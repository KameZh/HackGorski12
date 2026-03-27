import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { fetchTrailById, addTrailReview } from '../../api/trails'
import './TrailDetailPopup.css'

const DIFFICULTY_MAP = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  extreme: 'Extreme',
}

function StarRating({ value, onChange, readonly }) {
  const [hover, setHover] = useState(0)

  return (
    <div className="tdp-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`tdp-star ${star <= (hover || value) ? 'tdp-star-filled' : ''}`}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          disabled={readonly}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={star <= (hover || value) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  )
}

export default function TrailDetailPopup({ trailId, onClose }) {
  const { isSignedIn } = useAuth()
  const [trail, setTrail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState(false)

  useEffect(() => {
    if (!trailId) return
    setLoading(true)
    fetchTrailById(trailId)
      .then((res) => setTrail(res.data))
      .catch(() => setTrail(null))
      .finally(() => setLoading(false))
  }, [trailId])

  const handleReviewSubmit = async () => {
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError('Please select a rating (1-5 stars)')
      return
    }
    setSubmitting(true)
    setReviewError('')
    try {
      const res = await addTrailReview(trailId, {
        accuracy: reviewRating,
        comment: reviewComment.trim(),
      })
      setTrail(res.data)
      setReviewSuccess(true)
      setReviewRating(0)
      setReviewComment('')
    } catch (err) {
      setReviewError(err.response?.data?.error || 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  if (!trailId) return null

  return (
    <div className="tdp-overlay" onClick={onClose}>
      <div className="tdp-panel" onClick={(e) => e.stopPropagation()}>
        <button className="tdp-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {loading ? (
          <div className="tdp-loading">Loading trail details...</div>
        ) : !trail ? (
          <div className="tdp-loading">Trail not found.</div>
        ) : (
          <div className="tdp-content">
            <h2 className="tdp-name">{trail.name}</h2>

            <div className="tdp-badges">
              <span className={`tdp-difficulty tdp-difficulty-${trail.difficulty}`}>
                {DIFFICULTY_MAP[trail.difficulty] || trail.difficulty}
              </span>
              {trail.region && <span className="tdp-region">{trail.region}</span>}
            </div>

            {trail.description && (
              <p className="tdp-description">{trail.description}</p>
            )}

            <div className="tdp-stats">
              <div className="tdp-stat">
                <span className="tdp-stat-label">Distance</span>
                <span className="tdp-stat-value">
                  {trail.stats?.distance ? (trail.stats.distance / 1000).toFixed(1) + ' km' : '—'}
                </span>
              </div>
              <div className="tdp-stat">
                <span className="tdp-stat-label">Elevation</span>
                <span className="tdp-stat-value">
                  {trail.stats?.elevationGain ? trail.stats.elevationGain + ' m' : '—'}
                </span>
              </div>
              <div className="tdp-stat">
                <span className="tdp-stat-label">Duration</span>
                <span className="tdp-stat-value">
                  {trail.stats?.duration ? Math.round(trail.stats.duration / 60) + ' min' : '—'}
                </span>
              </div>
            </div>

            {(trail.startPoint || trail.endPoint || trail.highestPoint) && (
              <div className="tdp-stats">
                {trail.startPoint && (
                  <div className="tdp-stat">
                    <span className="tdp-stat-label">Start</span>
                    <span className="tdp-stat-value">{trail.startPoint}</span>
                  </div>
                )}
                {trail.endPoint && (
                  <div className="tdp-stat">
                    <span className="tdp-stat-label">End</span>
                    <span className="tdp-stat-value">{trail.endPoint}</span>
                  </div>
                )}
                {trail.highestPoint && (
                  <div className="tdp-stat">
                    <span className="tdp-stat-label">Highest</span>
                    <span className="tdp-stat-value">{trail.highestPoint}</span>
                  </div>
                )}
              </div>
            )}

            {trail.equipment && (
              <div className="tdp-detail">
                <span className="tdp-detail-label">Equipment</span>
                <p className="tdp-detail-text">{trail.equipment}</p>
              </div>
            )}

            {trail.resources && (
              <div className="tdp-detail">
                <span className="tdp-detail-label">Resources</span>
                <p className="tdp-detail-text">{trail.resources}</p>
              </div>
            )}

            <div className="tdp-detail">
              <span className="tdp-detail-label">Author</span>
              <p className="tdp-detail-text">{trail.username || 'Unknown'}</p>
            </div>

            {/* Average rating */}
            <div className="tdp-avg-rating">
              <StarRating value={Math.round(trail.averageAccuracy || 0)} readonly />
              <span className="tdp-avg-label">
                {trail.averageAccuracy ? trail.averageAccuracy.toFixed(1) : '—'} / 5
                ({trail.reviews?.length || 0} reviews)
              </span>
            </div>

            {/* Existing reviews */}
            {trail.reviews?.length > 0 && (
              <div className="tdp-reviews-list">
                <span className="tdp-detail-label">Reviews</span>
                {trail.reviews.map((r, i) => (
                  <div key={i} className="tdp-review-item">
                    <div className="tdp-review-header">
                      <span className="tdp-review-author">{r.username}</span>
                      <StarRating value={r.accuracy} readonly />
                    </div>
                    {r.comment && <p className="tdp-review-comment">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Submit review */}
            {isSignedIn && !reviewSuccess ? (
              <div className="tdp-review-form">
                <span className="tdp-detail-label">Leave a Review</span>
                <StarRating value={reviewRating} onChange={setReviewRating} />
                <textarea
                  className="tdp-review-input"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Write your review (optional)..."
                  rows={3}
                  maxLength={500}
                />
                {reviewError && <p className="tdp-review-error">{reviewError}</p>}
                <button
                  className="tdp-review-submit"
                  onClick={handleReviewSubmit}
                  disabled={submitting || reviewRating < 1}
                >
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            ) : reviewSuccess ? (
              <p className="tdp-review-success">Thank you for your review!</p>
            ) : (
              <p className="tdp-login-hint">Sign in to leave a review</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
