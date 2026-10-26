/* Ink Menagerie engine. Plays each animal's show as smooth, continuous motion in e-ink ink (halftone, paper, ink lines)
 * on a 1920 x 1080 design screen. The TV gets keyframes baked 12 times a second and blends between them.
 *
 * A show is pure maths, so the same code previews in the browser and bakes the frames the TV plays (bake.js):
 *   pose  where the drawing is (Pose), and where its prop is (a branch, a bar) when the prop moves on its own
 *   bend  how the drawing bends, sampled on a 24 x 12 grid; the TV bends its bitmap through the same grid
 *   fx    ink marks around it: dust, bubbles, wind, water lines, splashes (see "effects" below)
 *
 * Writing a show (motions/*.js):  Ink.MOTIONS[id] = {
 *   facing: 'L' | 'R' | 'F' | 'U'     which way the drawing faces: left, right, at us, head at the top (seen from above)
 *   size: [w, h]                      a pass's drawing fits w x h of the screen (default [1.1, 0.9])
 *   maxScale: 1.05                    the biggest P.scale gets (for the pass's off-screen margin)
 *   props: [layer, ...]               layers that are not the animal (a branch, a bar): drawn unbent, with P.prop's pose
 *   pass:   { dur, path(t, P, sc) }   3 to 5 s; written left to right; the player mirrors it for right to left
 *   outing: { dur, path(t, P, sc) }   ~9 s; starts and ends at home (sc.hx, sc.hy, scale 1)
 *   bend(u, v, t, P, o, r)            adds to o[0], o[1] the move of drawing point (u, v), all in 0..1 drawing units;
 *                                     r = width / height. P is this frame's pose (P.v carries anything from path).
 *   fx(t, P, sc, E, mode, poseAt)     pushes effects into E (design px, left to right); poseAt(t) = the pose at t
 * }
 * Set P.m to the way the animal is going (1 right, -1 left): a drawing that faces the other way is mirrored. */
