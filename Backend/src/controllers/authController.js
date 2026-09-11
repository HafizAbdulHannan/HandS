const User = require('../models/User');
const Post = require('../models/Post');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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
    console.error('updateProfile error name:', error.name);
    console.error('updateProfile error message:', error.message);
    console.error('updateProfile error code:', error.code);
    res.status(500).json({ message: error.message || 'Server error' });
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

    const message = `Dear ${user.fullName},\nhere is you one time pass for HandS app.\n${otp}\nPlease do not share it to anyone. If you don't requested it ignore it and immideately change your password.`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Forget Password - OTP',
        message,
        otp, // Explicitly pass the OTP code for EmailJS templates
      });

      res.status(200).json({ message: 'OTP sent to email', mockOtp: otp });
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

// @desc    Download User Data (Posts, Images, Gallery)
// @route   GET /api/auth/download-data
// @access  Private
const downloadData = async (req, res) => {
  try {
    const user = req.user;
    const posts = await Post.find({ author: user._id });

    // Set response headers for zip file download
    res.attachment('HandS_UserData.zip');
    
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    archive.on('error', function(err) {
      throw err;
    });

    archive.pipe(res);

    let postsTextContent = `Data Export for ${user.username} (${user.email})\n\n--- Posts ---\n\n`;

    posts.forEach((post, index) => {
      // Append text content
      if (post.content) {
        postsTextContent += `Post ${index + 1} (${new Date(post.createdAt).toLocaleString()}):\n${post.content}\n\n`;
      }

      // Handle media files
      if (post.mediaUrl && post.mediaType !== 'none') {
        const isGallery = !post.content && post.mediaType === 'image';
        const folderName = isGallery ? 'Gallery' : 'Images';
        
        // Check if mediaUrl is a base64 string or a local file path
        if (post.mediaUrl.startsWith('data:')) {
          const matches = post.mediaUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const buffer = Buffer.from(matches[2], 'base64');
            const ext = matches[1].split('/')[1] || 'png';
            archive.append(buffer, { name: `${folderName}/post_${index}_media.${ext}` });
          }
        } else {
          // Local file path
          const filePath = path.join(__dirname, '..', '..', post.mediaUrl);
          if (fs.existsSync(filePath)) {
            archive.file(filePath, { name: `${folderName}/${path.basename(post.mediaUrl)}` });
          }
        }
      }
    });

    archive.append(postsTextContent, { name: 'posts.txt' });

    await archive.finalize();
  } catch (error) {
    console.error('Download Data Error:', error);
    // Note: If headers are already sent due to pipe, we can't send JSON anymore.
    // However, if it errors before that, we can.
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
    const { password, reason } = req.body;
    const user = req.user;

    // Fetch user with password since req.user excludes it
    const userWithPassword = await User.findById(user._id);

    // Validate password
    const isMatch = await bcrypt.compare(password, userWithPassword.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    // Unpair if partnered
    if (user.partner) {
      const partnerUser = await User.findById(user.partner);
      if (partnerUser) {
        partnerUser.partner = null;
        await partnerUser.save();
      }
    }

    // Delete all posts by this user
    await Post.deleteMany({ author: user._id });

    // Note: If using local uploads, ideally we'd also delete the actual files from disk.
    // For simplicity and since we don't have the full list of files to unlink easily here
    // without scanning all posts first, we'll just delete from DB.

    // Delete the user
    await User.findByIdAndDelete(user._id);

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
  downloadData,
  deleteAccount,
  clearPendingAnimation,
};
