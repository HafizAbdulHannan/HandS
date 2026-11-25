const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    default: '',
  },
  audioUrl: {
    type: String,
    default: '',
  },
  mediaUrl: {
    type: String,
    default: '',
  },
  mediaType: {
    type: String,
    enum: ['none', 'image', 'video', 'audio', 'file'],
    default: 'none',
  },
  fileName: {
    type: String,
    default: '',
  },
  deletedFor: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  deletedForEveryone: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Message', messageSchema);
