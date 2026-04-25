import "dotenv/config";
import express from "express";
import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";
import cors from "cors";
import checkUser from "./middleware.js";
import { connectDB, disconnectDB, isDatabaseReady } from "./connection.js";
import Trail from "./models/trail.js";
import OfficialTrail from "./models/officialTrail.js";
import Ping from "./models/ping.js";
import PhotoPing from "./models/photoPing.js";
import TrashCluster from "./models/trashCluster.js";
import User from "./models/user.js";
import Hut from "./models/hut.js";
import { calculateStats, processRouteAI } from "./services/aiAnalysis.js";
import { isFeaturedOfficialTrail } from "./services/trailEnrichment.js";

const port = process.env.PORT || 5174;
const nodeEnv = String(process.env.NODE_ENV || "development").toLowerCase();
const configuredOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const allowAllOrigins =
  nodeEnv !== "production" && configuredOrigins.length === 0;
const enableAIAnalysis =
  String(
    process.env.ENABLE_AI_ANALYSIS ||
      (nodeEnv === "production" ? "false" : "true"),
  ).toLowerCase() === "true";
const isVercelRuntime = Boolean(process.env.VERCEL);
const isMongoObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ""));
const PHOTO_PING_CATEGORIES = new Set([
  "viewpoint",
  "trail_condition",
  "marking",
  "water_source",
  "hazard",
  "memory",
]);

function normalizePhotoPingPayload(body = {}) {
  const photoUrl = String(body.photoUrl || body.webPath || "").trim();
  const description = String(body.description || "").trim().slice(0, 200);
  const coordinates = Array.isArray(body.coordinates)
    ? body.coordinates.map((value) => Number(value))
    : [];
  const rawCategory = String(body.photoCategory || "memory").trim();
  const photoCategory = PHOTO_PING_CATEGORIES.has(rawCategory)
    ? rawCategory
    : "memory";
  const trailId = isMongoObjectId(body.trailId) ? String(body.trailId) : "";

  return { photoUrl, description, coordinates, photoCategory, trailId };
}

const app = express();
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowAllOrigins || configuredOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "ngrok-skip-browser-warning",
  ],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.disable("x-powered-by");
app.use(express.json({ limit: "6mb" }));
app.use(clerkMiddleware());

app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    env: nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.get("/api/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    env: nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.get("/readyz", (req, res) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({
      status: "not_ready",
      database: "disconnected",
    });
  }

  return res.status(200).json({
    status: "ready",
    database: "connected",
  });
});

app.get("/api/readyz", (req, res) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({
      status: "not_ready",
      database: "disconnected",
    });
  }

  return res.status(200).json({
    status: "ready",
    database: "connected",
  });
});

const BADGE_TIERS = {
  trailers: [
    { min: 20, name: "Senior" },
    { min: 10, name: "Junior" },
    { min: 3, name: "Rookie" },
  ],
  contribution: [
    { min: 20, name: "Country guide" },
    { min: 10, name: "Local guide" },
    { min: 3, name: "New guide" },
  ],
  campaign: [
    { min: 20, name: "Basically organizer" },
    { min: 10, name: "Helper" },
    { min: 3, name: "Volunteer" },
  ],
};

function pickTier(category, value = 0) {
  const tiers = BADGE_TIERS[category] || [];
  const found = tiers.find((t) => value >= t.min);
  return found?.name || null;
}

async function updateBadgeProgress(userId, increments = {}) {
  const user = await User.findOne({ clerkId: userId });
  if (!user) return null;

  user.badgeProgress = user.badgeProgress || {};
  const p = user.badgeProgress;
  p.trailCompletions =
    (p.trailCompletions || 0) + (increments.trailCompletions || 0);
  p.createdTrails = (p.createdTrails || 0) + (increments.createdTrails || 0);
  p.campaignPoints = (p.campaignPoints || 0) + (increments.campaignPoints || 0);

  p.awarded = p.awarded || {};
  p.awarded.trailers = pickTier("trailers", p.trailCompletions);
  p.awarded.contribution = pickTier("contribution", p.createdTrails);
  p.awarded.campaign = pickTier("campaign", p.campaignPoints);

  await user.save();
  return user;
}

function extractCoordinatesFromGeojson(geojson) {
  if (!geojson || typeof geojson !== "object") return [];
  if (geojson.type === "LineString")
    return Array.isArray(geojson.coordinates) ? geojson.coordinates : [];
  if (geojson.type === "MultiLineString") {
    return Array.isArray(geojson.coordinates)
      ? geojson.coordinates.flatMap((line) => (Array.isArray(line) ? line : []))
      : [];
  }
  if (geojson.type === "Feature")
    return extractCoordinatesFromGeojson(geojson.geometry);
  if (geojson.type === "FeatureCollection") {
    return Array.isArray(geojson.features)
      ? geojson.features.flatMap((feature) =>
          extractCoordinatesFromGeojson(feature?.geometry),
        )
      : [];
  }
  return [];
}

