import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useClerk, useUser } from '@clerk/clerk-react'
import api from '../api/client'
import { fetchMyTrails, updateTrail, deleteTrail } from '../api/trails'
import BottomNav from '../components/layout/Bottomnav'
import './Account.css'

const BADGE_TIERS = {
  trailers: [
    { min: 20, name: 'Senior', color: '#48a9a6' },
    { min: 10, name: 'Junior', color: '#74aed0' },
    { min: 3, name: 'Rookie', color: '#82c0de' },
  ],
  contribution: [
    { min: 20, name: 'Country guide', color: '#48a9a6' },
    { min: 10, name: 'Local guide', color: '#74aed0' },
    { min: 3, name: 'New guide', color: '#82c0de' },
  ],
  campaign: [
    { min: 20, name: 'Basically organizer', color: '#48a9a6' },
    { min: 10, name: 'Helper', color: '#74aed0' },
    { min: 3, name: 'Volunteer', color: '#82c0de' },
  ],
}

function pickTier(category, value = 0) {
  const tiers = BADGE_TIERS[category] || []
  const found = tiers.find((t) => value >= t.min)
  return found || null
}

function getNextGoal(category, value = 0) {
  const tiers = (BADGE_TIERS[category] || [])
    .map((tier) => Number(tier.min) || 0)
    .sort((a, b) => a - b)

  return tiers.find((goal) => value < goal) ?? null
}

