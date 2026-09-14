const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/', protect, (req, res, next) => {
  upload.single('media')(req, res, (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(400).json({ message: err.message || 'File upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded or invalid file format' });
    }
    res.json({ url: `/${req.file.path.replace(/\\/g, '/')}` });
  });
});

module.exports = router;
