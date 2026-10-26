/* Fliers: the rhinoceros and oriental pied hornbills, the collared kingfisher, the large flying fox and Rajah Brooke's
 * birdwing. The birds leave their branch (the prop stays at home) and fly by swinging the folded wing over the
 * shoulder; the flying fox and the birdwing are drawn wings open, so they beat them in place. */
'use strict';
(function () {

// ===== shared flight helpers =======================================================================================

/** Length of a wingbeat plan: [['flap', beats, hz] | ['glide', seconds], ...]. */
const planLen = plan => plan.reduce((s, p) => s + (p[0] === 'flap' ? p[1] / p[2] : p[1]), 0);

/** Where in a beat the wing passes the glide pose gw on its way up: a burst of beats starts and ends there, so it
 * opens with a rising wing (the anticipation) and closes back into the glide without a jump. */
const beatFrom = (gw, down) => down + (1 - down) * Math.acos(clamp(-gw, -1, 1)) / Math.PI;
/** The wings at t through a plan. w: 1 at the top of the upstroke, -1 at the bottom of the downstroke, gw while
 * gliding; env: 0 gliding .. 1 beating; down: the share of a beat spent on the (power) downstroke. */
function wings(t, plan, gw = 0.1, down = 0.42) {
  let t0 = 0;
  const p0 = beatFrom(gw, down);
  for (let i = 0; i < plan.length; i++) {
    const s = plan[i], d = s[0] === 'flap' ? s[1] / s[2] : s[1];
    if (t < t0 + d || i === plan.length - 1) {
      if (s[0] !== 'flap') return { w: gw, env: 0, i, k: clamp((t - t0) / d, 0, 1) };
      const ph = clamp((t - t0) * s[2], 0, s[1]), f = frac(ph + p0);
      const env = S(0, 0.25, ph) * S(s[1], s[1] - 0.25, ph);
      const c = f < down ? Math.cos(Math.PI * f / down) : -Math.cos(Math.PI * (f - down) / (1 - down));
      return { w: lerp(gw, c, env), env, i, k: clamp((t - t0) / d, 0, 1) };
    }
    t0 += d;
  }
}
/** The moments of the downstrokes (mid-stroke) in a plan, from t0. */
function downbeats(plan, t0 = 0, down = 0.42, gw = 0.1) {
  const out = [], p0 = beatFrom(gw, down);
  for (const s of plan) {
    if (s[0] === 'flap') for (let k = 1; k <= s[1]; k++) out.push(t0 + (k + down * 0.5 - p0) / s[2]);
    t0 += s[0] === 'flap' ? s[1] / s[2] : s[1];
  }
  return out;
}
/** A height that climbs while beating and sinks while gliding (eased in each stretch): the flap-and-glide wave. */
function undulate(t, plan, rise, sink) {
  let t0 = 0, y = 0;
  for (const s of plan) {
    const d = s[0] === 'flap' ? s[1] / s[2] : s[1], k = ease(clamp((t - t0) / d, 0, 1));
    y += s[0] === 'flap' ? -rise * k : sink * k;
    t0 += d;
  }
  return y;
}

/** A smooth path through keys [t, x, y, scale?, vx?, vy?] (Catmull-Rom; at rest at both ends; a given vx or vy pins
 * that velocity at the key, 0 for the far end of a loop). Returns [x, y, vx, vy, scale]. */
function glide(keys, t) {
  const n = keys.length;
  t = clamp(t, keys[0][0], keys[n - 1][0]);
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], h = b[0] - a[0], k = (t - a[0]) / h;
  const val = c => (c === 3 ? 1 : 0);
  const get = (key, c) => (key[c] === undefined ? val(c) : key[c]);
  const tan = (j, c) => {
    const key = keys[j];
    if (c < 3 && key[c + 3] !== undefined) return key[c + 3];
    if (j === 0 || j === n - 1) return 0;
    return (get(keys[j + 1], c) - get(keys[j - 1], c)) / (keys[j + 1][0] - keys[j - 1][0]);
  };
  const k2 = k * k, k3 = k2 * k;
  const out = [];
  for (const c of [1, 2, 3]) {
    const p0 = get(a, c), p1 = get(b, c), m0 = tan(i, c) * h, m1 = tan(i + 1, c) * h;
    out[c] = { x: (2 * k3 - 3 * k2 + 1) * p0 + (k3 - 2 * k2 + k) * m0 + (-2 * k3 + 3 * k2) * p1 + (k3 - k2) * m1,
      v: ((6 * k2 - 6 * k) * p0 + (3 * k2 - 4 * k + 1) * m0 + (-6 * k2 + 6 * k) * p1 + (3 * k2 - 2 * k) * m1) / h };
  }
  return [out[1].x, out[2].x, out[1].v, out[2].v, out[3].x];
}

/** A left-to-right pass at progress q for the pose as it is now: the whole drawing just off screen at q 0 and 1. */
function sweep(P, sc, q, pad = 12) {
  P.x = 0;
  const xs = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => at(sc, P, u, v)[0]);
  P.x = lerp(-Math.max(...xs) - pad, WW - Math.min(...xs) + pad, q); P.m = 1;
}

/** Place the drawing so its point (u, v) sits at screen (x, y), turned by angle, allowing for the mirror the engine
 * will add after the path for a drawing facing `facing` (the lib's pin sees the pose before that mirror). */
function pinM(sc, P, u, v, x, y, angle, facing = 'L') {
  const mir = (facing === 'L' ? P.m > 0 : facing === 'R' ? P.m < 0 : false) !== !!P.mirror;
  const [px, py] = Ink.pointOf(sc, Object.assign({}, P, { x: 0, y: 0, angle, mirror: mir }), u, v);
  P.angle = angle; P.x = x - px; P.y = y - py;
}

/** Which way a flier faces, smoothly: from m0, turning at each time in `at` over d s. Passes through 0 mid-turn. */
function facing(t, m0, at, d = 0.5) {
  let f = m0;
  for (const T of at) f *= 1 - 2 * S(T - d / 2, T + d / 2, t);
  return f;
}
/** Apply a facing value: the way it goes, and the drawing narrowing through the turn (a bank seen side-on). The body
 * keeps its level tilt for the side it faces (sgn), so the narrow moment flips mirror and tilt together: that frame is
 * a cut (the TV never blends across a mirror flip anyway). */
function turnTo(P, f) {
  const k = Math.abs(f);
  P.m = f >= 0 ? 1 : -1; P.sx *= 0.3 + 0.7 * k; P.sy *= 1 + 0.06 * (1 - k);
  if (k < 0.1) P.v.cut = true;
}
const sgn = f => (f >= 0 ? 1 : -1);
/** The tilt that keeps a body drawn at axis degrees (turned `level` degrees to fly) level while turnTo narrows it: a
 * narrowed drawing's slant steepens, so it needs more turn (the bird comes round end-on). */
function levelFor(axisDeg, level, f) {
  const sx = 0.3 + 0.7 * Math.abs(f), a = axisDeg * Math.PI / 180;
  return Math.atan(Math.tan(a) / sx) * 180 / Math.PI - (axisDeg - level);
}

/** Along and across a body axis from (ou, ov) at angle a (radians, in width-scaled drawing units); across > 0 is to
 * the axis's left (the back of a bird facing left). */
function axis(u, v, r, ou, ov, a) {
  const c = Math.cos(a), s = Math.sin(a), x = (u - ou) * r, y = v - ov;
  return [x * c + y * s, x * s - y * c];
}
/** Push the region weighted w by d across the axis at angle a (towards its left, the back). */
function lift(o, a, d, w, r) { if (!(w > 0) || !d) return; o[0] += Math.sin(a) * d * w / r; o[1] -= Math.cos(a) * d * w; }

/** Where drawing point (u, v) is on screen with the show's bend at t applied to it (a bill tip after the head turned). */
function bent(sc, P, mo, u, v, t) {
  const o = [0, 0];
  mo.bend(u, v, t, P, o, sc.a.w / sc.a.h);
  return at(sc, P, u + o[0], v + o[1]);
}

/** Two curved whoosh streaks behind a wing at (x, y), going way m, fading over life. */
function whoosh(E, x, y, age, life, m, size = 120) {
  const k = clamp(age / life, 0, 1);
  if (k >= 1) return;
  for (let j = 0; j < 2; j++) {
    const R = size * (0.8 + 0.45 * j) + 90 * k, from = m > 0 ? 150 : -50, cx = x - m * (60 * k + 20 * j);
    arc(E, cx, y + 10 * j, R, from + 10 * k, 60 - 25 * k, 6 * (1 - k) + 1.5);
  }
}
/** Call ticks: n short strokes fanning from (x, y) way m, growing out over life. */
function ticks(E, x, y, age, life, m, n = 3, len = 34, spread = 50) {
  const k = clamp(age / life, 0, 1);
  if (k <= 0.02 || k >= 0.97) return;
  for (let i = 0; i < n; i++) {
    const a = (spread * (i / (n - 1 || 1) - 0.5)) * Math.PI / 180, r0 = 18 + 40 * k, r1 = r0 + len * hump(k);
    line(E, x + m * r0 * Math.cos(a), y + r0 * Math.sin(a), x + m * r1 * Math.cos(a), y + r1 * Math.sin(a), 4);
  }
}
/** A little crab: body and four legs a side, claws up. */
function crab(E, x, y, size = 16, wiggle = 0) {
  blob(E, x, y, size, size * 0.7, 0);
  for (const sd of [-1, 1]) {
    for (let j = 0; j < 3; j++) { const yy = y + size * (0.1 + 0.25 * j), kk = Math.sin(wiggle + j * 1.7) * 4; line(E, x + sd * size * 0.8, yy, x + sd * size * 1.7, yy + size * 0.5 + kk, 3); }
    line(E, x + sd * size * 0.6, y - size * 0.4, x + sd * size * 1.2, y - size * 1.2, 4);
    disc(E, x + sd * size * 1.25, y - size * 1.25, size * 0.32);
  }
}

