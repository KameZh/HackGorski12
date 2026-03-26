import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import Map, { Layer, Marker, Source } from 'react-map-gl/mapbox'
import BottomNav from '../components/layout/Bottomnav'
import MapControls from '../components/map/MapControls'
import RoutePreviewCard from '../components/layout/RoutePreviewCard'
import { useMapStore } from '../store/mapStore'
import { fetchMapTrails } from '../api/maps'
import './Record.css'

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

function distanceMeters(p1, p2) {
  // простa Haversine формула
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
  const [currentLocation, setCurrentLocation] = useState(null) // <-- current location

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

  const handleZoomIn = useCallback(() => {
    const map = mapRef.current?.getMap()
    map?.zoomIn({ duration: 200 })
  }, [])

  const handleZoomOut = useCallback(() => {
    const map = mapRef.current?.getMap()
    map?.zoomOut({ duration: 200 })
  }, [])

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

  // --- Current Location Effect ---
  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        console.error(error)
      },
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
      <div className="record-page">
        <div className="record-fallback">
          <div className="record-fallback-card">
            <h3>Record cannot start</h3>
            <p>
              Missing VITE_MAPBOX_TOKEN in frontend environment. Mapbox-only
              mode is enabled.
            </p>
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
      <div className="record-map-layer">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(event) => setViewState(event.viewState)}
          mapStyle={`mapbox://styles/mapbox/${mapStyle}`}
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
                  'line-color': '#2563eb',
                  'line-width': 5,
                  'line-opacity': 0.95,
                }}
              />
            </Source>
          )}

          {/* Current Location Marker */}
          {currentLocation && (
            <Marker
              latitude={currentLocation.latitude}
              longitude={currentLocation.longitude}
              anchor="center"
            >
              <div className="current-location-marker" />
            </Marker>
          )}

          {markerPosition && (
            <Marker
              longitude={markerPosition.longitude}
              latitude={markerPosition.latitude}
              anchor="center"
            >
              <div className="record-marker" />
            </Marker>
          )}
        </Map>
      </div>

      <div className="record-status-wrap">
        <div
          className={`record-status-badge ${isTracking
              ? isPaused
                ? 'record-status-paused'
                : 'record-status-active'
              : ''
            }`}
        >
          {statusText}
        </div>
      </div>

      <div className="record-info-wrap">
        {loadingTrails && (
          <div className="record-info-box">Loading trails...</div>
        )}
        {trailsError && <div className="record-info-box">{trailsError}</div>}
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

      <div className="record-live-panel-wrap">
        <div className="record-live-panel">
          <div className="record-stats-row">
            <div className="record-stat-box">
              <div className="record-stat-value">{steps.toLocaleString()}</div>
              <div className="record-stat-label">steps</div>
            </div>
            <div className="record-stat-box">
              <div className="record-stat-value">
                {formatDuration(elapsedSeconds)}
              </div>
              <div className="record-stat-label">time</div>
            </div>
            <div className="record-stat-box">
              <div className="record-stat-value">
                {(distance / 1000).toFixed(2)}
              </div>
              <div className="record-stat-label">km</div>
            </div>
          </div>

          <div className="record-actions-row">
            {isTracking && !isPaused ? (
              <button
                type="button"
                onClick={pauseTracking}
                className="record-action-btn"
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
                className={`record-action-btn resume ${!hasTrackSession ? 'record-action-disabled' : ''
                  }`}
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
                className="record-primary-btn record-stop-btn"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={startTracking}
                className="record-primary-btn record-start-btn"
              >
                Start
              </button>
            )}

            <button
              type="button"
              onClick={resetTracking}
              className="record-action-btn reset"
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

      <div className="record-bottomnav-wrap">
        <BottomNav />
      </div>
    </div>
  )
}