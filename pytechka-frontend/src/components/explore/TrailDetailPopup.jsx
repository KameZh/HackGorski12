import { useState, useEffect } from 'react'
import {
  addTrailCondition,
  fetchTrailById,
  fetchTrailConditions,
} from '../../api/trails'
import './TrailDetailPopup.css'

const DIFFICULTY_MAP = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  extreme: 'Extreme',
}

const SURFACE_OPTIONS = [
  ['good', 'Good'],
  ['mixed', 'Mixed'],
  ['muddy', 'Muddy'],
  ['snow', 'Snow'],
  ['icy', 'Icy'],
  ['overgrown', 'Overgrown'],
  ['blocked', 'Blocked'],
]

const WATER_OPTIONS = [
  ['unknown', 'Unknown'],
  ['available', 'Available'],
  ['limited', 'Limited'],
  ['dry', 'Dry'],
]

const HAZARD_OPTIONS = [
  ['fallen_trees', 'Fallen trees'],
  ['landslide', 'Landslide'],
  ['flooded', 'Flooded'],
  ['missing_markers', 'Missing markers'],
  ['dangerous_animals', 'Animal risk'],
  ['trash', 'Trash'],
]

function parseTrailGeojson(geojson) {
  if (!geojson) return null
  try {
    const parsed = typeof geojson === 'string' ? JSON.parse(geojson) : geojson
    return parsed && typeof parsed === 'object' ? parsed : null
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
  if (parsed.type === 'Feature') return extractLineCoordinates(parsed.geometry)
  if (parsed.type === 'FeatureCollection') {
    return Array.isArray(parsed.features)
      ? parsed.features.flatMap((feature) =>
          extractLineCoordinates(feature?.geometry)
        )
      : []
  }
  return []
}

function haversineMeters(a, b) {
  const lon1 = Number(a?.[0])
  const lat1 = Number(a?.[1])
  const lon2 = Number(b?.[0])
  const lat2 = Number(b?.[1])
  if (![lon1, lat1, lon2, lat2].every(Number.isFinite)) return 0

  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function buildElevationSamples(geojson, trailMarks = []) {
  const coords = extractLineCoordinates(geojson)
  if (coords.length < 2) return null

  let distance = 0
  const samples = coords
    .map((coord, index) => {
      if (index > 0) distance += haversineMeters(coords[index - 1], coord)
      const elevation = Number(coord?.[2])
      return Number.isFinite(elevation)
        ? { index, distance, elevation }
        : null
    })
    .filter(Boolean)

  if (samples.length < 2) return null

  const elevations = samples.map((sample) => sample.elevation)
  const minElevation = Math.min(...elevations)
  const maxElevation = Math.max(...elevations)
  const totalDistance = samples[samples.length - 1].distance
  const boundaries = (Array.isArray(trailMarks) ? trailMarks : [])
    .flatMap((mark) => [mark.startIndex, mark.endIndex])
    .map((index) => samples.find((sample) => sample.index >= Number(index)))
    .filter(Boolean)

  return { samples, minElevation, maxElevation, totalDistance, boundaries }
}

function ElevationProfile({ trail }) {
  const [hovered, setHovered] = useState(null)
  const profile = buildElevationSamples(trail?.geojson, trail?.trailMarks)
  if (!profile) return null

  const width = 420
  const height = 130
  const padX = 12
  const padY = 14
  const elevationRange = Math.max(
    1,
    profile.maxElevation - profile.minElevation
  )

  const toX = (sample) =>
    padX +
    (sample.distance / Math.max(1, profile.totalDistance)) * (width - padX * 2)
  const toY = (sample) =>
    height -
    padY -
    ((sample.elevation - profile.minElevation) / elevationRange) *
      (height - padY * 2)

  const points = profile.samples
    .map((sample) => `${toX(sample).toFixed(1)},${toY(sample).toFixed(1)}`)
    .join(' ')

  const active = hovered || profile.samples[profile.samples.length - 1]

  return (
    <div className="tdp-elevation">
      <div className="tdp-section-head">
        <span>Elevation profile</span>
        <strong>
          {Math.round(profile.minElevation)}-{Math.round(profile.maxElevation)} m
        </strong>
      </div>
      <svg
        className="tdp-elevation-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Trail elevation profile"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const ratio = Math.max(
            0,
            Math.min(1, (event.clientX - rect.left) / rect.width)
          )
          const targetDistance = ratio * profile.totalDistance
          const nearest = profile.samples.reduce((best, sample) =>
            Math.abs(sample.distance - targetDistance) <
            Math.abs(best.distance - targetDistance)
              ? sample
              : best
          )
          setHovered(nearest)
        }}
        onMouseLeave={() => setHovered(null)}
      >
        <polyline className="tdp-elevation-area" points={points} />
        <polyline className="tdp-elevation-line" points={points} />
        {profile.boundaries.map((sample, index) => (
          <line
            key={`${sample.index}-${index}`}
            className="tdp-elevation-boundary"
            x1={toX(sample)}
            x2={toX(sample)}
            y1={padY}
            y2={height - padY}
          />
        ))}
        {active && (
          <circle
            className="tdp-elevation-dot"
            cx={toX(active)}
            cy={toY(active)}
            r="4"
          />
        )}
      </svg>
      <div className="tdp-elevation-readout">
        <span>{((active.distance || 0) / 1000).toFixed(1)} km</span>
        <span>{Math.round(active.elevation)} m</span>
      </div>
    </div>
  )
}

