/** Treasure Grid — קבועים לפי האפיון */
export const GRID_SIZE = 5;
/** ברירת מחדל ל-α (תגמול ועונש אם לא משנים בנפרד) */
export const LEARNING_RATE = 0.03;
export const DEFAULT_ALPHA_REWARD = 0.03;
export const DEFAULT_ALPHA_PENALTY = 0.03;
export const EPSILON = 0.2; // התחלת חקר
export const EPSILON_MIN = 0.05; // ε = max(5%, 20% − תורות/100)
/** ערך עתידי משוער בטעות TD */
export const GAMMA = 0.9;
export const TURN_DELAY_MS = 200;
export const MAX_TREASURES = 3;

export const CELL = {
  EMPTY: 0,
  TREASURE: 1,
  TRAP: 2,
};

export const DIRS = {
  UP: { dx: 0, dy: -1, key: "UP", label: "למעלה", arrow: "↑" },
  DOWN: { dx: 0, dy: 1, key: "DOWN", label: "למטה", arrow: "↓" },
  LEFT: { dx: -1, dy: 0, key: "LEFT", label: "שמאלה", arrow: "←" },
  RIGHT: { dx: 1, dy: 0, key: "RIGHT", label: "ימינה", arrow: "→" },
};

export const DIR_ORDER = ["UP", "RIGHT", "DOWN", "LEFT"];

export const FEATURE_LABELS = [
  "מתקרב לאוצר",
  "מתרחק ממלכודת",
  "מוביל לאוצר מול יריב (+1 קרוב יותר, −1 רחוק יותר)",
  "תא חדש (ביקור ראשון)",
  "תא ריק (לא חסום)",
];

/** משקלים התחלתיים — שינוי איטי (α נמוך) */
export const INITIAL_WEIGHTS = [0.01, 0.5, 0.45, 0.25, 0.45];

/** איפוס ל-0 — AI בלי ידע מובנה (רק חקר ε) */
export const ZERO_WEIGHTS = [0, 0, 0, 0, 0];
