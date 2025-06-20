// script.js
// Establish Socket.IO connection to the backend server
const socket = io('https://bingo-backend-1-4ajn.onrender.com'); // <--- !!! ENSURE THIS MATCHES YOUR DEPLOYED BACKEND URL !!!

// --- NEW: Backend HTTP URL for keep-alive pings ---
const BACKEND_HTTP_URL = 'https://bingo-backend-1-4ajn.onrender.com'; // <--- !!! REPLACE WITH YOUR ACTUAL DEPLOYED BACKEND'S HTTP URL !!!

// --- DOM Elements ---
// Lobby Screen Elements
const lobbyScreen = document.getElementById('lobby-screen');
const usernameInput = document.getElementById('username-input');
const gameIdInput = document.getElementById('game-id-input');
const createGameBtn = document.getElementById('create-game-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const lobbyStatusElement = document.getElementById('lobby-status');
const playerIdDisplayLobby = document.getElementById('player-id'); // For Lobby Screen
const onlinePlayersCountSpan = document.getElementById('online-players-count'); // NEW: Online Players Count
const playAiBtn = document.getElementById('play-ai-btn'); // NEW: Play with AI Button

// Game Screen Elements
const gameScreen = document.getElementById('game-screen');
const boardElement = document.getElementById('board');
const playerInfoElement = document.getElementById('player-info'); // This div contains game ID
const playerIdSpanGameScreen = document.getElementById('player-id-game-screen'); // For Game Screen
const currentRoomIdSpan = document.getElementById('current-room-id'); // Span for game ID in game screen
const copyGameIdBtn = document.getElementById('copy-game-id-btn');
const gameStatusElement = document.getElementById('game-status');
const startGameBtn = document.getElementById('start-game-btn');
const resetGameBtn = document.getElementById('reset-game-btn');
const exitRoomBtn = document.getElementById('exit-room-btn');
const chatMessagesElement = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const messageModal = document.getElementById('message-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalOkBtn = document.getElementById('modal-ok-btn');

// Game Notifications Element
const gameNotificationsElement = document.getElementById('game-notifications');

// Rematch Request Modal Elements
const rematchModal = document.createElement('div');
rematchModal.id = 'rematch-modal';
rematchModal.className = 'message-modal'; // Re-use modal styling
rematchModal.innerHTML = `
    <div class="message-modal-content">
        <h3 id="rematch-modal-title">Rematch Request!</h3>
        <p id="rematch-modal-message"></p>
        <div class="rematch-buttons">
            <button id="rematch-accept-btn" class="btn btn-primary">Accept</button>
            <button id="rematch-decline-btn" class="btn btn-secondary">Decline</button>
        </div>
    </div>
`;
document.body.appendChild(rematchModal);

const rematchModalMessage = document.getElementById('rematch-modal-message');
const rematchAcceptBtn = document.getElementById('rematch-accept-btn');
const rematchDeclineBtn = document.getElementById('rematch-decline-btn');

// BINGO Tracker Elements
const bingoLetters = ['B', 'I', 'N', 'G', 'O'].map(letter => document.getElementById(`bingo-${letter.toLowerCase()}`));

// Emote Buttons
const emoteButtons = document.querySelectorAll('.emote-btn'); // Select all buttons with this class

// --- Game State Variables ---
let numbers = []; // Array to hold the numbers on the player's board (1-25, shuffled)
let marked = Array(25).fill(false); // Boolean array to track marked cells
let gameStarted = false; // Flag to indicate if the game has started
let isMyTurn = false; // Flag to indicate if it's the current player's turn
let currentPlayerId = null; // Stores the unique socket ID assigned to this player by the server
let currentUsername = "Player"; // Stores the chosen username for this player
let currentPlayerNumber = null; // Stores the assigned player number (e.g., 1 or 2)
let currentGameId = null; // Stores the ID of the game room the player is in
let currentWinnerId = null; // Stores the ID of the winning player, or null if no winner yet
let isDraw = false; // Flag to indicate if the game ended in a draw

// Flag to help manage rapid game-ending events and prevent conflicting modal displays
let processingGameEnd = false; 

// Set to keep track of lines that have been visually struck
let struckLineIndices = new Set();

// NEW: AI Specific Variables
const AI_PLAYER_ID = 'AI-PLAYER'; // Consistent ID for the AI
const AI_USERNAME = 'BingoBot'; // Username for the AI
let isAIGame = false; // Flag to indicate if it's a game against AI

// --- UI Switching Functions ---
function showLobbyScreen() {
    lobbyScreen.style.display = 'flex'; // Use flex to center content
    gameScreen.style.display = 'none';
    lobbyStatusElement.innerText = "Enter a Game ID or create a new game.";
    gameIdInput.value = ''; // Clear input
    // Also clear any game-specific info when returning to lobby
    currentGameId = null;
    currentRoomIdSpan.innerText = '';
    gameStatusElement.innerText = '';
    chatMessagesElement.innerHTML = '';
    updatePlayerIdDisplay(); // Update display for lobby
    // Re-enable lobby buttons
    createGameBtn.disabled = false;
    joinGameBtn.disabled = false;
    playAiBtn.disabled = false; // NEW: Re-enable AI button
    rematchModal.style.display = 'none'; // Ensure rematch modal is hidden
    isDraw = false; // Reset draw state
    currentWinnerId = null; // Ensure winner is cleared
    processingGameEnd = false; // Reset processing flag
    isAIGame = false; // NEW: Reset AI game flag
}

function showGameScreen() {
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    initializeBoard(); // Initialize board when game screen is shown
}

// --- Helper Functions ---

/**
 * Updates the player ID display on both lobby and game screens.
 */
function updatePlayerIdDisplay() {
    const displayId = currentUsername || `Player ${currentPlayerId ? currentPlayerId.substring(0, 4) : '...'}`;
    const displayNum = currentPlayerNumber ? ` (Player ${currentPlayerNumber})` : '';

    playerIdDisplayLobby.innerText = `${displayId}${displayNum}`;
    playerIdSpanGameScreen.innerText = `${displayId}${displayNum}`;
}

/**
 * Displays a custom message box modal.
 * @param {string} title - The title of the message box.
 * @param {string} message - The message content.
 */
function showMessageModal(title, message) {
    modalTitle.innerText = title;
    modalMessage.innerText = message;
    modalOkBtn.removeEventListener('click', hideMessageModal); // Remove previous listener to prevent duplicates
    modalOkBtn.addEventListener('click', hideMessageModal); // Add new listener
    messageModal.style.display = 'flex'; // Show the modal
}

/**
 * Hides the custom message box modal.
 */
function hideMessageModal() {
    modalMessage.innerText = ''; // Clear message for next time
    messageModal.style.display = 'none'; // Hide the modal
}


// Temporary game notifications
let notificationTimeout;
/**
 * Displays a temporary notification on the game screen.
 * @param {string} message - The message to display.
 * @param {string} type - 'info' (default) or 'error'. (Currently only affects message, not styling)
 * @param {number} duration - How long the notification should display in ms.
 */
function displayGameNotification(message, type = 'info', duration = 3000) {
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        gameNotificationsElement.classList.remove('show');
        // Force reflow to restart animation if a new notification comes quickly
        void gameNotificationsElement.offsetWidth; // Trigger reflow
    }

    gameNotificationsElement.innerText = message;
    gameNotificationsElement.classList.add('show');

    notificationTimeout = setTimeout(() => {
        gameNotificationsElement.classList.remove('show');
        notificationTimeout = null;
    }, duration);
}


/**
 * Initializes or resets the Bingo board.
 * Shuffles numbers, clears marked cells, and updates the DOM.
 */
function initializeBoard() {
    numbers = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    marked.fill(false);
    struckLineIndices.clear(); // Clear previously struck lines
    boardElement.innerHTML = ''; // This clears existing cells

    // Reset BINGO tracker letters
    bingoLetters.forEach(letterElement => {
        if (letterElement) {
            letterElement.classList.remove('marked');
        }
    });

    numbers.forEach((num, idx) => {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.innerText = num;
        cell.dataset.index = idx;

        // Ensure previously applied bingo-line-strike classes are removed when board is initialized
        cell.classList.remove('bingo-line-strike');
        cell.classList.remove('marked');

        cell.addEventListener('click', () => {
            if (gameStarted && isMyTurn && !marked[idx]) {
                const calledNumber = parseInt(cell.innerText);
                console.log(`Calling number: ${calledNumber} in game ${currentGameId}...`);
                socket.emit('markNumber', calledNumber);
                disableBoardClicks(); // Disable clicks after calling a number
            } else if (!gameStarted) {
                displayGameNotification("Game has not started yet.", 'error', 2500);
            } else if (!isMyTurn) {
                displayGameNotification("It's not your turn!", 'error', 2500);
            } else if (marked[idx]) {
                displayGameNotification("Number already called!", 'error', 2500);
            }
        });

        boardElement.appendChild(cell);
    });
    disableBoardClicks(); // Initially disable board clicks
}

/**
 * Enables click events on all cells on the board.
 */
function enableBoardClicks() {
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('disabled-cell');
        cell.style.cursor = 'pointer';
    });
}

