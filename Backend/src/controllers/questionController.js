const Question = require('../models/Question');
const DailyQuestion = require('../models/DailyQuestion');
const QuestionAnswer = require('../models/QuestionAnswer');
const User = require('../models/User');

const DAILY_QUESTIONS_POOL = [
  "What made you smile today?",
  "What is your favorite memory of us together so far?",
  "If we could travel anywhere in the world tomorrow, where would we go?",
  "What is one small thing I do that makes you feel most loved?",
  "What song reminds you of our relationship right now?",
  "What is a dream or goal you want us to achieve together this year?",
  "What would our ideal lazy Sunday look like?",
  "What was your very first impression of me?",
  "What is one thing you appreciate most about our partnership?",
  "If we cooked a three-course dinner together tonight, what would be on the menu?",
  "What is something new you'd love for us to try together?",
  "When did you first realize how much I meant to you?",
  "What is a funny moment between us that still makes you laugh?",
  "How can I best support you when you're having a stressful day?"
];

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
    if (!questionText || !String(questionText).trim()) {
      return res.status(400).json({ message: 'Question text is required' });
    }

    let imageUrl = '';
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const question = await Question.create({
      user: req.user._id,
      questionText: String(questionText).trim(),
      imageUrl
    });

    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getDailyQuestion = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Find or create today's question with deterministic daily rotation
    let dailyQ = await DailyQuestion.findOne({ date: todayStr });
    if (!dailyQ) {
      const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % DAILY_QUESTIONS_POOL.length;
      dailyQ = await DailyQuestion.create({
        date: todayStr,
        question: DAILY_QUESTIONS_POOL[dayIndex],
      });
    }

    const myAnswerDoc = await QuestionAnswer.findOne({ user: req.user._id, questionId: dailyQ._id });
    const user = await User.findById(req.user._id);
    let partnerAnswerDoc = null;
    
    if (user && user.partner) {
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
    const { questionId, answer } = req.body;
    if (!questionId || !answer || !String(answer).trim()) {
      return res.status(400).json({ message: 'Question ID and answer are required' });
    }

    const dailyQ = await DailyQuestion.findById(questionId);
    if (!dailyQ) {
      return res.status(404).json({ message: 'Daily question not found' });
    }
    
    await QuestionAnswer.findOneAndUpdate(
      { user: req.user._id, questionId },
      { answer: String(answer).trim() },
      { upsert: true, new: true }
    );
    
    res.status(200).json({ message: 'Answer submitted successfully' });
  } catch (error) {
    console.error('Error submitting daily answer:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
