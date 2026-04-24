import "dotenv/config";

import { connectDB, disconnectDB } from "../connection.js";
import OfficialTrail from "../models/officialTrail.js";
import { calculateStats } from "../services/aiAnalysis.js";
import {
  buildDefaultTrailMarks,
  deriveTrailPointLabels,
  extractTrailCoordinates,
  inferOfficialTrailDifficulty,
  isFeaturedOfficialTrail,
} from "../services/trailEnrichment.js";

const FETCH_ELEVATION =
  String(process.env.FETCH_ELEVATION || "").toLowerCase() === "true";
const ELEVATION_API_URL =
  process.env.ELEVATION_API_URL ||
  "https://api.open-elevation.com/api/v1/lookup";
const MAX_ELEVATION_SAMPLES = Math.max(
  2,
  Number(process.env.MAX_ELEVATION_SAMPLES || 60),
);
const ELEVATION_REQUEST_DELAY_MS = Math.max(
  0,
  Number(process.env.ELEVATION_REQUEST_DELAY_MS || 250),
);

function hasValidPoint(value) {
  return Array.isArray(value) && value.length === 2;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasElevationData(coords) {
  return coords.some((coord) => Number.isFinite(Number(coord?.[2])));
}

function sampleCoordinates(coords, maxSamples) {
  const valid = coords
    .map((coord) => [Number(coord?.[0]), Number(coord?.[1])])
    .filter(
      ([longitude, latitude]) =>
        Number.isFinite(longitude) && Number.isFinite(latitude),
    );

  if (valid.length <= maxSamples) return valid;

  const result = [];
  const lastIndex = valid.length - 1;
  for (let i = 0; i < maxSamples; i += 1) {
    const index = Math.round((i / (maxSamples - 1)) * lastIndex);
    result.push(valid[index]);
  }
  return result;
}

function summarizeElevations(elevations) {
  const valid = elevations
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!valid.length) return null;

  let gain = 0;
  for (let i = 1; i < valid.length; i += 1) {
    const diff = valid[i] - valid[i - 1];
    if (diff > 3) gain += diff;
  }

  return {
    elevationGain: Math.round(gain),
    highestPoint: `${Math.round(Math.max(...valid))} m`,
  };
}

async function fetchElevationSummary(geojson) {
  if (!FETCH_ELEVATION) return null;

  const coords = extractTrailCoordinates(geojson);
  if (!coords.length || hasElevationData(coords)) return null;

  const samples = sampleCoordinates(coords, MAX_ELEVATION_SAMPLES);
  if (samples.length < 2) return null;

  const response = await fetch(ELEVATION_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locations: samples.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Elevation API failed with ${response.status}`);
  }

  const payload = await response.json();
  const elevations = Array.isArray(payload?.results)
    ? payload.results.map((entry) => entry?.elevation)
    : [];

  if (ELEVATION_REQUEST_DELAY_MS > 0) {
    await sleep(ELEVATION_REQUEST_DELAY_MS);
  }

  return summarizeElevations(elevations);
}

async function runBackfill() {
  console.log("Connecting to database...");
  await connectDB();

  let updated = 0;
  let skipped = 0;
  let modified = 0;
  let difficultyChanged = 0;

  try {
    const cursor = OfficialTrail.find({}).cursor();

    for await (const trail of cursor) {
      const geojson = trail.geojson;
      if (!geojson) {
        skipped += 1;
        continue;
      }

      const stats = calculateStats(geojson);
      const pointLabels = deriveTrailPointLabels(geojson);
      const trailMarks = buildDefaultTrailMarks({
        geojson,
        colourType: trail.colour_type,
        osmColour: trail.osm_colour,
        osmMarking: trail.osm_marking,
      });
      let elevationSummary = null;
      try {
        elevationSummary = await fetchElevationSummary(geojson);
      } catch (error) {
        console.warn(
          `Elevation lookup skipped for ${trail.osm_id || trail._id}: ${error.message}`,
        );
      }

      const nextStats = {
        ...(trail.stats?.toObject?.() || trail.stats || {}),
        ...stats,
      };
      if (elevationSummary?.elevationGain) {
        nextStats.elevationGain = Math.max(
          Number(nextStats.elevationGain || 0),
          elevationSummary.elevationGain,
        );
      }
      const startCoordinates = hasValidPoint(stats.startCoordinates)
        ? stats.startCoordinates
        : trail.startCoordinates;
      const endCoordinates = hasValidPoint(stats.endCoordinates)
        ? stats.endCoordinates
        : trail.endCoordinates;
      const difficulty = inferOfficialTrailDifficulty({
        stats: nextStats,
        network: trail.network,
        ref: trail.ref,
        name: trail.name,
        name_bg: trail.name_bg,
        name_en: trail.name_en,
      });
      const source = isFeaturedOfficialTrail({
        ref: trail.ref,
        name: trail.name,
        name_bg: trail.name_bg,
        name_en: trail.name_en,
      })
        ? "osm_featured"
        : "osm";
      if (difficulty !== trail.difficulty) difficultyChanged += 1;

      const updateResult = await OfficialTrail.updateOne(
        { _id: trail._id },
        {
          $set: {
            stats: nextStats,
            startCoordinates,
            endCoordinates,
            startPoint: pointLabels.startPoint,
            endPoint: pointLabels.endPoint,
            highestPoint:
              elevationSummary?.highestPoint || pointLabels.highestPoint,
            trailMarks,
            difficulty,
            source,
          },
        },
      );
      modified += Number(updateResult.modifiedCount || 0);
      updated += 1;

      if (updated % 250 === 0) {
        console.log(`Updated ${updated} official trails...`);
      }
    }

    console.log(
      `Official trail backfill finished. Updated ${updated}, modified ${modified}, difficulty changes ${difficultyChanged}, skipped ${skipped}.`,
    );
  } finally {
    await disconnectDB();
  }
}

runBackfill().catch((error) => {
  console.error("Official trail backfill failed:", error);
  process.exit(1);
});
