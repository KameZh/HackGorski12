import api from './client'

export async function getUserProfile() {
  const { data } = await api.get('/user/profile')
  return data
}

export async function updateUserProfile(updates) {
  const { data } = await api.put('/user/profile', updates)
  return data
}

export async function deleteAccount() {
  const { data } = await api.delete('/user/profile')
  return data
}