// ===== Rhinoceros hornbill ==========================================================================================
// Flap-flap-flap-glide: three heavy, loud wingbeats and a glide with the wing tips curled up; a heavy, slowly falling
// wave of a path. Calls "gok" with the bill raised. Facing left; the branch (layer 3) stays home.
const RH_A = 35.6 * Math.PI / 180;             // body axis: crown of the back (0.42, 0.36) to the tail tip (0.9, 0.95)
const RH_SH = [0.47, 0.41];                    // the shoulder the folded wing swings about
const RH_FEET = [0.55, 0.78];
const RH_LEVEL = 26;                           // degrees the drawing turns to fly level (the head turns back the rest)

/** Pose and wings of a flying rhinoceros hornbill: fly 0..1 blends from perched to flying; f is its facing. */
function rhinoFly(P, W, f, fly, vy) {
  const v = P.v;
  v.fly = fly; v.w = W.w; v.env = W.env;
  const fs = sgn(f);
  P.angle += fly * (levelFor(35.6, RH_LEVEL, f) * fs + 3 * (1 - W.w) * 0.5 * W.env * fs + clamp(vy * 0.012, -6, 6) * fs);
}

M['rhinoceros-hornbill'] = {
  facing: 'L', props: [3], size: [0.85, 0.75],
  pass: { dur: 4.5, path(t, P, sc) {
    const PLAN = M['rhinoceros-hornbill'].PLAN, v = P.v, W = wings(t, PLAN, 0.12);
    hideProp(P);
    // a heavy, slowly falling wave: up a little on each burst of beats, down more in each glide
    P.y = HH * 0.4 + undulate(t, PLAN, HH * 0.04, HH * 0.065);
    const vy = (undulate(t + 0.02, PLAN, HH * 0.04, HH * 0.065) - undulate(t - 0.02, PLAN, HH * 0.04, HH * 0.065)) / 0.04;
    rhinoFly(P, W, 1, 1, vy);
    // forward at a steady heavy pace, a little surge after each downstroke
    sweep(P, sc, t / 4.5);
    P.x += 18 * Math.sin(TAU * 2.4 * t) * W.env;
    v.lag = wings(t - 0.14, PLAN, 0.12).w; v.curl = 1 - W.env; v.b = W.env > 0.5 ? 'flap' : 'glide';
  } },
  PLAN: [['flap', 3, 2.4], ['glide', 0.8], ['flap', 3, 2.4], ['glide', 1.2]],
  OUT: [['call', 1.5], ['crouch', 0.4], ['fly', 6.5], ['settle', 0.6]],
  FLY: [['glide', 1.15], ['flap', 3, 2.4], ['glide', 0.6], ['flap', 3, 2.4], ['glide', 0.8], ['flap', 2, 2.4], ['glide', 0.87]],
  // the slow oval: swoop down left off the branch, turn, climb right along the bottom, turn high on the right, glide
  // back along the top and drop onto the branch from above. [t, dx, dy, scale, vx]
  KEYS: [[0, 0, 0, 1], [0.45, -70, 120, 0.98], [1.0, -150, 240, 0.95, 0], [2.2, 110, 265, 0.9], [3.4, 450, 90, 0.82], [4.6, 630, -100, 0.78, 0],
    [5.6, 300, -150, 0.85], [6.5, 0, 0, 1]],
  outing: { dur: 9, path(t, P, sc) {
    const mo = M['rhinoceros-hornbill'], b = beat(t, mo.OUT), v = P.v;
    P.v.idle = S(0, 0.5, t) * S(9, 9 - 0.5, t);   // the idle stirrings fade in and out, so it starts and ends as drawn
    stay(P, sc); P.m = -1; v.b = b.name;
    v.w = 0; v.fly = 0; v.head = 0;
    if (b.name === 'call') {   // lifts the bill twice to call "gok"
      v.head = 15 * hump(clamp((b.t - 0.15) / 0.55, 0, 1)) + 15 * hump(clamp((b.t - 0.8) / 0.55, 0, 1));
      P.y += -4 * hump(clamp((b.t - 0.15) / 0.55, 0, 1)) - 4 * hump(clamp((b.t - 0.8) / 0.55, 0, 1));
      v.w = 0.06 * Math.sin(TAU * 0.9 * b.t) * S(1.5, 1.2, b.t);   // the folded wing shifts as it breathes
    } else if (b.name === 'crouch') {   // squashes down on its feet, then springs
      const k = hump(b.k);
      P.sy = 1 - 0.06 * k; P.sx = 1 + 0.03 * k;
      P.y += 0.06 * k * (RH_FEET[1] - 0.5) * sc.sh;
      v.w = -0.3 * S(0.6, 1, b.k);
    } else if (b.name === 'fly') {
      const tt = b.t, [dx, dy, vx, vy, s] = glide(mo.KEYS, tt), W = wings(tt, mo.FLY, 0.15);
      P.x = sc.hx + dx; P.y = sc.hy + dy; P.scale = s;
      const f = facing(tt, -1, [1.0, 4.6], 0.6);
      const fly = S(0, 0.5, tt) * S(6.5, 5.7, tt);
      rhinoFly(P, W, f, fly, vy);
      turnTo(P, f);
      v.lag = wings(tt - 0.14, mo.FLY, 0.15).w; v.curl = (1 - W.env) * fly;
      // braking: the wings held up high, the body tipping upright, the feet reaching for the branch
      const brake = S(5.7, 6.1, tt);
      v.w = lerp(lerp(-0.3, W.w, S(0, 0.3, tt)), 1.0, brake); v.brake = brake * S(6.5, 6.3, tt);
      v.b = tt > 5.7 ? 'brake' : W.env > 0.5 ? 'flap' : 'glide';
    } else {   // lands with a bob, the branch dips and springs back, the wing folds with a little overshoot
      const k = b.k, bob = Math.sin(Math.PI * k) * (1 - k);
      P.y += 16 * bob; P.sy = 1 - 0.04 * bob; P.sx = 1 + 0.02 * bob;
      v.w = 1 - S(0, 0.55, k) - 0.15 * hump(clamp((k - 0.4) / 0.6, 0, 1));
      P.prop.y += 8 * bob;
    }
  } },
  bend(u, v, t, P, o, r) {
    const V = P.v, [al, sd] = axis(u, v, r, 0.42, 0.36, RH_A), fly = V.fly || 0;
    // the head and casque: level in flight (the body turned, the head turns back), raised to call
    const head = S(0.47, 0.39, u) * S(0.62, 0.5, v), id = V.idle === undefined ? 1 : V.idle;
    rot(o, u, v, 0.42, 0.37, (V.head || 0) + fly * RH_LEVEL * 0.85 + 2 * Math.sin(TAU * 0.6 * t) * id, head, r);
    // the folded wing (the back from the shoulder to the primaries) swings up over the shoulder and down
    const w = V.w || 0, deg = w >= 0 ? -44 * w : -16 * w, low = w >= 0 ? -0.12 : lerp(-0.12, -0.3, -w);
    const wing = S(0.0, 0.12, al) * S(0.72, 0.58, al) * S(low, low + 0.14, sd);
    rot(o, u, v, RH_SH[0], RH_SH[1], deg, wing, r);
    // gliding: the rear of the wing, the primaries, curl up
    lift(o, RH_A, 0.06 * (V.curl || 0), S(0.36, 0.56, al) * S(0.72, 0.6, al) * S(-0.08, 0.04, sd), r);
    // the long tail lags the wings and steers
    const tail = S(0.6, 0.74, al);
    rot(o, u, v, 0.72, 0.72, 7 * (V.lag || 0) * fly - 4 * (V.brake || 0), tail, r);
    // the feet tuck up in flight and reach down to brake
    const tuck = fly * (1 - (V.brake || 0));
    const feet = box(u, v, 0.47, 0.7, 0.64, 0.9, 0.03);
    scl(o, u, v, 0.6, 0.62, 1 - 0.92 * tuck, 1 - 0.92 * tuck, feet);
  },
  fx(t, P, sc, E, mode, poseAt) {
    const mo = M['rhinoceros-hornbill'], V = P.v;
    if (mode === 'pass') {
      // whoosh streaks behind the wing on every downstroke: the beats you hear
      for (const te of downbeats(mo.PLAN, 0, 0.42, 0.12)) {
        const age = t - te; if (age < 0 || age > 0.6) continue;
        const Q = poseAt(te), [x, y] = at(sc, Q, 0.66, 0.45);
        whoosh(E, x, y, age, 0.6, 1, 210);
      }
      // two leaves shaken loose from the canopy above
      // (they come down fast enough, and drift with the wind of its passing, to be gone when it is)
      for (const [te, seed, dx] of [[0.6, 1, 260], [1.2, 2, 640]]) {
        const age = t - te; if (age < 0) continue;
        const Q = poseAt(te), [x] = at(sc, Q, 0.5, 0.4);
        fallingLeaf(E, x + dx + 110 * age, -40, age, seed, 44, 380);
      }
    } else {
      const b = beat(t, mo.OUT);
      if (b.name === 'call') for (const tc of [0.42, 1.07]) {   // "gok"
        const age = b.t - tc; if (age < 0 || age > 0.45) continue;
        const [x, y] = at(sc, P, 0.05, 0.47);
        ticks(E, x - 6, y - 24, age, 0.45, -1, 3, 46, 64);
      }
      if (b.name === 'fly') {
        const t0 = beatStart(mo.OUT, 'fly');
        for (const te of downbeats(mo.FLY, t0, 0.42, 0.15)) {
          const age = t - te; if (age < 0 || age > 0.55) continue;
          const Q = poseAt(te), [x, y] = at(sc, Q, 0.64, 0.5);
          whoosh(E, x, y, age, 0.55, Q.m, 110 * Q.scale);
        }
      }
      if (b.name === 'settle') {   // bark dust knocked off the branch by the landing
        const [x, y] = at(sc, P, 0.56, 0.84);
        puff(E, x - 40, y + 10, 40, b.t, 0.6, -50, -0.6); puff(E, x + 50, y + 10, 34, b.t, 0.6, 50, -0.6);
      }
    }
  },
};

