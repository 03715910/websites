"use strict";

const SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = -1;
const PLAYER = BLACK;
const CPU = WHITE;
const DIFFICULTIES = ["初心者", "普通", "強い", "最強"];
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
];
const POSITION_WEIGHTS = [
  [120, -25, 20, 5, 5, 20, -25, 120],
  [-25, -45, -5, -5, -5, -5, -45, -25],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-25, -45, -5, -5, -5, -5, -45, -25],
  [120, -25, 20, 5, 5, 20, -25, 120]
];

const choiceScreen = document.getElementById("choice-screen");
const preGameScreen = document.getElementById("pre-game");
const gameScreen = document.getElementById("game-screen");
const winScreen = document.getElementById("win-screen");
const preGameMessage = document.getElementById("pre-game-message");
const boardElement = document.getElementById("board");
const playerScoreElement = document.getElementById("player-score");
const cpuScoreElement = document.getElementById("cpu-score");
const turnLabelElement = document.getElementById("turn-label");
const statusMessageElement = document.getElementById("status-message");
const winVideo = document.getElementById("win-video");

let boardState = createInitialBoard();
let currentColor = PLAYER;
let cpuDifficulty = "普通";
let gameActive = false;
let processing = false;
let transitionTimer = 0;
let cpuTimer = 0;
let resetTimer = 0;

document.querySelectorAll(".choice-button").forEach((button) => {
  button.addEventListener("click", () => handleChoice(button.dataset.choice));
});

boardElement.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell || !gameActive || processing || currentColor !== PLAYER) {
    return;
  }

  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  const move = getValidMoves(boardState, PLAYER)
    .find((candidate) => candidate.row === row && candidate.col === col);

  if (!move) {
    return;
  }

  processing = true;
  applyMove(boardState, row, col, PLAYER);
  currentColor = CPU;
  render();
  setStatus("CPUの番");
  continueTurn();
});

winVideo.addEventListener("ended", () => scheduleReturnToChoice(2000));
winVideo.addEventListener("error", () => scheduleReturnToChoice(2000));

showChoiceScreen();

function handleChoice(choice) {
  clearTimers();
  preGameMessage.textContent = choice === "white" ? "あなたは黒ですよ" : "よくわかってますね";
  showOnly(preGameScreen);
  transitionTimer = window.setTimeout(startGame, 1300);
}

function startGame() {
  clearTimers();
  boardState = createInitialBoard();
  cpuDifficulty = randomItem(DIFFICULTIES);
  currentColor = Math.random() < 0.5 ? PLAYER : CPU;
  gameActive = true;
  processing = false;
  showOnly(gameScreen);
  render();
  continueTurn();
}

function continueTurn() {
  if (!gameActive) {
    return;
  }

  const playerMoves = getValidMoves(boardState, PLAYER);
  const cpuMoves = getValidMoves(boardState, CPU);

  if (countPieces(boardState).empty === 0 || (playerMoves.length === 0 && cpuMoves.length === 0)) {
    endGame();
    return;
  }

  const legalMoves = currentColor === PLAYER ? playerMoves : cpuMoves;

  if (legalMoves.length === 0) {
    const skippedColor = currentColor;
    currentColor = opposite(currentColor);
    processing = true;
    render();
    setStatus(skippedColor === PLAYER ? "置ける場所がありません" : "CPUはパスしました");
    transitionTimer = window.setTimeout(() => {
      processing = false;
      continueTurn();
    }, 900);
    return;
  }

  render();

  if (currentColor === PLAYER) {
    processing = false;
    setStatus("あなたの番");
    render();
    return;
  }

  processing = true;
  setStatus("CPUの番");
  cpuTimer = window.setTimeout(playCpuTurn, 550);
}

function playCpuTurn() {
  if (!gameActive || currentColor !== CPU) {
    return;
  }

  const moves = getValidMoves(boardState, CPU);

  if (moves.length === 0) {
    currentColor = PLAYER;
    processing = false;
    continueTurn();
    return;
  }

  const move = chooseCpuMove(moves);
  applyMove(boardState, move.row, move.col, CPU);
  currentColor = PLAYER;
  processing = false;
  render();
  transitionTimer = window.setTimeout(continueTurn, 180);
}

