const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, updatePushToken, updateProfile, forgotPassword, verifyOTP, resetPassword, updateLocation, downloadData, deleteAccount, clearPendingAnimation } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.put('/push-token', protect, updatePushToken);
router.put('/profile', protect, updateProfile);
router.put('/location', protect, updateLocation);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);
router.post('/clear-animation', protect, clearPendingAnimation);

// New Routes for Data Download and Account Deletion
router.get('/download-data', protect, downloadData);
router.post('/delete-account', protect, deleteAccount);

module.exports = router;
