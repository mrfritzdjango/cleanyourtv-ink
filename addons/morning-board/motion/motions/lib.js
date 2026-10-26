/* Helpers every show uses. Loaded after engine.js and before the motions/*.js files; everything here is global. */
'use strict';
var { TAU, clamp, S, lerp, frac, sn, cs, box, rnd, surge } = Ink.util;
var M = Ink.MOTIONS, WW = Ink.W, HH = Ink.H, FRAME = Ink.FRAME;

// ---------- time

/** Beats of a choreography: [[name, seconds], ...] -> { name, k (0..1 through it), i, t (seconds into it), d }. */
function beat(t, list) {
  let t0 = 0;
  for (let i = 0; i < list.length; i++) {
    const [name, d] = list[i];
    if (t < t0 + d || i === list.length - 1) return { name, k: clamp((t - t0) / d, 0, 1), i, t: t - t0, d };
    t0 += d;
  }
}
/** Seconds from the start to the beginning of the named beat. */
function beatStart(list, name) { let t0 = 0; for (const [n, d] of list) { if (n === name) return t0; t0 += d; } return t0; }
const total = list => list.reduce((s, b) => s + b[1], 0);
/** Snap t to whole frames (an e-ink step). */
const step = (t, frames = 1) => Math.floor(t / (FRAME * frames) + 1e-6) * FRAME * frames;
/** A square wave: 1 for the first `duty` of each period. */
const square = (t, period, duty = 0.5) => (frac(t / period) < duty ? 1 : 0);
/** 0..1..0 once over k in 0..1. */
const hump = k => Math.sin(Math.PI * clamp(k, 0, 1));
const ease = k => S(0, 1, k);

// ---------- paths

/** A pass at progress q (0 off the left edge, 1 off the right edge), going right. */
function cross(P, sc, q) { P.x = -sc.ext + (WW + 2 * sc.ext) * q; P.m = 1; }
/** The centre height that puts a standing animal's feet near the bottom of the screen. */
const ground = sc => HH - sc.sh / 2 - 24;
/** Moves P from the home spot by (dx, dy), facing m; for outings. */
function fromHome(P, sc, dx, dy, m) { P.x = sc.hx + dx; P.y = sc.hy + dy; if (m) P.m = m; }
/** An outing out and back along x, forward first (ahead 1 right, -1 left), reach 0..1 of the room. */
function roam(P, sc, q, ahead = 1, reach = 1) {
  const s = Math.sin(TAU * q), c = Math.cos(TAU * q);
  const far = ahead > 0 ? sc.right : sc.left, back = ahead > 0 ? sc.left : sc.right;
  P.x = sc.hx + ahead * reach * (s > 0 ? s * far : s * back); P.y = sc.hy; P.m = c >= 0 ? ahead : -ahead;
}
/** The x the outing can reach: frac -1..1 of the room to the left (negative) or right (positive). */
const reachX = (sc, f) => sc.hx + (f >= 0 ? f * sc.right : f * sc.left);
const reachY = (sc, f) => sc.hy + (f >= 0 ? f * sc.down : f * sc.up);
/** The prop stays at home (an outing: the branch the bird left). */
function stay(P, sc) { P.prop = { x: sc.hx, y: sc.hy, scale: sc.homeScale || 1, sx: 1, sy: 1, angle: 0, mirror: false, hidden: false }; }
function hideProp(P) { P.prop = { x: 0, y: 0, scale: 1, sx: 1, sy: 1, angle: 0, mirror: false, hidden: true }; }
/** The pose's own copy, for a prop that goes with the animal but should not bend. */
function propWith(P, extra = {}) { P.prop = Object.assign({ x: P.x, y: P.y, scale: P.scale, sx: P.sx, sy: P.sy, angle: P.angle, mirror: P.mirror, hidden: false }, extra); }
/** Where drawing point (u, v) is on screen now (unbent). */
const at = (sc, P, u, v) => Ink.pointOf(sc, P, u, v);
/** Place the drawing so its point (u, v) is at screen (x, y), turned by angle about that point. */
const pin = (sc, P, u, v, x, y, angle) => Ink.pin(sc, P, u, v, x, y, angle);

// ---------- bends (all in drawing units; r = width / height)

