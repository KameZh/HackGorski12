import { useState, useEffect, useCallback, useMemo } from 'react'
import Map, { Layer, Marker, Source } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  booleanPointInPolygon,
  center as turfCenter,
  circle as turfCircle,
} from '@turf/turf'
import BottomNav from '../components/layout/Bottomnav'
import TrailCard from '../components/explore/TrailCard'
import EcoImpactBanner from '../components/explore/EcoImpactBanner'
import {
  FILTER_DEFAULTS,
  buildExploreFilterOptions,
} from '../components/data/Explorerdata'
import { fetchTrails } from '../api/trails'
import { fetchEcoStats } from '../api/eco'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const INITIAL_REGION_VIEW = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.6,
}

function SectionBlock({ title, subtitle, children }) {
  return (
    <section className="explore-section reveal-up">
      <header className="explore-section-head">
        <h2 className="explore-section-title">{title}</h2>
        {subtitle ? (
          <p className="explore-section-subtitle">{subtitle}</p>
        ) : null}
      </header>
      {children}
    </section>
  )
}

function getTrailCenterPoint(trail) {
  if (!trail?.geojson) return null

  try {
    const parsed =
      typeof trail.geojson === 'string'
        ? JSON.parse(trail.geojson)
        : trail.geojson
    if (!parsed || typeof parsed !== 'object' || !parsed.type) return null

    const centered = turfCenter(parsed)
    if (!centered?.geometry?.coordinates) return null

    const [longitude, latitude] = centered.geometry.coordinates
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      properties: {},
    }
  } catch {
    return null
  }
}

