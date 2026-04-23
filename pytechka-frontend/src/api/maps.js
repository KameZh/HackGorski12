import api from './client'

export const fetchMapTrails = (params = {}) => {
  return api.get('/trails', { params })
}

export const fetchMapTrailsGeojson = () => {
  return api.get('/trails/geojson')
}

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

export const fetchTrailStartReadiness = (trailId, params = {}) => {
  return api.get(`/trails/${trailId}/start-readiness`, { params })
}

export const completeTrailFromMap = (trailId, payload = {}) => {
  return api.post(`/trails/${trailId}/complete`, payload)
}

export const fetchHuts = () => {
  return api.get('/huts')
}
