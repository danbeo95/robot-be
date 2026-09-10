require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, RobotHistory } = require('../database/index');

/**
 * Generate random state similar to robot simulator
 */
function generateRandomTelemetry(robotId, timestamp) {
  return {
    robot_id: robotId,
    robotId: robotId,
    batteryPercentage: Math.floor(Math.random() * 100), // 0-100%
    wifiSignalStrength: Math.floor(Math.random() * 60) - 100, // -100 to -40 dBm
    isCharging: Math.random() > 0.7, // 30% chance of charging
    temperature: Math.floor(Math.random() * 30) + 40, // 40-70°C
    memoryUsage: Math.floor(Math.random() * 60) + 20, // 20-80%
    timestamp,
  };
}

async function seedHistory(recordsPerRobot = 20) {
  try {
    console.log('🚀 Generating sample historical telemetry records...');
    await connectDB();

    if (process.argv.includes('--clean')) {
      console.log('🧹 Clearing robot_history collection (--clean flag detected)...');
      await RobotHistory.deleteMany({});
    }

    const records = [];
    const now = Date.now();
    const intervalMs = 60 * 1000; // 1 data point per minute going back

    for (let i = 1; i <= 5; i++) {
      const robotId = String(i).padStart(5, '0');

      for (let step = recordsPerRobot; step >= 0; step--) {
        const timestamp = new Date(now - step * intervalMs);
        records.push(generateRandomTelemetry(robotId, timestamp));
      }
    }

    const result = await RobotHistory.insertMany(records);
    console.log(`✅ Successfully seeded ${result.length} historical records into robot_history`);
  } catch (error) {
    console.error('❌ Error seeding robot history:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  seedHistory(20);
}

module.exports = seedHistory;
