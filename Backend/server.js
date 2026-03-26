import dotenv from 'dotenv'
import express from 'express'
import { ClerkExpressRequireAuth, ClerkExpressWithAuth } from '@clerk/clerk-sdk-node'
import cors from 'cors'
import { Webhook } from 'swix'
import user from './backend/models/user'

dotenv.config()

const port = process.env.PORT || 3000

const app = express()
app.use(cors())
app.use(express.json())

const router = express.Router();

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env');
  }

  const headers = req.headers;
  const payload = req.body;

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt;

  try {
    evt = wh.verify(payload, headers);
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return res.status(400).json({ Error: err.message });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { email_addresses, username } = evt.data;

    const userAttributes = {
      clerkId: id,
      email: email_addresses[0].email_address,
      username: username
    };

    try {
      await user.findOneAndUpdate(
        { clerkId: id },
        userAttributes,
        { upsert: true, new: true }
      );
      console.log(`User ${id} was ${eventType}`);
    } catch (dbErr) {
      console.error('Database error:', dbErr);
      return res.status(500).json({ error: 'Database update failed' });
    }
  }

  if (eventType === 'user.deleted') {
    try {
      await user.findOneAndDelete({ clerkId: id });
      console.log(`User ${id} was deleted`);
    } catch (dbErr) {
      return res.status(500).json({ error: 'Database deletion failed' });
    }
  }

  return res.status(200).json({ response: 'Success' });
});

module.exports = router;