require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
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

// Middleware
app.use(cors());
app.use(express.json());

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

app.use('/api/auth', authRoutes);
app.use('/api/pairing', pairingRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dates', dateEventRoutes);
app.use('/api/watch', watchRoutes);
app.use('/api/website', websiteRoutes);

// Static folder setup for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Basic Route for testing
app.get('/', (req, res) => {
  res.send('H&S Backend API is running');
});

// Socket.io for Realtime Features
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Users can join a room that is a combination of both their IDs (sorted to be consistent)
  socket.on('join_pair_room', ({ userId, partnerId }) => {
    if (userId && partnerId) {
      const room = [userId, partnerId].sort().join('_');
      socket.join(room);
      console.log(`User ${userId} joined room ${room}`);
    }
  });

  socket.on('send_miss_you', ({ room }) => {
    socket.to(room).emit('receive_miss_you', { timestamp: new Date() });
  });

  socket.on('send_love_you', ({ room }) => {
    socket.to(room).emit('receive_love_you', { timestamp: new Date() });
  });

  socket.on('update_location', ({ room, location }) => {
    socket.to(room).emit('receive_location', location);
  });

  socket.on('send_notification', ({ room, title, message }) => {
    socket.to(room).emit('receive_notification', { title, message, timestamp: new Date() });
  });

  socket.on('send_message', ({ room, message }) => {
    socket.to(room).emit('receive_message', message);
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
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
