import { Routes, Route } from 'react-router-dom'
import Signup from './pages/Signup'
import Login from './pages/Login'
import Home from './pages/Home'
import Explore from './pages/Explore'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Explore />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/home" element={<Home />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  )
}

export default App
