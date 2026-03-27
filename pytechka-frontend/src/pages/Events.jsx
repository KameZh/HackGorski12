import { useCallback, useEffect, useMemo, useState } from 'react'
import { SignInButton, SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import 'mapbox-gl/dist/mapbox-gl.css'
import Map, { Layer, Source } from 'react-map-gl/mapbox'
import BottomNav from '../components/layout/Bottomnav'
import { fetchMapTrails } from '../api/maps'
import {
  listCleanupEvents,
  syncCleanupEventsFromTrails,
  toggleCleanupEventSignup,
} from '../api/events'
import { fetchClusters, voteClusterGone } from '../api/pings'
import './Events.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const MAPBOX_STYLE_URL = import.meta.env.VITE_MAPBOX_STYLE_URL
const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY

const DEMO_TRAILS = [
  {
    id: 'demo-01',
    name: 'Vitosha Panorama Loop',
    region: 'Vitosha',
    difficulty: 'moderate',
    shortDescription:
      'Forest-to-ridge loop with high visitor traffic and recurring litter hotspots.',
    distance: '13.4',
    elevation: '760',
    duration: '4h 10m',
    issueReports: 5,
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [23.2487, 42.6209],
              [23.2576, 42.6242],
              [23.2711, 42.6308],
              [23.2898, 42.6395],
            ],
          },
          properties: {},
        },
      ],
    },
  },
  {
    id: 'demo-02',
    name: 'Rila Seven Lakes Traverse',
    region: 'Rila',
    difficulty: 'hard',
    shortDescription:
      'Popular alpine route where cleanup efforts are needed after high-season weekends.',
    distance: '15.7',
    elevation: '1030',
    duration: '6h 20m',
    issueReports: 7,
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [23.3091, 42.2114],
              [23.3227, 42.2198],
              [23.3332, 42.2286],
              [23.3476, 42.2371],
            ],
          },
          properties: {},
        },
      ],
    },
  },
]

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

function toFeatureCollection(geojson) {
  if (!geojson) return null

  if (geojson.type === 'FeatureCollection') return geojson
  if (geojson.type === 'Feature') {
    return {
      type: 'FeatureCollection',
      features: [geojson],
    }
  }

  if (geojson.type === 'LineString' || geojson.type === 'MultiLineString') {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: geojson,
          properties: {},
        },
      ],
    }
  }

  return null
}

async function fetchMapTrailsWithTimeout(timeoutMs = 2600) {
  return Promise.race([
    fetchMapTrails(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Trails request timeout')), timeoutMs)
    }),
  ])
}

