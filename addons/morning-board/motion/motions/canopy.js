/* Canopy shows: white-handed gibbon, Sunda slow loris, binturong, proboscis monkey, buffy fish owl, Sunda colugo. */
'use strict';
(function () {
// ---------- helpers shared by the canopy shows

/** The mirror the engine will end up with for this pose (it flips a drawing that faces the other way). */
function finalMirror(P, facing) {
  const turn = facing === 'L' ? P.m > 0 : facing === 'R' ? P.m < 0 : false;
  return P.mirror !== turn;
}
/** pin(), but for a pose whose mirror the engine has not applied yet (inside path). */
function pinF(sc, P, facing, u, v, x, y, angle) {
  const keep = P.mirror; P.mirror = finalMirror(P, facing);
  Ink.pin(sc, P, u, v, x, y, angle);
  P.mirror = keep;
}
/** Where drawing point (u, v) is for a pose inside path (before the engine's mirror). */
function atF(sc, P, facing, u, v) { return Ink.pointOf(sc, Object.assign({}, P, { mirror: finalMirror(P, facing) }), u, v); }
/** Is the drawn part of the animal (box u0..u1, v0..v1 of the drawing) wholly off the left or right edge? */
function offScreen(sc, P, facing, u0, v0, u1, v1, pad = 10) {
  const xs = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]].map(([u, v]) => atF(sc, P, facing, u, v)[0]);
  return Math.max(...xs) < -pad || Math.min(...xs) > WW + pad;
}
/** A moth: a small body and two paper wings that open and close (flap 0 shut .. 1 open), heading deg. */
function moth(E, x, y, flap, deg = 0, size = 26) {
  const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const P2 = (dx, dy) => [x + dx * ca - dy * sa, y + dx * sa + dy * ca];
  for (const side of [-1, 1]) {
    const open = 0.25 + 0.75 * flap, pts = [];
    for (const [dx, dy] of [[0.25, 0], [0.55, side * 0.9 * open], [-0.2, side * 1.05 * open], [-0.55, side * 0.55 * open], [-0.35, 0]]) pts.push(...P2(dx * size, dy * size));
    paper(E, pts, 3);
  }
  blob(E, x, y, size * 0.55, size * 0.16, deg);
  const [ax, ay] = P2(size * 0.55, 0), [b1x, b1y] = P2(size * 0.95, -size * 0.35), [b2x, b2y] = P2(size * 0.95, size * 0.35);
  line(E, ax, ay, b1x, b1y, 2); line(E, ax, ay, b2x, b2y, 2);
}
/** A dotted limb along drawing points pts [[u, v], ...], half-width hw (drawing height units), with a paw at the end. */
function limbFx(E, sc, P, pts, hw, paw = true) {
  const a = sc.a, L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
    let tx = (p1[0] - p0[0]) * a.w, ty = (p1[1] - p0[1]) * a.h; const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
    const ox = -ty * hw * a.h / a.w, oy = tx * hw;
    L.push(at(sc, P, pts[i][0] + ox, pts[i][1] + oy)); R.push(at(sc, P, pts[i][0] - ox, pts[i][1] - oy));
  }
  const ring = [];
  L.forEach(p => ring.push(p[0], p[1])); R.reverse().forEach(p => ring.push(p[0], p[1]));
  if (pts.length > 1) poly(E, ring, 4, true, 3, 0.62);
  if (paw) {
    const e = pts[pts.length - 1], [x, y] = at(sc, P, e[0], e[1]), s = hw * sc.sh * P.scale * 1.25;
    poly(E, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].flatMap(i => [x + Math.cos(i * TAU / 12) * s * 1.1, y + Math.sin(i * TAU / 12) * s * 0.9]), 4, true, 3, 0.62);
  }
}
/** The bend at drawing point (u, v), as the TV applies it: interpolated from the 24 x 12 grid. */
function warpAt(mo, sc, u, v, t, P) {
  const r = sc.a.w / sc.a.h, gx = clamp(u, 0, 1) * Ink.COLS, gy = clamp(v, 0, 1) * Ink.ROWS;
  const ix = Math.min(Ink.COLS - 1, Math.floor(gx)), iy = Math.min(Ink.ROWS - 1, Math.floor(gy)), fx = gx - ix, fy = gy - iy;
  const node = (cx, cy) => { const o = [0, 0]; mo.bend((ix + cx) / Ink.COLS, (iy + cy) / Ink.ROWS, t, P, o, r); return o; };
  const a = node(0, 0), b = node(1, 0), c = node(0, 1), d = node(1, 1);
  return [u + (a[0] * (1 - fx) + b[0] * fx) * (1 - fy) + (c[0] * (1 - fx) + d[0] * fx) * fy,
    v + (a[1] * (1 - fx) + b[1] * fx) * (1 - fy) + (c[1] * (1 - fx) + d[1] * fx) * fy];
}
/** Where drawing point (u, v) is drawn, bend included. */
const bentAt = (mo, sc, P, u, v, t) => at(sc, P, ...warpAt(mo, sc, u, v, t, P));
/** A closed paper-filled shape with an ink edge. (The engine leaves its fill colour on paper after a paper fill, so
 * an empty ink fill follows to put it back: without it, later blobs and discs would come out as paper.) */
function paper(E, pts, w = 3) { poly(E, pts, w, true, 2); inkReset(E); }
function inkReset(E) { poly(E, [0, 0, 0, 0, 0, 0], 0, true, 1); }
/** lib's water(), then the ink fill colour put back. */
function river(E, x0, x1, y, t, amp) { water(E, x0, x1, y, t, amp); inkReset(E); }
/** A smooth ramp: position 0..1 for k 0..1 with a constant speed that eases out over the last `tail` of it. */
function easeOutRamp(k, tail = 0.35) {
  const L = tail, k0 = 1 - L, tot = k0 + L / 2;
  if (k <= k0) return k / tot;
  const x = Math.min(k, 1) - k0;
  return (k0 + x / 2 + (L / (2 * Math.PI)) * Math.sin(Math.PI * x / L)) / tot;
}


