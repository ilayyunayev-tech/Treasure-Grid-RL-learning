import { LEARNING_RATE } from "./config.js";

/**
 * w_new = w_old + α × error × feature
 * α = alphaReward כשטעות > 0 (תגמול יחסי לחיזוי), alphaPenalty כשטעות < 0 (עונש)
 */
export function updateWeights(weights, features, error, opts = {}) {
  const alphaReward = opts.alphaReward ?? opts.alpha ?? LEARNING_RATE;
  const alphaPenalty = opts.alphaPenalty ?? opts.alpha ?? LEARNING_RATE;
  const alpha =
    error > 0 ? alphaReward : error < 0 ? alphaPenalty : alphaReward;

  const next = [...weights];
  const deltas = [];
  for (let i = 0; i < weights.length; i++) {
    const old = next[i];
    const delta = alpha * error * features[i];
    next[i] = old + delta;
    if (Math.abs(delta) > 1e-8) {
      deltas.push({
        i,
        old,
        new: next[i],
        delta,
      });
    }
  }
  return { weights: next, deltas };
}
