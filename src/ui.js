import {
  FEATURE_LABELS,
  DIR_ORDER,
  LEARNING_RATE,
  DIRS,
} from "./config.js";
import { renderGrid, dirLabel } from "./render.js";

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function formatNum(n) {
  return (Math.round(n * 100) / 100).toString();
}

function rewardLabel(r) {
  if (r === 13) return "+13 (אוצר+מרוץ)";
  if (r === 10) return "+10 אוצר";
  if (r === -3) return "−3 מרוץ";
  if (r === -10) return "−10 מלכודת";
  if (r === 0) return "0";
  return `${r >= 0 ? "+" : ""}${r}`;
}

export function updateMainView(
  root,
  state,
  aiWeights,
  lastPlan,
  _lastLearn,
  flags,
  learnLog = [],
  learningRates = {
    alphaReward: LEARNING_RATE,
    alphaPenalty: LEARNING_RATE,
    gamma: 0.9,
  }
) {
  const { alphaReward, alphaPenalty, gamma, learningMode = "global" } =
    learningRates;
  const { gridEl, hudEl, msgEl, thinkEl, learnEl, calcEl, weightEl } = flags;

  if (gridEl) {
    gridEl.innerHTML = renderGrid(state.grid, state.human, state.ai);
  }
  if (hudEl) {
    hudEl.innerHTML = `
      <div class="score-card score-card--player">
        <span class="score-card__label">👤 אתה</span>
        <span class="score-card__value" id="player-score">${state.scores.human}</span>
      </div>
      <div class="score-card score-card--turns">
        <span class="score-card__label">תורות</span>
        <span class="score-card__value" id="turn-count">${state.turns}</span>
      </div>
      <div class="score-card score-card--ai">
        <span class="score-card__label">🤖 AI</span>
        <span class="score-card__value" id="ai-score">${state.scores.ai}</span>
      </div>
    `;
  }
  if (msgEl && state.messages && state.messages.length) {
    msgEl.innerHTML = state.messages
      .map((m) => `<div class="msg-line">${esc(m)}</div>`)
      .join("");
  } else if (msgEl && !state.messages?.length) {
    msgEl.innerHTML =
      '<div class="msg-hint">בחר כיוון — ה-AI יחשב ויראה לך הכל.</div>';
  }

  if (thinkEl && !lastPlan) {
    thinkEl.innerHTML =
      '<p class="placeholder">בחר כיוון — כאן יופיע החישוב המלא של ה-AI לפני התזוזה.</p>';
  } else if (thinkEl && lastPlan) {
    const { byDir, chosenKey, epsilonRoll, explore, greedyBest, greedyBestScore } =
      lastPlan;
    let bestScore = -Infinity;
    DIR_ORDER.forEach((k) => {
      if (byDir[k].score > bestScore) bestScore = byDir[k].score;
    });
    const lines = DIR_ORDER.map((k) => {
      const sc = byDir[k].score;
      const star = !explore && k === greedyBest && sc === greedyBestScore ? " ⭐" : "";
      return `<div class="think-dir ${k === chosenKey ? "chosen" : ""}">${DIRS[k].arrow} ${dirLabel(k)} → <strong>${formatNum(sc)}</strong>${star}</div>`;
    }).join("");

    const thr = lastPlan.epsilonPct ?? 20;
    const exploreLine = explore
      ? `<div class="epsilon explore">🎲 <strong>חקר:</strong> הוגרל ${formatNum(epsilonRoll)} &lt; ${formatNum(thr)} (סף נוכחי ${formatNum(thr)}% — יורד עם הזמן עד מינימום 5%) → כיוון <strong>אקראי</strong>.</div>`
      : `<div class="epsilon greedy">🎲 <strong>ניצול:</strong> ${formatNum(epsilonRoll)} ≥ ${formatNum(thr)} → בוחרים את <strong>הציון הגבוה</strong> (⭐). פחות חקר ככל שעוברים תורות.</div>`;

    let chosenExplain = "";
    if (explore) {
      chosenExplain = `<p class="think-note think-note--explore">הרובוט זז ל־<strong>${dirLabel(chosenKey)}</strong> כי הפעם נכנסנו ל־<strong>חקר</strong> — גם אם כיוון אחר היה נראה «חכם» יותר לפי הציון.</p>`;
    } else {
      chosenExplain = `<p class="think-note">הרובוט זז ל־<strong>${dirLabel(chosenKey)}</strong> — זה הכיוון עם הציון הגבוה ביותר מבין ארבעת האפשרויות.</p>`;
    }

    const best = byDir[greedyBest];
    const br = best.terms
      .map(
        (t, i) =>
          `<div class="term">├ ${FEATURE_LABELS[i]}: ${t.f >= 0 ? "+" : ""}${t.f} × ${formatNum(t.w)} = <span class="${t.prod >= 0 ? "pos" : "neg"}">${t.prod >= 0 ? "+" : ""}${formatNum(t.prod)}</span></div>`
      )
      .join("");
    thinkEl.innerHTML = `
      <h3>🤖 איך ה-AI חישב</h3>
      <p class="think-intro">לכל כיוון מחושב <strong>ציון</strong> = סכום (פיצ׳ר × משקל). <strong>f₂</strong> תמיד משווה מרחק למלכודת <em>הקרובה</em>; <strong>f₃</strong> = +1 אם אחרי הצעד אתה <em>קרוב יותר לאוצר מהיריב</em>, −1 אם היריב קרוב יותר, 0 בתיקו.</p>
      ${chosenExplain}
      ${exploreLine}
      <p class="think-legend"><strong>⭐</strong> מסמן את הכיוון עם הציון הגבוה ביותר (לפני ההגרלה) — רלוונטי כשלא בחקר.</p>
      <p class="think-subsec">ציון לכל כיוון:</p>
      <div class="scores-row">${lines}</div>
      <p class="why">למה <strong>${dirLabel(greedyBest)}</strong> קיבל את הציון הגבוה ביותר? פירוט (סכימה):</p>
      <p class="think-formula-hint">כל שורה: <strong>ערך הפיצ׳ר</strong> (בדרך כלל ‎−1, 0 או 1) × <strong>המשקל הנוכחי</strong> = תרומה לציון.</p>
      <div class="breakdown">${br}
        <div class="term total">└ סה״כ ציון לכיוון הזה: <strong>${formatNum(best.score)}</strong></div>
      </div>
    `;
  }

  if (learnEl) {
    let logHtml = "";
    if (learnLog.length === 0) {
      logHtml =
        '<p class="placeholder">אחרי כל תור תופיע כאן שורה ביומן — בלי לעצור את המשחק.</p>';
    } else {
      logHtml = learnLog
        .map((e, idx) => {
          const errC =
            e.error > 0 ? "log-err-pos" : e.error < 0 ? "log-err-neg" : "";
          const exp = e.explore ? "חקר 🎲" : "ניצול";
          const eth = e.epsThreshold ?? 20;
          const errExplain =
            e.error > 0
              ? "קיבלתי יותר ממה שחיזיתי (כולל ערך עתידי) → מחזקים פיצ׳רים של הצעד"
              : e.error < 0
                ? "פחות ממה שחיזיתי → מחלישים את הצעד"
                : "כמעט בדיוק כמו החיזוי";
          const deltasLine =
            e.deltas.length === 0
              ? '<span class="log-delta-muted">אין שינוי משמעותי במשקלים</span>'
              : e.deltas
                  .map((d) => {
                    const up = d.delta > 0;
                    return `<span class="log-delta-chip ${up ? "up" : "down"}">${esc(FEATURE_LABELS[d.i])}: ${d.delta >= 0 ? "+" : ""}${formatNum(d.delta)}</span>`;
                  })
                  .join(" ");
          const g = e.gamma ?? gamma;
          const tdRow =
            e.maxNext !== undefined && e.maxNext !== null && e.tdTarget !== undefined
              ? `<div class="learn-log-entry__row log-td-detail">
              יעד TD = פרס + ${formatNum(g)}×max(המשך) = ${rewardLabel(e.reward)} + ${formatNum(g)}×${formatNum(e.maxNext)} = <strong>${formatNum(e.tdTarget)}</strong>
              · ציון לצעד: <strong>${formatNum(e.predicted)}</strong>
            </div>`
              : "";
          const modeRow = `<div class="learn-log-entry__row">
              <strong>מצב עדכון:</strong> ${e.learningMode === "focused" ? "ממוקד" : "גלובלי"}
              · <strong>אירוע:</strong> ${esc(e.eventType || "neutral")}
            </div>`;
          return `<article class="learn-log-entry ${idx === 0 ? "learn-log-entry--latest" : ""}" aria-label="תור ${e.turn}">
            <div class="learn-log-entry__head">
              <strong>תור ${e.turn}</strong>
              <span class="learn-log-entry__dir">${DIRS[e.chosenKey].arrow} ${dirLabel(e.chosenKey)}</span>
              <span class="learn-log-entry__eps">${formatNum(e.epsilonRoll)} &lt; ${formatNum(eth)}? ${e.explore ? "כן → חקר" : "לא → ניצול"} · ${exp}</span>
            </div>
            <div class="learn-log-entry__row">
              <strong>טעות TD:</strong> <span class="${errC}">${e.error >= 0 ? "+" : ""}${formatNum(e.error)}</span>
              · ${esc(errExplain)}
            </div>
            ${tdRow}
            ${modeRow}
            <div class="learn-log-entry__deltas">${deltasLine}</div>
          </article>`;
        })
        .join("");
    }
    const modeText =
      learningMode === "focused"
        ? "עדכון ממוקד אירוע: רק משקלים רלוונטיים לאירוע מתעדכנים."
        : "עדכון גלובלי: כל פיצ׳ר פעיל מתעדכן.";
    learnEl.innerHTML = `
      <h3>📚 יומן למידה</h3>
      <p class="log-formula">טעות TD = (פרס + ${formatNum(gamma)}×מקס׳ ציון מהמצב הבא) − ציון הצעד. עדכון: משקל ← משקל + α×טעות×פיצ׳ר (α₊=${formatNum(alphaReward)} / α₋=${formatNum(alphaPenalty)}). <strong>${modeText}</strong> החדש למעלה.</p>
      <div class="learn-log-scroll" id="learn-log-scroll">${logHtml}</div>
    `;
    const sc = document.getElementById("learn-log-scroll");
    if (sc && learnLog.length) sc.scrollTop = 0;
  }

  if (calcEl && lastPlan && root.calcOpen) {
    let html = "<h3>חישוב מלא לכל כיוון</h3>";
    DIR_ORDER.forEach((k) => {
      const { score, terms } = lastPlan.byDir[k];
      const rows = terms
        .map(
          (t, i) =>
            `<tr><td>${FEATURE_LABELS[i]}</td><td>${t.f}</td><td>×</td><td>${formatNum(t.w)}</td><td>=</td><td class="${t.prod >= 0 ? "pos" : "neg"}">${formatNum(t.prod)}</td></tr>`
        )
        .join("");
      html += `<h4>${DIRS[k].arrow} ${dirLabel(k)} — סה״כ ${formatNum(score)}</h4><table class="calc-table">${rows}</table>`;
    });
    calcEl.innerHTML = html;
  } else if (calcEl) {
    calcEl.innerHTML = lastPlan
      ? ""
      : "<p>שחקו תור כדי לראות חישובים.</p>";
  }

  if (weightEl && root.weightsOpen) {
    weightEl.innerHTML = `<h3>משקלים נוכחיים</h3>
      <ul class="weight-list">
        ${aiWeights
          .map(
            (w, i) =>
              `<li><span class="wi">w${i + 1}</span> ${FEATURE_LABELS[i]}: <strong>${formatNum(w)}</strong></li>`
          )
          .join("")}
      </ul>`;
  }
}