function deriveTrailStartEndCenter(geojson) {
  const coords = extractCoordinatesFromGeojson(geojson);
  if (!coords.length) {
    return {
      startCoordinates: null,
      endCoordinates: null,
      centerCoordinates: null,
    };
  }

  const startCoordinates = [Number(coords[0][0]), Number(coords[0][1])];
  const endCoordinates = [
    Number(coords[coords.length - 1][0]),
    Number(coords[coords.length - 1][1]),
  ];
  const centerCoordinates = [
    coords.reduce((sum, point) => sum + Number(point[0]), 0) / coords.length,
    coords.reduce((sum, point) => sum + Number(point[1]), 0) / coords.length,
  ];

  return {
    startCoordinates,
    endCoordinates,
    centerCoordinates,
  };
}

function deriveTrailPointLabels(geojson) {
  const coords = extractCoordinatesFromGeojson(geojson);
  if (!coords.length) return { startPoint: "", endPoint: "", highestPoint: "" };

  const fmt = (c) =>
    `${Math.abs(c[1]).toFixed(5)}°${c[1] >= 0 ? "N" : "S"}, ${Math.abs(c[0]).toFixed(5)}°${c[0] >= 0 ? "E" : "W"}`;
  const startPoint = fmt(coords[0]);
  const endPoint = fmt(coords[coords.length - 1]);

  let maxElev = null;
  for (const c of coords) {
    if (
      c.length >= 3 &&
      Number.isFinite(c[2]) &&
      (maxElev === null || c[2] > maxElev)
    ) {
      maxElev = c[2];
    }
  }
  const highestPoint = maxElev !== null ? `${Math.round(maxElev)} m` : "";

  return { startPoint, endPoint, highestPoint };
}

const TRAIL_MARK_COLOURS = new Set([
  "red",
  "blue",
  "green",
  "yellow",
  "white",
  "black",
  "unmarked",
]);

function normalizeTrailMarks(trailMarks, geojson) {
  if (!Array.isArray(trailMarks) || !trailMarks.length) return [];

  const coords = extractCoordinatesFromGeojson(geojson);
  const maxIndex = Math.max(0, coords.length - 1);

  return trailMarks
    .map((entry, index) => {
      const rawColour = normalizeStringValue(
        entry?.colourType || entry?.colour_type,
      ).toLowerCase();
      if (!TRAIL_MARK_COLOURS.has(rawColour)) return null;

      const rawStart = Number(entry?.startIndex);
      const rawEnd = Number(entry?.endIndex);
      if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) return null;

      const startIndex = Math.max(
        0,
        Math.min(maxIndex, Math.round(Math.min(rawStart, rawEnd))),
      );
      const endIndex = Math.max(
        startIndex,
        Math.min(maxIndex, Math.round(Math.max(rawStart, rawEnd))),
      );

      return {
        name:
          normalizeStringValue(entry?.name).slice(0, 80) ||
          `Sector ${index + 1}`,
        description: normalizeStringValue(entry?.description).slice(0, 300),
        colourType: rawColour,
        startIndex,
        endIndex,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex)
    .slice(0, 200);
}

function normalizeStringValue(value) {
  return String(value || "").trim();
}

function inferColourTypeFromValues({
  colourType,
  osmColour,
  osmMarking,
  trailVisibility,
}) {
  const normalizedColourType = normalizeStringValue(colourType).toLowerCase();
  if (
    ["red", "blue", "green", "yellow", "white", "black", "unmarked"].includes(
      normalizedColourType,
    )
  ) {
    return normalizedColourType;
  }

  const marking = normalizeStringValue(osmMarking).toLowerCase();
  const visibility = normalizeStringValue(trailVisibility).toLowerCase();
  if (
    ["no", "false", "bad", "none", "unmarked"].includes(marking) ||
    ["no", "bad", "horrible", "none"].includes(visibility)
  ) {
    return "unmarked";
  }

  const colour = normalizeStringValue(osmColour).toLowerCase();
  if (!colour) return "unmarked";

  if (
    colour.includes("red") ||
    /#(?:e00|d00|dc2626|ff0000|c00)\b/i.test(colour)
  ) {
    return "red";
  }
  if (colour.includes("blue") || /#(?:00f|2563eb|1d4ed8)\b/i.test(colour)) {
    return "blue";
  }
  if (
    colour.includes("green") ||
    /#(?:0f0|22c55e|16a34a|008000)\b/i.test(colour)
  ) {
    return "green";
  }
  if (
    colour.includes("yellow") ||
    /#(?:ff0|ffd700|facc15|eab308)\b/i.test(colour)
  ) {
    return "yellow";
  }
  if (colour.includes("white") || /#(?:fff|ffffff|f8fafc)\b/i.test(colour)) {
    return "white";
  }
  if (colour.includes("black") || /#(?:000|000000|111827)\b/i.test(colour)) {
    return "black";
  }

  return "unmarked";
}

function extractLineGeometries(geojson) {
  if (!geojson || typeof geojson !== "object") return [];

  if (geojson.type === "LineString" || geojson.type === "MultiLineString") {
    return [geojson];
  }

  if (geojson.type === "Feature") {
    return extractLineGeometries(geojson.geometry);
  }

  if (geojson.type === "FeatureCollection") {
    return Array.isArray(geojson.features)
      ? geojson.features.flatMap((feature) =>
          extractLineGeometries(feature?.geometry),
        )
      : [];
  }

  return [];
}

function sampleCoordinates(coordinates = [], maxPoints = 120) {
  if (!Array.isArray(coordinates) || coordinates.length <= maxPoints) {
    return coordinates;
  }

  const lastIndex = coordinates.length - 1;
  const sampled = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const sourceIndex = Math.round((i / (maxPoints - 1)) * lastIndex);
    sampled.push(coordinates[sourceIndex]);
  }

  return sampled;
}

