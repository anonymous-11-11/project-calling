const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Route: default redirect to login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Route: login POST handler
app.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.send(`
      <script>
        alert("Username is required!");
        window.location.href = "/login.html";
      </script>
    `);
  }

  // Redirect to dashboard with query param
  res.redirect(`/dashboard.html?user=${encodeURIComponent(username)}`);
});

// Socket.io logic
const userSockets = {}; // username -> socket.id

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (username) => {
    socket.username = username;
    userSockets[username] = socket.id;
    console.log(`User ${username} joined with socket ${socket.id}`);
  });

  // Handle message sending
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

  // Typing indicator
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

  // Read receipt
  socket.on('message-read', ({ id, from, to }) => {
    const targetSocketId = userSockets[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('message-read-confirm', { id, from });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.username) {
      delete userSockets[socket.username];
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
