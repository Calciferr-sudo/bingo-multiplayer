// ✅ Replace this with your exact Render backend URL!
const socket = io('https://bingo-backend-1-4ajn.onrender.com');

let board = document.getElementById('board');
let numbers = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
let marked = Array(25).fill(false);
let gameOver = false;
let playerName = prompt("Enter your name") || "Player";

// Emit player name to server
socket.emit('playerName', playerName);

// Show messages
function showMessage(msg) {
  const msgBox = document.getElementById("message");
  msgBox.innerText = msg;
}

// Create grid
numbers.forEach((num, idx) => {
  const cell = document.createElement('div');
  cell.classList.add('cell');
  cell.innerText = num;
  cell.dataset.index = idx;

  cell.addEventListener('click', () => {
    if (marked[idx] || gameOver) return;
    marked[idx] = true;
    socket.emit('markNumber', num);
  });

  board.appendChild(cell);
});

function disableBoard() {
  document.querySelectorAll('.cell').forEach(cell => {
    cell.classList.add('disabled');
  });
}

function enableBoard() {
  document.querySelectorAll('.cell').forEach(cell => {
    cell.classList.remove('disabled');
  });
}

// Receive events
socket.on('userJoined', (playerCount) => {
  if (playerCount < 2) {
    showMessage("🕹 Waiting for another player...");
    disableBoard();
  } else {
    showMessage("🎮 Game ready! Start marking!");
    enableBoard();
  }
});

socket.on('playerJoined', (name) => {
  showMessage(`${name} joined the game!`);
});

socket.on('markNumber', (num) => {
  const idx = numbers.indexOf(num);
  if (idx > -1 && !marked[idx]) {
    marked[idx] = true;
    document.querySelectorAll('.cell')[idx].classList.add('marked');
  }
  if (checkBingo()) {
    socket.emit('declareWin');
  }
});

socket.on('gameOver', () => {
  showMessage("🎉 Bingo! You Win!");
  disableBoard();
  gameOver = true;
  document.getElementById('playAgain').style.display = 'inline';
});

// Reset
document.getElementById('playAgain').addEventListener('click', () => {
  location.reload();
});

// Bingo validation
function checkBingo() {
  const isMarked = idx => marked[idx];
  let count = 0;

  // rows
  for (let i = 0; i < 25; i += 5)
    if ([0, 1, 2, 3, 4].every(j => isMarked(i + j))) count++;

  // columns
  for (let i = 0; i < 5; i++)
    if ([0, 1, 2, 3, 4].every(j => isMarked(i + j * 5))) count++;

  // diagonals
  if ([0, 6, 12, 18, 24].every(isMarked)) count++;
  if ([4, 8, 12, 16, 20].every(isMarked)) count++;

  return count >= 1;
}
