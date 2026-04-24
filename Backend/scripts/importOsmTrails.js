import "dotenv/config";
import osmtogeojson from "osmtogeojson";

import { connectDB, disconnectDB } from "../connection.js";
import OfficialTrail from "../models/officialTrail.js";
import { calculateStats } from "../services/aiAnalysis.js";
import {
  buildDefaultTrailMarks,
  deriveTrailPointLabels,
  inferOfficialTrailDifficulty,
  isFeaturedOfficialTrail,
} from "../services/trailEnrichment.js";

const OVERPASS_ENDPOINTS = [
  String(
    process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter",
  ).trim(),
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
].filter(Boolean);
const OVERPASS_REQUEST_TIMEOUT_MS = Number(
  process.env.OVERPASS_REQUEST_TIMEOUT_MS || 90000,
);
const OVERPASS_QUERY_TIMEOUT_SECONDS = Number(
  process.env.OVERPASS_QUERY_TIMEOUT_SECONDS || 180,
);
const OVERPASS_USER_AGENT =
  process.env.OVERPASS_USER_AGENT ||
  "HackGorski12/1.0 (contact: github.com/KameZh/HackGorski12)";
const OVERPASS_FROM = process.env.OVERPASS_FROM || "noreply@hackgorski.local";
const SUPPORTED_ROUTE_TAGS = new Set(["hiking", "foot", "walking"]);

const OVERPASS_QUERY = `[out:json][timeout:${Math.max(30, OVERPASS_QUERY_TIMEOUT_SECONDS)}];
(
  area["ISO3166-1"="BG"][admin_level=2];
  area["name:en"="Bulgaria"][admin_level=2];
  area["name"="Bulgaria"][admin_level=2];
  area["name"="България"][admin_level=2];
)->.a;
relation["type"="route"]["route"~"^(hiking|foot|walking)$"](area.a);
(._;>>;);
out geom;`;

function normalizeString(value) {
  return String(value || "").trim();
}

function buildTagSources(feature) {
  const direct =
    feature?.properties?.tags && typeof feature.properties.tags === "object"
      ? feature.properties.tags
      : {};

  const relationTags = Array.isArray(feature?.properties?.relations)
    ? feature.properties.relations
        .map((entry) => entry?.reltags || entry?.tags || null)
        .filter((entry) => entry && typeof entry === "object")
    : [];

  return [direct, ...relationTags];
}

function readTag(feature, keys = []) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  const sources = buildTagSources(feature);

  for (const source of sources) {
    for (const key of keyList) {
      const value = source?.[key];
      if (value != null && String(value).trim()) {
        return String(value).trim();
      }
    }
  }

  return "";
}

function isHikingFeature(feature) {
  const tagSources = buildTagSources(feature);
  return tagSources.some((tags) =>
    SUPPORTED_ROUTE_TAGS.has(normalizeString(tags?.route).toLowerCase()),
  );
}

function inferColourType({ colour, marked, trailVisibility }) {
  const markedValue = normalizeString(marked).toLowerCase();
  const visibilityValue = normalizeString(trailVisibility).toLowerCase();
  if (
    ["no", "false", "bad", "none", "unmarked"].includes(markedValue) ||
    ["no", "bad", "horrible", "none"].includes(visibilityValue)
  ) {
    return "unmarked";
  }

  const normalizedColour = normalizeString(colour).toLowerCase();
  if (!normalizedColour) return "unmarked";

  if (
    normalizedColour.includes("red") ||
    /#(?:e00|d00|dc2626|ff0000|c00)\b/i.test(normalizedColour)
  ) {
    return "red";
  }
  if (
    normalizedColour.includes("blue") ||
    /#(?:00f|2563eb|1d4ed8|0000ff)\b/i.test(normalizedColour)
  ) {
    return "blue";
  }
  if (
    normalizedColour.includes("green") ||
    /#(?:0f0|22c55e|16a34a|008000|00ff00)\b/i.test(normalizedColour)
  ) {
    return "green";
  }
  if (
    normalizedColour.includes("yellow") ||
    /#(?:ff0|ffd700|facc15|eab308|ffff00)\b/i.test(normalizedColour)
  ) {
    return "yellow";
  }
  if (
    normalizedColour.includes("white") ||
    /#(?:fff|ffffff|f8fafc)\b/i.test(normalizedColour)
  ) {
    return "white";
  }
  if (
    normalizedColour.includes("black") ||
    /#(?:000|000000|111827)\b/i.test(normalizedColour)
  ) {
    return "black";
  }

  return "unmarked";
}

