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
    // Generate numbers 1-25 and shuffle them
    numbers = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    // Reset all cells to unmarked
    marked.fill(false);
    // Clear existing cells from the board
    boardElement.innerHTML = '';

    // Create and append new cells to the board
    numbers.forEach((num, idx) => {
        const cell = document.createElement('div');
        cell.classList.add('cell'); // Add base cell styling
        cell.innerText = num; // Set the number in the cell
        cell.dataset.index = idx; // Store the index for reference

        // Add click listener only if the game has started and it's not marked
        cell.addEventListener('click', () => {
            // Only allow marking if the game has started and it's this player's turn
            if (gameStarted && isMyTurn && !marked[idx]) {
                socket.emit('markNumber', num); // Emit the number to be marked to the server
            } else if (!gameStarted) {
                showMessageModal("Game Not Started", "Please wait for the game to start!");
            } else if (!isMyTurn) {
                showMessageModal("Not Your Turn", "It's not your turn to call a number.");
            }
        });
        boardElement.appendChild(cell); // Add the cell to the board
    });

    // Initially disable all cells until game starts and it's a player's turn
    disableBoardClicks();
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
 * Returns true if at least one Bingo line is found.
 * Note: The original code returned true only if bingoLines == 5.
 * For typical Bingo, one line is enough to win.
 * I've kept the original logic for 5 lines, but you can change it to `bingoLines >= 1` for standard Bingo.
 * @returns {boolean} - True if Bingo is achieved, false otherwise.
 */
function checkBingo() {
    const isCellMarked = (i) => marked[i]; // Helper to check if a cell is marked

    let bingoLines = 0; // Counter for completed bingo lines

    // Check Rows
    for (let i = 0; i < 25; i += 5) {
        if ([0, 1, 2, 3, 4].every(j => isCellMarked(i + j))) {
            bingoLines++;
        }
    }

    // Check Columns
    for (let i = 0; i < 5; i++) {
        if ([0, 1, 2, 3, 4].every(j => isCellMarked(i + j * 5))) {
            bingoLines++;
        }
    }

    // Check Diagonals
    // Main diagonal (top-left to bottom-right)
    if ([0, 6, 12, 18, 24].every(i => isCellMarked(i))) {
        bingoLines++;
    }
    // Anti-diagonal (top-right to bottom-left)
    if ([4, 8, 12, 16, 20].every(i => isCellMarked(i))) {
        bingoLines++;
    }

    // Return true if 5 lines are achieved (as per original code's logic)
    // For standard Bingo, change this to `return bingoLines >= 1;`
    return bingoLines === 5;
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
    currentPlayerId = socket.id; // Socket.IO assigns a unique ID on connect
    playerIdSpan.innerText = currentPlayerId; // Display the player's ID
    playerInfoElement.style.display = 'block'; // Ensure player info is visible
    gameStatusElement.innerText = "Connected. Waiting for players to join.";
    // If game is not started, enable start button
    if (!gameStarted) {
        startGameBtn.disabled = false;
    }
});

// Listen for game state updates from the server
socket.on('gameState', (state) => {
    gameStarted = state.gameStarted;
    isMyTurn = state.currentTurnPlayerId === currentPlayerId; // Check if it's this player's turn

    if (gameStarted) {
        startGameBtn.disabled = true; // Disable start button once game starts
        resetGameBtn.disabled = false; // Enable reset button once game starts
        if (isMyTurn) {
            gameStatusElement.innerText = "Your Turn! Click a number to call it.";
            enableBoardClicks(); // Enable board interaction
        } else {
            gameStatusElement.innerText = `Waiting for ${state.currentTurnPlayerId} to call a number.`;
            disableBoardClicks(); // Disable board interaction
        }
    } else {
        // Game is not started or has ended/reset
        gameStatusElement.innerText = "Game not started. Click 'Start Game' when ready.";
        startGameBtn.disabled = false; // Enable start button
        resetGameBtn.disabled = true; // Disable reset button
        disableBoardClicks(); // Disable board interaction
    }

    // Update board based on globally marked numbers (if provided by server)
    // This assumes the server sends an array of marked numbers
    if (state.markedNumbers) {
        // First, reset all cells visually
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('marked');
        });
        // Then, mark the ones provided by the server
        state.markedNumbers.forEach(num => {
            const idx = numbers.indexOf(num);
            if (idx > -1) {
                marked[idx] = true; // Update local marked array
                document.querySelectorAll('.cell')[idx].classList.add('marked'); // Add visual mark
            }
        });
    }
});

// Listen for a number being marked (called) by any player
socket.on('numberMarked', (num) => {
    const idx = numbers.indexOf(num);
    if (idx > -1 && !marked[idx]) {
        marked[idx] = true; // Mark the number in local state
        document.querySelectorAll('.cell')[idx].classList.add('marked'); // Add visual mark
        gameStatusElement.innerText = `Number ${num} was called!`; // Update status

          // --- ADD THE FOLLOWING LOGIC HERE ---
        // After marking the number, check if this player now has bingo
        // Ensure the game is still considered active before declaring win to avoid re-declaring
        if (gameStarted && checkBingo()) {
            console.log(`Player ${currentPlayerId} achieved BINGO! Emitting 'declareWin'.`);
            socket.emit('declareWin'); // Notify the server that this player has won
        }
        // --- END OF NEW LOGIC ---
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
    initializeBoard(); // Re-initialize the board
    gameStarted = false; // Reset game state
    isMyTurn = false; // Reset turn state
    startGameBtn.disabled = false; // Enable start button
    resetGameBtn.disabled = true; // Disable reset button until game starts again
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
