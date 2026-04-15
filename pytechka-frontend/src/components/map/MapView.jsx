import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import Map, { Source, Layer, Marker } from 'react-map-gl/mapbox'
import {
  circle as turfCircle,
  nearestPointOnLine,
  point as turfPoint,
} from '@turf/turf'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'

import { useMapStore } from '../../store/mapStore'
import {
  fetchMapTrails,
  fetchTrailStartReadiness,
  completeTrailFromMap,
  fetchHuts,
} from '../../api/maps'
import {
  fetchPings,
  createPing,
  votePingGone,
  fetchClusters,
  voteClusterGone,
} from '../../api/pings'
import {
  fetchCurrentWeather,
  fetchWeatherForecast,
  hasWeatherApiKey,
} from '../../api/weather'
import { buildCenteredView } from '../../utils/mapDefaults'
import MapControls from './MapControls'
import RoutePreviewCard from '../layout/RoutePreviewCard'
import HutPreviewCard from '../layout/HutPreviewCard'

const INITIAL_VIEW = buildCenteredView(7)

const DIFFICULTY_COLOR = {
  easy: '#22c55e',
  moderate: '#f97316',
  hard: '#ef4444',
  extreme: '#7f1d1d',
}

const DIFFICULTY_LABEL = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  extreme: 'Extreme',
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

const MAPS_BOTTOM_CARD_OFFSET = '5.5rem'
const USER_FOLLOW_BASE_ZOOM = 14.2
const USER_FOLLOW_TRAIL_ZOOM = 17.8

const SEGMENT_COLOR_EXPRESSION = [
  'match',
  ['get', 'difficulty'],
  'easy',
  DIFFICULTY_COLOR.easy,
  'moderate',
  DIFFICULTY_COLOR.moderate,
  'hard',
  DIFFICULTY_COLOR.hard,
  'extreme',
  DIFFICULTY_COLOR.extreme,
  '#64748b',
]

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
  radiusWrap: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
    width: 'min(92vw, 360px)',
    zIndex: 17,
    border: '1px solid rgba(66, 129, 164, 0.36)',
    borderRadius: 14,
    background: 'rgba(12, 20, 32, 0.9)',
    boxShadow: '0 10px 22px rgba(0,1,0,0.3)',
    backdropFilter: 'blur(8px)',
    padding: '9px 10px',
    display: 'grid',
    gap: 6,
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

const PING_TYPES = {
  junk: { label: 'Junk / Rubbish', marker: 'J', color: '#f59e0b' },
  mud: { label: 'Mud', marker: 'M', color: '#92400e' },
  environmental_danger: {
    label: 'Environmental Danger',
    marker: 'D',
    color: '#dc2626',
  },
}

