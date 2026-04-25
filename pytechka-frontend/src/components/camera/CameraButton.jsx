import { Camera } from '@capacitor/camera'
import { useState } from 'react'
import './CameraButton.css'

export default function CameraButton({ onPhotoCapture, className = '' }) {
  const [isCapturing, setIsCapturing] = useState(false)

  const handleCapture = async () => {
    if (isCapturing) return

    setIsCapturing(true)
    try {
      const result = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        saveToGallery: false,
      })

      if (result && result.path) {
        onPhotoCapture?.(result)
      }
    } catch (error) {
      console.error('Camera capture error:', error)
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <button
      className={`camera-button ${className} ${isCapturing ? 'capturing' : ''}`}
      onClick={handleCapture}
      disabled={isCapturing}
      aria-label="Take photo"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    </button>
  )
}