function toFeatureTrailDoc(feature, index) {
  const geometry = feature?.geometry;
  if (!geometry) return null;
  if (geometry.type !== "LineString" && geometry.type !== "MultiLineString") {
    return null;
  }
  if (!isHikingFeature(feature)) return null;

  const osmType = normalizeString(feature?.properties?.type || "feature");
  const osmNumericId = normalizeString(feature?.properties?.id || index + 1);
  const osmId = `${osmType}:${osmNumericId}`;

  const ref = readTag(feature, ["ref"]);
  const nameBg = readTag(feature, ["name:bg"]);
  const nameEn = readTag(feature, ["name:en"]);
  const fallbackName = readTag(feature, ["name"]);
  const displayName =
    normalizeString(nameBg) ||
    normalizeString(fallbackName) ||
    normalizeString(nameEn) ||
    normalizeString(ref) ||
    `OSM trail ${osmId}`;

  const osmColour = readTag(feature, [
    "colour",
    "color",
    "osm:relation:colour",
    "osmc:colour",
  ]);
  const marked = readTag(feature, ["marked"]);
  const trailVisibility = readTag(feature, ["trail_visibility"]);
  const osmMarking = normalizeString(marked || trailVisibility);
  const colourType = inferColourType({
    colour: osmColour,
    marked,
    trailVisibility,
  });

  const source = isFeaturedOfficialTrail({
    ref,
    name: displayName,
    name_bg: nameBg,
    name_en: nameEn,
  })
    ? "osm_featured"
    : "osm";

  const geojsonFeature = {
    type: "Feature",
    geometry,
    properties: {
      osm_id: osmId,
      ref: normalizeString(ref),
      source,
      name_bg: normalizeString(nameBg),
      name_en: normalizeString(nameEn),
      osm_colour: normalizeString(osmColour),
      marked: normalizeString(marked),
      trail_visibility: normalizeString(trailVisibility),
      network: normalizeString(readTag(feature, ["network"])),
      colour_type: colourType,
    },
  };

  const stats = calculateStats(geojsonFeature);
  const pointLabels = deriveTrailPointLabels(geojsonFeature);
  const trailMarks = buildDefaultTrailMarks({
    geojson: geojsonFeature,
    colourType,
    osmColour,
    osmMarking,
  });

  return {
    source,
    osm_id: osmId,
    name: displayName,
    ref: normalizeString(ref),
    name_bg: normalizeString(nameBg),
    name_en: normalizeString(nameEn),
    difficulty: inferOfficialTrailDifficulty({
      stats,
      network: readTag(feature, ["network"]),
      ref,
      name: displayName,
      name_bg: nameBg,
      name_en: nameEn,
    }),
    description: normalizeString(readTag(feature, ["description"])),
    ...pointLabels,
    osm_colour: normalizeString(osmColour),
    osm_marking: osmMarking,
    colour_type: colourType,
    network: normalizeString(readTag(feature, ["network"])),
    startCoordinates:
      Array.isArray(stats?.startCoordinates) &&
      stats.startCoordinates.length === 2
        ? stats.startCoordinates
        : null,
    endCoordinates:
      Array.isArray(stats?.endCoordinates) && stats.endCoordinates.length === 2
        ? stats.endCoordinates
        : null,
    geojson: geojsonFeature,
    geom: geometry,
    stats,
    trailMarks,
  };
}

function toWayCoordinates(way, nodeCoordinatesById = new Map()) {
  let coordinates = Array.isArray(way?.geometry)
    ? way.geometry
        .map((point) => [Number(point?.lon), Number(point?.lat)])
        .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))
    : [];

  if (
    coordinates.length < 2 &&
    Array.isArray(way?.nodes) &&
    way.nodes.length >= 2
  ) {
    coordinates = way.nodes
      .map((nodeId) => nodeCoordinatesById.get(Number(nodeId)) || null)
      .filter((coords) => Array.isArray(coords) && coords.length === 2);
  }

  return coordinates.length >= 2 ? coordinates : null;
}

