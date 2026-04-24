export const TRAIL_LAYER_KEYS = {
  unmarked: 'unmarked',
  yellow: 'yellow',
  green: 'green',
  blue: 'blue',
  whiteCasing: 'white-casing',
  whiteMain: 'white-main',
  black: 'black',
  red: 'red',
  featuredCasing: 'featured-casing',
  featuredMain: 'featured-main',
  user: 'user',
}

export const EMPTY_TRAIL_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
}

export function getTrailLayerIds(prefix = 'pytechka-trails') {
  return Object.fromEntries(
    Object.entries(TRAIL_LAYER_KEYS).map(([key, suffix]) => [
      key,
      `${prefix}-${suffix}`,
    ])
  )
}

export function getInteractiveTrailLayerIds(prefix = 'pytechka-trails') {
  const ids = getTrailLayerIds(prefix)
  return [
    ids.unmarked,
    ids.yellow,
    ids.green,
    ids.blue,
    ids.whiteMain,
    ids.black,
    ids.red,
    ids.featuredMain,
    ids.user,
  ]
}

function inferColourType({ colourType, osmColour, osmMarking }) {
  const normalized = String(colourType || '')
    .trim()
    .toLowerCase()
  if (
    ['red', 'blue', 'green', 'yellow', 'white', 'black', 'unmarked'].includes(
      normalized
    )
  ) {
    return normalized
  }

  const marking = String(osmMarking || '')
    .trim()
    .toLowerCase()
  if (['no', 'false', 'bad', 'none', 'unmarked'].includes(marking)) {
    return 'unmarked'
  }

  const colour = String(osmColour || '')
    .trim()
    .toLowerCase()
  if (!colour) return 'unmarked'

  if (
    colour.includes('red') ||
    /#(?:e00|d00|dc2626|ff0000|c00)\b/i.test(colour)
  ) {
    return 'red'
  }
  if (colour.includes('blue') || /#(?:00f|2563eb|1d4ed8)\b/i.test(colour)) {
    return 'blue'
  }
  if (
    colour.includes('green') ||
    /#(?:0f0|22c55e|16a34a|008000)\b/i.test(colour)
  ) {
    return 'green'
  }
  if (
    colour.includes('yellow') ||
    /#(?:ff0|ffd700|facc15|eab308)\b/i.test(colour)
  ) {
    return 'yellow'
  }
  if (colour.includes('white') || /#(?:fff|ffffff|f8fafc)\b/i.test(colour)) {
    return 'white'
  }
  if (colour.includes('black') || /#(?:000|000000|111827)\b/i.test(colour)) {
    return 'black'
  }

  return 'unmarked'
}

function normalizeTrailFeatureProperties(properties = {}) {
  const source = String(properties.source || 'user').toLowerCase()
  const ref = String(properties.ref || '').trim()

  return {
    id: String(properties.id || properties.trailId || ''),
    name: String(properties.name || '').trim(),
    name_bg: String(properties.name_bg || '').trim(),
    name_en: String(properties.name_en || '').trim(),
    ref,
    source: ['user', 'osm', 'osm_featured'].includes(source) ? source : 'user',
    difficulty: String(properties.difficulty || 'moderate').toLowerCase(),
    colour_type: inferColourType({
      colourType: properties.colour_type,
      osmColour: properties.osm_colour,
      osmMarking: properties.osm_marking,
    }),
    osm_colour: String(properties.osm_colour || '').trim(),
    osm_marking: String(properties.osm_marking || '').trim(),
    network: String(properties.network || '')
      .trim()
      .toLowerCase(),
    distance: Number(properties.distance || 0),
    elevation_gain: Number(properties.elevation_gain || 0),
    description: String(properties.description || '').trim(),
  }
}

export function normalizeTrailGeojsonCollection(collection) {
  if (!collection || collection.type !== 'FeatureCollection') {
    return EMPTY_TRAIL_FEATURE_COLLECTION
  }

  const features = (
    Array.isArray(collection.features) ? collection.features : []
  )
    .map((feature) => {
      if (!feature || feature.type !== 'Feature') return null
      const geometry = feature.geometry
      if (!geometry) return null
      if (
        geometry.type !== 'LineString' &&
        geometry.type !== 'MultiLineString'
      ) {
        return null
      }

      return {
        type: 'Feature',
        geometry,
        properties: normalizeTrailFeatureProperties(feature.properties || {}),
      }
    })
    .filter(Boolean)

  return { type: 'FeatureCollection', features }
}
