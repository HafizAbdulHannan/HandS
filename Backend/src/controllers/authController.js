const User = require('../models/User');
const Post = require('../models/Post');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const PairingRequest = require('../models/PairingRequest');
const DateEvent = require('../models/DateEvent');
const MoodLog = require('../models/MoodLog');
const Question = require('../models/Question');
const QuestionAnswer = require('../models/QuestionAnswer');
const SharedListItem = require('../models/SharedListItem');
const SharedPet = require('../models/SharedPet');
const WatchRoom = require('../models/WatchRoom');
const CoupleActivity = require('../models/CoupleActivity');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { fullName, username, phoneNumber, email, password } = req.body;

    if (!fullName || !username || !phoneNumber || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const trimmedUsername = String(username).trim();

    const emailExists = await User.findOne({ email: normalizedEmail });
    if (emailExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const usernameExists = await User.findOne({ username: trimmedUsername });
    if (usernameExists) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(String(password), salt);

    const user = await User.create({
      fullName: String(fullName).trim(),
      username: trimmedUsername,
      phoneNumber: String(phoneNumber).trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    if (user) {
      res.status(201).json({
        _id: user.id,
        fullName: user.fullName,
        username: user.username,
        phoneNumber: user.phoneNumber,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        partner: user.partner,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email or username already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });

    if (user && (await bcrypt.compare(String(password), user.password))) {
      res.json({
        _id: user.id,
        fullName: user.fullName,
        username: user.username,
        phoneNumber: user.phoneNumber,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        partner: user.partner,
        pendingAnimation: user.pendingAnimation,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update push token
// @route   PUT /api/auth/push-token
// @access  Private
const updatePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (pushToken !== undefined) {
      req.user.pushToken = pushToken;
      await req.user.save();
    }
    res.status(200).json({ message: 'Push token updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { fullName, username, bio, avatar } = req.body;
    const user = req.user;

    if (fullName) user.fullName = String(fullName).trim();
    if (username) {
      const trimmedUsername = String(username).trim();
      const existingUser = await User.findOne({ username: trimmedUsername });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      user.username = trimmedUsername;
    }
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();
    res.status(200).json(user);
  } catch (error) {
    console.error('updateProfile error:', error.message);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Update or end user's active trip
// @route   PUT /api/auth/trip
// @access  Private
const updateTrip = async (req, res) => {
  try {
    const tripData = req.body;
    if (!tripData || tripData.active === false) {
      req.user.activeTrip = {
        active: false,
        destination: '',
        routeCoordinates: [],
        updatedAt: new Date(),
      };
    } else {
      req.user.activeTrip = {
        active: true,
        destination: tripData.destination || '',
        destinationCoords: tripData.destinationCoords || undefined,
        startLocation: tripData.startLocation || undefined,
        currentLocation: tripData.currentLocation || undefined,
        vehicleType: tripData.vehicleType || 'Car',
        totalDistance: tripData.totalDistance || '',
        totalDistanceMeters: Number(tripData.totalDistanceMeters) || 0,
        coveredDistance: tripData.coveredDistance || '0.0 km',
        coveredDistanceMeters: Number(tripData.coveredDistanceMeters) || 0,
        eta: tripData.eta || '',
        speed: Number(tripData.speed) || 0,
        routeCoordinates: Array.isArray(tripData.routeCoordinates)
          ? tripData.routeCoordinates.slice(0, 600)
          : [],
        startedAt: tripData.startedAt ? new Date(tripData.startedAt) : new Date(),
        updatedAt: new Date(),
      };
    }
    await req.user.save();
    res.status(200).json({ activeTrip: req.user.activeTrip });
  } catch (error) {
    console.error('Update trip error:', error);
    res.status(500).json({ message: 'Server error updating trip' });
  }
};

// @desc    Update user location
// @route   PUT /api/auth/location
// @access  Private
const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude !== undefined && longitude !== undefined) {
      req.user.location = {
        lat: Number(latitude),
        lng: Number(longitude),
        updatedAt: new Date()
      };
      await req.user.save();
    }
    res.status(200).json({ message: 'Location updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();

    const salt = await bcrypt.genSalt(10);
    const hashedOTP = await bcrypt.hash(otp, salt);

    user.resetPasswordOTP = hashedOTP;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    const message = `Dear ${user.fullName},\nhere is your one-time passcode for HandS app:\n${otp}\nPlease do not share it with anyone. If you didn't request this, ignore it and immediately change your password.`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Forget Password - OTP',
        message,
        otp,
      });

      res.status(200).json({ message: 'OTP sent to email' });
    } catch (error) {
      user.resetPasswordOTP = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      console.error('Email Error details:', error);
      return res.status(500).json({ message: 'Email failed: ' + (error.message || error.toString()) });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user || !user.resetPasswordOTP) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const isMatch = await bcrypt.compare(String(otp), user.resetPasswordOTP);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user || !user.resetPasswordOTP) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const isMatch = await bcrypt.compare(String(otp), user.resetPasswordOTP);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(String(newPassword), salt);
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Download User Data (Posts, Images, Gallery)
// @route   GET /api/auth/download-data
// @access  Private
const downloadData = async (req, res) => {
  try {
    const user = req.user;
    const posts = await Post.find({ author: user._id });
    const uploadsBaseDir = path.resolve(__dirname, '../../uploads');

    res.attachment('HandS_UserData.zip');

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.on('error', function (err) {
      console.error('Archiver error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error creating archive' });
      } else {
        res.end();
      }
    });

    archive.pipe(res);

    let postsTextContent = `Data Export for ${user.username} (${user.email})\n\n--- Posts ---\n\n`;

    posts.forEach((post, index) => {
      if (post.content) {
        postsTextContent += `Post ${index + 1} (${new Date(post.createdAt).toLocaleString()}):\n${post.content}\n\n`;
      }

      if (post.mediaUrl && post.mediaType !== 'none') {
        const isGallery = !post.content && post.mediaType === 'image';
        const folderName = isGallery ? 'Gallery' : 'Images';

        if (post.mediaUrl.startsWith('data:')) {
          const matches = post.mediaUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const buffer = Buffer.from(matches[2], 'base64');
            const ext = matches[1].split('/')[1] || 'png';
            archive.append(buffer, { name: `${folderName}/post_${index}_media.${ext}` });
          }
        } else {
          // Safely resolve inside uploads directory to prevent path traversal
          const safeFilename = path.basename(post.mediaUrl);
          const filePath = path.resolve(uploadsBaseDir, safeFilename);
          if (filePath.startsWith(uploadsBaseDir) && fs.existsSync(filePath)) {
            archive.file(filePath, { name: `${folderName}/${safeFilename}` });
          }
        }
      }
    });

    archive.append(postsTextContent, { name: 'posts.txt' });

    await archive.finalize();
  } catch (error) {
    console.error('Download Data Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error generating zip' });
    }
  }
};

// @desc    Delete User Account
// @route   POST /api/auth/delete-account
// @access  Private
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const user = req.user;
    const userWithPassword = await User.findById(user._id);
    if (!userWithPassword) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(String(password), userWithPassword.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    // Unpair if partnered
    if (user.partner) {
      const partnerId = user.partner;
      const pairKey = [user._id.toString(), partnerId.toString()].sort().join('_');
      await User.findByIdAndUpdate(partnerId, { partner: null, pairedAt: null });
      await SharedListItem.deleteMany({ pair: pairKey });
      await SharedPet.deleteMany({ pair: pairKey });
      await CoupleActivity.deleteMany({ pair: pairKey });
    }

    // Delete all data associated with this user
    await Promise.all([
      Post.deleteMany({ author: user._id }),
      Message.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] }),
      Notification.deleteMany({ $or: [{ recipient: user._id }, { sender: user._id }] }),
      PairingRequest.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] }),
      DateEvent.deleteMany({ user: user._id }),
      MoodLog.deleteMany({ user: user._id }),
      Question.deleteMany({ user: user._id }),
      QuestionAnswer.deleteMany({ user: user._id }),
      WatchRoom.deleteMany({ host: user._id }),
      CoupleActivity.deleteMany({ user: user._id }),
      User.findByIdAndDelete(user._id),
    ]);

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete Account Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Clear pending animation
// @route   POST /api/auth/clear-animation
// @access  Private
const clearPendingAnimation = async (req, res) => {
  try {
    const user = req.user;
    if (user.pendingAnimation) {
      user.pendingAnimation = null;
      await user.save();
    }
    res.status(200).json({ message: 'Pending animation cleared' });
  } catch (error) {
    console.error('Clear pending animation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updatePushToken,
  updateProfile,
  forgotPassword,
  verifyOTP,
  resetPassword,
  updateLocation,
  updateTrip,
  downloadData,
  deleteAccount,
  clearPendingAnimation,
};
