import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser, useClerk, UserButton } from '@clerk/clerk-react'
import BottomNav from '../components/layout/Bottomnav'
import './Account.css'

export default function Home() {
  const { isSignedIn, user } = useUser()
  const { signOut } = useClerk()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    setShowLogoutConfirm(false)
    navigate('/login')
  }

  const handleDeleteAccount = async () => {
    try {
      await user.delete()
      setShowDeleteConfirm(false)
      navigate('/signup')
    } catch {
      setShowDeleteConfirm(false)
    }
  }

  if (!isSignedIn) {
    return (
      <div className="account-page">
        <div className="account-login-prompt">
          <h2>Welcome to Pytechka</h2>
          <p>Please sign up or log in to continue.</p>
          <Link to="/signup"><button className="account-btn">Sign Up</button></Link>
          <Link to="/login"><button className="account-btn">Log In</button></Link>
        </div>
        <BottomNav />
      </div>
    )
  }

  const displayName = user.username || user.firstName
  const email = user.primaryEmailAddress?.emailAddress || ''

  return (
    <div className="account-page">
      <div className="account-scroll">
        {/* Profile header */}
        <div className="account-profile">
          <div className="account-avatar">
            <UserButton afterSignOutUrl="/login" />
          </div>
          <div className="account-info">
            <h2 className="account-name">{displayName}</h2>
            <p className="account-email">{email}</p>
          </div>
        </div>

        {/* Today stats placeholder */}
        <div className="account-section">
          <h3 className="account-section-title">Today</h3>
          <div className="account-stats-row">
            <div className="account-stat">
              <span className="stat-icon stat-steps">👣</span>
              <span className="stat-value">—</span>
            </div>
            <div className="account-stat">
              <span className="stat-icon stat-time">⏱</span>
              <span className="stat-value">—</span>
            </div>
            <div className="account-stat">
              <span className="stat-icon stat-cal">🔥</span>
              <span className="stat-value">—</span>
            </div>
            <div className="account-stat">
              <span className="stat-icon stat-dist">📍</span>
              <span className="stat-value">—</span>
            </div>
          </div>
        </div>

        {/* Yesterday stats placeholder */}
        <div className="account-section">
          <h3 className="account-section-title">Yesterday</h3>
          <div className="account-stats-row">
            <div className="account-stat">
              <span className="stat-icon stat-steps">👣</span>
              <span className="stat-value">—</span>
            </div>
            <div className="account-stat">
              <span className="stat-icon stat-time">⏱</span>
              <span className="stat-value">—</span>
            </div>
            <div className="account-stat">
              <span className="stat-icon stat-cal">🔥</span>
              <span className="stat-value">—</span>
            </div>
            <div className="account-stat">
              <span className="stat-icon stat-dist">📍</span>
              <span className="stat-value">—</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="account-actions">
          <button className="account-btn-settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </button>

          <button className="account-btn-signout" onClick={() => setShowLogoutConfirm(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>

          <button className="account-btn-delete" onClick={() => setShowDeleteConfirm(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            Delete account
          </button>
        </div>
      </div>

      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <div className="confirm-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Are you sure you want to sign out?</p>
            <div className="confirm-buttons">
              <button className="confirm-yes" onClick={handleLogout}>Yes, sign out</button>
              <button className="confirm-no" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="confirm-dialog confirm-dialog-danger" onClick={(e) => e.stopPropagation()}>
            <p>Are you sure you want to delete your account? This action cannot be undone.</p>
            <div className="confirm-buttons">
              <button className="confirm-danger" onClick={handleDeleteAccount}>Delete account</button>
              <button className="confirm-no" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
