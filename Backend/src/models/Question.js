const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  questionText: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    default: '',
  },
  devReply: {
    type: String,
    default: '',
  }
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
