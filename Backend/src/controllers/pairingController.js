const User = require('../models/User');
const PairingRequest = require('../models/PairingRequest');
const Notification = require('../models/Notification');
const { sendPushNotification } = require('../utils/pushNotification');

// @desc    Search for a partner by username or email
// @route   GET /api/pairing/search?q=...
// @access  Private
const searchPartner = async (req, res) => {
  const { q } = req.query;

  if (!q || !String(q).trim()) {
    return res.status(400).json({ message: 'Search query is required' });
  }

  try {
    // Escape regex special characters to prevent ReDoS and SyntaxError crashes
    const escapedQuery = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'i');

    // Cannot search for yourself, only select public profile fields
    const users = await User.find({
      $or: [{ username: regex }, { email: regex }, { fullName: regex }],
      _id: { $ne: req.user._id }
    })
      .select('fullName username email avatar bio partner')
      .limit(25);

    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Send a pairing request
// @route   POST /api/pairing/request
// @access  Private
const sendPairingRequest = async (req, res) => {
  const { receiverId } = req.body;

  try {
    if (!receiverId) {
      return res.status(400).json({ message: 'Receiver ID is required' });
    }

    // Prevent self-pairing
    if (receiverId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot pair with yourself' });
    }

    // 1. Check if user already has a partner
    if (req.user.partner) {
      return res.status(400).json({ message: 'You already have a partner' });
    }

    // 2. Check if receiver exists and has a partner
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }
    if (receiver.partner) {
      return res.status(400).json({ message: 'This user already has a partner' });
    }

    // 3. Check if a request already exists
    const existingRequest = await PairingRequest.findOne({
      $or: [
        { sender: req.user._id, receiver: receiverId },
        { sender: receiverId, receiver: req.user._id }
      ],
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'A pending request already exists between you two' });
    }

    const request = await PairingRequest.create({
      sender: req.user._id,
      receiver: receiverId
    });

    if (receiver.pushToken) {
      sendPushNotification(
        receiver.pushToken,
        'New Pairing Request 💖',
        `${req.user.fullName || req.user.username} wants to connect with you!`
      ).catch((e) => console.error(e));
    }

    res.status(201).json(request);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get pending pairing requests for the logged-in user
// @route   GET /api/pairing/requests
// @access  Private
const getPendingRequests = async (req, res) => {
  try {
    const requests = await PairingRequest.find({ receiver: req.user._id, status: 'pending' })
      .populate('sender', 'fullName username email avatar');
    res.status(200).json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Accept a pairing request
// @route   POST /api/pairing/accept/:requestId
// @access  Private
const acceptPairingRequest = async (req, res) => {
  try {
    const request = await PairingRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.receiver.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is no longer pending' });
    }

    if (req.user.partner) {
      return res.status(400).json({ message: 'You already have a partner' });
    }

    const senderUser = await User.findById(request.sender);
    if (!senderUser) {
      return res.status(404).json({ message: 'Sender account no longer exists' });
    }
    if (senderUser.partner) {
      return res.status(400).json({ message: 'Sender is already paired with someone else' });
    }

    // Update both users to reference each other
    const pairedAt = new Date();
    await User.findByIdAndUpdate(request.sender, { partner: req.user._id, pairedAt });
    await User.findByIdAndUpdate(req.user._id, { partner: request.sender, pairedAt });

    // Mark request as accepted
    request.status = 'accepted';
    await request.save();

    // Delete any other pending requests for these users
    await PairingRequest.deleteMany({
      $or: [
        { sender: req.user._id, status: 'pending' },
        { receiver: req.user._id, status: 'pending' },
        { sender: request.sender, status: 'pending' },
        { receiver: request.sender, status: 'pending' }
      ]
    });

    await Notification.create({
      recipient: request.sender,
      sender: req.user._id,
      title: 'Partner Connected! ❤️',
      message: `${req.user.fullName || req.user.username} accepted your pairing request!`,
      type: 'other'
    });

    if (senderUser.pushToken) {
      sendPushNotification(
        senderUser.pushToken,
        'Partner Connected! ❤️',
        `${req.user.fullName || req.user.username} accepted your pairing request!`
      ).catch((e) => console.error(e));
    }

    res.status(200).json({ message: 'Pairing successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get partner details
// @route   GET /api/pairing/partner
// @access  Private
const getPartnerDetails = async (req, res) => {
  try {
    if (!req.user.partner) {
      return res.status(404).json({ message: 'No partner connected' });
    }
    const partner = await User.findById(req.user.partner)
      .select('fullName username email phoneNumber avatar bio mood partner location activeTrip pairedAt createdAt');
if (!partner) {
  return res.status(404).json({ message: 'Partner not found' });
}
res.status(200).json(partner);
  } catch (error) {
  console.error(error);
  res.status(500).json({ message: 'Server error' });
}
};

// @desc    Reject a pairing request
// @route   POST /api/pairing/reject/:requestId
// @access  Private
const rejectPairingRequest = async (req, res) => {
  try {
    const request = await PairingRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.receiver.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is no longer pending' });
    }

    request.status = 'rejected';
    await request.save();

    res.status(200).json({ message: 'Pairing request rejected' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Disconnect partner (Unpair)
// @route   POST /api/pairing/unpair
// @access  Private
const unpair = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.partner) {
      return res.status(400).json({ message: 'You are not paired' });
    }

    const partnerId = user.partner;

    // Remove partner reference from both users
    await User.findByIdAndUpdate(user._id, { partner: null, pairedAt: null, 'activeTrip.active': false });
    await User.findByIdAndUpdate(partnerId, { partner: null, pairedAt: null, 'activeTrip.active': false });

    await PairingRequest.deleteMany({
      $or: [
        { sender: user._id, receiver: partnerId },
        { sender: partnerId, receiver: user._id }
      ]
    });

    res.status(200).json({ message: 'Successfully disconnected from partner' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  searchPartner,
  sendPairingRequest,
  getPendingRequests,
  acceptPairingRequest,
  rejectPairingRequest,
  getPartnerDetails,
  unpair
};