/**
 * Disables click events on all cells on the board.
 * Adds a visual disabled state.
 */
function disableBoardClicks() {
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.add('disabled-cell');
        cell.style.cursor = 'not-allowed';
    });
}

/**
 * Checks for Bingo lines (rows, columns, diagonals) and applies visual strike.
 * Returns the count of completed Bingo lines.
 * @returns {number} - The total count of completed lines.
 */
function checkBingo() {
    const isCellMarked = (i) => marked[i];

    const allPossibleLines = [
        // Rows
        [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
        // Columns
        [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
        // Diagonals
        [0, 6, 12, 18, 24], // Top-left to bottom-right
        [4, 8, 12, 16, 20]  // Top-right to bottom-left
    ];

    let bingoLineCount = 0;

    allPossibleLines.forEach(lineIndices => {
        if (lineIndices.every(isCellMarked)) {
            bingoLineCount++;
            // Convert lineIndices array to a string for easy Set comparison
            const lineKey = JSON.stringify(lineIndices);

            // If this line hasn't been struck yet, add it to the set and apply visual effect
            if (!struckLineIndices.has(lineKey)) {
                struckLineIndices.add(lineKey);
                lineIndices.forEach(idx => {
                    const cellElement = document.querySelectorAll('.cell')[idx];
                    if (cellElement) {
                        cellElement.classList.add('bingo-line-strike');
                    }
                });
            }
        }
    });

    // Update BINGO tracker letters based on bingoLineCount
    bingoLetters.forEach((letterElement, index) => {
        if (letterElement) {
            if (index < bingoLineCount) {
                letterElement.classList.add('marked');
            } else {
                letterElement.classList.remove('marked');
            }
        }
    });

    return bingoLineCount;
}

/**
 * Appends a new message to the chat display, or an emote.
 * @param {string} senderDisplayName - The username or player number of the sender.
 * @param {string} message - The message content (could be an emote string).
 * @param {boolean} isSelf - True if the message is from the current player.
 * @param {boolean} isEmote - NEW: True if this is an emote message.
 */
function addChatMessage(senderDisplayName, message, isSelf = false, isEmote = false) { // Added isEmote parameter
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');
    // If it's an emote, add a special class for styling if needed
    if (isEmote) {
        messageElement.classList.add('emote-message');
    }

    const displaySender = isSelf ? 'You' : senderDisplayName;
    
    // Format differently for emotes: e.g., "Player-ABCD sent 👍 Nice!"
    if (isEmote) {
        messageElement.innerHTML = `<strong>${displaySender}</strong> sent ${message}`;
    } else {
        messageElement.innerHTML = `<strong>${displaySender}:</strong> ${message}`;
    }
    
    chatMessagesElement.appendChild(messageElement);
    chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
}

/**
 * Sends a periodic HTTP GET request to the backend to keep it awake.
 */
function sendKeepAlivePing() {
    fetch(`${BACKEND_HTTP_URL}/ping`)
        .then(response => {
            if (!response.ok) {
                console.warn('Keep-alive ping failed:', response.statusText);
            } else {
                console.log('Keep-alive ping successful.');
            }
        })
        .catch(error => {
            console.error('Keep-alive ping error:', error);
        });
}

// NEW: AI Logic for its turn
function handleAITurn() {
    // Only proceed if it's an AI game and it's the AI's turn
    if (!isAIGame || !gameStarted || isMyTurn || currentWinnerId || isDraw) {
        return;
    }

    // Small delay to make it seem like the AI is "thinking"
    setTimeout(() => {
        const unmarkedNumbers = [];
        for (let i = 0; i < numbers.length; i++) {
            if (!marked[i]) {
                unmarkedNumbers.push(numbers[i]);
            }
        }

        if (unmarkedNumbers.length > 0) {
            // Simple AI: pick a random unmarked number
            const randomIndex = Math.floor(Math.random() * unmarkedNumbers.length);
            const numberToMark = unmarkedNumbers[randomIndex];
            
            console.log(`AI (${AI_USERNAME}) is marking number: ${numberToMark}`);
            socket.emit('markNumber', numberToMark); // AI "marks" the number via server
        } else {
            console.log("AI: No unmarked numbers left.");
        }
    }, 1500); // 1.5 seconds delay
}


// --- Event Listeners for UI Elements ---

// Copy Game ID to clipboard
copyGameIdBtn.addEventListener('click', () => {
    const gameIdText = currentRoomIdSpan.innerText;
    if (gameIdText) {
        const tempInput = document.createElement('textarea');
        tempInput.value = gameIdText;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        displayGameNotification("Game ID copied!", 'info', 2000);
    } else {
        displayGameNotification("No Game ID to copy.", 'error', 2000);
    }
});


// Lobby Button Listeners
createGameBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (!username) {
        showMessageModal("Username Required", "Please enter a username before creating a game.");
        return;
    }
    console.log(`Requesting to create new game with username: ${username}...`);
    socket.emit('createGame', username);
    lobbyStatusElement.innerText = "Creating game...";
    createGameBtn.disabled = true;
    joinGameBtn.disabled = true;
    playAiBtn.disabled = true; // Disable AI button when creating/joining human game
});