// ===== Oriental pied hornbill =======================================================================================
// A few quick beats and a rigid glide, tail fanned; noisy, in flocks. Its tongue is too short to move food, so it
// tosses each fruit up and catches it. Facing left; the branch (layer 3) stays home.
const PH_A = 35.8 * Math.PI / 180;             // body axis: nape (0.38, 0.25) to the tail tip (0.88, 0.97)
const PH_NECK = [0.4, 0.28], PH_TIP = [0.04, 0.36], PH_GAPE = [0.31, 0.27];
const PH_LEVEL = 24;

/** A flock-mate far off: a little hornbill glyph, bill and casque, a V of wings beating at phase ph, going way m. */
function mate(E, x, y, size, ph, m = 1) {
  const up = 0.35 + 0.65 * Math.cos(ph), X = dx => x + m * dx * size, Y = dy => y + dy * size;
  poly(E, [X(-0.3), Y(-0.04), X(0.25), Y(-0.04), X(0.08 - 0.1 * up), Y(-0.95 * up), X(-0.2 - 0.12 * up), Y(-1.05 * up), X(-0.5 - 0.1 * up), Y(-0.8 * up)], 0, true, 1);
  blob(E, x, y, size * 0.5, size * 0.15, 0);
  disc(E, X(0.5), Y(-0.04), size * 0.14);
  poly(E, [X(0.58), Y(-0.1), X(1.08), Y(0.1), X(0.6), Y(0.05)], 0, true, 1);
  poly(E, [X(0.56), Y(-0.12), X(0.86), Y(-0.06), X(0.6), Y(-0.22)], 0, true, 1);
  poly(E, [X(-0.4), Y(-0.06), X(-0.98), Y(-0.04), X(-0.98), Y(0.1), X(-0.4), Y(0.06)], 0, true, 1);
  poly(E, [X(-0.8), Y(-0.04), X(-0.98), Y(-0.04), X(-0.98), Y(0.1), X(-0.8), Y(0.1)], 0, true, 2);
}

