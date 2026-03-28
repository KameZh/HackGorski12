import mongoose from 'mongoose'

const trashClusterSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ['clutter', 'event'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
    pingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ping' }],
    pingCount: { type: Number, default: 0 },
    description: { type: String, default: '' },
    goneVotes: [{ type: String }],
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const TrashCluster = mongoose.model('TrashCluster', trashClusterSchema)
export default TrashCluster
