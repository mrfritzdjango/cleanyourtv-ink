'use strict';
/* Blue water: green sea turtle, leatherback, whale shark, reef manta, blue-spotted stingray, dugong, Irrawaddy dolphin
 * and humpback whale. Each show follows study.py (SEA) and research.md ("Reef and open sea"). */

(function () {
  // ---------------------------------------------------------------- shared helpers

  /** 0..1..0 over k, starting and ending at rest (so an offset shaped by it never kicks). */
  const hump = k => { const s = Math.sin(Math.PI * clamp(k, 0, 1)); return s * s; };
  /** 0..1 at a steady pace, easing in over the first e and out over the last e. */
  const ramp = (k, e = 0.12) => {
    const F = x => (x <= 0 ? 0 : x >= e ? x - e / 2 : e * (Math.pow(x / e, 3) - Math.pow(x / e, 4) / 2));
    return clamp((F(k) - F(k - 1 + e)) / (1 - e), 0, 1);
  };
  /** Smooth path through keys [t, [values...], hold]: velocity is continuous; a hold (and both ends) is at rest. */
  function spline(t, keys) {
    const n = keys.length;
    if (t <= keys[0][0]) return keys[0][1].slice();
    if (t >= keys[n - 1][0]) return keys[n - 1][1].slice();
    let i = 0; while (t > keys[i + 1][0]) i++;
    const tan = j => {
      const [, pj, hj] = keys[j];
      if (hj || j === 0 || j === n - 1) return pj.map(() => 0);
      const [ta, pa] = keys[j - 1], [tb, pb] = keys[j + 1];
      return pj.map((_, c) => (pb[c] - pa[c]) / (tb - ta));
    };
    const [t0, p0] = keys[i], [t1, p1] = keys[i + 1], d = t1 - t0, k = (t - t0) / d, m0 = tan(i), m1 = tan(i + 1), k2 = k * k, k3 = k2 * k;
    const a = 2 * k3 - 3 * k2 + 1, b = k3 - 2 * k2 + k, c = -2 * k3 + 3 * k2, e = k3 - k2;
    return p0.map((_, j) => a * p0[j] + b * d * m0[j] + c * p1[j] + e * d * m1[j]);
  }

  /** Progress 0..1 over [0, T] of a swimmer whose speed is base plus a kick after each stroke start in `starts`.
   * ends: 0 keeps full speed at both ends (a pass), 1 eases in and out (an outing leg). */
  function swimProgress(t, T, starts, base = 0.5, kick = 1, ends = 1, tk = 0.28) {
    const v = x => {
      let s = base;
      for (const s0 of starts) { const d = x - s0; if (d > 0) s += kick * (d / tk) * Math.exp(1 - d / tk); }
      return ends ? s * S(0, 0.35, x) * S(T, T - 0.45, x) : s;
    };
    const n = 64, h = T / n;
    let F = 0, Ft = 0;
    for (let i = 0; i < n; i++) {
      const a = i * h, b = a + h, f = 0.5 * (v(a) + v(b)) * h;
      F += f;
      if (b <= t) Ft += f; else if (a < t) Ft += 0.5 * (v(a) + v(t)) * (t - a);
    }
    return clamp(Ft / F, 0, 1);
  }
  /** A stroking limb's angle: `up` at the end of each recovery, `back` at the end of the power stroke, then it relaxes
   * toward 0 in the glide. starts: power-stroke start times. */
  function strokeAngle(t, starts, up, back, pw = 0.4, rec = 0.5, relax = 1.1) {
    const base = tt => {
      let sl = null; for (const s of starts) if (s <= tt) sl = s;
      if (sl === null) return 0;
      if (tt < sl + pw) return lerp(up, back, ease((tt - sl) / pw));
      return back * (1 - S(0, relax, tt - sl - pw));
    };
    for (const s of starts) if (t > s - rec && t < s) return lerp(base(s - rec), up, ease((t - (s - rec)) / rec));
    return base(t);
  }
  /** 0..1..0 while a power stroke is on. */
  const powerOf = (t, starts, pw = 0.4) => { for (const s of starts) if (t >= s && t < s + pw) return hump((t - s) / pw); return 0; };
  /** A side-view turn: k 0..1 squeezes the drawing to its edge and opens it facing the other way. */
  function turn(P, k, m0) { const c = Math.cos(Math.PI * ease(k)); P.m = c >= 0 ? m0 : -m0; P.sx *= Math.max(0.07, Math.abs(c)); P.scale *= 1 + 0.05 * hump(k); }
  /** Light rays slanting down from the top edge, tapering into dashes; len shrinks them with depth. */
  function rays(E, t, n, len, w, seed = 0, x0 = -150, x1 = WW + 50, slant = 0.32) {
    if (len < 20) return;
    for (let i = 0; i < n; i++) {
      const x = lerp(x0, x1, (i + 0.6 * rnd(i, seed)) / n) + 30 * Math.sin(t * 0.5 + i * 1.7);
      const L = len * (0.55 + 0.6 * rnd(i, seed + 1)) * (0.88 + 0.12 * Math.sin(t * 0.8 + i));
      const seg = (a, b, ww) => line(E, x + L * a * slant, -10 + L * a, x + L * b * slant, -10 + L * b, ww);
      seg(0, 0.62, w); seg(0.7, 0.8, Math.max(1, w - 1)); seg(0.87, 0.92, 1.5);
      const L2 = 0.55; line(E, x + 34, -10, x + 34 + L * L2 * slant, -10 + L * L2, Math.max(1, w - 1.5));
    }
  }
  /** Ink specks of plankton or marine snow drifting in the water. */
  function specks(E, t, n, seed, vx = 0, vy = -20, r = 3.5, box = [0, 0, WW, HH]) {
    const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0;
    for (let i = 0; i < n; i++) {
      const x = x0 + ((rnd(i, seed) * w + vx * t + 18 * Math.sin(t * 0.7 + i)) % w + w) % w;
      const y = y0 + ((rnd(i, seed + 1) * h + vy * t) % h + h) % h;
      disc(E, x, y, r * (0.6 + 0.8 * rnd(i, seed + 2)));
    }
  }
  /** A moon jellyfish: a pulsing bell with trailing arms; squash 0..1 crushes it (being eaten). */
  function jelly(E, x, y, s, t, squash = 0) {
    const p = 0.5 + 0.5 * Math.sin(TAU * 0.9 * t), k = 1 - squash;
    const rx = s * (1 - 0.14 * p) * k, ry = s * 0.62 * (1 + 0.12 * p) * k;
    if (rx < 2) return;
    const pts = [];
    for (let i = 0; i <= 18; i++) { const a = Math.PI + Math.PI * i / 18; pts.push(x + rx * Math.cos(a), y + ry * Math.sin(a)); }
    for (let i = 0; i <= 6; i++) { const xx = x + rx - 2 * rx * i / 6; pts.push(xx, y + 5 * k * Math.sin(i * 2.4 + t * 5)); }
    poly(E, pts, 3, true, 2);
    for (let j = 0; j < 4; j++) {
      const ax = x + rx * (-0.6 + 0.4 * j), tp = [];
      for (let i = 0; i <= 6; i++) { const s2 = i / 6; tp.push(ax + 10 * k * Math.sin(t * 3 + j + s2 * 4) * s2, y + 6 + s * 1.25 * k * s2 * (1 - 0.12 * p)); }
      poly(E, tp, j % 3 ? 2 : 3);
    }
    oval(E, x - rx * 0.25, y - ry * 0.35, rx * 0.14, ry * 0.2, 0, 2); oval(E, x + rx * 0.25, y - ry * 0.35, rx * 0.14, ry * 0.2, 0, 2);
  }
  /** Water peeling off a flipper tip: two curling lines trailing behind (x, y), side -1 up, 1 down. */
  function peel(E, x, y, side, age, life, len = 170) {
    const k = clamp(age / life, 0, 1); if (k >= 1) return;
    for (let j = 0; j < 2; j++) {
      const L = len * (0.6 + 0.45 * j) * (0.35 + 0.8 * ease(k * 1.5)), off = 26 * j + 34 * k, pts = [];
      for (let i = 0; i <= 7; i++) { const s = i / 7; pts.push(x - 24 - L * s - 70 * k, y + side * (off + 0.3 * L * s * s + 12 * Math.sin(Math.PI * s))); }
      poly(E, pts, Math.max(1.2, 4.5 * (1 - k)));
    }
  }
  /** A surface line across the screen at y, with a few dashes of chop under it. */
  function surfaceLine(E, t, y, x0 = -20, x1 = WW + 20, amp = 7) {
    wavy(E, x0, x1, y, amp, 210, -t * 2.2, 4);
    for (let i = 0; i < 6; i++) { const xx = x0 + (x1 - x0) * rnd(i, 21) + 30 * Math.sin(t * 0.8 + i); line(E, xx, y + 26 + 14 * (i % 3), xx + 46, y + 26 + 14 * (i % 3), 2.5); }
  }
  /** Rising wobbling bubbles from a list of [x, y, born] (world positions at birth). */
  /** Half the width a pass needs to be wholly off screen (the drawing's box, a little turned or stretched). */
  const edge = (sc, scale = 1, extra = 0.05) => scale * (0.5 * sc.sw * (1 + extra) + 0.07 * sc.sh) + 30;
  /** A pass at progress q that starts and ends just off screen. */
  function crossTight(P, sc, q, scale = 1, extra = 0.05) { const e = edge(sc, scale, extra); P.x = -e + (WW + 2 * e) * q; P.m = 1; }
  /** Seagrass ribbons streaming in the current, seen from above: clumps around (x, y), g 0..1 how much shows. */
  function seagrassTop(E, t, x, y, wide, high, n, g, seed = 31) {
    for (let i = 0; i < n; i++) {
      const tx = x - wide / 2 + wide * rnd(i, seed), ty = y - high / 2 + high * rnd(i, seed + 1);
      for (let j = 0; j < 5; j++) {
        const L = g * (60 + 70 * rnd(i * 5 + j, seed + 2)), a0 = -0.5 + 0.25 * j + 0.1 * Math.sin(t * 0.9 + i), pts = [];
        for (let k = 0; k <= 6; k++) { const s = k / 6, a = a0 + 0.35 * s * Math.sin(t * 1.7 + i + j + s * 3); pts.push(tx + Math.cos(a) * L * s + 4 * j, ty + Math.sin(a) * L * s + 9 * Math.sin(t * 2 + s * 5 + j) * s); }
        poly(E, pts, j % 2 ? 2.5 : 3.5);
      }
    }
  }
  /** Caustic light lines rippling down over the screen: long wavy lines broken into dashes, drifting down slowly. */
  function caustics(E, t, n, seed) {
    for (let i = 0; i < n; i++) {
      const y0 = ((rnd(i, seed) * 0.8 + i / n) * HH + 55 * t) % (HH + 100) - 50, wl = 240 + 80 * rnd(i, seed + 1), off = 300 * rnd(i, seed + 2);
      for (let x0 = -80 - off; x0 < WW + 40; x0 += 330) {
        const pts = [];
        for (let k = 0; k <= 10; k++) { const x = x0 + 24 * k + 30 * Math.sin(t * 0.7 + i); pts.push(x, y0 + 16 * Math.sin(TAU * x / wl + t * 1.8 + i) + 0.12 * (x - WW / 2) * Math.sin(i)); }
        poly(E, pts, 2.5);
      }
    }
  }
  function riseBubble(E, x, y, age, r, wob = 10, speed = 160) { circle(E, x + wob * Math.sin(age * 5 + x), y - speed * age - 20 * age * age, r, 3); }

  // ================================================================ green sea turtle
  {
    /* Top view, head right. Front flippers beat together like wings: a quick power stroke (both swept back about their
     * shoulders, the body surges), a long glide with them held back, a recovery forward. Rear flippers are rudders. */
    const PASS_STROKES = [0.15, 2.05];
    const OUT = [['ready', 0.5], ['swim', 2.0], ['settle', 0.6], ['graze', 1.9], ['rise', 1.6], ['breathe', 0.9], ['home', 1.5]];
    const OUT_STROKES = [0.5, 1.6, 5.05, 5.85];
    const RX = 300, RY = 140;   // the outing's loop: home is its top, the seagrass bed its bottom

    const loopAt = (sc, phi) => [sc.hx + RX * Math.sin(phi), sc.hy + RY * (1 - Math.cos(phi))];
    const headingAt = phi => Math.atan2(RY * Math.sin(phi), RX * Math.cos(phi)) * 180 / Math.PI;

    M['green-sea-turtle'] = {
      facing: 'R', size: [1.25, 1.05],
      pass: { dur: 4, path(t, P, sc) {
        const v = P.v, q = swimProgress(t, 4, PASS_STROKES, 0.8, 1.0, 0);
        crossTight(P, sc, q, 1, 0.08);
        const pw = powerOf(t, PASS_STROKES);
        P.y = HH / 2 + 50 - 100 * q + 8 * Math.sin(TAU * 0.5 * t);
        P.angle = -3 + 1.5 * Math.sin(TAU * 0.5 * (t - 0.15)) - 1.5 * pw;
        P.sx = 1 + 0.03 * pw; P.sy = 1 - 0.02 * pw;
        v.fa = strokeAngle(t, [-1.85, ...PASS_STROKES], 30, -18); v.fs = 0.12 * pw;
        v.rear = 8 * Math.sin(TAU * 0.9 * t); v.head = 3 * Math.sin(TAU * 0.5 * t + 1); v.push = -0.4 * pw; v.b = 'swim';
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, T0 = beatStart(OUT, 'swim'), T1 = beatStart(OUT, 'graze'), T2 = beatStart(OUT, 'rise');
        v.b = b.name; v.fa = strokeAngle(t, OUT_STROKES, 30, -18, 0.38, 0.45); v.fs = 0.12 * powerOf(t, OUT_STROKES, 0.38);
        v.rear = 7 * Math.sin(TAU * 0.8 * t); v.head = 3 * Math.sin(TAU * 0.45 * t); v.push = 0; v.dip = 0;
        let phi = 0, s = 1;
        if (b.name === 'ready') { s = 1; P.x = sc.hx - 10 * hump(b.k); }
        else if (b.name === 'swim' || b.name === 'settle') {
          const k = swimProgress(t - T0, T1 - T0, [0, 1.1], 0.35, 1.2, 1);
          phi = Math.PI * k; s = lerp(1, 0.72, ease(k));
          if (b.name === 'settle') { const sq = hump(b.k); P.sx = 1 - 0.03 * sq; P.sy = 1 - 0.03 * sq; s -= 0.02 * ease(b.k); }
        } else if (b.name === 'graze') {
          phi = Math.PI; s = 0.70;
          v.dip = hump(frac(b.k * 3)) * S(0, 0.05, b.k) * S(1, 0.95, b.k); v.head = 0.6 * v.head;
          s += 0.006 * Math.sin(TAU * 1.5 * b.t);
        } else {
          const k = swimProgress(t - T2, total(OUT) - T2, [0.05, 0.85], 0.3, 1.0, 1);
          phi = Math.PI + Math.PI * k;
          if (b.name === 'rise') s = lerp(0.70, 1.1, ease(b.k));
          else if (b.name === 'breathe') { s = 1.1 + 0.03 * ease(b.k); v.push = hump(b.k); }
          else s = lerp(1.13, 1, ease(b.k));
        }
        if (b.name !== 'ready') { const [x, y] = loopAt(sc, phi); P.x = x; P.y = y; P.angle = headingAt(phi); }
        if (phi > Math.PI - 1e-9 && phi < Math.PI + 0.12 && b.name === 'rise') v.cut = true;   // 180 and -180 are the same heading
        P.scale = s * (1 + 0.006 * Math.sin(TAU * 0.4 * t));
        v.phi = phi;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        // front flippers: weight above the line from the tip to the shoulder, so the shell rim stays put
        const reach = (uu, vv) => S(-0.03, 0.05, 0.04 + (uu - 0.41) * 1.15 - vv) * S(0.33, 0.4, uu) * S(0.76, 0.69, uu);
        const wT = reach(u, v), wB = reach(u, 1 - v);
        rot(o, u, v, 0.61, 0.27, V.fa, wT, r); rot(o, u, v, 0.61, 0.73, -V.fa, wB, r);
        if (V.fs) { scl(o, u, v, 0.61, 0.27, 1 - 0.3 * V.fs, 1 - V.fs, wT); scl(o, u, v, 0.61, 0.73, 1 - 0.3 * V.fs, 1 - V.fs, wB); }
        // rear flippers steer, a beat behind each other
        rot(o, u, v, 0.27, 0.37, V.rear, box(u, v, 0.1, 0.18, 0.3, 0.35, 0.03), r);
        rot(o, u, v, 0.27, 0.63, -V.rear * 0.8, box(u, v, 0.1, 0.65, 0.3, 0.82, 0.03), r);
        // head: sways, pushes out to breathe, dips (foreshortens) to bite
        const wh = box(u, v, 0.72, 0.36, 1.0, 0.68, 0.025);
        rot(o, u, v, 0.71, 0.5, V.head, wh, r);
        if (V.push) shift(o, 0.03 * V.push, 0, wh);
        if (V.dip) scl(o, u, v, 0.71, 0.5, 1 - 0.16 * V.dip, 1 - 0.05 * V.dip, wh);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          for (const s of PASS_STROKES) {
            const te = s + 0.32, age = t - te; if (age < 0 || age > 1.3) continue;
            const Q = poseAt(te), a = at(sc, Q, 0.46, 0.13), b = at(sc, Q, 0.46, 0.87);
            peel(E, a[0], a[1], -1, age, 1.3, 260); peel(E, b[0], b[1], 1, age, 1.3, 260);
          }
          specks(E, t, 14, 3, -20, -12, 3);
          return;
        }
        const T1 = beatStart(OUT, 'settle'), T2 = beatStart(OUT, 'graze'), T3 = beatStart(OUT, 'breathe');
        const bx = sc.hx, by = sc.hy + 2 * RY;
        // seagrass tufts on the bed, seen from above, coming into view as it goes down and fading as it rises
        const g = S(1.2, T1, t) * S(T3 + 0.8, T3 - 0.6, t);
        if (g > 0.02) {
          E.back = true; seagrassTop(E, t, bx, by - 20, 1100, 380, 10, g); E.back = false;
        }
        // the sand it settles into
        if (t > T1 && t < T1 + 1.6) {
          const age = t - T1, Q = poseAt(T1 + 0.3);
          for (let i = 0; i < 7; i++) {
            const a = TAU * i / 7 + 0.4, [px, py] = at(sc, Q, 0.5 + 0.32 * Math.cos(a), 0.5 + 0.36 * Math.sin(a));
            puff(E, px + Math.cos(a) * 40 * age, py + Math.sin(a) * 30 * age, 70, age, 1.6, 0, 0.1);
          }
        }
        // grazing: three bites, a snipped blade drifting off each
        if (V.b === 'graze') {
          emit(t - T2, 1.9 / 3, 1.0, (i, te, age) => {
            const [hx, hy] = at(sc, P, 0.88, 0.5 + 0.06 * (i - 1));
            if (age > 0.2) { const k = (age - 0.2); line(E, hx - 10 - 40 * k, hy - 20 - 60 * k, hx + 18 - 40 * k, hy - 34 - 60 * k, 3); }
            puff(E, hx + 10, hy, 34, age, 1.0, 0, 0.2);
          }, 0.25);
        }
        // the breath: rings spreading round the head at the surface, two droplets
        if (t > T3 - 0.1) {
          const Q = poseAt(T3 + 0.25), [hx, hy] = at(sc, Q, 0.86, 0.5);
          for (let i = 0; i < 3; i++) {
            const age = t - (T3 + 0.2 + 0.28 * i), life = 1.5;
            if (age > 0 && age < life) { const k = age / life; circle(E, hx, hy, 60 + 260 * ease(k), 4.5 * (1 - k) + 1); }
          }
          const age = t - (T3 + 0.3);
          if (age > 0 && age < 0.9) for (let j = 0; j < 2; j++) {
            const dx = (j ? 1 : -1) * (40 + 90 * age), dy = -70 * age + 220 * age * age;
            blob(E, hx + 30 + dx, hy - 50 + dy, 7 * (1 - age), 10 * (1 - age), 0);
          }
        }
      },
    };
  }

  // ================================================================ leatherback turtle
  {
    /* Side view, head right, the long front flipper below. Dives steeply with a couple of strokes, then glides with the
     * flipper swept back. Flipper angle: positive swings the tip back and up along the belly, negative forward. */
    const PASS_STROKES = [0.3, 1.4];
    const OUT = [['tip', 0.6], ['down', 1.8], ['level', 0.8], ['rise', 2.0], ['jelly', 1.4], ['turn', 0.6], ['home', 1.3], ['face', 0.5]];
    const OUT_STROKES = [0.05, 3.3, 4.3];
    const LB = 'leatherback-turtle';

    /** Where the outing's jellyfish is, and how eaten it is. */
    function jellyAt(t, sc, P) {
      const T = beatStart(OUT, 'jelly'), k = clamp((t - T) / 1.4, 0, 1);
      const [mx, my] = at(sc, P, 0.985, 0.4);
      const d = ease(clamp((t - T + 1.6) / 2.1, 0, 1)), drift = [lerp(WW + 120, mx + 95, d), lerp(my - 130, my + 10, d)];
      const eat = S(0.4, 0.55, k);
      return { x: lerp(drift[0], mx + 10, eat), y: lerp(drift[1], my + 6, eat) + 12 * Math.sin(TAU * 0.9 * t), squash: eat, gone: k > 0.56, on: t > T - 1.6 };
    }

    M[LB] = {
      facing: 'R', size: [0.85, 0.7],
      pass: { dur: 4.5, path(t, P, sc) {
        const v = P.v, k = t / 4.5;
        const q = 0.62 * swimProgress(t, 4.5, PASS_STROKES, 0.7, 1.1, 0) + 0.38 * k * k;
        crossTight(P, sc, q, 1, 0.12);
        const pw = powerOf(t, PASS_STROKES, 0.55);
        P.y = HH / 2 + 90 + (q - 0.5) * 1350;
        P.angle = 31 - 4 * pw + 2 * S(2.2, 4.5, t);
        P.sx = 1 + 0.03 * pw; P.sy = 1 - 0.02 * pw;
        v.fa = strokeAngle(t, [-2, ...PASS_STROKES], -22, 14, 0.55, 0.5, 0.6);
        if (t > 2.0) v.fa = lerp(v.fa, 16, S(2.0, 2.8, t));
        v.rear = 5 * Math.sin(TAU * 0.7 * t); v.head = 2 * Math.sin(TAU * 0.4 * t); v.b = 'dive';
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, H = [sc.hx, sc.hy];
        const D = [sc.hx + 260, sc.hy + 230], L = [sc.hx + 440, sc.hy + 265], R = [sc.hx + 600, sc.hy + 40], R2 = [sc.hx + 630, sc.hy + 25];
        v.b = b.name; v.fa = strokeAngle(t, OUT_STROKES, -22, 14, 0.55, 0.5, 0.9); v.rear = 5 * Math.sin(TAU * 0.6 * t);
        v.head = 1.5 * Math.sin(TAU * 0.35 * t); v.stretch = 0; v.jaw = 0;
        // a V: tip over, glide steeply down, level out, stroke slowly up; then turn, glide home, turn to face out again
        let [x, y, s, a] = spline(t, [[0, [H[0], H[1], 1, 0], 1], [0.6, [H[0] + 25, H[1] + 6, 0.99, 18]], [2.4, [D[0], D[1], 0.74, 24]],
          [3.2, [L[0], L[1], 0.74, -4]], [5.2, [R[0], R[1], 0.74, -12]], [6.6, [R2[0], R2[1], 0.74, -2], 1], [7.2, [R2[0] - 30, R2[1], 0.74, 0], 1],
          [8.5, [H[0], H[1], 1, 0], 1], [9, [H[0], H[1], 1, 0]]]);
        for (const s0 of OUT_STROKES.slice(1)) { x += 16 * hump((t - s0) / 1.0); a -= 3 * powerOf(t, [s0], 0.55); }
        if (b.name === 'jelly') {
          x += 40 * S(0.3, 0.5, b.k) * S(1, 0.6, b.k);
          v.stretch = hump(clamp((b.k - 0.3) / 0.3, 0, 1)); v.jaw = b.k > 0.56 ? hump(frac((b.k - 0.56) / 0.22)) * S(0.98, 0.9, b.k) : 0;
        } else if (b.name === 'turn') { turn(P, b.k, 1); v.fa = lerp(v.fa, 6, b.k); }
        else if (b.name === 'home') { y += 18 * hump(b.k); a = -4 * hump(b.k); P.m = -1; v.fa = 6 + 8 * hump(b.k); }
        else if (b.name === 'face') { turn(P, b.k, -1); v.fa = 6 * (1 - b.k); }
        P.x = x; P.y = y; P.angle = a; P.scale *= s;
        P.y += 4 * Math.sin(TAU * 0.4 * t) * S(0, 0.3, t) * S(9, 8.7, t);
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        // the long front flipper: everything below the line of its leading edge, nothing of the shell or head
        const wf = S(-0.03, 0.04, v - (0.43 + (0.66 - u) * 1.07)) * S(0.16, 0.22, u) * S(0.79, 0.74, u);
        rot(o, u, v, 0.69, 0.46, V.fa, wf, r);
        // flex: the outer half of the flipper trails the stroke
        rot(o, u, v, 0.5, 0.66, 0.35 * V.fa * Math.cos(TAU * 0.6 * t), wf * S(0.52, 0.36, u), r);
        rot(o, u, v, 0.17, 0.43, V.rear, box(u, v, 0.06, 0.44, 0.2, 0.57, 0.02), r);
        const wh = box(u, v, 0.8, 0.22, 1.0, 0.5, 0.025);
        rot(o, u, v, 0.79, 0.37, V.head, wh, r);
        if (V.stretch) shift(o, 0.06 * V.stretch, -0.012 * V.stretch, box(u, v, 0.76, 0.2, 1.0, 0.52, 0.04));
        if (V.jaw) scl(o, u, v, 0.92, 0.38, 1, 1 - 0.18 * V.jaw, box(u, v, 0.82, 0.38, 1.0, 0.5, 0.025));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          const depth = t / 4.5;
          E.back = true;
          rays(E, t, 8, 900 * (1 - 0.8 * depth), 4.5 - 2.8 * depth, 5);
          E.back = false;
          specks(E, t, 26, 7, -40, -160, 3.2);
          return;
        }
        specks(E, t, 16, 8, -10, -35, 3);
        if (V.b === 'rise' || V.b === 'jelly' || V.b === 'level') {
          const J = jellyAt(t, sc, P);
          if (J.on && !J.gone) jelly(E, J.x, J.y, 88, t, J.squash);
          if (J.gone && V.b === 'jelly') {   // a last wisp of tentacle, and a little cloud of bubbles from the gulp
            const k = clamp((t - beatStart(OUT, 'jelly')) / 1.4, 0, 1), [mx, my] = at(sc, P, 0.985, 0.42);
            if (k < 0.7) line(E, mx + 4, my + 4, mx + 4 + 30 * (0.7 - k) * 5, my + 30 * (0.7 - k) * 4, 3);
            bubbles(E, t, mx - 20, my - 30, 0.25, 0.9, 2, 160, 4, beatStart(OUT, 'jelly') + 0.8, beatStart(OUT, 'jelly') + 1.3);
          }
        }
      },
    };
  }

  // ================================================================ whale shark
  {
    /* Side view, head right. Negatively buoyant: glides down with the tail still, climbs on slow side-to-side beats
     * (seen side-on, the tail fin narrows and widens as it swings toward and away from us). Mouth open to feed. */
    const OUT = [['rise', 1.8], ['tip', 1.0], ['gulp', 3.2], ['tipback', 0.9], ['glide', 2.1]];
    const WS = 'whale-shark';
    const hangAt = (sc, k) => [lerp(sc.hx + 170, sc.hx - 70, ease(k)), sc.hy + 115];

    M[WS] = {
      facing: 'R',
      pass: { dur: 5, path(t, P, sc) {
        const v = P.v, c = Math.cos(TAU * t / 2.5);
        crossTight(P, sc, t / 5 + 0.012 * Math.sin(TAU * t / 2.5), 1, 0.08);
        P.y = HH / 2 + 10 + 46 * Math.sin(TAU * t / 2.5);
        P.angle = 3.5 * c;
        v.tail = S(0.35, -0.55, c); v.ph = TAU * 0.7 * t; v.jaw = 0.55 + 0.1 * Math.sin(TAU * 0.4 * t); v.b = c > 0 ? 'glide' : 'climb';
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, H = [sc.hx, sc.hy], A = [sc.hx + 120, sc.hy - 40];
        v.b = b.name; v.ph = TAU * 0.65 * t; v.tail = 0; v.jaw = 0.15; v.gulp = 0;
        let x = H[0], y = H[1], s = 1, a = 0;
        if (b.name === 'rise') { const k = ease(b.k); x = lerp(H[0], A[0], k); y = lerp(H[1], A[1], k); s = lerp(1, 0.82, k); a = -36 * ease(b.k * 1.1); v.tail = S(0, 0.3, b.k); }
        else if (b.name === 'tip') { const k = ease(b.k), [hx, hy] = hangAt(sc, 0); x = lerp(A[0], hx, k); y = lerp(A[1], hy, k); s = lerp(0.82, 0.72, k); a = lerp(-36, -72, k); v.tail = 1 - 0.6 * b.k; v.jaw = lerp(0.15, 0.4, b.k); }
        else if (b.name === 'gulp') {
          const [hx, hy] = hangAt(sc, b.k); x = hx; y = hy + 6 * (1 - Math.cos(TAU * b.t / 1.6)); s = 0.72; a = -72 + 1.5 * (1 - Math.cos(TAU * b.t / 1.6));
          const g = frac(b.t / 1.6); v.gulp = S(0.05, 0.4, g) * S(0.75, 0.55, g); v.jaw = 0.4 + 0.6 * v.gulp; v.tail = 0.4;
        } else if (b.name === 'tipback') { const k = ease(b.k), [hx, hy] = hangAt(sc, 1); x = lerp(hx, H[0] - 70, k); y = lerp(hy, H[1] - 10, k); s = 0.72; a = lerp(-72, 10, k); v.jaw = lerp(0.4, 0.15, k); }
        else { const k = ease(b.k); x = lerp(H[0] - 70, H[0], k); y = lerp(H[1] - 10, H[1], k) + 20 * hump(b.k); s = lerp(0.72, 1, k); a = 10 * (1 - k); }
        P.x = x; P.y = y; P.angle = a; P.scale = s;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, sw = Math.sin(V.ph);
        // the tail: swings toward and away from us (narrows), a little up-down give, the rear body follows
        const wt = S(0.21, 0.15, u), f = 0.5 * (1 - Math.cos(2 * V.ph));
        if (V.tail) {
          scl(o, u, v, 0.165, 0.51, 1 - 0.5 * f * V.tail, 1 - 0.06 * f * V.tail, wt);
          rot(o, u, v, 0.165, 0.51, 5 * sw * V.tail, wt, r);
          wave(o, 1 - u, t, 0.012 * V.tail, 0.8, -0.65, S(0.5, 0.2, u) * S(0.12, 0.2, u), 1, V.ph * 0 - 1);
          shift(o, 0.012 * sw * V.tail, 0, box(u, v, 0.2, 0.15, 0.32, 0.42, 0.03));   // the second dorsal sways with it
        }
        // pectoral fin trims, mouth opens (the lower jaw drops), gulps swell the head
        rot(o, u, v, 0.69, 0.68, 4 * Math.sin(TAU * 0.3 * t) + (V.gulp || 0) * 8, box(u, v, 0.58, 0.69, 0.76, 0.95, 0.03), r);
        const wj = box(u, v, 0.86, 0.555, 1.0, 0.7, 0.02);
        rot(o, u, v, 0.875, 0.555, 9 * (V.jaw || 0), wj, r);
        if (V.gulp) scl(o, u, v, 0.86, 0.52, 1 + 0.05 * V.gulp, 1 + 0.12 * V.gulp, box(u, v, 0.74, 0.32, 1.0, 0.7, 0.05));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v, [mx, my] = at(sc, P, 0.975, 0.57);
        if (mode === 'pass') {
          // plankton hanging in the water: what is ahead of the mouth is drawn in, and vanishes at the lip
          for (let i = 0; i < 110; i++) {
            const bx = rnd(i, 41) * (WW + 600) - 300 + 25 * Math.sin(t * 0.8 + i), by = 60 + rnd(i, 42) * (HH - 120) + 12 * Math.sin(t * 1.1 + i * 2);
            let x = bx, y = by; const dx = bx - mx, dy = by - my;
            if (dx < 0 && Math.abs(dy) < 150) continue;
            if (dx > 0 && dx < 380 && Math.abs(dy) < 230) { const f = Math.pow(1 - dx / 380, 1.6); y = by - dy * 0.95 * f; x = bx - 40 * f; if (dx < 30 && Math.abs(y - my) < 30) continue; }
            E.back = dx < 0; disc(E, x, y, 2.5 + 3 * rnd(i, 43)); E.back = false;
          }
          return;
        }
        if (V.b === 'tip' || V.b === 'gulp' || V.b === 'tipback') {
          // a plankton cloud funnels in, thinning with each gulp
          const T = beatStart(OUT, 'gulp'), k = clamp((t - T) / 3.2, 0, 1), on = S(T - 0.9, T - 0.2, t) * S(T + 3.6, T + 3.2, t);
          const [cx, cy] = [mx + 40, my - 90];
          if (on > 0.02) {
            E.back = true;
            for (let j = 0; j < 5; j++) {
              const a = TAU * j / 5 + 0.4 * Math.sin(t * 0.5 + j), d = (60 + 25 * j % 3) * (1 - 0.4 * k);
              cloud(E, cx + Math.cos(a) * d * 1.3, cy - 30 + Math.sin(a) * d * 0.7, (70 + 18 * (j % 3)) * (1 - 0.45 * k) * on, 0.4 * (1 - 0.55 * k));
            }
            E.back = false;
            for (let i = 0; i < 26; i++) {
              const ph = frac(rnd(i, 44) + t * 0.55), rr = (230 - 200 * ph) * on, a = TAU * rnd(i, 45) + ph * 3;
              if (rnd(i, 46) < k * 0.9) continue;
              disc(E, mx + Math.cos(a) * rr * 0.8 + 10, my - 30 + Math.sin(a) * rr * 0.6 - rr * 0.4, 2.5 + 2.5 * rnd(i, 47));
            }
          }
        }
        if (V.b === 'rise') { const [gx, gy] = at(sc, P, 0.85, 0.3); bubbles(E, t, gx, gy, 0.6, 1.0, 2, 180, 3); }
      },
    };
  }

  // ================================================================ reef manta ray
  {
    /* Top view, head at the top. A wing beat seen from above is a foreshortening: both wings draw in toward the body
     * (to about 80% of the span), the tips curling after them, then spread again; about 3 s a beat. Head fins rolled
     * while travelling, unrolled to feed. Somersaults in plankton: seen from above, a backward loop makes the body
     * shorten to a sliver, turn over and lengthen again, nearer to us at the top of the loop. */
    const OUT = [['glide', 2.0], ['unfurl', 0.6], ['roll', 4.5], ['furl', 0.6], ['home', 1.3]];
    const MR = 'reef-manta-ray';
    const spot = sc => [sc.hx + 400, sc.hy + 70];

    M[MR] = {
      facing: 'U', size: [0.55, 0.78],
      pass: { dur: 4.5, path(t, P, sc) {
        const v = P.v, k = t / 4.5, e = 0.5 * sc.sh * 1.05 + 0.5 * sc.sw * 0.18 + 30;
        P.x = -e + (WW + 2 * e) * (k + 0.015 * Math.sin(TAU * t / 3)); P.m = 1;
        P.y = HH / 2 + 80 * Math.sin(TAU * (k * 0.9 - 0.1));
        v.bank = Math.cos(TAU * (k * 0.9 - 0.1));
        P.angle = 90 - 6 * v.bank;
        v.flap = 0.5 * (1 - Math.cos(TAU * (t + 0.4) / 3)); v.lag = 0.5 * (1 - Math.cos(TAU * (t + 0.1) / 3));
        v.hide = 1; v.b = 'cruise';
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, C = spot(sc);
        v.b = b.name; v.hide = S(0, 0.6, t) * S(9, 8.4, t); v.horns = 0; v.bank = 0;
        v.flap = 0.5 * (1 - Math.cos(TAU * t / 3)) * S(0, 0.4, t) * S(9, 8.4, t);
        v.lag = 0.5 * (1 - Math.cos(TAU * (t - 0.3) / 3)) * S(0.3, 0.7, t) * S(9, 8.4, t);
        let x = sc.hx, y = sc.hy, s = 1, a = 0;
        if (b.name === 'glide') { const k = ease(b.k); x = lerp(sc.hx, C[0], k); y = lerp(sc.hy, C[1], k); s = lerp(1, 0.72, k); a = 58 * hump(b.k) * (1 - 0.25 * b.k); v.bank = -hump(b.k); }
        else if (b.name === 'unfurl') { x = C[0]; y = C[1] - 8 * hump(b.k); s = 0.72; v.horns = ease(b.k); }
        else if (b.name === 'roll') {
          const th = 6 * Math.PI * ramp(b.k, 0.12);
          x = C[0] + 25 * Math.sin(th / 3); y = C[1] - 120 * Math.sin(th); s = 0.72 * (1 + 0.11 * (1 - Math.cos(th)));
          P.sy = Math.cos(th); v.horns = 1; v.th = th;
          v.flap = 0.5 * (1 - Math.cos(TAU * b.t / 1.5 + 0.5)); v.lag = 0.5 * (1 - Math.cos(TAU * (b.t - 0.2) / 1.5 + 0.5));
          const fade = S(0, 0.08, b.k) * S(1, 0.92, b.k), ref = 0.5 * (1 - Math.cos(TAU * t / 3));
          v.flap = lerp(ref, v.flap, fade); v.lag = lerp(0.5 * (1 - Math.cos(TAU * (t - 0.3) / 3)), v.lag, fade);
        } else if (b.name === 'furl') { x = C[0]; y = C[1] + 6 * hump(b.k); s = 0.72; v.horns = 1 - ease(b.k); }
        else { const k = ease(b.k); x = lerp(C[0], sc.hx, k); y = lerp(C[1], sc.hy, k); s = lerp(0.72, 1, k); a = -50 * hump(b.k) * (1 - 0.3 * (1 - b.k)); v.bank = hump(b.k); }
        P.x = x; P.y = y; P.angle = a; P.scale = s;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, fl = V.flap || 0, lg = V.lag || 0, bank = V.bank || 0;
        // the drawn bubbles fold onto the black wing (out of sight) while it swims; the wing's own bends then carry them
        if (V.hide) {
          const w = box(u, v, 0.86, 0.04, 1.0, 0.36, 0.02) * V.hide;
          if (w > 0) { const du = (0.86 - u) * w, dv = (0.45 - v) * w; o[0] += du; o[1] += dv; u += du; v += dv; }
        }
        // wings fold toward the body, the tips curling after them; a bank folds one side a little more
        const band = S(0.15, 0.24, v) * S(0.8, 0.7, v);
        const wl = S(0.43, 0.06, u) * band, wr = S(0.57, 0.94, u) * band;
        scl(o, u, v, 0.43, 0.42, 1 - (0.2 + 0.05 * bank) * fl, 1, wl);
        scl(o, u, v, 0.57, 0.42, 1 - (0.2 - 0.05 * bank) * fl, 1, wr);
        rot(o, u, v, 0.2, 0.44, -16 * lg, S(0.24, 0.03, u) * band, r);
        rot(o, u, v, 0.8, 0.44, 16 * lg, S(0.76, 0.97, u) * band, r);
        shift(o, 0, -0.025 * (lg - 0.5), (S(0.3, 0.05, u) + S(0.7, 0.95, u)) * band);
        // head fins unroll and splay to feed, fluttering
        const h = V.horns || 0;
        if (h) {
          const wh = (uu) => box(uu, v, 0.37, 0.04, 0.475, 0.25, 0.02);
          const fl2 = 3 * Math.sin(TAU * 1.3 * t);
          rot(o, u, v, 0.445, 0.23, -(16 + fl2) * h, wh(u), r); scl(o, u, v, 0.445, 0.23, 1, 1 + 0.15 * h, wh(u));
          rot(o, u, v, 0.555, 0.23, (16 + fl2) * h, wh(1 - u), r); scl(o, u, v, 0.555, 0.23, 1, 1 + 0.15 * h, wh(1 - u));
        }
        // the whip tail trails and sways
        rot(o, u, v, 0.5, 0.79, 7 * Math.sin(TAU * 0.5 * t - 1), S(0.8, 0.86, v) * box(u, v, 0.44, 0.78, 0.56, 1, 0.02), r);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          // caustic light on the sand below: two families of wavy lines drifting slowly
          caustics(E, t, 4, 61);
          specks(E, t, 18, 51, -30, -10, 3);
          return;
        }
        const C = spot(sc), on = S(0.8, 2.0, t) * S(8.4, 7.4, t);
        if (on > 0.02) {
          E.back = true;
          for (let j = 0; j < 9; j++) {
            const a = TAU * j / 9 + 0.3 * Math.sin(t * 0.4 + j), d = 150 + 90 * rnd(j, 57);
            cloud(E, C[0] + Math.cos(a) * d * 1.2, C[1] - 40 + Math.sin(a) * d, (45 + 30 * rnd(j, 58)) * on, 0.22 * on);
          }
          E.back = false;
          const [mx, my] = at(sc, P, 0.5, 0.18), feed = V.b === 'roll' ? 1 : 0;
          for (let i = 0; i < 80; i++) {
            if (rnd(i, 59) > on) continue;
            const a = TAU * rnd(i, 52) + t * (0.3 + 0.5 * rnd(i, 53)), rr = 120 + 260 * rnd(i, 54);
            let x = C[0] + Math.cos(a) * rr, y = C[1] - 40 + Math.sin(a) * rr * 0.75;
            if (feed) { const ph = frac(t * 0.7 + rnd(i, 55)); if (ph > 0.6) { const f = (ph - 0.6) / 0.4; x = lerp(x, mx, f); y = lerp(y, my, f); if (f > 0.9) continue; } }
            disc(E, x, y, 2.5 + 2.5 * rnd(i, 56));
          }
        }
      },
    };
  }

  // ================================================================ blue-spotted stingray
  {
    /* Top view, head at the top, the tail down. Swims by waves running along both edges of the disc, head to tail.
     * Feeds on sand flats by fluttering its front edge to blow pits; hides under ledges with the tail out. */
    const OUT = [['glide1', 1.1], ['dig1', 1.4], ['glide2', 0.9], ['dig2', 1.4], ['ledge', 2.2], ['back', 2.0]];
    const SR = 'blue-spotted-stingray';
    const spots = sc => ({ A: [sc.hx + 230, sc.hy + 80, 22], B: [sc.hx + 420, sc.hy + 10, 52], L: [1440, 560, 90] });
    // a rock overhang seen from above, running off the right edge; its edge is walked round from the top
    const LEDGE = [1960, 150, 1800, 165, 1660, 215, 1540, 250, 1470, 320, 1440, 400, 1418, 470, 1426, 545, 1408, 625, 1430, 700, 1462, 770,
      1540, 830, 1650, 880, 1800, 905, 1960, 915];
    const CRACKS = [[1520, 330, 1580, 360, 1640, 350], [1600, 520, 1680, 560, 1700, 640], [1500, 700, 1570, 720], [1720, 300, 1780, 400], [1760, 740, 1850, 760]];
    /** Wave phase (cycles) run up in the backing-out beat: the edge waves reverse, tail to head, then run forward again. */
    function waveBack(tb, d) {
      let ph = 0; const n = 40, h = tb / n;
      for (let i = 0; i < n; i++) { const k = (i + 0.5) * h / d; ph += h * lerp(lerp(0.8, -0.9, S(0, 0.08, k)), 0.8, S(0.2, 0.45, k)); }
      return ph;
    }
    /** The pit a dig leaves: under the front of the disc as it was at the dig. */
    function pitOf(sc, poseAt, T) { const Q = poseAt(T + 0.6); return at(sc, Q, 0.5, 0.2); }

    M[SR] = {
      facing: 'U', size: [0.42, 1.2],
      pass: { dur: 4.5, path(t, P, sc) {
        const v = P.v, e = 0.5 * sc.sh * 1.06 + 0.5 * sc.sw * 0.08 + 30;
        P.x = -e + (WW + 2 * e) * (t / 4.5); P.m = 1;
        P.y = HH - 0.45 * sc.sw - 30 + 10 * Math.sin(TAU * 0.5 * t);
        P.angle = 90 + 2.5 * Math.sin(TAU * 0.35 * t);
        v.wave = 1; v.wph = 1.1 * t; v.b = 'skim';
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, { A, B, L } = spots(sc), H = [sc.hx, sc.hy, 0];
        v.b = b.name; v.wave = 0.35; v.wph = 0.8 * t; v.flut = 0; v.tailOut = 0;
        const go = (p, q, k, arc = 0) => { const e = ease(k); P.x = lerp(p[0], q[0], e); P.y = lerp(p[1], q[1], e) - arc * hump(k); P.angle = lerp(p[2], q[2], e); };
        const back = (p, k) => { const a = p[2] * Math.PI / 180, d = 70 * ease(k); P.x = p[0] - Math.sin(a) * d; P.y = p[1] + Math.cos(a) * d; P.angle = p[2]; };
        const dig = (p, k) => {
          P.x = p[0]; P.y = p[1]; P.angle = p[2];
          const sq = S(0, 0.12, k) * S(0.72, 0.6, k); P.sy = 1 - 0.035 * sq; P.sx = 1 + 0.02 * sq;
          v.flut = S(0.1, 0.18, k) * S(0.62, 0.52, k); v.wave = 1 - 0.85 * S(0, 0.15, k) * S(1, 0.7, k);
          if (k > 0.68) back(p, (k - 0.68) / 0.32);
        };
        const A2 = [A[0] - Math.sin(A[2] * Math.PI / 180) * 70, A[1] + Math.cos(A[2] * Math.PI / 180) * 70, A[2]];
        const B2 = [B[0] - Math.sin(B[2] * Math.PI / 180) * 70, B[1] + Math.cos(B[2] * Math.PI / 180) * 70, B[2]];
        if (b.name === 'glide1') { go(H, A, b.k, 30); v.wave = 1; }
        else if (b.name === 'dig1') dig(A, b.k);
        else if (b.name === 'glide2') { go(A2, B, b.k, 20); v.wave = 1; }
        else if (b.name === 'dig2') dig(B, b.k);
        else if (b.name === 'ledge') {
          const k = S(0, 0.55, b.k); go(B2, L, k, -20); v.wave = 1 - 0.6 * S(0.4, 0.6, b.k); v.tailOut = S(0.5, 0.6, b.k);
        } else {
          const k = b.k, out = S(0, 0.35, k), home = S(0.25, 1, k);
          const a = L[2] * Math.PI / 180, bx = L[0] - Math.sin(a) * 260 * out, by = L[1] + Math.cos(a) * 260 * out;
          P.x = lerp(bx, H[0], ease(home)); P.y = lerp(by, H[1], ease(home)) - 40 * hump(home); P.angle = lerp(L[2], 0, ease(S(0.15, 0.95, k)));
          v.wave = 0.4 + 0.6 * S(0, 0.2, k); v.tailOut = 1 - S(0, 0.3, k); v.wph = 0.8 * (t - b.t) + waveBack(b.t, b.d);   // the edge waves run tail to head to back out
        }
        if (b.name !== 'dig1' && b.name !== 'dig2') { P.sx = 1; P.sy = 1; }
        v.wave *= S(0, 0.25, t) * S(9, 8.7, t) * 0.85 + 0.15;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, band = S(0.02, 0.1, v) * S(0.56, 0.47, v);
        // waves along both edges of the disc, head to tail: the edges swell out and in together
        const ph = TAU * (3.1 * v - (V.wph || 0)), a = 0.04 * (V.wave || 0);
        const wl = S(0.32, 0.05, u) * band, wr = S(0.68, 0.95, u) * band;
        o[0] += -a * Math.sin(ph) * wl + a * Math.sin(ph) * wr; o[1] += 0.3 * a * Math.cos(ph) * (wl + wr);
        // the front edge flutters hard to blow a pit
        if (V.flut) { const wf = S(0.24, 0.05, v) * box(u, v, 0.12, -0.1, 0.88, 0.3, 0.06); o[1] += 0.03 * V.flut * Math.sin(TAU * (4 * u - 6 * t)) * wf; o[0] += 0.012 * V.flut * Math.sin(TAU * 7 * t) * wf * (u - 0.5) * 4; }
        // the tail trails with a lag, a slow wave down it; pelvic fins flick
        const wt = S(0.52, 0.62, v) * box(u, v, 0.36, 0.5, 0.64, 1.05, 0.03);
        rot(o, u, v, 0.5, 0.53, 5 * Math.sin(TAU * 0.4 * t - 0.8) * (1 + 0.6 * (V.tailOut || 0)), wt, r);
        o[0] += 0.025 * Math.sin(TAU * (1.2 * v - 0.7 * t)) * S(0.6, 0.85, v) * wt * (1 + (V.tailOut || 0));
        rot(o, u, v, 0.43, 0.52, 6 * Math.sin(TAU * 0.9 * t), box(u, v, 0.33, 0.51, 0.46, 0.58, 0.02), r);
        rot(o, u, v, 0.57, 0.52, -6 * Math.sin(TAU * 0.9 * t + 1), box(u, v, 0.54, 0.51, 0.67, 0.58, 0.02), r);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        // the sand flat: a sparse grain and a few ripple marks
        E.back = true;
        specks(E, 0, 34, 71, 0, 0, 2.2);
        for (let i = 0; i < 7; i++) { const x = rnd(i, 72) * WW, y = 120 + rnd(i, 73) * (HH - 200); wavy(E, x - 70, x + 70, y, 6, 70, i, 2); }
        E.back = false;
        if (mode === 'pass') {
          // sand lifts at each trough along the edges, and hangs behind it
          emit(t, 0.45, 1.5, (i, te, age) => {
            const Q = poseAt(te), side = i % 2 ? 0.1 : 0.9, [x, y] = at(sc, Q, side, 0.34);
            puff(E, x - 30, y + (side < 0.5 ? -20 : 20), 120, age, 1.5, -70, 0.2); puff(E, x - 110, y + (side < 0.5 ? -50 : 50), 70, age, 1.5, -40, 0.3);
          }, 0.2);
          return;
        }
        const T = {}; let t0 = 0; for (const [n, d] of OUT) { T[n] = t0; t0 += d; }
        const gone = S(8.0, 8.9, t);
        // the pits it blows
        for (const n of ['dig1', 'dig2']) {
          if (t < T[n] + 0.7) continue;
          const [x, y] = pitOf(sc, poseAt, T[n]), k = S(T[n] + 0.7, T[n] + 1.2, t) * (1 - gone);
          E.back = true; if (k > 0.02) { cloud(E, x, y, 70 * k, 0.75); oval(E, x, y, 84 * k, 60 * k, 0, 3); } E.back = false;
        }
        // the sand cloud that erupts while the front edge flutters
        for (const n of ['dig1', 'dig2']) {
          const age = t - (T[n] + 0.25); if (age < 0 || age > 1.6) continue;
          const Q = poseAt(T[n] + 0.4), qa = Q.angle * Math.PI / 180;
          for (let i = 0; i < 11; i++) {
            const a = -Math.PI / 2 + (i - 5) * 0.32, [x, y] = at(sc, Q, 0.5 + 0.36 * Math.cos(a), 0.3 + 0.28 * Math.sin(a));
            const d = (70 + 70 * rnd(i, 74)) * ease(Math.min(1, age / 0.9)), sz = 45 + 40 * rnd(i, 75);
            puff(E, x + Math.cos(a + qa) * d, y + Math.sin(a + qa) * d, sz, age * (0.8 + 0.4 * rnd(i, 76)), 1.6, 0, 0.25);
          }
          if (age < 0.6) for (let i = 0; i < 8; i++) { const a = TAU * i / 8, [x, y] = at(sc, Q, 0.5, 0.15); disc(E, x + Math.cos(a) * 200 * age / 0.6, y + Math.sin(a) * 150 * age / 0.6 - 60 * age, 5); }
        }
        // the ledge it hides under: drawn in as it heads there, rubbed out as it leaves
        const show = S(T.glide2, T.glide2 + 1.0, t) * S(total(OUT), T.back + 1.2, t);
        if (show > 0.01) {
          const n = LEDGE.length / 2, f = (n - 1) * show, j = Math.floor(f), part = LEDGE.slice(0, 2 * (j + 1));
          if (j < n - 1) part.push(lerp(LEDGE[2 * j], LEDGE[2 * j + 2], f - j), lerp(LEDGE[2 * j + 1], LEDGE[2 * j + 3], f - j));
          poly(E, LEDGE, 0, true, 2);
          poly(E, LEDGE, 0, true, 3, 0.3 * S(0.5, 1, show));
          poly(E, part, 5);
          CRACKS.forEach((c, i) => { if (show > 0.55 + 0.08 * i) poly(E, c, 3); });
        }
        if (V.tailOut > 0.5 && V.b === 'ledge') { const [x, y] = at(sc, P, 0.49, 0.95); bubbles(E, t, x + 20, y - 10, 0.5, 0.9, 1, 120, 7, T.ledge + 1.4, T.ledge + 2.0); }
      },
    };
  }

  // ================================================================ dugong
  {
    /* Side view, head right. Grazes seagrass just above the bed, snout down, the fluke beating up and down; pushes off
     * the bottom with its flippers; comes up for a breath of a moment, only the snout tip breaking the surface. */
    const OUT = [['down', 1.3], ['graze', 2.5], ['up', 1.5], ['breath', 0.5], ['sink', 1.0], ['turn', 0.5], ['home', 1.2], ['face', 0.5]];
    const DG = 'dugong', BED = 1012, SURF = 72;
    const SNOUT = [0.955, 0.69];
    /** The centre that puts the snout tip at (x, y) for this angle and scale. */
    function snoutAt(sc, x, y, angle, scale) { const Q = { x: 0, y: 0, scale, sx: 1, sy: 1, angle, mirror: false }; const [px, py] = Ink.pointOf(sc, Q, SNOUT[0], SNOUT[1]); return [x - px, y - py]; }
    /** Seagrass along a bed line seen from the side; blades with x < cut are grazed down to stubs and a furrow. */
    function bedSide(E, t, y, x0, x1, cut, rise = 0, seed = 81) {
      poly(E, [x0 - 40, y + rise, x1 + 40, y + rise], 4);
      for (let i = 0; i < 6; i++) { const x = x0 + (x1 - x0) * rnd(i, seed + 4); line(E, x, y + rise + 22 + 12 * (i % 2), x + 50, y + rise + 22 + 12 * (i % 2), 2.5); }
      for (let x = x0, i = 0; x < x1; x += 22, i++) {
        const clump = Math.sin(x * 0.011 + seed) > -0.2, xx = x + 10 * rnd(i, seed);
        if (xx < cut) { if (i % 3 === 0) line(E, xx, y + rise + 9, xx + 30, y + rise + 9, 3); if (clump && i % 4 === 1) line(E, xx, y + rise, xx + 2, y + rise - 8, 3); continue; }
        if (!clump) continue;
        const h = 70 + 90 * rnd(i, seed + 1), sw = 16 * Math.sin(t * 1.6 + x * 0.04), pts = [];
        for (let k = 0; k <= 4; k++) { const s = k / 4; pts.push(xx + sw * s * s + 5 * s, y + rise - h * s); }
        poly(E, pts, i % 2 ? 2.5 : 3.5);
      }
    }

    M[DG] = {
      facing: 'R', size: [1.15, 0.72],
      pass: { dur: 4.5, path(t, P, sc) {
        const v = P.v, a = 7 + 1.2 * Math.sin(TAU * t / 1.5 - 1);
        crossTight(P, sc, t / 4.5 + 0.006 * Math.sin(TAU * t / 1.5), 1, 0.12);
        P.angle = a; P.y = 0;
        const [, py] = Ink.pointOf(sc, P, SNOUT[0], SNOUT[1]); P.y = BED - 34 - py + 5 * Math.sin(TAU * t / 1.5);
        v.fluke = 12 * Math.sin(TAU * t / 1.5); v.bob = Math.sin(TAU * t / 1.5); v.head = 6; v.fl = 4 * Math.sin(TAU * t / 1.5 + 2); v.b = 'graze';
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, H = [sc.hx, sc.hy];
        v.b = b.name; v.head = 0; v.hop = 0;
        const G0 = snoutAt(sc, sc.hx + 250, BED - 12, 12, 0.72), G1 = snoutAt(sc, sc.hx + 450, BED - 12, 12, 0.72);
        const U = snoutAt(sc, sc.hx + 760, SURF + 14, -30, 0.78), K = [U[0] - 60, U[1] + 230];
        let x = H[0], y = H[1], s = 1, a = 0;
        if (b.name === 'down') { const k = ease(b.k); x = lerp(H[0], G0[0], k); y = lerp(H[1], G0[1], ease(Math.pow(b.k, 1.2))); s = lerp(1, 0.72, k); a = 12 * ease(b.k * 1.4) + 6 * hump(b.k); v.head = 6 * k; }
        else if (b.name === 'graze') {
          const n = 3, h = b.k * n, i = Math.min(n - 1, Math.floor(h)), f = h - i, k = (i + S(0.2, 0.8, f)) / n;
          x = lerp(G0[0], G1[0], k); y = lerp(G0[1], G1[1], k) - 16 * hump(S(0.15, 0.85, f)); s = 0.72; a = 12 - 4 * hump(S(0.15, 0.85, f)); v.head = 6;
          v.hop = f;
        } else if (b.name === 'up') {
          const k = ease(b.k); x = lerp(G1[0], U[0], k); y = lerp(G1[1], U[1], k); s = lerp(0.72, 0.78, k); a = lerp(12, -30, ease(S(0, 0.6, b.k))); v.head = 6 * (1 - k);
        } else if (b.name === 'breath') { x = U[0] + 8 * b.k; y = U[1] - 26 * hump(S(0.1, 0.9, b.k)); s = 0.78; a = -30 - 2 * hump(b.k); }
        else if (b.name === 'sink') { const k = ease(b.k); x = lerp(U[0] + 8, K[0], k); y = lerp(U[1], K[1], k); s = 0.78; a = lerp(-30, -6, k); }
        else if (b.name === 'turn') { x = K[0] - 20 * b.k; y = K[1] + 10 * b.k; s = 0.78; a = -6 * (1 - b.k); turn(P, b.k, 1); }
        else if (b.name === 'home') { const k = ease(b.k); x = lerp(K[0] - 20, H[0], k); y = lerp(K[1] + 10, H[1], k); s = lerp(0.78, 1, k); P.m = -1; }
        else { turn(P, b.k, -1); }
        // one steady fluke rhythm, stronger on the climb, easy while it breathes and sinks; flipper hops while grazing
        const A = 10 - 4 * S(1.1, 1.5, t) + 10 * S(3.7, 4.1, t) - 11 * S(5.1, 5.5, t) - 3 * S(5.8, 6.4, t) + 8 * S(6.8, 7.4, t);
        v.fluke = A * Math.sin(TAU * 0.8 * t); v.bob = Math.sin(TAU * 0.8 * t);
        v.fl = lerp(3 * Math.sin(TAU * t / 1.6 + 2), 22 * hump(S(0, 0.45, v.hop)) - 4, S(1.3, 1.45, t) * S(3.8, 3.65, t));
        P.x = x; P.y = y; P.angle = a; P.scale *= s;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        // the fluke beats up and down about the tail stock; the rear body rides with it
        rot(o, u, v, 0.17, 0.53, V.fluke || 0, S(0.2, 0.14, u), r);
        shift(o, 0, -0.012 * (V.bob || 0), S(0.55, 0.18, u) * S(0.1, 0.2, u));
        // the flipper paddles, and pushes off the bed when it hops
        rot(o, u, v, 0.75, 0.665, V.fl || 0, box(u, v, 0.66, 0.67, 0.81, 0.86, 0.02), r);
        // head tilted down to graze, the snout working
        const wh = S(0.79, 0.86, u) * S(0.36, 0.42, v);
        rot(o, u, v, 0.82, 0.5, (V.head || 0) + 1.5 * Math.sin(TAU * 1.2 * t), wh, r);
        // the drawn bubbles wobble as they rise
        shift(o, 0.006 * Math.sin(TAU * 0.9 * t), -0.008 * (0.5 + 0.5 * Math.sin(TAU * 0.6 * t)), box(u, v, 0.9, 0.15, 1.0, 0.36, 0.02));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v, [sx, sy] = at(sc, P, SNOUT[0], SNOUT[1]);
        if (mode === 'pass') {
          E.back = true; bedSide(E, t, BED, -40, WW + 40, sx - 30); E.back = false;
          emit(t, 0.22, 1.5, (i, te, age) => { const Q = poseAt(te), [x, y] = at(sc, Q, SNOUT[0], SNOUT[1]); puff(E, x - 20, y + 16, 70 + 20 * (i % 2), age, 1.5, -110, 0.7); });
          return;
        }
        const T = {}; let t0 = 0; for (const [n, d] of OUT) { T[n] = t0; t0 += d; }
        // the bed slides into view as it goes down, and away as it leaves
        const bedK = S(0.2, T.graze, t) * S(T.turn + 0.5, T.sink, t);
        if (bedK > 0.01) {
          const first = poseAt(T.graze), [fx] = at(sc, first, SNOUT[0], SNOUT[1]);
          const cut = t < T.graze ? -1e9 : Math.min(sx, at(sc, poseAt(Math.min(t, T.up)), SNOUT[0], SNOUT[1])[0]);
          E.back = true; bedSide(E, t, BED, sc.hx - 200, WW + 40, cut > fx - 10 ? cut - 20 : -1e9, 120 * (1 - bedK)); E.back = false;
        }
        if (V.b === 'graze') emit(t - T.graze, 2.5 / 3, 1.2, (i, te, age) => { const Q = poseAt(T.graze + te), [x, y] = at(sc, Q, SNOUT[0], SNOUT[1]); puff(E, x, y + 6, 60, age, 1.2, -40, 0.7); }, 0.05);
        // the surface: slides down into view as it rises
        const sk = S(T.up, T.up + 0.8, t) * S(T.turn + 0.4, T.sink + 0.3, t);
        if (sk > 0.01) {
          const y = lerp(-40, SURF, sk); surfaceLine(E, t, y);
          const age = t - (T.breath + 0.12), [bx] = at(sc, poseAt(T.breath + 0.25), SNOUT[0], SNOUT[1]);
          if (age > 0) {
            ripple(E, bx, y, age, 1.4, 150, 0.22, 3);
            if (age < 0.9) for (let j = 0; j < 3; j++) { const a = -Math.PI / 2 + (j - 1) * 0.45, d = 220 * age; blob(E, bx + Math.cos(a) * d, y - 14 + Math.sin(a) * d + 300 * age * age, 10, 14, (j - 1) * 25); }
            if (age < 1.1) puff(E, bx + 10, y - 50, 80, age, 1.1, 30, 0.8);
          }
        }
      },
    };
  }

  // ================================================================ Irrawaddy dolphin
  {
    /* Side view, head right: a round head, no beak. Slow up-and-down fluke strokes; it surfaces in quiet rolls, the top
     * of the head, then the back and the little dorsal fin. Spits jets of water from the surface to herd fish. */
    const OUT = [['dip', 1.3], ['rise', 1.4], ['spit1', 1.6], ['spin', 0.7], ['spit2', 1.5], ['roll', 2.5]];
    const ID = 'irrawaddy-dolphin', PSURF = 205, OSURF = 215, MOUTH = [0.93, 0.6];
    const CRESTS = [1.25, 2.75];
    const spyAt = sc => [sc.hx + 210, 440];
    /** The droplets of a spit made at time ts from the mouth (mx, my), dir 1 right, -1 left; returns where they land. */
    function spit(E, t, ts, mx, my, dir, surf) {
      const g = 1500, lands = [];
      for (let i = 0; i < 7; i++) {
        const te = ts + 0.04 * i, vx = 560 * (0.82 + 0.36 * rnd(i, 91)), vy = 520 * (0.9 + 0.2 * rnd(i, 92));
        const tl = (vy + Math.sqrt(vy * vy + 2 * g * (surf - my))) / g, xl = mx + dir * vx * tl;
        lands.push([te + tl, xl]);
        const a = t - te; if (a < 0) continue;
        if (a < tl) { const x = mx + dir * vx * a, y = my - vy * a + 0.5 * g * a * a, ang = Math.atan2(-vy + g * a, dir * vx) * 180 / Math.PI; blob(E, x, y, 11 - i * 0.6, 7, ang); }
        else if (a < tl + 0.7) ripple(E, xl, surf, a - tl, 0.7, 60, 0.25, 2);
      }
      return lands;
    }
    /** A little school near (x, y) that bolts outward once the spit lands at time tl. */
    function school(E, t, x, y, tl, seed) {
      for (let i = 0; i < 6; i++) {
        const bx = x + (rnd(i, seed) - 0.5) * 220, by = y + rnd(i, seed + 1) * 110, m0 = rnd(i, seed + 2) < 0.5 ? -1 : 1;
        const a = t - tl, dir = bx >= x ? 1 : -1;
        if (a <= 0) { fishlet(E, bx + 14 * Math.sin(t * 2 + i), by + 6 * Math.sin(t * 3 + i), m0, 20); continue; }
        if (a > 1.2) continue;
        const d = 650 * a * (1.2 - 0.4 * a), fx = bx + dir * d, fy = by + (rnd(i, seed + 3) - 0.3) * 180 * a;
        fishlet(E, fx, fy, dir, 20);
        if (a < 0.6) for (let j = 0; j < 2; j++) line(E, fx - dir * (40 + 30 * j), fy - 6 + 12 * j, fx - dir * (90 + 40 * j), fy - 6 + 12 * j, 2.5);
      }
    }

    M[ID] = {
      facing: 'R', size: [0.95, 0.65],
      pass: { dur: 4, path(t, P, sc) {
        const v = P.v, w = TAU / 1.5;
        crossTight(P, sc, t / 4 + 0.008 * Math.sin(TAU * 1.3 * t), 1, 0.15);
        const c = Math.cos(w * (t - CRESTS[0]));
        P.y = PSURF + 120 + 90 * (1 - c);
        P.angle = -14 * Math.sin(w * (t - CRESTS[0])) * -1;
        v.fluke = 15 * Math.sin(TAU * 1.3 * t); v.b = 'roll';
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, H = [sc.hx, sc.hy], S0 = spyAt(sc), D = [sc.hx + 120, sc.hy + 70];
        v.b = b.name; v.jaw = 0; v.lunge = 0;
        v.fluke = (15 + 4 * S(1.2, 1.5, t) - 11 * S(2.5, 2.9, t) + 6 * S(6.5, 7.0, t) - 14 * S(8.3, 9, t)) * Math.sin(TAU * 1.3 * t);
        let x = H[0], y = H[1], s = 1, a = 0;
        if (b.name === 'dip') { const k = ease(b.k); x = lerp(H[0], D[0], k); y = lerp(H[1], D[1], k); s = lerp(1, 0.85, k); a = 10 * ease(b.k); }
        else if (b.name === 'rise') {
          const k = ease(b.k); x = lerp(D[0], S0[0], k) + 60 * hump(b.k); y = lerp(D[1], S0[1], k); s = lerp(0.85, 0.72, k); a = lerp(10, -90, ease(S(0, 0.85, b.k)));
        } else if (b.name === 'spit1' || b.name === 'spit2') {
          x = S0[0]; y = S0[1] + 16 * Math.sin(TAU * b.t / 0.8) * S(0, 0.2, b.k) * S(1, 0.8, b.k); s = 0.72; a = -90 + 3 * Math.sin(TAU * b.t / 0.8) * S(0, 0.2, b.k) * S(1, 0.8, b.k);
          if (b.name === 'spit2') P.sy = -1;
          const k = clamp((b.t - 0.3) / 0.35, 0, 1); v.jaw = hump(k); v.lunge = hump(clamp((b.t - 0.25) / 0.3, 0, 1));
          a += (b.name === 'spit1' ? 4 : -4) * v.lunge;
        } else if (b.name === 'spin') { x = S0[0]; y = S0[1] - 8 * hump(b.k); s = 0.72 * (1 + 0.03 * hump(b.k)); a = -90; P.sy = Math.cos(Math.PI * ease(b.k)); }
        else {
          const k = ease(b.k); x = lerp(S0[0], H[0], ease(S(0, 0.75, b.k))); y = lerp(S0[1], H[1], k) + 90 * hump(b.k); s = lerp(0.72, 1, k);
          a = lerp(-90, 0, ease(S(0.05, 0.9, b.k))); P.sy = -Math.cos(Math.PI * ease(S(0.1, 0.8, b.k)));
        }
        P.x = x; P.y = y; P.angle = a; P.scale = s;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        rot(o, u, v, 0.2, 0.62, V.fluke || 0, S(0.23, 0.16, u), r);
        shift(o, 0, -0.012 * Math.sin(((V.fluke || 0) / 15) * 1.2), S(0.5, 0.2, u) * S(0.12, 0.22, u));
        rot(o, u, v, 0.77, 0.63, 6 * Math.sin(TAU * 0.8 * t), box(u, v, 0.69, 0.64, 0.85, 0.85, 0.02), r);
        rot(o, u, v, 0.45, 0.27, -4 * Math.sin(TAU * 1.3 * t - 1), box(u, v, 0.36, 0.12, 0.52, 0.27, 0.02), r);
        // the spit: the head thrusts and the jaw drops
        if (V.lunge) shift(o, 0.02 * V.lunge, 0, S(0.72, 0.85, u));
        if (V.jaw) rot(o, u, v, 0.86, 0.59, 10 * V.jaw, box(u, v, 0.85, 0.6, 1.0, 0.72, 0.02), r);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          surfaceLine(E, t, PSURF);
          for (const c of CRESTS) {
            const age = t - c + 0.15; if (age < 0 || age > 1.5) continue;
            const Q = poseAt(c - 0.15), [bx] = at(sc, Q, 0.82, 0.28);
            ripple(E, bx, PSURF, age, 1.5, 200, 0.18, 3);
            if (age < 1.0) { puff(E, bx + 10, PSURF - 60, 60, age, 1.0, -40, 0.7); for (let j = 0; j < 3; j++) blob(E, bx - 10 + (j - 1) * 50 * age * 2, PSURF - 30 - 160 * age + 300 * age * age - 10 * j, 6, 9, 0); }
          }
          return;
        }
        const T = {}; let t0 = 0; for (const [n, d] of OUT) { T[n] = t0; t0 += d; }
        const sk = S(0.3, T.rise + 0.4, t) * S(total(OUT) - 0.2, T.roll + 1.2, t), surf = lerp(-40, OSURF, sk);
        if (sk > 0.01) surfaceLine(E, t, surf);
        // the head breaking the surface
        { const age = t - (T.rise + 0.85); if (age > 0 && age < 1.2) { const [hx] = at(sc, poseAt(T.rise + 0.9), 0.85, 0.5); ripple(E, hx, surf, age, 1.2, 170, 0.2, 2); if (age < 0.6) splash(E, hx, surf, age, 0.6, 6, 50, 3); } }
        // two spits, right then left, each scattering a little school where it lands
        for (const [n, dir, seed] of [['spit1', 1, 93], ['spit2', -1, 95]]) {
          if (t < T[n] - 0.6 || t > T[n] + 2.6) continue;
          const ts = T[n] + 0.42, Q = poseAt(ts), [mx, my] = at(sc, Q, MOUTH[0], MOUTH[1]);
          const lands = spit(E, t, ts, mx, my, dir, surf), tl = lands[2][0], xl = lands.reduce((s2, l) => s2 + l[1], 0) / lands.length;
          school(E, t, xl, surf + 70, tl, seed);
        }
      },
    };
  }

  // ================================================================ humpback whale
  {
    /* Side view, head right, the long pectoral fin below. Slow up-and-down fluke; the pectorals (a third of its length)
     * sweep like wings to bank, out of step with the fluke. Bubble-net feeding: a tightening spiral of bubbles, then a
     * lunge straight up through the ring, the throat pleats ballooning. */
    const OUT = [['spiral', 4.6], ['deep', 0.8], ['lunge', 1.2], ['arc', 1.0], ['dive', 1.4]];
    const HW = 'humpback-whale', BLOW = [0.79, 0.3], R0 = 300, R1 = 165, F = 0.3, TH0 = -Math.PI / 4, TH1 = 1.5 * Math.PI;
    const centre = sc => [sc.hx - R0 * Math.cos(TH0), sc.hy + F * R0 * Math.sin(TH0)];
    /** Where on the spiral at k 0..1: position, the turn angle and the size. */
    function spiralAt(sc, k) {
      const th = lerp(TH0, TH1, k), R = lerp(R0, R1, k), [cx, cy] = centre(sc), sb = lerp(1 / (1 - 0.2 * Math.sin(TH0)), 0.55, k);
      return { x: cx + R * Math.cos(th), y: cy - F * R * Math.sin(th), th, s: sb * (1 - 0.2 * Math.sin(th)) };
    }
    const lungeX = sc => centre(sc)[0], LUNGE_Y = 440, BAIT_Y = 330;

    M[HW] = {
      facing: 'R', size: [1.15, 0.85],
      pass: { dur: 5, path(t, P, sc) {
        const v = P.v, k = t / 5;
        crossTight(P, sc, k, 1, 0.1);
        P.y = 650 - 230 * ease(k) + 10 * Math.sin(TAU * 0.5 * t);
        P.angle = -8 * hump(k) * 1.1 + 1.2 * Math.sin(TAU * 0.5 * t + 1);
        v.pec = 16 * Math.sin(TAU * 0.5 * t); v.fluke = 10 * Math.sin(TAU * 0.5 * t + Math.PI); v.b = 'cruise';
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, H = [sc.hx, sc.hy], lx = lungeX(sc);
        v.b = b.name; v.throat = 0; v.jaw = 0; let bank = 0;
        let x = H[0], y = H[1], s = 1, a = 0;
        if (b.name === 'spiral') {
          const k = ramp(b.k, 0.15), q = spiralAt(sc, k), sn2 = Math.sin(q.th);
          x = q.x; y = q.y; s = q.s; P.m = sn2 < 0 ? 1 : -1;
          P.sx = lerp(1, 0.08 + 0.92 * Math.pow(Math.abs(sn2), 0.8), S(0, 0.12, b.k));
          const edgeOn = Math.min(1, 3 * Math.abs(sn2)); a = 5 * Math.cos(q.th) * P.m * S(0, 0.12, b.k) * edgeOn; bank = 8 * Math.cos(q.th) * P.m * edgeOn * S(0, 0.12, b.k);
        } else if (b.name === 'deep') {
          const q = spiralAt(sc, 1), k = ease(b.k); x = lerp(q.x, lx, k); y = lerp(q.y, q.y + 170, k); s = lerp(q.s, 0.62, k);
          a = -70 * ease(S(0.15, 1, b.k));
        } else if (b.name === 'lunge') {
          const y0 = spiralAt(sc, 1).y + 170, k = Math.pow(b.k, 1.3); x = lx + 20 * b.k; y = lerp(y0, LUNGE_Y, ease(k)); s = lerp(0.62, 0.7, b.k); a = -70 + 8 * S(0.6, 1, b.k);
          v.throat = S(0.25, 0.65, b.k); v.jaw = S(0.15, 0.4, b.k) * S(1, 0.85, b.k);
        } else if (b.name === 'arc') {
          const k = ease(b.k); x = lerp(lx + 20, lx + 150, k); y = LUNGE_Y - 60 * hump(b.k) + 40 * k; s = 0.7; a = lerp(-62, 82, k);
          v.throat = 1 - 0.6 * b.k; v.jaw = 0;
        } else {
          const kx = Math.pow(b.k, 1.6), ky = Math.sin(b.k * Math.PI / 2); x = lerp(lx + 150, H[0], ease(kx)); y = lerp(LUNGE_Y + 40, H[1], ky); s = lerp(0.7, 1, ease(b.k));
          a = lerp(82, 0, ease(S(0.1, 1, b.k))); v.throat = 0.4 * (1 - b.k);
        }
        // one slow rhythm: the fluke beats harder for the dive and the lunge and stops for the arc; the pectorals sweep,
        // bank in the turns, fold back for the lunge and open again for the dive
        v.fluke = (9 + 7 * S(4.4, 4.9, t) - 16 * S(6.4, 7.2, t) + 6 * S(7.6, 8.4, t)) * Math.sin(TAU * 0.75 * t + Math.PI);
        v.pec = (14 * (1 - S(4.4, 5.2, t)) + 6 * S(7.8, 8.6, t)) * Math.sin(TAU * 0.6 * t) + bank * (1 - S(4.4, 4.7, t))
          - 14 * S(4.6, 5.4, t) + 10 * S(5.4, 6.6, t) + 10 * S(6.6, 7.6, t) - 6 * S(7.6, 9.0, t);
        P.x = x; P.y = y; P.angle = a; P.scale = s;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        rot(o, u, v, 0.18, 0.45, V.fluke || 0, S(0.21, 0.14, u), r);
        shift(o, 0, 0.012 * Math.sin(((V.fluke || 0) / 10) * 1.3), S(0.45, 0.18, u) * S(0.1, 0.2, u));
        // the long pectoral: everything under its leading edge, sweeping about the shoulder
        const wp = S(-0.025, 0.035, v - (0.5 + (0.72 - u) * 0.7)) * S(0.29, 0.35, u) * S(0.76, 0.7, u);
        rot(o, u, v, 0.72, 0.53, V.pec || 0, wp, r);
        rot(o, u, v, 0.5, 0.66, 0.4 * (V.pec || 0) * Math.cos(TAU * 0.5 * t), wp * S(0.55, 0.38, u), r);
        // throat pleats balloon and the jaw drops on the lunge
        if (V.throat) scl(o, u, v, 0.86, 0.5, 1, 1 + 0.25 * V.throat, box(u, v, 0.66, 0.5, 1.0, 0.72, 0.04) * S(0.62, 0.72, u));
        if (V.jaw) rot(o, u, v, 0.78, 0.515, 9 * V.jaw, box(u, v, 0.76, 0.515, 1.0, 0.72, 0.02), r);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          E.back = true; rays(E, t, 9, 620, 3.5, 11); E.back = false;
          emit(t, 0.32, 1.8, (i, te, age) => { const Q = poseAt(te), [x, y] = at(sc, Q, BLOW[0], BLOW[1]); riseBubble(E, x - 10 * (i % 3), y - 10, age, 6 + 7 * rnd(i, 101), 12, 150); });
          return;
        }
        const T = {}; let t0 = 0; for (const [n, d] of OUT) { T[n] = t0; t0 += d; }
        const lx = lungeX(sc), end = T.arc + 0.5;
        // the bubble net: bubbles left along the spiral rise into a ring, until the lunge breaks it
        emit(t, 0.11, 8, (i, te, age) => {
          const Q = poseAt(te), [x, y] = at(sc, Q, BLOW[0], BLOW[1]), gone = t > end ? clamp((t - end) / 0.6, 0, 1) : 0;
          if (rnd(i, 102) < gone) return;
          for (let j = 0; j < 2; j++) circle(E, x + 8 * Math.sin(age * 3 + i + j), y - 10 - 24 * age - 34 * j * Math.min(1, age * 2), (5 + 5 * rnd(i, 103) + 1.5 * Math.min(age, 2)) * (1 - 0.35 * j), 3);
        }, 0.25, T.deep - 0.2);
        // the bait ball inside the ring, swallowed as the mouth comes through
        if (t < T.arc + 0.3) {
          const [mx, my] = at(sc, P, 0.97, 0.5);
          for (let i = 0; i < 9; i++) {
            const arrive = S(0.6 + 0.15 * i, 2.6 + 0.15 * i, t), mill = Math.sin(t * 0.8 + i);
            const fx = lerp(-80 - 60 * i, lx - 70 + 140 * rnd(i, 104) + 26 * Math.sin(t * 1.7 + i), arrive), fy = BAIT_Y + 70 * rnd(i, 105) + 12 * Math.sin(t * 2.3 + i);
            if (V.b === 'arc' || (V.b === 'lunge' && my < fy + 30 && Math.abs(mx - fx) < 200)) continue;
            fishlet(E, fx, fy, arrive < 0.98 ? 1 : (mill > 0 ? 1 : -1), 16);
          }
        }
        if (V.b === 'lunge' || V.b === 'arc') { const [x, y] = at(sc, P, 0.6, 0.6); bubbles(E, t, x, y + 40, 0.15, 0.8, 3, 140, 106, T.lunge, T.arc + 0.4); }
        if (V.b === 'dive') { const [x, y] = at(sc, P, 0.12, 0.45); bubbles(E, t, x, y, 0.3, 1.0, 2, 160, 107, T.dive, T.dive + 0.9); }
      },
    };
  }
})();
