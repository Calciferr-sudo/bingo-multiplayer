const socket = io('https://bingo-backend-1-4ajn.onrender.com');

const board = document.getElementById("board");
let numbers = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
let marked = Array(25).fill(false);
let gameOver = false;
let playersReady = false;

const playerName = prompt("Enter your name") || "Player";
socket.emit("playerName", playerName);
showMessage("Connecting...");

// Create 5x5 grid
numbers.forEach((num, idx) => {
  const cell = document.createElement("div");
  cell.className = "cell";
  cell.innerText = num;
  cell.dataset.index = idx;

  cell.addEventListener("click", () => {
    if (marked[idx] || gameOver || !playersReady) return;
    marked[idx] = true;
    socket.emit("markNumber", num);
  });

  board.appendChild(cell);
});

function showMessage(msg) {
  document.getElementById("message").innerText = msg;
}

function disableBoard() {
  document.querySelectorAll(".cell").forEach(cell => {
    cell.style.pointerEvents = "none";
    cell.style.opacity = "0.6";
  });
}

function enableBoard() {
  document.querySelectorAll(".cell").forEach(cell => {
    cell.style.pointerEvents = "auto";
    cell.style.opacity = "1";
  });
}

// Incoming events
socket.on("userJoined", (count) => {
  if (count >= 2) {
    showMessage("🎮 Both players ready! You can start!");
    playersReady = true;
    enableBoard();
  } else {
    showMessage("🕹 Waiting for another player...");
    playersReady = false;
    disableBoard();
  }
});

socket.on("playerJoined", (name) => {
  showMessage(`📢 ${name} just joined`);
});

socket.on("markNumber", (num) => {
  const idx = numbers.indexOf(num);
  if (idx > -1 && !marked[idx]) {
    marked[idx] = true;
    document.querySelectorAll(".cell")[idx].classList.add("marked");
  }

  if (checkBingo()) {
    socket.emit("declareWin");
  }
});

socket.on("gameOver", () => {
  showMessage("🎉 BINGO! You win!");
  disableBoard();
  gameOver = true;
  document.getElementById("playAgain").style.display = "inline";
});

document.getElementById("playAgain").addEventListener("click", () => {
  location.reload();
});

function checkBingo() {
  const isMarked = (i) => marked[i];
  let lines = 0;

  // Rows
  for (let i = 0; i < 25; i += 5)
    if ([0, 1, 2, 3, 4].every(j => isMarked(i + j))) lines++;

  // Columns
  for (let i = 0; i < 5; i++)
    if ([0, 1, 2, 3, 4].every(j => isMarked(i + j * 5))) lines++;

  // Diagonals
  if ([0, 6, 12, 18, 24].every(i => isMarked(i))) lines++;
  if ([4, 8, 12, 16, 20].every(i => isMarked(i))) lines++;

  return lines >= 1;
}