// ===== White-handed gibbon ==========================================================================================
// Brachiates: swings below one hand like a pendulum, lets go before the top of the swing, flies, and catches the vine
// again. The body turns in the air on every flight (the drawing squashes through edge-on and comes out mirrored), so the
// hand on the vine changes each stride. Pairs sing duets whose notes come closer and closer, ending in wild swinging.
(function () {
  const GU = 0.54, GV = 0.09;                       // the gripping hand, at the top of the straight arm
  const SHOULDER = [0.42, 0.53], HIP = [0.5, 0.76], NECK = [0.47, 0.52];
  /** The drawing hung from its grip at (gx, gy), turned ang degrees about it (+ swings the legs left). */
  function hang(sc, scale, gx, gy, ang, mir) {
    const Q = { x: 0, y: 0, scale, sx: 1, sy: 1, angle: 0, mirror: mir };
    Ink.pin(sc, Q, GU, GV, gx, gy, ang);
    return Q;
  }
  /** A pendulum swing from a0 to a1: quick through the bottom, slow (never stopped) at the ends. */
  const swingK = k => k - 0.8 * Math.sin(TAU * k) / TAU;
  /** The vine dips under a fresh catch, overshoots and settles: px down at `age` s after the catch. */
  const dip = (age, depth) => age < 0 ? 0 : depth * (1 - Math.exp(-5 * age) * Math.cos(TAU * 2.2 * age));

  /**
   * A brachiation timeline. Segments: { k: 'hang', g, d, th(k, tt) } hangs from grip g (index into grips) with angle
   * th; { k: 'fly', d, h } flies from the end of the previous hang to the start of the next, turning in the air.
   * Each hang knows its mirror. Returns { P set, info } for time t.
   */
  function brachiate(t, P, sc, T) {
    let t0 = 0, i = 0;
    for (; i < T.segs.length - 1 && t >= t0 + T.segs[i].d; i++) t0 += T.segs[i].d;
    const s = T.segs[i], k = clamp((t - t0) / s.d, 0, 1), scale = P.scale;
    const gripY = (j, tt) => T.grips[j][1] + T.sag(j, tt);
    const at = (j, tt) => { const sg = T.segs[j]; let a = 0; for (let n = 0; n < j; n++) a += T.segs[n].d; return [sg, a]; };
    if (s.k === 'hang') {
      const ang = s.th(k, t - t0);
      const Q = hang(sc, scale, T.grips[s.g][0], gripY(s.g, t), ang, s.mir);
      Object.assign(P, { x: Q.x, y: Q.y, angle: ang, mirror: s.mir, sx: 1 });
      P.v.grip = s.g; P.v.ang = ang; P.v.fly = 0;
    } else {
      const [a, ta] = at(i - 1), [c, tc] = at(i + 1);
      const angA = a.th(1, a.d), angC = c.th(0, 0);
      const A = hang(sc, scale, T.grips[a.g][0], gripY(a.g, ta + a.d), angA, a.mir);
      const C = hang(sc, scale, T.grips[c.g][0], gripY(c.g, tc), angC, c.mir);
      const kk = s.lin ? k : k * 0.85 + 0.15 * ease(k);
      P.x = lerp(A.x, C.x, kk); P.y = lerp(A.y, C.y, kk) - (s.h || 40) * hump(k);
      P.angle = lerp(angA, angC, ease(k));
      const tw = a.mir === c.mir ? 1 : Math.cos(Math.PI * S(0.3, 0.7, k));   // the turn in the air
      P.mirror = tw >= 0 ? a.mir : c.mir; P.sx = Math.max(0.2, Math.abs(tw));
      P.v.grip = -1; P.v.ang = P.angle; P.v.fly = hump(k);
    }
    // angular speed, for the legs that lag
    P.v.seg = i; P.v.segk = k;
    return s;
  }
  function angleAt(t, T, sc) {   // just the angle, for the lag (cheap: a pose without effects)
    const P = { v: {}, scale: 1, x: 0, y: 0, angle: 0, mirror: false, sx: 1 };
    brachiate(clamp(t, 0, T.dur), P, sc, T);
    return P.angle;
  }

  // ---- the pass: a vine across the top of the screen; it enters and leaves in mid-air
  const VY = 92;
  // it enters and leaves in mid-air: the first and last hangs are only where the flight starts and ends
  const PG = [[-430, VY], [190, VY], [730, VY], [1290, VY], [1870, VY], [2380, VY]];
  const PSEG = [
    { k: 'hang', g: 0, d: 0.001, mir: false, th: () => -6 },
    { k: 'fly', d: 0.34, h: 50, lin: true },
    { k: 'hang', g: 1, d: 0.7, mir: true, th: k => lerp(28, -22, swingK(k)) },
    { k: 'fly', d: 0.22, h: 35 },
    { k: 'hang', g: 2, d: 0.64, mir: false, th: k => lerp(26, -24, swingK(k)) },
    { k: 'fly', d: 0.26, h: 45 },
    { k: 'hang', g: 3, d: 0.58, mir: true, th: k => lerp(26, -26, swingK(k)) },
    { k: 'fly', d: 0.3, h: 55 },
    { k: 'hang', g: 4, d: 0.52, mir: false, th: k => lerp(26, -30, swingK(k)) },
    { k: 'fly', d: 0.38, h: 70, lin: true },
    { k: 'hang', g: 5, d: 0.001, mir: true, th: () => 8 },
  ];
  const segStart = (segs, j) => segs.slice(0, j).reduce((s, x) => s + x.d, 0);
  function sagFor(segs, depth) {
    // catch and release times of each grip, from the timeline
    const times = {};
    segs.forEach((s, j) => { if (s.k === 'hang') { const t0 = segStart(segs, j); times[s.g] = times[s.g] || []; times[s.g].push([t0, t0 + s.d]); } });
    return (g, t) => {
      let y = 0;
      for (const [c, r] of times[g] || []) {
        if (t < c) continue;
        const d = typeof depth === 'function' ? depth(g) : depth;
        if (t <= r) y += dip(t - c, d) + 0.2 * d * hump((t - c) / (r - c));
        else y += dip(r - c, d) * Math.exp(-4 * (t - r)) * Math.cos(TAU * 2.6 * (t - r));
      }
      return y;
    };
  }
  const PT = { segs: PSEG, grips: PG, dur: total(PSEG.map(s => [0, s.d])), sag: sagFor(PSEG, 30) };

  // ---- the outing: sings on its bar, swings out along a vine, leaps down to a lower liana and back home
  const OSEG = [
    { k: 'hang', g: 0, d: 2.0, mir: false, sing: true,
      th: (k, tt) => 3 * Math.sin(TAU * tt / 1.6) * (1 - S(0.6, 0.75, k)) + 30 * S(0.68, 1, k) },
    { k: 'hang', g: 0, d: 0.62, mir: false, th: k => lerp(30, -24, swingK(k)) },
    { k: 'fly', d: 0.24, h: 34 },
    { k: 'hang', g: 1, d: 0.58, mir: true, th: k => lerp(24, -24, swingK(k)) },
    { k: 'fly', d: 0.26, h: 40 },
    { k: 'hang', g: 2, d: 0.9, mir: false, th: k => -2 - 28 * Math.cos(Math.PI * (1 + 1.8 * swingK(k))) },
    { k: 'fly', d: 0.5, h: 90 },
    { k: 'hang', g: 3, d: 0.8, mir: true, th: k => lerp(-22, 26, swingK(k)) },
    { k: 'fly', d: 0.42, h: 120 },
    { k: 'hang', g: 0, d: 2.7, mir: false, settle: true,
      th: (k, tt) => -24 * Math.exp(-1.25 * tt) * Math.cos(TAU * tt / 0.95) * (1 - S(0.75, 1, k)) },
  ];
  const OT = { segs: OSEG, dur: total(OSEG.map(s => [0, s.d])) };

  const HOMEP = sc => ({ x: sc.hx, y: sc.hy, scale: 1, sx: 1, sy: 1, angle: 0, mirror: false });
  /** The outing's vine runs on from the end of the bar to the right edge, sagging a little. */
  function vineOf(sc) {
    const [x0, y0] = Ink.pointOf(sc, HOMEP(sc), 0.94, 0.08), x1 = WW + 40, y1 = y0 - 4;
    return { x0, x1, y0, y1, sag: 26, y: x => { const k = clamp((x - x0) / (x1 - x0), 0, 1); return lerp(y0, y1, k) + 26 * Math.sin(Math.PI * k); } };
  }
  function outingGrips(sc) {
    const home = Ink.pointOf(sc, HOMEP(sc), GU, GV), vn = vineOf(sc), x1 = home[0] + 360, x2 = home[0] + 740;
    return [home, [x1, vn.y(x1)], [x2, vn.y(x2)], [home[0] + 400, home[1] + 118]];
  }

  M['white-handed-gibbon'] = {
    facing: 'F', size: [1.0, 0.82], props: [0],
    pass: { dur: PT.dur, path(t, P, sc) {
      hideProp(P); P.m = 1;
      const s = brachiate(t, P, sc, PT);
      P.v.b = s.k === 'fly' ? 'fly' : 'swing';
      P.v.lag = (angleAt(t + 0.03, PT, sc) - angleAt(t - 0.03, PT, sc)) / 0.06;
    } },
    outing: { dur: OT.dur, path(t, P, sc) {
      const T = Object.assign({}, OT, { grips: outingGrips(sc) });
      T.sag = sagFor(OSEG, g => (g === 0 ? 0 : g === 3 ? 46 : 26));
      P.m = 1;
      const s = brachiate(t, P, sc, T);
      P.v.b = s.sing ? 'sing' : s.settle ? 'settle' : s.k === 'fly' ? 'fly' : 'swing';
      P.v.sing = t < 3.6 ? t : -1;
      P.v.lag = (angleAt(t + 0.03, T, sc) - angleAt(t - 0.03, T, sc)) / 0.06;
      // the bar dips when it takes the weight back, and springs
      const back = segStart(OSEG, 9), age = t - back;
      const bar = age > 0 ? 10 * Math.exp(-3 * age) * Math.sin(TAU * 1.9 * age) : 0;
      P.prop = { x: sc.hx, y: sc.hy + bar, scale: 1, sx: 1, sy: 1, angle: 0, mirror: false, hidden: false };
      if (s.g === 0 && s.k === 'hang') P.y += bar;
    } },
    bend(u, v, t, P, o, r) {
      const V = P.v, lag = clamp(V.lag || 0, -260, 260);
      // the legs trail the swing (the whip), and kick a little in flight
      const legs = S(0.7, 0.8, v) * S(0.3, 0.37, u) * S(0.68, 0.62, u);
      rot(o, u, v, HIP[0], HIP[1], -0.07 * lag + 8 * (V.fly || 0) * Math.sin(TAU * 3 * t), legs, r);
      // the free arm trails too, and lifts in flight
      const arm = S(0.45, 0.37, u) * S(0.46, 0.53, v) * S(0.82, 0.76, v);
      rot(o, u, v, SHOULDER[0], SHOULDER[1], -0.05 * lag + 18 * (V.fly || 0) + 3 * Math.sin(TAU * 0.7 * t), arm, r);
      // the body hangs a touch longer below the arm at the bottom of the swing
      o[1] += 0.012 * Math.cos(clamp(V.ang || 0, -60, 60) * Math.PI / 180) * S(0.2, 0.5, v) * (V.grip >= 0 ? 1 : 0);
      // singing: the head tips back with every note, the chest swells
      if (V.sing >= 0) {
        const n = singPulse(V.sing);
        rot(o, u, v, NECK[0], NECK[1], -9 * n, box(u, v, 0.37, 0.35, 0.56, 0.53, 0.03), r);
        scl(o, u, v, 0.5, 0.6, 1 + 0.03 * n, 1 + 0.01 * n, box(u, v, 0.42, 0.52, 0.62, 0.74, 0.04));
      }
    },
    fx(t, P, sc, E, mode, poseAt) {
      const V = P.v, pass = mode === 'pass';
      const T = pass ? PT : Object.assign({}, OT, { grips: outingGrips(sc) });
      if (!pass) T.sag = sagFor(OSEG, g => (g === 0 ? 0 : g === 3 ? 46 : 26));
      const segs = T.segs;
      // the vines, sagging under the hand that holds them, rippling after it lets go
      E.back = true;
      const vineLine = (x0, x1, y0, y1, sagMid, grips) => {
        const pts = [];
        for (let x = x0; x <= x1 + 1; x += 24) {
          let y = lerp(y0, y1, (x - x0) / (x1 - x0)) + sagMid * Math.sin(Math.PI * clamp((x - x0) / (x1 - x0), 0, 1));
          for (const g of grips) { const d = T.sag(g, t); y += d * Math.exp(-(((x - T.grips[g][0]) / 230) ** 2)); }
          pts.push(x, y);
        }
        poly(E, pts, 5);
        return pts;
      };
      if (pass) {
        const pts = vineLine(-40, WW + 40, VY, VY, 0, [1, 2, 3, 4]);
        // little leaves hang off the vine and swing with it
        for (let i = 0; i < 11; i++) {
          const j = 2 * Math.round((i * 190 + 60 + 40) / 24), x = pts[j], y = pts[j + 1];
          if (x === undefined) continue;
          leaf(E, x + 8, y + 24, 70 + 16 * Math.sin(TAU * 0.8 * t + i), 20, i % 3 === 0);
        }
      } else {
        const vn = vineOf(sc);
        vineLine(vn.x0, vn.x1, vn.y0, vn.y1, vn.sag, [1, 2]);
        // the lower liana: a loop hanging from the bar to the vine
        const g3 = T.grips[3], la = Ink.pointOf(sc, HOMEP(sc), 0.86, 0.09), lb = [g3[0] + 250, vn.y(g3[0] + 250)], loop = [];
        for (let k = 0; k <= 1.001; k += 0.04) {
          const kl = k < 0.5 ? k * 2 : (k - 0.5) * 2, a = k < 0.5 ? la : lb;
          const x = k < 0.5 ? lerp(a[0], g3[0], kl) : lerp(g3[0], a[0], kl);
          const y = k < 0.5 ? lerp(a[1], g3[1], Math.sin(kl * Math.PI / 2)) : lerp(g3[1], a[1], 1 - Math.cos(kl * Math.PI / 2));
          loop.push(x, y + T.sag(3, t) * Math.sin(Math.PI * k));
        }
        poly(E, loop, 5);
        leaf(E, lerp(la[0], g3[0], 0.4), lerp(la[1], g3[1], 0.75) + 14, 60 + 8 * Math.sin(TAU * 0.6 * t), 16);
        leaf(E, lerp(g3[0], lb[0], 0.6), lerp(g3[1], lb[1], 0.7) + 14, 115, 16, true);
      }
      E.back = false;
      // two leaves shaken loose at every catch, and a wobble of the vine
      segs.forEach((s, j) => {
        if (s.k !== 'hang' || j === 0 || segs[j - 1].k !== 'fly' || (pass && j === segs.length - 1)) return;
        const tc = segStart(segs, j), age = t - tc;
        if (age < 0 || age > 2.2) return;
        const [gx, gy] = T.grips[s.g];
        for (let n = 0; n < 2; n++) fallingLeaf(E, gx - 30 + 70 * n, gy + 30, age, j * 2 + n, 18, 150 + 40 * n);
        if (age < 0.3) for (let n = -1; n <= 1; n += 2) arc(E, gx + n * 12, gy, 26 + 120 * age, n > 0 ? -60 : 200, 40, 3);
      });
      // the song: "ooo" notes, closer and closer together, rising from the mouth
      if (!pass) {
        const notes = singTimes();
        for (let n = 0; n < notes.length; n++) {
          const age = t - notes[n];
          if (age < 0 || age > 0.95) continue;
          const Q = poseAt(notes[n]), [mx, my] = at(sc, Q, 0.4, 0.44);
          const x = mx - 30 - 40 * (n % 3) + 16 * Math.sin(age * 6 + n), y = my - 30 - 150 * age - 8 * n;
          note(E, x, y, 13 + 1.2 * Math.min(n, 6));
        }
      }
      // a whoosh behind the feet in the fast swings
      if (Math.abs(V.lag || 0) > 120 && !(V.sing >= 0)) {
        const [fx, fy] = at(sc, P, 0.52, 0.94), d = -Math.sign(V.lag);
        for (let n = 0; n < 3; n++) arc(E, fx + d * 40, fy - 60, 110 + 26 * n, d > 0 ? 40 + n * 6 : 110 - n * 6, 30, 3);
      }
    },
  };
  function singTimes() { const out = []; let t = 0.15, gap = 0.5; while (t < 3.2) { out.push(t); t += gap; gap = Math.max(0.12, gap * 0.78); } return out; }
  function singPulse(t) { let p = 0; for (const n of singTimes()) { const a = t - n; if (a > -0.08 && a < 0.35) p = Math.max(p, hump((a + 0.08) / 0.43)); } return p; }
})();

