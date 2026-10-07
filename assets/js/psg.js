/* Real polysomnogram replay for the home hero.
   Data: Sleep-EDF Database Expanded, record SC4001E0 (PhysioNet, ODC-By 1.0), prepared into
   assets/data/sleep-sc4001.json: the whole night's expert hypnogram plus 24 short excerpts
   spread across the night (EEG and EOG at 100 Hz, EMG envelope and respiration at 1 Hz, as
   recorded). Stages come from the sleep technicians; spindle boxes come from a simple
   11-16 Hz band-pass detector. Nothing here is simulated. */
(function () {
  const cv = document.getElementById("psg");
  const hc = document.getElementById("hypc");
  if (!cv || !hc) return;
  const cx = cv.getContext("2d"), hx = hc.getContext("2d");
  const $ = id => document.getElementById(id);
  const C = { trace: "#a9c8f0", grid: "rgba(169,200,240,.07)", muted: "#8fa3bd", teal: "#10d6c2" };
  const note = document.querySelector(".sim-note");
  const dataUrl = new URL("../data/sleep-sc4001.json", document.currentScript ? document.currentScript.src : location.href).href;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const WIN = 15, FS = 100, PRE = 15, LEN = 45;      // seconds on screen; Hz; lead-in; excerpt length

  fetch(dataUrl).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(start).catch(() => {
    if (note) note.textContent = "RECORDING UNAVAILABLE";
  });

  function start(D) {
    const b64 = s => Int8Array.from(atob(s), c => (c.charCodeAt(0) << 24) >> 24);
    const ex = D.excerpts.map(e => ({
      e: e.e, eeg1: b64(e.eeg1), eeg2: b64(e.eeg2), eog: b64(e.eog),
      emg: e.emg, resp: e.resp, spindles: e.spindles,
    }));
    // display scales taken from the data itself
    const p95 = a => { const s = a.map(Math.abs).sort((x, y) => x - y); return s[Math.floor(s.length * .95)] || 1; };
    const respMed = ex.map(e => { const s = [...e.resp].sort((x, y) => x - y); return s[22]; });
    const SC = {
      eeg: 55 / D.eeg_step_uv,                            // 55 uV fills a lane's half-height
      eog: 120 / D.eog_step_uv,
      emg: Math.max(1e-6, p95(ex.flatMap(e => e.emg))),
      resp: p95(ex.flatMap((e, i) => e.resp.map(v => v - respMed[i]))),
    };
    const LANES = [
      { id: "EEG Fpz-Cz · 100 Hz", key: "eeg1", rate: 100, k: SC.eeg, gain: 1 },
      { id: "EEG Pz-Oz · 100 Hz", key: "eeg2", rate: 100, k: SC.eeg, gain: 1 },
      { id: "EOG horizontal · 100 Hz", key: "eog", rate: 100, k: SC.eog, gain: 1 },
      { id: "EMG submental · envelope, 1 Hz", key: "emg", rate: 1, k: SC.emg, gain: .9, base: true },
      { id: "Respiration oro-nasal · 1 Hz", key: "resp", rate: 1, k: SC.resp, gain: .9, med: true },
    ];
    const STAGES = D.names, hyp = D.hyp, NE = hyp.length;     // rows top to bottom: W, REM, N1, N2, N3
    if (note) note.textContent = "REAL RECORDING · SLEEP-EDF SC4001E0 · PHYSIONET";

    // ?psg-excerpt=N pins the replay to excerpt N, paused (used to check each stage's final picture)
    const pin = new URLSearchParams(location.search).get("psg-excerpt");
    let W, H, k = pin ? Math.max(0, Math.min(ex.length - 1, +pin)) : 0, t = reduce || pin ? 30 : PRE, last = performance.now(), fade = 1;
    function size() {
      const d = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0);
      hc.width = hc.clientWidth * d; hc.height = hc.clientHeight * d; hx.setTransform(d, 0, 0, d, 0, 0);
    }
    size(); addEventListener("resize", () => { size(); draw(); });

    // value of a lane at excerpt time u seconds, in display units (about -1..1)
    function val(e, ln, u, i) {
      if (ln.rate === 100) { const j = Math.max(0, Math.min(e[ln.key].length - 1, Math.round(u * FS))); return e[ln.key][j] / ln.k; }
      // 1 Hz channels: smooth Catmull-Rom curve through the recorded points
      const a = e[ln.key], j = Math.max(0, Math.min(a.length - 2, Math.floor(u))), f = Math.max(0, Math.min(1, u - j));
      const p0 = a[Math.max(0, j - 1)], p1 = a[j], p2 = a[j + 1], p3 = a[Math.min(a.length - 1, j + 2)];
      let v = .5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
      if (ln.med) v -= respMed[i];
      return ln.base ? (v / ln.k) * 1.6 - .8 : v / ln.k;
    }

    function draw() {
      const e = ex[k], narrow = W < 760;
      const top = 44, bottom = H - 44, lane = (bottom - top) / LANES.length;
      const x0 = narrow ? 16 : Math.max(W * .5, 620), span = W - x0 - 24;
      cx.clearRect(0, 0, W, H);
      cx.globalAlpha = fade;
      cx.strokeStyle = C.grid; cx.lineWidth = 1;
      for (let s = 0; s <= WIN; s++) {
        const gx = x0 + span * (s - ((t % 1) + 1) % 1) / WIN; if (gx < x0) continue;
        cx.beginPath(); cx.moveTo(gx, top - 20); cx.lineTo(gx, bottom); cx.stroke();
      }
      const tl = t - WIN;                                    // window start, excerpt time
      cx.font = "500 11px 'IBM Plex Mono', monospace";
      for (const [a, b] of e.spindles) {
        if (b < tl || a > t) continue;
        const ax = x0 + span * (Math.max(a, tl) - tl) / WIN, bx = x0 + span * (Math.min(b, t) - tl) / WIN, y = top + lane * .5;
        cx.fillStyle = "rgba(16,214,194,.12)"; cx.fillRect(ax, y - lane * .48, bx - ax, lane * .96);
        cx.strokeStyle = C.teal; cx.strokeRect(ax + .5, y - lane * .48 + .5, bx - ax - 1, lane * .96 - 1);
        cx.fillStyle = C.teal; cx.fillText("spindle · 11–16 Hz", ax + 6, y - lane * .48 - 6);
      }
      LANES.forEach((ln, c) => {
        const mid = top + lane * (c + .5), amp = lane * .32 * ln.gain;
        cx.fillStyle = C.muted; cx.font = "400 11px 'IBM Plex Mono', monospace";
        cx.fillText(ln.id, x0, mid - lane * .36);
        cx.strokeStyle = C.trace; cx.lineWidth = 1.1; cx.globalAlpha = fade * .92; cx.beginPath();
        const n = ln.rate === 100 ? 600 : 150;             // 100 Hz lanes drawn at 40 points per second
        for (let i = 0; i <= n; i++) {
          const u = tl + WIN * i / n, v = val(e, ln, u, k);
          const px = x0 + span * i / n, py = mid - Math.max(-1.4, Math.min(1.4, v)) * amp;
          i ? cx.lineTo(px, py) : cx.moveTo(px, py);
        }
        cx.stroke(); cx.globalAlpha = fade;
      });
      cx.strokeStyle = "rgba(16,214,194,.55)"; cx.beginPath(); cx.moveTo(x0 + span, top - 20); cx.lineTo(x0 + span, bottom); cx.stroke();
      cx.globalAlpha = 1;
      drawHyp();
    }

    function drawHyp() {
      const w = hc.clientWidth, h = hc.clientHeight, rows = STAGES.length;
      const yOf = s => 8 + s * (h - 16) / (rows - 1);
      const L = 34, span = w - L, cur = ex[k].e;
      hx.clearRect(0, 0, w, h);
      hx.font = "400 9px 'IBM Plex Mono', monospace"; hx.fillStyle = C.muted;
      STAGES.forEach((s, i) => hx.fillText(s, 0, yOf(i) + 3));
      const path = upto => {
        hx.beginPath();
        for (let i = 0; i <= upto; i++) {
          const x = L + span * i / NE, y = yOf(hyp[i]);
          i ? hx.lineTo(x, y) : hx.moveTo(x, y); hx.lineTo(L + span * (i + 1) / NE, y);
        }
      };
      hx.lineWidth = 1.4;
      path(NE - 1); hx.strokeStyle = "rgba(169,200,240,.35)"; hx.stroke();
      path(cur); hx.strokeStyle = C.teal; hx.stroke();
      hx.fillStyle = C.teal; hx.beginPath(); hx.arc(L + span * (cur + 1) / NE, yOf(hyp[cur]), 3.5, 0, 7); hx.fill();

      const st = STAGES[hyp[cur]];
      $("stage").textContent = st;
      $("conf").textContent = "scored by technicians";
      const secs = D.start_clock_s + (D.window_first_epoch + cur) * 30 + Math.max(0, t - PRE);
      $("clock").textContent = [Math.floor(secs / 3600) % 24, Math.floor(secs / 60) % 60, Math.floor(secs) % 60].map(v => String(v).padStart(2, "0")).join(":");
      $("epoch").textContent = `epoch ${cur + 1} / ${NE}`;
      const pill = $("pill-epoch");
      if (pill) pill.textContent = `REPLAY · EPOCH ${cur + 1} / ${NE} · ${st}`;
    }

    let visible = true;
    new IntersectionObserver(en => { visible = en[0].isIntersecting; }).observe(cv);
    const SPEED = 1.6;                                      // recording seconds per real second
    function loop(now) {
      const dt = Math.min(.1, (now - last) / 1000) * SPEED; last = now;
      if (visible) {
        t += dt;
        if (t >= LEN) { k = (k + 1) % ex.length; t = PRE; fade = 0; }   // cut to the next excerpt of the night
        if (fade < 1) fade = Math.min(1, fade + dt * 1.4);
        draw();
      }
      requestAnimationFrame(loop);
    }
    draw();
    if (document.fonts) document.fonts.ready.then(draw);
    if (!reduce && !pin) requestAnimationFrame(loop);
  }
})();
