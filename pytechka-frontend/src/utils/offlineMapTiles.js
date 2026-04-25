import * as turf from '@turf/turf'

function lng2tile(lon, zoom) { 
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom)); 
}

function lat2tile(lat, zoom) { 
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)); 
}

/**
 * Proactively fetches Mapbox tiles covering the bounding box of a trail.
 * Since we have Workbox runtime caching configured for api.mapbox.com,
 * calling `fetch()` here will automatically store the tiles in the service worker cache.
 */
export async function downloadMapTilesForTrail(trail, mapboxToken) {
  if (!trail || !trail.geojson) return

  // 1. Calculate the bounding box of the trail using Turf
  const bbox = turf.bbox(trail.geojson)
  const [minLng, minLat, maxLng, maxLat] = bbox

  // 2. Define the zoom levels to cache
  // 11 to 14 provides a good balance of detail vs storage/network overhead for hiking trails.
  const zoomLevels = [11, 12, 13, 14]
  const urlsToCache = []

  // 3. Calculate all required tile coordinates covering the bbox at each zoom level
  for (const z of zoomLevels) {
    const minX = lng2tile(minLng, z)
    const maxX = lng2tile(maxLng, z)
    
    // Note: latitude goes from 90 to -90, so maxLat is the top (smaller Y tile index)
    const minY = lat2tile(maxLat, z)
    const maxY = lat2tile(minLat, z)

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        // Composite vector tiles for mapbox/outdoors-v12
        urlsToCache.push(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2,mapbox.mapbox-bathymetry-v2/${z}/${x}/${y}.vector.pbf?access_token=${mapboxToken}`)
        
        // 3D terrain DEM tiles
        urlsToCache.push(`https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/${z}/${x}/${y}.webp?access_token=${mapboxToken}`)
      }
    }
  }

  // 4. Proactively fetch all tiles in batches to avoid overwhelming the network
  const batchSize = 10
  for (let i = 0; i < urlsToCache.length; i += batchSize) {
    const batch = urlsToCache.slice(i, i + batchSize)
    await Promise.allSettled(
      batch.map(url => fetch(url, { mode: 'cors' }))
    )
  }
}
