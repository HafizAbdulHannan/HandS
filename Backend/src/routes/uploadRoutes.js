const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/', protect, (req, res, next) => {
  upload.fields([{ name: 'media', maxCount: 1 }, { name: 'audio', maxCount: 1 }])(req, res, (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(400).json({ message: err.message || 'File upload failed' });
    }
    
    // Check if either media or audio was uploaded
    const uploadedFile = (req.files && req.files['media'] && req.files['media'][0]) || 
                         (req.files && req.files['audio'] && req.files['audio'][0]);
                         
    if (!uploadedFile) {
      return res.status(400).json({ message: 'No file uploaded or invalid file format' });
    }
    res.json({ url: `/${uploadedFile.path.replace(/\\/g, '/')}` });
  });
});

module.exports = router;