// ===== Sunda slow loris =============================================================================================
// Never leaps: creeps with three limbs holding and one moving, the body gliding along the branch, head steady, and can
// freeze dead still for seconds. The one fast thing it does is the grab. In defence it rears and raises its arms over
// its head (the venom gland is on the inside of the elbow) and licks the elbow.
(function () {
  const BODY = [0.22, 0.1, 0.81, 0.76];                    // the drawn animal, for "is it off screen"
  const BR = [[0.1, 0.83], [0.9, 0.395]];                  // the branch's centre line in the drawing
  const SHOULDER = [0.41, 0.53], NECK = [0.42, 0.42], HINDPAW = [0.75, 0.6];
  const PASS = [['creep', 2.0], ['freeze', 1.1], ['go', 1.9]];
  const OUT = [['creep', 1.6], ['moth', 0.7], ['freeze', 3.0], ['grab', 0.35], ['startle', 0.45], ['hold', 1.5],
    ['lower', 1.0], ['home', 1.4]];
  const PASS_ANG = -9;            // turns its 15 degree branch down to a gentle 6 degrees across the screen
  const ALONG = Math.atan2(BR[1][1] - BR[0][1], (BR[1][0] - BR[0][0]) * 2);   // the branch's slope in the drawing (r = 2)

  /** One limb's offset over its gait cycle c (0..1): forward in the first quarter, lifted, then planted and drawn back. */
  function limb(c) {
    c = frac(c);
    if (c < 0.25) { const k = c / 0.25; return [lerp(-1, 1, ease(k)), hump(k)]; }
    return [lerp(1, -1, (c - 0.25) / 0.75), 0];
  }
  /** The screen direction of its branch in the pass (unit, forward). */
  function passDir(sc) {
    // mirrored (facing right) and turned PASS_ANG: forward is down-right along the branch
    const a = -ALONG + PASS_ANG * Math.PI / 180;   // mirror flips the slope's sign
    return [Math.cos(a), Math.sin(a)];
  }

  M['sunda-slow-loris'] = {
    facing: 'L', size: [1.1, 1.0], props: [0],
    pass: { dur: total(PASS), path(t, P, sc) {
      const b = beat(t, PASS), v = P.v, [fx, fy] = passDir(sc);
      hideProp(P); P.m = 1; P.angle = PASS_ANG; v.b = b.name;
      const d0 = -1720, d1 = 1700;   // px along the branch from the middle of the screen
      let d;
      if (b.name === 'creep') d = lerp(d0, 0, easeOutRamp(b.k, 0.4));
      else if (b.name === 'freeze') d = 0;
      else d = lerp(0, d1, 1 - easeOutRamp(1 - b.k, 0.4));
      // a little surge forward as each limb reaches (one limb at a time)
      const units = d / sc.sw;
      v.ph = units / 0.32;
      d += 8 * Math.sin(TAU * 4 * v.ph) * (b.name === 'freeze' ? 0 : 1);
      // pin a point on its branch to the screen's branch line
      pinF(sc, P, 'L', 0.55, 0.585, WW / 2 + d * fx, 790 + d * fy, PASS_ANG);
      v.watch = b.name === 'freeze' ? hump(b.k) : 0;
      if (offScreen(sc, P, 'L', ...BODY)) P.hidden = true;
    } },
    outing: { dur: total(OUT), path(t, P, sc) {
      const b = beat(t, OUT), v = P.v;
      stay(P, sc); P.m = -1; v.b = b.name;
      // forward along its branch is down and to the left
      const fx = -Math.cos(ALONG), fy = -Math.sin(ALONG), creep = 110, stride = 0.05;
      let d = 0, rear = 0, lunge = 0;
      v.grab = 0; v.raise = 0; v.tuck = 0; v.look = 0; v.eat = 0;
      if (b.name === 'creep') d = creep * ease(b.k);
      else if (b.name === 'home') d = creep * (1 - ease(b.k));
      else d = creep;
      if (b.name === 'moth') v.look = ease(b.k);
      if (b.name === 'freeze') v.look = 1;
      if (b.name === 'grab') {   // one frame: the arm is out and the moth is gone; then the paw goes to the mouth
        v.grab = 1 - S(0.45, 1, b.k); v.eat = S(0.45, 1, b.k); lunge = 26 * (1 - S(0.3, 1, b.k)); v.look = 1 - b.k;
        if (b.t < Ink.FRAME) v.cut = true;
      }
      if (b.name === 'startle') { const k = ease(b.k); rear = 26 * k; v.raise = k; v.tuck = k; v.eat = 1 - k; }
      if (b.name === 'hold') { rear = 26; v.raise = 1; v.tuck = 1; v.lick = b.t; }
      if (b.name === 'lower') { const k = 1 - ease(b.k); rear = 26 * k; v.raise = k; v.tuck = k; }
      v.ph = -(d / sc.sw) / stride;   // the gait runs on distance: backing home runs it backwards
      const bx = sc.hx + (d + lunge) * fx * 1, by = sc.hy + (d + lunge) * fy;
      P.x = bx; P.y = by;
      if (rear) { const [px, py] = atF(sc, P, 'L', ...HINDPAW); pinF(sc, P, 'L', ...HINDPAW, px, py, rear); }
      if (b.name === 'hold') { P.x += 1.5 * Math.sin(TAU * 9 * b.t) * (1 - b.k); }   // a shiver
    } },
    bend(u, v, t, P, o, r) {
      const V = P.v, ph = V.ph || 0;
      // the near front and hind limbs step one at a time (hind, front, then the far pair, hidden)
      const fr = limb(ph - 0.25), hi = limb(ph);
      const front = box(u, v, 0.32, 0.55, 0.46, 0.8, 0.03) * S(0.53, 0.66, v), hind = box(u, v, 0.67, 0.43, 0.83, 0.65, 0.03) * S(0.44, 0.55, v);
      shift(o, -0.035 * fr[0], -0.035 * fr[1], front * (1 - (V.raise || 0)) * (1 - (V.grab || 0)));
      shift(o, -0.03 * hi[0], -0.03 * hi[1], hind);
      // the body rides a touch higher while a limb is off the branch
      o[1] -= 0.006 * (fr[1] + hi[1] + limb(ph - 0.5)[1] + limb(ph - 0.75)[1]) * S(0.5, 0.35, v);
      // breathing, slow (not in a freeze)
      const still = V.b === 'freeze' || V.b === 'moth' ? 0 : 1;
      scl(o, u, v, 0.6, 0.35, 1, 1 + 0.012 * still * Math.sin(TAU * 0.5 * t), box(u, v, 0.42, 0.12, 0.8, 0.55, 0.05));
      // the head: steady, looks down at the moth, tucks when startled, eyes on the moth in the pass
      const head = box(u, v, 0.18, 0.12, 0.44, 0.58, 0.03) * S(0.62, 0.55, v);
      rot(o, u, v, NECK[0], NECK[1], -7 * (V.look || 0) - 12 * (V.tuck || 0) + 5 * (V.watch || 0), head, r);
      // the arm: the grab (30 degrees forward in one frame), to the mouth, and up over the head
      const arm = box(u, v, 0.31, 0.5, 0.47, 0.8, 0.03) * S(0.5, 0.58, v);
      const armDeg = 30 * (V.grab || 0) + 55 * (V.eat || 0) * (1 - (V.raise || 0)) + 82 * (V.raise || 0);
      rot(o, u, v, SHOULDER[0], SHOULDER[1], armDeg, arm, r);
    },
    fx(t, P, sc, E, mode, poseAt) {
      const V = P.v;
      if (mode === 'pass') {
        // its branch, stretched across the screen
        const Q = poseAt(0), [ax, ay] = at(sc, Q, ...BR[0]), [bx, by] = at(sc, Q, ...BR[1]);
        const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, half = 0.038 * sc.sh;
        const yAt = x => ay + (x - ax) * dy / dx;
        E.back = true;
        const top = [], bot = [];
        for (let x = -60; x <= WW + 60; x += 80) { top.push(x, yAt(x) - half + 3 * Math.sin(x * 0.013)); bot.push(x, yAt(x) + half + 3 * Math.sin(x * 0.011 + 1)); }
        const ring = top.slice();
        for (let i = bot.length - 2; i >= 0; i -= 2) ring.push(bot[i], bot[i + 1]);
        paper(E, ring, 4);
        for (let i = 0; i < 9; i++) { const x = 90 + i * 215 + 40 * rnd(i, 2), y = yAt(x) + half * (rnd(i, 3) - 0.5); line(E, x, y, x + 50, y + 50 * uy / ux, 2); }
        // a twig with two leaves
        for (const [x, s] of [[300, -1], [1500, 1]]) {
          const y = yAt(x) - half * 0.8, tx = x + 90 * s, ty = y - 120;
          poly(E, [x, y, x + 40 * s, y - 70, tx, ty], 3);
          leaf(E, tx + 40 * s, ty - 14, -30 * s + 6 * Math.sin(TAU * 0.5 * t + x), 48, false);
          leaf(E, x + 80 * s, y - 80, 40 * s, 36, true);
        }
        E.back = false;
        // the moth flutters on ahead of it, and loops over it while it freezes
        const [hx, hy] = at(sc, P, 0.24, 0.35);
        const b = beat(t, PASS);
        let mx = Math.max(hx, -400) + 380 + 60 * Math.sin(TAU * 0.9 * t), my = hy - 160 + 70 * Math.sin(TAU * 1.3 * t + 1);
        if (b.name === 'freeze') { mx = hx + 150 + 160 * Math.cos(TAU * b.k * 0.9); my = hy - 260 + 70 * Math.sin(TAU * b.k * 0.9); }
        moth(E, mx, my, Math.abs(Math.sin(TAU * 7 * t)), 10 * Math.sin(TAU * 1.3 * t), 62);
        return;
      }
      const b = beat(t, OUT);
      // the moth: flutters in, lands just under its nose, rests with slowly breathing wings; gone at the grab
      const grabT = beatStart(OUT, 'grab'), landT = beatStart(OUT, 'freeze');
      const Qg = poseAt(grabT + 0.001), [px, py] = at(sc, Qg, 0.33, 0.73);
      if (t < grabT) {
        const k = clamp((t - beatStart(OUT, 'moth') + 0.9) / 1.6, 0, 1);
        if (k > 0) {
          const land = ease(k), sx = px - 520, sy = py - 380;
          const mx = lerp(sx, px, land) + 50 * Math.sin(TAU * 1.7 * t) * (1 - land), my = lerp(sy, py - 18, land) + 40 * Math.sin(TAU * 2.3 * t) * (1 - land);
          const flap = t < landT ? Math.abs(Math.sin(TAU * 7 * t)) * (1 - 0.7 * land * land) : 0.25 + 0.2 * hump(frac((t - landT) / 1.4));
          moth(E, mx, my, flap, -10 + 20 * (1 - land), 40);
        }
      } else if (t < grabT + 0.5) {
        puff(E, px - 10, py - 30, 40, t - grabT, 0.5, -30, 0.6);   // a puff of wing scales
      }
      // startled: shock ticks over the head; licking the inside of the elbow twice
      if (b.name === 'startle' || (b.name === 'hold' && b.t < 0.3)) {
        const [hx, hy] = at(sc, P, 0.3, 0.15), k = b.name === 'startle' ? b.k : 1;
        for (let i = -1; i <= 1; i++) { const a = (-90 + 32 * i) * Math.PI / 180; line(E, hx + Math.cos(a) * 60, hy + Math.sin(a) * 60, hx + Math.cos(a) * (60 + 50 * k), hy + Math.sin(a) * (60 + 50 * k), 4); }
      }
      // the far arm comes up from behind the shoulders and over the head (drawn behind the animal)
      if (V.raise > 0) {
        E.back = true;
        const r = clamp(V.raise, 0, 1), pts = [];
        const A = [0.47, 0.42], C = [0.44, -0.1], H = [0.26, 0.03];
        for (let i = 0; i <= 10; i++) {
          const k = r * i / 10;
          const u = (1 - k) ** 2 * A[0] + 2 * k * (1 - k) * C[0] + k * k * H[0], v = (1 - k) ** 2 * A[1] + 2 * k * (1 - k) * C[1] + k * k * H[1];
          pts.push([u, v]);
        }
        limbFx(E, sc, P, pts, 0.06, true);
        E.back = false;
      }
      if (b.name === 'hold') {
        for (const t0 of [0.35, 0.95]) {
          const a = b.t - t0;
          if (a < 0 || a > 0.35) continue;
          const [ex, ey] = at(sc, P, 0.36, 0.5);
          arc(E, ex - 6, ey - 10, 26 + 8 * hump(a / 0.35), 200, 60, 3); arc(E, ex - 6, ey - 10, 40 + 10 * hump(a / 0.35), 205, 50, 3);
        }
      }
    },
  };
})();