M['oriental-pied-hornbill'] = {
  facing: 'L', props: [3], size: [0.85, 0.7],
  PLAN: [['flap', 4, 3.4], ['glide', 0.6], ['flap', 4, 3.4], ['glide', 0.55]],
  OUT: [['peer', 1.3], ['crouch', 0.3], ['fly', 5.3], ['settle', 0.45], ['toss', 1.35], ['gulp', 0.5]],
  FLY: [['glide', 0.5], ['flap', 3, 3.4], ['glide', 0.35], ['flap', 3, 3.4], ['glide', 0.65], ['flap', 2, 3.4],
    ['glide', 0.5], ['flap', 4, 3.4], ['glide', 0.5], ['flap', 2, 3.4], ['glide', 0.63]],
  // a bouncy zigzag down to a fig twig low on the right, a pause to pluck, then back up to the branch.
  KEYS: [[0, 0, 0, 1], [0.6, -110, 140, 0.95, 0], [1.1, 40, 80, 0.93], [1.55, 190, 210, 0.9], [2.0, 330, 130, 0.88],
    [2.5, 470, 270, 0.86, 0, 0], [2.95, 478, 262, 0.86, 0, 0], [3.7, 300, 90, 0.9], [4.5, 110, -70, 0.95], [5.3, 0, 0, 1]],
  TURNS: [0.6, 3.05],
  pass: { dur: 3.5, path(t, P, sc) {
    const mo = M['oriental-pied-hornbill'], v = P.v, W = wings(t, mo.PLAN, 0.05, 0.4);
    hideProp(P);
    // almost flat: a small lift on each burst of beats, and a bob on every stroke
    P.y = HH * 0.47 + undulate(t, mo.PLAN, HH * 0.012, HH * 0.012) + 7 * Math.sin(TAU * 3.4 * t) * W.env;
    P.angle = PH_LEVEL + 2 * (1 - W.w) * 0.5 * W.env;
    sweep(P, sc, t / 3.5);
    v.fly = 1; v.w = W.w; v.env = W.env; v.lag = wings(t - 0.1, mo.PLAN, 0.05, 0.4).w; v.fan = 1 - W.env;
    v.b = W.env > 0.5 ? 'flap' : 'glide';
  } },
  outing: { dur: 9.2, path(t, P, sc) {
    const mo = M['oriental-pied-hornbill'], b = beat(t, mo.OUT), v = P.v;
    P.v.idle = S(0, 0.5, t) * S(9.2, 9.2 - 0.5, t);   // the idle stirrings fade in and out, so it starts and ends as drawn
    stay(P, sc); P.m = -1; v.b = b.name; v.w = 0; v.fly = 0; v.head = 0; v.fruit = 0;
    if (b.name === 'peer') {   // peers down twice: the head dips to look, the body leans after it
      const k1 = S(0.1, 0.25, b.t) * S(0.6, 0.45, b.t), k2 = S(0.7, 0.85, b.t) * S(1.25, 1.05, b.t);
      v.head = -10 * k1 - 12 * k2; P.angle = -2 * (k1 + k2);
      v.w = 0.05 * Math.sin(TAU * 1.1 * b.t) * S(1.3, 1.1, b.t);
    } else if (b.name === 'crouch') {
      const k = hump(b.k);
      P.sy = 1 - 0.07 * k; P.sx = 1 + 0.03 * k; P.y += 0.07 * k * 0.25 * sc.sh;
      v.w = -0.4 * S(0.5, 1, b.k);
    } else if (b.name === 'fly') {
      const tt = b.t, [dx, dy, , vy, s] = glide(mo.KEYS, tt), W = wings(tt, mo.FLY, 0.05, 0.4);
      P.x = sc.hx + dx; P.y = sc.hy + dy; P.scale = s;
      const f = facing(tt, -1, mo.TURNS, 0.45), fly = S(0, 0.35, tt) * S(5.3, 4.75, tt);
      // the plucking pause: hovering on quick beats, tipped up
      const pluck = S(2.4, 2.6, tt) * S(3.0, 2.85, tt);
      const fs = sgn(f);
      P.angle = fly * (levelFor(35.8, PH_LEVEL, f) * fs * (1 - 0.6 * pluck) + 2 * (1 - W.w) * 0.5 * W.env * fs + clamp(vy * 0.012, -6, 6) * fs);
      P.y += 5 * Math.sin(TAU * 3.4 * tt) * W.env;   // the bounce of quick beats
      turnTo(P, f);
      const brake = S(4.75, 5.05, tt);
      v.fly = fly; v.w = lerp(lerp(-0.4, W.w, S(0, 0.3, tt)), 0.9, brake); v.env = W.env; v.lag = wings(tt - 0.1, mo.FLY, 0.05, 0.4).w;
      v.brake = brake * S(5.3, 5.1, tt); v.fan = (1 - W.env) * fly + v.brake;
      v.fruit = S(2.7, 2.75, tt);
      v.b = tt > 4.75 ? 'brake' : pluck > 0.5 ? 'pluck' : W.env > 0.5 ? 'flap' : 'glide';
    } else if (b.name === 'settle') {
      const k = b.k, bob = Math.sin(Math.PI * k) * (1 - k * 0.5);
      P.y += 12 * bob; P.sy = 1 - 0.035 * bob; v.w = 0.9 * (1 - S(0, 0.7, k)) - 0.12 * hump(clamp((k - 0.5) / 0.5, 0, 1)); v.fruit = 1;
      P.prop.y += 6 * bob;
    } else if (b.name === 'toss') {   // jerk the head up, the fruit flies, hangs, falls into the open bill; snap back
      const k = b.t;
      v.head = 36 * S(0.0, 0.16, k) * S(1.2, 1.0, k) + 6 * hump(clamp((k - 1.0) / 0.35, 0, 1)) * -1;
      v.open = S(0.45, 0.65, k) * S(1.02, 0.92, k);
      P.y += -10 * hump(clamp(k / 0.3, 0, 1)); P.angle = 3 * hump(clamp(k / 0.3, 0, 1));
      v.fruit = 1;
    } else {   // gulp: the throat swells and the swallow runs down the neck
      v.gulp = hump(b.k); v.head = -4 * hump(b.k);
    }
  } },
  bend(u, v, t, P, o, r) {
    const V = P.v, [al, sd] = axis(u, v, r, 0.38, 0.25, PH_A), fly = V.fly || 0;
    // the bill opens to catch: the lower mandible drops about the gape
    if (V.open) {
      const below = (v - PH_GAPE[1]) - (PH_GAPE[0] - u) * 0.31;   // below the line from the gape to the bill tip
      rot(o, u, v, PH_GAPE[0], PH_GAPE[1], -16 * V.open, S(-0.02, 0.03, below) * S(0.36, 0.3, u), r);
    }
    // the head: level in flight, dipping to peer, thrown up to toss
    const head = S(0.46, 0.38, u) * S(0.5, 0.4, v);
    rot(o, u, v, PH_NECK[0], PH_NECK[1], (V.head || 0) + fly * PH_LEVEL * 0.85 + 2.5 * Math.sin(TAU * 0.8 * t) * (V.idle === undefined ? 1 : V.idle), head, r);
    // the gulp: the throat swells, then the bulge slides down
    if (V.gulp) scl(o, u, v, 0.36, 0.3, 1.0, 1 + 0.25 * V.gulp, box(u, v, 0.3, 0.26, 0.44, 0.42, 0.04));
    // the folded wing swings up over the shoulder and down
    // (on the downstroke the whole flank swings, so the wing shows below the body instead of notching the back)
    const w = V.w || 0, deg = w >= 0 ? -56 * w : -16 * w, low = w >= 0 ? -0.12 : lerp(-0.12, -0.3, -w);
    rot(o, u, v, 0.46, 0.34, deg, S(0.0, 0.12, al) * S(0.74, 0.6, al) * S(low, low + 0.14, sd), r);
    // the tail: fanned in the glide (spread across its axis), lagging the beats
    const tail = S(0.68, 0.8, al);
    if (V.fan) lift(o, PH_A, 0.18 * (V.fan || 0) * sd, tail, r);
    rot(o, u, v, 0.76, 0.72, 8 * (V.lag || 0) * fly - 5 * (V.brake || 0), tail, r);
    // feet tucked into the belly feathers in flight
    const tuck = fly * (1 - (V.brake || 0)), feet = box(u, v, 0.46, 0.68, 0.6, 0.86, 0.03);
    scl(o, u, v, 0.6, 0.64, 1 - 0.92 * tuck, 1 - 0.92 * tuck, feet);
  },
  fx(t, P, sc, E, mode, poseAt) {
    const mo = M['oriental-pied-hornbill'], V = P.v;
    if (mode === 'pass') {
      // two flock-mates above and behind, beating out of phase with it
      // (they gain on it, so they are gone off the right edge with it)
      for (const [dx0, dx1, dy, ph, sz] of [[-760, 120, -330, 1.7, 130], [-1150, -60, -190, 3.9, 110]]) {
        const [x, y] = at(sc, P, 0.5, 0.5), k = t / 3.5;
        mate(E, x + lerp(dx0, dx1, k), y + dy + 16 * Math.sin(TAU * 3.4 * t + ph), sz, TAU * 3.4 * t + ph, 1);
      }
      // yap, yap, yap at the bill on each burst
      let t0 = 0;
      for (const sgm of mo.PLAN) {
        const d = sgm[0] === 'flap' ? sgm[1] / sgm[2] : sgm[1];
        if (sgm[0] === 'flap') for (let j = 0; j < 3; j++) {
          const te = t0 + 0.15 + j * 0.3, age = t - te;
          if (age > 0 && age < 0.28) { const [x, y] = bent(sc, poseAt(te), mo, PH_TIP[0], PH_TIP[1] - 0.03, te); ticks(E, x + 30, y - 10, age, 0.28, 1, 3, 60, 70); }
        }
        t0 += d;
      }
    } else {
      const b = beat(t, mo.OUT), tf = beatStart(mo.OUT, 'fly');
      // the fig twig reaching up from the bottom right corner, grown in while it flies there, gone once it is back
      const grow = S(tf + 0.7, tf + 1.9, t) * S(tf + 4.6, tf + 3.6, t);
      const Qf = poseAt(tf + 2.72), [fx, fy] = bent(sc, Qf, mo, PH_TIP[0] + 0.01, PH_TIP[1] + 0.02, tf + 2.72);
      if (grow > 0.01) {
        const base = [fx + 230, HH + 30], top = [fx + 30, fy - 60], k = grow;
        const pts = [];
        for (let i = 0; i <= 8; i++) { const s = i / 8 * k; pts.push(lerp(base[0], top[0], s) + 40 * Math.sin(Math.PI * s), lerp(base[1], top[1], s)); }
        E.back = true;
        poly(E, pts, 10);
        if (k > 0.6) {
          const kk = S(0.6, 1, k);
          leaf(E, top[0] + 90, top[1] + 150, -40, 56 * kk, true);
          leaf(E, top[0] + 20, top[1] + 280, 30, 50 * kk);
          leaf(E, top[0] + 120, top[1] + 330, -70, 46 * kk, true);
          for (const [ox, oy, rr] of [[60, 84, 20], [100, 60, 18]]) {   // the figs still on the twig
            line(E, top[0] + ox * 0.5, top[1] + oy - 40, top[0] + ox, top[1] + oy - rr, 4);
            disc(E, top[0] + ox, top[1] + oy, rr * kk);
          }
          if (t < tf + 2.72) { line(E, top[0] + 10, top[1] + 30, top[0], top[1] + 60 - 22, 4); disc(E, fx, fy, 22 * kk); }
        }
        E.back = false;
      }
      // the plucked fig: in the bill from the pluck until the toss
      if (b.name === 'fly' && V.fruit > 0.5 || b.name === 'settle' || (b.name === 'toss' && b.t < 0.16)) {
        const tip = bent(sc, P, mo, PH_TIP[0] + 0.01, PH_TIP[1] + 0.02, t);
        disc(E, tip[0], tip[1], 22);
      }
      if (b.name === 'toss') {   // up it goes, hangs, and drops into the gape
        const k = b.t;
        if (k >= 0.16 && k < 1.02) {
          const tip = bent(sc, P, mo, PH_TIP[0] + 0.01, PH_TIP[1], t), gape = bent(sc, P, mo, 0.16, 0.28, t);
          const q = clamp((k - 0.16) / 0.86, 0, 1), rise = HH * 0.11 * 4 * q * (1 - q);
          const x = lerp(tip[0], gape[0], q), y = lerp(tip[1] - 12, gape[1] - 10, q) - rise;
          disc(E, x, y, 22);
          if (q > 0.25 && q < 0.6) { line(E, x - 26, y - 8, x - 40, y - 14, 3); line(E, x + 26, y - 8, x + 40, y - 14, 3); }
        }
      }
      if (b.name === 'gulp') {   // gulp
        const [x, y] = at(sc, P, 0.36, 0.42);
        ticks(E, x - 20, y + 10, b.t, 0.42, -1, 3, 26, 80);
      }
      // a fig dropped from the branch as it takes off (it hides the jump)
      if (t > 1.45 && t < 2.6) {
        const age = t - 1.45, [x, y] = at(sc, poseAt(1.45), 0.36, 0.78);
        blob(E, x - 10, y + 0.5 * 1500 * age * age, 12, 14, 0);
      }
      // the rush of air under its quick beats
      if (b.name === 'fly') for (const te of downbeats(mo.FLY, tf, 0.4, 0.05)) {
        const age = t - te; if (age < 0 || age > 0.35) continue;
        const Q = poseAt(te), [x, y] = at(sc, Q, 0.62, 0.42);
        whoosh(E, x, y, age, 0.35, Q.m, 70 * Q.scale);
      }
    }
  },
};

// ===== Collared kingfisher ==========================================================================================
// Perch and pounce: sits dead still over the mud, bobs its head to judge the distance, drops onto a crab, flies back
// whirring (no gliding) and beats the crab against the branch before swallowing it; calls kee-kee-kee. Facing left;
// the branch (layer 4) stays home.
const KF_A = 56.2 * Math.PI / 180;             // body axis: crown (0.45, 0.18) to the tail tip (0.78, 0.96)
const KF_TIP = [0.05, 0.245], KF_NECK = [0.46, 0.26], KF_SH = [0.53, 0.29], KF_FEET = [0.52, 0.74];
const KF_LEVEL = 42;                           // the drawing turns this much to fly level

/** Pin the kingfisher's bill tip, as bent, to screen (x, y) with the drawing turned by angle. */
function pinTip(sc, P, x, y, angle, t) {
  const o = [0, 0];
  P.angle = angle;
  M['collared-kingfisher'].bend(KF_TIP[0], KF_TIP[1], t, P, o, sc.a.w / sc.a.h);
  pinM(sc, P, KF_TIP[0] + o[0], KF_TIP[1] + o[1], x, y, angle);
}

