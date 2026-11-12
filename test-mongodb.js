require("dotenv").config();
const mongoose = require("mongoose");

async function testConnection() {
  if (!process.env.MONGODB_URI) {
    console.error("ERROR: MONGODB_URI is missing from .env");
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });

    console.log("SUCCESS: MongoDB Atlas connected!");
    console.log("Database:", mongoose.connection.name);

    await mongoose.disconnect();
    console.log("Connection closed successfully.");
  } catch (error) {
    console.error("MONGODB CONNECTION FAILED:");
    console.error(error.message);
    process.exitCode = 1;
  }
}

testConnection();
