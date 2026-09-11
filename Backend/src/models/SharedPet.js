const mongoose = require('mongoose');

const sharedPetSchema = new mongoose.Schema({
  pair: {
    type: String, // combination of both user IDs sorted
    required: true,
    unique: true,
  },
  name: {
    type: String,
    default: 'Our Pet',
  },
  type: {
    type: String,
    enum: ['dog', 'cat', 'plant'],
    default: 'dog',
  },
  health: {
    type: Number,
    default: 100, // 0 - 100
  },
  xp: {
    type: Number,
    default: 0,
  },
  level: {
    type: Number,
    default: 1,
  },
  lastFed: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model('SharedPet', sharedPetSchema);