joinGameBtn.addEventListener('click', () => {
    const gameId = gameIdInput.value.trim().toUpperCase();
    const username = usernameInput.value.trim();

    if (!username) {
        showMessageModal("Username Required", "Please enter a username before joining a game.");
        return;
    }
    if (!gameId) {
        showMessageModal("Input Required", "Please enter a Game ID to join.");
        return;
    }

    console.log(`Requesting to join game: ${gameId} with username: ${username}`);
    socket.emit('joinGame', gameId, username);
    lobbyStatusElement.innerText = `Joining game ${gameId}...`;
    createGameBtn.disabled = true;
    joinGameBtn.disabled = true;
    playAiBtn.disabled = true; // Disable AI button when creating/joining human game
});

// NEW: Play with AI Button Listener
playAiBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (!username) {
        showMessageModal("Username Required", "Please enter a username before playing with AI.");
        return;
    }
    console.log(`Requesting to create AI game with username: ${username}...`);
    isAIGame = true; // Set AI game flag
    socket.emit('createAIGame', username);
    lobbyStatusElement.innerText = "Starting game with AI...";
    createGameBtn.disabled = true;
    joinGameBtn.disabled = true;
    playAiBtn.disabled = true;
});


// Game Screen Button Listeners
startGameBtn.addEventListener('click', () => {
    if (!gameStarted && currentGameId) { // Ensure in a game
        console.log(`Attempting to start game in room ${currentGameId}...`);
        socket.emit('startGame');
        startGameBtn.disabled = true;
        gameStatusElement.innerText = "Requesting game start...";
    }
});

