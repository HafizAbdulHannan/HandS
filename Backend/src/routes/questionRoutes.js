const express = require('express');
const router = express.Router();
const { getTodayQuestion, answerQuestion } = require('../controllers/questionController');
const { protect } = require('../middleware/authMiddleware');
const { requirePairing } = require('../middleware/pairMiddleware');

router.use(protect);
router.use(requirePairing);

router.get('/today', getTodayQuestion);
router.post('/answer', answerQuestion);

module.exports = router;
