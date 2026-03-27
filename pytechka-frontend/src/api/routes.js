import api from './client'

// POST /api/routes — upload a route for AI analysis
export const uploadRoute = (geojson, name) => {
  return api.post('/routes', { geojson, name })
}

// GET /api/routes — list current user's routes
export const fetchRoutes = () => {
  return api.get('/routes')
}

// GET /api/routes/:id — get single route (used for polling AI status)
export const fetchRouteById = (id) => {
  return api.get(`/routes/${id}`)
}

// DELETE /api/routes/:id
export const deleteRoute = (id) => {
  return api.delete(`/routes/${id}`)
}
