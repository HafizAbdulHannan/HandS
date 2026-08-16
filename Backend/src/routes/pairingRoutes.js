const express = require('express');
const router = express.Router();
const {
  searchPartner,
  sendPairingRequest,
  getPendingRequests,
  acceptPairingRequest,
  rejectPairingRequest,
  getPartnerDetails,
  unpair
} = require('../controllers/pairingController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/search', searchPartner);
router.post('/request', sendPairingRequest);
router.get('/requests', getPendingRequests);
router.post('/accept/:requestId', acceptPairingRequest);
router.post('/reject/:requestId', rejectPairingRequest);
router.get('/partner', getPartnerDetails);
router.post('/unpair', unpair);

module.exports = router;
