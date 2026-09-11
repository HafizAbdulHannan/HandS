const express = require('express');
const router = express.Router();
const { getItems, addItem, toggleItem, deleteItem } = require('../controllers/listController');
const { protect } = require('../middleware/authMiddleware');
const { requirePairing } = require('../middleware/pairMiddleware');

router.use(protect);
router.use(requirePairing);

router.get('/', getItems);
router.post('/', addItem);
router.put('/:id/toggle', toggleItem);
router.delete('/:id', deleteItem);

module.exports = router;
