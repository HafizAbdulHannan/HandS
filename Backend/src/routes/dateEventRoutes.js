const express = require('express');
const router = express.Router();
const { getDates, createDate, deleteDate } = require('../controllers/dateEventController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getDates)
  .post(protect, createDate);

router.route('/:id')
  .delete(protect, deleteDate);

module.exports = router;
