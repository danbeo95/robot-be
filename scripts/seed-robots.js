require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, Robot } = require('../database/index');

const RANDOM_DESCRIPTIONS = [
  'Autonomous warehouse logistics unit specializing in pallet transport and dock dispatch',
  'Automated inventory scanner equipped with high-resolution RFID and optical cameras',
  'Perimeter surveillance and environmental hazard monitoring patrol rover',
  'Heavy payload transport bot configured for industrial manufacturing zones',
  'High-precision delivery rover with obstacle avoidance and dynamic path planning',
  'Facility sanitation rover with UV sterilization and automated floor scrubbing',
  'Thermal and acoustic diagnostic inspection droid for predictive equipment maintenance',
  'Cold-chain storage courier unit optimized for sub-zero temperature environments',
];

function getRandomDescription(index) {
  // Guarantee each robot gets a distinct random description, with random variation
  const shuffled = [...RANDOM_DESCRIPTIONS].sort(() => 0.5 - Math.random());
  return shuffled[index % shuffled.length];
}

async function seedRobots(count = 5) {
  try {
    console.log('🚀 Starting default robots insertion...');
    await connectDB();

    // Check if --clean flag is provided
    if (process.argv.includes('--clean')) {
      console.log('🧹 Clearing existing robots collection (--clean flag detected)...');
      await Robot.deleteMany({});
    }

    const insertedRobots = [];

    for (let i = 1; i <= count; i++) {
      const robotIdStr = String(i).padStart(5, '0'); // '00001' -> '00005'
      const randomDescription = getRandomDescription(i - 1);

      const robotData = {
        id: robotIdStr,
        descriptions: randomDescription,
        description: randomDescription,
        batteryPercentage: Math.floor(Math.random() * 60) + 40,
        wifiSignalStrength: Math.floor(Math.random() * 50) - 90,
        isCharging: Math.random() > 0.6,
        temperature: Math.floor(Math.random() * 25) + 42,
        memoryUsage: Math.floor(Math.random() * 50) + 25,
      };

      // Upsert robot by id to make the script safe to run multiple times
      const robot = await Robot.findOneAndUpdate(
        { id: robotIdStr },
        { $set: robotData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      insertedRobots.push(robot);
      console.log(`🤖 Robot [${robot.id}] inserted/updated:`);
      console.log(`   - id: ${robot.id}`);
      console.log(`   - descriptions: ${robot.descriptions}`);
      console.log(`   - batteryPercentage: ${robot.batteryPercentage}%`);
      console.log(`   - wifiSignalStrength: ${robot.wifiSignalStrength} dBm`);
      console.log(`   - temperature: ${robot.temperature}°C`);
      console.log(`   - memoryUsage: ${robot.memoryUsage}%\n`);
    }

    console.log(`\n🎉 Successfully inserted/verified ${insertedRobots.length} default robots:`);
    console.table(
      insertedRobots.map((r) => ({
        id: r.id,
        descriptions: r.descriptions,
        battery: `${r.batteryPercentage}%`,
        wifi: `${r.wifiSignalStrength} dBm`,
        temp: `${r.temperature}°C`,
        ram: `${r.memoryUsage}%`,
      }))
    );

  } catch (error) {
    console.error('❌ Error seeding robots:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  seedRobots(5);
}

module.exports = seedRobots;