// Modified Reset Game button behavior
resetGameBtn.addEventListener('click', () => {
    if (currentGameId) {
        // If game is not started (i.e., after a win or before first start), request new match
        if (!gameStarted) {
            console.log(`Player ${currentUsername} requesting new match in room ${currentGameId}...`);
            socket.emit('requestNewMatch');
            gameStatusElement.innerText = "Requesting new match from opponent...";
            resetGameBtn.disabled = true; // Disable while waiting for response
            startGameBtn.disabled = true; // Keep disabled
        } else {
            // If game is still in progress, this button should not be enabled for reset
            displayGameNotification("Cannot reset: Game is in progress. Wait for a winner.", 'error', 3000);
        }
    }
});

// Exit Room button listener
exitRoomBtn.addEventListener('click', () => {
    if (currentGameId) {
        console.log(`Player ${currentUsername} leaving room ${currentGameId}...`);
        socket.emit('leaveGame'); // Inform the server
        showLobbyScreen(); // Immediately switch to lobby UI
        displayGameNotification("You have left the game room.", 'info', 2000);
    } else {
        showLobbyScreen(); // Already in lobby or not in a game, just ensure lobby is shown
    }
});


sendChatBtn.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message && currentGameId) { // Ensure in a game
        socket.emit('sendMessage', message);
        chatInput.value = '';
    } else if (!currentGameId) {
        showMessageModal("Chat Error", "You must join a game to send messages.");
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatBtn.click();
    }
});

