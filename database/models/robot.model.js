const mongoose = require('mongoose');

const robotSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    descriptions: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    batteryPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    wifiSignalStrength: {
      type: Number,
      min: -100,
      max: 0,
    },
    isCharging: {
      type: Boolean,
      default: false,
    },
    temperature: {
      type: Number,
    },
    memoryUsage: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual getters/setters for robot_id & robotId to maintain backward compatibility
robotSchema
  .virtual('robot_id')
  .get(function () {
    return this.id;
  })
  .set(function (val) {
    this.id = val;
  });

robotSchema
  .virtual('robotId')
  .get(function () {
    return this.id;
  })
  .set(function (val) {
    this.id = val;
  });

// Synchronize description / descriptions before validation
robotSchema.pre('validate', function (next) {
  if (!this.description && this.descriptions) {
    this.description = this.descriptions;
  }
  if (!this.descriptions && this.description) {
    this.descriptions = this.description;
  }
  next();
});

const Robot = mongoose.models.Robot || mongoose.model('Robot', robotSchema);

module.exports = Robot;
