import { useEffect, useMemo, useState } from 'react'
import MapView from '../components/map/MapView'
import BottomNav from '../components/layout/Bottomnav'
import { useMapStore } from '../store/mapStore'
import { fetchMapTrails } from '../api/maps'
import { getSearchSuggestions } from '../utils/searchSuggestions'
import './Maps.css'

const MAPS_FALLBACK_TERMS = [
  'Hiking',
  'Running',
  'Forest',
  'Waterfall',
  'Mountain',
  'Eco',
]

export default function Maps() {
  const { mode } = useMapStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [suggestionTrails, setSuggestionTrails] = useState([])

  useEffect(() => {
    let active = true

    fetchMapTrails()
      .then((response) => {
        if (!active) return
        setSuggestionTrails(Array.isArray(response.data) ? response.data : [])
      })
      .catch(() => {
        if (!active) return
        setSuggestionTrails([])
      })

    return () => {
      active = false
    }
  }, [])

  const mapSearchSuggestions = useMemo(
    () =>
      getSearchSuggestions({
        query: searchQuery,
        trails: suggestionTrails,
        fallbackTerms: MAPS_FALLBACK_TERMS,
        limit: 9,
      }),
    [searchQuery, suggestionTrails]
  )

  return (
    <div id="maps-page" className="maps-page">
      <div className="maps-glow maps-glow-top" />
      <div className="maps-glow maps-glow-bottom" />

      <div className="maps-layer">
        <MapView searchQuery={searchQuery} />
      </div>

      <div id="maps-topbar" className="maps-topbar">
        <div className="maps-panel">
          <div className="maps-title-row">
            <h1 className="maps-title">Maps</h1>
            <span className="maps-badge">LIVE</span>
          </div>

          <div className={`maps-search ${searchFocused ? 'focused' : ''}`}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="maps-search-icon"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="maps-search-input"
              type="text"
              placeholder="Search locations and routes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              list="maps-search-suggestions"
              autoComplete="off"
              className="maps-search-input"
            />
            <datalist id="maps-search-suggestions">
              {mapSearchSuggestions.map((suggestion) => (
                <option
                  key={`maps-suggestion-${suggestion.toLowerCase()}`}
                  value={suggestion}
                />
              ))}
            </datalist>
            {searchQuery && (
              <button
                id="maps-search-clear"
                onClick={() => setSearchQuery('')}
                className="maps-clear-btn"
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
      </div>

      {mode === 'draw' && (
        <div className="maps-draw-banner">
          Draw mode: tap the map to add points
        </div>
      )}

      <div className="maps-bottomnav-wrap">
        <BottomNav />
      </div>
    </div>
  )
}
