const User = require('../models/User');
const PairingRequest = require('../models/PairingRequest');

// @desc    Search for a partner by username or email
// @route   GET /api/pairing/search?q=...
// @access  Private
const searchPartner = async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ message: 'Search query is required' });
  }

  try {
    // Cannot search for yourself
    const users = await User.find({
      $or: [{ username: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }],
      _id: { $ne: req.user._id }
    }).select('-password');

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
      .populate('sender', 'username email avatar');
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

    // Update both users to reference each other
    await User.findByIdAndUpdate(request.sender, { partner: req.user._id });
    await User.findByIdAndUpdate(req.user._id, { partner: request.sender });

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
    const partner = await User.findById(req.user.partner).select('-password');
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

    // Mark request as rejected (or delete it)
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
    await User.findByIdAndUpdate(user._id, { partner: null });
    await User.findByIdAndUpdate(partnerId, { partner: null });

    // Optional: Delete old pairing requests between them if needed
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