M['collared-kingfisher'] = {
  facing: 'L', props: [4], size: [0.9, 0.75],
  PASS: [['dive', 0.95], ['strike', 0.5], ['climb', 1.55]],
  OUT: [['watch', 2.3], ['crouch', 0.25], ['dive', 0.85], ['grab', 0.4], ['return', 1.6], ['land', 0.35], ['whack', 2.25],
    ['call', 1.0]],
  pass: { dur: 3, path(t, P, sc) {
    const mo = M['collared-kingfisher'], b = beat(t, mo.PASS), v = P.v, hit = [WW * 0.45, HH * 0.85];
    hideProp(P); P.m = 1; v.b = b.name; v.fly = 1; v.head = 0;
    const dir = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];
    if (b.name === 'dive') {   // wings folded, a dart: the bill leads down the 30-degree line, gathering speed
      const k = b.k, d = 1250 * (1 - (0.7 * k + 0.3 * k * k));
      v.w = -0.1; v.head = 34; v.tuck = 1;
      pinTip(sc, P, hit[0] - dir[0] * d, hit[1] - dir[1] * d, 78 - 4 * k, t);
    } else if (b.name === 'strike') {   // in to the eyes, a beat under, and out with the crab
      const k = b.k, dip = 70 * Math.sin(Math.PI * Math.min(1, k * 1.15));
      v.w = lerp(-0.1, 0.6, S(0.4, 1, k)); v.head = lerp(34, 14, S(0.3, 1, k)); v.tuck = 1;
      // still sliding forward along the dive at first, then lifted out
      const slide = 70 * (1 - (1 - k) * (1 - k)) ;
      pinTip(sc, P, hit[0] + slide * dir[0] + 40 * S(0.5, 1, k), hit[1] + dip * (1 - S(0.6, 1, k)) + 30 * k - 60 * S(0.5, 1, k), lerp(74, 40, ease(S(0.25, 1, k))), t);
    } else {   // whirring out at 15 degrees, crab held high, accelerating away
      const k = b.k, d = 2700 * (0.35 * k + 0.65 * k * k), up = Math.tan(Math.PI / 12);
      const W = wings(b.t, [['flap', 7, 4.5]], 0.6, 0.45);
      v.w = W.w; v.head = 14 - 4 * k; v.tuck = 1;
      const x0 = hit[0] + 70 * dir[0] + 40, y0 = hit[1] + 30 - 60;
      pinTip(sc, P, x0 + d, y0 - d * up - 6 * Math.sin(TAU * 4.5 * b.t), 40 - 12 * S(0, 0.4, k), t);
    }
  } },
  outing: { dur: 9, path(t, P, sc) {
    const mo = M['collared-kingfisher'], b = beat(t, mo.OUT), v = P.v;
    P.v.idle = S(0, 0.5, t) * S(9, 9 - 0.5, t);   // the idle stirrings fade in and out, so it starts and ends as drawn
    stay(P, sc); P.m = -1; v.b = b.name; v.w = 0; v.fly = 0; v.head = 0; v.crab = 0;
    const home = mo.homeTip(sc), crabAt = mo.crabAt(sc);
    if (b.name === 'watch') {   // dead still; three bobs of the head, measuring; one flick of the tail
      v.bob = [0.35, 1.05, 1.75].reduce((s, t0) => s + S(t0, t0 + 0.09, b.t) * S(t0 + 0.42, t0 + 0.3, b.t), 0);
      v.flick = hump(clamp((b.t - 2.1) / 0.3, 0, 1));
    } else if (b.name === 'crouch') {
      const k = b.k;
      P.sy = 1 - 0.06 * hump(k); P.sx = 1 + 0.03 * hump(k); P.y += 0.06 * hump(k) * 0.24 * sc.sh;
      P.angle = -8 * ease(k); v.head = 6 * ease(k); v.bob = 0.6 * ease(k);
    } else if (b.name === 'dive') {   // drops off and plunges, bill first, wings folded
      const k = b.k, q = k * k * (0.6 + 0.4 * k);
      v.w = -0.1; v.fly = S(0, 0.4, k); v.head = lerp(6, 30, ease(k)); v.tuck = S(0, 0.5, k); v.bob = 0.6 * (1 - k);
      const x = lerp(home[0], crabAt[0], q) - 120 * Math.sin(Math.PI * q), y = lerp(home[1], crabAt[1] - 6, q);
      pinTip(sc, P, x, y, lerp(-8, -76, ease(Math.min(1, k * 1.3))), t);
    } else if (b.name === 'grab') {   // bill in the mud, the crab seized; a shove down and back up
      const k = b.k;
      v.w = lerp(-0.1, 0.5, S(0.3, 1, k)); v.fly = 1; v.head = 30; v.tuck = 1; v.crab = S(0.35, 0.45, k);
      pinTip(sc, P, crabAt[0] + 8 * hump(k), crabAt[1] - 6 + 14 * hump(k * 1.4) - 40 * S(0.55, 1, k), -76 + 14 * S(0.5, 1, k), t);
    } else if (b.name === 'return') {   // a different arc home: low to the right, up past the branch, turn, glide in
      const tt = b.t, start = mo.grabEnd(sc);
      const keys = [[0, start[0], start[1], 1, 260, -380], [0.55, sc.hx + 230, sc.hy + 150, 0.94], [1.05, sc.hx + 360, sc.hy - 50, 0.92, 0],
        [1.6, sc.hx, sc.hy, 1]];
      const [x, y, , vy, s] = glide(keys, tt), W = wings(tt, [['flap', 5, 4.2], ['glide', 0.41]], 0.45, 0.45);
      const f = facing(tt, -1, [0.22, 1.05], 0.4), fly = S(1.6, 1.3, tt);
      P.x = x; P.y = y; P.scale = s; v.crab = 1; v.fly = fly; v.tuck = fly; v.head = lerp(30, 14, S(0, 0.3, tt)) * fly;
      v.w = lerp(lerp(0.5, W.w, S(0, 0.2, tt)), 0.9, S(1.15, 1.4, tt) * S(1.6, 1.45, tt));
      P.angle = lerp(-62, 0, S(0, 0.25, tt)) * (1 - S(0.0, 0.5, tt)) + S(0, 0.5, tt) * fly * (levelFor(56.2, KF_LEVEL, f) * sgn(f) + clamp(vy * 0.015, -10, 10) * sgn(f));
      turnTo(P, f);
    } else if (b.name === 'land') {
      const k = b.k, bob = Math.sin(Math.PI * k) * (1 - 0.5 * k);
      P.y += 10 * bob; P.sy = 1 - 0.04 * bob; v.crab = 1; v.w = 0.45 * (1 - S(0, 0.7, k)); P.prop.y += 5 * bob;
    } else if (b.name === 'whack') {
      // hops round to face along the branch, beats the crab on it three times, the whole bird swinging from its feet,
      // swallows it and hops back round
      const T = b.t, [f0, f1] = mo.feetAt(sc), f = facing(T, -1, [0.15, 2.1], 0.3);
      let sw = 0;
      for (const t0 of [0.35, 0.9, 1.45]) {
        const up = S(t0, t0 + 0.25, T) * S(t0 + 0.37, t0 + 0.27, T);          // the wind-up, bill raised
        const down = S(t0 + 0.27, t0 + 0.35, T) * S(t0 + 0.55, t0 + 0.43, T);  // the blow
        sw += up - down;
      }
      const hop = hump(clamp(T / 0.3, 0, 1)) + hump(clamp((T - 1.95) / 0.3, 0, 1));
      v.head = 26 * Math.max(0, sw) + 36 * Math.min(0, sw); v.crab = 1 - S(1.95, 2.05, T); v.gulp = hump(clamp((T - 1.95) / 0.25, 0, 1));
      v.w = 0.35 * hop;
      turnTo(P, f);
      pinM(sc, P, KF_FEET[0], KF_FEET[1], f0, f1 - 22 * hop, -P.m * (6 * Math.max(0, sw) + 7 * Math.min(0, sw)));
      v.hit = sw;
    } else {   // kee-kee-kee-kee: the bill opens on each note, the tail pumps
      const T = b.t;
      v.open = [0.05, 0.25, 0.45, 0.65].reduce((s, t0) => s + hump(clamp((T - t0) / 0.18, 0, 1)), 0);
      v.flick = 0.5 * hump(clamp((T - 0.1) / 0.85, 0, 1)) * Math.sin(TAU * 2.2 * T);
    }
  } },
  homeTip(sc) { const Q = new Ink.Pose(); Q.x = sc.hx; Q.y = sc.hy; return at(sc, Q, KF_TIP[0], KF_TIP[1]); },
  feetAt(sc) { const Q = new Ink.Pose(); Q.x = sc.hx; Q.y = sc.hy; return at(sc, Q, KF_FEET[0], KF_FEET[1]); },
  crabAt(sc) { return [Math.max(150, this.homeTip(sc)[0] - 60), HH - 70]; },
  grabEnd(sc) {   // where the centre is as the grab ends: the return starts there
    const Q = Ink.poseAt('collared-kingfisher', 'outing', beatStart(this.OUT, 'return') - 1e-4);
    return [Q.x, Q.y];
  },
  bend(u, v, t, P, o, r) {
    const V = P.v, [al, sd] = axis(u, v, r, 0.45, 0.18, KF_A), fly = V.fly || 0;
    // the lower mandible drops to call
    if (V.open) rot(o, u, v, 0.33, 0.235, -10 * V.open, S(0.235, 0.265, v) * S(0.36, 0.3, u), r);
    // head bobs (forward and down, held), and the head turns about the neck to aim the bill or swing the crab
    const head = S(0.53, 0.45, u) * S(0.44, 0.34, v);
    shift(o, -0.03 * (V.bob || 0), 0.03 * (V.bob || 0), head);
    const id = V.idle === undefined ? 1 : V.idle;
    rot(o, u, v, KF_NECK[0], KF_NECK[1], (V.head || 0) + 1.5 * Math.sin(TAU * 0.5 * t) * id, head, r);
    // the gulp: a bulge running down the throat
    if (V.gulp) scl(o, u, v, 0.4, 0.33, 1, 1 + 0.2 * V.gulp, box(u, v, 0.34, 0.26, 0.48, 0.42, 0.04));
    // the dotted wing: swung up over the back on the upstroke; the flank swings down on the downstroke
    const w = V.w || 0, deg = w >= 0 ? -60 * w : -18 * w, low = w >= 0 ? -0.08 : lerp(-0.08, -0.26, -w);
    rot(o, u, v, KF_SH[0], KF_SH[1], deg, S(0.02, 0.12, al) * S(0.7, 0.58, al) * S(low, low + 0.12, sd), r);
    // breathing
    scl(o, u, v, 0.5, 0.45, 1 + 0.006 * Math.sin(TAU * 0.7 * t) * id, 1, box(u, v, 0.34, 0.26, 0.66, 0.66));
    // the tail flicks up, lags in flight, spreads to brake
    const tail = S(0.62, 0.74, al);
    rot(o, u, v, 0.71, 0.69, 8 * (V.flick || 0) + 6 * w * fly, tail, r);
    // feet tucked in flight
    const tuck = V.tuck || 0, feet = box(u, v, 0.46, 0.65, 0.58, 0.8, 0.03);
    scl(o, u, v, 0.56, 0.62, 1 - 0.9 * tuck, 1 - 0.9 * tuck, feet);
  },
  fx(t, P, sc, E, mode, poseAt) {
    const mo = M['collared-kingfisher'], V = P.v;
    const tip = () => bent(sc, P, mo, KF_TIP[0], KF_TIP[1], t);
    if (mode === 'pass') {
      const b = beat(t, mo.PASS), hit = [WW * 0.45, HH * 0.85], tS = beatStart(mo.PASS, 'strike');
      // the crab, legs going, held in the bill, dripping (drawn before the water, so it comes up out of it)
      if (t > tS + 0.15) {
        const [x, y] = tip();
        crab(E, x - 4, y + 40, 46, t * 30);
        emit(t, 0.12, 0.5, (i, te, age) => { const [dx, dy] = bent(sc, poseAt(te), mo, KF_TIP[0], KF_TIP[1], te); blob(E, dx - 6, dy + 40 + 900 * age * age, 5, 8); }, tS + 0.2, 2.6);
      }
      // the mangrove water: a line that rises in, takes the plunge, and sinks away
      const level = lerp(HH + 40, hit[1] + 6, S(0, 0.5, t) * S(3, 2.5, t));
      water(E, -20, WW + 20, level, t, 7);
      if (t >= tS) {
        const age = t - tS;
        splash(E, hit[0] + 20, level, age, 0.75, 9, 80, 3);
        ripple(E, hit[0] + 20, level + 4, age, 1.3, 220, 0.18, 3);
      }
      // speed lines along the dive
      if (b.name === 'dive') {
        const [x, y] = tip();
        for (let i = 0; i < 4; i++) { const o = 160 + 90 * i, l = 140 + 60 * b.k; line(E, x - o * 0.866 + (i - 1.5) * 26 * 0.5, y - o * 0.5 - (i - 1.5) * 26 * 0.866, x - (o + l) * 0.866 + (i - 1.5) * 13, y - (o + l) * 0.5 - (i - 1.5) * 22, 4); }
      }
    } else {
      const b = beat(t, mo.OUT), crabAt = mo.crabAt(sc), tg = beatStart(mo.OUT, 'grab') + 0.16;
      // the mudbank: drawn in from the left edge at the start, gone again by the end
      const bank = S(0, 0.8, t) * S(9, 8.2, t);
      if (bank > 0.01) {
        const x1 = lerp(-20, crabAt[0] + 260, bank), y0 = HH - 46, pts = [];
        for (let x = -20; x <= x1; x += 30) pts.push(x, y0 + 8 * Math.sin(x / 70));
        E.back = true; poly(E, pts, 5);
        for (let i = 0; i < 5; i++) { const x = 40 + i * 80; if (x < x1 - 20) line(E, x, y0 + 24, x + 34, y0 + 24, 3); }
        E.back = false;
      }
      // the crab scuttles in sideways and stops; it is seized; then it is in the bill until swallowed
      if (t < tg) {
        const k = S(0.2, 2.2, t), x = lerp(-100, crabAt[0], k - 0.03 * Math.sin(TAU * 1.5 * t) * (1 - k));
        crab(E, x, crabAt[1] - 14, 30, t * (k < 1 ? 26 : 6));
      } else if (V.crab > 0.5) {
        const [x, y] = tip();
        crab(E, x - 4 * P.m, y + 26, 30, t * 24);
      }
      // a spatter of mud as the bill goes in
      if (t > tg - 0.1 && t < tg + 0.6) {
        const age = t - tg + 0.1;
        for (let i = 0; i < 6; i++) { const a = Math.PI * (0.15 + 0.7 * rnd(i, 4)), sp = 260 + 160 * rnd(i, 5); disc(E, crabAt[0] - Math.cos(a) * sp * age, crabAt[1] - 20 - Math.sin(a) * sp * age + 700 * age * age, 6 * (1 - age / 0.7)); }
        puff(E, crabAt[0], crabAt[1] - 10, 50, age, 0.7, 0, 0.3);
      }
      // the whir of its wings on the way back
      if (b.name === 'return') emit(t, 0.24, 0.3, (i, te, age) => { const Q = poseAt(te), [x, y] = at(sc, Q, 0.62, 0.36); whoosh(E, x, y, age, 0.3, Q.m, 60); }, beatStart(mo.OUT, 'return'), beatStart(mo.OUT, 'return') + 1.15);
      // bits of shell flying at each blow
      if (b.name === 'whack') for (const t0 of [0.7, 1.25, 1.8]) {
        const age = b.t - t0; if (age < 0 || age > 0.45) continue;
        const [x, y] = bent(sc, poseAt(t - age), mo, KF_TIP[0], KF_TIP[1], t - age);
        for (let i = 0; i < 6; i++) { const a = Math.PI * (1.05 + 0.9 * rnd(i, t0 * 10)), sp = 320 + 220 * rnd(i, 7); disc(E, x + Math.cos(a) * sp * age, y + 24 + Math.sin(a) * sp * age + 1100 * age * age, 6); }
        if (age < 0.16) for (let i = 0; i < 4; i++) { const a = Math.PI * (1.1 + 0.27 * i); line(E, x + Math.cos(a) * 46, y + 24 + Math.sin(a) * 46, x + Math.cos(a) * (70 + 120 * age / 0.16), y + 24 + Math.sin(a) * (70 + 120 * age / 0.16), 5); }
      }
      // kee-kee-kee-kee
      if (b.name === 'call') for (const t0 of [0.05, 0.25, 0.45, 0.65]) {
        const age = b.t - t0; if (age < 0 || age > 0.28) continue;
        const [x, y] = bent(sc, P, mo, KF_TIP[0] + 0.02, KF_TIP[1], t);
        ticks(E, x - 10, y, age, 0.28, -1, 2, 34, 36);
      }
    }
  },
};

