/* Site motion: words come into focus, scan-line image reveal, counting readouts,
   the patient-split method diagram and the point-cloud brain.
   Everything replays when an element returns to view after leaving it completely. */
(function () {
  window.__motion = true;
  const root = document.documentElement;
  root.classList.add("motion");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = { trace: "#a9c8f0", muted: "#8fa3bd", teal: "#10d6c2", dim: "#4f6480" };

  /* ---------- words come into focus ---------- */
  document.querySelectorAll(".focus").forEach(h => {
    const out = [];
    h.childNodes.forEach(n => {
      if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach(t => out.push(t.trim() ? `<span class="w">${t}</span>` : t));
      else if (n.nodeType === 1) out.push(`<span class="w${n.classList.contains("teal") ? " teal" : ""}">${n.textContent}</span>`);
    });
    h.innerHTML = out.join("");
    h.querySelectorAll(".w").forEach((w, i) => (w.style.transitionDelay = i * 70 + "ms"));
  });

  /* ---------- counting readouts ---------- */
  let countRun = 0;
  const fmt = el => v => (el.dataset.prefix || "") + Math.round(v).toLocaleString("en-US") + (el.dataset.suffix || "");
  function resetCount(box) { countRun++; box.querySelectorAll("[data-to]").forEach(el => (el.textContent = fmt(el)(0))); }
  function countUp(box) {
    const run = ++countRun;
    box.querySelectorAll("[data-to]").forEach(el => {
      const to = +el.dataset.to, f = fmt(el);
      if (reduce) { el.textContent = f(to); return; }
      const t0 = performance.now(), dur = 1600;
      const tick = now => {
        if (run !== countRun) return;
        const u = Math.min(1, (now - t0) / dur);
        el.textContent = f(to * (1 - Math.pow(1 - u, 4)));
        if (u < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- play at 35% visible, rewind when fully off screen ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    const el = e.target;
    if (e.intersectionRatio >= .35 && !el.classList.contains("in")) {
      el.classList.add("in");
      if (el.classList.contains("stats")) countUp(el);
    } else if (!e.isIntersecting && el.classList.contains("in")) {
      el.classList.remove("in");
      if (el.classList.contains("stats")) resetCount(el);
    }
  }), { threshold: [0, .35] });
  const watched = document.querySelectorAll(".focus, .scanned, .stats");
  watched.forEach(el => io.observe(el));
  // safety net: whatever is already on screen when the page opens plays at once,
  // even if the observer's first report arrives late
  function playVisible() {
    watched.forEach(el => {
      const r = el.getBoundingClientRect();
      const seen = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (seen > Math.min(r.height, innerHeight) * .35 && !el.classList.contains("in")) {
        el.classList.add("in");
        if (el.classList.contains("stats")) countUp(el);
      }
    });
  }
  requestAnimationFrame(() => requestAnimationFrame(playVisible));
  addEventListener("load", playVisible);

  /* ---------- canvas helper ---------- */
  function fit(cv, g) {
    const w = cv.clientWidth, h = cv.clientHeight, d = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    g.setTransform(d, 0, 0, d, 0, 0);
    return [w, h];
  }
  function whileVisible(el, draw) {
    let on = false;
    new IntersectionObserver(e => { const was = on; on = e[0].isIntersecting; if (on && !was) requestAnimationFrame(loop); }).observe(el);
    function loop(t) { draw(t); if (on && !reduce) requestAnimationFrame(loop); }
  }

  /* ---------- the method: why we split by patient ----------
     40 patients x 6 samples. Every split below is computed, not drawn by hand:
     - the trap: 48 of 240 samples (20%) drawn at random for testing; the patients
       who then have samples on both sides are counted and flagged;
     - the honest split: 8 whole patients (4 with the diagnosis, 4 controls) sealed;
     - tuning: the 32 training patients form 4 folds of 8, each balanced 4/4. */
  const split = document.getElementById("split");
  if (split) {
    const g = split.getContext("2d"), cap = document.getElementById("split-cap");
    let s = 20261006; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const NP = 40, NS = 6, COND = "#a9c8f0", CTRL = "#2f6fd1", WARN = "#ff6b5e";
    const pts = [];
    for (let i = 0; i < NP; i++) pts.push({ id: i, cond: i % 2 === 0, test: false, fold: -1 });
    // stratified patient-level split: 4 diagnosed + 4 controls sealed
    for (const c of [true, false]) shuffle(pts.filter(p => p.cond === c)).slice(0, 4).forEach(p => (p.test = true));
    // stratified folds over the 32 training patients: 4 diagnosed + 4 controls each
    for (const c of [true, false]) shuffle(pts.filter(p => p.cond === c && !p.test)).forEach((p, k) => (p.fold = k % 4));
    const samples = [];
    pts.forEach(p => { for (let k = 0; k < NS; k++) samples.push({ p, k, x: 0, y: 0, rnd: false }); });
    // the trap: a random 20% of samples, ignoring who they belong to
    shuffle(samples.slice()).slice(0, 48).forEach(sm => (sm.rnd = true));
    const order = shuffle(samples.slice());
    pts.forEach(p => { const sides = new Set(samples.filter(sm => sm.p === p).map(sm => sm.rnd)); p.leak = sides.size === 2; });
    const leaked = pts.filter(p => p.leak).length;
    const trainP = pts.filter(p => !p.test).sort((a, b) => a.fold - b.fold || b.cond - a.cond);
    const testP = pts.filter(p => p.test).sort((a, b) => b.cond - a.cond);

    const WALL = .7, TOP = .16, BOT = .86;
    const tilePos = (col, row, x0, x1, cols, rows) => [x0 + (x1 - x0) * (col + .5) / cols, TOP + (BOT - TOP) * (row + .5) / rows];
    function layout(step, w, h) {
      const u = Math.min(w, h), sz = Math.max(4, u * .013), sp = sz * 1.55;
      const tile = (sm, cx, cy) => [cx * w + ((sm.k % 3) - 1) * sp, cy * h + (Math.floor(sm.k / 3) - .5) * sp];
      if (step === 0) {
        samples.forEach(sm => { const i = sm.p.id; sm.t = tile(sm, ...tilePos(i % 8, Math.floor(i / 8), .05, .95, 8, 5)); });
      } else if (step === 1) {
        let a = 0, b = 0;
        order.forEach(sm => {
          if (sm.rnd) { const c = b % 4, rr = Math.floor(b / 4); b++; sm.t = [w * (WALL + .07 + c * .055), h * (TOP + .02 + rr * (BOT - TOP - .04) / 11)]; }
          else { const c = a % 16, rr = Math.floor(a / 16); a++; sm.t = [w * (.06 + c * .039), h * (TOP + .02 + rr * (BOT - TOP - .04) / 11)]; }
        });
      } else {
        samples.forEach(sm => {
          const p = sm.p;
          if (p.test) { const i = testP.indexOf(p); sm.t = tile(sm, ...tilePos(i % 2, Math.floor(i / 2), WALL + .04, .96, 2, 4)); }
          else { const i = trainP.indexOf(p), f = p.fold, j = i - f * 8; sm.t = tile(sm, ...tilePos(f * 2 + (j % 2), Math.floor(j / 2), .04, WALL - .03, 8, 4)); }
        });
      }
      return sz;
    }
    let step = 0, placed = false;
    const caps = [
      "40 patients × 6 samples",
      `random 20% of samples → ${leaked} of 40 patients sit on both sides`,
      "8 whole patients sealed: 4 diagnosed, 4 controls",
      "",
      "scored once, on the 8 sealed patients",
    ];
    const rail = document.querySelectorAll(".rail a");
    const so = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      step = +e.target.dataset.step;
      rail.forEach((a, i) => a.classList.toggle("on", i === step));
      if (reduce) draw(performance.now());
    }), { rootMargin: "-45% 0px -45% 0px" });
    document.querySelectorAll(".step").forEach(x => so.observe(x));

    function label(txt, x, y, col, align) { g.fillStyle = col || C.muted; g.textAlign = align || "left"; g.fillText(txt, x, y); g.textAlign = "left"; }
    function draw(t) {
      const [w, h] = fit(split, g);
      g.clearRect(0, 0, w, h);
      g.font = "500 10.5px 'IBM Plex Mono', monospace";
      const sz = layout(step, w, h);
      const k = reduce || !placed ? 1 : .085;
      samples.forEach(sm => { sm.x += (sm.t[0] - sm.x) * k; sm.y += (sm.t[1] - sm.y) * k; });
      placed = true;
      const fold = Math.floor(t / 1700) % 4;
      cap.textContent = step === 3 ? `round ${fold + 1} of 4 · train on 24 patients, validate on 8` : caps[step];

      // legend
      g.fillStyle = COND; g.fillRect(w * .05, h * .055, 7, 7); label("DIAGNOSIS", w * .05 + 12, h * .055 + 7);
      g.fillStyle = CTRL; g.fillRect(w * .05 + 92, h * .055, 7, 7); label("CONTROL", w * .05 + 104, h * .055 + 7);
      if (step === 1) { g.fillStyle = WARN; g.fillRect(w * .05 + 172, h * .055, 7, 7); label("LEAKED PATIENT", w * .05 + 184, h * .055 + 7); }

      if (step >= 1) {
        g.strokeStyle = step === 1 ? "rgba(255,107,94,.55)" : "rgba(16,214,194,.5)"; g.setLineDash([4, 6]);
        g.beginPath(); g.moveTo(w * WALL, h * .12); g.lineTo(w * WALL, h * .9); g.stroke(); g.setLineDash([]);
        label("TRAINING", w * .05, h * .12);
        label(step >= 3 ? "TEST · SEALED" : "TEST", w * (WALL + .04), h * .12);
      }
      if (step === 3) {
        for (let f = 0; f < 4; f++) {
          const x0 = w * (.04 + (WALL - .07) * f / 4), x1 = w * (.04 + (WALL - .07) * (f + 1) / 4);
          const on = f === fold;
          g.strokeStyle = on ? C.teal : "rgba(169,200,240,.14)"; g.lineWidth = on ? 1.5 : 1;
          g.strokeRect(x0 + 3, h * (TOP - .015), x1 - x0 - 6, h * (BOT - TOP + .03)); g.lineWidth = 1;
          label(on ? "VALIDATE" : "TRAIN", (x0 + x1) / 2, h * (BOT + .045), on ? C.teal : C.muted, "center");
        }
      }
      samples.forEach(sm => {
        const p = sm.p;
        let col = p.cond ? COND : CTRL, a = .95;
        if (step === 1 && p.leak) { col = WARN; a = sm.rnd ? 1 : .55; }
        if (step === 3 && p.test) a = .25;
        if (step === 3 && !p.test && p.fold !== fold) a = .5;
        if (step === 4) { if (p.test) col = p.cond ? C.teal : "#0b8f84"; else a = .22; }
        g.globalAlpha = a; g.fillStyle = col; g.fillRect(sm.x - sz / 2, sm.y - sz / 2, sz, sz);
      });
      g.globalAlpha = 1;
      if (step === 4) {
        testP.forEach((p, i) => {
          const [cx, cy] = tilePos(i % 2, Math.floor(i / 2), WALL + .04, .96, 2, 4);
          g.globalAlpha = .35 + .25 * Math.sin(t / 320 + i); g.strokeStyle = C.teal;
          g.strokeRect(cx * w - sz * 3.2, cy * h - sz * 2.6, sz * 6.4, sz * 5.2);
        });
        g.globalAlpha = 1;
      }
    }
    whileVisible(split, draw);
  }

  /* ---------- point-cloud brain ---------- */
  const brain = document.getElementById("brain");
  if (brain) {
    const g = brain.getContext("2d");
    const pts = []; let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    function shell(n, cx, cy, cz, rx, ry, rz, fold, keep) {
      for (let i = 0; i < n; i++) {
        const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1);
        const k = 1 + fold * (Math.sin(u * 13 + v * 3) * Math.sin(v * 11) + .6 * Math.sin(u * 23 + v * 17));
        const x = cx + rx * k * Math.sin(v) * Math.cos(u), y = cy + ry * k * Math.cos(v), z = cz + rz * k * Math.sin(v) * Math.sin(u);
        if (!keep || keep(x, y, z)) pts.push({ x, y, z, hot: false });
      }
    }
    for (const side of [-1, 1]) {
      shell(2300, side * .2, .12, 0, .36, .56, .98, .045, (x, y, z) => side * x > .025 && y > -.28 + .12 * Math.max(0, -z));
      shell(650, side * .3, -.26, .22, .2, .2, .5, .04, x => side * x > .12);
      for (let i = 0; i < 90; i++) { const t = r(); pts.push({ x: side * (.2 + .03 * r()), y: -.24 + .07 * Math.sin(t * 3) + .02 * r(), z: .3 - t * .55, hot: true }); }
    }
    shell(900, 0, -.4, -.7, .44, .22, .3, 0, null);
    for (let i = 0; i < 260; i++) { const a = r() * Math.PI * 2, h = r(); pts.push({ x: .1 * Math.cos(a), y: -.38 - h * .5, z: -.38 + .1 * Math.sin(a) - h * .1, hot: false }); }
    let ang = 1.1, last = 0;
    const tc = Math.cos(-.32), ts = Math.sin(-.32);
    whileVisible(brain, t => {
      if (last) ang += Math.min(50, t - last) * .00021;
      last = t;
      const [w, h] = fit(brain, g);
      g.clearRect(0, 0, w, h);
      const c = Math.cos(ang), sn = Math.sin(ang), S = Math.min(w, h) * .37;
      const proj = pts.map(p => {
        const x = p.x * c + p.z * sn, z0 = -p.x * sn + p.z * c;
        return { x: w / 2 + x * S, y: h / 2 - (p.y * tc - z0 * ts) * S, z: p.y * ts + z0 * tc, hot: p.hot };
      }).sort((a, b) => a.z - b.z);
      for (const p of proj) {
        const depth = Math.max(0, Math.min(1, (p.z + 1.1) / 2.2)), sz = p.hot ? 3 : 1.2 + 1.5 * depth;
        g.globalAlpha = p.hot ? .95 : .18 + .6 * depth;
        g.fillStyle = p.hot ? C.teal : C.trace;
        g.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
      g.globalAlpha = 1;
    });
  }
})();
