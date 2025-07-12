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

let replyTo = null;
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

imageInput.addEventListener('change', async () => {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    const compressed = await compressBase64Image(reader.result, 800, 600, 0.6);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = 'msg_' + (++messageIdCounter);

    appendMessage(currentUser, compressed, time, 'image', msgId, null, replyTo);
    socket.emit('chat-message', { to: targetUser, from: currentUser, message: compressed, time, type: 'image', id: msgId, replyTo });

    replyTo = null;
    removeReplyBox();
  };
  reader.readAsDataURL(file);
  imageInput.value = '';
});

// Typing indicator
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

socket.on('typing', (username) => typingStatus.innerText = `${username} is typing...`);
socket.on('stop-typing', () => typingStatus.innerText = '');
socket.on('message-read-confirm', ({ id }) => markMessageReadConfirmed(id));

// Append message
function appendMessage(sender, content, time, type, id, status = 'delivered', replyToId = null) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message ' + (sender === currentUser ? 'sent' : 'received');
  msgDiv.dataset.id = id;

  let replyHTML = '';
  if (replyToId) {
    const repliedMsg = document.querySelector(`.message[data-id="${replyToId}"]`);
    if (repliedMsg) {
      const repliedTextElem = repliedMsg.querySelector('.msg-content');
      const repliedText = repliedTextElem ? repliedTextElem.innerText : 'Image';
      replyHTML = `<div class="reply-box">↪ Reply: ${repliedText}</div>`;
    }
  }

  let tickHTML = status === 'read-confirmed' ? '✔✔ (blue)' : status === 'read' ? '✔✔' : '✔️';

  let msgContentHTML = '';
  if (type === 'text') {
    msgContentHTML = `<p class="msg-content">${content}</p>`;
  } else if (type === 'image') {
    msgContentHTML = `<img class="chat-image" src="${content}" alt="Image" />`;
  }

  msgDiv.innerHTML = `
    ${replyHTML}
    ${msgContentHTML}
    <div class="meta">${time} <span class="tick">${tickHTML}</span></div>
  `;

  msgDiv.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    createReplyBox(sender, type === 'text' ? content : '[Image]', id);
  });

  chatBox.appendChild(msgDiv);
  // Disable auto scroll: no scroll after append
}

// Reply box create & remove
function createReplyBox(sender, content, id) {
  removeReplyBox();
  const replyBox = document.createElement('div');
  replyBox.id = 'reply-box';
  replyBox.innerHTML = `Replying to <b>${sender}</b>: "${content.length > 30 ? content.substr(0, 30) + '...' : content}" <button id="cancel-reply">Cancel</button>`;
  document.getElementById('chat-container').insertBefore(replyBox, chatForm);
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

// Ticks
function markMessageDelivered(id) {
  const msg = document.querySelector(`.message[data-id="${id}"] .tick`);
  if (msg) msg.textContent = '✔✔';
}
function markMessageReadConfirmed(id) {
  const msg = document.querySelector(`.message[data-id="${id}"] .tick`);
  if (msg) msg.textContent = '✔✔ (blue)';
}

// Scroll = Message read
chatBox.addEventListener('scroll', () => {
  const msgs = [...chatBox.querySelectorAll('.message.received')];
  msgs.forEach((msg) => {
    const rect = msg.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
      const msgId = msg.dataset.id;
      socket.emit('message-read', { id: msgId, from: currentUser, to: targetUser });
      markMessageReadConfirmed(msgId);
    }
  });
});
// Image preview modal
const imageModal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');

document.addEventListener('click', function (e) {
  if (e.target.classList.contains('chat-image')) {
    modalImage.src = e.target.src;
    imageModal.style.display = 'flex';
  } else if (e.target === imageModal) {
    imageModal.style.display = 'none';
  }
});


// 🧠 Image compression utility
function compressBase64Image(base64Str, maxWidth, maxHeight, quality = 0.6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((maxWidth / width) * height);
          width = maxWidth;
        } else {
          width = Math.round((maxHeight / height) * width);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = base64Str;
  });
}