function simplifyMapGeometry(geometry, maxPoints = 120) {
  if (!geometry || typeof geometry !== "object") return null;

  if (geometry.type === "Feature") {
    return simplifyMapGeometry(geometry.geometry, maxPoints);
  }

  if (geometry.type === "FeatureCollection") {
    const firstLine = Array.isArray(geometry.features)
      ? geometry.features
          .map((feature) => simplifyMapGeometry(feature?.geometry, maxPoints))
          .find(Boolean)
      : null;
    return firstLine || null;
  }

  if (geometry.type === "LineString") {
    return {
      type: "LineString",
      coordinates: sampleCoordinates(geometry.coordinates, maxPoints),
    };
  }

  if (geometry.type === "MultiLineString") {
    const lines = Array.isArray(geometry.coordinates)
      ? geometry.coordinates.filter(Array.isArray)
      : [];
    const lineBudget = Math.max(1, lines.length);
    const pointsPerLine = Math.max(2, Math.floor(maxPoints / lineBudget));

    return {
      type: "MultiLineString",
      coordinates: lines
        .map((line) => sampleCoordinates(line, pointsPerLine))
        .filter((line) => Array.isArray(line) && line.length >= 2),
    };
  }

  return null;
}

function buildTrailSearchFilter(search) {
  if (!search) return null;

  return [
    { name: { $regex: search, $options: "i" } },
    { name_bg: { $regex: search, $options: "i" } },
    { name_en: { $regex: search, $options: "i" } },
    { ref: { $regex: search, $options: "i" } },
    { region: { $regex: search, $options: "i" } },
    { description: { $regex: search, $options: "i" } },
  ];
}

function normalizeTrailDocument(trailDoc) {
  const trail =
    trailDoc && typeof trailDoc.toObject === "function"
      ? trailDoc.toObject()
      : { ...(trailDoc || {}) };

  const derived = deriveTrailStartEndCenter(trail.geojson);

  if (
    !Array.isArray(trail.startCoordinates) ||
    trail.startCoordinates.length !== 2
  ) {
    trail.startCoordinates = derived.startCoordinates;
  }
  if (
    !Array.isArray(trail.endCoordinates) ||
    trail.endCoordinates.length !== 2
  ) {
    trail.endCoordinates = derived.endCoordinates;
  }

  trail.stats = trail.stats || {};
  if (
    !Array.isArray(trail.stats.centerCoordinates) ||
    trail.stats.centerCoordinates.length !== 2
  ) {
    trail.stats.centerCoordinates = derived.centerCoordinates;
  }

  trail.source = normalizeStringValue(trail.source) || "user";
  trail.averageAccuracy = Number(trail.averageAccuracy || 0);

  return trail;
}

async function attachClusterVoterProfiles(clusterPayload) {
  const clusters = Array.isArray(clusterPayload)
    ? clusterPayload.filter(Boolean)
    : clusterPayload
      ? [clusterPayload]
      : [];

  if (!clusters.length) {
    return Array.isArray(clusterPayload) ? [] : null;
  }

  const voterIds = [
    ...new Set(
      clusters
        .flatMap((cluster) =>
          Array.isArray(cluster.goneVotes) ? cluster.goneVotes : [],
        )
        .filter(Boolean)
        .map(String),
    ),
  ];

  let usersByClerkId = new Map();
  if (voterIds.length) {
    const users = await User.find({ clerkId: { $in: voterIds } })
      .select("clerkId username email")
      .lean();

    usersByClerkId = new Map(
      users.map((entry) => [String(entry.clerkId), entry]),
    );
  }

  const enriched = clusters.map((cluster) => {
    const goneVotes = Array.isArray(cluster.goneVotes)
      ? cluster.goneVotes.map(String)
      : [];

    const voterProfiles = goneVotes.map((userId) => {
      const profile = usersByClerkId.get(String(userId));
      const emailPrefix = profile?.email
        ? String(profile.email).split("@")[0]
        : "";
      return {
        userId,
        name:
          profile?.username ||
          emailPrefix ||
          `User ${String(userId).slice(0, 6)}`,
      };
    });

    return {
      ...cluster,
      voterProfiles,
    };
  });

  return Array.isArray(clusterPayload) ? enriched : enriched[0] || null;
}

