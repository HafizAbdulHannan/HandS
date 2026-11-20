const MoodLog = require('../models/MoodLog');

const VALID_MOODS = ['happy', 'sad', 'angry', 'excited', 'tired', 'loved', 'stressed'];

// @desc    Log a new mood
// @route   POST /api/moods
// @access  Private
const logMood = async (req, res) => {
  try {
    const { mood, note } = req.body;
    
    if (!mood || !VALID_MOODS.includes(String(mood).toLowerCase())) {
      return res.status(400).json({ message: 'Valid mood is required' });
    }

    const normalizedMood = String(mood).toLowerCase();

    const moodLog = await MoodLog.create({
      user: req.user._id,
      mood: normalizedMood,
      note: note ? String(note).trim() : '',
    });

    req.user.mood = normalizedMood;
    await req.user.save();

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
    const authors = req.allowedAuthors || [req.user._id, req.user.partner].filter(Boolean);

    const moods = await MoodLog.find({
      user: { $in: authors }
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
