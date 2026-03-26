import api from './client'

// GET /api/eco/stats
export const fetchEcoStats = () => {
  return api.get('/eco/stats')
}
