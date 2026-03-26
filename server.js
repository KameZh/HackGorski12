require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const { clerkMiddleware } = require("@clerk/express");
const { connectDB } = require("./Backend/Database/connection");
const signupRoutes = require("./Backend/routes/signup");

const app = express();
const PORT = process.env.PORT || 5174;

// Middleware
app.use(cors());
app.use(express.json());
// Clerk: attaches auth info without blocking unauthenticated requests
app.use(clerkMiddleware({ debug: false }));

// API Routes
app.use("/api", signupRoutes);

// Serve React production build
const distPath = path.join(__dirname, "pytechka-frontend", "dist");
app.use(express.static(distPath));

// Catch-all: serve React app for client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

async function startServer() {
  try {
    const db = await connectDB();
    console.log(`Database connected: ${db.name}`);

    app.listen(PORT, () => {
      console.log(`Backend API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

startServer();
