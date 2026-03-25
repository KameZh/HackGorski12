const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "HackGorski";

let db = null;

async function connectDB() {
  if (db) {
    return db;
  }

  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log("Connected to MongoDB");
    db = client.db(DB_NAME);
    return db;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

function getDB() {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB first.");
  }
  return db;
}

module.exports = { connectDB, getDB };
