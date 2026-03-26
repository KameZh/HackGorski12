import { create } from 'zustand'

export const useMapStore = create((set) => ({
  // 'explore' | 'draw'
  mode: 'explore',

  // Trail object currently tapped — drives RoutePreviewCard
  selectedTrail: null,

  // Mapbox style token suffix
  mapStyle: 'outdoors-v12',

  // 3D terrain on/off
  terrain3D: false,

  // Actions
  setMode: (mode) => set({ mode }),
  setSelectedTrail: (trail) => set({ selectedTrail: trail }),
  setMapStyle: (style) => set({ mapStyle: style }),
  toggleTerrain: () => set((s) => ({ terrain3D: !s.terrain3D })),
  toggleMapStyle: () =>
    set((s) => ({
      mapStyle:
        s.mapStyle === 'outdoors-v12'
          ? 'satellite-streets-v12'
          : 'outdoors-v12',
    })),
}))
