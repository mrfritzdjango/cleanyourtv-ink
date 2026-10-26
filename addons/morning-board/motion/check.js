// node check.js [file,...] [id]  - checks every show: passes start and end off screen, outings start and end at home,
// no NaN, the bend inside the grid's range, nothing jumps between 1/60 s steps except at a marked cut.
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = __dirname, ctx = { console, Math, Float32Array, Object, Array, JSON, Number, String, Set, Map };
vm.createContext(ctx);
const run = f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
run('engine.js'); run('motions/lib.js');
const files = (process.argv[2] || fs.readdirSync(path.join(dir, 'motions')).filter(f => f !== 'lib.js' && f.endsWith('.js')).map(f => f.slice(0, -3)).join(',')).split(',');
for (const f of files) run('motions/' + f + '.js');
const Ink = ctx.Ink; Ink.loadAnimals(JSON.parse(fs.readFileSync(path.join(dir, '../app/src/main/assets/animals.json'))));
const only = process.argv[3];
let bad = 0;
const fail = (id, msg) => { bad++; console.log('  ✗ ' + id + ': ' + msg); };
const ids = Object.keys(Ink.MOTIONS).filter(id => !only || id === only);
for (const id of ids) {
  const mo = Ink.MOTIONS[id];
  if (!Ink.ANIMALS[id]) { fail(id, 'no such drawing'); continue; }
  if (!['L', 'R', 'F', 'U'].includes(mo.facing)) fail(id, 'facing');
  for (const mode of ['pass', 'outing']) {
    const d = Ink.duration(id, mode), sc = Ink.sceneFor(id, mode);
    if (mode === 'pass' && (d < 3 || d > (id === 'titan-triggerfish' ? 5.01 : 5))) fail(id, `pass lasts ${d} s`);
    if (mode === 'outing' && (d < 6 || d > 10.01)) fail(id, `outing lasts ${d} s`);
    const steps = Math.round(d * 60);
    let prev = null, worst = 0, worstT = 0;
    for (let i = 0; i <= steps; i++) {
      const t = Math.min(d, i / 60);
      let P, bend, fx;
      try { P = Ink.poseAt(id, mode, t); bend = Ink.bendGrid(id, t, P); fx = Ink.effectsAt(id, mode, t, P); }
      catch (e) { fail(id, `${mode} t=${t.toFixed(2)} throws ${e.message}`); break; }
      const nums = [P.x, P.y, P.scale, P.sx, P.sy, P.angle, P.shakeX, P.shakeY];
      if (nums.some(n => !Number.isFinite(n))) { fail(id, `${mode} t=${t.toFixed(2)} pose NaN ${JSON.stringify(nums)}`); break; }
      if (bend.some(n => !Number.isFinite(n))) { fail(id, `${mode} t=${t.toFixed(2)} bend NaN`); break; }
      for (const e of fx) { const v = e.c || e.l || e.e || e.a || e.d || e.p; if (!v || v.some(n => !Number.isFinite(n))) { fail(id, `${mode} t=${t.toFixed(2)} effect ${JSON.stringify(e).slice(0, 80)}`); break; } }
      if (prev && !P.screen && !prev.screen && !P.hidden && !prev.hidden && !P.v.cut && !prev.v.cut) {
        const jump = Math.hypot(P.x - prev.x, P.y - prev.y) + Math.abs(P.angle - prev.angle) * 4 + Math.abs(P.scale - prev.scale) * 600;
        if (jump > worst) { worst = jump; worstT = t; }
      }
      prev = P;
    }
    if (worst > 160) fail(id, `${mode} jumps ${worst.toFixed(0)} px in 1/60 s at t=${worstT.toFixed(2)} (smooth it, or set P.v.cut on a deliberate cut)`);
    // the drawing's corners, for the off-screen and home checks
    const box = P => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => Ink.pointOf(sc, P, u, v));
    if (mode === 'pass') {
      for (const t of [0, d]) {
        const P = Ink.poseAt(id, mode, t);
        if (P.hidden) continue;
        const xs = box(P).map(p => p[0]);
        if (!(Math.max(...xs) < 0 || Math.min(...xs) > Ink.W)) fail(id, `pass is on screen at t=${t} (x ${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)})`);
      }
    } else {
      for (const t of [0, d]) {
        const P = Ink.poseAt(id, mode, t);
        const off = Math.hypot(P.x - sc.hx, P.y - sc.hy);
        if (off > 2 || Math.abs(P.scale - sc.homeScale) > 0.01 || Math.abs(P.angle) > 0.5 || P.mirror || P.hidden || Math.abs(P.sx - 1) > 0.01 || Math.abs(P.sy - 1) > 0.01)
          fail(id, `outing not at home at t=${t}: x ${P.x.toFixed(0)}/${sc.hx} y ${P.y.toFixed(0)}/${sc.hy} scale ${P.scale.toFixed(2)} angle ${P.angle.toFixed(1)} mirror ${P.mirror}`);
        if (P.prop && !P.prop.hidden && (Math.hypot(P.prop.x - sc.hx, P.prop.y - sc.hy) > 2 || P.prop.angle)) fail(id, `outing prop not at home at t=${t}`);
      }
    }
  }
}
console.log(`${ids.length} shows checked, ${bad} problem${bad === 1 ? '' : 's'}`);
process.exit(bad ? 1 : 0);
