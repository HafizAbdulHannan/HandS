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
      index: true,
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
      index: true,
    },
    pairedAt: {
      type: Date,
      default: null,
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      updatedAt: { type: Date },
    },
    activeTrip: {
      active: { type: Boolean, default: false },
      destination: { type: String, default: '' },
      destinationCoords: {
        lat: { type: Number },
        lng: { type: Number },
      },
      startLocation: {
        lat: { type: Number },
        lng: { type: Number },
        address: { type: String, default: '' },
      },
      currentLocation: {
        lat: { type: Number },
        lng: { type: Number },
        address: { type: String, default: '' },
      },
      vehicleType: { type: String, default: 'Car' },
      totalDistance: { type: String, default: '' },
      totalDistanceMeters: { type: Number, default: 0 },
      coveredDistance: { type: String, default: '0.0 km' },
      coveredDistanceMeters: { type: Number, default: 0 },
      eta: { type: String, default: '' },
      speed: { type: Number, default: 0 },
      routeCoordinates: [
        {
          latitude: { type: Number },
          longitude: { type: Number },
        },
      ],
      startedAt: { type: Date },
      updatedAt: { type: Date },
    },
    mood: {
      type: String,
      default: 'happy',
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
    pendingAnimation: {
      type: String,
      enum: ['love_you', 'miss_you', 'heartbeat', null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);
module.exports = User;