app.get("/api/user/profile", requireAuth(), checkUser, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const user = await User.findOne({ clerkId: userId });
    res.json(user);
  } catch (err) {
    console.error("User profile error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

app.post("/api/trails", requireAuth(), checkUser, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const {
      geojson,
      name,
      region,
      difficulty,
      description,
      equipment,
      resources,
      trailMarks,
    } = req.body;
    if (!geojson) return res.status(400).json({ error: "geojson is required" });
    if (!name) return res.status(400).json({ error: "name is required" });

    const { userId } = getAuth(req);
    const stats = calculateStats(geojson);
    const derivedCoords = deriveTrailStartEndCenter(geojson);
    const startCoordinates =
      Array.isArray(stats?.startCoordinates) &&
      stats.startCoordinates.length === 2
        ? stats.startCoordinates
        : derivedCoords.startCoordinates;
    const endCoordinates =
      Array.isArray(stats?.endCoordinates) && stats.endCoordinates.length === 2
        ? stats.endCoordinates
        : derivedCoords.endCoordinates;

    const trail = await Trail.create({
      source: "user",
      userId,
      username: req.dbUser?.username || "",
      name,
      region: region || "",
      difficulty: difficulty || "moderate",
      description: description || "",
      equipment: equipment || "",
      resources: resources || "",
      ...deriveTrailPointLabels(geojson),
      startCoordinates,
      endCoordinates,
      geojson,
      mapGeometry: simplifyMapGeometry(geojson),
      stats,
      trailMarks: normalizeTrailMarks(trailMarks, geojson),
      ai: { status: "pending" },
    });

    if (enableAIAnalysis) {
      processRouteAI(trail._id);
    }

    await updateBadgeProgress(userId, { createdTrails: 1 });

    res.status(201).json(trail);
  } catch (err) {
    console.error("Trail publish error:", err);
    res.status(500).json({ error: "Failed to publish trail" });
  }
});

app.get("/api/trails/mine", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const trails = await Trail.find({ userId })
      .sort({ createdAt: -1 })
      .select("-reviews");
    res.json(trails);
  } catch (err) {
    console.error("My trails error:", err);
    res.status(500).json({ error: "Failed to fetch your trails" });
  }
});

app.post("/api/badges/trailers/complete", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const amount = Number(req.body?.amount || 1);
    const user = await updateBadgeProgress(userId, {
      trailCompletions: amount,
    });
    res.json({ badgeProgress: user?.badgeProgress || null });
  } catch (err) {
    console.error("Badge trailer update error:", err);
    res.status(500).json({ error: "Failed to update trailer badge" });
  }
});

app.post(
  "/api/badges/campaign/participate",
  requireAuth(),
  async (req, res) => {
    try {
      const { userId } = getAuth(req);
      const amount = Number(req.body?.amount || 1);
      const user = await updateBadgeProgress(userId, {
        campaignPoints: amount,
      });
      res.json({ badgeProgress: user?.badgeProgress || null });
    } catch (err) {
      console.error("Badge campaign update error:", err);
      res.status(500).json({ error: "Failed to update campaign badge" });
    }
  },
);

app.get("/api/trails/geojson", async (req, res) => {
  try {
    const userTrailFields =
      "geojson geom mapGeometry name name_bg name_en ref source difficulty osm_colour osm_marking colour_type network stats";
    const officialTrailFields =
      "mapGeometry name name_bg name_en ref source difficulty osm_colour osm_marking colour_type network stats";

    const [userTrails, officialTrails] = await Promise.all([
      Trail.find({}).select(userTrailFields).lean(),
      OfficialTrail.find({ mapGeometry: { $ne: null } })
        .select(officialTrailFields)
        .lean(),
    ]);

    const trails = [...userTrails, ...officialTrails];

    const features = trails.flatMap((trail) => {
      const storedGeometry =
        trail.mapGeometry && typeof trail.mapGeometry === "object"
          ? [trail.mapGeometry]
          : trail.geom && typeof trail.geom === "object"
            ? [simplifyMapGeometry(trail.geom)]
            : [];
      const geometries = extractLineGeometries(trail.geojson);
      const geometryCandidates = storedGeometry.length
        ? storedGeometry
        : geometries;

      if (!geometryCandidates.length) return [];

      const inferredColourType = inferColourTypeFromValues({
        colourType: trail.colour_type,
        osmColour: trail.osm_colour,
        osmMarking: trail.osm_marking,
      });

      const normalizedSource = normalizeStringValue(trail.source) || "user";
      const source =
        normalizedSource !== "user" &&
        isFeaturedOfficialTrail({
          ref: trail.ref,
          name: trail.name,
          name_bg: trail.name_bg,
          name_en: trail.name_en,
        })
          ? "osm_featured"
          : normalizedSource;

      return geometryCandidates.map((geometry) => ({
        type: "Feature",
        geometry,
        properties: {
          id: trail._id.toString(),
          name:
            normalizeStringValue(trail.name) ||
            normalizeStringValue(trail.name_bg) ||
            normalizeStringValue(trail.name_en) ||
            normalizeStringValue(trail.ref) ||
            "Unnamed trail",
          name_bg: normalizeStringValue(trail.name_bg),
          name_en: normalizeStringValue(trail.name_en),
          ref: normalizeStringValue(trail.ref),
          source,
          difficulty: normalizeStringValue(trail.difficulty) || "moderate",
          colour_type: inferredColourType,
          osm_colour: normalizeStringValue(trail.osm_colour),
          osm_marking: normalizeStringValue(trail.osm_marking),
          network: normalizeStringValue(trail.network),
          distance: trail.stats?.distance
            ? Number((trail.stats.distance / 1000).toFixed(2))
            : 0,
          elevation_gain: Number(trail.stats?.elevationGain || 0),
        },
      }));
    });

    res.json({ type: "FeatureCollection", features });
  } catch (err) {
    console.error("GeoJSON endpoint error:", err);
    res.status(500).json({ error: "Failed to fetch trails geojson" });
  }
});

