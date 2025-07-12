const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// --- User sockets tracking ---
const userSockets = {}; // username -> socket.id

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (username) => {
    socket.username = username;
    userSockets[username] = socket.id;
    console.log(`User ${username} joined with socket ${socket.id}`);
  });

  // Handle sending message to target user
  socket.on('chat-message', (data) => {
    const { to, from, message, time, type, id, replyTo } = data;
    const targetSocketId = userSockets[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('chat-message', {
        from,
        message,
        time,
        type,
        id,
        replyTo,
        status: 'delivered'
      });
    }
  });

  // Typing indicator events
  socket.on('typing', (to) => {
    const targetSocketId = userSockets[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('typing', socket.username);
    }
  });

  socket.on('stop-typing', (to) => {
    const targetSocketId = userSockets[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('stop-typing', socket.username);
    }
  });

  // Message read confirmation event
  socket.on('message-read', ({ id, from, to }) => {
    const targetSocketId = userSockets[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('message-read-confirm', { id, from });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.username) {
      delete userSockets[socket.username];
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
