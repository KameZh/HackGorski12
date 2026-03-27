import mongoose from 'mongoose'

const pingSchema = new mongoose.Schema(
  {
    trailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trail',
      required: true,
      index: true,
    },
    userId: { type: String, required: true },
    username: { type: String, default: 'Anonymous' },
    type: {
      type: String,
      enum: ['junk', 'mud', 'environmental_danger'],
      required: true,
    },
    description: { type: String, default: '' },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: (v) => v.length === 2,
        message: 'Coordinates must be [longitude, latitude]',
      },
    },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
)

// Expiration durations per type (ms). null = permanent.
const PING_EXPIRATION = {
  junk: null,
  mud: 24 * 60 * 60 * 1000,               // 1 day
  environmental_danger: 7 * 24 * 60 * 60 * 1000, // 1 week
}

pingSchema.statics.computeExpiresAt = function (type) {
  const ms = PING_EXPIRATION[type]
  return ms ? new Date(Date.now() + ms) : null
}

const Ping = mongoose.model('Ping', pingSchema)
export default Ping
