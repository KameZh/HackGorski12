import mongoose from 'mongoose'

const pingSchema = new mongoose.Schema(
  {
    trailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trail',
      default: null,
      index: true,
    },
    userId: { type: String, required: true },
    username: { type: String, default: 'Anonymous' },
    type: {
      type: String,
      enum: ['junk', 'mud', 'environmental_danger', 'photo'],
      required: true,
    },
    description: { type: String, default: '' },
    photoUrl: { type: String, default: null },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v) => v.length === 2,
        message: 'Coordinates must be [longitude, latitude]',
      },
    },
    expiresAt: { type: Date, default: null },
    goneVotes: [{ type: String }],
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const PING_EXPIRATION = {
  junk: null,
  mud: 24 * 60 * 60 * 1000,
  environmental_danger: 7 * 24 * 60 * 60 * 1000,
  photo: null, // Photos don't expire
}

pingSchema.statics.computeExpiresAt = function (type) {
  const ms = PING_EXPIRATION[type]
  return ms ? new Date(Date.now() + ms) : null
}

const Ping = mongoose.model('Ping', pingSchema)
export default Ping
