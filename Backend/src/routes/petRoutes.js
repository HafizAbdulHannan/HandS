const express = require('express');
const router = express.Router();
const { getPet, interactPet } = require('../controllers/petController');
const { protect } = require('../middleware/authMiddleware');
const { requirePairing } = require('../middleware/pairMiddleware');

router.use(protect);
router.use(requirePairing);

router.get('/', getPet);
router.post('/interact', interactPet);

module.exports = router;