// ===== Binturong ====================================================================================================
// A slow, stiff, bear-like climber whose prehensile tail is a fifth limb: it grips, the legs take two stiff steps, the
// tail lets go and slides up, and grips again. A gland under the tail smells of buttered popcorn, so popcorn puffs rise
// wherever the tail drags. It can hang from its hind feet and tail to reach fruit.
(function () {
  const BODY = [0.03, 0.08, 0.93, 0.92];
  const BR = [[0.06, 0.615], [0.94, 0.565]];               // the branch's centre line
  const TAILBASE = [0.72, 0.3], GRIP = [0.86, 0.6], HANGPIVOT = [0.86, 0.58], HANG = 42, SHOULDER = [0.31, 0.42], NECK = [0.24, 0.32];
  const C = 1.6;                                           // the pass's inching cycle, s
  const PASS_T = 5.0;
  const OUT = [['turn', 0.55], ['amble', 1.45], ['wrap', 0.45], ['down', 0.85], ['hang', 1.5], ['up', 0.8], ['chew', 1.6],
    ['turn2', 0.55], ['home', 1.45]];
  /** One limb's offset over its cycle c: a quick forward step in [s0, s1), then planted (drawn back slowly). */
  function step2(c, s0, s1) {
    c = frac(c);
    if (c >= s0 && c < s1) { const k = (c - s0) / (s1 - s0); return [lerp(-1, 1, ease(k)), hump(k)]; }
    const k = frac(c - s1) / (1 - (s1 - s0));
    return [lerp(1, -1, k), 0];
  }
  /** Progress inside one inching cycle: steady creep plus a surge while the legs step. */
  const inch = c => 0.4 * c + 0.6 * ease(clamp((c - 0.12) / 0.55, 0, 1));
  /** The tail over the cycle: curl (degrees round the branch) and lag (how far it trails, stretched). */
  function tailCycle(c) {
    c = frac(c);
    let curl, lag;
    if (c < 0.15) curl = 15 * ease(c / 0.15);
    else if (c < 0.6) curl = 15;
    else if (c < 0.85) curl = lerp(15, -10, ease((c - 0.6) / 0.25));
    else curl = lerp(-10, 0, ease((c - 0.85) / 0.15));
    if (c < 0.6) lag = 0.05 * ease(c / 0.6);
    else if (c < 0.85) lag = 0.05 * (1 - ease((c - 0.6) / 0.25));
    else lag = 0;
    return { curl, lag, slide: c >= 0.6 && c < 0.85 ? hump((c - 0.6) / 0.25) : 0 };
  }
  /** A puffed popcorn kernel: four paper lobes. */
  function popcorn(E, x, y, s, spin) {
    for (const [dx, dy, rr] of [[0, 0, 0.6], [0.65, -0.25, 0.5], [-0.6, -0.3, 0.5], [0.05, -0.75, 0.48]]) {
      const a = spin, cx = x + s * (dx * Math.cos(a) - dy * Math.sin(a)), cy = y + s * (dx * Math.sin(a) + dy * Math.cos(a)), pts = [];
      for (let i = 0; i < 10; i++) pts.push(cx + Math.cos(i * TAU / 10) * rr * s, cy + Math.sin(i * TAU / 10) * rr * s);
      paper(E, pts, 3);
    }
  }
  /** A popcorn puff born at (x, y), age s old: pops, rises and wobbles with a curl of scent, then shrinks away. */
  function popPuff(E, x, y, age, life, size, seed) {
    const k = clamp(age / life, 0, 1);
    const px = x + 22 * Math.sin(age * 4 + seed) + 30 * (rnd(seed, 1) - 0.5) * k, py = y - 140 * k - 14 * hump(k * 3);
    const s = size * (k < 0.12 ? 0.5 + 0.5 * ease(k / 0.12) : 1) * (1 - S(0.7, 1, k));
    if (s > 2) popcorn(E, px, py, s, seed + age * 0.8);
    if (k < 0.15) for (let i = 0; i < 3; i++) { const a = (-120 + 60 * i) * Math.PI / 180, r0 = size * 1.1, r1 = r0 + size * 0.8 * ease(k / 0.15); line(E, px + Math.cos(a) * r0, py + Math.sin(a) * r0, px + Math.cos(a) * r1, py + Math.sin(a) * r1, 3); }
    if (k > 0.2 && k < 0.85) { const sx = px + size * 0.4, sy = py - size * 1.4; poly(E, [sx, sy, sx + 8, sy - 12, sx, sy - 24, sx + 8, sy - 36], 3); }
  }

  M['binturong'] = {
    facing: 'L', size: [1.0, 0.95], props: [0],
    pass: { dur: PASS_T, path(t, P, sc) {
      const v = P.v; hideProp(P); P.m = 1; v.b = 'inch';
      const c = t / C, N = Math.floor(PASS_T / C) + inch(frac(PASS_T / C));
      const p = (Math.floor(c) + inch(frac(c))) / N;
      v.c = c; v.walk = 1;
      const d0 = -1890, d1 = 1860;
      const Q = { x: 0, y: 0, scale: 1, sx: 1, sy: 1, angle: 0, mirror: true };
      const [ax, ay] = Ink.pointOf(sc, Q, ...BR[0]), [bx, by] = Ink.pointOf(sc, Q, ...BR[1]);
      const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, dir = ux > 0 ? 1 : -1;
      const d = lerp(d0, d1, p);
      // body bobs with each stiff step
      const bob = 0.018 * sc.sh * (step2(c, 0.15, 0.375)[1] + step2(c, 0.375, 0.6)[1]);
      pinF(sc, P, 'L', 0.5, 0.59, WW / 2 + d * ux * dir, 800 + d * uy * dir - bob, 0);
      if (offScreen(sc, P, 'L', ...BODY)) P.hidden = true;
    } },
    outing: { dur: total(OUT), path(t, P, sc) {
      const b = beat(t, OUT), v = P.v; stay(P, sc); v.b = b.name;
      const far = 260, mid = sc.hx + far;
      v.walk = 0; v.c = 0; v.curl = 0; v.hang = 0; v.reach = 0; v.fig = 0; v.nod = 0;
      P.m = -1;
      if (b.name === 'turn' || b.name === 'turn2') {   // turns round on the branch: the drawing squashes edge-on
        const k = ease(b.k), back = b.name === 'turn2';
        const tw = Math.cos(Math.PI * k);
        P.m = (tw >= 0) !== back ? -1 : 1; P.sx = Math.max(0.08, Math.abs(tw));
        P.x = back ? mid : sc.hx; P.y = sc.hy - 10 * hump(b.k);
        v.curl = 8 * hump(b.k);
      } else if (b.name === 'amble' || b.name === 'home') {
        const out = b.name === 'amble', k = b.k;
        const p = (Math.floor(k * 2) + inch(frac(k * 2))) / 2;   // two inching cycles
        P.m = out ? 1 : -1; v.walk = S(0, 0.12, k) * S(1, 0.88, k); v.c = k * 2;
        P.x = out ? lerp(sc.hx, mid, p) : lerp(mid, sc.hx, p);
        if (k >= 1) P.x = out ? mid : sc.hx;
        P.y = sc.hy - 0.018 * sc.sh * (step2(v.c, 0.15, 0.375)[1] + step2(v.c, 0.375, 0.6)[1]);
      } else {
        P.m = 1; P.x = mid; P.y = sc.hy;
        let hang = 0;
        if (b.name === 'wrap') { v.curl = 18 * ease(b.k); hang = -0.08 * hump(b.k); }
        if (b.name === 'down') { v.curl = 18 * (1 - ease(b.k)); const k = b.k; hang = k < 0.75 ? ease(k / 0.75) * 1.1 : 1.1 - 0.1 * ease((k - 0.75) / 0.25); }
        if (b.name === 'hang') { v.curl = 0; hang = 1 + 0.05 * Math.sin(TAU * b.t / 1.1) * hump(b.k); v.reach = hump(clamp((b.k - 0.15) / 0.55, 0, 1)); v.fig = S(0.4, 0.45, b.k); }
        if (b.name === 'up') { v.curl = 0; const k = b.k; hang = k < 0.8 ? 1 - ease(k / 0.8) * 1.06 : -0.06 * (1 - ease((k - 0.8) / 0.2)); v.fig = 1; v.reach = 0.5 * hump(b.k); }
        if (b.name === 'chew') { v.fig = 1; v.nod = b.t; }
        v.hang = hang;
        if (hang) { const [fx, fy] = atF(sc, P, 'L', ...HANGPIVOT); pinF(sc, P, 'L', ...HANGPIVOT, fx, fy, HANG * hang); }
      }
    } },
    bend(u, v, t, P, o, r) {
      const V = P.v, c = V.c || 0, walk = V.walk || 0;
      // the tail: curls round the branch, trails and stretches as the body moves on, lets go and slides up
      const tc0 = walk ? tailCycle(c) : { curl: 0, lag: 0, slide: 0 }, tc = { curl: tc0.curl * walk, lag: tc0.lag * walk, slide: tc0.slide * walk };
      const tail = Math.max(S(0.68, 0.74, u) * S(0.18, 0.26, v), box(u, v, 0.64, 0.66, 0.9, 0.95, 0.03));
      const low = tail * S(0.5, 0.62, v);
      scl(o, u, v, TAILBASE[0], TAILBASE[1], 1 + tc.lag, 1, tail);
      rot(o, u, v, GRIP[0], 0.56, tc.curl + (V.curl || 0), low, r);
      o[1] -= 0.03 * tc.slide * low;
      // hanging: the tail keeps its hold on the branch while the body swings down
      if (V.hang) rot(o, u, v, ...HANGPIVOT, 0.8 * HANG * V.hang, box(u, v, 0.62, 0.6, 0.96, 0.98, 0.03) * S(0.58, 0.66, v), r);
      // two stiff steps a cycle: front legs, then hind legs, each moved as a block
      if (walk) {
        const f = step2(c, 0.15, 0.375), h = step2(c, 0.375, 0.6);
        const fl = box(u, v, 0.25, 0.44, 0.37, 0.64, 0.025) * S(0.42, 0.5, v), hl = box(u, v, 0.58, 0.44, 0.72, 0.64, 0.025) * S(0.42, 0.5, v);
        shift(o, -0.035 * f[0] * walk, -0.03 * f[1] * walk, fl); shift(o, -0.035 * h[0] * walk, -0.03 * h[1] * walk, hl);
      }
      // the forelegs reach down for the fig, then bring it to the mouth
      const fore = box(u, v, 0.24, 0.42, 0.38, 0.64, 0.025) * S(0.42, 0.5, v);
      rot(o, u, v, SHOULDER[0], SHOULDER[1], 40 * (V.reach || 0) + 55 * (V.nod > 0 ? 1 : 0) * S(0, 0.3, V.nod) * (1 - S(1.25, 1.6, V.nod)), fore, r);
      // head: low and swinging as it walks, nods slowly as it chews
      const head = S(0.27, 0.2, u) * S(0.5, 0.42, v);
      const nod = V.nod > 0 ? 7 * Math.max(0, Math.sin(TAU * V.nod / 0.55)) * (1 - S(1.4, 1.6, V.nod)) : 0;
      rot(o, u, v, NECK[0], NECK[1], -nod + 3 * Math.sin(TAU * 0.6 * t) * walk + 10 * (V.reach || 0), head, r);
      // the ears twitch now and then
      rot(o, u, v, 0.2, 0.2, 10 * Math.max(0, Math.sin(TAU * 0.45 * t)) ** 8, box(u, v, 0.16, 0.06, 0.24, 0.2, 0.02), r);
      // breathing
      scl(o, u, v, 0.45, 0.42, 1, 1 + 0.01 * Math.sin(TAU * 0.4 * t), box(u, v, 0.25, 0.15, 0.7, 0.45, 0.05));
    },
    fx(t, P, sc, E, mode, poseAt) {
      const V = P.v;
      if (mode === 'pass') {
        // the branch, across the screen
        const Q = poseAt(0), [ax, ay] = at(sc, Q, ...BR[0]), [bx, by] = at(sc, Q, ...BR[1]), half = 0.028 * sc.sh;
        const yAt = x => ay + (x - ax) * (by - ay) / (bx - ax);
        E.back = true;
        const top = [], bot = [];
        for (let x = -60; x <= WW + 60; x += 80) { top.push(x, yAt(x) - half + 3 * Math.sin(x * 0.017)); bot.push(x, yAt(x) + half + 3 * Math.sin(x * 0.012 + 2)); }
        for (let i = bot.length - 2; i >= 0; i -= 2) top.push(bot[i], bot[i + 1]);
        paper(E, top, 4);
        for (let i = 0; i < 8; i++) { const x = 140 + i * 240 + 60 * rnd(i, 5), y = yAt(x) + half * 0.3 * (rnd(i, 6) - 0.5); line(E, x, y, x + 46, y + 3, 2); }
        E.back = false;
        // popcorn puffs where the tail slides along the branch (they stay where they were made)
        emit(t, 0.12, 1.5, (i, te, age) => {
          const c = te / C, tc = tailCycle(c);
          if (tc.slide < 0.25) return;
          const Qe = poseAt(te), [gx, gy] = at(sc, Qe, GRIP[0] - 0.04, 0.57);
          popPuff(E, gx, gy - 30, age, 1.5, 40, i);
        });
        return;
      }
      const b = beat(t, OUT);
      // the fig hangs on a twig from the canopy above until it is picked; then it is in its paws, then eaten
      const tFig = beatStart(OUT, 'hang') + 1.5 * 0.42, Qf = poseAt(tFig), [fx, fy] = at(sc, Qf, 0.04, 0.5);
      if (t < tFig) {
        E.back = true;
        const sway = 6 * Math.sin(TAU * 0.5 * t);
        poly(E, [WW + 30, fy - 300, fx + 420, fy - 150, fx + 160, fy - 90, fx + 40, fy - 70, fx + sway, fy - 34], 3);
        leaf(E, fx + 420, fy - 120, 70, 30, true); leaf(E, fx + 250, fy - 140, -30, 26); leaf(E, fx + 120, fy - 60, 100, 22);
        E.back = false;
        figGlyph(E, fx + sway, fy, 26);
      } else {
        const chew = b.name === 'chew' ? b.k : 0, left = 1 - 0.85 * chew;
        if (b.name !== 'turn2' && b.name !== 'home') {
          const [px, py] = at(sc, P, 0.07, 0.5);
          if (left > 0.2) figGlyph(E, px, py, 26 * Math.sqrt(left));
        }
        if (b.name === 'chew') emit(b.t, 0.55, 0.6, (i, te, age) => { const [mx, my] = at(sc, P, 0.08, 0.5); for (let j = 0; j < 3; j++) disc(E, mx - 10 + 14 * j, my + 20 + 160 * age * age + 10 * j, 4); });
      }
      // popcorn puffs along the drag line while it walks with its tail down
      if (b.name === 'amble' || b.name === 'home' || b.name === 'turn' || b.name === 'turn2') {
        const t0 = beatStart(OUT, b.name);
        emit(t, 0.3, 1.5, (i, te, age) => {
          const Qe = poseAt(te); if (!(Qe.v.walk > 0.5)) return;
          const [gx, gy] = at(sc, Qe, GRIP[0] - 0.03, 0.57);
          popPuff(E, gx, gy - 14, age, 1.5, 22, i + 3);
        }, beatStart(OUT, 'amble'));
      } else if (t < beatStart(OUT, 'amble') + 1.45 + 1.5) {
        emit(t, 0.3, 1.5, (i, te, age) => {
          const Qe = poseAt(te); if (!(Qe.v.walk > 0.5)) return;
          const [gx, gy] = at(sc, Qe, GRIP[0] - 0.03, 0.57);
          popPuff(E, gx, gy - 14, age, 1.5, 22, i + 3);
        }, beatStart(OUT, 'amble'), beatStart(OUT, 'wrap'));
      }
    },
  };
  /** A fig: a round, dotted fruit with a little neck and a dark eye at the bottom. */
  function figGlyph(E, x, y, s) {
    const pts = [];
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14, rr = s * (1 + 0.18 * Math.max(0, -Math.sin(a))); pts.push(x + Math.cos(a) * rr * 0.92, y + Math.sin(a) * rr); }
    poly(E, pts, 3, true, 3, 0.55);
    line(E, x, y - s, x + 2, y - s * 1.45, 4);
    disc(E, x, y + s * 0.8, 3);
  }
})();

