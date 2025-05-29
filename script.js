// Establish Socket.IO connection to the backend server
const socket = io('https://bingo-backend-1-4ajn.onrender.com');

// --- DOM Elements ---
const boardElement = document.getElementById('board');
const playerInfoElement = document.getElementById('player-info');
const playerIdSpan = document.getElementById('player-id');
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

// Removed 'struckLines' variable as it's for the strike-out feature
let numbers = []; // Array to hold the numbers on the player's board (1-25, shuffled)
let marked = Array(25).fill(false); // Boolean array to track marked cells
let gameStarted = false; // Flag to indicate if the game has started
let isMyTurn = false; // Flag to indicate if it's the current player's turn
let currentPlayerId = null; // Stores the unique ID assigned to this player by the server

// --- Helper Functions ---

/**
 * Displays a custom message box modal.
 * Replaces the native alert() function for better UI.
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

    // No need to clear struckLines here as the feature is removed

    numbers.forEach((num, idx) => {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.innerText = num;
        cell.dataset.index = idx;

        // Existing cell click listener (unchanged)
        cell.addEventListener('click', () => {
            if (gameStarted && isMyTurn && !marked[idx]) {
                const calledNumber = parseInt(cell.innerText);
                socket.emit('markNumber', calledNumber); // Emit the number to the server
                // No need to mark locally immediately; wait for server confirmation via 'numberMarked'
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
    disableBoardClicks();
    // No need to call checkBingo() here as no numbers are marked yet.
}

/**
 * Enables click events on all cells on the board.
 */
function enableBoardClicks() {
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('disabled-cell'); // Remove visual disabled state
        cell.style.cursor = 'pointer'; // Restore pointer cursor
    });
}

/**
 * Disables click events on all cells on the board.
 * Adds a visual disabled state.
 */
function disableBoardClicks() {
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.add('disabled-cell'); // Add visual disabled state
        cell.style.cursor = 'not-allowed'; // Change cursor
    });
}

/**
 * Checks for Bingo lines (rows, columns, diagonals).
 * Returns the count of completed Bingo lines.
 * This version does NOT apply visual strike-throughs (CSS classes).
 * @returns {number} - The total count of completed lines.
 */
function checkBingo() {
    const isCellMarked = (i) => marked[i];

    // Define all possible lines (rows, columns, diagonals) by their cell indices
    const allPossibleLines = [
        // Rows
        [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
        // Columns
        [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
        // Diagonals
        [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]
    ];

    let bingoLineCount = 0; // This will count the total completed lines for win condition

    allPossibleLines.forEach(lineIndices => {
        // Check if all cells in this line are marked
        if (lineIndices.every(isCellMarked)) {
            bingoLineCount++;
        }
    });

    return bingoLineCount; // Return the total count of completed lines
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
    // Display 'You' if it's the current player's message
    const sender = isSelf ? 'You' : senderId;
    messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatMessagesElement.appendChild(messageElement);
    // Scroll to the bottom to show the latest message
    chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
}

// --- Event Listeners for UI Elements ---

// Handle OK button click on the message modal
modalOkBtn.addEventListener('click', hideMessageModal);

// Handle Start Game button click
startGameBtn.addEventListener('click', () => {
    // Only allow starting if game is not already started
    if (!gameStarted) {
        socket.emit('startGame'); // Request server to start the game
        startGameBtn.disabled = true; // Disable button after requesting start
        gameStatusElement.innerText = "Requesting game start...";
    }
});

// Handle Reset Game button click
resetGameBtn.addEventListener('click', () => {
    // Only allow reset if game has started
    if (gameStarted) {
        socket.emit('resetGame'); // Request server to reset the game
        resetGameBtn.disabled = true; // Disable button after requesting reset
        gameStatusElement.innerText = "Requesting game reset...";
    }
});

// Handle sending chat messages
sendChatBtn.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
        socket.emit('sendMessage', message); // Emit message to server
        chatInput.value = ''; // Clear input field
    }
});

// Allow sending chat messages by pressing Enter key
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatBtn.click(); // Simulate button click
    }
});

// --- Socket.IO Event Listeners ---

// When connected to the server, receive and display player ID
socket.on('connect', () => {
    currentPlayerId = socket.id;
    playerIdSpan.innerText = currentPlayerId;
    playerInfoElement.style.display = 'block';
    gameStatusElement.innerText = "Connected. Waiting for server to update game state...";
});

