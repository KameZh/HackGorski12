import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import Map, { Source, Layer } from 'react-map-gl/mapbox'

import { useMapStore } from '../../store/mapStore'
import { fetchMapTrails } from '../../api/maps'
import MapControls from './MapControls'
import RoutePreviewCard from '../layout/RoutePreviewCard'

const INITIAL_VIEW = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 7,
}

const DIFFICULTY_COLOR = {
  easy: '#22c55e',
  moderate: '#f97316',
  hard: '#ef4444',
  extreme: '#7f1d1d',
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 320,
  },
  fallback: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(180deg, #0b1220 0%, #0f172a 100%)',
    color: '#fff',
    padding: 16,
    textAlign: 'center',
  },
  fallbackCard: {
    maxWidth: 520,
    background: 'rgba(2, 6, 23, 0.7)',
    border: '1px solid rgba(148,163,184,0.3)',
    borderRadius: 14,
    padding: 16,
  },
  infoWrap: {
    position: 'absolute',
    top: 'calc(env(safe-area-inset-top, 0px) + 72px)',
    left: 12,
    right: 70,
    zIndex: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    pointerEvents: 'none',
  },
  infoBox: {
    background: 'rgba(2, 6, 23, 0.7)',
    border: '1px solid rgba(148,163,184,0.3)',
    color: '#e2e8f0',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 12,
    backdropFilter: 'blur(6px)',
  },
}

function parseTrailGeojson(geojson) {
  if (!geojson) return null

  try {
    const parsed = typeof geojson === 'string' ? JSON.parse(geojson) : geojson
    if (!parsed || typeof parsed !== 'object' || !parsed.type) return null

    if (
      parsed.type === 'FeatureCollection' ||
      parsed.type === 'Feature' ||
      parsed.type === 'LineString' ||
      parsed.type === 'MultiLineString'
    ) {
      return parsed
    }

    return null
  } catch {
    return null
  }
}

export default function MapView() {
  const mapRef = useRef(null)
  const { mapStyle, terrain3D, setSelectedTrail } = useMapStore()
  const [trails, setTrails] = useState([])
  const [loadingTrails, setLoadingTrails] = useState(true)
  const [trailsError, setTrailsError] = useState('')
  const [geoError, setGeoError] = useState('')
  const [viewState, setViewState] = useState(INITIAL_VIEW)

  const renderableTrails = useMemo(() => {
    return trails
      .map((trail) => {
        const geometry = parseTrailGeojson(trail.geojson)
        if (!geometry) return null
        return { trail, geometry }
      })
      .filter(Boolean)
  }, [trails])

  // Load trails from backend and surface non-blocking status.
  useEffect(() => {
    let active = true
    setLoadingTrails(true)
    setTrailsError('')

    fetchMapTrails()
      .then((res) => {
        if (!active) return
        const next = Array.isArray(res.data) ? res.data : []
        setTrails(next)
      })
      .catch(() => {
        if (!active) return
        setTrails([])
        setTrailsError(
          'Could not load trails from the API. The base map is still available.'
        )
      })
      .finally(() => {
        if (active) setLoadingTrails(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Apply/remove 3D terrain
  const applyTerrain = useCallback((map, enabled) => {
    if (enabled) {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        })
      }
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })
      map.setPitch(45)
    } else {
      map.setTerrain(null)
      map.setPitch(0)
    }
  }, [])

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) applyTerrain(map, terrain3D)
  }, [terrain3D, applyTerrain])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (map && map.loaded()) applyTerrain(map, terrain3D)
  }, [terrain3D, applyTerrain])

  const handleZoomIn = useCallback(() => {
    const map = mapRef.current?.getMap()
    map?.zoomIn({ duration: 200 })
  }, [])

  const handleZoomOut = useCallback(() => {
    const map = mapRef.current?.getMap()
    map?.zoomOut({ duration: 200 })
  }, [])

  // Center map on user's GPS location
  const handleCenterMe = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGeoError('')
        setViewState((v) => ({
          ...v,
          longitude: coords.longitude,
          latitude: coords.latitude,
          zoom: 14,
        }))
      },
      () => {
        setGeoError(
          'Location is unavailable. Allow location access and try again.'
        )
      }
    )
  }, [])

  // Tap a trail line → show preview card
  const handleMapClick = useCallback(
    (e) => {
      const map = mapRef.current?.getMap()
      if (!map) return
      const layerIds = renderableTrails
        .map(({ trail }) => `trail-hit-${trail.id}`)
        .filter((id) => map.getLayer(id))
      if (!layerIds.length) {
        setSelectedTrail(null)
        return
      }
      const features = map.queryRenderedFeatures(e.point, { layers: layerIds })
      if (!features.length) {
        setSelectedTrail(null)
        return
      }
      const trailId = features[0].layer.id.replace('trail-hit-', '')
      const trail = trails.find((t) => String(t.id) === String(trailId))
      if (trail) setSelectedTrail(trail)
    },
    [renderableTrails, trails, setSelectedTrail]
  )

  if (!MAPBOX_TOKEN) {
    return (
      <div id="map-container" style={styles.container}>
        <div style={styles.fallback}>
          <div style={styles.fallbackCard}>
            <h3 style={{ margin: '0 0 8px 0' }}>Map cannot start</h3>
            <p style={{ margin: 0, lineHeight: 1.45, color: '#cbd5e1' }}>
              Missing VITE_MAPBOX_TOKEN in frontend environment. Mapbox-only
              mode is enabled.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div id="map-container" style={styles.container}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={`mapbox://styles/mapbox/${mapStyle}`}
        style={{ width: '100%', height: '100%' }}
        onLoad={handleMapLoad}
        onClick={handleMapClick}
        attributionControl={false}
      >
        {renderableTrails.map(({ trail, geometry }) => {
          const color = DIFFICULTY_COLOR[trail.difficulty] ?? '#6b7280'
          return (
            <Source
              key={trail.id}
              id={`trail-source-${trail.id}`}
              type="geojson"
              data={geometry}
            >
              <Layer
                id={`trail-hit-${trail.id}`}
                type="line"
                paint={{
                  'line-color': color,
                  'line-width': 16,
                  'line-opacity': 0,
                }}
              />
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
        })}
      </Map>

      <div style={styles.infoWrap}>
        {loadingTrails && <div style={styles.infoBox}>Loading trails...</div>}
        {trailsError && <div style={styles.infoBox}>{trailsError}</div>}
        {geoError && <div style={styles.infoBox}>{geoError}</div>}
      </div>

      <MapControls
        onCenterMe={handleCenterMe}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />
      <RoutePreviewCard />
    </div>
  )
}