function StarRating({ value, onChange, readonly }) {
  const [hover, setHover] = useState(0)

  return (
    <div className="tdp-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`tdp-star ${star <= (hover || value) ? 'tdp-star-filled' : ''}`}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          disabled={readonly}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={star <= (hover || value) ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  )
}

export default function TrailDetailPopup({ trailId, onClose }) {
  const [trail, setTrail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [conditionReports, setConditionReports] = useState([])
  const [conditionForm, setConditionForm] = useState({
    surface: 'mixed',
    waterSources: 'unknown',
    hazards: [],
    notes: '',
  })
  const [conditionSaving, setConditionSaving] = useState(false)
  const [conditionError, setConditionError] = useState('')

  useEffect(() => {
    if (!trailId) return
    setLoading(true)
    fetchTrailById(trailId)
      .then((res) => {
        setTrail(res.data)
        setConditionReports(
          Array.isArray(res.data?.conditionReports)
            ? res.data.conditionReports
            : []
        )
      })
      .catch(() => setTrail(null))
      .finally(() => setLoading(false))

    fetchTrailConditions(trailId)
      .then((res) =>
        setConditionReports(Array.isArray(res.data?.reports) ? res.data.reports : [])
      )
      .catch(() => {})
  }, [trailId])

  const toggleHazard = (hazard) => {
    setConditionForm((old) => {
      const hazards = old.hazards.includes(hazard)
        ? old.hazards.filter((entry) => entry !== hazard)
        : [...old.hazards, hazard]
      return { ...old, hazards }
    })
  }

  const submitCondition = async () => {
    setConditionSaving(true)
    setConditionError('')
    try {
      const res = await addTrailCondition(trailId, conditionForm)
      setConditionReports((old) => [res.data, ...old])
      setConditionForm({
        surface: 'mixed',
        waterSources: 'unknown',
        hazards: [],
        notes: '',
      })
    } catch (err) {
      setConditionError(
        err?.response?.data?.error || 'Could not save condition report.'
      )
    } finally {
      setConditionSaving(false)
    }
  }

  if (!trailId) return null

  return (
    <div className="tdp-overlay" onClick={onClose}>
      <div className="tdp-panel" onClick={(e) => e.stopPropagation()}>
        <button className="tdp-close" onClick={onClose} aria-label="Close">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {loading ? (
          <div className="tdp-loading">Loading trail details...</div>
        ) : !trail ? (
          <div className="tdp-loading">Trail not found.</div>
        ) : (
          <div className="tdp-content">
            <h2 className="tdp-name">{trail.name}</h2>

            <div className="tdp-badges">
              <span
                className={`tdp-difficulty tdp-difficulty-${trail.difficulty}`}
              >
                {DIFFICULTY_MAP[trail.difficulty] || trail.difficulty}
              </span>
              {trail.region && (
                <span className="tdp-region">{trail.region}</span>
              )}
            </div>

            {trail.description && (
              <p className="tdp-description">{trail.description}</p>
            )}

            <div className="tdp-stats">
              <div className="tdp-stat">
                <span className="tdp-stat-label">Distance</span>
                <span className="tdp-stat-value">
                  {trail.stats?.distance
                    ? (trail.stats.distance / 1000).toFixed(1) + ' km'
                    : '—'}
                </span>
              </div>
              <div className="tdp-stat">
                <span className="tdp-stat-label">Elevation</span>
                <span className="tdp-stat-value">
                  {trail.stats?.elevationGain
                    ? trail.stats.elevationGain + ' m'
                    : '—'}
                </span>
              </div>
              <div className="tdp-stat">
                <span className="tdp-stat-label">Duration</span>
                <span className="tdp-stat-value">
                  {trail.stats?.duration
                    ? Math.round(trail.stats.duration / 60) + ' min'
                    : '—'}
                </span>
              </div>
            </div>

            {(trail.startPoint || trail.endPoint || trail.highestPoint) && (
              <div className="tdp-stats">
                {trail.startPoint && (
                  <div className="tdp-stat">
                    <span className="tdp-stat-label">Start</span>
                    <span className="tdp-stat-value">{trail.startPoint}</span>
                  </div>
                )}
                {trail.endPoint && (
                  <div className="tdp-stat">
                    <span className="tdp-stat-label">End</span>
                    <span className="tdp-stat-value">{trail.endPoint}</span>
                  </div>
                )}
                {trail.highestPoint && (
                  <div className="tdp-stat">
                    <span className="tdp-stat-label">Highest</span>
                    <span className="tdp-stat-value">{trail.highestPoint}</span>
                  </div>
                )}
              </div>
            )}

            <ElevationProfile trail={trail} />

            {trail.equipment && (
              <div className="tdp-detail">
                <span className="tdp-detail-label">Equipment</span>
                <p className="tdp-detail-text">{trail.equipment}</p>
              </div>
            )}

            {trail.resources && (
              <div className="tdp-detail">
                <span className="tdp-detail-label">Resources</span>
                <p className="tdp-detail-text">{trail.resources}</p>
              </div>
            )}

            <div className="tdp-detail">
              <span className="tdp-detail-label">Author</span>
              <p className="tdp-detail-text">{trail.username || 'Unknown'}</p>
            </div>

            <div className="tdp-avg-rating">
              <StarRating
                value={Math.round(trail.averageAccuracy || 0)}
                readonly
              />
              <span className="tdp-avg-label">
                {trail.averageAccuracy ? trail.averageAccuracy.toFixed(1) : '—'}{' '}
                / 5 ({trail.reviews?.length || 0} reviews)
              </span>
            </div>

            {trail.reviews?.length > 0 && (
              <div className="tdp-reviews-list">
                <span className="tdp-detail-label">Reviews</span>
                {trail.reviews.map((r, i) => (
                  <div key={i} className="tdp-review-item">
                    <div className="tdp-review-header">
                      <span className="tdp-review-author">{r.username}</span>
                      <StarRating value={r.accuracy} readonly />
                    </div>
                    {r.comment && (
                      <p className="tdp-review-comment">{r.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="tdp-conditions">
              <div className="tdp-section-head">
                <span>Recent conditions</span>
                <strong>{conditionReports.length}</strong>
              </div>

              {conditionReports.length > 0 ? (
                <div className="tdp-condition-list">
                  {conditionReports.slice(0, 4).map((report, index) => (
                    <div key={report._id || index} className="tdp-condition-item">
                      <div className="tdp-condition-title">
                        <span>
                          {SURFACE_OPTIONS.find(([value]) => value === report.surface)?.[1] ||
                            'Mixed'}
                        </span>
                        <small>
                          {report.createdAt
                            ? new Date(report.createdAt).toLocaleDateString()
                            : 'Now'}
                        </small>
                      </div>
                      <div className="tdp-condition-meta">
                        Water:{' '}
                        {WATER_OPTIONS.find(
                          ([value]) => value === report.waterSources
                        )?.[1] || 'Unknown'}
                      </div>
                      {Array.isArray(report.hazards) && report.hazards.length ? (
                        <div className="tdp-condition-tags">
                          {report.hazards.map((hazard) => (
                            <span key={hazard}>
                              {HAZARD_OPTIONS.find(([value]) => value === hazard)?.[1] ||
                                hazard}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {report.notes ? (
                        <p className="tdp-condition-notes">{report.notes}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="tdp-muted">
                  No recent condition reports for this trail yet.
                </p>
              )}

              <div className="tdp-condition-form">
                <label>
                  Surface
                  <select
                    value={conditionForm.surface}
                    onChange={(event) =>
                      setConditionForm((old) => ({
                        ...old,
                        surface: event.target.value,
                      }))
                    }
                  >
                    {SURFACE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Water
                  <select
                    value={conditionForm.waterSources}
                    onChange={(event) =>
                      setConditionForm((old) => ({
                        ...old,
                        waterSources: event.target.value,
                      }))
                    }
                  >
                    {WATER_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="tdp-condition-hazards">
                  {HAZARD_OPTIONS.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={
                        conditionForm.hazards.includes(value) ? 'is-active' : ''
                      }
                      onClick={() => toggleHazard(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={conditionForm.notes}
                  onChange={(event) =>
                    setConditionForm((old) => ({
                      ...old,
                      notes: event.target.value,
                    }))
                  }
                  maxLength={500}
                  rows={3}
                  placeholder="Short note about current trail conditions"
                />
                {conditionError ? (
                  <p className="tdp-review-error">{conditionError}</p>
                ) : null}
                <button
                  type="button"
                  className="tdp-review-submit"
                  onClick={submitCondition}
                  disabled={conditionSaving}
                >
                  {conditionSaving ? 'Saving...' : 'Report condition'}
                </button>
              </div>
            </div>

            <p className="tdp-login-hint">
              Ratings are now submitted after completing a trail from
              Maps/Record.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
