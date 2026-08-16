const express = require('express');
const router = express.Router();
const {
  createPost,
  getFeed,
  getGallery,
  toggleLike,
  addComment,
  deletePost,
  updatePost
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');
const { requirePairing } = require('../middleware/pairMiddleware');

// All post routes require authentication and an active pairing link
router.use(protect);
router.use(requirePairing);

router.route('/')
  .get(getFeed)
  .post(createPost);

router.get('/gallery', getGallery);
router.put('/:id/like', toggleLike);
router.post('/:id/comment', addComment);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);

module.exports = router;
