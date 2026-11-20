const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const Question = require('../models/Question');

// GET Stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    
    const feedbackStats = await Feedback.aggregate([
      { $group: { _id: null, averageRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } }
    ]);
    
    let averageRating = '5.0';
    let totalReviews = 0;
    if (feedbackStats.length > 0 && feedbackStats[0].averageRating != null) {
      averageRating = feedbackStats[0].averageRating.toFixed(1);
      totalReviews = feedbackStats[0].totalReviews;
    }
    
    res.json({
      totalUsers,
      averageRating,
      totalReviews,
      syncAccuracy: '99.9%'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Feedbacks
router.get('/feedback', async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate('user', 'fullName username')
      .sort({ createdAt: -1 })
      .limit(10);
      
    const formatted = feedbacks.map(fb => ({
      ...fb.toObject(),
      comment: fb.text || '',
      name: fb.user ? (fb.user.fullName || fb.user.username) : 'Anonymous'
    }));
    
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Questions
router.get('/questions', async (req, res) => {
  try {
    const questions = await Question.find()
      .populate('user', 'fullName username')
      .sort({ createdAt: -1 })
      .limit(10);
      
    const formatted = questions.map(q => ({
      ...q.toObject(),
      question: q.questionText || '',
      reply: q.devReply || '',
      name: q.user ? (q.user.fullName || q.user.username) : 'Anonymous'
    }));
    
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Question
router.post('/questions', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Question message is required' });
    }
    
    const newQuestion = {
      name: name ? String(name).trim() : 'Anonymous',
      email: email ? String(email).trim() : '',
      question: String(message).trim(),
      reply: ''
    };
    
    res.status(201).json(newQuestion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
