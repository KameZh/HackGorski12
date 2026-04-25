import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import Map, { Layer, Marker, Source } from 'react-map-gl/mapbox'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import BottomNav from '../components/layout/Bottomnav'
import MapControls from '../components/map/MapControls'
import LiveCompass from '../components/map/LiveCompass'
import RoutePreviewCard from '../components/layout/RoutePreviewCard'
import HutPreviewCard from '../components/layout/HutPreviewCard'
import RouteBuilderForm from '../components/route/RouteBuilderForm'
import CameraButton from '../components/camera/CameraButton'
import PhotoCaptureModal from '../components/camera/PhotoCaptureModal'
import OfflineMapModal from '../components/map/OfflineMapModal'
import { useMapStore } from '../store/mapStore'
import { fetchMapTrails, fetchMapTrailsGeojson, fetchHuts } from '../api/maps'
import { completeTrailFromMap } from '../api/maps'
import { fetchTrailById } from '../api/trails'
import { createPing, createPhotoPing, fetchPings } from '../api/pings'
import { buildCenteredView } from '../utils/mapDefaults'
import TrailMapLayers from '../components/map/TrailMapLayers'
import {
  EMPTY_TRAIL_FEATURE_COLLECTION,
  getInteractiveTrailLayerIds,
  normalizeTrailGeojsonCollection,
  buildTrailGeojsonFromTrails,
} from '../components/map/trailMapLayerUtils'
import { useOfflineStore } from '../store/offlineStore'
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

const INITIAL_VIEW = buildCenteredView(7)
const TRAIL_VISIBILITY_MIN_ZOOM = 9
const RECORD_TRAIL_LAYER_PREFIX = 'record-trails'
const RECORD_INTERACTIVE_TRAIL_LAYER_IDS = getInteractiveTrailLayerIds(
  RECORD_TRAIL_LAYER_PREFIX
)
const RECORD_DEM_SOURCE_ID = 'record-relief-dem'
const MONGO_OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i

const asMongoObjectId = (value) => {
  const id = String(value || '').trim()
  return MONGO_OBJECT_ID_PATTERN.test(id) ? id : null
}

const PING_TYPES = {
  junk: { label: 'Junk / Rubbish', emoji: '🗑️', color: '#f59e0b' },
  mud: { label: 'Mud', emoji: '💧', color: '#92400e' },
  environmental_danger: {
    label: 'Environmental Danger',
    emoji: '🌳',
    color: '#dc2626',
  },
  photo: { label: 'Photo', emoji: '📷', color: '#8b5cf6' },
}

const REPORT_PING_TYPES = Object.fromEntries(
  Object.entries(PING_TYPES).filter(([key]) => key !== 'photo')
)

const PHOTO_CATEGORY_META = {
  viewpoint: { label: 'Viewpoint', color: '#38bdf8' },
  trail_condition: { label: 'Trail condition', color: '#f59e0b' },
  marking: { label: 'Trail mark', color: '#ef4444' },
  water_source: { label: 'Water source', color: '#22c55e' },
  hazard: { label: 'Hazard', color: '#dc2626' },
  memory: { label: 'Memory', color: '#8b5cf6' },
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

const photoMarkerStyle = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  border: '2px solid #fff',
  boxShadow: '0 3px 10px rgba(0,0,0,0.4)',
  overflow: 'hidden',
  background: '#8b5cf6',
}

const pingBtnBase = {
  padding: '9px 14px',
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 13,
  textAlign: 'center',
}

const pingPopupStyle = {
  position: 'absolute',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 218px)',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(90vw, 340px)',
  zIndex: 45,
  border: '1px solid rgba(66, 129, 164, 0.5)',
  borderRadius: 14,
  background: 'rgba(17, 26, 40, 0.95)',
  boxShadow: '0 12px 28px rgba(0,1,0,0.4)',
  backdropFilter: 'blur(8px)',
  padding: '14px 16px',
  color: '#e2e8f0',
}

const LIVE_RECORDING_NOTIFICATION_ID = 50001
const LIVE_RECORDING_CHANNEL_ID = 'recording-live'

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

