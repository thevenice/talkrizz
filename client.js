const socket = io('https://talkrizz.com', { path: '/socket.io' });
// const socket = io('http://0.0.0.0:8001'); //local
const chatArea = document.getElementById('chat-area');
const msgInput = document.getElementById('msg-input');
const toggleBtn = document.getElementById('toggle-btn');
const leaveBtn = document.getElementById('leave-btn');

let partnerFound = false;
let pingInterval;
const PING_INTERVAL = 30000; // 30 seconds

function updateChat(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.className = 'mb-2';
    chatArea.appendChild(messageElement);
    chatArea.scrollTop = chatArea.scrollHeight;
}

function clearChat() {
    chatArea.innerHTML = '';
}

function updateButtonVisibility() {
    if (partnerFound) {
        toggleBtn.textContent = 'Send';
        toggleBtn.classList.remove('bg-green-500', 'hover:bg-green-600', 'focus:ring-green-500');
        toggleBtn.classList.add('bg-blue-500', 'hover:bg-blue-600', 'focus:ring-blue-500');
        msgInput.classList.remove('hidden');
        leaveBtn.disabled = false;
    } else {
        toggleBtn.textContent = 'Find Partner';
        toggleBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600', 'focus:ring-blue-500');
        toggleBtn.classList.add('bg-green-500', 'hover:bg-green-600', 'focus:ring-green-500');
        msgInput.classList.add('hidden');
        leaveBtn.disabled = true;
    }
    toggleBtn.disabled = false;  // Ensure the toggle button is always enabled
}

function startPingInterval() {
    clearInterval(pingInterval);
    pingInterval = setInterval(() => {
        if (socket.connected) {
            socket.emit('ping');
        }
    }, PING_INTERVAL);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        startPingInterval();
    } else {
        clearInterval(pingInterval);
    }
});

toggleBtn.addEventListener('click', () => {
    if (partnerFound) {
        // Send message
        if (msgInput.value.trim() !== '') {
            const message = msgInput.value.trim();
            console.log(`Sending message: ${message}`);
            socket.emit('send_message', message);
            updateChat(`You: ${message}`);
            msgInput.value = '';
        }
    } else {
        // Find partner
        console.log('Requesting partner...');
        socket.emit('find_partner');
        clearChat();
        updateChat("Looking for a partner...");
        toggleBtn.disabled = true;
    }
});

// Update the leave button event listener
leaveBtn.addEventListener('click', () => {
    console.log('Leaving chat...');
    socket.emit('leave_room');
    partnerFound = false;
    clearChat();
    updateChat("You've left the chat. Click 'Find Partner' to start a new chat.");
    updateButtonVisibility();
    toggleBtn.disabled = false;  // Explicitly enable the toggle button
});

msgInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && msgInput.value.trim() !== '') {
        const message = msgInput.value.trim();
        console.log(`Sending message: ${message}`);
        socket.emit('send_message', message);
        updateChat(`You: ${message}`);
        msgInput.value = '';
    }
});

socket.on('connect', () => {
    console.log("Connected to server");
    startPingInterval();
});

socket.on('connect_response', (data) => {
    console.log("Connection response:", data);
    clearChat();
    updateChat("Connected to server. Click 'Find Partner' to start chatting.");
    updateButtonVisibility();
});

socket.on('disconnect', () => {
    console.log("Disconnected from server");
    clearChat();
    updateChat("Disconnected from server. Please refresh the page.");
    partnerFound = false;
    updateButtonVisibility();
    clearInterval(pingInterval);
});

socket.on('pong', () => {
    console.log('Received pong from server');
});

socket.on('partner_found', (data) => {
    console.log('Partner found:', data);
    clearChat();
    updateChat("Partner found! You can start chatting.");
    partnerFound = true;
    updateButtonVisibility();
});

socket.on('waiting_for_partner', () => {
    console.log('Waiting for partner');
    clearChat();
    updateChat("Waiting for a partner. Please be patient...");
    toggleBtn.disabled = true;
});

socket.on('partner_left', () => {
    console.log('Partner left');
    updateChat("Your partner has left the chat.");
    partnerFound = false;
    updateButtonVisibility();
});

socket.on('left_room', () => {
    console.log('Left room');
    partnerFound = false;
    updateButtonVisibility();
});

socket.on('message', (data) => {
    console.log('Received message:', data);
    updateChat(`Partner: ${data.message}`);
});

socket.on('error', (data) => {
    console.log('Error:', data);
    updateChat(`Error: ${data.message}`);
    toggleBtn.disabled = false;
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    clearChat();
    updateChat("Connection error. Please refresh the page.");
    partnerFound = false;
    updateButtonVisibility();
});

socket.on('chat_error', (data) => {
    console.log('Chat error:', data);
    updateChat(`Error: ${data.message}`);
    toggleBtn.disabled = false;
});