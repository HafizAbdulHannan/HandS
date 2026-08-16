const Message = require('../models/Message');

// @desc    Get all messages between user and partner
// @route   GET /api/messages
// @access  Private (Requires Pairing)
const getMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const partnerId = req.user.partner;

    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: partnerId },
        { sender: partnerId, receiver: userId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching messages' });
  }
};

// @desc    Send a new message
// @route   POST /api/messages
// @access  Private (Requires Pairing)
const sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const userId = req.user._id;
    const partnerId = req.user.partner;

    if (!text) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const message = await Message.create({
      sender: userId,
      receiver: partnerId,
      text,
    });

    res.status(201).json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error sending message' });
  }
};

module.exports = {
  getMessages,
  sendMessage,
};
