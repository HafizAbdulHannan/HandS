const express = require('express');
const router = express.Router();
const { getQuestions, submitQuestion, getDailyQuestion, submitDailyAnswer } = require('../controllers/questionController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);
router.get('/', getQuestions);
router.post('/', upload.single('media'), submitQuestion);
router.get('/today', getDailyQuestion);
router.post('/answer', submitDailyAnswer);

module.exports = router;
