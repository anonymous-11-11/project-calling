const socket = io();
const params = new URLSearchParams(window.location.search);
const currentUser = params.get('user');
const targetUser = currentUser === 'me' ? 'Tahsina' : 'me';

const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const imageInput = document.getElementById('image-input');
const imageButton = document.getElementById('image-button');
const typingStatus = document.getElementById('typing-status');

let replyTo = null; // reply message id
let messageIdCounter = 0;

const notificationSound = new Audio('notification.mp3');

socket.emit('join', currentUser);

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (!message && !replyTo) return;

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const msgId = 'msg_' + (++messageIdCounter);

  appendMessage(currentUser, message, time, 'text', msgId, null, replyTo);
  socket.emit('chat-message', { to: targetUser, from: currentUser, message, time, type: 'text', id: msgId, replyTo });

  messageInput.value = '';
  replyTo = null;
  removeReplyBox();

  socket.emit('stop-typing', targetUser);
});

imageButton.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = 'msg_' + (++messageIdCounter);

    appendMessage(currentUser, reader.result, time, 'image', msgId, null, replyTo);
    socket.emit('chat-message', { to: targetUser, from: currentUser, message: reader.result, time, type: 'image', id: msgId, replyTo });

    replyTo = null;
    removeReplyBox();
  };
  reader.readAsDataURL(file);
  imageInput.value = '';
});

messageInput.addEventListener('input', () => {
  socket.emit('typing', targetUser);
  clearTimeout(window.typingTimeout);
  window.typingTimeout = setTimeout(() => {
    socket.emit('stop-typing', targetUser);
  }, 1000);
});

socket.on('chat-message', (data) => {
  if (data.from !== currentUser) {
    appendMessage(data.from, data.message, data.time, data.type, data.id, data.status, data.replyTo);
    notificationSound.play();
  }
  markMessageDelivered(data.id);
});

socket.on('typing', (username) => {
  typingStatus.innerText = `${username} is typing...`;
});

socket.on('stop-typing', () => {
  typingStatus.innerText = '';
});

socket.on('message-read-confirm', ({ id, from }) => {
  markMessageReadConfirmed(id);
});

function appendMessage(sender, content, time, type, id, status = 'delivered', replyToId = null) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message ' + (sender === currentUser ? 'sent' : 'received');
  msgDiv.dataset.id = id;

  // Reply box inside message
  let replyHTML = '';
  if (replyToId) {
    const repliedMsg = document.querySelector(`.message[data-id="${replyToId}"]`);
    if (repliedMsg) {
      const repliedTextElem = repliedMsg.querySelector('.msg-content');
      const repliedText = repliedTextElem ? repliedTextElem.innerText : 'Image';
      replyHTML = `<div class="reply-box">↪ Reply: ${repliedText}</div>`;
    }
  }

  // Tick marks
  let tickHTML = '✔️';
  if (status === 'read') tickHTML = '✔✔';
  if (status === 'read-confirmed') tickHTML = '✔✔ (blue)';

  let msgContentHTML = '';
  if (type === 'text') {
    msgContentHTML = `<p class="msg-content">${content}</p>`;
  } else if (type === 'image') {
    msgContentHTML = `<img class="chat-image" src="${content}" alt="Image message" />`;
  }

  msgDiv.innerHTML = `
    ${replyHTML}
    ${msgContentHTML}
    <div class="meta">${time} <span class="tick">${tickHTML}</span></div>
  `;

  // Right click to reply
  msgDiv.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    createReplyBox(sender, type === 'text' ? content : '[Image]', id);
  });

  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function createReplyBox(sender, content, id) {
  removeReplyBox();

  const replyBox = document.createElement('div');
  replyBox.id = 'reply-box';
  replyBox.innerHTML = `
    Replying to <b>${sender}</b>: "${content.length > 30 ? content.substr(0, 30) + '...' : content}"
    <button id="cancel-reply">Cancel</button>
  `;

  const chatContainer = document.getElementById('chat-container');
  chatContainer.insertBefore(replyBox, chatForm);

  replyTo = id;

  document.getElementById('cancel-reply').onclick = () => {
    replyTo = null;
    removeReplyBox();
  };
}

function removeReplyBox() {
  const existing = document.getElementById('reply-box');
  if (existing) existing.remove();
}

function markMessageDelivered(id) {
  const msgElem = document.querySelector(`.message[data-id="${id}"]`);
  if (msgElem) {
    const tickSpan = msgElem.querySelector('.tick');
    if (tickSpan) tickSpan.textContent = '✔✔'; // double tick delivered
  }
}

function markMessageReadConfirmed(id) {
  const msgElem = document.querySelector(`.message[data-id="${id}"]`);
  if (msgElem) {
    const tickSpan = msgElem.querySelector('.tick');
    if (tickSpan) tickSpan.textContent = '✔✔ (blue)';
  }
}

// Read confirmation on scroll (for received messages)
chatBox.addEventListener('scroll', () => {
  const messages = [...chatBox.querySelectorAll('.message.received')];
  messages.forEach((msg) => {
    const rect = msg.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
      const msgId = msg.dataset.id;
      socket.emit('message-read', { id: msgId, from: currentUser, to: targetUser });
      markMessageReadConfirmed(msgId);
    }
  });
});
