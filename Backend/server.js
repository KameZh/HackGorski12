import 'dotenv/config' // To read CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY
import express from 'express'
import { clerkMiddleware, requireAuth } from '@clerk/express'
import cors from 'cors'
import checkUser from './middleware.js'
import { connectDB } from './connection.js'
import Route from './models/route.js'
import { calculateStats, processRouteAI } from './services/aiAnalysis.js'

const port = process.env.PORT || 5174

const app = express()
app.use(cors())
app.use(express.json())
app.use(clerkMiddleware())

connectDB()
app.get('/protected-auth-required', requireAuth(), (req, res) => {
  res.json(req.auth)
})

app.get('/api/user/profile', requireAuth(), checkUser, (req, res) => {
  console.log('User profile requested for:', req.dbUser)
  res.json(req.dbUser)
})

// =====================
// ROUTE UPLOAD + AI ANALYSIS
// =====================

// POST /api/routes — upload a route (GeoJSON), triggers async AI analysis
app.post('/api/routes', requireAuth(), async (req, res) => {
  try {
    const { geojson, name } = req.body
    if (!geojson) return res.status(400).json({ error: 'geojson is required' })

    const stats = calculateStats(geojson)

    const route = await Route.create({
      userId: req.auth.userId,
      name: name || 'Untitled Route',
      geojson,
      stats,
      ai: { status: 'pending' },
    })

    // Fire-and-forget async AI processing
    processRouteAI(route._id)

    res.status(201).json(route)
  } catch (err) {
    console.error('Route upload error:', err)
    res.status(500).json({ error: 'Failed to save route' })
  }
})

// GET /api/routes — list all routes for the current user
app.get('/api/routes', requireAuth(), async (req, res) => {
  try {
    const routes = await Route.find({ userId: req.auth.userId })
      .sort({ createdAt: -1 })
      .select('-geojson') // exclude large geojson from list
    res.json(routes)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch routes' })
  }
})

// GET /api/routes/:id — get a single route (with AI status for polling)
app.get('/api/routes/:id', requireAuth(), async (req, res) => {
  try {
    const route = await Route.findOne({
      _id: req.params.id,
      userId: req.auth.userId,
    })
    if (!route) return res.status(404).json({ error: 'Route not found' })
    res.json(route)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch route' })
  }
})

// DELETE /api/routes/:id — delete a route
app.delete('/api/routes/:id', requireAuth(), async (req, res) => {
  try {
    const result = await Route.findOneAndDelete({
      _id: req.params.id,
      userId: req.auth.userId,
    })
    if (!result) return res.status(404).json({ error: 'Route not found' })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete route' })
  }
})


app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(401).send('Unauthenticated!')
})

app.get('/', function (req, res) {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})