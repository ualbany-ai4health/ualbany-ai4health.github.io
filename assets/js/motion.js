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

  /* ---------- the method: patients split before training ---------- */
  const split = document.getElementById("split");
  if (split) {
    const g = split.getContext("2d"), cap = document.getElementById("split-cap");
    let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const pts = [];
    for (let i = 0; i < 40; i++) pts.push({ x: .15 + .7 * r(), y: .15 + .7 * r(), test: i % 5 === 0, fold: i % 4, ph: r() * 6.28 });
    pts.forEach(p => { p.cx = p.x; p.cy = p.y; });
    const trainPts = pts.filter(p => !p.test), testPts = pts.filter(p => p.test);
    let step = 0;
    const caps = ["40 patients · each dot is one person", "8 patients sealed for testing · 32 for training",
      "training patients rotate through 4 inner folds", "one score, measured on the 8 unseen patients"];
    const rail = document.querySelectorAll(".rail a");
    const so = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      step = +e.target.dataset.step; cap.textContent = caps[step];
      rail.forEach((a, i) => a.classList.toggle("on", i === step));
      if (reduce) draw(0);
    }), { rootMargin: "-45% 0px -45% 0px" });
    document.querySelectorAll(".step").forEach(x => so.observe(x));
    const target = p => {
      if (step === 0) return [p.x, p.y];
      if (p.test) { const k = testPts.indexOf(p); return [.78 + (k % 2) * .09, .25 + Math.floor(k / 2) * .14]; }
      const k = trainPts.indexOf(p); return [.12 + (k % 6) * .1, .18 + Math.floor(k / 6) * .12];
    };
    function draw(t) {
      const [w, h] = fit(split, g);
      g.clearRect(0, 0, w, h);
      if (step >= 1) {
        g.strokeStyle = "rgba(16,214,194,.5)"; g.setLineDash([4, 6]);
        g.beginPath(); g.moveTo(w * .7, h * .1); g.lineTo(w * .7, h * .86); g.stroke(); g.setLineDash([]);
        g.font = "400 11px 'IBM Plex Mono', monospace"; g.fillStyle = C.muted;
        g.fillText("TRAINING", w * .12, h * .1); g.fillText("TEST", w * .78, h * .1);
      }
      pts.forEach(p => {
        const [tx, ty] = target(p);
        p.cx += (tx - p.cx) * (reduce ? 1 : .06); p.cy += (ty - p.cy) * (reduce ? 1 : .06);
        const x = p.cx * w, y = p.cy * h;
        let col = C.trace, a = .9;
        if (step >= 1 && p.test) { col = step === 3 ? C.teal : C.dim; a = step === 3 ? 1 : .8; }
        if (step === 2 && !p.test) { const on = Math.floor(t / 900) % 4 === p.fold; col = on ? C.teal : C.trace; a = on ? 1 : .55; }
        if (step === 3 && !p.test) a = .35;
        g.globalAlpha = a; g.fillStyle = col; g.fillRect(x - 3, y - 3, 6, 6);
        if (step === 3 && p.test) { g.globalAlpha = .25 + .2 * Math.sin(t / 300 + p.ph); g.strokeStyle = col; g.strokeRect(x - 9, y - 9, 18, 18); }
        g.globalAlpha = 1;
      });
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
