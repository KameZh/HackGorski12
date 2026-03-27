import 'dotenv/config' // To read CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY
import express from 'express'
import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express'
import cors from 'cors'
import checkUser from './middleware.js'
import { connectDB } from './connection.js'
import Trail from './models/trail.js'
import Ping from './models/ping.js'
import TrashCluster from './models/trashCluster.js'
import User from './models/user.js'
import { calculateStats, processRouteAI } from './services/aiAnalysis.js'

const port = process.env.PORT || 5174

const app = express()
app.use(cors())
app.use(express.json())
app.use(clerkMiddleware())

connectDB()

const BADGE_TIERS = {
  trailers: [
    { min: 20, name: 'Senior' },
    { min: 10, name: 'Junior' },
    { min: 3, name: 'Rookie' },
  ],
  contribution: [
    { min: 20, name: 'Country guide' },
    { min: 10, name: 'Local guide' },
    { min: 3, name: 'New guide' },
  ],
  campaign: [
    { min: 20, name: 'Basically organizer' },
    { min: 10, name: 'Helper' },
    { min: 3, name: 'Volunteer' },
  ],
}

function pickTier(category, value = 0) {
  const tiers = BADGE_TIERS[category] || []
  const found = tiers.find((t) => value >= t.min)
  return found?.name || null
}

async function updateBadgeProgress(userId, increments = {}) {
  const user = await User.findOne({ clerkId: userId })
  if (!user) return null

  user.badgeProgress = user.badgeProgress || {}
  const p = user.badgeProgress
  p.trailCompletions = (p.trailCompletions || 0) + (increments.trailCompletions || 0)
  p.createdTrails = (p.createdTrails || 0) + (increments.createdTrails || 0)
  p.campaignPoints = (p.campaignPoints || 0) + (increments.campaignPoints || 0)

  p.awarded = p.awarded || {}
  p.awarded.trailers = pickTier('trailers', p.trailCompletions)
  p.awarded.contribution = pickTier('contribution', p.createdTrails)
  p.awarded.campaign = pickTier('campaign', p.campaignPoints)

  await user.save()
  return user
}

app.get('/api/user/profile', requireAuth(), checkUser, async (req, res) => {
  try {
    const { userId } = getAuth(req)
    const user = await User.findOne({ clerkId: userId })
    res.json(user)
  } catch (err) {
    console.error('User profile error:', err)
    res.status(500).json({ error: 'Failed to load profile' })
  }
})

// =====================
// TRAILS (community published routes)
// =====================

// POST /api/trails — publish a trail (auth required)
app.post('/api/trails', requireAuth(), checkUser, async (req, res) => {
  try {
    const { geojson, name, region, difficulty, description, equipment, resources, startPoint, endPoint, highestPoint } = req.body
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
      startPoint: startPoint || '',
      endPoint: endPoint || '',
      highestPoint: highestPoint || '',
      geojson,
      stats,
      ai: { status: 'pending' },
    })

    // Fire-and-forget async AI processing
    processRouteAI(trail._id)

    // Contribution badge progress
    await updateBadgeProgress(userId, { createdTrails: 1 })

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

// POST /api/badges/trailers/complete — mark a completed trail
app.post('/api/badges/trailers/complete', requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req)
    const amount = Number(req.body?.amount || 1)
    const user = await updateBadgeProgress(userId, { trailCompletions: amount })
    res.json({ badgeProgress: user?.badgeProgress || null })
  } catch (err) {
    console.error('Badge trailer update error:', err)
    res.status(500).json({ error: 'Failed to update trailer badge' })
  }
})