function formatSuggestedDate(dateIso) {
  if (!dateIso) return 'Date not available'

  try {
    const date = new Date(dateIso)
    return new Intl.DateTimeFormat('bg-BG', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return 'Date not available'
  }
}

function initialsFromName(name) {
  if (!name) return 'U'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export default function Events() {
  const { isSignedIn, user } = useUser()
  const [events, setEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [detailMapReady, setDetailMapReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pendingSignupEventId, setPendingSignupEventId] = useState(null)

  // Backend clusters (clutters & cleanup events)
  const [clusters, setClusters] = useState([])
  const [clusterVoting, setClusterVoting] = useState(null)

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  )

  const selectedGeometry = useMemo(() => {
    const parsed = parseTrailGeojson(selectedEvent?.trailSnapshot?.geojson)
    return toFeatureCollection(parsed)
  }, [selectedEvent])

  const selectedCenter = useMemo(() => {
    const center = selectedEvent?.centerCoordinates
    if (Array.isArray(center) && center.length === 2) {
      return {
        longitude: Number(center[0]),
        latitude: Number(center[1]),
        zoom: 11,
      }
    }

    return { longitude: 25.4858, latitude: 42.7339, zoom: 7 }
  }, [selectedEvent])

  const loadAndSync = useCallback(async () => {
    // Always render quickly in frontend-only mode while backend may be unavailable.
    try {
      const seeded = await syncCleanupEventsFromTrails({
        trails: DEMO_TRAILS,
        weatherApiKey: OPENWEATHER_API_KEY,
      })
      setEvents(seeded)
      setLoading(false)
    } catch {
      setLoading(false)
    }

    // Enrich with live trails when backend responds; timeout prevents endless loading states.
    try {
      const res = await fetchMapTrailsWithTimeout(2600)
      const liveTrails = Array.isArray(res?.data) ? res.data : []
      if (liveTrails.length) {
        const synced = await syncCleanupEventsFromTrails({
          trails: liveTrails,
          weatherApiKey: OPENWEATHER_API_KEY,
        })

        setEvents(synced)
      }
    } catch {
      // Keep the locally seeded events as fallback when live API is unavailable.
    }
  }, [])

  useEffect(() => {
    const localEvents = listCleanupEvents()
    setEvents(localEvents)

    loadAndSync()
  }, [loadAndSync])

  // Fetch backend clusters (clutters & events from trash pings)
  useEffect(() => {
    fetchClusters()
      .then((res) => setClusters(Array.isArray(res.data) ? res.data : []))
      .catch(() => setClusters([]))
  }, [])

  const handleClusterVote = useCallback(async (clusterId) => {
    setClusterVoting(clusterId)
    try {
      const res = await voteClusterGone(clusterId)
      if (res.data.resolved) {
        setClusters((prev) => prev.filter((c) => c._id !== clusterId))
      } else {
        setClusters((prev) => prev.map((c) => (c._id === clusterId ? res.data : c)))
      }
    } catch (err) {
      console.error('Cluster vote error:', err)
    } finally {
      setClusterVoting(null)
    }
  }, [])

  useEffect(() => {
    setDetailMapReady(false)
  }, [selectedEventId])

  const handleToggleSignup = useCallback(
    async (eventId) => {
      if (!isSignedIn || !user) return

      try {
        setPendingSignupEventId(eventId)

        const updated = toggleCleanupEventSignup({
          eventId,
          userProfile: {
            userId: user.id,
            name:
              user.fullName ||
              user.username ||
              user.primaryEmailAddress?.emailAddress,
            imageUrl: user.imageUrl,
          },
        })

        setEvents((prev) =>
          prev.map((event) => (event.id === eventId ? updated : event))
        )
      } catch {
        // Ignore optimistic signup errors in frontend-only mode.
      } finally {
        setPendingSignupEventId(null)
      }
    },
    [isSignedIn, user]
  )

  return (
    <div id="events-page" className="events-page">
      <div className="events-glow events-glow-top" />
      <div className="events-glow events-glow-bottom" />

      <div className="events-shell">
        <header className="events-header reveal-up">
          <div className="events-title-row">
            <h1 className="events-title">Cleanup Events</h1>
            <span className="events-page-badge">ECO IMPACT</span>
          </div>
        </header>

        <main className="events-main">
          {/* Backend trash clusters — clutters & cleanup events */}
          {clusters.length > 0 && (
            <section className="events-grid" style={{ marginBottom: 24 }}>
              {clusters.filter((c) => c.level === 'event').length > 0 && (
                <h2 style={{ gridColumn: '1 / -1', color: '#ef4444', fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>
                  🚨 Active Cleanup Events
                </h2>
              )}
              {clusters.filter((c) => c.level === 'event').map((cluster) => (
                <article key={cluster._id} className="events-card card-enter" style={{ borderLeft: '3px solid #ef4444' }}>
                  <div className="events-card-head">
                    <div>
                      <h2 className="events-card-title">🚨 Cleanup Event</h2>
                      <p className="events-card-region" style={{ color: '#94a3b8' }}>
                        {cluster.pingCount} trash reports in this area
                      </p>
                    </div>
                    <span className="events-date-badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>EVENT</span>
                  </div>
                  <p className="events-purpose">{cluster.description || 'Multiple trash reports detected. This area needs cleanup!'}</p>
                  <div className="events-chip-row">
                    <span className="events-chip">Pings: {cluster.pingCount}</span>
                    <span className="events-chip">Votes: {cluster.goneVotes?.length || 0}/5</span>
                  </div>
                  <div className="events-card-actions">
                    <SignedOut>
                      <SignInButton mode="modal">
                        <button type="button" className="events-primary-btn">Vote Cleaned</button>
                      </SignInButton>
                    </SignedOut>
                    <SignedIn>
                      <button
                        type="button"
                        className="events-primary-btn"
                        onClick={() => handleClusterVote(cluster._id)}
                        disabled={clusterVoting === cluster._id}
                        style={{ background: '#22c55e' }}
                      >
                        {clusterVoting === cluster._id ? 'Voting...' : '✅ Cleaned up'}
                      </button>
                    </SignedIn>
                  </div>
                </article>
              ))}

              {clusters.filter((c) => c.level === 'clutter').length > 0 && (
                <h2 style={{ gridColumn: '1 / -1', color: '#f59e0b', fontSize: 16, fontWeight: 700, margin: '12px 0 4px' }}>
                  ⚠️ Clutter Warnings
                </h2>
              )}
              {clusters.filter((c) => c.level === 'clutter').map((cluster) => (
                <article key={cluster._id} className="events-card card-enter" style={{ borderLeft: '3px solid #f59e0b' }}>
                  <div className="events-card-head">
                    <div>
                      <h2 className="events-card-title">⚠️ Clutter Warning</h2>
                      <p className="events-card-region" style={{ color: '#94a3b8' }}>
                        {cluster.pingCount} trash reports in this area
                      </p>
                    </div>
                    <span className="events-date-badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>WARNING</span>
                  </div>
                  <p className="events-purpose">{cluster.description || 'Trash accumulating in this area — watch out!'}</p>
                  <div className="events-chip-row">
                    <span className="events-chip">Pings: {cluster.pingCount}</span>
                    <span className="events-chip">Votes: {cluster.goneVotes?.length || 0}/3</span>
                  </div>
                  <div className="events-card-actions">
                    <SignedOut>
                      <SignInButton mode="modal">
                        <button type="button" className="events-primary-btn">Vote Cleaned</button>
                      </SignInButton>
                    </SignedOut>
                    <SignedIn>
                      <button
                        type="button"
                        className="events-primary-btn"
                        onClick={() => handleClusterVote(cluster._id)}
                        disabled={clusterVoting === cluster._id}
                        style={{ background: '#22c55e' }}
                      >
                        {clusterVoting === cluster._id ? 'Voting...' : '✅ Cleaned up'}
                      </button>
                    </SignedIn>
                  </div>
                </article>
              ))}
            </section>
          )}

          {loading ? (
            <div className="events-empty">Loading cleanup events...</div>
          ) : events.length === 0 ? (
            <div className="events-empty">
              No cleanup events yet. An event appears automatically when a route
              passes 3 issue reports.
            </div>
          ) : (
            <section className="events-grid">
              {events.map((event) => {
                const participantCount = Array.isArray(event.participants)
                  ? event.participants.length
                  : 0
                const isJoined = Boolean(
                  user &&
                  Array.isArray(event.participants) &&
                  event.participants.some(
                    (participant) =>
                      String(participant.userId) === String(user.id)
                  )
                )

                return (
                  <article key={event.id} className="events-card card-enter">
                    <div className="events-card-head">
                      <div>
                        <h2 className="events-card-title">{event.routeName}</h2>
                        <p className="events-card-region">{event.region}</p>
                      </div>
                      <span className="events-date-badge">{event.aiBadge}</span>
                    </div>

                    <p className="events-purpose">{event.purpose}</p>

                    <div className="events-chip-row">
                      <span className="events-chip">
                        Issues: {event.issueCount}
                      </span>
                      <span className="events-chip">
                        Volunteers: {participantCount}
                      </span>
                      <span className="events-chip">{event.status}</span>
                    </div>

                    <p className="events-weather-text">
                      {event.weatherSummary}
                    </p>

                    <div className="events-card-actions">
                      <button
                        type="button"
                        className="events-ghost-btn"
                        onClick={() => setSelectedEventId(event.id)}
                      >
                        View details
                      </button>

                      <SignedOut>
                        <SignInButton mode="modal">
                          <button type="button" className="events-primary-btn">
                            Join
                          </button>
                        </SignInButton>
                      </SignedOut>

                      <SignedIn>
                        <button
                          type="button"
                          className="events-primary-btn"
                          onClick={() => handleToggleSignup(event.id)}
                          disabled={pendingSignupEventId === event.id}
                        >
                          {pendingSignupEventId === event.id
                            ? 'Updating...'
                            : isJoined
                              ? 'Leave'
                              : 'Join'}
                        </button>
                      </SignedIn>
                    </div>
                  </article>
                )
              })}
            </section>
          )}
        </main>
      </div>

      {selectedEvent ? (
        <>
          <div
            className="events-detail-backdrop"
            onClick={() => setSelectedEventId(null)}
            aria-hidden="true"
          />

          <section className="events-detail-sheet">
            <header className="events-detail-header">
              <div>
                <h3 className="events-detail-title">
                  {selectedEvent.routeName}
                </h3>
                <p className="events-detail-date">
                  {formatSuggestedDate(selectedEvent.suggestedDateISO)}
                </p>
              </div>

              <button
                type="button"
                className="events-close-btn"
                onClick={() => setSelectedEventId(null)}
                aria-label="Close details"
              >
                x
              </button>
            </header>

            <p className="events-detail-purpose">{selectedEvent.purpose}</p>

            <div className="events-detail-meta">
              <span className="events-chip">
                Issue reports: {selectedEvent.issueCount}
              </span>
              <span className="events-chip">
                Status: {selectedEvent.status}
              </span>
              <span className="events-chip">{selectedEvent.aiBadge}</span>
            </div>

            <div className="events-mini-map-wrap">
              {MAPBOX_TOKEN && selectedGeometry ? (
                <Map
                  key={`events-detail-map-${selectedEvent.id}`}
                  initialViewState={selectedCenter}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  mapStyle={
                    MAPBOX_STYLE_URL || 'mapbox://styles/mapbox/outdoors-v12'
                  }
                  style={{ width: '100%', height: '100%' }}
                  interactive={false}
                  attributionControl={false}
                  onLoad={() => setDetailMapReady(true)}
                >
                  {detailMapReady ? (
                    <Source
                      id={`events-detail-route-${selectedEvent.id}`}
                      type="geojson"
                      data={selectedGeometry}
                    >
                      <Layer
                        id={`events-detail-route-layer-${selectedEvent.id}`}
                        type="line"
                        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                        paint={{
                          'line-color': '#48a9a6',
                          'line-width': 4,
                          'line-opacity': 0.9,
                        }}
                      />
                    </Source>
                  ) : null}
                </Map>
              ) : (
                <div className="events-mini-map-fallback">
                  Map preview is unavailable. Add VITE_MAPBOX_TOKEN to enable
                  route map.
                </div>
              )}
            </div>

            <div className="events-volunteers-block">
              <h4 className="events-volunteers-title">Registered volunteers</h4>

              {Array.isArray(selectedEvent.participants) &&
              selectedEvent.participants.length > 0 ? (
                <div className="events-volunteers-list">
                  {selectedEvent.participants.map((participant) => (
                    <div
                      key={participant.userId}
                      className="events-volunteer-item"
                    >
                      {participant.imageUrl ? (
                        <img
                          src={participant.imageUrl}
                          alt={participant.name}
                          className="events-volunteer-avatar"
                        />
                      ) : (
                        <div className="events-volunteer-avatar events-volunteer-fallback">
                          {initialsFromName(participant.name)}
                        </div>
                      )}
                      <span className="events-volunteer-name">
                        {participant.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="events-empty-volunteers">
                  No volunteers yet. Be the first to join.
                </p>
              )}
            </div>

            <div className="events-join-row">
              <SignedOut>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="events-primary-btn events-join-btn"
                  >
                    Sign in to join this cleanup
                  </button>
                </SignInButton>
              </SignedOut>

              <SignedIn>
                <button
                  type="button"
                  className="events-primary-btn events-join-btn"
                  onClick={() => handleToggleSignup(selectedEvent.id)}
                  disabled={pendingSignupEventId === selectedEvent.id}
                >
                  {pendingSignupEventId === selectedEvent.id
                    ? 'Updating...'
                    : Array.isArray(selectedEvent.participants) &&
                        user &&
                        selectedEvent.participants.some(
                          (participant) =>
                            String(participant.userId) === String(user.id)
                        )
                      ? 'Leave cleanup'
                      : 'Join cleanup'}
                </button>
              </SignedIn>
            </div>
          </section>
        </>
      ) : null}

      <BottomNav />
    </div>
  )
}
