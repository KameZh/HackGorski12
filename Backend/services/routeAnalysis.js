import { readFileSync } from "fs";
import Trail from "../models/trail.js";

const ELEVATION_SAMPLE_LIMIT = Number(process.env.ELEVATION_SAMPLE_LIMIT || 36);
const elevationCache = new Map();

function readFrontendMapboxToken() {
  try {
    const envText = readFileSync(
      new URL("../../pytechka-frontend/.env", import.meta.url),
      "utf8",
    );
    const match = envText.match(/^\s*VITE_MAPBOX_TOKEN\s*=\s*(.+?)\s*$/m);
    return match?.[1]?.trim().replace(/^["']|["']$/g, "") || "";
  } catch {
    return "";
  }
}

const MAPBOX_ELEVATION_TOKEN =
  process.env.MAPBOX_TOKEN ||
  process.env.VITE_MAPBOX_TOKEN ||
  readFrontendMapboxToken();

export function calculateStats(geojson) {
  const coords = extractCoordinates(geojson);
  if (!coords || coords.length < 2) {
    return {
      distance: 0,
      elevationGain: 0,
      duration: 0,
      pointCount: coords?.length || 0,
      centerCoordinates: null,
      startCoordinates: null,
      endCoordinates: null,
    };
  }

  let distance = 0;
  let elevationGain = 0;
  let elevationLoss = 0;
  let highestPoint = null;
  let lowestPoint = null;
  let maxGrade = 0;

  for (let i = 1; i < coords.length; i += 1) {
    const stepDistance = haversine(coords[i - 1], coords[i]);
    distance += stepDistance;
    if (coords[i][2] != null && coords[i - 1][2] != null) {
      highestPoint = Math.max(
        highestPoint ?? Number(coords[i - 1][2]),
        Number(coords[i - 1][2]),
        Number(coords[i][2]),
      );
      lowestPoint = Math.min(
        lowestPoint ?? Number(coords[i - 1][2]),
        Number(coords[i - 1][2]),
        Number(coords[i][2]),
      );
      const diff = Number(coords[i][2]) - Number(coords[i - 1][2]);
      if (diff > 0) elevationGain += diff;
      if (diff < 0) elevationLoss += Math.abs(diff);
      if (stepDistance >= 20) {
        maxGrade = Math.max(maxGrade, Math.abs(diff) / stepDistance);
      }
    }
  }

  const distanceKm = distance / 1000;
  const estimatedHours = distanceKm / 4 + elevationGain / 600;
  const duration = Math.round(estimatedHours * 3600);

  const startCoordinates = [Number(coords[0][0]), Number(coords[0][1])];
  const endCoordinates = [
    Number(coords[coords.length - 1][0]),
    Number(coords[coords.length - 1][1]),
  ];

  const centerCoordinates = [
    Math.round(
      (coords.reduce((sum, point) => sum + Number(point[0]), 0) /
        coords.length) *
        1000000,
    ) / 1000000,
    Math.round(
      (coords.reduce((sum, point) => sum + Number(point[1]), 0) /
        coords.length) *
        1000000,
    ) / 1000000,
  ];

  return {
    distance: Math.round(distance),
    elevationGain: Math.round(elevationGain),
    elevationLoss: Math.round(elevationLoss),
    highestPoint:
      highestPoint === null ? undefined : Math.round(Number(highestPoint)),
    lowestPoint:
      lowestPoint === null ? undefined : Math.round(Number(lowestPoint)),
    maxGrade: Math.round(maxGrade * 1000) / 1000,
    duration,
    pointCount: coords.length,
    centerCoordinates,
    startCoordinates,
    endCoordinates,
  };
}

function mergeNumericStats(base = {}, extras = {}) {
  const next = { ...base };
  [
    "distance",
    "elevationGain",
    "elevationLoss",
    "duration",
    "highestPoint",
    "lowestPoint",
    "maxGrade",
    "directDistance",
    "routeRatio",
    "mapboxDuration",
    "pointCount",
  ].forEach((key) => {
    const value = Number(extras?.[key]);
    if (Number.isFinite(value)) next[key] = value;
  });
  return next;
}

function sampleCoordinates(coords, limit = ELEVATION_SAMPLE_LIMIT) {
  if (!Array.isArray(coords) || coords.length <= limit) return coords || [];
  const samples = [];
  const lastIndex = coords.length - 1;
  for (let i = 0; i < limit; i += 1) {
    const index = Math.round((i / (limit - 1)) * lastIndex);
    samples.push(coords[index]);
  }
  return samples;
}

async function fetchMapboxContourElevation([lng, lat]) {
  if (!MAPBOX_ELEVATION_TOKEN) return null;
  const key = `${Number(lng).toFixed(4)},${Number(lat).toFixed(4)}`;
  if (elevationCache.has(key)) return elevationCache.get(key);

  const url =
    `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/` +
    `${Number(lng)},${Number(lat)}.json?layers=contour&limit=1&radius=250&access_token=${MAPBOX_ELEVATION_TOKEN}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Mapbox elevation failed ${response.status}`);
    const payload = await response.json();
    const feature = Array.isArray(payload?.features) ? payload.features[0] : null;
    const rawElevation =
      feature?.properties?.ele ?? feature?.properties?.elevation;
    const elevation = Number(rawElevation);
    const value = Number.isFinite(elevation) ? elevation : null;
    elevationCache.set(key, value);
    return value;
  } catch {
    elevationCache.set(key, null);
    return null;
  }
}