// ===== Large flying fox =============================================================================================
// A 1.5 m wingspan on slow, steady rowing beats, no gliding; the wings narrow on each upstroke. Streams out at dusk.
// Lands upright on a branch tip, flips to hang head-down, fans its wings to cool. Drawn from the front, wings open.
const FF_FEET = [0.5, 0.86], FF_SH = 0.06;     // the feet; the half-width of the body (the wings start beyond it)

/** A far-off flying fox in the dusk stream: an "m" of wings at beat phase ph. */
function batlet(E, x, y, size, ph) {
  const up = Math.cos(ph);
  poly(E, [x - size, y - size * 0.45 * up, x - size * 0.5, y + size * 0.12 - size * 0.12 * up, x, y - size * 0.04,
    x + size * 0.5, y + size * 0.12 - size * 0.12 * up, x + size, y - size * 0.45 * up], 4);
  blob(E, x, y + size * 0.02, size * 0.16, size * 0.3, 0);
}
/** The branch it lands on, top right: drawn in from the right edge (k 0..1), with a few leaves. */
function ffBranch(E, k, x0, y0) {
  if (k <= 0.01) return;
  const x1 = WW + 30, xa = lerp(x1, x0 - 200, k), pts = [];
  for (let x = x1; x >= xa - 1; x -= 40) pts.push(x, y0 + 6 * Math.sin(x / 90) + 0.00004 * (x - x0) * (x - x0));
  E.back = true;
  poly(E, pts, 12);
  for (const [dx, a, sz] of [[260, 40, 50], [380, -30, 44], [-150, 150, 40]]) if (xa < x0 + dx) leaf(E, x0 + dx, y0 + 40, a, sz * S(x0 + dx, x0 + dx - 120, xa), true);
  E.back = false;
}