'use strict';
(function (G) {
const W = 1920, H = 1080, FPS = 12, FRAME = 1 / FPS;   // FPS: the TV's keyframe rate
const COLS = 24, ROWS = 12;
const HOME = { left: 200, top: 110, w: 1000, h: 740 };   // the screensaver's animal box (SaverView)
const PAPER = '#E6E5DF', INK = '#1C1C1A', NIGHT_PAPER = '#121211', NIGHT_INK = '#CFCEC8';

// ---------- maths

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const S = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
const frac = x => x - Math.floor(x);
const sn = (hz, t, ph = 0) => Math.sin(TAU * hz * t + ph);
const cs = (hz, t, ph = 0) => Math.cos(TAU * hz * t + ph);
const box = (u, v, u0, v0, u1, v1, f = 0.04) => S(u0 - f, u0 + f, u) * S(u1 + f, u1 - f, u) * S(v0 - f, v0 + f, v) * S(v1 + f, v1 - f, v);
const rnd = (i, salt = 0) => frac(Math.sin(i * 127.1 + salt * 311.7 + 0.5) * 43758.5453);
const surge = (p, n, k) => p - k * Math.sin(TAU * n * p) / (TAU * n);

// ---------- drawings

const ANIMALS = {};
function parsePath(d) {
  const t = d.trim().replace(/,/g, ' ').split(/\s+|(?<=[MLCQZ])|(?=[MLCQZ])/).filter(Boolean);
  const out = []; let i = 0, cmd = '';
  while (i < t.length) {
    const s = t[i];
    if (/^[A-Z]$/.test(s)) { cmd = s; i++; if (cmd === 'Z') out.push(['Z']); continue; }
    const n = cmd === 'M' || cmd === 'L' ? 2 : cmd === 'C' ? 6 : 4;
    out.push([cmd, t.slice(i, i + n).map(Number)]); i += n;
    if (cmd === 'M') cmd = 'L';
  }
  return out;
}
// The add-on's assets/animals.json ({animals: [{viewBox, layers: [{d, fill, stroke, width}]}]}) in the compact form
// used here: vb [w, h] and L [[fill, stroke 0/1, width, d]].
function asList(json) {
  return (Array.isArray(json) ? json : json.animals).map(a => a.L ? a : {
    id: a.id, name: a.name, latin: a.latin, group: a.group, vb: a.viewBox.split(/\s+/).slice(2).map(Number),
    L: a.layers.map(l => [l.fill, l.stroke ? 1 : 0, l.width || 2.5, l.d]) });
}

function loadAnimals(json) {
  for (const a of asList(json)) {
    ANIMALS[a.id] = { id: a.id, name: a.name, latin: a.latin, group: a.group, w: a.vb[0], h: a.vb[1],
      layers: a.L.map(([fill, stroke, width, d]) => {
        // A paper layer that starts with the whole frame cuts the animal out of the frame: it erases (on the TV too),
        // and its frame is made larger here so a bend never leaves a seam at the edge.
        const cut = fill === 'paper' && new RegExp(`^M0 0 L${a.vb[0]} 0 L${a.vb[0]} ${a.vb[1]} L0 ${a.vb[1]} Z`).test(d);
        const cmds = parsePath(d);
        if (cut) { const [w, h] = a.vb; cmds[0][1] = [-w, -h]; cmds[1][1] = [2 * w, -h]; cmds[2][1] = [2 * w, 2 * h]; cmds[3][1] = [-w, 2 * h]; }
        return { fill, stroke: !!stroke, width, cut, cmds };
      }) };
  }
}

// ---------- poses

const MOTIONS = {};

class Pose {
  constructor() { this.reset(); }
  reset() {
    this.x = 0; this.y = 0; this.scale = 1; this.sx = 1; this.sy = 1; this.angle = 0; this.mirror = false;
    this.hidden = false; this.m = 1;
    this.screen = 0;            // 1: the whole screen in ink; 2: ink screen, the animal in paper (TITANE)
    this.shakeX = 0; this.shakeY = 0; this.burst = false; this.shout = -1; this.shoutScale = 1;
    this.prop = null;           // null: the prop goes with the animal, unbent; else { x, y, scale, sx, sy, angle, mirror, hidden }
    this.v = {};
    return this;
  }
}

/** The scene a show plays in: the drawing's size at scale 1 (design px) and, for an outing, its home and room. */
function sceneFor(id, mode) {
  const a = ANIMALS[id], mo = MOTIONS[id] || {};
  const sc = { W, H, mode, a };
  if (mode === 'pass') {
    const b = mo.size || [1.1, 0.9];
    const s = Math.min(b[0] * W / a.w, b[1] * H / a.h);
    sc.sw = a.w * s; sc.sh = a.h * s; sc.fit = s;
    sc.ext = 0.5 * Math.hypot(sc.sw, sc.sh) * (mo.maxScale || 1.05) + 0.12 * Math.max(sc.sw, sc.sh) + 40;
  } else {
    const s = Math.min(HOME.w / a.w, HOME.h / a.h);
    sc.sw = a.w * s; sc.sh = a.h * s; sc.fit = s; sc.homeScale = 1;
    if (mo.bigOuting) {   // TITANE charges with a drawing as big as a pass's; home is then a smaller scale
      const b = Math.min(W / a.w, 0.95 * H / a.h);
      sc.homeScale = s / b; sc.fit = b; sc.sw = a.w * b; sc.sh = a.h * b;
    }
    const hw = a.w * s / 2, hh = a.h * s / 2;
    sc.hx = HOME.left + HOME.w / 2; sc.hy = HOME.top + HOME.h / 2;
    const m = 40;
    sc.left = Math.max(0, sc.hx - hw - m); sc.right = Math.max(0, W - m - (sc.hx + hw));
    sc.up = Math.max(0, sc.hy - hh - m); sc.down = Math.max(0, H - m - (sc.hy + hh));
  }
  return sc;
}

const duration = (id, mode) => (mode === 'pass' ? MOTIONS[id].pass : MOTIONS[id].outing).dur;

function poseAt(id, mode, t, P = new Pose()) {
  const mo = MOTIONS[id], sc = sceneFor(id, mode);
  P.reset();
  if (mode === 'outing') { P.x = sc.hx; P.y = sc.hy; P.scale = sc.homeScale; }
  (mode === 'pass' ? mo.pass : mo.outing).path(t, P, sc);
  const turn = mo.facing === 'L' ? P.m > 0 : mo.facing === 'R' ? P.m < 0 : false;
  if (turn) P.mirror = !P.mirror;
  if (P.prop && P.prop.mirror === undefined) P.prop.mirror = false;
  return P;
}

/** Where drawing point (u, v), unbent, is on the design screen for pose P (left-to-right terms). */
function pointOf(sc, P, u, v, R = P) {
  const a = sc.a, s = sc.fit * R.scale, ang = R.angle * Math.PI / 180;
  const bx = (u - 0.5) * a.w * s * R.sx * (R.mirror ? -1 : 1), by = (v - 0.5) * a.h * s * R.sy;
  return [R.x + bx * Math.cos(ang) - by * Math.sin(ang), R.y + bx * Math.sin(ang) + by * Math.cos(ang)];
}

/** Places the drawing so its point (u, v) sits at screen (x, y), turned by angle degrees about that point. */
function pin(sc, P, u, v, x, y, angle = P.angle) {
  P.angle = angle;
  const [px, py] = pointOf(sc, Object.assign({}, P, { x: 0, y: 0 }), u, v);
  P.x = x - px; P.y = y - py;
}

/** The bend at the 25 x 13 grid points, in drawing units (u, v pairs). */
function bendGrid(id, t, P) {
  const mo = MOTIONS[id], a = ANIMALS[id], r = a.w / a.h, g = new Float32Array((COLS + 1) * (ROWS + 1) * 2), o = [0, 0];
  if (!mo.bend) return g;
  let i = 0;
  for (let y = 0; y <= ROWS; y++) for (let x = 0; x <= COLS; x++) {
    o[0] = 0; o[1] = 0;
    mo.bend(x / COLS, y / ROWS, t, P, o, r);
    g[i++] = clamp(o[0], -0.49, 0.49); g[i++] = clamp(o[1], -0.49, 0.49);
  }
  return g;
}

/** The effects at time t. */
function effectsAt(id, mode, t, P) {
  const mo = MOTIONS[id], E = [], sc = sceneFor(id, mode);
  E.back = false;
  if (mo.fx) mo.fx(t, P, sc, E, mode, tt => poseAt(id, mode, Math.max(0, tt)));
  return E;
}

/** One frame of a show, as the TV gets it. */
function frameOf(id, mode, f) {
  const t = f * FRAME;
  const P = poseAt(id, mode, t);
  return { t, P, bend: bendGrid(id, t, P), fx: effectsAt(id, mode, t, P) };
}

// ---------- effects
// Every mark is one small record, drawn the same way here and on the TV. Design px; w is the line width (0 = filled).
//  {c:[x,y,r], w}               circle                         bubbles, droplets, pebbles, eyes of tiny fish
//  {l:[x1,y1,x2,y2], w}         line                           wind, rain, speed lines, current, grass blades
//  {e:[x,y,rx,ry,deg], w}       ellipse                        ripples, leaves, prints, fruit
//  {a:[x,y,r,from,sweep], w}    arc, degrees, clockwise         splash crowns, sense arcs, vortex curls
//  {d:[x,y,r,level]}            round cloud of halftone dots   dust, sand, silt, spray, plankton (level 0..1 dot size)
//  {p:[x,y,x,y,...], w, z, f}   path through points; z closed, f fill: 0 none, 1 ink, 2 paper, 3 dots (with lv)
//                                                              waterlines, vines, trunks, crevices, water bands
// b: 1 draws it behind the animal (set E.back = true while pushing).

// ---------- drawing (browser only)

function tile(cell, r, colour) {
  const c = document.createElement('canvas'); c.width = c.height = Math.max(2, Math.round(cell));
  const g = c.getContext('2d'); g.fillStyle = colour;
  g.beginPath(); g.arc(c.width / 2, c.height / 2, r * c.width, 0, TAU); g.fill();
  return c;
}

/** Draws layers of the drawing (props or not) through pose R; bend is the grid (or null), k design px -> canvas px. */
function drawLayers(g, a, sc, R, grid, k, pal, wantProps, props, negative) {
  const s = sc.fit * R.scale, ang = R.angle * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
  const mx = (R.mirror ? -1 : 1) * R.sx, my = R.sy, ox = R.x + (R.shakeX || 0), oy = R.y + (R.shakeY || 0);
  const map = (x, y) => {
    let u = x / a.w, v = y / a.h;
    if (grid) {
      const gx = clamp(u, 0, 1) * COLS, gy = clamp(v, 0, 1) * ROWS;
      const ix = Math.min(COLS - 1, Math.floor(gx)), iy = Math.min(ROWS - 1, Math.floor(gy)), fx = gx - ix, fy = gy - iy;
      const at = (cx, cy, j) => grid[((iy + cy) * (COLS + 1) + ix + cx) * 2 + j];
      for (let j = 0; j < 2; j++) {
        const d = (at(0, 0, j) * (1 - fx) + at(1, 0, j) * fx) * (1 - fy) + (at(0, 1, j) * (1 - fx) + at(1, 1, j) * fx) * fy;
        if (j === 0) u += d; else v += d;
      }
    }
    const bx = (u - 0.5) * a.w * s * mx, by = (v - 0.5) * a.h * s * my;
    return [(ox + bx * ca - by * sa) * k, (oy + bx * sa + by * ca) * k];
  };
  const ink = negative ? pal.paper : pal.ink, paper = negative ? pal.ink : pal.paper;
  const pat = g.createPattern(tile(12 * k * R.scale * Math.abs(R.sy), 0.34, ink), 'repeat');
  pat.setTransform(new DOMMatrix().translate(ox * k, oy * k).rotate(R.angle));
  const chosen = a.layers.map((L, i) => (props.includes(i) === wantProps ? L : null));
  const paths = chosen.map(L => {
    if (!L) return null;
    const p = new Path2D();
    for (const c of L.cmds) {
      if (c[0] === 'Z') { p.closePath(); continue; }
      const q = c[1], pts = [];
      for (let i = 0; i < q.length; i += 2) pts.push(...map(q[i], q[i + 1]));
      if (c[0] === 'M') p.moveTo(pts[0], pts[1]);
      else if (c[0] === 'L') p.lineTo(pts[0], pts[1]);
      else if (c[0] === 'C') p.bezierCurveTo(...pts);
      else p.quadraticCurveTo(...pts);
    }
    return p;
  });
  // the animal goes on a layer of its own, so a cut layer erases only the animal
  const c = scratch(g.canvas.width, g.canvas.height), o = c.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, c.width, c.height);
  o.lineCap = 'round'; o.lineJoin = 'round';
  o.fillStyle = paper;
  chosen.forEach((L, i) => { if (L && (L.fill === 'ink' || L.fill === 'dots')) o.fill(paths[i]); });
  chosen.forEach((L, i) => {
    if (!L) return;
    if (L.cut) { o.globalCompositeOperation = 'destination-out'; o.fillStyle = '#000'; o.fill(paths[i]); o.globalCompositeOperation = 'source-over'; }
    else if (L.fill === 'dots') { o.fillStyle = pat; o.fill(paths[i]); }
    else if (L.fill === 'ink') { o.fillStyle = ink; o.fill(paths[i]); }
    else if (L.fill === 'paper') { o.fillStyle = paper; o.fill(paths[i]); }
    if (L.stroke) { o.strokeStyle = ink; o.lineWidth = L.width * s * k * Math.min(Math.abs(R.sx), Math.abs(R.sy), 1); o.stroke(paths[i]); }
  });
  g.drawImage(c, 0, 0);
}

let scratchCanvas = null;
function scratch(w, h) {
  if (!scratchCanvas) scratchCanvas = document.createElement('canvas');
  if (scratchCanvas.width !== w || scratchCanvas.height !== h) { scratchCanvas.width = w; scratchCanvas.height = h; }
  return scratchCanvas;
}

function drawEffects(g, list, pal, k, flip, back) {
  g.save();
  g.strokeStyle = pal.ink; g.fillStyle = pal.ink; g.lineCap = 'round'; g.lineJoin = 'round';
  const X = x => (flip ? W - x : x) * k;
  for (const e of list) {
    if (!!e.b !== back) continue;
    const w = (e.w || 0) * k;
    g.lineWidth = w;
    g.beginPath();
    if (e.c) { g.arc(X(e.c[0]), e.c[1] * k, Math.max(0.5, e.c[2] * k), 0, TAU); w ? g.stroke() : g.fill(); }
    else if (e.l) { g.moveTo(X(e.l[0]), e.l[1] * k); g.lineTo(X(e.l[2]), e.l[3] * k); g.stroke(); }
    else if (e.e) { g.ellipse(X(e.e[0]), e.e[1] * k, Math.max(0.5, e.e[2] * k), Math.max(0.5, e.e[3] * k), (flip ? -e.e[4] : e.e[4]) * Math.PI / 180, 0, TAU); w ? g.stroke() : g.fill(); }
    else if (e.a) {
      let from = e.a[3]; const sweep = e.a[4];
      if (flip) from = 180 - from - sweep;
      g.arc(X(e.a[0]), e.a[1] * k, e.a[2] * k, from * Math.PI / 180, (from + sweep) * Math.PI / 180); g.stroke();
    } else if (e.d) {
      const [x, y, r, level] = e.d;
      if (level <= 0.02 || r <= 0) continue;
      g.save(); g.beginPath(); g.arc(X(x), y * k, r * k, 0, TAU); g.clip();
      g.fillStyle = g.createPattern(tile(10 * k, 0.5 * Math.min(0.75, level), pal.ink), 'repeat');
      g.fillRect(X(x) - r * k, y * k - r * k, 2 * r * k, 2 * r * k);
      g.restore();
    } else if (e.p) {
      const p = e.p;
      g.moveTo(X(p[0]), p[1] * k);
      for (let i = 2; i < p.length; i += 2) g.lineTo(X(p[i]), p[i + 1] * k);
      if (e.z) g.closePath();
      if (e.f === 1) { g.fillStyle = pal.ink; g.fill(); }
      else if (e.f === 2) { g.fillStyle = pal.paper; g.fill(); g.fillStyle = pal.ink; }
      else if (e.f === 3) { g.save(); g.fillStyle = g.createPattern(tile(10 * k, 0.5 * Math.min(0.75, e.lv || 0.4), pal.ink), 'repeat'); g.fill(); g.restore(); }
      if (w) g.stroke();
    }
  }
  g.restore();
}

function drawBurst(g, k, pal) {
  const cx = W / 2 * k, cy = H / 2 * k, r = Math.hypot(W, H) * k;
  g.save();
  g.fillStyle = g.createPattern(tile(14 * k, 0.3, pal.ink), 'repeat');
  g.beginPath();
  for (let i = 0; i < 18; i++) {
    const a0 = i * TAU / 18, a1 = a0 + TAU / 36;
    g.moveTo(cx, cy); g.lineTo(cx + r * Math.cos(a0), cy + r * Math.sin(a0)); g.lineTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
  }
  g.fill();
  g.restore();
}

function drawShout(g, P, k, pal, font) {
  const c = document.createElement('canvas'); c.width = g.canvas.width; c.height = g.canvas.height;
  const o = c.getContext('2d');
  const size = W * 0.17 * P.shoutScale * k;
  o.translate(W / 2 * k, H * 0.72 * k); o.rotate(-6 * Math.PI / 180);
  o.font = `700 ${size}px ${font}`; o.textAlign = 'center';
  o.fillStyle = o.createPattern(tile(10 * k, 0.4, pal.ink), 'repeat');
  o.fillText('TITANE!', size * 0.06, size * 0.06);
  o.lineWidth = size * 0.09; o.strokeStyle = pal.paper; o.lineJoin = 'round'; o.strokeText('TITANE!', 0, 0);
  o.fillStyle = pal.ink; o.fillText('TITANE!', 0, 0);
  if (P.shout > 0) {   // paper dots grow through the word until it is gone
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'destination-out';
    o.fillStyle = o.createPattern(tile(12 * k, 0.75 * Math.min(1, P.shout), '#000'), 'repeat');
    o.fillRect(0, 0, c.width, c.height);
  }
  g.drawImage(c, 0, 0);
}

/** One canvas playing shows. render(id, mode, t) draws the show at t seconds (any t: the motion is continuous), or the
 * still animal at home when t is null. Moments a show marks as cuts (TITANE's ink flash) are the only jumps. */
class Player {
  constructor(canvas, opts = {}) {
    this.canvas = canvas; this.g = canvas.getContext('2d');
    this.font = opts.font || 'sans-serif'; this.night = false; this.onShake = opts.onShake || null;
  }
  get pal() { return this.night ? { ink: NIGHT_INK, paper: NIGHT_PAPER } : { ink: INK, paper: PAPER }; }
  scale() {
    const r = this.canvas.getBoundingClientRect(), d = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
    const w = Math.max(1, Math.round((r.width || this.canvas.width) * d)), h = Math.round(w * H / W);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    return w / W;
  }
  /** dir -1 plays a pass right to left. still: the outing's animal at home (the screensaver between outings). */
  render(id, mode, t, dir = 1, still = false) {
    const k = this.scale(), pal = this.pal, g = this.g, a = ANIMALS[id], mo = MOTIONS[id], props = mo.props || [];
    let P = null;
    const flip = mode === 'pass' && dir < 0;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (t !== null && t <= duration(id, mode) + 1e-6) {
      P = poseAt(id, mode, t);
      const sc = sceneFor(id, mode), bend = bendGrid(id, t, P), fx = effectsAt(id, mode, t, P);
      if (P.screen) { g.fillStyle = pal.ink; g.fillRect(0, 0, this.canvas.width, this.canvas.height); }
      if (P.screen !== 1) {
        g.save(); if (flip) { g.translate(this.canvas.width, 0); g.scale(-1, 1); }
        if (P.burst) drawBurst(g, k, pal);
        g.restore();
        drawEffects(g, fx, pal, k, flip, true);
        g.save(); if (flip) { g.translate(this.canvas.width, 0); g.scale(-1, 1); }
        if (props.length && !(P.prop && P.prop.hidden)) drawLayers(g, a, sc, P.prop || P, null, k, pal, true, props, P.screen === 2);
        if (!P.hidden) drawLayers(g, a, sc, P, bend, k, pal, false, props, P.screen === 2);
        g.restore();
        drawEffects(g, fx, pal, k, flip, false);
        if (P.shout >= 0) drawShout(g, P, k, pal, this.font);
      }
    } else if (mode === 'outing' || still) {
      const sc = sceneFor(id, 'outing'), Q = new Pose(); Q.x = sc.hx; Q.y = sc.hy; Q.scale = sc.homeScale;
      drawLayers(g, a, sc, Q, null, k, pal, true, props, false);
      drawLayers(g, a, sc, Q, null, k, pal, false, props, false);
    }
    if (this.onShake) this.onShake(P ? (flip ? -P.shakeX : P.shakeX) * k : 0, P ? P.shakeY * k : 0);
    return P;
  }
}

G.Ink = { W, H, FPS, FRAME, COLS, ROWS, HOME, ANIMALS, MOTIONS, Pose, asList, loadAnimals, sceneFor, duration, poseAt, pointOf, pin,
  bendGrid, effectsAt, frameOf, Player, util: { TAU, clamp, S, lerp, frac, sn, cs, box, rnd, surge } };
})(typeof window !== 'undefined' ? window : globalThis);
