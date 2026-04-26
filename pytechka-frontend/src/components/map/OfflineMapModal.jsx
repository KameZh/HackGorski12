import React, { useState, useEffect } from 'react'
import { useOfflineStore } from '../../store/offlineStore'
import { fetchMapTrailsByArea } from '../../api/maps'
import { downloadMapTilesForTrail } from '../../utils/offlineMapTiles'
import './OfflineMapModal.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

function normalizeOfflineTrail(trail) {
  if (!trail || typeof trail !== 'object') return trail
  return {
    ...trail,
    geojson: trail.geojson || trail.geom || trail.mapGeometry || null,
  }
}

const OfflineMapModal = ({ isOpen, onClose, mapCenter }) => {
  const { offlineTrails, saveMultipleTrails, removeMultipleTrails } = useOfflineStore()
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [trailsList, setTrailsList] = useState([])
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveProgressText, setSaveProgressText] = useState('')

  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && mapCenter) {
      setLoading(true)
      setError(null)
      const lng = mapCenter.longitude ?? mapCenter.lng ?? 25.4858
      const lat = mapCenter.latitude ?? mapCenter.lat ?? 42.7339
      
      fetchMapTrailsByArea({
        center: [lng, lat],
        radiusKm: 40,
        proximityMode: 'start'
      }).then(res => {
         const fetchedTrails = Array.isArray(res.data)
           ? res.data.map(normalizeOfflineTrail)
           : []
         setTrailsList(fetchedTrails)
         
         const downloadedIds = new Set(offlineTrails.map((t) => String(t._id || t.id)))
         const initialSelected = new Set()
         fetchedTrails.forEach((t) => {
           const id = String(t._id || t.id)
           if (downloadedIds.has(id)) {
             initialSelected.add(id)
           }
         })
         setSelectedIds(initialSelected)
      }).catch(err => {
         setError(err?.response?.data?.error || err.message || String(err))
         setTrailsList([])
      }).finally(() => {
         setLoading(false)
      })
    }
  }, [isOpen, mapCenter, offlineTrails])

  const handleToggle = (id) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleToggleAll = () => {
    if (selectedIds.size === trailsList.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(trailsList.map((t) => String(t._id || t.id))))
    }
  }

  const handleDownload = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const trailsToSave = trailsList
        .filter((t) => selectedIds.has(String(t._id || t.id)))
        .map(normalizeOfflineTrail)
      const trailsToRemove = trailsList.filter((t) => !selectedIds.has(String(t._id || t.id)))

      setSaveProgressText('Saving trail data...')
      await saveMultipleTrails(trailsToSave)
      await removeMultipleTrails(trailsToRemove.map((t) => String(t._id || t.id)))

      setSaveProgressText('Caching map tiles...')
      for (const trail of trailsToSave) {
        await downloadMapTilesForTrail(trail, MAPBOX_TOKEN)
      }

      onClose()
    } catch (err) {
      setError(err?.message || 'Could not save offline trails.')
    } finally {
      setIsSaving(false)
      setSaveProgressText('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="offline-modal-backdrop">
      <div className="offline-modal">
        <div className="offline-modal-head">
          <div>
            <h2 className="offline-modal-title">Offline Trails</h2>
            <p className="offline-modal-subtitle">
              Save nearby trail data and cache Mapbox tiles around selected
              routes for low-connectivity hikes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="offline-modal-close"
            disabled={isSaving}
            aria-label="Close offline download"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="offline-modal-toolbar">
          <span className="offline-modal-count">
            {loading
              ? 'Finding trails...'
              : `${trailsList.length} trail${trailsList.length === 1 ? '' : 's'} found`}
          </span>
          <button
            onClick={handleToggleAll}
            disabled={loading || trailsList.length === 0 || isSaving}
            className="offline-modal-link"
          >
            {selectedIds.size === trailsList.length && trailsList.length > 0
              ? 'Clear selection'
              : 'Select all'}
          </button>
        </div>

        <div className="offline-modal-body">
          {loading ? (
            <div className="offline-modal-state">
              <div>
                <div className="offline-spinner" />
                Scanning the current map area...
              </div>
            </div>
          ) : error ? (
            <div className="offline-modal-state">
              <div>
                <strong>Could not load nearby trails.</strong>
                <br />
                {error}
              </div>
            </div>
          ) : trailsList.length === 0 ? (
            <div className="offline-modal-state">
              Move the map closer to a trail area and try again.
            </div>
          ) : (
            <ul className="offline-trail-list">
              {trailsList.map((trail) => {
                const id = String(trail._id || trail.id)
                const isSelected = selectedIds.has(id)
                const isDownloaded = offlineTrails.some(
                  (t) => String(t._id || t.id) === id
                )
                const distanceKm = trail.stats?.distance
                  ? (trail.stats.distance / 1000).toFixed(1)
                  : trail.distance
                  ? Number(trail.distance).toFixed(1)
                  : 0

                return (
                  <li key={id}>
                    <label
                      className={`offline-trail-row ${isSelected ? 'is-selected' : ''}`}
                    >
                      <div className="offline-check" aria-hidden="true">
                        {isSelected ? <span /> : null}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggle(id)}
                          disabled={isSaving}
                          className="sr-only"
                        />
                      </div>
                      
                      <div>
                        <div className="offline-trail-title">
                          {trail.name || trail.name_bg || 'Unnamed Trail'}
                        </div>
                        <div className="offline-trail-meta">
                          {distanceKm} km · {trail.difficulty || 'moderate'}
                        </div>
                      </div>

                      {isDownloaded && (
                        <span className="offline-saved">SAVED</span>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="offline-modal-footer">
          <button
            onClick={handleDownload}
            disabled={loading || isSaving}
            className="offline-primary"
          >
            {isSaving
              ? saveProgressText || 'Saving trails...'
              : `Save ${selectedIds.size} ${
                  selectedIds.size === 1 ? 'trail' : 'trails'
                } to device`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default OfflineMapModal
