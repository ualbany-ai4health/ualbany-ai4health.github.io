/* Live polysomnogram for the home hero.
   Simulated signals: five channels at 100 Hz, stage-specific rhythms and events,
   and a hypnogram of one night (960 epochs of 30 s) that the "model" reads in gold. */
(function () {
  const cv = document.getElementById("psg");
  const hc = document.getElementById("hypc");
  if (!cv || !hc) return;
  const cx = cv.getContext("2d"), hx = hc.getContext("2d");
  const $ = id => document.getElementById(id);
  const C = { trace: "#cbbbe8", grid: "rgba(203,187,232,.07)", muted: "#a397b3", gold: "#eeb211" };

  // deterministic noise
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };

  // one plausible night: 960 epochs of 30 s, five sleep cycles
  const STAGES = ["W", "REM", "N1", "N2", "N3"];          // hypnogram rows, top to bottom
  const night = [];
  const push = (s, n) => { for (let i = 0; i < n; i++) night.push(s); };
  push("W", 24); push("N1", 10);
  for (let c = 0; c < 5; c++) {
    push("N2", 44 - c * 2); push("N3", Math.max(4, 64 - c * 16)); push("N2", 34);
    if (c % 2) { push("W", 4); push("N1", 6); }
    push("REM", 22 + c * 12); push("N1", 4);
  }
  while (night.length < 952) push("N2", 1);
  push("W", 8); night.length = 960;

  const FS = 100, WIN = 15, N = FS * WIN;
  const CH = [
    { id: "EEG Fpz-Cz", gain: 1.0 }, { id: "EEG Pz-Oz", gain: 0.9 }, { id: "EOG horizontal", gain: 1.0 },
    { id: "EMG submental", gain: 0.6 }, { id: "ECG", gain: 0.8 },
  ];
  const buf = CH.map(() => new Float32Array(N));
  let head = 0, t = 0, epochIndex = 269;
  const ph = { a: 0, th: 0, d: 0, d2: 0, sp: 0 };
  let spindle = null, kc = null, rem = null, blink = null, lastBeat = 0, nextBeat = .3;
  const events = [];

  const stageNow = () => night[Math.floor(epochIndex + t / 30) % night.length];

  function sample() {
    const s = stageNow(), dt = 1 / FS;
    ph.a += 2 * Math.PI * 10 * dt; ph.th += 2 * Math.PI * (5.5 + Math.sin(t * .3)) * dt;
    ph.d += 2 * Math.PI * .9 * dt; ph.d2 += 2 * Math.PI * 1.6 * dt; ph.sp += 2 * Math.PI * 13 * dt;
    let eeg = 0, occ = 0, eog = 0, emg = 0;
    const n = gauss();
    if (s === "W") { occ += .55 * Math.sin(ph.a) * (.6 + .4 * Math.sin(t * .7)); eeg += .18 * n; emg = .55; }
    if (s === "N1") { eeg += .35 * Math.sin(ph.th); occ += .2 * Math.sin(ph.th + 1); emg = .3; eog += .5 * Math.sin(t * .6); }
    if (s === "N2") { eeg += .3 * Math.sin(ph.th) + .15 * Math.sin(ph.d); occ += .22 * Math.sin(ph.th); emg = .22; }
    if (s === "N3") { eeg += .95 * Math.sin(ph.d) + .5 * Math.sin(ph.d2 + 1); occ += .6 * Math.sin(ph.d + .4); emg = .18; }
    if (s === "REM") { eeg += .3 * Math.sin(ph.th) + .12 * ((ph.th / Math.PI) % 2 - 1); occ += .25 * Math.sin(ph.th); emg = .06; }
    eeg += .09 * n; occ += .08 * gauss();

    if (s === "N2" && !spindle && rnd() < .0009) { spindle = { t0: t, dur: .8 + rnd() * .7 }; events.push({ t0: t, t1: t + spindle.dur, label: "spindle · 13 Hz" }); }
    if (spindle) { const u = (t - spindle.t0) / spindle.dur; if (u > 1) spindle = null; else eeg += .55 * Math.sin(Math.PI * u) ** 2 * Math.sin(ph.sp); }
    if (s === "N2" && !kc && !spindle && rnd() < .0004) { kc = { t0: t }; events.push({ t0: t, t1: t + 1, label: "K-complex" }); }
    if (kc) { const u = t - kc.t0; if (u > 1) kc = null; else eeg += -1.5 * Math.exp(-((u - .25) ** 2) / .012) + 1.1 * Math.exp(-((u - .6) ** 2) / .03); }
    if (s === "REM" && !rem && rnd() < .01) rem = { t0: t, sign: rnd() < .5 ? -1 : 1 };
    if (rem) { const u = t - rem.t0; if (u > .5) rem = null; else eog += rem.sign * (u < .06 ? u / .06 : Math.exp(-(u - .06) * 6)) * 1.2; }
    if (s === "W" && !blink && rnd() < .006) blink = { t0: t };
    if (blink) { const u = t - blink.t0; if (u > .4) blink = null; else { const b = Math.exp(-((u - .15) ** 2) / .004); eog += 1.1 * b; eeg += .5 * b; } }
    eog += .05 * gauss();
    emg *= gauss() * .9;

    if (t >= nextBeat) { lastBeat = t; nextBeat = t + .95 + .08 * Math.sin(t * .25); }
    const x = t - lastBeat;
    const ecg = .02 * gauss() + .12 * Math.exp(-((x - .08) ** 2) / .0008) - .15 * Math.exp(-((x - .17) ** 2) / .00006)
      + 1.2 * Math.exp(-((x - .19) ** 2) / .00008) - .3 * Math.exp(-((x - .215) ** 2) / .0001) + .25 * Math.exp(-((x - .42) ** 2) / .003);
    return [eeg, occ, eog, emg, ecg];
  }

  function step() {
    const v = sample();
    for (let c = 0; c < CH.length; c++) buf[c][head % N] = v[c];
    head++; t += 1 / FS;
    // move through the night faster than real time so every stage shows within a minute
    if (head % (FS * 6) === 0) epochIndex += 7;
  }
  for (let i = 0; i < N; i++) step();

  let W, H;
  function size() {
    const d = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0);
    hc.width = hc.clientWidth * d; hc.height = hc.clientHeight * d; hx.setTransform(d, 0, 0, d, 0, 0);
  }
  size(); addEventListener("resize", size);

  function draw() {
    const narrow = W < 760;
    const top = 44, bottom = H - 44, lane = (bottom - top) / CH.length;
    const x0 = narrow ? 16 : Math.max(W * .5, 620), span = W - x0 - 24;
    cx.clearRect(0, 0, W, H);
    cx.strokeStyle = C.grid; cx.lineWidth = 1;
    for (let s = 0; s <= WIN; s++) {
      const gx = x0 + span * (s - (t % 1)) / WIN; if (gx < x0) continue;
      cx.beginPath(); cx.moveTo(gx, top - 20); cx.lineTo(gx, bottom); cx.stroke();
    }
    const tLeft = t - WIN;
    cx.font = "500 11px 'IBM Plex Mono', monospace";
    for (const e of events) {
      if (e.t1 < tLeft) continue;
      const ax = x0 + span * (e.t0 - tLeft) / WIN, bx = x0 + span * (e.t1 - tLeft) / WIN, y = top + lane * .5;
      cx.fillStyle = "rgba(238,178,17,.12)"; cx.fillRect(ax, y - lane * .48, bx - ax, lane * .96);
      cx.strokeStyle = C.gold; cx.strokeRect(ax + .5, y - lane * .48 + .5, bx - ax - 1, lane * .96 - 1);
      cx.fillStyle = C.gold; cx.fillText(e.label, ax + 6, y - lane * .48 - 6);
    }
    while (events.length && events[0].t1 < tLeft) events.shift();
    CH.forEach((ch, c) => {
      const mid = top + lane * (c + .5), amp = lane * .32 * ch.gain;
      cx.fillStyle = C.muted; cx.font = "400 11px 'IBM Plex Mono', monospace";
      cx.fillText(ch.id, x0, mid - lane * .36);
      cx.strokeStyle = C.trace; cx.globalAlpha = c === 4 ? .75 : .9; cx.lineWidth = 1.1; cx.beginPath();
      for (let i = 0; i < N; i++) {
        const px = x0 + span * i / N, py = mid - buf[c][(head - N + i) % N] * amp;
        i ? cx.lineTo(px, py) : cx.moveTo(px, py);
      }
      cx.stroke(); cx.globalAlpha = 1;
    });
    cx.strokeStyle = "rgba(238,178,17,.55)"; cx.beginPath(); cx.moveTo(x0 + span, top - 20); cx.lineTo(x0 + span, bottom); cx.stroke();
    drawHyp();
  }

  function drawHyp() {
    const w = hc.clientWidth, h = hc.clientHeight, rows = STAGES.length;
    const yOf = s => 8 + STAGES.indexOf(s) * (h - 16) / (rows - 1);
    const L = 34, span = w - L, cur = Math.floor(epochIndex + (t - WIN) / 30) % night.length;
    hx.clearRect(0, 0, w, h);
    hx.font = "400 9px 'IBM Plex Mono', monospace"; hx.fillStyle = C.muted;
    STAGES.forEach(s => hx.fillText(s, 0, yOf(s) + 3));
    const path = (upto) => {
      hx.beginPath();
      for (let i = 0; i <= upto; i++) {
        const x = L + span * i / night.length, y = yOf(night[i]);
        i ? hx.lineTo(x, y) : hx.moveTo(x, y); hx.lineTo(L + span * (i + 1) / night.length, y);
      }
    };
    hx.lineWidth = 1.4;
    path(night.length - 1); hx.strokeStyle = "rgba(203,187,232,.35)"; hx.stroke();
    path(cur); hx.strokeStyle = C.gold; hx.stroke();
    hx.fillStyle = C.gold; hx.beginPath(); hx.arc(L + span * (cur + 1) / night.length, yOf(night[cur]), 3.5, 0, 7); hx.fill();

    $("stage").textContent = night[cur];
    $("conf").textContent = "p = " + (.78 + .2 * Math.abs(Math.sin(cur * 1.7))).toFixed(2);
    const secs = cur * 30 + 22 * 3600 + 40 * 60;
    $("clock").textContent = [Math.floor(secs / 3600) % 24, Math.floor(secs / 60) % 60, secs % 60].map(v => String(v).padStart(2, "0")).join(":");
    $("epoch").textContent = `epoch ${cur + 1} / ${night.length}`;
  }

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let last = performance.now(), visible = true;
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(cv);
  const SPEED = 1.6;   // recording seconds per real second
  function loop(now) {
    const dt = Math.min(.1, (now - last) / 1000) * SPEED; last = now;
    if (visible) { for (let i = Math.round(dt * FS); i > 0; i--) step(); draw(); }
    requestAnimationFrame(loop);
  }
  draw();
  if (document.fonts) document.fonts.ready.then(draw);
  if (!reduce) requestAnimationFrame(loop);
})();
