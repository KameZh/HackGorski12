import api from './client'

// POST /api/pings — create a new ping on a trail
export const createPing = (data) => {
  return api.post('/pings', data)
}

// GET /api/pings — fetch all pings (optionally filter by trailId)
export const fetchPings = (params = {}) => {
  return api.get('/pings', { params })
}

// DELETE /api/pings/:id — delete a ping (owner only)
export const deletePing = (id) => {
  return api.delete(`/pings/${id}`)
}
