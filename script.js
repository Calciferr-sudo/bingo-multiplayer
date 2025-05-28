// Connect to backend socket
const socket = io('https://bingo-backend-1-4ajn.onrender.com');

// Prompt for player name
let playerName = prompt("Enter your name:");
if (!playerName) playerName = "Guest_" + Math.floor(Math.random() * 1000);

// Notify server of new player
socket.emit("joinGame", playerName);

// Select DOM elements
const board = document.getElementById('board');
const messageEl = document.getElementById('message');
const countdownEl = document.getElementById('countdown');
const playerListEl = document.getElementById('playerList');
const scoreboardEl = document.getElementById('scoreboard');
const playAgainBtn = document.getElementById('playAgain');

let numbers = [];
let marked = [];
let gameOver = false;

// Initialize board with random numbers 1-25
function initBoard() {
  numbers = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
  marked = Array(25).fill(false);
  board.innerHTML = "";
  numbers.forEach((num, idx) => {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    cell.innerText = num;
    cell.dataset.index = idx;
    cell.style.pointerEvents = "auto";

    cell.addEventListener('click', () => {
      if (!marked[idx] && !gameOver) {
        socket.emit('markNumber', num);
      }
    });

    board.appendChild(cell);
  });
}

initBoard();

// Listen for markNumber event from server
socket.on('markNumber', (num) => {
  const idx = numbers.indexOf(num);
  if (idx > -1 && !marked[idx]) {
    marked[idx] = true;
    const cell = document.querySelectorAll('.cell')[idx];
    cell.classList.add('marked');
    cell.style.pointerEvents = "none";
  }
  if (checkBingo() && !gameOver) {
    socket.emit('declareWin');
  }
});

// Listen for gameOver event
socket.on('gameOver', (winnerName) => {
  gameOver = true;
  showMessage(`🎉 ${winnerName} WON!`);
  disableBoard();
  playAgainBtn.style.display = "inline-block";
});

// Listen for resetGame event (play again)
socket.on('resetGame', () => {
  gameOver = false;
  showMessage("New Game Started! Good Luck!");
  playAgainBtn.style.display = "none";
  initBoard();
});

// Countdown timer update
socket.on("countdown", (time) => {
  countdownEl.innerText = `⏳ ${time}s`;
});

// Update player list
socket.on('updatePlayers', (players) => {
  playerListEl.innerHTML = "";
  Object.values(players).forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    playerListEl.appendChild(li);
  });
});

// Update scoreboard
socket.on("updateScoreboard", (scoreboard) => {
  scoreboardEl.innerHTML = "";
  for (const [name, score] of Object.entries(scoreboard)) {
    const li = document.createElement('li');
    li.textContent = `${name}: ${score}`;
    scoreboardEl.appendChild(li);
  }
});

// Play Again button click handler
playAgainBtn.addEventListener("click", () => {
  socket.emit("playAgain");
});

// Bingo check function
function checkBingo() {
  const isMarked = (i) => marked[i];
  let bingoLines = 0;

  // Check rows
  for (let i = 0; i < 25; i += 5) {
    if ([0, 1, 2, 3, 4].every(j => isMarked(i + j))) bingoLines++;
  }

  // Check columns
  for (let i = 0; i < 5; i++) {
    if ([0, 1, 2, 3, 4].every(j => isMarked(i + j * 5))) bingoLines++;
  }

  // Check diagonals
  if ([0, 6, 12, 18, 24].every(i => isMarked(i))) bingoLines++;
  if ([4, 8, 12, 16, 20].every(i => isMarked(i))) bingoLines++;

  return bingoLines >= 1;
}

// Disable all cells (after game over)
function disableBoard() {
  document.querySelectorAll('.cell').forEach(cell => {
    cell.style.pointerEvents = "none";
  });
}

// Show messages on top
function showMessage(text) {
  messageEl.innerText = text;
}