export default function Home() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const { signOut, openUserProfile } = useClerk()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [dbUser, setDbUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [badgeProgress, setBadgeProgress] = useState(null)
  const [myTrails, setMyTrails] = useState([])
  const [editingTrail, setEditingTrail] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    api
      .get('/user/profile')
      .then((res) => {
        setDbUser(res.data)
        setBadgeProgress(res.data?.badgeProgress || null)
      })
      .catch((err) => console.error('Failed to fetch profile:', err))
      .finally(() => setLoading(false))
  }, [isSignedIn])

  useEffect(() => {
    if (!isSignedIn) return
    fetchMyTrails()
      .then((res) => setMyTrails(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMyTrails([]))
  }, [isSignedIn])

  const handleEditOpen = (trail) => {
    setEditingTrail(trail._id)
    setEditForm({
      name: trail.name || '',
      region: trail.region || '',
      difficulty: trail.difficulty || 'moderate',
      description: trail.description || '',
      equipment: trail.equipment || '',
      resources: trail.resources || '',

    })
  }

  const handleEditSave = async () => {
    if (!editingTrail) return
    setEditSaving(true)
    try {
      const res = await updateTrail(editingTrail, editForm)
      setMyTrails((prev) =>
        prev.map((t) => (t._id === editingTrail ? { ...t, ...res.data } : t))
      )
      setEditingTrail(null)
    } catch (err) {
      console.error('Failed to update trail:', err)
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteTrail = async (id) => {
    try {
      await deleteTrail(id)
      setMyTrails((prev) => prev.filter((t) => t._id !== id))
      if (editingTrail === id) setEditingTrail(null)
    } catch (err) {
      console.error('Failed to delete trail:', err)
    }
  }

  const handleLogout = async () => {
    await signOut()
    setShowLogoutConfirm(false)
    navigate('/login')
  }

  const handleDeleteAccount = async () => {
    try {
      await user?.delete()
      setShowDeleteConfirm(false)
      navigate('/signup')
    } catch {
      setShowDeleteConfirm(false)
    }
  }

  const handleOpenProfile = () => {
    if (openUserProfile) openUserProfile()
  }

  if (!isSignedIn || loading) {
    if (loading) return null
    return (
      <div className="account-page">
        <div className="account-login-prompt">
          <div className="account-guest-shell">
            <h2 className="explore-title">Welcome to Pytechka</h2>
            <p>
              Create an account to start your adventure or log into an existing
              one
            </p>
            <div className="account-guest-actions">
              <Link to="/signup" className="account-guest-link">
                <button className="account-btn account-btn-primary">
                  Sign Up
                </button>
              </Link>
              <Link to="/login" className="account-guest-link">
                <button className="account-btn account-btn-secondary">
                  Log In
                </button>
              </Link>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  const displayName = dbUser?.username || '—'
  const email = dbUser?.email || ''
  const avatarUrl =
    dbUser?.avatarUrl || dbUser?.photoUrl || dbUser?.imageUrl || user?.imageUrl
  const avatarInitial =
    (dbUser?.username ||
      user?.firstName ||
      user?.username ||
      '?')[0]?.toUpperCase?.() || '?'

  const totalDistance = myTrails.reduce(
    (sum, t) => sum + (t.stats?.distance || 0),
    0
  )
  const totalDuration = myTrails.reduce(
    (sum, t) => sum + (t.stats?.duration || 0),
    0
  )
  const totalSteps = Math.round(totalDistance / 0.762) // avg stride ~0.762m

  const formatDistance = (m) => {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
    return `${Math.round(m)} m`
  }

  const formatTime = (sec) => {
    if (!sec) return '0 min'
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m} min`
  }

  const badgeCards = [
    {
      key: 'trailers',
      title: 'Trailers',
      progress: badgeProgress?.trailCompletions || 0,
      tier: pickTier('trailers', badgeProgress?.trailCompletions || 0),
      nextGoal: getNextGoal('trailers', badgeProgress?.trailCompletions || 0),
    },
    {
      key: 'contribution',
      title: 'Contribution',
      progress: badgeProgress?.createdTrails || 0,
      tier: pickTier('contribution', badgeProgress?.createdTrails || 0),
      nextGoal: getNextGoal('contribution', badgeProgress?.createdTrails || 0),
    },
    {
      key: 'campaign',
      title: 'Campaign',
      progress: badgeProgress?.campaignPoints || 0,
      tier: pickTier('campaign', badgeProgress?.campaignPoints || 0),
      nextGoal: getNextGoal('campaign', badgeProgress?.campaignPoints || 0),
    },
  ]

  return (
    <div className="account-page">
      <div className="account-scroll">
        <div className="account-profile">
          <div className="account-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" />
            ) : (
              <span>{avatarInitial}</span>
            )}
          </div>
          <div className="account-info">
            <h2 className="account-name">{displayName}</h2>
            <p className="account-email">{email}</p>
          </div>
        </div>

        <div className="account-section account-badges-section">
          <h3 className="account-section-title">Badges</h3>
          <div className="account-badges-box">
            <div className="badge-grid">
              {badgeCards.map((card) => (
                <div key={card.key} className="badge-card">
                  {(() => {
                    const isOverMaxGoal = card.progress >= 20
                    const progressTarget = card.nextGoal || 20
                    const progressPercent = Math.max(
                      0,
                      Math.min(100, (card.progress / progressTarget) * 100)
                    )

                    return (
                      <>
                        <div className="badge-card-top">
                          <span className="badge-title">{card.title}</span>
                          {card.tier ? (
                            <span
                              className="badge-pill"
                              style={{ color: card.tier.color }}
                            >
                              {card.tier.name}
                            </span>
                          ) : (
                            <span className="badge-pill badge-pill-empty">
                              Earn it
                            </span>
                          )}
                        </div>
                        <div className="badge-progress">
                          <div className="badge-progress-head">
                            <span className="badge-count">{card.progress}</span>
                            <span className="badge-hint">
                              {card.nextGoal
                                ? `${Math.max(0, card.nextGoal - card.progress)} to next goal`
                                : 'Top goal reached'}
                            </span>
                          </div>

                          {!isOverMaxGoal ? (
                            <>
                              <div
                                className="badge-progress-track"
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={progressTarget}
                                aria-valuenow={Math.min(
                                  card.progress,
                                  progressTarget
                                )}
                                aria-label={`${card.title} progress`}
                              >
                                <span
                                  className="badge-progress-fill"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <div className="badge-progress-target">
                                Goal: {progressTarget}
                              </div>
                            </>
                          ) : null}
                        </div>
                      </>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="account-section">
          <h3 className="account-section-title">Overall Activity</h3>
          <div className="account-stats-row">
            <div className="account-stat">
              <span className="stat-icon stat-steps">Steps</span>
              <span className="stat-value">{totalSteps.toLocaleString()}</span>
            </div>
            <div className="account-stat">
              <span className="stat-icon stat-time">Time</span>
              <span className="stat-value">{formatTime(totalDuration)}</span>
            </div>
            <div className="account-stat">
              <span className="stat-icon stat-dist">Distance</span>
              <span className="stat-value">
                {formatDistance(totalDistance)}
              </span>
            </div>
          </div>
        </div>

        {myTrails.length > 0 && (
          <div className="account-section" style={{ marginTop: '1rem' }}>
            <h3 className="account-section-title">My Trails</h3>
            <div className="my-trails-list">
              {myTrails.map((trail) => (
                <div key={trail._id} className="my-trail-item">
                  {editingTrail === trail._id ? (
                    <div className="my-trail-edit-form">
                      <label className="rbf-label">Name</label>
                      <input
                        className="rbf-input"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                        placeholder="Trail name"
                      />
                      <label className="rbf-label">Region</label>
                      <input
                        className="rbf-input"
                        value={editForm.region}
                        onChange={(e) =>
                          setEditForm({ ...editForm, region: e.target.value })
                        }
                        placeholder="Region"
                      />
                      <label className="rbf-label">Difficulty</label>
                      <select
                        className="rbf-input"
                        value={editForm.difficulty}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            difficulty: e.target.value,
                          })
                        }
                      >
                        <option value="easy">Easy</option>
                        <option value="moderate">Moderate</option>
                        <option value="hard">Hard</option>
                        <option value="extreme">Extreme</option>
                      </select>
                      <label className="rbf-label">Description</label>
                      <textarea
                        className="rbf-input"
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="Description"
                        rows={2}
                      />
                      <label className="rbf-label">Equipment</label>
                      <input
                        className="rbf-input"
                        value={editForm.equipment}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            equipment: e.target.value,
                          })
                        }
                        placeholder="Equipment"
                      />
                      <label className="rbf-label">Resources</label>
                      <input
                        className="rbf-input"
                        value={editForm.resources}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            resources: e.target.value,
                          })
                        }
                        placeholder="Resources"
                      />
                      <div className="my-trail-edit-actions">
                        <button
                          className="my-trail-save-btn"
                          onClick={handleEditSave}
                          disabled={editSaving}
                        >
                          {editSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          className="my-trail-cancel-btn"
                          onClick={() => setEditingTrail(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="my-trail-info">
                        <span className="my-trail-name">{trail.name}</span>
                        <span className="my-trail-meta">
                          {trail.difficulty} · {trail.region || 'No region'}
                        </span>
                      </div>
                      <div className="my-trail-actions">
                        <button
                          className="my-trail-edit-btn"
                          onClick={() => handleEditOpen(trail)}
                        >
                          Edit
                        </button>
                        <button
                          className="my-trail-delete-btn"
                          onClick={() => handleDeleteTrail(trail._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="account-actions">
          <button className="account-btn-settings" onClick={handleOpenProfile}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </button>

          <button
            className="account-btn-signout"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>

          <button
            className="account-btn-delete"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            Delete account
          </button>
        </div>
      </div>

      {showLogoutConfirm && (
        <div
          className="confirm-overlay"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Are you sure you want to sign out?</p>
            <div className="confirm-buttons">
              <button className="confirm-yes" onClick={handleLogout}>
                Yes, sign out
              </button>
              <button
                className="confirm-no"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="confirm-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="confirm-dialog confirm-dialog-danger"
            onClick={(e) => e.stopPropagation()}
          >
            <p>
              Are you sure you want to delete your account? This action cannot
              be undone.
            </p>
            <div className="confirm-buttons">
              <button className="confirm-danger" onClick={handleDeleteAccount}>
                Delete account
              </button>
              <button
                className="confirm-no"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