const CLUSTER_CONFIG = {
  clutter: {
    label: 'Trash Clutter',
    marker: 'C',
    color: '#f97316',
    votesNeeded: 3,
  },
  event: {
    label: 'Cleanup Event',
    marker: 'E',
    color: '#dc2626',
    votesNeeded: 5,
  },
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

const overlayCard = {
  width: 'min(92vw, 420px)',
  zIndex: 31,
  border: '1px solid rgba(66, 129, 164, 0.5)',
  borderRadius: 14,
  background: 'rgba(17, 26, 40, 0.96)',
  boxShadow: '0 12px 28px rgba(0,1,0,0.45)',
  backdropFilter: 'blur(8px)',
  color: '#e2e8f0',
}

const pingPopupStyle = {
  ...overlayCard,
  position: 'absolute',
  bottom: MAPS_BOTTOM_CARD_OFFSET,
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '14px 16px',
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

function extractLineCoordinates(geojson) {
  const parsed = parseTrailGeojson(geojson)
  if (!parsed) return []

  if (parsed.type === 'LineString') {
    return Array.isArray(parsed.coordinates) ? parsed.coordinates : []
  }

  if (parsed.type === 'MultiLineString') {
    return Array.isArray(parsed.coordinates)
      ? parsed.coordinates.flatMap((line) => (Array.isArray(line) ? line : []))
      : []
  }

  if (parsed.type === 'Feature') {
    return extractLineCoordinates(parsed.geometry)
  }

  if (parsed.type === 'FeatureCollection') {
    return Array.isArray(parsed.features)
      ? parsed.features.flatMap((feature) =>
          extractLineCoordinates(feature?.geometry)
        )
      : []
  }

  return []
}

function deriveTrailStartCoordinates(trail) {
  const fromTrail = Array.isArray(trail?.startCoordinates)
    ? trail.startCoordinates
    : Array.isArray(trail?.stats?.startCoordinates)
      ? trail.stats.startCoordinates
      : null

  if (fromTrail && fromTrail.length === 2) {
    return [Number(fromTrail[0]), Number(fromTrail[1])]
  }

  const coords = extractLineCoordinates(trail?.geojson)
  if (!coords.length) return null

  return [Number(coords[0][0]), Number(coords[0][1])]
}

function haversineMeters([lon1, lat1], [lon2, lat2]) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function pathLengthMeters(pathCoordinates) {
  if (!Array.isArray(pathCoordinates) || pathCoordinates.length < 2) return 0

  let total = 0
  for (let i = 1; i < pathCoordinates.length; i += 1) {
    const prev = pathCoordinates[i - 1]
    const current = pathCoordinates[i]
    total += haversineMeters(
      [Number(prev[0]), Number(prev[1])],
      [Number(current[0]), Number(current[1])]
    )
  }
  return total
}

function resolveTrailTotalDistanceMeters(trail, pathCoordinates) {
  const statsDistance = Number(trail?.stats?.distance)
  if (Number.isFinite(statsDistance) && statsDistance > 0) {
    return statsDistance
  }

  const statsDistanceMeters = Number(trail?.stats?.distanceMeters)
  if (Number.isFinite(statsDistanceMeters) && statsDistanceMeters > 0) {
    return statsDistanceMeters
  }

  const directDistanceMeters = Number(trail?.distanceMeters)
  if (Number.isFinite(directDistanceMeters) && directDistanceMeters > 0) {
    return directDistanceMeters
  }

  const directDistanceKm = Number(trail?.distance)
  if (Number.isFinite(directDistanceKm) && directDistanceKm > 0) {
    return directDistanceKm * 1000
  }

  return pathLengthMeters(pathCoordinates)
}

function resolveTrailElevationMeters(trail) {
  const statsElevation = Number(trail?.stats?.elevationGain)
  if (Number.isFinite(statsElevation)) return statsElevation

  const directElevation = Number(trail?.elevation)
  if (Number.isFinite(directElevation)) return directElevation

  return null
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0)
  const hh = Math.floor(total / 3600)
  const mm = Math.floor((total % 3600) / 60)
  const ss = total % 60

  if (hh > 0) {
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(
      ss
    ).padStart(2, '0')}`
  }

  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function sanitizeSegment(segment, maxIndex) {
  const startIndex = Math.max(
    0,
    Math.min(maxIndex, Number(segment?.startIndex || 0))
  )
  const endIndex = Math.max(
    startIndex,
    Math.min(maxIndex, Number(segment?.endIndex || maxIndex))
  )

  return {
    name: String(segment?.name || 'Sector'),
    difficulty: String(segment?.difficulty || 'moderate').toLowerCase(),
    description: String(segment?.description || ''),
    estimatedTime: String(segment?.estimatedTime || ''),
    startIndex,
    endIndex,
  }
}

function buildSegmentModel(trail, pointCount) {
  const maxIndex = Math.max(0, Number(pointCount) - 1)
  if (maxIndex === 0) {
    return [
      {
        name: 'Sector 1',
        difficulty: String(trail?.difficulty || 'moderate').toLowerCase(),
        description: 'Start segment',
        estimatedTime: '',
        startIndex: 0,
        endIndex: 0,
      },
    ]
  }

  const aiSegments = Array.isArray(trail?.ai?.segments) ? trail.ai.segments : []
  if (aiSegments.length) {
    const normalized = aiSegments
      .map((segment) => sanitizeSegment(segment, maxIndex))
      .filter((segment) => segment.endIndex >= segment.startIndex)

    if (normalized.length) return normalized
  }

  const a = Math.floor(maxIndex * 0.33)
  const b = Math.floor(maxIndex * 0.66)
  const difficulty = String(trail?.difficulty || 'moderate').toLowerCase()

  return [
    {
      name: 'Sector 1',
      difficulty: difficulty === 'extreme' ? 'hard' : 'easy',
      description: 'Warm up and establish your pace.',
      estimatedTime: '',
      startIndex: 0,
      endIndex: Math.max(1, a),
    },
    {
      name: 'Sector 2',
      difficulty,
      description: 'Main climbing and technical section.',
      estimatedTime: '',
      startIndex: Math.max(1, a + 1),
      endIndex: Math.max(a + 1, b),
    },
    {
      name: 'Sector 3',
      difficulty: difficulty === 'easy' ? 'moderate' : difficulty,
      description: 'Final section and descent to finish.',
      estimatedTime: '',
      startIndex: Math.max(b + 1, 0),
      endIndex: maxIndex,
    },
  ]
}

function buildSegmentFeatureCollection(pathCoordinates, segments) {
  if (!Array.isArray(pathCoordinates) || pathCoordinates.length < 2) return null
  if (!Array.isArray(segments) || !segments.length) return null

  const maxIndex = pathCoordinates.length - 1
  const features = segments
    .map((segment, index) => {
      const startIndex = Math.max(
        0,
        Math.min(maxIndex, Number(segment?.startIndex || 0))
      )
      const endIndex = Math.max(
        startIndex,
        Math.min(maxIndex, Number(segment?.endIndex || maxIndex))
      )

      const coords = pathCoordinates
        .slice(startIndex, endIndex + 1)
        .map((point) => [Number(point[0]), Number(point[1])])
        .filter(
          (point) => Number.isFinite(point[0]) && Number.isFinite(point[1])
        )

      if (coords.length < 2) return null

      return {
        type: 'Feature',
        properties: {
          segmentIndex: index,
          name: String(segment?.name || `Segment ${index + 1}`),
          difficulty: String(segment?.difficulty || 'moderate').toLowerCase(),
          estimatedTime: String(segment?.estimatedTime || ''),
          description: String(segment?.description || ''),
          pointCount: endIndex - startIndex + 1,
        },
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      }
    })
    .filter(Boolean)

  if (!features.length) return null
  return {
    type: 'FeatureCollection',
    features,
  }
}

function getNearestPathIndex(pathCoordinates, userLocation) {
  if (
    !Array.isArray(pathCoordinates) ||
    !pathCoordinates.length ||
    !userLocation
  ) {
    return -1
  }

  let nearestIndex = -1
  let minDistance = Infinity

  for (let i = 0; i < pathCoordinates.length; i += 1) {
    const point = pathCoordinates[i]
    const d = haversineMeters(
      [Number(point[0]), Number(point[1])],
      [Number(userLocation.longitude), Number(userLocation.latitude)]
    )
    if (d < minDistance) {
      minDistance = d
      nearestIndex = i
    }
  }

  return nearestIndex
}

function getSafetyDecision({ trail, forecast, readiness }) {
  const warnings = Array.isArray(trail?.ai?.warnings) ? trail.ai.warnings : []
  const highWarnings = warnings.filter(
    (entry) => String(entry?.severity || '').toLowerCase() === 'high'
  )
  const mediumWarnings = warnings.filter(
    (entry) => String(entry?.severity || '').toLowerCase() === 'medium'
  )

  const firstForecast =
    Array.isArray(forecast) && forecast.length ? forecast[0] : null
  const weatherMain = String(firstForecast?.condition || '').toLowerCase()
  const wind = Number(firstForecast?.windSpeed || 0)
  const rain = Number(firstForecast?.rainVolume || 0)

  const severeWeather =
    weatherMain.includes('thunder') ||
    weatherMain.includes('snow') ||
    wind >= 12 ||
    rain >= 2.5

  const cautionWeather =
    wind >= 8 || rain >= 0.8 || weatherMain.includes('rain')

  const tooFar = Number(readiness?.distanceToStartMeters || 0) > 1000

  if (tooFar || severeWeather || highWarnings.length > 0) {
    return {
      level: 'high',
      unsafe: true,
      title: 'High Risk',
      summary:
        'Start is not recommended right now. Weather, AI warnings, or distance-to-start is outside the safe threshold.',
    }
  }

  if (cautionWeather || mediumWarnings.length > 0) {
    return {
      level: 'medium',
      unsafe: false,
      title: 'Caution',
      summary:
        'Trail can be started, but keep an eye on conditions and follow sector guidance.',
    }
  }

  return {
    level: 'low',
    unsafe: false,
    title: 'Good To Start',
    summary: 'Weather and route signals look stable for starting this trail.',
  }
}

function weatherIconUrl(icon) {
  if (!icon) return ''
  return `https://openweathermap.org/img/wn/${icon}@2x.png`
}

export default function MapView({
  searchQuery = '',
  initialStartFocus = null,
  onTrailFlowVisibilityChange = null,
}) {
  const navigate = useNavigate()
  const { isSignedIn, userId } = useAuth()
  const mapRef = useRef(null)
  const locationWatchRef = useRef(null)
  const hasAutoCenteredOnUserRef = useRef(false)
  const lastCenteredLocationRef = useRef(null)
  const trailFollowModeRef = useRef(false)
  const lastActivityPointRef = useRef(null)
  const lastStartReadinessLocationRef = useRef(null)
  const promptedReportsRef = useRef(new Set())
  const initialStartFocusAppliedRef = useRef('')
  const initialTrailSelectionRef = useRef('')

  const {
    mapStyle,
    terrain3D,
    selectedTrail,
    setSelectedTrail,
    trailsVersion,
    huts,
    setHuts,
    selectedHut,
    setSelectedHut,
  } = useMapStore()

  useEffect(() => {
    let active = true
    fetchHuts()
      .then((res) => {
        if (active && Array.isArray(res.data)) {
          setHuts(res.data)
        }
      })
      .catch((err) => console.error('Failed to fetch huts', err))
    return () => { active = false }
  }, [setHuts])

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
  const [areaInsightsEnabled, setAreaInsightsEnabled] = useState(false)
  const [areaInsightsMinimized, setAreaInsightsMinimized] = useState(false)

  const [areaWeatherLoading, setAreaWeatherLoading] = useState(false)
  const [areaWeatherError, setAreaWeatherError] = useState('')
  const [areaWeather, setAreaWeather] = useState(null)

  const [startPanelTrail, setStartPanelTrail] = useState(null)
  const [startPanelLoading, setStartPanelLoading] = useState(false)
  const [startPanelError, setStartPanelError] = useState('')
  const [startReadiness, setStartReadiness] = useState(null)
  const [startForecast, setStartForecast] = useState([])
  const [startWeatherNow, setStartWeatherNow] = useState(null)
  const [startHoveredSegment, setStartHoveredSegment] = useState(0)
  const [startUnsafeAcknowledged, setStartUnsafeAcknowledged] = useState(false)

  const [activeTrailSession, setActiveTrailSession] = useState(null)
  const [activityDistanceMeters, setActivityDistanceMeters] = useState(0)
  const [activityDurationSeconds, setActivityDurationSeconds] = useState(0)
  const [activityCurrentElevation, setActivityCurrentElevation] = useState(null)
  const [activityElevationGain, setActivityElevationGain] = useState(0)
  const [currentSectorIndex, setCurrentSectorIndex] = useState(0)
  const [showSectorSummary, setShowSectorSummary] = useState(false)

  const [finishModalTrail, setFinishModalTrail] = useState(null)
  const [finishStats, setFinishStats] = useState(null)
  const [finishRating, setFinishRating] = useState(0)
  const [finishComment, setFinishComment] = useState('')
  const [finishSubmitting, setFinishSubmitting] = useState(false)
  const [finishError, setFinishError] = useState('')
  const [finishSuccess, setFinishSuccess] = useState('')

  const [stillTherePrompt, setStillTherePrompt] = useState(null)
  const [stillThereSubmitting, setStillThereSubmitting] = useState(false)

  const [userLocation, setUserLocation] = useState(null)

  const [pings, setPings] = useState([])
  const [pingMode, setPingMode] = useState(false)
  const [pendingPing, setPendingPing] = useState(null)
  const [pingType, setPingType] = useState('junk')
  const [pingDesc, setPingDesc] = useState('')
  const [pingSubmitting, setPingSubmitting] = useState(false)
  const [selectedPing, setSelectedPing] = useState(null)

  const [clusters, setClusters] = useState([])
  const [selectedCluster, setSelectedCluster] = useState(null)
  const [voteSubmitting, setVoteSubmitting] = useState(false)

  const isTrailFlowOverlayOpen = Boolean(
    activeTrailSession || (finishModalTrail && finishStats)
  )

  const showRadiusPanel =
    areaInsightsEnabled && !startPanelTrail && !isTrailFlowOverlayOpen

  useEffect(() => {
    if (typeof onTrailFlowVisibilityChange === 'function') {
      onTrailFlowVisibilityChange(isTrailFlowOverlayOpen)
    }
  }, [isTrailFlowOverlayOpen, onTrailFlowVisibilityChange])

  const defaultMapStyle = useMemo(
    () => `mapbox://styles/mapbox/${mapStyle}`,
    [mapStyle]
  )

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

  const visibleTrailEntries = useMemo(() => {
    if (!activeTrailSession?.trailId) return renderableTrails
    const activeTrailId = String(activeTrailSession.trailId)
    return renderableTrails.filter(
      ({ trail }) => String(trail._id || trail.id) === activeTrailId
    )
  }, [renderableTrails, activeTrailSession])

  const selectedAreaFeature = useMemo(() => {
    if (!selectedAreaCenter) return null

    return turfCircle(selectedAreaCenter, selectedAreaRadiusKm, {
      units: 'kilometers',
      steps: 60,
    })
  }, [selectedAreaCenter, selectedAreaRadiusKm])

  const selectedAreaTrails = useMemo(() => {
    if (!selectedAreaCenter) return []

    const radiusMeters = selectedAreaRadiusKm * 1000

    return trails
      .map((trail) => {
        const startCoordinates = deriveTrailStartCoordinates(trail)
        if (!startCoordinates) return null

        const distanceMeters = haversineMeters(
          selectedAreaCenter,
          startCoordinates
        )
        return {
          trail,
          startCoordinates,
          distanceMeters,
          withinRadius: distanceMeters <= radiusMeters,
        }
      })
      .filter((entry) => entry && entry.withinRadius)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
  }, [trails, selectedAreaCenter, selectedAreaRadiusKm])

  const startPanelCoordinates = useMemo(() => {
    if (!startPanelTrail) return null
    return deriveTrailStartCoordinates(startPanelTrail)
  }, [startPanelTrail])

  const startPanelPathCoordinates = useMemo(() => {
    return extractLineCoordinates(startPanelTrail?.geojson)
  }, [startPanelTrail])

  const startPanelSegments = useMemo(() => {
    return buildSegmentModel(startPanelTrail, startPanelPathCoordinates.length)
  }, [startPanelTrail, startPanelPathCoordinates])

  const startSafety = useMemo(() => {
    return getSafetyDecision({
      trail: startPanelTrail,
      forecast: startForecast,
      readiness: startReadiness,
    })
  }, [startPanelTrail, startForecast, startReadiness])

  const activeSector = useMemo(() => {
    if (!activeTrailSession?.segments?.length) return null
    const safeIndex = Math.max(
      0,
      Math.min(currentSectorIndex, activeTrailSession.segments.length - 1)
    )
    return activeTrailSession.segments[safeIndex]
  }, [activeTrailSession, currentSectorIndex])

  const activitySteps = useMemo(
    () => Math.max(0, Math.round(activityDistanceMeters / 0.78)),
    [activityDistanceMeters]
  )

  const activityDistanceProgressText = useMemo(() => {
    const coveredKm = (activityDistanceMeters / 1000).toFixed(2)
    const totalMeters = Number(activeTrailSession?.totalDistanceMeters || 0)
    const totalKm = totalMeters > 0 ? (totalMeters / 1000).toFixed(2) : '--'
    return `${coveredKm} / ${totalKm} km`
  }, [activityDistanceMeters, activeTrailSession])

  const activityProgressPercent = useMemo(() => {
    const total = Number(activeTrailSession?.totalDistanceMeters || 0)
    if (total <= 0) return 0
    return Math.max(0, Math.min(100, (activityDistanceMeters / total) * 100))
  }, [activityDistanceMeters, activeTrailSession])

  const activityPaceText = useMemo(() => {
    if (activityDistanceMeters <= 0.1) return '--'
    const km = activityDistanceMeters / 1000
    const minPerKm = activityDurationSeconds / 60 / km
    if (!Number.isFinite(minPerKm) || minPerKm <= 0) return '--'
    const minutes = Math.floor(minPerKm)
    const seconds = Math.round((minPerKm - minutes) * 60)
    return `${minutes}:${String(seconds).padStart(2, '0')} min/km`
  }, [activityDistanceMeters, activityDurationSeconds])

  const startPanelSegmentFeatures = useMemo(
    () =>
      buildSegmentFeatureCollection(
        startPanelPathCoordinates,
        startPanelSegments
      ),
    [startPanelPathCoordinates, startPanelSegments]
  )

  const loadedRouteCoordinates = useMemo(() => {
    if (Array.isArray(activeTrailSession?.pathCoordinates)) {
      return activeTrailSession.pathCoordinates
    }

    if (
      Array.isArray(startPanelPathCoordinates) &&
      startPanelPathCoordinates.length
    ) {
      return startPanelPathCoordinates
    }

    return extractLineCoordinates(selectedTrail?.geojson)
  }, [activeTrailSession, startPanelPathCoordinates, selectedTrail])

  const loadedRouteEndpoints = useMemo(() => {
    if (
      !Array.isArray(loadedRouteCoordinates) ||
      loadedRouteCoordinates.length < 2
    ) {
      return null
    }

    const start = loadedRouteCoordinates[0]
    const finish = loadedRouteCoordinates[loadedRouteCoordinates.length - 1]
    const startCoordinates = [Number(start[0]), Number(start[1])]
    const endCoordinates = [Number(finish[0]), Number(finish[1])]

    if (
      !Number.isFinite(startCoordinates[0]) ||
      !Number.isFinite(startCoordinates[1]) ||
      !Number.isFinite(endCoordinates[0]) ||
      !Number.isFinite(endCoordinates[1])
    ) {
      return null
    }

    return { startCoordinates, endCoordinates }
  }, [loadedRouteCoordinates])

  const activeTrailSegmentFeatures = useMemo(
    () =>
      buildSegmentFeatureCollection(
        activeTrailSession?.pathCoordinates,
        activeTrailSession?.segments
      ),
    [activeTrailSession]
  )

  const showUnsafeStartAlert = Boolean(
    startPanelTrail && startSafety.unsafe && !startUnsafeAcknowledged
  )

  useEffect(() => {
    trailFollowModeRef.current = Boolean(activeTrailSession)
  }, [activeTrailSession])

  const applyLiveUserLocation = useCallback((coords, options = {}) => {
    const longitude = Number(coords?.longitude)
    const latitude = Number(coords?.latitude)
    const altitude = Number.isFinite(coords?.altitude) ? coords.altitude : null

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return

    setGeoError('')
    setUserLocation({ longitude, latitude, altitude })
    setActivityCurrentElevation(altitude)

    const forceZoom = options.forceZoom === true
    const isTrailFollowMode =
      options.trailMode === true || trailFollowModeRef.current
    const previousCenter = lastCenteredLocationRef.current
    const movementThresholdMeters = isTrailFollowMode ? 0.6 : 4
    const movedEnough =
      !previousCenter ||
      haversineMeters(
        [previousCenter.longitude, previousCenter.latitude],
        [longitude, latitude]
      ) >= movementThresholdMeters

    const map = mapRef.current?.getMap()
    const mapCenter = map?.getCenter?.() || null
    const mapCenterDistanceMeters = mapCenter
      ? haversineMeters([mapCenter.lng, mapCenter.lat], [longitude, latitude])
      : 0
    const mapDriftThresholdMeters = isTrailFollowMode ? 1.5 : 12
    const mapIsOffUser = mapCenterDistanceMeters > mapDriftThresholdMeters
    const shouldRecenter =
      forceZoom ||
      !hasAutoCenteredOnUserRef.current ||
      movedEnough ||
      mapIsOffUser ||
      isTrailFollowMode

    if (!shouldRecenter) {
      return
    }

    const minFollowZoom = isTrailFollowMode
      ? USER_FOLLOW_TRAIL_ZOOM
      : USER_FOLLOW_BASE_ZOOM
    const nextMinZoom =
      forceZoom || !hasAutoCenteredOnUserRef.current || isTrailFollowMode
        ? minFollowZoom
        : null

    setViewState((prev) => ({
      ...prev,
      longitude,
      latitude,
      zoom: nextMinZoom ? Math.max(prev.zoom, nextMinZoom) : prev.zoom,
    }))

    if (map) {
      const targetZoom = nextMinZoom
        ? Math.max(map.getZoom(), nextMinZoom)
        : map.getZoom()
      map.easeTo({
        center: [longitude, latitude],
        zoom: targetZoom,
        duration:
          forceZoom || !hasAutoCenteredOnUserRef.current
            ? 700
            : isTrailFollowMode
              ? 180
              : 350,
        essential: true,
      })
    }

    hasAutoCenteredOnUserRef.current = true
    lastCenteredLocationRef.current = { longitude, latitude }
  }, [])

  const refreshPingsAndClusters = useCallback(() => {
    fetchPings()
      .then((res) => setPings(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPings([]))

    fetchClusters()
      .then((res) => setClusters(Array.isArray(res.data) ? res.data : []))
      .catch(() => setClusters([]))
  }, [])

  useEffect(() => {
    let active = true
    const normalizedSearch = searchQuery.trim()

    setLoadingTrails(true)
    setTrailsError('')
    setSelectedTrail(null)

    const fetchTimeout = setTimeout(() => {
      const request = fetchMapTrails(
        normalizedSearch ? { search: normalizedSearch } : {}
      )

      request
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

  useEffect(() => {
    if (!initialStartFocus?.startCoordinates) return

    const [startLng, startLat] = initialStartFocus.startCoordinates
    if (!Number.isFinite(startLng) || !Number.isFinite(startLat)) return

    const focusKey = `${startLng}|${startLat}|${initialStartFocus?.trailId || ''}`
    if (initialStartFocusAppliedRef.current === focusKey) return
    initialStartFocusAppliedRef.current = focusKey

    setSelectedAreaCenter([startLng, startLat])
    setViewState((old) => ({
      ...old,
      longitude: startLng,
      latitude: startLat,
      zoom: Math.max(old.zoom, 11.5),
    }))

    mapRef.current?.getMap()?.flyTo({
      center: [startLng, startLat],
      zoom: 11.5,
      essential: true,
      duration: 700,
    })
  }, [initialStartFocus])

  useEffect(() => {
    if (!initialStartFocus?.trailId || !trails.length) return

    const selectKey = `${initialStartFocus.trailId}|${trails.length}`
    if (initialTrailSelectionRef.current === selectKey) return

    const matchedTrail = trails.find(
      (trail) =>
        String(trail._id || trail.id) === String(initialStartFocus.trailId)
    )
    if (!matchedTrail) return

    initialTrailSelectionRef.current = selectKey
    setSelectedTrail(matchedTrail)
  }, [initialStartFocus, trails, setSelectedTrail])

  useEffect(() => {
    refreshPingsAndClusters()
  }, [refreshPingsAndClusters, trailsVersion])

  useEffect(() => {
    if (!selectedAreaCenter) {
      setAreaWeather(null)
      setAreaWeatherError('')
      setAreaWeatherLoading(false)
      return
    }

    if (!hasWeatherApiKey()) {
      setAreaWeather(null)
      setAreaWeatherError('Add VITE_OPENWEATHER_API_KEY to enable map weather.')
      setAreaWeatherLoading(false)
      return
    }

    let active = true
    setAreaWeatherLoading(true)
    setAreaWeatherError('')

    fetchCurrentWeather({
      latitude: selectedAreaCenter[1],
      longitude: selectedAreaCenter[0],
    })
      .then((data) => {
        if (!active) return
        setAreaWeather(data)
      })
      .catch(() => {
        if (!active) return
        setAreaWeather(null)
        setAreaWeatherError(
          'Weather service is unavailable for the selected region.'
        )
      })
      .finally(() => {
        if (active) setAreaWeatherLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedAreaCenter])

  useEffect(() => {
    if (areaInsightsEnabled) {
      setAreaInsightsMinimized(false)
      return
    }

    setSelectedAreaCenter(null)
    setAreaWeather(null)
    setAreaWeatherError('')
    setAreaWeatherLoading(false)
    setAreaInsightsMinimized(false)
  }, [areaInsightsEnabled])

  useEffect(() => {
    if (!navigator.geolocation) return undefined

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        applyLiveUserLocation(coords)
      },
      () => {
        setGeoError('')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    )

    locationWatchRef.current = watchId

    return () => {
      navigator.geolocation.clearWatch(watchId)
      locationWatchRef.current = null
    }
  }, [applyLiveUserLocation])

  useEffect(() => {
    if (!startPanelTrail) return undefined

    let active = true
    lastStartReadinessLocationRef.current = null
    setStartPanelLoading(true)
    setStartPanelError('')
    setStartReadiness(null)
    setStartWeatherNow(null)
    setStartForecast([])
    setStartUnsafeAcknowledged(false)

    const trailId = startPanelTrail?._id || startPanelTrail?.id

    Promise.all([
      fetchTrailStartReadiness(trailId, { maxDistanceMeters: 1000 }),
      hasWeatherApiKey() && startPanelCoordinates
        ? fetchCurrentWeather({
            latitude: startPanelCoordinates[1],
            longitude: startPanelCoordinates[0],
          })
        : Promise.resolve(null),
      hasWeatherApiKey() && startPanelCoordinates
        ? fetchWeatherForecast({
            latitude: startPanelCoordinates[1],
            longitude: startPanelCoordinates[0],
            limit: 10,
          })
        : Promise.resolve([]),
    ])
      .then(([readinessRes, weatherNowRes, forecastRes]) => {
        if (!active) return
        setStartReadiness(readinessRes.data || null)
        setStartWeatherNow(weatherNowRes || null)
        setStartForecast(Array.isArray(forecastRes) ? forecastRes : [])
      })
      .catch(() => {
        if (!active) return
        setStartPanelError('Could not load trail start readiness right now.')
      })
      .finally(() => {
        if (active) setStartPanelLoading(false)
      })

    return () => {
      active = false
    }
  }, [startPanelTrail, startPanelCoordinates])

  useEffect(() => {
    if (!startPanelTrail || !userLocation) return undefined

    const trailId = startPanelTrail?._id || startPanelTrail?.id
    if (!trailId) return undefined

    const lastLocation = lastStartReadinessLocationRef.current
    if (lastLocation) {
      const movedMeters = haversineMeters(
        [lastLocation.longitude, lastLocation.latitude],
        [userLocation.longitude, userLocation.latitude]
      )
      if (movedMeters < 25) {
        return undefined
      }
    }

    lastStartReadinessLocationRef.current = {
      longitude: userLocation.longitude,
      latitude: userLocation.latitude,
    }

    let active = true

    fetchTrailStartReadiness(trailId, {
      maxDistanceMeters: 1000,
      userLng: userLocation.longitude,
      userLat: userLocation.latitude,
    })
      .then((res) => {
        if (!active) return
        setStartReadiness(res.data || null)
        setStartPanelError('')
      })
      .catch(() => {
        if (!active) return
        setStartPanelError(
          (current) =>
            current || 'Could not refresh distance to start right now.'
        )
      })

    return () => {
      active = false
    }
  }, [startPanelTrail, userLocation])

  const handlePingSubmit = useCallback(async () => {
    if (!pendingPing || !activeTrailSession) return

    setPingSubmitting(true)
    try {
      const res = await createPing({
        trailId: pendingPing.trailId || activeTrailSession.trailId,
        type: pingType,
        description: pingDesc,
        coordinates: pendingPing.coordinates,
      })
      setPings((prev) => [res.data, ...prev])
      setPendingPing(null)
      setPingDesc('')
      setPingMode(false)

      fetchClusters()
        .then((r) => setClusters(Array.isArray(r.data) ? r.data : []))
        .catch(() => {})
    } catch (err) {
      console.error('Ping submit error:', err)
    } finally {
      setPingSubmitting(false)
    }
  }, [pendingPing, activeTrailSession, pingType, pingDesc])

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

  const handleClusterVote = useCallback(async (clusterId) => {
    setVoteSubmitting(true)
    try {
      const res = await voteClusterGone(clusterId)
      if (res.data.resolved) {
        setClusters((prev) =>
          prev.filter((cluster) => cluster._id !== clusterId)
        )
        setSelectedCluster(null)
        fetchPings()
          .then((r) => setPings(Array.isArray(r.data) ? r.data : []))
          .catch(() => {})
      } else {
        setClusters((prev) =>
          prev.map((cluster) =>
            cluster._id === clusterId ? res.data : cluster
          )
        )
        setSelectedCluster(res.data)
      }
    } catch (err) {
      console.error('Cluster vote error:', err)
    } finally {
      setVoteSubmitting(false)
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

  const handleCenterMe = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        applyLiveUserLocation(coords, { forceZoom: true })
        if (areaInsightsEnabled) {
          setSelectedAreaCenter([coords.longitude, coords.latitude])
        }
      },
      () => {
        setGeoError('')
      }
    )
  }, [areaInsightsEnabled, applyLiveUserLocation])

  const handleToggleAreaInsights = useCallback(() => {
    setAreaInsightsEnabled((value) => !value)
  }, [])

  const handleMapClick = useCallback(
    (e) => {
      const map = mapRef.current?.getMap()
      if (!map) return
      const { lng, lat } = e.lngLat

      if (pingMode) {
        if (!activeTrailSession) {
          setGeoError(
            'Start a trail first. Pings are available only during an active trail.'
          )
          return
        }

        let snapped = [lng, lat]
        let trailId = activeTrailSession.trailId

        const layerIds = renderableTrails
          .map(({ trail }) => `trail-hit-${trail._id || trail.id}`)
          .filter((id) => map.getLayer(id))

        if (layerIds.length) {
          const features = map.queryRenderedFeatures(e.point, {
            layers: layerIds,
          })
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
              } catch {}
            }
          }
        }

        setPendingPing({ coordinates: snapped, trailId })
        return
      }

      if (areaInsightsEnabled) {
        setSelectedAreaCenter([lng, lat])
      }

      const layerIds = renderableTrails
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
      const trail = trails.find(
        (entry) => String(entry._id || entry.id) === String(trailId)
      )
      if (trail) setSelectedTrail(trail)
    },
    [
      pingMode,
      activeTrailSession,
      renderableTrails,
      trails,
      setSelectedTrail,
      areaInsightsEnabled,
    ]
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

  const handleOpenStartPlanner = useCallback(
    (trail) => {
      if (!trail) return
      setStartPanelTrail(trail)
      setStartHoveredSegment(0)
      setStartPanelError('')

      if (!userLocation && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            setUserLocation({
              longitude: coords.longitude,
              latitude: coords.latitude,
              altitude: Number.isFinite(coords.altitude)
                ? coords.altitude
                : null,
            })
          },
          () => {}
        )
      }
    },
    [userLocation]
  )

  const handleFocusSelectedAreaTrail = useCallback(
    ({ trail, startCoordinates }) => {
      if (!Array.isArray(startCoordinates) || startCoordinates.length !== 2)
        return

      setSelectedAreaCenter(startCoordinates)
      setViewState((old) => ({
        ...old,
        longitude: startCoordinates[0],
        latitude: startCoordinates[1],
        zoom: Math.max(old.zoom, 12),
      }))

      mapRef.current?.getMap()?.flyTo({
        center: startCoordinates,
        zoom: 12,
        essential: true,
        duration: 650,
      })

      if (trail) {
        setSelectedTrail(trail)
      }
    },
    [setSelectedTrail]
  )

  const handleBeginTrail = useCallback(() => {
    if (!startPanelTrail) return

    if (!isSignedIn || !userId) {
      navigate('/login')
      return
    }

    const hasVerifiedDistance = startReadiness?.hasUserLocation === true
    const isOutOfStartRange =
      hasVerifiedDistance && startReadiness?.withinRange === false

    if (isOutOfStartRange) {
      setStartPanelError(
        startReadiness?.distanceToStartMeters
          ? `Move closer to the start point. You are ${Math.round(
              startReadiness.distanceToStartMeters
            )} m away and must be within 1000 m.`
          : 'Enable location and move within 1 km from the trail start to begin.'
      )
      return
    }

    if (startSafety.unsafe && !startUnsafeAcknowledged) {
      setStartPanelError('Review the risk popup and acknowledge to continue.')
      return
    }

    const pathCoordinates = extractLineCoordinates(startPanelTrail.geojson)
    if (!pathCoordinates.length) {
      setStartPanelError(
        'This trail has no usable coordinates for live sector tracking.'
      )
      return
    }

    const trailId = startPanelTrail._id || startPanelTrail.id
    const segments = buildSegmentModel(startPanelTrail, pathCoordinates.length)
    const totalDistanceMeters = resolveTrailTotalDistanceMeters(
      startPanelTrail,
      pathCoordinates
    )
    const totalElevationMeters = resolveTrailElevationMeters(startPanelTrail)

    setActiveTrailSession({
      trailId,
      trailName: startPanelTrail.name,
      trailDifficulty: startPanelTrail.difficulty,
      totalDistanceMeters,
      totalElevationMeters,
      pathCoordinates,
      segments,
      startedAt: Date.now(),
    })

    setActivityDistanceMeters(0)
    setActivityDurationSeconds(0)
    setActivityElevationGain(0)
    setActivityCurrentElevation(
      Number.isFinite(userLocation?.altitude) ? userLocation.altitude : null
    )
    setCurrentSectorIndex(0)
    setShowSectorSummary(false)
    setStartPanelTrail(null)
    setPingMode(false)
    setPendingPing(null)
    setStillTherePrompt(null)
    setFinishModalTrail(null)
    setFinishStats(null)
    promptedReportsRef.current = new Set()

    if (userLocation) {
      applyLiveUserLocation(userLocation, { forceZoom: true, trailMode: true })
      lastActivityPointRef.current = {
        longitude: userLocation.longitude,
        latitude: userLocation.latitude,
        altitude: userLocation.altitude,
      }
    } else {
      lastActivityPointRef.current = null
    }
  }, [
    startPanelTrail,
    isSignedIn,
    userId,
    navigate,
    startReadiness,
    startSafety,
    startUnsafeAcknowledged,
    applyLiveUserLocation,
    userLocation,
  ])

  useEffect(() => {
    if (!activeTrailSession) return undefined

    const interval = setInterval(() => {
      setActivityDurationSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [activeTrailSession])

  useEffect(() => {
    if (!activeTrailSession || !userLocation) return

    const current = [userLocation.longitude, userLocation.latitude]
    const prev = lastActivityPointRef.current
    if (prev) {
      const d = haversineMeters([prev.longitude, prev.latitude], current)
      if (d > 0.6 && d < 250) {
        setActivityDistanceMeters((old) => old + d)
      }

      const prevAltitude = Number(prev.altitude)
      const nextAltitude = Number(userLocation.altitude)
      if (Number.isFinite(prevAltitude) && Number.isFinite(nextAltitude)) {
        const positiveGain = nextAltitude - prevAltitude
        if (positiveGain > 0) {
          setActivityElevationGain((old) => old + positiveGain)
        }
      }
    }

    lastActivityPointRef.current = {
      longitude: userLocation.longitude,
      latitude: userLocation.latitude,
      altitude: userLocation.altitude,
    }

    const nearestPathIndex = getNearestPathIndex(
      activeTrailSession.pathCoordinates,
      userLocation
    )

    if (nearestPathIndex >= 0) {
      const segmentIndex = activeTrailSession.segments.findIndex(
        (segment) =>
          nearestPathIndex >= segment.startIndex &&
          nearestPathIndex <= segment.endIndex
      )
      if (segmentIndex >= 0) {
        setCurrentSectorIndex(segmentIndex)
      }
    }

    if (stillTherePrompt) return

    const nearbyPing = pings.find((ping) => {
      const key = `ping:${ping._id}`
      if (promptedReportsRef.current.has(key)) return false
      return haversineMeters(current, ping.coordinates) <= 100
    })

    if (nearbyPing) {
      setStillTherePrompt({ type: 'ping', payload: nearbyPing })
      return
    }

    const nearbyCluster = clusters.find((cluster) => {
      const key = `cluster:${cluster._id}`
      if (promptedReportsRef.current.has(key)) return false
      return haversineMeters(current, cluster.coordinates) <= 100
    })

    if (nearbyCluster) {
      setStillTherePrompt({ type: 'cluster', payload: nearbyCluster })
    }
  }, [activeTrailSession, userLocation, pings, clusters, stillTherePrompt])

  useEffect(() => {
    if (activeTrailSession) return
    setPingMode(false)
    setPendingPing(null)
  }, [activeTrailSession])

  const handleKeepPrompt = useCallback(() => {
    if (!stillTherePrompt) return

    const key = `${stillTherePrompt.type}:${stillTherePrompt.payload._id}`
    promptedReportsRef.current.add(key)
    setStillTherePrompt(null)
  }, [stillTherePrompt])

  const handleVotePromptGone = useCallback(async () => {
    if (!stillTherePrompt) return

    setStillThereSubmitting(true)
    const { type, payload } = stillTherePrompt
    const key = `${type}:${payload._id}`

    try {
      if (type === 'ping') {
        await votePingGone(payload._id)
        setPings((prev) => prev.filter((entry) => entry._id !== payload._id))
      } else {
        const res = await voteClusterGone(payload._id)
        if (res.data?.resolved) {
          setClusters((prev) =>
            prev.filter((entry) => entry._id !== payload._id)
          )
          fetchPings()
            .then((r) => setPings(Array.isArray(r.data) ? r.data : []))
            .catch(() => {})
        } else {
          setClusters((prev) =>
            prev.map((entry) => (entry._id === payload._id ? res.data : entry))
          )
        }
      }
    } catch (err) {
      console.error('Still-there vote failed:', err)
    } finally {
      promptedReportsRef.current.add(key)
      setStillTherePrompt(null)
      setStillThereSubmitting(false)
    }
  }, [stillTherePrompt])

  const handleFinishTrail = useCallback(() => {
    if (!activeTrailSession) return

    const trail = trails.find(
      (entry) =>
        String(entry._id || entry.id) === String(activeTrailSession.trailId)
    ) || {
      _id: activeTrailSession.trailId,
      name: activeTrailSession.trailName,
      difficulty: activeTrailSession.trailDifficulty,
    }

    setFinishModalTrail(trail)
    setFinishStats({
      distanceMeters: Math.round(activityDistanceMeters),
      durationSeconds: activityDurationSeconds,
      sectorName: activeSector?.name || 'N/A',
      sectorDifficulty: activeSector?.difficulty || 'moderate',
    })
    setFinishRating(0)
    setFinishComment('')
    setFinishError('')
    setFinishSuccess('')

    setActiveTrailSession(null)
    setCurrentSectorIndex(0)
    setActivityDistanceMeters(0)
    setActivityDurationSeconds(0)
    setActivityElevationGain(0)
    setActivityCurrentElevation(null)
    setShowSectorSummary(false)
    setPingMode(false)
    setPendingPing(null)
    setStillTherePrompt(null)
    lastActivityPointRef.current = null
    setSelectedTrail(null)
  }, [
    activeTrailSession,
    trails,
    activityDistanceMeters,
    activityDurationSeconds,
    activeSector,
    setSelectedTrail,
  ])

  const handleSubmitFinish = useCallback(async () => {
    if (!finishModalTrail) return

    setFinishSubmitting(true)
    setFinishError('')
    setFinishSuccess('')

    const trailId = finishModalTrail._id || finishModalTrail.id

    try {
      const payload = {
        durationSeconds: finishStats?.durationSeconds || 0,
        distanceMeters: finishStats?.distanceMeters || 0,
        ...(finishRating > 0 ? { accuracy: finishRating } : {}),
        ...(finishComment.trim() ? { comment: finishComment.trim() } : {}),
      }

      const res = await completeTrailFromMap(trailId, payload)
      const data = res?.data || {}

      if (data.reviewAdded) {
        setFinishSuccess(
          'Trail completed and your rating was saved. Great work!'
        )
      } else if (finishRating > 0 && data.alreadyReviewed) {
        setFinishSuccess(
          'Trail completed. You have already reviewed this trail before.'
        )
      } else {
        setFinishSuccess('Trail completed successfully. Nice effort!')
      }

      setTimeout(() => {
        setFinishModalTrail(null)
        setFinishStats(null)
      }, 1200)
    } catch (err) {
      setFinishError(
        err?.response?.data?.error || 'Could not complete this trail right now.'
      )
    } finally {
      setFinishSubmitting(false)
    }
  }, [finishModalTrail, finishStats, finishRating, finishComment])

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
            {visibleTrailEntries.map(({ trail, geometry }) => {
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

            {viewState.zoom >= 9 && huts.map((hut) => (
               <Marker
                 key={hut._id || hut.name}
                 longitude={hut.location[0]}
                 latitude={hut.location[1]}
                 anchor="bottom"
                 onClick={(e) => {
                   e.originalEvent.stopPropagation();
                   setSelectedHut(hut);
                 }}
                 style={{ cursor: 'pointer', zIndex: selectedHut?._id === hut._id ? 10 : 1 }}
               >
                 <div
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
                   title={hut.name}
                 >
                   ⌂
                 </div>
               </Marker>
            ))}

            {loadedRouteEndpoints ? (
              <>
                <Marker
                  longitude={loadedRouteEndpoints.startCoordinates[0]}
                  latitude={loadedRouteEndpoints.startCoordinates[1]}
                  anchor="bottom"
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      color: '#f8fafc',
                      fontSize: 12,
                      fontWeight: 900,
                      display: 'grid',
                      placeItems: 'center',
                      border: '2px solid #f8fafc',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                    }}
                    title="Route start"
                  >
                    S
                  </div>
                </Marker>
                <Marker
                  longitude={loadedRouteEndpoints.endCoordinates[0]}
                  latitude={loadedRouteEndpoints.endCoordinates[1]}
                  anchor="bottom"
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: '#f8fafc',
                      fontSize: 12,
                      fontWeight: 900,
                      display: 'grid',
                      placeItems: 'center',
                      border: '2px solid #f8fafc',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                    }}
                    title="Route finish"
                  >
                    F
                  </div>
                </Marker>
              </>
            ) : null}

            {userLocation ? (
              <Marker
                longitude={userLocation.longitude}
                latitude={userLocation.latitude}
                anchor="center"
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#0ea5e9',
                    border: '2px solid #f8fafc',
                    boxShadow: '0 0 0 6px rgba(14,165,233,0.22)',
                  }}
                  title="Your current position"
                />
              </Marker>
            ) : null}

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
                  paint={{ 'raster-opacity': 0.9 }}
                />
              </Source>
            ) : null}

            {startPanelSegmentFeatures && !activeTrailSession ? (
              <Source
                id="map-start-segments"
                type="geojson"
                data={startPanelSegmentFeatures}
              >
                <Layer
                  id="map-start-segment-line"
                  type="line"
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{
                    'line-color': SEGMENT_COLOR_EXPRESSION,
                    'line-width': 5,
                    'line-opacity': 0.95,
                  }}
                />
              </Source>
            ) : null}

            {activeTrailSegmentFeatures ? (
              <Source
                id="map-active-segments"
                type="geojson"
                data={activeTrailSegmentFeatures}
              >
                <Layer
                  id="map-active-segment-line"
                  type="line"
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{
                    'line-color': SEGMENT_COLOR_EXPRESSION,
                    'line-width': 6,
                    'line-opacity': 0.98,
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

            {viewState.zoom >= 12 &&
              pings.map((ping) => {
                const cfg = PING_TYPES[ping.type] || PING_TYPES.junk
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
                      {cfg.marker}
                    </div>
                  </Marker>
                )
              })}

            {clusters.map((cluster) => {
              const cfg =
                CLUSTER_CONFIG[cluster.level] || CLUSTER_CONFIG.clutter
              return (
                <Marker
                  key={cluster._id}
                  longitude={cluster.coordinates[0]}
                  latitude={cluster.coordinates[1]}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation()
                    setSelectedCluster(
                      selectedCluster?._id === cluster._id ? null : cluster
                    )
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
                    {cfg.marker}
                  </div>
                </Marker>
              )
            })}

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
                  }}
                />
              </Marker>
            ) : null}
          </>
        ) : null}
      </Map>

      {pingMode && !pendingPing && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 268px)',
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
          Tap on the map while walking to place a ping
        </div>
      )}

      {showUnsafeStartAlert ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 72,
            background: 'rgba(2, 6, 23, 0.62)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              ...overlayCard,
              width: 'min(92vw, 430px)',
              border: '1px solid rgba(239,68,68,0.6)',
              background: 'rgba(63, 14, 14, 0.95)',
              boxShadow: '0 18px 36px rgba(0,0,0,0.42)',
              padding: '12px 14px',
              color: '#fecaca',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800 }}>
              Unsafe start conditions detected
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.45 }}>
              {startSafety.summary}
            </div>
            <button
              type="button"
              onClick={() => setStartUnsafeAcknowledged(true)}
              style={{
                ...pingBtnBase,
                padding: '8px 10px',
                fontSize: 12,
                background: 'rgba(239,68,68,0.22)',
                border: '1px solid rgba(239,68,68,0.6)',
                color: '#ffe4e6',
              }}
            >
              Acknowledge and allow start
            </button>
          </div>
        </div>
      ) : null}

      {activeTrailSession ? (
        <div
          style={{
            ...overlayCard,
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(92vw, 380px)',
            padding: 10,
            zIndex: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#89afc2', fontWeight: 700 }}>
                ACTIVE TRAIL
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 1 }}>
                {activeTrailSession.trailName}
              </div>
              <div style={{ fontSize: 12, color: '#9cb7c8', marginTop: 2 }}>
                Current: {activeSector?.name || 'N/A'} (
                {DIFFICULTY_LABEL[activeSector?.difficulty] ||
                  activeSector?.difficulty ||
                  'Moderate'}
                )
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#89afc2' }}>Distance</div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                {activityDistanceProgressText}
              </div>
              <div style={{ fontSize: 11, color: '#89afc2', marginTop: 2 }}>
                Time {formatDuration(activityDurationSeconds)}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 6,
              marginTop: 8,
            }}
          >
            <div
              style={{
                ...styles.infoBox,
                fontSize: 11,
                padding: '6px 8px',
                borderColor: 'rgba(148,163,184,0.24)',
                background: 'rgba(12,19,30,0.72)',
              }}
            >
              <div style={{ color: '#8eaac0' }}>Steps</div>
              <div style={{ fontWeight: 800 }}>
                {activitySteps.toLocaleString()}
              </div>
            </div>
            <div
              style={{
                ...styles.infoBox,
                fontSize: 11,
                padding: '6px 8px',
                borderColor: 'rgba(148,163,184,0.24)',
                background: 'rgba(12,19,30,0.72)',
              }}
            >
              <div style={{ color: '#8eaac0' }}>Altitude</div>
              <div style={{ fontWeight: 800 }}>
                {Number.isFinite(activityCurrentElevation)
                  ? `${Math.round(activityCurrentElevation)} m`
                  : '--'}
              </div>
            </div>
            <div
              style={{
                ...styles.infoBox,
                fontSize: 11,
                padding: '6px 8px',
                borderColor: 'rgba(148,163,184,0.24)',
                background: 'rgba(12,19,30,0.72)',
              }}
            >
              <div style={{ color: '#8eaac0' }}>Progress</div>
              <div style={{ fontWeight: 800 }}>
                {activityProgressPercent.toFixed(0)}%
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.max(1, activeTrailSession.segments.length)}, minmax(0, 1fr))`,
              gap: 4,
              marginTop: 8,
            }}
          >
            {activeTrailSession.segments.map((segment, index) => (
              <div
                key={`${segment.name}-chip-${index}`}
                style={{
                  minHeight: 7,
                  borderRadius: 999,
                  background: DIFFICULTY_COLOR[segment.difficulty] || '#64748b',
                  opacity: index === currentSectorIndex ? 1 : 0.45,
                  border:
                    index === currentSectorIndex
                      ? '1px solid rgba(241,245,249,0.7)'
                      : '1px solid transparent',
                }}
                title={`${segment.name} (${DIFFICULTY_LABEL[segment.difficulty] || segment.difficulty})`}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={() => setShowSectorSummary((v) => !v)}
              style={{
                ...pingBtnBase,
                flex: 1,
                background: 'rgba(72,169,166,0.2)',
                color: '#8de0dc',
              }}
            >
              {showSectorSummary
                ? 'Hide Sector Summary'
                : 'Show Sector Summary'}
            </button>
            <button
              onClick={() => {
                setPingMode((v) => !v)
                setPendingPing(null)
                setSelectedPing(null)
              }}
              style={{
                ...pingBtnBase,
                flex: '0 0 40%',
                background: pingMode
                  ? 'linear-gradient(135deg, #b91c1c, #dc2626)'
                  : 'linear-gradient(135deg, #0f766e, #0e7490)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              {pingMode ? 'Cancel Ping' : 'Add Ping'}
            </button>
          </div>

          {showSectorSummary ? (
            <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
              <div
                style={{
                  ...styles.infoBox,
                  fontSize: 11,
                  padding: '7px 9px',
                  display: 'grid',
                  gap: 4,
                }}
              >
                <div>Average pace: {activityPaceText}</div>
                <div>
                  Elevation gain: +{Math.round(activityElevationGain)} m
                </div>
                <div>
                  Total route elevation:{' '}
                  {Number.isFinite(activeTrailSession?.totalElevationMeters)
                    ? `${Math.round(activeTrailSession.totalElevationMeters)} m`
                    : '--'}
                </div>
              </div>
              {activeTrailSession.segments.map((segment, index) => (
                <div
                  key={`${segment.name}-${index}`}
                  style={{
                    border: `1px solid ${index === currentSectorIndex ? 'rgba(203,213,225,0.85)' : 'rgba(107,114,128,0.4)'}`,
                    background:
                      index === currentSectorIndex
                        ? 'rgba(30,41,59,0.9)'
                        : 'rgba(15,23,35,0.58)',
                    borderRadius: 10,
                    padding: '8px 10px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    <span>{segment.name}</span>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: 999,
                        background:
                          DIFFICULTY_COLOR[segment.difficulty] || '#64748b',
                        color: '#f8fafc',
                        fontSize: 10,
                      }}
                    >
                      {DIFFICULTY_LABEL[segment.difficulty] ||
                        segment.difficulty}
                    </span>
                  </div>
                  <div style={{ marginTop: 3, fontSize: 11, color: '#96afc1' }}>
                    Points:{' '}
                    {Math.max(1, segment.endIndex - segment.startIndex + 1)}
                    {segment.estimatedTime ? ` · ${segment.estimatedTime}` : ''}
                  </div>
                  {segment.description ? (
                    <div
                      style={{ marginTop: 3, fontSize: 12, color: '#b7c9d6' }}
                    >
                      {segment.description}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTrailSession ? (
        <button
          onClick={handleFinishTrail}
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 108px)',
            zIndex: 23,
            width: 'min(92vw, 320px)',
            ...pingBtnBase,
            padding: '14px 20px',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 0.2,
            border: '1px solid rgba(187,247,208,0.6)',
            background:
              'linear-gradient(135deg, #22c55e, #16a34a 58%, #15803d)',
            color: '#fff',
            boxShadow:
              '0 14px 30px rgba(8,32,18,0.42), inset 0 1px 0 rgba(255,255,255,0.22)',
          }}
        >
          Finish Trail
        </button>
      ) : null}

      {pendingPing ? (
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
                <span style={{ fontSize: 14, display: 'block' }}>
                  {cfg.marker}
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
      ) : null}

      {selectedPing && !pendingPing ? (
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
              {PING_TYPES[selectedPing.type]?.marker || 'P'}
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
            By {selectedPing.username || 'Anonymous'} ·{' '}
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
              {voteSubmitting ? '...' : 'Not there anymore'}
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
      ) : null}

      {selectedCluster && !pendingPing ? (
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
              {CLUSTER_CONFIG[selectedCluster.level]?.marker || 'C'}
            </span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>
              {CLUSTER_CONFIG[selectedCluster.level]?.label ||
                selectedCluster.level}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 4 }}>
            {selectedCluster.pingCount} trash ping
            {selectedCluster.pingCount !== 1 ? 's' : ''} within this area
          </div>
          {selectedCluster.description ? (
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
              {selectedCluster.description}
            </div>
          ) : null}
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
            Votes: {selectedCluster.goneVotes?.length || 0} /{' '}
            {CLUSTER_CONFIG[selectedCluster.level]?.votesNeeded || 3}
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
              {voteSubmitting ? '...' : 'Cleaned up'}
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
      ) : null}

      {stillTherePrompt ? (
        <div
          style={{
            ...overlayCard,
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 360px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14 }}>Still there?</div>
          <div style={{ fontSize: 12, color: '#bfd4de', marginTop: 4 }}>
            You are within 100m of a reported{' '}
            {stillTherePrompt.type === 'cluster' ? 'cluster/event' : 'ping'}.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={handleKeepPrompt}
              disabled={stillThereSubmitting}
              style={{
                ...pingBtnBase,
                flex: 1,
                background: 'rgba(148,163,184,0.15)',
                color: '#e2e8f0',
              }}
            >
              Yes, still there
            </button>
            <button
              onClick={handleVotePromptGone}
              disabled={stillThereSubmitting}
              style={{
                ...pingBtnBase,
                flex: 1,
                background: 'rgba(34,197,94,0.22)',
                color: '#4ade80',
              }}
            >
              {stillThereSubmitting ? 'Saving...' : 'No, gone'}
            </button>
          </div>
        </div>
      ) : null}

      {startPanelTrail ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 40,
            background: 'rgba(3,9,17,0.58)',
            display: 'grid',
            placeItems: 'center',
            padding: 14,
          }}
          onClick={() => setStartPanelTrail(null)}
        >
          <div
            style={{
              ...overlayCard,
              width: 'min(92vw, 520px)',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: 14,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{ fontSize: 11, color: '#89afc2', fontWeight: 700 }}
                >
                  TRAIL START CHECK
                </div>
                <h3 style={{ margin: '2px 0 0 0', fontSize: 18 }}>
                  {startPanelTrail.name}
                </h3>
                <div style={{ fontSize: 12, color: '#b7c9d6' }}>
                  {startPanelTrail.region || 'Unknown region'} ·{' '}
                  {DIFFICULTY_LABEL[startPanelTrail.difficulty] ||
                    startPanelTrail.difficulty}
                </div>
              </div>
              <button
                onClick={() => setStartPanelTrail(null)}
                style={{
                  ...pingBtnBase,
                  background: 'rgba(148,163,184,0.15)',
                  color: '#cbd5e1',
                  minWidth: 72,
                }}
              >
                Close
              </button>
            </div>

            {startPanelLoading ? (
              <div style={{ ...styles.infoBox, marginTop: 12 }}>
                Loading start checks and weather...
              </div>
            ) : null}

            {startReadiness ? (
              <div style={{ ...styles.infoBox, marginTop: 12 }}>
                <div style={{ fontWeight: 700, color: '#8de0dc' }}>
                  Start Distance Check
                </div>
                {startReadiness.hasUserLocation ? (
                  <div style={{ marginTop: 4 }}>
                    Distance to start:{' '}
                    {Math.round(startReadiness.distanceToStartMeters || 0)} m
                    {' · '}
                    {startReadiness.withinRange
                      ? 'Within the 1 km start zone'
                      : 'Too far to begin (required <= 1000 m)'}
                  </div>
                ) : (
                  <div style={{ marginTop: 4 }}>
                    GPS distance check is unavailable. You can still start, but
                    distance-to-start cannot be verified.
                  </div>
                )}
              </div>
            ) : null}

            <div
              style={{
                ...styles.infoBox,
                marginTop: 10,
                borderColor:
                  startSafety.level === 'high'
                    ? 'rgba(239,68,68,0.55)'
                    : startSafety.level === 'medium'
                      ? 'rgba(245,158,11,0.55)'
                      : 'rgba(34,197,94,0.45)',
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color:
                    startSafety.level === 'high'
                      ? '#fca5a5'
                      : startSafety.level === 'medium'
                        ? '#fcd34d'
                        : '#86efac',
                }}
              >
                AI Safety Suggestion: {startSafety.title}
              </div>
              <div style={{ marginTop: 4 }}>{startSafety.summary}</div>
            </div>

            {startWeatherNow ? (
              <div style={{ ...styles.infoBox, marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {startWeatherNow.icon ? (
                    <img
                      src={weatherIconUrl(startWeatherNow.icon)}
                      alt={startWeatherNow.condition}
                      style={{ width: 38, height: 38 }}
                    />
                  ) : null}
                  <div>
                    <div style={{ fontWeight: 700, color: '#8de0dc' }}>
                      Start Area Weather
                    </div>
                    <div style={{ fontSize: 13 }}>
                      {Math.round(startWeatherNow.temperature)}°C ·{' '}
                      {startWeatherNow.description}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {startPanelSegments.length ? (
              <div style={{ ...styles.infoBox, marginTop: 10 }}>
                <div
                  style={{ fontWeight: 700, color: '#8de0dc', marginBottom: 6 }}
                >
                  Trail Sectors
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {startPanelSegments.map((segment, index) => {
                    const pointCount = Math.max(
                      1,
                      segment.endIndex - segment.startIndex + 1
                    )
                    return (
                      <div
                        key={`${segment.name}-${index}`}
                        onMouseEnter={() => setStartHoveredSegment(index)}
                        onFocus={() => setStartHoveredSegment(index)}
                        style={{
                          border:
                            index === startHoveredSegment
                              ? '1px solid rgba(203,213,225,0.8)'
                              : '1px solid rgba(148,163,184,0.24)',
                          borderRadius: 8,
                          padding: '7px 8px',
                          background:
                            index === startHoveredSegment
                              ? 'rgba(30,41,59,0.92)'
                              : 'rgba(15,23,35,0.62)',
                          cursor: 'pointer',
                        }}
                        title={segment.description || segment.name}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 700 }}>
                            {segment.name}
                          </span>
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: 999,
                              background:
                                DIFFICULTY_COLOR[segment.difficulty] ||
                                '#64748b',
                              color: '#f8fafc',
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {DIFFICULTY_LABEL[segment.difficulty] ||
                              segment.difficulty}
                          </span>
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 11,
                            color: '#94aab9',
                          }}
                        >
                          Points: {pointCount}
                          {segment.estimatedTime
                            ? ` · ${segment.estimatedTime}`
                            : ''}
                        </div>
                        {segment.description ? (
                          <div
                            style={{
                              marginTop: 3,
                              fontSize: 11,
                              color: '#bfd4de',
                            }}
                          >
                            {segment.description}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {Array.isArray(startForecast) && startForecast.length ? (
              <div style={{ ...styles.infoBox, marginTop: 10 }}>
                <div
                  style={{ fontWeight: 700, color: '#8de0dc', marginBottom: 6 }}
                >
                  Forecast (next hours)
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {startForecast.slice(0, 4).map((item) => (
                    <div
                      key={item.timestamp}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: 12,
                      }}
                    >
                      <span>
                        {new Date(item.timestamp * 1000).toLocaleString([], {
                          weekday: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>
                        {Math.round(item.temperature)}°C · {item.condition} ·
                        wind {item.windSpeed.toFixed(1)} m/s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {startPanelError ? (
              <div
                style={{
                  marginTop: 10,
                  color: '#fca5a5',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {startPanelError}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={handleBeginTrail}
                disabled={startPanelLoading}
                style={{
                  ...pingBtnBase,
                  flex: 1,
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: '#fff',
                  opacity: startPanelLoading ? 0.6 : 1,
                }}
              >
                Start Trail
              </button>
              <button
                onClick={() => setStartPanelTrail(null)}
                style={{
                  ...pingBtnBase,
                  flex: 1,
                  background: 'rgba(148,163,184,0.15)',
                  color: '#cbd5e1',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {finishModalTrail && finishStats ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 42,
            background: 'rgba(3,9,17,0.58)',
            display: 'grid',
            placeItems: 'center',
            padding: 14,
          }}
          onClick={() => {
            if (!finishSubmitting) {
              setFinishModalTrail(null)
              setFinishStats(null)
            }
          }}
        >
          <div
            style={{
              ...overlayCard,
              width: 'min(92vw, 480px)',
              padding: 14,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ fontSize: 12, color: '#89afc2', fontWeight: 700 }}>
              TRAIL COMPLETED
            </div>
            <h3 style={{ margin: '4px 0 6px 0' }}>
              Nice work! You finished {finishModalTrail.name}.
            </h3>

            <div style={{ ...styles.infoBox, marginTop: 4 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span>Distance</span>
                <strong>
                  {(finishStats.distanceMeters / 1000).toFixed(2)} km
                </strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span>Time</span>
                <strong>{formatDuration(finishStats.durationSeconds)}</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span>Final sector</span>
                <strong>
                  {finishStats.sectorName} (
                  {DIFFICULTY_LABEL[finishStats.sectorDifficulty] ||
                    finishStats.sectorDifficulty}
                  )
                </strong>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: '#b9cedd' }}>
              Rate this trail (optional, moved from Explore).
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
                border: '1px solid rgba(66,129,164,0.3)',
                background: 'rgba(15,23,35,0.88)',
                color: '#e2e8f0',
                padding: 10,
                boxSizing: 'border-box',
              }}
            />

            {finishError ? (
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
            ) : null}
            {finishSuccess ? (
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
            ) : null}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={handleSubmitFinish}
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
                onClick={() => {
                  if (!finishSubmitting) {
                    setFinishModalTrail(null)
                    setFinishStats(null)
                  }
                }}
                style={{
                  ...pingBtnBase,
                  flex: 1,
                  background: 'rgba(148,163,184,0.15)',
                  color: '#cbd5e1',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MapControls
        onCenterMe={handleCenterMe}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onToggleAreaInsights={handleToggleAreaInsights}
        areaInsightsEnabled={areaInsightsEnabled}
        showAreaInsightsButton
      />

      {showRadiusPanel ? (
        <div
          style={{
            ...styles.radiusWrap,
            bottom: activeTrailSession
              ? 'calc(env(safe-area-inset-bottom, 0px) + 188px)'
              : styles.radiusWrap.bottom,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12, color: '#8de0dc', fontWeight: 800 }}>
              Area insights
            </span>
            <button
              type="button"
              onClick={() => setAreaInsightsMinimized((value) => !value)}
              style={{
                ...pingBtnBase,
                padding: '4px 9px',
                fontSize: 11,
                background: 'rgba(148,163,184,0.14)',
                color: '#c9dcea',
              }}
            >
              {areaInsightsMinimized ? 'Expand' : 'Minimize'}
            </button>
          </div>

          {areaInsightsMinimized ? (
            <div
              style={{ ...styles.infoBox, fontSize: 11, padding: '7px 9px' }}
            >
              Area panel minimized.
            </div>
          ) : (
            <>
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
                <span style={styles.radiusValue}>
                  {selectedAreaRadiusKm} km
                </span>
              </div>

              <div
                style={{ ...styles.infoBox, fontSize: 11, padding: '6px 9px' }}
              >
                {!selectedAreaCenter ? (
                  <div>
                    Tap on the map to inspect exact trail starts inside this
                    radius.
                  </div>
                ) : selectedAreaTrails.length === 0 ? (
                  <div>
                    No trail starts found inside {selectedAreaRadiusKm} km.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontWeight: 700, color: '#8de0dc' }}>
                      Trail starts in radius ({selectedAreaTrails.length})
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gap: 6,
                        maxHeight: 156,
                        overflowY: 'auto',
                        paddingRight: 2,
                      }}
                    >
                      {selectedAreaTrails.map((entry) => {
                        const trailId = entry.trail?._id || entry.trail?.id
                        return (
                          <div
                            key={`area-trail-${trailId}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 6,
                              border: '1px solid rgba(148,163,184,0.24)',
                              borderRadius: 8,
                              padding: '6px 8px',
                              background: 'rgba(15,23,35,0.58)',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: '#e2e8f0',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {entry.trail?.name || 'Unnamed trail'}
                              </div>
                              <div style={{ color: '#95adbf' }}>
                                start {Math.round(entry.distanceMeters)} m away
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                handleFocusSelectedAreaTrail(entry)
                              }
                              style={{
                                ...pingBtnBase,
                                padding: '5px 10px',
                                fontSize: 11,
                                background: 'rgba(72,169,166,0.22)',
                                color: '#8de0dc',
                              }}
                            >
                              Focus
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    {selectedAreaTrails.length > 3 ? (
                      <div style={{ color: '#93abc1' }}>
                        Scroll down to see more routes.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          )}

          {selectedAreaCenter && !areaInsightsMinimized ? (
            <div
              style={{ ...styles.infoBox, fontSize: 11, padding: '8px 9px' }}
            >
              {areaWeatherLoading ? (
                <div>Loading region weather...</div>
              ) : areaWeatherError ? (
                <div style={{ color: '#fca5a5' }}>{areaWeatherError}</div>
              ) : areaWeather ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: '#8de0dc' }}>
                      Selected Region Weather
                    </div>
                    <div>
                      {Math.round(areaWeather.temperature)}°C ·{' '}
                      {areaWeather.description}
                    </div>
                    <div style={{ color: '#93abc1' }}>
                      wind {areaWeather.windSpeed.toFixed(1)} m/s · humidity{' '}
                      {Math.round(areaWeather.humidity)}%
                    </div>
                  </div>
                  {areaWeather.icon ? (
                    <img
                      src={weatherIconUrl(areaWeather.icon)}
                      alt={areaWeather.condition}
                      style={{ width: 42, height: 42 }}
                    />
                  ) : null}
                </div>
              ) : (
                <div>Choose an area for weather details.</div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {loadingTrails ||
      trailsError ||
      geoError ||
      mapError ||
      tilesetConfigWarning ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 88px)',
            left: 12,
            right: 12,
            zIndex: 12,
            display: 'grid',
            gap: 6,
            pointerEvents: 'none',
          }}
        >
          {loadingTrails ? (
            <div style={styles.infoBox}>Loading trails...</div>
          ) : null}
          {trailsError ? <div style={styles.infoBox}>{trailsError}</div> : null}
          {geoError ? <div style={styles.infoBox}>{geoError}</div> : null}
          {mapError ? <div style={styles.infoBox}>{mapError}</div> : null}
          {tilesetConfigWarning ? (
            <div style={styles.infoBox}>{tilesetConfigWarning}</div>
          ) : null}
        </div>
      ) : null}

      {!isTrailFlowOverlayOpen ? (
        <>
          <RoutePreviewCard
            onStartTrail={handleOpenStartPlanner}
            bottomOffset={MAPS_BOTTOM_CARD_OFFSET}
            showScheduleButton={false}
          />
          <HutPreviewCard
            hut={selectedHut}
            onClose={() => setSelectedHut(null)}
            bottomOffset={selectedHut ? MAPS_BOTTOM_CARD_OFFSET : undefined}
          />
        </>
      ) : null}
    </div>
  )
}
