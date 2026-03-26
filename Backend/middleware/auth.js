const { requireAuth } = require("@clerk/express");

// Re-export Clerk's requireAuth for use in route files
// Usage: router.get('/protected', clerkAuth, (req, res) => { ... })
// Access user ID via req.auth.userId
const clerkAuth = requireAuth();

module.exports = { clerkAuth };
