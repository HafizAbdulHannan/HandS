const express = require('express');
const router = express.Router();
const { getMessages, sendMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const { requirePairing } = require('../middleware/pairMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);
router.use(requirePairing);

router.get('/', getMessages);
router.post('/', upload.single('media'), sendMessage);

module.exports = router;
