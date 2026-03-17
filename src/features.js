import { GRID_SIZE, CELL, DIRS } from "./config.js";

export function sign(x) {
  if (x > 0) return 1;
  if (x < 0) return -1;
  return 0;
}

function inBounds(x, y) {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/** אוצר הכי קרוב (לפי מרחק) — מחזיר { x, y } או null */
export function nearestTreasure(grid, ax, ay) {
  let best = null;
  let bestD = Infinity;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (grid[y][x] === CELL.TREASURE) {
        const d = manhattan(ax, ay, x, y);
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
  }
  return best;
}

function nearestTrapFrom(ax, ay, grid) {
  let best = null;
  let bestD = Infinity;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (grid[y][x] === CELL.TRAP) {
        const d = manhattan(ax, ay, x, y);
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
  }
  return best;
}

/** מובילות לאוצר: +1 AI קרוב יותר, −1 יריב קרוב יותר, 0 תיקו במרחק */
function leadToTreasureFeature(ax, ay, humanX, humanY, treasureRef) {
  if (!treasureRef) return 0;
  const dAi = manhattan(ax, ay, treasureRef.x, treasureRef.y);
  const dH = manhattan(humanX, humanY, treasureRef.x, treasureRef.y);
  if (dAi < dH) return 1;
  if (dAi > dH) return -1;
  return 0;
}

/**
 * פיצ'רים לכיוון אחד (AI). treasureRef — אוצר הקרוב מנקודת ה-AI לפני התזוזה.
 */
export function computeFeatures(
  grid,
  aiX,
  aiY,
  humanX,
  humanY,
  dirKey,
  aiVisited,
  treasureRef
) {
  const d = DIRS[dirKey];
  const nx = aiX + d.dx;
  const ny = aiY + d.dy;
  const validMove = inBounds(nx, ny);

  let f1 = 0,
    f2 = 0,
    f3 = 0,
    f4 = 0,
    f5 = 0;

  if (treasureRef) {
    const before = manhattan(aiX, aiY, treasureRef.x, treasureRef.y);
    const after = validMove
      ? manhattan(nx, ny, treasureRef.x, treasureRef.y)
      : before;
    f1 = sign(before - after);
  }

  const trap = nearestTrapFrom(aiX, aiY, grid);
  if (trap) {
    const before = manhattan(aiX, aiY, trap.x, trap.y);
    const after = validMove ? manhattan(nx, ny, trap.x, trap.y) : before;
    f2 = sign(after - before);
  }

  if (treasureRef) {
    const ax = validMove ? nx : aiX;
    const ay = validMove ? ny : aiY;
    f3 = leadToTreasureFeature(ax, ay, humanX, humanY, treasureRef);
  }

  if (validMove) {
    const key = `${nx},${ny}`;
    f4 = aiVisited.has(key) ? 0 : 1;
  } else {
    f4 = 0;
  }

  if (!validMove) {
    f5 = -1;
  } else if (nx === humanX && ny === humanY) {
    f5 = -1;
  } else {
    f5 = 1;
  }

  return [f1, f2, f3, f4, f5];
}

export function scoreDirection(weights, features) {
  let s = 0;
  const terms = [];
  for (let i = 0; i < 5; i++) {
    const prod = weights[i] * features[i];
    s += prod;
    terms.push({ w: weights[i], f: features[i], prod });
  }
  return { score: s, terms };
}
