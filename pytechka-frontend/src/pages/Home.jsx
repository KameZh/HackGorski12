import { Link } from 'react-router-dom'
import './Auth.css'

export default function Home() {
  const userEmail = localStorage.getItem('userEmail')

  const handleLogout = () => {
    localStorage.removeItem('userEmail')
    window.location.reload()
  }

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Welcome to HackGorski</h2>
        {userEmail ? (
          <>
            <p>Logged in as <strong>{userEmail}</strong></p>
            <button onClick={handleLogout}>Log Out</button>
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
