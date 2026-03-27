import mongoose from 'mongoose'

const routeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, default: 'Untitled Route' },
    geojson: { type: Object, required: true },
    stats: {
      distance: Number,
      elevationGain: Number,
      duration: Number,
      pointCount: Number,
    },
    ai: {
      status: {
        type: String,
        enum: ['pending', 'processing', 'done', 'error'],
        default: 'pending',
      },
      segments: [
        {
          name: String,
          difficulty: { type: String, enum: ['easy', 'moderate', 'hard', 'extreme'] },
          description: String,
          estimatedTime: String,
          startIndex: Number,
          endIndex: Number,
        },
      ],
      warnings: [
        {
          type_: String,
          description: String,
          severity: { type: String, enum: ['low', 'medium', 'high'] },
        },
      ],
      summary: String,
      overallDifficulty: String,
      error: String,
    },
  },
  { timestamps: true }
)

const Route = mongoose.model('Route', routeSchema)
export default Route
