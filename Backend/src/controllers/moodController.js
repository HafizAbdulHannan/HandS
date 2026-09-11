const MoodLog = require('../models/MoodLog');

// @desc    Log a new mood
// @route   POST /api/moods
// @access  Private
const logMood = async (req, res) => {
  try {
    const { mood, note } = req.body;
    
    if (!mood) {
      return res.status(400).json({ message: 'Mood is required' });
    }

    const moodLog = await MoodLog.create({
      user: req.user._id,
      mood,
      note,
    });

    res.status(201).json(moodLog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error logging mood' });
  }
};

// @desc    Get mood history for paired users
// @route   GET /api/moods
// @access  Private (Requires Pairing)
const getMoods = async (req, res) => {
  try {
    const userId = req.user._id;
    const partnerId = req.user.partner;

    const moods = await MoodLog.find({
      user: { $in: [userId, partnerId] }
    }).sort({ date: -1 });

    res.status(200).json(moods);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching moods' });
  }
};

module.exports = {
  logMood,
  getMoods,
};
