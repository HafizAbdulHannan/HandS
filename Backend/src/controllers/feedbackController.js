const Feedback = require('../models/Feedback');

exports.getFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find().populate('user', 'fullName username avatar').sort({ createdAt: -1 });
    res.status(200).json(feedbacks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submitFeedback = async (req, res) => {
  try {
    const { rating, text } = req.body;
    const numericRating = Number(rating);

    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: 'Please provide a valid rating between 1 and 5' });
    }

    let imageUrl = '';
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const feedback = await Feedback.create({
      user: req.user._id,
      rating: numericRating,
      text: text ? String(text).trim() : '',
      imageUrl
    });

    await feedback.populate('user', 'fullName username avatar');

    res.status(201).json(feedback);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.likeFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: 'Not found' });
    
    feedback.likes += 1;
    await feedback.save();
    res.status(200).json(feedback);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
