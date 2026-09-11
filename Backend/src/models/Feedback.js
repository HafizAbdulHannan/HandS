const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  text: {
    type: String,
    required: false,
  },
  imageUrl: {
    type: String,
    default: '',
  },
  devReply: {
    type: String,
    default: '',
  },
  likes: {
    type: Number,
    default: 0,
  }
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
