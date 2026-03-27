import { clerkClient, getAuth } from "@clerk/express";
import User from "./models/user.js";

const sanitizeUsername = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");

const buildUniqueUsername = async (preferred, userId) => {
  const seed = sanitizeUsername(preferred);
  const fallback = `user_${String(userId || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(-8)
    .toLowerCase()}`;
  const base = seed || fallback || "user";

  let candidate = base;
  let index = 1;
  while (await User.exists({ username: candidate })) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  return candidate;
};

const checkUser = async (req, res, next) => {
  console.log("Entering checkUser middleware");
  try {
    const { userId } = getAuth(req);

    console.log("Authenticated userId:", userId);

    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }
    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const primaryEmail =
        clerkUser.emailAddresses?.[0]?.emailAddress ||
        `${userId}@unknown.local`;
      const preferredUsername =
        clerkUser.username ||
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join("") ||
        primaryEmail.split("@")[0];
      const username = await buildUniqueUsername(preferredUsername, userId);

      user = await User.create({
        clerkId: userId,
        email: primaryEmail,
        username,
        metadata: clerkUser.privateMetadata,
      });
      console.log("Created new user in DB:", user);
    }

    req.dbUser = user;
    next();
  } catch (err) {
    console.error("Error in checkUser middleware:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export default checkUser;
