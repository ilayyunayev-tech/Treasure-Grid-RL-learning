import { DIR_ORDER } from "./config.js";

const KEY_MAP = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  w: "UP",
  W: "UP",
  s: "DOWN",
  S: "DOWN",
  a: "LEFT",
  A: "LEFT",
  d: "RIGHT",
  D: "RIGHT",
};

export function bindInput(onDirection, isEnabled) {
  const handler = (e) => {
    if (!isEnabled()) return;
    const dir = KEY_MAP[e.key];
    if (dir && DIR_ORDER.includes(dir)) {
      e.preventDefault();
      onDirection(dir);
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}

export function wireDirectionButtons(container, onDirection, isEnabled) {
  if (!container) return;
  container.querySelectorAll("[data-dir]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isEnabled()) return;
      onDirection(btn.getAttribute("data-dir"));
    });
  });
}
