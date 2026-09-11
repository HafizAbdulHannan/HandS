const DailyQuestion = require('../models/DailyQuestion');
const QuestionAnswer = require('../models/QuestionAnswer');

// Generate a random daily question if it doesn't exist
const getTodayQuestion = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let question = await DailyQuestion.findOne({ date: today });
    
    if (!question) {
      const sampleQuestions = [
        "What was your first impression of me?",
        "Where is our dream vacation?",
        "What is your favorite memory of us?",
        "What is something I do that always makes you smile?",
        "If we could live anywhere in the world, where would it be?"
      ];
      const randomQ = sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)];
      question = await DailyQuestion.create({ question: randomQ, date: today });
    }

    const userId = req.user._id;
    const partnerId = req.user.partner;

    const myAnswer = await QuestionAnswer.findOne({ user: userId, questionId: question._id });
    const partnerAnswer = await QuestionAnswer.findOne({ user: partnerId, questionId: question._id });

    // Blind logic: only reveal partner's answer if I have answered
    const responseData = {
      _id: question._id,
      question: question.question,
      myAnswer: myAnswer ? myAnswer.answer : null,
      partnerAnswer: myAnswer && partnerAnswer ? partnerAnswer.answer : (partnerAnswer ? 'HIDDEN' : null)
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const answerQuestion = async (req, res) => {
  try {
    const { questionId, answer } = req.body;
    
    if (!answer) return res.status(400).json({ message: 'Answer is required' });

    let existingAnswer = await QuestionAnswer.findOne({ user: req.user._id, questionId });
    if (existingAnswer) {
      existingAnswer.answer = answer;
      await existingAnswer.save();
    } else {
      await QuestionAnswer.create({ user: req.user._id, questionId, answer });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getTodayQuestion,
  answerQuestion
};
