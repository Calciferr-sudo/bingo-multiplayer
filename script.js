const socket = io('https://bingo-backend-1-4ajn.onrender.com');

// Create 5x5 grid with random numbers 1-25
const board = document.getElementById('board');
let numbers = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
let marked = Array(25).fill(false);

numbers.forEach((num, idx) => {
  const cell = document.createElement('div');
  cell.classList.add('cell');
  cell.innerText = num;
  cell.dataset.index = idx;

  cell.addEventListener('click', () => {
    socket.emit('markNumber', num);
  });

  board.appendChild(cell);
});

// Listen for update to mark a number
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

// Game over signal
socket.on('gameOver', () => {
  alert("Bingo! You Win!");
  socket.disconnect(); // Stop game
});

// Bingo Check
function checkBingo() {
  const isMarked = (i) => marked[i];

  let bingoLines = 0;

  // Rows
  for (let i = 0; i < 25; i += 5)
    if ([0, 1, 2, 3, 4].every(j => isMarked(i + j))) bingoLines++;

  // Columns
  for (let i = 0; i < 5; i++)
    if ([0, 1, 2, 3, 4].every(j => isMarked(i + j * 5))) bingoLines++;

  // Diagonals
  if ([0, 6, 12, 18, 24].every(i => isMarked(i))) bingoLines++;
  if ([4, 8, 12, 16, 20].every(i => isMarked(i))) bingoLines++;

  return bingoLines ==5;
}
