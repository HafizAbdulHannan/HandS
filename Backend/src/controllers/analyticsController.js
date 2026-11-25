const CoupleActivity = require('../models/CoupleActivity');
const MoodLog = require('../models/MoodLog');
const Message = require('../models/Message');
const Post = require('../models/Post');
const PairingRequest = require('../models/PairingRequest');
const User = require('../models/User');

const POSITIVE_MOODS = ['happy', 'loved', 'excited'];
const MOOD_LABELS = {
  happy: { label: 'Happy', emoji: '😄' },
  loved: { label: 'Loved', emoji: '🥰' },
  excited: { label: 'Excited', emoji: '🤩' },
  tired: { label: 'Tired', emoji: '🥱' },
  stressed: { label: 'Stressed', emoji: '😫' },
  sad: { label: 'Sad', emoji: '😢' },
  angry: { label: 'Angry', emoji: '😠' },
};

const formatMinutes = (totalMinutes) => {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins === 0) return '0m';
  if (mins < 60) return `${mins}m`;
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const remMins = mins % 60;
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h ${remMins}m` : `${days}d ${remMins}m`;
  }
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
};

const getPairKey = (userId, partnerId) => {
  if (!partnerId) return `solo_${userId.toString()}`;
  return [userId.toString(), partnerId.toString()].sort().join('_');
};

const getDateKey = (date = new Date()) => {
  return date.toISOString().slice(0, 10);
};

// @desc    Record 1 minute of active foreground app engagement for couple analytics
// @route   POST /api/analytics/ping
// @access  Private
const pingActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const partnerId = req.user.partner;
    const pair = getPairKey(userId, partnerId);
    const todayKey = getDateKey();
    const now = new Date();

    const existing = await CoupleActivity.findOne({ pair, user: userId, date: todayKey });
    if (existing) {
      const elapsedMs = now.getTime() - new Date(existing.lastPingAt).getTime();
      if (elapsedMs >= 45000) {
        existing.minutesSpent += 1;
        existing.lastPingAt = now;
        await existing.save();
      }
      return res.status(200).json({ minutesSpentToday: existing.minutesSpent });
    }

    const created = await CoupleActivity.create({
      pair,
      user: userId,
      date: todayKey,
      minutesSpent: 1,
      lastPingAt: now,
    });

    res.status(200).json({ minutesSpentToday: created.minutesSpent });
  } catch (error) {
    console.error('Analytics ping error:', error);
    res.status(500).json({ message: 'Server error recording activity' });
  }
};

// @desc    Get Couple Analytics (time spent together, mood trends, activity stats)
// @route   GET /api/analytics?range=1d|3d|7d|30d|all
// @access  Private
const getCoupleAnalytics = async (req, res) => {
  try {
    const range = String(req.query.range || '7d').toLowerCase();
    const userId = req.user._id;
    const partnerId = req.user.partner;
    const allowedUsers = partnerId ? [userId, partnerId] : [userId];
    const pair = getPairKey(userId, partnerId);

    // Determine "Since Connected" date
    let connectedSince = req.user.pairedAt || null;
    if (!connectedSince && partnerId) {
      const acceptedReq = await PairingRequest.findOne({
        $or: [
          { sender: userId, receiver: partnerId, status: 'accepted' },
          { sender: partnerId, receiver: userId, status: 'accepted' },
        ],
      }).sort({ updatedAt: -1 });
      if (acceptedReq) {
        connectedSince = acceptedReq.updatedAt || acceptedReq.createdAt;
      }
    }
    if (!connectedSince && partnerId) {
      const firstMessage = await Message.findOne({
        $or: [
          { sender: userId, receiver: partnerId },
          { sender: partnerId, receiver: userId },
        ],
      }).sort({ createdAt: 1 });
      if (firstMessage) {
        connectedSince = firstMessage.createdAt;
      }
    }
    if (!connectedSince) {
      connectedSince = req.user.createdAt || new Date();
    }

    const now = new Date();
    let startDate;
    switch (range) {
      case '1d':
        startDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        break;
      case '3d':
        startDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        startDate = new Date(connectedSince);
        break;
    }

    const startDateKey = getDateKey(startDate);

    // Fetch tracked activity, mood logs, messages, and posts in parallel
    const [activities, moodLogs, messagesCount, postsCount, partnerDoc] = await Promise.all([
      CoupleActivity.find({
        pair,
        date: { $gte: startDateKey },
      }),
      MoodLog.find({
        user: { $in: allowedUsers },
        date: { $gte: startDate },
      }).sort({ date: -1 }),
      partnerId
        ? Message.countDocuments({
            $or: [
              { sender: userId, receiver: partnerId },
              { sender: partnerId, receiver: userId },
            ],
            createdAt: { $gte: startDate },
          })
        : Promise.resolve(0),
      Post.countDocuments({
        author: { $in: allowedUsers },
        createdAt: { $gte: startDate },
      }),
      partnerId ? User.findById(partnerId).select('mood fullName username') : Promise.resolve(null),
    ]);

    const trackedMinutes = activities.reduce((sum, item) => sum + (item.minutesSpent || 0), 0);
    // Supplement with real interaction activity so newly deployed analytics reflect actual couple interactions
    const interactionMinutes = Math.round(messagesCount * 0.5 + postsCount * 2 + moodLogs.length * 1);
    const totalMinutesSpent = Math.max(trackedMinutes, interactionMinutes);

    // Mood analytics
    const moodCounts = {};
    let positiveCount = 0;
    moodLogs.forEach((log) => {
      if (!log.mood) return;
      moodCounts[log.mood] = (moodCounts[log.mood] || 0) + 1;
      if (POSITIVE_MOODS.includes(log.mood)) {
        positiveCount += 1;
      }
    });

    const totalMoods = moodLogs.length;
    const positivityRate = totalMoods > 0 ? Math.round((positiveCount / totalMoods) * 100) : null;

    const moodBreakdown = Object.entries(moodCounts)
      .map(([mood, count]) => ({
        mood,
        label: MOOD_LABELS[mood]?.label || mood,
        emoji: MOOD_LABELS[mood]?.emoji || '🙂',
        count,
        percent: totalMoods > 0 ? Math.round((count / totalMoods) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const dominantMood = moodBreakdown.length > 0 ? moodBreakdown[0] : null;

    let moodStatus = 'No Moods Logged Yet';
    let moodTone = 'neutral';
    if (totalMoods > 0) {
      if (positivityRate >= 80) {
        moodStatus = 'Amazing & Loving';
        moodTone = 'great';
      } else if (positivityRate >= 60) {
        moodStatus = 'Mostly Happy & Good';
        moodTone = 'good';
      } else if (positivityRate >= 40) {
        moodStatus = 'Mixed / Ups & Downs';
        moodTone = 'mixed';
      } else {
        moodStatus = 'Needs Extra Love & Care';
        moodTone = 'low';
      }
    }

    const myLatestLog = moodLogs.find((m) => m.user.toString() === userId.toString());
    const partnerLatestLog = partnerId
      ? moodLogs.find((m) => m.user.toString() === partnerId.toString())
      : null;

    const daysConnected = Math.max(
      1,
      Math.floor((now.getTime() - new Date(connectedSince).getTime()) / (1000 * 60 * 60 * 24)) + 1
    );

    res.status(200).json({
      range,
      connectedSince,
      daysConnected,
      timeSpentMinutes: totalMinutesSpent,
      formattedTimeSpent: formatMinutes(totalMinutesSpent),
      messagesCount,
      postsCount,
      moodSummary: {
        totalLogs: totalMoods,
        positivityRate,
        status: moodStatus,
        tone: moodTone,
        dominantMood,
        breakdown: moodBreakdown,
        myLatestMood: myLatestLog
          ? {
              mood: myLatestLog.mood,
              label: MOOD_LABELS[myLatestLog.mood]?.label || myLatestLog.mood,
              emoji: MOOD_LABELS[myLatestLog.mood]?.emoji || '🙂',
            }
          : null,
        partnerLatestMood: partnerLatestLog
          ? {
              mood: partnerLatestLog.mood,
              label: MOOD_LABELS[partnerLatestLog.mood]?.label || partnerLatestLog.mood,
              emoji: MOOD_LABELS[partnerLatestLog.mood]?.emoji || '🙂',
            }
          : partnerDoc?.mood && MOOD_LABELS[partnerDoc.mood]
          ? {
              mood: partnerDoc.mood,
              label: MOOD_LABELS[partnerDoc.mood].label,
              emoji: MOOD_LABELS[partnerDoc.mood].emoji,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Server error fetching analytics' });
  }
};

module.exports = {
  pingActivity,
  getCoupleAnalytics,
};
