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
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" })); // Allow images to load across domains

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
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
const petRoutes = require('./routes/petRoutes'); // NEW
const feedbackRoutes = require('./routes/feedbackRoutes');

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

// Static folder setup for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Basic Route for testing
app.get('/', (req, res) => {
  res.send('H&S Backend API is running');
});

// Error Handling Middleware
app.use(errorHandler);

// Socket.io for Realtime Features
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Users can join a room that is a combination of both their IDs (sorted to be consistent)
  socket.on('join_pair_room', ({ userId, partnerId }) => {
    if (userId && partnerId) {
      userSocketMap.set(userId, socket.id);
      const room = [userId, partnerId].sort().join('_');
      socket.join(room);
      console.log(`User ${userId} joined room ${room}`);
    }
  });

  socket.on('send_miss_you', async ({ room, partnerId, senderId, senderName }) => {
    socket.to(room).emit('receive_miss_you', { timestamp: new Date() });
    if (partnerId) {
      try {
        const partner = await User.findById(partnerId);
        if (partner) {
          // Save pending animation
          partner.pendingAnimation = 'miss_you';
          await partner.save();

          // Create notification in DB
          if (senderId) {
            await Notification.create({
              recipient: partnerId,
              sender: senderId,
              title: `${senderName || 'Your partner'} Misses you`,
              message: 'Your partner misses you!',
              type: 'other'
            });
          }

          if (partner.pushToken) {
            await sendPushNotification(partner.pushToken, 'You have a new Notification', 'Your partner misses you!');
          }
        }
      } catch (e) { console.error(e); }
    }
  });

  socket.on('send_love_you', async ({ room, partnerId, senderId, senderName }) => {
    socket.to(room).emit('receive_love_you', { timestamp: new Date() });
    if (partnerId) {
      try {
        const partner = await User.findById(partnerId);
        if (partner) {
          // Save pending animation
          partner.pendingAnimation = 'love_you';
          await partner.save();

          // Create notification in DB
          if (senderId) {
            await Notification.create({
              recipient: partnerId,
              sender: senderId,
              title: `${senderName || 'Your partner'} Loves you`,
              message: 'Your partner loves you!',
              type: 'other'
            });
          }

          if (partner.pushToken) {
            await sendPushNotification(partner.pushToken, 'You have a new Notification', 'Your partner loves you!');
          }
        }
      } catch (e) { console.error(e); }
    }
  });

  socket.on('update_location', ({ room, location }) => {
    socket.to(room).emit('receive_location', location);
  });

  socket.on('send_notification', async ({ room, partnerId, title, message }) => {
    socket.to(room).emit('receive_notification', { title, message, timestamp: new Date() });
    if (partnerId) {
      try {
        const partner = await User.findById(partnerId);
        if (partner && partner.pushToken) {
          await sendPushNotification(partner.pushToken, title, message);
        }
      } catch (e) { console.error(e); }
    }
  });

  socket.on('send_message', ({ room, message }) => {
    socket.to(room).emit('receive_message', message);
  });

  socket.on('send_heartbeat', ({ room }) => {
    socket.to(room).emit('receive_heartbeat');
  });

  // --- WATCH TOGETHER SOCKET EVENTS ---
  socket.on('join_watch_room', ({ roomCode }) => {
    socket.join(roomCode);
    console.log(`User ${socket.id} joined watch room ${roomCode}`);
  });

  socket.on('leave_watch_room', ({ roomCode }) => {
    socket.leave(roomCode);
    console.log(`User ${socket.id} left watch room ${roomCode}`);
  });

  socket.on('media_uploading', ({ roomCode, progress }) => {
    socket.to(roomCode).emit('receive_media_uploading', { progress });
  });

  socket.on('invite_partner_watch', ({ partnerId, roomCode, hostName }) => {
    const partnerSocketId = userSocketMap.get(partnerId);
    if (partnerSocketId) {
      io.to(partnerSocketId).emit('receive_watch_invite', { roomCode, hostName });
    }
  });

  socket.on('accept_watch_invite', ({ hostId, guestName }) => {
    const hostSocketId = userSocketMap.get(hostId);
    if (hostSocketId) {
      io.to(hostSocketId).emit('watch_invite_accepted', { guestName });
    }
  });

  socket.on('reject_watch_invite', ({ hostId, guestName }) => {
    const hostSocketId = userSocketMap.get(hostId);
    if (hostSocketId) {
      io.to(hostSocketId).emit('watch_invite_rejected', { guestName });
    }
  });

  socket.on('media_play', ({ roomCode, timestamp }) => {
    socket.to(roomCode).emit('receive_media_play', { timestamp });
  });

  socket.on('media_pause', ({ roomCode, timestamp }) => {
    socket.to(roomCode).emit('receive_media_pause', { timestamp });
  });

  socket.on('media_seek', ({ roomCode, timestamp }) => {
    socket.to(roomCode).emit('receive_media_seek', { timestamp });
  });

  socket.on('sync_media', ({ roomCode, timestamp, playing }) => {
    socket.to(roomCode).emit('receive_sync_media', { timestamp, playing });
  });

  socket.on('send_reaction', ({ roomCode, reaction, senderName }) => {
    socket.to(roomCode).emit('receive_reaction', { reaction, senderName });
  });

  socket.on('change_media', ({ roomCode, media }) => {
    socket.to(roomCode).emit('receive_change_media', { media });
  });

  socket.on('kick_user', ({ roomCode, userId }) => {
    socket.to(roomCode).emit('receive_kick_user', { userId });
  });

  socket.on('delete_room', ({ roomCode }) => {
    socket.to(roomCode).emit('receive_delete_room');
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
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
