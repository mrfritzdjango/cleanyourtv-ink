'use strict';
/* The walkers: malayan-tiger, sunda-pangolin, lesser-mouse-deer, bornean-pygmy-elephant, gaur, sunda-clouded-leopard.
 * All six drawings face left. Legs swing about their hips through a shared foot cycle (planted, then swung forward
 * and lifted); in outings the cycle is tied to the distance walked, so feet slow and settle as the body does. */

(function () {
  const D = Math.PI / 180;

  // ---- shared helpers

  /** A foot's cycle at phase p: [reach, lift]. Planted for `duty` of it, sliding from +1 (forward) to -1 (back) as
   * the body goes over it, then swung forward through the air (lift 0..1..0). A foot lands at whole cycles. */
  function foot(p, duty) {
    p = frac(p);
    if (p < duty) return [1 - 2 * p / duty, 0];
    const k = (p - duty) / (1 - duty);
    return [-1 + 2 * ease(k), hump(k)];
  }
  /** Swings the legs. Each leg is [u0, u1, hipU, hipV, footV, phase, gain]; q is stride cycles walked, amp the foot's
   * reach (drawing units across), lift its rise; extra(i) adds degrees to leg i (a scrape, a stamp, a swat). */
  function legs(o, u, v, r, LS, q, amp, lift, duty, extra) {
    for (let i = 0; i < LS.length; i++) {
      const L = LS[i], w = box(u, v, L[0], L[3] - 0.12, L[1], 1.1, 0.012);
      if (!(w > 0)) continue;
      const g = L[6] || 1, [x, up] = amp || lift ? foot(q + L[5], duty) : [0, 0];
      const deg = Math.atan2(amp * g * x * r, L[4] - L[3]) / D + (extra ? extra(i) : 0);
      rot(o, u, v, L[2], L[3], deg, w * S(L[3] - 0.05, L[3] + 0.07, v), r);
      if (up && lift) shift(o, 0, -lift * g * up, w * S(L[3], L[4], v));
    }
  }
  /** 0..1..0 just after the foot with phase ph lands (the weight going onto it). */
  const landed = (q, ph, win = 0.3) => { const p = frac(q + ph); return p < win ? hump(p / win) : 0; };
  /** Turning round on the spot, as a card turns: the drawing narrows, flips, widens. from: the way it faced. */
  function turnRound(P, k, from) { const c = Math.cos(Math.PI * ease(k)); P.sx = Math.max(0.22, Math.abs(c)); P.m = c >= 0 ? from : -from; }
  /** Ink.pin for a left-facing drawing inside a path, where the engine has not yet mirrored the pose for P.m. */
  function pinM(sc, P, u, v, x, y, angle) { const s = P.mirror; P.mirror = (P.m > 0) !== s; pin(sc, P, u, v, x, y, angle); P.mirror = s; }
  /** Footfalls between t - life and t of the legs with phases phs: fn(Q, te, age, j), Q the pose when it landed. */
  function falls(t, life, poseAt, phs, fn, dt = 1 / 30) {
    const n0 = Math.max(1, Math.ceil((t - life) / dt)), n1 = Math.floor(t / dt + 1e-9);
    if (n1 < n0) return;
    let prev = poseAt((n0 - 1) * dt).v;
    for (let n = n0; n <= n1; n++) {
      const te = n * dt, Q = poseAt(te), V = Q.v;
      if (V.amp > 0.25 && prev.amp > 0.25) for (let j = 0; j < phs.length; j++) if (Math.floor(V.q + phs[j]) > Math.floor(prev.q + phs[j])) fn(Q, te, t - te, j);
      prev = V;
    }
  }
  /** Something thrown at (x, y) with velocity (vx, vy) px/s, age s ago, falling onto the ground at gy. */
  function toss(x, y, vx, vy, age, gy, g = 1700) {
    let tt = age, land = Infinity;
    const disc = vy * vy + 2 * g * (gy - y);
    if (disc >= 0) land = (-vy + Math.sqrt(disc)) / g;
    if (tt > land) tt = land;
    return [x + vx * tt, y + vy * tt + 0.5 * g * tt * tt, age >= land];
  }
  /** A blade of grass from (x, y) up, h tall, its tip leaning deg from upright (+ to the right), w wide at the base. */
  function blade(E, x, y, h, deg, w) {
    const n = 5, L = [], R = [];
    let px = x, py = y;
    for (let i = 0; i <= n; i++) {
      const s = i / n, a = deg * D * Math.pow(s, 1.6), half = 0.5 * w * (1 - s) + 0.6;
      if (i > 0) { px += Math.sin(a) * h / n; py -= Math.cos(a) * h / n; }
      L.push(px - Math.cos(a) * half, py - Math.sin(a) * half); R.unshift(px + Math.cos(a) * half, py + Math.sin(a) * half);
    }
    poly(E, L.concat(R), 0, true, 1);
  }
  /** A paper-filled shape. The player leaves its fill colour at paper after one, so an empty ink shape follows to set
   * it back to ink for the discs and blobs drawn after it. */
  function paper(E, pts) { poly(E, pts, 0, true, 2); poly(E, [-50, -50, -50, -50, -50, -50], 0, true, 1); }
  /** A tiny ant heading deg (0 = right), its legs ticking with phase ph. */
  function ant(E, x, y, deg, ph) {
    const c = Math.cos(deg * D), s = Math.sin(deg * D);
    disc(E, x + c * 7, y + s * 7, 3.2); disc(E, x, y, 2.6); blob(E, x - c * 8, y - s * 8, 5.5, 3.6, deg);
    const k = Math.sin(ph) * 3;
    line(E, x - 4, y + 5 + k * 0.3, x + 4, y - 5, 1.6); line(E, x + 4, y + 5 - k * 0.3, x - 4, y - 5, 1.6);
  }
  /** Short ink ticks radiating up from a spot on the ground (a stamp, a startle). */
  function ticks(E, x, y, r0, len, from, to, n, w = 4) {
    for (let i = 0; i < n; i++) { const a = (from + (to - from) * i / Math.max(1, n - 1)) * D; line(E, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * (r0 + len), y + Math.sin(a) * (r0 + len), w); }
  }
  /** A billow of dust, sand or breath: a few halftone puffs that spread, rise, drift and thin out (puff's signature). */
  function dust(E, x, y, size, age, life, drift = 0, rise = 0.4) {
    const k = clamp(age / life, 0, 1);
    if (k >= 1) return;
    const lv = 0.7 * Math.pow(1 - k, 1.2), seed = Math.round(x * 0.37 + y * 0.11) % 97;
    for (let i = 0; i < 4; i++) {
      const a = rnd(i, seed), b = rnd(i + 5, seed);
      const ox = (i - 1.5) * size * 0.42 * (0.55 + k) + drift * k * (0.6 + 0.6 * a), oy = -size * rise * k * (0.6 + 0.8 * b) - size * 0.18 * (i % 2);
      cloud(E, x + ox, y + oy, size * (0.32 + 0.22 * b) * (0.6 + 0.9 * k), lv * (0.65 + 0.35 * a));
    }
  }
  /** A ring of dust spreading flat on the ground. */
  function dustRing(E, x, y, age, life, r = 130) {
    const k = clamp(age / life, 0, 1);
    if (k >= 1) return;
    oval(E, x, y, r * (0.25 + k), r * (0.25 + k) * 0.2, 0, 5 * (1 - k) + 1);
    cloud(E, x, y - 20 - 30 * k, r * (0.4 + 0.6 * k), 0.6 * (1 - k));
  }

  // ======================================================================================================== TIGER
  (function () {
    const LEGS = [
      [0.29, 0.405, 0.35, 0.58, 0.97, 0.75],   // fore near
      [0.405, 0.475, 0.44, 0.62, 0.93, 0.25],  // fore far
      [0.665, 0.75, 0.71, 0.62, 0.94, 0.5],    // hind far
      [0.755, 0.866, 0.8, 0.56, 0.97, 0],      // hind near
    ];
    const DUTY = 0.65, PASS = 5;
    const OUT = [['look', 0.35], ['turn', 0.45], ['out', 1.5], ['about', 0.5], ['tailup', 0.55], ['spray', 1.0],
      ['taildown', 0.4], ['scrape', 1.1], ['flehmen', 1.5], ['home', 1.6], ['settle', 0.35]];
    // the hanging tail's centre line (degrees, length in drawing heights) and where it goes when raised
    const HANG = [[80.4, 0.105], [93.4, 0.139], [83, 0.114], [69.4, 0.091]], UP = [-84, -94, -84, -60];
    // the drawn tail below the rump, a little wider, to paper over while the raised ink tail is up
    const COVER = [[0.931, 0.44], [0.942, 0.533], [0.937, 0.672], [0.945, 0.782], [0.963, 0.846], [0.967, 0.9], [0.94, 0.93],
      [0.905, 0.889], [0.89, 0.794], [0.883, 0.672], [0.887, 0.533], [0.879, 0.44]];
    const fore = q => landed(q, 0.75) + landed(q, 0.25);
    const farX = sc => sc.hx + Math.min(560, 0.82 * sc.right);
    const trunkX = sc => farX(sc) + 0.5 * sc.sw + 40;

    /** The raised (or raising) tail in ink, k 0 hanging .. 1 straight up; quiver adds a shiver. */
    function inkTail(E, sc, P, k, quiver, t) {
      const r = sc.a.w / sc.a.h, sh = sc.sh * P.scale;
      let u = 0.905, v = 0.405;
      const C = [at(sc, P, u, v)];
      HANG.forEach(([deg, len], i) => {
        const ki = ease(clamp(k * 1.45 - 0.15 * i, 0, 1));
        const a0 = (HANG[i - 1] ? lerp(HANG[i - 1][0], UP[i - 1], ease(clamp(k * 1.45 - 0.15 * (i - 1), 0, 1))) : lerp(deg, UP[i], ki));
        const a1 = lerp(deg, UP[i], ki) + quiver * 5 * Math.sin(TAU * 4.5 * t + i * 1.3);
        for (let j = 1; j <= 3; j++) {
          const a = lerp(a0, a1, j / 3) * D, ds = (i === 0 && j === 1 ? len + 0.03 : len) / 3;
          u += Math.cos(a) * ds / r; v += Math.sin(a) * ds;
          C.push(at(sc, P, u, v));
        }
      });
      const n = C.length, Lp = [], Rp = [];
      for (let i = 0; i < n; i++) {
        const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        const hw = 0.5 * 0.075 * sh * (1 - 0.12 * i / n), nx = -dy / l, ny = dx / l;
        Lp.push([C[i][0] + nx * hw, C[i][1] + ny * hw]); Rp.push([C[i][0] - nx * hw, C[i][1] - ny * hw]);
      }
      const ring = Lp.concat(Rp.slice().reverse()).flat(), sw = 2.6 * sc.fit * P.scale;
      poly(E, ring, 0, true, 3, 0.68);
      poly(E, Lp.flat(), sw); poly(E, Rp.flat(), sw);
      for (const s of [0.22, 0.42, 0.6, 0.76]) {   // the stripes, from the outer edge in
        const i = Math.round(s * (n - 1)), a = Rp[i], c = C[i];
        line(E, a[0], a[1], lerp(a[0], Lp[i][0], 0.7), lerp(a[1], Lp[i][1], 0.7), 0.024 * sh);
        void c;
      }
      const e = C[n - 1];
      disc(E, e[0], e[1], 0.045 * sh);
    }
    function trunk(E, sc, g, yg) {   // a tree trunk, drawn up from the ground as g goes 0..1
      if (g <= 0.01) return;
      const x = trunkX(sc), w = 92, top = lerp(yg, -30, g), L = [], R = [];
      for (let y = yg; y >= top - 1; y -= 40) {
        const f = S(yg - 90, yg, y);
        L.push([x - 26 * f + 6 * Math.sin(y * 0.013), y]); R.push([x + w + 30 * f + 5 * Math.sin(y * 0.011 + 1), y]);
      }
      L.push([x + 6 * Math.sin(top * 0.013), top]); R.push([x + w + 5 * Math.sin(top * 0.011 + 1), top]);
      const pts = L.flat().concat(R.slice().reverse().flat());
      E.back = true;
      poly(E, pts, 0, true, 3, 0.3);
      poly(E, L.flat(), 5); poly(E, R.flat(), 5);
      for (let i = 0; i < 9; i++) {
        const y0 = yg - 60 - i * 95 - 30 * rnd(i, 7); if (y0 < top + 20) break;
        const xx = x + 18 + (w - 36) * rnd(i, 8);
        line(E, xx, y0, xx + 4, y0 - 40 - 30 * rnd(i, 9), 4);
      }
      line(E, x - 70, yg + 4, x + w + 80, yg + 4, 4);
      E.back = false;
    }

    M['malayan-tiger'] = {
      facing: 'L',
      pass: { dur: PASS, path(t, P, sc) {
        const v = P.v, x0 = -sc.sw / 2 - 40, x1 = WW + sc.sw / 2 + 40;
        P.m = 1; P.x = lerp(x0, x1, t / PASS); v.b = 'walk';
        v.q = (P.x - x0) / (0.55 * sc.sw); v.amp = 1;
        P.y = ground(sc) + 0.006 * sc.sh * fore(v.q);
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, xf = farX(sc), stride = 0.55 * sc.sw;
        v.b = b.name; v.amp = 0; v.q = 0; v.tailfx = -1; P.m = -1; P.x = sc.hx;
        const walk = k => S(0, 0.14, k) * S(1, 0.86, k);
        if (b.name === 'look') { P.x = sc.hx - 8 * hump(b.k); v.head = -3 * hump(b.k); }
        else if (b.name === 'turn') turnRound(P, b.k, -1);
        else if (b.name === 'out') { const d = (xf - 25 - sc.hx) * ease(b.k); P.m = 1; P.x = sc.hx + d; v.q = d / stride; v.amp = walk(b.k); }
        else if (b.name === 'about') { turnRound(P, b.k, 1); P.x = xf - 25 + 25 * ease(b.k); }
        else if (b.name === 'tailup') { P.x = xf; v.tailfx = ease(b.k); v.haunch = ease(b.k); }
        else if (b.name === 'spray') { P.x = xf; v.tailfx = 1; v.quiver = S(0, 0.15, b.k) * S(1, 0.8, b.k); v.spray = b.k; v.haunch = 1; }
        else if (b.name === 'taildown') { P.x = xf; v.tailfx = 1 - ease(b.k); v.haunch = 1 - ease(b.k); }
        else if (b.name === 'scrape') {
          P.x = xf; const k = b.k;
          v.scrN = k < 0.5 ? Math.pow(hump(k / 0.5), 0.7) : 0; v.scrF = k >= 0.5 ? Math.pow(hump((k - 0.5) / 0.5), 0.7) : 0;
          P.x -= 10 * (v.scrN + v.scrF); v.head = -2 * (v.scrN + v.scrF);
        } else if (b.name === 'flehmen') { P.x = xf; v.head = 7 * S(0, 0.16, b.k) * S(1, 0.84, b.k); v.still = S(0, 0.1, b.k) * S(1, 0.9, b.k); }
        else if (b.name === 'home') { const d = (xf - sc.hx) * ease(b.k); P.x = xf - d; v.q = d / stride; v.amp = walk(b.k); }
        else { v.head = -1.5 * hump(b.k); }
        P.y = sc.hy + 0.006 * sc.sh * fore(v.q) * v.amp;
        P.angle = -1.6 * (v.haunch || 0);
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, amp = V.amp || 0, q = V.q || 0;
        legs(o, u, v, r, LEGS, q, 0.035 * amp, 0.03 * amp, DUTY, i => (i === 3 ? -18 * (V.scrN || 0) : i === 2 ? -18 * (V.scrF || 0) : 0));
        if (V.scrN || V.scrF) {   // the scraping foot rakes back low, along the ground
          shift(o, 0, -0.025 * (V.scrN || 0), box(u, v, 0.755, 0.8, 0.866, 1.05, 0.012));
          shift(o, 0, -0.025 * (V.scrF || 0), box(u, v, 0.665, 0.8, 0.75, 1.05, 0.012));
        }
        // the shoulder blades roll above the back line as each foreleg takes the weight
        const pN = frac(q + 0.75), pF = frac(q + 0.25);
        if (amp) {
          shift(o, 0, -0.022 * amp * (pN < DUTY ? hump(pN / DUTY) : 0), box(u, v, 0.31, 0.1, 0.42, 0.42, 0.04));
          shift(o, 0, -0.014 * amp * (pF < DUTY ? hump(pF / DUTY) : 0), box(u, v, 0.43, 0.1, 0.52, 0.42, 0.04));
        }
        // the head, level and low, dips at each fore footfall
        rot(o, u, v, 0.31, 0.42, (V.head || 0) - 2 * amp * fore(q), S(0.33, 0.25, u) * S(0.68, 0.56, v), r);
        // breathing
        scl(o, u, v, 0.55, 0.62, 1, 1 + 0.008 * Math.sin(TAU * 0.5 * t), box(u, v, 0.3, 0.12, 0.85, 0.66, 0.06));
        if (!(V.tailfx >= 0)) {   // the tail hangs in a low J: it sways a beat behind the stride, its tip flicks
          const tw = S(0.872, 0.902, u) * S(0.4, 0.58, v), still = 1 - 0.85 * (V.still || 0);
          const sway = amp * 5 * Math.sin(TAU * (q - 0.2)) + (1 - amp) * 3 * Math.sin(TAU * 0.45 * t) * still;
          rot(o, u, v, 0.905, 0.43, sway, tw, r);
          const fl = amp * hump(clamp((frac(q / 2) - 0.5) / 0.22, 0, 1)) + (1 - amp) * still * hump(clamp((frac(t / 2.3) - 0.6) / 0.15, 0, 1));
          rot(o, u, v, 0.918, 0.76, -14 * fl, tw * S(0.72, 0.84, v), r);
        }
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {   // tall grass in front: blades bend away as the body goes through, then spring back
          const x0 = -sc.sw / 2 - 40, vel = (WW + sc.sw + 80) / PASS;
          for (let i = 0; i < 17; i++) for (let j = 0; j < 3; j++) {
            const gx = 30 + i * 118 + 60 * rnd(i, 1) + (j - 1) * 16, h = 120 + 120 * rnd(i * 3 + j, 2);
            const tIn = (gx - 40 - 0.22 * sc.sw - x0) / vel, tOut = (gx + 30 + 0.4 * sc.sw - x0) / vel;
            let a = 0;
            if (t >= tIn && t < tOut) a = 16 * S(tIn, tIn + 0.2, t);
            else if (t >= tOut) a = 16 * Math.exp(-(t - tOut) * 4.5) * Math.cos((t - tOut) * 13);
            const lean = (j - 1) * 7 + (rnd(i, 4) - 0.5) * 8 + 3 * Math.sin(TAU * 0.6 * t + gx * 0.01);
            const grow = S(0, 0.45, t - 0.012 * i) * (1 - S(PASS - 0.45, PASS, t + 0.012 * (16 - i)));   // grass springs up, and lies down at the end
            if (grow > 0.02) blade(E, gx, HH + 6, h * grow, lean + a, 11);
          }
          return;
        }
        const d = Ink.duration('malayan-tiger', 'outing'), yg = sc.hy + 0.47 * sc.sh;
        const tg = S(0.05, 0.75, t) * (1 - S(d - 0.6, d - 0.05, t)), ttop = lerp(yg, -30, tg);
        trunk(E, sc, tg, yg);
        if (V.b === 'out' || V.b === 'home') falls(t, 0.7, poseAt, [0.75, 0.25], (Q, te, age, j) => {
          const [fx, fy] = at(sc, Q, j ? 0.44 : 0.35, 0.95); dust(E, fx, fy, 22, age, 0.7, 0, 0.3);
        });
        const X = trunkX(sc), [sx, sy] = at(sc, P, 0.93, 0.47), b = beat(t, OUT);
        if (V.tailfx >= 0) {
          paper(E, COVER.map(([u, v]) => at(sc, P, u, v)).flat());
          inkTail(E, sc, P, V.tailfx, V.quiver || 0, t);
        }
        const tS = beatStart(OUT, 'spray'), top = yg - 0.95 * sc.sh * 0.9, low = yg - 0.42 * sc.sh * 0.9;
        if (t >= tS) {   // the mark: a wet halftone patch on the bark, fading slowly, and the fan of fine droplets
          const wet = S(tS, tS + 0.9, t);
          E.back = true;
          for (let i = 0; i < 6; i++) { const y = lerp(low, top, (i + 0.5) / 6); if (y - 50 > ttop) cloud(E, X + 30 + 25 * rnd(i, 3), y, 55 * wet, 0.55 * wet * (1 - 0.4 * S(d - 3, d, t))); }
          for (let i = 0; i < 3; i++) { const y0 = lerp(low, top, 0.2 + 0.3 * i), run = 90 * S(tS + 0.4 + 0.2 * i, tS + 1.6 + 0.2 * i, t); if (run > 2 && y0 > ttop) line(E, X + 14 + 22 * i, y0, X + 14 + 22 * i, y0 + run, 4); }
          E.back = false;
        }
        if (V.b === 'spray') emit(t, 0.02, 0.26, (i, te, age) => {
          const k = age / 0.26, y1 = lerp(low, top, rnd(i, 5)), x = lerp(sx, X + 8, k), y = lerp(sy, y1, k) - 60 * hump(k) * (0.5 + rnd(i, 6));
          disc(E, x, y, 4 + 3 * rnd(i, 7));
          disc(E, x - 18, y + 8 * rnd(i, 9) - 4, 3);
          if (rnd(i, 8) > 0.4) disc(E, x - 34, y + 10 * rnd(i, 10) - 5, 2.5);
        }, tS + 0.08, tS + 0.85);
        if (V.b === 'spray') cloud(E, lerp(sx, X, 0.55), lerp(sy, (top + low) / 2, 0.5), 110 * S(0, 0.3, V.spray), 0.22 * (1 - S(0.7, 1, V.spray)));
        const tc = beatStart(OUT, 'scrape');
        if (t >= tc && t < tc + 2.1) for (const [n, dl, u] of [[0, 0.28, 0.82], [1, 0.83, 0.71]]) {   // two rakes, each throws dirt back
          const te = tc + dl, age = t - te; if (age < 0 || age > 1.3) continue;
          const Q = poseAt(te), [fx, fy] = at(sc, Q, u, 0.96);
          dust(E, fx + 30, fy, 50, age, 1.0, 120, 0.5);
          for (let j = 0; j < 7; j++) {
            const [x, y, down] = toss(fx + 10, fy - 6, 260 + 380 * rnd(j, n + 20), -380 - 300 * rnd(j, n + 30), age, yg + 4);
            if (age < 1.2) blob(E, x, y, down ? 7 : 6 + 3 * rnd(j, n), down ? 3.5 : 5, j * 40 + age * 500);
          }
        }
        if (V.b === 'flehmen') {   // the scent coming off the mark to the curled lip
          const [nx, ny] = at(sc, P, 0.09, 0.3), k = b.k;
          for (let j = 0; j < 2; j++) {
            const kk = clamp(k * 1.4 - j * 0.3, 0, 1); if (kk <= 0 || kk >= 1) continue;
            const x = lerp(X - 10, nx + 300, kk), y = lerp(top + 120 + j * 90, ny - 60, kk), pts = [];
            for (let s = 0; s <= 6; s++) pts.push(x + s * 22, y + 9 * Math.sin(s * 1.6 + t * 8));
            poly(E, pts, 3);
          }
        }
      },
    };
  })();

  // ====================================================================================================== PANGOLIN
  (function () {
    const LEGS = [
      [0.235, 0.316, 0.28, 0.65, 0.92, 0.75, 0.5],  // fore near: on its knuckles, the forefeet barely reach
      [0.316, 0.385, 0.35, 0.67, 0.91, 0.25, 0.5],  // fore far
      [0.545, 0.655, 0.6, 0.58, 0.92, 0, 1],        // hind near
      [0.655, 0.722, 0.69, 0.63, 0.91, 0.5, 1],     // hind far
    ];
    const DUTY = 0.7, PASS = 5;
    const OUT = [['turn', 0.5], ['out', 2.0], ['nod', 1.6], ['startle', 0.35], ['curl', 0.45], ['roll', 1.2],
      ['hold', 1.25], ['uncurl', 0.5], ['turn2', 0.45], ['home', 0.9]];
    // the arch of the back is near a half circle about (0.5, 1.05): curling it is that circle wound twice as tight
    const R = 2, CX = 0.5 * R, CY = 1.05, TIPS = [[0.1, 0.82], [1.9, 0.88], [0.55, 0.92], [1.25, 0.92]];
    function curlMap(X, Y, m, cy) {
      const phi = Math.atan2(Y - CY, X - CX), rho = Math.hypot(X - CX, Y - CY), pn = -Math.PI / 2 + (phi + Math.PI / 2) * m;
      return [CX + rho / m * Math.cos(pn), cy + rho / m * Math.sin(pn)];
    }
    /** The centre height that keeps the lowest point of the curling body on the ground (v 0.92). */
    function curlCy(c) {
      const m = 1 + 1.3 * c;
      let low = -1;
      for (const [X, Y] of TIPS) low = Math.max(low, curlMap(X, Y, m, 0)[1]);
      return 0.92 - low;
    }
    const BALL = curlCy(1);   // the ball's centre (v) when wound up
    const xm = sc => sc.hx + Math.min(480, 0.75 * sc.right);
    const xr = sc => sc.hx + 90;
    /** The pass's x at time t (a stiff, surging shuffle) and its inverse, for the ants. */
    const passX = (sc, t) => lerp(-sc.sw / 2 - 40, WW + sc.sw / 2 + 40, surge(t / PASS, 16, 0.3));
    function passT(sc, x) { let a = 0, b = PASS; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (passX(sc, m) < x) a = m; else b = m; } return (a + b) / 2; }

    M['sunda-pangolin'] = {
      facing: 'L',
      pass: { dur: PASS, path(t, P, sc) {
        const v = P.v, x0 = -sc.sw / 2 - 40;
        P.m = 1; P.x = passX(sc, t); v.b = 'shuffle';
        v.q = (P.x - x0) / (0.26 * sc.sw); v.amp = 1;
        P.y = ground(sc) - 0.006 * sc.sh * (landed(v.q, 0) + landed(v.q, 0.5));
        P.angle = 1.2 * Math.sin(TAU * v.q);
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, XM = xm(sc), XR = xr(sc), stride = 0.2 * sc.sw;
        v.b = b.name; v.amp = 0; v.q = 0; v.curl = 0; P.m = 1; P.x = sc.hx; P.y = sc.hy;
        const walk = k => S(0, 0.12, k) * S(1, 0.88, k);
        if (b.name === 'turn') { turnRound(P, b.k, -1); }
        else if (b.name === 'out') { const d = (XM - sc.hx) * ease(b.k); P.x = sc.hx + d; v.q = d / stride; v.amp = walk(b.k); }
        else if (b.name === 'nod') {
          const n = 0.5 - 0.5 * Math.cos(TAU * b.t / 0.4), env = S(0, 0.12, b.k);
          v.nod = n * env; v.head = -8 * env - 7 * n * env; P.x = XM + 14 * n * env;
        } else if (b.name === 'startle') { P.x = XM - 12 * hump(b.k); v.flinch = hump(b.k); v.head = -8 * (1 - b.k) - 10 * b.k; }
        else if (b.name === 'curl') { P.x = XM; v.curl = ease(b.k); v.head = -10 * (1 - b.k); }
        else if (b.name === 'roll') {   // one turn, rolling back the way it came
          const k = ease(b.k); v.curl = 1;
          pinM(sc, P, 0.5, BALL, lerp(XM, XR, k), sc.hy + (BALL - 0.5) * sc.sh - 14 * Math.abs(Math.sin(TAU * k)) * (1 - k), -360 * k);
        } else if (b.name === 'hold') {   // rocks to rest, breathes, peeks
          v.curl = 1 - 0.1 * hump(clamp((b.k - 0.62) / 0.25, 0, 1)); v.cut = b.t < 0.02;
          const rock = -9 * Math.exp(-b.t * 3.5) * Math.sin(b.t * 9);
          pinM(sc, P, 0.5, BALL, XR - rock * D * 0.42 * sc.sh, sc.hy + (BALL - 0.5) * sc.sh, rock);
        } else if (b.name === 'uncurl') { P.x = XR; v.curl = 1 - ease(b.k); }
        else if (b.name === 'turn2') { P.x = XR; turnRound(P, b.k, 1); }
        else { const d = (XR - sc.hx) * ease(b.k); P.m = -1; P.x = XR - d; v.q = d / stride; v.amp = walk(b.k); }
        if (v.amp) { P.y = sc.hy - 0.006 * sc.sh * (landed(v.q, 0) + landed(v.q, 0.5)) * v.amp; P.angle = 1.2 * Math.sin(TAU * v.q) * v.amp; }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, amp = V.amp || 0, c = V.curl || 0;
        legs(o, u, v, r, LEGS, V.q || 0, 0.04 * amp, 0.02 * amp, DUTY);
        // the snout sniffs low; the nods push it in
        const head = S(0.28, 0.2, u) * S(0.52, 0.6, v);
        rot(o, u, v, 0.27, 0.64, (V.head || 0) + 3 * Math.sin(TAU * 1.3 * t) * (1 - c), head, r);
        // the tail drags low and sways
        rot(o, u, v, 0.74, 0.48, 2.5 * Math.sin(TAU * ((V.q || 0) - 0.25)) * amp + 1.2 * Math.sin(TAU * 0.4 * t), S(0.71, 0.86, u), r);
        if (V.flinch) scl(o, u, v, 0.5, 0.92, 1.02, 1 - 0.05 * V.flinch, 1);
        // breathing scales
        scl(o, u, v, 0.5, 0.92, 1, 1 + 0.008 * Math.sin(TAU * 0.7 * t), box(u, v, 0.25, 0.05, 0.8, 0.6, 0.08));
        if (c > 0) {
          const X = u * r, m = 1 + 1.3 * c, [Xn, Yn] = curlMap(X, v, m, curlCy(c));
          o[0] += (Xn - X) / r - o[0] * c; o[1] += Yn - v - o[1] * c;
        }
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          const gy = ground(sc) + 0.42 * sc.sh;
          for (let i = 0; i < 22; i++) {   // ants on the forest floor scatter from the snout
            const ax = 50 + i * 88 + 40 * rnd(i, 1), ay = gy + 8 - 12 * rnd(i, 2);
            const tS = passT(sc, ax - 0.46 * sc.sw - 140), a = t - tS;
            if (a < 0) { const w = 16 * Math.sin(0.9 * t + i); ant(E, ax + w, ay, Math.cos(0.9 * t + i) > 0 ? 0 : 180, t * 20 + i); continue; }
            const back = rnd(i, 3) < 0.3, deg = back ? 150 + 60 * rnd(i, 4) : -50 + 100 * rnd(i, 4);
            const sp = 330 + 200 * rnd(i, 5), wig = 10 * Math.sin(a * 14 + i);
            const x = ax + Math.cos(deg * D) * sp * a, y = ay + Math.sin(deg * D) * sp * a * 0.12 + wig * 0.3;
            if (x > -40 && x < WW + 40) ant(E, x, y, deg + wig, t * 40 + i);
          }
          falls(t, 1.1, poseAt, [0, 0.5], (Q, te, age, j) => {   // leaf litter flicked back by the hind feet
            const [fx, fy] = at(sc, Q, j ? 0.69 : 0.6, 0.92);
            for (let n = 0; n < 2; n++) {
              const s = j * 2 + n + Math.round(te * 30), [x, y, down] = toss(fx, fy - 10, -150 - 160 * rnd(s, 6), -360 - 200 * rnd(s, 7), age, gy + 6);
              leaf(E, x, y, down ? 8 * rnd(s, 8) : age * 600 + 90 * rnd(s, 9), 14, rnd(s, 10) > 0.5);
            }
          });
          return;
        }
        const d = Ink.duration('sunda-pangolin', 'outing'), b = beat(t, OUT);
        const gy = sc.hy + 0.42 * sc.sh, XM = xm(sc), mx = XM + 0.46 * sc.sw + 95;
        // the termite mound rises from the ground, and sinks again at the end
        const g = S(0.1, 0.8, t) * (1 - S(d - 0.6, d - 0.05, t));
        if (g > 0.01) {
          const pts = [];
          for (let i = 0; i <= 18; i++) {
            const a = Math.PI * i / 18, wob = 1 + 0.06 * Math.sin(i * 2.7);
            pts.push(mx - Math.cos(a) * 118 * wob * (0.6 + 0.4 * g), gy + 6 - Math.pow(Math.sin(a), 0.7) * (150 + 70 * Math.pow(Math.sin(a), 6)) * g * wob);
          }
          E.back = true;
          poly(E, pts, 4, true, 3, 0.45);
          if (g > 0.6) { blob(E, mx - 30, gy - 70 * g, 9, 13); blob(E, mx + 34, gy - 120 * g, 7, 10); blob(E, mx + 8, gy - 30 * g, 10, 7); }
          line(E, mx - 200, gy + 6, mx + 160, gy + 6, 4);
          E.back = false;
          for (let i = 0; i < 4; i++) {   // termites at the mound's foot
            const k = frac(t * 0.25 + i * 0.27), x = mx - 120 + 240 * k * g, y = gy + 2 - 18 * Math.sin(Math.PI * k) * g;
            if (g > 0.5 && !(V.b === 'nod' && x < mx - 40)) ant(E, x, y, Math.sin(Math.PI * k) > 0 ? -20 + 40 * k : 0, t * 30 + i);
          }
        }
        if (V.curl > 0.85) {   // the ball is solid: scales and tucked belly fill the ring's middle
          const [cx, cy] = at(sc, P, 0.5, curlCy(V.curl)), rr = 0.3 * sc.sh * S(0.7, 1, V.curl), pts = [];
          for (let i = 0; i < 24; i++) pts.push(cx + rr * Math.cos(TAU * i / 24), cy + rr * Math.sin(TAU * i / 24));
          E.back = true; poly(E, pts, 0, true, 3, 0.68); E.back = false;
        }
        if (V.b === 'out' || V.b === 'home') falls(t, 0.8, poseAt, [0, 0.5], (Q, te, age, j) => {
          const [fx, fy] = at(sc, Q, j ? 0.69 : 0.6, 0.92), s = Math.round(te * 30) + j;
          const [x, y, down] = toss(fx, fy - 6, (Q.m > 0 ? -1 : 1) * (90 + 90 * rnd(s, 1)), -260 - 120 * rnd(s, 2), age, gy + 4);
          leaf(E, x, y, down ? 0 : age * 500, 11, rnd(s, 3) > 0.5);
        });
        const tn = beatStart(OUT, 'nod');
        if (t >= tn && t < tn + 2.6) for (let n = 0; n < 4; n++) {   // soil crumbs fly back over the head at each nod
          const te = tn + 0.2 + 0.4 * n, age = t - te; if (age < 0 || age > 0.95) continue;
          const [sx, sy] = at(sc, poseAt(te), 0.05, 0.8);
          for (let j = 0; j < 6; j++) {
            const [x, y] = toss(sx + 10, sy - 20, -120 - 260 * rnd(j, n), -420 - 260 * rnd(j, n + 9), age, gy + 4);
            disc(E, x, y, 3 + 4 * rnd(j, n + 4));
          }
          dust(E, sx + 20, sy - 10, 40, age, 0.6, -30);
        }
        // the falling leaf that sets it off: drifts down onto its back, bounces off and lies on the ground
        const tHit = beatStart(OUT, 'startle'), H = poseAt(tHit), [hx, hy] = at(sc, H, 0.5, 0.06), tl = t - tHit;
        if (tl > -2.2 && t < d - 0.4) {
          if (tl < 0) { const a = -tl; leaf(E, hx + 70 * Math.sin(a * 3.3), hy - 30 - 230 * a, 40 * Math.sin(a * 3.3 + 0.6) + 20, 24, true); }
          else { const [x, y, down] = toss(hx, hy - 30, -170, -260, tl, gy, 900); leaf(E, x + (down ? 0 : 30 * Math.sin(tl * 6)), y, down ? 6 : 30 + 40 * Math.sin(tl * 6), 24, true); }
        }
        if (V.b === 'startle' || (V.b === 'curl' && beat(t, OUT).k < 0.4)) {
          const k = clamp((t - tHit) / 0.45, 0, 1), [x, y] = at(sc, P, 0.5, 0.04);
          if (k < 1) ticks(E, x, y - 30, 30 + 40 * k, 34, -150, -30, 5, 4);
        }
        if (V.b === 'roll') {   // dust and motion arcs behind the rolling ball
          const k = b.k, [cx, cy] = at(sc, P, 0.5, BALL), rr = (0.92 - BALL) * sc.sh;
          for (let i = 0; i < 3; i++) arc(E, cx, cy, rr + 26 + 20 * i, -60 + 40 * i - 360 * ease(k) * 0, 70 - 15 * i, 4);
          emit(t, 0.12, 0.7, (i, te, age) => { const [px] = at(sc, poseAt(te), 0.5, BALL); dust(E, px + 60, gy, 46, age, 0.7, 50, 0.4); }, beatStart(OUT, 'roll'), beatStart(OUT, 'roll') + 1.0);
        }
      },
    };
  })();

  // ================================================================================================ MOUSE-DEER
  (function () {
    const LEGS = [
      [0.315, 0.382, 0.355, 0.6, 0.96, 0.75],   // fore near
      [0.382, 0.44, 0.405, 0.64, 0.95, 0.25],   // fore far
      [0.72, 0.797, 0.765, 0.6, 0.95, 0.5],     // hind far
      [0.82, 0.9, 0.86, 0.58, 0.96, 0],         // hind near
    ];
    const BOUND = LEGS.map((L, i) => L.slice(0, 5).concat([i < 2 ? 0 : 0.5]));   // the dart: fore pair, then hind pair
    const PASSB = [['dart1', 0.6], ['freeze1', 0.5], ['dart2', 0.6], ['freeze2', 0.5], ['dart3', 0.8]];
    const OUT = [['look', 0.3], ['turn', 0.4], ['tiptoe', 2.0], ['freeze', 1.3], ['drum', 1.0], ['whirl', 0.3],
      ['dash', 1.0], ['alert', 0.5], ['tiptoe2', 1.1], ['settle', 0.3]];
    const DRUM = 3.5;   // stamps a second for each hind foot: 7 together
    const ease1 = { dart1: k => k + k * k - k * k * k, dart2: ease, dart3: k => k * k };
    const far = sc => sc.hx + Math.min(560, 0.82 * sc.right);
    const back = sc => sc.hx + 120;
    /** A hind foot's stamp (0..1) at time tt into the drum, and whether that foot is down. */
    const stamp = (tt, j) => Math.pow(Math.max(0, Math.sin(TAU * DRUM * tt + j * Math.PI)), 1.4);

    M['lesser-mouse-deer'] = {
      facing: 'L', size: [0.85, 0.7],
      pass: { dur: total(PASSB), path(t, P, sc) {
        const b = beat(t, PASSB), v = P.v, X = [-sc.sw / 2 - 40, WW * 0.33, WW * 0.66, WW + sc.sw / 2 + 40];
        v.b = b.name; P.m = 1; v.amp = 0; v.q = 0;
        const n = b.name.slice(-1) - 1;
        if (b.name.startsWith('dart')) {
          const e = ease1[b.name], k = b.k;
          P.x = lerp(X[n], X[n + 1], e(k));
          v.sp = clamp((e(Math.min(1, k + 0.02)) - e(Math.max(0, k - 0.02))) / 0.04 / 2, 0, 1);
          v.q = b.t * 4.2; v.amp = Math.min(1, v.sp * 1.6); v.dart = 1;
          v.head = n > 0 ? 4 * (1 - ease(Math.min(1, b.k * 2))) : 0;
        } else {   // the freeze: not a pixel moves, until the head snaps up at its end
          P.x = X[n + 1]; v.sp = 0; v.head = 4 * S(0.38, 0.5, b.t); v.still = 1;
        }
        P.y = ground(sc) - 0.015 * sc.sh * Math.abs(Math.sin(TAU * v.q / 2)) * v.amp;
        P.angle = 2.5 * (v.sp || 0);
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, XF = far(sc), XB = back(sc), stride = 0.22 * sc.sw;
        v.b = b.name; v.amp = 0; v.q = 0; P.m = -1; P.x = sc.hx; P.y = sc.hy;
        const walk = k => S(0, 0.12, k) * S(1, 0.88, k);
        if (b.name === 'look') { v.head = 3 * hump(b.k); v.ear = hump(b.k); }
        else if (b.name === 'turn') turnRound(P, b.k, -1);
        else if (b.name === 'tiptoe') { const d = (XF - sc.hx) * ease(b.k); P.m = 1; P.x = sc.hx + d; v.q = d / stride; v.amp = walk(b.k); v.tip = 1; }
        else if (b.name === 'freeze') { P.m = 1; P.x = XF; v.head = 4 * S(0, 0.08, b.k); v.ear = hump(clamp((b.k - 0.5) / 0.12, 0, 1)); }
        else if (b.name === 'drum') { P.m = 1; P.x = XF; v.head = 4; v.drum = S(0, 0.06, b.k) * S(1, 0.94, b.k); v.dt = b.t; P.y += 3 * (stamp(b.t, 0) + stamp(b.t, 1)) * v.drum; }
        else if (b.name === 'whirl') { turnRound(P, b.k, 1); P.x = XF - 30 * ease(b.k); P.y -= 40 * hump(b.k); v.head = 4; }
        else if (b.name === 'dash') {   // a zigzag bolt, switching lanes three times (far lanes smaller)
          const k = b.k, e = k * (1.6 - 0.6 * k), s = Math.sin(3 * Math.PI * k);
          P.x = lerp(XF - 30, XB, e); P.y = sc.hy - 75 * Math.max(0, s) + 50 * Math.max(0, -s); P.scale = 1 - 0.1 * Math.max(0, s);
          P.angle = 7 * Math.cos(3 * Math.PI * k) * S(0, 0.08, k) * S(1, 0.85, k);
          v.q = b.t * 4.4; v.amp = S(0, 0.06, k) * S(1, 0.8, k); v.dart = 1; v.sp = v.amp; v.head = 4 * (1 - S(0, 0.3, k));
          P.y -= 0.02 * sc.sh * Math.abs(Math.sin(TAU * v.q / 2)) * v.amp;
        } else if (b.name === 'alert') { P.x = XB; v.head = 5 * S(0, 0.25, b.k); v.tail = hump(clamp(b.k / 0.4, 0, 1)); v.ear = hump(clamp((b.k - 0.5) / 0.3, 0, 1)); }
        else if (b.name === 'tiptoe2') { const d = (XB - sc.hx) * ease(b.k); P.x = XB - d; v.q = d / stride; v.amp = walk(b.k); v.tip = 1; v.head = 5 * (1 - ease(b.k)); }
        else { v.head = -1.5 * hump(b.k); }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, amp = V.amp || 0;
        if (V.dart) legs(o, u, v, r, BOUND, V.q, 0.075 * amp, 0.035 * amp, 0.4);
        else legs(o, u, v, r, LEGS, V.q || 0, 0.025 * amp, 0.045 * amp, 0.55);
        if (V.drum) for (let j = 0; j < 2; j++) {   // the hind feet drum, one then the other
          const s = stamp(V.dt, j) * V.drum, L = LEGS[j ? 3 : 2], w = box(u, v, L[0], L[3] - 0.12, L[1], 1.1, 0.012);
          if (w > 0) { shift(o, 0, -0.07 * s, w * S(L[3], L[4], v)); rot(o, u, v, L[2], L[3], 9 * s, w * S(L[3] - 0.05, L[3] + 0.07, v), r); }
        }
        const head = V.head || 0, dip = V.dart ? -3 * amp : 0, bob = V.tip ? 2 * Math.sin(TAU * 2 * (V.q || 0)) * amp : 0;
        rot(o, u, v, 0.3, 0.45, head + dip + bob, S(0.32, 0.26, u) * S(0.68, 0.6, v), r);
        rot(o, u, v, 0.2, 0.38, -16 * (V.ear || 0), box(u, v, 0.15, 0.22, 0.235, 0.37, 0.02), r);
        const tail = Math.max(V.tail || 0, V.drum ? (0.6 + 0.4 * stamp(V.dt, 0)) * V.drum : 0, V.dart ? amp : 0);
        rot(o, u, v, 0.92, 0.34, -40 * tail, box(u, v, 0.915, 0.24, 1, 0.42, 0.02), r);
        if (!V.still) scl(o, u, v, 0.6, 0.6, 1, 1 + 0.01 * Math.sin(TAU * 1.1 * t), box(u, v, 0.35, 0.05, 0.9, 0.55, 0.06));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v, pass = mode === 'pass';
        const gy = pass ? ground(sc) + 0.46 * sc.sh : sc.hy + 0.46 * sc.sh;
        // leaf specks kicked up by the darting feet; they settle and lie still in the freezes
        const run = pass ? [0, 0.6, 1.1, 1.7, 2.2, 3.0] : [beatStart(OUT, 'dash'), beatStart(OUT, 'dash') + 1.0];
        for (let s = 0; s + 1 < run.length; s += 2) emit(t, 0.07, 1.25, (i, te, age) => {
          const Q = poseAt(te); if (!(Q.v.sp > 0.25)) return;
          const [fx, fy] = at(sc, Q, i % 2 ? 0.86 : 0.36, 0.95), dir = Q.m > 0 ? -1 : 1;
          for (let j = 0; j < 2; j++) {
            const z = i * 2 + j, [x, y, down] = toss(fx, fy - 4, dir * (120 + 260 * rnd(z, s + 1)), -300 - 340 * rnd(z, s + 2), age, pass ? gy + 8 * rnd(z, 3) : Q.y + 0.46 * sc.sh * Q.scale);
            blob(E, x, y, 6, 2.6, down ? 6 * rnd(z, 4) : age * 700 + 90 * rnd(z, 5));
          }
        }, run[s], run[s + 1]);
        if (V.dart && (V.sp || 0) > 0.15) {   // speed lines trail the blurred legs and body
          for (let i = 0; i < 5; i++) {
            const vv = 0.45 + 0.11 * i, [x, y] = at(sc, P, 0.96 - 0.12 * (i % 2), vv), dir = P.m > 0 ? -1 : 1, len = (90 + 160 * rnd(i, 6)) * V.sp;
            line(E, x + dir * 30, y, x + dir * (30 + len), y, 4);
          }
          for (const u of [0.38, 0.85]) { const [x, y] = at(sc, P, u, 0.8), dir = P.m > 0 ? -1 : 1; for (let j = 0; j < 3; j++) line(E, x + dir * (50 + 10 * j), y + j * 22 - 22, x + dir * (90 + 30 * V.sp + 10 * j), y + j * 22 - 22, 3); }
        }
        if (V.drum) {   // ticks under each stamping hoof
          for (let j = 0; j < 2; j++) {
            const ph = (V.dt * DRUM + (j ? 0.5 : 0)) % 1, since = (ph - 0.5) / DRUM;   // the foot met the ground at ph 0.5
            if (since >= 0 && since < 0.16) {
              const [x, y] = at(sc, P, j ? 0.86 : 0.765, 0.96), k = since / 0.16;
              ticks(E, x, y - 4, 22 + 18 * k, 30 * (1 - 0.5 * k), 200, 340, 4, 5);
              cloud(E, x, y - 6, 34 + 34 * k, 0.45 * (1 - k));
            }
          }
        }
      },
    };
  })();

  // ============================================================================================== PYGMY ELEPHANT
  (function () {
    const LEGS = [
      [0.225, 0.337, 0.28, 0.66, 0.99, 0.75],   // fore near
      [0.35, 0.442, 0.395, 0.7, 0.94, 0.25],    // fore far
      [0.685, 0.766, 0.725, 0.7, 0.94, 0.5],    // hind far
      [0.775, 0.896, 0.835, 0.64, 0.99, 0],     // hind near
    ];
    const DUTY = 0.68, PASS = 4.5;
    const OUT = [['turn', 0.7], ['walk', 1.8], ['lift', 0.5], ['sniff', 1.5], ['scoop', 0.7], ['fling', 0.7],
      ['flap', 1.3], ['turn2', 0.7], ['home', 1.8]];
    const sink = q => landed(q, 0.75, 0.4) + landed(q, 0.25, 0.4);
    const far = sc => sc.hx + Math.min(400, 0.6 * sc.right);
    const rotP = (X, Y, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a), dx = X - cx, dy = Y - cy; return [cx + c * dx - s * dy, cy + s * dx + c * dy]; };
    /** The trunk in three joints (base, middle, tip), each turned by its angle; the jaw lifts with the base. */
    function trunk(o, u, v, r, a1, a2, a3) {
      const wU = S(0.215, 0.165, u); if (!(wU > 0) || v < 0.38) return;
      const X = u * r, w1 = wU * S(0.42, 0.62, v), w2 = wU * S(0.7, 0.8, v), w3 = wU * S(0.82, 0.9, v);
      const p0 = [0.12 * r, 0.42], j1 = [0.11 * r, 0.74], j2 = [0.1 * r, 0.86];
      let p = rotP(X, v, p0[0], p0[1], a1 * w1 * D);
      const J1 = rotP(j1[0], j1[1], p0[0], p0[1], a1 * D);
      p = rotP(p[0], p[1], J1[0], J1[1], a2 * w2 * D);
      let J2 = rotP(j2[0], j2[1], p0[0], p0[1], a1 * D); J2 = rotP(J2[0], J2[1], J1[0], J1[1], a2 * D);
      p = rotP(p[0], p[1], J2[0], J2[1], a3 * w3 * D);
      o[0] += (p[0] - X) / r; o[1] += p[1] - v;
    }
    /** Where the trunk tip is (drawing u, v) for the angles, to throw dust from. */
    function tipAt(V, r) {
      let T = [0.1 * r, 0.95];
      const p0 = [0.12 * r, 0.42], j1 = [0.11 * r, 0.74], j2 = [0.1 * r, 0.86];
      T = rotP(T[0], T[1], p0[0], p0[1], V.t1 * D);
      const J1 = rotP(j1[0], j1[1], p0[0], p0[1], V.t1 * D);
      T = rotP(T[0], T[1], J1[0], J1[1], V.t2 * D);
      let J2 = rotP(j2[0], j2[1], p0[0], p0[1], V.t1 * D); J2 = rotP(J2[0], J2[1], J1[0], J1[1], V.t2 * D);
      T = rotP(T[0], T[1], J2[0], J2[1], V.t3 * D);
      return [T[0] / r, T[1]];
    }

    M['bornean-pygmy-elephant'] = {
      facing: 'L',
      pass: { dur: PASS, path(t, P, sc) {
        const v = P.v, x0 = -sc.sw / 2 - 40, x1 = WW + sc.sw / 2 + 40;
        P.m = 1; P.x = lerp(x0, x1, t / PASS); v.b = 'walk';
        v.q = 2.05 * t / PASS; v.amp = 1;
        P.y = ground(sc) + 0.01 * sc.sh * sink(v.q);
        v.t1 = 6 * Math.sin(TAU * (v.q - 0.23)); v.t2 = 3 * Math.sin(TAU * (v.q - 0.35)); v.t3 = 4 * Math.sin(TAU * (v.q - 0.45));
        v.ear = hump(clamp((t - 1.0) / 1.6, 0, 1));
        v.dip = sink(v.q);
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, XF = far(sc), stride = 0.9 * sc.sw, k = b.k;
        v.b = b.name; v.amp = 0; v.q = 0; P.m = -1; P.x = sc.hx; P.y = sc.hy; v.t1 = 0; v.t2 = 0; v.t3 = 0; v.ear = 0;
        const walk = kk => S(0, 0.12, kk) * S(1, 0.88, kk), swing = q => [6 * Math.sin(TAU * (q - 0.23)), 3 * Math.sin(TAU * (q - 0.35)), 4 * Math.sin(TAU * (q - 0.45))];
        if (b.name === 'turn') { turnRound(P, k, -1); v.t1 = 10 * Math.sin(Math.PI * k); v.t2 = 6 * Math.sin(Math.PI * k - 0.5); }
        else if (b.name === 'walk' || b.name === 'home') {
          const d = (XF - sc.hx) * ease(k); P.m = b.name === 'walk' ? 1 : -1; P.x = b.name === 'walk' ? sc.hx + d : XF - d;
          v.q = d / stride; v.amp = walk(k); [v.t1, v.t2, v.t3] = swing(v.q).map(a => a * v.amp);
          P.y += 0.01 * sc.sh * sink(v.q) * v.amp;
        } else {
          P.m = 1; P.x = XF;
          if (b.name === 'lift') { const e = ease(k); v.t1 = 56 * e; v.t2 = 0; v.t3 = 40 * e; v.ear = 0.3 * e; v.head = 3 * e; }
          else if (b.name === 'sniff') {   // trunk up, the tip curling in an S and swaying, the ear fanning slowly
            const tt = b.t, c = ease(Math.min(1, k * 3)) * (1 - ease(clamp((k - 0.8) / 0.2, 0, 1))), osc = S(0, 0.25, k) * S(1, 0.8, k);
            v.t1 = 56 + 3 * Math.sin(TAU * 0.8 * tt) * osc; v.t2 = -6 * c + 7 * Math.sin(TAU * 1.2 * tt + 1) * osc; v.t3 = 40 + 30 * c + 14 * Math.sin(TAU * 1.2 * tt + 2.4) * osc;
            v.ear = 0.3 + 0.7 * (0.5 - 0.5 * Math.cos(TAU * tt / 1.5)); v.head = 3; v.sniff = 1;
          } else if (b.name === 'scoop') {   // down to the ground, the tip curling back under to gather dust
            const e = ease(k); v.t1 = lerp(56, -14, e); v.t2 = lerp(0, -40, e); v.t3 = lerp(40, -30, e); v.head = 3 * (1 - e) - 3 * e; v.ear = 0.3 * (1 - e);
          } else if (b.name === 'fling') {   // a whip up and over: the dust flies back over the head
            const e = 1 - Math.pow(1 - k, 2.2); v.t1 = lerp(-14, 56, e); v.t2 = lerp(-40, 24, e); v.t3 = lerp(-30, 10, e); v.head = -3 + 6 * e;
          } else if (b.name === 'flap') {
            const e = ease(k); v.t1 = 56 * (1 - e); v.t2 = 24 * (1 - e) + 4 * Math.sin(TAU * b.t); v.t3 = 10 * (1 - e); v.head = 3 * (1 - e);
            v.ear = 0.5 - 0.5 * Math.cos(TAU * b.t / 0.65);
          } else { turnRound(P, k, 1); v.t1 = 8 * Math.sin(Math.PI * k); v.t2 = 5 * Math.sin(Math.PI * k - 0.5); }
        }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, amp = V.amp || 0;
        legs(o, u, v, r, LEGS, V.q || 0, 0.05 * amp, 0.025 * amp, DUTY);
        // the ear: fanned out from its front edge it looks narrower and swings forward
        const ew = box(u, v, 0.235, 0.11, 0.43, 0.62, 0.03), ear = V.ear || 0;
        if (ew > 0) { scl(o, u, v, 0.245, 0.35, 1 - 0.34 * ear, 1, ew); rot(o, u, v, 0.245, 0.3, 10 * ear, ew, r); }
        // the head dips at each forefoot; the trunk swings as a pendulum and lifts, curls, scoops
        rot(o, u, v, 0.27, 0.3, (V.head || 0) - 1.5 * (V.dip || 0) * amp - 1.5 * sink(V.q || 0) * amp, S(0.29, 0.22, u), r);
        trunk(o, u, v, r, V.t1 || 0, V.t2 || 0, V.t3 || 0);
        // tail
        rot(o, u, v, 0.925, 0.4, 5 * Math.sin(TAU * ((V.q || 0) - 0.3)) * amp + 3 * Math.sin(TAU * 0.6 * t) * (1 - amp), S(0.895, 0.912, u) * S(0.38, 0.45, v), r);
        scl(o, u, v, 0.6, 0.7, 1, 1 + 0.006 * Math.sin(TAU * 0.4 * t), box(u, v, 0.3, 0.05, 0.92, 0.7, 0.06));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v, r = sc.a.w / sc.a.h, pass = mode === 'pass';
        const gy = pass ? ground(sc) + 0.48 * sc.sh : sc.hy + 0.48 * sc.sh;
        // heavy dust thumps up at each forefoot, smaller at the hind feet
        falls(t, 1.2, poseAt, [0.75, 0.25, 0.5, 0], (Q, te, age, j) => {
          const [fx] = at(sc, Q, [0.28, 0.4, 0.72, 0.84][j], 0.98), big = j < 2 ? 1.4 : 0.8, s = pass ? 1 : 0.55;
          dust(E, fx - 60 * s, gy, 90 * big * s, age, 1.2, -70 * s, 0.5);
          dust(E, fx + 50 * s, gy, 70 * big * s, age, 1.0, 60 * s, 0.4);
          if (j < 2 && age < 0.5) for (let i = 0; i < 4; i++) { const [x, y] = toss(fx + (i - 1.5) * 40 * s, gy - 4, (i - 1.5) * 160 * s, -300 * s - 100 * rnd(i, j), age, gy); disc(E, x, y, 4 + 3 * rnd(i, j + 2)); }
        });
        if (pass) return;
        const b = beat(t, OUT);
        if (V.sniff) {   // scent drawn in at the curled tip
          const [tu, tv] = tipAt(V, r), [x, y] = at(sc, P, tu, tv), dir = P.m > 0 ? 1 : -1;
          for (let j = 0; j < 3; j++) {
            const k = frac(t * 1.1 + j / 3), xx = x + dir * (130 - 110 * k), yy = y - 50 + j * 34 - 10 * k, pts = [];
            for (let s = 0; s <= 5; s++) pts.push(xx + dir * s * 16, yy + 7 * Math.sin(s * 1.7 + t * 9 + j));
            if (k < 0.85) poly(E, pts, 3);
          }
        }
        if ((V.b === 'scoop' && b.k > 0.6) || (V.b === 'fling' && b.k < 0.55)) {   // a trunkful of dust
          const [tu, tv] = tipAt(V, r), [x, y] = at(sc, P, tu, tv);
          cloud(E, x, y + 6, 34, 0.6);
        }
        if (V.b === 'scoop' && b.k > 0.55) { const [tu, tv] = tipAt(V, r), [x] = at(sc, P, tu, tv); dust(E, x, gy - 10, 80, (b.k - 0.55) * 0.7, 0.6, 0, 0.3); }
        const tf = beatStart(OUT, 'fling') + 0.4;   // the throw: a halftone cloud arcs up over the head and rains on the back
        if (t > tf && t < tf + 2.2) {
          const age = t - tf, k = clamp(age / 0.6, 0, 1), Q = poseAt(tf), [tu, tv] = tipAt(Q.v, r);
          const [x0, y0] = at(sc, Q, tu, tv), [x1, y1] = at(sc, Q, 0.62, 0.02);
          if (k < 1) {
            for (let i = 0; i < 5; i++) {
              const kk = clamp(k - i * 0.06, 0, 1), x = lerp(x0, x1, kk) + (i - 2) * 26, y = lerp(y0, y1, kk) - 200 * hump(kk);
              cloud(E, x, y, 50 + 50 * kk, 0.7 - 0.2 * kk);
            }
          }
          const fall = clamp((age - 0.45) / 1.6, 0, 1);
          if (fall > 0 && fall < 1) for (let i = 0; i < 16; i++) {   // the dust rains down over the back and sides
            const [bx, by] = at(sc, Q, 0.4 + 0.5 * rnd(i, 1), 0.05 + 0.05 * rnd(i, 2)), yy = by + (gy - by) * Math.min(1, fall * (0.8 + 0.6 * rnd(i, 3)));
            disc(E, bx + 10 * Math.sin(age * 4 + i), yy, 3 + 2 * rnd(i, 4));
            if (i < 6) cloud(E, bx, by - 20 + 60 * fall, 80, 0.45 * (1 - fall));
          }
        }
        if (V.b === 'flap') {   // each flap fans the heat off: wavy wisps rise from the back
          for (let n = 0; n < 2; n++) {
            const age = b.t - 0.33 - 0.65 * n; if (age < 0 || age > 0.75) continue;
            for (let i = 0; i < 3; i++) {
              const [x, y] = at(sc, P, 0.42 + 0.14 * i, 0.06 - 0.03 * (i % 2)), yy = y - 12 - 90 * age, pts = [];
              for (let j = 0; j <= 6; j++) pts.push(x + 9 * Math.sin(j * 1.3 + age * 10 + i), yy - j * 12);
              if (age < 0.65) poly(E, pts, 3);
            }
          }
        }
      },
    };
  })();

  // ======================================================================================================== GAUR
  (function () {
    const LEGS = [
      [0.285, 0.378, 0.33, 0.68, 0.96, 0.75],   // fore near
      [0.385, 0.47, 0.425, 0.72, 0.95, 0.25],   // fore far
      [0.738, 0.812, 0.775, 0.72, 0.94, 0.5],   // hind far
      [0.815, 0.895, 0.855, 0.66, 0.96, 0],     // hind near
    ];
    const DUTY = 0.66;
    const PASSB = [['walk', 1.4], ['alarm', 0.9], ['gallop', 2.0]];
    const OUT = [['turn', 0.6], ['walk', 1.6], ['halt', 0.4], ['lower', 1.2], ['hold', 1.2], ['stamp', 1.2], ['snort', 0.6],
      ['raise', 0.6], ['turn2', 0.6], ['home', 1.5]];
    const V0 = 620;   // the pass's walking speed, px/s
    const far = sc => sc.hx + Math.min(380, 0.6 * sc.right);
    const fore = q => landed(q, 0.75) + landed(q, 0.25);
    /** Stamp cycle c (0..1, 0.6 s): the foreleg rises, hangs, slams down at 0.45. */
    const stampLift = c => (c < 0.33 ? ease(c / 0.33) : 1 - S(0.36, 0.45, c));

    M['gaur'] = {
      facing: 'L',
      pass: { dur: total(PASSB), path(t, P, sc) {
        const b = beat(t, PASSB), v = P.v, x0 = -sc.sw / 2 - 40, xw = x0 + V0 * 1.4, xa = xw + V0 * 0.3 / 2, x1 = WW + sc.sw / 2 + 60;
        v.b = b.name; P.m = 1; v.amp = 0; v.q = 0;
        if (b.name === 'walk') { P.x = x0 + V0 * b.t; v.q = (P.x - x0) / (0.5 * sc.sw); v.amp = 1; P.y = ground(sc) + 0.006 * sc.sh * fore(v.q); }
        else if (b.name === 'alarm') {   // halts; the head jerks up; two snorts; it gathers itself
          const k3 = Math.min(1, b.t / 0.3);
          P.x = xw + (xa - xw) * (1 - (1 - k3) * (1 - k3)); v.q = (P.x - x0) / (0.5 * sc.sw); v.amp = 1 - k3;
          v.head = 6 * S(0.08, 0.16, b.t) + 2 * (hump(clamp((b.t - 0.32) / 0.14, 0, 1)) + hump(clamp((b.t - 0.56) / 0.14, 0, 1)));
          const crouch = S(0.66, 0.9, b.t); v.head += -3 * crouch; P.angle = -2 * crouch; v.crouch = crouch;
          P.y = ground(sc) + 0.012 * sc.sh * crouch;
        } else {   // the rocking-horse gallop
          const k = b.k, e = 0.3 * k + 0.7 * k * k;
          P.x = xa + (x1 - xa) * e; v.g = b.t / 0.4; v.gal = S(0, 0.15, k);
          const s = Math.sin(TAU * v.g);
          P.angle = -3 * s * v.gal - 2 * (1 - v.gal); P.y = ground(sc) + 0.012 * sc.sh * (1 - v.gal) - 0.02 * sc.sh * Math.max(0, Math.sin(TAU * v.g + 0.8)) * v.gal;
          v.head = 3 + 2 * s; v.tailUp = v.gal;
        }
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, XF = far(sc), stride = 0.5 * sc.sw, k = b.k;
        v.b = b.name; v.amp = 0; v.q = 0; P.m = -1; P.x = sc.hx; P.y = sc.hy; v.low = 0;
        const walk = kk => S(0, 0.14, kk) * S(1, 0.86, kk);
        if (b.name === 'turn') turnRound(P, k, -1);
        else if (b.name === 'walk' || b.name === 'home') {
          const d = (XF - sc.hx) * ease(k), out = b.name === 'walk';
          P.m = out ? 1 : -1; P.x = out ? sc.hx + d : XF - d; v.q = d / stride; v.amp = walk(k); P.y += 0.006 * sc.sh * fore(v.q) * v.amp;
          v.head = -1.5 * fore(v.q) * v.amp;
        } else {
          P.m = 1; P.x = XF;
          if (b.name === 'halt') { P.x = XF + 10 * Math.sin(Math.PI * k) * (1 - k); v.head = -2 * hump(k); }
          else if (b.name === 'lower') v.low = ease(k);
          else if (b.name === 'hold') { v.low = 1; v.tremble = 1; }
          else if (b.name === 'stamp') {
            v.low = 1; const c = frac(b.t / 0.6); v.stamp = stampLift(c);
            P.y += 4 * hump(clamp((c - 0.45) / 0.1, 0, 1));
          } else if (b.name === 'snort') { v.low = 1; v.snort = b.k; v.head = -2.5 * (hump(clamp(k / 0.35, 0, 1)) + hump(clamp((k - 0.45) / 0.35, 0, 1))); }
          else if (b.name === 'raise') v.low = 1 - ease(k);
          else turnRound(P, k, 1);
        }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, amp = V.amp || 0, low = V.low || 0;
        if (V.g !== undefined) {   // gallop: forelegs as a pair reach as the front rises, then the hind pair
          const s = Math.sin(TAU * V.g), c = Math.cos(TAU * V.g), gal = V.gal;
          legs(o, u, v, r, LEGS, 0, 0, 0, DUTY, i => (i < 2 ? (24 * s + (i ? -6 : 6)) * gal : (-22 * s + (i === 2 ? 5 : -5)) * gal + 10 * (1 - gal)));
          for (const [i, lf] of [[0, Math.max(0, c)], [1, Math.max(0, c)], [2, Math.max(0, -c)], [3, Math.max(0, -c)]]) {
            const L = LEGS[i]; shift(o, 0, -0.04 * lf * gal, box(u, v, L[0], L[3], L[1], 1.1, 0.012) * S(L[3], L[4], v));
          }
        } else {
          legs(o, u, v, r, LEGS, V.q || 0, 0.03 * amp, 0.03 * amp, DUTY, i => (i === 0 ? 14 * (V.stamp || 0) : 0) + (i > 1 ? 6 * (V.crouch || 0) : 0));
          if (V.stamp) shift(o, 0, -0.05 * V.stamp, box(u, v, 0.285, 0.7, 0.378, 1.05, 0.012) * S(0.7, 0.95, v));
        }
        // the head: lowered slowly, horns low, under the towering ridge
        const hd = (V.head || 0) - 14 * low + (V.tremble ? 0.6 * Math.sin(TAU * 3 * t) : 0);
        rot(o, u, v, 0.27, 0.36, hd, S(0.33, 0.25, u) * S(0.8, 0.7, v), r);
        if (low) {
          shift(o, 0, -0.025 * low, box(u, v, 0.3, 0.0, 0.55, 0.3, 0.06));   // the ridge rises
          scl(o, u, v, 0.8, 0.96, 1, 1 - 0.04 * low, S(0.55, 0.7, u));         // the rump sinks
        }
        // tail: swishes; streams out at the gallop
        const tw = S(0.905, 0.93, u) * S(0.32, 0.42, v);
        rot(o, u, v, 0.94, 0.33, -40 * (V.tailUp || 0) + 8 * Math.sin(TAU * 0.9 * t + 0.5) * (1 - 0.5 * (V.tailUp || 0)), tw, r);
        if (V.tailUp) rot(o, u, v, 0.95, 0.56, 22 * Math.sin(TAU * 2.5 * t) * V.tailUp, tw * S(0.52, 0.66, v), r);   // the tuft whips in the wind
        scl(o, u, v, 0.6, 0.7, 1, 1 + 0.006 * Math.sin(TAU * 0.45 * t), box(u, v, 0.3, 0.1, 0.9, 0.72, 0.06));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v, pass = mode === 'pass';
        const gy = pass ? ground(sc) + 0.46 * sc.sh : sc.hy + 0.46 * sc.sh, nose = (Q, a) => at(sc, Q, 0.065, 0.58 + (a || 0));
        if (pass) {
          const b = beat(t, PASSB);
          if (b.name === 'walk') falls(t, 0.8, poseAt, [0.75, 0.25], (Q, te, age, j) => { const [fx] = at(sc, Q, j ? 0.43 : 0.33, 0.96); dust(E, fx, gy, 50, age, 0.8, -40); });
          const ta = beatStart(PASSB, 'alarm');
          for (const dl of [0.34, 0.58]) {   // two snorts
            const age = t - ta - dl; if (age < 0 || age > 0.7) continue;
            const [nx, ny] = nose(poseAt(ta + dl));
            dust(E, nx + 70 + 320 * age, ny + 30 + 90 * age, 80, age, 0.7, 60, -0.1);
            if (age < 0.25) for (let i = 0; i < 3; i++) line(E, nx + 30 + 20 * i, ny + 4 + 16 * i, nx + 90 + 40 * i + 260 * age, ny + 14 + 26 * i + 60 * age, 5);
            if (age < 0.45) for (let i = 0; i < 2; i++) arc(E, nx - 40, ny - 60, 50 + 34 * i + 120 * age, -80, 60, 4);   // the whistle
          }
          const tg = beatStart(PASSB, 'gallop');
          if (t > tg) {   // thick dust behind, twigs flying
            emit(t, 0.2, 1.3, (i, te, age) => {
              const Q = poseAt(te), [fx] = at(sc, Q, 0.85, 0.95);
              dust(E, fx - 40, gy, 150, age, 1.3, -200, 0.6);
              dust(E, fx - 160, gy - 40, 110, age, 1.1, -120, 0.8);
              if (i % 2 === 0 && age < 0.9) for (let j = 0; j < 3; j++) {
                const [x, y] = toss(fx, gy - 30, -300 - 300 * rnd(j, i), -500 - 300 * rnd(j, i + 5), age, gy + 10), a = age * (500 + 400 * rnd(j, i + 7));
                line(E, x - 30 * Math.cos(a * D), y - 30 * Math.sin(a * D), x + 30 * Math.cos(a * D), y + 30 * Math.sin(a * D), 6); line(E, x, y, x + 14 * Math.cos((a + 50) * D), y + 14 * Math.sin((a + 50) * D), 4);
              }
            }, tg, tg + 2.0);
            const [hx, hy] = at(sc, P, 0.95, 0.5);
            for (let i = 0; i < 4; i++) line(E, hx - 60 - 40 * i, hy - 120 + i * 90, hx - 260 - 60 * i - 200 * rnd(i, 3), hy - 120 + i * 90, 4);
          }
          return;
        }
        if (V.b === 'walk' || V.b === 'home') falls(t, 0.8, poseAt, [0.75, 0.25], (Q, te, age, j) => { const [fx] = at(sc, Q, j ? 0.43 : 0.33, 0.96); dust(E, fx, gy, 30, age, 0.8, 0); });
        const ts = beatStart(OUT, 'stamp');
        for (const n of [0, 1]) {   // each stamp: a ring of dust on the ground and a thud
          const te = ts + 0.6 * n + 0.27, age = t - te; if (age < 0 || age > 0.8) continue;
          const [fx] = at(sc, poseAt(te), 0.33, 0.96);
          dustRing(E, fx, gy + 4, age, 0.8, 150);
          if (age < 0.12) ticks(E, fx, gy - 10, 60, 30, 200, 340, 5, 5);
        }
        const tn = beatStart(OUT, 'snort');
        for (const dl of [0.08, 0.35]) {   // the snort: low to the ground, it blows the dust up
          const age = t - tn - dl; if (age < 0 || age > 0.8) continue;
          const Q = poseAt(tn + dl), [nx, ny] = nose(Q), dir = Q.m > 0 ? 1 : -1;
          dust(E, nx + dir * (40 + 200 * age), ny + 30 + 40 * age, 80, age, 0.8, dir * 90, -0.1);
          dust(E, nx + dir * 110, gy, 130, age, 0.9, dir * 80, 0.5);
          if (age < 0.18) for (let i = 0; i < 3; i++) line(E, nx + dir * (20 + 16 * i), ny + 10 + 12 * i, nx + dir * (60 + 24 * i + 140 * age), ny + 20 + 18 * i, 4);
        }
      },
    };
  })();

  // ===================================================================================== SUNDA CLOUDED LEOPARD
  (function () {
    const LEGS = [
      [0.215, 0.297, 0.26, 0.56, 0.88, 0.75],   // fore near
      [0.297, 0.36, 0.33, 0.6, 0.87, 0.25],     // fore far
      [0.44, 0.497, 0.47, 0.6, 0.87, 0.5],      // hind far
      [0.497, 0.58, 0.54, 0.55, 0.88, 0],       // hind near
    ];
    const BOUND = LEGS.map((L, i) => L.slice(0, 5).concat([i < 2 ? 0 : 0.5]));
    const PASSB = [['descend', 3.0], ['leap', 0.6], ['run', 0.9]];
    const OUT = [['grow', 0.4], ['turn', 0.45], ['walk', 2.0], ['poise', 0.4], ['flip', 0.55], ['hang', 1.6], ['up', 0.55],
      ['turn2', 0.45], ['home', 1.9], ['settle', 0.3]];
    const A = 32, CA = Math.cos(A * D), SA = Math.sin(A * D), L0 = [0, 150];   // the pass's trunk: its top surface
    const S0 = -900, S1 = 1300, LAND = 1500;
    const trunkPt = s => [L0[0] + s * CA, L0[1] + s * SA];
    /** The outing's branch: its top under the feet at x (rises to the right), and the sag where the cat stands. */
    const RISE = 200;
    const branchY = (sc, x) => sc.hy + 0.38 * sc.sh - RISE * S(sc.hx - 60, sc.hx + 640, x);
    const slope = (sc, x) => Math.atan2(branchY(sc, x + 4) - branchY(sc, x - 4), 8) / D;
    const far = sc => sc.hx + Math.min(600, 0.88 * sc.right);

    M['sunda-clouded-leopard'] = {
      facing: 'L', size: [0.75, 0.6],
      pass: { dur: total(PASSB), path(t, P, sc) {
        const b = beat(t, PASSB), v = P.v;
        v.b = b.name; P.m = 1; v.amp = 0; v.q = 0;
        if (b.name === 'descend') {   // head first down the trunk, careful step by careful step
          const p = surge(b.k, 3, 0.65), s = lerp(S0, S1, p), [x, y] = trunkPt(s);
          v.q = 3 * p; v.amp = S(1, 0.86, b.k); v.desc = 1;
          pinM(sc, P, 0.4, 0.88, x, y, A);
        } else if (b.name === 'leap') {   // drops off the end, levelling out in the air
          const k = b.k, [x0, y0] = trunkPt(S1), gy = ground(sc) + 0.38 * sc.sh;
          const x = lerp(x0, LAND, k), y = lerp(y0, gy, k * k) - 120 * hump(k);
          v.leap = hump(k); v.leapK = k; v.q = 3; v.land = S(0.85, 1, k);
          pinM(sc, P, 0.4, 0.88, x, y, A * (1 - S(0, 0.75, k)) - 8 * hump(k));
        } else {   // lands, and bounds away
          const k = b.k, gy = ground(sc) + 0.38 * sc.sh, e = 0.42 * k + 0.58 * k * k;
          v.q = b.t * 3.2; v.amp = S(0.05, 0.3, k); v.run = 1; v.land = 1 - S(0, 0.3, k);
          pinM(sc, P, 0.4, 0.88, LAND + (WW + sc.sw / 2 + 200 - LAND) * e, gy - 0.02 * sc.sh * Math.abs(Math.sin(TAU * v.q / 2)) * v.amp, 0);
          P.sy = 1 - 0.06 * hump(clamp(b.t / 0.25, 0, 1)); P.sx = 1 + 0.03 * hump(clamp(b.t / 0.25, 0, 1));
        }
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, XF = far(sc), stride = 0.36 * sc.sw, k = b.k, d = total(OUT);
        v.b = b.name; v.amp = 0; v.q = 0; P.m = -1; v.bal = 0.3 * Math.sin(TAU * 0.7 * t);
        const there = S(0, 0.4, t) * (1 - S(d - 0.6, d - 0.1, t));   // the branch, and the sag the cat puts in it
        let cx = sc.hx, ang = 0, tilt = 0, sag = 10 * there;
        const walk = kk => S(0, 0.1, kk) * S(1, 0.9, kk);
        if (b.name === 'turn') { turnRound(P, k, -1); }
        else if (b.name === 'walk' || b.name === 'home') {
          const dd = (XF - sc.hx) * ease(k), out = b.name === 'walk';
          P.m = out ? 1 : -1; cx = out ? sc.hx + dd : XF - dd; v.q = dd / stride; v.amp = walk(k);
          tilt = 2.2 * Math.sin(TAU * v.q) * v.amp; v.bal = Math.sin(TAU * v.q) * v.amp + v.bal * (1 - v.amp);   // tightrope: the body leans, the tail answers
        }
        else if (b.name === 'turn2') { cx = XF; turnRound(P, k, 1); }
        else if (b.name !== 'grow' && b.name !== 'settle') { P.m = 1; cx = XF; }
        const fx = cx + 100 * (P.m > 0 ? 1 : -1) * (P.sx || 1);
        if (['poise', 'flip', 'hang', 'up'].includes(b.name)) {
          const hxF = XF - 35, hy = branchY(sc, hxF) + 10, a0 = slope(sc, XF + 100);
          if (b.name === 'poise') { v.crouch = hump(k); v.bal = lerp(v.bal, -1, hump(k)); pinM(sc, P, 0.4, 0.88, XF + 100, branchY(sc, XF + 100) + sag + 6 * hump(k), a0 - 4 * hump(k)); }
          else {
            const e = b.name === 'flip' ? ease(k) : b.name === 'up' ? 1 - ease(k) : 1;
            const swing = b.name === 'hang' ? 7 * Math.sin(TAU * 0.75 * b.t) * Math.exp(-b.t * 0.9) : 0;
            v.ankle = e * (165 - a0); v.hang = e; sag = 10 + 22 * e + (b.name === 'hang' ? 8 * Math.sin(TAU * 1.4 * b.t) * Math.exp(-b.t * 2) : 0);
            pinM(sc, P, 0.535, 0.88, hxF, hy + sag - 10, lerp(a0, 165, e) + swing);
            if (b.name === 'hang') v.swat = hump(clamp((b.t - 0.62) / 0.3, 0, 1));
          }
        } else pinM(sc, P, 0.4, 0.88, fx, branchY(sc, fx) + sag, slope(sc, fx) * there + tilt);
        v.sag = sag; v.there = there;
        if (b.name === 'grow' || (b.name === 'settle' && false)) { P.x = sc.hx; }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, amp = V.amp || 0;
        if (V.run) legs(o, u, v, r, BOUND, V.q, 0.07 * amp, 0.04 * amp, 0.4);
        else if (V.leap) legs(o, u, v, r, LEGS, 0, 0, 0, 0.5, i => (i < 2 ? 26 : -24) * V.leap);
        else legs(o, u, v, r, LEGS, V.q || 0, (V.desc ? 0.05 : 0.035) * amp, 0.035 * amp, 0.62,
          i => (V.desc && i > 1 ? -6 * amp : 0) + (V.crouch ? (i < 2 ? 8 : -10) * V.crouch : 0) + (i < 2 ? (i ? 34 : 22) * (V.hang || 0) : 0) + (i === 0 ? 40 * (V.swat || 0) : 0));
        if (V.land) scl(o, u, v, 0.4, 0.88, 1, 1 - 0.05 * V.land, box(u, v, 0.15, 0.4, 0.62, 1.05, 0.05));
        // ankles turn back, so the hind feet keep their grip as the body swings under the branch
        if (V.ankle) rot(o, u, v, 0.52, 0.8, V.ankle, box(u, v, 0.44, 0.78, 0.58, 1.05, 0.015), r);
        // head: dips with each careful forefoot
        const dip = V.desc ? landed(V.q, 0.75, 0.4) + landed(V.q, 0.25, 0.4) : 0;
        rot(o, u, v, 0.25, 0.33, -4 * dip * amp + (V.hang ? 25 * V.hang : 0) - 4 * (V.leap || 0), S(0.27, 0.2, u) * S(0.58, 0.5, v), r);
        // the long tail, a balancing pole: raised on the trunk, swinging against the head and the lean
        const tw = S(0.585, 0.65, u), raise = V.desc ? -14 : V.run ? -10 : V.leapK !== undefined ? lerp(-14, -10, V.leapK) : V.hang ? -30 * V.hang : 0;
        const swing = (V.desc ? 8 * (dip - 0.5) * amp : 0) - 14 * (V.bal || 0) + (V.leap ? 22 * V.leap : 0);
        rot(o, u, v, 0.6, 0.4, raise + swing + 2 * Math.sin(TAU * 0.5 * t), tw, r);
        wave(o, u, t, 0.018, 1.1, 0.7, tw * S(0.65, 0.95, u), 1);
        scl(o, u, v, 0.4, 0.6, 1, 1 + 0.008 * Math.sin(TAU * 0.6 * t), box(u, v, 0.2, 0.15, 0.6, 0.55, 0.05));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          // the trunk is drawn down from the top left ahead of the cat, and taken away behind it at the end
          const n = [-SA, CA], w = 92, dur = total(PASSB), sA = lerp(-1700, 2000, S(dur - 0.6, dur, t)), sB = lerp(-320, 2000, S(0, 0.7, t));
          if (sB - sA > 10) {
            const top = [], bot = [], st = (sB - sA) / Math.ceil((sB - sA) / 100);
            for (let s = sA; s <= sB + 0.1; s += st) { const [x, y] = trunkPt(s), wob = 5 * Math.sin(s * 0.01); top.push(x - n[0] * wob, y - n[1] * wob); const ww = w + 8 * Math.sin(s * 0.007 + 1); bot.push(x + n[0] * ww, y + n[1] * ww); }
            E.back = true;
            const ring = top.concat(bot.reduceRight((a, _, i, arr) => (i % 2 ? a.concat([arr[i - 1], arr[i]]) : a), []));
            poly(E, ring, 0, true, 3, 0.3);
            poly(E, top, 5); poly(E, bot, 5);
            for (let i = 0; i < 22; i++) {   // bark
              const s = -1500 + i * 160 + 60 * rnd(i, 1), [x, y] = trunkPt(s), dd = 20 + 50 * rnd(i, 2), l = 40 + 40 * rnd(i, 3);
              if (s > sA && s + l < sB) line(E, x + n[0] * dd, y + n[1] * dd, x + n[0] * dd + CA * l, y + n[1] * dd + SA * l, 4);
            }
            for (const [s, len] of [[150, 170], [760, 140]]) if (s > sA && s < sB) {   // twigs with leaves on the trunk's top side
              const [x, y] = trunkPt(s), ex = x + 40, ey = y - len;
              line(E, x, y, ex, ey, 6);
              for (let j = 0; j < 3; j++) leaf(E, lerp(x, ex, 0.5 + 0.25 * j) + 26 * (j % 2 ? 1 : -1), lerp(y, ey, 0.5 + 0.25 * j), (j % 2 ? -30 : 210) + 6 * Math.sin(TAU * 0.5 * t + j), 22, j === 1);
            }
          }
          E.back = false;
          falls(t, 1.3, poseAt, [0.75, 0.25, 0.5, 0], (Q, te, age, j) => {   // bark flakes knocked off under each foot
            if (!Q.v.desc) return;
            const [fx, fy] = at(sc, Q, [0.26, 0.33, 0.47, 0.54][j], 0.88);
            for (let i = 0; i < 2; i++) {
              const z = Math.round(te * 30) * 4 + j * 2 + i, x = fx + n[0] * 80 + 30 * age * (rnd(z, 1) - 0.3) + 18 * Math.sin(age * 7 + z);
              const y = fy + n[1] * 80 + 120 * age + 500 * age * age;
              if (y < HH + 20) blob(E, x, y, 9, 4, age * 400 + 80 * rnd(z, 2));
            }
          });
          for (const [s, seed] of [[150, 1], [760, 2]]) {   // leaves shaken loose as the body brushes past
            const [x, y] = trunkPt(s), te = (() => { for (let tt = 0; tt < 3; tt += 0.05) { const [fx] = at(sc, poseAt(tt), 0.4, 0.88); if (fx > x + 60) return tt; } return 99; })();
            if (t > te) fallingLeaf(E, x + 40, y - 120, t - te, seed, 24, 230);
          }
          if (V.b === 'leap' || (V.b === 'run' && V.land > 0.3)) { const [x] = at(sc, P, 0.4, 0.88), gy = ground(sc) + 0.38 * sc.sh; if (V.land > 0.3) { dust(E, x - 100, gy, 70, 1 - V.land, 1, -60); dust(E, x + 80, gy, 60, 1 - V.land, 1, 60); } }
          return;
        }
        // the outing's branch: drawn in from the left, it sags under the cat, and is taken away at the end
        const d = Ink.duration('sunda-clouded-leopard', 'outing'), g = S(0, 0.4, t), gone = S(d - 0.6, d - 0.05, t);
        const [fx] = at(sc, P, 0.47, 0.88), x0 = 70, x1 = WW - 50, cut0 = lerp(x0, sc.hx - 100, gone), cut1 = lerp(x0, x1, g) - (x1 - sc.hx + 100) * gone;
        if (cut1 - cut0 > 4) {
          const top = [], bot = [];
          for (let x = cut0; x <= cut1 + 0.1; x += Math.max(4, (cut1 - cut0) / 40)) {
            const y = branchY(sc, x) + (V.sag || 0) * Math.exp(-Math.pow((x - fx) / 280, 2)) * (V.there || 0);
            const th = lerp(34, 18, (x - x0) / (x1 - x0));
            top.push(x, y); bot.push(x, y + th);
          }
          E.back = true;
          poly(E, top.concat(bot.reduceRight((a, _, i, arr) => (i % 2 ? a.concat([arr[i - 1], arr[i]]) : a), [])), 0, true, 3, 0.3);
          poly(E, top, 5); poly(E, bot, 4);
          for (const [xx, up] of [[260, 1], [1480, -1], [1760, 1]]) if (xx > cut0 && xx < cut1) {   // leafy twigs
            const y = branchY(sc, xx) + (up > 0 ? 0 : 26), ty = y - up * 90, sw = 4 * Math.sin(TAU * 0.4 * t + xx);
            line(E, xx, y, xx + 40 + sw, ty, 5);
            leaf(E, xx + 40 + sw + 20, ty - up * 6, -up * 25 + sw, 24, true); leaf(E, xx + 20 + sw, ty + up * 30, up * 200, 20, false);
          }
          E.back = false;
        }
        const th = beatStart(OUT, 'hang');   // the leaf falls; the paw swats it away spinning
        if (t > th - 1.2 && t < th + 2.6) {
          const ts = th + 0.77, Q = poseAt(ts), [px, py] = at(sc, Q, 0.25, 0.92);
          if (t < ts) { const a = ts - t; leaf(E, px + 60 * Math.sin(a * 3.5), py - 320 * a, 30 * Math.sin(a * 3.5 + 1), 26, true); }
          else { const a = t - ts; leaf(E, px - 520 * a, py - 200 * a + 300 * a * a, a * 900, 26, true); if (a < 0.2) ticks(E, px, py, 30, 30, 120, 240, 4, 4); }
        }
        if (V.b === 'hang' || V.b === 'flip') { const [x, y] = at(sc, P, 0.52, 0.88); if (V.b === 'flip') for (let i = 0; i < 2; i++) arc(E, x, y, 260 + 40 * i, 20, 110, 4 - i); void y; }
      },
    };
  })();
})();
