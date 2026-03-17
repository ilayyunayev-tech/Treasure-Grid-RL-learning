import { DIR_ORDER, EPSILON, DIRS } from "./config.js";
import { nearestTreasure, computeFeatures, scoreDirection } from "./features.js";

/**
 * מקסימום ציון על פעולות אפשריות ממצב נתון (ל-bootstrap ב-TD)
 */
export function maxActionValue(
  grid,
  aiX,
  aiY,
  humanX,
  humanY,
  weights,
  aiVisited
) {
  const treasureRef = nearestTreasure(grid, aiX, aiY);
  let best = -Infinity;
  for (const key of DIR_ORDER) {
    const features = computeFeatures(
      grid,
      aiX,
      aiY,
      humanX,
      humanY,
      key,
      aiVisited,
      treasureRef
    );
    const { score } = scoreDirection(weights, features);
    if (score > best) best = score;
  }
  return Number.isFinite(best) ? best : 0;
}

/**
 * מחשב ציונים ופירוט לכל כיוון + החלטת ε-greedy
 * @param epsilonEffective — בין 0 ל־1 (דעיכה עם הזמן מבחוץ)
 */
export function planAiMove(
  grid,
  aiX,
  aiY,
  humanX,
  humanY,
  weights,
  aiVisited,
  epsilonEffective = EPSILON
) {
  const eps = Math.min(1, Math.max(0, epsilonEffective));
  const treasureRef = nearestTreasure(grid, aiX, aiY);
  const byDir = {};
  let bestKey = "UP";
  let bestScore = -Infinity;

  for (const key of DIR_ORDER) {
    const features = computeFeatures(
      grid,
      aiX,
      aiY,
      humanX,
      humanY,
      key,
      aiVisited,
      treasureRef
    );
    const { score, terms } = scoreDirection(weights, features);
    byDir[key] = { score, features, terms };
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  const epsilonRoll = Math.random() * 100;
  const explore = epsilonRoll < eps * 100;
  let chosenKey;
  if (explore) {
    chosenKey = DIR_ORDER[Math.floor(Math.random() * DIR_ORDER.length)];
  } else {
    chosenKey = bestKey;
  }

  const predicted = byDir[chosenKey].score;
  return {
    byDir,
    chosenKey,
    predictedScore: predicted,
    epsilonRoll: Math.round(epsilonRoll * 10) / 10,
    explore,
    greedyBest: bestKey,
    greedyBestScore: bestScore,
    epsilonEffective: eps,
    epsilonPct: Math.round(eps * 1000) / 10,
  };
}

export function applyDir(x, y, dirKey) {
  const d = DIRS[dirKey];
  return { x: x + d.dx, y: y + d.dy };
}
