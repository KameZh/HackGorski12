import api from './client'

// GET /api/trails?activity=&difficulty=&region=&sort=&search=
export const fetchTrails = (params = {}) => {
  return api.get('/trails', { params })
}

// GET /api/trails/:id
export const fetchTrailById = (id) => {
  return api.get(`/trails/${id}`)
}

// POST /api/trails — publish a new trail
export const publishTrail = (data) => {
  return api.post('/trails', data)
}

// PUT /api/trails/:id — update trail (owner only)
export const updateTrail = (id, data) => {
  return api.put(`/trails/${id}`, data)
}

// DELETE /api/trails/:id — delete trail (owner only)
export const deleteTrail = (id) => {
  return api.delete(`/trails/${id}`)
}

// POST /api/trails/:id/reviews — add a review
export const addTrailReview = (id, review) => {
  return api.post(`/trails/${id}/reviews`, review)
}

// GET /api/trails/:id/reviews — get reviews
export const fetchTrailReviews = (id) => {
  return api.get(`/trails/${id}/reviews`)
}
