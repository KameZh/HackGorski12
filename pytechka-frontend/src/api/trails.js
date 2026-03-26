import api from './client'

// GET /api/trails?activity=&difficulty=&region=&sort=&search=
export const fetchTrails = (params = {}) => {
  return api.get('/trails', { params })
}

// GET /api/trails/:id
export const fetchTrailById = (id) => {
  return api.get(`/trails/${id}`)
}
