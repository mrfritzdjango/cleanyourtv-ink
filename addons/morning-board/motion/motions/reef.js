'use strict';
// The reef: scalloped hammerhead, clownfish, seahorse, day octopus, moon jellyfish, horseshoe crab, cuttlefish and
// lionfish. Each block is one animal; the helpers at the top are shared by them.

(function () {
  // ---- shared helpers ----

  /** Ambient motion that fades in after the start and out before the end, so an outing meets the still drawing. */
  const live = (t, d, a = 0.5) => S(0, a, t) * S(d, d - a, t);
  /** A smooth keyed value: keys [[t, value], ...], monotone cubic (no overshoot), easing in and out at the ends. */
  function curve(keys) {
    const n = keys.length, x = keys.map(k => k[0]), y = keys.map(k => k[1]), d = [], m = [];
    for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
    for (let i = 0; i < n; i++) m.push(i === 0 || i === n - 1 || d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
      if (h > 9) { const s = 3 / Math.sqrt(h); m[i] = s * a * d[i]; m[i + 1] = s * b * d[i]; }
    }
    return t => {
      if (t <= x[0]) return y[0];
      if (t >= x[n - 1]) return y[n - 1];
      let i = 0; while (t > x[i + 1]) i++;
      const h = x[i + 1] - x[i], s = (t - x[i]) / h, s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h * m[i + 1];
    };
  }
  /** A side-view swimmer turning round: k 0..1 from heading m0 to m1; the body foreshortens through the turn. */
  function yaw(P, k, m0, m1) {
    const c = Math.cos(Math.PI * clamp(k, 0, 1));
    P.sx *= Math.max(0.16, Math.abs(c)); P.m = c >= 0 ? m0 : m1;
  }
  /** A swim path through waypoints [x, y, heading deg, handle px (, handle out px)]: cubic pieces whose tangents follow the headings.
   * at(s), s from 0 to the number of pieces, gives [x, y, heading (unwrapped), curvature (1/px, + turns clockwise)]. */
  function route(pts) {
    const dir = p => [Math.cos(p[2] * Math.PI / 180), Math.sin(p[2] * Math.PI / 180)];
    const n = pts.length - 1;
    return { n, at(s) {
      s = clamp(s, 0, n);
      const i = Math.min(n - 1, Math.floor(s)), k = s - i, A = pts[i], B = pts[i + 1], da = dir(A), db = dir(B);
      const ha = A.length > 4 ? A[4] : A[3], p0 = [A[0], A[1]], p1 = [A[0] + da[0] * ha, A[1] + da[1] * ha], p2 = [B[0] - db[0] * B[3], B[1] - db[1] * B[3]], p3 = [B[0], B[1]];
      const j = 1 - k, out = [0, 0], d1 = [0, 0], d2 = [0, 0];
      for (let c = 0; c < 2; c++) {
        out[c] = j * j * j * p0[c] + 3 * j * j * k * p1[c] + 3 * j * k * k * p2[c] + k * k * k * p3[c];
        d1[c] = 3 * j * j * (p1[c] - p0[c]) + 6 * j * k * (p2[c] - p1[c]) + 3 * k * k * (p3[c] - p2[c]);
        d2[c] = 6 * j * (p2[c] - 2 * p1[c] + p0[c]) + 6 * k * (p3[c] - 2 * p2[c] + p1[c]);
      }
      let h = Math.atan2(d1[1], d1[0]) * 180 / Math.PI;
      const ref = lerp(A[2], B[2], k); h += 360 * Math.round((ref - h) / 360);
      const sp = Math.hypot(d1[0], d1[1]) || 1e-6;
      return [out[0], out[1], h, (d1[0] * d2[1] - d1[1] * d2[0]) / (sp * sp * sp)];
    } };
  }
  /** Half the on-screen width of the drawing's box at pose P (its turn included), for passes that start off screen. */
  const halfW = (sc, P) => { const a = P.angle * Math.PI / 180; return 0.5 * P.scale * (Math.abs(sc.sw * P.sx * Math.cos(a)) + Math.abs(sc.sh * P.sy * Math.sin(a))); };
  /** Marine snow: n specks drifting slowly across the whole screen (they wrap), dx px/s to the right, for depth. */
  function snow(E, t, n, seed, dx = -30, size = 4) {
    for (let i = 0; i < n; i++) {
      const x = ((rnd(i, seed) * (WW + 200) + dx * t) % (WW + 200) + WW + 200) % (WW + 200) - 100;
      const y = rnd(i + 40, seed) * HH + 14 * Math.sin(t * 0.7 + i);
      disc(E, x, y, size * (0.6 + 0.8 * rnd(i + 80, seed)));
    }
  }
  /** Speed streaks trailing behind (x, y) for a swimmer heading m (1 right, -1 left). */
  function wake(E, x, y, m, n, len, spread, t, seed = 0, w = 3) {
    for (let i = 0; i < n; i++) {
      const yy = y + (rnd(i, seed) - 0.5) * spread, l = len * (0.5 + rnd(i + 3, seed)), off = (rnd(i + 7, seed) * 160 + t * 300) % 160;
      line(E, x - m * off, yy, x - m * (off + l), yy, w);
    }
  }
  /** A paper-filled circle with an ink rim (it hides what is behind it). */
  function knob(E, x, y, r, w = 3) {
    const pts = []; for (let i = 0; i < 16; i++) pts.push(x + r * Math.cos(i * TAU / 16), y + r * Math.sin(i * TAU / 16));
    poly(E, pts, w, true, 2);
  }
  /** Current lines: n wavy strands flowing at speed px/s (negative: to the left), each a dash of len px, from time t0. */
  function current(E, t, n, speed, len, y0, y1, seed, t0 = 0, w = 3) {
    if (t < t0) return;
    const span = WW + len + 400, a = t - t0;
    for (let i = 0; i < n; i++) {
      const lead = rnd(i, seed) * 600 + speed * a * (0.85 + 0.3 * rnd(i + 5, seed));
      const xh = speed > 0 ? lead - 200 : WW + 200 - lead;
      for (let c = 0; c < 3; c++) {   // the strand repeats so the flow keeps going after the front has passed
        const x = xh - Math.sign(speed) * c * span * 0.55;
        const x0 = speed > 0 ? x - len : x, x1 = speed > 0 ? x : x + len;
        if (x1 < -50 || x0 > WW + 50 || (c > 0 && Math.abs(speed) * a < c * span * 0.55)) continue;
        wavy(E, x0, x1, lerp(y0, y1, (i + 0.5) / n) + 30 * (rnd(i + 9, seed) - 0.5), 9, 170, i * 1.3 - Math.sign(speed) * a * 3, w);
      }
    }
  }
  /** A copepod, the seahorse's prey: a speck with two long antennae. */
  function copepod(E, x, y, size = 1) {
    blob(E, x, y, 9 * size, 6 * size, -15);
    line(E, x + 4 * size, y - 3 * size, x - 16 * size, y - 16 * size, 2); line(E, x + 4 * size, y - 1 * size, x - 18 * size, y - 6 * size, 2);
    line(E, x - 8 * size, y + 2 * size, x - 16 * size, y + 6 * size, 2);
  }
  /** A ribbon of seagrass from (x, y) on the floor, len px tall, swaying; drawn in paper with an ink edge. */
  function seagrass(E, x, y, len, t, ph = 0, lean = 0, w = 22) {
    const L = [], R = [], n = 10;
    let px = x, py = y;
    for (let j = 0; j <= n; j++) {
      const k = j / n, ang = (-90 + lean + (6 + 10 * k) * Math.sin(TAU * 0.35 * t - 1.6 * k + ph) * k) * Math.PI / 180, hw = w / 2 * (1 - 0.55 * k * k);
      L.push(px - Math.sin(ang) * hw, py + Math.cos(ang) * hw); R.unshift(px + Math.sin(ang) * hw, py - Math.cos(ang) * hw);
      if (j < n) { px += Math.cos(ang) * len / n; py += Math.sin(ang) * len / n; }
    }
    for (let j = 0; j < R.length; j += 2) L.push(R[j], R[j + 1]);
    poly(E, L, 3, true, 2);
    return [px, py];
  }
  /** Draws the first `k` (0..1) of a path, as if the pen were still drawing it. */
  function drawOn(pts, k) {
    const n = pts.length / 2, m = clamp(k, 0, 1) * (n - 1), i = Math.floor(m), f = m - i, out = pts.slice(0, (i + 1) * 2);
    if (i < n - 1) out.push(lerp(pts[2 * i], pts[2 * i + 2], f), lerp(pts[2 * i + 1], pts[2 * i + 3], f));
    return out;
  }
  /** A spinning water curl (a vortex ring seen side-on): a spiral of r px, turned spin deg. */
  function curl(E, x, y, r, spin, w = 3, cw = 1) {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const a = (spin + cw * i * 30) * Math.PI / 180, rr = r * (1 - i / 18); pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    poly(E, pts, w);
  }
  /** An ellipse in the drawing's own coordinates, as screen points through pose P (for shapes that follow the animal). */
  function ring(sc, P, cu, cv, ru, rv, n = 20, from = 0, to = 360) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = (from + (to - from) * i / n) * Math.PI / 180, p = at(sc, P, cu + ru * Math.cos(a), cv + rv * Math.sin(a)); pts.push(p[0], p[1]); }
    return pts;
  }

  // ---- scalloped hammerhead: seen from above, head (the hammer) right, the thin tail at the left ----
  {
    const NECK = [0.79, 0.5];
    // the outing: out to the right and down into the deep (it shrinks), a U-turn, a long leg rolled on its side, a
    // second U-turn the other way to sweep low over the sand, the scan and a nose-down, then a rising swoop home
    const OUTD = 9.2;
    let R = null;
    const outRoute = sc => R || (R = route([
      [sc.hx, sc.hy, 0, 160], [sc.hx + 330, sc.hy + 150, 90, 120], [sc.hx + 60, sc.hy + 260, 180, 140],
      [sc.hx - 330, sc.hy + 225, 180, 110], [sc.hx - 440, sc.hy + 285, 90, 60], [sc.hx - 300, sc.hy + 370, 0, 90],
      [sc.hx - 150, sc.hy + 370, 0, 60, 150], [sc.hx, sc.hy, 0, 150]]));
    const outS = curve([[0, 0], [1.6, 1], [2.7, 2], [4.4, 3], [5.2, 4], [5.9, 5], [6.5, 5.82], [7.0, 5.9], [7.15, 6], [OUTD, 7]]);
    const outScale = curve([[0, 1], [1.7, 0.62], [2.8, 0.56], [6.6, 0.54], [7.2, 0.56], [OUTD, 1]]);

    M['scalloped-hammerhead'] = {
      facing: 'R',
      pass: { dur: 4.5, path(t, P, sc) {
        const v = P.v, hw = sc.sw / 2 + 40;
        P.m = 1; v.b = 'glide';
        // one long, even glide; a slow rise and fall that the body follows, and a slow roll (from above: a squash)
        P.x = lerp(-hw, WW + hw, t / 4.5);
        P.y = HH * 0.52 + 46 * Math.sin(TAU * 0.16 * t + 0.4);
        const slope = 46 * TAU * 0.16 * Math.cos(TAU * 0.16 * t + 0.4) / ((WW + 2 * hw) / 4.5);
        P.angle = Math.atan(slope) * 180 / Math.PI + 1.2 * Math.sin(TAU * 1.0 * t - 1.2);   // + a little yaw from the tail
        P.sy = 1 - 0.1 * (0.5 - 0.5 * Math.cos(TAU * t / 4.5));
        v.wave = 1; v.hz = 1; v.head = 5 * Math.sin(TAU * t / 1.5 + 0.6); v.kap = 0;
      } },
      outing: { dur: OUTD, path(t, P, sc) {
        const v = P.v, s = outS(t), [x, y, h, k] = outRoute(sc).at(s), al = live(t, OUTD, 0.6);
        P.x = x; P.y = y; P.angle = h; P.m = 1; P.scale = outScale(t);
        v.b = s < 2 ? 'dive' : s < 3 ? 'roll' : s < 5 ? 'down' : s < 6 ? 'scan' : 'home';
        // the body bend follows the curvature of the last third of a second, so it never snaps between pieces
        let kk = 0; for (let j = 0; j < 8; j++) kk += outRoute(sc).at(outS(t - 0.3 * j / 7))[3] / 8;
        v.kap = al * clamp(kk * sc.sh * P.scale * 0.5, -0.75, 0.75);
        v.wave = al * (0.6 + 0.4 * S(6.0, 6.3, s)); v.hz = 1;
        // the roll: on its side along the long leg (from above the body narrows), back level for the turn
        const roll = S(2.1, 2.5, s) * S(3.0, 2.7, s);
        P.sy = 1 - 0.42 * roll; P.angle += -10 * roll;
        // the scan: the hammer sweeps wide and fast over the sand; then the nose goes down once
        const scan = S(4.6, 5.0, s) * S(6.05, 5.85, s);
        v.head = al * ((1 - scan) * 5 * Math.sin(TAU * t / 1.5) + scan * 15 * Math.sin(TAU * t / 0.8));
        v.nose = hump(clamp((t - 6.45) / 0.6, 0, 1));
        v.scan = scan;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        // the side-to-side tail: a wave running back along the body, growing toward the tail tip
        const tailA = Math.pow(S(0.78, 0.04, u), 1.5);
        if (V.wave) o[1] += V.wave * 0.075 * tailA * Math.sin(TAU * (0.95 * (0.8 - u) - V.hz * t));
        // a turning body bends into the turn: both ends toward the turn's centre
        const d = (Math.min(u, NECK[0]) - 0.5) * r;
        if (V.kap) o[1] += V.kap * d * d / 2;
        // the hammer swings about the neck on its own rhythm, out of step with the tail; it leads into a turn
        const hw = S(0.75, 0.82, u);
        rot(o, u, v, NECK[0], NECK[1] + (V.kap || 0) * 0.045, (V.head || 0) + (V.kap || 0) * 6, hw, r);
        // nose-down: from above the head foreshortens
        if (V.nose) scl(o, u, v, 0.6, 0.5, 1 - 0.13 * V.nose, 1 + 0.04 * V.nose, S(0.6, 0.8, u));
        // pectorals flex a little with the beat
        rot(o, u, v, 0.66, 0.41, 4 * Math.sin(TAU * t * 0.5), box(u, v, 0.53, 0.18, 0.71, 0.42, 0.02), r);
        rot(o, u, v, 0.66, 0.59, -4 * Math.sin(TAU * t * 0.5), box(u, v, 0.53, 0.58, 0.71, 0.84, 0.02), r);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v, pass = mode === 'pass';
        // sense arcs: pulses from the front of the hammer, aimed where the head is pointing
        const pulse = (every, life, size, from) => emit(t, every, life, (i, te, age) => {
          const [hx, hy] = at(sc, P, 0.985, 0.5), dir = P.angle + (V.head || 0), k = age / life;
          for (let j = 0; j < 3; j++) {
            const kk = k - j * 0.18;
            if (kk > 0 && kk < 1) arc(E, hx + Math.cos(dir * Math.PI / 180) * 10, hy + Math.sin(dir * Math.PI / 180) * 10, size * P.scale * (0.25 + kk), dir - 50, 100, 5 * (1 - kk) + 1);
          }
        }, from);
        if (pass) {
          pulse(1.5, 1.1, 300, 0.25);
          // marine snow streams past, so the glide reads as fast and smooth
          snow(E, t, 14, 3, -60, 4);
          const [tx, ty] = at(sc, P, 0.06, 0.6);
          streaks(E, tx - 20, ty, 3, 120, 60, t, 4, 3);
        } else {
          if (V.scan > 0.05) pulse(0.4, 0.8, 380, 4.7);
          else if (V.b !== 'home' || t < OUTD - 1.2) pulse(1.5, 1.0, 340, 0.4);
          // the sand it sweeps over: specks lift where the hammer passes low; the nose-down raises a puff
          if (V.scan > 0.05 || V.b === 'scan') emit(t, 0.2, 1.0, (i, te, age) => {
            const Q = poseAt(te), [x, y] = at(sc, Q, 0.9, 0.3 + 0.4 * rnd(i, 2));
            disc(E, x + 30 * (rnd(i, 5) - 0.5) + age * 20, y - age * 30, 3 + 3 * rnd(i, 7));
          }, 5.0, 6.6);
          const age = t - 6.75;   // the nose-down: sand billows out round the hammer, under the shark
          if (age > 0 && age < 1.8) {
            const Q = poseAt(6.75), [x, y] = at(sc, Q, 0.94, 0.5), k = age / 1.8;
            E.back = true;
            for (let i = 0; i < 7; i++) {
              const a = TAU * i / 7 + 0.4, d = 40 + 150 * Math.sqrt(k) * (0.7 + 0.5 * rnd(i, 9));
              cloud(E, x + Math.cos(a) * d * 1.3, y + Math.sin(a) * d - 30 * k, 50 + 70 * k, 0.5 * (1 - k));
            }
            E.back = false;
            for (let i = 0; i < 9; i++) { const a = TAU * rnd(i, 10), d = 60 + 260 * k * (0.5 + rnd(i, 11)); disc(E, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8 + 80 * k * k, 4 * (1 - k) + 1.5); }
          }
          snow(E, t, 10, 8, -15, 3.5);
        }
      },
    };
  }
  // ---- clownfish: side view, head right; rows with its pectorals, the tail only for bursts ----
  {
    const PD = 3;
    // the pass: four nervous spurts, each a dash then a hover, on a slight zigzag
    const passQ = curve([[0, 0], [0.45, 0.235], [0.75, 0.25], [1.2, 0.485], [1.5, 0.5], [1.95, 0.735], [2.25, 0.75], [2.7, 0.985], [PD, 1]]);
    const passY = curve([[0, 30], [0.45, -40], [0.75, -44], [1.2, 34], [1.5, 38], [1.95, -30], [2.25, -34], [2.7, 26], [PD, 30]]);
    const spurt = t => { const k = frac(t / 0.75); return S(0, 0.2, k) * S(0.72, 0.5, k); };   // 1 while dashing

    // the outing: two short darts and a longer third trip, then into the anemone; times in seconds
    const OD = 9;
    const OX = [[0, 0], [0.7, 0], [1.1, 250], [1.45, 262], [1.75, 255], [2.2, 0], [2.55, -150], [2.85, -158], [3.15, -150], [3.55, 20],
      [4.0, 380], [4.2, 392], [4.55, 620], [5.05, 628], [5.35, 618], [5.8, 280], [5.95, 270], [6.4, 20], [6.7, 14], [7.1, 0], [8.0, 0], [OD, 0]];
    const OY = [[0, 0], [0.7, 0], [1.1, -30], [1.45, -34], [1.75, -30], [2.2, 0], [2.55, -80], [2.85, -84], [3.15, -78], [3.55, 0],
      [4.0, 22], [4.2, 22], [4.55, -10], [5.05, -14], [5.35, -10], [5.8, 6], [5.95, 6], [6.4, -18], [6.7, -26], [7.1, 205], [7.85, 212], [8.0, 210], [OD, 0]];
    const ox = curve(OX), oy = curve(OY);
    const TURNS = [[1.45, 1.75, 1, -1], [2.85, 3.15, -1, 1], [5.05, 5.35, 1, -1], [8.25, 8.7, -1, 1]];
    const DASHES = [[0.7, 1.1], [1.75, 2.2], [2.2, 2.55], [3.15, 3.55], [3.55, 4.0], [4.2, 4.55], [5.35, 5.8], [5.95, 6.4], [6.7, 7.1]];
    const dashing = t => DASHES.reduce((a, [t0, t1]) => Math.max(a, S(t0 - 0.1, t0 + 0.1, t) * S(t1 + 0.05, t1 - 0.15, t)), 0);
    /** The anemone's tentacles: [base x offset from home, length, lean deg, in front?]. */
    const TENT = Array.from({ length: 19 }, (_, i) => [-400 + 720 * i / 18 + 18 * (rnd(i, 21) - 0.5), 260 + 90 * rnd(i, 22) - 70 * Math.abs(i - 9) / 9,
      (i - 9) * 3 + 6 * (rnd(i, 23) - 0.5), i % 2 === 1]);

    M['clownfish'] = {
      facing: 'R', size: [0.95, 0.8],
      pass: { dur: PD, path(t, P, sc) {
        const v = P.v, hw = sc.sw / 2 + 30, q = passQ(t), d = spurt(t);
        P.m = 1; v.b = d > 0.5 ? 'dash' : 'hover';
        P.x = lerp(-hw, WW + hw, q);
        const vy = (passY(t + 0.01) - passY(t - 0.01)) / 0.02, vx = (passQ(t + 0.01) - passQ(t - 0.01)) / 0.02 * (WW + 2 * hw);
        P.y = HH * 0.5 + passY(t) + (1 - d) * 0.02 * sc.sh * Math.sin(TAU * 4 * t);   // bobs with the pectoral strokes
        P.angle = clamp(Math.atan2(vy, Math.max(200, vx)) * 180 / Math.PI * 0.8, -12, 12);
        v.tail = d * 20 * Math.sin(TAU * 3 * t) + (1 - d) * 5 * Math.sin(TAU * 2 * t);
        v.pec = (1 - d * 0.7) * 16 * Math.sin(TAU * 4 * t + 1);
        v.dash = d;
      } },
      outing: { dur: OD, path(t, P, sc) {
        const v = P.v, al = live(t, OD, 0.4), d = dashing(t);
        P.x = sc.hx + ox(t); P.y = sc.hy + oy(t); P.m = 1;
        v.b = t < 0.7 ? 'peek' : t < 6.4 ? 'dart' : t < 8.0 ? 'snuggle' : 'home';
        for (const [t0, t1, m0, m1] of TURNS) if (t >= t0 && t <= t1) yaw(P, (t - t0) / (t1 - t0), m0, m1);
          else if (t > t1) P.m = m1;
        if (t < TURNS[0][0]) P.m = 1;
        // tilt with the climb or dive, in the way it is heading
        const vy = (oy(t + 0.01) - oy(t - 0.01)) / 0.02, vx = Math.abs(ox(t + 0.01) - ox(t - 0.01)) / 0.02;
        let tilt = clamp(Math.atan2(vy, Math.max(250, vx)) * 180 / Math.PI * 0.6, -12, 12);
        // the dive: nose down into the tentacles, a wriggle, then it backs up and settles
        const nose = S(6.4, 6.75, t) * S(8.1, 7.7, t), wig = S(7.05, 7.2, t) * S(7.9, 7.75, t);
        tilt = tilt * (1 - nose) + 28 * nose;
        P.angle = P.m * tilt + wig * 10 * Math.sin(TAU * 4 * t);
        P.y += al * (1 - d) * (1 - nose) * 0.012 * sc.sh * Math.sin(TAU * 3.5 * t);
        v.tail = al * (d * 20 * Math.sin(TAU * 3 * t) + (1 - d) * 5 * Math.sin(TAU * 2 * t)) + wig * 16 * Math.sin(TAU * 4 * t + 1.2);
        v.pec = al * (1 - d * 0.7) * 15 * Math.sin(TAU * 3.5 * t + 1);
        v.wig = wig; v.dash = d; v.nose = nose;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        // the tail flicks about the narrow peduncle; the rear body follows a little
        rot(o, u, v, 0.36, 0.5, V.tail || 0, S(0.4, 0.24, u), r);
        o[1] += 0.012 * (V.dash || 0) * Math.sin(TAU * 3 * t + 2.2) * S(0.65, 0.35, u) * S(0.2, 0.35, u);
        // the wriggle into the anemone: an S through the whole body
        if (V.wig) o[1] += V.wig * 0.035 * Math.sin(TAU * (1.2 * u - 4 * t));
        // the pectoral rows about its base behind the gill
        rot(o, u, v, 0.81, 0.56, V.pec || 0, box(u, v, 0.61, 0.49, 0.83, 0.68, 0.025), r);
        // pelvic and anal fins scull, dorsal fins ripple
        rot(o, u, v, 0.74, 0.75, 0.5 * (V.pec || 0), box(u, v, 0.66, 0.76, 0.78, 0.95, 0.02), r);
        wave(o, 1 - u, t, 0.008, 2.5, 2.5, box(u, v, 0.3, 0.05, 0.88, 0.25, 0.03));
        wave(o, 1 - u, t, 0.008, 2.5, 2.5, box(u, v, 0.33, 0.8, 0.56, 0.94, 0.03));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          // tiny bubbles from the mouth when it hovers, a few dashes behind each spurt
          emit(t, 0.75, 0.9, (i, te, age) => {
            const Q = poseAt(te), [mx, my] = at(sc, Q, 0.95, 0.56);
            for (let j = 0; j < 3; j++) { const a = age - j * 0.1; if (a > 0) circle(E, mx + 10 + 8 * Math.sin(a * 9 + j), my - 30 - a * 160 - j * 18, 5 + 3 * rnd(i + j, 4), 3); }
          }, 0.5);
          if (V.dash > 0.3) { const [tx, ty] = at(sc, P, 0.05, 0.5); streaks(E, tx - 10, ty, 4, 90, 200, t, 6, 3); }
          snow(E, t, 10, 12, -20, 3.5);
          return;
        }
        // the anemone: tentacles rise out of the bottom, sway in the surge and close over the fish when it snuggles in
        const grow = S(0, 0.6, t) * S(OD, OD - 0.6, t), wrap = S(6.9, 7.3, t) * S(8.4, 7.9, t);
        const [fx] = at(sc, P, 0.6, 0.6);
        const tentacle = (bx, len, lean, i) => {
          const L = [], R = [], n = 9;
          let x = bx, y = HH + 40, tx = x, ty = y;
          const a = (-90 + lean) * Math.PI / 180, toward = clamp((fx - bx) / 260, -1, 1);
          for (let j = 0; j <= n; j++) {
            const k = j / n;
            const sway = 7 * Math.sin(TAU * 0.45 * t - k * 2.2 + i * 0.9) + 14 * wrap * toward * k + 6 * (V.wig || 0) * Math.sin(TAU * 4 * t + i) * k;
            const ang = a + (sway + 10 * k * Math.sin(i * 1.7)) * Math.PI / 180 * (0.4 + k);
            const w = lerp(24, 12, k);
            L.push(x - Math.sin(ang) * w, y + Math.cos(ang) * w); R.unshift(x + Math.sin(ang) * w, y - Math.cos(ang) * w);
            tx = x; ty = y;
            if (j < n) { x += Math.cos(ang) * len * grow / n; y += Math.sin(ang) * len * grow / n; }
          }
          for (let j = 0; j < R.length; j += 2) L.push(R[j], R[j + 1]);
          poly(E, L, 4, true, 2);
          knob(E, tx, ty, 13 * grow, 4);
        };
        if (grow > 0.02) {
          E.back = true;
          TENT.forEach(([dx, len, lean, front], i) => { if (!front) tentacle(sc.hx + dx, len * (1 + 0.15 * wrap), lean, i); });
          E.back = false;
          TENT.forEach(([dx, len, lean, front], i) => { if (front) tentacle(sc.hx + dx, len * (1 + 0.3 * wrap), lean * (1 - 0.5 * wrap), i); });
        }
        // bubbles when it hovers, and a rush of them as it wriggles in
        emit(t, 1.1, 1.0, (i, te, age) => {
          const Q = poseAt(te), [mx, my] = at(sc, Q, 0.95, 0.56);
          for (let j = 0; j < 2; j++) { const a = age - j * 0.12; if (a > 0) circle(E, mx + 12 * Q.m + 8 * Math.sin(a * 9 + j), my - 24 - a * 150 - j * 16, 5 + 3 * rnd(i + j, 4), 3); }
        }, 0.3, 6.3);
        E.back = true;   // the wriggle stirs bubbles out of the tentacles, behind the fish
        bubbles(E, t, te => at(sc, poseAt(te), 0.95, 0.55)[0], te => at(sc, poseAt(te), 0.95, 0.55)[1], 0.2, 1.0, 2, 300, 5, 7.1, 7.9);
        E.back = false;
        if (V.dash > 0.4 && V.b === 'dart') { const [tx, ty] = at(sc, P, 0.05, 0.5); wake(E, tx - 10 * P.m, ty, P.m, 3, 70, 150, t, 6, 3); }
      },
    };
  }
  // ---- seahorse: upright, snout right, the tail curled at the bottom ----
  {
    const PD = 4.6, OD = 9, SNAP = 6.2;
    // the pass: it rides a current; buoyancy steps of 2 % of its height, up and down
    const passX = curve([[0, 0], [0.6, 0.06], [PD - 0.3, 0.95], [PD, 1]]);
    const steps = curve([[0, 0], [0.5, 0], [0.75, -1], [1.3, -1], [1.55, -2], [2.1, -2], [2.35, -1], [2.9, -1], [3.15, -2], [3.7, -2], [3.95, -1], [PD, -1]]);
    // the outing: off the stalk, up, across to the copepod, the freeze and the snap, then the current takes it back
    const ox = curve([[0, 0], [1.6, 0], [3.1, 150], [4.7, 400], [5.2, 410], [6.6, 410], [8.3, 4], [8.6, 0], [OD, 0]]);
    const oy = curve([[0, 0], [1.4, 8], [2.6, -66], [3.4, -60], [4.7, -30], [5.2, -28], [6.6, -28], [8.3, -2], [8.6, 0], [OD, 0]]);
    const unc = curve([[0, 0], [0.7, 0], [1.6, 1], [7.6, 1], [8.7, 0], [OD, 0]]);

    M['seahorse'] = {
      facing: 'R', size: [0.8, 0.86],
      pass: { dur: PD, path(t, P, sc) {
        const v = P.v;
        P.m = 1; P.angle = 15 + 3 * Math.sin(TAU * 0.4 * t); v.b = 'drift';
        const hw = halfW(sc, P) + 40;
        P.x = lerp(-hw, WW + hw, passX(t));
        P.y = HH * 0.5 + 0.02 * sc.sh * steps(t) + 8 * Math.sin(TAU * 0.6 * t);
        v.fin = 1; v.unc = 0.5 - 0.5 * Math.cos(TAU * t / PD * 1.2); v.sway = 1;
      } },
      outing: { dur: OD, path(t, P, sc) {
        const v = P.v, al = live(t, OD, 0.4);
        P.m = 1; P.x = sc.hx + ox(t); P.y = sc.hy + oy(t);
        v.b = t < 1.6 ? 'uncurl' : t < 4.7 ? 'swim' : t < SNAP ? 'freeze' : t < 6.6 ? 'snap' : t < 8.4 ? 'drift' : 'curl';
        // leans into its swim; the current that takes it home pushes it back on its heels
        const vx = (ox(t + 0.02) - ox(t - 0.02)) / 0.04;
        P.angle = clamp(vx / 18, -12, 14) * (t < 6.6 ? 1 : -0.7) + al * 2 * Math.sin(TAU * 0.5 * t) * (t > 4.9 && t < SNAP ? 0.1 : 1);
        v.unc = unc(t); v.fin = al * (t > 5.0 && t < SNAP ? 0.35 : 1); v.sway = al * (t > 5.0 && t < SNAP ? 0.1 : 1);
        // the snap: the head flicks up in one frame, holds, eases back
        v.snap = t >= SNAP ? (t < SNAP + 0.25 ? 1 : S(SNAP + 0.6, SNAP + 0.25, t)) : 0;
        if (t >= SNAP && t < SNAP + FRAME * 1.01) v.cut = true;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        // the dorsal fin flickers: a fast, small beat with a ripple through its rays
        const finW = box(u, v, 0.19, 0.38, 0.41, 0.6, 0.02);
        if (V.fin) { rot(o, u, v, 0.405, 0.49, V.fin * 9 * Math.sin(TAU * 5.3 * t), finW, r); o[1] += V.fin * 0.012 * Math.sin(TAU * (6 * u - 4.7 * t)) * finW; }
        // the head snaps up about the neck
        if (V.snap) rot(o, u, v, 0.47, 0.31, -26 * V.snap, S(0.36, 0.25, v), r);
        // the tail: the curl opens away from the stalk and closes round it again
        if (V.unc) {
          rot(o, u, v, 0.56, 0.93, 24 * V.unc, S(0.55, 0.65, u) * S(0.76, 0.84, v), r);
          rot(o, u, v, 0.5, 0.7, 10 * V.unc, S(0.7, 0.8, v), r);
        }
        // the trunk sways a little; the gill pumps
        if (V.sway) o[0] += V.sway * 0.012 * Math.sin(TAU * 0.5 * t - 2 * v) * S(0.55, 0.95, v);
        scl(o, u, v, 0.43, 0.27, 1.06, 1.06, 0.5 * (1 + Math.sin(TAU * 1.2 * t)) * box(u, v, 0.36, 0.21, 0.5, 0.33, 0.02));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          // the current comes first, and it carries the seahorse and the plankton with it
          E.back = true; current(E, t, 7, 900, 420, 140, 980, 31, 0, 3); E.back = false;
          for (let i = 0; i < 9; i++) {
            const [cx, cy] = at(sc, P, 0.5, 0.5), a = rnd(i, 7) * TAU;
            disc(E, cx + Math.cos(a) * (380 + 120 * rnd(i, 8)) + 30 * Math.sin(t * 2 + i), cy + Math.sin(a) * (300 + 140 * rnd(i, 9)) + 20 * Math.cos(t * 1.7 + i), 4 + 3 * rnd(i, 3));
          }
          return;
        }
        // the seagrass it anchors to: rises out of the floor at the start and sinks back at the end
        const grow = S(0, 0.5, t) * S(OD, OD - 0.5, t), base = HH + 30, sx = sc.hx + 64;
        if (grow > 0.01) {
          E.back = true;
          seagrass(E, sx - 150, base, 520 * grow, t, 1.1, -6, 20);
          seagrass(E, sx, base, 470 * grow, t, 0, -3, 24);
          seagrass(E, sx + 120, base, 380 * grow, t, 2.3, 7, 18);
          E.back = false;
        }
        // the copepod: hops about in front of it, then is gone at the snap
        if (t > 3.6 && t < SNAP) {
          const hop = Math.floor(t / 0.55), hk = S(0, 0.12, frac(t / 0.55)), calm = S(5.6, 5.0, t);
          const jx = lerp(rnd(hop, 4), rnd(hop + 1, 4), hk) * 34 * calm, jy = lerp(rnd(hop, 5), rnd(hop + 1, 5), hk) * 28 * calm;
          const [cx, cy] = at(sc, poseAt(Math.min(t, 5.2)), 0.8, 0.19);
          copepod(E, cx + 26 + jx - 17 * calm, cy - 48 + jy - 14 * calm - 90 * S(4.9, 3.6, t), 1.5);
        }
        if (t >= SNAP && t < SNAP + 0.35) {   // a suck line into the snout, and the startled water
          const k = (t - SNAP) / 0.35, [sx2, sy2] = at(sc, poseAt(5.2), 0.8, 0.19);
          for (let j = -1; j <= 1; j++) line(E, sx2 + 50 + 30 * k, sy2 - 60 + j * 26, sx2 + 90 + 50 * k, sy2 - 70 + j * 40, 5 * (1 - k) + 1);
        }
        if (V.b === 'drift') { E.back = true; current(E, t, 4, -520, 300, sc.hy - 260, sc.hy + 260, 17, 6.6, 3); E.back = false; }
        // a few bubbles from the gill while it swims
        bubbles(E, t, te => at(sc, poseAt(te), 0.47, 0.06)[0], te => at(sc, poseAt(te), 0.47, 0.06)[1], 1.3, 1.2, 2, 200, 3, 0.8, 4.6);
      },
    };
  }
  // ---- day octopus: front view, mantle at the top, arms spread below ----
  {
    const C = [0.48, 0.56];                       // the middle of the arm crown
    const ARMS = [-25, 5, 38, 73, 110, 148, 190]; // each arm's direction from there (screen degrees, 90 is down)
    const PD = 4.4, OD = 9;
    // the pass: four jet pulses; per pulse, the progress of a jet (fast at once, then a long coast)
    const jet = k => { const a = 7, f = x => 1 - (1 + a * x) * Math.exp(-a * x); return f(clamp(k, 0, 1)) / f(1); };
    const PULSES = [0.15, 1.2, 2.25, 3.3];
    /** Streamline amount at time t of a pulse train: snaps to 1 in 0.22 s, relaxes with a slight overshoot. */
    const tuck = (t, starts) => {
      let z = 0;
      for (const t0 of starts) {
        const k = t - t0;
        if (k < 0 || k > 1.1) continue;
        z += k < 0.3 ? S(0, 0.3, k) : (1 - S(0.3, 0.95, k)) - 0.18 * hump((k - 0.6) / 0.5);
      }
      return z;
    };
    // the outing: walk out on its arms, rise, umbrella over the rock, probe, walk home
    const ROCK = 560;
    const walkX = (t, t0, t1, x0, x1, n) => {   // steps: the body moves in surges, n of them
      const k = clamp((t - t0) / (t1 - t0), 0, 1), q = k * n, i = Math.min(n - 1, Math.floor(q));
      return lerp(x0, x1, (i + S(0.15, 0.85, q - i)) / n);
    };
    const oy = curve([[0, 0], [0.5, 0], [1.6, 140], [3.3, 140], [3.7, 156], [4.4, -30], [4.55, -36], [4.95, 150], [6.0, 152], [6.5, 140], [8.4, 140], [OD, 0]]);

    M['day-octopus'] = {
      facing: 'F', size: [0.55, 0.9],
      pass: { dur: PD, path(t, P, sc) {
        const v = P.v;
        P.m = 1; P.angle = 90; v.b = 'jet';
        const hw = halfW(sc, P) + 60, x0 = -hw, x1 = WW + hw;
        let q = 0.12 * clamp(t / PULSES[0], 0, 1) * 0.25;   // drifting in before the first jet
        PULSES.forEach(t0 => { q += jet((t - t0) / 1.05) * (1 - 0.03) / PULSES.length; });
        P.x = lerp(x0, x1, q + 0.03 * clamp(t / PULSES[0], 0, 1));
        P.y = HH * 0.5 + 50 * Math.sin(TAU * 0.22 * t + 0.5);
        P.angle = 90 + 6 * Math.cos(TAU * 0.22 * t + 0.5);
        v.z = tuck(t, PULSES); v.sq = PULSES.reduce((a, t0) => a + hump((t - t0) / 0.3), 0);
        v.trail = 1; v.idle = 1;
      } },
      outing: { dur: OD, path(t, P, sc) {
        const v = P.v, al = live(t, OD, 0.5);
        P.m = 1;
        let dx = 0;
        if (t < 3.3) dx = walkX(t, 0.5, 3.3, 0, ROCK - 140, 5);
        else if (t < 4.95) dx = lerp(ROCK - 140, ROCK, S(3.7, 4.95, t));
        else if (t < 6.6) dx = ROCK - 12 * S(6.0, 6.6, t);
        else dx = walkX(t, 6.6, 8.8, ROCK - 12, 0, 5);
        P.x = sc.hx + dx; P.y = sc.hy + oy(t);
        v.b = t < 3.3 ? 'walk' : t < 3.7 ? 'crouch' : t < 4.5 ? 'rise' : t < 4.95 ? 'pounce' : t < 6.0 ? 'probe' : t < 6.6 ? 'retract' : 'walk';
        const walking = (t > 0.5 && t < 3.3) || (t > 6.6 && t < 8.8);
        v.walk = walking ? S(0.5, 0.8, t) * S(8.8, 8.5, t) * Math.min(S(0.5, 0.8, t), S(3.3, 3.0, t) + S(6.6, 6.9, t)) : 0;
        v.ph = t < 4 ? (t - 0.5) / (2.8 / 5) : (t - 6.6) / (2.2 / 5);
        P.y -= v.walk * 10 * Math.abs(Math.sin(Math.PI * v.ph));   // the body lifts on each step
        P.sy = 1 - 0.06 * S(3.3, 3.7, t) * S(3.9, 3.7, t) + 0.04 * S(3.7, 3.9, t) * S(4.3, 4.0, t);
        v.z = 0.35 * S(3.3, 3.7, t) * S(3.95, 3.75, t);
        v.sp = S(3.75, 4.35, t) * S(6.2, 5.9, t);   // the umbrella
        v.drape = S(4.5, 4.95, t) * S(6.2, 5.95, t);
        v.probe = S(4.95, 5.2, t) * S(6.0, 5.8, t);
        v.sq = hump((t - 3.7) / 0.35) + 0.6 * hump((t - 4.05) / 0.3);
        v.idle = al; v.trail = 0;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        // the arms, as a warp around the crown: each point turns about C by an amount set by its direction
        const dx = (u - C[0]) * r, dy = v - C[1], rr = Math.hypot(dx, dy);
        let a = Math.atan2(dy, dx) * 180 / Math.PI;
        if (a < -90) a += 360;                    // directions run from -90 (straight up, the mantle) round to 270
        const mant = ((u - 0.43) / 0.17) ** 2 + ((v - 0.25) / 0.22) ** 2;   // keep the mantle itself out of the warp
        const w = S(0.11, 0.22, rr) * S(-48, -30, a) * S(228, 212, a) * S(1.0, 1.35, mant);
        if (w > 0) {
          let da = 0, dr = 0;
          if (V.z) { da += (90 - a) * 0.5 * V.z; dr += 0.12 * V.z; }                   // streamline: all arms toward the trail
          if (V.sp) { da += (a - 90) * 0.22 * V.sp; dr += 0.12 * V.sp; }               // umbrella: arms fan out, the web stretched
          if (V.drape) da += (a < 90 ? 1 : -1) * Math.min(Math.abs(a - 90), 60) * 0.35 * V.drape * S(0.2, 0.42, rr);   // tips droop over the rock
          if (V.walk) {                                                                // alternate arms reach and push
            let alt = 0; ARMS.forEach((am, i) => { alt += (i % 2 ? -1 : 1) * Math.exp(-(((a - am) / 16) ** 2)); });
            da += 11 * V.walk * alt * Math.sin(Math.PI * V.ph);
          }
          if (V.probe) da += 7 * V.probe * Math.sin(TAU * 1.6 * t + a / 25) * S(0.28, 0.45, rr);   // the tips feel about
          if (V.trail) da += 9 * Math.sin(TAU * 0.9 * t - rr * 9 + a / 40) * S(0.15, 0.4, rr) * (1 - 0.6 * (V.z || 0));
          if (V.idle) da += 4 * V.idle * Math.sin(TAU * 0.35 * t - rr * 7 + a / 30) * S(0.15, 0.4, rr);
          const a2 = (a + da * w) * Math.PI / 180, r2 = rr * (1 + dr * w);
          o[0] += (C[0] + Math.cos(a2) * r2 / r) - u; o[1] += (C[1] + Math.sin(a2) * r2) - v;
        }
        // the mantle breathes, and squeezes on each jet
        const mw = S(0.5, 0.42, v) * box(u, v, 0.22, 0.0, 0.66, 0.6, 0.04);
        scl(o, u, v, 0.43, 0.3, 1 - 0.1 * (V.sq || 0) + 0.025 * Math.sin(TAU * 0.6 * t), 1 + 0.05 * (V.sq || 0) - 0.015 * Math.sin(TAU * 0.6 * t), mw);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        // water dashes from the siphon: a spray of short strokes, backward along the body
        const spray = (t0, n, len, seed) => {
          const age = t - t0; if (age < 0 || age > 0.6) return;
          const Q = poseAt(t0 + 0.08), [sx, sy] = at(sc, Q, 0.5, 0.55), [bx, by] = at(sc, Q, 0.5, 0.95);
          const ang = Math.atan2(by - sy, bx - sx), k = age / 0.6;
          for (let i = 0; i < n; i++) {
            const sp = (rnd(i, seed) - 0.5) * 0.7, d0 = 80 + 900 * k * (0.6 + 0.6 * rnd(i + 3, seed)), l = len * (1 - k);
            const ca = Math.cos(ang + sp), sa = Math.sin(ang + sp);
            if (l > 4) line(E, sx + ca * d0, sy + sa * d0, sx + ca * (d0 + l), sy + sa * (d0 + l), 5 * (1 - k) + 1);
          }
        };
        if (mode === 'pass') {
          PULSES.forEach((t0, i) => spray(t0, 9, 110, i + 3));
          snow(E, t, 12, 41, -40, 4);
          return;
        }
        // the rock it hunts over: a coral head drawn on at the start and taken off at the end
        const rx = sc.hx + ROCK + 10, ry = HH + 20, show = S(0, 0.7, t) * S(OD, OD - 0.6, t);
        E.back = true;
        if (show > 0.01) {
          const pts = [];
          for (let i = 0; i <= 22; i++) {
            const a = Math.PI + Math.PI * i / 22, rad = 1 + 0.08 * Math.sin(i * 2.3) + 0.05 * Math.sin(i * 5.1);
            pts.push(rx + Math.cos(a) * 250 * rad, ry + Math.sin(a) * 290 * rad);
          }
          if (show > 0.98) poly(E, pts, 0, true, 3, 0.3);
          poly(E, drawOn(pts, show), 4);
          const q = S(0.6, 1, show);   // brain-coral grooves
          if (q > 0) for (let i = 0; i < 4; i++) wavy(E, rx - 170 + 20 * i, rx + 170 - 20 * i, ry - 220 + 55 * i, 12 * q, 70, i, 3);
        }
        // the web: when the arms spread, the skin between them shows as a stretched, dotted umbrella
        const web = Math.max(V.sp || 0, V.drape || 0);
        if (web > 0.05) {
          const c0 = at(sc, P, C[0], C[1] - 0.04), pts = [c0[0], c0[1]], sp = V.sp || 0, ar = sc.a.w / sc.a.h;
          for (let a0 = ARMS[0]; a0 <= ARMS[ARMS.length - 1] + 0.1; a0 += 4) {
            let j = 0; while (j < ARMS.length - 2 && a0 > ARMS[j + 1]) j++;
            const f = (a0 - ARMS[j]) / (ARMS[j + 1] - ARMS[j]), a = (a0 + (a0 - 90) * 0.22 * sp) * Math.PI / 180;
            const rad = 0.36 * (1 + 0.12 * sp) * (1 - 0.24 * Math.sin(Math.PI * f) ** 2);   // the web sags between two arms
            const p = at(sc, P, C[0] + Math.cos(a) * rad / ar, C[1] + Math.sin(a) * rad);
            pts.push(p[0], p[1]);
          }
          poly(E, pts, 3 * web, true, 3, 0.3 + 0.25 * web);
        }
        if (t > 4.85 && t < 6.0) { const k = (t - 4.85) / 1.15; puff(E, rx - 270, HH - 70, 150, 0.25 + 0.75 * k, 1, -160); puff(E, rx + 260, HH - 70, 150, 0.25 + 0.75 * k, 1, 160); }
        E.back = false;
        if (V.b === 'walk' || V.b === 'retract') emit(t, 0.56, 0.8, (i, te, age) => {   // a little silt at each step
          const Q = poseAt(te), [x, y] = at(sc, Q, i % 2 ? 0.3 : 0.7, 0.96);
          puff(E, x, Math.min(HH - 20, y), 36, age, 0.8, (i % 2 ? -1 : 1) * 30);
        }, 0.7, 8.8);
        spray(3.7, 10, 90, 1); spray(4.05, 7, 70, 2);
        if (t > 4.9 && t < 5.9) {   // the pounce: silt bursts out from under the web, two small fish flee
          const k = (t - 4.9) / 1.0;
          fishlet(E, rx + 280 + 600 * k * k, HH - 160 - 220 * k, 1, 26); fishlet(E, rx - 300 - 500 * k * k, HH - 140 - 280 * k, -1, 22);
        }
        snow(E, t, 8, 42, -12, 3.5);
      },
    };
  }
  // ---- moon jellyfish: the bell at the top, rim at v 0.6, tentacles and oral arms below ----
  {
    const PD = 4.5, OD = 9;
    /** Bell contraction 0..1 for pulses starting at `starts`: squeeze in 0.25 s, ease open over 1.1 s. */
    const squeeze = (t, starts) => starts.reduce((c, t0) => { const k = t - t0; return k < 0 || k > 1.4 ? c : Math.max(c, k < 0.25 ? S(0, 0.25, k) : S(1.35, 0.25, k)); }, 0);
    /** How far through its glide a pulse is: most of the push right after the squeeze. */
    const glide = k => { const f = x => 1 - (1 + 5 * x) * Math.exp(-5 * x); return f(clamp(k / 0.85, 0, 1)) / f(1); };
    const PP = [0.25, 1.75, 3.25];
    // the outing: drift and sink, four lopsided pulses up and to the right, two seconds of stillness while it sinks
    // with its tentacles streaming up, then two pulses home
    const OP = [[1.2, 60, -50], [2.2, 90, -55], [3.2, 100, -50], [4.2, 90, -35], [7.0, -250, -100], [7.6, -230, -70]];
    const OPT = OP.map(p => p[0]);
    const tilt = curve([[0, 0], [1.2, 0], [1.5, 10], [2.2, 10], [2.5, 20], [4.2, 20], [4.5, 10], [5.0, 8], [6.6, 0], [7.0, 0], [7.3, -12], [7.6, -12], [8.0, 0], [OD, 0]]);

    M['moon-jellyfish'] = {
      facing: 'F',
      pass: { dur: PD, path(t, P, sc) {
        const v = P.v, hw = sc.sw / 2 + 40;
        P.m = 1; v.b = 'drift';
        // the current carries it across; each pulse adds a small surge and a 3 % step up, then it sinks 1 %
        let q = t / PD, y = 0;
        PP.forEach(t0 => { const k = t - t0; if (k > 0) { q += 0.012 * (glide(k) - (t0 + 0.4) / PD); y += -0.03 * glide(k) + 0.01 * S(0.4, 1.4, k); } });
        q -= 0.012 * PP.reduce((a, t0) => a - (t0 + 0.4) / PD, 0) * t / PD;
        P.x = lerp(-hw, WW + hw, clamp(q, 0, 1));
        P.y = HH * 0.54 + y * sc.sh - 0.03 * sc.sh * t / PD;
        P.angle = 4 * Math.sin(TAU * 0.25 * t);
        v.c = squeeze(t, PP); v.drag = 1; v.sway = 1;
      } },
      outing: { dur: OD, path(t, P, sc) {
        const v = P.v, al = live(t, OD, 0.5);
        P.m = 1;
        let x = 80 * S(0, 1.4, t) + 60 * S(5.0, 7.0, t), y = 120 * S(0, 1.4, t) + 240 * S(5.0, 7.0, t) * S(5.0, 7.0, t);
        OP.forEach(([t0, dx, dy]) => { const g = glide(t - t0); x += dx * g; y += dy * g; });
        P.x = sc.hx + x; P.y = sc.hy + y; P.angle = tilt(t);
        v.b = t < 1.2 ? 'drift' : t < 5.0 ? 'rise' : t < 7.0 ? 'sink' : 'home';
        v.c = squeeze(t, OPT);
        v.lop = (t > 1.1 && t < 2.6) ? 1 : (t > 6.9 && t < 7.5) ? -1 : 0;   // lopsided pulses steer it
        v.up = S(5.2, 6.2, t) * S(7.4, 6.9, t);   // tentacles streaming up as it sinks
        v.drag = 0.4 * al; v.sway = al;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, c = V.c || 0;
        const bell = S(0.66, 0.58, v) * (1 - box(u, v, 0.8, 0.04, 1.0, 0.2, 0.02));
        // the bell squeezes narrow and a little tall; the margin tucks in the most. A lopsided pulse squeezes one side.
        const side = V.lop ? 1 + 0.5 * V.lop * (u < 0.5 ? -1 : 1) : 1;
        scl(o, u, v, 0.5, 0.4, 1 - 0.2 * c * side, 1 + 0.05 * c, bell);
        scl(o, u, v, 0.5, 0.6, 1 - 0.08 * c * side, 1, bell * S(0.42, 0.6, v));
        // sinking, the bell opens flat like a parachute
        if (V.up) scl(o, u, v, 0.5, 0.45, 1 + 0.05 * V.up, 1 - 0.1 * V.up, bell);
        // tentacles and oral arms hang from the rim and follow it late: they bow in after a squeeze, then trail
        const ten = S(0.57, 0.66, v), d = clamp((v - 0.6) / 0.4, 0, 1);
        if (ten > 0) {
          o[0] += (u - 0.5) * -0.2 * c * ten * (1 - d) + (u - 0.5) * -0.24 * (V.cLag || 0) * ten * d;
          o[1] += 0.07 * d * (V.cLag2 || 0) * ten;
          if (V.drag) o[0] -= V.drag * 0.07 * Math.pow(d, 1.3) * ten;
          if (V.sway) o[0] += V.sway * 0.016 * Math.sin(TAU * (0.5 * t - 1.1 * v) + u * 4) * ten * (0.3 + d);
          if (V.up) {   // streaming up: shorter, splayed, the outer ones lifted most, like the ribs of an umbrella blown inside out
            o[1] -= V.up * (0.28 + 0.4 * Math.abs(u - 0.5) / 0.45) * (v - 0.6) * ten;
            o[0] += V.up * (u - 0.5) * 0.65 * d * ten + V.up * 0.02 * Math.sin(TAU * 0.7 * t + u * 9) * ten;
          }
        }
        // the drawn bubbles wobble up a little
        shift(o, 0.004 * Math.sin(TAU * 0.8 * t), -0.006 * (0.5 + 0.5 * Math.sin(TAU * 0.4 * t)), box(u, v, 0.8, 0.04, 1.0, 0.2, 0.02));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v, pass = mode === 'pass', starts = pass ? PP : OPT;
        // the signature: two curls spin off the rim on each squeeze (and two smaller ones as it opens), drifting down
        starts.forEach((t0, i) => {
          for (const [dt, size, life] of [[0.12, 46, 1.7], [0.6, 30, 1.3]]) {
            const te = t0 + dt, age = t - te;
            if (age < 0 || age > life) continue;
            const Q = poseAt(te), k = age / life;
            for (const sd of [-1, 1]) {
              const [x, y] = at(sc, Q, sd < 0 ? 0.06 : 0.94, 0.6);
              const carry = pass ? (P.x - Q.x) * 0.8 : 0;
              curl(E, x + carry + sd * (30 + 70 * k), y + 36 + 120 * k, size * (1 - 0.4 * k), (sd < 0 ? -1 : 1) * 380 * age, 5 * (1 - k) + 1.5, sd < 0 ? -1 : 1);
            }
          }
        });
        if (pass) { E.back = true; current(E, t, 6, 700, 380, 120, 980, 61, 0, 3); E.back = false; snow(E, t, 10, 62, 120, 4); return; }
        if (V.b === 'drift') { E.back = true; current(E, t, 3, 260, 300, sc.hy - 250, sc.hy + 300, 63, 0, 3); E.back = false; }
        if (V.up > 0.05) for (let i = 0; i < 10; i++) {   // sinking: the water streams up past it
          const [cx, cy] = at(sc, P, 0.5, 0.5), x = cx + (rnd(i, 65) - 0.5) * 520, y = cy + 380 - ((rnd(i, 66) * 700 + t * 260) % 700);
          line(E, x, y, x, y - 50 * V.up, 3);
        }
        snow(E, t, 10, 64, 18, 3.5);
      },
    };
    // the tentacles' late follow-through needs the squeeze a moment ago: stored on the pose by the path
    const mo = M['moon-jellyfish'];
    for (const which of ['pass', 'outing']) {
      const path = mo[which].path;
      mo[which].path = function (t, P, sc) {
        path(t, P, sc);
        const starts = which === 'pass' ? PP : OPT;
        const end = which === 'pass' ? 1 : S(OD, OD - 0.5, t);   // an outing ends with the bell at rest
        P.v.c *= end; P.v.cLag = squeeze(t - 0.3, starts) * end; P.v.cLag2 = (squeeze(t - 0.12, starts) - squeeze(t - 0.6, starts)) * end;
      };
    }
  }
  // ---- horseshoe crab: seen from above, head shield at the top, the tail spike (telson) down ----
  {
    const PD = 4.5, OD = 9.2;
    const TEL = [0.5, 0.705];   // where the telson hinges
    // the outing: crawl out, a surge flips it, two failed levers with the telson, the third rolls it, glide home
    const ox = curve([[0, 0], [0.4, -10], [1.8, -300], [1.95, -300], [2.75, -40], [5.4, -40], [6.6, 20], [7.0, 20], [OD, 0]]);
    const oy = curve([[0, 0], [0.4, 8], [1.8, 150], [1.95, 152], [2.75, 172], [6.6, 172], [7.0, 170], [OD, 0]]);
    const oa = curve([[0, 0], [0.9, -100], [1.8, -100], [1.95, -98], [2.75, -62], [5.4, -62], [6.6, -48], [7.0, -46], [8.4, -4], [OD, 0]]);
    /** The roll about its long axis: 1 right way up, -1 on its back; the attempts lift one side and fall back. */
    const roll = t => {
      if (t < 1.95) return 1;
      if (t < 2.6) return Math.cos(Math.PI * S(1.95, 2.6, t));
      const tryK = (t0, peak) => peak * hump(clamp((t - t0) / 0.75, 0, 1) ** 0.8);
      if (t < 5.4) return -1 + tryK(3.45, 0.42) + tryK(4.45, 0.58);
      if (t < 6.5) return -Math.cos(Math.PI * S(5.45, 6.4, t));
      return 1;
    };

    M['horseshoe-crab'] = {
      facing: 'U',
      pass: { dur: PD, path(t, P, sc) {
        const v = P.v;
        P.m = 1; P.angle = 90; v.b = 'glide';
        const hw = halfW(sc, P) + 40;
        P.x = lerp(-hw, WW + hw, t / PD);
        P.y = HH - sc.sw * 0.43 - 30 + 1.5 * Math.sin(TAU * 9 * t);   // dead level; the hidden legs only jitter it
        v.rud = 4 * Math.sin(TAU * 0.7 * t);
      } },
      outing: { dur: OD, path(t, P, sc) {
        const v = P.v, al = live(t, OD, 0.4);
        P.m = 1; P.x = sc.hx + ox(t); P.y = sc.hy + oy(t); P.angle = oa(t);
        const rl = roll(t);
        P.sx = Math.abs(rl) < 0.06 ? (rl < 0 ? -0.06 : 0.06) : rl;
        // the surge lifts it as it tumbles; each heave lifts it a little; the roll pivots on one edge
        P.scale = 1 + 0.12 * hump((t - 1.9) / 0.85) + 0.03 * hump((t - 3.45) / 0.75) + 0.04 * hump((t - 4.45) / 0.75) + 0.06 * hump((t - 5.45) / 0.95);
        const piv = 60 * (1 - Math.abs(P.sx)) * (t > 3 && t < 6.6 ? 1 : 0), a = P.angle * Math.PI / 180;
        P.x += Math.cos(a) * piv; P.y += Math.sin(a) * piv;
        v.b = t < 1.8 ? 'crawl' : t < 2.7 ? 'surge' : t < 3.4 ? 'flail' : t < 5.45 ? 'lever' : t < 6.6 ? 'roll' : 'home';
        v.back = P.sx < 0 ? -P.sx : 0;
        v.rud = al * 4 * Math.sin(TAU * 0.7 * t);
        // the telson: thrashes on its back, then swings hard and digs in for each try
        const push = t0 => hump(clamp((t - t0 + 0.15) / 0.55, 0, 1));
        v.dig = 26 * (push(3.45) + push(4.45) + push(5.45));
        v.thrash = (t > 2.4 && t < 3.4 ? 1 : 0) * S(2.4, 2.7, t) * S(3.4, 3.2, t);
        v.arch = 7 * (hump((t - 3.45) / 0.75) + hump((t - 4.45) / 0.75) + hump((t - 5.45) / 0.9));
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        const tw = S(0.69, 0.75, v) * box(u, v, 0.4, 0.6, 0.6, 1.0, 0.02);
        rot(o, u, v, TEL[0], TEL[1], (V.rud || 0) + (V.dig || 0) + 20 * (V.thrash || 0) * Math.sin(TAU * 2.2 * t), tw, r);
        // the hinged abdomen arches as it heaves
        if (V.arch) rot(o, u, v, 0.5, 0.42, V.arch, S(0.42, 0.5, v), r);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          // the trackway: two rows of footprints and the telson's drag line, left in the sand behind it
          const [rx, ry] = at(sc, P, 0.5, 0.46), [lx, ly] = at(sc, P, 0.28, 0.4), [qx, qy] = at(sc, P, 0.72, 0.4);
          E.back = true;
          prints(E, -40, lx - 30, ly, 34, 5, 7); prints(E, -40 + 17, qx - 30, qy, 34, 5, 7);
          const pts = [];
          for (let te = Math.max(0, t - 2.6); te <= t + 1e-6; te += 0.08) { const Q = poseAt(Math.min(te, t)); const [x, y] = at(sc, Q, 0.5, 0.955); pts.push(x, y + Math.sin(Q.v.rud * 0.1) * 6); }
          if (pts.length >= 4) poly(E, [-20, pts[1]].concat(pts), 3);
          emit(t, 0.5, 1.0, (i, te, age) => { const Q = poseAt(te), [x, y] = at(sc, Q, 0.5, 0.05); puff(E, x - 60, y + (i % 2 ? -150 : 150), 50, age, 1.0, -70, 0.1); });
          E.back = false;
          snow(E, t, 6, 81, -20, 3.5);
          return;
        }
        // the surge: a band of water and sand that sweeps in from the left and rolls it over
        if (t > 1.5 && t < 3.3) {
          const k = (t - 1.5) / 1.8, fx = lerp(-300, WW + 400, k);
          E.back = true;
          for (let i = 0; i < 9; i++) { const y = sc.hy - 260 + i * 80, l = 260 + 180 * rnd(i, 82); wavy(E, fx - l - 120 * rnd(i, 83), fx - 120 * rnd(i, 83), y, 10, 140, t * 6 + i, 4); }
          for (let i = 0; i < 8; i++) cloud(E, fx - 80 - 200 * rnd(i, 84), HH - 60 - 140 * rnd(i, 85), 70 + 50 * rnd(i, 86), 0.5 * (1 - k));
          E.back = false;
        }
        // on its back: the pale underside, the legs kicking, the gill plates
        if (V.back > 0.05) {
          const b = V.back;
          poly(E, ring(sc, P, 0.5, 0.27, 0.3, 0.18, 24), 3, true, 2);
          poly(E, ring(sc, P, 0.5, 0.55, 0.17, 0.12, 18), 3, true, 2);
          for (let j = 0; j < 5; j++) {   // five pairs of walking legs, jointed, kicking in a wave from front to back
            const vb = 0.13 + 0.065 * j;
            for (const sd of [-1, 1]) {
              const ph = TAU * (1.6 + 1.2 * (V.thrash || 0)) * t - j * 0.9 + (sd > 0 ? Math.PI : 0), kick = Math.sin(ph);
              const k1 = [0.5 + sd * 0.15, vb + 0.035 * kick], k2 = [0.5 + sd * (0.25 + 0.02 * Math.cos(ph)), vb - 0.03 + 0.045 * Math.cos(ph)];
              const p0 = at(sc, P, 0.5 + sd * 0.035, vb), p1 = at(sc, P, k1[0], k1[1]), p2 = at(sc, P, k2[0], k2[1]);
              const lw = 6 * Math.min(1, b * 1.5);
              poly(E, [p0[0], p0[1], p1[0], p1[1], p2[0], p2[1]], lw);
              const c1 = at(sc, P, k2[0] + sd * 0.025, k2[1] - 0.02), c2 = at(sc, P, k2[0] + sd * 0.025, k2[1] + 0.02);
              line(E, p2[0], p2[1], c1[0], c1[1], lw * 0.6); line(E, p2[0], p2[1], c2[0], c2[1], lw * 0.6);
            }
          }
          { const a = at(sc, P, 0.5, 0.12), c = at(sc, P, 0.5, 0.42); line(E, a[0], a[1], c[0], c[1], 4); }
          for (let j = 0; j < 4; j++) { const a = at(sc, P, 0.38, 0.49 + 0.035 * j), c = at(sc, P, 0.62, 0.49 + 0.035 * j); line(E, a[0], a[1], c[0], c[1], 3); }
        }
        // the telson digging in: sand flies at its tip
        [3.45, 4.45, 5.45].forEach((t0, i) => {
          const age = t - (t0 + 0.2); if (age < 0 || age > 1.0) return;
          const Q = poseAt(t0 + 0.2), [x, y] = at(sc, Q, 0.5, 0.95);
          E.back = true; puff(E, x, y, 70, age, 1.0, (i - 1) * 40, 0.3); E.back = false;
          for (let j = 0; j < 5; j++) disc(E, x + (rnd(j + i * 9, 87) - 0.5) * 160 * age * 2, y - 120 * age + 300 * age * age, 5);
        });
        // thumps: landing after the surge, falling back twice, landing upright
        [2.6, 4.15, 5.15, 6.35].forEach((t0, i) => {
          const age = t - t0; if (age < 0 || age > 1.1) return;
          const Q = poseAt(t0);
          E.back = true;
          for (const [u, v] of [[0.1, 0.4], [0.9, 0.4], [0.5, 0.06]]) { const [x, y] = at(sc, Q, u, v); puff(E, x, y, i === 3 ? 90 : 60, age, 1.1, 0, 0.2); }
          E.back = false;
        });
        // the crawl and the glide home leave footprints
        if (V.b === 'crawl' || V.b === 'home') emit(t, 0.09, 1.8, (i, te, age) => {
          const Q = poseAt(te), [x, y] = at(sc, Q, i % 2 ? 0.3 : 0.7, 0.42);
          E.back = true; disc(E, x, y, 5 * (1 - age / 1.8) + 1); E.back = false;
        }, 0.3, OD - 0.3);
        snow(E, t, 8, 88, -10, 3.5);
      },
    };
  }
  // ---- cuttlefish: side view, head and arms right, the fin skirt round the mantle ----
  {
    const PD = 4.5, OD = 9, JET = 2.6, STRIKE = 5.25;
    /** Its silhouette, in drawing units: the skirt round the back, then the head and the arms. */
    const SIL = [0.65, 0.3, 0.55, 0.265, 0.45, 0.245, 0.35, 0.245, 0.25, 0.27, 0.15, 0.31, 0.08, 0.37, 0.04, 0.45, 0.04, 0.53, 0.07, 0.6,
      0.12, 0.66, 0.2, 0.71, 0.3, 0.745, 0.4, 0.76, 0.5, 0.755, 0.6, 0.74, 0.65, 0.725, 0.7, 0.66, 0.78, 0.64, 0.86, 0.6, 0.93, 0.56,
      0.96, 0.53, 0.93, 0.48, 0.86, 0.44, 0.78, 0.4, 0.7, 0.37];
    const passX = sc => curve([[0, -sc.sw / 2 - 30], [JET - 0.2, 600], [JET, 650], [JET + 0.18, 1140], [PD, WW + sc.sw / 2 + 30]]);
    let PX = null;
    const ox = curve([[0, 0], [0.8, 0], [3.6, 380], [4.2, 392], [STRIKE, 396], [STRIKE + 0.15, 404], [6.0, 400], [OD - 0.2, 0], [OD, 0]]);
    const oy = curve([[0, 0], [0.8, 0], [3.6, 60], [6.0, 62], [OD - 0.2, 0], [OD, 0]]);
    /** The mantle's top and bottom (drawing v) at u, for marks that sit on the mantle. */
    const mantleV = u => 0.205 * Math.sqrt(Math.max(0, 1 - ((u - 0.35) / 0.28) ** 2));

    M['cuttlefish'] = {
      facing: 'R',
      pass: { dur: PD, path(t, P, sc) {
        const v = P.v;
        PX = PX || passX(sc);
        P.m = 1; P.x = PX(t); P.y = HH * 0.5;   // dead level: steadier than any fish
        v.b = t < JET - 0.2 ? 'glide' : t < JET ? 'squeeze' : t < JET + 0.2 ? 'jet' : 'coast';
        v.dir = 1; v.fin = t < JET ? 1 : S(JET + 0.5, JET + 1.0, t);
        v.sq = S(JET - 0.2, JET - 0.05, t) * S(JET + 0.25, JET + 0.1, t);
        v.fold = S(JET - 0.15, JET, t) * S(JET + 0.9, JET + 0.3, t);
        v.tuck = v.fold;
        P.sx = 1 + 0.06 * S(JET, JET + 0.08, t) * S(JET + 0.4, JET + 0.12, t);   // stretched by the leap
      } },
      outing: { dur: OD, path(t, P, sc) {
        const v = P.v, al = live(t, OD, 0.5);
        P.m = 1; P.x = sc.hx + ox(t); P.y = sc.hy + oy(t);
        v.b = t < 0.8 ? 'hover' : t < 3.6 ? 'creep' : t < 4.2 ? 'raise' : t < STRIKE ? 'hold' : t < 6.0 ? 'strike' : 'back';
        v.dir = t < 6.0 ? 1 : -1;                         // backing home: the fin wave runs the other way
        v.fin = al * (t > 4.3 && t < STRIKE ? 0.35 : 1);
        v.raise = S(3.6, 4.2, t) * S(6.0, 5.6, t);
        v.lunge = hump((t - STRIKE) / 0.35);
        v.clouds = S(0.8, 1.3, t) * S(4.4, 3.9, t);      // the "passing cloud" display while it stalks
        v.sq = 0.5 * hump((t - 6.0) / 0.5);
        P.angle = -2 * v.raise;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        // the fin skirt: a fine wave runs round its edge, head to tail (tail to head when backing up)
        const e = ((u - 0.35) / 0.29) ** 2 + ((v - 0.5) / 0.21) ** 2, skirt = S(0.8, 1.15, e) * S(0.69, 0.62, u);
        if (skirt > 0) {
          const dx = (u - 0.35) * r, dy = v - 0.5, d = Math.hypot(dx, dy) || 1, th = Math.abs(Math.atan2(dy, dx));
          const amp = 0.017 * (V.fin || 0) * Math.sin(TAU * (3 * (Math.PI - th) / Math.PI * -1 * (V.dir || 1) - 2 * t) * (V.dir || 1)) - 0.06 * (V.fold || 0);
          o[0] += amp * dx / d / r * skirt; o[1] += amp * dy / d * skirt;
        }
        // the mantle squeezes for a jet
        if (V.sq) scl(o, u, v, 0.35, 0.5, 1, 1 - 0.1 * V.sq, S(0.7, 0.62, u));
        // the arms: idle curls, raised as a lure, bunched for the jet, thrown forward in the strike
        const arms = S(0.78, 0.84, u);
        o[1] += 0.012 * Math.sin(TAU * 0.6 * t + u * 9) * S(0.82, 0.95, u);
        if (V.raise) rot(o, u, v, 0.79, 0.47, -20 * V.raise, arms, r);
        if (V.tuck) scl(o, u, v, 0.79, 0.5, 1.05, 1 - 0.4 * V.tuck, arms);
        if (V.lunge) scl(o, u, v, 0.79, 0.5, 1 + 0.12 * V.lunge, 1 - 0.2 * V.lunge, arms);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        const shape = (Q, k, cx, cy) => { const pts = []; for (let i = 0; i < SIL.length; i += 2) { const [x, y] = at(sc, Q, SIL[i], SIL[i + 1]); pts.push(cx + (x - cx) * k, cy + (y - cy) * k); } return pts; };
        if (mode === 'pass') {
          // the ink double: left where it was at the jet, a solid copy that slowly breaks into dots and sinks
          const age = t - JET;
          if (age >= 0) {
            const Q = poseAt(JET), [cx, cy0] = at(sc, Q, 0.48, 0.5), k = clamp(age / (PD - JET), 0, 1), cy = cy0 + 60 * k * k;
            const solid = 1 - S(0.15, 0.75, k);
            E.back = true;
            const haze = 0.75 * S(0.05, 0.25, k) * S(0.92, 0.55, k);
            if (haze > 0.05) poly(E, shape(Q, 1 + 0.15 * k, cx, cy), 0, true, 3, haze);
            if (solid > 0.02) poly(E, shape(Q, 0.3 + 0.7 * solid, cx, cy), 0, true, 1);
            for (let i = 0; i < 26; i++) {   // drops of ink drifting off its edge
              const j = (i * 2 * 7) % SIL.length, [x, y] = at(sc, Q, SIL[j], SIL[j + 1]), f = S(0.1, 1, k) * (0.6 + 0.8 * rnd(i, 91));
              disc(E, x + (x - cx) * 0.6 * f + 20 * Math.sin(i + t), y + (y - cy0) * 0.6 * f + 60 * k * k, 9 * (1 - k) * (0.6 + 0.8 * rnd(i, 92)) + 0.5);
            }
            E.back = false;
            // the jet's wake: water dashes thrown back from the funnel
            if (age < 0.6) { const [fx, fy] = at(sc, P, 0.03, 0.5); E.back = true; wake(E, fx, fy, 1, 6, 160, 220, t, 93, 4); E.back = false; }
          }
          snow(E, t, 10, 94, -30, 4);
          return;
        }
        // the passing clouds: dark bands that sweep over the mantle from head to tail
        if (V.clouds > 0.02) for (let b = 0; b < 3; b++) {
          const uc = 0.6 - frac(t * 0.55 + b / 3) * 0.55, w = 0.02 * V.clouds;
          const band = (half, fill, lv) => {
            const pts = [];
            for (let i = 0; i <= 4; i++) { const u = uc - half + 2 * half * i / 4; if (u < 0.08 || u > 0.62) continue; const [x, y] = at(sc, P, u, 0.5 - mantleV(u) * 0.92); pts.push(x, y); }
            for (let i = 4; i >= 0; i--) { const u = uc - half + 2 * half * i / 4; if (u < 0.08 || u > 0.62) continue; const [x, y] = at(sc, P, u, 0.5 + mantleV(u) * 0.92); pts.push(x, y); }
            if (pts.length >= 6) poly(E, pts, 0, true, fill, lv);
          };
          band(w * 2.6, 3, 0.6); band(w, 1);
        }
        // the shrimp it stalks: twitches, then is snatched
        const [ax, ay] = at(sc, poseAt(4.2), 0.97, 0.47), shx = ax + 190, shy = ay - 20;
        if (t < STRIKE + 0.05) {
          const hop = Math.floor(t / 0.8), hk = S(0, 0.15, frac(t / 0.8)), calm = S(4.6, 3.8, t) * 0.5 + 0.5;
          const x = shx + lerp(rnd(hop, 95), rnd(hop + 1, 95), hk) * 40 * calm - 20 + (t < 1 ? 80 * (1 - t) : 0), y = shy + lerp(rnd(hop, 96), rnd(hop + 1, 96), hk) * 30 * calm;
          shrimp(E, x, y, Math.sin(t * 7) * 0.3);
        }
        if (t >= STRIKE && t < STRIKE + 0.3) {   // two tentacles fired out in one frame, then reeled back with the catch
          const k = (t - STRIKE) / 0.3, reel = S(0.25, 1, k);
          for (const sd of [-1, 1]) {
            const [bx, by] = at(sc, P, 0.9, 0.5 + sd * 0.02), tx = lerp(shx, bx + 20, reel), ty = lerp(shy + sd * 8, by, reel);
            line(E, bx, by, tx, ty, 7); blob(E, tx, ty, 20, 12, Math.atan2(ty - by, tx - bx) * 180 / Math.PI);
          }
          if (reel < 0.9) shrimp(E, lerp(shx, at(sc, P, 0.95, 0.5)[0], reel), lerp(shy, at(sc, P, 0.95, 0.5)[1], reel), 0.8);
        }
        if (V.b === 'back') { const [tx, ty] = at(sc, P, 0.04, 0.5); wake(E, tx, ty, -1, 4, 90, 200, t, 97, 3); }
        snow(E, t, 10, 98, -15, 3.5);
      },
    };
    /** A shrimp: curled body in segments, a tail fan, long antennae; bend curls it. */
    function shrimp(E, x, y, bend = 0, z = 1.6) {
      const pts = [];
      for (let i = 0; i <= 6; i++) { const a = Math.PI * (0.15 + (0.75 + 0.3 * bend) * i / 6); pts.push(x - Math.cos(a) * 26 * z, y + (Math.sin(a) * 18 - 10) * z); }
      poly(E, pts, 9 * z);
      const tx = pts[pts.length - 2], ty = pts[pts.length - 1];
      poly(E, [tx, ty, tx + 12 * z, ty + 10 * z, tx + 2 * z, ty + 14 * z], 3, true, 1);
      line(E, pts[0], pts[1], pts[0] - 50 * z, pts[1] - 26 * z, 2.5); line(E, pts[0], pts[1], pts[0] - 44 * z, pts[1] - 8 * z, 2.5);
      for (let i = 1; i < 5; i++) line(E, pts[2 * i], pts[2 * i + 1], pts[2 * i] - 4 * z, pts[2 * i + 1] + 12 * z, 2.5);
    }
  }
  // ---- lionfish: side view, head right; the crest of venomous spines above, the big pectoral fan below ----
  {
    const PD = 5, OD = 9, STRIKE = 5.4;
    const PIV = [0.72, 0.6];   // where the pectoral fan's rays meet
    const PUFFS = [3.9, 4.15, 4.4, 4.65, 4.9, 5.15];
    const ox = curve([[0, 0], [2.0, 360], [STRIKE, 372], [STRIKE + 0.4, 372], [6.3, 318], [6.7, 300], [8.3, 10], [8.7, 0], [OD, 0]]);
    const oy = curve([[0, 0], [2.0, 50], [STRIKE, 56], [6.3, 56], [8.3, 4], [8.7, 0], [OD, 0]]);
    /** The little fish it herds: [x, y] offsets from the group's centre. */
    const FRY = [[0, 0], [60, -50], [110, 20], [40, 60], [150, -30], [-30, -70]];

    M['lionfish'] = {
      facing: 'R',
      pass: { dur: PD, path(t, P, sc) {
        const v = P.v;
        P.m = 1; P.angle = 8; v.b = 'parade';
        const hw = halfW(sc, P) + 40;
        P.x = lerp(-hw, WW + hw, t / PD);   // a dead straight, even procession
        P.y = HH * 0.5 + 10 * Math.sin(TAU * 0.3 * t);
        v.fan = 10 * Math.sin(TAU * t / 2); v.tail = 5 * Math.sin(TAU * 0.6 * t); v.sway = 1;
      } },
      outing: { dur: OD, path(t, P, sc) {
        const v = P.v, al = live(t, OD, 0.5);
        P.m = 1; P.x = sc.hx + ox(t); P.y = sc.hy + oy(t);
        if (t >= STRIKE && t < STRIKE + 0.4) { P.x += 190 * (1 - S(STRIKE + 0.12, STRIKE + 0.4, t)); }   // the lunge: out in one frame, eased back
        if (t >= STRIKE && t < STRIKE + 1.01 / 12) v.cut = true;
        if (t > 6.3 && t < 6.7) yaw(P, (t - 6.3) / 0.4, 1, -1); else if (t >= 6.7 && t < 8.3) P.m = -1; else if (t >= 8.3 && t < 8.7) yaw(P, (t - 8.3) / 0.4, -1, 1);
        v.b = t < 2.0 ? 'drift' : t < 2.6 ? 'flare' : t < 3.8 ? 'signal' : t < STRIKE ? 'puff' : t < 6.3 ? 'strike' : 'home';
        P.angle = P.m * 8 * S(0, 1.5, t) * S(OD, 8.4, t) + (t > 2.6 && t < 3.8 ? 2 * Math.sin(TAU * 1.5 * t) : 0);
        v.spread = S(2.0, 2.6, t) * S(6.0, 5.6, t);
        v.fold = S(6.3, 6.9, t) * S(8.8, 8.3, t);
        v.wave = (t > 2.6 && t < 3.2 ? hump((t - 2.6) / 0.6) : 0);
        v.far = (t > 3.2 && t < 3.8 ? hump((t - 3.2) / 0.6) : 0);
        v.fan = al * (1 - v.fold) * 9 * Math.sin(TAU * t / 2) + 26 * v.wave * Math.sin(TAU * 2.5 * (t - 2.6));
        v.tail = al * (5 * Math.sin(TAU * 0.6 * t) + 8 * v.spread * Math.sin(TAU * 1.4 * t) * (t > 2.4 && t < 3.9 ? 1 : 0));
        v.sway = al;
        v.blow = PUFFS.reduce((a, t0) => Math.max(a, hump((t - t0) / 0.18)), 0);
        v.gulp = hump((t - STRIKE) / 0.35);
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        // the spine crest sways like weed, the tips lagging; it rises when the fish flares, lies back when it glides
        const spW = S(0.43, 0.36, v) * S(0.32, 0.38, u) * S(0.86, 0.8, u);
        if (spW > 0) {
          const h = clamp(0.42 - v, 0, 0.42);
          o[0] += (V.sway || 0) * 0.11 * h * Math.sin(TAU * 0.5 * t - 6 * h - 3 * (0.8 - u)) * spW;
          rot(o, u, v, 0.6, 0.42, 9 * (V.spread || 0) - 14 * (V.fold || 0), spW, r);
        }
        // the pectoral fan opens and shuts about its root; the rear rays swing most
        const fanW = box(u, v, 0.45, 0.6, 0.81, 1.0, 0.02) * S(0.585, 0.63, v) * (1 - box(u, v, 0.37, 0.58, 0.545, 0.79, 0.015));   // not the spotted anal fin
        if (fanW > 0) {
          scl(o, u, v, PIV[0], PIV[1], 1 + 0.15 * (V.spread || 0), 1 + 0.15 * (V.spread || 0) - 0.3 * (V.fold || 0), fanW);
          rot(o, u, v, PIV[0], PIV[1], (V.fan || 0) + 30 * (V.fold || 0), fanW * (0.4 + 0.6 * S(0.76, 0.5, u)), r);
        }
        // the tail and the soft fins scull gently
        rot(o, u, v, 0.355, 0.51, V.tail || 0, S(0.37, 0.3, u), r);
        o[1] += 0.008 * Math.sin(TAU * (0.8 * t - 3 * u)) * (box(u, v, 0.32, 0.3, 0.46, 0.47, 0.02) + box(u, v, 0.39, 0.6, 0.56, 0.78, 0.02));
        // the mouth: a pulse for each jet of water, wide for the gulp
        const mouth = box(u, v, 0.8, 0.48, 0.9, 0.62, 0.02);
        if (V.blow || V.gulp) scl(o, u, v, 0.82, 0.55, 1 + 0.04 * (V.blow || 0), 1 + 0.12 * (V.blow || 0) + 0.25 * (V.gulp || 0), mouth);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          // plankton hanging in the water parts around the fins as the procession goes by
          const [cx, cy] = at(sc, P, 0.62, 0.62);
          for (let i = 0; i < 34; i++) {
            const x0 = rnd(i, 101) * WW, y0 = rnd(i, 102) * HH, dx = x0 - cx, dy = y0 - cy, d = Math.hypot(dx * 0.75, dy) || 1, R = 560;
            const push = d < R ? (R - d) * 0.55 : 0;
            disc(E, x0 + dx / d * push + 6 * Math.sin(t * 1.3 + i), y0 + dy / d * push * 0.8 + 6 * Math.cos(t + i), 3.5 + 3 * rnd(i, 103));
          }
          return;
        }
        // the small fish it corners: a nervous huddle that flinches at every puff; one is gone at the strike
        const g = at(sc, poseAt(2.0), 0.9, 0.55), gx = g[0] + 230, gy = g[1] + 10, scatter = S(STRIKE + 0.05, STRIKE + 0.8, t);
        const flinch = PUFFS.reduce((a, t0) => a + Math.exp(-(((t - t0 - 0.1) / 0.08) ** 2)), 0);
        FRY.forEach(([fx, fy], i) => {
          if (i === 0 && t >= STRIKE) return;
          const herd = S(3.9, 5.3, t) * 0.5;
          let x = gx + fx * (1 - herd) + 12 * Math.sin(t * 3 + i * 2) + 26 * flinch, y = gy + fy * (1 - herd) + 8 * Math.cos(t * 2.4 + i);
          x += scatter * (300 + 200 * rnd(i, 104)); y += scatter * (rnd(i, 105) - 0.5) * 500;
          if (scatter < 0.98) fishlet(E, x, y, flinch > 0.3 || scatter > 0.05 ? 1 : -1, 24);
        });
        // the jets of water it blows: little bursts of dashes from the mouth
        PUFFS.forEach((t0, i) => {
          const age = t - t0; if (age < 0 || age > 0.45) return;
          const [mx, my] = at(sc, P, 0.87, 0.55), k = age / 0.45;
          for (let j = -1; j <= 1; j++) line(E, mx + 30 + 170 * k, my + j * 22 * (1 + k), mx + 90 + 200 * k, my + j * 28 * (1 + k), 6 * (1 - k) + 1);
          arc(E, mx + 20 + 210 * k, my, 22 + 36 * k, -50, 100, 5 * (1 - k) + 1);
        });
        // the far fan, waved from behind the body in the signal
        if (V.far > 0.02) {
          const [px, py] = at(sc, P, PIV[0], PIV[1]);
          E.back = true;
          for (let j = 0; j < 9; j++) { const a = (40 + j * 11 - 40 * V.far) * Math.PI / 180, L = 330 * (0.75 + 0.25 * Math.sin(j)) * (0.5 + 0.5 * V.far); line(E, px, py, px + Math.cos(a) * L, py + Math.sin(a) * L, 4); }
          E.back = false;
        }
        if (V.b === 'strike' && t < STRIKE + 0.3) { const [mx, my] = at(sc, P, 0.15, 0.5); E.back = true; for (let j = 0; j < 4; j++) line(E, mx - 200 - 40 * j, my - 90 + j * 60, mx - 20 * j, my - 90 + j * 60, 5); E.back = false; }
        snow(E, t, 12, 106, -10, 3.5);
      },
    };
  }
})();