/** Turn the region weighted w about (pu, pv) by deg. */
function rot(o, u, v, pu, pv, deg, w, r) {
  if (!(w > 0) || !deg) return;
  const a = deg * w * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const dx = (u - pu) * r, dy = v - pv;
  o[0] += ((c - 1) * dx - s * dy) / r; o[1] += s * dx + (c - 1) * dy;
}
/** Scale the region weighted w about (pu, pv). */
function scl(o, u, v, pu, pv, sx, sy, w) { if (!(w > 0)) return; o[0] += (u - pu) * (sx - 1) * w; o[1] += (v - pv) * (sy - 1) * w; }
function shift(o, du, dv, w = 1) { if (!(w > 0)) return; o[0] += du * w; o[1] += dv * w; }
/** A travelling wave across the region: offset along y (or x) of amp, k waves per unit of `along`, at hz. */
function wave(o, along, t, amp, k, hz, w, axis = 1, phase = 0) { if (!(w > 0)) return; o[axis] += amp * w * Math.sin(TAU * (k * along - hz * t) + phase); }

// ---------- effects (design px, left to right). E.back = true while pushing marks that go behind the animal.

function push(E, e) { if (E.back) e.b = 1; E.push(e); }
const circle = (E, x, y, r, w = 3) => push(E, { c: [x, y, r], w });
const disc = (E, x, y, r) => push(E, { c: [x, y, r], w: 0 });
const line = (E, x1, y1, x2, y2, w = 3) => push(E, { l: [x1, y1, x2, y2], w });
const oval = (E, x, y, rx, ry, deg = 0, w = 3) => push(E, { e: [x, y, rx, ry, deg], w });
const blob = (E, x, y, rx, ry, deg = 0) => push(E, { e: [x, y, rx, ry, deg], w: 0 });
const arc = (E, x, y, r, from, sweep, w = 3) => push(E, { a: [x, y, r, from, sweep], w });
const cloud = (E, x, y, r, level) => { if (level > 0.02 && r > 1) push(E, { d: [x, y, r, clamp(level, 0, 1)] }); };
/** A path through [x, y, x, y, ...]: fill 0 none, 1 ink, 2 paper, 3 dots (lv the dot size). */
const poly = (E, pts, w = 3, closed = false, fill = 0, lv = 0.4) => push(E, { p: pts.map(n => Math.round(n * 10) / 10), w, z: closed ? 1 : 0, f: fill, lv });