// ===== Proboscis monkey =============================================================================================
// Sits in the trees by rivers; crosses them by leaping from a branch and belly-flopping in, then swims dog-paddle with
// its head up. The male's huge nose bounces as he honks.
(function () {
  const BODY = [0.3, 0.02, 0.82, 0.98], UPPER = [0.3, 0.02, 0.76, 0.36];
  const SHOULDER = [0.66, 0.28], HIP = [0.62, 0.46], TAILBASE = [0.745, 0.5], NOSE = [0.47, 0.15], CHIN = [0.53, 0.22];
  const SEAT = [0.55, 0.53];                                // where it sits on its branch
  const PASS = [['hop', 0.8], ['crouch', 0.45], ['leap', 1.25], ['flop', 0.35], ['paddle', 2.15]];
  const OUT = [['sit', 0.6], ['crouch', 0.35], ['hop', 0.75], ['land', 0.45], ['honk', 2.8], ['turn', 0.35], ['crouch2', 0.4],
    ['hop2', 0.75], ['land2', 0.5], ['turn2', 0.35], ['rest', 0.9]];
  const WY = 950;                                           // the river's surface in the pass
  const HONKS = [0.35, 0.95, 1.55];                         // into the honk beat

  /** The honk: 0..1..0 over 0.4 s after each honk, with a little bounce after it. */
  function honkAt(tt) {
    let n = 0;
    for (const h of HONKS) {
      const a = tt - h;
      if (a < -0.06) continue;
      if (a < 0.14) n = Math.max(n, ease((a + 0.06) / 0.2));
      else n = Math.max(n, Math.exp(-6 * (a - 0.14)) * Math.cos(TAU * 3 * (a - 0.14)));
    }
    return n;
  }
  /** Crouching before a hop: down, hold, and the release as it springs. */
  const crouchSq = k => (k < 0.6 ? ease(k / 0.6) : 1 - ease(clamp((k - 0.75) / 0.25, 0, 1))) * 1.1;
  /** A leap from (x0, y0) to (x1, y1) peaking `h` px above the higher end. */
  function arcAt(k, x0, y0, x1, y1, h) {
    return [lerp(x0, x1, k), lerp(y0, y1, k) - (h + Math.abs(y1 - y0) * 0.5) * 4 * k * (1 - k)];
  }

  M['proboscis-monkey'] = {
    facing: 'L', props: [1], size: [1.1, 0.88],
    pass: { dur: total(PASS), path(t, P, sc) {
      const b = beat(t, PASS), v = P.v; hideProp(P); P.m = 1; v.b = b.name;
      const sit = HH * 0.52;                     // the branch's height
      const x0 = -260, x1 = 400, xl = 1420, xe = 2240;
      const yBranch = sit - (SEAT[1] - 0.5) * sc.sh, ySwim = WY + (0.5 - 0.3) * sc.sh;
      v.swim = 0; v.squash = 0; v.fly = 0; v.reach = 0;
      if (b.name === 'hop') {          // two hops in along its branch
        const k = b.k, hop = Math.abs(Math.sin(Math.PI * k * 2));
        P.x = lerp(x0, x1, k * 0.85 + 0.15 * ease(k)); P.y = yBranch - 70 * hop;
        v.squash = 0.5 * (1 - hop) * (k > 0.02 ? 1 : 0); v.fly = 0.3 * hop;
      } else if (b.name === 'crouch') {
        P.x = x1; P.y = yBranch; v.squash = b.k < 0.6 ? lerp(0.5, 1, ease(b.k / 0.6)) : 1 - ease(clamp((b.k - 0.8) / 0.2, 0, 1));
        v.reach = 0.25 * S(0.6, 1, b.k);
      } else if (b.name === 'leap') {
        const k = b.k;
        const [x, y] = arcAt(k, x1, yBranch, xl, WY - 0.05 * sc.sh, 120);
        P.x = x; P.y = y;
        P.angle = 66 * ease(k) ** 1.3;        // tips forward, belly first
        v.sq = [1 + 0.05 * hump(k), 1 / (1 + 0.05 * hump(k)), 0.55, 0.4];
        v.fly = S(0, 0.25, k); v.reach = 0.25 + 0.75 * S(0, 0.4, k);
      } else if (b.name === 'flop') {
        const k = b.k;
        P.x = xl + 40 * ease(k); P.y = lerp(WY - 0.05 * sc.sh, ySwim, ease(k)); P.angle = 66 * (1 - ease(k));
        v.sq = [1 + 0.06 * hump(k), 1 - 0.08 * hump(k), 0.55, 0.4];
        v.reach = 1 - ease(k); v.fly = 1 - ease(k); v.swim = ease(k);
      } else {
        const k = b.k;
        P.x = lerp(xl + 40, xe, k * 0.8 + 0.2 * ease(k)); P.y = ySwim + 12 * Math.sin(TAU * 2 * b.t);
        P.angle = 4 * Math.sin(TAU * 2 * b.t); v.swim = 1; v.paddle = b.t;
      }
      v.wy = WY; v.ys = ySwim;
      if (v.squash) { const s = 0.07 * v.squash; v.sq = [1 + s * 0.6, 1 - s, SEAT[0], SEAT[1]]; }
      const box = b.name === 'paddle' || b.name === 'flop' ? UPPER : BODY;
      if (offScreen(sc, P, 'L', ...box)) P.hidden = true;
    } },
    outing: { dur: total(OUT), path(t, P, sc) {
      const b = beat(t, OUT), v = P.v; stay(P, sc); v.b = b.name;
      const bx = sc.hx - 330, by = sc.hy + 70;              // the other branch, down to the left
      v.squash = 0; v.fly = 0; v.reach = 0; v.honk = 0; v.look = 0;
      P.m = -1;
      const away = ['hop', 'land', 'honk', 'turn', 'crouch2'].includes(b.name);
      if (away) { P.x = bx; P.y = by; }
      if (b.name === 'sit') { v.look = ease(b.k); }
      else if (b.name === 'crouch' || b.name === 'crouch2') { v.squash = crouchSq(b.k); v.look = b.name === 'crouch' ? 1 : ease(b.k); if (b.name === 'crouch2') P.m = 1; }
      else if (b.name === 'hop' || b.name === 'hop2') {
        const back = b.name === 'hop2', k = b.k;
        const [x, y] = back ? arcAt(k, bx, by, sc.hx, sc.hy, 40) : arcAt(k, sc.hx, sc.hy, bx, by, 40);
        P.x = x; P.y = y; P.m = back ? 1 : -1;
        P.angle = (back ? 1 : -1) * 16 * Math.sin(Math.PI * k);
        v.sq = [1 + 0.05 * hump(k), 1 / (1 + 0.05 * hump(k)), 0.55, 0.4]; v.fly = hump(k); v.reach = hump(k); v.look = 1 - ease(k);
      } else if (b.name === 'land' || b.name === 'land2') {
        if (b.name === 'land2') { P.m = 1; P.x = sc.hx; P.y = sc.hy; }
        v.squash = 1.3 * Math.exp(-4.5 * b.t) * Math.sin(TAU * 1.6 * b.t);
      } else if (b.name === 'honk') { v.honk = b.t; v.look = 1 - S(0, 0.3, b.k); }
      else if (b.name === 'turn' || b.name === 'turn2') {
        const k = ease(b.k), tw = Math.cos(Math.PI * k), back = b.name === 'turn2';
        P.m = (tw >= 0) === !back ? -1 : 1; P.sx = Math.max(0.22, Math.abs(tw));
        if (back) { P.x = sc.hx; P.y = sc.hy; }
        P.y -= 46 * hump(b.k); v.fly = 0.4 * hump(b.k);   // a little hop as it turns round
      } else if (b.name === 'rest') v.look = 0;
      // the branch it lands on dips and springs back
      const tl = beatStart(OUT, 'land2'), al = t - tl;
      if (al > 0) { const dip = 12 * Math.exp(-4 * al) * Math.sin(TAU * 2.2 * al); P.prop.y += dip; if (!away) P.y += dip; }
      // squash about the feet: the seat stays on the branch
      if (v.squash) { const s = 0.07 * v.squash; v.sq = [1 + s * 0.6, 1 - s, SEAT[0], SEAT[1]]; }
    } },
    bend(u, v, t, P, o, r) {
      const V = P.v, honk = V.honk ? honkAt(V.honk) : 0;
      if (V.sq) scl(o, u, v, V.sq[2], V.sq[3], V.sq[0], V.sq[1], 1);   // squash and stretch
      // the nose bounces out and up with each honk, the chin drops
      rot(o, u, v, NOSE[0], NOSE[1], 22 * honk + (V.swim ? 5 * Math.sin(TAU * 2 * t) : 0), box(u, v, 0.34, 0.11, 0.5, 0.33, 0.025), r);
      rot(o, u, v, CHIN[0], CHIN[1] - 0.05, -4 * honk, box(u, v, 0.48, 0.19, 0.6, 0.26, 0.02), r);
      // looking toward the other branch (head and nose together)
      rot(o, u, v, 0.58, 0.22, 6 * (V.look || 0), box(u, v, 0.33, 0.0, 0.72, 0.33, 0.03) * S(0.36, 0.3, v), r);
      // the arm reaches forward in the leap, strokes in the water
      const arm = box(u, v, 0.43, 0.24, 0.73, 0.5, 0.025);
      const stroke = V.swim ? 22 * Math.sin(TAU * 2 * (V.paddle || 0)) + 30 : 0;
      rot(o, u, v, SHOULDER[0], SHOULDER[1], 70 * (V.reach || 0) + stroke * (V.swim || 0), arm, r);
      // the legs swing down and back in the air, kick in the water
      const leg = box(u, v, 0.38, 0.4, 0.68, 0.58, 0.025) * (1 - arm);
      rot(o, u, v, HIP[0], HIP[1], -28 * (V.fly || 0) + (V.swim ? 12 * Math.sin(TAU * 2 * (V.paddle || 0) + 2) : 0), leg, r);
      // the tail: a slow sway, streaming behind in the leap
      const tail = box(u, v, 0.68, 0.48, 0.82, 1.0, 0.025) * S(0.5, 0.56, v);
      rot(o, u, v, TAILBASE[0], TAILBASE[1], 4 * Math.sin(TAU * t / 2) - 32 * (V.fly || 0), tail, r);
      wave(o, v, t, 0.012 * (1 + 2 * (V.fly || 0)), 1.3, 1.1, tail * S(0.6, 0.9, v), 0);
      // breathing
      scl(o, u, v, 0.57, 0.45, 1 + 0.012 * Math.sin(TAU * 0.4 * t), 1, box(u, v, 0.42, 0.2, 0.72, 0.52, 0.04));
    },
    fx(t, P, sc, E, mode, poseAt) {
      const V = P.v;
      if (mode === 'pass') {
        const b = beat(t, PASS), tf = beatStart(PASS, 'flop');
        // its branch, reaching in from the left
        const yb = HH * 0.52;
        E.back = true;
        paper(E, [-60, yb - 18, 300, yb - 14, 560, yb - 8, 600, yb + 4, 560, yb + 14, 300, yb + 22, -60, yb + 26], 4);
        poly(E, [440, yb - 10, 520, yb - 80, 560, yb - 110], 3); leaf(E, 580, yb - 120, -40, 30, true); leaf(E, 500, yb - 90, 20, 24);
        E.back = false;
        // the branch springs back after the leap
        if (t > beatStart(PASS, 'leap')) { const a = t - beatStart(PASS, 'leap'); if (a < 1) for (let i = 0; i < 2; i++) arc(E, 560, yb - 30 - 20 * i, 40 + 30 * a, 250, 40, 3); }
        // the river, in front, so only its head and shoulders show once it swims
        river(E, -20, WW + 20, WY, t, 10);
        if (t > tf) {
          const a = t - tf;
          splash(E, 1440, WY, a, 0.9, 14, 170, 3); splash(E, 1500, WY, a - 0.08, 0.8, 9, 110, 7);
          ripple(E, 1450, WY + 6, a, 1.4, 300, 0.12, 3);
        }
        if (b.name === 'paddle') {
          const [hx] = at(sc, P, 0.55, 0.2);
          emit(t, 0.5, 1.0, (i, te, age) => { const Q = poseAt(te), [x] = at(sc, Q, 0.55, 0.3); ripple(E, x, WY + 4, age, 1.0, 140, 0.15, 2); }, tf + 0.35);
          for (let i = 0; i < 3; i++) line(E, hx - 220 - 90 * i, WY + 22 + 14 * i, hx - 150 - 90 * i, WY + 22 + 14 * i, 3);
          // a splash at each stroke
          emit(t, 0.5, 0.35, (i, te, age) => { const Q = poseAt(te), [x] = at(sc, Q, 0.42, 0.3); for (let j = 0; j < 3; j++) blob(E, x + 30 * (j - 1) * (1 + age * 3), WY - 30 * hump(age / 0.35) - 10 * j, 6, 9, 0); }, tf + 0.6);
        }
        return;
      }
      const b = beat(t, OUT);
      // the other branch, up to the left
      const bx = sc.hx - 330, by = sc.hy + 70;
      const Q0 = { x: bx, y: by, scale: 1, sx: 1, sy: 1, angle: 0, mirror: false }, [lx, ly] = at(sc, Q0, 0.04, 0.55), [rx, ry] = at(sc, Q0, 0.8, 0.53);
      const al = t - beatStart(OUT, 'land'), dip = al > 0 ? 10 * Math.exp(-4 * al) * Math.sin(TAU * 2.2 * al) : 0;
      E.back = true;
      paper(E, [lx - 100, ly - 14, lx, ly - 12 + dip * 0.5, (lx + rx) / 2, (ly + ry) / 2 - 12 + dip, rx + 40, ry - 10, rx + 60, ry + 2, (lx + rx) / 2, (ly + ry) / 2 + 14 + dip, lx, ly + 16 + dip * 0.5, lx - 100, ly + 16], 4);
      leaf(E, rx + 40, ry - 40, -30, 24, true); leaf(E, lx - 20, ly - 30, 200, 22);
      E.back = false;
      // sound arcs from the nose at each honk
      if (b.name === 'honk') {
        for (let n = 0; n < HONKS.length; n++) {
          const a = b.t - HONKS[n];
          if (a < 0 || a > 0.8) continue;
          const [nx, ny] = at(sc, P, 0.37, 0.27);
          for (let j = 0; j < 3; j++) { const rr = 30 + 60 * j + 220 * a; if (a * 3 - j * 0.3 < 2.2) arc(E, nx + 10, ny - 10, rr, 140, 80, 5 - j); }
        }
      }
    },
  };
})();

