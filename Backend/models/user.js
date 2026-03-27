import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
    {
        clerkId: { type: String, required: true, unique: true, index: true },
        email: { type: String, required: true, unique: true },
        username: { type: String, required: true, unique: true },
        metadata: mongoose.Schema.Types.Mixed, // Flexible additional data
        badgeProgress: {
            trailCompletions: { type: Number, default: 0 },
            createdTrails: { type: Number, default: 0 },
            campaignPoints: { type: Number, default: 0 },
            awarded: {
                trailers: { type: String, default: null },
                contribution: { type: String, default: null },
                campaign: { type: String, default: null },
            },
        },
    },
    { timestamps: true },
)

const User = mongoose.model('User', userSchema)
export default User;
