"use strict";

const SIZE = 9;
const PLAYER_ID = "player-silver";
const ALLY_KING_ID = "ally-king";
const ENEMY_KING_ID = "enemy-king";
const MOVE_ANIMATION_MS = 560;
const TURN_PAUSE_MS = 180;
const DRAW_ROUND_LIMIT = 80;
const RESULT_RESTART_MS = 3400;
const boardElement = document.getElementById("board");
const messageElement = document.getElementById("message");
const turnLabelElement = document.getElementById("turnLabel");
const restartButton = document.getElementById("restartButton");
const victoryOverlay = document.getElementById("victoryOverlay");
const victoryVideo = document.getElementById("victoryVideo");
const playVictoryButton = document.getElementById("playVictoryButton");
const resultOverlay = document.getElementById("resultOverlay");
const resultCard = document.getElementById("resultCard");
const resultEyebrow = document.getElementById("resultEyebrow");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const resultSymbol = document.getElementById("resultSymbol");
const rulesButton = document.getElementById("rulesButton");
const rulesOverlay = document.getElementById("rulesOverlay");
const rulesCloseButton = document.getElementById("rulesCloseButton");
const promotionOverlay = document.getElementById("promotionOverlay");
const promotionGroupList = document.getElementById("promotionGroupList");
const promotionConfirmButton = document.getElementById("promotionConfirmButton");
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

const PROMOTED_DATA = {
  rook: { label: "龍", rank: 8 },
  bishop: { label: "馬", rank: 8 },
  silver: { label: "全", rank: 5 },
  knight: { label: "圭", rank: 5 },
  lance: { label: "杏", rank: 5 },
  pawn: { label: "と", rank: 5 }
};

const SUBORDINATE_TYPES = new Set(["pawn", "lance", "knight"]);
const PROMOTION_TYPE_ORDER = ["pawn", "lance", "knight", "silver", "bishop", "rook"];
const PROMOTABLE_TYPES = new Set(Object.keys(PROMOTED_DATA));

let pieces = [];
let phase = "player";
let selectedCommand = "attack";
let gameOver = false;
let playerHints = [];
let actionToken = 0;
let completedRounds = 0;
let resultTimer = 0;
let pendingPromotionBatch = null;

for (const button of commandButtons) {
  button.addEventListener("click", () => {
    if (phase !== "player" || gameOver) {
      return;
    }

    selectedCommand = button.dataset.command;
    updateCommandButtons();
    setMessage("あなたの番", `${COMMANDS[selectedCommand]}を下位の駒に命令しました。光っているマスを選んでください。`);
  });
}

for (const button of directionButtons) {
  button.addEventListener("click", () => runPlayerTurn(button.dataset.dir));
}

victoryVideo.addEventListener("ended", () => {
  hideVictoryVideo();
  startGame();
});

victoryVideo.addEventListener("error", () => {
  hideVictoryVideo();
  startGame();
});

playVictoryButton.addEventListener("click", playVictoryVideo);
restartButton.addEventListener("click", startGame);
rulesButton.addEventListener("click", showRules);
rulesCloseButton.addEventListener("click", hideRules);
promotionGroupList.addEventListener("click", handlePromotionGroupClick);
promotionConfirmButton.addEventListener("click", confirmPromotionBatch);
rulesOverlay.addEventListener("click", (event) => {
  if (event.target === rulesOverlay) {
    hideRules();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !promotionOverlay.hidden) {
    cancelPromotionBatch();
    return;
  }

  if (event.key === "Escape" && !rulesOverlay.hidden) {
    hideRules();
  }
});
startGame();

function startGame() {
  actionToken += 1;
  hideVictoryVideo();
  hideResultOverlay();
  cancelPromotionBatch();
  hideRules();
  pieces = createInitialPieces();
  phase = "player";
  selectedCommand = "attack";
  gameOver = false;
  completedRounds = 0;
  updatePlayerHints();
  setMessage("あなたの番", "下位の駒への命令を選び、光っているマスへ自分の駒を動かしてください。");
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
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
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
  node.className = [
    "piece",
    visualClassFor(piece),
    piece.type === "king" ? "king" : "",
    piece.promoted ? "promoted" : ""
  ].filter(Boolean).join(" ");
  node.textContent = piece.label;
  node.dataset.pieceId = piece.id;
  node.dataset.side = piece.side;
  node.dataset.badge = badgeFor(piece);
  node.dataset.promoted = piece.promoted ? "成" : "";
  return node;
}

