<script>
const socket = io('https://bingo-backend-1-4ajn.onrender.com');
let playerName = prompt("Enter your name:");
socket.emit("joinGame", playerName);

// Setup board
const board = document.getElementById('board');
let numbers = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
let marked = Array(25).fill(false);

numbers.forEach((num, idx) => {
  const cell = document.createElement('div');
  cell.classList.add('cell');
  cell.innerText = num;
  cell.dataset.index = idx;

  cell.addEventListener('click', () => {
    if (!marked[idx]) socket.emit('markNumber', num);
  });

  board.appendChild(cell);
});

// Mark Number
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

// Game Over
socket.on('gameOver', (winnerName) => {
  showMessage(`🎉 ${winnerName} WON!`);
  disableBoard();
  document.getElementById("playAgain").style.display = "inline";
});

// Reset Game
socket.on('resetGame', () => {
  location.reload(); // Simple reload to reset board (can replace with smarter reset)
});

// Countdown Timer
socket.on("countdown", (time) => {
  document.getElementById("countdown").innerText = `⏳ ${time}s`;
});

// Player List
socket.on('updatePlayers', (players) => {
  const list = document.getElementById("playerList");
  list.innerHTML = "";
  Object.values(players).forEach(name => {
    const li = document.createElement("li");
    li.textContent = name;
    list.appendChild(li);
  });
});

// Scoreboard
socket.on("updateScoreboard", (scoreboard) => {
  const board = document.getElementById("scoreboard");
  board.innerHTML = "";
  for (const [name, score] of Object.entries(scoreboard)) {
    const li = document.createElement("li");
    li.textContent = `${name}: ${score}`;
    board.appendChild(li);
  }
});

// Play Again Button
document.getElementById("playAgain").addEventListener("click", () => {
  socket.emit("playAgain");
});

// Bingo check
function checkBingo() {
  const isMarked = (i) => marked[i];
  let bingoLines = 0;
  for (let i = 0; i < 25; i += 5)
    if ([0, 1, 2, 3, 4].every(j => isMarked(i + j))) bingoLines++;
  for (let i = 0; i < 5; i++)
    if ([0, 1, 2, 3, 4].every(j => isMarked(i + j * 5))) bingoLines++;
  if ([0, 6, 12, 18, 24].every(i => isMarked(i))) bingoLines++;
  if ([4, 8, 12, 16, 20].every(i => isMarked(i))) bingoLines++;
  return bingoLines >= 5;
}

function disableBoard() {
  document.querySelectorAll('.cell').forEach(cell => {
    cell.style.pointerEvents = "none";
  });
}

function showMessage(text) {
  document.getElementById("message").innerText = text;
}
</script>
