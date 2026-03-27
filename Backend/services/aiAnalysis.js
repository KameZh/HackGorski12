import { GoogleGenerativeAI } from '@google/generative-ai'
import Route from '../models/route.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

/**
 * Calculate basic stats from GeoJSON LineString coordinates.
 * Coordinates can be [lng, lat] or [lng, lat, elevation].
 */
export function calculateStats(geojson) {
  const coords = extractCoordinates(geojson)
  if (!coords || coords.length < 2) {
    return { distance: 0, elevationGain: 0, duration: 0, pointCount: coords?.length || 0 }
  }

  let distance = 0
  let elevationGain = 0

  for (let i = 1; i < coords.length; i++) {
    distance += haversine(coords[i - 1], coords[i])
    if (coords[i][2] != null && coords[i - 1][2] != null) {
      const diff = coords[i][2] - coords[i - 1][2]
      if (diff > 0) elevationGain += diff
    }
  }

  // Rough estimate: 4 km/h base + elevation penalty
  const distanceKm = distance / 1000
  const estimatedHours = distanceKm / 4 + elevationGain / 600
  const duration = Math.round(estimatedHours * 3600)

  return {
    distance: Math.round(distance),
    elevationGain: Math.round(elevationGain),
    duration,
    pointCount: coords.length,
  }
}

/**
 * Extract flat coordinate array from various GeoJSON shapes.
 */
function extractCoordinates(geojson) {
  if (!geojson) return []
  if (geojson.type === 'LineString') return geojson.coordinates
  if (geojson.type === 'MultiLineString') return geojson.coordinates.flat()
  if (geojson.type === 'Feature') return extractCoordinates(geojson.geometry)
  if (geojson.type === 'FeatureCollection' && geojson.features?.length) {
    return geojson.features.flatMap((f) => extractCoordinates(f.geometry))
  }
  return []
}

function haversine([lng1, lat1], [lng2, lat2]) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Simplify points by taking every Nth point to keep prompt size reasonable.
 */
function simplifyForAI(geojson, maxPoints = 80) {
  const coords = extractCoordinates(geojson)
  if (coords.length <= maxPoints) return coords
  const step = Math.ceil(coords.length / maxPoints)
  const simplified = []
  for (let i = 0; i < coords.length; i += step) {
    simplified.push(coords[i])
  }
  // Always include the last point
  if (simplified[simplified.length - 1] !== coords[coords.length - 1]) {
    simplified.push(coords[coords.length - 1])
  }
  return simplified
}

/**
 * Build the elevation profile summary for the AI prompt.
 */
function buildElevationProfile(coords) {
  const elevations = coords.filter((c) => c[2] != null).map((c) => c[2])
  if (elevations.length === 0) return 'No elevation data available.'
  const min = Math.round(Math.min(...elevations))
  const max = Math.round(Math.max(...elevations))
  const avg = Math.round(elevations.reduce((a, b) => a + b, 0) / elevations.length)
  return `Min: ${min}m, Max: ${max}m, Avg: ${avg}m, Samples: [${elevations.map((e) => Math.round(e)).join(', ')}]`
}

/**
 * Async: called after route creation. Sends data to Gemini and stores the result.
 */
export async function processRouteAI(routeId) {
  try {
    await Route.updateOne({ _id: routeId }, { 'ai.status': 'processing' })

    const route = await Route.findById(routeId)
    if (!route) throw new Error('Route not found')

    const simplifiedCoords = simplifyForAI(route.geojson)
    const elevationProfile = buildElevationProfile(simplifiedCoords)
    const distanceKm = (route.stats.distance / 1000).toFixed(2)

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
}`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // Parse AI response — strip any accidental markdown fences
    const cleanJson = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
    const analysis = JSON.parse(cleanJson)

    await Route.updateOne(
      { _id: routeId },
      {
        'ai.status': 'done',
        'ai.segments': analysis.segments || [],
        'ai.warnings': analysis.warnings || [],
        'ai.summary': analysis.summary || '',
        'ai.overallDifficulty': analysis.overallDifficulty || 'moderate',
      }
    )

    console.log(`AI analysis complete for route ${routeId}`)
  } catch (err) {
    console.error(`AI analysis failed for route ${routeId}:`, err.message)
    await Route.updateOne(
      { _id: routeId },
      {
        'ai.status': 'error',
        'ai.error': err.message,
      }
    ).catch(() => {})
  }
}
