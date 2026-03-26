import api from './client'

export const fetchAnimals = (params = {}) => {
  return api.get('/animals', { params })
}

export const fetchAnimalById = (id) => {
  return api.get(`/animals/${id}`)
}
