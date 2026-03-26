require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./Database/connection");
const signupRoutes = require("./routes/signup");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use("/api", signupRoutes);

async function startServer() {
  try {
    const db = await connectDB();
    console.log(`Database connected: ${db.name}`);

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

startServer();
