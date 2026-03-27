import { useState } from 'react'
import { publishTrail } from '../../api/trails'
import './RouteBuilderForm.css'

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'hard', label: 'Hard' },
  { value: 'extreme', label: 'Extreme' },
]

export default function RouteBuilderForm({ geojson, onSuccess, onCancel }) {
  const [name, setName] = useState('')
  const [region, setRegion] = useState('')
  const [difficulty, setDifficulty] = useState('moderate')
  const [description, setDescription] = useState('')
  const [equipment, setEquipment] = useState('')
  const [resources, setResources] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Trail name is required')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await publishTrail({
        geojson,
        name: name.trim(),
        region: region.trim(),
        difficulty,
        description: description.trim(),
        equipment: equipment.trim(),
        resources: resources.trim(),
      })
      onSuccess?.(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to publish trail. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rbf-overlay" onClick={onCancel}>
      <div className="rbf-panel" onClick={(e) => e.stopPropagation()}>
        <div className="rbf-header">
          <h2 className="rbf-title">Publish Trail</h2>
          <button className="rbf-close-btn" onClick={onCancel} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className="rbf-form" onSubmit={handleSubmit}>
          <label className="rbf-field">
            <span className="rbf-label">Trail Name *</span>
            <input
              className="rbf-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Musala Peak Trail"
              maxLength={120}
            />
          </label>

          <label className="rbf-field">
            <span className="rbf-label">Region</span>
            <input
              className="rbf-input"
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Rila, Pirin, Rhodopes"
              maxLength={100}
            />
          </label>

          <label className="rbf-field">
            <span className="rbf-label">Difficulty</span>
            <select
              className="rbf-select"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              {DIFFICULTY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="rbf-field">
            <span className="rbf-label">Description</span>
            <textarea
              className="rbf-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the trail, notable landmarks, scenery..."
              rows={3}
              maxLength={2000}
            />
          </label>

          <label className="rbf-field">
            <span className="rbf-label">Equipment</span>
            <textarea
              className="rbf-textarea"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="Recommended gear: hiking boots, poles, rain jacket..."
              rows={2}
              maxLength={1000}
            />
          </label>

          <label className="rbf-field">
            <span className="rbf-label">Resources</span>
            <textarea
              className="rbf-textarea"
              value={resources}
              onChange={(e) => setResources(e.target.value)}
              placeholder="Water sources, huts, shelters, phone signal..."
              rows={2}
              maxLength={1000}
            />
          </label>

          {error && <p className="rbf-error">{error}</p>}

          <div className="rbf-actions">
            <button
              type="button"
              className="rbf-btn rbf-btn-cancel"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rbf-btn rbf-btn-publish"
              disabled={submitting}
            >
              {submitting ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
