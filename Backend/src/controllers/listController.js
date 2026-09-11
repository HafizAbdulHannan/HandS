const SharedListItem = require('../models/SharedListItem');

const getItems = async (req, res) => {
  try {
    const pair = [req.user._id, req.user.partner].sort().join('_');
    const items = await SharedListItem.find({ pair }).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const addItem = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'Text is required' });
    
    const pair = [req.user._id, req.user.partner].sort().join('_');
    const item = await SharedListItem.create({
      pair,
      creator: req.user._id,
      text,
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const toggleItem = async (req, res) => {
  try {
    const item = await SharedListItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    
    item.completed = !item.completed;
    await item.save();
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteItem = async (req, res) => {
  try {
    await SharedListItem.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getItems, addItem, toggleItem, deleteItem };