function buildDocsFromRawRelations(elements = []) {
  const nodeCoordinatesById = new Map();
  for (const element of elements) {
    if (element?.type !== "node") continue;
    const lon = Number(element?.lon);
    const lat = Number(element?.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    nodeCoordinatesById.set(Number(element.id), [lon, lat]);
  }

  const wayCoordinatesById = new Map();
  for (const element of elements) {
    if (element?.type !== "way") continue;
    const coordinates = toWayCoordinates(element, nodeCoordinatesById);
    if (!coordinates) continue;
    wayCoordinatesById.set(Number(element.id), coordinates);
  }

  const docs = [];
  function toMemberCoordinates(member) {
    if (!Array.isArray(member?.geometry)) return null;

    const coordinates = member.geometry
      .map((point) => [Number(point?.lon), Number(point?.lat)])
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));

    return coordinates.length >= 2 ? coordinates : null;
  }
  for (const element of elements) {
    if (element?.type !== "relation") continue;

    const routeTag = normalizeString(element?.tags?.route).toLowerCase();
    if (!SUPPORTED_ROUTE_TAGS.has(routeTag)) continue;

    const members = Array.isArray(element?.members) ? element.members : [];
    const segments = [];

    for (const member of members) {
      if (member?.type !== "way") continue;
      const memberCoordinates =
        toMemberCoordinates(member) ||
        wayCoordinatesById.get(Number(member.ref));
      if (memberCoordinates?.length >= 2) {
        segments.push(memberCoordinates);
      }
    }

    if (!segments.length) continue;

    const geometry =
      segments.length === 1
        ? { type: "LineString", coordinates: segments[0] }
        : { type: "MultiLineString", coordinates: segments };

    const tags =
      element?.tags && typeof element.tags === "object" ? element.tags : {};
    const ref = normalizeString(tags.ref);
    const nameBg = normalizeString(tags["name:bg"]);
    const nameEn = normalizeString(tags["name:en"]);
    const fallbackName = normalizeString(tags.name);
    const osmId = `relation:${normalizeString(element.id)}`;
    const displayName =
      nameBg || fallbackName || nameEn || ref || `OSM trail ${osmId}`;

    const osmColour = normalizeString(
      tags.colour ||
        tags.color ||
        tags["osm:relation:colour"] ||
        tags["osmc:colour"],
    );
    const marked = normalizeString(tags.marked);
    const trailVisibility = normalizeString(tags.trail_visibility);
    const colourType = inferColourType({
      colour: osmColour,
      marked,
      trailVisibility,
    });

    const source = isFeaturedOfficialTrail({
      ref,
      name: displayName,
      name_bg: nameBg,
      name_en: nameEn,
    })
      ? "osm_featured"
      : "osm";

    const geojsonFeature = {
      type: "Feature",
      geometry,
      properties: {
        osm_id: osmId,
        ref,
        source,
        name_bg: nameBg,
        name_en: nameEn,
        osm_colour: osmColour,
        marked,
        trail_visibility: trailVisibility,
        network: normalizeString(tags.network),
        colour_type: colourType,
      },
    };

    const stats = calculateStats(geojsonFeature);
    const osmMarking = marked || trailVisibility;
    const pointLabels = deriveTrailPointLabels(geojsonFeature);
    const trailMarks = buildDefaultTrailMarks({
      geojson: geojsonFeature,
      colourType,
      osmColour,
      osmMarking,
    });

    docs.push({
      source,
      osm_id: osmId,
      name: displayName,
      ref,
      name_bg: nameBg,
      name_en: nameEn,
      difficulty: inferOfficialTrailDifficulty({
        stats,
        network: tags.network,
        ref,
        name: displayName,
        name_bg: nameBg,
        name_en: nameEn,
      }),
      description: normalizeString(tags.description),
      ...pointLabels,
      osm_colour: osmColour,
      osm_marking: osmMarking,
      colour_type: colourType,
      network: normalizeString(tags.network),
      startCoordinates:
        Array.isArray(stats?.startCoordinates) &&
        stats.startCoordinates.length === 2
          ? stats.startCoordinates
          : null,
      endCoordinates:
        Array.isArray(stats?.endCoordinates) &&
        stats.endCoordinates.length === 2
          ? stats.endCoordinates
          : null,
      geojson: geojsonFeature,
      geom: geometry,
      stats,
      trailMarks,
    });
  }

  return docs;
}

function buildOverpassRequests(query) {
  return [
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json,text/plain,*/*",
        "User-Agent": OVERPASS_USER_AGENT,
        From: OVERPASS_FROM,
      },
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
    },
    {
      headers: {
        "Content-Type": "text/plain; charset=UTF-8",
        Accept: "application/json,text/plain,*/*",
        "User-Agent": OVERPASS_USER_AGENT,
        From: OVERPASS_FROM,
      },
      method: "POST",
      body: query,
    },
    {
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": OVERPASS_USER_AGENT,
        From: OVERPASS_FROM,
      },
      method: "GET",
      body: null,
      queryString: `data=${encodeURIComponent(query)}`,
    },
  ];
}

