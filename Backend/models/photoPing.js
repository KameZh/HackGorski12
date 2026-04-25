import mongoose from 'mongoose'

const photoPingSchema = new mongoose.Schema(
  {
    trailId: { type: String, default: null, index: true },
    userId: { type: String, required: true },
    username: { type: String, default: 'Anonymous' },
    type: { type: String, default: 'photo' },
    description: { type: String, default: '' },
    photoUrl: { type: String, required: true },
    photoCategory: {
      type: String,
      enum: [
        'viewpoint',
        'trail_condition',
        'marking',
        'water_source',
        'hazard',
        'memory',
      ],
      default: 'memory',
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v) =>
          Array.isArray(v) &&
          v.length === 2 &&
          v.every((value) => Number.isFinite(value)),
        message: 'Coordinates must be [longitude, latitude]',
      },
    },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const PhotoPing = mongoose.model('PhotoPing', photoPingSchema)
export default PhotoPing