// ===== Buffy fish owl ===============================================================================================
// Hunts from a perch at the water's edge and swoops on fish without plunging. Its eyes are fixed in their sockets, so it
// turns and bobs the whole head to follow things and to judge distance. Its wings are not silent like other owls'.
(function () {
  const EYES = [[0.425, 0.252], [0.567, 0.252]], EYE_R = 0.058;        // eye centres and radius (in u)
  const NECK = [0.5, 0.36], LSH = [0.335, 0.3], RSH = [0.665, 0.3], BRANCH_L = [0.05, 0.91], FEET = [0.5, 0.9];
  const PASS_T = 4.5;
  const OUT = [['bob', 1.5], ['lean', 0.45], ['launch', 0.5], ['swoop', 1.45], ['strike', 0.45], ['climb', 1.75], ['land', 0.75],
    ['gulp', 1.0], ['settle', 0.95]];
  const snap = (k, k0) => S(k0, k0 + 0.026, k);         // an owl head turn: quick (0.12 s), then held

  /** The pass's head: three snaps following you (+15, 0, -15 degrees), a slow blink, then a sideways bob. */
  function passHead(t) {
    const k = t / PASS_T;
    const tilt = 15 * (snap(k, 0.2) - snap(k, 0.45) - snap(k, 0.7));
    const blink = hump(clamp((k - 0.5) / 0.12, 0, 1)) ** 0.7;
    const bob = k > 0.8 ? Math.sin(TAU * (k - 0.8) / 0.2) * hump((k - 0.8) / 0.2) : 0;
    return { tilt, blink, bob, look: tilt / 15 };
  }

  M['buffy-fish-owl'] = {
    facing: 'F', props: [0], size: [1.0, 0.92],
    pass: { dur: PASS_T, path(t, P, sc) {
      // the owl does not fly: you pass it. It slides at a camera's steady speed; its branch sways about its left end
      const v = P.v; P.m = 1; P.prop = null; v.b = 'pan';
      const x0 = -sc.sw * 0.5 - 40, x1 = WW + sc.sw * 0.5 + 40;
      P.x = lerp(x0, x1, t / PASS_T); P.y = HH * 0.5 + 10;
      const [lx, ly] = at(sc, P, ...BRANCH_L);
      Ink.pin(sc, P, ...BRANCH_L, lx, ly, 2 * Math.sin(TAU * t / 1.7));
      Object.assign(v, passHead(t));
    } },
    outing: { dur: total(OUT), path(t, P, sc) {
      const b = beat(t, OUT), v = P.v; v.b = b.name; P.m = 1;
      v.tilt = 0; v.bob = 0; v.blink = 0; v.wing = 0; v.flap = 0; v.legs = 0; v.lean = 0; v.down = 0; v.look = 0;
      const sx = sc.hx + 480, syW = 935;                    // where it strikes, and the river's surface
      const strikeY = syW - (0.92 + 0.07 - 0.5) * sc.sh * 0.8;
      let away = false;
      if (b.name === 'bob') {            // two parallax bobs, looking down at the water
        const k = b.k;
        v.bob = Math.sin(TAU * 2 * k) * hump(k); v.down = ease(k * 3) ; v.tilt = 6 * Math.sin(TAU * k);
        v.blink = hump(clamp((k - 0.62) / 0.12, 0, 1));
      } else if (b.name === 'lean') { v.lean = ease(b.k); v.down = 1; v.wing = 0.15 * ease(b.k); }
      else {
        away = true;
        // the flight: up and out, a long low glide down to the water, the strike, a laboured climb home
        const path = [[sc.hx, sc.hy, 1], [sc.hx + 160, sc.hy - 50, 0.95], [sx - 120, strikeY - 40, 0.84], [sx, strikeY, 0.8],
          [sx - 60, sc.hy - 40, 0.86], [sc.hx + 70, sc.hy - 30, 0.97], [sc.hx, sc.hy, 1]];
        const seg = { launch: [0, 1], swoop: [1, 2], strike: [2, 3], climb: [3, 5], land: [5, 6] }[b.name];
        if (seg) {
          const n = seg[1] - seg[0], q = b.name === 'climb' ? b.k : ease(b.k), f = seg[0] + q * n, i = Math.min(Math.floor(f), 5), k = f - i;
          const A = path[i], B = path[i + 1];
          P.x = lerp(A[0], B[0], k); P.y = lerp(A[1], B[1], k); P.scale = lerp(A[2], B[2], k);
          if (b.name === 'climb') { P.y += 22 * Math.sin(TAU * 2 * b.t); }    // each heavy beat lifts it
        } else { P.x = sc.hx; P.y = sc.hy; }
        if (b.name === 'launch') { const e = ease(b.k / 0.3); v.wing = 0.15 + 0.85 * ease(b.k * 2); v.flap = b.t; v.lean = 1 - ease(b.k); v.down = 1 - ease(b.k); P.angle = 8 * hump(b.k); v.sq = [1 + 0.03 * (1 - e), 1 - 0.06 * (1 - e), 0.5, 0.9]; }
        if (b.name === 'swoop') { v.wing = 1; v.flap = 0; P.angle = 10 * hump(b.k) + 4; v.legs = S(0.6, 1, b.k) * 0.6; v.down = 1; }
        if (b.name === 'strike') { v.wing = 1; v.legs = 0.6 + 0.4 * hump(b.k); P.angle = 4 * (1 - b.k); v.down = 1; v.fish = b.k > 0.4 ? 1 : 0; }
        if (b.name === 'climb') { v.wing = 1; v.flap = b.t; v.legs = 0.6 - 0.2 * ease(b.k * 3); P.angle = lerp(0, -6, ease(b.k * 3)); v.down = 1 - ease(b.k * 3); v.fish = 1; }
        if (b.name === 'land') { v.wing = 1 - S(0.55, 1, b.k); v.flap = 0; v.brake = hump(b.k); P.angle = -6 * (1 - ease(b.k)); v.fish = 1; v.legs = 0.4 * (1 - ease(b.k)); }
        if (b.name === 'gulp') { v.fish = 1; v.gulp = b.k; v.down = -0.6 * hump(b.k); v.tilt = -8 * hump(b.k); away = false; P.x = sc.hx; P.y = sc.hy; P.scale = 1; }
        if (b.name === 'settle') { away = false; P.x = sc.hx; P.y = sc.hy; v.blink = hump(clamp((b.k - 0.3) / 0.25, 0, 1)); v.tilt = 4 * Math.sin(Math.PI * b.k); }
      }
      // the branch: springs up as it leaves, dips under it when it lands (3 degrees), and settles
      const tl = beatStart(OUT, 'launch'), tland = beatStart(OUT, 'land') + 0.75 * 0.7;
      let bend = 0;
      if (t > tl && t < tland) bend = -1.5 * Math.exp(-4 * (t - tl)) * Math.sin(TAU * 2 * (t - tl));
      if (t >= tland) bend = 3 * Math.exp(-3.2 * (t - tland)) * Math.cos(TAU * 1.6 * (t - tland)) * (1 - S(total(OUT) - 0.5, total(OUT), t));
      stay(P, sc);
      const home = { x: sc.hx, y: sc.hy, scale: 1, sx: 1, sy: 1, angle: 0, mirror: false };
      const [lx, ly] = at(sc, home, ...BRANCH_L);
      Ink.pin(sc, P.prop, ...BRANCH_L, lx, ly, bend);
      const ride = !away ? 1 : b.name === 'land' ? S(0.62, 0.75, b.k) : 0;
      if (ride) {   // it sits on the branch, so it rides it
        const [fx, fy] = at(sc, P.prop, ...FEET), [hx, hy] = at(sc, home, ...FEET);
        P.x += (fx - hx) * ride; P.y += (fy - hy) * ride;
        if (b.name === 'lean') v.sq = [1 + 0.03 * v.lean, 1 - 0.06 * v.lean, 0.5, 0.9];
      }
      v.sx0 = sx; v.wy = syW;
    } },
    bend(u, v, t, P, o, r) {
      const V = P.v;
      if (V.sq) scl(o, u, v, V.sq[2], V.sq[3], V.sq[0], V.sq[1], 1);   // squash and stretch
      // the head: tilts to follow, bobs sideways and up and down to judge distance (the eyes cannot move)
      const head = box(u, v, 0.2, 0.0, 0.8, 0.36, 0.04) * S(0.42, 0.33, v);
      rot(o, u, v, NECK[0], NECK[1], V.tilt || 0, head, r);
      shift(o, 0.04 * (V.bob || 0), 0.025 * (V.down || 0) - 0.015 * Math.abs(V.bob || 0), head);
      // the face turns a little further than the head (a turn, seen from the front)
      shift(o, -0.018 * (V.look || 0), 0, box(u, v, 0.34, 0.15, 0.66, 0.37, 0.03));
      // ear tufts ruffle in the air
      const ruff = Math.sin(TAU * 1.7 * t) * 0.5 + Math.sin(TAU * 4.3 * t + 1) * 0.5;
      rot(o, u, v, 0.33, 0.12, 6 * ruff + 10 * (V.wing || 0), box(u, v, 0.22, 0.0, 0.36, 0.13, 0.02), r);
      rot(o, u, v, 0.67, 0.12, -6 * ruff - 10 * (V.wing || 0), box(u, v, 0.64, 0.0, 0.78, 0.13, 0.02), r);
      // wings: the side bands swing out from the shoulders: held out in a glide, beating slow and heavy when flapping
      const W = V.wing || 0;
      if (W) {
        const beatA = V.flap ? Math.sin(TAU * 2 * V.flap) : 0;
        const deg = W * (7 + 5 * beatA) + 4 * (V.brake || 0);
        const lw = box(u, v, 0.18, 0.28, 0.4, 0.88, 0.04) * S(0.42, 0.35, u), rw = box(u, v, 0.6, 0.28, 0.82, 0.88, 0.04) * S(0.58, 0.65, u);
        rot(o, u, v, ...LSH, deg, lw, r); rot(o, u, v, ...RSH, -deg, rw, r);
        o[1] -= 0.02 * W * beatA * (lw + rw);
      }
      // feet: thrust down and forward for the strike, and kept low while carrying
      shift(o, 0, 0.07 * (V.legs || 0), box(u, v, 0.36, 0.8, 0.64, 1.0, 0.03) * S(0.8, 0.87, v));
      // breathing
      scl(o, u, v, 0.5, 0.6, 1 + 0.01 * Math.sin(TAU * 0.35 * t), 1, box(u, v, 0.28, 0.4, 0.72, 0.85, 0.05));
    },
    fx(t, P, sc, E, mode, poseAt) {
      const V = P.v, mo = M['buffy-fish-owl'];
      // the open wings: broad, barred, fingered, behind the body; beating slow and heavy, held out to glide
      if (V.wing > 0.02) {
        E.back = true;
        const beatA = V.flap ? Math.sin(TAU * 2 * V.flap) : 0;
        const phi = -8 + 36 * beatA * (V.flap ? 1 : 0) - 26 * (V.brake || 0), span = 0.66 * sc.sw * P.scale * V.wing * (1 - 0.12 * Math.max(0, -beatA));
        for (const side of [-1, 1]) {
          const [rx, ry] = bentAt(mo, sc, P, side < 0 ? 0.36 : 0.64, 0.36, t);
          owlWing(E, rx, ry, side, span, phi * side + P.angle);
        }
        E.back = false;
      }
      // eyelids for the slow blink: feathered lids that close down over the fixed eyes
      if (V.blink > 0.02) {
        for (const [eu, ev] of EYES) {
          const [cx, cy] = bentAt(mo, sc, P, eu, ev, t), [ex] = bentAt(mo, sc, P, eu + EYE_R, ev, t), R = Math.abs(ex - cx) * 1.08;
          const yl = cy - R + 2 * R * V.blink * 0.92, pts = [];
          for (let i = 0; i <= 24; i++) { const a = Math.PI + Math.PI * i / 24, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a); pts.push(x, Math.min(y, yl)); }
          for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a); if (y < yl) pts.push(x, y); }
          paper(E, pts, 0); poly(E, pts, 3, true, 3, 0.5);
          const hw = Math.sqrt(Math.max(0, R * R - (yl - cy) ** 2));
          line(E, cx - hw, yl, cx + hw, yl, 5);
        }
      }
      if (mode === 'pass') {
        // depth: far leaves drift slowly behind, three big leaves sweep across in front, faster (you are moving)
        const vx = (WW + sc.sw + 40) / PASS_T;
        E.back = true;
        for (let i = 0; i < 6; i++) { const x = -200 + frac(i * 0.37 + t * vx * 0.45 / 2400) * 2400, y = 120 + 140 * i % 800; leaf(E, x, y + 20 * Math.sin(t + i), 30 + 40 * i, 22, i % 2 === 0); }
        E.back = false;
        for (let i = 0; i < 3; i++) {
          const x = -600 - 900 * i + t * vx * 1.8 + 400, y = [300, 820, 560][i], s = [260, 330, 220][i], a = [-25, 15, -50][i];
          bigLeaf(E, x, y, s, a + 6 * Math.sin(TAU * 0.6 * t + i));
        }
        return;
      }
      const b = beat(t, OUT), wy = V.wy, sx = V.sx0;
      // the river at the foot of the perch, with a fish showing under the surface until it is caught
      river(E, -20, WW + 20, wy, t, 8);
      const tS = beatStart(OUT, 'strike') + 0.45 * 0.4;
      if (t < tS) {   // a fish just under the surface, turning to and fro
        const fx = sx + 150 * Math.sin(TAU * 0.25 * t), fy = wy + 52, m = Math.cos(TAU * 0.25 * t) >= 0 ? 1 : -1, w = 8 * Math.sin(TAU * 3 * t);
        oval(E, fx, fy, 44, 16, 0, 3);
        poly(E, [fx - m * 40, fy, fx - m * 74, fy - 18 + w, fx - m * 74, fy + 18 + w], 3, true);
        disc(E, fx + m * 26, fy - 3, 4);
      }
      // ripples under the glide
      if (b.name === 'swoop' || b.name === 'strike') {
        emit(t, 0.35, 1.2, (i, te, age) => { const Q = poseAt(te), [x] = at(sc, Q, 0.5, 0.9); ripple(E, x, wy + 6, age, 1.2, 160, 0.14, 2); }, beatStart(OUT, 'swoop') + 0.6);
      }
      if (t > tS && t < tS + 1.2) { splash(E, sx, wy, t - tS, 0.9, 10, 110, 4); ripple(E, sx, wy + 6, t - tS, 1.2, 240, 0.13, 3); }
      // whoosh: its wingbeats are heard (fish owls are not silent fliers)
      if (V.flap && V.wing > 0.5 && Math.sin(TAU * 2 * V.flap) < -0.6) {
        for (const s of [-1, 1]) { const [wx, wy2] = at(sc, P, s < 0 ? 0.12 : 0.88, 0.62); arc(E, wx + s * 20, wy2, 60, s < 0 ? 150 : -30, 60, 4); arc(E, wx + s * 40, wy2, 90, s < 0 ? 155 : -35, 50, 3); }
      }
      // the fish in its talons, flapping, then swallowed head first
      if (V.fish) {
        const g = V.gulp || 0;
        const [tx, ty] = bentAt(mo, sc, P, 0.5, 0.97, t), [bx, by] = bentAt(mo, sc, P, 0.5, 0.33, t);
        const lift = ease(g * 2.2), x = lerp(tx, bx, lift), y = lerp(ty + 34, by + 40 * lift, lift), s = 58 * P.scale * (1 - S(0.45, 0.85, g));
        if (s > 3) {
          const w = Math.sin(TAU * 4 * t) * (1 - g);
          fishGlyph(E, x, y, s, lerp(8 + 10 * w, -80, ease(g * 2.2)), w);
          if (b.name === 'climb') for (let i = 0; i < 2; i++) { const a = frac(t * 1.5 + i * 0.5); disc(E, x + 20 * (i - 0.5), y + 20 + 160 * a, 6 * (1 - a)); }
        }
      }
    },
  };
  /** A fish, side on: paper body with dotted back, a forked tail that flicks (w), an eye. Head to the right. */
  function fishGlyph(E, x, y, s, deg, w) {
    const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), P2 = (dx, dy) => [x + dx * ca - dy * sa, y + dx * sa + dy * ca];
    const body = [];
    for (let i = 0; i <= 16; i++) { const k = i / 16 * TAU; body.push(...P2(s * Math.cos(k), s * 0.36 * Math.sin(k) * (Math.cos(k) > 0 ? 1 : 0.8))); }
    paper(E, body, 4);
    const back = [];
    for (let i = 0; i <= 8; i++) { const k = Math.PI + i / 8 * Math.PI; back.push(...P2(s * 0.9 * Math.cos(k), s * 0.3 * Math.sin(k))); }
    poly(E, back.concat(P2(s * 0.9, 0), P2(-s * 0.9, 0)), 0, true, 3, 0.6);
    paper(E, [...P2(-s * 0.9, 0), ...P2(-s * 1.55, -s * 0.42 + w * s * 0.2), ...P2(-s * 1.35, w * s * 0.1), ...P2(-s * 1.55, s * 0.42 + w * s * 0.2)], 4);
    disc(E, ...P2(s * 0.62, -s * 0.06), Math.max(2, s * 0.07));
    line(E, ...P2(s * 0.45, -s * 0.28), ...P2(s * 0.42, s * 0.25), 3);
  }
  /** An owl's open wing, front view: root at (x, y), going out to `side`, span px, turned deg (minus lifts it). */
  function owlWing(E, x, y, side, span, deg) {
    const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const P2 = (px, py) => { const X = side * px * span, Y = py * span; return [x + X * ca - Y * sa, y + X * sa + Y * ca]; };
    const shape = [[0, -0.16], [0.25, -0.22], [0.55, -0.2], [0.82, -0.13], [1.0, -0.02], [0.97, 0.06], [0.88, 0.03], [0.9, 0.14], [0.78, 0.1],
      [0.79, 0.21], [0.67, 0.15], [0.66, 0.27], [0.55, 0.2], [0.5, 0.31], [0.38, 0.26], [0.3, 0.33], [0.18, 0.27], [0.08, 0.31], [0, 0.22]];
    const pts = []; for (const [px, py] of shape) pts.push(...P2(px, py));
    paper(E, pts, 0); poly(E, pts, 4, true, 3, 0.5);
    for (const k of [0.22, 0.42, 0.62, 0.8]) { const lead = -0.21 + 0.16 * k * k, trail = 0.3 - 0.2 * k; line(E, ...P2(k, lead * 0.7), ...P2(k + 0.05, trail * 0.8), 7); }
  }
  /** A big leaf close to the camera: paper with an ink edge, a midrib and veins. */
  function bigLeaf(E, x, y, s, deg) {
    const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), P2 = (dx, dy) => [x + dx * ca - dy * sa, y + dx * sa + dy * ca];
    const pts = [];
    for (let i = 0; i <= 20; i++) { const k = i / 20, w = Math.sin(Math.PI * k) ** 0.8 * 0.38 * s; pts.push(...P2(-s + 2 * s * k, -w)); }
    for (let i = 20; i >= 0; i--) { const k = i / 20, w = Math.sin(Math.PI * k) ** 0.8 * 0.38 * s; pts.push(...P2(-s + 2 * s * k, w)); }
    paper(E, pts, 5);
    poly(E, pts.slice(0, 42).concat(P2(s, 0)), 0, false, 0);
    line(E, ...P2(-s * 1.25, 0), ...P2(s * 0.95, 0), 4);
    for (let i = 1; i < 6; i++) { const k = -s + 2 * s * i / 6; for (const d of [-1, 1]) line(E, ...P2(k, 0), ...P2(k + s * 0.22, d * 0.28 * s * Math.sin(Math.PI * i / 6)), 3); }
  }
})();

