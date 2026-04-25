import { useState, useEffect } from 'react'
import './PhotoCaptureModal.css'

export default function PhotoCaptureModal({
  photo,
  isOpen,
  onClose,
  onSubmit,
}) {
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setDescription('')
      setLocation(null)
      setLocationError(null)
      getCurrentLocation()
    }
  }, [isOpen])

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        console.error('Geolocation error:', error)
        setLocationError('Unable to get your current location')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  const handleSubmit = async () => {
    if (!location) {
      setLocationError('Location is required to submit a photo')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        photoPath: photo.path,
        webPath: photo.webPath,
        description: description.trim(),
        coordinates: [location.longitude, location.latitude],
      })
      onClose()
    } catch (error) {
      console.error('Submit error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="photo-capture-modal-overlay" onClick={onClose}>
      <div
        className="photo-capture-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="photo-capture-modal-header">
          <h3>Add Photo Description</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="photo-preview-container">
          {photo?.webPath ? (
            <img
              src={photo.webPath}
              alt="Captured photo"
              className="photo-preview"
            />
          ) : (
            <div className="photo-placeholder">No photo available</div>
          )}
        </div>

        <div className="photo-form-group">
          <label htmlFor="photo-description">
            Description (e.g., "Aleko Konstantinov Hut")
          </label>
          <input
            id="photo-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter a short description..."
            maxLength={200}
          />
        </div>

        <div className="location-info">
          {location ? (
            <div className="location-success">
              <span className="location-icon">📍</span>
              <span>
                Location: {location.latitude.toFixed(6)},{' '}
                {location.longitude.toFixed(6)}
              </span>
            </div>
          ) : locationError ? (
            <div className="location-error">
              <span className="location-icon">⚠️</span>
              <span>{locationError}</span>
            </div>
          ) : (
            <div className="location-loading">
              <span className="loading-spinner"></span>
              <span>Getting your location...</span>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            className="cancel-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={isSubmitting || !location}
          >
            {isSubmitting ? 'Submitting...' : 'Add to Map'}
          </button>
        </div>
      </div>
    </div>
  )
}