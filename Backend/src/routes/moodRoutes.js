const express = require('express');
const router = express.Router();
const { logMood, getMoods } = require('../controllers/moodController');
const { protect } = require('../middleware/authMiddleware');
const { requirePairing } = require('../middleware/pairMiddleware');

router.use(protect);

router.post('/', logMood);
router.get('/', requirePairing, getMoods);

module.exports = router;
