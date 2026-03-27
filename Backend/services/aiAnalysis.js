import Trail from "../models/trail.js";

// Local LLM (e.g., Ollama) config
const USE_LOCAL_LLM = process.env.USE_LOCAL_LLM === "true";
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || "gpt-oss:20b-cloud";
const LOCAL_LLM_URL =
  process.env.LOCAL_LLM_URL || "http://localhost:11434/v1/chat/completions";
const THINK_LEVEL_LLM = process.env.THINK_LEVEL_LLM || "low";
const GITHUB_TOKEN = String(process.env.GITHUB_TOKEN || "").trim();
const GITHUB_CHAT_URL = String(process.env.GITHUB_CHAT_URL || "").trim();
const GITHUB_MODEL =
  String(process.env.GITHUB_MODEL || "").trim() || "gpt-4o-mini";

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

  for (let i = 1; i < coords.length; i++) {
    distance += haversine(coords[i - 1], coords[i]);
    if (coords[i][2] != null && coords[i - 1][2] != null) {
      const diff = coords[i][2] - coords[i - 1][2];
      if (diff > 0) elevationGain += diff;
    }
  }

  // Rough estimate: 4 km/h base + elevation penalty
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
    duration,
    pointCount: coords.length,
    centerCoordinates,
    startCoordinates,
    endCoordinates,
  };
}

/**
 * Extract flat coordinate array from various GeoJSON shapes.
 */
function extractCoordinates(geojson) {
  if (!geojson) return [];
  if (geojson.type === "LineString") return geojson.coordinates;
  if (geojson.type === "MultiLineString") return geojson.coordinates.flat();
  if (geojson.type === "Feature") return extractCoordinates(geojson.geometry);
  if (geojson.type === "FeatureCollection" && geojson.features?.length) {
    return geojson.features.flatMap((f) => extractCoordinates(f.geometry));
  }
  return [];
}

function haversine([lng1, lat1], [lng2, lat2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Simplify points by taking every Nth point to keep prompt size reasonable.
 */
function simplifyForAI(geojson, maxPoints = 80) {
  const coords = extractCoordinates(geojson);
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const simplified = [];
  for (let i = 0; i < coords.length; i += step) {
    simplified.push(coords[i]);
  }
  // Always include the last point
  if (simplified[simplified.length - 1] !== coords[coords.length - 1]) {
    simplified.push(coords[coords.length - 1]);
  }
  return simplified;
}

/**
 * Build the elevation profile summary for the AI prompt.
 */
function buildElevationProfile(coords) {
  const elevations = coords.filter((c) => c[2] != null).map((c) => c[2]);
  if (elevations.length === 0) return "No elevation data available.";
  const min = Math.round(Math.min(...elevations));
  const max = Math.round(Math.max(...elevations));
  const avg = Math.round(
    elevations.reduce((a, b) => a + b, 0) / elevations.length,
  );
  return `Min: ${min}m, Max: ${max}m, Avg: ${avg}m, Samples: [${elevations.map((e) => Math.round(e)).join(", ")}]`;
}

/**
 * Async: called after route creation. Sends data to Gemini and stores the result.
 */
export async function processRouteAI(routeId) {
  try {
    await Trail.updateOne({ _id: routeId }, { "ai.status": "processing" });

    const route = await Trail.findById(routeId);
    if (!route) throw new Error("Route not found");

    const simplifiedCoords = simplifyForAI(route.geojson);
    const elevationProfile = buildElevationProfile(simplifiedCoords);
    const distanceKm = (route.stats.distance / 1000).toFixed(2);

    const prompt = `You are an expert hiking trail analyst for Bulgarian mountain trails.

Analyze this hiking route and return a JSON analysis.

Route data:
- Total distance: ${distanceKm} km
- Total elevation gain: ${route.stats.elevationGain} m
- Number of GPS points: ${route.stats.pointCount}
- Estimated duration: ${Math.round(route.stats.duration / 60)} minutes
- Elevation profile: ${elevationProfile}
- Simplified coordinates (lng, lat, elevation): ${JSON.stringify(simplifiedCoords.slice(0, 40))}

Tasks:
1. Split the route into logical segments based on terrain changes and difficulty
2. For each segment, provide difficulty (easy/moderate/hard/extreme), a short description, and estimated time
3. Detect any potentially dangerous areas (steep descents, high exposure, etc.)
4. Write a brief overall summary of the route
5. Determine overall difficulty

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "segments": [
    {
      "name": "Segment name",
      "difficulty": "easy|moderate|hard|extreme",
      "description": "Brief description",
      "estimatedTime": "e.g. 45 min",
      "startIndex": 0,
      "endIndex": 10
    }
  ],
  "warnings": [
    {
      "type_": "steep_descent|exposure|weather|terrain|other",
      "description": "Warning description",
      "severity": "low|medium|high"
    }
  ],
  "summary": "Overall route summary in 2-3 sentences",
  "overallDifficulty": "easy|moderate|hard|extreme"
}`;

    const useLocal = USE_LOCAL_LLM || !GITHUB_TOKEN || !GITHUB_CHAT_URL;
    const targetUrl = useLocal ? LOCAL_LLM_URL : GITHUB_CHAT_URL;
    const targetModel = useLocal ? LOCAL_LLM_MODEL : GITHUB_MODEL;

    const headers = {
      "Content-Type": "application/json",
      ...(useLocal,
      THINK_LEVEL_LLM
        ? {}
        : {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            "X-GitHub-Api-Version": "2023-07-01",
          }),
    };

    const body = useLocal
      ? {
          model: targetModel,
          messages: [
            {
              role: "system",
              content:
                "You are an expert hiking trail analyst. Respond with JSON only, no markdown, no code fences.",
            },
            { role: "user", content: prompt },
          ],
          stream: false,
          temperature: 0.8,
        }
      : {
          model: targetModel,
          messages: [
            {
              role: "system",
              content:
                "You are an expert hiking trail analyst. Respond with JSON only, no markdown, no code fences.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 1200,
          temperature: 1,
        };

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      const source = useLocal ? "Local LLM" : "GitHub model";
      throw new Error(
        `${source} request failed: ${response.status} ${errText}`,
      );
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text || (typeof text === "string" && !text.trim())) {
      throw new Error("AI returned empty response");
    }

    // Parse AI response — strip any accidental markdown fences and salvage inner JSON when needed
    const rawContent = typeof text === "string" ? text : JSON.stringify(text);
    const cleanJson = rawContent
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

    let analysis;
    try {
      analysis = JSON.parse(cleanJson);
    } catch (parseErr) {
      const match = cleanJson.match(/\{[\s\S]*\}/);
      if (match) {
        analysis = JSON.parse(match[0]);
      } else {
        throw new Error(`Failed to parse AI JSON: ${parseErr.message}`);
      }
    }

    await Trail.updateOne(
      { _id: routeId },
      {
        "ai.status": "done",
        "ai.segments": analysis.segments || [],
        "ai.warnings": analysis.warnings || [],
        "ai.summary": analysis.summary || "",
        "ai.overallDifficulty": analysis.overallDifficulty || "moderate",
      },
    );

    console.log(`AI analysis complete for route ${routeId}`);
  } catch (err) {
    console.error(`AI analysis failed for route ${routeId}:`, err.message);
    await Trail.updateOne(
      { _id: routeId },
      {
        "ai.status": "error",
        "ai.error": err.message,
      },
    ).catch(() => {});
  }
}
