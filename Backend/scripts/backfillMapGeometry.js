import "dotenv/config";
import { connectDB, disconnectDB } from "../connection.js";
import OfficialTrail from "../models/officialTrail.js";
import Trail from "../models/trail.js";

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

async function backfillCollection(Model, label) {
  let scanned = 0;
  let updated = 0;
  const cursor = Model.find({})
    .select("geojson geom mapGeometry")
    .lean()
    .cursor();

  for await (const trail of cursor) {
    scanned += 1;
    const sourceGeometry = trail.geom || trail.geojson;
    const mapGeometry = simplifyMapGeometry(sourceGeometry);
    if (!mapGeometry) continue;

    await Model.updateOne(
      { _id: trail._id },
      { $set: { mapGeometry } },
    );
    updated += 1;

    if (updated % 25 === 0) {
      console.log(`${label}: updated ${updated}/${scanned}`);
    }
  }

  console.log(`${label}: updated ${updated}/${scanned}`);
}

async function main() {
  await connectDB();
  await backfillCollection(OfficialTrail, "official trails");
  await backfillCollection(Trail, "user trails");
  await disconnectDB();
}

main().catch(async (err) => {
  console.error("Map geometry backfill failed:", err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
