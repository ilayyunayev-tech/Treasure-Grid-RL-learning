import { reportCaughtError } from "./errorToasts.js";
import {
  DIRS,
  TURN_DELAY_MS,
  INITIAL_WEIGHTS,
  ZERO_WEIGHTS,
  FEATURE_LABELS,
  DEFAULT_ALPHA_REWARD,
  DEFAULT_ALPHA_PENALTY,
  EPSILON,
  EPSILON_MIN,
  GAMMA,
} from "./config.js";
import {
  createInitialState,
  resolveTurn,
  ensureTreasureExists,
} from "./game.js";
import { planAiMove, maxActionValue } from "./ai.js";
import { updateWeights } from "./learning.js";
import { bindInput, wireDirectionButtons } from "./input.js";
import {
  updateMainView,
  setupPanels,
  setupCollapsibleSidePanels,
  showWeightUpdateToastIfNeeded,
  clearWeightToastSkip,
} from "./ui.js";

const LEARN_LOG_MAX = 50;
const LEARNING_MODE = {
  GLOBAL: "global",
  FOCUSED: "focused",
};

const dirVec = {
  UP: { dx: DIRS.UP.dx, dy: DIRS.UP.dy },
  DOWN: { dx: DIRS.DOWN.dx, dy: DIRS.DOWN.dy },
  LEFT: { dx: DIRS.LEFT.dx, dy: DIRS.LEFT.dy },
  RIGHT: { dx: DIRS.RIGHT.dx, dy: DIRS.RIGHT.dy },
};

