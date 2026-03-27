import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import Map, { Layer, Marker, Source } from 'react-map-gl/mapbox'
import BottomNav from '../components/layout/Bottomnav'
import MapControls from '../components/map/MapControls'
import RoutePreviewCard from '../components/layout/RoutePreviewCard'
import { useMapStore } from '../store/mapStore'
import { fetchMapTrails } from '../api/maps'
import { uploadRoute, fetchRouteById } from '../api/routes'
import './Record.css'

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

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`
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

function distanceMeters(p1, p2) {
  const R = 6371000
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(p2.latitude - p1.latitude)
  const dLon = toRad(p2.longitude - p1.longitude)
  const lat1 = toRad(p1.latitude)
  const lat2 = toRad(p2.latitude)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export default function Record() {
  const mapRef = useRef(null)
  const watchRef = useRef(null)
  const pendingCenterRef = useRef(null)
  const { mapStyle, terrain3D, setSelectedTrail, setMode, selectedTrail } =
    useMapStore()

  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const [points, setPoints] = useState([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [distance, setDistance] = useState(0)
  const [isTracking, setIsTracking] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [trails, setTrails] = useState([])
  const [loadingTrails, setLoadingTrails] = useState(true)
  const [trailsError, setTrailsError] = useState('')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)
  const [currentElevation, setCurrentElevation] = useState(0)
  const [elevationGain, setElevationGain] = useState(0)
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0)
  const [mapReady, setMapReady] = useState(false)
  const [savedRoute, setSavedRoute] = useState(null)
  const [aiStatus, setAiStatus] = useState(null) // 'pending' | 'processing' | 'done' | 'error'
  const [aiResult, setAiResult] = useState(null)
  const [saving, setSaving] = useState(false)

  const resolvedMapStyle =
    MAPBOX_STYLE_URL || `mapbox://styles/mapbox/${mapStyle}`
  const hasVectorTileset =
    Boolean(MAPBOX_TILESET_URL) &&
    MAPBOX_TILESET_TYPE === 'vector' &&
    Boolean(MAPBOX_TILESET_SOURCE_LAYER)
  const hasRasterTileset =
    Boolean(MAPBOX_TILESET_URL) && MAPBOX_TILESET_TYPE === 'raster'

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

  const centerOnCurrentLocation = useCallback(
    ({ longitude, latitude }, zoom = 16, duration = 1200) => {
      setViewState((old) => ({ ...old, longitude, latitude, zoom }))
      const map = mapRef.current?.getMap()
      const target = {
        center: [longitude, latitude],
        zoom,
        duration,
        essential: true,
      }

      if (map) {
        map.flyTo(target)
      } else {
        pendingCenterRef.current = target
      }
    },
    []
  )

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) {
      applyTerrain(map, terrain3D)
      setMapReady(true)
      if (pendingCenterRef.current) {
        map.flyTo(pendingCenterRef.current)
        pendingCenterRef.current = null
      }
    }
  }, [applyTerrain, terrain3D])

  const handleZoomIn = useCallback(() => {
    const map = mapRef.current?.getMap()
    map?.zoomIn({ duration: 200 })
  }, [])

  const handleZoomOut = useCallback(() => {
    const map = mapRef.current?.getMap()
    map?.zoomOut({ duration: 200 })
  }, [])

  const onPosition = useCallback((position) => {
    const nextElevation = Number.isFinite(position.coords.altitude)
      ? position.coords.altitude
      : null

    const nextPoint = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      elevation: nextElevation,
      recordedAt: Date.now(),
    }

    if (Number.isFinite(nextElevation)) {
      setCurrentElevation(nextElevation)
    }

    setGeoError('')
    setPoints((prev) => {
      if (prev.length > 0) {
        const increment = distanceMeters(prev[prev.length - 1], nextPoint)
        const elapsedSinceLast =
          (nextPoint.recordedAt - prev[prev.length - 1].recordedAt) / 1000

        const gpsSpeedMps =
          Number.isFinite(position.coords.speed) && position.coords.speed >= 0
            ? position.coords.speed
            : null

        const derivedSpeedMps =
          elapsedSinceLast > 0 ? increment / elapsedSinceLast : 0
        const speedToUse = gpsSpeedMps ?? derivedSpeedMps

        if (Number.isFinite(speedToUse)) {
          setCurrentSpeedKmh(Math.max(0, speedToUse * 3.6))
        }

        if (Number.isFinite(increment) && increment > 0.4) {
          setDistance((d) => d + increment)
        }

        const prevElevation = prev[prev.length - 1].elevation
        if (Number.isFinite(prevElevation) && Number.isFinite(nextElevation)) {
          const positiveDiff = nextElevation - prevElevation
          if (positiveDiff > 0.7) {
            setElevationGain((gain) => gain + positiveDiff)
          }
        }
      }

      return [...prev, nextPoint]
    })

    setViewState((old) => ({
      ...old,
      latitude: nextPoint.latitude,
      longitude: nextPoint.longitude,
      zoom: Math.max(old.zoom, 15.5),
    }))
  }, [])

  const startWatch = useCallback(() => {
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
  }, [onPosition])

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported on this device.')
      return
    }

    clearWatch()
    setIsTracking(true)

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGeoError('')
        centerOnCurrentLocation({
          longitude: coords.longitude,
          latitude: coords.latitude,
        })
        startWatch()
      },
      () => {
        setGeoError(
          'Could not access location. Allow GPS permissions and try again.'
        )
        startWatch()
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    )
  }, [centerOnCurrentLocation, clearWatch, startWatch])

  const stopTracking = useCallback(() => {
    clearWatch()
    setIsTracking(false)
    setCurrentSpeedKmh(0)
  }, [clearWatch])

  const saveTracking = useCallback(async () => {
    clearWatch()
    setIsTracking(false)
    if (points.length < 2) return

    setSaving(true)
    try {
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: points.map((p) => [
                p.longitude,
                p.latitude,
                ...(p.elevation != null ? [p.elevation] : []),
              ]),
            },
            properties: {},
          },
        ],
      }

      const res = await uploadRoute(geojson)
      setSavedRoute(res.data)
      setAiStatus(res.data.ai?.status || 'pending')
    } catch (err) {
      console.error('Failed to save route:', err)
      setGeoError('Failed to save route. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [clearWatch, points])

  const resetTracking = useCallback(() => {
    clearWatch()
    setPoints([])
    setElapsedSeconds(0)
    setDistance(0)
    setElevationGain(0)
    setCurrentSpeedKmh(0)
    setGeoError('')
    setIsTracking(false)
    setShowAdvancedControls(false)
    setViewState(INITIAL_VIEW)
    setSavedRoute(null)
    setAiStatus(null)
    setAiResult(null)
  }, [clearWatch])

  const handleCenterMe = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGeoError('')
        centerOnCurrentLocation(
          {
            longitude: coords.longitude,
            latitude: coords.latitude,
          },
          15,
          700
        )
      },
      () => {
        setGeoError(
          'Location is unavailable. Allow location access and try again.'
        )
      }
    )
  }, [centerOnCurrentLocation])

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
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextAltitude = Number.isFinite(position.coords.altitude)
          ? position.coords.altitude
          : null

        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })

        if (Number.isFinite(nextAltitude)) {
          setCurrentElevation(nextAltitude)
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

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
    if (!isTracking) return undefined

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isTracking])

  // Poll for AI analysis results after saving a route
  useEffect(() => {
    if (!savedRoute?._id) return
    if (aiStatus === 'done' || aiStatus === 'error') return

    const interval = setInterval(async () => {
      try {
        const res = await fetchRouteById(savedRoute._id)
        const status = res.data.ai?.status
        setAiStatus(status)
        if (status === 'done') {
          setAiResult(res.data.ai)
          clearInterval(interval)
        } else if (status === 'error') {
          setAiResult({ error: res.data.ai?.error || 'Analysis failed' })
          clearInterval(interval)
        }
      } catch {
        // keep polling
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [savedRoute, aiStatus])

  const markerPosition = points.length > 0 ? points[points.length - 1] : null
  const hasRecordingData =
    points.length > 0 || elapsedSeconds > 0 || distance > 0
  const showControls = showAdvancedControls || hasRecordingData || isTracking

  if (!MAPBOX_TOKEN) {
    return (
      <div className="record-page">
        <div className="record-fallback">
          <div className="record-fallback-card">
            <h3>Record cannot start</h3>
            <p>Missing VITE_MAPBOX_TOKEN in frontend environment.</p>
          </div>
        </div>
        <div className="record-bottomnav-wrap">
          <BottomNav />
        </div>
      </div>
    )
  }

  return (
    <div id="record-page" className="record-page">
      <div className="record-glow record-glow-top" />
      <div className="record-glow record-glow-bottom" />

      <div className="record-map-layer">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(event) => setViewState(event.viewState)}
          mapStyle={resolvedMapStyle}
          mapboxAccessToken={MAPBOX_TOKEN}
          className="record-map"
          attributionControl={false}
          onLoad={handleMapLoad}
          onClick={handleMapClick}
        >
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
                  'line-color': '#48a9a6',
                  'line-width': 5,
                  'line-opacity': 0.95,
                }}
              />
            </Source>
          )}

          {currentLocation && (
            <Marker
              latitude={currentLocation.latitude}
              longitude={currentLocation.longitude}
              anchor="center"
            >
              <div className="current-location-marker" />
            </Marker>
          )}
        </Map>
      </div>

      <div className="record-status-wrap">
        <div className="record-topbar">
          <div className="record-title-row">
            <h1 className="record-topbar-title">
              {isTracking
                ? 'Recording...'
                : hasRecordingData
                  ? 'Paused'
                  : 'Record Active'}
            </h1>
          </div>

          {showControls && (
            <div className="record-stats-grid record-top-stats-enter">
              <div className="record-top-stat">
                <span className="record-top-stat-value">
                  {steps.toLocaleString()}
                </span>
                <span className="record-top-stat-label">Steps</span>
              </div>
              <div className="record-top-stat">
                <span className="record-top-stat-value">
                  {formatDuration(elapsedSeconds)}
                </span>
                <span className="record-top-stat-label">Time</span>
              </div>
              <div className="record-top-stat">
                <span className="record-top-stat-value">
                  {(distance / 1000).toFixed(2)}
                </span>
                <span className="record-top-stat-label">km</span>
              </div>
              <div className="record-top-stat">
                <span className="record-top-stat-value">
                  {Math.round(currentElevation)}
                </span>
                <span className="record-top-stat-label">m Elev</span>
              </div>
              <div className="record-top-stat">
                <span className="record-top-stat-value">
                  +{Math.round(elevationGain)}
                </span>
                <span className="record-top-stat-label">Gain</span>
              </div>
              <div className="record-top-stat">
                <span className="record-top-stat-value">
                  {currentSpeedKmh.toFixed(1)}
                </span>
                <span className="record-top-stat-label">km/h</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="record-info-wrap">
        {loadingTrails && (
          <div className="record-info-box">Loading trails...</div>
        )}
        {geoError && (
          <div className="record-info-box record-info-error">{geoError}</div>
        )}
      </div>

      <MapControls
        onCenterMe={handleCenterMe}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />

      {selectedTrail && <RoutePreviewCard />}

      {/* AI Analysis Results */}
      {savedRoute && (
        <div className="record-ai-panel">
          {(aiStatus === 'pending' || aiStatus === 'processing') && (
            <div className="record-ai-loading">
              <div className="record-ai-spinner" />
              <span>AI is analyzing your route...</span>
            </div>
          )}

          {aiStatus === 'error' && (
            <div className="record-ai-error">
              <span>⚠️ AI analysis failed</span>
              {aiResult?.error && <p>{aiResult.error}</p>}
            </div>
          )}

          {aiStatus === 'done' && aiResult && (
            <div className="record-ai-results">
              <h3 className="record-ai-title">🧠 AI Trail Analysis</h3>

              {aiResult.overallDifficulty && (
                <div className={`record-ai-difficulty record-ai-diff-${aiResult.overallDifficulty}`}>
                  Overall: {aiResult.overallDifficulty.toUpperCase()}
                </div>
              )}

              {aiResult.summary && (
                <p className="record-ai-summary">{aiResult.summary}</p>
              )}

              {aiResult.segments?.length > 0 && (
                <div className="record-ai-segments">
                  <h4>Segments</h4>
                  {aiResult.segments.map((seg, i) => (
                    <div key={i} className={`record-ai-segment record-ai-seg-${seg.difficulty}`}>
                      <div className="record-ai-seg-header">
                        <strong>{seg.name}</strong>
                        <span className="record-ai-seg-badge">{seg.difficulty}</span>
                        {seg.estimatedTime && <span className="record-ai-seg-time">⏱ {seg.estimatedTime}</span>}
                      </div>
                      <p>{seg.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {aiResult.warnings?.length > 0 && (
                <div className="record-ai-warnings">
                  <h4>⚠️ Warnings</h4>
                  {aiResult.warnings.map((w, i) => (
                    <div key={i} className={`record-ai-warning record-ai-warn-${w.severity}`}>
                      <span className="record-ai-warn-severity">{w.severity?.toUpperCase()}</span>
                      <span>{w.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="record-live-panel-wrap">
        <div className="record-live-panel">
          {!hasRecordingData && !isTracking ? (
            <div className="record-start-only-row">
              <button
                onClick={startTracking}
                className="record-primary-btn record-start-btn"
              >
                Start Recording
              </button>
            </div>
          ) : (
            <div className="record-actions-row record-actions-enter">
              <button
                onClick={resetTracking}
                className="record-action-btn record-reset-btn"
              >
                Reset
              </button>

              {isTracking ? (
                <button
                  onClick={stopTracking}
                  className="record-primary-btn record-stop-btn"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={startTracking}
                  className="record-primary-btn record-resume-btn"
                >
                  Resume
                </button>
              )}

              <button
                onClick={saveTracking}
                disabled={saving || points.length < 2}
                className="record-action-btn record-save-btn"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="record-bottomnav-wrap">
        <BottomNav />
      </div>
    </div>
  )
}
