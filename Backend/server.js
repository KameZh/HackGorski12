import 'dotenv/config' // To read CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY
import express from 'express'
import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express'
import cors from 'cors'
import checkUser from './middleware.js'
import { connectDB } from './connection.js'
import Route from './models/route.js'
import Trail from './models/trail.js'
import User from './models/user.js'
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
      userId: getAuth(req).userId,
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
    const routes = await Route.find({ userId: getAuth(req).userId })
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
      userId: getAuth(req).userId,
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
      userId: getAuth(req).userId,
    })
    if (!result) return res.status(404).json({ error: 'Route not found' })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete route' })
  }
})


// =====================
// TRAILS (community published routes)
// =====================

// Helper: optionally extract auth without requiring it
function optionalAuth(req) {
  return req.auth?.userId || null
}

// POST /api/trails — publish a trail (auth required)
app.post('/api/trails', requireAuth(), checkUser, async (req, res) => {
  try {
    const { geojson, name, region, difficulty, description, equipment, resources } = req.body
    if (!geojson) return res.status(400).json({ error: 'geojson is required' })
    if (!name) return res.status(400).json({ error: 'name is required' })

    const { userId } = getAuth(req)
    const stats = calculateStats(geojson)

    const trail = await Trail.create({
      userId,
      username: req.dbUser?.username || '',
      name,
      region: region || '',
      difficulty: difficulty || 'moderate',
      description: description || '',
      equipment: equipment || '',
      resources: resources || '',
      geojson,
      stats,
    })

    res.status(201).json(trail)
  } catch (err) {
    console.error('Trail publish error:', err)
    res.status(500).json({ error: 'Failed to publish trail' })
  }
})

// GET /api/trails/mine — get current user's trails (auth required)
app.get('/api/trails/mine', requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req)
    const trails = await Trail.find({ userId })
      .sort({ createdAt: -1 })
      .select('-reviews -geojson')
    res.json(trails)
  } catch (err) {
    console.error('My trails error:', err)
    res.status(500).json({ error: 'Failed to fetch your trails' })
  }
})

// GET /api/trails/geojson — public GeoJSON FeatureCollection for Mapbox
app.get('/api/trails/geojson', async (req, res) => {
  try {
    const trails = await Trail.find({}).select('geojson name difficulty region stats')

    const features = trails.map((trail) => {
      let geometry = null

      if (trail.geojson?.type === 'FeatureCollection' && trail.geojson.features?.length) {
        geometry = trail.geojson.features[0].geometry
      } else if (trail.geojson?.type === 'Feature') {
        geometry = trail.geojson.geometry
      } else if (trail.geojson?.type === 'LineString' || trail.geojson?.type === 'MultiLineString') {
        geometry = trail.geojson
      }

      if (!geometry) return null

      return {
        type: 'Feature',
        geometry,
        properties: {
          id: trail._id.toString(),
          name: trail.name,
          difficulty: trail.difficulty,
          distance: trail.stats?.distance ? (trail.stats.distance / 1000).toFixed(2) : '0',
          elevationGain: trail.stats?.elevationGain || 0,
          region: trail.region || '',
        },
      }
    }).filter(Boolean)

    res.json({ type: 'FeatureCollection', features })
  } catch (err) {
    console.error('GeoJSON endpoint error:', err)
    res.status(500).json({ error: 'Failed to fetch trails geojson' })
  }
})

// GET /api/trails — list all trails (public, no auth required)
app.get('/api/trails', async (req, res) => {
  try {
    const { search, difficulty, activity, sort } = req.query
    const filter = {}

    if (difficulty && difficulty !== 'all') {
      filter.difficulty = difficulty
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { region: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ]
    }

    let sortOption = { createdAt: -1 }
    if (sort === 'popular') sortOption = { averageAccuracy: -1 }
    if (sort === 'newest' || sort === 'new') sortOption = { createdAt: -1 }

    const trails = await Trail.find(filter)
      .sort(sortOption)
      .select('-reviews')

    res.json(trails)
  } catch (err) {
    console.error('Trails list error:', err)
    res.status(500).json({ error: 'Failed to fetch trails' })
  }
})

// GET /api/trails/:id — get a single trail (public)
app.get('/api/trails/:id', async (req, res) => {
  try {
    const trail = await Trail.findById(req.params.id)
    if (!trail) return res.status(404).json({ error: 'Trail not found' })
    res.json(trail)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch trail' })
  }
})

// PUT /api/trails/:id — update trail (owner only)
app.put('/api/trails/:id', requireAuth(), async (req, res) => {
  try {
    const trail = await Trail.findById(req.params.id)
    if (!trail) return res.status(404).json({ error: 'Trail not found' })
    if (trail.userId !== getAuth(req).userId) {
      return res.status(403).json({ error: 'Not authorized to edit this trail' })
    }

    const allowed = ['name', 'region', 'difficulty', 'description', 'equipment', 'resources']
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        trail[key] = req.body[key]
      }
    }

    await trail.save()
    res.json(trail)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update trail' })
  }
})

// DELETE /api/trails/:id — delete trail (owner only)
app.delete('/api/trails/:id', requireAuth(), async (req, res) => {
  try {
    const trail = await Trail.findById(req.params.id)
    if (!trail) return res.status(404).json({ error: 'Trail not found' })
    if (trail.userId !== getAuth(req).userId) {
      return res.status(403).json({ error: 'Not authorized to delete this trail' })
    }

    await Trail.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete trail' })
  }
})

// POST /api/trails/:id/reviews — add a review (auth required)
app.post('/api/trails/:id/reviews', requireAuth(), checkUser, async (req, res) => {
  try {
    const { accuracy, comment } = req.body
    if (!accuracy || accuracy < 1 || accuracy > 5) {
      return res.status(400).json({ error: 'Accuracy must be between 1 and 5' })
    }

    const trail = await Trail.findById(req.params.id)
    if (!trail) return res.status(404).json({ error: 'Trail not found' })

    // Prevent duplicate reviews from the same user
    const reviewUserId = getAuth(req).userId
    const existing = trail.reviews.find((r) => r.userId === reviewUserId)
    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this trail' })
    }

    trail.reviews.push({
      userId: reviewUserId,
      username: req.dbUser?.username || 'Anonymous',
      accuracy: Number(accuracy),
      comment: comment || '',
    })

    trail.recalcAverageAccuracy()
    await trail.save()

    res.status(201).json(trail)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add review' })
  }
})

// GET /api/trails/:id/reviews — get reviews for a trail (public)
app.get('/api/trails/:id/reviews', async (req, res) => {
  try {
    const trail = await Trail.findById(req.params.id).select('reviews averageAccuracy')
    if (!trail) return res.status(404).json({ error: 'Trail not found' })
    res.json({ reviews: trail.reviews, averageAccuracy: trail.averageAccuracy })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch reviews' })
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