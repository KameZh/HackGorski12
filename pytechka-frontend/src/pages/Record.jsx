import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
} from 'react-map-gl/mapbox'
import BottomNav from '../components/layout/Bottomnav'
import MapControls from '../components/map/MapControls'
import RoutePreviewCard from '../components/layout/RoutePreviewCard'
import { useMapStore } from '../store/mapStore'
import { fetchMapTrails } from '../api/maps'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

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

const styles = {
  page: {
    position: 'fixed',
    inset: 0,
    width: '100vw',
    height: '100vh',
    background: '#0b1220',
    overflow: 'hidden',
  },
  mapLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
  },
  fallback: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    padding: 16,
    background: 'linear-gradient(180deg, #0b1220 0%, #111827 100%)',
    color: '#fff',
    textAlign: 'center',
    zIndex: 2,
  },
  fallbackCard: {
    maxWidth: 520,
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.35)',
    background: 'rgba(2,6,23,0.72)',
    padding: 16,
  },
  statusWrap: {
    position: 'absolute',
    top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
    left: 12,
    right: 12,
    zIndex: 16,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  statusBadge: {
    borderRadius: 999,
    padding: '7px 14px',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
    background: 'rgba(15,23,42,0.82)',
    border: '1px solid rgba(148,163,184,0.35)',
    backdropFilter: 'blur(8px)',
  },
  infoWrap: {
    position: 'absolute',
    top: 'calc(env(safe-area-inset-top, 0px) + 56px)',
    left: 12,
    right: 76,
    zIndex: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    pointerEvents: 'none',
  },
  infoBox: {
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.35)',
    background: 'rgba(15,23,42,0.78)',
    color: '#e2e8f0',
    padding: '8px 10px',
    fontSize: 12,
  },
  errorBox: {
    border: '1px solid rgba(239,68,68,0.6)',
    background: 'rgba(127,29,29,0.8)',
    color: '#fee2e2',
  },
  livePanelWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 'max(72px, env(safe-area-inset-bottom, 0px))',
    zIndex: 24,
  },
  livePanel: {
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'rgba(15,23,42,0.86)',
    backdropFilter: 'blur(10px)',
    color: '#fff',
    padding: '10px 12px',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
    marginBottom: 10,
  },
  statBox: {
    textAlign: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  statLabel: {
    marginTop: 2,
    color: '#94a3b8',
    fontSize: 12,
  },
  actionsRow: {
    display: 'grid',
    gridTemplateColumns: '54px 1fr 54px',
    gap: 8,
    alignItems: 'center',
  },
  actionSmall: {
    width: 54,
    height: 40,
    borderRadius: 12,
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
  },
  actionDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  primaryButton: {
    width: '100%',
    height: 40,
    borderRadius: 12,
    border: 'none',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  bottomNavWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
  },
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

function distanceMeters(a, b) {
  const earthRadius = 6371000
  const dLat = toRadians(b.latitude - a.latitude)
  const dLng = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  return 2 * earthRadius * Math.asin(Math.sqrt(h))
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
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

export default function Record() {
  const mapRef = useRef(null)
  const watchRef = useRef(null)
  const { mapStyle, terrain3D, setSelectedTrail, setMode, selectedTrail } =
    useMapStore()

  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const [points, setPoints] = useState([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [distance, setDistance] = useState(0)
  const [isTracking, setIsTracking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [trails, setTrails] = useState([])
  const [loadingTrails, setLoadingTrails] = useState(true)
  const [trailsError, setTrailsError] = useState('')

  const routeGeoJSON = useMemo(() => {
    if (points.length < 2) return null

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: points.map((point) => [
              point.longitude,
              point.latitude,
            ]),
          },
          properties: {},
        },
      ],
    }
  }, [points])

  const renderableTrails = useMemo(() => {
    return trails
      .map((trail) => {
        const geometry = parseTrailGeojson(trail.geojson)
        if (!geometry) return null
        return { trail, geometry }
      })
      .filter(Boolean)
  }, [trails])

  const steps = useMemo(() => Math.round(distance / 0.78), [distance])

  const clearWatch = useCallback(() => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
  }, [])

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
  }, [applyTerrain, terrain3D])

  const onPosition = useCallback((position) => {
    const nextPoint = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      recordedAt: Date.now(),
    }

    setGeoError('')
    setPoints((prev) => {
      if (prev.length > 0) {
        const increment = distanceMeters(prev[prev.length - 1], nextPoint)
        if (Number.isFinite(increment) && increment > 0.4) {
          setDistance((d) => d + increment)
        }
      }
      return [...prev, nextPoint]
    })

    setViewState((old) => ({
      ...old,
      latitude: nextPoint.latitude,
      longitude: nextPoint.longitude,
      zoom: Math.max(old.zoom, 15),
    }))
  }, [])

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported on this device.')
      return
    }

    clearWatch()

    watchRef.current = navigator.geolocation.watchPosition(
      onPosition,
      () => {
        setGeoError(
          'Could not access location. Allow GPS permissions and try again.'
        )
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    )

    setIsTracking(true)
    setIsPaused(false)
  }, [clearWatch, onPosition])

  const pauseTracking = useCallback(() => {
    clearWatch()
    setIsPaused(true)
  }, [clearWatch])

  const resumeTracking = useCallback(() => {
    if (isTracking && isPaused) {
      startTracking()
    }
  }, [isTracking, isPaused, startTracking])

  const stopTracking = useCallback(() => {
    clearWatch()
    setIsTracking(false)
    setIsPaused(false)
  }, [clearWatch])

  const resetTracking = useCallback(() => {
    clearWatch()
    setPoints([])
    setElapsedSeconds(0)
    setDistance(0)
    setIsTracking(false)
    setIsPaused(false)
    setGeoError('')
    setViewState(INITIAL_VIEW)
  }, [clearWatch])

  const handleCenterMe = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGeoError('')
        setViewState((old) => ({
          ...old,
          longitude: coords.longitude,
          latitude: coords.latitude,
          zoom: Math.max(old.zoom, 14),
        }))
      },
      () => {
        setGeoError(
          'Location is unavailable. Allow location access and try again.'
        )
      }
    )
  }, [])

  const handleMapClick = useCallback(
    (event) => {
      const map = mapRef.current?.getMap()
      if (!map) return

      const layerIds = renderableTrails
        .map(({ trail }) => `record-trail-hit-${trail.id}`)
        .filter((id) => map.getLayer(id))

      if (!layerIds.length) {
        setSelectedTrail(null)
        return
      }

      const features = map.queryRenderedFeatures(event.point, {
        layers: layerIds,
      })
      if (!features.length) {
        setSelectedTrail(null)
        return
      }

      const trailId = features[0].layer.id.replace('record-trail-hit-', '')
      const selected = trails.find(
        (trail) => String(trail.id) === String(trailId)
      )
      if (selected) {
        setSelectedTrail(selected)
      }
    },
    [renderableTrails, setSelectedTrail, trails]
  )

  useEffect(() => {
    let active = true
    setLoadingTrails(true)
    setTrailsError('')

    fetchMapTrails()
      .then((res) => {
        if (!active) return
        setTrails(Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => {
        if (!active) return
        setTrails([])
        setTrailsError(
          'Could not load trails from API. Record mode still works.'
        )
      })
      .finally(() => {
        if (active) setLoadingTrails(false)
      })

    return () => {
      active = false
      clearWatch()
      setMode('explore')
      setSelectedTrail(null)
    }
  }, [clearWatch, setMode, setSelectedTrail])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (map && map.loaded()) {
      applyTerrain(map, terrain3D)
    }
  }, [applyTerrain, terrain3D])

  useEffect(() => {
    if (!isTracking || isPaused) return undefined

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isTracking, isPaused])

  const markerPosition = points.length > 0 ? points[points.length - 1] : null
  const statusText = isTracking ? (isPaused ? 'Paused' : 'Recording') : 'Ready'
  const hasTrackSession = isTracking || isPaused

  if (!MAPBOX_TOKEN) {
    return (
      <div style={styles.page}>
        <div style={styles.fallback}>
          <div style={styles.fallbackCard}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>
              Record cannot start
            </h3>
            <p style={{ margin: 0, color: '#cbd5e1' }}>
              Missing VITE_MAPBOX_TOKEN in frontend environment. Mapbox-only
              mode is enabled.
            </p>
          </div>
        </div>
        <div style={styles.bottomNavWrap}>
          <BottomNav />
        </div>
      </div>
    )
  }

  return (
    <div id="record-page" style={styles.page}>
      <div style={styles.mapLayer}>
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(event) => setViewState(event.viewState)}
          mapStyle={`mapbox://styles/mapbox/${mapStyle}`}
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
          onLoad={handleMapLoad}
          onClick={handleMapClick}
        >
          <NavigationControl position="top-left" />

          {renderableTrails.map(({ trail, geometry }) => {
            const color = DIFFICULTY_COLOR[trail.difficulty] ?? '#6b7280'

            return (
              <Source
                key={trail.id}
                id={`record-trail-source-${trail.id}`}
                type="geojson"
                data={geometry}
              >
                <Layer
                  id={`record-trail-hit-${trail.id}`}
                  type="line"
                  paint={{
                    'line-color': color,
                    'line-width': 16,
                    'line-opacity': 0,
                  }}
                />
                <Layer
                  id={`record-trail-line-${trail.id}`}
                  type="line"
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{
                    'line-color': color,
                    'line-width': 4,
                    'line-opacity': 0.72,
                  }}
                />
              </Source>
            )
          })}

          {routeGeoJSON && (
            <Source id="record-route" type="geojson" data={routeGeoJSON}>
              <Layer
                id="record-route-line"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': '#2563eb',
                  'line-width': 5,
                  'line-opacity': 0.95,
                }}
              />
            </Source>
          )}

          {markerPosition && (
            <Marker
              longitude={markerPosition.longitude}
              latitude={markerPosition.latitude}
              anchor="center"
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#0ea5e9',
                  border: '2px solid #fff',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
                }}
              />
            </Marker>
          )}
        </Map>
      </div>

      <div style={styles.statusWrap}>
        <div
          style={{
            ...styles.statusBadge,
            background: isTracking
              ? isPaused
                ? 'rgba(234, 179, 8, 0.2)'
                : 'rgba(34, 197, 94, 0.2)'
              : 'rgba(148, 163, 184, 0.2)',
          }}
        >
          {statusText}
        </div>
      </div>

      <div style={styles.infoWrap}>
        {loadingTrails && <div style={styles.infoBox}>Loading trails...</div>}
        {trailsError && <div style={styles.infoBox}>{trailsError}</div>}
        {geoError && (
          <div style={{ ...styles.infoBox, ...styles.errorBox }}>
            {geoError}
          </div>
        )}
      </div>

      <MapControls onCenterMe={handleCenterMe} />
      {selectedTrail && <RoutePreviewCard />}

      <div style={styles.livePanelWrap}>
        <div style={styles.livePanel}>
          <div style={styles.statsRow}>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{steps.toLocaleString()}</div>
              <div style={styles.statLabel}>steps</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>
                {formatDuration(elapsedSeconds)}
              </div>
              <div style={styles.statLabel}>time</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{(distance / 1000).toFixed(2)}</div>
              <div style={styles.statLabel}>km</div>
            </div>
          </div>

          <div style={styles.actionsRow}>
            {isTracking && !isPaused ? (
              <button
                type="button"
                onClick={pauseTracking}
                style={{ ...styles.actionSmall, background: '#111827' }}
                aria-label="Pause recording"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                >
                  <line x1="8" y1="5" x2="8" y2="19" />
                  <line x1="16" y1="5" x2="16" y2="19" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={resumeTracking}
                style={{
                  ...styles.actionSmall,
                  background: '#1d4ed8',
                  ...(hasTrackSession ? null : styles.actionDisabled),
                }}
                disabled={!hasTrackSession}
                aria-label="Resume recording"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                >
                  <polygon points="6 4 20 12 6 20 6 4" />
                </svg>
              </button>
            )}

            {hasTrackSession ? (
              <button
                type="button"
                onClick={stopTracking}
                style={{ ...styles.primaryButton, background: '#ef4444' }}
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={startTracking}
                style={{ ...styles.primaryButton, background: '#22c55e' }}
              >
                Start
              </button>
            )}

            <button
              type="button"
              onClick={resetTracking}
              style={{ ...styles.actionSmall, background: '#374151' }}
              aria-label="Reset recording"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M21 12a9 9 0 1 1-3.2-6.9" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div style={styles.bottomNavWrap}>
        <BottomNav />
      </div>
    </div>
  )
}
