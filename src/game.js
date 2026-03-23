import { GRID_SIZE, CELL, MAX_TREASURES } from "./config.js";
import { inBoundsCheck, manhattan } from "./gameUtils.js";

function emptyPositions(grid, human, ai) {
  const list = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (grid[y][x] !== CELL.EMPTY) continue;
      if (x === human.x && y === human.y) continue;
      if (x === ai.x && y === ai.y) continue;
      list.push({ x, y });
    }
  }
  return list;
}

function countTreasures(grid) {
  let n = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (grid[y][x] === CELL.TREASURE) n++;
    }
  }
  return n;
}

/** spawn אוצר במקום ריק אקראי */
export function spawnTreasure(grid, human, ai) {
  if (countTreasures(grid) >= MAX_TREASURES) return { spawned: false };
  const opts = emptyPositions(grid, human, ai);
  if (opts.length === 0) return { spawned: false };
  const i = Math.floor(Math.random() * opts.length);
  const { x, y } = opts[i];
  grid[y][x] = CELL.TREASURE;
  return { spawned: true, x, y };
}

export function ensureTreasureExists(grid, human, ai) {
  if (countTreasures(grid) === 0) {
    const r = spawnTreasure(grid, human, ai);
    return r.spawned ? "אוצר חדש הופיע!" : null;
  }
  return null;
}

export function createInitialState() {
  const grid = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(CELL.EMPTY)
  );
  const human = { x: 0, y: GRID_SIZE - 1 };
  const ai = { x: GRID_SIZE - 1, y: 0 };

  const placeRandom = (type, count) => {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < 200) {
      const x = Math.floor(Math.random() * GRID_SIZE);
      const y = Math.floor(Math.random() * GRID_SIZE);
      if (grid[y][x] !== CELL.EMPTY) continue;
      if ((x === human.x && y === human.y) || (x === ai.x && y === ai.y))
        continue;
      grid[y][x] = type;
      placed++;
    }
  };

  placeRandom(CELL.TRAP, 3);
  let t = 0;
  for (let y = 0; y < GRID_SIZE && t < 2; y++) {
    for (let x = 0; x < GRID_SIZE && t < 2; x++) {
      if (grid[y][x] !== CELL.EMPTY) continue;
      if ((x === human.x && y === human.y) || (x === ai.x && y === ai.y))
        continue;
      grid[y][x] = CELL.TREASURE;
      t++;
    }
  }

  return {
    grid,
    human: { ...human },
    ai: { ...ai },
    scores: { human: 0, ai: 0 },
    turns: 0,
    messages: [],
    lastResolution: null,
  };
}

function tryMove(pos, dir, gridSize) {
  const nx = pos.x + dir.dx;
  const ny = pos.y + dir.dy;
  if (!inBoundsCheck(nx, ny, gridSize)) return { ...pos };
  return { x: nx, y: ny };
}

/**
 * מריץ תור: תזוזות, אוצרות, מלכודות, פרסים.
 * מחזיר אובייקט ל-AI למידה + הודעות
 */
export function resolveTurn(state, humanDir, aiDir, dirVec) {
  const grid = state.grid;
  const h0 = { ...state.human };
  const a0 = { ...state.ai };

  const h1 = tryMove(h0, dirVec[humanDir], GRID_SIZE);
  const a1 = tryMove(a0, dirVec[aiDir], GRID_SIZE);
  const aiStayed = a1.x === a0.x && a1.y === a0.y;

  let rh = 0;
  let ra = 0;
  const messages = [];

  const hTreasure =
    inBoundsCheck(h1.x, h1.y, GRID_SIZE) &&
    grid[h1.y][h1.x] === CELL.TREASURE;
  const aTreasure =
    inBoundsCheck(a1.x, a1.y, GRID_SIZE) &&
    grid[a1.y][a1.x] === CELL.TREASURE;

  const sameTreasureCell =
    hTreasure &&
    aTreasure &&
    h1.x === a1.x &&
    h1.y === a1.y;

  if (sameTreasureCell) {
    const tx = h1.x;
    const ty = h1.y;
    const dH = manhattan(h0.x, h0.y, tx, ty);
    const dA = manhattan(a0.x, a0.y, tx, ty);
    let humanWins;
    if (dH < dA) {
      humanWins = true;
      messages.push("אותו אוצר — היית קרוב יותר בתור הקודם!");
    } else if (dA < dH) {
      humanWins = false;
      messages.push("אותו אוצר — ה-AI היה קרוב יותר בתור הקודם.");
    } else {
      humanWins = Math.random() < 0.5;
      messages.push("תיקו במרחק! הטבע הכריע (הגרלה 50/50).");
    }

    if (humanWins) {
      rh = 10 + 3;
      ra = -3;
    } else {
      rh = -3;
      ra = 10 + 3;
    }
    grid[ty][tx] = CELL.EMPTY;
  } else {
    if (hTreasure) {
      rh += 10;
      grid[h1.y][h1.x] = CELL.EMPTY;
    }
    if (aTreasure) {
      ra += 10;
      grid[a1.y][a1.x] = CELL.EMPTY;
    }
  }

  const hTrap =
    inBoundsCheck(h1.x, h1.y, GRID_SIZE) && grid[h1.y][h1.x] === CELL.TRAP;
  const aTrap =
    inBoundsCheck(a1.x, a1.y, GRID_SIZE) && grid[a1.y][a1.x] === CELL.TRAP;

  if (hTrap) {
    rh -= 10;
    messages.push("נפלת במלכודת!");
  }
  if (aTrap) {
    ra -= 10;
    messages.push("ה-AI נפל במלכודת.");
  }

  const newHuman = h1;
  const newAi = a1;

  const spawnMsg = ensureTreasureExists(grid, newHuman, newAi);
  if (spawnMsg) messages.push(spawnMsg);

  return {
    human: newHuman,
    ai: newAi,
    rewardHuman: rh,
    rewardAi: ra,
    messages,
    prevHuman: h0,
    prevAi: a0,
    aiTrap: aTrap,
    aiTreasure: aTreasure,
    sameTreasureCell,
    aiWonTreasureRace: sameTreasureCell ? ra > 0 : false,
    aiStayed,
  };
}

