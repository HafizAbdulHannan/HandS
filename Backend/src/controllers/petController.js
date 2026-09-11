const SharedPet = require('../models/SharedPet');

const getPet = async (req, res) => {
  try {
    const pair = [req.user._id, req.user.partner].sort().join('_');
    let pet = await SharedPet.findOne({ pair });
    
    if (!pet) {
      pet = await SharedPet.create({ pair });
    } else {
      // Calculate health decay (1 health per hour since last fed)
      const hoursSinceFed = Math.floor((Date.now() - pet.lastFed.getTime()) / (1000 * 60 * 60));
      if (hoursSinceFed > 0) {
        pet.health = Math.max(0, pet.health - hoursSinceFed);
        await pet.save();
      }
    }
    
    res.status(200).json(pet);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const interactPet = async (req, res) => {
  try {
    const { action } = req.body; // 'feed', 'play'
    const pair = [req.user._id, req.user.partner].sort().join('_');
    let pet = await SharedPet.findOne({ pair });
    
    if (!pet) return res.status(404).json({ message: 'Pet not found' });
    
    if (action === 'feed') {
      pet.health = Math.min(100, pet.health + 20);
      pet.lastFed = Date.now();
      pet.xp += 10;
    } else if (action === 'play') {
      pet.xp += 15;
    }
    
    // Level up logic
    if (pet.xp >= pet.level * 100) {
      pet.xp -= pet.level * 100;
      pet.level += 1;
    }
    
    await pet.save();
    res.status(200).json(pet);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getPet, interactPet };
