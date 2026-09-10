const mongoose = require('mongoose');
const Robot = require('./models/robot.model');
const RobotHistory = require('./models/robot-history.model');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/robot-fleet';
    await mongoose.connect(mongoUri, {});
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = {
  connectDB,
  models: {
    Robot,
    RobotHistory,
  },
  Robot,
  RobotHistory,
};

