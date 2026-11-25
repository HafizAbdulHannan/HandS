const Message = require('../models/Message');

const inferMediaType = (file, mediaUrl, explicitType) => {
  if (explicitType && ['none', 'image', 'video', 'audio', 'file'].includes(explicitType)) {
    return explicitType;
  }
  if (file) {
    if (file.mimetype?.startsWith('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname || '')) {
      return 'image';
    }
    if (file.mimetype?.startsWith('video') || /\.(mp4|mov|mkv|avi|webm)$/i.test(file.originalname || '')) {
      return 'video';
    }
    if (file.mimetype?.startsWith('audio') || /\.(m4a|mp3|wav|aac|ogg)$/i.test(file.originalname || '')) {
      return 'audio';
    }
    return 'file';
  }
  if (mediaUrl) {
    if (mediaUrl.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(mediaUrl)) {
      return 'image';
    }
    if (/\.(mp4|mov|mkv|avi|webm)(\?.*)?$/i.test(mediaUrl)) {
      return 'video';
    }
    return 'file';
  }
  return 'none';
};

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
      deletedFor: { $ne: userId },
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
    let fileName = req.body.fileName || '';
    let mediaType = req.body.mediaType || 'none';
    const userId = req.user._id;
    const partnerId = req.user.partner;

    if (!partnerId) {
      return res.status(400).json({ message: 'You must connect with a partner before sending messages' });
    }

    if (req.file) {
      const filePath = `/uploads/${req.file.filename}`;
      if (!fileName) fileName = req.file.originalname || req.file.filename;
      const isAudioFile =
        req.file.mimetype.startsWith('audio') ||
        /\.(m4a|mp3|wav|aac|ogg)$/i.test(req.file.originalname) ||
        req.body.type === 'audio';

      if (isAudioFile) {
        audioUrl = filePath;
        mediaType = 'audio';
      } else {
        mediaUrl = filePath;
        mediaType = inferMediaType(req.file, filePath, req.body.mediaType);
      }
    } else if (audioUrl) {
      mediaType = 'audio';
    } else if (mediaUrl) {
      mediaType = inferMediaType(null, mediaUrl, req.body.mediaType);
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
      mediaType,
      fileName: fileName || '',
    });

    res.status(201).json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error sending message' });
  }
};

// @desc    Delete message for me or for everyone
// @route   DELETE /api/messages/:id?scope=me|everyone
// @access  Private (Requires Pairing)
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = String(req.query.scope || req.body?.scope || 'me').toLowerCase();
    const userId = req.user._id;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const isSender = message.sender.toString() === userId.toString();
    const isReceiver = message.receiver.toString() === userId.toString();

    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    if (scope === 'everyone') {
      if (!isSender) {
        return res.status(403).json({ message: 'Only the sender can delete a message for everyone' });
      }
      message.deletedForEveryone = true;
      message.text = '';
      message.audioUrl = '';
      message.mediaUrl = '';
      message.mediaType = 'none';
      message.fileName = '';
      await message.save();
      return res.status(200).json({ message: 'Deleted for everyone', scope: 'everyone', data: message });
    }

    // Delete for me
    if (!message.deletedFor.some((uid) => uid.toString() === userId.toString())) {
      message.deletedFor.push(userId);
      await message.save();
    }

    res.status(200).json({ message: 'Deleted for you', scope: 'me', id: message._id });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error deleting message' });
  }
};

module.exports = {
  getMessages,
  sendMessage,
  deleteMessage,
};
