"use strict";

const SIZE = 9;
const PLAYER_ID = "player";
const boardElement = document.getElementById("board");
const messageElement = document.getElementById("message");
const turnLabelElement = document.getElementById("turnLabel");
const restartButton = document.getElementById("restartButton");

const playerMoves = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
];

const enemyMoves = {
  king: [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ],
  gold: [
    [-1, 0],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ],
  pawn: [
    [1, 0]
  ]
};

let pieces = [];
let phase = "player";
let gameOver = false;
let validMoves = [];

restartButton.addEventListener("click", startGame);
startGame();

function startGame() {
  pieces = [
    { id: PLAYER_ID, side: "player", type: "soldier", label: "兵", row: 8, col: 4 },
    { id: "king", side: "enemy", type: "king", label: "王", row: 0, col: 4 },
    { id: "gold-left", side: "enemy", type: "gold", label: "金", row: 1, col: 3 },
    { id: "gold-right", side: "enemy", type: "gold", label: "金", row: 1, col: 5 },
    { id: "pawn-left", side: "enemy", type: "pawn", label: "歩", row: 2, col: 2 },
    { id: "pawn-center", side: "enemy", type: "pawn", label: "歩", row: 2, col: 4 },
    { id: "pawn-right", side: "enemy", type: "pawn", label: "歩", row: 2, col: 6 }
  ];
  phase = "player";
  gameOver = false;
  updateValidMoves();
  setMessage("あなたの番", "黄色い場所へ兵を進めてください。");
  render();
}

function render() {
  boardElement.replaceChildren();

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = document.createElement("button");
      const move = validMoves.find((candidate) => candidate.row === row && candidate.col === col);
      const piece = pieceAt(row, col);

      cell.className = [
        "cell",
        row < 3 ? "enemy-zone" : "",
        row > 5 ? "player-zone" : "",
        move ? "valid" : "",
        move?.capture ? "capture" : ""
      ].filter(Boolean).join(" ");
      cell.type = "button";
      cell.setAttribute("aria-label", labelForCell(row, col, piece, move));
      cell.disabled = !move || gameOver || phase !== "player";

      if (move && !gameOver) {
        cell.addEventListener("click", () => playPlayerMove(move));
      }

      if (piece) {
        cell.append(createPiece(piece));
      }

      boardElement.append(cell);
    }
  }
}

function createPiece(piece) {
  const node = document.createElement("span");
  node.className = ["piece", piece.side, piece.type === "king" ? "king" : ""].filter(Boolean).join(" ");
  node.textContent = piece.label;
  return node;
}

function playPlayerMove(move) {
  if (gameOver || phase !== "player") {
    return;
  }

  const player = getPlayer();
  const target = pieceAt(move.row, move.col);

  if (target?.type === "king") {
    player.row = move.row;
    player.col = move.col;
    pieces = pieces.filter((piece) => piece.id !== target.id);
    finish("勝ち", "敵の王を取りました。");
    return;
  }

  if (target?.side === "enemy") {
    pieces = pieces.filter((piece) => piece.id !== target.id);
  }

  player.row = move.row;
  player.col = move.col;
  phase = "enemy";
  validMoves = [];
  setMessage("敵の番", "敵が兵を狙っています。");
  render();

  window.setTimeout(playEnemyTurn, 360);
}

function playEnemyTurn() {
  if (gameOver) {
    return;
  }

  const enemies = pieces
    .filter((piece) => piece.side === "enemy")
    .sort((a, b) => distanceToPlayer(a.row, a.col) - distanceToPlayer(b.row, b.col));

  for (const enemy of enemies) {
    const capture = legalEnemyMoves(enemy).find((move) => move.capturePlayer);

    if (capture) {
      enemy.row = capture.row;
      enemy.col = capture.col;
      pieces = pieces.filter((piece) => piece.id !== PLAYER_ID);
      finish("負け", `${enemy.label}に兵を取られました。`);
      return;
    }
  }

  for (const enemy of enemies) {
    const move = chooseEnemyMove(enemy);

    if (move) {
      enemy.row = move.row;
      enemy.col = move.col;
    }
  }

  phase = "player";
  updateValidMoves();
  setMessage("あなたの番", validMoves.length ? "黄色い場所へ兵を進めてください。" : "動ける場所がありません。");
  render();
}

function chooseEnemyMove(enemy) {
  const moves = legalEnemyMoves(enemy).filter((move) => !move.capturePlayer);

  if (!moves.length) {
    return null;
  }

  if (enemy.type === "king") {
    const player = getPlayer();
    const nearPlayer = Math.abs(enemy.row - player.row) <= 2 && Math.abs(enemy.col - player.col) <= 2;

    if (!nearPlayer) {
      return null;
    }

    return moves.sort((a, b) => distanceFromPlayer(b.row, b.col) - distanceFromPlayer(a.row, a.col))[0];
  }

  return moves.sort((a, b) => {
    const distanceDelta = distanceToPlayer(a.row, a.col) - distanceToPlayer(b.row, b.col);
    return distanceDelta || Math.abs(a.col - 4) - Math.abs(b.col - 4);
  })[0];
}

function updateValidMoves() {
  const player = getPlayer();

  validMoves = playerMoves
    .map(([rowDelta, colDelta]) => ({ row: player.row + rowDelta, col: player.col + colDelta }))
    .filter((move) => inBounds(move.row, move.col))
    .filter((move) => pieceAt(move.row, move.col)?.side !== "player")
    .map((move) => ({ ...move, capture: pieceAt(move.row, move.col)?.side === "enemy" }));
}

function legalEnemyMoves(enemy) {
  return enemyMoves[enemy.type]
    .map(([rowDelta, colDelta]) => ({ row: enemy.row + rowDelta, col: enemy.col + colDelta }))
    .filter((move) => inBounds(move.row, move.col))
    .filter((move) => {
      const target = pieceAt(move.row, move.col);
      return !target || target.side === "player";
    })
    .map((move) => ({ ...move, capturePlayer: pieceAt(move.row, move.col)?.side === "player" }));
}

function finish(result, message) {
  gameOver = true;
  validMoves = [];
  setMessage(result, message);
  render();
}

function setMessage(turn, message) {
  turnLabelElement.textContent = turn;
  messageElement.textContent = message;
}

function pieceAt(row, col) {
  return pieces.find((piece) => piece.row === row && piece.col === col);
}

function getPlayer() {
  return pieces.find((piece) => piece.id === PLAYER_ID);
}

function distanceToPlayer(row, col) {
  const player = getPlayer();
  return Math.abs(row - player.row) + Math.abs(col - player.col);
}

function distanceFromPlayer(row, col) {
  return distanceToPlayer(row, col);
}

function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function labelForCell(row, col, piece, move) {
  const position = `${row + 1}段 ${col + 1}列`;

  if (piece) {
    return `${position} ${piece.side === "player" ? "自分" : "敵"}の${piece.label}`;
  }

  if (move?.capture) {
    return `${position} 敵を取れる場所`;
  }

  if (move) {
    return `${position} 移動できる場所`;
  }

  return `${position} 空きマス`;
}