async function resolveElevationSamples(coords) {
  const sampled = sampleCoordinates(coords);
  if (sampled.every(hasElevation)) {
    return sampled.map((coord) => ({
      point: coord,
      elevation: Number(coord[2]),
    }));
  }

  const samples = [];
  for (const coord of sampled) {
    const embedded = hasElevation(coord) ? Number(coord[2]) : null;
    const elevation = embedded ?? (await fetchMapboxContourElevation(coord));
    if (Number.isFinite(elevation)) {
      samples.push({ point: coord, elevation });
    }
  }
  return samples;
}

function calculateElevationStatsFromSamples(samples) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return {
      elevationGain: 0,
      elevationLoss: 0,
      highestPoint: undefined,
      lowestPoint: undefined,
      maxGrade: 0,
    };
  }

  let elevationGain = 0;
  let elevationLoss = 0;
  let highestPoint = samples[0].elevation;
  let lowestPoint = samples[0].elevation;
  let maxGrade = 0;

  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const next = samples[i];
    const diff = next.elevation - prev.elevation;
    const stepDistance = haversine(prev.point, next.point);
    if (diff > 0) elevationGain += diff;
    if (diff < 0) elevationLoss += Math.abs(diff);
    highestPoint = Math.max(highestPoint, next.elevation);
    lowestPoint = Math.min(lowestPoint, next.elevation);
    if (stepDistance >= 20) {
      maxGrade = Math.max(maxGrade, Math.abs(diff) / stepDistance);
    }
  }

  return {
    elevationGain: Math.round(elevationGain),
    elevationLoss: Math.round(elevationLoss),
    highestPoint: Math.round(highestPoint),
    lowestPoint: Math.round(lowestPoint),
    maxGrade: Math.round(maxGrade * 1000) / 1000,
  };
}

export async function calculateEnrichedStats(geojson, submittedStats = {}) {
  const coords = extractCoordinates(geojson);
  const base = calculateStats(geojson);
  const submitted = mergeNumericStats({}, submittedStats);
  const submittedGain = Number(submitted.elevationGain || 0);
  const submittedLoss = Number(submitted.elevationLoss || 0);
  const submittedHighest = Number(submitted.highestPoint || 0);
  const submittedLowest = Number(submitted.lowestPoint || 0);
  const submittedGrade = Number(submitted.maxGrade || 0);
  const submittedElevationLooksReal =
    submittedGain >= 10 ||
    submittedLoss >= 10 ||
    submittedHighest > 50 ||
    submittedLowest > 50 ||
    submittedGrade >= 0.005;

  const hasEmbeddedElevation =
    Number(base.elevationGain || 0) > 0 ||
    Number(base.elevationLoss || 0) > 0 ||
    Number(base.highestPoint || 0) > 0 ||
    Number(base.lowestPoint || 0) > 0;

  let elevationStats = {};
  if (submittedElevationLooksReal) {
    elevationStats = submitted;
  } else if (hasEmbeddedElevation) {
    elevationStats = base;
  } else if (coords.length >= 2) {
    const samples = await resolveElevationSamples(coords);
    elevationStats = calculateElevationStatsFromSamples(samples);
  }

  const distance = Math.round(Number(submitted.distance || base.distance || 0));
  const elevationGain = Math.round(
    Number(elevationStats.elevationGain || base.elevationGain || 0),
  );
  const naismithDuration = Math.round(
    (distance / 1000 / 4 + elevationGain / 600) * 3600,
  );
  const duration = Math.round(
    Math.max(Number(submitted.duration || 0), naismithDuration),
  );

  return mergeNumericStats(base, {
    ...submitted,
    ...elevationStats,
    distance,
    elevationGain,
    duration,
    pointCount: coords.length || submitted.pointCount || base.pointCount,
  });
}

