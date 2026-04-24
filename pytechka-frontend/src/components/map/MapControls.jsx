import { useMapStore } from '../../store/mapStore'

const styles = {
  controlsWrap: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 16,
  },
  buttonBase: {
    width: 44,
    height: 44,
    borderRadius: 13,
    border: '1px solid rgba(66, 129, 164, 0.4)',
    boxShadow: '0 10px 22px rgba(0, 1, 0, 0.32)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  zoomStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
}

export default function MapControls({
  onCenterMe,
  onZoomIn,
  onZoomOut,
  onResetView,
  onTogglePitch,
  showResetViewButton = true,
  onToggleAreaInsights,
  areaInsightsEnabled = false,
  showAreaInsightsButton = false,
}) {
  const {
    mapStyle,
    terrain3D,
    hillshadeRelief,
    toggleMapStyle,
    toggleTerrain,
    toggleHillshadeRelief,
  } = useMapStore()

  const inactiveButton = {
    ...styles.buttonBase,
    background: 'rgba(18, 26, 40, 0.9)',
    color: '#9fc9de',
  }

  return (
    <div id="map-controls" style={styles.controlsWrap}>
      <button
        id="map-style-toggle"
        title={
          mapStyle === 'outdoors-v12'
            ? 'Switch to Satellite'
            : 'Switch to Outdoors'
        }
        onClick={toggleMapStyle}
        className="w-11 h-11 rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white active:scale-95 transition-all"
        style={{
          ...inactiveButton,
        }}
      >
        {mapStyle === 'outdoors-v12' ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
            <line x1="9" y1="3" x2="9" y2="18" />
            <line x1="15" y1="6" x2="15" y2="21" />
          </svg>
        )}
      </button>

      <button
        id="map-terrain-toggle"
        title={terrain3D ? 'Disable 3D terrain' : 'Enable 3D terrain'}
        onClick={toggleTerrain}
        className={`w-11 h-11 rounded-2xl backdrop-blur-sm shadow-lg flex items-center justify-center transition-all active:scale-95 ${
          terrain3D
            ? 'bg-emerald-500 text-white'
            : 'bg-white/90 text-gray-700 hover:bg-white'
        }`}
        style={{
          ...styles.buttonBase,
          background: terrain3D
            ? 'linear-gradient(180deg, #48a9a6, #4281a4)'
            : 'rgba(18, 26, 40, 0.9)',
          color: terrain3D ? '#fbfef9' : '#9fc9de',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
        </svg>
      </button>

      <button
        id="map-relief-toggle"
        title={hillshadeRelief ? 'Hide relief shading' : 'Show relief shading'}
        onClick={toggleHillshadeRelief}
        style={{
          ...styles.buttonBase,
          background: hillshadeRelief
            ? 'linear-gradient(180deg, #334155, #0f766e)'
            : 'rgba(18, 26, 40, 0.9)',
          color: hillshadeRelief ? '#fbfef9' : '#9fc9de',
        }}
        aria-label="Toggle relief shading"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 17c3-5 5-8 8-8s4 4 7 4c1 0 2-.4 3-1" />
          <path d="M3 21c3-4 5-6 8-6s4 3 7 3c1 0 2-.2 3-.8" />
          <path d="M3 13c2-4 4-6 7-6 4 0 5 4 8 4 1 0 2-.3 3-1" />
        </svg>
      </button>

      {onTogglePitch ? (
        <button
          id="map-pitch-toggle"
          title="Toggle tilted 3D view"
          onClick={() => onTogglePitch?.()}
          style={inactiveButton}
          aria-label="Toggle tilted 3D view"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 16 12 4l9 12" />
            <path d="M6 16h12" />
            <path d="M8 20h8" />
          </svg>
        </button>
      ) : null}

      <button
        id="map-center-me"
        title="Center on my location"
        onClick={onCenterMe}
        className="w-11 h-11 rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white active:scale-95 transition-all"
        style={{
          ...inactiveButton,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="7" />
        </svg>
      </button>

      {showAreaInsightsButton ? (
        <button
          id="map-area-insights-toggle"
          title={
            areaInsightsEnabled
              ? 'Hide area insights panel'
              : 'Show area insights panel'
          }
          onClick={() => onToggleAreaInsights?.()}
          style={{
            ...styles.buttonBase,
            background: areaInsightsEnabled
              ? 'linear-gradient(180deg, #48a9a6, #4281a4)'
              : 'rgba(18, 26, 40, 0.9)',
            color: areaInsightsEnabled ? '#fbfef9' : '#9fc9de',
          }}
          aria-label="Toggle area insights panel"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </button>
      ) : null}

      {showResetViewButton ? (
        <button
          id="map-reset-view"
          title="Reset map view"
          onClick={() => onResetView?.()}
          style={inactiveButton}
          aria-label="Reset map view"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 3-6.708" />
            <path d="M3 4v5h5" />
          </svg>
        </button>
      ) : null}

      <div style={styles.zoomStack}>
        <button
          id="map-zoom-in"
          title="Zoom in"
          onClick={() => onZoomIn?.()}
          className="w-11 h-11 rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white active:scale-95 transition-all"
          style={{
            ...inactiveButton,
          }}
          aria-label="Zoom in"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </button>

        <button
          id="map-zoom-out"
          title="Zoom out"
          onClick={() => onZoomOut?.()}
          className="w-11 h-11 rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white active:scale-95 transition-all"
          style={{
            ...inactiveButton,
          }}
          aria-label="Zoom out"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