/** Calls fn(i, te, age) for every emission (one each `every` s from `from`, until `until`) still alive at t. */
function emit(t, every, life, fn, from = 0, until = 1e9) {
  const last = Math.floor((Math.min(t, until) - from) / every);
  for (let i = Math.max(0, Math.floor((t - from - life) / every)); i <= last; i++) {
    const te = from + i * every, age = t - te;
    if (te <= until && age >= 0 && age < life) fn(i, te, age);
  }
}
/** A puff of dust, sand or silt: grows and thins out over its life. */
function puff(E, x, y, size, age, life, drift = 0, rise = 0.4) {
  const k = clamp(age / life, 0, 1);
  cloud(E, x + drift * k, y - size * rise * k, size * (0.5 + 0.9 * k), 0.8 * (1 - k));
}
/** A short column of bubbles rising from (x, y), emitted every `every` s. */
function bubbles(E, t, x, y, every, life, n = 3, rise = 260, seed = 0, from = 0, until = 1e9) {
  emit(t, every, life, (i, te, age) => {
    for (let j = 0; j < n; j++) {
      const a = age - j * 0.12; if (a < 0) continue;
      const r = 5 + 8 * rnd(i * 7 + j, seed);
      circle(E, (typeof x === 'function' ? x(te) : x) + 14 * Math.sin(a * 6 + j + i), (typeof y === 'function' ? y(te) : y) - rise * a / life - j * 20, r, 3);
    }
  }, from, until);
}
/** A leaf: an ink-edged oval with a midrib, turned by deg. */
function leaf(E, x, y, deg, size = 22, filled = false) {
  if (filled) blob(E, x, y, size, size * 0.42, deg); else oval(E, x, y, size, size * 0.42, deg, 3);
  const a = deg * Math.PI / 180;
  line(E, x - Math.cos(a) * size, y - Math.sin(a) * size, x + Math.cos(a) * size * 0.9, y + Math.sin(a) * size * 0.9, 2);
}
/** A leaf falling from (x, y) since te, swaying side to side in steps. */
function fallingLeaf(E, x, y, age, seed = 0, size = 22, speed = 160) {
  const sway = Math.sin(age * 3.2 + seed * 2) * 50;
  leaf(E, x + sway + age * 30, y + age * speed, Math.sin(age * 3.2 + seed * 2) * 40 + seed * 30, size, rnd(seed, 3) > 0.6);
}
/** A splash: droplets flying out on arcs from (x, y), plus a crown, over `life` s. */
function splash(E, x, y, age, life, n = 7, size = 90, seed = 0) {
  const k = clamp(age / life, 0, 1);
  for (let i = 0; i < n; i++) {
    const ang = Math.PI * (0.15 + 0.7 * (i + 0.5) / n) + (rnd(i, seed) - 0.5) * 0.3;
    const v = size * (1.4 + rnd(i + 9, seed));
    const dx = -Math.cos(ang) * v * k * 2, dy = -Math.sin(ang) * v * k * 2 + 900 * k * k * life * life * 0.5;
    if (k < 0.95) blob(E, x + dx, y + dy, 7 + 5 * rnd(i, seed + 1), 10 + 6 * rnd(i, seed + 1), -ang * 180 / Math.PI + 90);
  }
  if (k < 0.5) { const h = size * 0.9 * hump(k * 2); for (let i = -2; i <= 2; i++) line(E, x + i * size * 0.25, y, x + i * size * 0.42, y - h * (1 - Math.abs(i) * 0.2), 4); }
}
/** Ripple rings spreading from (x, y), flattened for a water surface seen side-on. */
function ripple(E, x, y, age, life, r = 120, flat = 0.25, rings = 2) {
  const k = clamp(age / life, 0, 1);
  for (let i = 0; i < rings; i++) { const kk = k - i * 0.2; if (kk > 0 && kk < 1) oval(E, x, y, r * (0.3 + kk), r * (0.3 + kk) * flat, 0, 3 * (1 - kk) + 1); }
}
/** A wavy line from x0 to x1 at y (a water surface, a current), amp px, wavelength wl px, drifting with phase. */
function wavy(E, x0, x1, y, amp = 10, wl = 160, phase = 0, w = 3) {
  const pts = [];
  for (let x = x0; x <= x1 + 1; x += wl / 8) pts.push(x, y + amp * Math.sin(TAU * x / wl + phase));
  poly(E, pts, w);
}
/** A band of water from y down, covering what is under it: paper fill, a wavy top line and a few dashes under it. */
function water(E, x0, x1, y, t, amp = 10) {
  const pts = [];
  for (let x = x0; x <= x1 + 1; x += 20) pts.push(x, y + amp * Math.sin(TAU * x / 180 - t * 4));
  poly(E, pts.concat([x1, HH + 20, x0, HH + 20]), 0, true, 2);
  poly(E, pts, 4);
  for (let i = 0; i < 9; i++) { const xx = x0 + (x1 - x0) * rnd(i, 4) + 40 * Math.sin(t + i); const yy = y + 50 + 60 * (i % 3); line(E, xx, yy, xx + 60, yy, 3); }
}
/** Straight wind or speed streaks behind (x, y), going right; len px, n streaks over a height spread. */
function streaks(E, x, y, n, len, spread, t, seed = 0, w = 3) {
  for (let i = 0; i < n; i++) {
    const yy = y + (rnd(i, seed) - 0.5) * spread, l = len * (0.5 + rnd(i + 3, seed)), off = (rnd(i + 7, seed) * 200 + t * 300) % 200;
    line(E, x - off - l, yy, x - off, yy, w);
  }
}
/** A tiny fish, as a speck of prey or a flock-mate: body oval + tail. */
function fishlet(E, x, y, m = 1, size = 16) {
  blob(E, x, y, size, size * 0.45, 0);
  poly(E, [x - m * size * 0.8, y, x - m * size * 1.6, y - size * 0.55, x - m * size * 1.6, y + size * 0.55], 0, true, 1);
}
/** A musical-note glyph for calls and songs. */
function note(E, x, y, size = 18) { blob(E, x, y, size * 0.6, size * 0.42, -20); line(E, x + size * 0.5, y, x + size * 0.5, y - size * 1.8, 3); }
/** Dotted trail of prints between x0 and x1 at y. */
function prints(E, x0, x1, y, gap, r = 6, offset = 0) { for (let x = x0; x <= x1; x += gap) disc(E, x, y + (Math.round((x - x0) / gap) % 2 ? offset : -offset), r); }
