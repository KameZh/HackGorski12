import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import Map, { Source, Layer, Marker } from 'react-map-gl/mapbox'
import {
  booleanPointInPolygon,
  center as turfCenter,
  circle as turfCircle,
  nearestPointOnLine,
  point as turfPoint,
} from '@turf/turf'

import { useMapStore } from '../../store/mapStore'
import { fetchMapTrails } from '../../api/maps'
import { fetchPings, createPing, votePingGone, fetchClusters, voteClusterGone } from '../../api/pings'
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
    top: 'calc(env(safe-area-inset-top, 0px) + 118px)',
    left: 12,
    right: 12,
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
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 132px)',
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

const PING_TYPES = {
  junk: { label: 'Junk / Rubbish', emoji: '🗑️', color: '#f59e0b' },
  mud: { label: 'Mud', emoji: '💧', color: '#92400e' },
  environmental_danger: { label: 'Environmental Danger', emoji: '🌳', color: '#dc2626' },
}

const CLUSTER_CONFIG = {
  clutter: { label: 'Trash Clutter', emoji: '⚠️', color: '#f97316', votesNeeded: 3 },
  event: { label: 'Cleanup Event', emoji: '🚨', color: '#dc2626', votesNeeded: 5 },
}

const clusterMarkerStyle = {
  width: 40,
  height: 40,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  fontSize: 22,
  cursor: 'pointer',
  border: '3px solid #fff',
  boxShadow: '0 3px 12px rgba(0,0,0,0.45)',
}

const pingMarkerStyle = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  fontSize: 18,
  cursor: 'pointer',
  border: '2px solid #fff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
}

const pingPopupStyle = {
  position: 'absolute',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 290px)',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(90vw, 340px)',
  zIndex: 25,
  border: '1px solid rgba(66, 129, 164, 0.5)',
  borderRadius: 14,
  background: 'rgba(17, 26, 40, 0.95)',
  boxShadow: '0 12px 28px rgba(0,1,0,0.4)',
  backdropFilter: 'blur(8px)',
  padding: '14px 16px',
  color: '#e2e8f0',
}

