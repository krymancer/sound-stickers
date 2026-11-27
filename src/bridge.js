// Bridge (extension isolated world):
// - persists the log in chrome.storage.local (survives reloads, visible on the log page);
// - forwards the "toggle panel" command (extension button) to the page and notifies the background.
(() => {
  const MAX_ENTRIES = 5000;
  let queue = [];
  let timer = null;
  let writing = Promise.resolve();

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    const batch = queue;
    queue = [];
    if (!batch.length) return writing;
    writing = writing.then(() => new Promise((resolve) => {
      chrome.storage.local.get({ log: [] }, (res) => {
        let log = (res.log || []).concat(batch);
        if (log.length > MAX_ENTRIES) log = log.slice(log.length - MAX_ENTRIES);
        chrome.storage.local.set({ log }, resolve);
      });
    }));
    return writing;
  }

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || typeof d !== "object") return;
    if (d.__waas === "log" && d.entry) {
      queue.push(d.entry);
      if (!timer) timer = setTimeout(flush, 400);
    } else if (d.__waas === "getLog") {
      flush().then(() => {
        chrome.storage.local.get({ log: [] }, (res) => {
          window.postMessage({ __waas: "logResponse", reqId: d.reqId, log: res.log || [] }, location.origin);
        });
      });
    } else if (d.__waas === "clearLog") {
      queue = [];
      writing = writing.then(() => new Promise((r) => chrome.storage.local.set({ log: [] }, r)));
    } else if (d.__waas === "openLog") {
      chrome.runtime.sendMessage({ waas: "openLog" }).catch(() => {});
    } else if (d.__waas === "uiReady") {
      chrome.runtime.sendMessage({ waas: "pageReady" }).catch(() => {});
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.waas === "togglePanel") window.postMessage({ __waas: "togglePanel" }, location.origin);
  });

  window.addEventListener("pagehide", () => { flush(); });
})();
