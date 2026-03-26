import { useState, useMemo } from 'react'
import BottomNav from '../components/layout/Bottomnav'
import TrailCard from '../components/explore/TrailCard'
import AnimalCard from '../components/explore/AnimalCard'
import EcoImpactBanner from '../components/explore/EcoImpactBanner'
import {
  DEMO_TRAILS,
  DEMO_ANIMALS,
  ECO_STATS,
  FILTER_OPTIONS,
} from '../components/data/Explorerdata'

const TABS = [
  { id: 'trails', label: 'Pytechka' },
  { id: 'animals', label: 'Animals' },
]

export default function Explore() {
  const [activeTab, setActiveTab] = useState('trails')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [activeActivity, setActiveActivity] = useState('All')
  const [activeDifficulty, setActiveDifficulty] = useState('All')
  const [activeRegion, setActiveRegion] = useState('All')
  const [activeSort, setActiveSort] = useState('Popular')
  const [showFilters, setShowFilters] = useState(false)

  // Filtered trails
  const filteredTrails = useMemo(() => {
    return DEMO_TRAILS.filter((trail) => {
      const matchesSearch =
        searchQuery === '' ||
        trail.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trail.region.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesActivity =
        activeActivity === 'All' ||
        trail.activityType.toLowerCase() === activeActivity.toLowerCase()

      const matchesDifficulty =
        activeDifficulty === 'All' ||
        trail.difficulty.toLowerCase() === activeDifficulty.toLowerCase()

      const matchesRegion =
        activeRegion === 'All' || trail.region.includes(activeRegion)

      return (
        matchesSearch && matchesActivity && matchesDifficulty && matchesRegion
      )
    })
  }, [searchQuery, activeActivity, activeDifficulty, activeRegion])

  // Filtered animals
  const filteredAnimals = useMemo(() => {
    return DEMO_ANIMALS.filter((animal) => {
      const matchesSearch =
        searchQuery === '' ||
        animal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        animal.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
        animal.species.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesRegion =
        activeRegion === 'All' || animal.region.includes(activeRegion)

      return matchesSearch && matchesRegion
    })
  }, [searchQuery, activeRegion])

  return (
    <div id="explore-page" className="explore-page">
      {/* ── HEADER ── */}
      <header id="explore-header" className="explore-header">
        {/* App title + tabs */}
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
          className={`explore-search-wrapper ${isSearchFocused ? 'explore-search-wrapper-focused' : ''}`}
        >
          <svg
            id="explore-search-icon"
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

        {/* Filter chips row */}
        <div id="explore-filters-row" className="explore-filters-row">
          {/* Activity filter — only on trails tab */}
          {activeTab === 'trails' && (
            <div id="explore-filter-activity" className="explore-filter-group">
              {FILTER_OPTIONS.activity.map((opt) => (
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

          {/* Difficulty filter — only on trails tab */}
          {activeTab === 'trails' && (
            <div
              id="explore-filter-difficulty"
              className="explore-filter-group"
            >
              {FILTER_OPTIONS.difficulty.map((opt) => (
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

          {/* Region filter — shared */}
          <div id="explore-filter-region" className="explore-filter-group">
            {FILTER_OPTIONS.region.map((opt) => (
              <button
                key={opt}
                id={`filter-region-${opt.toLowerCase()}`}
                className={`filter-chip ${activeRegion === opt ? 'filter-chip-active' : 'filter-chip-inactive'}`}
                onClick={() => setActiveRegion(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── SCROLLABLE CONTENT ── */}
      <main id="explore-content" className="explore-content">
        {/* Eco Impact Banner — always visible */}
        <EcoImpactBanner stats={ECO_STATS} />

        {/* ── TRAILS TAB ── */}
        {activeTab === 'trails' && (
          <section id="trails-section" className="trails-section">
            {/* Section header */}
            <div id="trails-section-header" className="section-header">
              <h2 id="trails-section-title" className="section-title">
                {searchQuery !== ''
                  ? `Results for "${searchQuery}"`
                  : 'Popular Trails'}
              </h2>
              <span id="trails-count" className="section-count">
                {filteredTrails.length} trail
                {filteredTrails.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Sort row */}
            <div id="trails-sort-row" className="trails-sort-row">
              <span id="trails-sort-label" className="trails-sort-label">
                Sort by:
              </span>
              {FILTER_OPTIONS.sort.map((opt) => (
                <button
                  key={opt}
                  id={`sort-option-${opt.toLowerCase().replace(' ', '-')}`}
                  className={`sort-chip ${activeSort === opt ? 'sort-chip-active' : 'sort-chip-inactive'}`}
                  onClick={() => setActiveSort(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>

            {/* Trail cards list */}
            {filteredTrails.length > 0 ? (
              <div id="trails-list" className="trails-list">
                {filteredTrails.map((trail) => (
                  <TrailCard key={trail.id} trail={trail} />
                ))}
              </div>
            ) : (
              <div id="trails-empty-state" className="empty-state">
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
                  Try adjusting your filters or search query
                </p>
                <button
                  id="trails-empty-reset"
                  className="empty-state-reset-btn"
                  onClick={() => {
                    setSearchQuery('')
                    setActiveActivity('All')
                    setActiveDifficulty('All')
                    setActiveRegion('All')
                  }}
                >
                  Reset filters
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── ANIMALS TAB ── */}
        {activeTab === 'animals' && (
          <section id="animals-section" className="animals-section">
            {/* Section header */}
            <div id="animals-section-header" className="section-header">
              <h2 id="animals-section-title" className="section-title">
                {searchQuery !== ''
                  ? `Results for "${searchQuery}"`
                  : 'Wildlife Sightings'}
              </h2>
              <span id="animals-count" className="section-count">
                {filteredAnimals.length} species
              </span>
            </div>

            {/* Info note */}
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
                Sighting locations are reported by our community of hikers and
                photographers. Always keep your distance from wildlife.
              </span>
            </div>

            {/* Animal cards list */}
            {filteredAnimals.length > 0 ? (
              <div id="animals-list" className="animals-list">
                {filteredAnimals.map((animal) => (
                  <AnimalCard key={animal.id} animal={animal} />
                ))}
              </div>
            ) : (
              <div id="animals-empty-state" className="empty-state">
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
                  No animals found
                </p>
                <p id="animals-empty-subtitle" className="empty-state-subtitle">
                  Try a different region or search term
                </p>
                <button
                  id="animals-empty-reset"
                  className="empty-state-reset-btn"
                  onClick={() => {
                    setSearchQuery('')
                    setActiveRegion('All')
                  }}
                >
                  Reset filters
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── BOTTOM NAV ── */}
      <BottomNav />
    </div>
  )
}
