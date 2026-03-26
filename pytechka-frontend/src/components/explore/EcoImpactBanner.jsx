export default function EcoImpactBanner({ stats }) {
  const { reportsThisWeek, eventsScheduled, volunteersActive, trailsCleaned } =
    stats

  return (
    <div id="eco-impact-banner" className="eco-impact-banner">
      {/* Header */}
      <div id="eco-banner-header" className="eco-banner-header">
        <div id="eco-banner-title-group" className="eco-banner-title-group">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
          </svg>
          <span id="eco-banner-title" className="eco-banner-title">
            Eco Impact This Week
          </span>
        </div>
        <button id="eco-banner-cta" className="eco-banner-cta">
          Join cleanup
        </button>
      </div>

      {/* Stats grid */}
      <div id="eco-stats-grid" className="eco-stats-grid">
        <div id="eco-stat-reports" className="eco-stat-item">
          <span id="eco-stat-reports-value" className="eco-stat-value">
            {reportsThisWeek}
          </span>
          <span id="eco-stat-reports-label" className="eco-stat-label">
            Reports
          </span>
        </div>

        <div id="eco-stat-events" className="eco-stat-item">
          <span id="eco-stat-events-value" className="eco-stat-value">
            {eventsScheduled}
          </span>
          <span id="eco-stat-events-label" className="eco-stat-label">
            Events
          </span>
        </div>

        <div id="eco-stat-volunteers" className="eco-stat-item">
          <span id="eco-stat-volunteers-value" className="eco-stat-value">
            {volunteersActive}
          </span>
          <span id="eco-stat-volunteers-label" className="eco-stat-label">
            Volunteers
          </span>
        </div>

        <div id="eco-stat-trails" className="eco-stat-item">
          <span id="eco-stat-trails-value" className="eco-stat-value">
            {trailsCleaned}
          </span>
          <span id="eco-stat-trails-label" className="eco-stat-label">
            Trails cleaned
          </span>
        </div>
      </div>
    </div>
  )
}
