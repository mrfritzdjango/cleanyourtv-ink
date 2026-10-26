/* The two reference shows: TITANE and the Malayan tapir. */
'use strict';

// ===== TITANE, the titan triggerfish =========================================================================
// Swims on its rear dorsal and anal fins (matching waves, body rigid); the tail only kicks for bursts. Guards a cone
// from its sand nest to the surface and charges anything inside it. Blows jets at the sand for prey.
(function () {
  const PASS = [['cruise', 0.625], ['blow', 0.375], ['alarm', 0.5], ['windup', 0.375], ['charge', 0.625],
    ['ink', 0.125], ['negative', 0.125], ['shout', 1.25], ['gone', 0.5], ['fade', 0.5]];
  const OUT = [['patrol', 3], ['blow', 1.25], ['intruder', 1.25], ['alarm', 0.375], ['charge', 0.625],
    ['ink', 0.125], ['negative', 0.125], ['shout', 1.5], ['back', 0.75], ['fade', 0.5], ['settle', 0.5]];
  const CHARGE_STEPS = [0.62, 0.85, 1.12, 1.38, 1.6];

  /** The shared second half: charge, ink, negative, TITANE!, then `after` beats. */
  function drama(b, P, sc, from) {
    const v = P.v;
    if (b.name === 'charge') {
      const k = Math.pow(b.k, 1.7);   // slow to start, then it comes at you
      P.scale = from.scale * Math.pow(1.6 / from.scale, k);
      P.x = lerp(from.x, WW / 2, ease(b.k)); P.y = lerp(from.y, HH / 2, ease(b.k));
      v.flip = Math.sin(TAU * 6 * b.t); v.tail = 1; v.spine = 1; v.mouth = S(0.55, 0.8, b.k);
      P.angle = 4 * Math.sin(TAU * 3 * b.t); v.lines = b.k;
      return true;
    }
    if (b.name === 'ink') { P.screen = 1; P.hidden = true; return true; }
    if (b.name === 'negative') { P.screen = 2; P.x = WW / 2; P.y = HH / 2; P.scale = 1.6; v.spine = 1; v.mouth = 1; return true; }
    if (b.name === 'shout') {
      P.x = WW / 2; P.y = HH / 2; P.scale = 1.3; v.spine = 1; v.mouth = b.t < 0.5 ? 1 : 0;
      P.angle = 3 * sn(1.5, b.t); P.burst = b.t < 0.5; P.shout = 0; P.shoutScale = b.t < FRAME ? 1.25 : 1;
      v.tail = 0.5; v.flip = Math.sin(TAU * 4 * b.t);
      const k = b.t / 0.5;
      if (k < 1) { const a = 0.045 * HH * (1 - k) ** 1.5; P.shakeX = a * Math.sin(TAU * 11 * b.t); P.shakeY = 0.6 * a * Math.sin(TAU * 7 * b.t + 1); }
      return true;
    }
    return false;
  }

  M['titan-triggerfish'] = {
    facing: 'R', size: [1.0, 0.95], maxScale: 1.6, bigOuting: true,
    pass: { dur: total(PASS), path(t, P, sc) {
      const b = beat(t, PASS), v = P.v, start = 0.42, sx = WW * 0.36, sy = HH * 0.58;
      v.spine = 0; v.tail = 0; v.mouth = 0; v.b = b.name;
      P.scale = start; P.m = 1;
      if (b.name === 'cruise') { P.x = lerp(-sc.sw * start * 0.6, sx, ease(b.k)); P.y = sy; }
      else if (b.name === 'blow') { P.x = sx; P.y = sy; P.angle = 28 * hump(b.k * 1.2); v.jet = b.k; }
      else if (b.name === 'alarm') { P.x = sx; P.y = sy; v.spine = 1; P.angle = -6; P.sx = 0.9; v.cone = clamp(b.k * 1.5, 0, 1); }
      else if (b.name === 'windup') { P.x = sx - 50 * ease(b.k * 2); P.y = sy; P.scale = start * 0.92; v.spine = 1; v.cock = 1; v.cone = 1; }
      else if (drama(b, P, sc, { x: sx - 50, y: sy, scale: start * 0.92 })) { v.cone = b.name === 'charge' ? 1 : 0; }
      else if (b.name === 'gone') {
        P.y = HH / 2; P.scale = 1.3; P.x = WW / 2 + (WW / 2 + sc.sw * 0.8) * Math.pow(b.k, 1.4); v.tail = 1; v.flip = Math.sin(TAU * 6 * b.t);
        v.spine = 1; P.shout = 0;
      } else { P.hidden = true; P.shout = clamp(b.k, 0, 1); }
    } },
    outing: { dur: total(OUT), path(t, P, sc) {
      const b = beat(t, OUT), v = P.v, hs = sc.homeScale, nest = [sc.hx, HH - 70];
      v.spine = 0; v.tail = 0; v.mouth = 0; v.b = b.name; v.cone = 1;
      P.scale = hs; P.x = sc.hx; P.y = sc.hy; P.m = 1;
      if (b.name === 'patrol') {   // pacing its cone: zigzag up and down inside it
        const q = b.t / 3;
        P.x = sc.hx + 230 * Math.sin(TAU * q * 1.5); P.y = sc.hy + 90 * Math.sin(TAU * q * 3);
        P.m = Math.cos(TAU * q * 1.5) >= 0 ? 1 : -1; P.angle = 6 * Math.sin(TAU * q * 3) * P.m;
      } else if (b.name === 'blow') {
        P.x = sc.hx; P.y = sc.hy + 120 * ease(b.k * 3); P.angle = 35 * hump(b.k); v.jet = b.k;
      } else if (b.name === 'intruder') {
        const k = b.k; v.fish = k;
        P.x = sc.hx + 260 * S(0.2, 0.45, k); P.y = sc.hy; v.tail = hump((k - 0.2) / 0.25); v.flip = Math.sin(TAU * 6 * b.t); v.spine = 1;
      } else if (b.name === 'alarm') { P.x = sc.hx + 260; v.spine = 1; P.angle = -6; P.sx = 0.9; }
      else if (drama(b, P, sc, { x: sc.hx + 260, y: sc.hy, scale: hs })) { v.cone = 0; }
      else if (b.name === 'back') {
        const k = ease(b.k);
        P.x = lerp(WW / 2, sc.hx, k); P.y = lerp(HH / 2, sc.hy, k); P.scale = 1.3 * Math.pow(hs / 1.3, k); P.m = -1; v.spine = 1; P.shout = 0; v.cone = 0;
      } else if (b.name === 'fade') { v.spine = 1; P.shout = b.k; v.cone = 0; }
      else { v.spine = b.k < 0.5 ? 1 : 0; v.click = b.k >= 0.5 && b.k < 0.75; v.cone = 0; }
    } },
    bend(u, v, t, P, o, r) {
      const V = P.v, back = 1 - u;
      // rear dorsal and anal fins: matching waves running front to back, the dorsal a little stronger
      wave(o, back, t, 0.032, 2, -2, box(u, v, 0.16, 0.0, 0.5, 0.3), 1);
      wave(o, back, t, 0.024, 2, -2, box(u, v, 0.16, 0.74, 0.5, 1.0), 1);
      // the tail kicks only in bursts (flip every frame), or cocks before the charge
      const tailW = S(0.22, 0.12, u);
      if (V.tail) rot(o, u, v, 0.2, 0.55, 20 * V.tail * (V.flip || 1), tailW, r);
      if (V.cock) rot(o, u, v, 0.2, 0.55, -22, tailW, r);
      // the first dorsal spine: folded back unless alarmed
      rot(o, u, v, 0.62, 0.24, -62 * (1 - (V.spine || 0)), box(u, v, 0.56, 0.0, 0.69, 0.22, 0.02), r);
      // the jaw drops to show the teeth
      if (V.mouth) rot(o, u, v, 0.86, 0.55, 16, box(u, v, 0.86, 0.56, 1.0, 0.72, 0.03), r);
    },
    fx(t, P, sc, E, mode, poseAt) {
      const V = P.v, pass = mode === 'pass';
      const nestX = pass ? WW * 0.36 : sc.hx, nestY = HH - 50;
      // the sand nest, a shallow crater, while it guards
      if (V.cone !== undefined && V.b !== 'ink' && V.b !== 'negative' && ['cruise', 'blow', 'alarm', 'windup', 'patrol', 'intruder'].includes(V.b)) {
        E.back = true;
        arc(E, nestX, nestY - 120, 160, 30, 120, 4);
        cloud(E, nestX, nestY + 10, 120, 0.25);
        E.back = false;
      }
      // the cone of its territory: dotted lines from the nest to the top edge, drawn in
      const cone = V.cone === undefined ? 0 : (pass ? V.cone : (['patrol', 'blow', 'intruder', 'alarm'].includes(V.b) ? 1 : 0));
      if (cone > 0 && V.b !== 'ink') {
        for (const side of [-1, 1]) {
          const x0 = nestX + side * 80, x1 = nestX + side * 760, n = 26;
          for (let i = 0; i <= n * cone; i++) { const k = i / n; disc(E, lerp(x0, x1, k), lerp(nestY, -10, k), 5); }
        }
      }
      // blowing the sand: three jets from the mouth, then a sand cloud (and, on the screensaver, a crab)
      if (V.b === 'blow') {
        const [mx, my] = at(sc, P, 0.97, 0.6), k = V.jet;
        for (let i = 0; i < 3; i++) { const kk = k * 3 - i; if (kk > 0 && kk < 1.4) line(E, mx + 20 + i * 18, my + 40 + kk * 70, mx + 34 + i * 18, my + 90 + kk * 70, 5); }
        puff(E, mx + 60, Math.min(HH - 60, my + 220), 130, clamp(k - 0.3, 0, 1) * 1.2, 1.2, 40);
        if (!pass && k > 0.45) {
          const ck = (k - 0.45) / 0.55, cx = mx + 120 - 120 * ck, cy = my + 230 - 260 * hump(ck) ;
          if (ck < 0.85) { disc(E, cx, cy, 14); for (let j = -1; j <= 1; j += 2) { line(E, cx, cy, cx + j * 26, cy + 12, 3); line(E, cx, cy, cx + j * 24, cy - 8, 3); } }
        }
      }
      // a small fish wanders into the cone and is chased out
      if (V.b === 'intruder') {
        const k = V.fish, x = k < 0.4 ? lerp(WW - 120, sc.hx + 620, k / 0.4) : lerp(sc.hx + 620, WW + 100, (k - 0.4) / 0.25);
        fishlet(E, x, sc.hy - 40 + (k > 0.4 ? -80 * (k - 0.4) : 0), k < 0.4 ? -1 : 1, 22);
        if (k > 0.4 && k < 0.7) streaks(E, x - 30, sc.hy - 40, 3, 50, 30, t, 2);
      }
      // speed lines from the middle while it charges
      if (V.b === 'charge') {
        const n = 20;
        for (let i = 0; i < n; i++) {
          const a = TAU * (i + 0.5 * rnd(i, 1)) / n, r0 = 380 + 160 * rnd(i, 2) + 300 * V.lines, r1 = r0 + 220 + 200 * rnd(i, 3);
          line(E, WW / 2 + Math.cos(a) * r0, HH / 2 + Math.sin(a) * r0 * 0.7, WW / 2 + Math.cos(a) * r1, HH / 2 + Math.sin(a) * r1 * 0.7, 6);
        }
      }
      // ink splashing in from the edges as TITANE! lands
      if (V.b === 'shout' && P.shout === 0) {
        const b = beat(t, pass ? PASS : OUT), k = clamp(b.t / 0.6, 0, 1);
        if (k < 1) for (let i = 0; i < 26; i++) {
          const side = i % 4, s = rnd(i, 5);
          const ex = side === 0 ? 0 : side === 1 ? WW : s * WW, ey = side === 2 ? 0 : side === 3 ? HH : s * HH;
          const dx = (WW / 2 - ex) * 0.12 * (0.4 + k), dy = (HH / 2 - ey) * 0.12 * (0.4 + k);
          blob(E, ex + dx, ey + dy, 14 + 18 * rnd(i, 6), 9 + 10 * rnd(i, 7), Math.atan2(dy, dx) * 180 / Math.PI);
        }
      }
      // bubbles from the gills while it swims
      if (['cruise', 'patrol', 'gone'].includes(V.b)) { const [gx, gy] = at(sc, P, 0.7, 0.3); bubbles(E, t, gx, gy, 0.75, 1.1, 2, 200, 9); }
      // the spine clicks down at home
      if (V.click) { const [x, y] = at(sc, P, 0.63, 0.12); line(E, x - 30, y - 50, x - 10, y - 20, 4); line(E, x + 20, y - 56, x + 10, y - 22, 4); }
    },
  };
})();

