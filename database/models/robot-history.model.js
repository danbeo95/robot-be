const mongoose = require('mongoose');

const robotHistorySchema = new mongoose.Schema(
  {
    robot_id: {
      type: String,
      required: true,
      index: true,
    },
    robotId: {
      type: String,
      index: true,
    },
    batteryPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    wifiSignalStrength: {
      type: Number,
      required: true,
      min: -100,
      max: 0,
    },
    isCharging: {
      type: Boolean,
      required: true,
      default: false,
    },
    temperature: {
      type: Number,
      required: true,
    },
    memoryUsage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: 'robot_history', // Explicitly maps to robot_history collection
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Sync robot_id and robotId before validation
robotHistorySchema.pre('validate', function (next) {
  if (!this.robotId && this.robot_id) {
    this.robotId = this.robot_id;
  }
  if (!this.robot_id && this.robotId) {
    this.robot_id = this.robotId;
  }
  if (!this.timestamp) {
    this.timestamp = new Date();
  }
  next();
});

// Compound indexes for time-series / history lookups
robotHistorySchema.index({ robot_id: 1, timestamp: -1 });
robotHistorySchema.index({ robotId: 1, timestamp: -1 });

const RobotHistory =
  mongoose.models.RobotHistory ||
  mongoose.model('RobotHistory', robotHistorySchema);

module.exports = RobotHistory;
