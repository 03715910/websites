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

const allyMoves = {
  gold: [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, 0]
  ],
  silver: [
    [-1, -1], [-1, 0], [-1, 1],
    [1, -1], [1, 1]
  ]
};

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
    { id: "ally-gold", side: "ally", type: "gold", label: "金", row: 8, col: 2 },
    { id: "ally-silver", side: "ally", type: "silver", label: "銀", row: 8, col: 6 },
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
  setMessage("あなたの番", "黄色い場所へ兵を進めてください。味方の金と銀は自動で動きます。");
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
    movePiece(player, move.row, move.col);
    removePiece(target.id);
    finish("勝ち", "敵の王を取りました。");
    return;
  }

  if (target?.side === "enemy") {
    removePiece(target.id);
  }

  movePiece(player, move.row, move.col);
  phase = "ally";
  validMoves = [];
  setMessage("味方の番", "味方の金と銀が自動で動きます。");
  render();

  window.setTimeout(playAllyTurn, 340);
}

function playAllyTurn() {
  if (gameOver) {
    return;
  }

  const allies = pieces
    .filter((piece) => piece.side === "ally")
    .sort((a, b) => distanceToEnemyKing(a.row, a.col) - distanceToEnemyKing(b.row, b.col));

  for (const ally of allies) {
    const move = chooseAllyMove(ally);

    if (!move) {
      continue;
    }

    const target = pieceAt(move.row, move.col);

    if (target?.type === "king") {
      movePiece(ally, move.row, move.col);
      removePiece(target.id);
      finish("勝ち", `${ally.label}が敵の王を取りました。`);
      return;
    }

    if (target?.side === "enemy") {
      removePiece(target.id);
    }

    movePiece(ally, move.row, move.col);
  }

  phase = "enemy";
  setMessage("敵の番", "敵が兵を狙っています。");
  render();

  window.setTimeout(playEnemyTurn, 420);
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
      movePiece(enemy, capture.row, capture.col);
      removePiece(PLAYER_ID);
      finish("負け", `${enemy.label}に兵を取られました。`);
      return;
    }
  }

  for (const enemy of enemies) {
    const move = chooseEnemyMove(enemy);

    if (!move) {
      continue;
    }

    const target = pieceAt(move.row, move.col);

    if (target?.side === "ally") {
      removePiece(target.id);
    }

    movePiece(enemy, move.row, move.col);
  }

  phase = "player";
  updateValidMoves();
  setMessage("あなたの番", validMoves.length ? "黄色い場所へ兵を進めてください。" : "動ける場所がありません。");
  render();
}

function chooseAllyMove(ally) {
  const moves = legalAllyMoves(ally);

  if (!moves.length) {
    return null;
  }

  return moves.sort((a, b) => scoreAllyMove(b) - scoreAllyMove(a))[0];
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
    const captureDelta = Number(Boolean(pieceAt(b.row, b.col)?.side === "ally")) -
      Number(Boolean(pieceAt(a.row, a.col)?.side === "ally"));
    const distanceDelta = distanceToPlayer(a.row, a.col) - distanceToPlayer(b.row, b.col);
    return captureDelta || distanceDelta || Math.abs(a.col - 4) - Math.abs(b.col - 4);
  })[0];
}

function updateValidMoves() {
  const player = getPlayer();

  validMoves = playerMoves
    .map(([rowDelta, colDelta]) => ({ row: player.row + rowDelta, col: player.col + colDelta }))
    .filter((move) => inBounds(move.row, move.col))
    .filter((move) => !isPlayerArmy(pieceAt(move.row, move.col)))
    .map((move) => ({ ...move, capture: pieceAt(move.row, move.col)?.side === "enemy" }));
}

function legalAllyMoves(ally) {
  return allyMoves[ally.type]
    .map(([rowDelta, colDelta]) => ({ row: ally.row + rowDelta, col: ally.col + colDelta }))
    .filter((move) => inBounds(move.row, move.col))
    .filter((move) => !isPlayerArmy(pieceAt(move.row, move.col)))
    .map((move) => ({ ...move, target: pieceAt(move.row, move.col) }));
}

function legalEnemyMoves(enemy) {
  return enemyMoves[enemy.type]
    .map(([rowDelta, colDelta]) => ({ row: enemy.row + rowDelta, col: enemy.col + colDelta }))
    .filter((move) => inBounds(move.row, move.col))
    .filter((move) => pieceAt(move.row, move.col)?.side !== "enemy")
    .map((move) => {
      const target = pieceAt(move.row, move.col);
      return {
        ...move,
        capturePlayer: target?.id === PLAYER_ID,
        captureAlly: target?.side === "ally"
      };
    });
}

function scoreAllyMove(move) {
  const target = move.target;
  let score = 0;

  if (target?.type === "king") {
    score += 1000;
  } else if (target?.side === "enemy") {
    score += 80;
  }

  score -= distanceToEnemyKing(move.row, move.col) * 8;
  score -= distanceToPlayer(move.row, move.col);
  return score;
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

function movePiece(piece, row, col) {
  piece.row = row;
  piece.col = col;
}

function removePiece(id) {
  pieces = pieces.filter((piece) => piece.id !== id);
}

function pieceAt(row, col) {
  return pieces.find((piece) => piece.row === row && piece.col === col);
}

function getPlayer() {
  return pieces.find((piece) => piece.id === PLAYER_ID);
}

function getEnemyKing() {
  return pieces.find((piece) => piece.side === "enemy" && piece.type === "king");
}

function distanceToPlayer(row, col) {
  const player = getPlayer();
  return Math.abs(row - player.row) + Math.abs(col - player.col);
}

function distanceFromPlayer(row, col) {
  return distanceToPlayer(row, col);
}

function distanceToEnemyKing(row, col) {
  const king = getEnemyKing();
  return king ? Math.abs(row - king.row) + Math.abs(col - king.col) : 0;
}

function isPlayerArmy(piece) {
  return piece?.side === "player" || piece?.side === "ally";
}

function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function labelForCell(row, col, piece, move) {
  const position = `${row + 1}段 ${col + 1}列`;

  if (piece) {
    return `${position} ${labelForSide(piece.side)}の${piece.label}`;
  }

  if (move?.capture) {
    return `${position} 敵を取れる場所`;
  }

  if (move) {
    return `${position} 移動できる場所`;
  }

  return `${position} 空きマス`;
}

function labelForSide(side) {
  if (side === "player") {
    return "自分";
  }

  if (side === "ally") {
    return "味方";
  }

  return "敵";
}