const pingBtnBase = {
  padding: '8px 14px',
  borderRadius: 10,
  border: 'none',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
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

export default function MapView({ searchQuery = '' }) {
  const mapRef = useRef(null)
  const { mapStyle, terrain3D, setSelectedTrail, trailsVersion } = useMapStore()
  const [trails, setTrails] = useState([])
  const [loadingTrails, setLoadingTrails] = useState(true)
  const [trailsError, setTrailsError] = useState('')
  const [geoError, setGeoError] = useState('')
  const [mapError, setMapError] = useState('')
  const [styleFailed, setStyleFailed] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const [selectedAreaCenter, setSelectedAreaCenter] = useState(null)
  const [selectedAreaRadiusKm, setSelectedAreaRadiusKm] = useState(8)

  // Ping state
  const [pings, setPings] = useState([])
  const [pingMode, setPingMode] = useState(false)
  const [pendingPing, setPendingPing] = useState(null) // { coordinates, trailId }
  const [pingType, setPingType] = useState('junk')
  const [pingDesc, setPingDesc] = useState('')
  const [pingSubmitting, setPingSubmitting] = useState(false)
  const [selectedPing, setSelectedPing] = useState(null)

  // Cluster/event state
  const [clusters, setClusters] = useState([])
  const [selectedCluster, setSelectedCluster] = useState(null)
  const [voteSubmitting, setVoteSubmitting] = useState(false)

  const defaultMapStyle = useMemo(
    () => `mapbox://styles/mapbox/${mapStyle}`,
    [mapStyle]
  )

  // Prefer custom style, but automatically fall back to a safe default on 404s.
  const resolvedMapStyle = useMemo(() => {
    if (styleFailed) return defaultMapStyle
    return MAPBOX_STYLE_URL || defaultMapStyle
  }, [styleFailed, defaultMapStyle])
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
    const normalizedSearch = searchQuery.trim()

    setLoadingTrails(true)
    setTrailsError('')
    setSelectedTrail(null)

    const fetchTimeout = setTimeout(() => {
      const params = normalizedSearch ? { search: normalizedSearch } : {}

      fetchMapTrails(params)
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
    }, 180)

    return () => {
      active = false
      clearTimeout(fetchTimeout)
    }
  }, [trailsVersion, searchQuery, setSelectedTrail])

  // Load pings and clusters
  useEffect(() => {
    let active = true
    fetchPings()
      .then((res) => {
        if (active) setPings(Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => {
        if (active) setPings([])
      })
    fetchClusters()
      .then((res) => {
        if (active) setClusters(Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => {
        if (active) setClusters([])
      })
    return () => { active = false }
  }, [trailsVersion])

  // Submit a pending ping
  const handlePingSubmit = useCallback(async () => {
    if (!pendingPing) return
    setPingSubmitting(true)
    try {
      const res = await createPing({
        trailId: pendingPing.trailId,
        type: pingType,
        description: pingDesc,
        coordinates: pendingPing.coordinates,
      })
      setPings((prev) => [res.data, ...prev])
      setPendingPing(null)
      setPingDesc('')
      setPingMode(false)
      // Refresh clusters after new ping
      fetchClusters()
        .then((r) => setClusters(Array.isArray(r.data) ? r.data : []))
        .catch(() => {})
    } catch (err) {
      console.error('Ping submit error:', err)
    } finally {
      setPingSubmitting(false)
    }
  }, [pendingPing, pingType, pingDesc])

  // Vote on a single ping
  const handlePingVote = useCallback(async (pingId) => {
    setVoteSubmitting(true)
    try {
      await votePingGone(pingId)
      setPings((prev) => prev.filter((p) => p._id !== pingId))
      setSelectedPing(null)
    } catch (err) {
      console.error('Ping vote error:', err)
    } finally {
      setVoteSubmitting(false)
    }
  }, [])

  // Vote on a cluster/event
  const handleClusterVote = useCallback(async (clusterId) => {
    setVoteSubmitting(true)
    try {
      const res = await voteClusterGone(clusterId)
      if (res.data.resolved) {
        setClusters((prev) => prev.filter((c) => c._id !== clusterId))
        setSelectedCluster(null)
        // Refresh pings too since member pings get resolved
        fetchPings()
          .then((r) => setPings(Array.isArray(r.data) ? r.data : []))
          .catch(() => {})
      } else {
        setClusters((prev) => prev.map((c) => (c._id === clusterId ? res.data : c)))
        setSelectedCluster(res.data)
      }
    } catch (err) {
      console.error('Cluster vote error:', err)
    } finally {
      setVoteSubmitting(false)
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
    if (map) {
      applyTerrain(map, terrain3D)
      setMapReady(true)
    }
  }, [terrain3D, applyTerrain])

  const handleMapError = useCallback(
    (event) => {
      const status = event?.error?.status || event?.error?.statusCode
      const message = event?.error?.message || ''
      const is404 = status === 404 || message.includes('404')

      if (MAPBOX_STYLE_URL && !styleFailed && is404) {
        setStyleFailed(true)
        setMapError(
          'Custom map style is not reachable (404). Switched to the default Mapbox style.'
        )
        return
      }

      setMapError(
        'Map failed to load. Check your network, Mapbox token, or style URL permissions.'
      )
      setMapReady(false)
    },
    [styleFailed]
  )

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

  // Tap a trail line → show preview card OR place ping
  const handleMapClick = useCallback(
    (e) => {
      const map = mapRef.current?.getMap()
      if (!map) return
      const { lng, lat } = e.lngLat

      if (pingMode) {
        // Place ping anywhere — snap to nearest trail if close, otherwise free-place
        let snapped = [lng, lat]
        let trailId = null

        const layerIds = visibleRenderableTrails
          .map(({ trail }) => `trail-hit-${trail._id || trail.id}`)
          .filter((id) => map.getLayer(id))

        if (layerIds.length) {
          const features = map.queryRenderedFeatures(e.point, { layers: layerIds })
          if (features.length) {
            trailId = features[0].layer.id.replace('trail-hit-', '')
            const match = renderableTrails.find(
              ({ trail }) => String(trail._id || trail.id) === String(trailId)
            )
            if (match) {
              const clickPt = turfPoint([lng, lat])
              let geom = match.geometry
              if (geom.type === 'FeatureCollection') {
                geom = geom.features?.[0]?.geometry || geom
              } else if (geom.type === 'Feature') {
                geom = geom.geometry
              }
              try {
                const nearest = nearestPointOnLine(geom, clickPt)
                if (nearest?.geometry?.coordinates) {
                  snapped = nearest.geometry.coordinates
                }
              } catch {
                // fall back to raw click
              }
            }
          }
        }

        setPendingPing({ coordinates: snapped, trailId })
        return
      }

      // Normal mode
      setSelectedAreaCenter([lng, lat])

      const layerIds = visibleRenderableTrails
        .map(({ trail }) => `trail-hit-${trail._id || trail.id}`)
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
      const trail = trails.find((t) => String(t._id || t.id) === String(trailId))
      if (trail) setSelectedTrail(trail)
    },
    [visibleRenderableTrails, renderableTrails, trails, setSelectedTrail, pingMode]
  )

  const handleResetView = useCallback(() => {
    const map = mapRef.current?.getMap()
    setViewState(INITIAL_VIEW)
    setSelectedAreaCenter(null)
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
        onError={handleMapError}
        onClick={handleMapClick}
        attributionControl={false}
      >
        {mapReady ? (
          <>
            {visibleRenderableTrails.map(({ trail, geometry }) => {
              const color = DIFFICULTY_COLOR[trail.difficulty] ?? '#6b7280'
              const tid = trail._id || trail.id
              return (
                <Source
                  key={tid}
                  id={`trail-source-${tid}`}
                  type="geojson"
                  data={geometry}
                >
                  <Layer
                    id={`trail-hit-${tid}`}
                    type="line"
                    paint={{
                      'line-color': color,
                      'line-width': 16,
                      'line-opacity': 0,
                    }}
                  />
                  <Layer
                    id={`trail-line-${tid}`}
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

            {/* Ping markers — only visible when zoomed in close (zoom >= 12) */}
            {viewState.zoom >= 12 && pings.map((ping) => {
              const cfg = PING_TYPES[ping.type] || PING_TYPES.junk
              return (
                <Marker
                  key={ping._id}
                  longitude={ping.coordinates[0]}
                  latitude={ping.coordinates[1]}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation()
                    setSelectedPing(selectedPing?._id === ping._id ? null : ping)
                  }}
                >
                  <div
                    style={{
                      ...pingMarkerStyle,
                      background: cfg.color,
                    }}
                    title={`${cfg.label}: ${ping.description || 'No description'}`}
                  >
                    {cfg.emoji}
                  </div>
                </Marker>
              )
            })}

            {/* Cluster / Event markers — always visible */}
            {clusters.map((cluster) => {
              const cfg = CLUSTER_CONFIG[cluster.level] || CLUSTER_CONFIG.clutter
              return (
                <Marker
                  key={cluster._id}
                  longitude={cluster.coordinates[0]}
                  latitude={cluster.coordinates[1]}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation()
                    setSelectedCluster(selectedCluster?._id === cluster._id ? null : cluster)
                    setSelectedPing(null)
                  }}
                >
                  <div
                    style={{
                      ...clusterMarkerStyle,
                      background: cfg.color,
                      border: `2px solid ${cfg.color}`,
                    }}
                    title={`${cfg.label}: ${cluster.description || ''}`}
                  >
                    {cfg.emoji}
                  </div>
                </Marker>
              )
            })}

            {/* Pending ping marker (preview before submit) */}
            {pendingPing ? (
              <Marker
                longitude={pendingPing.coordinates[0]}
                latitude={pendingPing.coordinates[1]}
                anchor="center"
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#f43f5e',
                    border: '3px solid #fff',
                    boxShadow: '0 0 0 4px rgba(244,63,94,0.35)',
                    animation: 'pulse 1.2s infinite',
                  }}
                />
              </Marker>
            ) : null}
          </>
        ) : null}
      </Map>

      {/* Ping mode toggle button */}
      <button
        onClick={() => {
          setPingMode((v) => !v)
          setPendingPing(null)
          setSelectedPing(null)
        }}
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 128px)',
          right: 12,
          zIndex: 20,
          ...pingBtnBase,
          background: pingMode
            ? 'linear-gradient(135deg, #f43f5e, #dc2626)'
            : 'linear-gradient(135deg, #48a9a6, #4281a4)',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        {pingMode ? '✕ Cancel Ping' : '📌 Add Ping'}
      </button>

      {/* Ping mode banner */}
      {pingMode && !pendingPing && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 172px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            padding: '8px 16px',
            borderRadius: 12,
            border: '1px solid rgba(244,63,94,0.5)',
            background: 'rgba(18, 26, 40, 0.92)',
            color: '#fda4af',
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
          }}
        >
          Tap anywhere on the map to place a ping
        </div>
      )}

      {/* Ping creation form */}
      {pendingPing && (
        <div style={pingPopupStyle}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>
            New Ping
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {Object.entries(PING_TYPES).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setPingType(key)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 10,
                  border: pingType === key
                    ? `2px solid ${cfg.color}`
                    : '2px solid rgba(148,163,184,0.2)',
                  background: pingType === key
                    ? `${cfg.color}22`
                    : 'rgba(15,23,35,0.6)',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                <span style={{ fontSize: 20, display: 'block' }}>{cfg.emoji}</span>
                {cfg.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Brief description (optional)"
            value={pingDesc}
            onChange={(e) => setPingDesc(e.target.value)}
            maxLength={200}
            style={{
              width: '100%',
              padding: '9px 11px',
              borderRadius: 10,
              border: '1px solid rgba(66,129,164,0.34)',
              background: 'rgba(15,23,35,0.88)',
              color: '#fbfef9',
              fontSize: 13,
              outline: 'none',
              marginBottom: 10,
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                setPendingPing(null)
                setPingDesc('')
              }}
              style={{
                ...pingBtnBase,
                flex: 1,
                background: 'rgba(148,163,184,0.15)',
                color: '#94a3b8',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handlePingSubmit}
              disabled={pingSubmitting}
              style={{
                ...pingBtnBase,
                flex: 1,
                background: 'linear-gradient(135deg, #48a9a6, #4281a4)',
                color: '#fff',
                opacity: pingSubmitting ? 0.6 : 1,
              }}
            >
              {pingSubmitting ? 'Saving...' : 'Place Ping'}
            </button>
          </div>
        </div>
      )}

      {/* Selected ping detail popup */}
      {selectedPing && !pendingPing && (
        <div style={{ ...pingPopupStyle, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>
              {PING_TYPES[selectedPing.type]?.emoji || '📌'}
            </span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>
              {PING_TYPES[selectedPing.type]?.label || selectedPing.type}
            </span>
          </div>
          {selectedPing.description ? (
            <div style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 6 }}>
              {selectedPing.description}
            </div>
          ) : null}
          <div style={{ fontSize: 11, color: '#64748b' }}>
            By {selectedPing.username || 'Anonymous'} &middot;{' '}
            {new Date(selectedPing.createdAt).toLocaleDateString()}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              onClick={() => handlePingVote(selectedPing._id)}
              disabled={voteSubmitting}
              style={{
                ...pingBtnBase,
                flex: 1,
                background: 'rgba(34,197,94,0.18)',
                color: '#4ade80',
              }}
            >
              {voteSubmitting ? '...' : '✅ Not there anymore'}
            </button>
            <button
              onClick={() => setSelectedPing(null)}
              style={{
                ...pingBtnBase,
                flex: 1,
                background: 'rgba(148,163,184,0.15)',
                color: '#94a3b8',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Selected cluster/event detail popup */}
      {selectedCluster && !pendingPing && (
        <div style={{ ...pingPopupStyle, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>
              {CLUSTER_CONFIG[selectedCluster.level]?.emoji || '⚠️'}
            </span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>
              {CLUSTER_CONFIG[selectedCluster.level]?.label || selectedCluster.level}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 4 }}>
            {selectedCluster.pingCount} trash ping{selectedCluster.pingCount !== 1 ? 's' : ''} within this area
          </div>
          {selectedCluster.description ? (
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
              {selectedCluster.description}
            </div>
          ) : null}
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
            Votes: {selectedCluster.goneVotes?.length || 0} / {CLUSTER_CONFIG[selectedCluster.level]?.votesNeeded || 3}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => handleClusterVote(selectedCluster._id)}
              disabled={voteSubmitting}
              style={{
                ...pingBtnBase,
                flex: 1,
                background: 'rgba(34,197,94,0.18)',
                color: '#4ade80',
              }}
            >
              {voteSubmitting ? '...' : '✅ Cleaned up'}
            </button>
            <button
              onClick={() => setSelectedCluster(null)}
              style={{
                ...pingBtnBase,
                flex: 1,
                background: 'rgba(148,163,184,0.15)',
                color: '#94a3b8',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Info overlay intentionally removed per request */}

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
