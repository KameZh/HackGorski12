import api from './client'

export const createPing = (data) => {
  return api.post('/pings', data)
}

export const createPhotoPing = (data) => {
  return api.post('/pings', {
    ...data,
    type: 'photo',
  })
}

export const fetchPings = (params = {}) => {
  return api.get('/pings', { params })
}

export const votePingGone = (id) => {
  return api.post(`/pings/${id}/vote`)
}

export const deletePing = (id) => {
  return api.delete(`/pings/${id}`)
}

export const fetchClusters = () => {
  return api.get('/clusters')
}

export const voteClusterGone = (id) => {
  return api.post(`/clusters/${id}/vote`)
}