// Listen for game state updates from the server
socket.on('gameState', (state) => {
    gameStarted = state.gameStarted;
    isMyTurn = state.currentTurnPlayerId === currentPlayerId;

    if (!gameStarted) { // If the game is currently NOT started
        if (state.players.length >= 2) { // And if there are 2 or more players connected
            startGameBtn.disabled = false; // Enable the 'Start Game' button
            gameStatusElement.innerText = "Two players ready! Click 'Start Game' to begin.";
        } else { // If there are less than 2 players
            startGameBtn.disabled = true; // Keep the 'Start Game' button disabled
            gameStatusElement.innerText = "Connected. Waiting for another player to join...";
        }
        resetGameBtn.disabled = true; // 'Reset Game' button should be disabled when game not started
        disableBoardClicks(); // Board clicks should be disabled when game not started
    }
    else { // If game IS started
        startGameBtn.disabled = true;
        resetGameBtn.disabled = false;
        if (isMyTurn) {
            gameStatusElement.innerText = "Your Turn! Click a number to call it.";
            enableBoardClicks();
        } else {
            gameStatusElement.innerText = `Waiting for ${state.currentTurnPlayerId} to call a number.`;
            disableBoardClicks();
        }
    }

    // Update board based on globally marked numbers (if provided by server)
    if (state.markedNumbers) {
        // First, reset all cells visually (marked, but NOT strike classes)
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('marked');
            // Removed: cell.classList.remove('bingo-line-strike');
        });
        // Removed: struckLines = []; // Clear local tracking of struck lines for full state sync

        // Then, mark the ones provided by the server
        state.markedNumbers.forEach(num => {
            const idx = numbers.indexOf(num);
            if (idx > -1) {
                marked[idx] = true; // Update local marked array
                document.querySelectorAll('.cell')[idx].classList.add('marked'); // Add visual mark
            }
        });
        // Removed: checkBingo(); // Removed call to apply visual strikes
    }
});

// Listen for a number being marked (called) by any player
socket.on('numberMarked', (num) => {
    const idx = numbers.indexOf(num);
    if (idx > -1 && !marked[idx]) {
        marked[idx] = true; // Mark the number in local state
        document.querySelectorAll('.cell')[idx].classList.add('marked'); // Add visual mark
        gameStatusElement.innerText = `Number ${num} was called!`; // Update status

        // Call checkBingo() to get the current line count (without applying visual strikes)
        const currentBingoLineCount = checkBingo();

        // Now, use the returned count for your win condition
        if (gameStarted && currentBingoLineCount === 5) { // Assuming 5 lines for a win
            console.log(`Player ${currentPlayerId} achieved BINGO! Emitting 'declareWin'.`);
            socket.emit('declareWin');
        }
    }
});

// Listen for a player declaring win
socket.on('playerDeclaredWin', (winningPlayerId) => {
    disableBoardClicks(); // Disable board interaction for everyone
    gameStarted = false; // End the game
    startGameBtn.disabled = false; // Re-enable start button
    resetGameBtn.disabled = false; // Enable reset button
    if (winningPlayerId === currentPlayerId) {
        showMessageModal("Congratulations!", "BINGO! You won the game!");
        gameStatusElement.innerText = "You won! Click 'Reset Game' to start a new round.";
    } else {
        showMessageModal("Game Over!", `Player ${winningPlayerId} won the game!`);
        gameStatusElement.innerText = `Player ${winningPlayerId} won! Click 'Reset Game' to start a new round.`;
    }
});

// Listen for game reset event from server
socket.on('gameReset', () => {
    initializeBoard(); // This calls initializeBoard which clears the board
    // Removed: struckLines = []; // No need to clear struckLines
    gameStarted = false;
    isMyTurn = false;
    startGameBtn.disabled = false;
    resetGameBtn.disabled = true;
    gameStatusElement.innerText = "Game has been reset. Click 'Start Game' to begin a new round.";
    showMessageModal("Game Reset", "The game has been reset. A new round can begin!");
});

// Listen for incoming chat messages
socket.on('message', (data) => {
    // Determine if the message is from the current player
    const isSelf = data.senderId === currentPlayerId;
    addChatMessage(data.senderId, data.message, isSelf);
});

// Listen for server errors or disconnections
socket.on('disconnect', () => {
    gameStatusElement.innerText = "Disconnected from server. Please refresh.";
    startGameBtn.disabled = true;
    resetGameBtn.disabled = true;
    disableBoardClicks();
    showMessageModal("Disconnected", "You have been disconnected from the server. Please refresh the page to reconnect.");
});

socket.on('connect_error', (error) => {
    gameStatusElement.innerText = "Connection error. Please check server status.";
    showMessageModal("Connection Error", `Could not connect to the game server: ${error.message}`);
});

// --- Initial Setup ---
initializeBoard(); // Render the initial board when the page loads
startGameBtn.disabled = true; // Disable start button until connected
resetGameBtn.disabled = true; // Disable reset button initially