app.get("/api/trails", async (req, res) => {
  try {
    const { search, difficulty, activity, sort } = req.query;
    const officialOnly =
      String(req.query.officialOnly || "").toLowerCase() === "true";
    const unmarkedOnly =
      String(req.query.unmarkedOnly || "").toLowerCase() === "true";
    const compact =
      String(req.query.compact || "").toLowerCase() === "true" ||
      String(req.query.includeGeometry || "").toLowerCase() === "false";
    const centerLng = Number(req.query.centerLng);
    const centerLat = Number(req.query.centerLat);
    const radiusKm = Number(req.query.radiusKm);
    const proximityMode = String(
      req.query.proximityMode || "start",
    ).toLowerCase();
    const userFilter = {};
    const officialFilter = {};

    if (difficulty && difficulty !== "all") {
      userFilter.difficulty = difficulty;
      officialFilter.difficulty = difficulty;
    }
    if (unmarkedOnly) {
      userFilter.colour_type = "unmarked";
      officialFilter.colour_type = "unmarked";
    }

    const searchFilter = buildTrailSearchFilter(search);
    if (searchFilter) {
      userFilter.$or = searchFilter;
      officialFilter.$or = searchFilter;
    }

    let sortOption = { createdAt: -1 };
    if (sort === "popular") sortOption = { averageAccuracy: -1 };
    if (sort === "newest" || sort === "new") sortOption = { createdAt: -1 };

    const userTrailsPromise = officialOnly
      ? Promise.resolve([])
      : Trail.find(userFilter)
          .sort(sortOption)
          .select(compact ? "-reviews -geojson -geom -mapGeometry" : "-reviews")
          .lean();
    const officialTrailsPromise = OfficialTrail.find(officialFilter)
      .sort(sortOption)
      .select(compact ? "-geojson -geom -mapGeometry" : "")
      .lean();

    const [userTrails, officialTrails] = await Promise.all([
      userTrailsPromise,
      officialTrailsPromise,
    ]);

    const normalized = [...userTrails, ...officialTrails].map(
      normalizeTrailDocument,
    );

    if (sort === "popular") {
      normalized.sort(
        (a, b) =>
          Number(b.averageAccuracy || 0) - Number(a.averageAccuracy || 0),
      );
    } else {
      normalized.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
    }

    const hasAreaFilter =
      Number.isFinite(centerLng) &&
      Number.isFinite(centerLat) &&
      Number.isFinite(radiusKm) &&
      radiusKm > 0;

    if (!hasAreaFilter) {
      res.json(normalized);
      return;
    }

    const centerCoords = [centerLng, centerLat];
    const radiusMeters = Math.min(Math.max(radiusKm, 0.1), 100) * 1000;
    const filtered = normalized.filter((trail) => {
      const anchor =
        proximityMode === "center"
          ? trail.stats?.centerCoordinates
          : trail.startCoordinates;
      if (!Array.isArray(anchor) || anchor.length !== 2) return false;
      return haversineMeters(centerCoords, anchor) <= radiusMeters;
    });

    res.json(filtered);
  } catch (err) {
    console.error("Trails list error:", err);
    res.status(500).json({ error: "Failed to fetch trails" });
  }
});

app.get("/api/trails/:id/start-readiness", async (req, res) => {
  try {
    const selectFields =
      "name startCoordinates geojson stats ai difficulty region";
    const trail =
      (await Trail.findById(req.params.id).select(selectFields)) ||
      (await OfficialTrail.findById(req.params.id).select(selectFields));
    if (!trail) return res.status(404).json({ error: "Trail not found" });

    const derived = deriveTrailStartEndCenter(trail.geojson);
    const startCoordinates =
      Array.isArray(trail.startCoordinates) &&
      trail.startCoordinates.length === 2
        ? trail.startCoordinates
        : derived.startCoordinates;

    if (!Array.isArray(startCoordinates) || startCoordinates.length !== 2) {
      return res
        .status(400)
        .json({ error: "Trail has no valid start coordinates" });
    }

    const userLng = Number(req.query.userLng);
    const userLat = Number(req.query.userLat);
    const hasUserLocation =
      Number.isFinite(userLng) && Number.isFinite(userLat);
    const maxDistanceMeters =
      Number(req.query.maxDistanceMeters) > 0
        ? Number(req.query.maxDistanceMeters)
        : 1000;

    const distanceToStartMeters = hasUserLocation
      ? Math.round(haversineMeters([userLng, userLat], startCoordinates))
      : null;

    const withinRange =
      distanceToStartMeters != null
        ? distanceToStartMeters <= maxDistanceMeters
        : false;

    res.json({
      trailId: trail._id,
      trailName: trail.name,
      startCoordinates,
      maxDistanceMeters,
      hasUserLocation,
      distanceToStartMeters,
      withinRange,
      ai: trail.ai || null,
      difficulty: trail.difficulty,
      region: trail.region,
      centerCoordinates:
        trail.stats?.centerCoordinates || derived.centerCoordinates || null,
    });
  } catch (err) {
    console.error("Trail start-readiness error:", err);
    res.status(500).json({ error: "Failed to validate trail start readiness" });
  }
});

