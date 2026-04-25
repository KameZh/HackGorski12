import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import MapView from '../components/map/MapView'
import BottomNav from '../components/layout/Bottomnav'
import CameraButton from '../components/camera/CameraButton'
import PhotoCaptureModal from '../components/camera/PhotoCaptureModal'
import { fetchMapTrails } from '../api/maps'
import { createPhotoPing } from '../api/pings'
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
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [suggestionTrails, setSuggestionTrails] = useState([])
  const [hideTopBar, setHideTopBar] = useState(false)
  const [searchRequest, setSearchRequest] = useState(null)

  // Photo capture state
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)

  const initialStartFocus = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const rawStartLng = params.get('startLng')
    const rawStartLat = params.get('startLat')
    const trailId = String(params.get('trailId') || '').trim()

    if (rawStartLng == null || rawStartLat == null) {
      return null
    }

    const startLng = Number(rawStartLng)
    const startLat = Number(rawStartLat)

    if (!Number.isFinite(startLng) || !Number.isFinite(startLat)) {
      return null
    }

    if (Math.abs(startLng) > 180 || Math.abs(startLat) > 90) {
      return null
    }

    return {
      startCoordinates: [startLng, startLat],
      trailId: trailId || null,
    }
  }, [location.search])

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

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverscroll =
      document.documentElement.style.overscrollBehavior
    const previousBodyOverscroll = document.body.style.overscrollBehavior

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overscrollBehavior = 'none'
    document.body.style.overscrollBehavior = 'none'

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll
      document.body.style.overscrollBehavior = previousBodyOverscroll
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

  const handleMapSearchSubmit = useCallback(
    (event) => {
      event.preventDefault()
      const query = searchQuery.trim()
      if (!query) return
      setSearchRequest({ id: Date.now(), query })
    },
    [searchQuery]
  )

  // Handle photo capture from camera button
  const handlePhotoCapture = useCallback((photo) => {
    setCapturedPhoto(photo)
    setShowPhotoModal(true)
  }, [])

  // Handle photo submission
  const handlePhotoSubmit = useCallback(async (photoData) => {
    try {
      await createPhotoPing({
        type: 'photo',
        description: photoData.description,
        photoUrl: photoData.webPath,
        coordinates: photoData.coordinates,
      })
    } catch (err) {
      console.error('Photo ping submit error:', err)
      throw err
    }
  }, [])

  return (
    <div id="maps-page" className="maps-page">
      <div className="maps-glow maps-glow-top" />
      <div className="maps-glow maps-glow-bottom" />

      <div className="maps-layer">
        <MapView
          searchQuery={searchQuery}
          searchRequest={searchRequest}
          initialStartFocus={initialStartFocus}
          onTrailFlowVisibilityChange={setHideTopBar}
        >
          <CameraButton onPhotoCapture={handlePhotoCapture} />
        </MapView>
      </div>

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

      {!hideTopBar ? (
        <div id="maps-topbar" className="maps-topbar">
          <div className="maps-panel">
            <div className="maps-title-row">
              <h1 className="maps-title">Maps</h1>
              <span className="maps-badge">LIVE</span>
            </div>

            <form
              className={`maps-search ${searchFocused ? 'focused' : ''}`}
              onSubmit={handleMapSearchSubmit}
            >
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
                  type="button"
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
            </form>
          </div>
        </div>
      ) : null}

      <div className="maps-bottomnav-wrap">
        <BottomNav />
      </div>
    </div>
  )
}
