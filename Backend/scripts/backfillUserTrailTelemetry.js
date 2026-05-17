import "dotenv/config";
import { connectDB, disconnectDB } from "../connection.js";
import Trail from "../models/trail.js";
import {
  calculateEnrichedStats,
  inferDifficultyFromStats,
} from "../services/routeAnalysis.js";

function hasGeometry(trail) {
  return Boolean(trail?.geojson || trail?.geom || trail?.mapGeometry);
}

async function main() {
  await connectDB();

  let checked = 0;
  let updated = 0;
  const cursor = Trail.find({ source: "user" }).cursor();

  for await (const trail of cursor) {
    checked += 1;
    if (!hasGeometry(trail)) continue;

    const geojson = trail.geojson || trail.geom || trail.mapGeometry;
    const stats = await calculateEnrichedStats(geojson, trail.stats || {});
    const difficulty = inferDifficultyFromStats(stats);

    await Trail.updateOne(
      { _id: trail._id },
      {
        $set: {
          geojson,
          stats,
          difficulty: trail.difficulty || difficulty,
          highestPoint: stats.highestPoint ? `${Math.round(stats.highestPoint)} m` : trail.highestPoint || "",
        },
      },
    );

    updated += 1;
    if (updated % 25 === 0) {
      console.log(`Updated ${updated} user trails...`);
    }
  }

  console.log(`User trail telemetry backfill finished. Checked ${checked}, updated ${updated}.`);
  await disconnectDB();
}

main().catch(async (error) => {
  console.error("User trail telemetry backfill failed:", error);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
