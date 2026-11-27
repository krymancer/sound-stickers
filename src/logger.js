// Event and error log (runs in the page's main world).
// Each entry is kept in memory and sent to bridge.js, which persists it in chrome.storage.
(() => {
  const WAAS = (window.WAAS = window.WAAS || {});
  if (WAAS.log) return;

  WAAS.VERSION = "1.0.0";
  WAAS.sessionId = Math.random().toString(36).slice(2, 10);
  WAAS.entries = [];
  WAAS.activeRun = null; // id of the running operation (create/send)
  const MAX_MEM = 3000;
  const listeners = new Set();

  function maskIds(s) {
    // Hide long numbers (phone numbers, group ids), keeping the last 3 digits.
    return s.replace(/\d{7,}/g, (m) => "…" + m.slice(-3));
  }

  function sanitize(value, depth = 0) {
    if (value == null) return value;
    if (depth > 4) return "[max depth]";
    if (value instanceof Error || (value && typeof value === "object" && "stack" in value && "message" in value)) {
      return { name: value.name, message: maskIds(String(value.message)), stack: maskIds(String(value.stack || "")).slice(0, 4000) };
    }
    if (typeof Blob !== "undefined" && value instanceof Blob) return { blob: true, size: value.size, type: value.type };
    if (value instanceof ArrayBuffer) return { arrayBuffer: value.byteLength };
    if (ArrayBuffer.isView(value)) return { bytes: value.byteLength };
    if (typeof value === "string") return maskIds(value.length > 3000 ? value.slice(0, 3000) + "…" : value);
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "bigint") return String(value);
    if (typeof value === "function") return "[function " + (value.name || "anonymous") + "]";
    if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
    if (typeof value === "object") {
      const out = {};
      let n = 0;
      for (const k of Object.keys(value)) {
        if (n++ > 60) { out["…"] = "more keys omitted"; break; }
        try { out[k] = sanitize(value[k], depth + 1); } catch (e) { out[k] = "[unreadable]"; }
      }
      return out;
    }
    return String(value);
  }

  function log(level, event, data) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      event,
      run: WAAS.activeRun,
      session: WAAS.sessionId,
      data: sanitize(data),
    };
    WAAS.entries.push(entry);
    if (WAAS.entries.length > MAX_MEM) WAAS.entries.splice(0, WAAS.entries.length - MAX_MEM);
    try { window.postMessage({ __waas: "log", entry }, location.origin); } catch (e) { /* no bridge */ }
    // console.debug only: console.warn/error would show up on chrome://extensions as if the
    // extension itself had crashed. The level is preserved in the log.
    console.debug("[sound-stickers]", level, event, entry.data ?? "");
    for (const l of listeners) { try { l(entry); } catch (e) { /* ignore */ } }
    return entry;
  }

  WAAS.log = log;
  WAAS.info = (event, data) => log("info", event, data);
  WAAS.warn = (event, data) => log("warn", event, data);
  WAAS.error = (event, data) => log("error", event, data);
  WAAS.onLog = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  WAAS.maskIds = maskIds;

  // Runs fn inside an "operation" with its own id; logs start, end, duration and error.
  WAAS.run = async function (name, fn) {
    const prev = WAAS.activeRun;
    const id = name + "-" + Date.now().toString(36);
    WAAS.activeRun = id;
    const t0 = performance.now();
    log("info", name + ":start", null);
    try {
      const r = await fn();
      log("info", name + ":end", { ms: Math.round(performance.now() - t0) });
      return r;
    } catch (err) {
      log("error", name + ":error", { ms: Math.round(performance.now() - t0), error: err });
      throw err;
    } finally {
      WAAS.activeRun = prev;
    }
  };

  // Global errors: logged when they come from the extension or an operation is running.
  const EXT_MARK = "chrome-extension://";
  window.addEventListener("error", (ev) => {
    const stack = (ev.error && ev.error.stack) || "";
    const fromExt = (ev.filename || "").startsWith(EXT_MARK) || stack.includes(EXT_MARK);
    if (!fromExt && !WAAS.activeRun) return;
    log("error", fromExt ? "global-error-extension" : "global-error-page", {
      message: ev.message, file: ev.filename, line: ev.lineno, col: ev.colno, error: ev.error,
    });
  }, true);
  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason;
    const stack = (r && r.stack) || "";
    const fromExt = stack.includes(EXT_MARK);
    if (!fromExt && !WAAS.activeRun) return;
    log("error", fromExt ? "unhandled-rejection-extension" : "unhandled-rejection-page", { reason: r });
  });

  // Requests the full persisted log (via the bridge). Resolves null if there is no answer.
  WAAS.getStoredLog = function () {
    return new Promise((resolve) => {
      const reqId = Math.random().toString(36).slice(2);
      const timer = setTimeout(() => { window.removeEventListener("message", onMsg); resolve(null); }, 3000);
      function onMsg(ev) {
        const d = ev.data;
        if (ev.source !== window || !d || d.__waas !== "logResponse" || d.reqId !== reqId) return;
        clearTimeout(timer);
        window.removeEventListener("message", onMsg);
        resolve(d.log || []);
      }
      window.addEventListener("message", onMsg);
      window.postMessage({ __waas: "getLog", reqId }, location.origin);
    });
  };

  log("info", "logger:ready", { version: WAAS.VERSION, url: location.href, ua: navigator.userAgent });
})();
