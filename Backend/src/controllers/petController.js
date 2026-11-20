const SharedPet = require('../models/SharedPet');

const getPairKey = (user) => {
  if (user.partner) {
    return [user._id.toString(), user.partner.toString()].sort().join('_');
  }
  return user._id.toString();
};

const applyHealthDecay = async (pet) => {
  const now = Date.now();
  const lastFedTime = pet.lastFed ? pet.lastFed.getTime() : now;
  const hoursSinceFed = Math.floor((now - lastFedTime) / (1000 * 60 * 60));
  if (hoursSinceFed > 0) {
    pet.health = Math.max(0, pet.health - hoursSinceFed);
    // Advance lastFed by the decayed hours so repeated refreshes don't drain health again
    pet.lastFed = new Date(lastFedTime + hoursSinceFed * 1000 * 60 * 60);
    await pet.save();
  }
  return pet;
};

const getPet = async (req, res) => {
  try {
    const pair = getPairKey(req.user);
    let pet = await SharedPet.findOne({ pair });
    
    if (!pet) {
      pet = await SharedPet.create({ pair });
    } else {
      pet = await applyHealthDecay(pet);
    }
    
    res.status(200).json(pet);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const interactPet = async (req, res) => {
  try {
    const { action } = req.body; // 'feed', 'play'
    if (!['feed', 'play'].includes(action)) {
      return res.status(400).json({ message: 'Invalid pet action' });
    }

    const pair = getPairKey(req.user);
    let pet = await SharedPet.findOne({ pair });
    
    if (!pet) {
      pet = await SharedPet.create({ pair });
    } else {
      pet = await applyHealthDecay(pet);
    }
    
    if (action === 'feed') {
      pet.health = Math.min(100, pet.health + 20);
      pet.lastFed = new Date();
      pet.xp += 10;
    } else if (action === 'play') {
      pet.xp += 15;
    }
    
    // Level up logic
    while (pet.xp >= pet.level * 100) {
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
