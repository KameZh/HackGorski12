import 'dotenv/config' // To read CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY
import express from 'express'
import { ClerkExpressRequireAuth, ClerkExpressWithAuth } from '@clerk/clerk-sdk-node'
import cors from 'cors'
import checkUser from './middleware.js'
import { connectDB } from './connection.js'

const port = process.env.PORT || 5174

const app = express()
app.use(cors())
app.use(express.json())

connectDB()
app.get('/protected-auth-required', ClerkExpressRequireAuth(), (req, res) => {
  res.json(req.auth)
})

app.get('/api/user/profile', ClerkExpressRequireAuth(), checkUser, (req, res) => {
  console.log('User profile requested for:', req.dbUser)
  res.json(req.dbUser)
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