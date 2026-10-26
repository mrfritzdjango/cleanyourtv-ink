/* The theatre: plays one animal at a time on a 16:9 screen, over a sketch of Home (a pass) or the screensaver (an
 * outing), with the same code the TV's moves are baked from. */
(function () {
  const $ = id => document.getElementById(id);
  const screen = $('screen'), mock = $('mock'), pick = $('pick'), now = $('now');
  const player = new Ink.Player($('stage'), { font: "'Atkinson Hyperlegible', system-ui, sans-serif" });
  const order = [...document.querySelectorAll('article.animal')].map(a => a.id);
  order.unshift('titan-triggerfish');
  const ids = order.filter(id => Ink.MOTIONS[id]);
  for (const id of ids) pick.add(new Option(Ink.ANIMALS[id].name, id));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode = 'pass', dir = 1, auto = !reduce, start = 0, id = ids.includes('titan-triggerfish') ? 'titan-triggerfish' : ids[0], raf = 0;

  function clock() { const d = new Date(); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function day() { return new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', ''); }
  function sketch() {
    if (mode === 'pass') {
      const rows = ['Calendar', 'Tasks', '', 'YouTube', 'Netflix', 'Prime Video', 'Disney+', 'Apple TV', 'Spotify', 'Screensaver'];
      mock.innerHTML = '<div class="list">' + rows.map((r, i) => r ? `<span class="${i === 0 ? 'on' : ''}">${r}</span>` : '<span class="gap"></span>').join('') +
        `</div><div class="clock">${clock()}<small>${day()}</small></div>`;
    } else {
      mock.innerHTML = `<div class="caption">${Ink.ANIMALS[id].name}</div><div class="clock">${clock()}<small>${day()}</small></div>`;
    }
  }
  function show(newId, newMode) {
    id = newId; if (newMode) mode = newMode;
    pick.value = id;
    $('m-pass').setAttribute('aria-pressed', mode === 'pass'); $('m-outing').setAttribute('aria-pressed', mode === 'outing');
    sketch();
    start = performance.now() + (mode === 'outing' ? 1200 : 400);
    now.textContent = '';
    if (reduce && !raf) player.render(id, mode, mode === 'outing' ? null : Ink.duration(id, mode) * 0.45, dir, true);
  }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const d = Ink.duration(id, mode), t = (ts - start) / 1000;
    if (t < 0) { player.render(id, mode, null, dir, mode === 'outing'); return; }
    if (t > d) {
      player.render(id, mode, null, dir, mode === 'outing');
      if (t > d + 1.4) {
        if (auto) { const i = (ids.indexOf(id) + 1) % ids.length; show(ids[i]); }
        else start = ts + 600;
      }
      return;
    }
    player.render(id, mode, t, dir);
    now.textContent = `${Ink.ANIMALS[id].name} · ${t.toFixed(1)} of ${d} s`;
  }
  player.onShake = (x, y) => { screen.style.transform = x || y ? `translate(${x / devicePixelRatio}px, ${y / devicePixelRatio}px)` : ''; };
  pick.onchange = () => { auto = false; $('auto').setAttribute('aria-pressed', false); show(pick.value); };
  $('m-pass').onclick = () => show(id, 'pass');
  $('m-outing').onclick = () => show(id, 'outing');
  $('dir').onclick = e => { dir = -dir; e.currentTarget.setAttribute('aria-pressed', dir < 0); show(id); };
  $('night').onclick = e => { player.night = !player.night; screen.classList.toggle('night', player.night); e.currentTarget.setAttribute('aria-pressed', player.night); };
  $('auto').onclick = e => { auto = !auto; e.currentTarget.setAttribute('aria-pressed', auto); if (auto && !raf) raf = requestAnimationFrame(frame); };
  document.addEventListener('click', e => {
    const b = e.target.closest('.playbtn'); if (!b || !Ink.MOTIONS[b.dataset.id]) return;
    auto = false; $('auto').setAttribute('aria-pressed', false);
    show(b.dataset.id, b.dataset.mode);
    if (!raf) raf = requestAnimationFrame(frame);
    $('theatre').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
  for (const b of document.querySelectorAll('.playbtn')) if (!Ink.MOTIONS[b.dataset.id]) b.disabled = true;
  document.fonts && document.fonts.ready.then(() => {});
  show(id, 'pass');
  if (!reduce) raf = requestAnimationFrame(frame);
  else player.render(id, 'pass', Ink.duration(id, 'pass') * 0.45, 1);
})();
