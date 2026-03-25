require("dotenv").config();
const { connectDB } = require("./Database/connection");

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    const db = await connectDB();
    console.log(`Database connected: ${db.name}`);

    console.log(`Server is ready on port ${PORT}`);
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

startServer();
