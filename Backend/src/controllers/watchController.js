const WatchRoom = require('../models/WatchRoom');
const crypto = require('crypto');

// @desc    Create a new watch room
// @route   POST /api/watch/create
// @access  Private
exports.createRoom = async (req, res) => {
  try {
    const { roomName } = req.body;
    if (!roomName) {
      return res.status(400).json({ message: 'Room name is required' });
    }

    const roomCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const room = await WatchRoom.create({
      roomCode,
      roomName,
      host: req.user._id,
      participants: [req.user._id]
    });

    res.status(201).json({
      success: true,
      room
    });
  } catch (error) {
    console.error('Error creating watch room:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Join an existing watch room
// @route   POST /api/watch/join
// @access  Private
exports.joinRoom = async (req, res) => {
  try {
    const { roomCode } = req.body;
    if (!roomCode) {
      return res.status(400).json({ message: 'Room code is required' });
    }

    const room = await WatchRoom.findOne({ roomCode });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!room.participants.includes(req.user._id)) {
      room.participants.push(req.user._id);
      await room.save();
    }

    res.status(200).json({
      success: true,
      room
    });
  } catch (error) {
    console.error('Error joining watch room:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get room details
// @route   GET /api/watch/:roomId
// @access  Private
exports.getRoom = async (req, res) => {
  try {
    const room = await WatchRoom.findById(req.params.roomId).populate('host participants', 'name email profilePic');
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.status(200).json({
      success: true,
      room
    });
  } catch (error) {
    console.error('Error getting watch room:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a watch room
// @route   DELETE /api/watch/:roomId
// @access  Private
exports.deleteRoom = async (req, res) => {
  try {
    const room = await WatchRoom.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this room' });
    }

    await WatchRoom.findByIdAndDelete(req.params.roomId);

    res.status(200).json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting watch room:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
