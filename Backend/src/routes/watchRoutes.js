const express = require('express');
const router = express.Router();
const {
  createRoom,
  joinRoom,
  getRoom,
  deleteRoom
} = require('../controllers/watchController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/create', createRoom);
router.post('/join', joinRoom);
router.get('/:roomId', getRoom);
router.delete('/:roomId', deleteRoom);

module.exports = router;
