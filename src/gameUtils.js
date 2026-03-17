import { GRID_SIZE } from "./config.js";

export function inBoundsCheck(x, y, size = GRID_SIZE) {
  return x >= 0 && x < size && y >= 0 && y < size;
}

export function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}