export default function Explore() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeActivity, setActiveActivity] = useState(FILTER_DEFAULTS.activity)
  const [activeDifficulty, setActiveDifficulty] = useState(
    FILTER_DEFAULTS.difficulty
  )
  const [activeSort, setActiveSort] = useState(FILTER_DEFAULTS.sort)
  const [regionMapView, setRegionMapView] = useState(INITIAL_REGION_VIEW)
  const [selectedAreaCenter, setSelectedAreaCenter] = useState(null)
  const [selectedAreaRadiusKm, setSelectedAreaRadiusKm] = useState(8)

  const [trails, setTrails] = useState([])
  const [ecoStats, setEcoStats] = useState(null)

  const [loadingTrails, setLoadingTrails] = useState(false)
  const [errorTrails, setErrorTrails] = useState(null)

  const filterOptions = useMemo(
    () =>
      buildExploreFilterOptions({
        trails,
        selectedActivity: activeActivity,
        selectedDifficulty: activeDifficulty,
      }),
    [trails, activeActivity, activeDifficulty]
  )

  const loadTrails = useCallback(async () => {
    setLoadingTrails(true)
    setErrorTrails(null)
    try {
      const params = {
        ...(searchQuery && { search: searchQuery }),
        ...(activeActivity !== FILTER_DEFAULTS.activity && {
          activity: activeActivity.toLowerCase(),
        }),
        ...(activeDifficulty !== FILTER_DEFAULTS.difficulty && {
          difficulty: activeDifficulty.toLowerCase(),
        }),
        sort: activeSort.toLowerCase().replace(' ', '_'),
      }

      const response = await fetchTrails(params)
      setTrails(Array.isArray(response.data) ? response.data : [])
    } catch {
      setErrorTrails('Could not load trails. Please try again.')
      setTrails([])
    } finally {
      setLoadingTrails(false)
    }
  }, [searchQuery, activeActivity, activeDifficulty, activeSort])

  useEffect(() => {
    const loadEcoStats = async () => {
      try {
        const response = await fetchEcoStats()
        setEcoStats(response.data)
      } catch {
        // Banner is optional.
      }
    }

    loadEcoStats()
  }, [])

  useEffect(() => {
    loadTrails()
  }, [loadTrails])

  const handleResetFilters = useCallback(() => {
    setSearchQuery('')
    setActiveActivity(FILTER_DEFAULTS.activity)
    setActiveDifficulty(FILTER_DEFAULTS.difficulty)
    setActiveSort(FILTER_DEFAULTS.sort)
    setSelectedAreaCenter(null)
  }, [])

  const hasActiveFilters = useMemo(
    () =>
      Boolean(searchQuery) ||
      activeActivity !== FILTER_DEFAULTS.activity ||
      activeDifficulty !== FILTER_DEFAULTS.difficulty ||
      activeSort !== FILTER_DEFAULTS.sort ||
      Boolean(selectedAreaCenter),
    [
      searchQuery,
      activeActivity,
      activeDifficulty,
      activeSort,
      selectedAreaCenter,
    ]
  )

  const selectedAreaFeature = useMemo(() => {
    if (!selectedAreaCenter) return null

    return turfCircle(selectedAreaCenter, selectedAreaRadiusKm, {
      units: 'kilometers',
      steps: 60,
    })
  }, [selectedAreaCenter, selectedAreaRadiusKm])

  const visibleTrails = useMemo(() => {
    if (!selectedAreaFeature) return trails

    return trails.filter((trail) => {
      const centerPoint = getTrailCenterPoint(trail)
      if (!centerPoint) return false
      return booleanPointInPolygon(centerPoint, selectedAreaFeature)
    })
  }, [trails, selectedAreaFeature])

  const featuredTrail = visibleTrails[0] ?? null
  const ecoFocusTrails = useMemo(
    () =>
      visibleTrails
        .filter((trail) => Number(trail.ecoWarnings) > 0)
        .slice(0, 3),
    [visibleTrails]
  )
  const latestTrails = visibleTrails.slice(1, 5)

  return (
    <div id="explore-page" className="explore-page">
      <div className="explore-glow explore-glow-top" />
      <div className="explore-glow explore-glow-bottom" />

      <div className="explore-shell">
        <header className="explore-header reveal-up">
          <div className="explore-title-row">
            <h1 className="explore-title">Pytechka</h1>
          </div>
        </header>

        <main className="explore-main">
          {ecoStats ? (
            <div className="explore-banner-wrap reveal-up">
              <EcoImpactBanner stats={ecoStats} />
            </div>
          ) : null}

          <section className="explore-map-panel reveal-up">
            <div className="explore-map-head">
              {selectedAreaCenter ? (
                <button
                  type="button"
                  className="explore-ghost-btn"
                  onClick={() => setSelectedAreaCenter(null)}
                >
                  Clear area
                </button>
              ) : null}
            </div>

            <div className="explore-map-controls">
              <div className="explore-filter-panel">
                <div className="explore-filter-grid">
                  <label className="explore-filter-field">
                    <span className="explore-filter-label">Activity</span>
                    <select
                      value={activeActivity}
                      onChange={(event) =>
                        setActiveActivity(event.target.value)
                      }
                      className="explore-select"
                    >
                      {filterOptions.activities.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="explore-filter-field">
                    <span className="explore-filter-label">Difficulty</span>
                    <select
                      value={activeDifficulty}
                      onChange={(event) =>
                        setActiveDifficulty(event.target.value)
                      }
                      className="explore-select"
                    >
                      {filterOptions.difficulties.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="explore-filter-field">
                    <span className="explore-filter-label">Sort</span>
                    <select
                      value={activeSort}
                      onChange={(event) => setActiveSort(event.target.value)}
                      className="explore-select"
                    >
                      {filterOptions.sorts.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {hasActiveFilters ? (
                  <div className="explore-active-summary">
                    {searchQuery ? (
                      <span className="explore-chip">
                        Search: {searchQuery}
                      </span>
                    ) : null}
                    {activeActivity !== FILTER_DEFAULTS.activity ? (
                      <span className="explore-chip">
                        Activity: {activeActivity}
                      </span>
                    ) : null}
                    {activeDifficulty !== FILTER_DEFAULTS.difficulty ? (
                      <span className="explore-chip">
                        Difficulty: {activeDifficulty}
                      </span>
                    ) : null}
                    {activeSort !== FILTER_DEFAULTS.sort ? (
                      <span className="explore-chip">Sort: {activeSort}</span>
                    ) : null}
                    {selectedAreaCenter ? (
                      <span className="explore-chip">
                        Area: {selectedAreaRadiusKm} km
                      </span>
                    ) : null}

                    <button
                      type="button"
                      className="explore-reset-link"
                      onClick={handleResetFilters}
                    >
                      Reset all
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="explore-action-grid explore-action-grid-map">
                <button
                  type="button"
                  className="explore-action-card"
                  onClick={() => {
                    setActiveSort('Nearest')
                  }}
                >
                  <p className="explore-action-title">Nearest Routes</p>
                </button>

                <button
                  type="button"
                  className="explore-action-card"
                  onClick={() => {
                    setActiveSort('Eco Score')
                  }}
                >
                  <p className="explore-action-title">Eco Priority</p>
                </button>

                <button
                  type="button"
                  className="explore-action-card"
                  onClick={() => {
                    setActiveActivity('Hiking')
                    setActiveDifficulty('Easy')
                    setActiveSort('Popular')
                  }}
                >
                  <p className="explore-action-title">Easy Trails</p>
                </button>
              </div>

              <div className="explore-search-row explore-search-row-map">
                <input
                  id="explore-search-input"
                  type="text"
                  placeholder="Search routes, mountain ranges, or terrain..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="explore-search-input"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="explore-ghost-btn"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            {MAPBOX_TOKEN ? (
              <Map
                {...regionMapView}
                mapboxAccessToken={MAPBOX_TOKEN}
                mapStyle="mapbox://styles/mapbox/outdoors-v12"
                style={{ width: '100%', height: 260 }}
                onMove={(event) => setRegionMapView(event.viewState)}
                onClick={(event) => {
                  const { lng, lat } = event.lngLat
                  setSelectedAreaCenter([lng, lat])
                }}
                attributionControl={false}
              >
                {selectedAreaFeature ? (
                  <Source
                    id="explore-selected-area"
                    type="geojson"
                    data={selectedAreaFeature}
                  >
                    <Layer
                      id="explore-selected-area-fill"
                      type="fill"
                      paint={{
                        'fill-color': '#48a9a6',
                        'fill-opacity': 0.22,
                      }}
                    />
                    <Layer
                      id="explore-selected-area-line"
                      type="line"
                      paint={{
                        'line-color': '#4281a4',
                        'line-width': 2.5,
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
                    <div className="explore-map-marker" />
                  </Marker>
                ) : null}
              </Map>
            ) : (
              <div className="explore-state-box">
                Missing VITE_MAPBOX_TOKEN. Area map is unavailable.
              </div>
            )}

            <div className="explore-radius-controls">
              <span className="explore-radius-label">Radius</span>
              <input
                type="range"
                min={2}
                max={40}
                step={1}
                value={selectedAreaRadiusKm}
                onChange={(event) =>
                  setSelectedAreaRadiusKm(Number(event.target.value))
                }
                className="explore-radius-input"
              />
              <span className="explore-radius-value">
                {selectedAreaRadiusKm} km
              </span>
              <span className="explore-badge">TRAILS</span>
            </div>
          </section>

          <SectionBlock
            title={
              searchQuery ? `Results for \"${searchQuery}\"` : 'Featured Route'
            }
            subtitle={
              selectedAreaCenter
                ? `Primary suggestion in selected area (${visibleTrails.length} routes found)`
                : 'Primary suggestion based on active filters'
            }
          >
            {loadingTrails ? (
              <div className="explore-state-box">Loading routes...</div>
            ) : errorTrails ? (
              <div className="explore-state-box">
                <p>{errorTrails}</p>
                <button
                  type="button"
                  onClick={loadTrails}
                  className="explore-primary-btn"
                >
                  Retry
                </button>
              </div>
            ) : featuredTrail ? (
              <div className="explore-card-shell card-enter">
                <TrailCard trail={featuredTrail} />
              </div>
            ) : (
              <div className="explore-state-box">
                No routes found for current filters and selected area.
              </div>
            )}
          </SectionBlock>

          {!loadingTrails && !errorTrails ? (
            <SectionBlock
              title="Eco Priority Routes"
              subtitle="Routes with active community eco reports"
            >
              {ecoFocusTrails.length > 0 ? (
                <div className="explore-cards-stack">
                  {ecoFocusTrails.map((trail) => (
                    <div
                      key={trail.id}
                      className="explore-card-shell card-enter"
                    >
                      <TrailCard trail={trail} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="explore-state-box">
                  No eco-priority routes in the current scope.
                </div>
              )}
            </SectionBlock>
          ) : null}

          {!loadingTrails && !errorTrails ? (
            <SectionBlock
              title="New From Community"
              subtitle="Fresh uploads from hikers and runners"
            >
              {latestTrails.length > 0 ? (
                <div className="explore-cards-stack">
                  {latestTrails.map((trail) => (
                    <div
                      key={trail.id}
                      className="explore-card-shell card-enter"
                    >
                      <TrailCard trail={trail} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="explore-state-box">
                  No additional routes available yet.
                </div>
              )}
            </SectionBlock>
          ) : null}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
