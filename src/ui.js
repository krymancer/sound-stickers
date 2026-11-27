// UI: a Shadow DOM panel opened from the extension button.
// Three tabs, each with its own form: video with its own sound, image + audio, and video/GIF + other audio.
// No innerHTML (WhatsApp Web enforces Trusted Types): every node is built with createElement.
(() => {
  const WAAS = (window.WAAS = window.WAAS || {});
  const log = (lvl, ev, data) => WAAS.log(lvl, ev, data);
  const FRAME = 1 / 30;     // fine-adjust step
  const MIN_LEN = 0.3;      // minimum clip length
  const DEFAULT_LEN = 10;   // initial clip length when a file is opened

  // Design tokens follow shadcn/ui's zinc palette (Tailwind gray scale).
  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: "Inter", "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .overlay { position: fixed; inset: 0; z-index: 2147483001; background: rgb(0 0 0 / .55); backdrop-filter: blur(4px);
             display: flex; align-items: center; justify-content: center; padding: 16px; }
  .panel {
    --background:#ffffff; --foreground:#09090b; --muted:#f4f4f5; --muted-foreground:#71717a; --border:#e4e4e7; --input:#e4e4e7;
    --primary:#18181b; --primary-foreground:#fafafa; --accent:#f4f4f5; --ring:#a1a1aa; --destructive:#dc2626;
    --ok:#16a34a; --ok-bg:rgb(34 197 94 / .14); --warn:#d97706; --warn-bg:rgb(245 158 11 / .14);
    --check-a:#f4f4f5; --check-b:#e4e4e7;
    width: min(720px, 100%); max-height: calc(100vh - 32px); overflow: auto; background: var(--background); color: var(--foreground);
    border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 25px 50px -12px rgb(0 0 0 / .35);
    font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  .panel.dark {
    --background:#09090b; --foreground:#fafafa; --muted:#27272a; --muted-foreground:#a1a1aa; --border:#27272a; --input:#3f3f46;
    --primary:#fafafa; --primary-foreground:#18181b; --accent:#27272a; --ring:#71717a; --destructive:#f87171;
    --ok:#4ade80; --ok-bg:rgb(34 197 94 / .16); --warn:#fbbf24; --warn-bg:rgb(245 158 11 / .16);
    --check-a:#18181b; --check-b:#27272a; }
  .panel::-webkit-scrollbar { width: 10px; } .panel::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; border: 3px solid var(--background); }

  header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 12px;
           padding: 16px 20px; background: var(--background); border-bottom: 1px solid var(--border); }
  .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .logo { flex: none; width: 36px; height: 36px; border-radius: 8px; background: var(--primary); color: var(--primary-foreground);
          display: inline-flex; align-items: center; justify-content: center; }
  h2 { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -.01em; }
  .hdr-r { display: flex; align-items: center; gap: 8px; flex: none; }
  .badge { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 999px; border: 1px solid var(--border);
           font-size: 11.5px; font-weight: 500; color: var(--muted-foreground); font-variant-numeric: tabular-nums; }
  .body { padding: 16px 20px 20px; }
  footer { padding: 12px 20px; border-top: 1px solid var(--border); color: var(--muted-foreground); font-size: 12px; }

  .muted { color: var(--muted-foreground); font-size: 13px; }
  .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; padding: 4px; border-radius: 8px; background: var(--muted); }
  .tabs button { height: 32px; border: none; border-radius: 6px; background: transparent; color: var(--muted-foreground); font-size: 13px; font-weight: 500;
                 transition: background .15s, color .15s, box-shadow .15s; }
  .tabs button:hover:not(:disabled) { color: var(--foreground); }
  .tabs button.on { background: var(--background); color: var(--foreground); box-shadow: 0 1px 3px rgb(0 0 0 / .1), 0 1px 2px rgb(0 0 0 / .06); }
  .tabdesc { margin: 12px 2px 0; }

  section { border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin: 12px 0; background: var(--background); transition: opacity .15s; }
  section.off { opacity: .5; pointer-events: none; }
  h3 { margin: 0 0 12px; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 10px; letter-spacing: -.01em; }
  h3 .n { display: inline-flex; width: 22px; height: 22px; border-radius: 999px; background: var(--muted); border: 1px solid var(--border);
          align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--foreground); font-variant-numeric: tabular-nums; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
  .grow { flex: 1; }
  .label { font-size: 13px; font-weight: 500; }

  button { font: inherit; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; pointer-events: none; }
  button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; border-radius: 6px;
         font-weight: 500; border: 1px solid transparent; transition: background .15s, opacity .15s, border-color .15s; }
  .btn svg { flex: none; }
  .act { height: 36px; padding: 0 16px; font-size: 14px; background: var(--primary); color: var(--primary-foreground); }
  .act:hover { opacity: .9; }
  .sec { height: 32px; padding: 0 12px; font-size: 13px; border-color: var(--input); background: var(--background); color: var(--foreground);
         box-shadow: 0 1px 2px rgb(0 0 0 / .04); }
  .sec:hover { background: var(--accent); }
  .icon { width: 32px; padding: 0; }
  .ghost { width: 32px; height: 32px; padding: 0; background: transparent; color: var(--muted-foreground); border: none; }
  .ghost:hover { background: var(--accent); color: var(--foreground); }

  input[type=text], input[type=number], select { height: 32px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--input);
         background: transparent; color: var(--foreground); font: inherit; font-size: 13px; transition: border-color .15s, box-shadow .15s; }
  input[type=text] { width: 100%; max-width: 260px; }
  input[type=number] { width: 84px; font-variant-numeric: tabular-nums; }
  select { max-width: 100%; padding-right: 6px; }
  select option { background: var(--background); color: var(--foreground); }
  input:focus, select:focus { outline: none; border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 25%, transparent); }
  input::placeholder { color: var(--muted-foreground); }
  input[type=checkbox] { width: 16px; height: 16px; margin: 2px 0 0; accent-color: var(--primary); flex: none; }
  .meta { display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; align-items: center; margin: 8px 0 14px; }
  label.chk { display: flex; gap: 10px; align-items: flex-start; margin: 8px 0; font-size: 13px; }

  video { display: block; width: 100%; max-height: 260px; background: #000; border-radius: 8px; }
  .thumb { width: 156px; height: 156px; object-fit: contain; border-radius: 8px; border: 1px solid var(--border);
           background: repeating-conic-gradient(var(--check-a) 0 25%, var(--check-b) 0 50%) 50% / 16px 16px; }
  .track { position: relative; height: 36px; margin: 14px 8px 6px; background: var(--muted); border: 1px solid var(--border); border-radius: 6px;
           cursor: pointer; touch-action: none; user-select: none; }
  .track.audio { height: 52px; }
  .track canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .track .sel { position: absolute; top: -1px; bottom: -1px; background: color-mix(in srgb, var(--primary) 12%, transparent);
                border-top: 2px solid var(--primary); border-bottom: 2px solid var(--primary); pointer-events: none; }
  .track .handle { position: absolute; top: -6px; bottom: -6px; width: 12px; margin-left: -6px; background: var(--primary); border-radius: 4px;
                   cursor: ew-resize; box-shadow: 0 1px 3px rgb(0 0 0 / .25); }
  .track .handle::after { content: ""; position: absolute; left: 3px; top: 35%; bottom: 35%; width: 4px;
                          border-left: 1px solid var(--primary-foreground); border-right: 1px solid var(--primary-foreground); opacity: .8; }
  .track .ph { position: absolute; top: -8px; bottom: -8px; width: 2px; margin-left: -1px; background: var(--destructive); border-radius: 2px; pointer-events: none; }
  .times { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--muted-foreground); margin: 0 8px; font-variant-numeric: tabular-nums; }
  .trim { display: grid; grid-template-columns: auto auto 1fr; gap: 8px 12px; align-items: center; margin-top: 4px; }
  .seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 8px; background: var(--muted); }
  .seg button { height: 28px; border: none; border-radius: 6px; padding: 0 12px; background: transparent; color: var(--muted-foreground); font-size: 13px; font-weight: 500; }
  .seg button.on { background: var(--background); color: var(--foreground); box-shadow: 0 1px 2px rgb(0 0 0 / .1); }
  .summary { background: var(--muted); border-radius: 8px; padding: 10px 12px; margin: 8px 0; font-size: 13px; }

  table.grid { border-collapse: separate; border-spacing: 3px; margin: 8px 0; font-size: 12px; font-variant-numeric: tabular-nums; }
  table.grid th { color: var(--muted-foreground); font-weight: 500; padding: 2px 4px; text-align: center; }
  table.grid th.side { text-align: right; }
  table.grid td button { width: 52px; height: 28px; padding: 0; border-radius: 6px; border: 1px solid transparent; font-size: 12px; background: transparent; color: var(--muted-foreground); }
  table.grid td button.ok { background: var(--ok-bg); color: var(--foreground); }
  table.grid td button.low { background: var(--warn-bg); color: var(--foreground); }
  table.grid td button.ok:hover, table.grid td button.low:hover { border-color: var(--ring); }
  table.grid td button.no, table.grid td button.out { opacity: .55; }
  table.grid td button.sel { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); font-weight: 600; }
  .legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--muted-foreground); }
  .legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -2px; margin-right: 6px; }

  .callout { border-radius: 8px; padding: 8px 12px; font-size: 13px; border: 1px solid color-mix(in srgb, var(--warn) 35%, transparent);
             background: var(--warn-bg); color: var(--foreground); margin: 8px 0; }
  .bar { height: 6px; background: var(--muted); border-radius: 999px; overflow: hidden; margin-top: 10px; }
  .bar > div { height: 100%; width: 0; background: var(--primary); border-radius: 999px; transition: width .2s; }
  .status { font-size: 13px; margin: 8px 0 0; min-height: 20px; color: var(--muted-foreground); }
  .status.err { color: var(--destructive); font-weight: 500; }
  .result { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-top: 12px; padding: 12px; border-radius: 8px; background: var(--muted); }
  .result audio { height: 36px; max-width: 100%; }
  .divider { height: 1px; background: var(--border); margin: 14px 0; }
  details { margin-top: 12px; }
  summary { cursor: pointer; color: var(--muted-foreground); font-size: 13px; font-weight: 500; border-radius: 4px; }
  summary:hover { color: var(--foreground); }
  .logbox { max-height: 160px; overflow: auto; font: 11px/1.45 ui-monospace, "JetBrains Mono", Consolas, monospace; background: var(--muted);
            border: 1px solid var(--border); padding: 8px 10px; border-radius: 8px; white-space: pre-wrap; margin-top: 8px; }
  .logbox .e { color: var(--destructive); } .logbox .w { color: var(--warn); }
  `;

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (k === "class") el.className = v;
        else if (k === "style") el.style.cssText = v;
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else if (k in el) el[k] = v;
        else el.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }

  // Lucide-style stroke icons, built with createElementNS (no innerHTML).
  const ICONS = {
    play: ["M6 3l14 9-14 9V3z"],
    x: ["M18 6 6 18", "m6 6 12 12"],
    upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
    download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
    send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
    sound: ["M11 5 6 9H2v6h4l5 4V5z", "M15.54 8.46a5 5 0 0 1 0 7.07", "M19.07 4.93a10 10 0 0 1 0 14.14"],
    sparkles: ["M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z"],
    grid: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
    minus: ["M5 12h14"],
    plus: ["M5 12h14", "M12 5v14"],
    pin: ["M12 2v20", "M8 6l4-4 4 4"],
  };
  function icon(name, size = 16) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    for (const [k, v] of Object.entries({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(k, v);
    for (const d of ICONS[name] || []) { const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); svg.append(p); }
    return svg;
  }
  // Button with an optional leading icon. variant: "act" (primary) | "sec" (outline) | "ghost".
  function btn(label, { variant = "sec", ico, ...props } = {}) {
    return h("button", { class: "btn " + variant + (props.class ? " " + props.class : ""), ...Object.fromEntries(Object.entries(props).filter(([k]) => k !== "class")) },
      ico ? icon(ico, variant === "act" ? 16 : 14) : null, label != null ? h("span", null, label) : null);
  }
  // Updates a button's text, leaving its icon in place.
  const setLabel = (b, txt) => { const s = b.querySelector("span"); if (s) s.textContent = txt; else b.textContent = txt; };

  function attachStyles(root) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      root.adoptedStyleSheets = [sheet];
    } catch (e) {
      log("warn", "ui:styles-fallback", e);
      root.append(h("style", { textContent: CSS }));
    }
  }

  function download(blob, name) {
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  async function saveLog() {
    const stored = await WAAS.getStoredLog();
    const entries = stored && stored.length ? stored : WAAS.entries;
    const content = JSON.stringify({ exported: new Date().toISOString(), version: WAAS.VERSION, ua: navigator.userAgent, entries }, null, 1);
    const blob = new Blob([content], { type: "application/json" });
    const name = "sound-stickers-log-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".json";
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "JSON log", accept: { "application/json": [".json"] } }] });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        log("info", "log:saved", { name: handle.name, entries: entries.length });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
        log("warn", "log:picker-failed", e);
      }
    }
    download(blob, name);
    log("info", "log:downloaded", { name, entries: entries.length });
  }
  WAAS.saveLog = saveLog;

  const fmtT = (t) => (t >= 60 ? Math.floor(t / 60) + ":" + (t % 60).toFixed(2).padStart(5, "0") : t.toFixed(2) + " s");
  const fmtB = (b) => (b >= 1e6 ? (b / 1e6).toFixed(2) + " MB" : Math.round(b / 1000) + " KB");
  const isDark = () => {
    try {
      return document.body.classList.contains("dark") || document.documentElement.classList.contains("dark") ||
        matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) { return false; }
  };
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* no storage */ } },
  };
  const baseName = (f) => (f && f.name.replace(/\.[^.]+$/, "")) || "sticker";

  function mount() {
    if (document.getElementById("sound-stickers-root")) return;
    const host = h("div", { id: "sound-stickers-root" });
    document.body.append(host);
    const root = host.attachShadow({ mode: "open" });
    attachStyles(root);

    // Shared state: only one operation at a time across the whole panel.
    const G = { busy: false, forms: [], refreshTabs: () => {} };
    const setBusy = (b) => { G.busy = b; G.forms.forEach((f) => f.refresh()); G.refreshTabs(); };
    const run = async (name, fn) => {
      const ac = new AbortController();
      G.abort = ac;
      setBusy(true);
      try { return await WAAS.run(name, () => fn(ac.signal)); } finally { G.abort = null; setBusy(false); }
    };

    // ============================================================ timeline with handles
    // kind "video": shows the video and jumps to the frame under the handles.
    // kind "audio": shows the waveform; the player stays hidden.
    function makeTrimmer(kind, hint) {
      const isVideo = kind === "video";
      const media = isVideo ? h("video", { playsInline: true, preload: "auto" }) : h("audio", { preload: "auto" });
      const wave = isVideo ? null : h("canvas");
      const selBar = h("div", { class: "sel" });
      const hS = h("div", { class: "handle", title: "Clip start (drag)" });
      const hE = h("div", { class: "handle", title: "Clip end (drag)" });
      const ph = h("div", { class: "ph" });
      const track = h("div", { class: "track" + (isVideo ? "" : " audio"), title: "Click or drag to scrub" }, wave, selBar, ph, hS, hE);
      const tLeft = h("span"), tRight = h("span");
      const playSegBtn = btn("Play clip", { ico: "play" });
      const playCurBtn = btn("From cursor", { ico: "play" });
      const playEndBtn = btn("Clip ending", { ico: "play" });
      const curLbl = h("span", { class: "muted grow", style: "text-align:right;font-variant-numeric:tabular-nums" });
      const startNum = h("input", { type: "number", min: 0, step: 0.01 });
      const endNum = h("input", { type: "number", min: 0, step: 0.01 });
      const startCur = btn("Set to cursor", { title: "Use the cursor position as the start" });
      const endCur = btn("Set to cursor", { title: "Use the cursor position as the end" });
      const lenLbl = h("span", { class: "muted", style: "font-variant-numeric:tabular-nums" });
      const t = { start: 0, end: 0, playhead: 0, stopAt: null, dur: 0, offset: 0, url: null, peaks: null, peakMax: 1, muted: false };
      const listeners = new Set();
      const emit = () => listeners.forEach((fn) => fn());
      const mkStep = (ico, title, fn) => btn(null, { ico, class: "icon", title, onclick: fn });
      const el = h("div", null,
        isVideo ? media : null, track, h("div", { class: "times" }, tLeft, tRight),
        h("div", { class: "row" }, playSegBtn, playCurBtn, playEndBtn, curLbl),
        h("div", { class: "trim" },
          h("span", { class: "label" }, "Start"),
          h("span", { class: "row", style: "margin:0" }, mkStep("minus", "One frame earlier", () => setStart(t.start - FRAME)), startNum, mkStep("plus", "One frame later", () => setStart(t.start + FRAME))),
          h("span", { class: "row", style: "margin:0" }, startCur),
          h("span", { class: "label" }, "End"),
          h("span", { class: "row", style: "margin:0" }, mkStep("minus", "One frame earlier", () => setEnd(t.end - FRAME)), endNum, mkStep("plus", "One frame later", () => setEnd(t.end + FRAME))),
          h("span", { class: "row", style: "margin:0" }, endCur, lenLbl)),
        hint ? h("div", { class: "muted", style: "margin-top:10px" }, hint) : null);

      const layout = () => {
        const d = t.dur || 1;
        const pct = (x) => Math.max(0, Math.min(100, (x / d) * 100)) + "%";
        selBar.style.left = pct(t.start);
        selBar.style.width = Math.max(0, ((t.end - t.start) / d) * 100) + "%";
        hS.style.left = pct(t.start);
        hE.style.left = pct(t.end);
        ph.style.left = pct(t.playhead);
        tLeft.textContent = "0 s";
        tRight.textContent = fmtT(t.dur);
        curLbl.textContent = "Cursor " + fmtT(t.playhead);
        if (root.activeElement !== startNum) startNum.value = t.start.toFixed(2);
        if (root.activeElement !== endNum) endNum.value = t.end.toFixed(2);
        lenLbl.textContent = "Length " + fmtT(t.end - t.start);
      };

      const drawWave = () => {
        if (!wave) return;
        const w = track.clientWidth, hh = track.clientHeight;
        if (!w) return;
        const dpr = window.devicePixelRatio || 1;
        wave.width = Math.round(w * dpr); wave.height = Math.round(hh * dpr);
        const ctx = wave.getContext("2d");
        ctx.clearRect(0, 0, wave.width, wave.height);
        if (!t.peaks) return;
        ctx.fillStyle = getComputedStyle(track).getPropertyValue("--muted-foreground").trim() || "#71717a";
        const n = t.peaks.length, cols = wave.width, mid = wave.height / 2, norm = 1 / (t.peakMax || 1);
        for (let x = 0; x < cols; x++) {
          const a = Math.floor((x / cols) * n), b = Math.max(a + 1, Math.floor(((x + 1) / cols) * n));
          let p = 0;
          for (let i = a; i < b && i < n; i++) if (t.peaks[i] > p) p = t.peaks[i];
          const hgt = Math.max(1, p * norm * (wave.height - 6));
          ctx.fillRect(x, mid - hgt / 2, 1, hgt);
        }
      };
      if (wave && typeof ResizeObserver !== "undefined") new ResizeObserver(drawWave).observe(track);

      // Chained seeks: the next one is requested once the previous finished (smooth dragging).
      let seeking = false, pendingSeek = null;
      const seekTo = (x) => { pendingSeek = x; if (!seeking) doSeek(); };
      const doSeek = () => {
        if (pendingSeek == null) return;
        const x = pendingSeek; pendingSeek = null; seeking = true;
        t.playhead = x;
        media.currentTime = t.offset + x;
        layout();
      };
      media.addEventListener("seeked", () => { seeking = false; if (pendingSeek != null) doSeek(); });

      const changed = () => { layout(); emit(); };
      const setStart = (x, seek = true) => {
        if (!t.dur) return;
        t.start = Math.max(0, Math.min(x, t.end - MIN_LEN));
        changed();
        if (seek) { stop(); seekTo(t.start); }
      };
      const setEnd = (x, seek = true) => {
        if (!t.dur) return;
        t.end = Math.min(t.dur, Math.max(x, t.start + MIN_LEN));
        changed();
        if (seek) { stop(); seekTo(Math.max(t.start, t.end - FRAME)); }
      };

      const tAt = (ev) => {
        const r = track.getBoundingClientRect();
        return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * t.dur;
      };
      let drag = null;
      track.addEventListener("pointerdown", (ev) => {
        if (!t.dur || G.busy) return;
        drag = ev.target === hS ? "s" : ev.target === hE ? "e" : "p";
        track.setPointerCapture(ev.pointerId);
        stop();
        applyDrag(ev);
      });
      track.addEventListener("pointermove", (ev) => { if (drag) applyDrag(ev); });
      const endDrag = () => { drag = null; };
      track.addEventListener("pointerup", endDrag);
      track.addEventListener("pointercancel", endDrag);
      const applyDrag = (ev) => {
        const x = tAt(ev);
        if (drag === "s") setStart(x);
        else if (drag === "e") setEnd(x);
        else seekTo(x);
      };
      startNum.addEventListener("change", () => setStart(+startNum.value || 0));
      endNum.addEventListener("change", () => setEnd(+endNum.value || 0));
      startCur.addEventListener("click", () => setStart(t.playhead));
      endCur.addEventListener("click", () => setEnd(t.playhead));

      let raf = 0;
      const tick = () => {
        t.playhead = Math.max(0, media.currentTime - t.offset);
        layout();
        if (t.stopAt != null && media.currentTime >= t.offset + t.stopAt) { stop(); return; }
        if (!media.paused) raf = requestAnimationFrame(tick);
      };
      function stop() {
        cancelAnimationFrame(raf);
        if (!media.paused) media.pause();
        t.stopAt = null;
      }
      const play = (from, to, muted = t.muted) => {
        stop();
        t.stopAt = to;
        media.muted = muted;
        seeking = false; pendingSeek = null;
        media.currentTime = t.offset + from;
        return media.play().then(() => { raf = requestAnimationFrame(tick); }).catch((e) => log("warn", "ui:play", e));
      };
      const toggleRange = (from, to) => { if (!media.paused) stop(); else play(from, to); };
      playSegBtn.addEventListener("click", () => toggleRange(t.start, t.end));
      playCurBtn.addEventListener("click", () => toggleRange(t.playhead >= t.start && t.playhead < t.end - 0.1 ? t.playhead : t.start, t.end));
      playEndBtn.addEventListener("click", () => toggleRange(Math.max(t.start, t.end - 2), t.end));

      const load = (file, { duration, offset = 0, peaks = null, peakMax = 1 }) => {
        stop();
        if (t.url) URL.revokeObjectURL(t.url);
        t.url = URL.createObjectURL(file);
        Object.assign(t, { dur: duration, offset, start: 0, end: Math.min(duration, DEFAULT_LEN), playhead: 0, peaks, peakMax });
        media.addEventListener("loadeddata", () => seekTo(0), { once: true });
        media.src = t.url;
        changed();
        requestAnimationFrame(drawWave);
      };
      const clear = () => {
        stop();
        if (t.url) URL.revokeObjectURL(t.url);
        t.url = null;
        media.removeAttribute("src");
        Object.assign(t, { dur: 0, start: 0, end: 0, playhead: 0, peaks: null });
        changed();
        drawWave();
      };

      layout();
      return {
        el, media, load, clear, stop, play, layout, drawWave,
        onChange: (fn) => listeners.add(fn),
        setMuted: (m) => { t.muted = m; media.muted = m; },
        get loaded() { return t.dur > 0; },
        get start() { return t.start; },
        get end() { return t.end; },
        get len() { return t.end - t.start; },
        get key() { return t.start.toFixed(3) + "-" + t.end.toFixed(3); },
      };
    }

    // ============================================================ shared sections
    const section = (n, title, ...body) => h("section", { class: "off" }, h("h3", null, h("span", { class: "n" }, String(n)), title), ...body);

    // File picker: button + status text.
    function makePicker(label, accept, hint) {
      const input = h("input", { type: "file", accept, style: "display:none" });
      const b = btn(label, { variant: "act", ico: "upload" });
      const info = h("span", { class: "muted" }, hint);
      b.addEventListener("click", () => input.click());
      return {
        el: h("div", { class: "row" }, b, info, input), btn: b, info,
        onPick: (fn) => input.addEventListener("change", () => {
          const f = input.files && input.files[0];
          input.value = "";
          if (f) fn(f);
        }),
      };
    }

    // Separate audio section (tabs 2 and 3): file + clip with waveform.
    function makeAudioSource(onChange) {
      const picker = makePicker("Choose audio…", "audio/*,video/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac,.mp4,.mov,.webm",
        "MP3, M4A, OGG, WAV… or a video to take the sound from.");
      const trimmer = makeTrimmer("audio", "Choose where the sound starts and ends. Drag the handles or type the seconds.");
      const wrap = h("div", { style: "display:none" }, trimmer.el);
      const s = { file: null };
      picker.onPick(async (f) => {
        picker.info.textContent = "Reading " + f.name + "…";
        await run("audio", async () => {
          try {
            const a = await WAAS.probeAudio(f);
            s.file = f;
            trimmer.load(f, { duration: a.duration, peaks: a.peaks, peakMax: a.peakMax });
            wrap.style.display = "";
            picker.info.textContent = `${f.name} · ${fmtT(a.duration)}${a.peakMax < 0.001 ? " · seems to be silent" : ""}`;
            log("info", "ui:audio-picked", { name: f.name, type: f.type, bytes: f.size, duration: a.duration, channels: a.channels, peak: +a.peakMax.toFixed(4) });
          } catch (e) {
            log("error", "ui:audio-error", e);
            picker.info.textContent = "Couldn't read it: " + e.message;
            s.file = null;
            trimmer.clear();
            wrap.style.display = "none";
          }
        });
        onChange();
      });
      trimmer.onChange(onChange);
      return {
        els: [picker.el, wrap], trimmer, picker,
        get ready() { return !!s.file && trimmer.loaded; },
        get params() { return s.file ? { file: s.file, start: trimmer.start, dur: trimmer.len } : null; },
        get key() { return s.file ? s.file.name + s.file.size + "|" + trimmer.key : ""; },
      };
    }

    // Format: framing + (optional) resolution × fps table.
    // getParams() returns { visual, audio, fit } or null when data is missing.
    function makeFormat({ getParams, grid = true, sync = true, still = false, extras = [] }) {
      const f = { mode: "fit", an: null, anKey: null, sel: null };
      const segFit = h("button", { textContent: "Fit (transparent edges)", class: "on" });
      const segCrop = h("button", { textContent: "Crop (fill the square)" });
      const calcBtn = btn("Estimate sizes", { variant: "act", ico: "grid" });
      const calcInfo = h("span", { class: "muted" });
      const staleLbl = h("div", { class: "callout", style: "display:none" }, "Something changed — estimate the sizes again.");
      // Dedicated progress bar for the estimate (the one under "Create & send" is for creating only).
      const calcBarIn = h("div");
      const calcBar = h("div", { class: "bar", style: "display:none" }, calcBarIn);
      const gridHost = h("div", { style: "overflow-x:auto" });
      const selLbl = h("div", { class: "row label" });
      const legend = h("div", { class: "legend" },
        h("span", null, h("i", { style: "background:var(--ok-bg);border:1px solid var(--ok)" }), "fits"),
        h("span", null, h("i", { style: "background:var(--warn-bg);border:1px solid var(--warn)" }), "fits at lower quality"),
        h("span", null, h("i", { style: "border:1px solid var(--border)" }), "✕ over 1 MB (WhatsApp rejects it)"),
        h("span", null, "★ recommended · values in KB"));
      const syncNum = h("input", { type: "number", min: 0, max: 1000, step: 10, value: store.get("sound-stickers:sync-ms", 0) });
      syncNum.addEventListener("change", () => { store.set("sound-stickers:sync-ms", +syncNum.value || 0); api.onUpdate(); });
      const stillChk = h("input", { type: "checkbox", onchange: () => api.onUpdate() });
      const advRows = [];
      if (sync) advRows.push(h("div", { class: "row" }, h("span", { class: "label" }, "Sync offset (ms)"), syncNum,
        h("span", { class: "muted" }, "Usually 0. If the audio lags on some phones, the picture waits this long.")));
      if (still) advRows.push(h("label", { class: "chk" }, stillChk, h("span", null, h("span", { class: "label" }, "Send as a still image (experimental)"),
        h("div", { class: "muted" }, "By default the image is sent as a one-frame animated sticker that lasts as long as the audio, like typical sound stickers. Check this to test whether WhatsApp also accepts sound on a still sticker."))));
      const advanced = advRows.length ? h("details", null, h("summary", null, "Advanced"), ...advRows) : null;

      // Analysis key: only what changes the sticker's frames. The audio is uploaded separately (it doesn't
      // add to the sticker's size), so only its length counts when the animation follows it.
      const fileId = (x) => (x ? x.name + "|" + x.size + "|" + x.lastModified : "");
      const key = () => {
        const p = getParams();
        if (!p) return null;
        const v = p.visual;
        const followsAudio = v.kind === "image" || p.fit !== "independent";
        return JSON.stringify([v.kind, fileId(v.file), v.start, v.dur, followsAudio ? p.fit : "", followsAudio ? +p.audio.dur.toFixed(3) : "", f.mode]);
      };
      // Result key: everything that changes the sticker or its audio (pack and author apply on send).
      const fullKey = () => {
        const p = getParams();
        if (!p) return null;
        return JSON.stringify([key(), fileId(p.audio.file), +p.audio.start.toFixed(3), +p.audio.dur.toFixed(3), p.fit, f.sel, api.options()]);
      };
      const fresh = () => !!f.an && f.anKey === key();
      const CALC_HINT = "Reads the clip once and estimates the size of each combination.";
      const reset = () => { if (f.an) WAAS.release(f.an); f.an = null; f.sel = null; gridHost.textContent = ""; selLbl.textContent = ""; calcInfo.textContent = CALC_HINT; };
      calcInfo.textContent = CALC_HINT;

      const renderGrid = () => {
        gridHost.textContent = "";
        const an = f.an;
        if (!an) return;
        const L = WAAS.limits;
        const thead = h("tr", null, h("th", { class: "side" }, "px \\ fps"), L.FPS_LIST.map((x) => h("th", null, String(x))));
        const rows = L.SIDES.map((side) => h("tr", null, h("th", { class: "side" }, String(side)), L.FPS_LIST.map((fps) => {
          const c = an.cells.find((x) => x.side === side && x.fps === fps);
          const isAuto = an.auto && an.auto.side === side && an.auto.fps === fps;
          const isSel = f.sel && f.sel.side === side && f.sel.fps === fps;
          const can = !!c && (c.status === "ok" || c.status === "low");
          const label = !c || c.status === "out" ? "·" : c.status === "no" ? "✕" : (isAuto ? "★ " : "") + Math.round(c.est / 1000);
          const title = !c || c.status === "out" ? "Not available for this clip"
            : c.status === "no" ? `≈ ${fmtB(c.estMin)} even at minimum quality: over 1 MB`
            : c.status === "low" ? `≈ ${fmtB(c.est)} at normal quality: quality will be lowered to fit`
            : `≈ ${fmtB(c.est)}`;
          return h("td", null, h("button", {
            class: (c ? c.status : "out") + (isSel ? " sel" : ""), textContent: label, title, disabled: !can,
            onclick: () => { f.sel = { side, fps }; renderGrid(); api.onUpdate(); },
          }));
        })));
        gridHost.append(h("table", { class: "grid" }, thead, rows));
        const c = f.sel && an.cells.find((x) => x.side === f.sel.side && x.fps === f.sel.fps);
        selLbl.textContent = c ? `Selected: ${c.side} px · ${c.fps} fps · ≈ ${fmtB(c.est)}${c.status === "low" ? " (lower quality)" : ""}` : "No combination fits in 1 MB — shorten the clip.";
      };

      segFit.addEventListener("click", () => { f.mode = "fit"; api.onUpdate(); });
      segCrop.addEventListener("click", () => { f.mode = "crop"; api.onUpdate(); });
      calcBtn.addEventListener("click", async () => {
        const p = getParams();
        if (!p) return;
        reset();
        const k = key();
        api.onUpdate();
        try {
          const an = await run("analyze", (signal) => WAAS.analyze({
            ...p, mode: f.mode, signal,
            onProgress: (txt, frac) => { calcInfo.textContent = txt; api.setProgress(frac); },
          }));
          f.an = an; f.anKey = k;
          f.sel = an.auto ? { side: an.auto.side, fps: an.auto.fps } : null;
          calcInfo.textContent = `Done in ${(an.ms / 1000).toFixed(1)} s. Pick a cell (★ = recommended).`;
          renderGrid();
        } catch (e) {
          calcInfo.textContent = e.name === "AbortError" ? "Cancelled" : "Error: " + e.message;
        }
        api.setProgress(0);
        api.onUpdate();
      });

      const body = [...extras, h("div", { class: "row" }, h("span", { class: "label" }, "Framing"), h("span", { class: "seg" }, segFit, segCrop))];
      if (grid) body.push(h("div", { class: "divider" }), h("div", { class: "row" }, calcBtn, calcInfo), calcBar, staleLbl, gridHost, selLbl, legend);
      if (advanced) body.push(advanced);

      const api = {
        body,
        onUpdate: () => {},
        setProgress: (frac) => { calcBar.style.display = frac > 0 ? "" : "none"; calcBarIn.style.width = Math.round(frac * 100) + "%"; },
        refresh() {
          const has = !!getParams();
          const stale = !!f.an && !fresh();
          staleLbl.style.display = stale ? "" : "none";
          gridHost.style.opacity = stale ? ".35" : "";
          gridHost.style.pointerEvents = stale ? "none" : "";
          calcBtn.disabled = G.busy || !has;
          segFit.disabled = segCrop.disabled = G.busy;
          segFit.classList.toggle("on", f.mode === "fit");
          segCrop.classList.toggle("on", f.mode === "crop");
        },
        // Can we create yet? With a table, the estimate must be fresh and a cell picked.
        get ready() { return grid ? fresh() && !!f.sel : !!getParams(); },
        reset,
        fullKey,
        options: () => ({ syncMs: sync ? +syncNum.value || 0 : 0, still: still && stillChk.checked }),
        // Returns the analysis and the combination to create. Without a table it analyzes on the spot.
        async prepare(signal, onProgress) {
          const p = getParams();
          if (grid) return { an: f.an, side: f.sel.side, fps: f.sel.fps, audio: p.audio, temp: false };
          const an = await WAAS.analyze({ ...p, mode: f.mode, signal, onProgress });
          return { an, side: an.auto.side, fps: an.auto.fps, audio: p.audio, temp: true };
        },
      };
      return api;
    }

    // Create & send: pack metadata, creation, preview and sending.
    function makeCreate({ fmt, getBase }) {
      const META_KEY = "sound-stickers:metadata";
      const packInput = h("input", { type: "text", maxLength: 128, placeholder: "e.g. My memes" });
      const authorInput = h("input", { type: "text", maxLength: 128, placeholder: "e.g. your name or handle" });
      const loadMeta = () => { const m = store.get(META_KEY, {}) || {}; packInput.value = m.pack || ""; authorInput.value = m.author || ""; };
      const saveMeta = () => store.set(META_KEY, { pack: packInput.value, author: authorInput.value });
      loadMeta();
      packInput.addEventListener("change", saveMeta);
      authorInput.addEventListener("change", saveMeta);
      const createBtn = btn("Create sticker", { variant: "act", ico: "sparkles" });
      const cancelBtn = btn("Cancel", { style: "display:none" });
      const barIn = h("div");
      const status = h("div", { class: "status" });
      const resImg = h("img", { class: "thumb", alt: "sticker preview" });
      const resAudio = h("audio", { controls: true });
      const resInfo = h("div", { class: "muted", style: "max-width:380px;font-size:12px" });
      const togetherBtn = btn("Play together", { ico: "play" });
      const destSel = h("select", null,
        h("option", { value: "open-only", textContent: "Send to the open chat" }),
        h("option", { value: "open", textContent: "Send to the open chat, then Forward" }),
        h("option", { value: "self", textContent: "Save to my own chat (You), then Forward" }));
      const sendBtn = btn("Send", { variant: "act", ico: "send" });
      const dlBtn = btn("Download .webp + .ogg", { ico: "download" });
      const staleNote = h("div", { class: "callout", style: "display:none" },
        "You changed something after creating this sticker. Click “Create sticker with changes”; sending now sends the previous version.");
      const resultBox = h("div", { class: "result" }, resImg, h("div", { style: "flex:1;min-width:200px" }, resAudio, h("div", { class: "row" }, togetherBtn), resInfo));
      const result = h("div", { style: "display:none" }, staleNote, resultBox,
        h("div", { class: "row", style: "margin-top:12px" }, destSel, sendBtn, dlBtn));
      const c = { result: null, key: null, urls: [] };
      const setStatus = (txt, frac, isErr) => {
        status.textContent = txt || "";
        status.className = "status" + (isErr ? " err" : "");
        if (frac != null) barIn.style.width = Math.round(frac * 100) + "%";
      };
      const revoke = () => { c.urls.forEach((u) => URL.revokeObjectURL(u)); c.urls = []; };
      const clear = () => { c.result = null; c.key = null; result.style.display = "none"; revoke(); setStatus("", 0); };

      createBtn.addEventListener("click", async () => {
        if (!fmt.ready) return;
        result.style.display = "none";
        try {
          const k = fmt.fullKey();
          const res = await run("create", async (signal) => {
            const p = await fmt.prepare(signal, (t, f) => setStatus(t, f * 0.3));
            try {
              return await WAAS.create(p.an, {
                side: p.side, fps: p.fps, audio: p.audio, ...fmt.options(),
                packName: packInput.value, publisher: authorInput.value,
                onProgress: (t, f) => setStatus(t, f), signal,
              });
            } finally {
              if (p.temp) WAAS.release(p.an);
            }
          });
          c.result = res;
          c.key = k;
          revoke();
          const u1 = URL.createObjectURL(res.webp), u2 = URL.createObjectURL(res.ogg);
          c.urls.push(u1, u2);
          resImg.src = u1; resAudio.src = u2;
          const i = res.info;
          const durTxt = Math.abs(i.duration - i.audioDuration) > 0.05 ? `picture ${fmtT(i.duration)} · audio ${fmtT(i.audioDuration)}` : fmtT(i.duration);
          resInfo.textContent = `${durTxt} · ${i.side} px${i.fps ? " · " + i.fps + " fps" : ""}${i.isAnimated ? "" : " · still"} · quality ${Math.round(i.quality * 100)} · sticker ${fmtB(i.webpBytes)}${i.estimate ? " (est. " + fmtB(i.estimate) + ")" : ""} · audio ${fmtB(i.oggBytes)} at ${i.audioKbps} kbps`;
          result.style.display = "";
          setStatus("Sticker ready. Check the preview and send it.", 1);
        } catch (e) {
          setStatus(e.name === "AbortError" ? "Cancelled" : "Error: " + e.message, 0, e.name !== "AbortError");
        }
        // run() unlocks the panel before the result is stored: refresh again here
        // (without this, the Send button stayed disabled until switching tabs).
        api.onUpdate();
      });
      cancelBtn.addEventListener("click", () => { if (G.abort) G.abort.abort(); });

      // Replay the animation from the start together with the audio, like tapping the sticker.
      togetherBtn.addEventListener("click", () => {
        if (!c.result) return;
        const u = resImg.src;
        resImg.src = "";
        resImg.src = u;
        resAudio.currentTime = 0;
        resAudio.play().catch((e) => log("warn", "ui:play", e));
      });

      sendBtn.addEventListener("click", async () => {
        if (!c.result) return;
        const dest = destSel.value;
        try {
          await run("send", async () => {
            // Apply the pack and author typed now (they may have changed after creating).
            const i = c.result.info;
            if (packInput.value.trim() !== (i.pack || "") || authorInput.value.trim() !== (i.author || "")) {
              c.result.webp = await WAAS.retagWebp(c.result.webp, { packName: packInput.value, publisher: authorInput.value, soundSha: i.soundSha256 });
              i.pack = packInput.value.trim(); i.author = authorInput.value.trim();
              log("info", "metadata:updated", { pack: i.pack, author: i.author, webpBytes: c.result.webp.size });
            }
            saveMeta();
            await WAAS.wa.publish(c.result, {
              target: dest === "self" ? "self" : "open",
              openForward: dest !== "open-only",
              onProgress: (t) => setStatus(t),
            });
          });
          setStatus(dest === "open-only" ? "Sent." : "Sent. Pick the chats to forward it to in the dialog.", 1);
          api.onSent();
        } catch (e) {
          setStatus("Couldn't send: " + e.message, 0, true);
        }
      });
      dlBtn.addEventListener("click", () => {
        if (!c.result) return;
        const base = getBase();
        download(c.result.webp, base + ".webp");
        download(c.result.ogg, base + ".ogg");
        log("info", "ui:download-files", { base });
      });

      const api = {
        body: [
          h("div", null,
            h("div", { class: "muted" }, "Sticker details (optional) — WhatsApp shows them under the sticker. They're remembered."),
            h("div", { class: "meta" }, h("span", { class: "label" }, "Pack"), packInput, h("span", { class: "label" }, "Author"), authorInput)),
          h("div", { class: "row" }, createBtn, cancelBtn), h("div", { class: "bar" }, barIn), status, result,
        ],
        onSent: () => {},
        onUpdate: () => {},
        setStatus, clear, loadMeta,
        get hasResult() { return !!c.result; },
        refresh() {
          const stale = !!c.result && c.key !== fmt.fullKey();
          const done = !!c.result && !stale;
          setLabel(createBtn, done ? "Sticker created" : c.result ? "Create sticker with changes" : "Create sticker");
          createBtn.disabled = G.busy || !fmt.ready || done;
          staleNote.style.display = stale ? "" : "none";
          resultBox.style.opacity = stale ? ".45" : "";
          sendBtn.disabled = G.busy || !c.result;
          cancelBtn.style.display = G.busy && api.isActive() ? "" : "none";
        },
        isActive: () => true,
      };
      return api;
    }

    // Builds a full form from its source sections.
    function makeForm({ id, title, desc, sources, fmt, getBase, onShow, stop }) {
      const create = makeCreate({ fmt, getBase });
      let n = 0;
      const secs = sources.map((s) => section(++n, s.title, ...s.body));
      const secFmt = section(++n, "Format", ...fmt.body);
      const secCreate = section(++n, "Create & send", ...create.body);
      const el = h("div", { style: "display:none" }, h("div", { class: "muted tabdesc" }, desc), ...secs, secFmt, secCreate);
      const form = {
        id, title, el, create, stop,
        refresh() {
          sources.forEach((s, i) => secs[i].classList.toggle("off", G.busy || (s.enabled ? !s.enabled() : false)));
          secFmt.classList.toggle("off", !sources.every((s) => s.ready()));
          secCreate.classList.toggle("off", !fmt.ready && !create.hasResult);
          fmt.refresh();
          create.refresh();
        },
        show(on) { el.style.display = on ? "" : "none"; if (on) { create.loadMeta(); if (onShow) onShow(); } else stop(); },
      };
      fmt.onUpdate = () => form.refresh();
      create.onUpdate = () => form.refresh();
      create.isActive = () => el.style.display !== "none";
      create.onSent = () => close(true);
      return form;
    }

    // ============================================================ tab 1: video with its own sound
    function videoForm() {
      const picker = makePicker("Choose video…", "video/*,.mov,.mp4,.webm,.mkv", "Any video with sound.");
      const trimmer = makeTrimmer("video", "Drag the handles — the video shows the frame under them. Click or drag the bar to move the cursor.");
      const s = { file: null };
      const changed = () => form.refresh();
      const fmt = makeFormat({
        getParams: () => (s.file && trimmer.loaded ? {
          visual: { kind: "video", file: s.file, start: trimmer.start, dur: trimmer.len },
          audio: { file: s.file, start: trimmer.start, dur: trimmer.len }, fit: "loop",
        } : null),
      });
      picker.onPick(async (f) => {
        trimmer.stop();
        fmt.reset();
        form.create.clear();
        picker.info.textContent = "Reading " + f.name + "…";
        await run("video", async () => {
          try {
            const meta = await WAAS.probeVideo(f);
            s.file = f;
            trimmer.load(f, meta);
            picker.info.textContent = `${f.name} · ${fmtT(meta.duration)} · ${meta.width}×${meta.height}`;
            log("info", "ui:video-picked", { name: f.name, type: f.type, bytes: f.size, ...meta });
          } catch (e) {
            log("error", "ui:video-error", e);
            picker.info.textContent = "Couldn't read it: " + e.message;
            s.file = null;
            trimmer.clear();
          }
        });
        changed();
      });
      trimmer.onChange(changed);
      const form = makeForm({
        id: "video", title: "Video",
        desc: "A video with its own sound: trim a clip and the picture and audio stay together.",
        sources: [
          { title: "Video", body: [picker.el], ready: () => !!s.file },
          { title: "Clip", body: [trimmer.el], ready: () => trimmer.loaded, enabled: () => trimmer.loaded },
        ],
        fmt, getBase: () => baseName(s.file), stop: () => trimmer.stop(),
      });
      return form;
    }

    // ============================================================ tab 2: image + audio
    function imageForm() {
      const picker = makePicker("Choose image…", "image/*", "JPG, PNG, WebP… (a photo, a drawing, a meme).");
      const thumb = h("img", { class: "thumb", alt: "selected image", style: "display:none;margin-top:8px" });
      const animNote = h("div", { class: "callout", style: "display:none" }, "This is an animated image — only its first frame is used here. To keep it moving, use the “Video or GIF + audio” tab.");
      const s = { file: null, url: null };
      const changed = () => form.refresh();
      const audio = makeAudioSource(changed);
      const fmt = makeFormat({
        grid: false, sync: false, still: true,
        getParams: () => (s.file && audio.ready ? { visual: { kind: "image", file: s.file }, audio: audio.params, fit: "loop" } : null),
      });
      picker.onPick(async (f) => {
        form.create.clear();
        picker.info.textContent = "Reading " + f.name + "…";
        await run("image", async () => {
          try {
            const meta = await WAAS.probeImage(f);
            s.file = f;
            if (s.url) URL.revokeObjectURL(s.url);
            s.url = URL.createObjectURL(f);
            thumb.src = s.url; thumb.style.display = "";
            animNote.style.display = meta.animated ? "" : "none";
            picker.info.textContent = `${f.name} · ${meta.width}×${meta.height}`;
            log("info", "ui:image-picked", { name: f.name, type: f.type, bytes: f.size, ...meta });
          } catch (e) {
            log("error", "ui:image-error", e);
            picker.info.textContent = "Couldn't read it: " + e.message;
            s.file = null; thumb.style.display = "none"; animNote.style.display = "none";
          }
        });
        changed();
      });
      const form = makeForm({
        id: "image", title: "Image + audio",
        desc: "A still image with the sound of your choice. The sticker lasts as long as the audio clip.",
        sources: [
          { title: "Image", body: [picker.el, thumb, animNote], ready: () => !!s.file },
          { title: "Audio", body: audio.els, ready: () => audio.ready },
        ],
        fmt, getBase: () => baseName(s.file), stop: () => audio.trimmer.stop(),
      });
      return form;
    }

    // ============================================================ tab 3: video or GIF + other audio
    function mixForm() {
      const picker = makePicker("Choose video or GIF…", "video/*,image/gif,image/webp,image/apng,.gif,.mov,.mp4,.webm,.mkv",
        "A video (its sound is ignored) or an animated GIF.");
      const vTrim = makeTrimmer("video", "Choose the part of the animation to use. This video's sound is not used.");
      vTrim.setMuted(true);
      const vWrap = h("div", { style: "display:none" }, vTrim.el);
      const gifImg = h("img", { class: "thumb", alt: "selected GIF", style: "display:none;margin-top:8px" });
      const s = { file: null, kind: null, gif: null, url: null };
      const changed = () => { updateSummary(); form.refresh(); };
      const audio = makeAudioSource(changed);

      const FIT_KEY = "sound-stickers:duration-fit";
      const fitSel = h("select", null,
        h("option", { value: "independent", textContent: "Let each keep its own length" }),
        h("option", { value: "loop", textContent: "Loop the animation until the audio ends" }),
        h("option", { value: "freeze", textContent: "Hold the last frame until the audio ends" }));
      fitSel.value = store.get(FIT_KEY, "independent");
      fitSel.addEventListener("change", () => { store.set(FIT_KEY, fitSel.value); changed(); });
      const summary = h("div", { class: "summary" });
      const fitRow = h("div", null, h("div", { class: "row" }, h("span", { class: "label" }, "If lengths differ"), fitSel));
      const testBtn = btn("Preview together", { ico: "play" });
      const vDur = () => (s.kind === "gif" ? s.gif.duration : vTrim.len);

      function updateSummary() {
        summary.textContent = "";
        if (!s.file || !audio.ready) { summary.append("Choose the animation and the audio to see how long the sticker will be."); fitRow.style.display = "none"; return; }
        const v = vDur(), a = audio.params.dur;
        const same = Math.abs(v - a) < 0.05;
        fitRow.style.display = same ? "none" : "";
        if (same) { summary.append(`Animation and audio are the same length: ${fmtT(a)}.`); return; }
        const fit = fitSel.value;
        let txt = `Animation ${fmtT(v)} · audio ${fmtT(a)}. `;
        if (fit === "independent") txt += "Each keeps its own length: when the sticker is tapped, both start together and end separately. Changing the audio doesn't require re-estimating sizes.";
        else if (v > a) txt += `The animation is longer: it's cut at ${fmtT(a)}.`;
        else if (fit === "loop") txt += `The sticker lasts ${fmtT(a)}: the animation plays ${(a / v).toFixed(1)} times.`;
        else txt += `The sticker lasts ${fmtT(a)}: the animation stops on its last frame at ${fmtT(v)}.`;
        summary.append(txt);
      }

      testBtn.addEventListener("click", () => {
        if (!s.file || !audio.ready) return;
        const a = audio.params;
        if (s.kind === "gif") { const u = gifImg.src; gifImg.src = ""; gifImg.src = u; }
        else vTrim.play(vTrim.start, vTrim.end, true);
        audio.trimmer.play(a.start, a.start + a.dur, false);
      });

      const fmt = makeFormat({
        extras: [summary, fitRow, h("div", { class: "row" }, testBtn, h("span", { class: "muted" }, "The animation plays once, as in WhatsApp."))],
        getParams: () => {
          if (!s.file || !audio.ready) return null;
          const visual = s.kind === "gif" ? { kind: "gif", file: s.file, start: 0, dur: s.gif.duration } : { kind: "video", file: s.file, start: vTrim.start, dur: vTrim.len };
          return { visual, audio: audio.params, fit: fitSel.value };
        },
      });

      picker.onPick(async (f) => {
        vTrim.stop();
        fmt.reset();
        form.create.clear();
        picker.info.textContent = "Reading " + f.name + "…";
        await run("animation", async () => {
          try {
            if (s.url) { URL.revokeObjectURL(s.url); s.url = null; }
            if (WAAS.isAnimationFile(f) || (f.type || "").startsWith("image/")) {
              const g = await WAAS.probeAnimation(f);
              if (!g.animated) throw new Error("it's a still image. Use the “Image + audio” tab.");
              s.file = f; s.kind = "gif"; s.gif = g;
              s.url = URL.createObjectURL(f);
              gifImg.src = s.url; gifImg.style.display = ""; vWrap.style.display = "none";
              vTrim.clear();
              picker.info.textContent = `${f.name} · ${fmtT(g.duration)} · ${g.frames} frames · ${g.width}×${g.height} · used in full`;
              log("info", "ui:gif-picked", { name: f.name, type: f.type, bytes: f.size, frames: g.frames, duration: g.duration, width: g.width, height: g.height });
            } else {
              const meta = await WAAS.probeVideo(f);
              s.file = f; s.kind = "video"; s.gif = null;
              vTrim.load(f, meta);
              vWrap.style.display = ""; gifImg.style.display = "none";
              picker.info.textContent = `${f.name} · ${fmtT(meta.duration)} · ${meta.width}×${meta.height}`;
              log("info", "ui:video-picked", { name: f.name, type: f.type, bytes: f.size, withoutOwnAudio: true, ...meta });
            }
          } catch (e) {
            log("error", "ui:animation-error", e);
            picker.info.textContent = "Couldn't use it: " + e.message;
            s.file = null; s.kind = null; s.gif = null;
            vTrim.clear(); vWrap.style.display = "none"; gifImg.style.display = "none";
          }
        });
        changed();
      });
      vTrim.onChange(changed);
      updateSummary();

      const form = makeForm({
        id: "mix", title: "Video or GIF + audio",
        desc: "An animation (a muted video or a GIF) with the audio of your choice.",
        sources: [
          { title: "Animation", body: [picker.el, vWrap, gifImg], ready: () => !!s.file },
          { title: "Audio", body: audio.els, ready: () => audio.ready },
        ],
        fmt, getBase: () => baseName(s.file),
        stop: () => { vTrim.stop(); audio.trimmer.stop(); },
      });
      return form;
    }

    // ============================================================ panel
    G.forms = [videoForm(), imageForm(), mixForm()];
    const TAB_KEY = "sound-stickers:tab";
    let active = Math.max(0, G.forms.findIndex((f) => f.id === store.get(TAB_KEY, "video")));
    const tabBtns = G.forms.map((f, i) => h("button", { textContent: f.title, onclick: () => selectTab(i) }));
    function selectTab(i) {
      if (G.busy) return;
      active = i;
      store.set(TAB_KEY, G.forms[i].id);
      G.forms.forEach((f, j) => f.show(j === i));
      G.refreshTabs();
      G.forms[i].refresh();
      log("info", "ui:tab", { tab: G.forms[i].id });
    }
    G.refreshTabs = () => tabBtns.forEach((b, i) => { b.classList.toggle("on", i === active); b.disabled = G.busy && i !== active; });

    const logBox = h("div", { class: "logbox" });
    const tools = h("details", null, h("summary", null, "Troubleshooting (log, diagnostics)"),
      h("div", { class: "row" },
        btn("Run diagnostics", { onclick: () => WAAS.wa.diagnose().catch((e) => log("error", "diagnostics:error", e)) }),
        btn("Save log…", { ico: "download", onclick: () => saveLog().catch((e) => log("error", "log:error", e)) }),
        btn("Open full log", { onclick: () => window.postMessage({ __waas: "openLog" }, location.origin) })),
      logBox);

    const closeBtn = btn(null, { variant: "ghost", ico: "x", title: "Close" });
    const logo = h("span", { class: "logo" }, icon("sound", 18));
    const panel = h("div", { class: "panel", role: "dialog", "aria-label": "Sound Stickers" },
      h("header", null,
        h("div", { class: "brand" }, logo, h("div", null, h("h2", null, "Sound Stickers"), h("div", { class: "muted", style: "font-size:12.5px" }, "Turn any clip into a WhatsApp sticker with sound"))),
        h("div", { class: "hdr-r" }, h("span", { class: "badge" }, "v" + WAAS.VERSION), closeBtn)),
      h("div", { class: "body" }, h("nav", { class: "tabs" }, tabBtns), G.forms.map((f) => f.el), tools),
      h("footer", null, "Everything is processed locally in your browser · 1 MB max per sticker · Unofficial, not affiliated with WhatsApp"));
    const overlay = h("div", { class: "overlay", style: "display:none" }, panel);
    root.append(overlay);

    const showEntry = (e) => {
      logBox.append(h("div", { class: e.level === "error" ? "e" : e.level === "warn" ? "w" : "" },
        e.ts.slice(11, 19) + " " + e.event + (e.data != null ? " " + JSON.stringify(e.data).slice(0, 260) : "")));
      while (logBox.childNodes.length > 200) logBox.firstChild.remove();
      logBox.scrollTop = logBox.scrollHeight;
    };
    WAAS.entries.slice(-30).forEach(showEntry);
    WAAS.onLog(showEntry);

    const open = () => {
      panel.classList.toggle("dark", isDark());
      overlay.style.display = "";
      G.forms[active].show(true);
      log("info", "ui:open", null);
    };
    function close(force) {
      if (G.busy && force !== true) return;
      G.forms.forEach((f) => f.stop());
      overlay.style.display = "none";
    }
    const toggle = () => (overlay.style.display === "none" ? open() : close());
    window.addEventListener("message", (ev) => {
      if (ev.source === window && ev.data && ev.data.__waas === "togglePanel") toggle();
    });
    window.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && overlay.style.display !== "none") close(); });
    WAAS.togglePanel = toggle;
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

    selectTab(active);
    log("info", "ui:mounted", null);
    window.postMessage({ __waas: "uiReady" }, location.origin);
  }

  WAAS.mountUI = mount;
})();
