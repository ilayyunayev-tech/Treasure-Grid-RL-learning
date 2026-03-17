/**
 * כל שגיאה בדפדפן מוצגת בטוסט — כולל קובץ ושורה (כשזמין).
 */

const CONTAINER_ID = "error-toast-root";

function ensureContainer() {
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = CONTAINER_ID;
    el.className = "error-toast-container";
    el.setAttribute("aria-live", "assertive");
    document.body.appendChild(el);
  }
  return el;
}

function shortPath(urlOrPath) {
  if (!urlOrPath || urlOrPath === "(לא ידוע)") return urlOrPath;
  try {
    const u = new URL(urlOrPath, window.location.origin);
    const path = u.pathname || urlOrPath;
    const base = window.location.pathname.replace(/\/[^/]*$/, "/") || "/";
    if (path.startsWith(base)) return path.slice(base.length) || path;
    return path.replace(/^\//, "");
  } catch {
    return urlOrPath.replace(/^.*\/([^/]+\/[^/]+\.js).*$/, "$1");
  }
}

/** מחלץ קובץ:שורה מהמחסנית הראשונה שנראית כמו קוד המשחק */
function parseStackLocation(stack) {
  if (!stack || typeof stack !== "string") return null;
  const lines = stack.split("\n");
  const re =
    /(?:at\s+)?(?:.*?\s+)?\(?(?:https?:\/\/[^/]+)?(\/?[^\s):]+\.(?:js|mjs))(?:\?[^):]*)?:(\d+)(?::(\d+))?\)?/;
  for (const line of lines) {
    const m = line.match(re);
    if (m) {
      return { file: shortPath(m[1]), line: m[2], col: m[3] || "" };
    }
  }
  return null;
}

export function reportCaughtError(err, title = "שגיאה") {
  const e = err instanceof Error ? err : new Error(String(err));
  const fromStack = e.stack ? parseStackLocation(e.stack) : null;
  showErrorToast({
    title,
    message: e.message || String(err),
    file: fromStack?.file || "(לא ידוע)",
    line: fromStack?.line ?? "?",
    col: fromStack?.col || "",
    stack: e.stack || "",
  });
}

function showErrorToast({ title, message, file, line, col, stack }) {
  const container = ensureContainer();
  const toast = document.createElement("div");
  toast.className = "error-toast";
  toast.setAttribute("role", "alert");

  const loc =
    file && file !== "(לא ידוע)"
      ? `${file}:${line ?? "?"}${col ? `:${col}` : ""}`
      : null;

  toast.innerHTML = `
    <div class="error-toast-head">
      <span class="error-toast-title">${escapeHtml(title)}</span>
      <button type="button" class="error-toast-close" aria-label="סגור">×</button>
    </div>
    <pre class="error-toast-msg">${escapeHtml(message)}</pre>
    ${loc ? `<div class="error-toast-loc"><strong>מיקום:</strong> ${escapeHtml(loc)}</div>` : ""}
    ${stack ? `<details class="error-toast-stack"><summary>מחסנית</summary><pre>${escapeHtml(stack)}</pre></details>` : ""}
  `;

  toast.querySelector(".error-toast-close")?.addEventListener("click", () => {
    toast.remove();
  });

  container.appendChild(toast);

  const t = setTimeout(() => {
    toast.classList.add("error-toast-fade");
    setTimeout(() => toast.remove(), 400);
  }, 25000);
  toast.addEventListener("mouseenter", () => clearTimeout(t));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function installErrorToasts() {
  window.addEventListener(
    "error",
    (event) => {
      const msg =
        event.message ||
        (event.error && event.error.message) ||
        String(event.error || "שגיאה לא ידועה");
      let file = event.filename || "(לא ידוע)";
      let line = event.lineno;
      let col = event.colno;
      if (event.error && event.error.stack) {
        const fromStack = parseStackLocation(event.error.stack);
        if (fromStack && (!line || file === "(לא ידוע)")) {
          file = fromStack.file;
          line = fromStack.line;
          col = fromStack.col || col;
        }
      }
      file = shortPath(file);
      showErrorToast({
        title: "שגיאת JavaScript",
        message: msg,
        file,
        line: line ?? "?",
        col: col != null ? String(col) : "",
        stack: event.error?.stack || "",
      });
    },
    true
  );

  window.addEventListener("unhandledrejection", (event) => {
    const r = event.reason;
    const err = r instanceof Error ? r : new Error(String(r));
    const fromStack = err.stack ? parseStackLocation(err.stack) : null;
    const file = fromStack?.file || "(לא ידוע)";
    const line = fromStack?.line ?? "?";
    const col = fromStack?.col || "";
    showErrorToast({
      title: "הבטחה נדחתה (Unhandled Rejection)",
      message: err.message || String(r),
      file,
      line,
      col,
      stack: err.stack || "",
    });
  });
}

installErrorToasts();
