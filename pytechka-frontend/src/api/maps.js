import api from './client'

// GET /api/trails — same endpoint as Explore, can filter by activity/difficulty/region
export const fetchMapTrails = (params = {}) => {
  return api.get('/trails', { params })
}
