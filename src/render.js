import { GRID_SIZE, CELL, DIRS } from "./config.js";

const EMOJI = {
  empty: "⬜",
  treasure: "💎",
  trap: "⚡",
  human: "👤",
  ai: "🤖",
};

/**
 * מחזיר תא אחד — אם שני שחקנים באותה משבצת מציגים שניהם
 */
export function renderGrid(grid, human, ai) {
  const rows = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const cells = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const onH = human.x === x && human.y === y;
      const onA = ai.x === x && ai.y === y;
      let base = EMOJI.empty;
      if (grid[y][x] === CELL.TREASURE) base = EMOJI.treasure;
      else if (grid[y][x] === CELL.TRAP) base = EMOJI.trap;

      let content = base;
      if (onH && onA) {
        content = `${EMOJI.human}${EMOJI.ai}`;
      } else if (onH) {
        content =
          grid[y][x] === CELL.TREASURE
            ? `${EMOJI.human}💎`
            : grid[y][x] === CELL.TRAP
              ? `${EMOJI.human}⚡`
              : EMOJI.human;
      } else if (onA) {
        content =
          grid[y][x] === CELL.TREASURE
            ? `${EMOJI.ai}💎`
            : grid[y][x] === CELL.TRAP
              ? `${EMOJI.ai}⚡`
              : EMOJI.ai;
      }

      cells.push(`<div class="cell" data-x="${x}" data-y="${y}">${content}</div>`);
    }
    rows.push(`<div class="grid-row">${cells.join("")}</div>`);
  }
  return `<div class="grid" dir="ltr">${rows.join("")}</div>`;
}

export function dirLabel(key) {
  const d = DIRS[key];
  return d ? `${d.arrow} ${d.label}` : key;
}
