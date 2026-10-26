/* Ground shows: the water monitor, the otter, the crocodile, the peacock-pheasant, the sun bear and the orangutan. */
'use strict';
(function () {
  // ---------- helpers shared by the shows in this file

  /** Where drawing point (u, v) is on screen once the show's own bend has moved it (for effects that sit on a part). */
  function atB(sc, P, id, u, v, t) {
    const o = [0, 0], a = Ink.ANIMALS[id];
    M[id].bend(u, v, t, P, o, a.w / a.h);
    return at(sc, P, u + o[0], v + o[1]);
  }
  /** The integral of S(a, b, x) from 0 to t: lets a speed ramp smoothly while the distance stays continuous. */
  function sInt(a, b, t) {
    if (t <= a) return 0;
    const d = b - a, k = Math.min(1, (t - a) / d);
    return d * (k * k * k - k * k * k * k / 2) + Math.max(0, t - b);
  }
  /** A card turn for a side view: the drawing narrows to a sliver and opens the other way. k 0..1; returns true once turned. */
  function cardTurn(P, k) {
    const c = Math.cos(Math.PI * clamp(k, 0, 1));
    P.sx = Math.max(0.03, Math.abs(c)); P.sy = 1 + 0.04 * hump(k);
    return c < 0;
  }
  /** Turn the region weighted w about (pu, pv) by deg and scale it toward that point by k, exactly (not linearised). */
  function rotScale(o, u, v, pu, pv, deg, k, w, r) {
    if (!(w > 0)) return;
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = (u - pu) * r, dy = v - pv;
    const nx = k * (c * dx - s * dy), ny = k * (s * dx + c * dy);
    o[0] += w * (nx - dx) / r; o[1] += w * (ny - dy);
  }
  /** A small ink bee: striped body and two wings that beat. */
  function bee(E, x, y, dir, t, seed, size = 11) {
    blob(E, x, y, size, size * 0.62, 0);
    const flap = 0.6 + 0.4 * Math.sin(t * 70 + seed * 3);
    oval(E, x - dir * 2, y - size * (0.9 + 0.3 * flap), size * 0.7, size * 0.45 * flap + 2, -dir * 25, 2);
    oval(E, x + dir * 5, y - size * (0.8 + 0.3 * flap), size * 0.6, size * 0.4 * flap + 2, dir * 20, 2);
    line(E, x + dir * size, y, x + dir * (size + 6), y + 1, 2);
  }
  /** A clawed print seen on the ground: a pad and three claw ticks pointing the way of travel. */
  function claw(E, x, y, dir, r = 7) {
    blob(E, x, y, r, r * 0.6, 0);
    for (let j = -1; j <= 1; j++) line(E, x + dir * r * 0.7, y + j * r * 0.5, x + dir * r * 1.9, y + j * r * 0.9, 2.5);
  }

  // ===== Asian water monitor (seen from above) ======================================================================
  // Walks with the spine bending in an S while diagonal legs step together, the head held steady on its path and the
  // forked tongue flicking. In water the legs fold flat against the body and the tail drives with a travelling wave.
  (function () {
    const ID = 'asian-water-monitor';
    const PASS = [['walk', 2.1], ['shore', 0.8], ['swim', 1.6]];
    const OUT = [['turn', 1.4], ['out', 2.0], ['scan', 1.9], ['bask', 2.0], ['turn2', 1.2], ['home', 1.1]];
    // legs: [pivot u, pivot v, region u0, v0, u1, v1, out (1 up, -1 down), turn that lays it back along the flank]
    const LEGS = [
      [0.28, 0.43, 0.15, -0.05, 0.37, 0.41, 1, 100],    // front, upper side of the drawing
      [0.27, 0.62, 0.05, 0.63, 0.33, 0.95, -1, -128],   // front, lower side
      [0.46, 0.42, 0.39, -0.05, 0.58, 0.41, 1, 48],     // hind, upper side
      [0.47, 0.63, 0.41, 0.65, 0.61, 0.95, -1, -24],    // hind, lower side
    ];
    const FEET = [[0.22, 0.18], [0.13, 0.76], [0.53, 0.2], [0.59, 0.78]];
    const SHORE = WW * 0.5;
    const flick = t => { const k = frac(t / 0.75) / 0.25; return k < 1 ? hump(k) : 0; };   // tongue out 0.25 s of every 0.75 s

    function passX(t, sc) {   // walk, then a faster swim; a lurch with every step on land
      const x0 = -sc.sw / 2 - 80, x1 = WW + sc.sw / 2 + 80, T = total(PASS);
      const F = tt => tt + 0.4 * sInt(2.0, 3.1, tt);
      return x0 + (x1 - x0) * F(t) / F(T) - 16 * Math.sin(TAU * t / 0.5) * (1 - S(1.9, 2.6, t));
    }

    M[ID] = {
      facing: 'L', size: [0.8, 0.62],
      pass: { dur: total(PASS), path(t, P, sc) {
        const b = beat(t, PASS), v = P.v;
        v.b = b.name; P.m = 1; P.y = HH / 2 + 10;
        P.x = passX(t, sc);
        // where the shoulders and the hips are, for the legs that fold as each girdle reaches the water
        const sh = P.x + (0.5 - 0.27) * sc.sw, hip = P.x + (0.5 - 0.46) * sc.sw;   // the drawing is mirrored to go right
        v.foldF = S(SHORE - 120, SHORE + 300, sh); v.foldH = S(SHORE - 120, SHORE + 300, hip);
        v.swim = S(SHORE - 120, SHORE + 260, hip);
        v.walk = 1 - v.swim; v.tongue = flick(t);
        P.angle = 1.5 * Math.sin(TAU * t / 1.0) * v.walk;   // the whole body yaws a little with each pair
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, k = b.k;
        v.b = b.name; P.m = -1; v.walk = 0; v.swim = 0; v.foldF = 0; v.foldH = 0; v.c = 0;
        v.tongue = flick(t); v.raise = 0; v.look = 0; v.bask = 0;
        const A = [sc.hx, sc.hy], B = [sc.hx + 60, sc.hy + 40], C = [reachX(sc, 0.8), sc.hy + 40], D = [reachX(sc, 0.71), sc.hy + 20];
        if (b.name === 'turn') {   // a pivot turn, the head sweeping down and round; the body curls into a C
          const e = ease(k);
          P.x = lerp(A[0], B[0], e); P.y = lerp(A[1], B[1], e); P.angle = -180 * e;
          v.walk = 0.8 * hump(k); v.c = hump(k);
        } else if (b.name === 'out') {   // out along a gentle S, the body following its path
          const e = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
          P.x = lerp(B[0], C[0], e); P.y = B[1] - 34 * Math.sin(TAU * e);
          const dx = (C[0] - B[0]), dy = -34 * TAU * Math.cos(TAU * e);
          P.angle = -180 + Math.atan2(dy, dx) * 180 / Math.PI * hump(k) ** 0.5;
          v.walk = Math.min(1, hump(k) * 1.6);
        } else if (b.name === 'scan') {   // stops, lifts its head and sweeps it, three flicks of the tongue
          P.x = C[0]; P.y = C[1]; P.angle = -180;
          v.raise = S(0, 0.15, k) * S(1, 0.85, k);
          v.look = Math.sin(TAU * 1.5 * S(0.1, 0.9, k)) * v.raise;
          v.tongue = [0.22, 0.5, 0.78].reduce((s, c) => s + hump((k - c) * 1.9 / 0.25 + 0.5), 0);
        } else if (b.name === 'bask') {   // lies flat in the sun, legs splayed, breathing slowly
          P.x = C[0]; P.y = C[1]; P.angle = -180;
          v.bask = S(0, 0.2, k) * S(1, 0.82, k); v.tongue = 0;
        } else if (b.name === 'turn2') {
          const e = ease(k);
          P.x = lerp(C[0], D[0], e); P.y = lerp(C[1], D[1], e); P.angle = -180 + 180 * e;
          v.walk = 0.8 * hump(k); v.c = -hump(k);
        } else {
          const e = ease(k);
          P.x = lerp(D[0], A[0], e); P.y = lerp(D[1], A[1], e);
          P.angle = Math.atan2(D[1] - A[1], D[0] - A[0]) * 180 / Math.PI * hump(k) * 0.6;
          v.walk = Math.min(1, hump(k) * 1.6);
        }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, walk = V.walk || 0, swim = V.swim || 0, s = Math.sin(TAU * t / 1.0);
        // the spine's S: the trunk one way, the tail base the other; the head stays on its line
        if (walk) {
          const along = clamp((u - 0.2) / 0.6, 0, 1.4);
          o[1] += 0.05 * walk * s * Math.sin(TAU * along) * S(0.16, 0.26, u) * (u > 0.8 ? 1 - 0.6 * (u - 0.8) / 0.2 : 1);
        }
        // a pivot turn curls the body into a C, head and tail toward the turn
        if (V.c) o[1] += 0.25 * V.c * (u - 0.42) * (u - 0.42);
        // swimming: a wave runs down the tail, growing to the tip; the trunk barely moves
        if (swim) {
          const w = S(0.42, 1.0, u);
          o[1] += swim * (0.012 + 0.1 * w * w) * Math.sin(TAU * (1.5 * (u - 0.42) - t / 0.75)) * S(0.3, 0.45, u);
        }
        // legs: diagonal pairs swing together on land; fold flat back against the body in the water; splay to bask
        for (let i = 0; i < 4; i++) {
          const [pu, pv, u0, v0, u1, v1, dir, back] = LEGS[i], w = box(u, v, u0, v0, u1, v1, 0.03);
          if (!(w > 0)) continue;
          const fold = ease(i < 2 ? (V.foldF || 0) : (V.foldH || 0));
          const swing = 20 * walk * (1 - fold) * (i < 2 ? -s : s);   // the diagonal pairs: both fronts turn one way, both hinds the other
          rotScale(o, u, v, pu, pv, swing + back * fold + (i < 2 ? -1 : 1) * dir * 22 * (V.bask || 0), 1 - 0.5 * fold, w, r);
          if (V.bask) shift(o, 0, -dir * 0.03 * V.bask, w);
        }
        // basking: the trunk spreads flat; it breathes
        if (V.bask) scl(o, u, v, 0.4, 0.53, 1, 1 + V.bask * (0.08 + 0.02 * Math.sin(TAU * 0.6 * t)), box(u, v, 0.18, 0.35, 0.62, 0.72, 0.05));
        // the head: lifted (nearer, so bigger) and swept side to side when it scans
        const head = S(0.24, 0.17, u) * box(u, v, -0.1, 0.25, 0.4, 0.6, 0.06);
        if (V.raise) scl(o, u, v, 0.2, 0.47, 1 + 0.13 * V.raise, 1 + 0.13 * V.raise, head);
        if (V.look) rot(o, u, v, 0.22, 0.47, 17 * V.look, head, r);
        // the tail tip never quite stops
        rot(o, u, v, 0.86, 0.82, 4 * Math.sin(TAU * 0.7 * t), S(0.86, 0.95, u), r);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v, pass = mode === 'pass', k = sc.fit * P.scale / 2.2;
        const pt = (Q, tt, u, v) => atB(sc, Q, ID, u, v, tt);
        if (pass) {
          // the shore: wet sand edge and the waterline; ripples drifting on the water side
          E.back = true;
          const wl = [], wet = [];
          for (let y = -20; y <= HH + 20; y += 30) { wl.push(SHORE + 26 * Math.sin(y / 90 + t * 1.5), y); wet.push(SHORE - 40 + 18 * Math.sin(y / 70 + 1), y); }
          poly(E, wl, 4); poly(E, wet, 2);
          for (let i = 0; i < 16; i++) {
            const x = SHORE + 60 + (WW - SHORE - 60) * rnd(i, 21) + 30 * Math.sin(t * 1.3 + i), y = 40 + (HH - 80) * rnd(i, 22);
            wavy(E, x, x + 60 + 50 * rnd(i, 26), y, 5, 70, t * 3 + i, 3);
          }
          const foam = []; for (let y = -20; y <= HH + 20; y += 30) foam.push(SHORE + 34 + 22 * Math.sin(y / 90 + t * 1.5 + 0.6) + 8 * Math.sin(y / 23 - t * 4), y);
          poly(E, foam, 2);
          for (let i = 0; i < 14; i++) disc(E, SHORE * rnd(i, 23) - 30, HH * rnd(i, 24), 3 + 3 * rnd(i, 25));
          E.back = false;
          // sand kicked up as the feet plant on land
          emit(t, 0.5, 0.7, (i, te, age) => {
            const Q = poseAt(te);
            for (const f of (i % 2 ? [1, 2] : [0, 3])) {
              const [x, y] = pt(Q, te, FEET[f][0], FEET[f][1]);
              if (x < SHORE - 30) puff(E, x, y, 34, age, 0.7, -50, 0.1);
            }
          }, 0.25, 2.6);
          // the V-shaped wake from the snout, and rings from the beating tail
          if (V.swim > 0.05) {
            const arms = [[], []];
            emit(t, 0.08, 0.75, (i, te, age) => {
              const Q = poseAt(te), [x, y] = pt(Q, te, 0.07, 0.42);
              if (x < SHORE + 30) return;
              const sp = 300 * age + 6;
              arms[0].push(x - sp * 0.3, y - sp); arms[1].push(x - sp * 0.3, y + sp);
            }, 2.2);
            E.back = true;
            for (const a of arms) if (a.length >= 4) poly(E, a, 4);
            E.back = false;
            emit(t, 0.375, 0.9, (i, te, age) => { const Q = poseAt(te), [x, y] = pt(Q, te, 0.94, 0.84); if (x > SHORE) ripple(E, x, y, age, 0.9, 70, 0.9, 2); }, 2.4);
          }
        } else if (V.b === 'scan' || V.b === 'bask') {
          // basking: heat shimmer rising off its back
          if (V.bask > 0.3) for (let i = 0; i < 4; i++) {   // heat shimmer rising off its back
            const [x, y] = at(sc, P, 0.26 + 0.09 * i, 0.5), rise = frac(t * 0.7 + i * 0.37), y0 = y - 40 - 170 * rise, pts = [];
            for (let j = 0; j <= 8; j++) pts.push(x + 9 * Math.sin(j * 1.4 + t * 5 + i), y0 - j * 11);
            if (rise < 0.85) poly(E, pts, 2.5);
          }
        }
        // the forked tongue: out, a quick flicker of the tips, and in
        if (V.tongue > 0.02) {
          const [bx, by] = pt(P, t, 0.05, 0.403), [hx, hy] = pt(P, t, 0.16, 0.44);
          const a = Math.atan2(by - hy, bx - hx), L = (V.b === 'scan' ? 190 : 130) * k * Math.min(1, V.tongue);
          const tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L;
          line(E, bx, by, tx, ty, 4 * k + 1);
          const wag = 0.25 * Math.sin(t * 60);
          for (const sd of [-1, 1]) {
            const aa = a + sd * 0.42 + wag;
            line(E, tx, ty, tx + Math.cos(aa) * 34 * k, ty + Math.sin(aa) * 34 * k, 3.5 * k + 1);
          }
        }
      },
    };
  })();

  // ===== Smooth-coated otter ========================================================================================
  // A humped, bounding lope on land, two bounds a second: hind feet push, a flight, front feet land, the back humps as the
  // hind feet come up beside them. In water the tail and hind legs drive; it stands up to look round (the periscope).
  (function () {
    const ID = 'smooth-coated-otter';
    const PASS = [['bound', 2.6], ['leap', 0.753], ['plunge', 0.75], ['under', 0.35]];
    const OUT = [['turn', 0.4], ['bound', 1.0], ['slide', 0.6], ['swim', 1.6], ['scope', 2.0], ['dive', 0.7], ['under', 0.5],
      ['climb', 1.0], ['shake', 1.1], ['home', 1.0]];
    const NOSE = [0.08, 0.37], TAILTIP = [0.95, 0.66], TAILBASE = [0.79, 0.56];
    const GROUND = 700, BANK = 1400, WATER = 742;          // the pass: bank top, its edge, the river's surface
    const LEAP = { vx: 700, vy: -420, g: 2200 };

    /** One bound at phase p (0..1): hind feet push (stretched), flight, front feet land, humped. */
    function gait(P, p, amt = 1) {
      const v = P.v;
      v.p = p; v.gait = amt;
      P.sx = 1 + amt * 0.04 * Math.cos(TAU * (p - 0.05));
      v.lift = p < 0.45 ? Math.sin(Math.PI * p / 0.45) * amt : 0;
      v.pitch = 3.5 * Math.sin(TAU * (p - 0.15)) * amt;    // nose down as it comes in to land
    }
    const passX = (t, sc) => -sc.sw / 2 - 70 + 480 * t - 22 * Math.sin(TAU * t / 0.5);
    function boundPose(t, P, sc) {
      gait(P, frac(t / 0.5));
      P.x = passX(t, sc); P.y = GROUND - 0.33 * sc.sh - 0.085 * sc.sh * P.v.lift; P.angle = P.v.pitch;
    }

    M[ID] = {
      facing: 'L', size: [0.6, 0.48],
      pass: { dur: total(PASS), path(t, P, sc) {
        const b = beat(t, PASS), v = P.v, td = beatStart(PASS, 'leap');
        v.b = b.name; P.m = 1;
        if (b.name === 'bound') { boundPose(t, P, sc); return; }
        // the leap: the nose flies on a ballistic arc into the river, the body pitching to follow it
        const Q = new Ink.Pose(); boundPose(td, Q, sc);
        const n0 = [Q.x + (0.5 - NOSE[0]) * sc.sw * Q.sx, Q.y + (NOSE[1] - 0.5) * sc.sh];
        const tau = t - td, te = beatStart(PASS, 'plunge') - td;
        let nx, ny, ang;
        if (tau <= te) {
          nx = n0[0] + LEAP.vx * tau; ny = n0[1] + LEAP.vy * tau + 0.5 * LEAP.g * tau * tau;
          ang = 0.8 * Math.atan2(LEAP.vy + LEAP.g * tau, LEAP.vx) * 180 / Math.PI;
          ang = lerp(Q.angle, ang, S(0, 0.2, tau));
        } else {   // under the surface it keeps its line and slows
          const ve = [LEAP.vx, LEAP.vy + LEAP.g * te], sp = Math.hypot(ve[0], ve[1]), d = tau - te;
          const dist = sp * d - 300 * d * d, e = [ve[0] / sp, ve[1] / sp];
          nx = n0[0] + LEAP.vx * te + e[0] * dist; ny = n0[1] + LEAP.vy * te + 0.5 * LEAP.g * te * te + e[1] * dist;
          ang = Math.atan2(ve[1], ve[0]) * 180 / Math.PI * lerp(0.8, 1, S(0, 0.4, d));
        }
        gait(P, frac(t / 0.5), 1 - S(0, 0.3, tau));   // the bound's shape melts into the dive
        P.sx = lerp(Q.sx, 1, S(0, 0.15, tau));
        Ink.pin(sc, P, 1 - NOSE[0], NOSE[1], nx, ny, ang);
        v.lift = 0; v.dive = S(0, 0.35, tau);
        v.entry = [n0[0] + LEAP.vx * te, WATER]; v.te = td + te;
        const tip = Ink.pointOf(sc, Object.assign({}, P, { mirror: true }), TAILTIP[0], TAILTIP[1]);
        if (b.name === 'under' || tip[1] > WATER + 20) P.hidden = true;
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, k = b.k, hs = sc.homeScale;
        const W = sc.hy + 0.33 * sc.sh + 20, bank = sc.hx + 300;   // the pool's surface; where the bank drops into it
        v.b = b.name; v.W = W; v.bank = bank; v.gait = 0; v.lift = 0;
        const swimY = W + 0.13 * sc.sh;   // floating: only the head and the line of the back above the water
        const S1 = [bank + 230, swimY], S2 = [reachX(sc, 0.97), swimY], CL = [sc.hx + 40, sc.hy];
        if (b.name === 'turn') { P.m = cardTurn(P, k) ? 1 : -1; }
        else if (b.name === 'bound') {
          P.m = 1; gait(P, frac(b.t / 0.5), hump(k) ** 0.3);
          P.x = lerp(sc.hx, bank - 60, k); P.y = sc.hy - 0.05 * sc.sh * v.lift; P.angle = v.pitch;
        } else if (b.name === 'slide') {   // slips in nose first
          P.m = 1; const e = ease(k);
          P.x = lerp(bank - 60, S1[0], e); P.y = lerp(sc.hy, S1[1], e); P.angle = 22 * hump(k) - 4 * S(0.6, 1, k);
          v.swim = S(0.5, 1, k);
        } else if (b.name === 'swim') {
          P.m = 1; const e = ease(k);
          P.x = lerp(S1[0], S2[0], e); P.y = S1[1] + 6 * Math.sin(TAU * 1.2 * b.t); P.angle = -4 + 2 * Math.sin(TAU * 1.2 * b.t + 1);
          v.swim = 1;
        } else if (b.name === 'scope') {   // stands up in the water about the tail base: the periscope
          P.m = 1; v.swim = 1;
          const up = S(0, 0.25, k) * S(1, 0.82, k), d = 1.6, a0 = -4 + 2 * Math.sin(TAU * 1.2 * d + 1);
          v.up = up; v.scan = Math.sin(TAU * 1.25 * S(0.2, 0.8, k)) * S(0.15, 0.3, k) * S(0.85, 0.7, k);
          const Q = Object.assign(new Ink.Pose(), { x: S2[0], y: S2[1] + 6 * Math.sin(TAU * 1.2 * d), angle: a0, scale: hs, mirror: true });
          const base = Ink.pointOf(sc, Q, TAILBASE[0], TAILBASE[1]), bob = 4 * Math.sin(TAU * 0.9 * b.t) * up;
          Ink.pin(sc, P, 1 - TAILBASE[0], TAILBASE[1], base[0], base[1] + 40 * up + bob, lerp(a0, -70, up));
        } else if (b.name === 'dive') {   // nose down, tail last
          P.m = 1; v.swim = 1; const e = ease(k);
          P.x = S2[0] + 140 * e; P.y = S2[1] + 0.75 * sc.sh * k * k; P.angle = -4 + 50 * S(0, 0.55, k);
          v.flip = S(0.2, 0.6, k);
          if (k > 0.97) P.hidden = true;
        } else if (b.name === 'under') { P.m = -1; P.hidden = true; P.x = bank + 280; P.y = W + 0.4 * sc.sh; }
        else if (b.name === 'climb') {   // out onto the bank, streaming water
          P.m = -1; const e = ease(k);
          P.x = lerp(bank + 280, CL[0], e); P.y = lerp(W + 0.4 * sc.sh, CL[1], ease(k * 1.15)); P.angle = 22 * hump(k * 0.9) * (1 - S(0.8, 1, k));
          v.wet = 1;
        } else if (b.name === 'shake') {   // shakes off: fast twists, a fan of spray
          P.m = -1; P.x = CL[0]; P.y = CL[1];
          const env = S(0, 0.12, k) * S(1, 0.75, k);
          v.shake = env; P.angle = 3.5 * env * Math.sin(TAU * 9 * b.t); P.sx = 1 - 0.03 * env * Math.abs(Math.sin(TAU * 9 * b.t));
        } else {
          P.m = -1; gait(P, frac(b.t / 0.5), hump(k) ** 0.4);
          P.x = lerp(CL[0], sc.hx, ease(k)); P.y = sc.hy - 0.04 * sc.sh * v.lift; P.angle = -v.pitch;
        }
        P.scale = hs;
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        if (V.gait) {
          const p = V.p, g = V.gait;
          // the back humps as the hind feet come up under it
          const hmp = (0.5 - 0.5 * Math.cos(TAU * (p - 0.1))) * g;
          o[1] -= 0.06 * hmp * Math.exp(-(((u - 0.52) / 0.2) ** 2)) * S(0.8, 0.45, v);
          // hind legs reach forward under the hump and push back when stretched; the forelegs the other way
          const sw = Math.cos(TAU * (p - 0.6)) * g;
          shift(o, -0.075 * sw * clamp((v - 0.6) / 0.24, 0, 1), -0.015 * Math.max(0, sw), box(u, v, 0.6, 0.6, 0.84, 0.95, 0.03));
          shift(o, 0.065 * sw * clamp((v - 0.6) / 0.24, 0, 1), -0.02 * (V.lift || 0), box(u, v, 0.21, 0.6, 0.4, 0.95, 0.03));
          // the head stays level-ish; the tail trails a beat behind
          rot(o, u, v, 0.28, 0.42, -0.7 * 3.5 * Math.sin(TAU * (p - 0.15)) * g, S(0.3, 0.2, u), r);
          rot(o, u, v, 0.79, 0.56, 9 * Math.sin(TAU * (p - 0.35)) * g, S(0.78, 0.88, u), r);
        }
        if (V.swim) {   // the back rolls in a slow wave; the tail sculls
          o[1] += 0.014 * V.swim * Math.sin(TAU * (1.3 * u - 1.1 * t)) * S(0.25, 0.4, u) * S(0.5, 0.2, v);
          rot(o, u, v, 0.79, 0.56, 10 * Math.sin(TAU * 1.6 * t) * V.swim, S(0.78, 0.9, u), r);
          shift(o, 0.04 * Math.sin(TAU * 1.6 * t) * V.swim, 0, box(u, v, 0.6, 0.66, 0.84, 0.95, 0.03));
        }
        if (V.scan) rot(o, u, v, 0.28, 0.45, 11 * V.scan, S(0.32, 0.22, u), r);
        if (V.up) rotScale(o, u, v, 0.3, 0.62, -62 * V.up, 1 - 0.25 * V.up, box(u, v, 0.18, 0.62, 0.42, 0.95, 0.03), r);   // forepaws tucked to the chest
        if (V.flip) rot(o, u, v, 0.79, 0.56, -35 * V.flip, S(0.78, 0.9, u), r);
        if (V.shake) {   // the loose skin twists round the body, head and rump against each other
          const w = Math.sin(TAU * 9 * t);
          rot(o, u, v, 0.3, 0.45, 9 * V.shake * w, S(0.34, 0.2, u), r);
          rot(o, u, v, 0.75, 0.5, -10 * V.shake * w, S(0.7, 0.85, u), r);
          o[1] += 0.012 * V.shake * Math.sin(TAU * 9 * t + u * 9) * S(0.6, 0.3, v);
        }
        // whiskers and breath, always
        rot(o, u, v, 0.12, 0.42, 4 * Math.sin(TAU * 1.3 * t), S(0.12, 0.05, u) * S(0.36, 0.42, v), r);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          // the bank, its edge, and the river below it
          E.back = true;
          poly(E, [-20, GROUND, BANK, GROUND, BANK + 50, WATER + 6], 4);
          for (let i = 0; i < 10; i++) { const x = BANK * rnd(i, 31); line(E, x, GROUND + 14 + 30 * rnd(i, 32), x + 40, GROUND + 14 + 30 * rnd(i, 32), 2); }
          E.back = false;
          water(E, BANK + 30, WW + 20, WATER, t, 9);
          // tufts kicked back from the bounding feet
          if (V.b === 'bound') emit(t, 0.5, 0.6, (i, te, age) => { const Q = poseAt(te + 0.25), [x] = at(sc, Q, 0.72, 0.83); puff(E, x - 30, GROUND - 6, 30, age, 0.6, -70, 0.3); }, 0.2, 2.6);
          if (V.entry) {
            const age = t - V.te;
            if (age > 0) { splash(E, V.entry[0], WATER, age, 0.8, 9, 95, 3); ripple(E, V.entry[0], WATER + 4, age, 1.1, 170, 0.18, 3); }
            if (age > 0.2) bubbles(E, t, tt => V.entry[0] + 120 + 200 * (tt - V.te), WATER + 230, 0.18, 0.7, 2, 160, 5, V.te + 0.2, V.te + 1.2);
            if (age > 1.0) ripple(E, V.entry[0] + 260, WATER + 4, age - 1.0, 0.8, 90, 0.2, 2);
          }
          return;
        }
        // ---- the outing: a pool beyond the bank; the water comes up as it goes in and drains when it is home
        const dur = total(OUT), lvl = lerp(HH + 60, V.W, S(0.2, 1.4, t) * S(dur, dur - 1.2, t)), bank = V.bank;
        if (lvl < HH + 50) {
          E.back = true; poly(E, [-20, V.W - 0, bank, V.W - 0], 4); E.back = false;
          poly(E, [-20, V.W + 8, bank, V.W + 8, bank + 110, lvl + 4, bank + 110, HH + 20, -20, HH + 20], 0, true, 2);   // the bank hides what is under it
          poly(E, [bank, V.W, bank + 110, lvl + 4], 4);
          for (let i = 0; i < 6; i++) { const x = 60 + (bank - 120) * rnd(i, 44); line(E, x, V.W + 22 + 40 * rnd(i, 45), x + 36, V.W + 22 + 40 * rnd(i, 45), 2); }
          water(E, bank + 70, WW + 20, lvl, t, 7);
        }
        const b = beat(t, OUT);
        if (V.b === 'slide') { const age = b.t - 0.25; if (age > 0) splash(E, bank + 120, V.W, age, 0.6, 7, 70, 1); }
        if (V.b === 'swim' || V.b === 'scope') {   // rings round the body where it breaks the surface; a wake off the chin
          const [cx] = at(sc, P, 0.2, 0.4);
          ripple(E, cx, V.W + 2, t % 0.7, 0.7, 110, 0.18, 2);
          if (V.b === 'swim') { const [nx] = at(sc, P, 0.07, 0.4); for (let i = 0; i < 3; i++) arc(E, nx + 10 + i * 16, V.W + 2, 22 + i * 12, -60, 120, 3 - i * 0.7); }   // the bow wave at its chin
        }
        if (V.b === 'scope' && V.up > 0.3) {   // drops falling from its chin and paws
          emit(b.t, 0.16, 0.5, (i, te, age) => { const [x, y] = at(sc, poseAt(beatStart(OUT, 'scope') + te), 0.2 + 0.08 * (i % 3), 0.62); if (y + 600 * age * age < V.W) blob(E, x + 6 * (i % 2), y + 30 + 700 * age * age, 5, 8, 0); }, 0.4, 1.7);
        }
        if (V.b === 'dive') { const age = b.t - 0.3; if (age > 0) { splash(E, at(sc, P, 0.6, 0.4)[0], V.W, age, 0.5, 5, 55, 4); } }
        if (V.b === 'dive' || V.b === 'under') { const t0 = beatStart(OUT, 'dive') + 0.5; ripple(E, reachX(sc, 0.97) + 160, V.W + 2, t - t0, 1.0, 140, 0.18, 3); }
        if (V.b === 'under') bubbles(E, t, tt => lerp(reachX(sc, 0.97) + 100, V.bank + 160, (tt - beatStart(OUT, 'under')) / 0.5), V.W + 120, 0.12, 0.4, 2, 110, 7, beatStart(OUT, 'under'), beatStart(OUT, 'climb'));
        if (V.b === 'climb') {   // water streaming off as it hauls out
          emit(b.t, 0.1, 0.45, (i, te, age) => { const Q = poseAt(beatStart(OUT, 'climb') + te), [x, y] = at(sc, Q, 0.3 + 0.1 * (i % 5), 0.8); blob(E, x, y + 900 * age * age, 4, 8, 0); }, 0, 1);
          ripple(E, V.bank + 200, V.W + 2, b.t, 1.0, 130, 0.18, 2);
        }
        if (V.shake > 0.2) {   // a fan of spray flung off the coat
          const [cx, cy] = at(sc, P, 0.5, 0.42);
          for (let i = 0; i < 30; i++) {
            const a = -Math.PI * (0.05 + 0.9 * rnd(i, 41)), ph = frac(t * 2.2 + rnd(i, 42)), d = 260 + 300 * ph + 120 * rnd(i, 43);
            const x = cx + Math.cos(a) * d * 1.25, y = cy + Math.sin(a) * d * 0.75 + 260 * ph * ph;
            if (ph < 0.7) { const l = 30 * (1 - ph); line(E, x, y, x - Math.cos(a) * l, y - Math.sin(a) * l, 4); }
            else blob(E, x, y, 6, 6, 0);
          }
        }
      },
    };
  })();

  // ===== Saltwater crocodile ========================================================================================
  // Belly-slides in lurches, or lifts into a high walk on straightened legs with the tail tip dragging; leaves a
  // trackway of clawed prints and a tail groove. Lies with its jaws open for long spells, then snaps them shut.
  (function () {
    const ID = 'saltwater-crocodile';
    const PASS = [['slide', 1.6], ['rise', 0.6], ['walk', 2.8]];
    const OUT = [['turn', 0.45], ['walk', 2.5], ['turn2', 0.45], ['open', 0.55], ['hold', 3.0], ['snap', 0.5], ['slide', 1.75], ['rise', 0.35]];
    // legs: [u0, u1, phase, near (1) or far (0)]: near front with far hind, far front with near hind
    const LEGS = [[0.22, 0.335, 0, 1], [0.335, 0.43, 0.5, 0], [0.54, 0.65, 0.5, 1], [0.65, 0.76, 0, 0]];
    const FOOT_V = 0.745, BELLY_V = 0.6, HINGE = [0.305, 0.462], STRIDE = 1.25;
    const jawPt = (u, v, deg, r) => {   // a point of the upper jaw turned about the hinge, in drawing units
      const a = deg * Math.PI / 180, dx = (u - HINGE[0]) * r, dy = v - HINGE[1];
      return [HINGE[0] + (Math.cos(a) * dx - Math.sin(a) * dy) / r, HINGE[1] + Math.sin(a) * dx + Math.cos(a) * dy];
    };
    /** A belly-slide lurch: progress that surges with each shove of the legs (period per). */
    const lurch = (t, per) => t - 0.8 * per * Math.sin(TAU * t / per) / TAU;

    function passX(t, sc) {
      const x0 = -sc.sw / 2 - 60, x1 = WW + sc.sw / 2 + 60, T = total(PASS), ts = 1.6;
      const F = tt => (tt < ts ? 0.8 * lurch(tt, 0.53) : 0.8 * lurch(ts, 0.53) + 0.8 * (tt - ts) + 0.2 * sInt(ts, ts + 0.8, tt));
      return x0 + (x1 - x0) * F(t) / F(T);
    }

    M[ID] = {
      facing: 'L', size: [0.75, 0.6],
      pass: { dur: total(PASS), path(t, P, sc) {
        const b = beat(t, PASS), v = P.v, g = HH - 150;
        v.b = b.name; v.g = g; P.m = 1; P.x = passX(t, sc);
        v.up = b.name === 'slide' ? 0 : b.name === 'rise' ? ease(b.k) : 1;     // 0 on its belly, 1 in the high walk
        v.shove = b.name === 'slide' ? frac(t / 0.53) : -1; v.shoveAmt = b.name === 'slide' ? 1 - S(0.75, 1, b.k) : 0;
        v.walk = b.name === 'walk' ? Math.min(1, b.t / 0.3) : 0; v.wt = t - beatStart(PASS, 'walk');
        P.y = g - (FOOT_V - 0.5) * sc.sh + (FOOT_V - BELLY_V) * sc.sh * (1 - v.up) * 0.85;
        if (v.walk) P.y -= 0.008 * sc.sh * Math.abs(Math.sin(TAU * v.wt / STRIDE));
        P.angle = v.shove >= 0 ? -1.2 * Math.sin(TAU * v.shove) : 0.6 * Math.sin(TAU * v.wt / STRIDE * 2) * v.walk;
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, k = b.k, far = reachX(sc, 0.66);
        v.b = b.name; v.up = 1; v.walk = 0; v.shove = -1; v.gape = 0; v.g = sc.hy + (FOOT_V - 0.5) * sc.sh;
        if (b.name === 'turn') P.m = cardTurn(P, k) ? 1 : -1;
        else if (b.name === 'walk') {
          P.m = 1; v.walk = S(0, 0.15, k) * S(1, 0.85, k); v.wt = b.t;
          P.x = lerp(sc.hx, far, ease(k) * 0.3 + k * 0.7); P.y = sc.hy - 0.006 * sc.sh * Math.abs(Math.sin(TAU * b.t / STRIDE)) * v.walk;
        } else if (b.name === 'turn2') { P.x = far; P.y = sc.hy; P.m = cardTurn(P, k) ? -1 : 1; }
        else if (b.name === 'open') { P.m = -1; P.x = far; P.y = sc.hy; v.gape = ease(clamp(b.t / 0.4, 0, 1)); }
        else if (b.name === 'hold') { P.m = -1; P.x = far; P.y = sc.hy; v.gape = 1; v.hold = b.t; }
        else if (b.name === 'snap') {   // shut in one frame; the whole body jolts
          P.m = -1; P.x = far - 10 * hump(b.t / 0.12) * (b.t < 0.12 ? 1 : 0); P.y = sc.hy + 6 * hump(clamp(b.t / 0.2, 0, 1));
          v.snap = b.t; v.cut = b.t < 1 / 60;
        } else if (b.name === 'slide') {   // drops onto its belly and shoves itself home in lurches
          P.m = -1; v.up = 1 - S(0, 0.2, k); v.shove = frac(b.t / 0.44); v.shoveAmt = S(0.05, 0.25, k) * S(1, 0.85, k);
          P.x = lerp(far, sc.hx, lurch(b.t, 0.44) / lurch(b.d, 0.44));
          P.y = sc.hy + (FOOT_V - BELLY_V) * sc.sh * 0.85 * (1 - v.up); P.angle = -1 * Math.sin(TAU * v.shove) * (1 - v.up);
        } else {
          P.m = -1; P.x = sc.hx; v.up = ease(k); P.y = sc.hy + (FOOT_V - BELLY_V) * sc.sh * 0.85 * (1 - v.up);
        }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, up = V.up === undefined ? 1 : V.up;
        const legs = box(u, v, 0.2, 0.5, 0.78, 1.0, 0.03);
        // on its belly the legs splay out sideways (seen side-on: squashed) and shove back in turn
        if (up < 1) {
          scl(o, u, v, u, 0.53, 1, 1 - 0.5 * (1 - up), legs);
          if (V.shove >= 0) {
            const push = Math.sin(TAU * V.shove);
            const amt = (1 - up) * (V.shoveAmt || 0);
            for (const [u0, u1, ph] of LEGS) shift(o, 0.05 * Math.sin(TAU * (V.shove + ph * 0.5)) * clamp((v - 0.52) / 0.22, 0, 1), 0, amt * box(u, v, u0, 0.5, u1, 1.0, 0.025));
            rot(o, u, v, 0.6, 0.5, 2.5 * push * amt, S(0.62, 0.8, u), r);
          }
        }
        // the high walk: legs straight under it, diagonal pairs stepping; each foot lifts as it swings forward
        if (up > 0) scl(o, u, v, u, FOOT_V, 1, 1 + 0.1 * up, legs);
        if (V.walk) for (const [u0, u1, ph] of LEGS) {
          const q = TAU * (V.wt / STRIDE + ph), w = V.walk * box(u, v, u0, 0.5, u1, 1.0, 0.025), reach = clamp((v - 0.5) / 0.25, 0, 1);
          shift(o, -0.045 * Math.cos(q) * reach, -0.03 * Math.max(0, Math.sin(q)) * reach, w);
        }
        // the tail: its tip drags on the ground when the body is up; a slow sway, the tip a beat behind
        rot(o, u, v, 0.6, 0.48, 12 * up + 2.5 * Math.sin(TAU * 0.4 * t), S(0.62, 0.82, u), r);
        rot(o, u, v, 0.84, 0.55, 4 * Math.sin(TAU * 0.4 * t - 1), S(0.84, 0.95, u), r);
        // the gape: the upper jaw lifts about its hinge; the throat flutters while it holds
        if (V.gape) {
          rot(o, u, v, HINGE[0], HINGE[1], 25 * V.gape, box(u, v, -0.3, -0.2, HINGE[0], 0.455, 0.012), r);
          if (V.hold !== undefined) shift(o, 0, 0.006 * Math.sin(TAU * 3 * t), box(u, v, 0.18, 0.47, 0.34, 0.56, 0.03));
        }
        // it always breathes, slowly
        scl(o, u, v, 0.45, 0.42, 1, 1 + 0.008 * Math.sin(TAU * 0.35 * t), box(u, v, 0.3, 0.25, 0.62, 0.6, 0.05));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v, g = V.g, pass = mode === 'pass', dir = pass ? 1 : P.m;
        const pt = (Q, tt, u, v) => atB(sc, Q, ID, u, v, tt);
        E.back = true;
        if (pass) poly(E, [-20, g + 2, WW + 20, g + 2], 3);
        // the trackway: a smooth swept patch where it slid, then two rows of clawed prints and the wavy tail groove
        if (pass) {
          const ts = beatStart(PASS, 'rise'), tw = beatStart(PASS, 'walk');
          const [sx1] = pt(poseAt(Math.min(t, ts + 0.3)), Math.min(t, ts + 0.3), 0.62, BELLY_V);
          const sx0 = -40;
          if (sx1 > sx0) { line(E, sx0, g + 16, sx1, g + 16, 2); line(E, sx0, g + 30, sx1 - 40, g + 30, 2); line(E, sx0, g + 44, sx1 - 90, g + 44, 2); }
          if (t > tw) {
            for (let i = 0; i < 40; i++) {
              const te = tw + (i + 0.5) * STRIDE / 2; if (te > t) break;
              const Q = poseAt(te);
              for (const [j, lg] of LEGS.entries()) {
                if ((i % 2 === 0) !== (lg[2] === 0)) continue;
                const [x] = pt(Q, te, (lg[0] + lg[1]) / 2, FOOT_V);
                claw(E, x, g + (lg[3] ? 46 : 22), 1, 10);
              }
            }
            const pts = [], tip = pt(P, t, 0.955, 0.6);
            for (let x = tip[0]; x > sx1 - 200; x -= 24) pts.push(x, g + 34 + 7 * Math.sin(x / 45));
            if (pts.length > 3) poly(E, pts, 3);
          }
          // the shove raises a little dust off the slide
          if (V.shove >= 0) emit(t, 0.53, 0.5, (i, te, age) => { const [x] = pt(poseAt(te + 0.13), te + 0.13, 0.66, 0.72); puff(E, x, g - 4, 40, age, 0.5, -60, 0.3); }, 0, 1.6);
          E.back = false;
          return;
        }
        E.back = false;
        const b = beat(t, OUT);
        // the gape: the open mouth, pale inside, a row of teeth on each jaw
        if (V.gape > 0.02) {
          const r = sc.a.w / sc.a.h, deg = 25 * V.gape;
          const H = at(sc, P, HINGE[0], HINGE[1]), U = at(sc, P, ...jawPt(0.05, 0.456, deg, r)), L = at(sc, P, 0.05, 0.472);
          poly(E, [H[0], H[1], U[0], U[1], L[0], L[1]], 3, true, 2);
          for (const [A, B, sd] of [[U, H, 1], [L, H, -1]]) {
            const n = 9, tt = [];
            for (let i = 0; i <= n * 2; i++) {
              const kk = i / (n * 2), x = lerp(A[0], B[0], kk * 0.88), y = lerp(A[1], B[1], kk * 0.88);
              const nx = -(B[1] - A[1]), ny = B[0] - A[0], nl = Math.hypot(nx, ny), d = i % 2 ? 14 * sd : 0;
              tt.push(x + nx / nl * d * (sd * Math.sign(ny) || 1), y + ny / nl * d * (sd * Math.sign(ny) || 1));
            }
            poly(E, tt, 2.5, false, 0);
          }
          const T = [lerp(H[0], U[0], 0.18), lerp(H[1], U[1], 0.18)], T2 = [lerp(H[0], L[0], 0.18), lerp(H[1], L[1], 0.18)];
          poly(E, [H[0], H[1], T[0], T[1], T2[0], T2[1]], 0, true, 1);   // the dark throat
        }
        // a fly: it circles the open jaws, lands on the snout, and is gone at the snap
        if (V.b === 'hold' || V.b === 'open' || (V.b === 'snap' && V.snap < 0.45)) {
          const [sx, sy] = at(sc, P, ...jawPt(0.12, 0.4, 25 * (V.gape || 0), sc.a.w / sc.a.h));
          const h = V.b === 'hold' ? V.hold : V.b === 'open' ? -0.3 : 3 + V.snap;
          let fx = sx + 160 * Math.cos(h * 3.1) + 60 * Math.sin(h * 7), fy = sy - 120 + 70 * Math.sin(h * 4.3);
          const land = S(1.8, 2.3, h) * (h < 3 ? 1 : 0);
          fx = lerp(fx, sx, land); fy = lerp(fy, sy - 18, land);
          if (h >= 3) { const e = (h - 3) / 0.45; fx = sx + 40 + 700 * e * e - 60 * Math.sin(e * 14); fy = sy - 30 - 500 * e; streaks(E, fx, fy, 3, 50, 30, t, 7, 2); }
          blob(E, fx, fy, 7, 5, 0);
          const fl = land > 0.9 && h < 3 ? 0.3 : 0.5 + 0.5 * Math.sin(t * 80);
          oval(E, fx - 4, fy - 8 * fl - 3, 8, 4 * fl + 1, -30, 2); oval(E, fx + 4, fy - 8 * fl - 3, 8, 4 * fl + 1, 30, 2);
        }
        // the snap: marks bursting off the shut jaws
        if (V.b === 'snap' && V.snap < 0.35) {
          const [x, y] = at(sc, P, 0.08, 0.45), k = V.snap / 0.35;
          for (let i = 0; i < 7; i++) {
            const a = Math.PI * (0.55 + 0.9 * i / 6), r0 = 40 + 120 * k, r1 = r0 + 50 * (1 - k);
            line(E, x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.8, x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.8, 5);
          }
        }
        // the slide home: the belly smooths a groove behind it
        if (V.b === 'slide' || V.b === 'rise') {
          const t0 = beatStart(OUT, 'slide') + 0.2, [x0] = pt(poseAt(t0), t0, 0.62, BELLY_V), [x1] = pt(P, t, 0.62, BELLY_V);
          E.back = true; if (t > t0) { line(E, x1, g + 8, x0, g + 8, 2); line(E, x1 + 30, g + 16, x0 - 20, g + 16, 2); }
          if (V.shove >= 0) emit(b.t, 0.44, 0.45, (i, te, age) => puff(E, at(sc, P, 0.3, 0.7)[0] + 60 * age, g - 4, 30, age, 0.45, 40, 0.3), 0.1, 1.6);
          E.back = false;
        }
        if (V.b === 'walk') emit(b.t, STRIDE / 2, 0.6, (i, te, age) => { const Q = poseAt(beatStart(OUT, 'walk') + te), [x] = at(sc, Q, i % 2 ? 0.3 : 0.7, FOOT_V); puff(E, x, g - 2, 24, age, 0.6, -30, 0.3); }, 0.3, 2.3);
      },
    };
  })();

  // ===== Malayan peacock-pheasant ===================================================================================
  // A shy walker of the forest floor: quick light steps, the head held still in space then thrust forward. Displays low
  // and flat, the tail fanned up toward the watcher so its eyespots open; athletic jumps. Picks up a titbit and shakes it.
  (function () {
    const ID = 'malayan-peacock-pheasant';
    const PASS = [['run', 1.75], ['display', 1.25], ['run2', 1.6]];
    const OUT = [['turn', 0.4], ['walk', 1.5], ['scratch', 1.6], ['titbit', 1.4], ['display', 2.2], ['jump', 0.6], ['home', 1.3]];
    const STEP = 0.3, FOOT_V = 0.955, TAILBASE = [0.47, 0.47];
    const EYES = [[0.64, 0.375], [0.755, 0.355], [0.865, 0.385], [0.685, 0.515], [0.79, 0.52], [0.89, 0.49], [0.3, 0.44], [0.375, 0.44], [0.44, 0.48]];
    const LEGS = [[0.2, 0.31, 0], [0.31, 0.43, 0.5]];

    /** The walk at phase q (steps): legs swing in turn, the head lags then thrusts; lag is how far the body slides per step. */
    function walk(P, q, amt, lag) {
      const v = P.v; v.q = q; v.walk = amt;
      const p = frac(q);   // the head holds still in space for most of a step, then thrusts to catch up
      v.bob = amt * lag * ((p < 0.62 ? p / 0.62 : 1 - S(0.62, 1, p)) - 0.45);
    }
    function passX(t, sc) {
      const x0 = -sc.sw / 2 - 60, x1 = WW + sc.sw / 2 + 60, T = total(PASS);
      const F = tt => tt - 0.85 * sInt(1.6, 1.9, tt) + 0.85 * sInt(2.85, 3.15, tt);   // slows almost to a stop to display
      return x0 + (x1 - x0) * F(t) / F(T);
    }

    M[ID] = {
      facing: 'L', size: [0.6, 0.55],
      pass: { dur: total(PASS), path(t, P, sc) {
        const b = beat(t, PASS), v = P.v, g = HH - 40;
        v.b = b.name; P.m = 1; P.x = passX(t, sc);
        const run = 1 - S(1.55, 1.85, t) + S(2.85, 3.15, t);
        walk(P, t / STEP, run, 0.13);
        v.fan = 0; v.low = 0;
        if (b.name === 'display') {   // squashes low, the tail swings up and spreads its eyespots, a hop, and away
          const k = b.k;
          v.fan = S(0, 0.25, k) * S(1, 0.8, k); v.low = v.fan;
          v.hop = k > 0.55 && k < 0.85 ? hump((k - 0.55) / 0.3) : 0;
          v.quiver = v.fan;
        }
        P.sy = 1 - 0.08 * v.low;
        P.y = g - (FOOT_V - 0.5) * sc.sh * P.sy - 0.08 * sc.sh * (v.hop || 0) - 0.012 * sc.sh * Math.abs(Math.sin(Math.PI * t / STEP)) * run;
        P.angle = 2.5 * v.low;   // the body tips forward, flat to the ground
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, k = b.k, far = reachX(sc, 0.6), hs = sc.homeScale;
        v.b = b.name; v.fan = 0; v.low = 0; v.walk = 0; v.bob = 0; v.peck = 0; v.shake = 0; v.rake = 0;
        P.scale = hs;
        if (b.name === 'turn') P.m = cardTurn(P, k) ? 1 : -1;
        else if (b.name === 'walk') {
          P.m = 1; P.x = lerp(sc.hx, far, ease(k) * 0.4 + k * 0.6); walk(P, b.t / STEP, S(0, 0.1, k) * S(1, 0.85, k), 0.1);
          P.y = sc.hy - 0.01 * sc.sh * Math.abs(Math.sin(Math.PI * b.t / STEP)) * v.walk;
        } else if (b.name === 'scratch') {   // rakes the litter back twice, then two quick pecks at what turned up
          P.m = 1; P.x = far;
          v.rake = hump(clamp(k / 0.22, 0, 1)) + hump(clamp((k - 0.25) / 0.22, 0, 1));
          v.peck = hump(clamp((k - 0.52) / 0.2, 0, 1)) + hump(clamp((k - 0.76) / 0.2, 0, 1));
        } else if (b.name === 'titbit') {   // lifts a morsel, shakes it three times, drops it
          P.m = 1; P.x = far;
          v.peck = 0.35 * hump(clamp(k / 0.25, 0, 1)); v.morsel = k < 0.72 ? 1 : 0;
          v.shake = S(0.2, 0.28, k) * S(0.7, 0.62, k) * Math.sin(TAU * 3 * clamp((k - 0.22) / 0.46, 0, 1));
        } else if (b.name === 'display') {   // the low fan, held, the eyespots glinting
          P.m = 1; P.x = far; v.fan = S(0, 0.18, k) * S(1, 0.85, k); v.low = v.fan; v.quiver = v.fan; v.glint = b.t;
        } else if (b.name === 'jump') {   // an athletic jump, turning in the air
          P.x = far - 40 * ease(k); P.m = cardTurn(P, S(0.2, 0.8, k)) ? -1 : 1; v.hop = hump(k);
        } else {
          P.m = -1; P.x = lerp(far - 40, sc.hx, ease(k) * 0.4 + k * 0.6); walk(P, b.t / STEP, S(0, 0.1, k) * S(1, 0.8, k), 0.1);
          P.y = sc.hy - 0.01 * sc.sh * Math.abs(Math.sin(Math.PI * b.t / STEP)) * v.walk;
        }
        if (b.name !== 'walk' && b.name !== 'home') P.y = sc.hy;
        const tip = 44 * Math.max(v.peck, 0) + 4 * v.low;   // tips forward over its feet to peck
        v.tip = tip;
        if (tip) {   // the body pitches about the hips; the legs (turned back in the bend) stay upright and planted
          const a = P.m * tip * Math.PI / 180, fx = -P.m * (0.32 - 0.5) * sc.sw, fy = (0.7 - 0.5) * sc.sh;
          P.angle = P.m * tip; P.x += fx - (Math.cos(a) * fx - Math.sin(a) * fy); P.y += fy - (Math.sin(a) * fx + Math.cos(a) * fy);
        }
        P.sy = 1 - 0.08 * v.low; if (v.low) P.y += (FOOT_V - 0.5) * sc.sh * 0.08 * v.low;
        P.y -= 0.16 * sc.sh * (v.hop || 0);
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        // legs: thin, quick; each swings forward lifted, then pushes back planted
        if (V.walk) for (const [u0, u1, ph] of LEGS) {
          const q = TAU * (V.q / 2 + ph), reach = clamp((v - 0.7) / 0.26, 0, 1), w = V.walk * box(u, v, u0, 0.69, u1, 1.05, 0.02);
          shift(o, -0.13 * Math.cos(q) * reach, -0.04 * Math.max(0, Math.sin(q)) * reach, w);
        }
        if (V.tip) rot(o, u, v, 0.32, 0.7, V.tip, box(u, v, 0.16, 0.69, 0.46, 1.1, 0.02), r);
        if (V.rake) shift(o, 0.09 * V.rake * clamp((v - 0.7) / 0.26, 0, 1), -0.02 * V.rake, box(u, v, 0.2, 0.69, 0.31, 1.05, 0.02));
        // the head: held still in space as the body slides under it, then thrust forward
        const head = S(0.33, 0.24, u) * S(0.42, 0.32, v);
        if (V.bob) shift(o, V.bob, 0, head);
        if (V.peck) rot(o, u, v, 0.27, 0.36, -42 * V.peck, head, r);
        if (V.shake) rot(o, u, v, 0.27, 0.36, 16 * V.shake, head, r);
        // the display: mantle up, the tail swung up toward the watcher and spread so the eyespots open
        if (V.fan) {
          const tail = S(0.44, 0.56, u);
          rotScale(o, u, v, TAILBASE[0], TAILBASE[1], -34 * V.fan, 1, tail, r);
          scl(o, u, v, TAILBASE[0], TAILBASE[1], 1, 1 + 0.4 * V.fan, tail);
          scl(o, u, v, u, FOOT_V, 1, 1 - 0.38 * (V.low || 0), S(0.62, 0.74, v));   // legs folded: it sinks flat to the ground
          shift(o, 0, -0.035 * V.fan, box(u, v, 0.22, 0.28, 0.5, 0.5, 0.05));
          rot(o, u, v, 0.27, 0.36, -14 * V.fan, head, r);   // head low, ruffled
          if (V.quiver) o[1] += 0.006 * V.quiver * Math.sin(TAU * 11 * t + u * 8) * tail;
        }
        // the tail sways low as it walks; the crest bobs a beat behind the head
        rot(o, u, v, TAILBASE[0], TAILBASE[1], 2.5 * Math.sin(TAU * (V.q || t) / 2) * (V.walk || 0.3), S(0.5, 0.6, u), r);
        rot(o, u, v, 0.17, 0.2, 6 * Math.sin(TAU * 1.5 * t) + 30 * (V.bob || 0), box(u, v, -0.1, -0.1, 0.17, 0.2, 0.03), r);
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v, pass = mode === 'pass', g = pass ? HH - 40 : sc.hy + (FOOT_V - 0.5) * sc.sh, dir = pass ? 1 : P.m;
        const pt = (Q, tt, u, v) => atB(sc, Q, ID, u, v, tt);
        // leaf litter on the forest floor
        if (pass) { E.back = true; for (let i = 0; i < 14; i++) leaf(E, WW * rnd(i, 51), g + 4 - 6 * rnd(i, 52), 10 * rnd(i, 53) - 5, 14 + 6 * rnd(i, 54), rnd(i, 55) > 0.5); E.back = false; }
        // litter flicked back by each planted foot
        if (V.walk > 0.2) emit(t, STEP, 0.5, (i, te, age) => {
          const Q = poseAt(te), [x] = pt(Q, te, i % 2 ? 0.37 : 0.25, FOOT_V), d = pass ? -1 : -Q.m;
          for (let j = 0; j < 2; j++) { const a = age / 0.5; leaf(E, x + d * (60 + 40 * j) * a, g - 70 * hump(a) * (1 + j * 0.4), 40 * a * d + j * 50, 9, j === 0); }
        });
        if (V.rake) {   // the scratch throws litter back
          const b = beat(t, OUT);
          for (const t0 of [0.05, 0.45]) { const age = b.t - t0; if (age > 0 && age < 0.6) for (let j = 0; j < 4; j++) { const a = age / 0.6, [x] = at(sc, P, 0.25, FOOT_V); leaf(E, x - dir * (40 + 120 * a + 30 * j), g - 140 * hump(a) * (0.6 + 0.2 * j), 60 * a + j * 40, 9, j % 2 === 0); } }
        }
        if (V.morsel) { const [x, y] = pt(P, t, 0.055, 0.3), w = 0.25 * Math.sin(t * 9); for (let j = 0; j < 4; j++) blob(E, x + dir * (4 + 9 * Math.sin(j * 0.9 + w)), y + 8 + j * 10, 8, 6, 20 * dir); }   // a fat grub
        if (V.b === 'titbit') { const b = beat(t, OUT), age = b.t - 0.72 * b.d; if (age > 0) { const [x, y] = at(sc, P, 0.06, 0.3), yy = Math.min(g - 10, y + 8 + 1500 * age * age); for (let j = 0; j < 3; j++) blob(E, x + dir * 10 * j, yy + 3 * Math.sin(j + age * 20), 8, 6, 0); } }
        // the eyespots glint while the fan is up
        if (V.fan > 0.5) {
          for (let i = 0; i < EYES.length; i++) {
            const ph = frac(t * 1.3 + i * 0.37), a = ph < 0.35 ? hump(ph / 0.35) : 0;
            if (a < 0.05) continue;
            const [x, y] = pt(P, t, EYES[i][0], EYES[i][1] - 0.02), l = 40 * a * P.scale;
            line(E, x - l, y, x + l, y, 4); line(E, x, y - l, x, y + l, 4); line(E, x - l * 0.4, y - l * 0.4, x + l * 0.4, y + l * 0.4, 2.5); line(E, x - l * 0.4, y + l * 0.4, x + l * 0.4, y - l * 0.4, 2.5);
          }
        }
        if (V.hop > 0.05 && V.b === 'jump') { const [x] = at(sc, P, 0.3, FOOT_V); puff(E, x, g, 40, beat(t, OUT).t, 0.6, 0, 0.3); }
      },
    };
  })();

  // ===== Malayan sun bear ===========================================================================================
  // The smallest bear, pigeon-toed, often up on its hind legs. Rips open logs with long claws for bees and termites and
  // licks them up with a tongue 20 to 25 cm long. Seen from the front, it waddles across sideways, rocking foot to foot.
  (function () {
    const ID = 'malayan-sun-bear';
    const PASS = [['waddle', 4.6]];
    const OUT = [['look', 0.5], ['go', 1.9], ['sniff', 1.2], ['rake', 1.7], ['lick', 1.7], ['sit', 0.6], ['home', 1.8]];
    const STEP = 0.46, FEET = [0.29, 0.71], FOOT_V = 0.96;
    const SH = [[0.27, 0.33], [0.73, 0.33]];   // shoulders

    /** The waddle at step phase f (steps): rock over the planted foot, the other swings in, pigeon-toed. */
    function waddle(P, sc, f, amt) {
      const v = P.v, i = Math.floor(f), k = f - i, side = i % 2 ? 1 : -1;   // -1: weight on the left foot
      v.f = f; v.amt = amt; v.side = side; v.k = k;
      P.angle += 4.5 * side * Math.sin(Math.PI * k) * amt;
      return -0.012 * sc.sh * Math.sin(Math.PI * k) * amt;   // it rises a little over the planted leg
    }

    M[ID] = {
      facing: 'F', size: [1.1, 0.9],
      pass: { dur: total(PASS), path(t, P, sc) {
        const v = P.v, x0 = -sc.sw / 2 - 90, x1 = WW + sc.sw / 2 + 90, f = t / STEP;
        v.b = 'waddle'; P.m = 1;
        P.x = x0 + (x1 - x0) * (t / 4.6) - 30 * Math.sin(TAU * f) / TAU;   // it lurches a little with each step
        P.y = HH - 18 - (FOOT_V - 0.5) * sc.sh + waddle(P, sc, f, 1);
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, k = b.k, stump = reachX(sc, 0.5);
        v.b = b.name; v.amt = 0; v.sniff = 0; v.rake = 0; v.lean = 0; v.tongue = 0; v.sit = 0;
        P.m = 1;
        if (b.name === 'go') { const e = k * 0.7 + ease(k) * 0.3; P.x = lerp(sc.hx, stump, e); P.y = sc.hy + waddle(P, sc, b.t / STEP * 1.05, S(0, 0.1, k) * S(1, 0.85, k)); }
        else if (b.name === 'home') { const e = k * 0.7 + ease(k) * 0.3; P.x = lerp(stump, sc.hx, e); P.y = sc.hy + waddle(P, sc, b.t / STEP * 1.05, S(0, 0.1, k) * S(1, 0.85, k)); }
        else if (b.name !== 'look') {
          P.x = stump; P.y = sc.hy;
          if (b.name === 'sniff') v.sniff = S(0, 0.15, k) * S(1, 0.85, k);
          if (b.name === 'rake') v.rake = S(0, 0.06, k) * S(1, 0.9, k), v.rt = b.t;
          if (b.name === 'lick') { v.lean = S(0, 0.2, k) * S(1, 0.8, k); v.tongue = k; }
          if (b.name === 'sit') { v.sit = hump(k); }
          if (v.sit) { P.sy = 1 - 0.05 * v.sit; P.y += (FOOT_V - 0.5) * sc.sh * 0.05 * v.sit; }
          if (v.lean) { P.y += 0.02 * sc.sh * v.lean; }
        }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v, amt = V.amt || 0;
        if (amt) {
          // the free leg swings in toward the other (pigeon-toed) and lifts; the arms swing against the legs
          const k = V.k, lift = Math.sin(Math.PI * k) * amt, free = V.side < 0 ? 1 : 0;
          for (let j = 0; j < 2; j++) {
            const w = box(u, v, j ? 0.55 : 0.12, 0.66, j ? 0.88 : 0.45, 1.05, 0.03), down = clamp((v - 0.66) / 0.3, 0, 1);
            if (j === free) shift(o, (j ? -1 : 1) * 0.035 * lift * down, -0.035 * lift * down, w);
            else shift(o, (j ? 1 : -1) * 0.012 * lift * down, 0, w);
            rot(o, u, v, SH[j][0], SH[j][1], (j === free ? 1 : -1) * (j ? -1 : 1) * 7 * lift, box(u, v, j ? 0.68 : -0.1, 0.3, j ? 1.1 : 0.32, 0.68, 0.03), r);
          }
        }
        // the head bobs a beat after the body, ears flick
        const head = box(u, v, 0.22, -0.1, 0.78, 0.3, 0.04);
        shift(o, 0, 0.012 * Math.sin(TAU * ((V.f || 0) / 2) * 2 - 1) * amt, head);
        rot(o, u, v, 0.5, 0.28, 2 * Math.sin(TAU * 0.5 * t), head, r);
        // sniffing: nose up (the muzzle rides up, the face foreshortens), three little bobs
        if (V.sniff) {
          const bob = 0.5 + 0.5 * Math.sin(TAU * 2.5 * t);
          scl(o, u, v, 0.5, 0.3, 1, 1 - (0.05 + 0.02 * bob) * V.sniff, head);
          shift(o, 0, -0.015 * V.sniff * (1 + bob), box(u, v, 0.36, 0.12, 0.64, 0.27, 0.03));
        }
        // raking: each arm lifts out, then claws down across the stump, in turn, three strokes a second
        if (V.rake) for (let j = 0; j < 2; j++) {
          const ph = frac(1.5 * V.rt + j * 0.5), raise = S(0, 0.45, ph) * S(0.68, 0.52, ph), dig = hump(clamp((ph - 0.55) / 0.4, 0, 1));
          const side = j ? 1 : -1, arm = box(u, v, j ? 0.66 : -0.1, 0.26, j ? 1.1 : 0.34, 0.72, 0.03) * Math.max(S(0.5, 0.42, v), j ? S(0.76, 0.83, u) : S(0.24, 0.17, u));
          const reach = clamp((v - 0.32) / 0.28, 0, 1);
          shift(o, -side * (0.03 * raise + 0.06 * dig) * reach * V.rake, (-0.17 * raise + 0.04 * dig) * reach * V.rake, arm);
        }
        // leaning in to lick: the head comes down and forward (nearer, a little bigger)
        if (V.lean) { scl(o, u, v, 0.5, 0.3, 1 + 0.06 * V.lean, 1 + 0.06 * V.lean, head); shift(o, 0, 0.03 * V.lean, box(u, v, 0.2, -0.1, 0.8, 0.45, 0.05)); }
        // breathing: the chest crescent rises and falls
        scl(o, u, v, 0.5, 0.6, 1 + 0.01 * Math.sin(TAU * 0.6 * t), 1, box(u, v, 0.2, 0.3, 0.8, 0.75, 0.05));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v, pass = mode === 'pass', k = sc.fit * P.scale / 1.62;
        const pt = (Q, tt, u, v) => atB(sc, Q, ID, u, v, tt);
        if (pass) {
          // bees looping round its head, one trailing behind
          const [hx, hy] = pt(P, t, 0.5, 0.12);
          for (let i = 0; i < 4; i++) {
            const a = TAU * (0.7 * t + i / 4) * (i % 2 ? 1 : -1), rx = sc.sw * (0.32 + 0.06 * i), ry = sc.sh * (0.07 + 0.02 * i);
            const x = hx + rx * Math.cos(a), y = hy - 20 + ry * Math.sin(2 * a) * 0.6 + ry * Math.sin(a);
            bee(E, x, y, Math.sin(a) * (i % 2 ? 1 : -1) > 0 ? -1 : 1, t, i, 14 * k);
          }
          const Q = poseAt(Math.max(0, t - 0.5)), [qx, qy] = pt(Q, t - 0.5, 0.5, 0.1);
          bee(E, qx - 140 + 30 * Math.sin(t * 5), qy - 40 + 25 * Math.sin(t * 7), 1, t, 9, 14 * k);
          line(E, qx - 160 + 30 * Math.sin(t * 5), qy - 40, qx - 230, qy - 40 + 12 * Math.sin(t * 6), 2);
          // dust at each footfall
          emit(t, STEP, 0.6, (i, te, age) => { const Q2 = poseAt(te), [fx] = pt(Q2, te, FEET[i % 2 ? 0 : 1], FOOT_V); puff(E, fx, HH - 18, 34, age, 0.6, 0, 0.3); }, STEP);
          return;
        }
        // ---- the outing: a rotten stump rises out of the ground, the bear rips it open and licks up the termites
        const dur = total(OUT), b = beat(t, OUT), sx = reachX(sc, 0.5), gy = sc.hy + (FOOT_V - 0.5) * sc.sh;
        const grow = S(0, 0.7, t) * S(dur, dur - 0.7, t), top = gy - 250 * grow, w2 = 205;
        if (grow > 0.02) {
          const out = [sx - w2 - 40, gy, sx - w2, gy - 40 * grow, sx - w2 + 6, top + 20, sx - w2 + 40, top + 4, sx - 70, top + 16, sx - 10, top - 6, sx + 60, top + 14, sx + w2 - 30, top, sx + w2 - 4, top + 18, sx + w2, gy - 50 * grow, sx + w2 + 44, gy];
          poly(E, out, 4, true, 2);
          oval(E, sx, top + 10, w2 - 8, 22 * grow, 0, 3);
          for (let i = 0; i < 9; i++) { const x = sx - w2 + 30 + i * 44; poly(E, [x, top + 40, x + 6 * Math.sin(i), lerp(top + 40, gy - 10, 0.5), x - 4, gy - 14], 2); }
          blob(E, sx + 10, top + 12, 60, 10 * grow, 0);   // the hollow, where the termites are
        }
        if (V.sniff) { const [nx, ny] = pt(P, t, 0.5, 0.17); for (let i = 0; i < 2; i++) { const ph = frac(t * 2.5 + i * 0.5); arc(E, nx + (i ? 30 : -30), ny - 30 - 40 * ph, 14 + 10 * ph, i ? -100 : -80, 80, 3); } }
        if (V.rake) {   // chips and termites burst out of the stump
          emit(V.rt, 1 / 6, 0.7, (i, te, age) => {
            for (let j = 0; j < 3; j++) {
              const a = Math.PI * (1.15 + 0.7 * rnd(i * 3 + j, 61)), sp = 380 + 260 * rnd(i * 3 + j, 62);
              const x = sx + (i % 2 ? 150 : -150) + Math.cos(a) * sp * age * (i % 2 ? -1 : 1), y = top + Math.sin(a) * sp * age + 1100 * age * age;
              if (y > gy) continue;
              const r0 = age * 14 + j, c = Math.cos(r0), s2 = Math.sin(r0);
              if (j < 2) poly(E, [x - 12 * c, y - 12 * s2, x + 12 * c, y + 12 * s2], 6);   // a chip
              else { blob(E, x, y, 6, 4, r0 * 40); blob(E, x + 7 * c, y + 7 * s2, 4, 3, 0); }     // a termite
            }
          }, 0, 1.6);
        }
        if (V.rake) for (let j = 0; j < 2; j++) {   // a crack of impact where each paw strikes
          const ph = frac(1.5 * V.rt + j * 0.5), d = (ph - 0.56) / 0.18;
          if (d > 0 && d < 1) { const x = sx + (j ? 1 : -1) * 150; for (let i = 0; i < 4; i++) { const a = Math.PI * (1.15 + 0.23 * i); line(E, x + Math.cos(a) * (30 + 40 * d), top + 6 + Math.sin(a) * (20 + 30 * d), x + Math.cos(a) * (50 + 50 * d), top + 6 + Math.sin(a) * (34 + 40 * d), 4); } }
        }
        if (V.tongue > 0) {   // the long tongue: out, two licks down into the hollow, and back
          const kk = V.tongue, ext = S(0.08, 0.25, kk) * S(0.92, 0.75, kk) * (1 - 0.35 * hump(clamp((kk - 0.42) / 0.16, 0, 1)));
          if (ext > 0.02) {
            const [mx, my] = pt(P, t, 0.5, 0.235), L = 200 * k * ext, curl = Math.sin(TAU * 2 * kk);
            const pts = [], n = 10;
            for (let i = 0; i <= n; i++) { const q = i / n, a = curl * 1.1 * q * q * q; pts.push([mx + L * 0.55 * Math.sin(a) * q, my + L * q * Math.cos(a * 0.6)]); }
            const left = [], right = [];
            for (let i = 0; i <= n; i++) { const wd = 15 * k * (1 - 0.25 * i / n); left.push(pts[i][0] - wd, pts[i][1]); right.unshift(pts[i][0] + wd, pts[i][1]); }
            const tip = pts[n];
            const tipArc = [], rt = 15 * k * 0.75;
            for (let i = 0; i <= 6; i++) { const a = Math.PI * (1 - i / 6); tipArc.push(tip[0] + rt * Math.cos(a), tip[1] + rt * Math.sin(a)); }
            poly(E, left.concat(tipArc).concat(right), 3.5, true, 2);
            poly(E, [mx, my + 8, ...pts.slice(1, n).flat()], 2);
          }
        }
        if (V.b === 'go' || V.b === 'home') emit(b.t, STEP / 1.05, 0.5, (i, te, age) => { const Q = poseAt(beatStart(OUT, b.name) + te), [fx] = at(sc, Q, FEET[i % 2 ? 0 : 1], FOOT_V); puff(E, fx, gy, 22, age, 0.5, 0, 0.3); }, STEP / 1.05, b.d - 0.2);
      },
    };
  })();

  // ===== Bornean orangutan ==========================================================================================
  // Slow and deliberate, holding on with all four hands. Crosses gaps by rocking its support with growing swings until
  // it can reach across. Holds a leaf to its lips for the kiss-squeak. Seen from the front, hanging by its right hand.
  (function () {
    const ID = 'bornean-orangutan';
    const GRIP = [0.67, 0.085], RS = [0.66, 0.42], LS = [0.29, 0.46], LH = [0.14, 0.92], ELBOW = [0.2, 0.68];
    const ALPHA = 65, BETA = 25;   // the free arm raised to reach, the gripping arm spread, at a regrip
    const R = 440 / 600;
    const turnPt = (p, c, deg) => {   // drawing point p turned about c by deg (as rot() does)
      const a = deg * Math.PI / 180, dx = (p[0] - c[0]) * R, dy = p[1] - c[1];
      return [c[0] + (Math.cos(a) * dx - Math.sin(a) * dy) / R, c[1] + Math.sin(a) * dx + Math.cos(a) * dy];
    };
    /** Hang the drawing from its (bent) right hand at screen G: mirrored or not, swung by theta. */
    function hang(P, sc, G, mirror, theta, alpha, beta, sx = 1) {
      const v = P.v; v.alpha = alpha; v.beta = beta; P.mirror = mirror; P.sx = sx;
      const g = turnPt(GRIP, RS, beta);
      Ink.pin(sc, P, g[0], g[1], G[0], G[1], theta);
    }
    /** Where the free hand is for a hang (screen), without placing anything. */
    function freeHand(sc, G, mirror, theta, alpha, beta, scale) {
      const Q = Object.assign(new Ink.Pose(), { scale, mirror });
      hang(Q, sc, G, mirror, theta, alpha, beta);
      return Ink.pointOf(sc, Q, ...turnPt(LH, LS, alpha));
    }
    /** The swing angle that puts the free hand level with the grip (M: mirrored). */
    function levelAngle(sc, mirror) {
      const g = turnPt(GRIP, RS, BETA), h = turnPt(LH, LS, ALPHA);
      let dx = (h[0] - g[0]) * sc.sw, dy = (h[1] - g[1]) * sc.sh; if (mirror) dx = -dx;
      return Math.atan2(-dy, dx) * 180 / Math.PI + (dx < 0 ? 180 : 0);
    }
    const PLUMB = 15.7;   // unmirrored, the body hangs plumb under the hand at -15.7 degrees

    // ---- the pass: hand over hand along a liana, three handholds
    const CYC = 1.54, K0 = 0.55, LIANA = 64;
    function passPose(t, P, sc) {
      const v = P.v, apex = levelAngle(sc, true), D = Math.abs(freeHand(sc, [0, 0], true, apex, ALPHA, BETA, 1)[0]);
      const G0 = -500, c = t / CYC + K0, i = Math.floor(c), k = c - i, G = [G0 + i * D, LIANA];
      v.i = i; v.k = k; v.D = D; v.G0 = G0;
      if (k < 0.4) {   // just changed hands: hangs from the new hand, swings down through, the old arm lowering
        const q = ease(k / 0.4);
        hang(P, sc, G, false, lerp(-apex, -PLUMB, q), ALPHA * (1 - q), BETA * (1 - q));
        if (i > 0 && k * CYC < 1 / 60 + 1e-6) v.cut = true;
      } else if (k < 0.55) {   // turns its body under the hand, so the free arm comes to the front
        const q = (k - 0.4) / 0.15, c2 = Math.cos(Math.PI * q);
        hang(P, sc, G, c2 < 0, lerp(-PLUMB, PLUMB, ease(q)), 0, 0, Math.max(0.03, Math.abs(c2)));
        v.turn = 1 - Math.abs(c2);
      } else {   // swings forward, the free arm reaching up and out for the next hold
        const q = (k - 0.55) / 0.45, e = 0.5 - 0.5 * Math.cos(Math.PI * q);
        hang(P, sc, G, true, lerp(PLUMB, apex, e), ALPHA * S(0.15, 1, q), BETA * S(0.3, 1, q));
      }
    }

    // ---- the outing: rocks with growing swings, turns and reaches across to a hanging vine, kiss-squeaks, swings home
    const SWAY = [4, -8, 14], HALF = 0.7, LAST = 1.0;
    const OUT = [['sway', SWAY.length * HALF + LAST], ['settle', 1.0], ['kiss', 2.6], ['back', 1.0], ['home', 1.5]];
    /** The swing during the sway: half-swings growing to alternate sides, then the big one across with a turn in it. */
    function sway(t, apex) {
      const n = SWAY.length;
      if (t < n * HALF) {
        const i = Math.floor(t / HALF), k = t / HALF - i;
        return { th: lerp(i ? SWAY[i - 1] : 0, SWAY[i], 0.5 - 0.5 * Math.cos(Math.PI * k)), k: -1 };
      }
      const k = (t - n * HALF) / LAST;
      return { th: lerp(SWAY[n - 1], apex, 0.5 - 0.5 * Math.cos(Math.PI * k)), k };
    }
    M[ID] = {
      facing: 'F', size: [1.1, 0.88], props: [0],
      pass: { dur: 5, path(t, P, sc) {
        P.m = 1; P.v.b = 'swing'; hideProp(P);
        passPose(t, P, sc);
      } },
      outing: { dur: total(OUT), path(t, P, sc) {
        const b = beat(t, OUT), v = P.v, k = b.k, hs = sc.homeScale;
        const Gh = Ink.pointOf(sc, Object.assign(new Ink.Pose(), { x: sc.hx, y: sc.hy, scale: hs }), ...GRIP);
        const apex = levelAngle(sc, true), V = freeHand(sc, Gh, true, apex, ALPHA, 0, hs);   // the vine: where the free hand lands
        v.b = b.name; v.V = V; v.Gh = Gh; P.scale = hs; stay(P, sc);
        const turning = (q, th, G, toMirror) => {   // a body turn under the hand while the swing carries through
          const c = Math.cos(Math.PI * q), flipped = c < 0;
          hang(P, sc, G, flipped === toMirror, th, 0, 0, Math.max(0.03, Math.abs(c))); v.turn = 1 - Math.abs(c);
        };
        if (b.name === 'sway') {   // the swings grow, 4, 8, 14 degrees, then the big one: it turns and reaches
          const w = sway(b.t, apex);
          if (w.k < 0) hang(P, sc, Gh, false, w.th, 0, 0);
          else if (w.k < 0.3) hang(P, sc, Gh, false, w.th, 0, 0);
          else if (w.k < 0.55) turning((w.k - 0.3) / 0.25, w.th, Gh, true);
          else hang(P, sc, Gh, true, w.th, ALPHA * S(0.6, 1, w.k), 0);
          P.prop.y += 6 * Math.sin(Math.PI * b.t / HALF) ** 2 * S(0, 0.5, b.t);   // the branch gives with each swing
        } else if (b.name === 'settle') {   // changes hands onto the vine and swings down under it
          const q = b.t, sw = -apex * Math.exp(-2.6 * q) * Math.cos(TAU * 0.7 * q);
          hang(P, sc, V, false, sw, ALPHA * (1 - S(0, 0.7, k)), 0);
          if (b.t < 1 / 60 + 1e-6) v.cut = true;
        } else if (b.name === 'kiss') {   // a leaf to its lips: two kiss-squeaks, the leaf drops
          const sw0 = -apex * Math.exp(-2.6) * Math.cos(TAU * 0.7);
          hang(P, sc, V, false, sw0 * (1 - S(0, 0.4, k)) + 1.5 * Math.sin(TAU * 0.35 * b.t) * S(0, 0.4, k), 0, 0);
          v.fold = S(0.05, 0.25, k) * S(0.92, 0.75, k); v.kiss = k;
        } else if (b.name === 'back') {   // swings back toward home, the free hand reaching for the branch
          const sw0 = 1.5 * Math.sin(TAU * 0.35 * 2.6), e = 0.5 - 0.5 * Math.cos(Math.PI * k);
          hang(P, sc, V, false, lerp(sw0, -apex, e), ALPHA * S(0.2, 1, k), 0);
        } else {   // changes hands onto the branch, swings back, turns under it and comes to rest at home
          const q = k, th = apex * Math.exp(-2.2 * b.t) * Math.cos(TAU * 0.62 * b.t) * (1 - S(0.8, 1, q));
          if (b.t < 1 / 60 + 1e-6) v.cut = true;
          if (q < 0.25) hang(P, sc, Gh, true, th, ALPHA * (1 - S(0, 0.25, q)), 0);
          else if (q < 0.5) turning((q - 0.25) / 0.25, th, Gh, false);
          else hang(P, sc, Gh, false, th, 0, 0);
        }
      } },
      bend(u, v, t, P, o, r) {
        const V = P.v;
        // the free (left) arm: raised out to reach; the gripping (right) arm: spread
        const wl = box(u, v, -0.3, 0.36, 0.31, 1.1, 0.03) * Math.max(S(0.58, 0.5, v), S(0.25, 0.2, u));
        if (V.alpha) rot(o, u, v, LS[0], LS[1], V.alpha, wl, r);
        const wr = box(u, v, 0.6, -0.2, 0.9, 0.41, 0.03) * Math.max(S(0.32, 0.24, v), S(0.62, 0.67, u));
        if (V.beta) rot(o, u, v, RS[0], RS[1], V.beta, wr, r);
        // the legs hang a beat behind the swing
        rot(o, u, v, 0.5, 0.72, 5 * Math.sin(TAU * 0.6 * t + 1), S(0.7, 0.8, v), r);
        // the forearm folds up to bring a leaf to the lips
        if (V.fold) rotScale(o, u, v, ELBOW[0], ELBOW[1], -150 * V.fold, 1 - 0.1 * V.fold, box(u, v, -0.2, 0.69, 0.235, 1.1, 0.02), r);
        // lips purse for the kiss-squeak
        if (V.kiss) scl(o, u, v, 0.44, 0.44, 1 - 0.25 * V.fold, 1 + 0.15 * V.fold, box(u, v, 0.37, 0.4, 0.51, 0.48, 0.02));
        // breathing in the big belly
        scl(o, u, v, 0.5, 0.6, 1 + 0.012 * Math.sin(TAU * 0.5 * t), 1, box(u, v, 0.3, 0.45, 0.72, 0.78, 0.05));
      },
      fx(t, P, sc, E, mode, poseAt) {
        const V = P.v;
        if (mode === 'pass') {
          // the liana: sagging between the holds, little leaves along it
          const D = V.D, G0 = V.G0, pts = [];
          for (let x = -40; x <= WW + 40; x += 40) { const q = frac((x - G0) / D); pts.push(x, LIANA + 30 * Math.sin(Math.PI * q) ** 2 + 4 * Math.sin(x / 70 + t)); }
          E.back = true; poly(E, pts, 6); for (let x = 20; x < WW; x += 150) { const q = frac((x - G0) / D), y = LIANA + 30 * Math.sin(Math.PI * q) ** 2; leaf(E, x + 14, y + 18, 70 + 20 * Math.sin(x), 16); } E.back = false;
          // leaves shaken loose at each new grip
          for (let i = 1; i <= 3; i++) {
            const tg = (i - K0) * CYC, age = t - tg;
            if (age > 0 && age < 2.5) for (let j = 0; j < 4; j++) fallingLeaf(E, G0 + i * D - 60 + 40 * j, LIANA + 20, age - j * 0.08 > 0 ? age - j * 0.08 : 0, i * 4 + j, 18, 260);
          }
          return;
        }
        // the outing: the vine it reaches across to; leaves at the kiss-squeak
        const dur = total(OUT), drop = S(0, 0.8, t) * S(dur, dur - 0.6, t), x = V.V[0], top = -20, bot = lerp(-20, V.V[1] + 140, drop);
        if (drop > 0.01) {
          E.back = true;
          const pts = []; for (let y = top; y <= bot; y += 30) pts.push(x + 8 * Math.sin(y / 60 + 1), y);
          poly(E, pts, 6); for (let y = 60; y < bot - 20; y += 110) leaf(E, x + 20, y, 40 + 30 * Math.sin(y), 16);
          E.back = false;
        }
        const b = beat(t, OUT);
        if (V.b === 'kiss') {
          const k = b.k, [mx, my] = atB(sc, P, ID, 0.44, 0.45, t), s = sc.fit * P.scale;
          if (V.fold > 0.15 && k < 0.8) {   // a leaf held from the hand up to the lips
            let [hx, hy] = atB(sc, P, ID, ...LH, t); const q = S(0.15, 0.9, V.fold);
            const tx = lerp(hx, mx + 4, q), ty = lerp(hy - 60, my + 2, q), a = Math.atan2(ty - hy, tx - hx) || -1.4, L = Math.max(78 * s / 1.2, Math.hypot(tx - hx, ty - hy));
            const c = Math.cos(a), sn2 = Math.sin(a), wd = 24 * s / 1.2, pts = [];
            hx = tx - c * L; hy = ty - sn2 * L;
            for (let i = 0; i <= 8; i++) { const f = i / 8, d = Math.sin(Math.PI * f) * wd; pts.push(hx + c * L * f - sn2 * d, hy + sn2 * L * f + c * d); }
            for (let i = 8; i >= 0; i--) { const f = i / 8, d = -Math.sin(Math.PI * f) * wd * 0.8; pts.push(hx + c * L * f - sn2 * d, hy + sn2 * L * f + c * d); }
            poly(E, pts, 3, true, 2);
            line(E, hx - c * 14, hy - sn2 * 14, tx, ty, 2);
          }
          for (const c of [0.38, 0.6]) {   // two kiss-squeaks: puffs from the pursed lips
            const age = k - c; if (age > 0 && age < 0.18) { const q = age / 0.18; for (let j = 0; j < 3; j++) arc(E, mx + 20, my, 20 + 50 * q + 14 * j, -50, 100, 4 * (1 - q) + 1); }
          }
          if (k > 0.8) fallingLeaf(E, mx - 20, my + 10, (k - 0.8) * b.d, 3, 22, 300);
        }
        if (V.b === 'settle' && b.t < 1.4) for (let j = 0; j < 3; j++) fallingLeaf(E, V.V[0] - 30 + 30 * j, V.V[1], b.t, 20 + j, 18, 240);
        if (V.b === 'home' && b.t < 1.0) for (let j = 0; j < 3; j++) fallingLeaf(E, V.Gh[0] - 40 + 40 * j, V.Gh[1] + 10, b.t, 30 + j, 18, 240);
      },
    };
  })();
})();
