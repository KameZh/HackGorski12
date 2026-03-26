import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import Map, { Source, Layer, Marker } from 'react-map-gl/mapbox'
import {
  booleanPointInPolygon,
  center as turfCenter,
  circle as turfCircle,
} from '@turf/turf'

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
const MAPBOX_STYLE_URL = import.meta.env.VITE_MAPBOX_STYLE_URL
const MAPBOX_TILESET_URL = import.meta.env.VITE_MAPBOX_TILESET_URL
const MAPBOX_TILESET_TYPE = (
  import.meta.env.VITE_MAPBOX_TILESET_TYPE || 'vector'
).toLowerCase()
const MAPBOX_TILESET_SOURCE_LAYER = import.meta.env
  .VITE_MAPBOX_TILESET_SOURCE_LAYER
const MAPBOX_TILESET_LINE_COLOR =
  import.meta.env.VITE_MAPBOX_TILESET_LINE_COLOR || '#0ea5e9'
const MAPBOX_TILESET_LINE_WIDTH = Number(
  import.meta.env.VITE_MAPBOX_TILESET_LINE_WIDTH || 3
)

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
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 108px)',
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
  radiusWrap: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
    width: 'min(92vw, 420px)',
    zIndex: 17,
    border: '1px solid rgba(66, 129, 164, 0.42)',
    borderRadius: 14,
    background: 'rgba(17, 26, 40, 0.92)',
    boxShadow: '0 12px 28px rgba(0,1,0,0.32)',
    backdropFilter: 'blur(8px)',
    padding: '10px 12px',
    display: 'grid',
    gap: 8,
  },
  radiusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  radiusLabel: {
    fontSize: 12,
    color: '#c8dfec',
    fontWeight: 700,
    minWidth: 74,
  },
  radiusValue: {
    fontSize: 12,
    color: '#8de0dc',
    fontWeight: 700,
    minWidth: 54,
    textAlign: 'right',
  },
  radiusInput: {
    flex: 1,
    accentColor: '#48a9a6',
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

function buildTrailCenterPoint(geometry) {
  try {
    const centered = turfCenter(geometry)
    if (!centered?.geometry?.coordinates) return null

    const [longitude, latitude] = centered.geometry.coordinates
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      properties: {},
    }
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
  const [selectedAreaCenter, setSelectedAreaCenter] = useState([
    INITIAL_VIEW.longitude,
    INITIAL_VIEW.latitude,
  ])
  const [selectedAreaRadiusKm, setSelectedAreaRadiusKm] = useState(8)

  const resolvedMapStyle =
    MAPBOX_STYLE_URL || `mapbox://styles/mapbox/${mapStyle}`
  const hasVectorTileset =
    Boolean(MAPBOX_TILESET_URL) &&
    MAPBOX_TILESET_TYPE === 'vector' &&
    Boolean(MAPBOX_TILESET_SOURCE_LAYER)
  const hasRasterTileset =
    Boolean(MAPBOX_TILESET_URL) && MAPBOX_TILESET_TYPE === 'raster'
  const tilesetConfigWarning =
    Boolean(MAPBOX_TILESET_URL) &&
    MAPBOX_TILESET_TYPE === 'vector' &&
    !MAPBOX_TILESET_SOURCE_LAYER
      ? 'Tileset source-layer is missing. Set VITE_MAPBOX_TILESET_SOURCE_LAYER.'
      : ''

  const renderableTrails = useMemo(() => {
    return trails
      .map((trail) => {
        const geometry = parseTrailGeojson(trail.geojson)
        if (!geometry) return null
        return { trail, geometry }
      })
      .filter(Boolean)
  }, [trails])

  const selectedAreaFeature = useMemo(() => {
    if (!selectedAreaCenter) return null

    return turfCircle(selectedAreaCenter, selectedAreaRadiusKm, {
      units: 'kilometers',
      steps: 60,
    })
  }, [selectedAreaCenter, selectedAreaRadiusKm])

  const visibleRenderableTrails = useMemo(() => {
    if (!selectedAreaFeature) return renderableTrails

    return renderableTrails.filter(({ geometry }) => {
      const centerPoint = buildTrailCenterPoint(geometry)
      if (!centerPoint) return false
      return booleanPointInPolygon(centerPoint, selectedAreaFeature)
    })
  }, [renderableTrails, selectedAreaFeature])

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
        setSelectedAreaCenter([coords.longitude, coords.latitude])
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
      const { lng, lat } = e.lngLat
      setSelectedAreaCenter([lng, lat])

      const layerIds = visibleRenderableTrails
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
    [visibleRenderableTrails, trails, setSelectedTrail]
  )

  const handleResetView = useCallback(() => {
    const map = mapRef.current?.getMap()
    setViewState(INITIAL_VIEW)
    setSelectedAreaCenter([INITIAL_VIEW.longitude, INITIAL_VIEW.latitude])
    setSelectedAreaRadiusKm(8)
    setSelectedTrail(null)
    setGeoError('')

    map?.flyTo({
      center: [INITIAL_VIEW.longitude, INITIAL_VIEW.latitude],
      zoom: INITIAL_VIEW.zoom,
      essential: true,
      duration: 700,
    })
  }, [setSelectedTrail])

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
        mapStyle={resolvedMapStyle}
        style={{ width: '100%', height: '100%' }}
        onLoad={handleMapLoad}
        onClick={handleMapClick}
        attributionControl={false}
      >
        {visibleRenderableTrails.map(({ trail, geometry }) => {
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

        {hasVectorTileset ? (
          <Source
            id="custom-tileset-source"
            type="vector"
            url={MAPBOX_TILESET_URL}
          >
            <Layer
              id="custom-tileset-layer"
              type="line"
              source="custom-tileset-source"
              source-layer={MAPBOX_TILESET_SOURCE_LAYER}
              paint={{
                'line-color': MAPBOX_TILESET_LINE_COLOR,
                'line-width': MAPBOX_TILESET_LINE_WIDTH,
              }}
            />
          </Source>
        ) : null}

        {hasRasterTileset ? (
          <Source
            id="custom-tileset-source"
            type="raster"
            url={MAPBOX_TILESET_URL}
          >
            <Layer
              id="custom-tileset-raster-layer"
              type="raster"
              paint={{
                'raster-opacity': 0.9,
              }}
            />
          </Source>
        ) : null}

        {selectedAreaFeature ? (
          <Source
            id="map-selected-area"
            type="geojson"
            data={selectedAreaFeature}
          >
            <Layer
              id="map-selected-area-fill"
              type="fill"
              paint={{
                'fill-color': '#48a9a6',
                'fill-opacity': 0.18,
              }}
            />
            <Layer
              id="map-selected-area-line"
              type="line"
              paint={{
                'line-color': '#4281a4',
                'line-width': 2,
              }}
            />
          </Source>
        ) : null}

        {selectedAreaCenter ? (
          <Marker
            longitude={selectedAreaCenter[0]}
            latitude={selectedAreaCenter[1]}
            anchor="center"
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#48a9a6',
                border: '2px solid #fbfef9',
                boxShadow: '0 0 0 4px rgba(72,169,166,0.22)',
              }}
            />
          </Marker>
        ) : null}
      </Map>

      <div style={styles.infoWrap}>
        {loadingTrails && <div style={styles.infoBox}>Loading trails...</div>}
        {trailsError && <div style={styles.infoBox}>{trailsError}</div>}
        {geoError && <div style={styles.infoBox}>{geoError}</div>}
        {tilesetConfigWarning && (
          <div style={styles.infoBox}>{tilesetConfigWarning}</div>
        )}
      </div>

      <MapControls
        onCenterMe={handleCenterMe}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
      />

      <div style={styles.radiusWrap}>
        <div style={styles.radiusRow}>
          <span style={styles.radiusLabel}>Area radius</span>
          <input
            type="range"
            min={2}
            max={40}
            step={1}
            value={selectedAreaRadiusKm}
            onChange={(event) =>
              setSelectedAreaRadiusKm(Number(event.target.value))
            }
            style={styles.radiusInput}
          />
          <span style={styles.radiusValue}>{selectedAreaRadiusKm} km</span>
        </div>
        <div style={{ ...styles.infoBox, fontSize: 11, padding: '6px 9px' }}>
          Routes in selected area: {visibleRenderableTrails.length}
        </div>
      </div>
      <RoutePreviewCard />
    </div>
  )
}
