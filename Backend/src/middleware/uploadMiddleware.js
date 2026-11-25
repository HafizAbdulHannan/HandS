const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(
      null,
      `${file.fieldname}-${Date.now()}${safeExt || '.bin'}`
    );
  },
});

function checkFileType(file, cb) {
  const filetypes = /^\.(jpg|jpeg|png|gif|webp|heic|mp4|mov|mkv|avi|pdf|doc|docx|xls|xlsx|ppt|pptx|csv|zip|txt|mp3|wav|m4a|aac|webm|ogg)$/i;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Mobile app might send generic application/octet-stream for audio/video files
  if (extname) {
    return cb(null, true);
  } else {
    return cb(new Error('Images, Videos, Audio, and Files only!'));
  }
}

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

module.exports = upload;
