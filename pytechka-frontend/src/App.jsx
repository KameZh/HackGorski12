import { SignInButton, SignedIn, SignedOut, UserButton, useAuth } from '@clerk/clerk-react'
import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Signup from './pages/Signup'
import Login from './pages/Login'
import Home from './pages/Home'
import Explore from './pages/Explore'
import Maps from './pages/Maps'
import Record from './pages/Record'

// Placeholder pages (to be built)
const Placeholder = ({ name }) => (
  <div className="flex items-center justify-center h-screen bg-gray-950 text-white text-xl font-bold">
    {name} — coming soon
  </div>
)

function App() {
  const { getToken } = useAuth()
  const [data, setData] = useState({})

  async function callProtectedAuthRequired() {
    const token = await getToken()
    const res = await fetch('http://localhost:5174/protected-auth-required', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const json = await res.json()
    setData(json)
  }

  return (
    <Routes>
      <Route path="/" element={<Explore />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/maps" element={<Maps />} />
      <Route path="/record" element={<Record />} />
      <Route path="/events" element={<Placeholder name="Events" />} />
      <Route path="/account" element={<Home />} />
      <Route path="/home" element={<Home />} />
      <Route path="/signup/*" element={<Signup />} />
      <Route path="/login/*" element={<Login />} />
    </Routes>
  )
}

export default App
