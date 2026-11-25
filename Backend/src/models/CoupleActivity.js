const mongoose = require('mongoose');

const coupleActivitySchema = new mongoose.Schema(
  {
    pair: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    minutesSpent: {
      type: Number,
      default: 0,
    },
    lastPingAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

coupleActivitySchema.index({ pair: 1, user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('CoupleActivity', coupleActivitySchema);
