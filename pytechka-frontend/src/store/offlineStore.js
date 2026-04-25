import { create } from 'zustand'
import localforage from 'localforage'

// Create a localforage instance for offline trails
const trailsStore = localforage.createInstance({
  name: 'PytechkaOffline',
  storeName: 'trails',
  description: 'Stores trail data for offline usage',
})

const draftsStore = localforage.createInstance({
  name: 'PytechkaOffline',
  storeName: 'recorded_trail_drafts',
  description: 'Stores recorded trails before publishing',
})

export const useOfflineStore = create((set, get) => ({
  offlineTrails: [],
  draftTrails: [],
  isLoaded: false,
  draftsLoaded: false,

  // Load all trails from local storage into memory
  loadOfflineTrails: async () => {
    try {
      const trails = []
      await trailsStore.iterate((value) => {
        trails.push(value)
      })
      set({ offlineTrails: trails, isLoaded: true })
    } catch (err) {
      console.error('Failed to load offline trails', err)
      set({ isLoaded: true }) // Set loaded even on fail to stop loading spinners
    }
  },

  loadDraftTrails: async () => {
    try {
      const drafts = []
      await draftsStore.iterate((value) => {
        drafts.push(value)
      })
      drafts.sort(
        (a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0)
      )
      set({ draftTrails: drafts, draftsLoaded: true })
    } catch (err) {
      console.error('Failed to load local trail drafts', err)
      set({ draftsLoaded: true })
    }
  },

  saveDraftTrail: async (draft) => {
    try {
      const id =
        draft?.localId ||
        `local-trail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const next = {
        ...draft,
        localId: id,
        source: 'local_draft',
        savedAt: draft?.savedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await draftsStore.setItem(id, next)
      set((state) => {
        const existing = state.draftTrails.filter(
          (trail) => trail.localId !== id
        )
        return { draftTrails: [next, ...existing] }
      })
      return next
    } catch (err) {
      console.error('Failed to save local trail draft', err)
      throw err
    }
  },

  updateDraftTrail: async (id, updates) => {
    const current = await draftsStore.getItem(id)
    if (!current) throw new Error('Local trail draft not found')
    return get().saveDraftTrail({
      ...current,
      ...updates,
      localId: id,
      savedAt: current.savedAt,
    })
  },

  removeDraftTrail: async (id) => {
    try {
      if (!id) return
      await draftsStore.removeItem(id)
      set((state) => ({
        draftTrails: state.draftTrails.filter((trail) => trail.localId !== id),
      }))
    } catch (err) {
      console.error('Failed to remove local trail draft', err)
      throw err
    }
  },

  // Save a single trail offline
  saveTrail: async (trail) => {
    try {
      const id = trail._id || trail.id
      if (!id) return

      await trailsStore.setItem(id, trail)
      set((state) => {
        const existing = state.offlineTrails.filter(
          (t) => (t._id || t.id) !== id
        )
        return { offlineTrails: [...existing, trail] }
      })
    } catch (err) {
      console.error('Failed to save trail', err)
    }
  },

  // Remove a single trail from offline storage
  removeTrail: async (trailId) => {
    try {
      if (!trailId) return
      await trailsStore.removeItem(trailId)
      set((state) => ({
        offlineTrails: state.offlineTrails.filter(
          (t) => (t._id || t.id) !== trailId
        ),
      }))
    } catch (err) {
      console.error('Failed to remove trail', err)
    }
  },

  // Save multiple trails
  saveMultipleTrails: async (trails) => {
    try {
      for (const trail of trails) {
        const id = trail._id || trail.id
        if (id) {
          await trailsStore.setItem(id, trail)
        }
      }
      await get().loadOfflineTrails()
    } catch (err) {
      console.error('Failed to save multiple trails', err)
    }
  },

  // Remove multiple trails
  removeMultipleTrails: async (trailIds) => {
    try {
      for (const id of trailIds) {
        if (id) {
          await trailsStore.removeItem(id)
        }
      }
      await get().loadOfflineTrails()
    } catch (err) {
      console.error('Failed to remove multiple trails', err)
    }
  },

  // Clear all offline trails
  clearAll: async () => {
    try {
      await trailsStore.clear()
      set({ offlineTrails: [] })
    } catch (err) {
      console.error('Failed to clear offline trails', err)
    }
  },
}))
