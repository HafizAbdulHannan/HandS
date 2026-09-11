const mongoose = require('mongoose');

const questionAnswerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DailyQuestion',
    required: true,
  },
  answer: {
    type: String,
    required: true,
  },
}, { timestamps: true });

// A user can only answer a question once
questionAnswerSchema.index({ user: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model('QuestionAnswer', questionAnswerSchema);