M['large-flying-fox'] = {
  facing: 'F', size: [0.95, 0.75], maxScale: 1.05,
  OUT: [['drop', 0.6], ['loop', 3.6], ['flip', 0.75], ['fan', 1.65], ['release', 0.8], ['home', 1.6]],
  BRANCH: [1480, 300],
  pass: { dur: 5, path(t, P, sc) {
    const v = P.v, ph = TAU * 2 * t;   // rowing at 2 beats a second, never gliding
    // flying slightly towards you: it grows as it crosses; banked into the way it goes
    P.scale = lerp(0.9, 1.05, t / 5);
    v.w = Math.cos(ph); v.fold = 0.18 * Math.max(0, Math.cos(ph - 0.5));
    P.y = HH * 0.46 + 70 * Math.sin(Math.PI * t / 5 - 0.4) - 14 * v.w;   // the body bobs against the wings
    P.angle = 4 + 1.5 * Math.sin(ph + 1);
    sweep(P, sc, t / 5, 4);
    v.b = 'row';
  } },
  outing: { dur: 9, path(t, P, sc) {
    const mo = M['large-flying-fox'], b = beat(t, mo.OUT), v = P.v, [bx, by] = mo.BRANCH;
    P.v.idle = S(0, 0.5, t) * S(9, 9 - 0.5, t);   // the idle stirrings fade in and out, so it starts and ends as drawn
    v.b = b.name; v.w = 0; v.fold = 0;
    const row = tt => Math.cos(TAU * 2 * tt);
    if (b.name === 'drop' || b.name === 'loop') {
      // drops off its spot with the wings half shut, then rows one wide circuit (small on the far side of it) and comes
      // in to the branch tip, wings shutting to brake
      const tt = t, sit = [bx, by - (FF_FEET[1] - 0.5) * sc.sh * 0.6];
      const keys = [[0, sc.hx, sc.hy, 1], [0.6, sc.hx + 10, sc.hy + 65, 1, 30, 180], [1.5, sc.hx + 330, sc.hy + 230, 1.05],
        [2.5, sc.hx + 720, sc.hy + 60, 0.88], [3.3, sc.hx + 470, sc.hy - 200, 0.7], [4.2, sit[0], sit[1], 0.6]];
      const [x, y, vx, , s] = glide(keys, tt);
      P.x = x; P.y = y; P.scale = s;
      const k0 = S(0, 0.35, tt), rowOn = S(0.45, 0.75, tt) * S(4.2, 3.8, tt);
      v.w = lerp(0.35 * k0, row(tt - 0.45), rowOn) * (1 - S(3.85, 4.2, tt)) + 0.3 * S(3.85, 4.2, tt);
      const rowIn = S(0.45, 0.75, tt), rowOut = S(4.2, 3.7, tt);
      v.fold = lerp(0.5 * k0, 0.16 * Math.max(0, row(tt - 0.7)), rowIn) * rowOut + 0.55 * (1 - rowOut);
      P.y -= 10 * v.w * rowOn;
      P.angle = clamp(vx * 0.012, -9, 9) * (1 - S(3.7, 4.2, tt));
    } else if (b.name === 'flip') {   // upright on the branch, then over about its feet to hang head-down
      const k = b.k;
      P.scale = 0.6; v.fold = 0.55 + 0.1 * ease(k); v.w = 0.3 * (1 - k) - 0.2 * hump(k);
      pinM(sc, P, FF_FEET[0], FF_FEET[1], bx, by, 180 * ease(S(0.15, 1, k)) + 8 * hump(S(0, 0.3, k)) * -1, 'F');
    } else if (b.name === 'fan') {   // hanging, fanning its half-open wings to cool; it swings a little on its feet
      const T = b.t, fan = S(0, 0.3, T) * S(1.65, 1.35, T);
      P.scale = 0.6; v.fold = 0.65 - 0.4 * fan * (0.5 + 0.5 * Math.sin(TAU * 1.3 * T - Math.PI / 2)); v.w = -0.1 * fan;
      pinM(sc, P, FF_FEET[0], FF_FEET[1], bx, by, 180 + 4 * Math.sin(TAU * 0.6 * T) * fan, 'F');
    } else if (b.name === 'release') {   // lets go: drops, turning upright about its middle as it falls, the wings opening
      const k = b.k;
      P.x = bx - 160 * k * k; P.y = by + (FF_FEET[1] - 0.5) * sc.sh * 0.6 + 260 * k * k; P.angle = 180 * (1 - ease(k));
      P.scale = lerp(0.6, 0.68, k); v.fold = lerp(0.65, 0.1, S(0.2, 0.9, k)); v.w = lerp(0, row(t - 7.25), S(0.5, 1, k));
    } else {   // rows home, growing as it comes near, and spreads still
      const T = b.t, st = mo.releaseEnd(sc);
      const keys = [[0, st[0], st[1], st[2], st[3], st[4]], [0.8, sc.hx + 260, sc.hy + 40, 0.86], [1.6, sc.hx, sc.hy, 1]];
      const [x, y, vx, , s] = glide(keys, T);
      P.x = x; P.y = y; P.scale = s;
      const on = S(1.6, 1.1, T), inn = S(0, 0.4, T);
      v.w = row(t - 7.25) * on; v.fold = (0.1 * (1 - inn) + 0.16 * Math.max(0, row(t - 7.5)) * inn) * on;
      P.y -= 10 * v.w * on * inn; P.angle = clamp(vx * 0.012, -9, 9) * on * inn;
    }
  } },
  releaseEnd(sc) {   // the pose as it lets go of the fall: the row home starts from there, at that speed
    const T = beatStart(this.OUT, 'home'), A = Ink.poseAt('large-flying-fox', 'outing', T - 0.02), B = Ink.poseAt('large-flying-fox', 'outing', T - 1e-4);
    return [B.x, B.y, B.scale, (B.x - A.x) / 0.0199, (B.y - A.y) / 0.0199];
  },
  bend(u, v, t, P, o, r) {
    const V = P.v, w = V.w || 0, fold = V.fold || 0, d = Math.abs(u - 0.5), side = u < 0.5 ? -1 : 1;
    // each wing turns about its shoulder, more towards the tip (the arm curves): up on the upstroke, down on the down
    const arm = S(FF_SH, 0.3, d), deg = (w >= 0 ? 26 * w : 17 * w) * -side;
    rot(o, u, v, 0.5 + side * FF_SH, 0.33, deg, arm, r);
    // folding: the wing draws in towards the body and droops (the upstroke narrowing, landing, hanging)
    o[0] -= side * (d - FF_SH) * fold * S(FF_SH, FF_SH + 0.12, d);
    o[1] += 0.06 * fold * S(FF_SH, 0.35, d);
    // the head looks about, the ears twitch, it breathes
    const head = box(u, v, 0.42, 0.0, 0.58, 0.34, 0.03), id = V.idle === undefined ? 1 : V.idle;
    rot(o, u, v, 0.5, 0.32, (5 * Math.sin(TAU * 0.4 * t) + 3 * Math.sin(TAU * 1.1 * t)) * id, head, r);
    shift(o, 0.004 * Math.sin(TAU * 3 * t) * id, 0, box(u, v, 0.43, 0.0, 0.57, 0.1, 0.02));
    scl(o, u, v, 0.5, 0.6, 1 + 0.025 * Math.sin(TAU * 0.9 * t) * id, 1, box(u, v, 0.44, 0.35, 0.56, 0.85, 0.02));
  },
  fx(t, P, sc, E, mode, poseAt) {
    const mo = M['large-flying-fox'], V = P.v;
    if (mode === 'pass') {
      // the dusk stream: eight tiny flying foxes far behind, rising out across the top left corner, slower than it
      E.back = true;
      for (let i = 0; i < 8; i++) {
        const t0 = 0.35 + 0.2 * i + 0.08 * rnd(i, 2), k = (t - t0) / 3.0;
        if (k <= 0 || k >= 1) continue;
        const x = lerp(-40, 760, k) + 50 * (rnd(i, 3) - 0.5), y = lerp(470, -40, k) + 60 * (rnd(i, 4) - 0.5);
        batlet(E, x, y, 26 + 10 * rnd(i, 5), TAU * 2.6 * t + i * 1.9);
      }
      E.back = false;
    } else {
      const b = beat(t, mo.OUT), [bx, by] = mo.BRANCH, tf = beatStart(mo.OUT, 'fan');
      ffBranch(E, S(1.2, 2.6, t) * S(9, 8.2, t), bx, by);
      // two figs drop while it hangs
      for (const [te, dx] of [[tf + 0.35, -18], [tf + 1.05, 22]]) {
        const age = t - te; if (age < 0 || age > 1.5) continue;
        const [hx, hy] = at(sc, poseAt(te), 0.5, 0.2), y = hy + 30 + 0.5 * 1400 * age * age;
        if (y < HH + 40) { blob(E, hx + dx, y, 16, 19, 0); line(E, hx + dx, y - 19, hx + dx + 4, y - 30, 3); }
      }
      // the landing shakes the branch tip: a twig of bark dust
      const tl = beatStart(mo.OUT, 'flip') - 0.25;
      if (t > tl && t < tl + 0.7) { puff(E, bx - 30, by + 10, 40, t - tl, 0.7, -40, -0.5); puff(E, bx + 40, by + 10, 34, t - tl, 0.7, 40, -0.5); }
      // the fanning stirs the air
      if (b.name === 'fan') emit(b.t, 0.77, 0.6, (i, te, age) => {
        for (const sd of [-1, 1]) { const [x, y] = at(sc, P, 0.5 + sd * 0.42, 0.55); arc(E, x + sd * 30, y, 50 + 80 * age, sd > 0 ? -40 : 140, 80, 5 * (1 - age / 0.6) + 1); }
      }, 0.2, 1.5);
    }
  },
};

// ===== Rajah Brooke's birdwing ======================================================================================
// Fast and bird-like, a few beats then a long flat glide. Spirals down in tight circles before it settles, flutters
// nervously on landing, then rests flat with the forewings swept back. Drawn from above, head at the top.
const BW_ROOT = 0.43;                          // the wing roots' height

/** A dust mote curling into a little vortex behind a beat. */
function swirl(E, x, y, age, life, size, turn) {
  const k = clamp(age / life, 0, 1);
  if (k >= 1) return;
  const r = size * (0.4 + 0.8 * k);
  arc(E, x, y, r, turn * (200 + 260 * k), 200 * (1 - 0.5 * k), 3 * (1 - k) + 1);
  const a = (turn * (200 + 260 * k) + 200 * (1 - 0.5 * k)) * Math.PI / 180;
  disc(E, x + r * Math.cos(a), y + r * Math.sin(a), 5 * (1 - k) + 2);
}

