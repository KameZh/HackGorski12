import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

let clerkTokenGetter = null

export function setClerkTokenGetter(fn) {
  clerkTokenGetter = fn
}

api.interceptors.request.use(async (config) => {
  if (clerkTokenGetter) {
    try {
      const token = await clerkTokenGetter()
      if (token) config.headers.Authorization = `Bearer ${token}`
    } catch {
    }
  }
  return config
})

export default api
