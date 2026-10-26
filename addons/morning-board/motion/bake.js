// node bake.js <out moves.bin>  - bakes every show into the keyframes the TV plays (Shows.java reads them).
//
// File: "INKM", u16 version, u8 fps, u8 cols, u8 rows, u16 count, then per animal: u8 id length, id, u8 prop count,
// prop layers (u8 each), u32 offset and u32 length of the pass, the same for the outing (offsets from the file start).
// Each show is gzipped: f32 fit (design px per drawing unit), f32 home scale, f32 seconds, u16 frames, then per frame:
//   u16 flags: 1 hidden, 2|4 screen (1 ink, 2 negative), 8 burst, 16 mirror, 32 own prop pose, 64 prop hidden,
//              128 prop mirror, 256 cut (don't blend into the next frame), 512 shout
//   f32 x, y, scale, sx, sy, angle, shakeX, shakeY            (design px and degrees, left to right)
//   [shout] f32 shout, shoutScale     [own prop pose, shown] f32 x, y, scale, sx, sy, angle
//   i16 x (cols+1)(rows+1)x2: the bend in drawing units x 65534, as the change from the previous frame
//   u16 effect count, then per effect: u8 kind (0 circle, 1 line, 2 ellipse, 3 arc, 4 dots, 5 path), u8 flags
//   (1 behind, 2 closed, fill << 2), u8 width x 4, [path] u16 point count, u8 dot level x 255, then i16 values x 2
//   (circle x y r; line x1 y1 x2 y2; ellipse x y rx ry deg; arc x y r from sweep; dots x y r level x 1000; path x y ...)
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), zlib = require('zlib');
const dir = __dirname, ctx = { console, Math, Float32Array, Object, Array, JSON, Number, String, Set, Map };
vm.createContext(ctx);
const run = f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
run('engine.js'); run('motions/lib.js');
const only = process.env.FILES ? process.env.FILES.split(',').map(f => f + '.js') : null;   // FILES=ref,reef bakes just those
for (const f of fs.readdirSync(path.join(dir, 'motions')).sort()) {
  if (!f.endsWith('.js') || f === 'lib.js' || (only && !only.includes(f))) continue;
  try { run('motions/' + f); } catch (e) { console.log(`skipped motions/${f}: ${e.message}`); }   // a file still being written
}
const Ink = ctx.Ink;
const list = Ink.asList(JSON.parse(fs.readFileSync(path.join(dir, '../app/src/main/assets/animals.json'))));
Ink.loadAnimals(list);

class Out {
  constructor() { this.buf = Buffer.alloc(1 << 16); this.n = 0; }
  room(k) { if (this.n + k > this.buf.length) { const b = Buffer.alloc(Math.max(this.buf.length * 2, this.n + k)); this.buf.copy(b, 0, 0, this.n); this.buf = b; } }
  u8(v) { this.room(1); this.buf.writeUInt8(v, this.n); this.n += 1; }
  u16(v) { this.room(2); this.buf.writeUInt16LE(v, this.n); this.n += 2; }
  u32(v) { this.room(4); this.buf.writeUInt32LE(v, this.n); this.n += 4; }
  i16(v) { this.room(2); this.buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), this.n); this.n += 2; }
  f32(v) { this.room(4); this.buf.writeFloatLE(v, this.n); this.n += 4; }
  bytes() { return this.buf.subarray(0, this.n); }
}

const KINDS = ['c', 'l', 'e', 'a', 'd', 'p'];
const COLS = Ink.COLS, ROWS = Ink.ROWS, POINTS = (COLS + 1) * (ROWS + 1) * 2;