// Rematch modal button listeners
rematchAcceptBtn.addEventListener('click', () => {
    socket.emit('acceptNewMatch');
    rematchModal.style.display = 'none';
    gameStatusElement.innerText = "Accepted rematch. Starting new round...";
    // The server will send a gameReset event, which will handle board and button states.
});

rematchDeclineBtn.addEventListener('click', () => {
    socket.emit('declineNewMatch');
    rematchModal.style.display = 'none';
    gameStatusElement.innerText = "Declined rematch.";
});


// Emote Button Listeners
emoteButtons.forEach(button => {
    button.addEventListener('click', () => {
        if (!currentGameId) {
            showMessageModal("Emote Error", "You must join a game to send emotes.");
            return;
        }
        const emote = button.dataset.emote; // Get the emote string from data-emote attribute
        console.log(`Sending emote: ${emote} in game ${currentGameId}...`);
        socket.emit('sendEmote', emote); // Emit the new event
    });
});


// --- Socket.IO Event Listeners ---

socket.on('connect', () => {
    currentPlayerId = socket.id;
    // Set a default username if not already set or cleared from a previous session
    if (!currentUsername || currentUsername.startsWith("Player-")) {
        currentUsername = `Player-${socket.id.substring(0, 4)}`;
        usernameInput.value = currentUsername;
    }
    updatePlayerIdDisplay();
    console.log(`Connected with ID: ${currentPlayerId}, Username: ${currentUsername}`);
    showLobbyScreen();
    // Start sending keep-alive pings on connect
    sendKeepAlivePing();
});

// NEW: Listener for online players count
socket.on('onlinePlayersCount', (count) => {
    onlinePlayersCountSpan.innerText = count;
});


socket.on('gameCreated', (gameId) => {
    currentGameId = gameId;
    currentRoomIdSpan.innerText = currentGameId;
    console.log(`Game created. Your Game ID: ${gameId}`);
    showMessageModal("Game Created!", `Share this Game ID: ${gameId}`);
    showGameScreen();
    chatMessagesElement.innerHTML = '';
});

// NEW: Game created with AI
socket.on('aiGameCreated', (gameId) => {
    currentGameId = gameId;
    currentRoomIdSpan.innerText = currentGameId;
    console.log(`AI Game created. Your Game ID: ${gameId}`);
    showMessageModal("AI Game Started!", `You are playing against ${AI_USERNAME}.`);
    showGameScreen();
    chatMessagesElement.innerHTML = '';
});


socket.on('gameJoined', (gameId) => {
    currentGameId = gameId;
    currentRoomIdSpan.innerText = currentGameId;
    console.log(`Successfully joined game: ${gameId}`);
    showMessageModal("Game Joined!", `You have joined game ${gameId}.`);
    showGameScreen();
    chatMessagesElement.innerHTML = '';
});

socket.on('gameError', (message) => {
    console.error('Game Error:', message);
    if (message === 'It is not your turn.' || message === 'Number already called.') {
        displayGameNotification(message, 'error', 2500);
    } else {
        showMessageModal("Game Error", message);
        lobbyStatusElement.innerText = message;
        createGameBtn.disabled = false;
        joinGameBtn.disabled = false;
        playAiBtn.disabled = false; // NEW: Re-enable AI button on error
        // If the error is about a pending rematch request, re-enable reset button
        if (message.includes("A new match request is already pending.")) {
            resetGameBtn.disabled = false; // Allow user to try requesting again
            startGameBtn.disabled = true; // Still disabled after a win
            gameStatusElement.innerText = "Rematch request already pending. Please wait or try again.";
        }
    }
});

socket.on('userJoined', (username) => {
    displayGameNotification(`${username} joined!`);
    console.log(`${username} joined the game.`);
});

socket.on('userLeft', (username) => {
    displayGameNotification(`${username} left the game.`);
    console.log(`${username} left the game.`);
});

