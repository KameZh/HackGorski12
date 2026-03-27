import { useAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { setClerkTokenGetter } from './api/client'
import { getUserProfile } from './api/auth'
import Signup from './pages/Signup'
import Login from './pages/Login'
import Home from './pages/Home'
import Explore from './pages/Explore'
import Maps from './pages/Maps'
import Record from './pages/Record'
import Events from './pages/Events'

function App() {
  const { getToken, isSignedIn } = useAuth()

  // Wire Clerk's getToken into the axios client so all API calls are authenticated
  useEffect(() => {
    setClerkTokenGetter(getToken)
  }, [getToken])

  // Sync user to MongoDB whenever they sign in
  useEffect(() => {
    if (isSignedIn) {
      getUserProfile().catch((err) => console.error('User sync failed:', err))
    }
  }, [isSignedIn])

  return (
    <Routes>
      <Route path="/" element={<Explore />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/maps" element={<Maps />} />
      <Route path="/record" element={<Record />} />
      <Route path="/events" element={<Events />} />
      <Route path="/account" element={<Home />} />
      <Route path="/home" element={<Home />} />
      <Route path="/signup/*" element={<Signup />} />
      <Route path="/login/*" element={<Login />} />
    </Routes>
  )
}

export default App
