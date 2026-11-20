const Message = require('../models/Message');

// @desc    Get all messages between user and partner
// @route   GET /api/messages
// @access  Private (Requires Pairing)
const getMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const partnerId = req.user.partner;

    if (!partnerId) {
      return res.status(200).json([]);
    }

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
    let audioUrl = req.body.audioUrl || '';
    let mediaUrl = req.body.mediaUrl || '';
    const userId = req.user._id;
    const partnerId = req.user.partner;

    if (!partnerId) {
      return res.status(400).json({ message: 'You must connect with a partner before sending messages' });
    }

    if (req.file) {
      const filePath = `/uploads/${req.file.filename}`;
      const isAudioFile =
        req.file.mimetype.startsWith('audio') ||
        /\.(m4a|mp3|wav|aac|ogg)$/i.test(req.file.originalname) ||
        req.body.type === 'audio';

      if (isAudioFile) {
        audioUrl = filePath;
      } else {
        mediaUrl = filePath;
      }
    }

    if (!text && !audioUrl && !mediaUrl) {
      return res.status(400).json({ message: 'Message must contain text, audio, or media' });
    }

    const message = await Message.create({
      sender: userId,
      receiver: partnerId,
      text: text || '',
      audioUrl: audioUrl || '',
      mediaUrl: mediaUrl || '',
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
