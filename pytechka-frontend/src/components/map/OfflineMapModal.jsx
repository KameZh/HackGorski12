import React, { useState, useEffect } from 'react'
import { useOfflineStore } from '../../store/offlineStore'
import { fetchMapTrailsByArea } from '../../api/maps'
import { downloadMapTilesForTrail } from '../../utils/offlineMapTiles'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

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
        radiusKm: 100,
        proximityMode: 'start'
      }).then(res => {
         const fetchedTrails = res.data || []
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
    try {
      const trailsToSave = trailsList.filter((t) => selectedIds.has(String(t._id || t.id)))
      const trailsToRemove = trailsList.filter((t) => !selectedIds.has(String(t._id || t.id)))

      setSaveProgressText('Saving trail data...')
      await saveMultipleTrails(trailsToSave)
      await removeMultipleTrails(trailsToRemove.map((t) => String(t._id || t.id)))

      setSaveProgressText('Caching map tiles...')
      for (const trail of trailsToSave) {
        await downloadMapTilesForTrail(trail, MAPBOX_TOKEN)
      }

      onClose()
    } finally {
      setIsSaving(false)
      setSaveProgressText('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md transition-opacity">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden ring-1 ring-white/10">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div>
            <h2 className="text-2xl font-black text-slate-50 tracking-tight flex items-center gap-2">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Offline Trails
            </h2>
            <p className="text-sm text-slate-400 mt-1 font-medium">Download trails within 100km radius</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-2.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            disabled={isSaving}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controls Area */}
        <div className="px-5 py-3 bg-slate-800/40 flex items-center justify-between border-b border-slate-800/60">
          <span className="text-sm font-semibold text-slate-300">
            {loading ? 'Finding trails...' : `${trailsList.length} Trails found`}
          </span>
          <button
            onClick={handleToggleAll}
            disabled={loading || trailsList.length === 0 || isSaving}
            className="text-sm font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer disabled:opacity-50 transition-colors px-3 py-1.5 rounded-lg hover:bg-emerald-400/10 active:bg-emerald-400/20"
          >
            {selectedIds.size === trailsList.length && trailsList.length > 0
              ? 'Deselect All'
              : 'Select All'}
          </button>
        </div>

        {/* List Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 scrollbar-thin scrollbar-thumb-slate-700">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
              <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
              <p className="text-slate-400 font-medium">Scanning area for trails...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-3 text-center px-6">
              <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mb-2 border border-red-500/50">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-slate-300 font-medium text-lg">Failed to load trails</p>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : trailsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-3 text-center px-6">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-2">
                <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-300 font-medium text-lg">No trails found nearby</p>
              <p className="text-slate-500 text-sm">Move the map to another location and try again.</p>
            </div>
          ) : (
            <ul className="space-y-2">
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
                      className={`
                      relative flex items-center p-4 rounded-xl cursor-pointer transition-all duration-200 border
                      ${isSelected 
                        ? 'bg-slate-800/80 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
                        : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600'}
                    `}
                    >
                      <div className="flex-shrink-0 mr-4">
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 bg-slate-900/50'
                        }`}>
                          {isSelected && (
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggle(id)}
                          disabled={isSaving}
                          className="sr-only"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0 pr-4">
                        <p className={`text-sm font-bold truncate ${isSelected ? 'text-emerald-50' : 'text-slate-200'}`}>
                          {trail.name || trail.name_bg || 'Unnamed Trail'}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm font-medium text-slate-400 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            {distanceKm} km
                          </span>
                          
                          {trail.difficulty && (
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 before:content-['•'] before:mr-1 before:text-slate-600">
                              {trail.difficulty}
                            </span>
                          )}
                        </div>
                      </div>

                      {isDownloaded && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                           <span className="flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-md text-[10px] font-black tracking-widest shadow-sm">
                             SAVED
                           </span>
                        </div>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/80 backdrop-blur-sm">
          <button
            onClick={handleDownload}
            disabled={loading || isSaving}
            className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 flex items-center justify-center gap-3
              ${isSaving 
                ? 'bg-emerald-600/50 text-white cursor-not-allowed' 
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 active:translate-y-0'}
            `}
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                {saveProgressText || 'Saving Trails...'}
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Sync {selectedIds.size} {selectedIds.size === 1 ? 'Trail' : 'Trails'} to Device
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default OfflineMapModal
