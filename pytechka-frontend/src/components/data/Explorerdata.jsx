import { useState, useEffect, useCallback } from 'react'
import BottomNav from '../components/layout/BottomNav'
import TrailCard from '../components/explore/TrailCard'
import AnimalCard from '../components/explore/AnimalCard'
import EcoImpactBanner from '../components/explore/EcoImpactBanner'
import { fetchTrails } from '../api/trails'
import { fetchAnimals } from '../api/animals'
import { fetchEcoStats } from '../api/eco'

const TABS = [
  { id: 'trails', label: 'Пътечка' },
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

export default function Explore() {
  const [activeTab, setActiveTab] = useState('trails')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [activeActivity, setActiveActivity] = useState('All')
  const [activeDifficulty, setActiveDifficulty] = useState('All')
  const [activeRegion, setActiveRegion] = useState('All')
  const [activeSort, setActiveSort] = useState('Popular')

  const [trails, setTrails] = useState([])
  const [animals, setAnimals] = useState([])
  const [ecoStats, setEcoStats] = useState(null)

  const [loadingTrails, setLoadingTrails] = useState(false)
  const [loadingAnimals, setLoadingAnimals] = useState(false)

  const [errorTrails, setErrorTrails] = useState(null)
  const [errorAnimals, setErrorAnimals] = useState(null)

  // Fetch trails whenever filters or search change
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
      setTrails(response.data)
    } catch {
      setErrorTrails('Could not load trails. Please try again.')
    } finally {
      setLoadingTrails(false)
    }
  }, [searchQuery, activeActivity, activeDifficulty, activeRegion, activeSort])

  // Fetch animals whenever filters or search change
  const loadAnimals = useCallback(async () => {
    setLoadingAnimals(true)
    setErrorAnimals(null)
    try {
      const params = {
        ...(searchQuery && { search: searchQuery }),
        ...(activeRegion !== 'All' && { region: activeRegion }),
      }
      const response = await fetchAnimals(params)
      setAnimals(response.data)
    } catch {
      setErrorAnimals('Could not load wildlife data. Please try again.')
    } finally {
      setLoadingAnimals(false)
    }
  }, [searchQuery, activeRegion])

  // Fetch eco stats once on mount
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

  const handleResetFilters = () => {
    setSearchQuery('')
    setActiveActivity('All')
    setActiveDifficulty('All')
    setActiveRegion('All')
    setActiveSort('Popular')
  }

  return (
    <div id="explore-page" className="explore-page">
      {/* HEADER */}
      <header id="explore-header" className="explore-header">
        {/* Title + tab switcher */}
        <div id="explore-title-row" className="explore-title-row">
          <h1 id="explore-app-title" className="explore-app-title">
            Pytechka
          </h1>
          <div id="explore-tabs" className="explore-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                id={`explore-tab-${tab.id}`}
                className={`explore-tab ${activeTab === tab.id ? 'explore-tab-active' : 'explore-tab-inactive'}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div
          id="explore-search-wrapper"
          className={`explore-search-wrapper ${isSearchFocused ? 'explore-search-focused' : ''}`}
        >
          <svg
            className="explore-search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="explore-search-input"
            type="text"
            placeholder={
              activeTab === 'trails'
                ? 'Search trails, regions...'
                : 'Search animals, species...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="explore-search-input"
          />
          {searchQuery !== '' && (
            <button
              id="explore-search-clear"
              className="explore-search-clear"
              onClick={() => setSearchQuery('')}
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

        {/* Filter chips */}
        <div id="explore-filters" className="explore-filters">
          {activeTab === 'trails' && (
            <div id="filter-row-activity" className="filter-row">
              {ACTIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  id={`filter-activity-${opt.toLowerCase()}`}
                  className={`filter-chip ${activeActivity === opt ? 'filter-chip-active' : 'filter-chip-inactive'}`}
                  onClick={() => setActiveActivity(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'trails' && (
            <div id="filter-row-difficulty" className="filter-row">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  id={`filter-difficulty-${opt.toLowerCase()}`}
                  className={`filter-chip ${activeDifficulty === opt ? 'filter-chip-active' : 'filter-chip-inactive'}`}
                  onClick={() => setActiveDifficulty(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          <div id="filter-row-region" className="filter-row">
            {REGION_OPTIONS.map((opt) => (
              <button
                key={opt}
                id={`filter-region-${opt.toLowerCase().replace(' ', '-')}`}
                className={`filter-chip ${activeRegion === opt ? 'filter-chip-active' : 'filter-chip-inactive'}`}
                onClick={() => setActiveRegion(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* SCROLLABLE CONTENT */}
      <main id="explore-content" className="explore-content">
        {/* Eco impact banner — renders only when backend data arrives */}
        {ecoStats && <EcoImpactBanner stats={ecoStats} />}

        {/* TRAILS TAB */}
        {activeTab === 'trails' && (
          <section id="trails-section" className="trails-section">
            <div id="trails-section-header" className="section-header">
              <h2 id="trails-section-title" className="section-title">
                {searchQuery !== '' ? `Results for "${searchQuery}"` : 'Trails'}
              </h2>
              <div id="trails-sort-row" className="sort-row">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    id={`sort-${opt.toLowerCase().replace(' ', '-')}`}
                    className={`sort-chip ${activeSort === opt ? 'sort-chip-active' : 'sort-chip-inactive'}`}
                    onClick={() => setActiveSort(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {loadingTrails && (
              <div id="trails-loading" className="loading-state">
                <div id="trails-spinner" className="loading-spinner" />
                <span className="loading-label">Loading trails...</span>
              </div>
            )}

            {errorTrails && !loadingTrails && (
              <div id="trails-error" className="error-state">
                <p id="trails-error-msg" className="error-message">
                  {errorTrails}
                </p>
                <button
                  id="trails-retry"
                  className="retry-btn"
                  onClick={loadTrails}
                >
                  Retry
                </button>
              </div>
            )}

            {!loadingTrails && !errorTrails && trails.length > 0 && (
              <div id="trails-list" className="trails-list">
                {trails.map((trail) => (
                  <TrailCard key={trail.id} trail={trail} />
                ))}
              </div>
            )}

            {!loadingTrails && !errorTrails && trails.length === 0 && (
              <div id="trails-empty" className="empty-state">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="empty-state-icon"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <p id="trails-empty-title" className="empty-state-title">
                  No trails found
                </p>
                <p id="trails-empty-subtitle" className="empty-state-subtitle">
                  Try adjusting your filters or be the first to add a trail
                  here.
                </p>
                <button
                  id="trails-empty-reset"
                  className="empty-state-reset-btn"
                  onClick={handleResetFilters}
                >
                  Reset filters
                </button>
              </div>
            )}
          </section>
        )}

        {/* ANIMALS TAB */}
        {activeTab === 'animals' && (
          <section id="animals-section" className="animals-section">
            <div id="animals-section-header" className="section-header">
              <h2 id="animals-section-title" className="section-title">
                {searchQuery !== ''
                  ? `Results for "${searchQuery}"`
                  : 'Wildlife Sightings'}
              </h2>
            </div>

            <div id="animals-info-note" className="animals-info-note">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                Sighting locations are reported by our community. Always keep
                your distance from wildlife.
              </span>
            </div>

            {loadingAnimals && (
              <div id="animals-loading" className="loading-state">
                <div id="animals-spinner" className="loading-spinner" />
                <span className="loading-label">Loading wildlife data...</span>
              </div>
            )}

            {errorAnimals && !loadingAnimals && (
              <div id="animals-error" className="error-state">
                <p id="animals-error-msg" className="error-message">
                  {errorAnimals}
                </p>
                <button
                  id="animals-retry"
                  className="retry-btn"
                  onClick={loadAnimals}
                >
                  Retry
                </button>
              </div>
            )}

            {!loadingAnimals && !errorAnimals && animals.length > 0 && (
              <div id="animals-list" className="animals-list">
                {animals.map((animal) => (
                  <AnimalCard key={animal.id} animal={animal} />
                ))}
              </div>
            )}

            {!loadingAnimals && !errorAnimals && animals.length === 0 && (
              <div id="animals-empty" className="empty-state">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="empty-state-icon"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <p id="animals-empty-title" className="empty-state-title">
                  No wildlife found
                </p>
                <p id="animals-empty-subtitle" className="empty-state-subtitle">
                  Try a different region or search term.
                </p>
                <button
                  id="animals-empty-reset"
                  className="empty-state-reset-btn"
                  onClick={handleResetFilters}
                >
                  Reset filters
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
