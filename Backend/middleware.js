import { clerkClient } from '@clerk/express'
import User from './models/user.js'

const checkUser = async (req, res, next) => {
    console.log('Entering checkUser middleware')
    try {
        const { userId } = req.auth;

        console.log('Authenticated userId:', userId);

        if (!userId) {
            return res.status(401).json({ error: 'Unauthenticated' });
        }
        let user = await User.findOne({ clerkId: userId });
        if (!user) {
            const clerkUser = await clerkClient.users.getUser(userId);
            user = await User.create({
                clerkId: userId,
                email: clerkUser.emailAddresses[0].emailAddress,
                username: clerkUser.username,
                metadata: clerkUser.privateMetadata
            });
                console.log('Created new user in DB:', user);
        }

        req.dbUser = user;
        next();
    } catch (err) {
        console.error('Error in checkUser middleware:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export default checkUser;