function buildGame() {
  const state = createInitialState();
  let aiWeights = [...INITIAL_WEIGHTS];
  let alphaReward = DEFAULT_ALPHA_REWARD;
  let alphaPenalty = DEFAULT_ALPHA_PENALTY;
  let learningMode = LEARNING_MODE.GLOBAL;
  const aiVisited = new Set([`${state.ai.x},${state.ai.y}`]);
  let waiting = true;
  let lastPlan = null;
  let lastLearn = null;
  /** יומן למידה — החדש בראש (unshift) */
  const learnLog = [];

  const root = { calcOpen: true, weightsOpen: false };

  const els = {
    gridEl: document.getElementById("grid-wrap"),
    hudEl: document.getElementById("hud"),
    msgEl: document.getElementById("messages"),
    thinkEl: document.getElementById("think-panel"),
    learnEl: document.getElementById("learn-panel"),
    calcEl: document.getElementById("calc-panel-body"),
    weightEl: document.getElementById("weight-panel-body"),
    btnCalc: document.getElementById("btn-calc"),
    btnWeights: document.getElementById("btn-weights"),
    calcPanel: document.getElementById("calc-panel"),
    weightPanel: document.getElementById("weight-panel"),
    dirPad: document.getElementById("dir-pad"),
    statusEl: document.getElementById("status"),
  };

  setupPanels(root, els);
  setupCollapsibleSidePanels();

  const weightInputs = [];
  const wrapWeights = document.getElementById("weights-edit-wrap");
  if (wrapWeights && !wrapWeights.dataset.built) {
    FEATURE_LABELS.forEach((label, i) => {
      const row = document.createElement("div");
      row.className = "weight-row";
      const lab = document.createElement("label");
      lab.htmlFor = `ai-weight-${i}`;
      lab.textContent = `w${i + 1} · ${label}`;
      const inp = document.createElement("input");
      inp.type = "number";
      inp.step = "any";
      inp.id = `ai-weight-${i}`;
      inp.className = "weight-input";
      inp.dir = "ltr";
      row.appendChild(lab);
      row.appendChild(inp);
      wrapWeights.appendChild(row);
      weightInputs.push(inp);
    });
    wrapWeights.dataset.built = "1";
  }

  function syncWeightInputs() {
    weightInputs.forEach((inp, i) => {
      if (document.activeElement !== inp && aiWeights[i] !== undefined) {
        const v = aiWeights[i];
        inp.value = Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000);
      }
    });
  }

  function syncAlphaInputs() {
    const ar = document.getElementById("alpha-reward");
    const ap = document.getElementById("alpha-penalty");
    if (ar && document.activeElement !== ar) {
      ar.value = String(Math.round(alphaReward * 10000) / 10000);
    }
    if (ap && document.activeElement !== ap) {
      ap.value = String(Math.round(alphaPenalty * 10000) / 10000);
    }
  }

  function syncLearningModeInput() {
    const chk = document.getElementById("chk-focused-learning");
    if (!chk) return;
    chk.checked = learningMode === LEARNING_MODE.FOCUSED;
  }

  function inferLearningEvent(res) {
    if (res.aiTrap) return "trap";
    if (res.sameTreasureCell) return res.aiWonTreasureRace ? "race_win" : "race_loss";
    if (res.aiTreasure) return "treasure";
    if (res.aiStayed) return "blocked";
    return "neutral";
  }

  function buildGatesByEvent(eventType) {
    switch (eventType) {
      case "trap":
        return [0, 1, 0, 0, 0];
      case "treasure":
        return [1, 0, 0.5, 0, 0];
      case "race_win":
      case "race_loss":
        return [0, 0, 1, 0, 0];
      case "blocked":
        return [0, 0, 0, 0, 1];
      default:
        return [1, 1, 1, 1, 1];
    }
  }

  function paint() {
    updateMainView(root, state, aiWeights, lastPlan, lastLearn, els, learnLog, {
      alphaReward,
      alphaPenalty,
      gamma: GAMMA,
      learningMode,
    });
    syncWeightInputs();
    syncAlphaInputs();
    syncLearningModeInput();
  }

  function fullReset(newWeights) {
    const s = createInitialState();
    state.grid = s.grid;
    state.human = s.human;
    state.ai = s.ai;
    state.scores = s.scores;
    state.turns = s.turns;
    state.messages = [];
    aiWeights = [...newWeights];
    aiVisited.clear();
    aiVisited.add(`${state.ai.x},${state.ai.y}`);
    lastPlan = null;
    lastLearn = null;
    learnLog.length = 0;
    waiting = true;
    setStatus("בחר כיוון (חצים או כפתורים)");
    paint();
  }

  function setStatus(text) {
    if (els.statusEl) els.statusEl.textContent = text;
  }

  function runTurn(humanDir) {
    if (!waiting) return;
    waiting = false;
    setStatus("מחשב…");

    try {
      const spawnHint = ensureTreasureExists(
        state.grid,
        state.human,
        state.ai
      );

      const effEps = Math.max(EPSILON_MIN, EPSILON - state.turns / 100);
      lastPlan = planAiMove(
        state.grid,
        state.ai.x,
        state.ai.y,
        state.human.x,
        state.human.y,
        aiWeights,
        aiVisited,
        effEps
      );

      const res = resolveTurn(
        state,
        humanDir,
        lastPlan.chosenKey,
        dirVec
      );

      state.human = res.human;
      state.ai = res.ai;
      state.scores.human += res.rewardHuman;
      state.scores.ai += res.rewardAi;
      state.turns += 1;
      state.messages = [...(spawnHint ? [spawnHint] : []), ...res.messages];

      const feats = lastPlan.byDir[lastPlan.chosenKey].features;
      const predicted = lastPlan.predictedScore;
      const visitNext = new Set(aiVisited);
      visitNext.add(`${state.ai.x},${state.ai.y}`);
      const maxNext = maxActionValue(
        state.grid,
        state.ai.x,
        state.ai.y,
        state.human.x,
        state.human.y,
        aiWeights,
        visitNext
      );
      const tdTarget = res.rewardAi + GAMMA * maxNext;
      const error = tdTarget - predicted;
      const eventType = inferLearningEvent(res);
      const gates =
        learningMode === LEARNING_MODE.FOCUSED
          ? buildGatesByEvent(eventType)
          : [1, 1, 1, 1, 1];
      const { weights: newW, deltas } = updateWeights(aiWeights, feats, error, {
        alphaReward,
        alphaPenalty,
        gates,
      });
      aiWeights = newW;
      showWeightUpdateToastIfNeeded(deltas, FEATURE_LABELS, state.turns);

      aiVisited.add(`${state.ai.x},${state.ai.y}`);

      lastLearn = {
        predicted,
        reward: res.rewardAi,
        error,
        deltas,
        chosenKey: lastPlan.chosenKey,
        maxNext,
        tdTarget,
        gamma: GAMMA,
        learningMode,
        eventType,
        gates: [...gates],
      };

      const epsThr = Math.round(lastPlan.epsilonEffective * 1000) / 10;
      learnLog.unshift({
        turn: state.turns,
        chosenKey: lastPlan.chosenKey,
        predicted,
        reward: res.rewardAi,
        error,
        maxNext,
        tdTarget,
        epsilonRoll: lastPlan.epsilonRoll,
        explore: lastPlan.explore,
        epsThreshold: epsThr,
        gamma: GAMMA,
        learningMode,
        eventType,
        gates: [...gates],
        deltas: deltas.map((d) => ({ ...d })),
      });
      if (learnLog.length > LEARN_LOG_MAX) learnLog.length = LEARN_LOG_MAX;

      paint();

      setStatus(`עוד רגע… (${TURN_DELAY_MS}ms)`);
      setTimeout(() => {
        try {
          waiting = true;
          setStatus("בחר כיוון (חצים או כפתורים)");
          paint();
        } catch (e) {
          reportCaughtError(e, "שגיאה אחרי תור");
          waiting = true;
          console.error(e);
        }
      }, TURN_DELAY_MS);
    } catch (e) {
      reportCaughtError(e, "שגיאה בתור");
      waiting = true;
      setStatus("אירעה שגיאה — אפשר לנסות שוב או משחק מחדש");
      console.error(e);
    }
  }

  const isEnabled = () => waiting;

  bindInput(runTurn, isEnabled);
  wireDirectionButtons(els.dirPad, runTurn, isEnabled);

  document.getElementById("btn-reset")?.addEventListener("click", () => {
    fullReset(INITIAL_WEIGHTS);
  });

  document.getElementById("btn-weights-apply")?.addEventListener("click", () => {
    const next = weightInputs.map((inp) =>
      parseFloat(String(inp.value).trim().replace(",", "."))
    );
    if (next.length !== INITIAL_WEIGHTS.length || next.some((n) => !Number.isFinite(n))) {
      setStatus("הזינו מספר תקין בכל אחד מחמשת המשקלים.");
      return;
    }
    aiWeights = next;
    setStatus("משקלים עודכנו — בחר כיוון.");
    paint();
  });

  document.getElementById("btn-weights-restore-default")?.addEventListener("click", () => {
    aiWeights = [...INITIAL_WEIGHTS];
    setStatus("משקלים חזרו לברירת המחדל (0.01, 0.5, 0.45, 0.25, 0.45).");
    paint();
  });

  document.getElementById("btn-weights-zero")?.addEventListener("click", () => {
    aiWeights = [...ZERO_WEIGHTS];
    setStatus("כל המשקלים 0 — ה-AI כמעט רק אקראי (חקר 20%).");
    paint();
  });

  document.getElementById("btn-new-game-zero")?.addEventListener("click", () => {
    fullReset(ZERO_WEIGHTS);
  });

  document.getElementById("btn-restore-weight-toast")?.addEventListener("click", () => {
    clearWeightToastSkip();
    setStatus("טוסט עדכון משקלים יופיע שוב מהתור הבא.");
  });

  document.getElementById("btn-alpha-apply")?.addEventListener("click", () => {
    const ar = parseFloat(String(document.getElementById("alpha-reward")?.value || "").replace(",", "."));
    const ap = parseFloat(String(document.getElementById("alpha-penalty")?.value || "").replace(",", "."));
    if (!Number.isFinite(ar) || !Number.isFinite(ap) || ar < 0 || ap < 0 || ar > 2 || ap > 2) {
      setStatus("α חייב להיות מספר בין 0 ל־2.");
      return;
    }
    alphaReward = ar;
    alphaPenalty = ap;
    setStatus(`α עודכן: תגמול ${ar}, עונש ${ap}.`);
    paint();
  });

  document.getElementById("btn-alpha-default")?.addEventListener("click", () => {
    alphaReward = DEFAULT_ALPHA_REWARD;
    alphaPenalty = DEFAULT_ALPHA_PENALTY;
    setStatus("α חזר ל־0.03 לשניהם.");
    paint();
  });

  document.getElementById("chk-focused-learning")?.addEventListener("change", (e) => {
    const enabled = Boolean(e.target?.checked);
    learningMode = enabled ? LEARNING_MODE.FOCUSED : LEARNING_MODE.GLOBAL;
    setStatus(
      enabled
        ? "מצב למידה: ממוקד אירוע (אפשר לכבות בצ'קבוקס)."
        : "מצב למידה: גלובלי (ברירת מחדל)."
    );
    paint();
  });

  setStatus("בחר כיוון (חצים או כפתורים)");
  paint();
}

try {
  buildGame();
} catch (e) {
  reportCaughtError(e, "שגיאה באתחול המשחק");
  console.error(e);
}
