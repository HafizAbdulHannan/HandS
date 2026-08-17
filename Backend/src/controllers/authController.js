const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

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

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      fullName,
      username,
      phoneNumber,
      email,
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
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
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
    
    if (fullName) user.fullName = fullName;
    if (username) {
      const existingUser = await User.findOne({ username });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      user.username = username;
    }
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
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
        lat: latitude,
        lng: longitude,
        updatedAt: new Date()
      };
      await req.user.save();
      // Optionally, we can notify partner via socket.io, but the socket is handled in server.js.
      // Since this is for background updates, we will just save to DB.
      // Partner map screen will need to periodically fetch or we can integrate socket here if needed.
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
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const salt = await bcrypt.genSalt(10);
    const hashedOTP = await bcrypt.hash(otp, salt);

    user.resetPasswordOTP = hashedOTP;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Use ethereal email for testing
    let testAccount = await nodemailer.createTestAccount();
    
    let transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const message = {
      from: '"HandS Support" <support@hands.local>',
      to: user.email,
      subject: 'Password Reset OTP',
      text: `You requested a password reset. Your OTP is: ${otp}`,
    };

    const info = await transporter.sendMail(message);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log("OTP: %s", otp);
    console.log("Preview URL: %s", previewUrl);

    res.status(200).json({ 
      message: 'OTP sent to email (check server console for Ethereal URL if using test account)', 
      previewUrl 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Email could not be sent' });
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ 
      email,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user || !user.resetPasswordOTP) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const isMatch = await bcrypt.compare(otp, user.resetPasswordOTP);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error(error);
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
  resetPassword,
  updateLocation,
};
