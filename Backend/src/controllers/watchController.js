const WatchRoom = require('../models/WatchRoom');
const mongoose = require('mongoose');
const crypto = require('crypto');

// @desc    Create a new watch room
// @route   POST /api/watch/create
// @access  Private
exports.createRoom = async (req, res) => {
  try {
    const { roomName } = req.body;
    if (!roomName || !String(roomName).trim()) {
      return res.status(400).json({ message: 'Room name is required' });
    }

    let roomCode;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = crypto.randomBytes(3).toString('hex').toUpperCase();
      const existing = await WatchRoom.findOne({ roomCode: candidate });
      if (!existing) {
        roomCode = candidate;
        break;
      }
    }
    if (!roomCode) {
      roomCode = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
    }

    const room = await WatchRoom.create({
      roomCode,
      roomName: String(roomName).trim(),
      host: req.user._id,
      participants: [req.user._id]
    });

    await room.populate('host participants', 'fullName username email avatar');

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
    if (!roomCode || !String(roomCode).trim()) {
      return res.status(400).json({ message: 'Room code is required' });
    }

    const normalizedCode = String(roomCode).trim().toUpperCase();
    const room = await WatchRoom.findOne({ roomCode: normalizedCode });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!room.participants.some(id => id.toString() === req.user._id.toString())) {
      room.participants.push(req.user._id);
      await room.save();
    }

    await room.populate('host participants', 'fullName username email avatar');

    res.status(200).json({
      success: true,
      room
    });
  } catch (error) {
    console.error('Error joining watch room:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get room details (by ObjectId or roomCode)
// @route   GET /api/watch/:roomId
// @access  Private
exports.getRoom = async (req, res) => {
  try {
    const param = String(req.params.roomId || '').trim();
    let room = null;

    if (mongoose.Types.ObjectId.isValid(param)) {
      room = await WatchRoom.findById(param).populate('host participants', 'fullName username email avatar');
    }
    if (!room && param && param !== 'undefined') {
      room = await WatchRoom.findOne({ roomCode: param.toUpperCase() }).populate('host participants', 'fullName username email avatar');
    }

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
    const param = String(req.params.roomId || '').trim();
    let room = null;
    if (mongoose.Types.ObjectId.isValid(param)) {
      room = await WatchRoom.findById(param);
    }
    if (!room && param) {
      room = await WatchRoom.findOne({ roomCode: param.toUpperCase() });
    }

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this room' });
    }

    await WatchRoom.findByIdAndDelete(room._id);

    res.status(200).json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting watch room:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
