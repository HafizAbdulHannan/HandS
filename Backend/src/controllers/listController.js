const SharedListItem = require('../models/SharedListItem');

const getPairKey = (user) => {
  if (user.partner) {
    return [user._id.toString(), user.partner.toString()].sort().join('_');
  }
  return user._id.toString();
};

const getItems = async (req, res) => {
  try {
    const pair = getPairKey(req.user);
    const items = await SharedListItem.find({ pair }).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const addItem = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: 'Text is required' });
    }
    
    const pair = getPairKey(req.user);
    const item = await SharedListItem.create({
      pair,
      creator: req.user._id,
      text: String(text).trim(),
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const toggleItem = async (req, res) => {
  try {
    const pair = getPairKey(req.user);
    const item = await SharedListItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (item.pair !== pair) {
      return res.status(403).json({ message: 'Not authorized to modify this item' });
    }
    
    item.completed = !item.completed;
    await item.save();
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteItem = async (req, res) => {
  try {
    const pair = getPairKey(req.user);
    const item = await SharedListItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (item.pair !== pair) {
      return res.status(403).json({ message: 'Not authorized to delete this item' });
    }

    await item.deleteOne();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getItems, addItem, toggleItem, deleteItem };