async function runPlayerTurn(directionKey) {
  if (phase !== "player" || gameOver) {
    return;
  }

  const token = actionToken + 1;
  actionToken = token;
  phase = "ally";
  playerHints = [];
  updateCommandButtons();
  updateDirectionButtons();
  setMessage("味方の行動", `${COMMANDS[selectedCommand]}命令を受けて、味方全体が動きます。`);
  render();

  const allyPlans = buildAllyPlans(directionKey);
  const appliedPlans = await resolvePlansWithAnimation("ally", allyPlans, () => token === actionToken);

  if (!appliedPlans || token !== actionToken) {
    return;
  }

  if (checkFinished()) {
    return;
  }

  render();
  window.setTimeout(() => runEnemyTurn(token), TURN_PAUSE_MS);
}

async function runEnemyTurn(token = actionToken) {
  if (gameOver || token !== actionToken) {
    return;
  }

  phase = "enemy";
  updateCommandButtons();
  updateDirectionButtons();
  setMessage("敵の行動", "敵軍が自動で動きます。");
  render();

  await wait(TURN_PAUSE_MS);

  if (gameOver || token !== actionToken) {
    return;
  }

  const appliedPlans = await resolvePlansWithAnimation("enemy", buildEnemyPlans(), () => token === actionToken);

  if (!appliedPlans || token !== actionToken) {
    return;
  }

  if (checkFinished()) {
    return;
  }

  completedRounds += 1;

  if (checkDraw()) {
    return;
  }

  phase = "player";
  updatePlayerHints();
  updateCommandButtons();
  updateDirectionButtons();
  setMessage("あなたの番", "下位の駒への命令を選び、光っているマスへ自分の駒を動かしてください。");
  render();
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
  return bestPlan(piece, commandMovesFor(piece, selectedCommand), scorer);
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

function commandMovesFor(piece, command) {
  const legalMoves = legalMovesFor(piece);

  if (command === "evade") {
    return uniqueMoves([{ row: piece.row, col: piece.col }, ...legalMoves]);
  }

  return legalMoves;
}

function legalMovesFor(piece) {
  const forward = forwardFor(piece);

  if (piece.promoted) {
    return promotedMovesFor(piece, forward);
  }

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
    return goldMoves(piece, forward);
  }

  if (piece.type === "pawn") {
    return stepMoves(piece, [{ row: forward, col: 0 }]);
  }

  if (piece.type === "king") {
    return stepMoves(piece, KING_MOVES);
  }

  return stepMoves(piece, ORTHOGONAL_MOVES);
}

function promotedMovesFor(piece, forward) {
  if (piece.type === "rook") {
    return uniqueMoves([
      ...slidingMoves(piece, ORTHOGONAL_MOVES),
      ...stepMoves(piece, DIAGONAL_MOVES)
    ]);
  }

  if (piece.type === "bishop") {
    return uniqueMoves([
      ...slidingMoves(piece, DIAGONAL_MOVES),
      ...stepMoves(piece, ORTHOGONAL_MOVES)
    ]);
  }

  return goldMoves(piece, forward);
}