function extractCoordinates(geojson) {
  if (!geojson) return [];
  if (geojson.type === "LineString") return geojson.coordinates || [];
  if (geojson.type === "MultiLineString") {
    return Array.isArray(geojson.coordinates) ? geojson.coordinates.flat() : [];
  }
  if (geojson.type === "Feature") return extractCoordinates(geojson.geometry);
  if (geojson.type === "FeatureCollection" && geojson.features?.length) {
    return geojson.features.flatMap((f) => extractCoordinates(f.geometry));
  }
  return [];
}

function haversine([lng1, lat1], [lng2, lat2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLng = toRad(Number(lng2) - Number(lng1));
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(lat1))) *
      Math.cos(toRad(Number(lat2))) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasElevation(coord) {
  return Number.isFinite(Number(coord?.[2]));
}

function formatMinutes(seconds) {
  const minutes = Math.max(1, Math.round(Number(seconds || 0) / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function scoreDifficulty({ distanceMeters, elevationGain, maxGrade }) {
  const distanceKm = Number(distanceMeters || 0) / 1000;
  let score = 0;

  if (distanceKm >= 30) score += 4;
  else if (distanceKm >= 18) score += 3;
  else if (distanceKm >= 9) score += 2;
  else if (distanceKm >= 4) score += 1;

  if (elevationGain >= 1800) score += 4;
  else if (elevationGain >= 1000) score += 3;
  else if (elevationGain >= 550) score += 2;
  else if (elevationGain >= 250) score += 1;

  if (maxGrade >= 0.35) score += 3;
  else if (maxGrade >= 0.25) score += 2;
  else if (maxGrade >= 0.15) score += 1;

  if (score >= 7) return "extreme";
  if (score >= 5) return "hard";
  if (score >= 2) return "moderate";
  return "easy";
}

export function inferDifficultyFromStats(stats = {}) {
  return scoreDifficulty({
    distanceMeters: Number(stats.distance || 0),
    elevationGain: Number(stats.elevationGain || 0),
    maxGrade: Number(stats.maxGrade || 0),
  });
}

function summarizeSegment(coords, startIndex, endIndex) {
  let distanceMeters = 0;
  let elevationGain = 0;
  let elevationLoss = 0;
  let maxGrade = 0;
  let highest = null;
  let lowest = null;

  for (let i = startIndex + 1; i <= endIndex; i += 1) {
    const prev = coords[i - 1];
    const next = coords[i];
    const stepDistance = haversine(prev, next);
    distanceMeters += stepDistance;

    if (hasElevation(prev) && hasElevation(next)) {
      highest = Math.max(
        highest ?? Number(prev[2]),
        Number(prev[2]),
        Number(next[2]),
      );
      lowest = Math.min(
        lowest ?? Number(prev[2]),
        Number(prev[2]),
        Number(next[2]),
      );
      const diff = Number(next[2]) - Number(prev[2]);
      if (diff > 0) elevationGain += diff;
      if (diff < 0) elevationLoss += Math.abs(diff);
      if (stepDistance >= 20) {
        maxGrade = Math.max(maxGrade, Math.abs(diff) / stepDistance);
      }
    }
  }

  const duration = (distanceMeters / 1000 / 4 + elevationGain / 600) * 3600;
  const difficulty = scoreDifficulty({
    distanceMeters,
    elevationGain,
    maxGrade,
  });

  return {
    distanceMeters,
    elevationGain,
    elevationLoss,
    maxGrade,
    highest,
    lowest,
    duration,
    difficulty,
  };
}

function classifyExposure({ maxGrade, distanceMeters, elevationGain }) {
  const climbRate = distanceMeters > 0 ? elevationGain / distanceMeters : 0;
  if (maxGrade >= 0.35 || climbRate >= 0.18) return "high";
  if (maxGrade >= 0.22 || climbRate >= 0.11) return "medium";
  return "low";
}

function buildSegmentOrientation(coords, startIndex, endIndex, trailMarks = []) {
  const relatedMark = trailMarks.find((mark) => {
    const markStart = Number(mark.startIndex ?? 0);
    const markEnd = Number(mark.endIndex ?? markStart);
    return markEnd >= startIndex && markStart <= endIndex;
  });
  const notes = [];

  if (relatedMark?.colourType && relatedMark.colourType !== "unmarked") {
    notes.push(`Follow ${relatedMark.colourType} trail marks in this sector`);
  } else {
    notes.push("No reliable colour marking is stored for this sector");
  }

  let notableTurns = 0;
  for (let i = startIndex + 2; i <= endIndex; i += 1) {
    const first = bearingDegrees(coords[i - 2], coords[i - 1]);
    const second = bearingDegrees(coords[i - 1], coords[i]);
    const delta = Math.abs(((second - first + 540) % 360) - 180);
    if (delta >= 55) notableTurns += 1;
  }

  if (notableTurns >= 3) {
    notes.push("Several sharp turns or junction-like bends need attention");
  } else if (notableTurns >= 1) {
    notes.push("Watch for at least one clear turn in this sector");
  } else {
    notes.push("Mostly direct sector with no major stored turn");
  }

  return notes.join(". ") + ".";
}

function bearingDegrees([lon1, lat1], [lon2, lat2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const startLat = toRad(Number(lat1));
  const endLat = toRad(Number(lat2));
  const deltaLon = toRad(Number(lon2) - Number(lon1));
  const y = Math.sin(deltaLon) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function splitRouteIntoSegments(coords, trailMarks = []) {
  const pointCount = coords.length;
  if (pointCount < 2) return [];

  const stats = calculateStats({ type: "LineString", coordinates: coords });
  const distanceKm = stats.distance / 1000;
  const targetSegments = Math.min(
    6,
    Math.max(2, Math.ceil(distanceKm / 4) || 2),
  );
  const segmentCount = Math.min(targetSegments, pointCount - 1);
  const segments = [];

  for (let i = 0; i < segmentCount; i += 1) {
    const startIndex =
      i === 0 ? 0 : Math.round((i / segmentCount) * (pointCount - 1));
    const endIndex =
      i === segmentCount - 1
        ? pointCount - 1
        : Math.max(
            startIndex + 1,
            Math.round(((i + 1) / segmentCount) * (pointCount - 1)),
          );
    const segmentStats = summarizeSegment(coords, startIndex, endIndex);
    const gain = Math.round(segmentStats.elevationGain);
    const loss = Math.round(segmentStats.elevationLoss);
    const distanceText = (segmentStats.distanceMeters / 1000).toFixed(1);
    const gradeText = Math.round(segmentStats.maxGrade * 100);

    segments.push({
      name: `Segment ${i + 1}`,
      difficulty: segmentStats.difficulty,
      description: [
        `${distanceText} km`,
        gain ? `${gain} m climb` : "",
        loss ? `${loss} m descent` : "",
        gradeText >= 12 ? `steepest grade about ${gradeText}%` : "",
      ]
        .filter(Boolean)
        .join(", "),
      estimatedTime: formatMinutes(segmentStats.duration),
      startIndex,
      endIndex,
      distanceMeters: Math.round(segmentStats.distanceMeters),
      elevationGain: Math.round(segmentStats.elevationGain),
      elevationLoss: Math.round(segmentStats.elevationLoss),
      maxGrade: Math.round(segmentStats.maxGrade * 1000) / 1000,
      exposure: classifyExposure(segmentStats),
      orientationNote: buildSegmentOrientation(
        coords,
        startIndex,
        endIndex,
        trailMarks,
      ),
    });
  }

  return segments;
}

function buildWarnings({ stats, segments, hasElevationData }) {
  const warnings = [];
  const distanceKm = Number(stats.distance || 0) / 1000;
  const elevationGain = Number(stats.elevationGain || 0);
  const steepSegments = segments.filter((segment) =>
    /grade about (2[5-9]|[3-9]\d)%/.test(segment.description || ""),
  );

  if (distanceKm >= 25 || elevationGain >= 1500) {
    warnings.push({
      type_: "terrain",
      severity: "high",
      description:
        "Long and demanding route. Start early, carry extra water, and plan bailout points.",
    });
  } else if (distanceKm >= 14 || elevationGain >= 800) {
    warnings.push({
      type_: "terrain",
      severity: "medium",
      description:
        "Moderate endurance required. Check weather and keep enough daylight for the return.",
    });
  }

  if (steepSegments.length > 0) {
    warnings.push({
      type_: "steep_descent",
      severity: steepSegments.length >= 2 ? "high" : "medium",
      description:
        "One or more sectors contain very steep ground. Slow down on wet, icy, or loose terrain.",
    });
  }

  if (!hasElevationData) {
    warnings.push({
      type_: "other",
      severity: "low",
      description:
        "No elevation samples are stored for this route, so climbing difficulty is estimated from distance only.",
    });
  }

  return warnings;
}

function buildElevationBands(coords, segments) {
  const elevations = coords
    .filter(hasElevation)
    .map((coord) => Number(coord[2]))
    .filter(Number.isFinite);

  if (!elevations.length) {
    return [
      {
        min: 0,
        max: 0,
        risk: "unknown",
        notes: ["No elevation samples are stored for weather band analysis"],
      },
    ];
  }

  const min = Math.floor(Math.min(...elevations) / 250) * 250;
  const max = Math.ceil(Math.max(...elevations) / 250) * 250;
  const bands = [];
  for (let floor = min; floor < max; floor += 250) {
    const ceiling = floor + 250;
    const notes = [];
    const highSegments = segments.filter((segment) => {
      const exposure = segment.exposure || "low";
      return exposure !== "low" && segment.elevationGain >= 80;
    });
    let risk = "low";
    if (ceiling >= 2200) {
      risk = "high";
      notes.push("High mountain band: wind, fog, snow, and lightning risk rises quickly");
    } else if (ceiling >= 1500) {
      risk = "medium";
      notes.push("Mountain weather can change fast above this elevation");
    } else {
      notes.push("Lower elevation band, usually less exposed");
    }
    if (highSegments.length) {
      risk = risk === "high" ? "high" : "medium";
      notes.push("Steep exposed sectors increase risk in poor weather");
    }
    bands.push({ min: floor, max: ceiling, risk, notes });
  }
  return bands;
}

function buildWeatherRisk(coords, segments) {
  const elevationBands = buildElevationBands(coords, segments);
  const score = elevationBands.reduce((total, band) => {
    if (band.risk === "high") return total + 35;
    if (band.risk === "medium") return total + 18;
    return total + 7;
  }, 0);
  const normalized = Math.min(100, Math.round(score / Math.max(1, elevationBands.length)));
  return {
    score: normalized,
    level: normalized >= 55 ? "high" : normalized >= 28 ? "medium" : "low",
    elevationBands,
  };
}

function buildSeasonLabels({ stats, segments, weatherRisk }) {
  const labels = [];
  const gain = Number(stats.elevationGain || 0);
  const distanceKm = Number(stats.distance || 0) / 1000;
  const hasHighExposure = segments.some((segment) => segment.exposure === "high");

  if (weatherRisk.level === "high" || gain >= 1100) {
    labels.push("best in stable summer or early autumn weather");
  } else {
    labels.push("usable in most dry seasons");
  }
  if (hasHighExposure || segments.some((segment) => segment.maxGrade >= 0.22)) {
    labels.push("avoid after heavy rain");
  }
  if (gain >= 700 || distanceKm >= 14 || weatherRisk.level !== "low") {
    labels.push("winter risk without snow equipment");
  }
  return labels;
}

function buildOrientationNotes(segments, trailMarks = []) {
  const notes = segments.map((segment) => segment.orientationNote).filter(Boolean);
  const markColours = [
    ...new Set(
      trailMarks
        .map((mark) => String(mark.colourType || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (markColours.length) {
    notes.unshift(`Stored mark colours: ${markColours.join(", ")}.`);
  }
  return [...new Set(notes)].slice(0, 10);
}

function buildQualityScore(route, segments, warnings) {
  let score = 62;
  const reasons = [];
  const reviews = Array.isArray(route?.reviews) ? route.reviews : [];
  const reports = Array.isArray(route?.conditionReports)
    ? route.conditionReports
    : [];
  const marks = Array.isArray(route?.trailMarks) ? route.trailMarks : [];
  const coords = extractCoordinates(route?.geojson);

  if (coords.length >= 250) {
    score += 10;
    reasons.push("dense route geometry");
  } else if (coords.length < 30) {
    score -= 12;
    reasons.push("sparse route geometry");
  }

  if (marks.length) {
    score += 8;
    reasons.push("trail mark sectors are stored");
  } else {
    score -= 8;
    reasons.push("no trail mark sectors stored");
  }

  if (reviews.length) {
    const average =
      reviews.reduce((sum, review) => sum + Number(review.accuracy || 0), 0) /
      reviews.length;
    score += Math.round((average - 3) * 6);
    reasons.push(`${reviews.length} user review${reviews.length === 1 ? "" : "s"}`);
  }

  const riskyReports = reports.filter((report) => {
    return (
      report.surface === "blocked" ||
      report.surface === "icy" ||
      (Array.isArray(report.hazards) && report.hazards.length)
    );
  });
  if (riskyReports.length) {
    score -= Math.min(20, riskyReports.length * 6);
    reasons.push("recent reports mention hazards or blocked path");
  }

  if (warnings.some((warning) => warning.severity === "high")) {
    score -= 8;
    reasons.push("high-severity terrain warning");
  }

  if (segments.length >= 2) {
    score += 5;
    reasons.push("route is split into usable sectors");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons: reasons.slice(0, 6),
  };
}

function buildDeterministicSummary({ stats, overallDifficulty, weatherRisk, seasonLabels, quality }) {
  const distanceKm = (Number(stats.distance || 0) / 1000).toFixed(1);
  const gain = Math.round(Number(stats.elevationGain || 0));
  return [
    `${distanceKm} km route with ${gain} m climb`,
    `estimated hiking time ${formatMinutes(stats.duration)}`,
    `overall difficulty ${overallDifficulty}`,
    `weather risk ${weatherRisk.level}`,
    `quality score ${quality.score}/100`,
    seasonLabels.length ? seasonLabels.join("; ") : "",
  ]
    .filter(Boolean)
    .join(". ") + ".";
}

export function analyzeRouteLocally(route) {
  const coords = extractCoordinates(route?.geojson);
  const stats = route?.stats?.distance ? route.stats : calculateStats(route?.geojson);
  const hasElevationData = coords.some(hasElevation);

  if (coords.length < 2) {
    return {
      segments: [],
      warnings: [
        {
          type_: "other",
          severity: "medium",
          description: "Route geometry is too short to analyze reliably.",
        },
      ],
      summary: "Route analysis is limited because the saved geometry is incomplete.",
      overallDifficulty: route?.difficulty || "moderate",
    };
  }

  const trailMarks = Array.isArray(route?.trailMarks) ? route.trailMarks : [];
  const segments = splitRouteIntoSegments(coords, trailMarks);
  const overallDifficulty = scoreDifficulty({
    distanceMeters: stats.distance,
    elevationGain: stats.elevationGain,
    maxGrade: Math.max(
      0,
      ...segments.map((segment) => {
        const match = String(segment.description || "").match(/grade about (\d+)%/);
        return match ? Number(match[1]) / 100 : 0;
      }),
    ),
  });
  const warnings = buildWarnings({ stats, segments, hasElevationData });
  const weatherRisk = buildWeatherRisk(coords, segments);
  const seasonLabels = buildSeasonLabels({ stats, segments, weatherRisk });
  const orientationNotes = buildOrientationNotes(segments, trailMarks);
  const quality = buildQualityScore(route, segments, warnings);
  const hikingTimeSeconds = Math.round(Number(stats.duration || 0));
  const summary = buildDeterministicSummary({
    stats,
    overallDifficulty,
    weatherRisk,
    seasonLabels,
    quality,
  });

  return {
    segments,
    warnings,
    summary,
    overallDifficulty,
    hikingTimeSeconds,
    weatherRisk,
    seasonLabels,
    orientationNotes,
    qualityScore: quality.score,
    qualityReasons: quality.reasons,
  };
}

export async function processRouteAnalysis(routeId) {
  try {
    await Trail.updateOne({ _id: routeId }, { "ai.status": "processing" });

    const route = await Trail.findById(routeId);
    if (!route) throw new Error("Route not found");

    const analysis = analyzeRouteLocally(route);

    await Trail.updateOne(
      { _id: routeId },
      {
        "ai.status": "done",
        "ai.segments": analysis.segments,
        "ai.warnings": analysis.warnings,
        "ai.summary": analysis.summary,
        "ai.overallDifficulty": analysis.overallDifficulty,
        "ai.hikingTimeSeconds": analysis.hikingTimeSeconds,
        "ai.weatherRisk": analysis.weatherRisk,
        "ai.seasonLabels": analysis.seasonLabels,
        "ai.orientationNotes": analysis.orientationNotes,
        "ai.qualityScore": analysis.qualityScore,
        "ai.qualityReasons": analysis.qualityReasons,
        "ai.error": "",
      },
    );

    console.log(`Route analysis complete for route ${routeId}`);
  } catch (err) {
    console.error(`Route analysis failed for route ${routeId}:`, err.message);
    await Trail.updateOne(
      { _id: routeId },
      {
        "ai.status": "error",
        "ai.error": err.message,
      },
    ).catch(() => {});
  }
}
