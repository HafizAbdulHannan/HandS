const DateEvent = require('../models/DateEvent');

// @desc    Get all date events for user and partner
// @route   GET /api/dates
// @access  Private
const getDates = async (req, res) => {
  try {
    const userId = req.user._id;
    const partnerId = req.user.partner;

    const query = partnerId 
      ? { $or: [{ user: userId }, { user: partnerId }] }
      : { user: userId };

    const dates = await DateEvent.find(query).sort({ date: 1 }).populate('user', 'username avatar');
    res.status(200).json(dates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a date event
// @route   POST /api/dates
// @access  Private
const createDate = async (req, res) => {
  try {
    const { title, date, customSoundUrl } = req.body;

    if (!title || !date) {
      return res.status(400).json({ message: 'Title and date are required' });
    }

    const newDate = await DateEvent.create({
      title,
      date,
      customSoundUrl: customSoundUrl || '',
      user: req.user._id,
      partner: req.user.partner
    });

    const populatedDate = await DateEvent.findById(newDate._id).populate('user', 'username avatar');
    res.status(201).json(populatedDate);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a date event
// @route   DELETE /api/dates/:id
// @access  Private
const deleteDate = async (req, res) => {
  try {
    const dateEvent = await DateEvent.findById(req.params.id);

    if (!dateEvent) {
      return res.status(404).json({ message: 'Date not found' });
    }

    // Only creator can delete for now, or partner? Let's allow both
    if (dateEvent.user.toString() !== req.user._id.toString() && 
        (!req.user.partner || dateEvent.user.toString() !== req.user.partner.toString())) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await dateEvent.deleteOne();
    res.status(200).json({ id: req.params.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getDates,
  createDate,
  deleteDate
};
