const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['post', 'gallery', 'like', 'comment', 'drawing', 'other'],
      default: 'other',
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId, // Link to a Post
      ref: 'Post',
    },
    read: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