// Listener for new match request from opponent
socket.on('newMatchRequested', (data) => { // 'data' will now be { requesterId, requesterUsername }
    if (isAIGame) { // NEW: If it's an AI game, auto-accept or handle differently
        // For AI, we can just auto-accept the rematch
        console.log("AI game: Auto-accepting rematch request.");
        socket.emit('acceptNewMatch');
        return;
    }

    if (data.requesterId === currentPlayerId) {
        // This is the player who sent the request
        gameStatusElement.innerText = "Waiting for opponent's response to rematch request...";
        rematchModal.style.display = 'none'; // Ensure modal is hidden for the requester
    } else {
        // This is the opponent
        rematchModalMessage.innerText = `${data.requesterUsername} wants to play another match!`;
        rematchModal.style.display = 'flex';
        gameStatusElement.innerText = "Opponent requested a rematch!";
    }
    // Ensure game buttons are disabled while rematch request is pending for BOTH
    startGameBtn.disabled = true;
    resetGameBtn.disabled = true;
});

// Listener when new match is accepted
socket.on('newMatchAccepted', () => {
    // This event is now primarily for notification. The actual reset and state update
    // will come from the 'gameReset' and 'gameState' events emitted by the server
    // after the 'acceptNewMatch' call.
    displayGameNotification("Rematch accepted! Starting new game.", 'info', 3000);
    rematchModal.style.display = 'none'; // Hide modal if it was showing
});

// Listener when new match is declined
socket.on('newMatchDeclined', (declinerUsername) => {
    displayGameNotification(`${declinerUsername} declined the rematch.`, 'error', 3000);
    rematchModal.style.display = 'none'; // Hide modal if it was showing
    // After decline, revert to post-win state (Start Game disabled, Reset Game enabled)
    startGameBtn.disabled = true; // Keep Start Game disabled after decline
    resetGameBtn.disabled = false; // Allow requesting again
    gameStatusElement.innerText = "Rematch declined. Click 'Reset Game' to send another request.";
});

// Listener for a game ending in a draw
socket.on('gameDraw', (data) => {
    console.log(`Game ended in a draw on number ${data.number}.`);
    disableBoardClicks();
    gameStarted = false; // Game is no longer started
    currentWinnerId = null; // IMPORTANT: Clear winner ID on draw
    isDraw = true; // Set draw state
    processingGameEnd = true; // Set flag to indicate we're processing a game end

    // Ensure any previously shown 'win' modal is hidden
    hideMessageModal(); 
    showMessageModal("It's a Draw!", `Both players got Bingo on number ${data.number}!`);
    gameStatusElement.innerText = `It's a Draw! Click 'Reset Game' for a rematch.`;
    // The gameState update will correctly set button states based on isDraw.
});