export function setupPanels(root, els) {
  els.btnCalc?.addEventListener("click", () => {
    root.calcOpen = !root.calcOpen;
    els.calcPanel?.classList.toggle("hidden", !root.calcOpen);
    els.btnCalc?.setAttribute("aria-expanded", String(root.calcOpen));
  });
  els.btnWeights?.addEventListener("click", () => {
    root.weightsOpen = !root.weightsOpen;
    els.weightPanel?.classList.toggle("hidden", !root.weightsOpen);
  });
}

export function setupCollapsibleSidePanels() {
  const bind = (btnId, wrapId) => {
    const btn = document.getElementById(btnId);
    const wrap = document.getElementById(wrapId);
    if (!btn || !wrap) return;
    btn.addEventListener("click", () => {
      const open = wrap.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    });
  };
  bind("btn-toggle-think", "panel-think-wrap");
  bind("btn-toggle-learn", "panel-learn-wrap");
}

const WEIGHT_TOAST_SKIP_KEY = "treasureGridSkipWeightToast";

export function clearWeightToastSkip() {
  try {
    localStorage.removeItem(WEIGHT_TOAST_SKIP_KEY);
  } catch {
    /* ignore */
  }
}

function isWeightToastSkipped() {
  try {
    return localStorage.getItem(WEIGHT_TOAST_SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * טוסט אחרי תור כשהמשקלים השתנו — עם «אל תציג שוב»
 */
export function showWeightUpdateToastIfNeeded(deltas, featureLabels, turn) {
  if (!deltas?.length || isWeightToastSkipped()) return;
  const host = document.getElementById("weight-toast-host");
  if (!host) return;

  host.innerHTML = "";
  const el = document.createElement("div");
  el.className = "weight-info-toast";
  el.setAttribute("role", "status");

  const lines = deltas.map((d) => {
    const name = featureLabels[d.i] ?? `w${d.i + 1}`;
    return `w${d.i + 1} (${name}): ${formatNum(d.old)} → ${formatNum(d.new)} (${d.delta >= 0 ? "+" : ""}${formatNum(d.delta)})`;
  });

  el.innerHTML = `
    <div class="weight-info-toast__head">
      <span class="weight-info-toast__title">📊 עדכון משקלים · תור ${turn}</span>
      <button type="button" class="weight-info-toast__close" aria-label="סגור">×</button>
    </div>
    <pre class="weight-info-toast__body">${lines.map(esc).join("\n")}</pre>
    <label class="weight-info-toast__skip">
      <input type="checkbox" id="weight-toast-skip-cb" />
      אל תציג את החלון הזה שוב (עדכוני משקלים)
    </label>
  `;

  const close = () => {
    el.remove();
    if (!host.querySelector(".weight-info-toast")) host.innerHTML = "";
  };

  el.querySelector(".weight-info-toast__close")?.addEventListener("click", close);
  el.querySelector("#weight-toast-skip-cb")?.addEventListener("change", (e) => {
    if (e.target.checked) {
      try {
        localStorage.setItem(WEIGHT_TOAST_SKIP_KEY, "1");
      } catch {
        /* ignore */
      }
      close();
    }
  });

  host.appendChild(el);
  const t = setTimeout(close, 14000);
  el.addEventListener("mouseenter", () => clearTimeout(t));
}
