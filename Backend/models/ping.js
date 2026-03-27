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
  },
  { timestamps: true }
)

const Ping = mongoose.model('Ping', pingSchema)
export default Ping
