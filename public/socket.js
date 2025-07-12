const socket = io();
const params = new URLSearchParams(window.location.search);
const username = params.get("user") || "me";
document.getElementById("welcome-msg").textContent = `Welcome, ${username}!`;

const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const fileInput = document.getElementById("file");
const messages = document.getElementById("messages");
const typingStatus = document.getElementById("typing-status");

socket.emit('join', username);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value.trim()) {
    appendMessage(username, input.value, true);
    socket.emit('chat-message', { message: input.value });
    input.value = '';
  }
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    appendImage(username, reader.result, true);
    socket.emit('image-message', { image: reader.result });
  };
  reader.readAsDataURL(file);
});

input.addEventListener('input', () => {
  socket.emit('typing', input.value.length > 0);
});

socket.on('chat-message', (data) => {
  appendMessage(data.from, data.message, false, data.timestamp);
});

socket.on('image-message', (data) => {
  appendImage(data.from, data.image, false, data.timestamp);
});

socket.on('typing', ({ user, isTyping }) => {
  typingStatus.textContent = isTyping ? `${user} is typing...` : '';
});

function appendMessage(sender, text, isMe, time = new Date().toLocaleTimeString()) {
  const div = document.createElement("div");
  div.className = `message ${isMe ? 'you' : 'other'}`;
  div.innerHTML = `
    ${text}<div class="meta">${time} ${isMe ? '✔️' : ''}</div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function appendImage(sender, imageSrc, isMe, time = new Date().toLocaleTimeString()) {
  const div = document.createElement("div");
  div.className = `message ${isMe ? 'you' : 'other'}`;
  div.innerHTML = `
    <img src="${imageSrc}" style="max-width: 200px; border-radius: 8px;" />
    <div class="meta">${time} ${isMe ? '✔️' : ''}</div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}
