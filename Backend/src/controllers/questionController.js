const Question = require('../models/Question');

exports.getQuestions = async (req, res) => {
  try {
    const questions = await Question.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submitQuestion = async (req, res) => {
  try {
    const { questionText } = req.body;
    let imageUrl = '';
    
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const question = await Question.create({
      user: req.user._id,
      questionText,
      imageUrl
    });

    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getDailyQuestion = async (req, res) => {
  try {
    const DailyQuestion = require('../models/DailyQuestion');
    const QuestionAnswer = require('../models/QuestionAnswer');
    const User = require('../models/User');

    const todayStr = new Date().toISOString().split('T')[0];
    
    // Find or create today's question
    let dailyQ = await DailyQuestion.findOne({ date: todayStr });
    if (!dailyQ) {
      dailyQ = await DailyQuestion.create({
        date: todayStr,
        question: "What made you smile today?",
      });
    }

    const myAnswerDoc = await QuestionAnswer.findOne({ user: req.user._id, questionId: dailyQ._id });
    const user = await User.findById(req.user._id);
    let partnerAnswerDoc = null;
    
    if (user.partner) {
      partnerAnswerDoc = await QuestionAnswer.findOne({ user: user.partner, questionId: dailyQ._id });
    }

    let partnerAnswer = null;
    if (partnerAnswerDoc) {
      if (myAnswerDoc) {
        partnerAnswer = partnerAnswerDoc.answer;
      } else {
        partnerAnswer = 'HIDDEN';
      }
    }

    res.status(200).json({
      _id: dailyQ._id,
      question: dailyQ.question,
      myAnswer: myAnswerDoc ? myAnswerDoc.answer : null,
      partnerAnswer: partnerAnswer
    });
  } catch (error) {
    console.error('Error fetching daily question:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submitDailyAnswer = async (req, res) => {
  try {
    const QuestionAnswer = require('../models/QuestionAnswer');
    const { questionId, answer } = req.body;
    
    await QuestionAnswer.findOneAndUpdate(
      { user: req.user._id, questionId },
      { answer },
      { upsert: true, new: true }
    );
    
    res.status(200).json({ message: 'Answer submitted successfully' });
  } catch (error) {
    console.error('Error submitting daily answer:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
