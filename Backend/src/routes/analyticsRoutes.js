const express = require('express');
const router = express.Router();
const { pingActivity, getCoupleAnalytics } = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

router.post('/ping', protect, pingActivity);
router.get('/', protect, getCoupleAnalytics);

module.exports = router;
