const mongoose = require('mongoose');

const sharedListItemSchema = new mongoose.Schema({
  pair: {
    type: String, // combination of both user IDs sorted
    required: true,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

module.exports = mongoose.model('SharedListItem', sharedListItemSchema);