function endGame() {
  gameActive = false;
  processing = false;
  render();

  const counts = countPieces(boardState);
  if (counts.black > counts.white) {
    showWinVideo();
    return;
  }

  setStatus(counts.black === counts.white ? "引き分け" : "負けました");
  scheduleReturnToChoice(1400);
}

function showWinVideo() {
  showOnly(winScreen);
  winVideo.pause();
  winVideo.currentTime = 0;
  winVideo.load();

  const playAttempt = winVideo.play();
  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {
      winVideo.muted = true;
      winVideo.play().catch(() => scheduleReturnToChoice(2000));
    });
  }
}

function scheduleReturnToChoice(delay) {
  window.clearTimeout(resetTimer);
  resetTimer = window.setTimeout(showChoiceScreen, delay);
}

function showChoiceScreen() {
  clearTimers();
  gameActive = false;
  processing = false;
  winVideo.pause();
  try {
    winVideo.currentTime = 0;
  } catch (error) {
    // Some browsers reject currentTime changes before metadata is available.
  }
  winVideo.muted = false;
  showOnly(choiceScreen);
}

function showOnly(visibleElement) {
  [choiceScreen, preGameScreen, gameScreen, winScreen].forEach((element) => {
    element.classList.toggle("hidden", element !== visibleElement);
  });
}

function clearTimers() {
  window.clearTimeout(transitionTimer);
  window.clearTimeout(cpuTimer);
  window.clearTimeout(resetTimer);
}

function render() {
  renderScores();
  renderBoard();
  turnLabelElement.textContent = currentColor === PLAYER ? "あなたの番" : "CPUの番";
}

function renderScores() {
  const counts = countPieces(boardState);
  playerScoreElement.textContent = String(counts.black);
  cpuScoreElement.textContent = String(counts.white);
}

function renderBoard() {
  const playableMoves = gameActive && currentColor === PLAYER && !processing
    ? getValidMoves(boardState, PLAYER)
    : [];
  const playableKeys = new Set(playableMoves.map((move) => cellKey(move.row, move.col)));
  const fragment = document.createDocumentFragment();

  boardElement.innerHTML = "";

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const value = boardState[row][col];
      const key = cellKey(row, col);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.disabled = !playableKeys.has(key);
      cell.setAttribute("aria-label", cellLabel(row, col, value, playableKeys.has(key)));

      if (playableKeys.has(key)) {
        cell.classList.add("valid");
      }

      if (value !== EMPTY) {
        const disc = document.createElement("span");
        disc.className = `disc ${value === BLACK ? "black" : "white"}`;
        cell.appendChild(disc);
      }

      fragment.appendChild(cell);
    }
  }

  boardElement.appendChild(fragment);
}

function setStatus(message) {
  statusMessageElement.textContent = message;
}

function createInitialBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
}

function getValidMoves(board, color) {
  const moves = [];

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const flips = getFlips(board, row, col, color);
      if (flips.length > 0) {
        moves.push({ row, col, flips });
      }
    }
  }

  return moves;
}

function getFlips(board, row, col, color) {
  if (!isInside(row, col) || board[row][col] !== EMPTY) {
    return [];
  }

  const opponent = opposite(color);
  const flips = [];

  for (const [rowStep, colStep] of DIRECTIONS) {
    const line = [];
    let nextRow = row + rowStep;
    let nextCol = col + colStep;

    while (isInside(nextRow, nextCol) && board[nextRow][nextCol] === opponent) {
      line.push([nextRow, nextCol]);
      nextRow += rowStep;
      nextCol += colStep;
    }

    if (line.length > 0 && isInside(nextRow, nextCol) && board[nextRow][nextCol] === color) {
      flips.push(...line);
    }
  }

  return flips;
}

function applyMove(board, row, col, color) {
  const flips = getFlips(board, row, col, color);
  board[row][col] = color;

  for (const [flipRow, flipCol] of flips) {
    board[flipRow][flipCol] = color;
  }
}

function chooseCpuMove(moves) {
  if (cpuDifficulty === "初心者") {
    return randomItem(moves);
  }

  if (cpuDifficulty === "普通") {
    return chooseBySimpleScore(moves);
  }

  const emptyCount = countPieces(boardState).empty;
  const depth = cpuDifficulty === "最強"
    ? emptyCount <= 8 ? 8 : emptyCount <= 16 ? 5 : 4
    : emptyCount <= 10 ? 4 : 2;

  return chooseBySearch(moves, depth);
}

