const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  question: {
    type: String,
    required: true
  },
  reply: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
