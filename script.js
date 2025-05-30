// Establish Socket.IO connection to the backend server
const socket = io('https://bingo-backend-1-4ajn.onrender.com');

// --- DOM Elements ---
// Lobby Screen Elements
const lobbyScreen = document.getElementById('lobby-screen');
const gameIdInput = document.getElementById('game-id-input');
const createGameBtn = document.getElementById('create-game-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const lobbyStatusElement = document.getElementById('lobby-status');
const playerIdDisplayLobby = document.getElementById('player-id'); // For Lobby Screen

// Game Screen Elements (Existing)
const gameScreen = document.getElementById('game-screen'); // New container for game UI
const boardElement = document.getElementById('board');
const playerInfoElement = document.getElementById('player-info'); // This div contains game ID
const playerIdSpanGameScreen = document.getElementById('player-id-game-screen'); // For Game Screen
const currentRoomIdSpan = document.getElementById('current-room-id'); // New span for game ID in game screen
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

// --- Game State Variables ---
let numbers = []; // Array to hold the numbers on the player's board (1-25, shuffled)
let marked = Array(25).fill(false); // Boolean array to track marked cells
let gameStarted = false; // Flag to indicate if the game has started
let isMyTurn = false; // Flag to indicate if it's the current player's turn
let currentPlayerId = null; // Stores the unique ID assigned to this player by the server
let currentGameId = null; // Stores the ID of the game room the player is in

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
}

function showGameScreen() {
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    initializeBoard(); // Initialize board when game screen is shown
}

// --- Helper Functions ---

/**
 * Displays a custom message box modal.
 * @param {string} title - The title of the message box.
 * @param {string} message - The message content.
 */
function showMessageModal(title, message) {
    modalTitle.innerText = title;
    modalMessage.innerText = message;
    messageModal.style.display = 'flex'; // Show the modal
}

/**
 * Hides the custom message box modal.
 */
function hideMessageModal() {
    modalOkBtn.removeEventListener('click', hideMessageModal); // Remove previous listener to prevent duplicates
    modalOkBtn.addEventListener('click', hideMessageModal); // Add new listener
    messageModal.style.display = 'none'; // Hide the modal
}

/**
 * Initializes or resets the Bingo board.
 * Shuffles numbers, clears marked cells, and updates the DOM.
 */
