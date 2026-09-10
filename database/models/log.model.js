const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
  {
    connectionId: {
      type: String,
      required: false,
      index: true,
    },
    entries: [
      {
        type: String,
      },
    ],
    totalEntries: {
      type: Number,
      required: true,
    },
    payloadSizeBytes: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Log = mongoose.model('Log', logSchema);

module.exports = Log;