function goldMoves(piece, forward = forwardFor(piece)) {
  return stepMoves(piece, [
    { row: forward, col: -1 },
    { row: forward, col: 0 },
    { row: forward, col: 1 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
    { row: -forward, col: 0 }
  ]);
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

function uniqueMoves(moves) {
  const seen = new Set();

  return moves.filter((move) => {
    const key = `${move.row},${move.col}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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
  const chosenPlans = prepareResolvedPlans(plans);
  applyResolvedPlans(side, chosenPlans);
  return chosenPlans;
}

async function resolvePlansWithAnimation(side, plans, shouldApply = () => true) {
  const chosenPlans = prepareResolvedPlans(plans);
  await animatePlans(side, chosenPlans);

  if (!shouldApply()) {
    return null;
  }

  await applyResolvedPlansWithChoices(side, chosenPlans, shouldApply);

  if (!shouldApply()) {
    return null;
  }

  return chosenPlans;
}

function prepareResolvedPlans(plans) {
  const validPlans = plans.map((plan) => blockFriendlyTargets(plan));
  return chooseNonConflictingPlans(validPlans);
}

function applyResolvedPlans(side, chosenPlans) {
  const movedPlans = applyMovesWithoutPromotion(side, chosenPlans);

  for (const { piece, plan, capturedKing } of movedPlans) {
    if (!capturedKing) {
      promoteAfterMove(piece, plan);
    }
  }
}

async function applyResolvedPlansWithChoices(side, chosenPlans, shouldApply = () => true) {
  const movedPlans = applyMovesWithoutPromotion(side, chosenPlans);
  const promotionChoices = [];

  if (!shouldApply()) {
    return;
  }

  for (const { piece, plan, capturedKing } of movedPlans) {
    if (capturedKing) {
      continue;
    }

    const decision = promotionDecisionFor(piece, plan);

    if (decision === "forced" || decision === "auto") {
      promotePiece(piece);
    } else if (decision === "choice") {
      promotionChoices.push({ piece, plan });
    }

    if (!shouldApply()) {
      return;
    }
  }

  if (!promotionChoices.length) {
    return;
  }

  render();
  const choicesByType = await askPromotionBatchChoice(promotionChoices);

  if (!shouldApply()) {
    return;
  }

  for (const { piece } of promotionChoices) {
    if (choicesByType[piece.type]) {
      promotePiece(piece);
    }
  }
}

function applyMovesWithoutPromotion(side, chosenPlans) {
  const movedPlans = [];

  for (const plan of chosenPlans) {
    if (plan.row === plan.fromRow && plan.col === plan.fromCol) {
      continue;
    }

    const target = pieceAt(plan.row, plan.col);
    const capturedKing = target?.type === "king";

    if (target && target.side !== side) {
      removePiece(target.id);
    }

    const current = pieces.find((piece) => piece.id === plan.id);

    if (current) {
      current.row = plan.row;
      current.col = plan.col;
      movedPlans.push({ piece: current, plan, capturedKing });
    }
  }

  return movedPlans;
}

function promoteAfterMove(piece, plan) {
  if (promotionDecisionFor(piece, plan) === "none") {
    return;
  }

  promotePiece(piece);
}

function promotionDecisionFor(piece, plan) {
  if (!canPromoteAfterMove(piece, plan)) {
    return "none";
  }

  if (mustPromote(piece, plan.row)) {
    return "forced";
  }

  if (canChoosePromotion(piece)) {
    return "choice";
  }

  return "auto";
}

function canChoosePromotion(piece) {
  return piece.side === "ally" && PROMOTABLE_TYPES.has(piece.type);
}

function promotePiece(piece) {
  const promotedData = PROMOTED_DATA[piece.type];
  piece.promoted = true;
  piece.label = promotedData.label;
  piece.rank = promotedData.rank;
}

function canPromoteAfterMove(piece, plan) {
  return Boolean(
    PROMOTABLE_TYPES.has(piece.type) &&
      !piece.promoted &&
      (inPromotionZone(piece.side, plan.fromRow) || inPromotionZone(piece.side, plan.row))
  );
}

function mustPromote(piece, row) {
  if (piece.type === "pawn" || piece.type === "lance") {
    return piece.side === "ally" ? row === 0 : row === SIZE - 1;
  }

  if (piece.type === "knight") {
    return piece.side === "ally" ? row <= 1 : row >= SIZE - 2;
  }

  return false;
}

function inPromotionZone(side, row) {
  return side === "ally" ? row <= 2 : row >= 6;
}

async function animatePlans(side, chosenPlans) {
  const animations = chosenPlans
    .filter((plan) => plan.row !== plan.fromRow || plan.col !== plan.fromCol)
    .map((plan) => animationDataForPlan(side, plan))
    .filter(Boolean);

  if (!animations.length) {
    return;
  }

  await nextFrame();

  for (const animation of animations) {
    const { movingPiece, targetPiece, sourceCell, targetCell, dx, dy } = animation;
    movingPiece.classList.add("is-moving");
    sourceCell.classList.add("move-from");
    targetCell.classList.add("move-to");
    movingPiece.style.setProperty("--move-x", `${dx}px`);
    movingPiece.style.setProperty("--move-y", `${dy}px`);

    if (targetPiece) {
      movingPiece.classList.add("is-capturing");
      targetPiece.classList.add("is-captured");
      targetCell.classList.add("capture-cell");
      targetCell.classList.add(targetPiece.dataset.side === "enemy" ? "ally-capture" : "enemy-capture");
    }
  }

  await wait(MOVE_ANIMATION_MS);
}

function animationDataForPlan(side, plan) {
  const sourceCell = cellAt(plan.fromRow, plan.fromCol);
  const targetCell = cellAt(plan.row, plan.col);
  const movingPiece = sourceCell?.querySelector?.(".piece");
  const target = pieceAt(plan.row, plan.col);
  const isCapture = target && target.side !== side;
  const targetPiece = isCapture ? targetCell?.querySelector?.(".piece") : null;

  if (!canAnimate(sourceCell) || !canAnimate(targetCell) || !canAnimate(movingPiece)) {
    return null;
  }

  const fromRect = sourceCell.getBoundingClientRect();
  const toRect = targetCell.getBoundingClientRect();

  return {
    movingPiece,
    targetPiece,
    sourceCell,
    targetCell,
    dx: toRect.left - fromRect.left,
    dy: toRect.top - fromRect.top
  };
}

function canAnimate(element) {
  return Boolean(
    element &&
      element.classList &&
      element.style &&
      typeof element.getBoundingClientRect === "function"
  );
}

function cellAt(row, col) {
  return boardElement.children[row * SIZE + col];
}

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function nextFrame() {
  return new Promise((resolve) => {
    const requestFrame = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 16));
    requestFrame(() => resolve());
  });
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
  const startDistance = distanceToEnemyKing(piece.row, piece.col);
  const endDistance = distanceToEnemyKing(move.row, move.col);
  let score = captureScore(target) * 3;

  score += (startDistance - endDistance) * 35;
  score += forwardProgress(piece, move) * 18;
  score += promotionPressure(piece, move);

  if (isSquareAttackedBy("enemy", move.row, move.col)) {
    score -= 24;
  }

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

function scoreEvadeMove(move, piece) {
  const target = pieceAt(move.row, move.col);
  const isStaying = move.row === piece.row && move.col === piece.col;
  let score = distanceToNearestEnemy(move.row, move.col) * 40;

  score += ownCampSafety(piece, move) * 9;
  score -= forwardProgress(piece, move) * 24;

  if (isStaying) {
    score += 18;
  }

  if (isSquareAttackedBy("enemy", move.row, move.col)) {
    score -= 170;
  }

  if (target?.id === ENEMY_KING_ID) {
    score += 2000;
  } else if (target?.side === "enemy") {
    score -= 90 + target.rank * 12;
  }

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

function forwardProgress(piece, move) {
  return (move.row - piece.row) * forwardFor(piece);
}

function ownCampSafety(piece, move) {
  return piece.side === "ally" ? move.row : SIZE - 1 - move.row;
}

function promotionPressure(piece, move) {
  if (!PROMOTABLE_TYPES.has(piece.type) || piece.promoted) {
    return 0;
  }

  if (inPromotionZone(piece.side, move.row)) {
    return 28;
  }

  return 0;
}

function isSquareAttackedBy(side, row, col) {
  return pieces
    .filter((piece) => piece.side === side)
    .some((piece) => legalMovesFor(piece).some((move) => move.row === row && move.col === col));
}

function checkFinished() {
  if (!pieces.some((piece) => piece.id === ENEMY_KING_ID)) {
    finish("勝ち", "敵の王を取りました。", { playVictoryVideo: true });
    return true;
  }

  if (!pieces.some((piece) => piece.id === PLAYER_ID)) {
    finish("負け", "自分の銀を取られました。", { resultType: "loss" });
    return true;
  }

  if (!pieces.some((piece) => piece.id === ALLY_KING_ID)) {
    finish("負け", "自分の王を取られました。", { resultType: "loss" });
    return true;
  }

  return false;
}

function checkDraw() {
  if (completedRounds < DRAW_ROUND_LIMIT) {
    return false;
  }

  finish("引き分け", "80ターンで決着がつきませんでした。", { resultType: "draw" });
  return true;
}

function finish(result, message, options = {}) {
  gameOver = true;
  phase = "ended";
  playerHints = [];
  setMessage(result, message);
  updateCommandButtons();
  updateDirectionButtons();
  render();

  if (options.playVictoryVideo) {
    showVictoryVideo();
  }

  if (options.resultType) {
    showResultOverlay(options.resultType, result, message);
  }
}

function showVictoryVideo() {
  victoryOverlay.hidden = false;
  victoryVideo.currentTime = 0;
  playVictoryButton.hidden = true;
  playVictoryVideo();
}

function hideVictoryVideo() {
  victoryVideo.pause();
  victoryVideo.currentTime = 0;
  victoryOverlay.hidden = true;
  playVictoryButton.hidden = true;
}

function playVictoryVideo() {
  const playResult = victoryVideo.play();

  if (playResult?.catch) {
    playResult.catch(() => {
      playVictoryButton.hidden = false;
    });
  }
}

function showResultOverlay(type, title, message) {
  window.clearTimeout(resultTimer);
  resultOverlay.hidden = false;
  resultOverlay.dataset.result = type;
  resultCard.className = `result-card ${type}`;
  resultEyebrow.textContent = type === "draw" ? "Draw" : "Defeat";
  resultTitle.textContent = title;
  resultText.textContent = message;
  resultSymbol.textContent = type === "draw" ? "引" : "負";

  resultTimer = window.setTimeout(() => {
    startGame();
  }, RESULT_RESTART_MS);
}

function hideResultOverlay() {
  window.clearTimeout(resultTimer);
  resultTimer = 0;
  resultOverlay.hidden = true;
}

function askPromotionBatchChoice(promotionChoices) {
  const groups = promotionGroupsFor(promotionChoices);
  const choices = Object.fromEntries(groups.map((group) => [group.type, true]));

  promotionOverlay.hidden = false;

  return new Promise((resolve) => {
    pendingPromotionBatch = { resolve, groups, choices };
    renderPromotionBatch();
    promotionConfirmButton.focus?.();
  });
}

function promotionGroupsFor(promotionChoices) {
  const groups = new Map();

  for (const { piece } of promotionChoices) {
    const group = groups.get(piece.type) || {
      type: piece.type,
      label: PIECE_DATA[piece.type].label,
      promotedLabel: PROMOTED_DATA[piece.type].label,
      count: 0
    };

    group.count += 1;
    groups.set(piece.type, group);
  }

  return [...groups.values()].sort(
    (a, b) => PROMOTION_TYPE_ORDER.indexOf(a.type) - PROMOTION_TYPE_ORDER.indexOf(b.type)
  );
}

function renderPromotionBatch() {
  if (!pendingPromotionBatch) {
    return;
  }

  promotionGroupList.replaceChildren();

  for (const group of pendingPromotionBatch.groups) {
    const row = document.createElement("div");
    row.className = "promotion-choice-row";

    const summary = document.createElement("div");
    summary.className = "promotion-choice-summary";

    const label = document.createElement("strong");
    label.textContent = `${group.label} ${group.count}枚`;

    const promotedLabel = document.createElement("span");
    promotedLabel.textContent = `${group.promotedLabel}へ`;

    summary.append(label, promotedLabel);

    const toggle = document.createElement("div");
    toggle.className = "promotion-choice-toggle";
    toggle.setAttribute("role", "group");
    toggle.setAttribute("aria-label", `${group.label}の成り選択`);

    toggle.append(
      createPromotionChoiceButton(group.type, "promote", "成る"),
      createPromotionChoiceButton(group.type, "decline", "成らない")
    );

    row.append(summary, toggle);
    promotionGroupList.append(row);
  }
}

function createPromotionChoiceButton(type, choice, label) {
  const button = document.createElement("button");
  const activeChoice = pendingPromotionBatch.choices[type] ? "promote" : "decline";

  button.type = "button";
  button.textContent = label;
  button.dataset.batchPromotionType = type;
  button.dataset.batchPromotionChoice = choice;
  button.setAttribute("aria-pressed", String(choice === activeChoice));

  return button;
}

function handlePromotionGroupClick(event) {
  if (!pendingPromotionBatch) {
    return;
  }

  const button = promotionChoiceButtonFrom(event.target);

  if (!button) {
    return;
  }

  pendingPromotionBatch.choices[button.dataset.batchPromotionType] =
    button.dataset.batchPromotionChoice === "promote";
  renderPromotionBatch();
}

function promotionChoiceButtonFrom(target) {
  let current = target;

  while (current && current !== promotionGroupList) {
    if (current.dataset?.batchPromotionType) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function confirmPromotionBatch() {
  if (!pendingPromotionBatch) {
    hidePromotionOverlay();
    return;
  }

  resolvePromotionBatch({ ...pendingPromotionBatch.choices });
}

function cancelPromotionBatch() {
  if (!pendingPromotionBatch) {
    hidePromotionOverlay();
    return;
  }

  const choices = Object.fromEntries(pendingPromotionBatch.groups.map((group) => [group.type, false]));
  resolvePromotionBatch(choices);
}

function resolvePromotionBatch(choices) {
  const resolve = pendingPromotionBatch.resolve;
  pendingPromotionBatch = null;
  hidePromotionOverlay();
  resolve(choices);
}

function hidePromotionOverlay() {
  promotionOverlay.hidden = true;
  promotionGroupList.replaceChildren();
}

function showRules() {
  rulesOverlay.hidden = false;
  rulesButton.setAttribute("aria-expanded", "true");
  rulesCloseButton.focus?.();
}

function hideRules() {
  rulesOverlay.hidden = true;
  rulesButton.setAttribute("aria-expanded", "false");
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
    return `${position} 自分の駒の移動候補`;
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
