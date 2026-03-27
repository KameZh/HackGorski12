import api from './client'

// POST /api/pings — create a new ping on a trail
export const createPing = (data) => {
  return api.post('/pings', data)
}

// GET /api/pings — fetch all pings (optionally filter by trailId)
export const fetchPings = (params = {}) => {
  return api.get('/pings', { params })
}

// POST /api/pings/:id/vote — vote that a ping is gone
export const votePingGone = (id) => {
  return api.post(`/pings/${id}/vote`)
}

// DELETE /api/pings/:id — delete a ping (owner only)
export const deletePing = (id) => {
  return api.delete(`/pings/${id}`)
}

// GET /api/clusters — fetch all active trash clusters/events
export const fetchClusters = () => {
  return api.get('/clusters')
}

// POST /api/clusters/:id/vote — vote that a cluster is cleared
export const voteClusterGone = (id) => {
  return api.post(`/clusters/${id}/vote`)
}
