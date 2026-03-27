import api from './client'

// GET /api/trails — same endpoint as Explore, can filter by activity/difficulty/region
export const fetchMapTrails = (params = {}) => {
  return api.get('/trails', { params })
}

// GET /api/trails with area/startpoint filtering
export const fetchMapTrailsByArea = ({
  search = '',
  center = null,
  radiusKm = 8,
  proximityMode = 'start',
} = {}) => {
  const params = {
    ...(search ? { search } : {}),
    ...(Array.isArray(center) && center.length === 2
      ? {
          centerLng: center[0],
          centerLat: center[1],
          radiusKm,
          proximityMode,
        }
      : {}),
  }

  return api.get('/trails', { params })
}

// GET /api/trails/:id/start-readiness
export const fetchTrailStartReadiness = (trailId, params = {}) => {
  return api.get(`/trails/${trailId}/start-readiness`, { params })
}

// POST /api/trails/:id/complete
export const completeTrailFromMap = (trailId, payload = {}) => {
  return api.post(`/trails/${trailId}/complete`, payload)
}