async function parseOverpassJson(response) {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON received: ${raw.slice(0, 4000)}`);
  }
}

async function fetchOverpassData() {
  const requestVariants = buildOverpassRequests(OVERPASS_QUERY);
  const attempts = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let i = 0; i < requestVariants.length; i += 1) {
      const variant = requestVariants[i];
      const controller = new AbortController();
      const timeoutHandle = setTimeout(
        () => controller.abort(),
        Math.max(5000, OVERPASS_REQUEST_TIMEOUT_MS),
      );

      console.log(
        `Overpass attempt ${attempts.length + 1}: ${endpoint} (payload variant ${i + 1})`,
      );

      try {
        const requestUrl =
          variant.method === "GET" && variant.queryString
            ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}${variant.queryString}`
            : endpoint;

        const response = await fetch(requestUrl, {
          method: variant.method || "POST",
          headers: variant.headers,
          body: variant.body,
          signal: controller.signal,
        });
        clearTimeout(timeoutHandle);

        if (!response.ok) {
          const raw = await response.text();
          attempts.push(
            `${endpoint} [variant ${i + 1}] -> ${response.status} ${raw.slice(0, 220)}`,
          );
          continue;
        }

        return await parseOverpassJson(response);
      } catch (error) {
        clearTimeout(timeoutHandle);
        attempts.push(
          `${endpoint} [variant ${i + 1}] -> ${error?.message || String(error)}`,
        );
      }
    }
  }

  throw new Error(
    `Overpass request failed on all endpoints. Attempts: ${attempts.join(" | ")}`,
  );
}

async function runImport() {
  console.log("Connecting to database...");
  await connectDB();

  try {
    console.log("Requesting hiking relations from Overpass API...");
    const osmJson = await fetchOverpassData();
    const elements = Array.isArray(osmJson?.elements) ? osmJson.elements : [];
    const routeRelations = elements.filter(
      (entry) =>
        entry?.type === "relation" &&
        SUPPORTED_ROUTE_TAGS.has(
          normalizeString(entry?.tags?.route).toLowerCase(),
        ),
    );
    console.log(
      `Overpass returned ${elements.length} elements (${routeRelations.length} hiking/foot relations).`,
    );
    if (routeRelations.length) {
      const sampleMembers = Array.isArray(routeRelations[0]?.members)
        ? routeRelations[0].members
        : [];
      const memberTypeCounts = sampleMembers.reduce((acc, member) => {
        const memberType = normalizeString(
          member?.type || "unknown",
        ).toLowerCase();
        acc[memberType] = (acc[memberType] || 0) + 1;
        return acc;
      }, {});
      const relationsWithWayMembers = routeRelations.filter((relation) =>
        Array.isArray(relation?.members)
          ? relation.members.some(
              (member) => normalizeString(member?.type).toLowerCase() === "way",
            )
          : false,
      ).length;
      console.log(
        `Sample route member type counts: ${JSON.stringify(memberTypeCounts)}; relations with direct way members: ${relationsWithWayMembers}.`,
      );
    }

    console.log("Converting OSM JSON to GeoJSON...");
    const geojson = osmtogeojson(osmJson);
    const features = Array.isArray(geojson?.features) ? geojson.features : [];
    const lineFeatures = features.filter(
      (feature) =>
        feature?.geometry?.type === "LineString" ||
        feature?.geometry?.type === "MultiLineString",
    ).length;
    const relationFeatures = features.filter(
      (feature) =>
        normalizeString(feature?.properties?.type).toLowerCase() === "relation",
    );
    const relationLineFeatures = relationFeatures.filter(
      (feature) =>
        feature?.geometry?.type === "LineString" ||
        feature?.geometry?.type === "MultiLineString",
    ).length;
    console.log(
      `GeoJSON contains ${features.length} features (${lineFeatures} line or multiline).`,
    );
    console.log(
      `GeoJSON relation features: ${relationFeatures.length} (${relationLineFeatures} line or multiline).`,
    );

    const docsByOsmId = new Map();
    for (let i = 0; i < features.length; i += 1) {
      const doc = toFeatureTrailDoc(features[i], i);
      if (!doc) continue;
      if (!docsByOsmId.has(doc.osm_id)) {
        docsByOsmId.set(doc.osm_id, doc);
      }
    }

    let docs = Array.from(docsByOsmId.values());
    if (!docs.length && routeRelations.length) {
      console.log(
        "No valid trail docs from GeoJSON relation parsing. Falling back to raw OSM relation geometry.",
      );
      docs = buildDocsFromRawRelations(elements);
    }
    const featuredCount = docs.filter(
      (doc) => doc.source === "osm_featured",
    ).length;

    console.log(
      `Prepared ${docs.length} OSM trail sections (${featuredCount} featured).`,
    );

    console.log("Replacing official trail collection...");
    await OfficialTrail.deleteMany({});

    if (docs.length) {
      await OfficialTrail.insertMany(docs, { ordered: false });
    }

    console.log("OSM trail import finished successfully.");
  } finally {
    await disconnectDB();
  }
}

runImport().catch((error) => {
  console.error("OSM import failed:", error);
  process.exit(1);
});
