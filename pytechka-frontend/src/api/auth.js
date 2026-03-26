import api from './client'

// With Clerk handling authentication, these functions interact with the backend
// using the automatically-attached Clerk token from the axios interceptor.

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
