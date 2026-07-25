"use strict";

const SIZE = 9;
const PLAYER_ID = "player-silver";
const ALLY_KING_ID = "ally-king";
const ENEMY_KING_ID = "enemy-king";
const boardElement = document.getElementById("board");
const messageElement = document.getElementById("message");
const turnLabelElement = document.getElementById("turnLabel");
const restartButton = document.getElementById("restartButton");
const commandButtons = [...document.querySelectorAll("[data-command]")];
const directionButtons = [...document.querySelectorAll("[data-dir]")];

const DIRECTIONS = {
  upLeft: { row: -1, col: -1, label: "左上" },
  up: { row: -1, col: 0, label: "上" },
  upRight: { row: -1, col: 1, label: "右上" },
  right: { row: 0, col: 1, label: "右" },
  downRight: { row: 1, col: 1, label: "右下" },
  down: { row: 1, col: 0, label: "下" },
  downLeft: { row: 1, col: -1, label: "左下" },
  left: { row: 0, col: -1, label: "左" },
  stay: { row: 0, col: 0, label: "待機" }
};

const ORTHOGONAL_MOVES = [
  { row: -1, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 0, col: -1 }
];

const DIAGONAL_MOVES = [
  { row: -1, col: -1 },
  { row: -1, col: 1 },
  { row: 1, col: 1 },
  { row: 1, col: -1 }
];

const KING_MOVES = [...ORTHOGONAL_MOVES, ...DIAGONAL_MOVES];

const COMMANDS = {
  attack: "攻撃",
  evade: "退避",
  hold: "待機"
};

const PIECE_DATA = {
  king: { label: "王", rank: 7 },
  rook: { label: "飛", rank: 6 },
  bishop: { label: "角", rank: 6 },
  gold: { label: "金", rank: 5 },
  silver: { label: "銀", rank: 4 },
  knight: { label: "桂", rank: 2 },
  lance: { label: "香", rank: 2 },
  pawn: { label: "歩", rank: 1 }
};

const SUBORDINATE_TYPES = new Set(["pawn", "lance", "knight"]);

let pieces = [];
let phase = "player";
let selectedCommand = "attack";
let gameOver = false;
let playerHints = [];

for (const button of commandButtons) {
  button.addEventListener("click", () => {
    if (phase !== "player" || gameOver) {
      return;
    }

    selectedCommand = button.dataset.command;
    updateCommandButtons();
    setMessage("あなたの番", `${COMMANDS[selectedCommand]}を下位の駒に命令しました。銀の移動方向を選んでください。`);
  });
}

for (const button of directionButtons) {
  button.addEventListener("click", () => runPlayerTurn(button.dataset.dir));
}

restartButton.addEventListener("click", startGame);
startGame();

function startGame() {
  pieces = createInitialPieces();
  phase = "player";
  selectedCommand = "attack";
  gameOver = false;
  updatePlayerHints();
  setMessage("あなたの番", "下位の駒への命令を選び、自分の銀を動かしてください。");
  updateCommandButtons();
  updateDirectionButtons();
  render();
}

function createInitialPieces() {
  const initialPieces = [];
  const backRank = ["lance", "knight", "silver", "gold", "king", "gold", "silver", "knight", "lance"];

  for (const [col, type] of backRank.entries()) {
    addInitialPiece(initialPieces, "enemy", type, 0, col);
    addInitialPiece(initialPieces, "ally", type, 8, col);
  }

  addInitialPiece(initialPieces, "enemy", "bishop", 1, 1);
  addInitialPiece(initialPieces, "enemy", "rook", 1, 7);
  addInitialPiece(initialPieces, "ally", "rook", 7, 1);
  addInitialPiece(initialPieces, "ally", "bishop", 7, 7);

  for (let col = 0; col < SIZE; col += 1) {
    addInitialPiece(initialPieces, "enemy", "pawn", 2, col);
    addInitialPiece(initialPieces, "ally", "pawn", 6, col);
  }

  return initialPieces;
}

function addInitialPiece(initialPieces, side, type, row, col) {
  const data = PIECE_DATA[type];
  const id = idForInitialPiece(side, type, row, col);

  initialPieces.push({
    id,
    side,
    control: controlForInitialPiece(side, type, id),
    type,
    label: data.label,
    rank: data.rank,
    row,
    col
  });
}

function idForInitialPiece(side, type, row, col) {
  if (side === "ally" && type === "king") {
    return ALLY_KING_ID;
  }

  if (side === "enemy" && type === "king") {
    return ENEMY_KING_ID;
  }

  if (side === "ally" && type === "silver" && row === 8 && col === 2) {
    return PLAYER_ID;
  }

  return `${side}-${type}-${row}-${col}`;
}

