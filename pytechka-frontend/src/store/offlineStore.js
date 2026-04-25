import { create } from 'zustand'
import localforage from 'localforage'

// Create a localforage instance for offline trails
const trailsStore = localforage.createInstance({
  name: 'PytechkaOffline',
  storeName: 'trails',
  description: 'Stores trail data for offline usage',
})

export const useOfflineStore = create((set, get) => ({
  offlineTrails: [],
  isLoaded: false,

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