function chooseBySimpleScore(moves) {
  const scored = moves.map((move) => ({
    move,
    score: move.flips.length * 12 + POSITION_WEIGHTS[move.row][move.col] + Math.random() * 8
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0].move;
}

function chooseBySearch(moves, depth) {
  let bestScore = -Infinity;
  let bestMoves = [];
  const orderedMoves = orderMoves(moves, CPU);

  for (const move of orderedMoves) {
    const nextBoard = cloneBoard(boardState);
    applyMove(nextBoard, move.row, move.col, CPU);
    const score = minimax(nextBoard, PLAYER, depth - 1, -Infinity, Infinity);

    if (score > bestScore + 0.0001) {
      bestScore = score;
      bestMoves = [move];
    } else if (Math.abs(score - bestScore) <= 0.0001) {
      bestMoves.push(move);
    }
  }

  return randomItem(bestMoves);
}

function minimax(board, color, depth, alpha, beta) {
  const moves = getValidMoves(board, color);
  const otherMoves = getValidMoves(board, opposite(color));

  if (depth === 0 || countPieces(board).empty === 0 || (moves.length === 0 && otherMoves.length === 0)) {
    return evaluateBoard(board);
  }

  if (moves.length === 0) {
    return minimax(board, opposite(color), depth - 1, alpha, beta);
  }

  if (color === CPU) {
    let best = -Infinity;
    for (const move of orderMoves(moves, color)) {
      const nextBoard = cloneBoard(board);
      applyMove(nextBoard, move.row, move.col, color);
      best = Math.max(best, minimax(nextBoard, opposite(color), depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) {
        break;
      }
    }
    return best;
  }

  let best = Infinity;
  for (const move of orderMoves(moves, color)) {
    const nextBoard = cloneBoard(board);
    applyMove(nextBoard, move.row, move.col, color);
    best = Math.min(best, minimax(nextBoard, opposite(color), depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (beta <= alpha) {
      break;
    }
  }
  return best;
}

function evaluateBoard(board) {
  const counts = countPieces(board);
  const playerMoves = getValidMoves(board, PLAYER).length;
  const cpuMoves = getValidMoves(board, CPU).length;

  if (counts.empty === 0 || (playerMoves === 0 && cpuMoves === 0)) {
    return (counts.white - counts.black) * 100000;
  }

  let score = 0;

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (board[row][col] === CPU) {
        score += POSITION_WEIGHTS[row][col];
      } else if (board[row][col] === PLAYER) {
        score -= POSITION_WEIGHTS[row][col];
      }
    }
  }

  score += (cpuMoves - playerMoves) * 7;
  score += cornerScore(board) * 45;
  score += (counts.white - counts.black) * (counts.empty < 18 ? 9 : 1);
  return score;
}

function orderMoves(moves, color) {
  return moves.slice().sort((a, b) => {
    const scoreA = movePriority(a, color);
    const scoreB = movePriority(b, color);
    return color === CPU ? scoreB - scoreA : scoreA - scoreB;
  });
}

function movePriority(move, color) {
  const sign = color === CPU ? 1 : -1;
  return sign * (POSITION_WEIGHTS[move.row][move.col] + move.flips.length * 10);
}

function cornerScore(board) {
  const corners = [
    board[0][0],
    board[0][SIZE - 1],
    board[SIZE - 1][0],
    board[SIZE - 1][SIZE - 1]
  ];

  return corners.reduce((score, value) => {
    if (value === CPU) {
      return score + 1;
    }
    if (value === PLAYER) {
      return score - 1;
    }
    return score;
  }, 0);
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function countPieces(board) {
  const counts = { black: 0, white: 0, empty: 0 };

  for (const row of board) {
    for (const value of row) {
      if (value === BLACK) {
        counts.black += 1;
      } else if (value === WHITE) {
        counts.white += 1;
      } else {
        counts.empty += 1;
      }
    }
  }

  return counts;
}

function cellKey(row, col) {
  return `${row}:${col}`;
}

function cellLabel(row, col, value, playable) {
  const place = `${row + 1}行${col + 1}列`;
  if (value === BLACK) {
    return `${place} 黒`;
  }
  if (value === WHITE) {
    return `${place} 白`;
  }
  return playable ? `${place} 置けます` : `${place} 空き`;
}

function opposite(color) {
  return color === BLACK ? WHITE : BLACK;
}

function isInside(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}