// ===== Sunda colugo =================================================================================================
// Cannot flap: a membrane from neck to fingers, toes and tail tip makes it a living kite. It glides far and flat (about
// 5 m forward for every metre down), can turn hard in the air, flares and lands head-up on a trunk, and climbs back up
// in lingering hops.
(function () {
  const PASS_T = 4.0, GLIDE = 101;                         // head leading, 11 degrees below level
  const OUT = [['wrap', 0.5], ['hop', 0.8], ['spin', 0.5], ['glide', 2.8], ['flare', 0.6], ['land', 0.35], ['climb', 3.0],
    ['open', 0.65]];
  const HOPS_UP = 2, HOPS_HOME = 6, HOP = 36;
  /** Membrane wrapped round the body (1) or spread (0), with the overshoot of the snap. */
  function wrapBend(o, u, v, w, r) {
    if (!w) return;
    // the outer bands fold in to 55% of the width; the body and head (u 0.38..0.62) stay
    const side = clamp((Math.abs(u - 0.5) - 0.08) / 0.42, 0, 1);
    o[0] += -(u - 0.5) * 0.45 * w * S(0, 0.3, side) * S(0.12, 0.25, v);
    o[1] += 0.03 * w * side * S(0.2, 0.5, v);
  }
  /** Hitching hops: quick up, then a hold. n hops in time T (0..1 progress k), returns 0..n. */
  const hops = (k, n) => { const f = k * n, i = Math.floor(f), q = f - i; return Math.min(n, i + ease(clamp(q / 0.32, 0, 1))); };
  /** A Catmull-Rom point on pts at s (0..pts.length - 1). */
  function spline(pts, s) {
    const n = pts.length - 1, i = clamp(Math.floor(s), 0, n - 1), k = s - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
    const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * k + (2 * a - 5 * b + 4 * c - d) * k * k + (-a + 3 * b - 3 * c + d) * k * k * k);
    return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
  }
  function loopPts(sc) {
    const x = sc.hx, y = sc.hy;
    return [[x + 120, y - 50], [x + 420, y + 10], [x + 590, y + 110], [x + 570, y + 190], [x + 340, y + 222], [x + 110, y + 218]];
  }

  M['sunda-colugo'] = {
    facing: 'U', size: [0.48, 0.56],
    pass: { dur: PASS_T, path(t, P, sc) {
      // one rigid glide, dead straight and steady: nothing moves but the membrane's trailing edge
      const v = P.v; P.m = 1; v.b = 'glide'; v.flutter = 1;
      const x0 = -410, x1 = WW + 410, k = t / PASS_T;
      P.x = lerp(x0, x1, k); P.y = 190 + (x1 - x0) * k * Math.tan(11 * Math.PI / 180);
      P.angle = GLIDE + 2 * Math.sin(TAU * t);
    } },
    outing: { dur: total(OUT), path(t, P, sc) {
      const b = beat(t, OUT), v = P.v; v.b = b.name; P.m = 1;
      v.wrap = 0; v.flutter = 0; v.open = 0;
      const top = sc.hy - HOPS_UP * HOP, low = sc.hy + HOPS_HOME * HOP, L = loopPts(sc);
      if (b.name === 'wrap') { v.wrap = ease(b.k); v.sq = [1, 1 + 0.02 * hump(b.k), 0.5, 0.5]; }
      else if (b.name === 'hop') { v.wrap = 1; P.y = sc.hy - HOP * hops(b.k, HOPS_UP); v.hop = frac(b.k * HOPS_UP); }
      else if (b.name === 'spin') {
        // pushes off and spins round in the air; the membrane snaps open as it comes round, like a carpet shaken out
        const k = b.k, e = ease(k);
        const [x1, y1] = L[0];
        P.x = lerp(sc.hx, x1, e) - 30 * hump(k); P.y = lerp(top, y1, e) - 40 * hump(k);
        P.angle = -259 * Math.pow(e, 1.15);
        v.wrap = k < 0.7 ? 1 : 1 - ease((k - 0.7) / 0.3) * 1.1;   // snaps past spread (overshoot)...
        P.scale = 1 - 0.15 * e;
        v.snap = k > 0.7 ? hump((k - 0.7) / 0.3) : 0;
      } else if (b.name === 'glide') {
        // a smooth loop: out to the right, a banked turn down and round, back toward the trunk
        const s = b.k * (L.length - 1), [x, y] = spline(L, s), [x2, y2] = spline(L, Math.min(L.length - 1, s + 0.02)), [x0, y0] = spline(L, Math.max(0, s - 0.02));
        P.x = x; P.y = y;
        let h = Math.atan2(x2 - x0, -(y2 - y0)) * 180 / Math.PI; if (h > 0) h -= 360;   // heading, kept on one turn
        P.angle = b.k < 0.08 ? lerp(-259, h, ease(b.k / 0.08)) : h;
        v.wrap = -0.1 * Math.exp(-8 * b.t);                                            // ...and settles
        v.flutter = 1;
        // the bank: the membrane foreshortens as it rolls into the turn
        const turn = hump(clamp((b.k - 0.3) / 0.45, 0, 1));
        P.sx = 1 - 0.17 * turn; P.scale = 0.85 - 0.05 * turn;
      } else if (b.name === 'flare') {
        // the head swings up to vertical, the membrane billows as it brakes onto the trunk
        const k = ease(b.k), [xs, ys] = L[L.length - 1];
        P.x = lerp(xs, sc.hx, k); P.y = lerp(ys, low, k) - 26 * hump(b.k);
        P.angle = lerp(-90, 0, k);
        v.sq = [1 + 0.08 * hump(b.k), 1 - 0.08 * hump(b.k), 0.5, 0.5]; P.scale = lerp(0.85, 1, k);
        v.flutter = 1 - k;
      } else if (b.name === 'land') {
        P.x = sc.hx; P.y = low;
        const s = hump(b.k); v.sq = [1 + 0.03 * s, 1 - 0.04 * s, 0.5, 0.9];
        v.wrap = ease(b.k);
      } else if (b.name === 'climb') {
        P.x = sc.hx; P.y = low - HOP * hops(b.k, HOPS_HOME); v.wrap = 1; v.hop = frac(b.k * HOPS_HOME);
      } else { v.wrap = 1 - ease(b.k); v.open = b.k; }
      if (v.hop !== undefined && (b.name === 'hop' || b.name === 'climb')) {   // each hop: stretch up, then a little squash on the hold
        const q = v.hop; v.sq = [1, 1 + 0.04 * hump(clamp(q / 0.32, 0, 1)) - 0.025 * hump(clamp((q - 0.32) / 0.25, 0, 1)), 0.5, 0.9];
      }
    } },
    bend(u, v, t, P, o, r) {
      const V = P.v;
      if (V.sq) scl(o, u, v, V.sq[2], V.sq[3], V.sq[0], V.sq[1], 1);   // squash and stretch
      wrapBend(o, u, v, V.wrap || 0, r);
      // the trailing edges (the back and the far sides of the membrane) flutter fast in the airflow
      if (V.flutter) {
        const f = V.flutter, back = S(0.8, 0.92, v) * S(0.04, 0.12, Math.abs(u - 0.5) + 0.04);
        o[1] += 0.018 * f * Math.sin(TAU * (7 * t - 3 * u)) * back;
        const sideW = S(0.36, 0.46, Math.abs(u - 0.5)) * S(0.25, 0.4, v);
        o[0] += 0.016 * f * Math.sign(u - 0.5) * Math.sin(TAU * (6.3 * t - 2.5 * v) + (u > 0.5 ? 1.3 : 0)) * sideW;
      }
      // the head looks about while it clings; the tail tip trails
      rot(o, u, v, 0.5, 0.25, (V.wrap > 0.5 ? 6 * Math.sin(TAU * 0.5 * t) : 0), box(u, v, 0.38, 0.0, 0.62, 0.26, 0.03), r);
      shift(o, 0.012 * Math.sin(TAU * 2 * t), 0, box(u, v, 0.44, 0.86, 0.56, 1.0, 0.02));
      // breathing while it holds on
      if (V.wrap > 0.5) scl(o, u, v, 0.5, 0.55, 1 + 0.015 * Math.sin(TAU * 0.6 * t), 1, box(u, v, 0.38, 0.3, 0.62, 0.8, 0.04));
    },
    fx(t, P, sc, E, mode, poseAt) {
      const V = P.v;
      if (mode === 'pass') {
        const dx = Math.cos(11 * Math.PI / 180), dy = Math.sin(11 * Math.PI / 180);
        // four long wind streaks along its path, peeling off the corners of the membrane
        for (const [u, v, len] of [[0.08, 0.36, 520], [0.92, 0.36, 520], [0.12, 0.78, 380], [0.88, 0.78, 380]]) {
          const [x, y] = at(sc, P, u, v);
          for (let j = 0; j < 3; j++) {
            const off = frac(t * 2.2 + j / 3 + u) * len, l = len * 0.42;
            line(E, x - dx * (40 + off), y - dy * (40 + off), x - dx * (40 + off + l), y - dy * (40 + off + l), 3);
          }
        }
        // leaves torn loose in its wake, tumbling down slowly behind it
        emit(t, 0.32, 2.2, (i, te, age) => {
          const Q = poseAt(te), [x, y] = at(sc, Q, rnd(i, 2) < 0.5 ? 0.15 : 0.85, 0.9);
          const sway = 40 * Math.sin(age * 4 + i), spin = age * 300 * (rnd(i, 3) - 0.5);
          leaf(E, x - 80 * age + sway, y + 30 + 90 * age, spin + 40 * Math.sin(age * 5 + i), 22, rnd(i, 4) > 0.5);
        });
        return;
      }
      const b = beat(t, OUT);
      // the trunk it lives on
      E.back = true;
      const tx = sc.hx, wv = 54;
      paper(E, [tx - wv, -20, tx - wv + 8, 400, tx - wv - 4, 800, tx - wv + 6, HH + 20, tx + wv - 4, HH + 20, tx + wv + 6, 700, tx + wv, 300, tx + wv - 6, -20], 4);
      for (let i = 0; i < 9; i++) { const y = 60 + i * 115, x = tx - wv * 0.6 + wv * 1.1 * rnd(i, 7); poly(E, [x, y, x + 6, y + 30, x - 2, y + 62], 3); }
      E.back = false;
      // the snap: a crack of lines off the membrane's edges
      if (V.snap > 0.05) {
        for (const [u, v] of [[0.02, 0.4], [0.98, 0.4], [0.1, 0.8], [0.9, 0.8]]) {
          const [x, y] = at(sc, P, u, v), [cx, cy] = at(sc, P, 0.5, 0.5), dx = x - cx, dy = y - cy, n = Math.hypot(dx, dy);
          for (let j = -1; j <= 1; j++) { const a = Math.atan2(dy, dx) + j * 0.3, r0 = 20, r1 = 20 + 70 * V.snap; line(E, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, 4); }
        }
      }
      // wind lines while it glides
      if (b.name === 'glide') {
        const Q = poseAt(Math.max(0, t - 0.12)), [ax, ay] = at(sc, Q, 0.5, 0.5), [bx, by] = at(sc, P, 0.5, 0.5);
        const d = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / d, uy = (by - ay) / d;
        for (const side of [-1, 1]) {
          const [x, y] = at(sc, P, side < 0 ? 0.05 : 0.95, 0.5);
          for (let j = 0; j < 2; j++) { const o = frac(t * 2.5 + j * 0.5) * 220; line(E, x - ux * (30 + o), y - uy * (30 + o), x - ux * (130 + o), y - uy * (130 + o), 3); }
        }
      }
      // bark flakes knocked off by the landing; scratch ticks at each hop up the trunk
      const tl = beatStart(OUT, 'land');
      if (t > tl && t < tl + 1.2) for (let i = 0; i < 5; i++) { const a = t - tl, x = sc.hx - 60 + 30 * i + 40 * a * (i - 2), y = sc.hy + HOPS_HOME * HOP + 220 + 300 * a * a + 20 * i; blob(E, x, y, 7, 4, 40 * i + 200 * a); }
      if (b.name === 'hop' || b.name === 'climb') {
        const n = b.name === 'hop' ? HOPS_UP : HOPS_HOME, q = frac(b.k * n);
        if (q > 0.3 && q < 0.6) { const [x, y] = at(sc, P, 0.5, 0.86); for (const s of [-1, 1]) line(E, x + s * 36, y + 10, x + s * 50, y + 34, 3); }
      }
    },
  };
})();

})();