// ===== Malayan tapir ================================================================================================
// Walks slowly on its toe tips, head low, snout sweeping for scent; a strong swimmer that snorkels with its snout.
(function () {
  const PASS = [['walk', 1.75], ['wade', 1.5], ['snorkel', 1.0], ['under', 0.25]];
  const OUT = [['start', 0.5], ['out', 2.5], ['taste', 1.75], ['trot', 2.75], ['sniff', 1.5]];
  // legs: [u0, u1, phase] - near and far front, near and far hind, in a lateral walk (hind, fore, hind, fore)
  const LEGS = [[0.27, 0.37, 0.25], [0.37, 0.47, 0.75], [0.73, 0.83, 0], [0.83, 0.94, 0.5]];

  M['malayan-tapir'] = {
    facing: 'L',
    pass: { dur: total(PASS), path(t, P, sc) {
      // walks in, wades into the river, snorkels, and slips under: it leaves under the water, not off the edge
      const b = beat(t, PASS), v = P.v;
      P.m = 1; v.stride = 1; v.b = b.name;
      const x0 = -sc.ext, x1 = WW * 0.3, x2 = WW * 0.42, x3 = WW * 0.5, x4 = WW * 0.52;
      const fore = Math.abs(Math.sin(Math.PI * t / 0.5));
      P.y = ground(sc) + 0.006 * sc.sh * fore;
      if (b.name === 'walk') P.x = lerp(x0, x1, b.k);
      else if (b.name === 'wade') { P.x = lerp(x1, x2, b.k); P.y += 0.22 * sc.sh * ease(b.k); }
      else if (b.name === 'snorkel') { P.x = lerp(x2, x3, b.k); P.y += 0.22 * sc.sh + 0.02 * sc.sh * Math.sin(TAU * b.t); v.stride = 0.8; }
      else { P.x = lerp(x3, x4, b.k); P.y += 0.22 * sc.sh + 0.5 * sc.sh * ease(b.k); P.hidden = b.k >= 1; }
      v.snorkel = b.name === 'snorkel' || b.name === 'under' ? ease(beat(t, PASS).name === 'snorkel' ? b.k * 3 : 1) : 0;
      v.level = HH - 0.36 * sc.sh - 0.02 * sc.sh;   // the river's surface once it is deep
      v.rise = b.name === 'walk' ? S(0.55, 1, b.k) * 0.15 : b.name === 'wade' ? 0.15 + 0.85 * ease(b.k) : 1;
    } },
    outing: { dur: total(OUT), path(t, P, sc) {
      const b = beat(t, OUT), v = P.v, far = reachX(sc, 0.95);
      v.b = b.name; v.stride = 1;
      if (b.name === 'start') { P.m = -1; v.stride = 0; }
      else if (b.name === 'out') { P.m = 1; P.x = lerp(sc.hx, far, b.k); P.scale = 1 - 0.05 * Math.sin(b.k * TAU * 1.5) ** 2; P.y = sc.hy + 12 * Math.sin(b.k * TAU * 1.5); }
      else if (b.name === 'taste') { P.m = 1; P.x = far; v.stride = 0; v.taste = ease(b.k * 4) * (1 - ease((b.k - 0.85) * 7)); }
      else if (b.name === 'trot') { P.m = -1; P.x = lerp(far, sc.hx, b.k); v.stride = 0.75; P.y = sc.hy - 6 * Math.abs(Math.sin(Math.PI * b.t / 0.375)); }
      else { P.m = -1; v.stride = 0; }
    } },
    bend(u, v, t, P, o, r) {
      const V = P.v;
      if (V.stride) {
        const legs = S(0.66, 0.95, v);
        for (const [u0, u1, ph] of LEGS) shift(o, 0.04 * Math.sin(TAU * (t / V.stride + ph)) * (v - 0.66) / 0.34, 0, legs * box(u, v, u0, 0.6, u1, 1.05, 0.015));
      }
      // head carried low; the snout tip sniffs side to side every half second
      const head = S(0.3, 0.2, u) * S(0.68, 0.58, v);
      rot(o, u, v, 0.27, 0.32, -5, head, r);
      rot(o, u, v, 0.11, 0.48, 6 * Math.sin(TAU * 2 * t) * (V.stride ? 1 : 0.5), S(0.14, 0.07, u) * S(0.68, 0.58, v), r);
      // tasting the air (flehmen) and the snorkel: the snout curls up
      const up = Math.max(V.taste || 0, V.snorkel || 0);
      if (up) rot(o, u, v, 0.17, 0.42, (V.snorkel ? 62 : 38) * up, S(0.19, 0.06, u) * S(0.7, 0.6, v), r);
    },
    fx(t, P, sc, E, mode, poseAt) {
      const V = P.v;
      if (mode === 'pass') {
        // footfall dust on land; the river rises up its body as it wades in
        if (V.b === 'walk') emit(t, 0.5, 0.9, (i, te, age) => { const Q = poseAt(te), [fx, fy] = at(sc, Q, i % 2 ? 0.4 : 0.85, 0.98); puff(E, fx, fy, 50, age, 0.9, -80); });
        if (V.rise > 0) {
          const level = lerp(HH + 40, V.level, V.rise);
          water(E, -20, WW + 20, level, t, 12);
          const [bx] = at(sc, P, 0.5, 0.5);
          ripple(E, bx, level, t % 0.75, 0.75, sc.sw * 0.35, 0.12, 2);
          if (V.snorkel > 0.5) { const [sx, sy] = at(sc, P, 0.04, 0.3); ripple(E, sx + 20, level, t % 0.5, 0.5, 90, 0.25, 3); }
        }
      } else {
        if (V.b === 'out' || V.b === 'trot') emit(t, 0.5, 0.75, (i, te, age) => { const Q = poseAt(te), [fx, fy] = at(sc, Q, i % 2 ? 0.4 : 0.85, 0.98); puff(E, fx, fy, 26, age, 0.75, 0); });
        if (V.b === 'taste') {   // little whistle squiggles rising from the curled snout
          const b = beat(t, OUT), [sx, sy] = at(sc, P, 0.06, 0.2);
          emit(b.t, 0.45, 1.2, (i, te, age) => { const y = sy - 30 - age * 120, x = sx + 30 * i - 20; poly(E, [x, y, x + 12, y - 10, x + 24, y, x + 36, y - 10, x + 48, y], 3); }, 0.2, 1.4);
        }
      }
    },
  };
})();
