'use strict';
/* Seabed and shore: pufferfish, bumphead parrotfish, moray eel, giant grouper, chambered nautilus, mudskipper,
 * fiddler crab, barracuda and sea star. Each show follows study.py (SEA) and research.md; drawing coordinates were read
 * off grid3.png and grid4.png (u across, v down, 0..1). */

(function () {
  // ------------------------------------------------------------------------------------------------ shared helpers

  /** 0 at both ends of an outing and 1 in between: idle motion (fins, breathing) fades in and out with it, so the
   * outing starts and ends on the still drawing. */
  const env = (t, d, a = 0.35) => S(0, a, t) * S(d, d - a, t);
  /** sx through a turn seen side-on: 1 -> -1 (the fish shows its back edge-on halfway). */
  const turnSx = k => Math.cos(Math.PI * ease(k));
  /** The first k (0..1) of a polyline's length: a line being drawn in. */
  function partial(pts, k) {
    if (k >= 1) return pts;
    const seg = []; let L = 0;
    for (let i = 2; i < pts.length; i += 2) { const d = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); seg.push(d); L += d; }
    let left = L * clamp(k, 0, 1); const out = [pts[0], pts[1]];
    for (let i = 0; i < seg.length; i++) {
      const x0 = pts[2 * i], y0 = pts[2 * i + 1], x1 = pts[2 * i + 2], y1 = pts[2 * i + 3];
      if (left >= seg[i]) { out.push(x1, y1); left -= seg[i]; }
      else { const f = seg[i] ? left / seg[i] : 0; out.push(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f); break; }
    }
    return out;
  }
  /** A line drawn in (k 0..1) and out again (k 1..2, erased from its start). */
  function inkLine(E, pts, k, w = 3) {
    if (k <= 0 || k >= 2) return;
    if (k <= 1) { const p = partial(pts, k); if (p.length >= 4) poly(E, p, w); return; }
    const rev = []; for (let i = pts.length - 2; i >= 0; i -= 2) rev.push(pts[i], pts[i + 1]);
    const p = partial(rev, 2 - k); if (p.length >= 4) poly(E, p, w);
  }
  /** Points of an ellipse, as a polyline. */
  function ellipsePts(x, y, rx, ry, n = 20, from = 0, to = TAU) {
    const p = []; for (let i = 0; i <= n; i++) { const a = from + (to - from) * i / n; p.push(x + rx * Math.cos(a), y + ry * Math.sin(a)); }
    return p;
  }
  /** A predator's shadow gliding over: a halftone fish silhouette heading left (m -1) or right. */
  function shadowFish(E, x, y, len, m = -1, lv = 0.35) {
    const p = [];
    for (let i = 0; i <= 16; i++) { const a = Math.PI * i / 16; p.push(x + m * len * 0.42 * Math.cos(a), y - len * 0.13 * Math.sin(a)); }
    for (let i = 0; i <= 16; i++) { const a = Math.PI * i / 16; p.push(x - m * len * 0.42 * Math.cos(a), y + len * 0.11 * Math.sin(a)); }
    poly(E, p, 0, true, 3, lv);
    poly(E, [x - m * len * 0.38, y, x - m * len * 0.62, y - len * 0.14, x - m * len * 0.56, y, x - m * len * 0.62, y + len * 0.13], 0, true, 3, lv);
    poly(E, [x - m * len * 0.05, y - len * 0.12, x - m * len * 0.16, y - len * 0.24, x - m * len * 0.22, y - len * 0.11], 0, true, 3, lv);
  }
  /** A wading bird's shadow, wings out, flapping with phase f. */
  function shadowBird(E, x, y, span, f, lv = 0.4) {
    const lift = 0.18 * span * Math.sin(f);
    poly(E, [x - span * 0.5, y - lift, x - span * 0.22, y - span * 0.05 - lift * 0.4, x, y - span * 0.06, x + span * 0.22, y - span * 0.05 - lift * 0.4,
      x + span * 0.5, y - lift, x + span * 0.2, y + span * 0.06, x + span * 0.08, y + span * 0.05, x, y + span * 0.22,
      x - span * 0.08, y + span * 0.05, x - span * 0.2, y + span * 0.06], 0, true, 3, lv);
    blob(E, x, y - span * 0.13, span * 0.05, span * 0.035, 0);
  }
  /** A swirl of water: a curl of three shrinking arcs, turned by rot degrees. */
  function swirl(E, x, y, r, rot, w = 3) {
    if (r < 2 || w < 0.3) return;
    arc(E, x, y, r, rot, 220, w); arc(E, x + r * 0.25 * Math.cos(rot * Math.PI / 180), y + r * 0.25 * Math.sin(rot * Math.PI / 180), r * 0.55, rot + 160, 200, w);
  }
  /** A four-point glint. */
  function glint(E, x, y, r, w = 3) { line(E, x - r, y, x + r, y, w); line(E, x, y - r * 0.7, x, y + r * 0.7, w); }
  /** Water dashes thrown from (x, y) toward angle deg, `age` s into a `life` s spurt. */
  function spurt(E, x, y, deg, age, life, n = 5, len = 60, reach = 220, spread = 26, seed = 0, w = 4) {
    const k = clamp(age / life, 0, 1); if (k <= 0 || k >= 1) return;
    for (let i = 0; i < n; i++) {
      const a = (deg + (rnd(i, seed) - 0.5) * 2 * spread) * Math.PI / 180, d = reach * (0.35 + 0.65 * rnd(i + 5, seed)) * Math.sqrt(k), l = len * (1 - k) * (0.6 + 0.6 * rnd(i + 9, seed));
      const x0 = x + Math.cos(a) * d, y0 = y + Math.sin(a) * d;
      if (l > 4) line(E, x0, y0, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l, w * (1 - 0.5 * k));
    }
  }
  /** Lines of water rushing into (x, y) from the side `deg` points to: suction. */
  function suction(E, x, y, deg, k, n = 6, reach = 260, seed = 0) {
    if (k <= 0 || k >= 1) return;
    for (let i = 0; i < n; i++) {
      const a = (deg + (rnd(i, seed) - 0.5) * 80) * Math.PI / 180, d0 = reach * (1 - k) * (0.6 + 0.6 * rnd(i + 3, seed)) + 30, l = 50 + 50 * rnd(i + 6, seed);
      line(E, x + Math.cos(a) * d0, y + Math.sin(a) * d0, x + Math.cos(a) * (d0 + l * (1 - k)), y + Math.sin(a) * (d0 + l * (1 - k)), 3);
    }
  }
  /** Sand grains sinking from (x, y). */
  function grains(E, x, y, age, life, n = 8, seed = 0, fall = 160, spread = 90) {
    const k = clamp(age / life, 0, 1); if (k >= 1) return;
    for (let i = 0; i < n; i++) disc(E, x + (rnd(i, seed) - 0.5) * spread * (0.4 + k), y + fall * k * (0.5 + rnd(i + 4, seed)) + 10 * Math.sin(age * 4 + i), 3 + 2 * rnd(i + 2, seed));
  }
  /** The player leaves its fill colour at paper after a paper-filled path: an empty ink fill puts it back to ink, so
   * blobs and discs drawn after it in the same layer come out ink. */
  const inkReset = E => poly(E, [-50, -50, -49, -50, -50, -49], 0, true, 1);
  /** A lumpy cloud of sand or silt: discs of one halftone level, which merge into one shape. */
  function sandCloud(E, x, y, r, level, seed = 0, n = 7) {
    if (level <= 0.02 || r < 2) return;
    for (let i = 0; i < n; i++) {
      const a = TAU * rnd(i, seed), d = r * 0.6 * Math.sqrt(rnd(i + 11, seed));
      cloud(E, x + Math.cos(a) * d * 1.35, y + Math.sin(a) * d * 0.7, r * (0.42 + 0.3 * rnd(i + 5, seed)), level);
    }
  }
  /** sandCloud that grows, drifts and thins out over its life. */
  function sandPuff(E, x, y, size, age, life, drift = 0, sink = 0, seed = 0) {
    const k = clamp(age / life, 0, 1); if (k >= 1 || age < 0) return;
    sandCloud(E, x + drift * k, y + sink * k, size * (0.5 + 0.9 * Math.sqrt(k)), 0.75 * (1 - k) ** 1.2, seed);
  }
  /** Mud droplets thrown up from (x, y) in arcs (dir -1 left, 1 right, 0 both). */
  function mudSplat(E, x, y, age, life, n = 5, size = 70, seed = 0, dir = 0) {
    const k = clamp(age / life, 0, 1); if (k >= 1) return;
    for (let i = 0; i < n; i++) {
      const side = dir || (i % 2 ? 1 : -1), sp = size * (0.8 + 0.8 * rnd(i, seed)), up = size * (1.6 + 1.2 * rnd(i + 3, seed));
      const dx = side * sp * (0.5 + i * 0.25) * k * 2, dy = -up * 4 * k * (1 - k) * 1.1;
      if (k < 0.97) blob(E, x + dx, y + dy, 10 + 6 * rnd(i, seed + 1), 8 + 5 * rnd(i + 1, seed + 1), 0);
    }
    if (k < 0.4) { const r = size * 0.9 * S(0, 0.4, k); oval(E, x, y + 2, r, r * 0.18, 0, 4 * (1 - k / 0.4) + 1); }
  }

  // ======================================================================================================= pufferfish
  (function () {
    // Its drawing is already blown up, spines out. Deflated, the pose is stretched long and low (sx 1.12, sy 0.8) and
    // the bend folds the spine ring flat against the body; V.inf runs 0 (deflated) .. 1 (the drawing).
    const PASS = [['bumble', 1.6], ['shadow', 0.5], ['gulp', 1.3], ['drift', 1.6]];
    const OUT = [['swell', 0.5], ['spit', 1.7], ['scull', 2.6], ['gulp', 1.35], ['float', 2.35]];
    const MOUTH = [0.9, 0.535], SMALL = 0.68;
    /** Spines and outline fold in toward the body when it is not blown up (fold 1 deflated, 0 the drawing). */
    function foldOff(u, v, fold, r, o) {
      const dx = (u - 0.57) * r / 0.40, dy = (v - 0.52) / 0.36, q = Math.hypot(dx, dy);
      if (q > 0.72) { const k = 0.72 * fold * (q - 0.72) / q * S(0.29, 0.40, u); o[0] -= (u - 0.57) * k; o[1] -= (v - 0.52) * k; }
    }
    /** Four gulps, 0.3 s apart, tt seconds into the series: each opens the mouth, then the body lurches a size up. */
    function gulps(tt) {
      let inf = 0, mouth = 0, lurch = 0;
      for (let j = 0; j < 4; j++) {
        const t0 = 0.05 + j * 0.3;
        mouth = Math.max(mouth, hump((tt - t0) / 0.17));
        inf += S(t0 + 0.07, t0 + 0.19, tt) / 4;
        lurch += hump((tt - t0 - 0.08) / 0.24);
      }
      return { inf, mouth, lurch };
    }
    function shape(P, inf, lurch = 0) {
      P.sx = lerp(1.12, 1, inf) * (1 + 0.035 * lurch); P.sy = lerp(0.8, 1, inf) * (1 + 0.05 * lurch);
    }
    M['pufferfish'] = {
      facing: 'R', size: [0.75, 0.6], maxScale: 1.9,
      pass: { dur: total(PASS), path(t, P, sc) {
        const b = beat(t, PASS), v = P.v; v.b = b.name; P.m = 1;
        const x0 = -0.5 * sc.sw * 1.15 - 60, x1 = WW * 0.34, y0 = HH * 0.5;
        let inf = 0, mouth = 0, lurch = 0;
        P.y = y0 + 12 * Math.sin(TAU * 0.9 * t);
        if (b.name === 'bumble') { P.x = lerp(x0, x1, 1 - (1 - b.k) ** 1.6); P.angle = 3 * sn(1.3, t); }
        else if (b.name === 'shadow') { P.x = x1 - 40 * ease(b.k); P.angle = 3 * sn(1.3, t) * (1 - b.k) - 4 * hump(b.k); v.startle = hump(b.k); }
        else if (b.name === 'gulp') {
          const g = gulps(b.t); inf = g.inf; mouth = g.mouth; lurch = g.lurch;
          P.x = x1 - 40 + 70 * inf; P.y -= 30 * inf;
        } else {   // too round to swim: the current takes it, tumbling
          inf = 1; P.x = lerp(x1 + 30, WW + 0.55 * sc.sw * 1.8 * 1.1 + 60, b.k ** 1.8); P.y -= 30 + 70 * ease(b.k);
          P.angle = 10 * Math.sin(TAU * 0.7 * b.t) * S(0, 0.3, b.k) + 14 * b.k;
        }
        P.scale = 1 + 0.8 * inf + 0.06 * lurch;
        shape(P, inf, lurch);
        v.inf = inf; v.mouth = mouth; v.fin = b.name === 'shadow' ? 1 - 0.75 * hump(b.k) : 1 - 0.6 * inf; v.env = 1;
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, D = total(OUT); v.b = b.name; P.m = 1; v.env = env(t, D);
        let inf = 1, mouth = 0, lurch = 0, x = sc.hx, y = sc.hy, s = 1, ang = 0;
        const xa = sc.hx - 150, xb = reachX(sc, 0.38), yb = reachY(sc, 0.55);
        if (b.name === 'swell') { s = 1 + 0.04 * ease(b.k); ang = -4 * ease(b.k); y -= 10 * ease(b.k); }
        else if (b.name === 'spit') {   // three spits; each jet shoves it backward and it shrinks a size
          let gone = 0, push = 0;
          for (let j = 0; j < 3; j++) { const t0 = 0.1 + j * 0.55; gone += S(t0, t0 + 0.28, b.t) / 3; push += S(t0, t0 + 0.42, b.t) / 3; mouth = Math.max(mouth, hump((b.t - t0 + 0.04) / 0.3)); }
          inf = 1 - gone; s = lerp(SMALL, 1.04, inf); x = lerp(sc.hx, xa, push); y = sc.hy - 10 * inf;
          ang = -4 * inf + 3 * Math.sin(TAU * 1.8 * b.t) * (1 - inf); v.spit = 1;
        } else if (b.name === 'scull') {   // small again: sculls ahead, hovers, backs up a little
          inf = 0; s = SMALL;
          const k1 = ease(clamp(b.k / 0.6, 0, 1));
          x = lerp(xa, xb, k1) - 60 * ease(clamp((b.k - 0.62) / 0.3, 0, 1)); y = lerp(sc.hy, yb, k1) + 8 * Math.sin(TAU * 0.9 * b.t);
          ang = 4 * Math.sin(TAU * 1.2 * b.t);
        } else if (b.name === 'gulp') {
          const g = gulps(b.t * 1.0); inf = g.inf; mouth = g.mouth; lurch = g.lurch;
          s = lerp(SMALL, 1, inf); x = xb - 60 + 40 * inf; y = lerp(yb, sc.hy - 50, ease(b.k)); ang = -6 * inf * S(0.6, 1, b.k);
        } else {   // a balloon: floats back home, bobbing and rolling to a stop
          const k = ease(b.k);
          x = lerp(xb - 20, sc.hx, k); y = lerp(sc.hy - 50, sc.hy, k) + 14 * Math.sin(Math.PI * 2 * b.k) * (1 - k);
          ang = -6 * (1 - S(0, 0.4, b.k)) + 8 * Math.sin(TAU * 0.8 * b.t) * hump(b.k) ;
        }
        P.x = x; P.y = y; P.scale = s + 0.06 * lurch; P.angle = ang; shape(P, inf, lurch);
        if (b.name === 'float' || b.name === 'swell') { P.sx = 1; P.sy = 1; }
        v.inf = inf; v.mouth = mouth; v.fin = 1 - 0.6 * inf;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, e = V.env, fold = 1 - V.inf, fin = V.fin * e;
        if (fold > 0.001) foldOff(u, v, fold, r, o);   // spines lie flat when it is not blown up
        rot(o, u, v, 0.27, 0.5, 6 * fin * sn(1.1, t), S(0.29, 0.22, u) * box(u, v, 0.05, 0.3, 0.3, 0.7), r);
        rot(o, u, v, 0.355, 0.21, 22 * fin * sn(3, t), box(u, v, 0.24, 0.05, 0.38, 0.24, 0.03), r);
        rot(o, u, v, 0.35, 0.79, -22 * fin * sn(3, t), box(u, v, 0.24, 0.76, 0.37, 0.95, 0.03), r);
        scl(o, u, v, 0.725, 0.575, 1 - 0.45 * fin * (0.5 + 0.5 * sn(6, t)), 1, box(u, v, 0.6, 0.5, 0.73, 0.66, 0.02));
      },
      fx(t, P, sc, E, mode) {
        const V = P.v, mo = [0, 0]; foldOff(MOUTH[0], MOUTH[1], 1 - V.inf, 1.25, mo);
        const [mx, my] = at(sc, P, MOUTH[0] + 0.01 + mo[0], MOUTH[1] + mo[1]);
        if (mode === 'pass') {
          const ts = t - 1.25;   // a predator's shadow sweeps over, right to left
          if (ts > 0 && ts < 1.3) { E.back = true; shadowFish(E, lerp(WW + 900, -900, ts / 1.3), 300, 1300, -1, 0.42); E.back = false; }
          if (V.b === 'drift') { const [bx, by] = at(sc, P, 0.2, 0.5); streaks(E, bx, by, 5, 120, sc.sh * 1.2, t, 3, 3); }
          if (V.b === 'shadow') { const [ex, ey] = at(sc, P, 0.75, 0.25); line(E, ex - 30, ey - 40, ex - 40, ey - 75, 4); line(E, ex + 5, ey - 50, ex + 10, ey - 85, 4); line(E, ex + 40, ey - 40, ex + 55, ey - 70, 4); }
        }
        if (V.mouth > 0.02 && !V.spit) {   // the gulp: an open mouth with water rushing in
          blob(E, mx, my, 16 * V.mouth * P.scale, 20 * V.mouth * P.scale, 0);
          suction(E, mx, my, 0, V.mouth, 5, 200 * P.scale, Math.floor(t * 3.3));
        }
        if (V.spit) {   // the jets: water shot forward out of the mouth
          const b = beat(t, OUT);
          for (let j = 0; j < 3; j++) {
            const t0 = 0.1 + j * 0.55, a = b.t - t0;
            spurt(E, mx + 10, my, 0, a, 0.6, 8, 110 * (1 - 0.2 * j), 380 * (1 - 0.2 * j), 12, j + 1, 6);
            if (a > 0 && a < 0.2) oval(E, mx + 6, my, 12, 16, 0, 4);
            if (a > 0.1) bubbles(E, a, mx + 60 + 140 * Math.min(a, 0.5), my, 9, 1.0, 2, 120, j + 30);
          }
        }
        if (V.inf > 0.99 && V.b === 'gulp') { const k = clamp((beat(t, mode === 'pass' ? PASS : OUT).t - 1.0) / 0.3, 0, 1); if (k > 0 && k < 1) { const [cx, cy] = at(sc, P, 0.57, 0.52), R = sc.sh * P.scale * 0.55 * (1 + 0.15 * k); for (let i = 0; i < 12; i++) { const a = TAU * i / 12 + 0.2; line(E, cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a) * (R + 40 * (1 - k)), cy + Math.sin(a) * (R + 40 * (1 - k)), 4); } } }
        if (V.b === 'bumble' || V.b === 'scull' || V.b === 'float') { const [gx, gy] = at(sc, P, 0.7, 0.42); bubbles(E, t, gx, gy, 1.1, 1.2, 2, 160, 11); }
      },
    };
  })();

  // ============================================================================================= bumphead parrotfish
  (function () {
    const PASS = [['row', 4.5]];
    const OUT = [['row', 2.2], ['rear', 0.6], ['ram', 0.15], ['recoil', 0.55], ['chew', 1.6], ['sand', 0.9], ['turn', 0.55], ['home', 1.75], ['turn2', 0.55]];
    const VENT = [0.56, 0.77], BEAK = [0.945, 0.575];
    // the staghorn coral it rams (design px): [width, points]; the first branch ends at ROOT, where the piece breaks off
    const CORAL = [
      [30, [1700, 1090, 1690, 980, 1672, 900, 1650, 820, 1628, 740, 1612, 690]],
      [24, [1672, 900, 1740, 850, 1770, 770, 1790, 690, 1800, 620]],
      [22, [1690, 980, 1620, 940, 1570, 880, 1540, 820]],
      [20, [1628, 740, 1680, 700, 1700, 640, 1705, 585]],
      [20, [1740, 850, 1820, 820, 1860, 750]],
      [16, [1790, 690, 1840, 650, 1870, 600]],
      [16, [1770, 770, 1728, 720]],
      [16, [1570, 880, 1560, 828]],
    ];
    const TIPS = [[1800, 620], [1540, 820], [1705, 585], [1860, 750], [1870, 600], [1728, 720], [1560, 828]];
    const PIECE = [0, 0, -16, -58, -36, -112, -16, -58, -52, -74];   // from its root: the branch tip and a twig
    const ROOT = [1612, 690];
    const rowAng = t => 25 * Math.sin(TAU * 2 * t);
    M['bumphead-parrotfish'] = {
      facing: 'R',
      pass: { dur: total(PASS), path(t, P, sc) {
        const v = P.v; v.b = 'row'; v.env = 1; v.row = 1;
        const q = surge(t / 4.5, 9, 0.22);
        P.m = 1; P.x = lerp(-0.5 * sc.sw - 90, WW + 0.5 * sc.sw + 90, q); P.y = HH * 0.47 + 10 * Math.sin(TAU * 2 * t - 1);
        P.angle = 5 + 1.2 * Math.sin(TAU * 2 * t);
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, D = total(OUT); v.b = b.name; v.env = env(t, D); v.row = 1;
        const xr = sc.hx + 330, xb = sc.hx + 270, xh = sc.hx + 440, y1 = sc.hy + 80;
        P.m = 1; P.x = sc.hx; P.y = sc.hy;
        if (b.name === 'row') { const k = ease(b.k); P.x = lerp(sc.hx, xr, k); P.y = lerp(sc.hy, y1, k) + 6 * Math.sin(TAU * 2 * b.t) * hump(b.k); P.angle = 3 * hump(b.k); }
        else if (b.name === 'rear') { const k = ease(b.k); P.x = lerp(xr, xb, k); P.y = y1 - 20 * k; P.angle = -11 * k; P.sx = 1 - 0.05 * k; P.sy = 1 + 0.03 * k; v.row = 1 - 0.6 * k; }
        else if (b.name === 'ram') { const k = b.k * b.k; P.x = lerp(xb, xh, k); P.y = y1 - 20 * (1 - k); P.angle = lerp(-11, 3, k); P.sx = 0.95 + 0.11 * k; P.sy = 1.03 - 0.05 * k; v.row = 0.4 * (1 - b.k); }
        else if (b.name === 'recoil') {   // the crunch: squash against the coral, then bounce off
          const k = b.k; P.x = xh - 55 * ease(k) + 8 * Math.sin(TAU * 3 * b.t) * (1 - k); P.y = y1; P.angle = 3 * (1 - ease(k));
          P.sx = 1.06 - 0.12 * hump(k * 2) * (k < 0.5 ? 1 : 0) - 0.06 * ease(k); P.sy = 0.98 + 0.06 * hump(clamp(k * 2, 0, 1)) + 0.02 * ease(k);
          const sk = (1 - k) ** 2; P.shakeX = 14 * sk * Math.sin(TAU * 13 * b.t); P.shakeY = 9 * sk * Math.sin(TAU * 9 * b.t + 1); v.row = 0.3 * ease(k);
        } else if (b.name === 'chew') { v.row = 0.3 + 0.7 * S(0, 0.4, b.k); P.x = xh - 55 - 25 * ease(b.k); P.y = y1 + 4 * Math.sin(TAU * 1.9 * b.t); v.chew = hump(frac(b.t * 1.9)) * S(0, 0.1, b.k) * S(1, 0.85, b.k); }
        else if (b.name === 'sand') { P.x = xh - 80 - 10 * ease(b.k); P.y = y1 - 6 * hump(b.k); P.angle = -3 * hump(b.k); P.sy = 1 + 0.04 * hump(b.k * 2); }
        else if (b.name === 'turn') { P.x = xh - 90 - 30 * ease(b.k); P.y = y1; P.sx = turnSx(b.k); P.sy = 1 + 0.04 * hump(b.k); }
        else if (b.name === 'home') { const k = ease(b.k); P.x = lerp(xh - 120, sc.hx, k); P.y = lerp(y1, sc.hy, k) + 8 * Math.sin(TAU * 2 * b.t) * hump(b.k); P.sx = -1; P.angle = -3 * hump(b.k); }
        else { P.sx = -turnSx(b.k); P.sy = 1 + 0.04 * hump(b.k); }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, e = V.env, row = V.row * e;
        // pectoral rows about its base, turning edge-on on the return
        const ra = rowAng(t);
        rot(o, u, v, 0.735, 0.585, ra * row, box(u, v, 0.56, 0.52, 0.75, 0.65, 0.02), r);
        scl(o, u, v, 0.735, 0.585, 1 - 0.3 * row * (0.5 - 0.5 * Math.cos(TAU * 2 * t)), 1, box(u, v, 0.56, 0.52, 0.75, 0.65, 0.02));
        // the tail barely sweeps (it rows), a lag behind the fin
        rot(o, u, v, 0.2, 0.5, 6 * e * Math.sin(TAU * 1 * t - 1.2), S(0.24, 0.16, u), r);
        wave(o, 1 - u, t, 0.008 * e, 0.8, 1, S(0.6, 0.3, u), 1);
        if (V.chew) {   // throat teeth grinding: the head squeezes
          scl(o, u, v, 0.86, 0.45, 1 + 0.035 * V.chew, 1 - 0.07 * V.chew, S(0.72, 0.84, u));
          shift(o, 0, 0.018 * V.chew, box(u, v, 0.84, 0.5, 0.97, 0.68, 0.02));
        }
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {   // a puff of sand every 1.5 s from the vent; it trails, sinks and settles: it is making the beach
          emit(t, 1.5, 3.2, (i, te, age) => {
            const Q = poseAt(te), [x, y] = at(sc, Q, VENT[0], VENT[1]), k = age / 3.2;
            E.back = true;
            sandPuff(E, x - 60 - 60 * Math.sqrt(age), y + 20, 80, age, 2.4, -70, 200, i);
            sandPuff(E, x - 150 - 50 * Math.sqrt(age), y + 50, 60, age - 0.12, 2.2, -50, 260, i + 9);
            grains(E, x - 90, y + 30, age, 3.2, 12, i, 300, 180);
            if (k > 0.3) { const h = 34 * S(0.3, 0.9, k); poly(E, [x - 300, HH + 4, x - 170, HH - h, x - 60, HH - h * 0.75, x + 70, HH + 4], 3, true, 3, 0.45); }
            E.back = false;
          }, 0.35);
          return;
        }
        const D = total(OUT), b = beat(t, OUT), ts = beatStart(OUT, 'recoil'), tc = beatStart(OUT, 'home');
        // the coral: drawn in at the start, out again on the way home
        const draw = t < tc ? clamp(t / 1.0, 0, 1) : 1 + clamp((t - tc - 0.2) / 1.3, 0, 1);
        E.back = true;
        CORAL.forEach(([w, p], i) => { const k = draw <= 1 ? clamp(draw * 1.8 - i * 0.1, 0, 1) : 1 + clamp((draw - 1) * 1.8 - (7 - i) * 0.1, 0, 1); inkLine(E, p, k, w); });
        const knob = clamp((draw - 0.55) * 3, 0, 1) * clamp((1.6 - draw) * 4, 0, 1);
        if (knob > 0) TIPS.forEach(([x, y], i) => circle(E, x, y, (i < 2 ? 15 : 12) * knob, 4));
        E.back = false;
        // the piece: on the branch until the ram, then held in the beak and ground smaller with each chew
        const left = t < ts ? 1 : t < beatStart(OUT, 'sand') ? 1 - 0.85 * clamp((t - ts - 0.3) / 1.7, 0, 1) : 0;
        if (left > 0.05) {
          let x = ROOT[0], y = ROOT[1], a = 0, s = 1;
          if (t >= ts) { const [bx, by] = at(sc, P, BEAK[0], BEAK[1]); x = bx - 10; y = by + 70 * left; a = 20 + 30 * clamp((t - ts) * 3, 0, 1); s = left; }
          const ca = Math.cos(a * Math.PI / 180), sa = Math.sin(a * Math.PI / 180), pts = [];
          for (let i = 0; i < PIECE.length; i += 2) pts.push(x + (PIECE[i] * ca - PIECE[i + 1] * sa) * s, y + (PIECE[i] * sa + PIECE[i + 1] * ca) * s);
          const k1 = t < ts ? clamp(draw * 1.8 - 0.25, 0, 1) : 1, k2 = t < ts ? clamp(draw * 1.8 - 0.5, 0, 1) : 1;
          inkLine(E, pts.slice(0, 6), k1, 20 * Math.max(0.5, s)); inkLine(E, pts.slice(6, 10), k2, 14 * Math.max(0.5, s));
          if (k1 >= 1) circle(E, pts[4], pts[5], 12 * Math.max(0.5, s) * (t < ts ? knob : 1), 4);
        }
        // the crunch: a starburst at the break and splinters flying off it
        const kc = (t - ts) / 0.7, cx = ROOT[0] - 25, cy = ROOT[1] - 70;
        if (kc > 0 && kc < 1) {
          for (let i = 0; i < 11; i++) {
            const a = -Math.PI * (0.05 + 0.9 * rnd(i, 4)), d = 40 + 300 * kc * (0.5 + rnd(i, 5)), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d + 420 * kc * kc;
            line(E, x, y, x + 18 * Math.cos(a + 1.2 + 6 * kc), y + 18 * Math.sin(a + 1.2 + 6 * kc), 5);
          }
          if (kc < 0.4) for (let i = 0; i < 10; i++) { const a = TAU * (i + 0.3 * rnd(i, 2)) / 10, r0 = 40 + 220 * kc, r1 = r0 + (40 + 40 * rnd(i, 3)) * (1 - kc / 0.4); line(E, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, 6); }
        }
        if (V.b === 'chew') { const [bx, by] = at(sc, P, BEAK[0], BEAK[1] + 0.05); emit(b.t, 0.53, 1.0, (i, te, age) => grains(E, bx, by, age, 1.0, 4, i + 20, 140, 30), 0.2); }
        // the sand: one big cloud out of the vent, billowing behind and settling slowly
        const tsd = beatStart(OUT, 'sand'), ks = t - tsd;
        if (ks > 0) {
          const Q = Ink.poseAt('bumphead-parrotfish', 'outing', tsd + 0.15), [x, y] = at(sc, Q, VENT[0], VENT[1]), life = D - tsd - 0.05;
          E.back = true;
          for (let j = 0; j < 4; j++) sandPuff(E, x - 70 - 110 * j - 80 * Math.sqrt(Math.max(0, ks - j * 0.08)), y + 25 * j, 110 + 30 * j, ks - j * 0.08, life - j * 0.08, -40, 90, j + 3);
          grains(E, x - 160, y + 30, ks, life, 18, 7, 300, 360);
          E.back = false;
        }
        if (V.b === 'row' || V.b === 'home') { const [gx, gy] = at(sc, P, 0.8, 0.3); bubbles(E, t, gx, gy, 1.3, 1.1, 2, 150, 4, 0.3, D - 1.2); }
      },
    };
  })();

  // ======================================================================================================== moray eel
  (function () {
    // The body's centre line, head (s = 0) to tail tip (s = 1), in drawing units. The body wave displaces every grid
    // point along the normal of its nearest spine point, so the whole long body undulates, not just its y.
    const SPINE = [[0.95, 0.38], [0.86, 0.40], [0.79, 0.43], [0.72, 0.47], [0.65, 0.53], [0.58, 0.60], [0.51, 0.665], [0.44, 0.715],
      [0.36, 0.735], [0.28, 0.71], [0.2, 0.65], [0.13, 0.56], [0.08, 0.45], [0.07, 0.33], [0.085, 0.21]];
    const R = 1.5, near = new Map();
    let LEN = 0; const CUM = [0];
    for (let i = 1; i < SPINE.length; i++) { LEN += Math.hypot((SPINE[i][0] - SPINE[i - 1][0]) * R, SPINE[i][1] - SPINE[i - 1][1]); CUM.push(LEN); }
    /** Nearest spine point to (u, v): [s 0..1, normal x (u units), normal y, distance]. */
    function nearest(u, v) {
      const key = Math.round(u * 1000) * 10000 + Math.round(v * 1000);
      if (near.has(key)) return near.get(key);
      let best = [0, 0, 1, 9];
      for (let i = 1; i < SPINE.length; i++) {
        const ax = SPINE[i - 1][0] * R, ay = SPINE[i - 1][1], bx = SPINE[i][0] * R, by = SPINE[i][1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        const f = clamp(((u * R - ax) * dx + (v - ay) * dy) / L2, 0, 1), px = ax + dx * f, py = ay + dy * f, d = Math.hypot(u * R - px, v - py);
        if (d < best[3]) { const L = Math.sqrt(L2); best = [(CUM[i - 1] + L * f) / LEN, -dy / L / R, dx / L, d]; }
      }
      near.set(key, best);
      return best;
    }
    /** The body wave's offset at s: 1.2 wavelengths along the body, amplitude 1% at the head to 6% at the tail. */
    const waveAt = (s, ph) => (0.012 + 0.065 * s ** 1.3) * Math.sin(TAU * (1.2 * s) - ph);
    const PASS = [['swim', 4.5]];
    const OUT = [['rock', 0.7], ['back', 1.9], ['breathe', 1.9], ['out', 2.0], ['poke', 1.7], ['home', 1.4]];
    const NECK = [0.8, 0.415], HEAD = [0.955, 0.385], MOUTHPT = [0.95, 0.42];
    const MOUTH = [236, 560];   // the den's mouth, on the reef wall at the left edge
    const FLOOR = 985, HOLES = [[640, FLOOR + 6], [985, FLOOR + 4]];
    const WALL = [0, 110, 120, 118, 196, 190, 222, 320, 232, 452, 226, 515, 236, 600, 250, 660, 236, 760, 252, 880, 236, 1000, 246, 1090, 0, 1090];
    /** The head's path out of the den: an S through two holes on the sand, then up to its home spot. */
    function headPath(k, sc) {
      const pts = [[MOUTH[0] + 110, MOUTH[1] + 10], [420, 760], [560, 700], [HOLES[0][0], HOLES[0][1] - 10]];
      return pts;
    }
    M['moray-eel'] = {
      facing: 'R',
      pass: { dur: total(PASS), path(t, P, sc) {
        const v = P.v; v.b = 'swim'; v.amp = 1; v.ph = TAU * 1.0 * t; v.env = 1;
        v.jaw = hump(frac(t / 1.5 + 0.3) / 0.5);
        P.m = 1; P.x = lerp(-0.5 * sc.sw - 60, WW + 0.5 * sc.sw + 60, t / 4.5); P.y = HH * 0.5 + 14 * Math.sin(TAU * 0.5 * t);
        P.angle = 1.5 * Math.sin(TAU * t - 0.4);
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, D = total(OUT); v.b = b.name; v.env = env(t, D, 0.5);
        v.amp = 0; v.ph = 0; v.jaw = 0; P.m = 1;
        const den = 0.8;   // its size inside the den (it is further away from us there)
        const dx = MOUTH[0] + 0.165 * sc.sw * den, inX = dx - (NECK[0] - 0.5) * sc.sw * den, inY = MOUTH[1] - (NECK[1] - 0.5) * sc.sh * den;
        if (b.name === 'rock') { v.jaw = 0.6 * hump(b.k); v.amp = 0.3 * S(0.3, 1, b.k); v.ph = -TAU * 1.1 * t; }
        else if (b.name === 'back') {   // tail first into the den, the wave running backward, tail to head
          const k = ease(b.k);
          P.x = lerp(sc.hx, inX, k); P.y = lerp(sc.hy, inY, k) + 30 * Math.sin(Math.PI * k); P.scale = lerp(1, den, k);
          P.angle = 6 * Math.sin(Math.PI * k); v.amp = 0.8 + 0.2 * hump(b.k); v.ph = -TAU * 1.1 * t;
        } else if (b.name === 'breathe') {   // only the head out: the mouth opening and shutting, all the time
          P.x = inX; P.y = inY + 5 * Math.sin(TAU * 0.6 * b.t); P.scale = den; v.amp = 0.8 * (1 - S(0, 0.35, b.k)) + 0.06 * S(0.2, 0.5, b.k) * (1 - S(0.85, 1, b.k)); v.ph = -TAU * 1.1 * t;
          v.jaw = 0.5 + 0.5 * Math.sin(TAU * (b.t / 0.63) - Math.PI / 2); v.look = Math.sin(TAU * 0.4 * b.t) * S(0, 0.15, b.k) * (1 - S(0.8, 1, b.k));
          P.angle = 2 * Math.sin(TAU * 0.5 * b.t);
        } else if (b.name === 'out' || b.name === 'poke') {
          // the head follows an S across the sand; the drawing is pinned at the head and turned along the path
          const tt = b.name === 'out' ? b.k * 0.55 : 0.55 + b.k * 0.45;
          const [hx0, hy0] = Ink.pointOf(sc, { x: inX, y: inY + 5 * Math.sin(TAU * 0.6 * 1.9), scale: den, sx: 1, sy: 1, angle: 2 * Math.sin(TAU * 0.5 * 1.9), mirror: false }, HEAD[0], HEAD[1]);
          // key points of the head: leaving the den, dip into hole 1, up and over, dip into hole 2
          const K = [[0, hx0, hy0, 0], [0.22, 470, 650, 24], [0.42, HOLES[0][0] + 30, HOLES[0][1] - 36, 38], [0.55, HOLES[0][0] + 30, HOLES[0][1] - 36, 38],
            [0.7, 820, 820, -10], [0.88, HOLES[1][0] + 30, HOLES[1][1] - 36, 38], [1.0, HOLES[1][0] + 30, HOLES[1][1] - 36, 38]];
          let i = 1; while (i < K.length - 1 && tt > K[i][0]) i++;
          const A = K[i - 1], B2 = K[i], f = ease((tt - A[0]) / (B2[0] - A[0]));
          const hx = lerp(A[1], B2[1], f), hy = lerp(A[2], B2[2], f), ang = lerp(A[3], B2[3], f);
          P.scale = den; pin(sc, P, HEAD[0], HEAD[1], hx, hy, ang);
          v.amp = 0.9 * (b.name === 'out' ? S(0, 0.25, b.k) : 1); v.ph = TAU * 1.1 * t;
          const dip = b.name === 'out' ? S(0.42, 0.55, b.k * 0.55 / 0.55) * 0 : 0;
          v.dip = (tt > 0.42 && tt < 0.55) ? hump((tt - 0.42) / 0.13) : (tt > 0.88 ? hump((tt - 0.88) / 0.12) : 0);
          v.jaw = lerp(0.5 + 0.5 * Math.sin(TAU * (1.9 / 0.63) - Math.PI / 2), 0.2 + 0.2 * Math.sin(TAU * 0.8 * t) + dip, b.name === 'out' ? S(0, 0.2, b.k) : 1);
        } else {   // glides back up to its spot and lies still, mouth working
          const hx1 = HOLES[1][0] + 30, hy1 = HOLES[1][1] - 36;
          const Q = { x: 0, y: 0, scale: den, sx: 1, sy: 1, angle: 38, mirror: false }; pin(sc, Q, HEAD[0], HEAD[1], hx1, hy1, 38);
          const k = ease(b.k);
          P.x = lerp(Q.x, sc.hx, k); P.y = lerp(Q.y, sc.hy, k) - 40 * hump(b.k); P.scale = lerp(den, 1, k); P.angle = lerp(38, 0, ease(clamp(b.k * 1.3, 0, 1)));
          v.amp = 0.9 * (1 - k); v.ph = TAU * 1.1 * t; v.jaw = 0.3 * hump(b.k);
        }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, e = V.env;
        if (V.amp > 0.001) {
          const [s, nx, ny, d] = nearest(u, v), w = S(0.2, 0.1, d);
          const a = V.amp * waveAt(s, V.ph) * w;
          o[0] += nx * a; o[1] += ny * a;
        }
        const head = S(0.75, 0.82, u) * box(u, v, 0.7, 0.2, 1, 0.55);
        rot(o, u, v, 0.8, 0.43, 3 * Math.sin(TAU * 0.7 * t) * e + 8 * (V.look || 0) * e + 22 * (V.dip || 0), head, r);
        if (V.jaw) rot(o, u, v, 0.83, 0.41, 20 * V.jaw * e, box(u, v, 0.84, 0.405, 1.0, 0.5, 0.02), r);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {   // little swirls shed at each tail crest, left behind in the water
          emit(t, 1.0, 1.4, (i, te, age) => {
            const Q = poseAt(te), [x, y] = at(sc, Q, 0.085, 0.21);
            swirl(E, x - 30 * age, y - 20 * age, 22 + 30 * age, i * 70 + age * 160, 4 * (1 - age / 1.4));
          }, 0.15);
          emit(t, 1.0, 1.2, (i, te, age) => {
            const Q = poseAt(te), [x, y] = at(sc, Q, 0.36, 0.78);
            swirl(E, x - 20 * age, y + 20 * age, 16 + 24 * age, i * 50 + 200 - age * 140, 3 * (1 - age / 1.2));
          }, 0.65);
          return;
        }
        const D = total(OUT), b = beat(t, OUT), th = beatStart(OUT, 'home');
        // the reef wall and the den, drawn in first and taken away on the way home
        const kin = clamp(t / 0.6, 0, 1), kout = clamp((t - th - 0.3) / 0.9, 0, 1), lv = 0.42 * kin * (1 - kout);
        if (lv > 0.01) {
          poly(E, WALL, 0, true, 2);
          poly(E, WALL, 0, true, 3, lv);
          inkReset(E);
          inkLine(E, WALL.slice(2, -2), kin + kout, 4);
          const hk = kin * (1 - kout);
          // the den: a dark fissure down the reef's edge; the eel's body is in it wherever it leaves the rock
          const L = [236, 470, 206, 530, 196, 620, 206, 720, 196, 820, 206, 920, 200, 1000, 210, 1095], Rr = [236, 470, 252, 540, 246, 620, 256, 720, 244, 820, 252, 920, 258, 1000, 252, 1095];
          const crack = []; for (let i = 0; i < L.length; i += 2) crack.push(lerp(232, L[i], hk), L[i + 1]);
          for (let i = Rr.length - 2; i >= 0; i -= 2) crack.push(lerp(232, Rr[i], hk), Rr[i + 1]);
          poly(E, crack, 0, true, 1);
          for (let i = 0; i < 4; i++) { const yy = 230 + i * 230; inkLine(E, [40 + 30 * i, yy, 120 + 20 * i, yy + 30, 170, yy + 80], kin + kout, 3); }
        }
        // the sand floor with its two holes
        const fk = clamp((t - 2.6) / 1.0, 0, 1), fo = clamp((t - th - 0.2) / 0.9, 0, 1);
        if (fk > 0 && fo < 1) {
          E.back = true;
          const pts = []; for (let x = 300; x <= 1500; x += 40) pts.push(x, FLOOR + 8 * Math.sin(x / 90));
          inkLine(E, pts, fk + fo, 3);
          for (const [hx, hy] of HOLES) blob(E, hx, hy, 46 * fk * (1 - fo), 13 * fk * (1 - fo), 0);
          E.back = false;
        }
        if (b.name === 'poke' || b.name === 'out') {   // a puff of sand at each poke
          const tt = b.name === 'out' ? b.k * 0.55 : 0.55 + b.k * 0.45, ag1 = (tt - 0.44) * 3.7, ag2 = (tt - 0.9) * 3.7;
          if (ag1 > 0) puff(E, HOLES[0][0], HOLES[0][1] - 10, 70, ag1, 1.6, 50);
          if (ag2 > 0) puff(E, HOLES[1][0], HOLES[1][1] - 10, 70, ag2, 1.6, 50);
        }
        if (b.name === 'home') { const ag = b.t + 0.45; puff(E, HOLES[1][0], HOLES[1][1] - 10, 70, ag + 0.7, 1.6, 50); }
        if (b.name === 'breathe') { const [mx, my] = at(sc, P, MOUTHPT[0], MOUTHPT[1]); emit(b.t, 0.63, 0.9, (i, te, age) => { const k = age / 0.9; line(E, mx + 20 + 90 * k, my + 10 - 20 * k, mx + 50 + 90 * k, my + 10 - 20 * k, 3 * (1 - k) + 0.5); }, 0.3); }
        if (b.name === 'out') emit(t, 0.5, 1.1, (i, te, age) => { const Q = poseAt(te), [x, y] = at(sc, Q, 0.2, 0.68); swirl(E, x, y + 10 * age, 14 + 20 * age, i * 80 + age * 150, 3 * (1 - age / 1.1)); }, beatStart(OUT, 'out') + 0.4);
      },
    };
  })();

  // ===================================================================================================== giant grouper
  (function () {
    const PASS = [['lumber', 2.0], ['boom', 1.0], ['lumber2', 2.0]];
    const OUT = [['patrol', 2.2], ['turn', 0.9], ['hover', 1.9], ['gulp', 0.1], ['swallow', 0.7], ['boom', 1.0], ['home', 1.8], ['turn2', 0.8]];
    const MOUTH = [0.965, 0.5];
    /** Push and hold: in each 1 s, a push for 0.55 s and a slow glide; continuous at every cycle. */
    const push = t => Math.floor(t) + 0.85 * ease(clamp(frac(t) / 0.55, 0, 1)) + 0.15 * frac(t);
    const ROCK = [1430, 1090, 1452, 900, 1440, 700, 1468, 480, 1500, 300, 1560, 160, 1680, 110, 1930, 100, 1930, 1090];
    const CAVE = [1930, 300, 1760, 310, 1640, 380, 1585, 500, 1572, 640, 1600, 790, 1700, 860, 1930, 870];
    M['giant-grouper'] = {
      facing: 'R', size: [0.95, 0.8],
      pass: { dur: total(PASS), path(t, P, sc) {
        const b = beat(t, PASS), v = P.v; v.b = b.name; v.env = 1;
        const units = 2 + 0.15 + 2, x0 = -0.5 * sc.sw - 80, x1 = WW + 0.5 * sc.sw + 80;
        let q = b.name === 'lumber' ? push(t) : b.name === 'boom' ? 2 + 0.15 * b.k : 2.15 + push(b.t);
        P.m = 1; P.x = lerp(x0, x1, q / units); P.y = HH * 0.5 + 8 * Math.sin(TAU * 0.5 * t);
        P.angle = 1.5 * Math.sin(TAU * t - 1);
        if (b.name === 'boom') {   // the swim bladder booms: the whole fish shudders
          const k = b.k, a = hump(clamp(k * 1.4, 0, 1));
          P.shakeX = 0.01 * sc.sh * a * Math.sin(TAU * 15 * b.t); P.shakeY = 0.01 * sc.sh * a * Math.sin(TAU * 11 * b.t + 1);
          P.sx = 1 + 0.015 * a * Math.sin(TAU * 15 * b.t); P.sy = 1 + 0.02 * a; v.boom = a;
        }
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, D = total(OUT); v.b = b.name; v.env = env(t, D);
        const xc = sc.hx + 430, units = 2.2;
        P.m = 1; P.x = sc.hx; P.y = sc.hy;
        if (b.name === 'patrol') { P.x = lerp(sc.hx, xc - 20, push(b.t * 1.0) / units); P.y = sc.hy + 6 * Math.sin(TAU * 0.5 * b.t); }
        else if (b.name === 'turn') { P.x = xc - 20 + 20 * ease(b.k); P.sx = turnSx(b.k); P.sy = 1 + 0.04 * hump(b.k); P.y = sc.hy - 10 * hump(b.k); }
        else if (b.name === 'hover') { P.x = xc; P.sx = -1; P.y = sc.hy + 6 * Math.sin(TAU * 0.5 * b.t); v.breath = Math.sin(TAU * 1.1 * b.t); }
        else if (b.name === 'gulp') { P.x = xc - 50; P.sx = -1; P.y = sc.hy + 6 * Math.sin(TAU * 0.5 * 1.9); v.swell = 1; v.cut = true; }
        else if (b.name === 'swallow') { const k = ease(b.k); P.x = xc - 50; P.sx = -1; P.y = sc.hy + 6 * Math.sin(TAU * 0.5 * 1.9) - 4 * hump(b.k); v.swell = (1 - k) ** 2; v.gill = hump(frac(b.k * 2)) * (1 - b.k); }
        else if (b.name === 'boom') {
          const a = hump(clamp(b.k * 1.4, 0, 1)); P.x = xc - 50; P.sx = -1 - 0.012 * a * Math.sin(TAU * 15 * b.t); P.sy = 1 + 0.02 * a;
          P.y = sc.hy + 6 * Math.sin(TAU * 0.5 * 1.9) - 4 * (1 - b.k) * 0; P.shakeX = 7 * a * Math.sin(TAU * 15 * b.t); P.shakeY = 6 * a * Math.sin(TAU * 11 * b.t + 1);
          P.angle = -3 * hump(b.k); v.boom = a;
        } else if (b.name === 'home') { P.x = lerp(xc - 50, sc.hx, push(b.t) / 1.94); P.sx = -1; P.y = sc.hy + 6 * Math.sin(TAU * 0.5 * 1.9) * (1 - ease(b.k)); }
        else { P.sx = -turnSx(b.k); P.sy = 1 + 0.04 * hump(b.k); P.y = sc.hy - 8 * hump(b.k); }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, e = V.env;
        rot(o, u, v, 0.21, 0.5, 13 * e * Math.sin(TAU * 0.5 * t), S(0.25, 0.15, u), r);
        wave(o, 1 - u, t, 0.01 * e, 0.6, 0.5, S(0.55, 0.25, u), 1);
        const flick = hump(clamp(frac(t / 0.5) / 0.3, 0, 1));
        rot(o, u, v, 0.745, 0.57, -(14 + 16 * flick) * e + 14 * e, box(u, v, 0.56, 0.49, 0.76, 0.67, 0.02), r);
        if (V.breath) scl(o, u, v, 0.8, 0.5, 1, 1 + 0.025 * V.breath * e, box(u, v, 0.74, 0.3, 0.92, 0.72));
        if (V.gill) scl(o, u, v, 0.8, 0.5, 1, 1 + 0.06 * V.gill, box(u, v, 0.72, 0.28, 0.9, 0.74));
        if (V.swell) {   // the gulp: mouth and gills balloon out to 130%
          scl(o, u, v, 0.82, 0.5, 1 + 0.34 * V.swell, 1 + 0.36 * V.swell, S(0.68, 0.84, u));
          rot(o, u, v, 0.86, 0.5, 24 * V.swell, box(u, v, 0.86, 0.5, 1.0, 0.64, 0.02), r);
          scl(o, u, v, 0.55, 0.62, 1, 1 + 0.08 * V.swell, box(u, v, 0.35, 0.45, 0.8, 0.85));
        }
        if (V.boom) scl(o, u, v, 0.5, 0.5, 1, 1 + 0.03 * V.boom * Math.sin(TAU * 15 * t), box(u, v, 0.25, 0.4, 0.75, 0.8));
      },
      fx(t, P, sc, E, mode) {
        const V = P.v;
        if (V.b === 'boom') {   // three low arcs going out from the body
          const b = beat(t, mode === 'pass' ? PASS : OUT), [cx, cy] = at(sc, P, 0.52, 0.55), sh = sc.sh * P.scale;
          for (let i = 0; i < 3; i++) {
            const k = clamp((b.t - i * 0.16) / 0.8, 0, 1); if (k <= 0 || k >= 1) continue;
            const rr = sh * (0.42 + 0.75 * k);
            arc(E, cx, cy, rr, 28, 124, 7 * (1 - k) + 1); arc(E, cx, cy, rr * 1.04, 208, 124, 5 * (1 - k) + 1);
          }
        }
        if (mode === 'pass') { if (V.b !== 'boom') { const [gx, gy] = at(sc, P, 0.86, 0.32); bubbles(E, t, gx, gy, 1.4, 1.2, 2, 170, 6); } return; }
        const D = total(OUT), b = beat(t, OUT), th = beatStart(OUT, 'home');
        const kin = clamp(t / 0.9, 0, 1), kout = clamp((t - th - 0.2) / 1.2, 0, 1), lv = kin * (1 - kout);
        if (lv > 0.01) {   // the cave under an overhang: it grows out from the right edge, and back
          const g = ease(lv), grow = p => p.map((n, i) => (i % 2 ? n : 1930 - (1930 - n) * g));
          E.back = true;
          poly(E, grow(ROCK), 4, true, 3, 0.4);
          poly(E, grow(CAVE), 4, true, 1);
          for (let i = 0; i < 5; i++) { const y = 180 + i * 190, x = 1930 - (1930 - (1500 + 40 * (i % 2))) * g; inkLine(E, [x, y, x + 60, y + 40, x + 90, y + 110], 1, 3); }
          E.back = false;
        }
        // the small fish: out of the left, nosing toward the grouper's mouth until it is sucked in
        const tg = beatStart(OUT, 'gulp'), tf = tg - 2.4;
        if (t > tf && t < tg) {
          const k = (t - tf) / 2.4, [mx, my] = at(sc, P, MOUTH[0], MOUTH[1]);
          const x = lerp(-40, mx - 70, 1 - (1 - k) ** 1.4) + 10 * Math.sin(t * 7), y = lerp(330, my + 6, ease(k)) + 14 * Math.sin(t * 3.3);
          fishlet(E, x, y, 1, 26);
        }
        if (t >= tg && t < tg + 0.5) {   // current snapping into the mouth
          const [mx, my] = at(sc, P, MOUTH[0], MOUTH[1]), k = (t - tg) / 0.5;
          suction(E, mx, my, 180, k, 7, 260, 3);
          if (k < 0.2) fishlet(E, mx + 6, my, 1, 12);
        }
        if (V.b === 'hover' || V.b === 'patrol') { const [gx, gy] = at(sc, P, 0.86, 0.32); bubbles(E, t, gx, gy, 1.3, 1.2, 2, 170, 6, 0.2, th); }
      },
    };
  })();

  // =============================================================================================== chambered nautilus
  (function () {
    // Shell left, tentacles right. It jets backward, shell first: in a pass going right it is mirrored (P.m -1).
    const PASS = [['jets', 4.0]];
    const OUT = [['sink', 1.6], ['rise', 3.4], ['drift', 2.0], ['down', 2.0]];
    const FUNNEL = [0.63, 0.79];
    /** One jet cycle of length T at phase p: g the progress (fast push, then a coast), c the tentacle pull (0..1). */
    function jet(p) {
      const f = frac(p);
      return { g: Math.floor(p) + 0.8 * ease(clamp(f / 0.3, 0, 1)) + 0.2 * f, c: S(0, 0.22, f) * S(1, 0.3, f), rock: Math.sin(Math.PI * clamp(f / 0.25, 0, 1)) * (f < 0.25 ? 1 : 0) + (f >= 0.25 ? Math.exp(-(f - 0.25) * 4) * Math.cos((f - 0.25) * 9) : 0) };
    }
    M['chambered-nautilus'] = {
      facing: 'R',
      pass: { dur: total(PASS), path(t, P, sc) {
        const v = P.v; v.b = 'jets'; v.env = 1;
        const j = jet(t), x0 = -0.62 * sc.sw - 60, x1 = WW + 0.62 * sc.sw + 60;
        P.m = -1; P.x = lerp(x0, x1, j.g / 4); P.y = HH * 0.5 + 18 * Math.sin(TAU * 0.25 * t) - 10 * j.c;
        P.angle = 8 * j.rock; v.pull = j.c; v.coast = 1 - j.c;
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, D = total(OUT); v.b = b.name; v.env = env(t, D);
        const lowY = 770, topY = 310, lowS = 0.7, xl = sc.hx - 60;
        P.m = 1; P.x = sc.hx; P.y = sc.hy; v.pull = 0; v.coast = 1; v.fan = 0;
        if (b.name === 'sink') {   // lets itself sink deep, tentacles streaming up
          const k = ease(b.k); P.x = lerp(sc.hx, xl, k); P.y = lerp(sc.hy, lowY, k); P.scale = lerp(1, lowS, k); P.angle = -5 * hump(b.k); v.stream = hump(b.k);
        } else if (b.name === 'rise') {   // three slow rocking pulses up the screen
          const j = jet(b.t / 1.133); P.scale = lowS; P.x = xl + 70 * (j.g / 3); P.y = lerp(lowY, topY, j.g / 3);
          P.angle = 8 * j.rock * S(0, 0.05, b.k); v.pull = j.c; v.coast = 1 - j.c;
        } else if (b.name === 'drift') {   // at the top: tentacles fanned, drifting on its buoyancy
          const k = b.k; P.scale = lowS; P.x = xl + 70 + 110 * ease(k); P.y = topY - 14 * Math.sin(Math.PI * k) + 6 * Math.sin(TAU * 0.7 * b.t);
          P.angle = 4 * Math.sin(TAU * 0.5 * b.t); v.fan = hump(k) ** 0.5;
        } else {   // sinks back home with soft pulses
          const k = ease(b.k), j = jet(b.t / 1.0);
          P.scale = lerp(lowS, 1, k); P.x = lerp(xl + 180, sc.hx, k); P.y = lerp(topY, sc.hy, k); P.angle = 4 * j.rock * (1 - k); v.pull = 0.6 * j.c * (1 - k);
        }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, e = V.env;
        const tent = S(0.58, 0.68, u) * S(0.42, 0.5, v);
        // jet: the tentacles draw together and pull in toward the shell
        if (V.pull) scl(o, u, v, 0.62, 0.66, 1 - 0.32 * V.pull, 1 - 0.3 * V.pull, tent);
        if (V.fan) { scl(o, u, v, 0.62, 0.66, 1.05, 1.18 * 1, tent * V.fan); rot(o, u, v, 0.62, 0.66, -10 * V.fan, tent * V.fan, r); }
        if (V.stream) rot(o, u, v, 0.62, 0.66, -18 * V.stream, tent, r);
        // between jets the tentacles trail and ripple
        wave(o, u - 0.6, t, 0.018 * (V.coast ?? 1) * e, 1.6, 1.2, tent * S(0.6, 0.85, u), 1);
        // the hood breathes
        scl(o, u, v, 0.55, 0.6, 1, 1 + 0.02 * Math.sin(TAU * 0.8 * t) * e, box(u, v, 0.43, 0.42, 0.69, 0.8));
      },
      fx(t, P, sc, E, mode) {
        const V = P.v, [fx, fy] = at(sc, P, FUNNEL[0], FUNNEL[1]);
        const mir = P.m < 0;   // the funnel points forward, under the tentacles: water goes out ahead of the head
        if (mode === 'pass') {
          // each jet: a spurt of water out of the funnel, backward, left hanging in the water as it shoots off
          emit(t, 1, 0.8, (i, te, age) => { const x = fx, y = fy; spurt(E, x - 20, y, 178, age, 0.8, 8, 130, 460, 10, i, 6); swirl(E, x - 120 - 300 * age, y + 10, 20 + 40 * age, 90 + 200 * age, 4 * (1 - age / 0.8)); }, 0.02);
          const [cx, cy] = at(sc, P, 0.33, 0.42); if (V.coast > 0.8) bubbles(E, t, cx, cy - 60, 1.0, 1.0, 2, 140, 13);
          return;
        }
        if (V.b === 'rise' || V.b === 'down') {
          const b = beat(t, OUT), per = V.b === 'rise' ? 1.133 : 1.0, s = P.scale;
          emit(b.t, per, 0.7, (i, te, age) => spurt(E, fx + 10, fy + 20, 110, age, 0.8, 7, 80 * s, 320 * s, 16, i + 3, 5), 0.02, V.b === 'down' ? 1.2 : 9);
        }
        if (V.b === 'drift') { const [cx, cy] = at(sc, P, 0.4, 0.05); bubbles(E, t, cx, cy, 0.9, 1.1, 2, 130, 5); }
        // marine snow, drifting down slowly: it shows the nautilus rising and sinking through deep water
        const snow = V.env;
        if (snow > 0.02) for (let i = 0; i < 14; i++) { const x = 80 + 130 * i + 40 * Math.sin(t * 0.8 + i), y = 60 + frac(rnd(i, 8) + t * 0.04) * 960; disc(E, x, y, (3 + 3 * rnd(i, 9)) * snow); }
      },
    };
  })();

  // ========================================================================================================= mudskipper
  (function () {
    // The mud line under it is part of the drawing (with the mouth and gill lines, so it cannot be a prop). The show
    // draws the mudflat across the screen at the same height; when the fish leaves the ground, the bend folds the
    // drawing's own strip of mud up flat under its belly, where it reads as the belly line.
    const PASS = [['steps', 2.0], ['skip', 1.0], ['steps2', 1.5]];
    const OUT = [['crutch', 2.0], ['flag', 1.0], ['leap', 2.4], ['rival', 0.6], ['flick', 0.8], ['pivot', 0.5], ['home', 1.6], ['pivot2', 0.5]];
    const MUD = 0.78, STEP = 0.5;
    // the drawing's mud line, v at u (read off its path): the bend straightens it onto v = 0.78
    const LINE = [[0.048, 0.79], [0.14, 0.778], [0.23, 0.775], [0.33, 0.782], [0.43, 0.787], [0.55, 0.778], [0.67, 0.772], [0.78, 0.778], [0.87, 0.784], [0.96, 0.778]];
    function vline(u) {
      if (u <= LINE[0][0]) return LINE[0][1];
      for (let i = 1; i < LINE.length; i++) if (u <= LINE[i][0]) { const [a, va] = LINE[i - 1], [b, vb] = LINE[i]; return lerp(va, vb, (u - a) / (b - a)); }
      return LINE[LINE.length - 1][1];
    }
    /** One crutch step at phase f (0..1): the fins plant and swing back (vault), the body hops forward, then the fins
     * swing forward again while the body rests. */
    function crutch(f) {
      const vault = clamp(f / 0.5, 0, 1);
      return { adv: ease(vault), fin: f < 0.5 ? 30 * ease(vault) : 30 * (1 - ease((f - 0.5) / 0.4)), hop: hump(vault), squash: hump(clamp((f - 0.45) / 0.25, 0, 1)) };
    }
    M['mudskipper'] = {
      facing: 'R', size: [0.9, 0.6],
      pass: { dur: total(PASS), path(t, P, sc) {
        const b = beat(t, PASS), v = P.v; v.b = b.name; v.env = 1;
        const yg = HH - 70 - (MUD - 0.5) * sc.sh;   // centre height that puts its mud line on the mudflat
        const x0 = -0.5 * sc.sw - 40, xe = WW + 0.5 * sc.sw + 40, jump = 0.8 * sc.sw, D = (xe - x0 - jump) / 7;
        const x1 = x0 + 4 * D, x2 = x1 + jump;
        P.m = 1; P.y = yg; v.fin = 0; v.lift = 0; v.ground = 0;
        if (b.name === 'steps' || b.name === 'steps2') {
          const tt = b.name === 'steps' ? b.t : b.t, n = b.name === 'steps' ? 4 : 3, per = b.d / n, c = crutch(frac(tt / per)), i = Math.floor(tt / per + 1e-9);
          P.x = (b.name === 'steps' ? x0 : x2) + D * (Math.min(i, n) + (i < n ? c.adv : 0));
          const hop = 0.025 * sc.sh * c.hop; P.y = yg - hop; v.ground = hop / sc.sh; v.fin = c.fin;
          P.sy = 1 - 0.04 * c.squash; P.sx = 1 + 0.02 * c.squash;
          if (b.name === 'steps' && b.k > 0.8) v.curl = S(0.8, 1, b.k);
        } else {   // the skip: tail curls under, a flick, a high arc, a splat
          const k = b.k, air = clamp((k - 0.15) / 0.68, 0, 1), land = clamp((k - 0.83) / 0.17, 0, 1);
          P.x = x1 + jump * ease(air) * 0.98 + jump * 0.02 * land;
          const H = HH * 0.25; P.y = yg - H * 4 * air * (1 - air);
          v.curl = k < 0.15 ? 1 - 0.0 * k : 1 - S(0.15, 0.3, k); v.flick = hump(clamp((k - 0.12) / 0.2, 0, 1));
          v.lift = S(0.08, 0.24, k) * S(0.98, 0.88, k); v.fin = -25 * v.lift;
          P.angle = lerp(-18, 16, air) * S(0.08, 0.2, k) * S(0.9, 0.8, k);
          P.sy = 1 - 0.1 * hump(clamp(k / 0.15, 0, 1)) - 0.12 * hump(land); P.sx = 1 + 0.06 * hump(land) + 0.06 * v.flick;
        }
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, D = total(OUT); v.b = b.name; v.env = env(t, D);
        const step = 70, xm = sc.hx + 4 * step;
        P.m = 1; v.fin = 0; v.lift = 0; v.ground = 0; v.flag = 0; v.gape = 0;
        if (b.name === 'crutch') {
          const per = 0.5, i = Math.floor(b.t / per + 1e-9), c = crutch(frac(b.t / per));
          P.x = sc.hx + step * (Math.min(i, 4) + (i < 4 ? c.adv : 0)); const hop = 0.025 * sc.sh * c.hop;
          P.y = sc.hy - hop; v.ground = hop / sc.sh; v.fin = c.fin; P.sy = 1 - 0.04 * c.squash; P.sx = 1 + 0.02 * c.squash;
        } else if (b.name === 'flag') {   // dorsal fin up like a flag, mouth agape
          P.x = xm; P.y = sc.hy; v.flag = ease(clamp(b.k * 2, 0, 1)); v.gape = ease(clamp((b.k - 0.3) * 2, 0, 1));
          P.sy = 1 + 0.02 * v.flag;
        } else if (b.name === 'leap') {   // three leaps straight up, a splat each time
          const k = frac(b.t / 0.8), i = Math.floor(b.t / 0.8), air = clamp((k - 0.22) / 0.62, 0, 1), crouch = hump(clamp(k / 0.22, 0, 1)), land = hump(clamp((k - 0.84) / 0.16, 0, 1));
          P.x = xm; P.y = sc.hy - 150 * 4 * air * (1 - air) * (i === 1 ? 1.1 : 1);
          P.sy = 1 - 0.1 * crouch - 0.1 * land + 0.06 * hump(air); P.sx = 1 + 0.05 * crouch + 0.06 * land;
          v.lift = S(0.12, 0.3, k) * S(0.92, 0.8, k); v.flag = 1; v.gape = 1 - 0.5 * hump(air); v.flick = hump(clamp((k - 0.1) / 0.25, 0, 1));
          P.angle = -4 * Math.sin(Math.PI * air); v.fin = -20 * v.lift;
        } else if (b.name === 'rival') {   // a rival's flash: it snaps round to face it and back
          P.x = xm; P.y = sc.hy; v.flag = 1; v.gape = 0.8; P.sx = 1 - 2 * hump(b.k) ** 0.7; P.sy = 1 + 0.04 * hump(b.k);
        } else if (b.name === 'flick') {   // flicks mud over its own back to keep wet
          P.x = xm; P.y = sc.hy; v.flag = 1 - ease(b.k); v.gape = 0.5 * (1 - b.k); v.flickUp = hump(b.k);
        } else if (b.name === 'pivot') { P.x = xm; P.y = sc.hy - 6 * hump(b.k); P.sx = turnSx(b.k); }
        else if (b.name === 'home') {
          const per = 0.4, i = Math.floor(b.t / per + 1e-9), c = crutch(frac(b.t / per)), n = 4;
          P.x = xm - step * (Math.min(i, n) + (i < n ? c.adv : 0)); const hop = 0.025 * sc.sh * c.hop * (i < n ? 1 : 0);
          P.y = sc.hy - hop; v.ground = hop / sc.sh; v.fin = i < n ? c.fin : 0; P.sx = -1;
        } else { P.x = sc.hx; P.y = sc.hy - 6 * hump(b.k); P.sx = -turnSx(b.k); }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, e = V.env;
        // the drawing's strip of mud: straightened onto the mudflat, kept on the ground during a hop, folded flat
        // under the belly in the air
        const mud = S(0.7, 0.75, v);
        if (mud) shift(o, 0, (MUD - vline(u)) * e, mud);
        if (V.ground) shift(o, 0, V.ground, S(0.62, 0.75, v));
        if (V.lift && v > 0.7) { o[1] -= (v - 0.70) * V.lift; o[0] -= (u - 0.55) * 0.35 * V.lift; }
        // pectoral crutches about their base
        rot(o, u, v, 0.78, 0.63, V.fin, box(u, v, 0.71, 0.6, 0.82, 0.8, 0.02), r);
        // dorsal fin: raised to 140% as a flag, otherwise it ripples
        scl(o, u, v, 0.69, 0.5, 1, 1 + 0.38 * (V.flag || 0) - 0.06 * e * (1 - (V.flag || 0)) * (0.5 + 0.5 * Math.sin(TAU * 0.7 * t)), box(u, v, 0.6, 0.12, 0.78, 0.5, 0.02));
        rot(o, u, v, 0.69, 0.5, -6 * (V.flag || 0), box(u, v, 0.6, 0.12, 0.78, 0.5, 0.02), r);
        // tail: curls under before a skip, flicks, sweeps mud up; idle it twitches
        const tail = S(0.21, 0.15, u) * box(u, v, 0, 0.42, 0.3, 0.78);
        rot(o, u, v, 0.17, 0.62, 30 * (V.curl || 0) - 40 * (V.flick || 0) - 45 * (V.flickUp || 0) + 6 * e * Math.sin(TAU * 0.9 * t), tail, r);
        // mouth agape
        if (V.gape) rot(o, u, v, 0.86, 0.6, 24 * V.gape, box(u, v, 0.86, 0.59, 0.96, 0.68, 0.015), r);
        // the eyes drop into their sockets in a blink every few seconds
        const bl = hump(clamp((frac(t / 2.7 + 0.3) - 0.9) / 0.1, 0, 1)) * e;
        if (bl) shift(o, 0, 0.04 * bl, box(u, v, 0.81, 0.33, 0.91, 0.47, 0.02));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v, pass = mode === 'pass';
        const gy = pass ? HH - 70 : sc.hy + (MUD - 0.5) * sc.sh;
        // the mudflat: in a pass the whole width; on the screensaver it grows out of the drawing's own line and back
        E.back = true;
        if (pass) { const p = []; for (let x = -20; x <= WW + 20; x += 40) p.push(x, gy + 3 * Math.sin(x / 70)); poly(E, p, 3); for (let i = 0; i < 9; i++) { const x = 100 + i * 230 + 50 * rnd(i, 2); line(E, x, gy + 22 + 14 * (i % 2), x + 70, gy + 20 + 14 * (i % 2), 3); } }
        else {
          // the middle copies the drawing's own line at home, straightening as the drawing's does
          const D = total(OUT), k = S(0, 0.6, t) * S(D, D - 0.6, t), x0 = sc.hx + (0.048 - 0.5) * sc.sw, x1 = sc.hx + (0.96 - 0.5) * sc.sw;
          if (k > 0.01) {
            const p = [];
            for (let u = 0.048; u < 0.961; u += 0.03) p.push(sc.hx + (u - 0.5) * sc.sw, gy + (vline(u) - MUD) * sc.sh * (1 - V.env));
            poly(E, p, 3);
            line(E, x0 - (x0 + 20) * k, gy + (vline(0.048) - MUD) * sc.sh * (1 - V.env), x0 + 1, gy + (vline(0.048) - MUD) * sc.sh * (1 - V.env), 3);
            line(E, x1 - 1, gy, x1 + (WW + 20 - x1) * k, gy, 3);
          }
        }
        E.back = false;
        if (pass) {
          // fin prints at each step
          emit(t, STEP, 9, (i, te, age) => { const Q = poseAt(te), [x] = at(sc, Q, 0.76, 0.78); if (Q.v.b !== 'skip') { line(E, x - 16, gy + 8, x + 6, gy + 6, 4); } }, 0.15);
          const ts = beatStart(PASS, 'skip') + 0.85, a = t - ts;
          if (a > 0) {   // the landing: a splat and a print
            const Q = poseAt(ts + 0.12), [x] = at(sc, Q, 0.6, 0.75);
            mudSplat(E, x, gy, a, 0.6, 5, 80, 3);
            oval(E, x, gy + 6, 70, 9, 0, 4);
          }
          if (V.b === 'skip' && V.flick > 0.2) { const [x, y] = at(sc, P, 0.08, 0.62); for (let i = 0; i < 3; i++) line(E, x - 30 - i * 25, y - 40 + i * 30, x - 80 - i * 25, y - 50 + i * 30, 3); }
          return;
        }
        const b = beat(t, OUT);
        if (V.b === 'crutch' || V.b === 'home') emit(b.t, V.b === 'crutch' ? 0.5 : 0.4, 3, (i, te, age) => { const [x] = at(sc, P, 0.76, 0.78); line(E, x - 12, gy + 7, x + 6, gy + 5, 3); }, 0.12, V.b === 'crutch' ? 1.9 : 1.5);
        if (V.b === 'leap' || V.b === 'rival') { const tl = beatStart(OUT, 'leap'); emit(t, 0.8, 0.7, (i, te, age) => { mudSplat(E, sc.hx + 4 * 70 + 0.12 * sc.sw, gy, age, 0.7, 7, 80, i + 7); line(E, sc.hx + 280 + 0.05 * sc.sw, gy + 8, sc.hx + 280 + 0.2 * sc.sw, gy + 8, 4 * (1 - age / 0.7)); }, tl + 0.7, tl + 2.4); }
        if (V.b === 'rival') { const k = b.k; if (k > 0.2 && k < 0.8) { const [x, y] = at(sc, P, 0.5, 0.4); for (let i = -1; i <= 1; i++) line(E, x + i * 60, y - 190, x + i * 80, y - 230, 4); } }
        if (V.b === 'flick' || (V.b === 'pivot' && b.k < 0.5)) {   // mud thrown over its back
          const k = V.b === 'flick' ? b.k : 1 + b.k * 0.6, [tx, ty] = at(sc, { x: sc.hx + 280, y: sc.hy, scale: 1, sx: 1, sy: 1, angle: 0, mirror: false }, 0.08, 0.62);
          for (let i = 0; i < 6; i++) { const kk = clamp((k - 0.2 - i * 0.04) / 0.8, 0, 1); if (kk <= 0 || kk >= 1) continue; const x = lerp(tx, tx + 300 + 60 * i, kk), y = ty - 260 * 4 * kk * (1 - kk) + 120 * kk * kk * (0.5 + 0.2 * i); blob(E, x, y, 8 + 3 * (i % 3), 7, 0); }
        }
      },
    };
  })();

  // ======================================================================================================= fiddler crab
  (function () {
    // Front view, the big claw on the right. Crabs go sideways, so the front view walks straight across.
    const PASS = [['scuttle', 3.0]];
    const OUT = [['feed', 2.4], ['wave', 3.0], ['shadow', 0.45], ['drop', 0.35], ['hide', 0.9], ['peek', 1.0], ['out', 1.0]];
    const WAVES = [1.0, 0.8, 0.65, 0.55];   // each wave quicker than the last
    function waveAt(tt) {   // claw wave phase in the 'wave' beat: [phase 0..1, which]
      let t0 = 0;
      for (let i = 0; i < WAVES.length; i++) { if (tt < t0 + WAVES[i]) return [(tt - t0) / WAVES[i], i]; t0 += WAVES[i]; }
      return [1, WAVES.length - 1];
    }
    /** A lateral wave: the claw swings out, lifts high, holds, and drops back. */
    const clawOf = f => ({ out: 38 * hump(clamp(f / 0.85, 0, 1)), up: 0.17 * S(0.08, 0.38, f) * S(0.95, 0.68, f) });
    /** How far down it goes into the burrow (design px, at scale 0.8 the big claw's tip is just under the sand). */
    const depth = sc => 0.46 * sc.sh + 4 - 10 + 0.46 * sc.sh * 0.8;
    M['fiddler-crab'] = {
      facing: 'F',
      pass: { dur: total(PASS), path(t, P, sc) {
        const v = P.v; v.b = 'scuttle'; v.env = 1; v.legs = 1; v.legHz = 6;
        P.m = 1; P.x = lerp(-0.5 * sc.sw - 60, WW + 0.5 * sc.sw + 60, t / 3); P.y = ground(sc) - 0.012 * sc.sh * Math.abs(Math.sin(TAU * 3 * t));
        const f = clamp((t - 0.9) / 1.1, 0, 1); const c = clawOf(f); v.out = c.out; v.up = c.up; v.tuck = 1 - hump(f);
        P.angle = 1.5 * Math.sin(TAU * 3 * t);
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, D = total(OUT); v.b = b.name; v.env = env(t, D);
        P.m = 1; P.x = sc.hx; P.y = sc.hy; v.legs = 0; v.out = 0; v.up = 0; v.scoop = 0; v.eyes = 0;
        const deep = depth(sc);
        if (b.name === 'feed') { const f = frac(b.t / 0.8); v.scoop = f; P.y = sc.hy + 8 * hump(clamp(f / 0.4, 0, 1)); }
        else if (b.name === 'wave') { const [f, i] = waveAt(b.t), c = clawOf(f); v.out = c.out; v.up = c.up; P.y = sc.hy - 14 * c.up / 0.17; P.angle = -2 * c.up / 0.17; v.legs = 0.15 + 0.1 * i; v.legHz = 2 + i; }
        else if (b.name === 'shadow') { P.y = sc.hy + 10 * ease(b.k); v.eyes = -0.5 * ease(b.k); }
        else if (b.name === 'drop') { const k = b.k * b.k; P.y = lerp(sc.hy + 10, sc.hy + deep, k); P.scale = lerp(1, 0.8, k); v.eyes = -0.5 * (1 - k); v.legs = 1; v.legHz = 9; }
        else if (b.name === 'hide') { P.y = sc.hy + deep; P.scale = 0.8; v.tuckIn = ease(clamp(b.k * 2, 0, 1)); }
        else if (b.name === 'peek') {   // claw pulled in, it edges up until the eyestalks stand out of the sand and look about
          const k = ease(clamp(b.k / 0.3, 0, 1));
          P.y = sc.hy + deep - 45 * k; P.scale = 0.8; v.tuckIn = 1; v.eyes = k * (1 - 0.2 * ease(clamp((b.k - 0.85) / 0.15, 0, 1)));
          v.look = Math.sin(TAU * 1.2 * b.t) * S(0.25, 0.4, b.k);
        } else { const k = ease(b.k); P.y = lerp(sc.hy + deep - 45, sc.hy, k); P.scale = lerp(0.8, 1, k); v.eyes = 0.8 * (1 - k); v.tuckIn = 1 - k; v.legs = 1 - b.k; v.legHz = 5; }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, e = V.env;
        // legs: a ripple of steps from one leg to the next, tips lifting as they reach
        const lw = S(0.58, 0.95, v) * (1 - box(u, v, 0.73, 0, 0.97, 0.62, 0.03));
        if (V.legs) {
          const ph = TAU * V.legHz * t + (u < 0.5 ? u * 9 : u * 9 + Math.PI);
          o[0] += 0.03 * V.legs * Math.sin(ph) * lw; o[1] -= 0.025 * V.legs * Math.max(0, Math.cos(ph)) * lw;
        }
        // the big claw: swings out and lifts in a wave; tucked a little when it runs
        const claw = box(u, v, 0.72, 0, 0.98, 0.6, 0.04);
        rot(o, u, v, 0.7, 0.52, (V.out || 0) - 6 * (V.tuck || 0) + 2 * e * Math.sin(TAU * 0.6 * t), claw, r);
        if (V.up) shift(o, 0.03 * V.up / 0.17, -V.up, claw);
        if (V.tuckIn) shift(o, -0.03 * V.tuckIn, 0.15 * V.tuckIn, claw);
        // the small claw: scoops sand, carries it to the mouth
        if (V.scoop) {
          const f = V.scoop, w = box(u, v, 0.17, 0.55, 0.3, 0.74, 0.03);
          shift(o, 0.14 * S(0.3, 0.6, f) * S(1, 0.8, f), 0.05 * hump(clamp(f / 0.3, 0, 1)) - 0.1 * S(0.3, 0.6, f) * S(1, 0.8, f), w);
        }
        // eyestalks: twitch, duck at the shadow, and stretch up out of the burrow to peek
        const stalk = box(u, v, 0.37, 0.1, 0.57, 0.36, 0.02) * S(0.38, 0.2, v);
        shift(o, 0.008 * e * Math.sin(TAU * 0.9 * t) + 0.025 * (V.look || 0), -0.17 * (V.eyes || 0), stalk);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          const gy = ground(sc) + 0.46 * sc.sh + 6;
          E.back = true; const p = []; for (let x = -20; x <= WW + 20; x += 40) p.push(x, gy + 4 * Math.sin(x / 110)); poly(E, p, 3);
          for (let i = 0; i < 8; i++) { const x = 60 + i * 250 + 60 * rnd(i, 3); line(E, x, gy + 20 + 10 * (i % 2), x + 50, gy + 20 + 10 * (i % 2), 3); } E.back = false;
          // sand pellets dropped behind as it goes, and little puffs where the feet strike
          emit(t, 0.22, 3, (i, te, age) => { const Q = poseAt(te), [x] = at(sc, Q, 0.3 + 0.05 * (i % 3), 0.9); disc(E, x - 20, gy - 7 - 30 * Math.max(0, 1 - age * 6) ** 2, 8 + 2 * (i % 2)); }, 0.1);
          emit(t, 0.17, 0.4, (i, te, age) => { const Q = poseAt(te), [x] = at(sc, Q, i % 2 ? 0.15 : 0.75, 0.95); puff(E, x, gy - 6, 26, age, 0.4, -30); }, 0.05);
          if (V.up > 0.08) { const [x, y] = at(sc, P, 0.93, 0.08); for (let j = 0; j < 3; j++) line(E, x + 26 + j * 10, y - 24 + j * 28, x + 60 + j * 16, y - 34 + j * 30, 4); }
          return;
        }
        const D = total(OUT), b = beat(t, OUT), feet = sc.hy + 0.46 * sc.sh, sy = feet + 4;
        const kin = S(0, 0.5, t) * S(D, D - 0.5, t), td = beatStart(OUT, 'drop');
        const hx = sc.hx - 10, hr = 120;
        // the burrow at its feet, behind it, with a rim of dug sand
        E.back = true;
        if (kin > 0.01) {
          blob(E, hx, sy, hr * kin, 24 * kin, 0);
          for (const s of [-1, 1]) arc(E, hx + s * (hr + 40) * kin, sy + 2, 40 * kin, 200, 140, 3);
        }
        E.back = false;
        // once it goes down: the sand in front covers whatever is below the surface, the near lip of the burrow too
        if (t > td - 0.05 && kin > 0.01) {
          poly(E, [0, sy, WW, sy, WW, HH + 20, 0, HH + 20], 0, true, 2);
          const p = ellipsePts(hx, sy, hr * kin, 24 * kin, 14, 0, Math.PI); poly(E, p, 0, true, 1);
        }
        if (kin > 0.01) { line(E, hx - (hr + 400) * kin - 40, sy, hx - hr * kin, sy, 3); line(E, hx + hr * kin, sy, hx + (hr + 400) * kin + 40, sy, 3); }
        // pellets left by the feeding claw, in a little row
        for (let i = 0; i < 3; i++) { const te = 0.55 + i * 0.8; if (t > te && kin > 0.01) disc(E, sc.hx - 330 + i * 34, sy - 9 - 40 * Math.max(0, 1 - (t - te) * 5) ** 2, 9 * S(D - 0.4, D - 0.9, t)); }
        if (V.b === 'wave') { const [f, i] = waveAt(b.t); if (f > 0.3 && f < 0.8) { const [x, y] = at(sc, P, 0.93, 0.08); for (let j = 0; j < 2 + i; j++) line(E, x + 30 + j * 10, y - 26 + j * 26, x + 62 + j * 16, y - 36 + j * 28, 4); } }
        if (t > td - 0.75 && t < td + 0.5) { const k = (t - td + 0.75) / 1.25; shadowBird(E, lerp(-500, WW + 500, k), lerp(330, 260, k), 640, t * 9, 0.4); }
        if (V.b === 'drop' || V.b === 'hide') { const a = t - td; puff(E, hx - 60, sy - 14, 70, a, 0.8, -60); puff(E, hx + 60, sy - 14, 70, a - 0.05, 0.8, 60); }
        if (V.b === 'out') emit(b.t, 0.25, 0.5, (i, te, age) => grains(E, hx + (i % 2 ? 140 : -160), sy - 10, age, 0.5, 4, i, 0, 60), 0, 0.6);
      },
    };
  })();

  // ========================================================================================================== barracuda
  (function () {
    const PASS = [['drift', 1.3], ['freeze', 1.0], ['cock', 0.15], ['strike', 0.3], ['gone', 0.26]];
    const OUT = [['hover', 1.0], ['track', 1.6], ['shadow', 2.8], ['strike', 0.1], ['settle', 0.45], ['turn', 0.6], ['back', 1.55], ['turn2', 0.6]];
    // the small fish it shadows: [outing time, x, y] (design px). It drops in from above, hangs, then goes off in fits
    // and starts; the strike comes at 5.4 s.
    const SPECK = [[0.25, 1240, -40], [1.4, 1290, 190], [2.2, 1360, 250], [2.9, 1380, 262], [3.6, 1520, 310], [4.2, 1530, 312], [4.85, 1660, 370], [5.6, 1668, 372]];
    function speck(t) {
      if (t <= SPECK[0][0]) return [SPECK[0][1], SPECK[0][2]];
      let i = 1; while (i < SPECK.length - 1 && t > SPECK[i][0]) i++;
      const A = SPECK[i - 1], B = SPECK[i], f = ease(clamp((t - A[0]) / (B[0] - A[0]), 0, 1));
      return [lerp(A[1], B[1], f), lerp(A[2], B[2], f)];
    }
    const GAP = 300, LAG = 0.3, TILT = 12, NOSE = 0.46;
    M['barracuda'] = {
      facing: 'R', size: [0.75, 0.5],
      pass: { dur: total(PASS), path(t, P, sc) {
        const b = beat(t, PASS), v = P.v; v.b = b.name; v.env = 1; v.fins = 1; v.tail = 0;
        const x0 = -0.5 * sc.sw - 40, x1 = WW * 0.28, x3 = WW + 0.5 * sc.sw * 1.2 + 60;
        P.m = 1; P.y = HH * 0.52;
        if (b.name === 'drift') { P.x = lerp(x0, x1, 1 - (1 - b.k) ** 2.2); v.tail = 0.4 * (1 - b.k); }
        else if (b.name === 'freeze') { P.x = x1; v.fins = 0.15; }   // dead still: only the fin tips quiver
        else if (b.name === 'cock') { P.x = x1 - 18 * ease(b.k); v.cock = ease(b.k); v.fins = 0; P.sx = 1 - 0.04 * ease(b.k); }
        else if (b.name === 'strike') {
          const k = b.k; P.x = lerp(x1 - 18, x3, k ** 1.6); P.sx = 1.14; P.sy = 0.92; v.cut = true; v.sbend = hump(clamp(k * 1.6, 0, 1)); v.jaw = 1; v.fins = 0;
        } else { P.x = x3; P.hidden = true; }
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, D = total(OUT); v.b = b.name; v.env = env(t, D); v.fins = 1;
        P.m = 1; P.x = sc.hx; P.y = sc.hy;
        const nose = NOSE * sc.sw;
        /** Where it holds station behind the fish (centre), and the tilt that points it at the fish. */
        const follow = tt => { const [qx, qy] = speck(tt - LAG); return [qx - GAP - nose, qy + 40]; };
        const aim = (x, y, tt) => { const [qx, qy] = speck(tt); return clamp(Math.atan2(qy - y, qx - (x + nose)) * 180 / Math.PI, -TILT, TILT); };
        const ts = beatStart(OUT, 'strike'), [kx, ky] = speck(ts), [fx0, fy0] = follow(ts), sa = aim(fx0, fy0, ts);
        const hitX = kx - nose * Math.cos(sa * Math.PI / 180), hitY = ky - nose * Math.sin(sa * Math.PI / 180);
        if (b.name === 'hover') { P.y = sc.hy + 2 * Math.sin(TAU * 0.4 * b.t); v.fins = 0.4; }
        else if (b.name === 'track') { P.angle = aim(sc.hx, sc.hy, t) * ease(b.k); v.fins = 0.5; P.y = sc.hy + 2 * Math.sin(TAU * 0.4 * t); }
        else if (b.name === 'shadow') {   // holds a fixed distance behind it, stopping when it stops
          const [fx, fy] = follow(t), k = ease(clamp(b.t / 0.9, 0, 1));
          P.x = lerp(sc.hx, fx, k); P.y = lerp(sc.hy, fy, k); P.angle = aim(P.x, P.y, t); v.fins = 0.7;
          v.tail = 0.6 * Math.min(1, Math.hypot(follow(t + 0.05)[0] - fx, follow(t + 0.05)[1] - fy) / 6);
        } else if (b.name === 'strike') { P.x = hitX; P.y = hitY; P.angle = sa; v.cut = true; P.sx = 1.12; P.sy = 0.93; v.jaw = 1; v.sbend = 1; v.fins = 0; }
        else if (b.name === 'settle') { const k = ease(b.k); P.x = hitX + 30 * k; P.y = hitY + 20 * k; P.angle = sa * (1 - k); P.sx = 1 + 0.12 * (1 - k); P.sy = 1 - 0.07 * (1 - k); v.jaw = 1 - k; v.sbend = (1 - k) * Math.cos(b.k * 9); }
        else if (b.name === 'turn') { P.x = hitX + 30 - 10 * ease(b.k); P.y = hitY + 20; P.sx = turnSx(b.k); P.sy = 1 + 0.06 * hump(b.k); }
        else if (b.name === 'back') { const k = ease(b.k); P.x = lerp(hitX + 20, sc.hx, k); P.y = lerp(hitY + 20, sc.hy, k); P.sx = -1; v.tail = 0.5 * hump(b.k); }
        else { P.sx = -turnSx(b.k); P.sy = 1 + 0.06 * hump(b.k); }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, e = V.env, f = V.fins * e;
        // fins flicker; everything else holds
        scl(o, u, v, 0.765, 0.52, 1 - 0.35 * f * (0.5 + 0.5 * Math.sin(TAU * 4 * t)), 1, box(u, v, 0.66, 0.48, 0.78, 0.6, 0.015));
        rot(o, u, v, 0.31, 0.44, 10 * f * Math.sin(TAU * 2.6 * t), box(u, v, 0.25, 0.3, 0.36, 0.44, 0.02), r);
        rot(o, u, v, 0.31, 0.56, -10 * f * Math.sin(TAU * 2.6 * t + 1), box(u, v, 0.25, 0.56, 0.36, 0.7, 0.02), r);
        rot(o, u, v, 0.17, 0.5, 5 * f * Math.sin(TAU * 1.3 * t) + 14 * (V.tail || 0) * Math.sin(TAU * 2.5 * t) - 26 * (V.cock || 0), S(0.21, 0.12, u), r);
        if (V.sbend) wave(o, 1 - u, t, 0.06 * V.sbend, 0.9, 0, S(0.75, 0.2, u), 1, -Math.PI / 2);
        if (V.jaw) rot(o, u, v, 0.83, 0.505, 9 * V.jaw, box(u, v, 0.84, 0.505, 0.98, 0.56, 0.01), r);
      },
      fx(t, P, sc, E, mode) {
        const V = P.v;
        if (mode === 'pass') {
          const ts = beatStart(PASS, 'strike'), a = t - ts, x1 = WW * 0.28;
          if (V.b === 'freeze' || V.b === 'cock') { const [ex, ey] = at(sc, P, 0.855, 0.455), k = beat(t, PASS).k; if (V.b === 'freeze' && k > 0.55 && k < 0.85) glint(E, ex + 4, ey - 4, 18 * hump((k - 0.55) / 0.3), 3); }
          if (a > 0) {   // the strike: speed streaks along its path, glints left hanging in the water
            const k = clamp(a / 0.55, 0, 1), y = HH * 0.52;
            for (let i = 0; i < 9; i++) {
              const yy = y + (rnd(i, 3) - 0.5) * sc.sh * 0.5, xs = x1 - 0.2 * sc.sw + rnd(i, 4) * 300, xe = Math.min(P.hidden ? WW + 40 : P.x - 0.3 * sc.sw, WW + 40);
              const fade = clamp((a - 0.25 - 0.03 * i) / 0.3, 0, 1);
              if (xe > xs + 20 && fade < 1) line(E, lerp(xs, xe, fade), yy, xe, yy, 5 * (1 - fade) + 1);
            }
            for (let i = 0; i < 4; i++) { const g = clamp((a - 0.05 * i) / 0.4, 0, 1); if (g > 0 && g < 1) glint(E, x1 + 300 + i * 360, y + (rnd(i, 7) - 0.5) * 200, 26 * hump(g), 4); }
          }
          return;
        }
        const tk = beatStart(OUT, 'strike'), [qx, qy] = speck(t);
        if (t > 0.25 && t < tk) { const [px] = speck(t - 0.05); fishlet(E, qx + 5 * Math.sin(t * 9), qy + 4 * Math.sin(t * 5), qx < px - 0.5 ? -1 : 1, 20); }
        if (t >= tk && t < tk + 0.5) {
          const a = (t - tk) / 0.5, [mx, my] = at(sc, P, 0.96, 0.51);
          for (let i = 0; i < 6; i++) { const yy = my + (i - 2.5) * 22, l = 380 * (1 - a); line(E, mx - 0.6 * sc.sw - l, yy + 30, mx - 0.6 * sc.sw, yy + 30, 5 * (1 - a) + 1); }
          for (let i = 0; i < 5; i++) blob(E, mx + 30 + 120 * a * Math.cos(i * 1.3), my + 120 * a * Math.sin(i * 1.3), 5 * (1 - a) + 1, 4 * (1 - a) + 1, 0);
        }
      },
    };
  })();

  // ========================================================================================================== sea star
  (function () {
    // Seen from above. No front: any arm can lead. Arms: 0 up, 1 right, 2 lower right, 3 lower left, 4 left.
    const C = [0.5, 0.565];
    const TIPS = [[0.465, 0.11], [0.94, 0.47], [0.80, 0.885], [0.205, 0.885], [0.055, 0.46]];
    const ANG = TIPS.map(([u, v]) => Math.atan2(v - C[1], u - C[0]) * 180 / Math.PI);
    const PASS = [['bounce', 4.0]];
    const OUT = [['look', 0.7], ['crawl1', 1.7], ['switch', 1.1], ['crawl2', 1.4], ['hump', 2.4], ['home', 2.0]];
    /** Lift (0..1) and curl the tip of arm i: from above it shortens toward its root and bends a little sideways. */
    function arm(o, u, v, i, lift, curl) {
      if (!lift && !curl) return;
      const [tu, tv] = TIPS[i], ax = tu - C[0], ay = tv - C[1], len = Math.hypot(ax, ay), dx = ax / len, dy = ay / len;
      const pu = u - C[0], pv = v - C[1], along = (pu * dx + pv * dy) / len, side = -pu * dy + pv * dx;
      const w = S(0.35, 0.7, along) * Math.exp(-((side / 0.12) ** 2)), k = clamp((along - 0.35) / 0.65, 0, 1.2);
      o[0] += (-dx * 0.13 * lift * k * k - dy * 0.05 * curl * k * k) * w; o[1] += (-dy * 0.13 * lift * k * k + dx * 0.05 * curl * k * k) * w;
    }
    /** Every arm sways a little from its root (the tube feet working). */
    function sway(o, u, v, t, amp) {
      const pu = u - C[0], pv = v - C[1], d = Math.hypot(pu, pv); if (d < 0.08) return;
      const a = Math.atan2(pv, pu) * 180 / Math.PI;
      for (let i = 0; i < 5; i++) {
        let da = a - ANG[i]; da = ((da + 540) % 360) - 180;
        const w = Math.exp(-((da / 26) ** 2)) * S(0.1, 0.4, d);
        if (w > 0.01) { const s = amp * Math.sin(TAU * 0.45 * t + i * 1.3) * d * w; o[0] += -pv / d * s; o[1] += pu / d * s; }
      }
    }
    /** Centre of the disc on screen for the drawing at (x, y), scale 1, angle 0. */
    M['sea-star'] = {
      facing: 'U',
      pass: { dur: total(PASS), path(t, P, sc) {
        const v = P.v; v.b = 'bounce'; v.env = 1;
        const lead = 1; P.angle = -ANG[lead];
        const f = frac(t / 0.5), hop = hump(f);
        P.m = 1; P.x = lerp(-0.62 * sc.sw - 40, WW + 0.62 * sc.sw + 40, (t + 0.25 * Math.sin(TAU * t / 0.5) / (TAU / 0.5) * 2) / 4);
        P.y = HH * 0.52 - 0.012 * sc.sh * hop; P.scale = 1 + 0.03 * hop;
        v.lead = lead; v.lift = 0.75 + 0.25 * Math.sin(TAU * t / 0.5); v.curl = 0.6;
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, D = total(OUT); v.b = b.name; v.env = env(t, D);
        const d1 = 260, d2 = 235, a1 = ANG[1] * Math.PI / 180, a2 = ANG[2] * Math.PI / 180;
        const p1 = [sc.hx + d1 * Math.cos(a1), sc.hy + d1 * Math.sin(a1)], p2 = [p1[0] + d2 * Math.cos(a2), p1[1] + d2 * Math.sin(a2)];
        P.m = 1; P.x = sc.hx; P.y = sc.hy; v.lifts = [0, 0, 0, 0, 0]; v.hump = 0;
        const L = v.lifts;
        if (b.name === 'look') { L[1] = ease(b.k); }
        else if (b.name === 'crawl1') { const k = ease(b.k); P.x = lerp(sc.hx, p1[0], k); P.y = lerp(sc.hy, p1[1], k); L[1] = 1; v.creep = 1; }
        else if (b.name === 'switch') {   // the drawing stays put: the raised tip passes from one arm to the next
          P.x = p1[0]; P.y = p1[1]; L[1] = 1 - ease(clamp(b.k / 0.6, 0, 1)); L[2] = ease(clamp((b.k - 0.35) / 0.6, 0, 1));
        } else if (b.name === 'crawl2') { const k = ease(b.k); P.x = lerp(p1[0], p2[0], k); P.y = lerp(p1[1], p2[1], k); L[2] = 1 - S(0.75, 1, b.k); v.creep = 1; }
        else if (b.name === 'hump') {   // over the clam: arms arch in, the middle bulges to 108%, held
          P.x = p2[0]; P.y = p2[1]; v.hump = S(0, 0.25, b.k) * S(1, 0.82, b.k); L[4] = S(0.8, 1, b.k);
        } else { const k = ease(b.k); P.x = lerp(p2[0], sc.hx, k); P.y = lerp(p2[1], sc.hy, k); L[4] = 1 - S(0.7, 1, b.k); v.creep = 1; }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, e = V.env;
        sway(o, u, v, t, 0.06 * e + 0.03 * (V.creep || 0) * e);
        if (V.lead !== undefined) arm(o, u, v, V.lead, V.lift, V.curl * Math.sin(TAU * 0.5 * t));
        if (V.lifts) V.lifts.forEach((l, i) => arm(o, u, v, i, l * e, 0.5 * l * e * Math.sin(TAU * 0.6 * t + i)));
        if (V.hump) {
          const d = Math.hypot(u - C[0], v - C[1]);
          scl(o, u, v, C[0], C[1], 1 + 0.1 * V.hump, 1 + 0.1 * V.hump, S(0.22, 0.08, d));
          scl(o, u, v, C[0], C[1], 1 - 0.12 * V.hump, 1 - 0.12 * V.hump, S(0.18, 0.42, d));
        }
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v, s = sc.fit * P.scale;
        // a raised tip: its shadow on the sand just beyond it, and the eyespot at its end looking about
        const tipShadow = (i, l) => {
          if (l < 0.05) return;
          const [tu, tv] = TIPS[i], ax = tu - C[0], ay = tv - C[1], len = Math.hypot(ax, ay);
          const [x, y] = at(sc, P, tu - ax / len * 0.13 * l, tv - ay / len * 0.13 * l), [ox, oy] = at(sc, P, tu, tv);
          E.back = true; cloud(E, lerp(x, ox, 0.25) + 12, lerp(y, oy, 0.25) + 16, 30 * s / 1.48, 0.55 * l); E.back = false;
          const a = Math.atan2(oy - y, ox - x), k = 0.6 + 0.4 * Math.sin(t * 5 + i);
          for (const d of [-0.5, 0, 0.5]) line(E, x + Math.cos(a + d) * 34 * s / 1.48, y + Math.sin(a + d) * 34 * s / 1.48, x + Math.cos(a + d) * (34 + 22 * k * l) * s / 1.48, y + Math.sin(a + d) * (34 + 22 * k * l) * s / 1.48, 3);
        };
        if (mode === 'pass') {   // a track of tube-foot prints behind it
          E.back = true;
          const [cx, cy] = at(sc, P, C[0], C[1]);
          for (let x = cx - 0.28 * sc.sw; x > -40; x -= 34) { const j = Math.round(x / 34); disc(E, x, cy - 26 + 52 * (j % 2 ? 1 : 0) + 8 * Math.sin(j), 4 + 2 * rnd(j, 1)); }
          E.back = false;
          tipShadow(V.lead, V.lift);
          return;
        }
        V.lifts.forEach((l, i) => tipShadow(i, l));
        // the clam, drawn in as it comes into view, opened under the star, then gone
        const D = total(OUT), th = beatStart(OUT, 'hump'), tc = beatStart(OUT, 'crawl1');
        const d1 = 260, d2 = 235, a1 = ANG[1] * Math.PI / 180, a2 = ANG[2] * Math.PI / 180;
        const cx = sc.hx + d1 * Math.cos(a1) + d2 * Math.cos(a2) + (C[0] - 0.5) * sc.sw, cy = sc.hy + d1 * Math.sin(a1) + d2 * Math.sin(a2) + (C[1] - 0.5) * sc.sh;
        const kin = clamp((t - tc - 0.5) / 0.7, 0, 1), kout = clamp((t - D + 1.3) / 0.9, 0, 1), open = S(th + 0.6, th + 1.6, t);
        if (kin > 0) {
          E.back = true;
          const gape = 22 * open, rx = 88, ry = 52;
          const top = ellipsePts(cx, cy - gape, rx, ry, 18, Math.PI, TAU), bot = ellipsePts(cx, cy + gape * 0.3, rx, ry * 0.8, 18, 0, Math.PI);
          if (kout < 1) {
            poly(E, top.concat([cx - rx, cy - gape]), 0, true, 2); poly(E, bot, 0, true, 2);
            inkLine(E, top, kin + kout, 4); inkLine(E, bot, kin + kout, 4);
            for (let i = -2; i <= 2; i++) inkLine(E, [cx + i * 22, cy - gape - 4, cx + i * 30, cy - gape - ry * 0.85], kin + kout, 3);
            if (open > 0.1) inkLine(E, [cx - rx * 0.8, cy - gape * 0.5, cx + rx * 0.8, cy - gape * 0.5], 1 + kout, 3);
          }
          E.back = false;
        }
      },
    };
  })();
})();
