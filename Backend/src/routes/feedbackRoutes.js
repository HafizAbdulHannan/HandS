const express = require('express');
const router = express.Router();
const { getFeedbacks, submitFeedback, likeFeedback } = require('../controllers/feedbackController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../controllers/authController');

router.get('/', getFeedbacks); // Public or protect depending on Web UI, let's allow all authenticated for app

router.use(protect);
router.post('/', upload.single('media'), submitFeedback);
router.post('/:id/like', likeFeedback);

module.exports = router;