function controlForInitialPiece(side, type, id) {
  if (side === "enemy") {
    return "enemy";
  }

  if (id === PLAYER_ID) {
    return "player";
  }

  if (SUBORDINATE_TYPES.has(type)) {
    return "subordinate";
  }

  return "superior";
}

function render() {
  boardElement.replaceChildren();

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = document.createElement("button");
      const piece = pieceAt(row, col);
      const hint = playerHints.find((move) => move.row === row && move.col === col);

      cell.className = [
        "cell",
        row < 3 ? "enemy-zone" : "",
        row > 5 ? "player-zone" : "",
        hint ? "valid" : ""
      ].filter(Boolean).join(" ");
      cell.type = "button";
      cell.disabled = !hint || phase !== "player" || gameOver;
      cell.setAttribute("aria-label", labelForCell(row, col, piece, hint));

      if (hint && phase === "player" && !gameOver) {
        cell.addEventListener("click", () => runPlayerTurn(hint.dir));
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
  node.className = ["piece", visualClassFor(piece), piece.type === "king" ? "king" : ""].filter(Boolean).join(" ");
  node.textContent = piece.label;
  node.dataset.badge = badgeFor(piece);
  return node;
}

function runPlayerTurn(directionKey) {
  if (phase !== "player" || gameOver) {
    return;
  }

  phase = "ally";
  playerHints = [];
  updateDirectionButtons();
  setMessage("味方の行動", `${COMMANDS[selectedCommand]}命令を受けて、味方全体が動きます。`);

  const allyPlans = buildAllyPlans(directionKey);
  resolvePlans("ally", allyPlans);

  if (checkFinished()) {
    return;
  }

  render();
  window.setTimeout(runEnemyTurn, 420);
}

function runEnemyTurn() {
  if (gameOver) {
    return;
  }

  phase = "enemy";
  setMessage("敵の行動", "敵軍が自動で動きます。");
  render();

  window.setTimeout(() => {
    resolvePlans("enemy", buildEnemyPlans());

    if (checkFinished()) {
      return;
    }

    phase = "player";
    updatePlayerHints();
    updateDirectionButtons();
    setMessage("あなたの番", "下位の駒への命令を選び、自分の銀を動かしてください。");
    render();
  }, 360);
}

function buildAllyPlans(directionKey) {
  return pieces
    .filter((piece) => piece.side === "ally")
    .map((piece) => {
      if (piece.control === "player") {
        return planPlayerMove(piece, directionKey);
      }

      if (piece.control === "subordinate") {
        return planSubordinateMove(piece);
      }

      if (piece.id === ALLY_KING_ID) {
        return planOwnKingMove(piece);
      }

      return planSuperiorMove(piece);
    });
}

function buildEnemyPlans() {
  return pieces
    .filter((piece) => piece.side === "enemy")
    .map((piece) => {
      if (piece.type === "king") {
        return planEnemyKingMove(piece);
      }

      return bestPlan(piece, legalMovesFor(piece), scoreEnemyMove);
    });
}

function planPlayerMove(piece, directionKey) {
  const direction = DIRECTIONS[directionKey] || DIRECTIONS.stay;
  const target = { row: piece.row + direction.row, col: piece.col + direction.col };
  const isLegalMove = legalMovesFor(piece).some((move) => move.row === target.row && move.col === target.col);

  if (directionKey === "stay" || !isLegalMove) {
    return stayPlan(piece);
  }

  return createPlan(piece, target.row, target.col, 50);
}

function planSubordinateMove(piece) {
  if (selectedCommand === "hold") {
    return stayPlan(piece);
  }

  const scorer = selectedCommand === "evade" ? scoreEvadeMove : scoreAttackMove;
  return bestPlan(piece, legalMovesFor(piece), scorer);
}

function planSuperiorMove(piece) {
  return bestPlan(piece, legalMovesFor(piece), scoreSuperiorMove);
}

function planOwnKingMove(piece) {
  const threatened = distanceToNearestEnemy(piece.row, piece.col) <= 2;

  if (!threatened) {
    return stayPlan(piece);
  }

  return bestPlan(piece, legalMovesFor(piece), scoreOwnKingSafety);
}

function planEnemyKingMove(piece) {
  const moves = legalMovesFor(piece);
  const threatened = distanceToNearestAlly(piece.row, piece.col) <= 2;

  if (!threatened) {
    return stayPlan(piece);
  }

  return bestPlan(piece, moves, scoreKingSafety);
}

function bestPlan(piece, moves, scorer) {
  if (!moves.length) {
    return stayPlan(piece);
  }

  const scored = moves
    .map((move) => ({ ...move, score: scorer(move, piece) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  return createPlan(piece, best.row, best.col, best.score);
}

function legalMovesFor(piece) {
  const forward = forwardFor(piece);

  if (piece.type === "rook") {
    return slidingMoves(piece, ORTHOGONAL_MOVES);
  }

  if (piece.type === "bishop") {
    return slidingMoves(piece, DIAGONAL_MOVES);
  }

  if (piece.type === "lance") {
    return slidingMoves(piece, [{ row: forward, col: 0 }]);
  }

  if (piece.type === "knight") {
    return stepMoves(piece, [
      { row: forward * 2, col: -1 },
      { row: forward * 2, col: 1 }
    ]);
  }

  if (piece.type === "silver") {
    return stepMoves(piece, [
      { row: forward, col: -1 },
      { row: forward, col: 0 },
      { row: forward, col: 1 },
      { row: -forward, col: -1 },
      { row: -forward, col: 1 }
    ]);
  }

  if (piece.type === "gold") {
    return stepMoves(piece, [
      { row: forward, col: -1 },
      { row: forward, col: 0 },
      { row: forward, col: 1 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
      { row: -forward, col: 0 }
    ]);
  }

  if (piece.type === "pawn") {
    return stepMoves(piece, [{ row: forward, col: 0 }]);
  }

  if (piece.type === "king") {
    return stepMoves(piece, KING_MOVES);
  }

  return stepMoves(piece, ORTHOGONAL_MOVES);
}

function stepMoves(piece, directions) {
  return directions
    .map((direction) => ({ row: piece.row + direction.row, col: piece.col + direction.col }))
    .filter((move) => canMoveTo(piece, move.row, move.col));
}

function slidingMoves(piece, directions) {
  const moves = [];

  for (const direction of directions) {
    for (let step = 1; step < SIZE; step += 1) {
      const row = piece.row + direction.row * step;
      const col = piece.col + direction.col * step;

      if (!inBounds(row, col)) {
        break;
      }

      const target = pieceAt(row, col);

      if (target?.side === piece.side) {
        break;
      }

      moves.push({ row, col });

      if (target && target.side !== piece.side) {
        break;
      }
    }
  }

  return moves;
}

function forwardFor(piece) {
  return piece.side === "ally" ? -1 : 1;
}

function canMoveTo(piece, row, col) {
  if (!inBounds(row, col)) {
    return false;
  }

  return pieceAt(row, col)?.side !== piece.side;
}

function createPlan(piece, row, col, score) {
  return {
    id: piece.id,
    piece,
    fromRow: piece.row,
    fromCol: piece.col,
    row,
    col,
    score
  };
}

function stayPlan(piece) {
  return createPlan(piece, piece.row, piece.col, -999);
}

function resolvePlans(side, plans) {
  const validPlans = plans.map((plan) => blockFriendlyTargets(plan));
  const chosenPlans = chooseNonConflictingPlans(validPlans);

  for (const plan of chosenPlans) {
    if (plan.row === plan.fromRow && plan.col === plan.fromCol) {
      continue;
    }

    const target = pieceAt(plan.row, plan.col);

    if (target && target.side !== side) {
      removePiece(target.id);
    }

    const current = pieces.find((piece) => piece.id === plan.id);

    if (current) {
      current.row = plan.row;
      current.col = plan.col;
    }
  }
}

function blockFriendlyTargets(plan) {
  const target = pieceAt(plan.row, plan.col);

  if (target?.side === plan.piece.side) {
    return stayPlan(plan.piece);
  }

  return plan;
}

function chooseNonConflictingPlans(plans) {
  const groups = new Map();

  for (const plan of plans) {
    const key = `${plan.row},${plan.col}`;
    const group = groups.get(key) || [];
    group.push(plan);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    if (group.length === 1) {
      return group[0];
    }

    return group.sort((a, b) => b.piece.rank - a.piece.rank || b.score - a.score)[0];
  });
}

function scoreAttackMove(move, piece) {
  const target = pieceAt(move.row, move.col);
  let score = captureScore(target);

  score -= distanceToEnemyKing(move.row, move.col) * 8;
  score -= distanceToNearestEnemy(move.row, move.col) * 2;
  score += piece.rank;
  return score;
}

function scoreSuperiorMove(move, piece) {
  const target = pieceAt(move.row, move.col);
  let score = captureScore(target) * 1.2;

  score -= distanceToEnemyKing(move.row, move.col) * 10;
  score += piece.rank * 2;
  return score;
}

function scoreEvadeMove(move) {
  const target = pieceAt(move.row, move.col);
  let score = target?.side === "enemy" ? 20 : 0;

  score += distanceToNearestEnemy(move.row, move.col) * 14;
  score += move.row;
  return score;
}

function scoreEnemyMove(move) {
  const target = pieceAt(move.row, move.col);
  let score = 0;

  if (target?.id === PLAYER_ID || target?.id === ALLY_KING_ID) {
    score += 1000;
  } else if (target?.side === "ally") {
    score += 80 + target.rank * 10;
  }

  score -= distanceToPlayer(move.row, move.col) * 10;
  return score;
}

function scoreOwnKingSafety(move) {
  const target = pieceAt(move.row, move.col);
  let score = target?.side === "enemy" ? 40 : 0;

  score += distanceToNearestEnemy(move.row, move.col) * 18;
  score += move.row;
  return score;
}

function scoreKingSafety(move) {
  const target = pieceAt(move.row, move.col);
  let score = target?.side === "ally" ? 70 : 0;

  score += distanceToNearestAlly(move.row, move.col) * 16;
  return score;
}

function captureScore(target) {
  if (!target || target.side !== "enemy") {
    return 0;
  }

  if (target.id === ENEMY_KING_ID) {
    return 1000;
  }

  return 80 + target.rank * 10;
}

function checkFinished() {
  if (!pieces.some((piece) => piece.id === ENEMY_KING_ID)) {
    finish("勝ち", "敵の王を取りました。");
    return true;
  }

  if (!pieces.some((piece) => piece.id === PLAYER_ID)) {
    finish("負け", "自分の銀を取られました。");
    return true;
  }

  if (!pieces.some((piece) => piece.id === ALLY_KING_ID)) {
    finish("負け", "自分の王を取られました。");
    return true;
  }

  return false;
}

function finish(result, message) {
  gameOver = true;
  phase = "ended";
  playerHints = [];
  setMessage(result, message);
  updateDirectionButtons();
  render();
}

function updatePlayerHints() {
  const player = getPlayer();
  const legalCells = new Set(legalMovesFor(player).map((move) => `${move.row},${move.col}`));

  playerHints = Object.entries(DIRECTIONS)
    .map(([dir, delta]) => ({
      dir,
      row: player.row + delta.row,
      col: player.col + delta.col
    }))
    .filter((move) => move.dir === "stay" || legalCells.has(`${move.row},${move.col}`));
}

function updateCommandButtons() {
  const disabled = gameOver || phase !== "player";

  for (const button of commandButtons) {
    const active = button.dataset.command === selectedCommand;
    button.setAttribute("aria-pressed", String(active));
    button.disabled = disabled;
  }
}

function updateDirectionButtons() {
  const disabled = gameOver || phase !== "player";
  const allowedDirections = new Set(playerHints.map((move) => move.dir));

  for (const button of directionButtons) {
    button.disabled = disabled || !allowedDirections.has(button.dataset.dir);
  }
}

function setMessage(turn, message) {
  turnLabelElement.textContent = turn;
  messageElement.textContent = message;
}

function pieceAt(row, col) {
  return pieces.find((piece) => piece.row === row && piece.col === col);
}

function removePiece(id) {
  pieces = pieces.filter((piece) => piece.id !== id);
}

function getPlayer() {
  return pieces.find((piece) => piece.id === PLAYER_ID);
}

function getEnemyKing() {
  return pieces.find((piece) => piece.id === ENEMY_KING_ID);
}

function distanceToPlayer(row, col) {
  const player = getPlayer();
  return player ? manhattan(row, col, player.row, player.col) : 0;
}

function distanceToEnemyKing(row, col) {
  const king = getEnemyKing();
  return king ? manhattan(row, col, king.row, king.col) : 0;
}

function distanceToNearestEnemy(row, col) {
  return nearestDistance(row, col, pieces.filter((piece) => piece.side === "enemy"));
}

function distanceToNearestAlly(row, col) {
  return nearestDistance(row, col, pieces.filter((piece) => piece.side === "ally"));
}

function nearestDistance(row, col, candidates) {
  if (!candidates.length) {
    return 0;
  }

  return Math.min(...candidates.map((piece) => manhattan(row, col, piece.row, piece.col)));
}

function manhattan(rowA, colA, rowB, colB) {
  return Math.abs(rowA - rowB) + Math.abs(colA - colB);
}

function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function labelForCell(row, col, piece, hint) {
  const position = `${row + 1}段 ${col + 1}列`;

  if (piece) {
    return `${position} ${labelForControl(piece)}の${piece.label}`;
  }

  if (hint) {
    return `${position} 銀の移動候補`;
  }

  return `${position} 空きマス`;
}

function visualClassFor(piece) {
  if (piece.side === "enemy") {
    return "enemy";
  }

  return piece.control;
}

function badgeFor(piece) {
  if (piece.control === "player") {
    return "YOU";
  }

  if (piece.control === "subordinate") {
    return "CMD";
  }

  if (piece.control === "superior") {
    return "AUTO";
  }

  return "ENEMY";
}

function labelForControl(piece) {
  if (piece.side === "enemy") {
    return "敵";
  }

  if (piece.control === "player") {
    return "自分";
  }

  if (piece.control === "subordinate") {
    return "命令下の味方";
  }

  return "自動で動く味方";
}
