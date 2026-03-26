import { useState, useEffect, useCallback, useMemo } from 'react'
import Map, { Layer, Marker, Source } from 'react-map-gl/mapbox'
import { booleanPointInPolygon, center as turfCenter, circle as turfCircle } from '@turf/turf'
import BottomNav from '../components/layout/Bottomnav'
import TrailCard from '../components/explore/TrailCard'
import AnimalCard from '../components/explore/AnimalCard'
import EcoImpactBanner from '../components/explore/EcoImpactBanner'
import { fetchTrails } from '../api/trails'
import { fetchAnimals } from '../api/animals'
import { fetchEcoStats } from '../api/eco'

const TABS = [
  { id: 'trails', label: 'Pytechka' },
  { id: 'animals', label: 'Animals' },
]

const ACTIVITY_OPTIONS = ['All', 'Hiking', 'Running', 'Cycling']
const DIFFICULTY_OPTIONS = ['All', 'Easy', 'Moderate', 'Hard', 'Extreme']
const REGION_OPTIONS = [
  'All',
  'Рила',
  'Пирин',
  'Витоша',
  'Стара Планина',
  'Родопи',
  'Черноморие',
]
const SORT_OPTIONS = ['Popular', 'Newest', 'Nearest', 'Eco Score']
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const INITIAL_REGION_VIEW = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.6,
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    color: '#0f172a',
    paddingBottom: 92,
  },
  shell: {
    maxWidth: 980,
    margin: '0 auto',
    padding: '12px 12px 0 12px',
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  title: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.1,
  },
  tabs: {
    display: 'inline-flex',
    gap: 6,
    padding: 4,
    borderRadius: 12,
    background: '#e2e8f0',
  },
  tabButton: {
    border: 'none',
    borderRadius: 10,
    padding: '7px 12px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  searchRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    padding: '10px 12px',
    fontSize: 14,
    outline: 'none',
    background: '#fff',
  },
  clearButton: {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    padding: '10px 12px',
    cursor: 'pointer',
    background: '#fff',
    fontWeight: 600,
  },
  heroActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
    marginBottom: 10,
  },
  heroButton: {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    background: '#ffffff',
    padding: '10px 12px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  heroTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
  },
  heroSubtitle: {
    margin: '4px 0 0 0',
    color: '#475569',
    fontSize: 12,
  },
  filterPanel: {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    background: '#fff',
    padding: 10,
    marginBottom: 10,
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 8,
  },
  filterField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#475569',
  },
  select: {
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 13,
    background: '#fff',
  },
  activeSummary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryChip: {
    fontSize: 12,
    borderRadius: 999,
    padding: '4px 9px',
    background: '#dbeafe',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
  },
  resetButton: {
    border: 'none',
    background: 'transparent',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
  },
  moduleBlock: {
    marginBottom: 14,
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    background: '#fff',
    padding: 10,
  },
  moduleHead: {
    marginBottom: 8,
  },
  moduleTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 800,
  },
  moduleSubtitle: {
    margin: '3px 0 0 0',
    color: '#475569',
    fontSize: 12,
  },
  cardsStack: {
    display: 'grid',
    gap: 10,
  },
  regionMapWrap: {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#fff',
    marginBottom: 12,
  },
  regionMapHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottom: '1px solid #e2e8f0',
    padding: '8px 10px',
  },
  regionMapTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 800,
  },
  regionMapHint: {
    margin: 0,
    color: '#64748b',
    fontSize: 12,
  },
  radiusControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderTop: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  radiusLabel: {
    fontSize: 12,
    color: '#334155',
    minWidth: 72,
    fontWeight: 700,
  },
  radiusValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: 700,
    minWidth: 54,
  },
  radiusInput: {
    flex: 1,
  },
  clearAreaBtn: {
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    background: '#fff',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
  },
  stateBox: {
    borderRadius: 12,
    border: '1px dashed #cbd5e1',
    background: '#f8fafc',
    padding: 16,
    textAlign: 'center',
    color: '#475569',
  },
}

