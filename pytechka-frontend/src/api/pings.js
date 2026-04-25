import api from './client'

export const createPing = (data) => {
  return api.post('/pings', data)
}

export const createPhotoPing = (data) => {
  return api.post('/photo-pings', {
    type: 'photo',
    ...(data.trailId ? { trailId: data.trailId } : {}),
    description: data.description || '',
    photoUrl: data.photoUrl,
    photoCategory: data.photoCategory || 'memory',
    coordinates: data.coordinates,
  })
}

export const fetchPings = async (params = {}) => {
  const [pingsResult, photosResult] = await Promise.allSettled([
    api.get('/pings', { params }),
    api.get('/photo-pings', { params }),
  ])

  const pings =
    pingsResult.status === 'fulfilled' && Array.isArray(pingsResult.value.data)
      ? pingsResult.value.data
      : []
  const photoPings =
    photosResult.status === 'fulfilled' && Array.isArray(photosResult.value.data)
      ? photosResult.value.data
      : []

  return {
    data: [...photoPings, ...pings].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    ),
    status: pingsResult.value?.status || photosResult.value?.status || 200,
  }
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
