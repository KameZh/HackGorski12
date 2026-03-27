import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, default: 'Anonymous' },
    accuracy: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
  },
  { timestamps: true }
)

const trailSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    username: { type: String, default: '' },
    name: { type: String, required: true },
    region: { type: String, default: '' },
    difficulty: {
      type: String,
      enum: ['easy', 'moderate', 'hard', 'extreme'],
      default: 'moderate',
    },
    description: { type: String, default: '' },
    equipment: { type: String, default: '' },
    resources: { type: String, default: '' },
    geojson: { type: Object, required: true },
    stats: {
      distance: Number,
      elevationGain: Number,
      duration: Number,
      pointCount: Number,
    },
    reviews: [reviewSchema],
    averageAccuracy: { type: Number, default: 0 },
  },
  { timestamps: true }
)

trailSchema.methods.recalcAverageAccuracy = function () {
  if (!this.reviews.length) {
    this.averageAccuracy = 0
    return
  }
  const sum = this.reviews.reduce((acc, r) => acc + r.accuracy, 0)
  this.averageAccuracy = Math.round((sum / this.reviews.length) * 10) / 10
}

const Trail = mongoose.model('Trail', trailSchema)
export default Trail
