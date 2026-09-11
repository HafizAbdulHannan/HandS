const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/', protect, upload.single('media'), (req, res) => {
  res.send(`/${req.file.path.replace(/\\/g, '/')}`);
});

module.exports = router;