function initializeBoard() {
    numbers = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    marked.fill(false);
    boardElement.innerHTML = ''; // This clears existing cells

    numbers.forEach((num, idx) => {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.innerText = num;
        cell.dataset.index = idx;

        cell.addEventListener('click', () => {
            if (gameStarted && isMyTurn && !marked[idx]) {
                const calledNumber = parseInt(cell.innerText);
                console.log(`Calling number: ${calledNumber} in game ${currentGameId}...`);
                // CORRECTED: No gameId parameter needed here, backend uses socket.id's playerGameId
                socket.emit('markNumber', calledNumber);
                disableBoardClicks(); // Disable clicks after calling a number
            } else if (!gameStarted) {
                showMessageModal("Game Not Started", "The game has not started yet. Click 'Start Game' to begin.");
            } else if (!isMyTurn) {
                showMessageModal("Not Your Turn", "It's not your turn to call a number.");
            } else if (marked[idx]) {
                showMessageModal("Already Marked", "This number has already been called.");
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
 * Checks for Bingo lines (rows, columns, diagonals).
 * Returns the count of completed Bingo lines.
 * @returns {number} - The total count of completed lines.
 */
function checkBingo() {
    const isCellMarked = (i) => marked[i];

    const allPossibleLines = [
        [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
        [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
        [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]
    ];

    let bingoLineCount = 0;
    allPossibleLines.forEach(lineIndices => {
        if (lineIndices.every(isCellMarked)) {
            bingoLineCount++;
        }
    });
    return bingoLineCount;
}

/**
 * Appends a new message to the chat display.
 * @param {string} senderId - The ID of the sender.
 * @param {string} message - The message content.
 * @param {boolean} isSelf - True if the message is from the current player.
 */
function addChatMessage(senderId, message, isSelf = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');
    const sender = isSelf ? 'You' : senderId;
    messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatMessagesElement.appendChild(messageElement);
    chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
}

// --- Event Listeners for UI Elements ---

modalOkBtn.addEventListener('click', hideMessageModal);

// Lobby Button Listeners
createGameBtn.addEventListener('click', () => {
    console.log('Requesting to create new game...');
    socket.emit('createGame');
    lobbyStatusElement.innerText = "Creating game...";
});

joinGameBtn.addEventListener('click', () => {
    const gameId = gameIdInput.value.trim().toUpperCase();
    if (gameId) {
        console.log(`Requesting to join game: ${gameId}`);
        socket.emit('joinGame', gameId);
        lobbyStatusElement.innerText = `Joining game ${gameId}...`;
    } else {
        showMessageModal("Input Required", "Please enter a Game ID to join.");
    }
});

// Game Screen Button Listeners
startGameBtn.addEventListener('click', () => {
    if (!gameStarted && currentGameId) { // Ensure in a game
        console.log(`Attempting to start game in room ${currentGameId}...`);
        // CORRECTED: No gameId parameter needed here, backend uses socket.id's playerGameId
        socket.emit('startGame');
        startGameBtn.disabled = true;
        gameStatusElement.innerText = "Requesting game start...";
    }
});

resetGameBtn.addEventListener('click', () => {
    if (gameStarted && currentGameId) { // Ensure in a game
        console.log(`Attempting to reset game in room ${currentGameId}...`);
        // CORRECTED: No gameId parameter needed here, backend uses socket.id's playerGameId
        socket.emit('resetGame');
        resetGameBtn.disabled = true;
        gameStatusElement.innerText = "Requesting game reset...";
    }
});

sendChatBtn.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message && currentGameId) { // Ensure in a game
        // CORRECTED: No gameId parameter needed here, backend uses socket.id's playerGameId
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
    playerIdDisplayLobby.innerText = currentPlayerId; // Display ID on lobby screen
    playerIdSpanGameScreen.innerText = currentPlayerId; // Display ID on game screen
    console.log(`Connected with ID: ${currentPlayerId}`);
    showLobbyScreen(); // Show lobby first
});

// New: Listen for game creation confirmation
socket.on('gameCreated', (gameId) => {
    currentGameId = gameId;
    currentRoomIdSpan.innerText = currentGameId; // Display game ID on game screen
    console.log(`Game created. Your Game ID: ${gameId}`);
    showMessageModal("Game Created!", `Share this Game ID: ${gameId}`);
    showGameScreen(); // Transition to game screen
    chatMessagesElement.innerHTML = ''; // Clear chat for new game
});

// New: Listen for game join confirmation
socket.on('gameJoined', (gameId) => {
    currentGameId = gameId;
    currentRoomIdSpan.innerText = currentGameId; // Display game ID on game screen
    console.log(`Successfully joined game: ${gameId}`);
    showMessageModal("Game Joined!", `You have joined game ${gameId}.`);
    showGameScreen(); // Transition to game screen
    chatMessagesElement.innerHTML = ''; // Clear chat for new game
});

// New: Listen for game errors (e.g., ID not found, game started)
socket.on('gameError', (message) => {
    console.error('Game Error:', message);
    showMessageModal("Game Error", message);
    lobbyStatusElement.innerText = message; // Update lobby status if applicable
    // Re-enable join/create buttons if an error occurred during join attempt
    createGameBtn.disabled = false;
    joinGameBtn.disabled = false;
});

// Listen for game state updates from the server
socket.on('gameState', (state) => {
    console.log('Received gameState:', state);

    // Basic validation for received state
    if (!state || !Array.isArray(state.players) || !Array.isArray(state.markedNumbers) || !state.gameId) {
        console.error("Received an invalid gameState object. Missing or malformed data.", state);
        gameStatusElement.innerText = "Error: Invalid game state received from server. Please refresh.";
        // Potentially force back to lobby if state is truly messed up
        showLobbyScreen();
        return;
    }

    // Ensure this state update is for the game we are currently in
    if (state.gameId !== currentGameId) {
        console.warn(`Received gameState for a different game ID (${state.gameId}) than current (${currentGameId}). Ignoring.`);
        return;
    }

    gameStarted = state.gameStarted;
    isMyTurn = state.currentTurnPlayerId === currentPlayerId;

    console.log(`Updated client state for Game ${currentGameId}: gameStarted=${gameStarted}, isMyTurn=${isMyTurn}, players.length=${state.players.length}`);

    if (!gameStarted) {
        if (state.players.length >= 2) {
            startGameBtn.disabled = false;
            gameStatusElement.innerText = "Two players ready! Click 'Start Game' to begin.";
            console.log('UI Update: Start Game button ENABLED (2+ players, game not started)');
        } else {
            startGameBtn.disabled = true;
            gameStatusElement.innerText = "Waiting for another player to join...";
            console.log('UI Update: Start Game button DISABLED (<2 players, game not started)');
        }
        resetGameBtn.disabled = true;
        disableBoardClicks();
        console.log('UI Update: Reset Game button DISABLED, board clicks DISABLED');
    } else { // If game IS started
        startGameBtn.disabled = true;
        resetGameBtn.disabled = false;
        console.log('UI Update: Start Game button DISABLED, Reset Game button ENABLED');
        if (isMyTurn) {
            gameStatusElement.innerText = "Your Turn! Click a number to call it.";
            enableBoardClicks();
            console.log('UI Update: It is your turn, board clicks ENABLED');
        } else {
            gameStatusElement.innerText = `Waiting for ${state.currentTurnPlayerId.substring(0, 5)}... to call a number.`; // Shorten ID for display
            disableBoardClicks();
            console.log('UI Update: Not your turn, board clicks DISABLED');
        }
    }

    // Update board based on globally marked numbers
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('marked');
    });

    state.markedNumbers.forEach(num => {
        const idx = numbers.indexOf(num);
        if (idx > -1) {
            marked[idx] = true;
            document.querySelectorAll('.cell')[idx].classList.add('marked');
        }
    });
    console.log('UI Update: Board marked based on server state.');
});

// Listen for a number being marked (called) by any player
socket.on('numberMarked', (num) => {
    console.log(`Number ${num} marked by server confirmation.`);
    const idx = numbers.indexOf(num);
    if (idx > -1 && !marked[idx]) {
        marked[idx] = true;
        document.querySelectorAll('.cell')[idx].classList.add('marked');
        gameStatusElement.innerText = `Number ${num} was called!`;

        const currentBingoLineCount = checkBingo();
        if (gameStarted && currentBingoLineCount === 5) {
            console.log(`Player ${currentPlayerId} achieved BINGO! Emitting 'declareWin'.`);
            // CORRECTED: No gameId parameter needed here, backend uses socket.id's playerGameId
            socket.emit('declareWin');
        }
    }
});

// Listen for a player declaring win
socket.on('playerDeclaredWin', (winningPlayerId) => {
    console.log(`Player ${winningPlayerId} declared win. Game ending.`);
    disableBoardClicks();
    gameStarted = false;
    startGameBtn.disabled = false;
    resetGameBtn.disabled = false;
    if (winningPlayerId === currentPlayerId) {
        showMessageModal("Congratulations!", "BINGO! You won the game!");
        gameStatusElement.innerText = "You won! Click 'Reset Game' to start a new round.";
    } else {
        showMessageModal("Game Over!", `Player ${winningPlayerId.substring(0, 5)}... won the game!`);
        gameStatusElement.innerText = `Player ${winningPlayerId.substring(0, 5)}... won! Click 'Reset Game' to start a new round.`;
    }
    // Optionally go back to lobby after win
    // setTimeout(showLobbyScreen, 5000); // Go back after 5 seconds
});

// Listen for game reset event from server
socket.on('gameReset', () => {
    console.log('Game reset event received from server.');
    initializeBoard();
    gameStarted = false;
    isMyTurn = false;
    startGameBtn.disabled = false;
    resetGameBtn.disabled = true;
    gameStatusElement.innerText = "Game has been reset. Click 'Start Game' to begin a new round.";
    showMessageModal("Game Reset", "The game has been reset. A new round can begin!");
});

// Listen for incoming chat messages
socket.on('message', (data) => {
    const isSelf = data.senderId === currentPlayerId;
    addChatMessage(data.senderId.substring(0, 5) + '...', data.message, isSelf); // Shorten sender ID
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
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    gameStatusElement.innerText = "Connection error. Please check server status.";
    showMessageModal("Connection Error", `Could not connect to the game server: ${error.message}`);
    showLobbyScreen(); // Go back to lobby on connection error
    currentGameId = null; // Clear current game ID
});

// --- Initial Setup ---
// The page will initially show the lobby screen due to socket.on('connect')
// initializeBoard() is now called when showGameScreen() is called.
// Buttons in game screen are controlled by gameState updates.