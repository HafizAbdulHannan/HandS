const mongoose = require('mongoose');

const dailyQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  date: {
    type: String, // 'YYYY-MM-DD'
    required: true,
    unique: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('DailyQuestion', dailyQuestionSchema);