socket.on('gameState', (state) => {
    console.log('Received gameState:', state);

    if (!state || !Array.isArray(state.players) || !Array.isArray(state.markedNumbers) || !state.gameId) {
        console.error("Received an invalid gameState object. Missing or malformed data.", state);
        gameStatusElement.innerText = "Error: Invalid game state received from server. Please refresh.";
        showLobbyScreen();
        return;
    }

    if (state.gameId !== currentGameId) {
        console.warn(`Received gameState for a different game ID (${state.gameId}) than current (${currentGameId}). Ignoring.`);
        return;
    }

    // Determine if this is an AI game based on players in the state
    isAIGame = state.players.some(p => p.id === AI_PLAYER_ID);

    // Update player info (username, number)
    const selfPlayer = state.players.find(p => p.id === currentPlayerId);
    if (selfPlayer) {
        currentUsername = selfPlayer.username;
        currentPlayerNumber = selfPlayer.playerNumber;
        updatePlayerIdDisplay();
    } else {
        currentUsername = `Disconnected Player`;
        currentPlayerNumber = null;
        updatePlayerIdDisplay();
        console.error("Current player not found in gameState players list.");
    }

    // Update local game state variables
    gameStarted = state.gameStarted;
    isMyTurn = state.currentTurnPlayerId === currentPlayerId;
    currentWinnerId = state.winnerId; // Update global winner ID from server state
    isDraw = state.draw; // Update local draw state from server state

    // Reset processing flag if game is no longer ended (e.g., after a reset)
    if (!state.winnerId && !state.draw && state.gameStarted) {
        processingGameEnd = false;
    }


    // --- IMPORTANT: Handle button states and status messages based on current game state ---
    if (isDraw) { // Prioritize draw state for display
        startGameBtn.disabled = true;
        resetGameBtn.disabled = false;
        gameStatusElement.innerText = `It's a Draw! Click 'Reset Game' for a rematch.`;
        // Only show modal if we haven't already processed a game end event that would show it
        if (!processingGameEnd) {
             showMessageModal("It's a Draw!", `Both players got Bingo on number ${state.markedNumbers[state.markedNumbers.length-1]}!`);
             processingGameEnd = true; // Mark as processed
        }
        disableBoardClicks();
    } else if (currentWinnerId) { // Game has ended with a winner (and it's not a draw)
        startGameBtn.disabled = true;
        resetGameBtn.disabled = false;
        const winnerUsername = state.players.find(p => p.id === currentWinnerId)?.username || 'Someone';
        gameStatusElement.innerText = `Game Over! ${winnerUsername} won. Click 'Reset Game' for a rematch.`;
        // Only show modal if we haven't already processed a game end event that would show it
        if (!processingGameEnd) {
            if (currentWinnerId === currentPlayerId) {
                showMessageModal("Congratulations!", "BINGO! You won the game!");
            } else {
                showMessageModal("Game Over!", `${winnerUsername} won the game!`);
            }
            processingGameEnd = true; // Mark as processed
        }
        disableBoardClicks();
    }
    else if (state.pendingNewMatchRequest) { // A rematch request is pending
        startGameBtn.disabled = true;
        resetGameBtn.disabled = true; // Both disabled during negotiation
        if (state.pendingNewMatchRequest.requesterId === currentPlayerId) {
            gameStatusElement.innerText = "Waiting for opponent's response to rematch request...";
            rematchModal.style.display = 'none'; // Ensure modal is hidden for the requester
        } else {
            gameStatusElement.innerText = `${state.pendingNewMatchRequest.requesterUsername} wants to play again! Please respond in the modal.`;
            // Modal display for opponent is handled in newMatchRequested listener directly.
        }
        disableBoardClicks();
    } else if (gameStarted) { // Game is actively in progress (no winner, no pending request, no draw)
        startGameBtn.disabled = true;
        resetGameBtn.disabled = true;
        
        const turnPlayer = state.players.find(p => p.id === state.currentTurnPlayerId);
        const turnPlayerName = turnPlayer ? turnPlayer.username : "Unknown Player";

        if (isMyTurn) {
            gameStatusElement.innerText = "Your Turn! Click a number to call it.";
            enableBoardClicks();
        } else {
            gameStatusElement.innerText = `Waiting for ${turnPlayerName} to call a number.`;
            disableBoardClicks();
            // NEW: Trigger AI turn if it's AI's turn
            if (isAIGame && state.currentTurnPlayerId === AI_PLAYER_ID) {
                handleAITurn();
            }
        }
        processingGameEnd = false; // Ensure flag is off if game becomes active again
    } else { // Game is not started (e.g., lobby state, after full reset, or initial join, or after a decline)
        if (state.players.length >= 2) {
            startGameBtn.disabled = false; // Enable if 2 players are present and no game is started/won/pending
            resetGameBtn.disabled = true; // Reset is only for post-win/rematch scenario now
            gameStatusElement.innerText = "Two players ready! Click 'Start Game' to begin.";
        } else {
            startGameBtn.disabled = true;
            resetGameBtn.disabled = true;
            gameStatusElement.innerText = "Waiting for another player to join...";
        }
        disableBoardClicks();
        processingGameEnd = false; // Ensure flag is off if game is not started
    }

    // Update board based on globally marked numbers
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('marked');
        cell.classList.remove('bingo-line-strike');
    });
    struckLineIndices.clear(); // Clear local struck lines state for fresh re-evaluation

    state.markedNumbers.forEach(num => {
        const idx = numbers.indexOf(num);
        if (idx > -1) {
            marked[idx] = true;
            document.querySelectorAll('.cell')[idx].classList.add('marked');
        }
    });
    checkBingo(); // Re-check and apply strikes based on current marked numbers
});

socket.on('numberMarked', (num) => {
    console.log(`Number ${num} marked by server confirmation.`);
    const idx = numbers.indexOf(num);
    if (idx > -1 && !marked[idx]) {
        marked[idx] = true;
        document.querySelectorAll('.cell')[idx].classList.add('marked');

        const currentBingoLineCount = checkBingo();
        // Only emit 'declareWin' if the game is still considered started and no winner is known yet, AND not a draw
        if (gameStarted && currentBingoLineCount >= 5 && !currentWinnerId && !isDraw) {
            console.log(`Player ${currentUsername} achieved BINGO! Emitting 'declareWin'.`);
            socket.emit('declareWin');
        }
    }
});

