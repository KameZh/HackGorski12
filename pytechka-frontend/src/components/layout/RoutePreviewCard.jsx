import { useEffect, useRef } from 'react'
import { useMapStore } from '../../store/mapStore'

const DIFFICULTY_COLORS = {
  easy: '#34d399',
  moderate: '#fb923c',
  hard: '#ef4444',
  extreme: '#7f1d1d',
}

const DIFFICULTY_LABELS = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  extreme: 'Extreme',
}

const styles = {
  backdrop: {
    position: 'absolute',
    inset: 0,
    zIndex: 20,
  },
  cardWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 'max(84px, calc(env(safe-area-inset-bottom, 0px) + 72px))',
    zIndex: 30,
  },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    background: 'rgba(17, 24, 39, 0.95)',
    border: '1px solid rgba(148,163,184,0.2)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
    color: '#fff',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0,0,0,0.55)',
    color: '#fff',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
  },
  content: {
    padding: 14,
  },
  statsRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  statCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  actions: {
    display: 'flex',
    gap: 8,
  },
  startBtn: {
    flex: 1,
    border: 'none',
    borderRadius: 14,
    background: '#10b981',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '11px 14px',
  },
  scheduleBtn: {
    border: 'none',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '11px 14px',
  },
}

/**
 * RoutePreviewCard — bottom sheet that slides up when a trail is selected.
 * Dismissed by tapping outside or the X button.
 */
export default function RoutePreviewCard() {
  const { selectedTrail, setSelectedTrail } = useMapStore()
  const cardRef = useRef(null)

  const dismiss = () => setSelectedTrail(null)

  // Close on backdrop tap
  useEffect(() => {
    if (!selectedTrail) return
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        dismiss()
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [selectedTrail])

  if (!selectedTrail) return null

  const trail = selectedTrail

  return (
    <>
      {/* Backdrop */}
      <div
        id="route-preview-backdrop"
        style={styles.backdrop}
        aria-hidden="true"
      />

      {/* Card */}
      <div ref={cardRef} id="route-preview-card" style={styles.cardWrap}>
        <div style={styles.card}>
          {/* Trail image */}
          {trail.image && (
            <div
              style={{
                position: 'relative',
                height: 160,
                width: '100%',
                overflow: 'hidden',
              }}
            >
              <img
                src={trail.image}
                alt={trail.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* Dismiss button */}
              <button
                id="route-preview-close"
                onClick={dismiss}
                style={styles.closeButton}
                aria-label="Close route preview"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              {/* Difficulty badge */}
              <span
                id="route-preview-difficulty"
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  borderRadius: 999,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                  background: 'rgba(0,0,0,0.55)',
                  color: DIFFICULTY_COLORS[trail.difficulty] ?? '#cbd5e1',
                }}
              >
                {DIFFICULTY_LABELS[trail.difficulty] ?? trail.difficulty}
              </span>
            </div>
          )}

          {/* Content */}
          <div style={styles.content}>
            <h2
              id="route-preview-name"
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: 18,
                lineHeight: 1.2,
              }}
            >
              {trail.name}
            </h2>
            {trail.region && (
              <p
                id="route-preview-region"
                style={{
                  color: '#94a3b8',
                  fontSize: 13,
                  marginTop: 6,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {trail.region}
              </p>
            )}

            {/* Stats row */}
            <div id="route-preview-stats" style={styles.statsRow}>
              {trail.distance && (
                <div id="route-preview-distance" style={styles.statCol}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {trail.distance}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>km</span>
                </div>
              )}
              {trail.elevation && (
                <div id="route-preview-elevation" style={styles.statCol}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {trail.elevation}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>elev</span>
                </div>
              )}
              {trail.duration && (
                <div id="route-preview-duration" style={styles.statCol}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {trail.duration}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>time</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={styles.actions}>
              <button id="route-preview-start" style={styles.startBtn}>
                Start
              </button>
              <button id="route-preview-schedule" style={styles.scheduleBtn}>
                Schedule
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
