const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, updatePushToken, updateProfile, forgotPassword, resetPassword, updateLocation } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.put('/push-token', protect, updatePushToken);
router.put('/profile', protect, updateProfile);
router.put('/location', protect, updateLocation);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
