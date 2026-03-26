export default function AnimalCard({ animal }) {
  const {
    id,
    name,
    species,
    image,
    region,
    lastSeen,
    photoCount,
    rarity,
    shortDescription,
    conservationStatus,
  } = animal

  const rarityMap = {
    common: { label: 'Common', className: 'rarity-badge-common' },
    uncommon: { label: 'Uncommon', className: 'rarity-badge-uncommon' },
    rare: { label: 'Rare', className: 'rarity-badge-rare' },
    very_rare: { label: 'Very Rare', className: 'rarity-badge-very-rare' },
  }

  const conservationMap = {
    LC: { label: 'Least Concern', className: 'conservation-lc' },
    NT: { label: 'Near Threatened', className: 'conservation-nt' },
    VU: { label: 'Vulnerable', className: 'conservation-vu' },
    EN: { label: 'Endangered', className: 'conservation-en' },
    CR: { label: 'Critically Endangered', className: 'conservation-cr' },
  }

  const rarity_info = rarityMap[rarity] || rarityMap['common']
  const conservation_info = conservationMap[conservationStatus]

  return (
    <article id={`animal-card-${id}`} className="animal-card">
      {/* Image */}
      <div
        id={`animal-card-image-wrapper-${id}`}
        className="animal-card-image-wrapper"
      >
        <img
          id={`animal-card-image-${id}`}
          src={image}
          alt={name}
          className="animal-card-image"
        />

        {/* Rarity badge */}
        <div
          id={`animal-rarity-badge-${id}`}
          className={`rarity-badge ${rarity_info.className}`}
        >
          {rarity_info.label}
        </div>

        {/* Conservation status */}
        {conservation_info && (
          <div
            id={`animal-conservation-${id}`}
            className={`conservation-badge ${conservation_info.className}`}
          >
            {conservationStatus}
          </div>
        )}
      </div>

      {/* Content */}
      <div id={`animal-card-content-${id}`} className="animal-card-content">
        {/* Name + species */}
        <div id={`animal-card-header-${id}`} className="animal-card-header">
          <h3 id={`animal-card-name-${id}`} className="animal-card-name">
            {name}
          </h3>
          <span id={`animal-species-${id}`} className="animal-species">
            {species}
          </span>
        </div>

        {/* Region */}
        <div id={`animal-region-${id}`} className="animal-region">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="animal-region-label">{region}</span>
        </div>

        {/* Description */}
        <p
          id={`animal-card-description-${id}`}
          className="animal-card-description"
        >
          {shortDescription}
        </p>

        {/* Footer */}
        <div id={`animal-card-footer-${id}`} className="animal-card-footer">
          {/* Last seen */}
          <div className="animal-last-seen">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Last seen: {lastSeen}</span>
          </div>

          {/* Photo count */}
          <div className="animal-photo-count">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>{photoCount} sightings</span>
          </div>
        </div>
      </div>
    </article>
  )
}
