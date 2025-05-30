// Establish Socket.IO connection to the backend server
const socket = io('https://bingo-backend-1-4ajn.onrender.com'); // <--- !!! ENSURE THIS MATCHES YOUR DEPLOYED BACKEND URL !!!

// --- DOM Elements ---
// Lobby Screen Elements
const lobbyScreen = document.getElementById('lobby-screen');
const usernameInput = document.getElementById('username-input');
const gameIdInput = document.getElementById('game-id-input');
const createGameBtn = document.getElementById('create-game-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const lobbyStatusElement = document.getElementById('lobby-status');
const playerIdDisplayLobby = document.getElementById('player-id'); // For Lobby Screen

// Game Screen Elements
const gameScreen = document.getElementById('game-screen');
const boardElement = document.getElementById('board');
const playerInfoElement = document.getElementById('player-info'); // This div contains game ID
const playerIdSpanGameScreen = document.getElementById('player-id-game-screen'); // For Game Screen
const currentRoomIdSpan = document.getElementById('current-room-id'); // Span for game ID in game screen
const copyGameIdBtn = document.getElementById('copy-game-id-btn'); // NEW: Copy button
const gameStatusElement = document.getElementById('game-status');
const startGameBtn = document.getElementById('start-game-btn');
const resetGameBtn = document.getElementById('reset-game-btn');
const chatMessagesElement = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const messageModal = document.getElementById('message-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalOkBtn = document.getElementById('modal-ok-btn');

// Game Notifications Element
const gameNotificationsElement = document.getElementById('game-notifications');


// --- Game State Variables ---
let numbers = []; // Array to hold the numbers on the player's board (1-25, shuffled)
let marked = Array(25).fill(false); // Boolean array to track marked cells
let gameStarted = false; // Flag to indicate if the game has started
let isMyTurn = false; // Flag to indicate if it's the current player's turn
let currentPlayerId = null; // Stores the unique socket ID assigned to this player by the server
let currentUsername = "Player"; // Stores the chosen username for this player
let currentPlayerNumber = null; // Stores the assigned player number (e.g., 1 or 2)
let currentGameId = null; // Stores the ID of the game room the player is in

// Set to keep track of lines that have been visually struck
let struckLineIndices = new Set();

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

    return bingoLineCount;
}

/**
 * Appends a new message to the chat display.
 * @param {string} senderDisplayName - The username or player number of the sender.
 * @param {string} message - The message content.
 * @param {boolean} isSelf - True if the message is from the current player.
 */
function addChatMessage(senderDisplayName, message, isSelf = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');
    // Display "You" if it's the current player, otherwise the sender's display name
    const displaySender = isSelf ? 'You' : senderDisplayName;
    messageElement.innerHTML = `<strong>${displaySender}:</strong> ${message}`;
    chatMessagesElement.appendChild(messageElement);
    chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
}

// --- Event Listeners for UI Elements ---

// NEW: Copy Game ID to clipboard
copyGameIdBtn.addEventListener('click', () => {
    const gameIdText = currentRoomIdSpan.innerText;
    if (gameIdText) {
        // Use a temporary textarea to copy text to clipboard
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

resetGameBtn.addEventListener('click', () => {
    if (currentGameId) { // Allow reset if in a game, regardless of gameStarted state
        console.log(`Attempting to reset game in room ${currentGameId}...`);
        socket.emit('resetGame');
        resetGameBtn.disabled = true;
        gameStatusElement.innerText = "Requesting game reset...";
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

// --- Socket.IO Event Listeners ---

socket.on('connect', () => {
    currentPlayerId = socket.id;
    // Set a default username if not already set or cleared from a previous session
    if (!currentUsername || currentUsername.startsWith("Player-")) { // If it's still default "Player-"
        currentUsername = `Player-${socket.id.substring(0, 4)}`;
        usernameInput.value = currentUsername; // Set input field to default
    }
    updatePlayerIdDisplay(); // Update display on connect
    console.log(`Connected with ID: ${currentPlayerId}, Username: ${currentUsername}`);
    showLobbyScreen(); // Show lobby first
});

// Listen for game creation confirmation
socket.on('gameCreated', (gameId) => {
    currentGameId = gameId;
    currentRoomIdSpan.innerText = currentGameId; // Display game ID on game screen
    console.log(`Game created. Your Game ID: ${gameId}`);
    showMessageModal("Game Created!", `Share this Game ID: ${gameId}`);
    showGameScreen(); // Transition to game screen
    chatMessagesElement.innerHTML = ''; // Clear chat for new game
});

// Listen for game join confirmation
socket.on('gameJoined', (gameId) => {
    currentGameId = gameId;
    currentRoomIdSpan.innerText = currentGameId; // Display game ID on game screen
    console.log(`Successfully joined game: ${gameId}`);
    showMessageModal("Game Joined!", `You have joined game ${gameId}.`);
    showGameScreen(); // Transition to game screen
    chatMessagesElement.innerHTML = ''; // Clear chat for new game
});

// Listen for game errors (e.g., ID not found, game started, etc.)
socket.on('gameError', (message) => {
    console.error('Game Error:', message);
    if (message === 'It is not your turn.' || message === 'Number already called.') {
        displayGameNotification(message, 'error', 2500); // Shorter duration for quick feedback
    } else {
        // Use modal for other, more critical errors like game not found or room full
        showMessageModal("Game Error", message);
        lobbyStatusElement.innerText = message; // Update lobby status if applicable
        // Re-enable join/create buttons if an error occurred during join attempt
        createGameBtn.disabled = false;
        joinGameBtn.disabled = false;
    }
});

// Listen for user joined notification (now receives username)
socket.on('userJoined', (username) => {
    displayGameNotification(`${username} joined!`);
    console.log(`${username} joined the game.`);
});

// Listen for user left notification (now receives username)
socket.on('userLeft', (username) => {
    displayGameNotification(`${username} left the game.`);
    console.log(`${username} left the game.`);
});

// Listen for game state updates from the server
socket.on('gameState', (state) => {
    console.log('Received gameState:', state);

    // Basic validation for received state
    if (!state || !Array.isArray(state.players) || !Array.isArray(state.markedNumbers) || !state.gameId) {
        console.error("Received an invalid gameState object. Missing or malformed data.", state);
        gameStatusElement.innerText = "Error: Invalid game state received from server. Please refresh.";
        showLobbyScreen();
        return;
    }

    // Ensure this state update is for the game we are currently in
    if (state.gameId !== currentGameId) {
        console.warn(`Received gameState for a different game ID (${state.gameId}) than current (${currentGameId}). Ignoring.`);
        return;
    }

    gameStarted = state.gameStarted;

    // Find current player's data from the received state
    const selfPlayer = state.players.find(p => p.id === currentPlayerId);
    if (selfPlayer) {
        currentUsername = selfPlayer.username;
        currentPlayerNumber = selfPlayer.playerNumber;
        updatePlayerIdDisplay(); // Update display based on server-assigned data
    } else {
        // This case should ideally not happen if player is in game, but handle gracefully
        currentUsername = `Disconnected Player`;
        currentPlayerNumber = null;
        updatePlayerIdDisplay();
        console.error("Current player not found in gameState players list.");
    }

    isMyTurn = state.currentTurnPlayerId === currentPlayerId;

    if (!gameStarted) {
        if (state.players.length >= 2) {
            startGameBtn.disabled = false;
            gameStatusElement.innerText = "Two players ready! Click 'Start Game' to begin.";
        } else {
            startGameBtn.disabled = true;
            gameStatusElement.innerText = "Waiting for another player to join...";
        }
        resetGameBtn.disabled = true; // Reset button disabled when game not started
        disableBoardClicks();
    } else { // If game IS started
        startGameBtn.disabled = true;
        resetGameBtn.disabled = false; // Reset button enabled when game is in progress or won

        // Find the username of the player whose turn it is
        const turnPlayer = state.players.find(p => p.id === state.currentTurnPlayerId);
        const turnPlayerName = turnPlayer ? turnPlayer.username : "Unknown Player";

        if (isMyTurn) {
            gameStatusElement.innerText = "Your Turn! Click a number to call it.";
            enableBoardClicks();
        } else {
            gameStatusElement.innerText = `Waiting for ${turnPlayerName} to call a number.`;
            disableBoardClicks();
        }
    }

    // Update board based on globally marked numbers
    // First, remove all marked and bingo-line-strike classes
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('marked');
        cell.classList.remove('bingo-line-strike'); // Ensure line strike is removed
    });
    // Then, re-apply marked classes
    state.markedNumbers.forEach(num => {
        const idx = numbers.indexOf(num);
        if (idx > -1) {
            marked[idx] = true; // Update local marked state
            document.querySelectorAll('.cell')[idx].classList.add('marked');
        }
    });
    // After updating marked numbers, check for Bingo lines to apply strikes
    // We call checkBingo here to ensure lines are struck based on the *latest* marked numbers from the server.
    // This is important for clients who might join mid-game or if their marked state gets out of sync.
    checkBingo();
});

// Listen for a number being marked (called) by any player
socket.on('numberMarked', (num) => {
    console.log(`Number ${num} marked by server confirmation.`);
    const idx = numbers.indexOf(num);
    if (idx > -1 && !marked[idx]) {
        marked[idx] = true;
        document.querySelectorAll('.cell')[idx].classList.add('marked');

        const currentBingoLineCount = checkBingo(); // Check for Bingo lines and apply strikes
        if (gameStarted && currentBingoLineCount >= 5) { // Check for >=5 lines for Bingo win
            console.log(`Player ${currentUsername} achieved BINGO! Emitting 'declareWin'.`);
            socket.emit('declareWin');
        }
    }
});

// Listen for a player declaring win (now receives an object with winnerId and winningUsername)
socket.on('playerDeclaredWin', (data) => {
    console.log(`${data.winningUsername} declared win. Game ending.`);
    disableBoardClicks();
    gameStarted = false;
    startGameBtn.disabled = false;
    resetGameBtn.disabled = false;
    
    // Use winnerId to determine if current player won
    if (data.winnerId === currentPlayerId) {
        showMessageModal("Congratulations!", "BINGO! You won the game!");
        gameStatusElement.innerText = "You won! Click 'Reset Game' to start a new round.";
    } else {
        showMessageModal("Game Over!", `${data.winningUsername} won the game!`);
        gameStatusElement.innerText = `${data.winningUsername} won! Click 'Reset Game' to start a new round.`;
    }
});

// Listen for game reset event from server
socket.on('gameReset', () => {
    console.log('Game reset event received from server.');
    initializeBoard(); // This now also clears struckLineIndices and removes strike classes
    gameStarted = false;
    isMyTurn = false;
    startGameBtn.disabled = false;
    resetGameBtn.disabled = true;
    gameStatusElement.innerText = "Game has been reset. Click 'Start Game' to begin a new round.";
    showMessageModal("Game Reset", "The game has been reset. A new round can begin!");
});

// Listen for incoming chat messages (senderId is now username)
socket.on('message', (data) => {
    // Check if the sender is the current player by username
    const isSelf = (data.senderId === currentUsername) || (data.senderId === `Player-${currentPlayerId.substring(0, 4)}`); // Handle potential temporary ID
    addChatMessage(data.senderId, data.message, isSelf);
});

// Listen for server errors or disconnections
socket.on('disconnect', () => {
    console.log('Disconnected from server.');
    gameStatusElement.innerText = "Disconnected from server. Please refresh.";
    startGameBtn.disabled = true;
    resetGameBtn.disabled = true;
    disableBoardClicks();
    showMessageModal("Disconnected", "You have been disconnected from the server. Please refresh the page to reconnect.");
    showLobbyScreen(); // Go back to lobby on disconnect
    currentGameId = null; // Clear current game ID
    currentPlayerNumber = null; // Clear player number
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    gameStatusElement.innerText = "Connection error. Please check server status.";
    showMessageModal("Connection Error", `Could not connect to the game server: ${error.message}`);
    showLobbyScreen(); // Go back to lobby on connection error
    currentGameId = null; // Clear current game ID
    currentPlayerNumber = null; // Clear player number
});

// --- Initial Setup ---
// The page will initially show the lobby screen due to socket.on('connect')
// initializeBoard() is now called when showGameScreen() is called.
// Buttons in game screen are controlled by gameState updates.
// Set a default username when the script loads or on connect if empty
document.addEventListener('DOMContentLoaded', () => {
    // Check if username is already in local storage (optional, but good for persistence)
    const storedUsername = localStorage.getItem('bingoUsername');
    if (storedUsername) {
        usernameInput.value = storedUsername;
        currentUsername = storedUsername;
    } else {
        currentUsername = `Player-${Math.random().toString(36).substring(2, 6).toUpperCase()}`; // More random default
        usernameInput.value = currentUsername;
    }
    updatePlayerIdDisplay(); // Initialize display
});

// Save username to local storage on input change
usernameInput.addEventListener('input', () => {
    localStorage.setItem('bingoUsername', usernameInput.value.trim());
    currentUsername = usernameInput.value.trim();
    updatePlayerIdDisplay();
});