app.post(
  "/api/trails/:id/complete",
  requireAuth(),
  checkUser,
  async (req, res) => {
    try {
      let trail = await Trail.findById(req.params.id);
      const officialTrail = trail
        ? null
        : await OfficialTrail.findById(req.params.id).select("_id name");
      if (!trail && !officialTrail) {
        return res.status(404).json({ error: "Trail not found" });
      }

      const { userId } = getAuth(req);

      if (officialTrail) {
        await updateBadgeProgress(userId, { trailCompletions: 1 });
        return res.json({
          success: true,
          reviewAdded: false,
          alreadyReviewed: false,
          averageAccuracy: 0,
          reviewsCount: 0,
          officialTrail: true,
        });
      }

      const accuracy = Number(req.body?.accuracy);
      const comment = String(req.body?.comment || "").trim();
      const hasRating =
        Number.isFinite(accuracy) && accuracy >= 1 && accuracy <= 5;

      let reviewAdded = false;
      const existing = trail.reviews.find((review) => review.userId === userId);
      if (hasRating && !existing) {
        trail.reviews.push({
          userId,
          username: req.dbUser?.username || "Anonymous",
          accuracy,
          comment,
        });
        trail.recalcAverageAccuracy();
        await trail.save();
        reviewAdded = true;
      }

      await updateBadgeProgress(userId, { trailCompletions: 1 });

      res.json({
        success: true,
        reviewAdded,
        alreadyReviewed: Boolean(existing),
        averageAccuracy: trail.averageAccuracy,
        reviewsCount: trail.reviews.length,
      });
    } catch (err) {
      console.error("Trail completion error:", err);
      res.status(500).json({ error: "Failed to complete trail" });
    }
  },
);

app.get("/api/trails/:id", async (req, res) => {
  try {
    const trail =
      (await Trail.findById(req.params.id)) ||
      (await OfficialTrail.findById(req.params.id));
    if (!trail) return res.status(404).json({ error: "Trail not found" });
    res.json(trail);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch trail" });
  }
});

app.get("/api/huts", async (req, res) => {
  try {
    const huts = await Hut.find({}).lean();
    res.json(huts);
  } catch (err) {
    console.error("Huts list error:", err);
    res.status(500).json({ error: "Failed to fetch huts" });
  }
});

app.put("/api/trails/:id", requireAuth(), async (req, res) => {
  try {
    const trail = await Trail.findById(req.params.id);
    if (!trail) return res.status(404).json({ error: "Trail not found" });
    if (trail.userId !== getAuth(req).userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to edit this trail" });
    }

    const allowed = [
      "name",
      "region",
      "difficulty",
      "description",
      "equipment",
      "resources",
      "trailMarks",
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === "trailMarks") {
          trail.trailMarks = normalizeTrailMarks(req.body.trailMarks, trail.geojson);
        } else {
          trail[key] = req.body[key];
        }
      }
    }

    await trail.save();
    res.json(trail);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update trail" });
  }
});

app.delete("/api/trails/:id", requireAuth(), async (req, res) => {
  try {
    const trail = await Trail.findById(req.params.id);
    if (!trail) return res.status(404).json({ error: "Trail not found" });
    if (trail.userId !== getAuth(req).userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this trail" });
    }

    await Trail.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete trail" });
  }
});

app.post(
  "/api/trails/:id/reviews",
  requireAuth(),
  checkUser,
  async (req, res) => {
    try {
      const { accuracy, comment } = req.body;
      if (!accuracy || accuracy < 1 || accuracy > 5) {
        return res
          .status(400)
          .json({ error: "Accuracy must be between 1 and 5" });
      }

      const trail = await Trail.findById(req.params.id);
      if (!trail) {
        const isOfficialTrail = await OfficialTrail.exists({
          _id: req.params.id,
        });
        if (isOfficialTrail) {
          return res.status(400).json({
            error: "Official routes do not support user reviews",
          });
        }
        return res.status(404).json({ error: "Trail not found" });
      }

      const reviewUserId = getAuth(req).userId;
      const existing = trail.reviews.find((r) => r.userId === reviewUserId);
      if (existing) {
        return res
          .status(400)
          .json({ error: "You have already reviewed this trail" });
      }

      trail.reviews.push({
        userId: reviewUserId,
        username: req.dbUser?.username || "Anonymous",
        accuracy: Number(accuracy),
        comment: comment || "",
      });

      trail.recalcAverageAccuracy();
      await trail.save();

      res.status(201).json(trail);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add review" });
    }
  },
);

