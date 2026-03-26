import { Source, Layer } from 'react-map-gl/mapbox'

// Difficulty → line color
const DIFFICULTY_COLOR = {
  easy: '#22c55e',      // green-500
  moderate: '#f97316',  // orange-500
  hard: '#ef4444',      // red-500
  extreme: '#7f1d1d',   // red-950
}

/**
 * RouteLayer renders all trails as colored lines on the map.
 *
 * trails: array of trail objects from /api/trails
 * Each trail must have: id, geojson (GeoJSON FeatureCollection or LineString), difficulty
 *
 * If a trail doesn't have a geojson field yet (e.g. demo data), it is skipped.
 */
export default function RouteLayer({ trails = [] }) {
  return trails.map((trail) => {
    // Skip trails without geometry
    if (!trail.geojson) return null

    const color = DIFFICULTY_COLOR[trail.difficulty] ?? '#6b7280'

    const geojson =
      typeof trail.geojson === 'string'
        ? JSON.parse(trail.geojson)
        : trail.geojson

    return (
      <Source
        key={trail.id}
        id={`trail-source-${trail.id}`}
        type="geojson"
        data={geojson}
      >
        {/* Wider transparent hit area for easier tapping */}
        <Layer
          id={`trail-hit-${trail.id}`}
          type="line"
          paint={{
            'line-color': color,
            'line-width': 16,
            'line-opacity': 0,
          }}
        />
        {/* Visible trail line */}
        <Layer
          id={`trail-line-${trail.id}`}
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': color,
            'line-width': 4,
            'line-opacity': 0.85,
          }}
        />
      </Source>
    )
  })
}
