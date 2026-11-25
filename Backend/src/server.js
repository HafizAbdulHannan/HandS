require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorMiddleware');
const connectDB = require('./config/db');

// Connect to database
connectDB();

const fs = require('fs');
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Security Middleware
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Basic Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

const { sendPushNotification } = require('./utils/pushNotification');
const User = require('./models/User');
const Notification = require('./models/Notification');
const WatchRoom = require('./models/WatchRoom');

const userSocketMap = new Map();

// Routes
const authRoutes = require('./routes/authRoutes');
const pairingRoutes = require('./routes/pairingRoutes');
const postRoutes = require('./routes/postRoutes');
const messageRoutes = require('./routes/messageRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dateEventRoutes = require('./routes/dateEventRoutes');
const watchRoutes = require('./routes/watchRoutes');
const websiteRoutes = require('./routes/websiteRoutes');
const moodRoutes = require('./routes/moodRoutes');
const questionRoutes = require('./routes/questionRoutes');
const listRoutes = require('./routes/listRoutes');
const petRoutes = require('./routes/petRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/pairing', pairingRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dates', dateEventRoutes);
app.use('/api/watch', watchRoutes);
app.use('/api/website', websiteRoutes);
app.use('/api/moods', moodRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/feedbacks', feedbackRoutes);
app.use('/api/analytics', analyticsRoutes);

// Static folder setup for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Basic Route for testing
app.get('/', (req, res) => {
  res.send('H&S Backend API is running');
});

// Error Handling Middleware
app.use(errorHandler);

const extractId = (val) => {
  if (!val) return null;
  if (typeof val === 'object' && val._id) return val._id.toString();
  return String(val);
};

// Socket.io for Realtime Features
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('register_user', ({ userId }) => {
    const uid = extractId(userId);
    if (uid) {
      userSocketMap.set(uid, socket.id);
    }
  });

  // Users can join a room that is a combination of both their IDs (sorted to be consistent)
  socket.on('join_pair_room', ({ userId, partnerId }) => {
    const uid = extractId(userId);
    const pid = extractId(partnerId);
    if (uid) {
      userSocketMap.set(uid, socket.id);
    }
    if (uid && pid) {
      const room = [uid, pid].sort().join('_');
      socket.join(room);
      console.log(`User ${uid} joined room ${room}`);
    }
  });

  socket.on('send_miss_you', async ({ room, partnerId, senderId, senderName }) => {
    const pid = extractId(partnerId);
    const sid = extractId(senderId);
    if (room) {
      socket.to(room).emit('receive_miss_you', { timestamp: new Date() });
    }
    if (pid) {
      try {
        const partner = await User.findById(pid);
        if (partner) {
          partner.pendingAnimation = 'miss_you';
          await partner.save();

          if (sid) {
            await Notification.create({
              recipient: pid,
              sender: sid,
              title: `${senderName || 'Your partner'} Misses you`,
              message: 'Your partner misses you!',
              type: 'other'
            });
          }

          if (partner.pushToken) {
            await sendPushNotification(partner.pushToken, 'You have a new Notification', 'Your partner misses you!', { type: 'realtime_emotion', emotion: 'miss_you' });
          }
        }
      } catch (e) { console.error(e); }
    }
  });

  socket.on('send_love_you', async ({ room, partnerId, senderId, senderName }) => {
    const pid = extractId(partnerId);
    const sid = extractId(senderId);
    if (room) {
      socket.to(room).emit('receive_love_you', { timestamp: new Date() });
    }
    if (pid) {
      try {
        const partner = await User.findById(pid);
        if (partner) {
          partner.pendingAnimation = 'love_you';
          await partner.save();

          if (sid) {
            await Notification.create({
              recipient: pid,
              sender: sid,
              title: `${senderName || 'Your partner'} Loves you`,
              message: 'Your partner loves you!',
              type: 'other'
            });
          }

          if (partner.pushToken) {
            await sendPushNotification(partner.pushToken, 'You have a new Notification', 'Your partner loves you!', { type: 'realtime_emotion', emotion: 'love_you' });
          }
        }
      } catch (e) { console.error(e); }
    }
  });

  socket.on('update_location', ({ room, location }) => {
    if (room && location) {
      socket.to(room).emit('receive_location', location);
    }
  });

  socket.on('start_trip', async ({ room, partnerId, senderId, senderName, trip }) => {
    const pid = extractId(partnerId);
    const sid = extractId(senderId);
    if (room && trip) {
      socket.to(room).emit('receive_partner_trip', trip);
    }
    if (pid) {
      try {
        const partner = await User.findById(pid);
        if (partner) {
          if (sid) {
            await Notification.create({
              recipient: pid,
              sender: sid,
              title: `${senderName || 'Your partner'} started a trip 🚗`,
              message: `Heading to ${trip?.destination || 'a destination'} (${trip?.vehicleType || 'Car'}) • ETA: ${trip?.eta || 'Calculating...'}`,
              type: 'other'
            });
          }
          if (partner.pushToken) {
            await sendPushNotification(
              partner.pushToken,
              `${senderName || 'Your partner'} started a trip 🚗`,
              `Heading to ${trip?.destination || 'a destination'} (${trip?.vehicleType || 'Car'})`
            );
          }
        }
      } catch (e) { console.error(e); }
    }
  });

  socket.on('update_trip', ({ room, trip }) => {
    if (room && trip) {
      socket.to(room).emit('receive_partner_trip', trip);
    }
  });

  socket.on('end_trip', ({ room }) => {
    if (room) {
      socket.to(room).emit('receive_partner_trip_ended');
    }
  });

  socket.on('delete_message_everyone', ({ room, messageId }) => {
    if (room && messageId) {
      socket.to(room).emit('receive_delete_message_everyone', { messageId });
    }
  });

  socket.on('send_notification', async ({ room, partnerId, title, message }) => {
    const pid = extractId(partnerId);
    if (room) {
      socket.to(room).emit('receive_notification', { title, message, timestamp: new Date() });
    }
    if (pid) {
      try {
        const partner = await User.findById(pid);
        if (partner && partner.pushToken) {
          await sendPushNotification(partner.pushToken, title, message);
        }
      } catch (e) { console.error(e); }
    }
  });

  socket.on('send_message', ({ room, message }) => {
    if (room && message) {
      socket.to(room).emit('receive_message', message);
    }
  });

  socket.on('send_heartbeat', async ({ room, partnerId, senderId, senderName }) => {
    const pid = extractId(partnerId);
    const sid = extractId(senderId);
    if (room) {
      socket.to(room).emit('receive_heartbeat', { senderName, timestamp: new Date() });
    }
    if (pid) {
      try {
        const partner = await User.findById(pid);
        if (partner) {
          partner.pendingAnimation = 'heartbeat';
          await partner.save();

          if (sid) {
            await Notification.create({
              recipient: pid,
              sender: sid,
              title: `${senderName || 'Your partner'} sent a Heartbeat`,
              message: 'Your partner is thinking of you!',
              type: 'other'
            });
          }

          if (partner.pushToken) {
            await sendPushNotification(partner.pushToken, 'You have a new Notification', 'Your partner sent a Heartbeat!', { type: 'realtime_emotion', emotion: 'heartbeat' });
          }
        }
      } catch (e) { console.error(e); }
    }
  });

  // --- WATCH TOGETHER SOCKET EVENTS ---
  socket.on('join_watch_room', ({ roomCode }) => {
    if (!roomCode) return;
    const normalizedCode = String(roomCode).trim().toUpperCase();
    socket.join(normalizedCode);
    socket.to(normalizedCode).emit('participant_joined', { roomCode: normalizedCode });
    console.log(`User ${socket.id} joined watch room ${normalizedCode}`);
  });

  socket.on('leave_watch_room', ({ roomCode }) => {
    if (!roomCode) return;
    const normalizedCode = String(roomCode).trim().toUpperCase();
    socket.leave(normalizedCode);
    socket.to(normalizedCode).emit('participant_left', { roomCode: normalizedCode });
    console.log(`User ${socket.id} left watch room ${normalizedCode}`);
  });

  socket.on('media_uploading', ({ roomCode, progress }) => {
    if (!roomCode) return;
    socket.to(String(roomCode).trim().toUpperCase()).emit('receive_media_uploading', { progress });
  });

  socket.on('invite_partner_watch', async ({ partnerId, roomCode, roomId, hostName, hostId }) => {
    const pid = extractId(partnerId);
    const normalizedCode = String(roomCode || '').trim().toUpperCase();
    if (!pid || !normalizedCode) return;

    const partnerSocketId = userSocketMap.get(pid);
    if (partnerSocketId) {
      io.to(partnerSocketId).emit('receive_watch_invite', { roomCode: normalizedCode, roomId, hostName, hostId });
    }

    try {
      const partner = await User.findById(pid);
      if (partner && partner.pushToken) {
        await sendPushNotification(
          partner.pushToken,
          'Watch Together Invite 🍿',
          `${hostName || 'Your partner'} invited you to watch together! Room Code: ${normalizedCode}`,
          { roomCode: normalizedCode, roomId }
        );
      }
    } catch (e) {
      console.error('Error sending watch invite push notification:', e);
    }
  });

  socket.on('accept_watch_invite', ({ hostId, roomCode, guestName }) => {
    const hid = extractId(hostId);
    if (hid) {
      const hostSocketId = userSocketMap.get(hid);
      if (hostSocketId) {
        io.to(hostSocketId).emit('watch_invite_accepted', { guestName });
      }
    }
    if (roomCode) {
      socket.to(String(roomCode).trim().toUpperCase()).emit('watch_invite_accepted', { guestName });
    }
  });

  socket.on('reject_watch_invite', ({ hostId, roomCode, guestName }) => {
    const hid = extractId(hostId);
    if (hid) {
      const hostSocketId = userSocketMap.get(hid);
      if (hostSocketId) {
        io.to(hostSocketId).emit('watch_invite_rejected', { guestName });
      }
    }
    if (roomCode) {
      socket.to(String(roomCode).trim().toUpperCase()).emit('watch_invite_rejected', { guestName });
    }
  });

  socket.on('media_play', async ({ roomCode, timestamp }) => {
    if (!roomCode) return;
    const normalizedCode = String(roomCode).trim().toUpperCase();
    socket.to(normalizedCode).emit('receive_media_play', { timestamp });
    try {
      await WatchRoom.findOneAndUpdate(
        { roomCode: normalizedCode },
        { $set: { 'currentMedia.status': 'playing', 'currentMedia.timestamp': Number(timestamp) || 0 } }
      );
    } catch (e) { }
  });

  socket.on('media_pause', async ({ roomCode, timestamp }) => {
    if (!roomCode) return;
    const normalizedCode = String(roomCode).trim().toUpperCase();
    socket.to(normalizedCode).emit('receive_media_pause', { timestamp });
    try {
      await WatchRoom.findOneAndUpdate(
        { roomCode: normalizedCode },
        { $set: { 'currentMedia.status': 'paused', 'currentMedia.timestamp': Number(timestamp) || 0 } }
      );
    } catch (e) { }
  });

  socket.on('media_seek', async ({ roomCode, timestamp }) => {
    if (!roomCode) return;
    const normalizedCode = String(roomCode).trim().toUpperCase();
    socket.to(normalizedCode).emit('receive_media_seek', { timestamp });
    try {
      await WatchRoom.findOneAndUpdate(
        { roomCode: normalizedCode },
        { $set: { 'currentMedia.timestamp': Number(timestamp) || 0 } }
      );
    } catch (e) { }
  });

  socket.on('sync_media', async ({ roomCode, timestamp, playing }) => {
    if (!roomCode) return;
    const normalizedCode = String(roomCode).trim().toUpperCase();
    socket.to(normalizedCode).emit('receive_sync_media', { timestamp, playing });
    try {
      await WatchRoom.findOneAndUpdate(
        { roomCode: normalizedCode },
        {
          $set: {
            'currentMedia.timestamp': Number(timestamp) || 0,
            'currentMedia.status': playing ? 'playing' : 'paused'
          }
        }
      );
    } catch (e) { }
  });

  socket.on('send_reaction', ({ roomCode, reaction, senderName }) => {
    if (!roomCode) return;
    socket.to(String(roomCode).trim().toUpperCase()).emit('receive_reaction', { reaction, senderName });
  });

  socket.on('change_media', async ({ roomCode, media }) => {
    if (!roomCode || !media) return;
    const normalizedCode = String(roomCode).trim().toUpperCase();
    socket.to(normalizedCode).emit('receive_change_media', { media });
    try {
      await WatchRoom.findOneAndUpdate(
        { roomCode: normalizedCode },
        {
          $set: {
            currentMedia: {
              type: media.type || 'none',
              url: media.url || '',
              timestamp: 0,
              status: 'paused'
            }
          }
        }
      );
    } catch (e) { }
  });

  socket.on('kick_user', async ({ roomCode, userId }) => {
    if (!roomCode) return;
    const normalizedCode = String(roomCode).trim().toUpperCase();
    socket.to(normalizedCode).emit('receive_kick_user', { userId });
    try {
      await WatchRoom.findOneAndUpdate(
        { roomCode: normalizedCode },
        { $pull: { participants: userId } }
      );
    } catch (e) { }
  });

  socket.on('delete_room', ({ roomCode }) => {
    if (!roomCode) return;
    socket.to(String(roomCode).trim().toUpperCase()).emit('receive_delete_room');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (let [userId, id] of userSocketMap.entries()) {
      if (id === socket.id) {
        userSocketMap.delete(userId);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
