import { useState } from 'react'
import MapView from '../components/map/MapView'
import BottomNav from '../components/layout/Bottomnav'
import { useMapStore } from '../store/mapStore'

const styles = {
  page: {
    position: 'fixed',
    inset: 0,
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#0b1220',
  },
  mapLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
  },
  topbarWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 15,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
    paddingBottom: 8,
    pointerEvents: 'none',
  },
  searchBar: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    borderRadius: 16,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
    backdropFilter: 'blur(10px)',
    color: '#fff',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 14,
  },
  clearBtn: {
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.85)',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    padding: 0,
  },
  drawBanner: {
    position: 'absolute',
    top: 'calc(env(safe-area-inset-top, 0px) + 72px)',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 18,
    padding: '8px 14px',
    borderRadius: 14,
    background: 'rgba(59, 130, 246, 0.92)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    pointerEvents: 'none',
    boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
  },
  bottomNavWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
  },
}

export default function Maps() {
  const { mode } = useMapStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <div id="maps-page" style={styles.page}>
      <div style={styles.mapLayer}>
        <MapView />
      </div>

      <div id="maps-topbar" style={styles.topbarWrap}>
        <div
          style={{
            ...styles.searchBar,
            background: searchFocused
              ? 'rgba(255,255,255,0.22)'
              : 'rgba(255,255,255,0.15)',
            border: searchFocused
              ? '1px solid rgba(255,255,255,0.45)'
              : '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.7, flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="maps-search-input"
            type="text"
            placeholder="Search locations, trails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={styles.searchInput}
          />
          {searchQuery && (
            <button
              id="maps-search-clear"
              onClick={() => setSearchQuery('')}
              style={styles.clearBtn}
              aria-label="Clear search"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {mode === 'draw' && (
        <div style={styles.drawBanner}>
          Draw mode: tap the map to add points
        </div>
      )}

      <div style={styles.bottomNavWrap}>
        <BottomNav />
      </div>
    </div>
  )
}
