import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
    {
        clerkId: { type: String, required: true, unique: true, index: true },
        email: { type: String, required: true, unique: true },
        username: { type: String, required: true, unique: true },
        metadata: mongoose.Schema.Types.Mixed, // Flexible additional data
    },
    { timestamps: true },
)

const User = mongoose.model('User', userSchema)
export default User;