app.get("/api/trails/:id/reviews", async (req, res) => {
  try {
    const trail = await Trail.findById(req.params.id).select(
      "reviews averageAccuracy",
    );
    if (!trail) {
      const isOfficialTrail = await OfficialTrail.exists({
        _id: req.params.id,
      });
      if (isOfficialTrail) {
        return res.json({ reviews: [], averageAccuracy: 0 });
      }
      return res.status(404).json({ error: "Trail not found" });
    }
    res.json({
      reviews: trail.reviews,
      averageAccuracy: trail.averageAccuracy,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

function haversineMeters([lon1, lat1], [lon2, lat2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function detectTrashClusters(newPing) {
  if (newPing.type !== "junk") return;

  const junkPings = await Ping.find({
    type: "junk",
    resolved: { $ne: true },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });

  const nearby = junkPings.filter(
    (p) => haversineMeters(newPing.coordinates, p.coordinates) <= 300,
  );

  if (nearby.length < 3) return;

  const nearbyIds = nearby.map((p) => p._id);

  const existing = await TrashCluster.findOne({
    resolved: { $ne: true },
    pingIds: { $in: nearbyIds },
  });

  if (existing) {
    const mergedIds = [
      ...new Set([...existing.pingIds.map(String), ...nearbyIds.map(String)]),
    ];
    const allPings = junkPings.filter((p) => mergedIds.includes(String(p._id)));
    const avgLng =
      allPings.reduce((s, p) => s + p.coordinates[0], 0) / allPings.length;
    const avgLat =
      allPings.reduce((s, p) => s + p.coordinates[1], 0) / allPings.length;

    existing.pingIds = allPings.map((p) => p._id);
    existing.pingCount = allPings.length;
    existing.coordinates = [avgLng, avgLat];
    existing.level = allPings.length >= 5 ? "event" : "clutter";
    if (existing.level === "event") {
      existing.description = `Trash cleanup needed! ${allPings.length} reports of litter in this area.`;
    }
    await existing.save();
  } else {
    const avgLng =
      nearby.reduce((s, p) => s + p.coordinates[0], 0) / nearby.length;
    const avgLat =
      nearby.reduce((s, p) => s + p.coordinates[1], 0) / nearby.length;
    const level = nearby.length >= 5 ? "event" : "clutter";

    await TrashCluster.create({
      level,
      coordinates: [avgLng, avgLat],
      pingIds: nearbyIds,
      pingCount: nearby.length,
      description:
        level === "event"
          ? `Trash cleanup needed! ${nearby.length} reports of litter in this area.`
          : `Warning: ${nearby.length} trash reports nearby. This area may need cleanup soon.`,
    });
  }
}

async function createPhotoPingHandler(req, res) {
  try {
    const { photoUrl, description, coordinates, photoCategory, trailId } =
      normalizePhotoPingPayload(req.body);

    if (!photoUrl) {
      return res.status(400).json({ error: "photoUrl is required" });
    }

    if (!photoUrl.startsWith("data:image/") && !photoUrl.startsWith("http")) {
      return res.status(400).json({ error: "Invalid photo data" });
    }

    if (
      coordinates.length !== 2 ||
      !Number.isFinite(coordinates[0]) ||
      !Number.isFinite(coordinates[1]) ||
      Math.abs(coordinates[0]) > 180 ||
      Math.abs(coordinates[1]) > 90
    ) {
      return res
        .status(400)
        .json({ error: "coordinates must be [longitude, latitude]" });
    }

    const { userId } = getAuth(req);
    const ping = await PhotoPing.create({
      trailId: trailId || null,
      userId,
      username: req.auth?.sessionClaims?.username || "Anonymous",
      type: "photo",
      description,
      photoUrl,
      photoCategory,
      coordinates,
      expiresAt: null,
    });

    return res.status(201).json(ping);
  } catch (err) {
    console.error("Photo ping create error:", err);
    if (err?.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    if (err?.name === "CastError") {
      return res.status(400).json({ error: "Invalid photo data" });
    }
    if (String(err?.message || "").includes("BSONObj size")) {
      return res.status(413).json({
        error: "Photo is too large. Please retake it or choose a smaller image.",
      });
    }
    return res.status(500).json({
      error:
        nodeEnv === "production"
          ? "Failed to create photo ping"
          : err?.message || "Failed to create photo ping",
    });
  }
}

app.post("/api/pings/photo", requireAuth(), createPhotoPingHandler);
app.post("/api/photo-pings", requireAuth(), createPhotoPingHandler);

app.get("/api/photo-pings", async (req, res) => {
  try {
    const filter = { resolved: { $ne: true } };
    if (req.query.trailId) filter.trailId = String(req.query.trailId);
    const photoPings = await PhotoPing.find(filter).sort({ createdAt: -1 });
    res.json(photoPings);
  } catch (err) {
    console.error("Photo pings list error:", err);
    res.status(500).json({ error: "Failed to fetch photo pings" });
  }
});

app.post(
  "/api/pings",
  requireAuth(),
  (req, res, next) => {
    if (req.body?.type === "photo") {
      return createPhotoPingHandler(req, res);
    }
    return checkUser(req, res, next);
  },
  async (req, res) => {
  try {
    const { trailId, type, description, coordinates, photoUrl, photoCategory } =
      req.body;
    const normalizedTrailId = String(trailId || "").trim();
    if (!type) return res.status(400).json({ error: "type is required" });
    if (
      !coordinates ||
      !Array.isArray(coordinates) ||
      coordinates.length !== 2
    ) {
      return res
        .status(400)
        .json({ error: "coordinates must be [longitude, latitude]" });
    }
    if (type === "photo" && !photoUrl) {
      return res.status(400).json({ error: "photoUrl is required" });
    }

    if (normalizedTrailId) {
      if (!isMongoObjectId(normalizedTrailId)) {
        return res.status(400).json({ error: "Invalid trail id" });
      }

      const trail =
        (await Trail.findById(normalizedTrailId).select("_id")) ||
        (await OfficialTrail.findById(normalizedTrailId).select("_id"));
      if (!trail) return res.status(404).json({ error: "Trail not found" });
    }

    const { userId } = getAuth(req);
    const ping = await Ping.create({
      trailId: normalizedTrailId || null,
      userId,
      username: req.dbUser?.username || "Anonymous",
      type,
      description: description || "",
      photoUrl: photoUrl || null,
      photoCategory: type === "photo" ? photoCategory || "memory" : null,
      coordinates,
      expiresAt: Ping.computeExpiresAt(type),
    });

    detectTrashClusters(ping).catch((err) =>
      console.error("Cluster detection error:", err),
    );

    res.status(201).json(ping);
  } catch (err) {
    console.error("Ping create error:", err);
    if (err?.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    if (err?.name === "CastError") {
      return res.status(400).json({ error: "Invalid ping data" });
    }
    if (String(err?.message || "").includes("BSONObj size")) {
      return res.status(413).json({
        error: "Photo is too large. Please retake it or choose a smaller image.",
      });
    }
    res.status(500).json({ error: "Failed to create ping" });
  }
  },
);

app.get("/api/pings", async (req, res) => {
  try {
    const filter = {
      resolved: { $ne: true },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    };
    if (req.query.trailId) filter.trailId = req.query.trailId;
    const pings = await Ping.find(filter).sort({ createdAt: -1 });
    res.json(pings);
  } catch (err) {
    console.error("Pings list error:", err);
    res.status(500).json({ error: "Failed to fetch pings" });
  }
});

app.post("/api/pings/:id/vote", requireAuth(), async (req, res) => {
  try {
    const ping = await Ping.findById(req.params.id);
    if (!ping) return res.status(404).json({ error: "Ping not found" });
    if (ping.resolved)
      return res.status(400).json({ error: "Already resolved" });

    const { userId } = getAuth(req);
    if (ping.goneVotes.includes(userId)) {
      return res.status(400).json({ error: "You already voted" });
    }

    ping.goneVotes.push(userId);
    if (ping.goneVotes.length >= 1) {
      ping.resolved = true;
    }
    await ping.save();
    res.json(ping);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to vote on ping" });
  }
});

app.delete("/api/pings/:id", requireAuth(), async (req, res) => {
  try {
    const ping = await Ping.findById(req.params.id);
    if (!ping) return res.status(404).json({ error: "Ping not found" });
    if (ping.userId !== getAuth(req).userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this ping" });
    }
    await Ping.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete ping" });
  }
});

app.get("/api/clusters", async (req, res) => {
  try {
    const clusters = await TrashCluster.find({ resolved: { $ne: true } })
      .sort({
        createdAt: -1,
      })
      .lean();

    const withVoters = await attachClusterVoterProfiles(clusters);
    res.json(withVoters);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch clusters" });
  }
});

app.post(
  "/api/clusters/:id/vote",
  requireAuth(),
  checkUser,
  async (req, res) => {
    try {
      const cluster = await TrashCluster.findById(req.params.id);
      if (!cluster) return res.status(404).json({ error: "Cluster not found" });
      if (cluster.resolved)
        return res.status(400).json({ error: "Already resolved" });

      const { userId } = getAuth(req);
      if (cluster.goneVotes.includes(userId)) {
        return res.status(400).json({ error: "You already voted" });
      }

      cluster.goneVotes.push(userId);
      const needed = cluster.level === "event" ? 5 : 3;
      if (cluster.goneVotes.length >= needed) {
        cluster.resolved = true;
        await Ping.updateMany(
          { _id: { $in: cluster.pingIds } },
          { $set: { resolved: true } },
        );
      }
      await cluster.save();

      const freshCluster = await TrashCluster.findById(cluster._id).lean();
      const withVoters = await attachClusterVoterProfiles(freshCluster);
      res.json(withVoters);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to vote on cluster" });
    }
  },
);

app.use((err, req, res, next) => {
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  if (err?.type === "entity.too.large" || err?.status === 413) {
    return res.status(413).json({
      error: "Photo is too large. Please retake it or choose a smaller image.",
    });
  }

  if (err?.status === 401) {
    return res.status(401).send("Unauthenticated!");
  }

  console.error(err?.stack || err);
  return res.status(500).json({ error: "Internal Server Error" });
});

app.get("/", function (req, res) {
  res.send("Pytechka backend is running.");
});

let server;

async function startServer() {
  try {
    await connectDB();
    server = app.listen(port, "0.0.0.0", () => {
      console.log(`Backend listening at http://localhost:${port}`);
    });
  } catch (err) {
    console.error("Failed to start backend:", err.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  if (!server) {
    await disconnectDB().catch(() => {});
    process.exit(0);
  }

  server.close(async () => {
    await disconnectDB().catch(() => {});
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 10000).unref();
}

export default app;
export { startServer, shutdown };

if (!isVercelRuntime) {
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  startServer();
}
