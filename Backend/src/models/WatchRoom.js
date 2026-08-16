const mongoose = require('mongoose');

const watchRoomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true
  },
  roomName: {
    type: String,
    required: true
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  currentMedia: {
    type: {
      type: String, // 'youtube', 'upload', 'screen_share', 'none'
      enum: ['youtube', 'upload', 'screen_share', 'none'],
      default: 'none'
    },
    url: {
      type: String, // Video URL or YouTube video ID
      default: ''
    },
    timestamp: {
      type: Number,
      default: 0
    },
    status: {
      type: String, // 'playing', 'paused'
      enum: ['playing', 'paused'],
      default: 'paused'
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('WatchRoom', watchRoomSchema);