function bake(id, mode) {
  const sc = Ink.sceneFor(id, mode), d = Ink.duration(id, mode);
  const n = Math.ceil(d * Ink.FPS - 1e-6) + 1;   // the last keyframe is the show's very end, even off the 1/12 s beat
  const o = new Out();
  o.f32(sc.fit); o.f32(sc.homeScale || 1); o.f32(d); o.u16(n);
  let last = new Int32Array(POINTS), prev = null, effects = 0;
  for (let f = 0; f < n; f++) {
    const t = Math.min(d, f * Ink.FRAME), next = Math.min(d, (f + 1) * Ink.FRAME);
    const P = Ink.poseAt(id, mode, t), bend = Ink.bendGrid(id, t, P), fx = Ink.effectsAt(id, mode, t, P);
    const N = Ink.poseAt(id, mode, next);
    // a cut: the show says so, or the next frame is another kind of frame, or the animal jumps
    const jump = Math.hypot(N.x - P.x, N.y - P.y) > 420 || Math.abs(N.angle - P.angle) > 60;
    const cut = P.v.cut || N.v.cut || N.screen !== P.screen || N.hidden !== P.hidden || N.mirror !== P.mirror || jump;
    const prop = P.prop;
    let flags = (P.hidden ? 1 : 0) | (P.screen << 1) | (P.burst ? 8 : 0) | (P.mirror ? 16 : 0) | (cut ? 256 : 0) | (P.shout >= 0 ? 512 : 0);
    if (prop) flags |= 32 | (prop.hidden ? 64 : 0) | (prop.mirror ? 128 : 0);
    o.u16(flags);
    for (const v of [P.x, P.y, P.scale, P.sx, P.sy, P.angle, P.shakeX, P.shakeY]) o.f32(v);
    if (P.shout >= 0) { o.f32(P.shout); o.f32(P.shoutScale); }
    if (prop && !prop.hidden) for (const v of [prop.x, prop.y, prop.scale, prop.sx ?? 1, prop.sy ?? 1, prop.angle]) o.f32(v);
    for (let i = 0; i < POINTS; i++) { const q = Math.round(bend[i] * 65534); o.i16(q - last[i]); last[i] = q; }
    o.u16(fx.length); effects += fx.length;
    for (const e of fx) {
      const kind = KINDS.findIndex(k => e[k]);
      if (kind < 0) throw new Error(`${id} ${mode}: unknown effect ${JSON.stringify(e)}`);
      o.u8(kind); o.u8((e.b ? 1 : 0) | (e.z ? 2 : 0) | ((e.f || 0) << 2)); o.u8(Math.min(255, Math.round((e.w || 0) * 4)));
      let vals = e[KINDS[kind]];
      if (kind === 5) { o.u16(vals.length / 2); o.u8(Math.round(Math.min(1, e.lv || 0.4) * 255)); }
      if (kind === 4) vals = [vals[0], vals[1], vals[2], vals[3] * 1000];
      vals.forEach((v, i) => o.i16(kind === 4 && i === 3 ? v : v * 2));
    }
    prev = P;
  }
  return { blob: zlib.gzipSync(o.bytes(), { level: 9 }), frames: n, effects, raw: o.n };
}

const allowed = process.env.IDS ? new Set(process.env.IDS.split(',')) : null;   // IDS=a,b bakes just those
const ids = list.map(a => a.id).filter(id => Ink.MOTIONS[id] && (!allowed || allowed.has(id)));
const missing = list.map(a => a.id).filter(id => !ids.includes(id));
const shows = ids.map(id => ({ id, props: Ink.MOTIONS[id].props || [], pass: bake(id, 'pass'), outing: bake(id, 'outing') }));
const head = new Out();
head.u8(0x49); head.u8(0x4e); head.u8(0x4b); head.u8(0x4d); head.u16(1); head.u8(Ink.FPS); head.u8(COLS); head.u8(ROWS); head.u16(shows.length);
let indexSize = head.n;
for (const s of shows) indexSize += 1 + Buffer.byteLength(s.id) + 1 + s.props.length + 16;
let at = indexSize;
for (const s of shows) {
  head.u8(Buffer.byteLength(s.id)); for (const b of Buffer.from(s.id)) head.u8(b);
  head.u8(s.props.length); for (const p of s.props) head.u8(p);
  head.u32(at); head.u32(s.pass.blob.length); at += s.pass.blob.length;
  head.u32(at); head.u32(s.outing.blob.length); at += s.outing.blob.length;
}
const out = Buffer.concat([head.bytes(), ...shows.flatMap(s => [s.pass.blob, s.outing.blob])]);
const file = process.argv[2] || path.join(dir, 'moves.bin');
fs.writeFileSync(file, out);
const raw = shows.reduce((n, s) => n + s.pass.raw + s.outing.raw, 0);
console.log(`${shows.length} animals baked to ${file}: ${(out.length / 1024).toFixed(0)} KB (${(raw / 1024).toFixed(0)} KB before gzip)`);
if (missing.length) console.log(`no show yet: ${missing.join(', ')}`);