function deriveTrailStartCoordinates(trail) {
  const direct = Array.isArray(trail?.startCoordinates)
    ? trail.startCoordinates
    : Array.isArray(trail?.stats?.startCoordinates)
      ? trail.stats.startCoordinates
      : null

  if (Array.isArray(direct) && direct.length === 2) {
    return [Number(direct[0]), Number(direct[1])]
  }

  const parsed = parseTrailGeojson(trail?.geojson)
  if (!parsed) return null

  const extract = (shape) => {
    if (!shape || typeof shape !== 'object') return []
    if (shape.type === 'LineString') {
      return Array.isArray(shape.coordinates) ? shape.coordinates : []
    }
    if (shape.type === 'MultiLineString') {
      return Array.isArray(shape.coordinates)
        ? shape.coordinates.flatMap((line) => (Array.isArray(line) ? line : []))
        : []
    }
    if (shape.type === 'Feature') return extract(shape.geometry)
    if (shape.type === 'FeatureCollection') {
      return Array.isArray(shape.features)
        ? shape.features.flatMap((feature) => extract(feature?.geometry))
        : []
    }
    return []
  }

  const coordinates = extract(parsed)
  if (!coordinates.length) return null
  return [Number(coordinates[0][0]), Number(coordinates[0][1])]
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

function bearingDegrees(p1, p2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const toDeg = (rad) => (rad * 180) / Math.PI
  const startLat = toRad(p1.latitude)
  const endLat = toRad(p2.latitude)
  const deltaLon = toRad(p2.longitude - p1.longitude)
  const y = Math.sin(deltaLon) * Math.cos(endLat)
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLon)

  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

export default function Record() {
  const mapRef = useRef(null)
  const watchRef = useRef(null)
  const pendingCenterRef = useRef(null)
  const lastCompassLocationRef = useRef(null)
  const liveNotificationReadyRef = useRef(false)
  const liveNotificationLastBodyRef = useRef('')
  const liveNotificationTickRef = useRef(-1)
  const {
    mapStyle,
    terrain3D,
    hillshadeRelief,
    setSelectedTrail,
    setMode,
    selectedTrail,
    refreshTrails,
  } = useMapStore()

  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const [points, setPoints] = useState([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [distance, setDistance] = useState(0)
  const [isTracking, setIsTracking] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [trails, setTrails] = useState([])
  const [trailsGeojson, setTrailsGeojson] = useState(
    EMPTY_TRAIL_FEATURE_COLLECTION
  )
  const [loadingTrails, setLoadingTrails] = useState(true)
  const [trailsError, setTrailsError] = useState('')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [currentElevation, setCurrentElevation] = useState(0)
  const [elevationGain, setElevationGain] = useState(0)
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0)
  const [movementHeading, setMovementHeading] = useState(null)
  const [savedRoute, setSavedRoute] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [saving] = useState(false)
  const [showPublishForm, setShowPublishForm] = useState(false)

  const [pings, setPings] = useState([])
  const [pingMode, setPingMode] = useState(false)
  const [pingType, setPingType] = useState('junk')
  const [pingDesc, setPingDesc] = useState('')
  const [pingSubmitting, setPingSubmitting] = useState(false)
  const [selectedPing, setSelectedPing] = useState(null)
  const [loadedTrailActivity, setLoadedTrailActivity] = useState(null)

  // Photo capture state
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [offlineModalOpen, setOfflineModalOpen] = useState(false)

  const [huts, setHuts] = useState([])
  const [selectedHut, setSelectedHut] = useState(null)

  const [showFinishModal, setShowFinishModal] = useState(false)
  const [finishRating, setFinishRating] = useState(0)
  const [finishComment, setFinishComment] = useState('')
  const [finishSubmitting, setFinishSubmitting] = useState(false)
  const [finishError, setFinishError] = useState('')
  const [finishSuccess, setFinishSuccess] = useState('')

  const { loadOfflineTrails } = useOfflineStore()


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

  const visibleTrailSourceCollection = useMemo(
    () =>
      viewState.zoom >= TRAIL_VISIBILITY_MIN_ZOOM
        ? trailsGeojson
        : EMPTY_TRAIL_FEATURE_COLLECTION,
    [trailsGeojson, viewState.zoom]
  )

  const trailsById = useMemo(() => {
    const byId = new globalThis.Map()
    trails.forEach((trail) => {
      const id = String(trail?._id || trail?.id || '')
      if (id) byId.set(id, trail)
    })
    return byId
  }, [trails])

  const trailGeojsonFeaturesById = useMemo(() => {
    const byId = new globalThis.Map()
    const features = Array.isArray(trailsGeojson?.features)
      ? trailsGeojson.features
      : []
    features.forEach((feature) => {
      const id = String(feature?.properties?.id || '')
      if (id && !byId.has(id)) byId.set(id, feature)
    })
    return byId
  }, [trailsGeojson])

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

  const handleTogglePitch = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const tilted = map.getPitch() >= 35
    const nextPitch = tilted ? 0 : 58
    const nextBearing = tilted ? 0 : -18
    const nextZoom = tilted ? map.getZoom() : Math.max(map.getZoom(), 13)

    setViewState((old) => ({
      ...old,
      pitch: nextPitch,
      bearing: nextBearing,
      zoom: nextZoom,
    }))

    map.easeTo({
      pitch: nextPitch,
      bearing: nextBearing,
      zoom: nextZoom,
      duration: 500,
      essential: true,
    })
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

    const gpsHeading = Number(position.coords.heading)
    if (Number.isFinite(gpsHeading) && gpsHeading >= 0) {
      setMovementHeading(gpsHeading)
    } else {
      const previousCompassLocation = lastCompassLocationRef.current
      if (previousCompassLocation) {
        const movementMeters = distanceMeters(previousCompassLocation, nextPoint)
        if (movementMeters >= 2) {
          setMovementHeading(bearingDegrees(previousCompassLocation, nextPoint))
        }
      }
    }
    lastCompassLocationRef.current = nextPoint

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
    lastCompassLocationRef.current = null

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
    lastCompassLocationRef.current = null
  }, [clearWatch])

  const resetActivity = useCallback(() => {
    clearWatch()
    setIsTracking(false)
    setPoints([])
    setElapsedSeconds(0)
    setDistance(0)
    setElevationGain(0)
    setCurrentSpeedKmh(0)
    setMovementHeading(null)
    lastCompassLocationRef.current = null
    setGeoError('')
    setPingMode(false)
    setPingDesc('')
    setSelectedPing(null)
    setLoadedTrailActivity(null)
    setSelectedTrail(null)
    setShowPublishForm(false)
    setSavedRoute(null)
    setAiStatus(null)
    setAiResult(null)
    setShowFinishModal(false)
    setFinishRating(0)
    setFinishComment('')
    setFinishError('')
    setFinishSuccess('')
  }, [clearWatch, setSelectedTrail])

  const recordedGeoJSON = useMemo(() => {
    if (points.length < 2) return null
    return {
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
  }, [points])

  const saveTracking = useCallback(() => {
    clearWatch()
    setIsTracking(false)
    if (points.length < 2) return

    if (selectedTrail?._id || selectedTrail?.id) {
      setShowFinishModal(true)
      setFinishRating(0)
      setFinishComment('')
      setFinishError('')
      setFinishSuccess('')
    }

    setShowPublishForm(true)
  }, [clearWatch, points, selectedTrail])

  const submitTrailCompletion = useCallback(async () => {
    const trailId = selectedTrail?._id || selectedTrail?.id
    if (!trailId) {
      setFinishError('No selected trail to rate.')
      return
    }

    setFinishSubmitting(true)
    setFinishError('')
    setFinishSuccess('')

    try {
      const payload = {
        durationSeconds: elapsedSeconds,
        distanceMeters: Math.round(distance),
        elevationGain: Math.round(elevationGain),
        ...(finishRating > 0 ? { accuracy: finishRating } : {}),
        ...(finishComment.trim() ? { comment: finishComment.trim() } : {}),
      }

      const res = await completeTrailFromMap(trailId, payload)
      const data = res?.data || {}

      if (data.reviewAdded) {
        setFinishSuccess('Trail completed and your rating was saved.')
      } else if (finishRating > 0 && data.alreadyReviewed) {
        setFinishSuccess('Trail completed. You already reviewed it before.')
      } else {
        setFinishSuccess('Trail completion saved successfully.')
      }

      setTimeout(() => setShowFinishModal(false), 1000)
    } catch (err) {
      setFinishError(
        err.response?.data?.error || 'Could not save completion now.'
      )
    } finally {
      setFinishSubmitting(false)
    }
  }, [
    selectedTrail,
    elapsedSeconds,
    distance,
    elevationGain,
    finishRating,
    finishComment,
  ])

  const handlePublishSuccess = useCallback(
    (trail) => {
      setShowPublishForm(false)
      setSavedRoute(trail)
      setAiStatus(trail?.ai?.status || 'pending')
      refreshTrails()
    },
    [refreshTrails]
  )

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

  const startLoadedTrailActivity = useCallback(
    (trail) => {
      if (!trail) return

      const trailId = trail._id || trail.id
      if (!trailId) return

      setLoadedTrailActivity({ trailId, trailName: trail.name || 'Trail' })

      const startCoordinates = deriveTrailStartCoordinates(trail)
      if (startCoordinates) {
        setViewState((old) => ({
          ...old,
          longitude: startCoordinates[0],
          latitude: startCoordinates[1],
          zoom: Math.max(old.zoom, 13),
        }))
        mapRef.current?.getMap()?.flyTo({
          center: startCoordinates,
          zoom: 13,
          duration: 700,
          essential: true,
        })
      }

      setSelectedTrail(null)
      setPingMode(false)
    },
    [setSelectedTrail]
  )

  const handleMapClick = useCallback(
    (event) => {
      const map = mapRef.current?.getMap()
      if (!map) return

      const layerIds = RECORD_INTERACTIVE_TRAIL_LAYER_IDS.filter((id) =>
        map.getLayer(id)
      )

      if (!layerIds.length) {
        setSelectedTrail(null)
        setSelectedHut(null)
        return
      }

      const features = map.queryRenderedFeatures(event.point, {
        layers: layerIds,
      })
      if (!features.length) {
        setSelectedTrail(null)
        setSelectedHut(null)
        return
      }

      const properties = features[0]?.properties || {}
      const trailId = String(properties.id || '')
      const selected = trailsById.get(trailId)
      if (selected) {
        setSelectedTrail(selected)
        setSelectedHut(null)
        return
      }

      const geojsonFeature = trailGeojsonFeaturesById.get(trailId)
      if (trailId && geojsonFeature) {
        setSelectedTrail({
          _id: trailId,
          id: trailId,
          name: properties.name || properties.name_bg || 'Trail',
          name_bg: properties.name_bg || '',
          name_en: properties.name_en || '',
          ref: properties.ref || '',
          source: properties.source || 'user',
          difficulty: properties.difficulty || 'moderate',
          colour_type: properties.colour_type || 'unmarked',
          osm_colour: properties.osm_colour || '',
          osm_marking: properties.osm_marking || '',
          network: properties.network || '',
          geojson: {
            type: 'Feature',
            geometry: geojsonFeature.geometry,
            properties,
          },
          stats: {
            distance: Number(properties.distance || 0) * 1000,
            elevationGain: Number(properties.elevation_gain || 0),
          },
        })
        setSelectedHut(null)
      }
    },
    [setSelectedTrail, trailGeojsonFeaturesById, trailsById]
  )

  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextAltitude = Number.isFinite(position.coords.altitude)
          ? position.coords.altitude
          : null

        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }

        setCurrentLocation(nextLocation)

        const gpsHeading = Number(position.coords.heading)
        if (Number.isFinite(gpsHeading) && gpsHeading >= 0) {
          setMovementHeading(gpsHeading)
        } else {
          const previousCompassLocation = lastCompassLocationRef.current
          if (previousCompassLocation) {
            const movementMeters = distanceMeters(
              previousCompassLocation,
              nextLocation
            )
            if (movementMeters >= 2) {
              setMovementHeading(
                bearingDegrees(previousCompassLocation, nextLocation)
              )
            }
          }
        }
        lastCompassLocationRef.current = nextLocation

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

    const loadTrails = async () => {
      setLoadingTrails(true)
      setTrailsError('')

      // Step 1: immediately show whatever is in offline storage
      await loadOfflineTrails()
      const cachedTrails = useOfflineStore.getState().offlineTrails
      if (cachedTrails.length > 0) {
        setTrails([...cachedTrails])
        setTrailsGeojson(buildTrailGeojsonFromTrails(cachedTrails))
        setLoadingTrails(false) // stop the spinner immediately
      }

      // Step 2: try to fetch from API in the background
      try {
        const [trailsResult, geojsonResult] = await Promise.allSettled([
          fetchMapTrails({ compact: true }),
          fetchMapTrailsGeojson(),
        ])
        if (!active) return

        const fresh = cachedTrails.length === 0 // only show loading if we had nothing to show

        if (trailsResult.status === 'fulfilled') {
          const apiTrails = Array.isArray(trailsResult.value?.data) ? trailsResult.value.data : []
          const mergedMap = new globalThis.Map()
          cachedTrails.forEach(t => mergedMap.set(t._id || t.id, t))
          apiTrails.forEach(t => mergedMap.set(t._id || t.id, t))
          setTrails(Array.from(mergedMap.values()))
        } else if (cachedTrails.length === 0) {
          setTrailsError('Could not load trail details from API. Record mode still works.')
        }

        if (geojsonResult.status === 'fulfilled') {
          const apiGeojson = normalizeTrailGeojsonCollection(geojsonResult.value?.data)
          const offlineGeojson = buildTrailGeojsonFromTrails(cachedTrails)
          const mergedFeatures = new globalThis.Map()
          apiGeojson.features.forEach(f => { if (f.properties?.id) mergedFeatures.set(f.properties.id, f) })
          offlineGeojson.features.forEach(f => { if (f.properties?.id && !mergedFeatures.has(f.properties.id)) mergedFeatures.set(f.properties.id, f) })
          setTrailsGeojson({ type: 'FeatureCollection', features: Array.from(mergedFeatures.values()) })
        } else if (cachedTrails.length === 0) {
          setTrailsGeojson(EMPTY_TRAIL_FEATURE_COLLECTION)
        }

        if (fresh) setLoadingTrails(false)
      } catch {
        if (!active) return
        if (cachedTrails.length === 0) {
          setTrailsError('Offline — no cached trails available.')
          setLoadingTrails(false)
        }
      }
    }

    loadTrails()

    return () => {
      active = false
      clearWatch()
      setMode('explore')
      setSelectedTrail(null)
    }
  }, [clearWatch, setMode, setSelectedTrail, loadOfflineTrails])


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

  useEffect(() => {
    if (!savedRoute?._id) return
    if (aiStatus === 'done' || aiStatus === 'error') return

    const interval = setInterval(async () => {
      try {
        const res = await fetchTrailById(savedRoute._id)
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
        /* Ignore transient polling failures. */
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [savedRoute, aiStatus])

  useEffect(() => {
    let active = true
    fetchPings()
      .then((res) => {
        if (active) setPings(Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => {
        if (active) setPings([])
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchHuts()
      .then((res) => {
        if (active) setHuts(Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => {
        if (active) setHuts([])
      })
    return () => {
      active = false
    }
  }, [])

  const handlePingSubmit = useCallback(async () => {
    const activityActive =
      isTracking ||
      points.length > 0 ||
      elapsedSeconds > 0 ||
      distance > 0 ||
      Boolean(loadedTrailActivity)

    if (!activityActive || !currentLocation) return
    setPingSubmitting(true)
    try {
      let nearestTrailId = loadedTrailActivity?.trailId || null
      if (trails.length > 0) {
        let minDist = Infinity
        for (const trail of trails) {
          const center = trail.stats?.centerCoordinates
          if (Array.isArray(center) && center.length === 2) {
            const d = distanceMeters(
              {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              },
              { latitude: center[1], longitude: center[0] }
            )
            if (d < minDist) {
              minDist = d
              nearestTrailId = trail._id || trail.id
            }
          }
        }
        if (minDist > 2000) nearestTrailId = null
      }

      const res = await createPing({
        trailId: nearestTrailId,
        type: pingType,
        description: pingDesc,
        coordinates: [currentLocation.longitude, currentLocation.latitude],
      })
      setPings((prev) => [res.data, ...prev])
      setPingMode(false)
      setPingDesc('')
    } catch (err) {
      console.error('Ping submit error:', err)
    } finally {
      setPingSubmitting(false)
    }
  }, [
    isTracking,
    points,
    elapsedSeconds,
    distance,
    currentLocation,
    pingType,
    pingDesc,
    trails,
    loadedTrailActivity,
  ])

  // Handle photo capture from camera button
  const handlePhotoCapture = useCallback(
    (photo) => {
      const activityActive =
        isTracking ||
        points.length > 0 ||
        elapsedSeconds > 0 ||
        distance > 0 ||
        Boolean(loadedTrailActivity)

      if (!activityActive) return

      setCapturedPhoto(photo)
      setShowPhotoModal(true)
      setSelectedPing(null)
    },
    [isTracking, points.length, elapsedSeconds, distance, loadedTrailActivity]
  )

  // Handle photo submission
  const handlePhotoSubmit = useCallback(async (photoData) => {
    try {
      const trailId = asMongoObjectId(loadedTrailActivity?.trailId)
      const res = await createPhotoPing({
        ...(trailId ? { trailId } : {}),
        description: photoData.description,
        photoUrl: photoData.photoUrl,
        photoCategory: photoData.photoCategory,
        coordinates: photoData.coordinates,
      })
      const savedPhotoPing = {
        ...res.data,
        type: 'photo',
        photoUrl: res.data?.photoUrl || photoData.photoUrl,
        photoCategory: res.data?.photoCategory || photoData.photoCategory,
        coordinates: res.data?.coordinates || photoData.coordinates,
      }
      setPings((prev) => [savedPhotoPing, ...prev])
      setSelectedPing(savedPhotoPing)
      setPingMode(false)
      if (Array.isArray(photoData.coordinates)) {
        setViewState((old) => ({
          ...old,
          longitude: photoData.coordinates[0],
          latitude: photoData.coordinates[1],
          zoom: Math.max(old.zoom || 0, 16),
        }))
      }
    } catch (err) {
      console.error('Photo ping submit error:', err)
      throw err
    }
  }, [loadedTrailActivity])

  const hasRecordingData =
    points.length > 0 || elapsedSeconds > 0 || distance > 0
  const isActivityActive =
    isTracking || hasRecordingData || Boolean(loadedTrailActivity)
  const showControls = hasRecordingData || isTracking

  useEffect(() => {
    if (isActivityActive) return
    setShowPhotoModal(false)
    setCapturedPhoto(null)
  }, [isActivityActive])

  const liveNotificationBody = useMemo(() => {
    return [
      `${steps.toLocaleString()} STEPS   ${formatDuration(elapsedSeconds)} TIME   ${(distance / 1000).toFixed(2)} KM`,
      `${Math.round(currentElevation)} M ELEV   +${Math.round(elevationGain)} GAIN   ${currentSpeedKmh.toFixed(1)} KM/H`,
    ].join('\n')
  }, [
    steps,
    elapsedSeconds,
    distance,
    currentElevation,
    elevationGain,
    currentSpeedKmh,
  ])

  useEffect(() => {
    if (isActivityActive) return
    setPingMode(false)
  }, [isActivityActive])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let cancelled = false
    ;(async () => {
      try {
        const permissions = await LocalNotifications.checkPermissions()
        if (permissions.display !== 'granted') {
          await LocalNotifications.requestPermissions()
        }

        if (Capacitor.getPlatform() === 'android') {
          await LocalNotifications.createChannel({
            id: LIVE_RECORDING_CHANNEL_ID,
            name: 'Live recording',
            description: 'Live stats while recording a trail',
            importance: 2,
            visibility: 1,
            sound: undefined,
          })
        }

        await LocalNotifications.cancel({
          notifications: [{ id: 1101 }],
        })

        if (!cancelled) {
          liveNotificationReadyRef.current = true
        }
      } catch {
        /* Native notification permission setup is best-effort. */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (!liveNotificationReadyRef.current) return

    const syncNotification = async () => {
      if (!isTracking) {
        liveNotificationLastBodyRef.current = ''
        liveNotificationTickRef.current = -1
        try {
          await LocalNotifications.cancel({
            notifications: [{ id: LIVE_RECORDING_NOTIFICATION_ID }],
          })
        } catch {
          /* Native notification cancellation is best-effort. */
        }
        return
      }

      const tick = Math.floor(elapsedSeconds / 5)
      const shouldUpdate =
        elapsedSeconds === 0 ||
        tick !== liveNotificationTickRef.current ||
        liveNotificationBody !== liveNotificationLastBodyRef.current

      if (!shouldUpdate) return

      liveNotificationTickRef.current = tick
      liveNotificationLastBodyRef.current = liveNotificationBody

      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: LIVE_RECORDING_NOTIFICATION_ID,
              channelId:
                Capacitor.getPlatform() === 'android'
                  ? LIVE_RECORDING_CHANNEL_ID
                  : undefined,
              title: 'Trail recording in progress',
              body: liveNotificationBody,
              ongoing: true,
              autoCancel: false,
              schedule: { at: new Date(Date.now() + 100) },
            },
          ],
        })
      } catch {
        /* Native notification sync is best-effort. */
      }
    }

    syncNotification()
  }, [isTracking, elapsedSeconds, liveNotificationBody])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    return () => {
      LocalNotifications.cancel({
        notifications: [{ id: LIVE_RECORDING_NOTIFICATION_ID }],
      }).catch(() => {})
    }
  }, [])

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
          {hillshadeRelief ? (
            <Source
              id={RECORD_DEM_SOURCE_ID}
              type="raster-dem"
              url="mapbox://mapbox.mapbox-terrain-dem-v1"
              tileSize={512}
              maxzoom={14}
            >
              <Layer
                id="record-hillshade-relief"
                type="hillshade"
                paint={{
                  'hillshade-exaggeration': 0.42,
                  'hillshade-shadow-color': '#0f172a',
                  'hillshade-highlight-color': '#e2e8f0',
                  'hillshade-accent-color': '#4281a4',
                }}
              />
            </Source>
          ) : null}

          <TrailMapLayers
            sourceId="record-trails-source"
            layerPrefix={RECORD_TRAIL_LAYER_PREFIX}
            data={visibleTrailSourceCollection}
          />

          {hasVectorTileset ? (
            <Source
              id="record-custom-tileset-source"
              type="vector"
              url={MAPBOX_TILESET_URL}
            >
              <Layer
                id="record-custom-tileset-layer"
                type="line"
                source="record-custom-tileset-source"
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
              id="record-custom-tileset-source"
              type="raster"
              url={MAPBOX_TILESET_URL}
            >
              <Layer
                id="record-custom-tileset-raster-layer"
                type="raster"
                paint={{ 'raster-opacity': 0.9 }}
              />
            </Source>
          ) : null}

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

          {viewState.zoom >= 10 &&
            huts.map((hut) => {
              if (!Array.isArray(hut.location) || hut.location.length < 2)
                return null
              const [lng, lat] = hut.location
              const isSelected = selectedHut?._id === hut._id
              return (
                <Marker
                  key={hut._id}
                  longitude={lng}
                  latitude={lat}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation()
                    setSelectedHut(isSelected ? null : hut)
                    setSelectedPing(null)
                  }}
                >
                  <div
                    title={hut.name}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#166534',
                      color: '#f8fafc',
                      display: 'grid',
                      placeItems: 'center',
                      border: '2px solid #bbf7d0',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    }}
                  >
                    ⌂
                  </div>
                </Marker>
              )
            })}

          {pings.map((ping) => {
              const cfg = PING_TYPES[ping.type] || PING_TYPES.junk
              const isPhoto = Boolean(ping.photoUrl)
              const categoryMeta =
                PHOTO_CATEGORY_META[ping.photoCategory] ||
                PHOTO_CATEGORY_META.memory

              if (!isPhoto && viewState.zoom < 12) return null

              if (isPhoto) {
                return (
                  <Marker
                    key={ping._id}
                    longitude={ping.coordinates[0]}
                    latitude={ping.coordinates[1]}
                    anchor="center"
                    onClick={(e) => {
                      e.originalEvent.stopPropagation()
                      setSelectedPing(
                        selectedPing?._id === ping._id ? null : ping
                      )
                    }}
                  >
                    <div
                      style={{
                        ...photoMarkerStyle,
                        borderColor: categoryMeta.color,
                      }}
                      title={`${categoryMeta.label}: ${ping.description || 'No description'}`}
                    >
                      <img
                        src={ping.photoUrl}
                        alt={ping.description || 'Photo'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </div>
                  </Marker>
                )
              }

              return (
                <Marker
                  key={ping._id}
                  longitude={ping.coordinates[0]}
                  latitude={ping.coordinates[1]}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation()
                    setSelectedPing(
                      selectedPing?._id === ping._id ? null : ping
                    )
                  }}
                >
                  <div
                    style={{ ...pingMarkerStyle, background: cfg.color }}
                    title={`${cfg.label}: ${ping.description || 'No description'}`}
                  >
                    {cfg.emoji}
                  </div>
                </Marker>
              )
            })}
        </Map>
      </div>

      <LiveCompass
        mapBearing={viewState.bearing}
        movementHeading={movementHeading}
        top={
          showControls
            ? 'calc(env(safe-area-inset-top, 0px) + 156px)'
            : undefined
        }
        left={12}
        zIndex={19}
      />

      {isActivityActive ? (
        <CameraButton
          onPhotoCapture={handlePhotoCapture}
          className="record-camera-button"
        />
      ) : null}

      {/* Photo capture modal */}
      <PhotoCaptureModal
        photo={capturedPhoto}
        isOpen={showPhotoModal}
        onClose={() => {
          setShowPhotoModal(false)
          setCapturedPhoto(null)
        }}
        onSubmit={handlePhotoSubmit}
      />

      {isActivityActive ? (
        <button
          onClick={() => {
            setPingMode((v) => !v)
            setSelectedPing(null)
          }}
          className={`record-ping-button ${pingMode ? 'active' : ''}`}
          type="button"
          aria-label={pingMode ? 'Cancel ping' : 'Add ping'}
          title={pingMode ? 'Cancel ping' : 'Add ping'}
        >
          {pingMode ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 21s7-5.4 7-12a7 7 0 0 0-14 0c0 6.6 7 12 7 12z" />
              <circle cx="12" cy="9" r="2.4" />
            </svg>
          )}
        </button>
      ) : null}

      {pingMode && isActivityActive && (
        <div style={pingPopupStyle}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>
            New Ping at your location
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {Object.entries(REPORT_PING_TYPES).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setPingType(key)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 10,
                  border:
                    pingType === key
                      ? `2px solid ${cfg.color}`
                      : '2px solid rgba(148,163,184,0.2)',
                  background:
                    pingType === key ? `${cfg.color}22` : 'rgba(15,23,35,0.6)',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                <span style={{ fontSize: 20, display: 'block' }}>
                  {cfg.emoji}
                </span>
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

          {!currentLocation && (
            <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>
              Waiting for GPS location...
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                setPingMode(false)
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
              disabled={pingSubmitting || !currentLocation}
              style={{
                ...pingBtnBase,
                flex: 1,
                background: 'linear-gradient(135deg, #48a9a6, #4281a4)',
                color: '#fff',
                opacity: pingSubmitting || !currentLocation ? 0.6 : 1,
              }}
            >
              {pingSubmitting ? 'Saving...' : 'Place Ping'}
            </button>
          </div>
        </div>
      )}

      {selectedPing && !pingMode && (
        <div style={{ ...pingPopupStyle, padding: '12px 14px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
            }}
          >
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
          {selectedPing.photoUrl ? (
            <div style={{ marginBottom: 6 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 8,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: 'rgba(148,163,184,0.14)',
                  color:
                    (
                      PHOTO_CATEGORY_META[selectedPing.photoCategory] ||
                      PHOTO_CATEGORY_META.memory
                    ).color,
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {(
                  PHOTO_CATEGORY_META[selectedPing.photoCategory] ||
                  PHOTO_CATEGORY_META.memory
                ).label}
              </div>
              <img
                src={selectedPing.photoUrl}
                alt={selectedPing.description || 'Photo'}
                style={{
                  width: '100%',
                  maxHeight: '200px',
                  objectFit: 'cover',
                  borderRadius: 8,
                }}
              />
            </div>
          ) : null}
          <div style={{ fontSize: 11, color: '#64748b' }}>
            By {selectedPing.username || 'Anonymous'} &middot;{' '}
            {new Date(selectedPing.createdAt).toLocaleDateString()}
          </div>
          <button
            onClick={() => setSelectedPing(null)}
            style={{
              ...pingBtnBase,
              marginTop: 8,
              background: 'rgba(148,163,184,0.15)',
              color: '#94a3b8',
              width: '100%',
            }}
          >
            Close
          </button>
        </div>
      )}

      <div className="record-status-wrap">
        <div className="record-topbar">
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
        {trailsError && (
          <div className="record-info-box record-info-error">
            {trailsError}
          </div>
        )}
        {geoError && (
          <div className="record-info-box record-info-error">{geoError}</div>
        )}
      </div>

      <MapControls
        onCenterMe={handleCenterMe}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onTogglePitch={handleTogglePitch}
        showResetViewButton={false}
        onToggleOffline={() => setOfflineModalOpen(true)}
        showOfflineButton={true}
      />

      <OfflineMapModal
        isOpen={offlineModalOpen}
        onClose={() => setOfflineModalOpen(false)}
        mapCenter={viewState}
      />

      {selectedTrail && !selectedHut && (
        <RoutePreviewCard onStartTrail={startLoadedTrailActivity} />
      )}

      {selectedHut && (
        <HutPreviewCard
          hut={selectedHut}
          onClose={() => setSelectedHut(null)}
          bottomOffset="calc(env(safe-area-inset-bottom, 0px) + 228px)"
        />
      )}

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
              <span> AI analysis failed</span>
              {aiResult?.error && <p>{aiResult.error}</p>}
            </div>
          )}

          {aiStatus === 'done' && aiResult && (
            <div className="record-ai-results">
              <h3 className="record-ai-title">🧠 AI Trail Analysis</h3>

              {aiResult.overallDifficulty && (
                <div
                  className={`record-ai-difficulty record-ai-diff-${aiResult.overallDifficulty}`}
                >
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
                    <div
                      key={i}
                      className={`record-ai-segment record-ai-seg-${seg.difficulty}`}
                    >
                      <div className="record-ai-seg-header">
                        <strong>{seg.name}</strong>
                        <span className="record-ai-seg-badge">
                          {seg.difficulty}
                        </span>
                        {seg.estimatedTime && (
                          <span className="record-ai-seg-time">
                            {seg.estimatedTime}
                          </span>
                        )}
                      </div>
                      <p>{seg.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {aiResult.warnings?.length > 0 && (
                <div className="record-ai-warnings">
                  <h4>Warnings</h4>
                  {aiResult.warnings.map((w, i) => (
                    <div
                      key={i}
                      className={`record-ai-warning record-ai-warn-${w.severity}`}
                    >
                      <span className="record-ai-warn-severity">
                        {w.severity?.toUpperCase()}
                      </span>
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
                onClick={saveTracking}
                disabled={saving || points.length < 2}
                className="record-action-btn record-save-btn"
              >
                {saving ? 'Saving...' : 'Save'}
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
                onClick={resetActivity}
                className="record-action-btn record-reset-btn"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {showPublishForm && recordedGeoJSON && (
        <RouteBuilderForm
          geojson={recordedGeoJSON}
          onSuccess={handlePublishSuccess}
          onCancel={() => setShowPublishForm(false)}
        />
      )}

      {showFinishModal && selectedTrail && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 60,
            background: 'rgba(3, 9, 17, 0.56)',
            display: 'grid',
            placeItems: 'center',
            padding: 14,
          }}
          onClick={() => {
            if (!finishSubmitting) setShowFinishModal(false)
          }}
        >
          <div
            style={{
              width: 'min(92vw, 460px)',
              border: '1px solid rgba(66,129,164,0.5)',
              borderRadius: 14,
              background: 'rgba(17,26,40,0.96)',
              boxShadow: '0 12px 28px rgba(0,1,0,0.45)',
              backdropFilter: 'blur(8px)',
              color: '#e2e8f0',
              padding: 14,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ fontSize: 12, color: '#89afc2', fontWeight: 700 }}>
              TRAIL COMPLETED
            </div>
            <h3 style={{ margin: '4px 0 8px 0' }}>
              Congrats! You finished {selectedTrail.name}.
            </h3>

            <div
              style={{
                border: '1px solid rgba(148,163,184,0.28)',
                borderRadius: 10,
                padding: '8px 10px',
                fontSize: 13,
                display: 'grid',
                gap: 4,
              }}
            >
              <div>Distance: {(distance / 1000).toFixed(2)} km</div>
              <div>Time: {formatDuration(elapsedSeconds)}</div>
              <div>Elevation gain: +{Math.round(elevationGain)} m</div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: '#bfd4de' }}>
              Rate this trail (optional):
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setFinishRating(star)}
                  style={{
                    ...pingBtnBase,
                    flex: 1,
                    background:
                      finishRating >= star
                        ? 'rgba(250,204,21,0.25)'
                        : 'rgba(148,163,184,0.12)',
                    color: finishRating >= star ? '#facc15' : '#94a3b8',
                    padding: '8px 0',
                  }}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={finishComment}
              onChange={(event) => setFinishComment(event.target.value)}
              placeholder="Share quick feedback (optional)"
              rows={3}
              maxLength={500}
              style={{
                width: '100%',
                marginTop: 10,
                borderRadius: 10,
                border: '1px solid rgba(66,129,164,0.34)',
                background: 'rgba(15,23,35,0.88)',
                color: '#fbfef9',
                fontSize: 13,
                outline: 'none',
                padding: 10,
                boxSizing: 'border-box',
              }}
            />

            {finishError && (
              <div
                style={{
                  marginTop: 8,
                  color: '#fca5a5',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {finishError}
              </div>
            )}
            {finishSuccess && (
              <div
                style={{
                  marginTop: 8,
                  color: '#86efac',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {finishSuccess}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={submitTrailCompletion}
                disabled={finishSubmitting}
                style={{
                  ...pingBtnBase,
                  flex: 1,
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: '#fff',
                  opacity: finishSubmitting ? 0.6 : 1,
                }}
              >
                {finishSubmitting ? 'Saving...' : 'Submit Completion'}
              </button>
              <button
                onClick={() => setShowFinishModal(false)}
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
        </div>
      )}

      <div className="record-bottomnav-wrap">
        <BottomNav />
      </div>
    </div>
  )
}