M['rajah-brookes-birdwing'] = {
  facing: 'U', size: [0.5, 0.4], maxScale: 1.05,
  PLAN: [['flap', 3, 3.2], ['glide', 0.9], ['flap', 3, 3.2], ['glide', 0.725]],
  OUT: [['lift', 1.0], ['spiral', 3.6], ['flutter', 1.3], ['settle', 1.4], ['burst', 1.7]],
  WET: [700, 840],
  pass: { dur: 3.5, path(t, P, sc) {
    const mo = M['rajah-brookes-birdwing'], v = P.v, W = wings(t, mo.PLAN, 0, 0.5);
    // head first along a gentle S through the upper half; each beat surges it forward, the glide coasts
    const q = t / 3.5, beatsDone = clamp(t * 3.2, 0, 3) + clamp((t - 1.8375) * 3.2, 0, 3);
    v.w = W.w; v.env = W.env; v.lag = wings(t - 0.05, mo.PLAN, 0, 0.5).w;
    P.y = HH * 0.36 + 120 * Math.sin(TAU * (q - 0.15));
    const dy = 120 * TAU / 3.5 * Math.cos(TAU * (q - 0.15));
    P.angle = 90 + 6 * Math.sin(TAU * 1.3 * t + 0.6) - Math.atan2(-dy, 1200) * 180 / Math.PI;
    P.scale = 1 - 0.04 * Math.max(0, W.w);
    sweep(P, sc, q + 0.008 * (beatsDone - 6 * q), 8);
    v.b = W.env > 0.5 ? 'beat' : 'glide';
  } },
  outing: { dur: 9, path(t, P, sc) {
    const mo = M['rajah-brookes-birdwing'], b = beat(t, mo.OUT), v = P.v, [wx, wy] = mo.WET;
    P.v.idle = S(0, 0.5, t) * S(9, 9 - 0.5, t);   // the idle stirrings fade in and out, so it starts and ends as drawn
    v.b = b.name; v.w = 0;
    const c0 = [1000, 400], R0 = 110, ts = beatStart(mo.OUT, 'spiral');
    const turns = 2.5, Dsp = 3.6, g = k => 1 - Math.pow(1 - k, 1.6), om0 = TAU * turns * 1.6 / Dsp;
    if (b.name === 'lift') {   // a fast take-off up to the top centre, beating, shrinking as it rises away
      const T = b.t, keys = [[0, sc.hx, sc.hy, 1], [1.0, c0[0], c0[1] - R0, 0.5, R0 * om0, 30]];
      const [x, y, , , s] = glide(keys, T), W = wings(T, [['flap', 3, 3.2], ['glide', 0.0625]], 0, 0.5);
      P.x = x; P.y = y; P.scale = s * (1 - 0.04 * Math.max(0, W.w)); v.w = W.w;
      P.angle = 90 * S(0.15, 1, T);
    } else if (b.name === 'spiral') {   // two and a half tight turns down onto the wet ground, wings flat, getting smaller
      const k = b.t / Dsp, th = TAU * turns * g(k), R = R0 * (1 - k) * (1 - 0.3 * k);
      const cx = lerp(c0[0], wx, ease(k)), cy = lerp(c0[1], wy, ease(k));
      P.x = cx + R * Math.sin(th); P.y = cy - R * Math.cos(th); P.scale = lerp(0.5, 0.42, k);
      P.angle = 90 + th * 180 / Math.PI;
      v.w = 0.25 * hump(clamp(k * 6 - 2, 0, 1)) + 0.25 * hump(clamp(k * 6 - 3.6, 0, 1));   // a beat now and then
    } else if (b.name === 'flutter') {   // down: a nervous flutter, shuffling round to face up the slope
      const T = b.t, nerv = S(0, 0.15, T) * S(1.3, 1.0, T);
      P.x = wx + 6 * Math.sin(TAU * 2.3 * T) * nerv; P.y = wy; P.scale = 0.42;
      P.angle = 990 + 90 * S(0.1, 1.15, T) + 7 * Math.sin(TAU * 1.7 * T) * nerv;
      v.flut = nerv * (0.6 + 0.4 * Math.sin(TAU * 0.9 * T)); v.ph = TAU * 3.6 * T;
    } else if (b.name === 'settle') {   // flat, still, forewings swept back over the hindwings; a slow bask
      const T = b.t;
      P.x = wx; P.y = wy; P.scale = 0.42; P.angle = T < 0.7 ? 1080 : 0;   // a whole number of turns: no visible change
      v.cut = Math.abs(T - 0.7) < 0.05;
      v.sweep = S(0.1, 0.5, T) * S(1.4, 1.15, T); v.w = 0.18 * hump(clamp((T - 0.55) / 0.6, 0, 1));
    } else {   // and a straight, fast burst home
      const T = b.t, keys = [[0, wx, wy, 0.42], [1.7, sc.hx, sc.hy, 1]];
      const [x, y, , , s] = glide(keys, T), W = wings(T, [['flap', 4, 3.4], ['glide', 0.524]], 0, 0.5);
      P.x = x; P.y = y; P.scale = s * (1 - 0.04 * Math.max(0, W.w)); v.w = W.w;
      P.angle = 5 * Math.sin(TAU * 0.8 * T) * S(1.7, 1.2, T);
    }
  } },
  bend(u, v, t, P, o, r) {
    const V = P.v, d = Math.abs(u - 0.5), side = u < 0.5 ? -1 : 1, w = Math.max(0, V.w || 0);
    const wing = S(0.035, 0.09, d), fore = S(0.58, 0.5, v), hind = 1 - fore;
    // a beat: the wings swing up out of the picture and draw in towards the body (to about 45% of their width), the
    // hindwings a moment behind the forewings
    const lag = Math.max(0, V.lag === undefined ? w : V.lag);
    o[0] -= (u - 0.5) * 0.55 * (w * fore + lag * hind) * wing;
    // the nervous flutter: quick, shallow, to 80% width
    if (V.flut) o[0] -= (u - 0.5) * 0.2 * V.flut * (0.5 + 0.5 * Math.sin(V.ph)) * wing;
    // at rest the forewings sweep back over the hindwings
    if (V.sweep) rot(o, u, v, 0.5 + side * 0.03, BW_ROOT, -side * 6 * V.sweep, wing * fore, r);
    // the antennae feel about; the abdomen sways
    const id = V.idle === undefined ? 1 : V.idle;
    rot(o, u, v, 0.5, 0.33, (4 * Math.sin(TAU * 0.7 * t) + 2 * Math.sin(TAU * 1.9 * t)) * id, box(u, v, 0.4, 0.0, 0.6, 0.3, 0.03), r);
    rot(o, u, v, 0.5, 0.5, 3 * Math.sin(TAU * 0.5 * t + 1) * id, box(u, v, 0.46, 0.6, 0.54, 0.95, 0.03), r);
  },
  fx(t, P, sc, E, mode, poseAt) {
    const mo = M['rajah-brookes-birdwing'], V = P.v;
    if (mode === 'pass') {
      // sunlit motes curling into little vortices off the wing tips behind each beat
      for (const te of downbeats(mo.PLAN, 0, 0.5, 0)) {
        const age = t - te; if (age < 0 || age > 0.8) continue;
        const Q = poseAt(te);
        for (const [u, sd] of [[0.06, -1], [0.94, 1]]) {
          const [x, y] = at(sc, Q, u, 0.3);
          swirl(E, x - 120 * age, y + sd * 30 * age, age, 0.8, 46, sd);
          swirl(E, x - 60 - 200 * age, y + sd * (70 + 50 * age), age, 0.8, 26, -sd);
          for (let j = 0; j < 3; j++) disc(E, x - 40 - (90 + 50 * j) * age - 30 * j, y + sd * (20 + 40 * j + 30 * age), (5 - j) * (1 - age / 0.8) + 1);
        }
      }
    } else {
      const b = beat(t, mo.OUT), [wx, wy] = mo.WET, tt = beatStart(mo.OUT, 'flutter');
      // the wet patch on the ground: a dark seep that soaks in, gone again by the end
      const wet = S(1.6, 3.4, t) * S(8.9, 8.0, t);
      if (wet > 0.01) {
        const pts = [];
        for (let i = 0; i < 24; i++) { const a = TAU * i / 24, rr = 1 + 0.12 * Math.sin(3 * a + 1) + 0.08 * Math.sin(5 * a); pts.push(wx + 240 * wet * rr * Math.cos(a), wy + 30 + 80 * wet * rr * Math.sin(a)); }
        E.back = true; poly(E, pts, 0, true, 3, 0.35); E.back = false;
      }
      // rings where it touches down, and smaller ones from the flutter
      if (t > tt - 0.25) {
        if (t < tt + 0.95) ripple(E, wx, wy + 30, t - tt + 0.25, 1.2, 160, 0.33, 3);
        if (b.name === 'flutter') emit(b.t, 0.35, 0.7, (i, te, age) => ripple(E, wx + (i % 2 ? 60 : -60), wy + 40, age, 0.7, 70, 0.33, 1), 0.1, 1.0);
      }
      // a dotted trail fading behind it down the spiral
      if (b.name === 'spiral' || b.name === 'lift') emit(t, 0.12, 0.7, (i, te, age) => {
        const [x, y] = at(sc, poseAt(te), 0.5, 0.9);
        disc(E, x, y, 6 * (1 - age / 0.7) + 1);
      }, 0.5, tt - 0.4);
      // the burst home throws up a few motes
      if (b.name === 'burst') emit(b.t, 0.3, 0.8, (i, te, age) => {
        for (const sd of [-1, 1]) swirl(E, wx + sd * (120 + 60 * age), wy - 40 - 200 * te - 50 * age, age, 0.8, 26, sd);
      }, 0, 1.0);
    }
  },
};

})();
