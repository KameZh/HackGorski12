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
    borderRadius: 14,
    border: '1px solid rgba(148, 163, 184, 0.35)',
    boxShadow: '0 8px 18px rgba(0,0,0,0.2)',
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

/**
 * MapControls — floating right-side action buttons.
 * Positioned absolutely over the map.
 */
export default function MapControls({ onCenterMe, onZoomIn, onZoomOut }) {
  const { mapStyle, terrain3D, toggleMapStyle, toggleTerrain, mode, setMode } =
    useMapStore()

  return (
    <div id="map-controls" style={styles.controlsWrap}>
      {/* Toggle map style */}
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
          ...styles.buttonBase,
          background: 'rgba(255,255,255,0.92)',
          color: '#334155',
        }}
      >
        {mapStyle === 'outdoors-v12' ? (
          /* Satellite icon */
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
          /* Map icon */
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

      {/* 3D Terrain toggle */}
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
          background: terrain3D ? '#10b981' : 'rgba(255,255,255,0.92)',
          color: terrain3D ? '#fff' : '#334155',
        }}
      >
        {/* Mountain icon */}
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

      {/* Center on my location */}
      <button
        id="map-center-me"
        title="Center on my location"
        onClick={onCenterMe}
        className="w-11 h-11 rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white active:scale-95 transition-all"
        style={{
          ...styles.buttonBase,
          background: 'rgba(255,255,255,0.92)',
          color: '#334155',
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

      {/* Draw mode toggle */}
      <button
        id="map-draw-toggle"
        title={mode === 'draw' ? 'Exit draw mode' : 'Draw a route'}
        onClick={() => setMode(mode === 'draw' ? 'explore' : 'draw')}
        className={`w-11 h-11 rounded-2xl backdrop-blur-sm shadow-lg flex items-center justify-center transition-all active:scale-95 ${
          mode === 'draw'
            ? 'bg-blue-500 text-white'
            : 'bg-white/90 text-gray-700 hover:bg-white'
        }`}
        style={{
          ...styles.buttonBase,
          background: mode === 'draw' ? '#3b82f6' : 'rgba(255,255,255,0.92)',
          color: mode === 'draw' ? '#fff' : '#334155',
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
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </button>

      <div style={styles.zoomStack}>
        {/* Zoom in */}
        <button
          id="map-zoom-in"
          title="Zoom in"
          onClick={() => onZoomIn?.()}
          className="w-11 h-11 rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white active:scale-95 transition-all"
          style={{
            ...styles.buttonBase,
            background: 'rgba(255,255,255,0.92)',
            color: '#111827',
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

        {/* Zoom out */}
        <button
          id="map-zoom-out"
          title="Zoom out"
          onClick={() => onZoomOut?.()}
          className="w-11 h-11 rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white active:scale-95 transition-all"
          style={{
            ...styles.buttonBase,
            background: 'rgba(255,255,255,0.92)',
            color: '#111827',
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
