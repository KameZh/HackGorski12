import mongoose from 'mongoose'

const trashClusterSchema = new mongoose.Schema(
  {
    // 'clutter' = 3+ pings, 'event' = 5+ pings
    level: {
      type: String,
      enum: ['clutter', 'event'],
      required: true,
    },
    // center coordinates [lng, lat] — average of member pings
    coordinates: {
      type: [Number],
      required: true,
    },
    // IDs of the junk pings that form this cluster
    pingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ping' }],
    pingCount: { type: Number, default: 0 },
    description: { type: String, default: '' },
    // "gone" votes — users who confirmed this cluster is cleared
    goneVotes: [{ type: String }], // userIds
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const TrashCluster = mongoose.model('TrashCluster', trashClusterSchema)
export default TrashCluster
