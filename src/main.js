// Startup: wait for WhatsApp Web to finish loading, log a diagnostic and mount the panel.
(() => {
  const WAAS = window.WAAS;
  if (!WAAS || WAAS._started) return;
  WAAS._started = true;

  async function waitForWA(maxMs = 180000) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      try {
        if (WAAS.wa.hasLoader()) {
          const CC = WAAS.wa.ns("WAWebChatCollection");
          if (CC && CC.ChatCollection) return Date.now() - t0;
        }
      } catch (e) { /* still loading */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("WhatsApp Web did not finish loading within 3 minutes (logged out, or its code changed?)");
  }

  (async () => {
    try {
      WAAS.mountUI(); // mounted even if WA is not ready, so the log can still be saved
    } catch (e) {
      WAAS.error("ui:mount-error", e);
    }
    try {
      const ms = await waitForWA();
      WAAS.info("wa:ready", { ms });
      // The account's options (AB props) arrive a few seconds after the UI loads.
      await new Promise((r) => setTimeout(r, 8000));
      await WAAS.wa.diagnose();
    } catch (e) {
      WAAS.error("wa:not-ready", e);
    }
  })();
})();
