import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import './Auth.css'

export default function Home() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const [showConfirm, setShowConfirm] = useState(false)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    setShowConfirm(false)
    navigate('/login')
  }

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Welcome to Pytechka</h2>
        {isAuthenticated ? (
          <>
            <p>Logged in as <strong>{user.email}</strong></p>
            <button onClick={() => setShowConfirm(true)}>Log Out</button>

            {showConfirm && (
              <div className="confirm-overlay">
                <div className="confirm-dialog">
                  <p>Are you sure you want to log out?</p>
                  <div className="confirm-buttons">
                    <button className="confirm-yes" onClick={handleLogout}>Yes, log out</button>
                    <button className="confirm-no" onClick={() => setShowConfirm(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p>Please sign up or log in to continue.</p>
            <Link to="/signup"><button>Sign Up</button></Link>
            <Link to="/login"><button>Log In</button></Link>
          </>
        )}
      </div>
    </div>
  )
}
