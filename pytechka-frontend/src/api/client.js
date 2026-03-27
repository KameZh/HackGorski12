import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

// Clerk stores its session token accessible via this global.
// The interceptor attaches it as a Bearer token to every request.
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
      // Not signed in — send request without auth header
    }
  }
  return config
})

export default api