socket.on('playerDeclaredWin', (data) => {
    // ONLY process if we are not already processing a draw (which takes precedence)
    if (isDraw) { // If it's already a draw, ignore a late playerDeclaredWin
        console.log("Ignoring playerDeclaredWin, game is already in a draw state.");
        return;
    }
    // Set processingGameEnd true here to prevent conflicting modals from gameState
    processingGameEnd = true;

    console.log(`${data.winningUsername} declared win. Game ending.`);
    disableBoardClicks();
    gameStarted = false; // Game is no longer started
    currentWinnerId = data.winnerId; // Ensure local winner ID is set immediately
    isDraw = false; // Ensure not a draw

    // The gameState update will now correctly set button states based on winnerId.

    if (data.winnerId === currentPlayerId) {
        showMessageModal("Congratulations!", "BINGO! You won the game!");
        gameStatusElement.innerText = "You won! Click 'Reset Game' to start a new round.";
    } else {
        showMessageModal("Game Over!", `${data.winningUsername} won the game!`);
        gameStatusElement.innerText = `${data.winningUsername} won! Click 'Reset Game' to start a new round.`;
    }
});

socket.on('gameReset', () => {
    console.log('Game reset event received from server.');
    initializeBoard(); // This now also clears struckLineIndices and removes strike classes
    gameStarted = false;
    isMyTurn = false;
    currentWinnerId = null; // Reset winner ID on game reset
    isDraw = false; // Reset draw state on game reset
    processingGameEnd = false; // Reset processing flag on game reset
    // Button states will be handled by the gameState update
    gameStatusElement.innerText = "Game has been reset. Waiting for players to ready up or another player to join.";
    showMessageModal("Game Reset", "The game has been reset. A new round can begin!");
});

socket.on('message', (data) => {
    const isSelf = (data.senderId === currentUsername) || (data.senderId === `Player-${currentPlayerId.substring(0, 4)}`);
    // Existing message handling
    addChatMessage(data.senderId, data.message, isSelf, false); // Explicitly set isEmote to false
});

// Listen for incoming emotes
socket.on('emote', (data) => {
    // data should contain { senderUsername, emote }
    const isSelf = (data.senderUsername === currentUsername); // Check if sender is current user
    addChatMessage(data.senderUsername, data.emote, isSelf, true); // Set isEmote to true
});


socket.on('disconnect', () => {
    console.log('Disconnected from server.');
    gameStatusElement.innerText = "Disconnected from server. Please refresh.";
    startGameBtn.disabled = true;
    resetGameBtn.disabled = true;
    disableBoardClicks();
    showMessageModal("Disconnected", "You have been disconnected from the server. Please refresh the page to reconnect.");
    showLobbyScreen();
    currentGameId = null;
    currentPlayerNumber = null;
    currentWinnerId = null; // Reset on disconnect
    isDraw = false; // Reset on disconnect
    processingGameEnd = false; // Reset on disconnect
    isAIGame = false; // NEW: Reset AI game flag on disconnect
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    gameStatusElement.innerText = "Connection error. Please check server status.";
    showMessageModal("Connection Error", `Could not connect to the game server: ${error.message}`);
    showLobbyScreen();
    currentGameId = null;
    currentPlayerNumber = null;
    currentWinnerId = null; // Reset on connection error
    isDraw = false; // Reset on connection error
    processingGameEnd = false; // Reset on connection error
    isAIGame = false; // NEW: Reset AI game flag on connection error
});

document.addEventListener('DOMContentLoaded', () => {
    const storedUsername = localStorage.getItem('bingoUsername');
    if (storedUsername) {
        usernameInput.value = storedUsername;
        currentUsername = storedUsername;
    } else {
        currentUsername = `Player-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        usernameInput.value = currentUsername;
    }
    updatePlayerIdDisplay();
});

usernameInput.addEventListener('input', () => {
    localStorage.setItem('bingoUsername', usernameInput.value.trim());
    currentUsername = usernameInput.value.trim();
    updatePlayerIdDisplay();
});

// Call the ping function periodically
// Send a ping every 5 minutes (300000 ms)
setInterval(sendKeepAlivePing, 300000);