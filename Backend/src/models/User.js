const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Critical: 1-on-1 link to partner
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      updatedAt: { type: Date },
    },
    mood: {
      type: String,
      default: 'Happy',
    },
    pushToken: {
      type: String,
      default: '',
    },
    resetPasswordOTP: {
      type: String,
    },
    resetPasswordExpire: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);
module.exports = User;