function SectionBlock({ title, subtitle, children }) {
  return (
    <section style={styles.moduleBlock}>
      <div style={styles.moduleHead}>
        <h2 style={styles.moduleTitle}>{title}</h2>
        {subtitle ? <p style={styles.moduleSubtitle}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function getTrailCenterPoint(trail) {
  if (!trail?.geojson) return null

  try {
    const parsed = typeof trail.geojson === 'string' ? JSON.parse(trail.geojson) : trail.geojson
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

function getAnimalPoint(animal) {
  if (!animal) return null

  const fromCoordsArray = (coords) => {
    if (!Array.isArray(coords) || coords.length < 2) return null
    const [longitude, latitude] = coords
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      properties: {},
    }
  }

  const directLng = Number(animal.longitude ?? animal.lng)
  const directLat = Number(animal.latitude ?? animal.lat)
  if (Number.isFinite(directLng) && Number.isFinite(directLat)) {
    return fromCoordsArray([directLng, directLat])
  }

  const nested =
    fromCoordsArray(animal.coordinates) ||
    fromCoordsArray(animal.location?.coordinates) ||
    fromCoordsArray(animal.geometry?.coordinates)

  return nested
}

export default function Explore() {
  const [activeTab, setActiveTab] = useState('trails')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeActivity, setActiveActivity] = useState('All')
  const [activeDifficulty, setActiveDifficulty] = useState('All')
  const [activeRegion, setActiveRegion] = useState('All')
  const [activeSort, setActiveSort] = useState('Popular')
  const [regionMapView, setRegionMapView] = useState(INITIAL_REGION_VIEW)
  const [selectedAreaCenter, setSelectedAreaCenter] = useState(null)
  const [selectedAreaRadiusKm, setSelectedAreaRadiusKm] = useState(8)

  const [trails, setTrails] = useState([])
  const [animals, setAnimals] = useState([])
  const [ecoStats, setEcoStats] = useState(null)

  const [loadingTrails, setLoadingTrails] = useState(false)
  const [loadingAnimals, setLoadingAnimals] = useState(false)
  const [errorTrails, setErrorTrails] = useState(null)
  const [errorAnimals, setErrorAnimals] = useState(null)

  const loadTrails = useCallback(async () => {
    setLoadingTrails(true)
    setErrorTrails(null)
    try {
      const params = {
        ...(searchQuery && { search: searchQuery }),
        ...(activeActivity !== 'All' && {
          activity: activeActivity.toLowerCase(),
        }),
        ...(activeDifficulty !== 'All' && {
          difficulty: activeDifficulty.toLowerCase(),
        }),
        ...(activeRegion !== 'All' && { region: activeRegion }),
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
  }, [searchQuery, activeActivity, activeDifficulty, activeRegion, activeSort])

  const loadAnimals = useCallback(async () => {
    setLoadingAnimals(true)
    setErrorAnimals(null)
    try {
      const params = {
        ...(searchQuery && { search: searchQuery }),
        ...(activeRegion !== 'All' && { region: activeRegion }),
      }
      const response = await fetchAnimals(params)
      setAnimals(Array.isArray(response.data) ? response.data : [])
    } catch {
      setErrorAnimals('Could not load wildlife data. Please try again.')
      setAnimals([])
    } finally {
      setLoadingAnimals(false)
    }
  }, [searchQuery, activeRegion])

  useEffect(() => {
    const loadEcoStats = async () => {
      try {
        const response = await fetchEcoStats()
        setEcoStats(response.data)
      } catch {
        // Non-critical — banner simply does not render
      }
    }
    loadEcoStats()
  }, [])

  useEffect(() => {
    if (activeTab === 'trails') loadTrails()
  }, [activeTab, loadTrails])

  useEffect(() => {
    if (activeTab === 'animals') loadAnimals()
  }, [activeTab, loadAnimals])

  const handleResetFilters = useCallback(() => {
    setSearchQuery('')
    setActiveActivity('All')
    setActiveDifficulty('All')
    setActiveRegion('All')
    setActiveSort('Popular')
    setSelectedAreaCenter(null)
  }, [])

  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery ||
      activeActivity !== 'All' ||
      activeDifficulty !== 'All' ||
      activeRegion !== 'All' ||
      activeSort !== 'Popular' ||
      Boolean(selectedAreaCenter)
    )
  }, [searchQuery, activeActivity, activeDifficulty, activeRegion, activeSort, selectedAreaCenter])

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
  const ecoRiskTrails = useMemo(
    () => visibleTrails.filter((trail) => Number(trail.ecoWarnings) > 0).slice(0, 3),
    [visibleTrails]
  )
  const newTrailDrops = visibleTrails.slice(1, 5)

  const visibleAnimals = useMemo(() => {
    if (!selectedAreaFeature) return animals

    return animals.filter((animal) => {
      const point = getAnimalPoint(animal)
      if (!point) return false
      return booleanPointInPolygon(point, selectedAreaFeature)
    })
  }, [animals, selectedAreaFeature])

  const rareAnimals = useMemo(
    () => visibleAnimals.filter((animal) => ['rare', 'very_rare'].includes(animal.rarity)).slice(0, 3),
    [visibleAnimals]
  )
  const freshSightings = visibleAnimals.slice(0, 6)

  return (
    <div id="explore-page" style={styles.page}>
      <div style={styles.shell}>
        <header>
          <div style={styles.titleRow}>
            <h1 style={styles.title}>Pytechka</h1>
            <div style={styles.tabs}>
              {TABS.map((tab) => {
                const isActive = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      ...styles.tabButton,
                      background: isActive ? '#0f172a' : 'transparent',
                      color: isActive ? '#fff' : '#0f172a',
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={styles.searchRow}>
            <input
              id="explore-search-input"
              type="text"
              placeholder={
                activeTab === 'trails'
                  ? 'Search trails or regions...'
                  : 'Search animals or species...'
              }
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              style={styles.searchInput}
            />
            {searchQuery ? (
              <button onClick={() => setSearchQuery('')} style={styles.clearButton}>
                Clear
              </button>
            ) : null}
          </div>

          <div style={styles.heroActions}>
            <button
              style={styles.heroButton}
              onClick={() => {
                setActiveTab('trails')
                setActiveSort('Nearest')
              }}
            >
              <p style={styles.heroTitle}>Continue Near Me</p>
              <p style={styles.heroSubtitle}>Show closest routes first</p>
            </button>
            <button
              style={styles.heroButton}
              onClick={() => {
                setActiveTab('trails')
                setActiveSort('Eco Score')
              }}
            >
              <p style={styles.heroTitle}>Low Eco Score Alerts</p>
              <p style={styles.heroSubtitle}>Focus regions needing cleanup</p>
            </button>
            <button
              style={styles.heroButton}
              onClick={() => {
                setActiveTab('animals')
                setActiveRegion('Рила')
              }}
            >
              <p style={styles.heroTitle}>Rare Sightings</p>
              <p style={styles.heroSubtitle}>Switch to wildlife feed</p>
            </button>
          </div>

          <div style={styles.filterPanel}>
            <div style={styles.filterGrid}>
              <div style={styles.filterField}>
                <span style={styles.filterLabel}>Activity</span>
                <select
                  value={activeActivity}
                  onChange={(event) => setActiveActivity(event.target.value)}
                  style={styles.select}
                  disabled={activeTab !== 'trails'}
                >
                  {ACTIVITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.filterField}>
                <span style={styles.filterLabel}>Difficulty</span>
                <select
                  value={activeDifficulty}
                  onChange={(event) => setActiveDifficulty(event.target.value)}
                  style={styles.select}
                  disabled={activeTab !== 'trails'}
                >
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.filterField}>
                <span style={styles.filterLabel}>Region</span>
                <select
                  value={activeRegion}
                  onChange={(event) => setActiveRegion(event.target.value)}
                  style={styles.select}
                >
                  {REGION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.filterField}>
                <span style={styles.filterLabel}>Sort</span>
                <select
                  value={activeSort}
                  onChange={(event) => setActiveSort(event.target.value)}
                  style={styles.select}
                  disabled={activeTab !== 'trails'}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {hasActiveFilters ? (
            <div style={styles.activeSummary}>
              {searchQuery ? <span style={styles.summaryChip}>Search: {searchQuery}</span> : null}
              {activeTab === 'trails' && activeActivity !== 'All' ? (
                <span style={styles.summaryChip}>Activity: {activeActivity}</span>
              ) : null}
              {activeTab === 'trails' && activeDifficulty !== 'All' ? (
                <span style={styles.summaryChip}>Difficulty: {activeDifficulty}</span>
              ) : null}
              {activeRegion !== 'All' ? (
                <span style={styles.summaryChip}>Region: {activeRegion}</span>
              ) : null}
              {activeTab === 'trails' && activeSort !== 'Popular' ? (
                <span style={styles.summaryChip}>Sort: {activeSort}</span>
              ) : null}
              {selectedAreaCenter ? (
                <span style={styles.summaryChip}>Area: {selectedAreaRadiusKm} km radius</span>
              ) : null}
              <button style={styles.resetButton} onClick={handleResetFilters}>
                Reset all
              </button>
            </div>
          ) : null}
        </header>

        <main>
          {ecoStats ? <EcoImpactBanner stats={ecoStats} /> : null}

          <section style={styles.regionMapWrap}>
            <div style={styles.regionMapHead}>
              <div>
                <p style={styles.regionMapTitle}>Select Your Territory</p>
                <p style={styles.regionMapHint}>Click on the mini map to draw a circular area and filter {activeTab === 'trails' ? 'tracks' : 'sightings'} inside it.</p>
              </div>
              {selectedAreaCenter ? (
                <button
                  type="button"
                  style={styles.clearAreaBtn}
                  onClick={() => setSelectedAreaCenter(null)}
                >
                  Clear area
                </button>
              ) : null}
            </div>

            {MAPBOX_TOKEN ? (
              <Map
                {...regionMapView}
                mapboxAccessToken={MAPBOX_TOKEN}
                mapStyle="mapbox://styles/mapbox/outdoors-v12"
                style={{ width: '100%', height: 220 }}
                onMove={(event) => setRegionMapView(event.viewState)}
                onClick={(event) => {
                  const { lng, lat } = event.lngLat
                  setSelectedAreaCenter([lng, lat])
                }}
                attributionControl={false}
              >
                {selectedAreaFeature ? (
                  <Source id="explore-selected-area" type="geojson" data={selectedAreaFeature}>
                    <Layer
                      id="explore-selected-area-fill"
                      type="fill"
                      paint={{
                        'fill-color': '#22c55e',
                        'fill-opacity': 0.2,
                      }}
                    />
                    <Layer
                      id="explore-selected-area-line"
                      type="line"
                      paint={{
                        'line-color': '#16a34a',
                        'line-width': 2,
                      }}
                    />
                  </Source>
                ) : null}

                {selectedAreaCenter ? (
                  <Marker longitude={selectedAreaCenter[0]} latitude={selectedAreaCenter[1]} anchor="center">
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: '#16a34a',
                        border: '2px solid #fff',
                      }}
                    />
                  </Marker>
                ) : null}
              </Map>
            ) : (
              <div style={{ ...styles.stateBox, margin: 10 }}>
                Missing VITE_MAPBOX_TOKEN. Mini region map is unavailable.
              </div>
            )}

            <div style={styles.radiusControls}>
              <span style={styles.radiusLabel}>Radius</span>
              <input
                type="range"
                min={2}
                max={40}
                step={1}
                value={selectedAreaRadiusKm}
                onChange={(event) => setSelectedAreaRadiusKm(Number(event.target.value))}
                style={styles.radiusInput}
              />
              <span style={styles.radiusValue}>{selectedAreaRadiusKm} km</span>
            </div>
          </section>

          {activeTab === 'trails' ? (
            <>
              <SectionBlock
                title={searchQuery ? `Results for "${searchQuery}"` : 'Featured Trail'}
                subtitle={selectedAreaCenter ? `Main suggestion in selected area (${visibleTrails.length} tracks found)` : 'Main suggestion based on your current filters'}
              >
                {loadingTrails ? (
                  <div style={styles.stateBox}>Loading trails...</div>
                ) : errorTrails ? (
                  <div style={styles.stateBox}>
                    <p>{errorTrails}</p>
                    <button onClick={loadTrails} style={styles.clearButton}>
                      Retry
                    </button>
                  </div>
                ) : featuredTrail ? (
                  <TrailCard trail={featuredTrail} />
                ) : (
                  <div style={styles.stateBox}>No trails found for current filters and selected territory.</div>
                )}
              </SectionBlock>

              {!loadingTrails && !errorTrails ? (
                <SectionBlock
                  title="Eco Alerts Nearby"
                  subtitle="Routes with active eco reports from the community"
                >
                  {ecoRiskTrails.length > 0 ? (
                    <div style={styles.cardsStack}>
                      {ecoRiskTrails.map((trail) => (
                        <TrailCard key={trail.id} trail={trail} />
                      ))}
                    </div>
                  ) : (
                    <div style={styles.stateBox}>No active eco alerts in this filter scope.</div>
                  )}
                </SectionBlock>
              ) : null}

              {!loadingTrails && !errorTrails ? (
                <SectionBlock
                  title="Community New"
                  subtitle="Fresh uploads from hikers and runners"
                >
                  {newTrailDrops.length > 0 ? (
                    <div style={styles.cardsStack}>
                      {newTrailDrops.map((trail) => (
                        <TrailCard key={trail.id} trail={trail} />
                      ))}
                    </div>
                  ) : (
                    <div style={styles.stateBox}>No additional trails in the feed yet.</div>
                  )}
                </SectionBlock>
              ) : null}
            </>
          ) : (
            <>
              <SectionBlock
                title={searchQuery ? `Results for "${searchQuery}"` : 'Rare Sightings'}
                subtitle={selectedAreaCenter ? `Species in selected area (${visibleAnimals.length} sightings found)` : 'Species that deserve careful observation'}
              >
                {loadingAnimals ? (
                  <div style={styles.stateBox}>Loading wildlife data...</div>
                ) : errorAnimals ? (
                  <div style={styles.stateBox}>
                    <p>{errorAnimals}</p>
                    <button onClick={loadAnimals} style={styles.clearButton}>
                      Retry
                    </button>
                  </div>
                ) : rareAnimals.length > 0 ? (
                  <div style={styles.cardsStack}>
                    {rareAnimals.map((animal) => (
                      <AnimalCard key={animal.id} animal={animal} />
                    ))}
                  </div>
                ) : (
                  <div style={styles.stateBox}>No rare sightings in this region.</div>
                )}
              </SectionBlock>

              {!loadingAnimals && !errorAnimals ? (
                <SectionBlock
                  title="Recent Community Sightings"
                  subtitle="Fresh wildlife reports from users"
                >
                  {freshSightings.length > 0 ? (
                    <div style={styles.cardsStack}>
                      {freshSightings.map((animal) => (
                        <AnimalCard key={animal.id} animal={animal} />
                      ))}
                    </div>
                  ) : (
                    <div style={styles.stateBox}>No sightings found for current filters.</div>
                  )}
                </SectionBlock>
              ) : null}
            </>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