// POST /api/badges/campaign/participate — add participation point
app.post('/api/badges/campaign/participate', requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req)
    const amount = Number(req.body?.amount || 1)
    const user = await updateBadgeProgress(userId, { campaignPoints: amount })
    res.json({ badgeProgress: user?.badgeProgress || null })
  } catch (err) {
    console.error('Badge campaign update error:', err)
    res.status(500).json({ error: 'Failed to update campaign badge' })
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

    const allowed = ['name', 'region', 'difficulty', 'description', 'equipment', 'resources', 'startPoint', 'endPoint', 'highestPoint']
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

// =====================
// PINGS (trail hazard markers)
// =====================

// Haversine distance between two [lng, lat] pairs in meters
function haversineMeters([lon1, lat1], [lon2, lat2]) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// After a junk ping is created, check for clusters within 300 m
async function detectTrashClusters(newPing) {
  if (newPing.type !== 'junk') return

  // Find all active junk pings (not resolved, not expired)
  const junkPings = await Ping.find({
    type: 'junk',
    resolved: { $ne: true },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  })

  // Find pings within 300 m of the new one
  const nearby = junkPings.filter(
    (p) => haversineMeters(newPing.coordinates, p.coordinates) <= 300
  )

  if (nearby.length < 3) return // not enough for a cluster

  const nearbyIds = nearby.map((p) => p._id)

  // Check if there's already a cluster containing most of these pings
  const existing = await TrashCluster.findOne({
    resolved: { $ne: true },
    pingIds: { $in: nearbyIds },
  })

  if (existing) {
    // Merge new pings into the existing cluster
    const mergedIds = [...new Set([...existing.pingIds.map(String), ...nearbyIds.map(String)])]
    const allPings = junkPings.filter((p) => mergedIds.includes(String(p._id)))
    const avgLng = allPings.reduce((s, p) => s + p.coordinates[0], 0) / allPings.length
    const avgLat = allPings.reduce((s, p) => s + p.coordinates[1], 0) / allPings.length

    existing.pingIds = allPings.map((p) => p._id)
    existing.pingCount = allPings.length
    existing.coordinates = [avgLng, avgLat]
    existing.level = allPings.length >= 5 ? 'event' : 'clutter'
    if (existing.level === 'event') {
      existing.description = `Trash cleanup needed! ${allPings.length} reports of litter in this area.`
    }
    await existing.save()
  } else {
    // Create a new cluster
    const avgLng = nearby.reduce((s, p) => s + p.coordinates[0], 0) / nearby.length
    const avgLat = nearby.reduce((s, p) => s + p.coordinates[1], 0) / nearby.length
    const level = nearby.length >= 5 ? 'event' : 'clutter'

    await TrashCluster.create({
      level,
      coordinates: [avgLng, avgLat],
      pingIds: nearbyIds,
      pingCount: nearby.length,
      description:
        level === 'event'
          ? `Trash cleanup needed! ${nearby.length} reports of litter in this area.`
          : `Warning: ${nearby.length} trash reports nearby. This area may need cleanup soon.`,
    })
  }
}

// POST /api/pings — create a ping (auth required)
app.post('/api/pings', requireAuth(), checkUser, async (req, res) => {
  try {
    const { trailId, type, description, coordinates } = req.body
    if (!type) return res.status(400).json({ error: 'type is required' })
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ error: 'coordinates must be [longitude, latitude]' })
    }

    if (trailId) {
      const trail = await Trail.findById(trailId)
      if (!trail) return res.status(404).json({ error: 'Trail not found' })
    }

    const { userId } = getAuth(req)
    const ping = await Ping.create({
      trailId: trailId || null,
      userId,
      username: req.dbUser?.username || 'Anonymous',
      type,
      description: description || '',
      coordinates,
      expiresAt: Ping.computeExpiresAt(type),
    })

    // Fire-and-forget cluster detection for junk pings
    detectTrashClusters(ping).catch((err) =>
      console.error('Cluster detection error:', err)
    )

    res.status(201).json(ping)
  } catch (err) {
    console.error('Ping create error:', err)
    res.status(500).json({ error: 'Failed to create ping' })
  }
})

// GET /api/pings — list all pings (public)
app.get('/api/pings', async (req, res) => {
  try {
    const filter = {
      resolved: { $ne: true },
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    }
    if (req.query.trailId) filter.trailId = req.query.trailId
    const pings = await Ping.find(filter).sort({ createdAt: -1 })
    res.json(pings)
  } catch (err) {
    console.error('Pings list error:', err)
    res.status(500).json({ error: 'Failed to fetch pings' })
  }
})

// POST /api/pings/:id/vote — vote "gone" on a single ping (auth required)
// 1 vote needed to resolve a single ping
app.post('/api/pings/:id/vote', requireAuth(), async (req, res) => {
  try {
    const ping = await Ping.findById(req.params.id)
    if (!ping) return res.status(404).json({ error: 'Ping not found' })
    if (ping.resolved) return res.status(400).json({ error: 'Already resolved' })

    const { userId } = getAuth(req)
    if (ping.goneVotes.includes(userId)) {
      return res.status(400).json({ error: 'You already voted' })
    }

    ping.goneVotes.push(userId)
    // Single ping needs 1 vote to be removed
    if (ping.goneVotes.length >= 1) {
      ping.resolved = true
    }
    await ping.save()
    res.json(ping)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to vote on ping' })
  }
})

// DELETE /api/pings/:id — delete a ping (owner only)
app.delete('/api/pings/:id', requireAuth(), async (req, res) => {
  try {
    const ping = await Ping.findById(req.params.id)
    if (!ping) return res.status(404).json({ error: 'Ping not found' })
    if (ping.userId !== getAuth(req).userId) {
      return res.status(403).json({ error: 'Not authorized to delete this ping' })
    }
    await Ping.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete ping' })
  }
})

// =====================
// TRASH CLUSTERS & EVENTS
// =====================

// GET /api/clusters — list all active clusters/events (public)
app.get('/api/clusters', async (req, res) => {
  try {
    const clusters = await TrashCluster.find({ resolved: { $ne: true } }).sort({ createdAt: -1 })
    res.json(clusters)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch clusters' })
  }
})

// POST /api/clusters/:id/vote — vote "gone" on a cluster/event (auth required)
// Clutter needs 3 votes, Event needs 5 votes
app.post('/api/clusters/:id/vote', requireAuth(), async (req, res) => {
  try {
    const cluster = await TrashCluster.findById(req.params.id)
    if (!cluster) return res.status(404).json({ error: 'Cluster not found' })
    if (cluster.resolved) return res.status(400).json({ error: 'Already resolved' })

    const { userId } = getAuth(req)
    if (cluster.goneVotes.includes(userId)) {
      return res.status(400).json({ error: 'You already voted' })
    }

    cluster.goneVotes.push(userId)
    const needed = cluster.level === 'event' ? 5 : 3
    if (cluster.goneVotes.length >= needed) {
      cluster.resolved = true
      // Also resolve all member pings
      await Ping.updateMany(
        { _id: { $in: cluster.pingIds } },
        { $set: { resolved: true } }
      )
    }
    await cluster.save()
    res.json(cluster)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to vote on cluster' })
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