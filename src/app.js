(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, ms));
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
window.NENGA = window.NENGA || {};
const SNDX = window.NENGA.snd || { play: () => false, sfx: new Proxy({}, { get: () => () => {} }) };

/* ---------- shared sheep art ---------- */
const INK = '#161717';
function sheepSVG(o = {}) {
  const face = INK;
  const eyes = o.initial
    ? `<circle cx="99" cy="41" r="11.5" fill="${o.color}" stroke="#fff" stroke-width="1.5"/><text x="99" y="45.5" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="Noto Sans JP, sans-serif">${o.initial}</text>`
    : `<circle cx="94" cy="38" r="2.4" fill="#fff"/><circle cx="104" cy="38" r="2.4" fill="#fff"/>`;
  return `<svg viewBox="0 0 124 92" aria-hidden="true">
  <g fill="${face}"><rect x="34" y="60" width="7" height="27" rx="3"/><rect x="48" y="62" width="7" height="25" rx="3"/><rect x="68" y="62" width="7" height="25" rx="3"/><rect x="82" y="60" width="7" height="27" rx="3"/></g>
  <g fill="#fff" stroke="#D3DDEE" stroke-width="1.5"><circle cx="30" cy="46" r="14"/><circle cx="44" cy="31" r="16"/><circle cx="64" cy="27" r="17"/><circle cx="82" cy="35" r="14"/><circle cx="84" cy="54" r="14"/><circle cx="64" cy="62" r="15"/><circle cx="42" cy="60" r="15"/></g>
  <circle cx="58" cy="46" r="22" fill="#fff"/>
  <ellipse cx="86" cy="33" rx="8" ry="3.6" fill="${face}" transform="rotate(-25 86 33)"/>
  <ellipse cx="112" cy="33" rx="8" ry="3.6" fill="${face}" transform="rotate(25 112 33)"/>
  <ellipse cx="99" cy="43" rx="14" ry="17" fill="${face}"/>
  <circle cx="99" cy="26" r="7.5" fill="#fff"/>
  ${eyes}</svg>`;
}
NENGA.sheepSVG = sheepSVG;
$$('[data-sheep]').forEach(el => { el.innerHTML = sheepSVG(); });

/* ---------- idea list: collapsed by default, opens when linked to ---------- */
(() => {
  const fold = $('#ideas-fold'); if (!fold) return;
  const openIf = () => { const id = location.hash.slice(1); if (id === 'ideas' || (id && fold.querySelector('#' + CSS.escape(id)))) fold.open = true; };
  window.addEventListener('hashchange', openIf); openIf();
  $$('a[href="#ideas"]').forEach(l => l.addEventListener('click', () => { fold.open = true; }));
})();

/* ---------- device frames: phone / PC ---------- */
const PC_W = 1280, PC_H = 760;
const devs = $$('.dev');
devs.forEach(dev => {
  const scr = $('.scr', dev);
  const chrome = document.createElement('div');
  chrome.className = 'chrome';
  chrome.innerHTML = `<i></i><i></i><i></i><span class="url">bravesoft.co.jp/nenga2027/${dev.dataset.path || ''}</span>`;
  const holder = document.createElement('div'); holder.className = 'holder';
  const vp = document.createElement('div'); vp.className = 'vp';
  vp.appendChild(scr); holder.appendChild(vp);
  dev.append(chrome, holder);
  dev._holder = holder; dev._vp = vp;
});
// On a phone the page becomes an app: one full-screen page at a time (see "phone app layout" below).
// Decided once at load, so rotating the phone never reshuffles the page. ?sp=1 / ?sp=0 force it for testing.
const spQ = new URLSearchParams(location.search).get('sp');
const SP = spQ != null ? spQ === '1' : (innerWidth < 700 || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600));
let mode = SP ? 'phone' : (store.get('nenga-mode') || (innerWidth >= 900 ? 'pc' : 'phone'));
function fit(dev) {
  if (mode === 'pc') {
    const s = dev._holder.clientWidth / PC_W || 1;
    dev._vp.style.transform = `scale(${s})`;
    dev._holder.style.height = (PC_H * s) + 'px';
  } else {
    dev._vp.style.transform = '';
    dev._holder.style.height = '';
  }
}
function applyMode() {
  document.documentElement.classList.toggle('pc', mode === 'pc');
  devs.forEach(d => { d.classList.toggle('pc', mode === 'pc'); d.classList.toggle('phone', mode !== 'pc'); fit(d); });
  $$('.seg [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  window.dispatchEvent(new CustomEvent('nenga:mode', { detail: mode }));
}
$$('.seg [data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; store.set('nenga-mode', mode); applyMode(); }));
const ro = new ResizeObserver(es => es.forEach(e => fit(e.target.closest('.dev'))));
devs.forEach(d => ro.observe(d._holder));
applyMode();
NENGA.isPC = () => mode === 'pc';
NENGA.sp = SP;

/* ---------- phone app layout: intro page → each demo full screen → closing page ----------
   Pages switch with the two arrows in the bottom bar, or from the page list that opens from the title; ⓘ opens the demo's notes as a bottom sheet.
   Only the current page is displayed, so the other demos stop rendering (their observers see them leave). */
if (SP) (() => {
  const html = document.documentElement; html.classList.add('sp');
  // no accidental zooming in the app layout: a fixed viewport (also stops iOS zooming into the 未来ポスト letter's text box
  // on focus), touch-action on <html> (no double-tap / pinch zoom; see style.css) and, because iOS Safari ignores
  // user-scalable, its pinch gesture events cancelled
  let vm = document.querySelector('meta[name="viewport"]');
  if (!vm) { vm = document.createElement('meta'); vm.name = 'viewport'; document.head.appendChild(vm); }
  vm.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault(); }, { passive: false });
  const deck = document.createElement('div'); deck.className = 'sp-deck';
  const page = (cls, nodes) => { const p = document.createElement('div'); p.className = 'sp-page sp-text ' + cls; nodes.filter(Boolean).forEach(n => p.appendChild(n)); return p; };
  const intro = page('sp-intro', [$('.hero') && $('.hero').closest('.band'), $('.neta') && $('.neta').closest('section'), $('#ideas')]);
  const outro = page('sp-outro', [$('.letter') && $('.letter').closest('section'), $('#memo'), $('footer.ft')]);
  intro.dataset.title = 'はじめに'; intro.dataset.hash = 'top';
  outro.dataset.title = '企画・制作メモ'; outro.dataset.hash = 'memo';
  const demos = $$('.demo');
  let sheet = () => {};
  deck.appendChild(intro);
  demos.forEach((d, i) => {
    d.classList.add('sp-page');
    const ttl = $('.expl h3', d), code = $('.expl .mono', d);
    d.dataset.title = ttl ? ttl.textContent : '';
    d.dataset.code = code ? code.textContent.replace('DEMO', '').split('/')[0].trim() : String.fromCharCode(65 + i);
    d.dataset.hash = d.id;
    const ex = $('.expl', d);
    if (ex) {
      const x = document.createElement('button'); x.type = 'button'; x.className = 'sp-close'; x.setAttribute('aria-label', '詳細を閉じる');
      x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      x.addEventListener('click', () => sheet(false)); ex.prepend(x);
    }
    deck.appendChild(d);
  });
  deck.appendChild(outro);
  const scrim = document.createElement('div'); scrim.className = 'sp-scrim'; scrim.addEventListener('click', () => sheet(false));
  const ico = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const bar = document.createElement('nav'); bar.className = 'sp-bar'; bar.setAttribute('aria-label', 'ページ切り替え');
  bar.innerHTML = `<button type="button" class="sp-arrow sp-prev" aria-label="前へ">${ico('M15 5l-7 7 7 7')}</button>
    <div class="sp-mid"><button type="button" class="sp-info" aria-label="このデモの詳細" aria-expanded="false">${ico('M12 11v6M12 7.5v.01')}</button>
      <button type="button" class="sp-ttl" aria-haspopup="true" aria-expanded="false" aria-label="ページを選ぶ"><span><b></b><small></small></span>${ico('M7 14.5l5-5 5 5')}</button></div>
    <button type="button" class="sp-arrow sp-next" aria-label="次へ">${ico('M9 5l7 7-7 7')}</button>`;
  const menuEl = document.createElement('div'); menuEl.className = 'sp-menu'; menuEl.setAttribute('role', 'menu'); menuEl.hidden = true;
  bar.appendChild(menuEl);   // fixed, so it floats above the bar; inside the bar so it stacks over the deck and the scrim
  deck.appendChild(scrim);   // inside the deck (a fixed element = its own stacking context) so the sheet can sit above it
  document.body.append(deck, bar);
  const pages = [intro, ...demos, outro];
  const prev = $('.sp-prev', bar), next = $('.sp-next', bar), ttl = $('.sp-ttl', bar), info = $('.sp-info', bar), tB = $('.sp-ttl b', bar), tS = $('.sp-ttl small', bar);
  let cur = -1;
  // page list: every page, the current one marked; opens upward from the title
  const items = pages.map((p, k) => {
    const isDemo = p.classList.contains('demo'), b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `<span class="c">${isDemo ? p.dataset.code : k === 0 ? 'TOP' : 'END'}</span><span class="t"></span>`;
    $('.t', b).textContent = p.dataset.title;
    b.addEventListener('click', () => { menu(false); go(k); });
    menuEl.appendChild(b); return b;
  });
  const menu = on => {
    if (on) sheet(false);
    menuEl.hidden = !on; html.classList.toggle('sp-menu-on', on); ttl.setAttribute('aria-expanded', String(on));
    if (on && items[cur]) { menuEl.scrollTop = 0; items[cur].scrollIntoView({ block: 'nearest' }); items[cur].focus({ preventScroll: true }); }
  };
  ttl.addEventListener('click', () => menu(menuEl.hidden));
  scrim.addEventListener('click', () => menu(false));
  sheet = on => {
    const p = pages[cur], ex = p && $('.expl', p);
    on = !!(on && ex);
    if (on) menu(false);
    html.classList.toggle('sp-sheet', on); info.setAttribute('aria-expanded', String(on));
    if (ex) { ex.classList.toggle('sp-open', on); if (on) ex.scrollTop = 0; }
  };
  function go(i, push = true) {
    i = Math.max(0, Math.min(pages.length - 1, i)); if (i === cur) return;
    sheet(false); menu(false);
    pages.forEach((p, k) => p.classList.toggle('cur', k === i)); cur = i;
    items.forEach((b, k) => b.toggleAttribute('aria-current', k === i));
    const p = pages[i], isDemo = p.classList.contains('demo');
    tB.textContent = isDemo ? `${p.dataset.code}  ${p.dataset.title}` : p.dataset.title;
    tS.textContent = isDemo ? `デモ ${i} / ${demos.length}` : (i === 0 ? '→ でデモへ' : 'おわり');
    prev.disabled = i === 0; next.disabled = i === pages.length - 1;
    info.hidden = !isDemo;
    if (!isDemo) p.scrollTop = 0;
    if (push) history.replaceState(null, '', '#' + p.dataset.hash);
    window.dispatchEvent(new Event('resize'));
  }
  prev.addEventListener('click', () => go(cur - 1));
  next.addEventListener('click', () => go(cur + 1));
  info.addEventListener('click', () => sheet(!html.classList.contains('sp-sheet')));
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === 'Escape') { sheet(false); menu(false); }
  });
  // in-page links (hero buttons, idea cards) jump to the matching page
  const target = id => {
    if (!id || id === 'top') return 0;
    const map = { demos: 'demo-shear', demos3d: 'demo-flock', demoswa: 'demo-omikuji' };
    const el = document.getElementById(map[id] || id); if (!el) return -1;
    return pages.findIndex(p => p === el || p.contains(el));
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const id = a.getAttribute('href').slice(1), i = target(id); if (i < 0) return;
    e.preventDefault(); go(i);
    const el = document.getElementById(id); if (i === 0 && el && intro.contains(el)) el.scrollIntoView({ block: 'start' });
  });
  const start = target(location.hash.slice(1));
  go(start < 0 ? 0 : start, false);
  NENGA.spGo = go;   // test hook
})();

/* local (unscaled) pointer coordinates inside an element */
function local(el, e) {
  const r = el.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (el.clientWidth / (r.width || 1)), y: (e.clientY - r.top) * (el.clientHeight / (r.height || 1)) };
}

/* ---------- A: shear ----------
   The fleece is made of individual curly tufts that cover (and overhang) the body, so the outline is bumpy like a real sheep.
   Clipping a tuft detaches it as a physics body: it drops, tumbles, bumps into other tufts and piles up on the ground. */
(() => {
  const root = $('#shear'), big = $('.sh-sheep', root), body = $('.sh-body', root), cv = $('.wool', root), head = $('.sh-head', root), bubble = $('.bubble', root);
  const ctx = cv.getContext('2d');
  const pct = $('.pct', root);
  const M = window.Matter;
  const rand = (a, b) => a + Math.random() * (b - a);

  // pre-rendered tuft sprites: clumps of small curls with soft shading
  // three tones (lit top, mid, shaded underside) x 6 shapes
  const TONES = [['#FFFFFF', '#F7FAFE', '#DCE5F2'], ['#FFFFFF', '#EEF3FA', '#CCD8EA'], ['#F3F6FB', '#DDE5F1', '#B7C6DD']];
  const SPR = TONES.map(([c0, c1, c2], tone) => Array.from({ length: 6 }, (_, v) => {
    const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), cx = S / 2, cy = S / 2;
    g.fillStyle = `rgba(20,50,110,${.12 + tone * .05})`; g.beginPath(); g.ellipse(cx + 3, cy + 7, S * .37, S * .3, 0, 0, 7); g.fill();
    const n = 10 + (v % 4);
    const curls = Array.from({ length: n }, (_, k) => {
      const a = k / n * 6.28 + rand(-.3, .3), d = k === 0 ? 0 : rand(S * .1, S * .27);
      return [cx + Math.cos(a) * d, cy + Math.sin(a) * d, rand(S * .11, S * .18)];
    }).sort((p, q) => p[1] - q[1]);
    curls.forEach(([x, y, r]) => {
      const gr = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
      gr.addColorStop(0, c0); gr.addColorStop(.62, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.strokeStyle = `rgba(140,165,205,${.45 + tone * .1})`; g.lineWidth = 1.3;
      g.beginPath(); g.arc(x + r * .1, y + r * .05, r * .55, rand(0, 3), rand(3.6, 6.2)); g.stroke();
      g.beginPath(); g.arc(x - r * .05, y - r * .1, r * .25, rand(0, 3), rand(3.6, 6.2)); g.stroke();
    });
    return c;
  }));

  let fluff = null, gusts = [], spray = [], sneezing = null, sneezed = false, clearAt = 0, held = null, brush = null, cooldownUntil = 0;
  let W = 0, H = 0, dpr = 1, tufts = [], loose = [], eng = null, statics = [], last = null, lastT = 0, started = false, done = false, removed = 0, raf = 0, visible = false, autoT = 0, cursor = null, groundY = 0, hintA = 1;
  const pc = () => W > 700;

  function bodyRect() {
    const sr = root.getBoundingClientRect(), k = root.clientWidth / (sr.width || 1), br = body.getBoundingClientRect();
    return { x: (br.left - sr.left) * k, y: (br.top - sr.top) * k, w: br.width * k, h: br.height * k, r: 44 };
  }
  // organic fleece outline: a rounded superellipse around the body with gentle lumps
  let lump = [];
  function inside(x, y, R, grow) {
    const cx = R.x + R.w / 2, cy = R.y + R.h / 2, a = R.w / 2 + grow, b = R.h / 2 + grow;
    const th = Math.atan2(y - cy, x - cx);
    const k = 1 + lump.reduce((acc, [f, p, amp]) => acc + Math.sin(th * f + p) * amp, 0);
    const u = Math.abs(x - cx) / (a * k), v = Math.abs(y - cy) / (b * k);
    return Math.pow(u, 3.6) + Math.pow(v, 3.6) <= 1;
  }
  function build() {
    W = cv.clientWidth; H = cv.clientHeight; if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const R = bodyRect(), r0 = pc() ? 26 : 16, step = r0 * 1.1, grow = r0 * 1.15;
    lump = [[5, rand(0, 6), .035], [8, rand(0, 6), .025], [13, rand(0, 6), .015]];
    tufts = [];
    for (let row = 0, y = R.y - grow - r0; y < R.y + R.h + grow + r0; y += step * .84, row++) {
      for (let x = R.x - grow - r0 + (row % 2) * step / 2; x < R.x + R.w + grow + r0; x += step) {
        const jx = x + rand(-3, 3), jy = y + rand(-3, 3);
        if (!inside(jx, jy, R, grow)) continue;
        const edge = !inside(jx, jy, R, grow - r0 * 1.2);
        const fy = (jy - R.y) / R.h;                     // 0 top .. 1 bottom
        const tone = fy > .78 || (edge && fy > .55) ? 2 : fy < .3 ? 0 : 1;
        const set = SPR[tone];
        tufts.push({ x: jx, y: jy, r: r0 * (edge ? rand(1.1, 1.4) : rand(.95, 1.2)), a: rand(0, 6.28), s: set[(Math.random() * set.length) | 0], on: true, ph: rand(0, 6.28) });
      }
    }
    tufts.sort((p, q) => p.y - q.y);   // lower tufts drawn on top, like overlapping fleece
    groundY = $('.sbar', root).offsetTop;
    if (M) {
      if (eng) { M.World.clear(eng.world, false); M.Engine.clear(eng); }
      eng = M.Engine.create({ enableSleeping: true }); eng.gravity.y = .8;
      const o = { isStatic: true, friction: .9 };
      statics = [M.Bodies.rectangle(W / 2, groundY + 40, W * 3, 80, o), M.Bodies.rectangle(-40, H / 2, 80, H * 3, o), M.Bodies.rectangle(W + 40, H / 2, 80, H * 3, o)];
      M.Composite.add(eng.world, statics);
    }
    loose = []; removed = 0; done = false; started = false; hintA = 1; autoT = 0;
    fluff = null; gusts = []; spray = []; sneezing = null; sneezed = false; clearAt = 0; held = null; brush = null;
    head.className = 'sh-head'; bubble.textContent = 'メェ〜！';
    big.classList.remove('done'); pct.textContent = '刈った量 0%';
    draw(performance.now());
  }
  const CAP = () => (pc() ? 120 : 64);
  function detach(t, vx = 0, vy = 0) {
    if (!t.on) return;
    t.on = false; removed++;
    const lr = t.r * .5;
    if (M && eng) {
      const b = M.Bodies.circle(t.x, t.y, lr, { restitution: .12, friction: .8, frictionAir: .04, density: .0006, slop: .05 });
      M.Body.setVelocity(b, { x: vx * .3 + rand(-1.2, 1.2), y: vy * .2 + rand(-2, -.2) });
      M.Body.setAngle(b, t.a); M.Body.setAngularVelocity(b, rand(-.15, .15));
      b.t = t; b.alpha = 1; M.Composite.add(eng.world, b); loose.push(b);
    } else {
      loose.push({ t, position: { x: t.x, y: t.y }, angle: t.a, vy: rand(-2, 0), vx: rand(-1, 1), alpha: 1 });
    }
    // keep the pile low: the oldest wool on the ground melts away
    const over = loose.filter(b => !b.fading).length - CAP();
    for (let k = 0, n = 0; k < loose.length && n < over; k++) if (!loose[k].fading) { loose[k].fading = true; n++; }
  }
  let lastSnip = 0;
  function cutAlong(a, b) {
    const R = pc() ? 30 : 20, dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, before = removed;
    tufts.forEach(t => {
      if (!t.on) return;
      const u = Math.max(0, Math.min(1, ((t.x - a.x) * dx + (t.y - a.y) * dy) / L2));
      const px = a.x + dx * u, py = a.y + dy * u;
      if ((t.x - px) ** 2 + (t.y - py) ** 2 < (R + t.r * .35) ** 2) detach(t, dx, dy);
    });
    const cut = removed - before, now = performance.now();
    if (cut && now - lastSnip > 75) { lastSnip = now; SNDX.play('snip', { vol: Math.min(1, .45 + cut * .12) }); }
    progress();
  }
  function progress() {
    const p = Math.round(removed / tufts.length * 100);
    pct.textContent = done ? '刈り終わりました' : '刈った量 ' + p + '%';
    if (!done && p >= 72) { SNDX.sfx.chime(); SNDX.sfx.bleat({ delay: .25 }); done = true; sneezed = false; clearAt = 0; autoT = performance.now(); big.classList.add('done'); pct.textContent = '刈り終わりました'; }
  }
  /* ---- the sneeze: a fluff tickles the nose → は…はっ… → ハックション! → the wind blows wool off the message ---- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function noseXY() {
    const sr = root.getBoundingClientRect(), k = root.clientWidth / (sr.width || 1), hr = head.getBoundingClientRect();
    return { x: (hr.left + hr.width / 2 - sr.left) * k, y: (hr.bottom - sr.top) * k - 8 };
  }
  function say(t) { bubble.textContent = t; big.classList.add('done'); if (!RM) bubble.animate([{ transform: 'scale(.7)' }, { transform: 'scale(1)' }], { duration: 180 }); }
  function startSneeze(byClick, at) {
    if (sneezing || performance.now() < cooldownUntil) return;
    const n = noseXY();
    if (at) {   // a clump of wool brushed the face: the tickle starts right there
      fluff = { x: at.x, y: at.y, sx: at.x, sy: at.y, a: 0 };
      sneezing = { t0: performance.now(), dur: 350, stage: 0 };
      say('ん…！？'); return;
    }
    // the cause: a stray wool fluff floats up from the pile (or, when tapped, the tap itself tickles the nose)
    // the first sneeze: a lone tuft of wool floats down from the sky like a feather and lands on the nose
    const from = byClick ? { x: n.x + rand(-60, 60), y: n.y + 70 } : { x: n.x + (Math.random() < .5 ? -1 : 1) * rand(50, 110) * (pc() ? 1.6 : 1), y: -30 };
    fluff = { x: from.x, y: from.y, sx: from.x, sy: from.y, a: 0, fall: !byClick };
    sneezing = { t0: performance.now(), dur: byClick ? 700 : 3200, stage: 0 };
    say(byClick ? 'ん…？' : '…ん？');
  }
  function stepSneeze(now, dt) {
    gusts = gusts.filter(gs => (gs.life -= dt / 600) > 0); gusts.forEach(gs => { gs.x += gs.vx * dt / 16; gs.y += gs.vy * dt / 16; });
    spray = spray.filter(p => (p.life -= dt / 700) > 0); spray.forEach(p => { p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vy += .05; });
    if (!sneezing) return;
    const S = sneezing, el = now - S.t0, n = noseXY();
    if (fluff && el < S.dur) {   // drift up in a lazy zig-zag toward the nose
      const k = el / S.dur, e2 = k * k * (3 - 2 * k);
      if (fluff.fall) {   // falling: steady descent with a wide, slowing side-to-side sway, homing in on the nose at the end
        const sway = Math.sin(k * 11) * (1 - k) * (pc() ? 70 : 42);
        fluff.x = fluff.sx + (n.x - fluff.sx) * Math.pow(k, 1.6) + sway; fluff.y = fluff.sy + (n.y - fluff.sy) * k; fluff.a = Math.sin(k * 11) * .6;
      } else { fluff.x = fluff.sx + (n.x - fluff.sx) * e2 + Math.sin(k * 9) * (1 - k) * 24; fluff.y = fluff.sy + (n.y - fluff.sy) * e2; fluff.a += dt / 300; }
      return;
    }
    const t2 = el - S.dur;
    if (S.stage === 0) { S.stage = 1; fluff = null; head.className = 'sh-head twitch'; say('ムズムズ…'); }
    if (S.stage === 1 && t2 > 650) { S.stage = 2; head.className = 'sh-head inhale'; say('は…'); SNDX.play('inhale', { vol: .55, rate: 1, exact: true }); }
    if (S.stage === 2 && t2 > 1150) { S.stage = 3; say('はっ…'); }
    if (S.stage === 3 && t2 > 1600) { S.stage = 4; head.className = 'sh-head sneeze'; say('ハックション！'); blow(n); SNDX.play('sneeze', { vol: 1 }); SNDX.play('gust', { vol: .8, delay: .08 }); }
    if (S.stage === 4 && t2 > 2900) { S.stage = 5; head.className = 'sh-head'; say('メェ〜…すっきり'); SNDX.sfx.bleat(); sneezing = null; sneezed = true; cooldownUntil = performance.now() + 1500; if (done) pct.textContent = 'タップでもう一度くしゃみ'; else progress(); }
  }
  function blow(n) {
    if (!RM) root.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,3px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(0,0)' }], { duration: 320 });
    const R = bodyRect(), cx = R.x + R.w / 2;
    // wind streaks fanning out from the nose
    for (let k = 0; k < 14; k++) { const a = Math.PI / 2 + rand(-1.1, 1.1), L = rand(.5, 1) * (pc() ? 220 : 130); gusts.push({ x: n.x, y: n.y + 6, dx: Math.cos(a) * L, dy: Math.sin(a) * L, cx: rand(-30, 30), vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, w: rand(1.5, 3.5), life: 1 }); }
    for (let k = 0; k < 24; k++) { const a = Math.PI / 2 + rand(-.9, .9), v = rand(2, 6); spray.push({ x: n.x, y: n.y + 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(1, 2.5), life: 1 }); }
    // the fleece still on the sheep: the sneeze strips its top layer — almost everything near the head, thinning out
    // toward the bottom, so a sneeze half-way through shearing blows a big bite out of the wool
    const left = tufts.filter(t => t.on);
    if (left.length) {
      const reach = R.h * (pc() ? .75 : .8);
      left.forEach(t => {
        const d = Math.hypot(t.x - n.x, t.y - n.y), f = clamp(1 - d / reach, 0, 1);
        if (Math.random() > f * .9 + .04) return;
        const before = loose.length; detach(t);
        const b = loose[loose.length - 1];
        if (loose.length > before && M && eng) {
          const side = t.x < cx ? -1 : 1; b.blown = true;
          M.Body.setVelocity(b, { x: side * rand(6, 16) * (.5 + f) * (pc() ? 1.5 : 1) + (t.x - n.x) * .02, y: -rand(3, 9) * (.4 + f) });
          M.Body.setAngularVelocity(b, rand(-.4, .4));
        }
      });
      progress();
    }
    if (!(M && eng)) return;
    // push the wool that covers the card out to the sides; wool further away gets a weaker gust, so some stays
    loose.forEach(b => {
      if (b.blown) { b.blown = false; return; }   // just blown off the fleece: already has its own velocity
      const x = b.position.x, y = b.position.y, onCard = x > R.x - 10 && x < R.x + R.w + 10 && y > R.y - 10 && y < R.y + R.h + 30;
      const d = Math.hypot(x - n.x, y - n.y), f = clamp(1 - d / (H * 1.1), .15, 1) * (onCard ? 1 : .35);
      if (onCard && Math.random() < .12) return;   // a few stubborn tufts stay put
      M.Sleeping.set(b, false);
      const side = x < cx ? -1 : 1;
      M.Body.setVelocity(b, { x: side * rand(10, 20) * Math.max(f, .5) * (pc() ? 1.6 : 1), y: -rand(5, 11) * f });
      M.Body.setAngularVelocity(b, rand(-.4, .4));
    });
  }
  head.addEventListener('click', () => { if (!sneezing) startSneeze(true); });   // tap the face any time: it sneezes (and blows wool off)

  function draw(now) {
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const t = now / 1000;
    // attached fleece (breathes slightly)
    tufts.forEach(tf => {
      if (!tf.on) return;
      const s = tf.r * 2 * (1 + Math.sin(t * 1.6 + tf.ph) * .015);
      c.save(); c.translate(tf.x, tf.y + Math.sin(t * 1.6) * .6); c.rotate(tf.a); c.drawImage(tf.s, -s / 2, -s / 2, s, s); c.restore();
    });
    if (hintA > 0 && tufts.length) {
      const R = bodyRect();
      c.globalAlpha = hintA; c.textAlign = 'center';
      c.fillStyle = 'rgba(0,102,255,.85)'; c.font = `900 ${pc() ? 22 : 15}px "Noto Sans JP", sans-serif`; c.fillText('もこもこ', R.x + R.w / 2, R.y + R.h / 2 - 4);
      c.font = `700 ${pc() ? 15 : 11}px "Noto Sans JP", sans-serif`; c.fillText('なぞると刈れます', R.x + R.w / 2, R.y + R.h / 2 + (pc() ? 20 : 14));
      c.globalAlpha = 1;
    }
    // loose wool
    loose.forEach(b => {
      const tf = b.t, s = tf.r * 1.45;
      c.save(); c.globalAlpha = b.alpha; c.translate(b.position.x, b.position.y); c.rotate(b.angle); c.drawImage(tf.s, -s / 2, -s / 2, s, s); c.restore();
    });
    c.globalAlpha = 1;
    // the tickling fluff and the sneeze wind
    if (fluff) { const sz = (pc() ? 36 : 22); c.save(); c.globalAlpha = .95; c.translate(fluff.x, fluff.y); c.rotate(fluff.a); c.drawImage(SPR[0][0], -sz / 2, -sz / 2, sz, sz); c.restore(); }
    gusts.forEach(gs => {
      c.globalAlpha = Math.max(0, gs.life) * .8; c.strokeStyle = '#fff'; c.lineWidth = gs.w; c.lineCap = 'round';
      c.beginPath(); c.moveTo(gs.x, gs.y); c.quadraticCurveTo(gs.x + gs.dx * .5 + gs.cx, gs.y + gs.dy * .5, gs.x + gs.dx, gs.y + gs.dy); c.stroke();
    });
    spray.forEach(p => { c.globalAlpha = Math.max(0, p.life); c.fillStyle = '#E5F0FF'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); });
    c.globalAlpha = 1;
    // clipper cursor
    if (cursor && !done && !held) {
      const r = pc() ? 30 : 20;
      c.strokeStyle = 'rgba(255,233,74,.95)'; c.lineWidth = 2.5; c.setLineDash([5, 4]);
      c.beginPath(); c.arc(cursor.x, cursor.y, r, 0, 7); c.stroke(); c.setLineDash([]);
    }
  }
  function loop(now) {
    raf = 0; if (!visible) return;
    const dt = Math.min(50, now - (lastT || now)); lastT = now;
    if (started && hintA > 0) hintA = Math.max(0, hintA - dt / 400);
    // after the threshold, the rest of the fleece slides off in a cascade from the top
    if (done) {
      const rest = tufts.filter(t => t.on);
      const n = Math.min(rest.length, Math.max(1, Math.round(dt / 8)));
      for (let k = 0; k < n; k++) detach(rest[k], rand(-2, 2), rand(0, 2));
      // 4 seconds after the last tuft lands, a stray fluff drifts up and tickles the nose
      if (!rest.length) { if (!clearAt) clearAt = now; if (!sneezed && !sneezing && now - clearAt > 4000) startSneeze(false); }
    }
    stepSneeze(now, dt);
    // a loose clump of wool touching the sheep's face makes it sneeze too
    if (!sneezing && loose.length && now > cooldownUntil) {
      const sr = root.getBoundingClientRect(), k = root.clientWidth / (sr.width || 1), hr = head.getBoundingClientRect();
      const hx = (hr.left + hr.width / 2 - sr.left) * k, hy = (hr.top + hr.height * .55 - sr.top) * k, hrad = hr.width * k * .55;
      // only wool that is carried or thrown up to the face counts (not tufts simply falling off the fleece next to it)
      const hit = loose.find(b => !b.fading && ((held && held.b === b) || b.velocity.y < -1.5) && (b.position.x - hx) ** 2 + (b.position.y - hy) ** 2 < (hrad + b.t.r * .5) ** 2);
      if (hit) startSneeze(false, { x: hit.position.x, y: hit.position.y });
    }
    // held wool follows the pointer
    if (held && M && eng) { const b = held.b; M.Sleeping.set(b, false); const vx = (held.x - b.position.x) * .35, vy = (held.y - b.position.y) * .35; M.Body.setVelocity(b, { x: vx, y: vy }); }
    loose.forEach(b => { if (b.fading && (!held || held.b !== b)) b.alpha -= dt / 700; });
    const gone = loose.filter(b => b.alpha <= 0);
    if (gone.length) { if (M && eng) M.Composite.remove(eng.world, gone); loose = loose.filter(b => b.alpha > 0); }
    if (M && eng) { M.Engine.update(eng, Math.min(33, dt || 16)); }
    else loose.forEach(b => { b.vy += .25; b.position.y = Math.min(groundY - 8, b.position.y + b.vy); b.position.x += b.vx; });
    draw(now);
    raf = requestAnimationFrame(loop);
  }
  new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; if (visible && !raf) { lastT = 0; raf = requestAnimationFrame(loop); } }).observe(root);
  // pointer: shear the fleece, or grab / brush the wool that has already fallen
  const nearFleece = p => tufts.some(t => t.on && (t.x - p.x) ** 2 + (t.y - p.y) ** 2 < (t.r * 1.3) ** 2);
  const nearLoose = p => { let best = null, bd = 1e9; loose.forEach(b => { if (b.fading) return; const d = (b.position.x - p.x) ** 2 + (b.position.y - p.y) ** 2, r = b.t.r * .9; if (d < r * r && d < bd) { bd = d; best = b; } }); return best; };
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); const p = local(cv, e); cursor = p;
    if (nearFleece(p)) { started = true; last = p; cutAlong(p, p); return; }
    const b = M && eng ? nearLoose(p) : null;
    if (b) { held = { b, x: p.x, y: p.y, hist: [{ x: p.x, y: p.y, t: e.timeStamp }] }; return; }
    last = p; brush = p;   // a stroke that starts off the sheep still shears once it reaches the fleece, and pushes loose wool on the way
  });
  cv.addEventListener('pointermove', e => {
    const p = local(cv, e); cursor = p;
    if (held) { held.x = p.x; held.y = p.y; held.hist.push({ x: p.x, y: p.y, t: e.timeStamp }); while (held.hist.length > 2 && e.timeStamp - held.hist[0].t > 100) held.hist.shift(); return; }
    if (brush && M && eng) {   // sweep through the pile to push the wool around
      const dx = p.x - brush.x, dy = p.y - brush.y, R = pc() ? 46 : 30;
      loose.forEach(b => { const ox = b.position.x - p.x, oy = b.position.y - p.y; if (ox * ox + oy * oy < R * R) { M.Sleeping.set(b, false); M.Body.setVelocity(b, { x: b.velocity.x + dx * .25, y: b.velocity.y + dy * .25 - .6 }); } });
      brush = p;
    }
    if (!last) return;
    if (nearFleece(p) || nearFleece(last)) { started = true; cutAlong(last, p); }
    last = p;
  });
  const up = e => {
    if (held && M) { SNDX.play('poof', { vol: .5 }); SNDX.sfx.whoosh(); }
    if (held && M) { const h = held.hist, a = h[0], z = h[h.length - 1], dtm = Math.max(16, z.t - a.t); M.Body.setVelocity(held.b, { x: clamp((z.x - a.x) / dtm * 16, -25, 25), y: clamp((z.y - a.y) / dtm * 16, -25, 25) }); }
    held = null; brush = null; last = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { cursor = null; });
  // tap on loose wool in the pile to toss it
  $('.js-reset', root).addEventListener('click', () => { SNDX.play('poof', { vol: .7 }); SNDX.play('pon', { vol: .5, delay: .05 }); build(); });
  let bw = 0, bh = 0;
  new ResizeObserver(() => { if (Math.abs(cv.clientWidth - bw) > 2 || Math.abs(cv.clientHeight - bh) > 2) { bw = cv.clientWidth; bh = cv.clientHeight; build(); } }).observe(cv);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!started) draw(performance.now()); });
})();

/* ---------- B: count — a night meadow painted from the supplied assets: sky, crescent moon, hill, fence and one fluffy sheep at a time ---------- */
(() => {
  const root = $('#count'); if (!root) return;
  const scene = $('.c-scene', root), actors = $('.c-actors', root);
  const nEl = $('.js-n', root), numEl = $('.c-num', root), linesEl = $('.c-lines', root), btn = $('.js-go', root), photo = $('.js-photo', root), hint = $('.c-hint', root);
  const cv = $('.c-phys', root), ctx = cv.getContext('2d');
  const SVGNS = 'http://www.w3.org/2000/svg';
  const rand = (a, b) => a + Math.random() * (b - a);
  // the message, grouped into paragraphs (one line per jump)
  // "|" marks where a line may wrap, so phrases never break mid-word
  const PARAS = [['眠れない夜は、|ひつじを|数えるといいそうです。'], ['でも2027年は、', '眠っている場合じゃない|一年になりそうです。'], ['未年の「未」は、|未来の「未」。', 'まだ誰も|見たことのない|体験を、|皆さまと一緒に。']];
  const FINAL = ['あけまして|おめでとうございます。', '本年もどうぞ|よろしくお願いいたします。'];
  const setText = (p, t) => { p.setAttribute('aria-label', t.replace(/\|/g, '')); p.innerHTML = t.split('|').map(s => `<span class="nw">${s}</span>`).join(''); };
  const STAFF = [['開', '#0066FF'], ['営', '#3F9CFF'], ['デ', '#253A58'], ['企', '#2247FF'], ['広', '#00BBFF'], ['人', '#3366FF'], ['総', '#004190']];
  const paraEls = [], lineEls = [];
  [...PARAS, FINAL].forEach((ls, pi) => {
    const d = document.createElement('div'); d.className = 'c-para'; linesEl.appendChild(d); paraEls.push(d);
    ls.forEach(t => { const p = document.createElement('p'); setText(p, t); if (pi === PARAS.length) p.className = 'final'; d.appendChild(p); if (pi < PARAS.length) lineEls.push({ p, pi }); });
    if (pi === PARAS.length) { const s = document.createElement('p'); s.className = 'sig final'; s.textContent = 'bravesoft株式会社 代表取締役 〇〇 〇〇'; d.appendChild(s); }
  });
  const NL = lineEls.length;
  let n = 0, i = 0, phase = 'normal', busy = false, staffIx = 0;

  /* --- painted assets (sky, moon, hill, fence, sheep) --- */
  const AS = window.NENGA_ASSETS || { img: {} }, IMG = AS.img;
  const skyEl = $('.c-sky', root), moonEl = $('.c-moon', root), hillEl = $('.c-hill', root), fenceImg = $('.c-fence', root), fxSvg = $('.c-fx', root);
  if (IMG.sky) skyEl.style.backgroundImage = `url(${IMG.sky})`;
  if (IMG.moon) moonEl.src = IMG.moon; if (IMG.hill) hillEl.src = IMG.hill; if (IMG.fence) fenceImg.src = IMG.fence;
  // the sheep is a rig of separate parts (body, head, 4 legs) laid out in a 200×150 unit box, facing right
  const SH = { ar: .75, bx: .425, by: .453, br: .32, fx: .82, fy: .41, fr: .09 };
  const RIG = { body: [10, 14, 150], head: [124, 13, 74], legs: [['hd far a', 40], ['fr far b', 106], ['hd near b', 57], ['fr near a', 123]], hipY: 92, legW: 19 };
  const pct = (v, of) => (v / of * 100).toFixed(2) + '%';
  function rigHTML() {
    const lw = RIG.legW, lh = lw * 240 / 104;
    const legs = RIG.legs.map(([c, x]) => `<img class="lg ${c}" alt="" src="${IMG.leg || ''}" style="left:${pct(x - lw / 2, 200)};top:${pct(RIG.hipY, 150)};width:${pct(lw, 200)};height:${pct(lh, 150)}">`);
    const [bx, by, bw] = RIG.body, [hx, hy, hw] = RIG.head;
    return `<div class="rig">${legs[0]}${legs[1]}${legs[2]}${legs[3]}`
      + `<img class="bd" alt="" src="${IMG.body || ''}" style="left:${pct(bx, 200)};top:${pct(by, 150)};width:${pct(bw, 200)}">`
      + `<img class="hdp" alt="" src="${IMG.head || ''}" style="left:${pct(hx, 200)};top:${pct(hy, 150)};width:${pct(hw, 200)}"></div>`;
  }
  // the hill's ridge line, sampled from the painting (original 1586×992 frame)
  const PROF = AS.prof || [], HW = AS.hillW || 1586, HH = AS.hillH || 992, HTOP = AS.hillTop || 0;
  const ridge = xo => { if (!PROF.length) return 722; const f = clamp01(xo / (HW - 1)) * (PROF.length - 1), i = Math.floor(f), t = f - i; return PROF[i] * (1 - t) + PROF[Math.min(PROF.length - 1, i + 1)] * t; };
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  /* --- scene geometry (px in the screen's own coordinates) --- */
  let G = null;
  function geo() {
    const W = root.clientWidth, H = root.clientHeight, pc = W >= 700;
    const g = pc
      ? { W, H, pc, fx: W * .656, fw: W * .162, moon: [W * .873, H * .18, W * .115], sheepW: W * .165, num: [W * .548, H * .235], numS: H * .175 }
      : { W, H, pc, fx: W * .62, fw: W * .32, moon: [W * .8, H * .44, W * .2], sheepW: W * .34, num: [W * .08, H * .5], numS: H * .1 };
    // place the hill painting: full width on PC; zoomed in on its crest on the phone
    if (pc) { g.s = W / HW; g.ox = 0; g.oy = H * .725 - 722 * g.s; if (g.oy + HH * g.s < H) g.oy = H - HH * g.s; }
    else { g.s = Math.max(W * 2.2 / HW, H * .27 / 270); g.ox = W * .55 - 1015 * g.s; g.oy = H * .77 - 722 * g.s; if (g.oy + HH * g.s < H) g.oy = H - HH * g.s; }
    g.hy = x => g.oy + ridge((x - g.ox) / g.s) * g.s;
    g.fh = g.fw * 299 / 520;
    g.base = g.hy(g.fx) + g.fh * .05; g.fTop = g.base - g.fh * .9;
    g.tx = g.fx - g.fw * 1.1; g.lx = g.fx + g.fw * 1.1;           // takeoff / landing
    return g;
  }
  const el = (tag, at, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in at) e.setAttribute(k, at[k]); if (parent) parent.appendChild(e); return e; };
  function drawScene() {
    G = geo(); const { W, H } = G;
    // stars (behind the hill)
    scene.setAttribute('viewBox', `0 0 ${W} ${H}`); scene.innerHTML = '';
    for (let k = 0; k < (G.pc ? 46 : 26); k++) {
      const x = rand(0, W), y = rand(G.pc ? 70 : 10, G.hy(x) - 30), r = Math.random() < .12 ? rand(1.4, 2) : rand(.5, 1.2);
      el('circle', { cx: x, cy: y, r, fill: '#fff', opacity: rand(.35, .9), class: Math.random() < .3 ? 'tw' : '', style: `animation-delay:${rand(0, 3).toFixed(2)}s` }, scene);
    }
    // moon
    const [mx, my, mw] = G.moon;
    Object.assign(moonEl.style, { width: mw + 'px', left: (mx - mw / 2) + 'px', top: (my - mw * 392 / 360 / 2) + 'px' });
    // hill
    Object.assign(hillEl.style, { width: HW * G.s + 'px', left: G.ox + 'px', top: (G.oy + HTOP * G.s) + 'px' });
    // fence
    Object.assign(fenceImg.style, { width: G.fw + 'px', left: (G.fx - G.fw / 2) + 'px', top: (G.base - G.fh) + 'px' });
    // takeoff sparkle + dotted-trail layer (in front of the hill)
    fxSvg.setAttribute('viewBox', `0 0 ${W} ${H}`); fxSvg.innerHTML = '';
    const defs = el('defs', {}, fxSvg);
    defs.innerHTML = '<radialGradient id="cGlow"><stop offset="0" stop-color="#FFD86B" stop-opacity=".6"/><stop offset=".5" stop-color="#FFC94A" stop-opacity=".2"/><stop offset="1" stop-color="#FFC94A" stop-opacity="0"/></radialGradient>';
    const ty = G.hy(G.tx) + 2;
    el('ellipse', { cx: G.tx, cy: ty, rx: G.pc ? 26 : 16, ry: G.pc ? 9 : 6, fill: 'url(#cGlow)' }, fxSvg);
    el('circle', { cx: G.tx, cy: ty, r: G.pc ? 3.2 : 2.2, fill: '#FFF1B8', class: 'takeoff' }, fxSvg);
    trail = el('g', { fill: '#FFD86B' }, fxSvg);
    // counter position + size
    numEl.style.left = G.num[0] + 'px'; numEl.style.top = G.num[1] + 'px'; numEl.style.fontSize = G.numS + 'px';
  }
  let trail = null;
  new ResizeObserver(() => drawScene()).observe(root);
  window.addEventListener('nenga:mode', () => setTimeout(drawScene, 30));
  drawScene();

  /* --- one sheep runs in, jumps the fence (with a dotted trail), lands and trots off --- */
  function spawn(dur, solo = true) {
    const g = G; if (!g) return;
    const s = STAFF[staffIx++ % STAFF.length];
    const r = document.createElement('div'); r.className = 'runner run';
    const w = g.sheepW, h = w * SH.ar;
    r.style.width = w + 'px'; r.style.height = h + 'px';
    r.innerHTML = rigHTML() + (photo.checked ? `<b class="face" style="left:${SH.fx * 100}%;top:${SH.fy * 100}%;width:${SH.fr * 200}%;background:${s[1]}">${s[0]}</b>` : '');
    actors.appendChild(r);
    const footY = x => g.hy(x) - h * .9;                          // hooves (≈135 of 150 units) on the ridge
    const xs = -w - 10, xe = g.W + 10, apexY = g.fTop - h * .98;   // clear the fence comfortably
    const jx0 = g.tx - w * .78, jx1 = g.lx - w * .55;             // x of the sheep's left edge at takeoff / landing
    const N = 40, kf = [];
    let tUp = 0, tDown = 0;
    for (let k = 0; k <= N; k++) {
      const t = k / N, x = xs + (xe - xs) * t;
      let y = footY(x + w * .5), rot = 0;
      if (x >= jx0 && x <= jx1) {
        const u = (x - jx0) / (jx1 - jx0), base = footY(x + w * .5);
        y = base + (apexY - base) * Math.sin(u * Math.PI) * 1; rot = -14 * Math.cos(u * Math.PI);
      } else y += Math.abs(Math.sin(t * 34)) * -h * .05;          // trotting bob
      kf.push({ transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`, offset: t });
    }
    tUp = (jx0 - xs) / (xe - xs); tDown = (jx1 - xs) / (xe - xs);
    const a = r.animate(kf, { duration: dur, easing: 'linear' });
    // airborne pose + dotted trail drawn behind the sheep
    setTimeout(() => { r.classList.remove('run'); r.classList.add('air'); if (solo) SNDX.play('boing', { vol: .6 }); }, dur * tUp);
    setTimeout(() => { if (solo) SNDX.play('poof', { vol: .55 }); r.classList.remove('air'); r.classList.add('run', 'land'); setTimeout(() => r.classList.remove('land'), 260); }, dur * tDown);
    if (solo && trail) {
      trail.innerHTML = ''; trail.style.opacity = 1; trail.style.transition = '';
      const dots = [], M = 26;
      for (let k = 0; k <= M; k++) {
        const u = k / M, x = g.tx + (g.lx - g.tx) * u * .62, xx = jx0 + (jx1 - jx0) * u * .62;
        const base = footY(xx + w * .5), y = base + (apexY - base) * Math.sin(u * .62 * Math.PI) + h * .62;
        const c = el('circle', { cx: (xx + w * .18).toFixed(1), cy: y.toFixed(1), r: (g.pc ? 2.3 : 1.5) * (.7 + u * .4), opacity: 0 }, trail); dots.push([c, tUp + (tDown - tUp) * u * .62]);
      }
      const t0 = performance.now();
      const st = () => {
        const tt = (performance.now() - t0) / dur;
        dots.forEach(([c, at]) => { if (tt >= at) c.setAttribute('opacity', '.95'); });
        if (tt < tDown + .02) requestAnimationFrame(st);
        else { trail.style.transition = 'opacity .8s'; trail.style.opacity = 0; }
      };
      requestAnimationFrame(st);
    }
    a.onfinish = () => r.remove();
    return dur * ((tUp + tDown) / 2);   // ms until the sheep is over the fence
  }
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];   // count notes climb a major pentatonic
  function bump(v) {
    if (v < 2027) SNDX.play('pon', { vol: .7, rate: Math.pow(2, PENTA[(v - 1) % PENTA.length] / 12) });
    nEl.textContent = v.toLocaleString('ja-JP'); nEl.dataset.v = v; numEl.classList.add('on');
    if (!RM) {
      numEl.animate([{ transform: 'scale(.7) rotate(-6deg)' }, { transform: 'scale(1.12) rotate(2deg)', offset: .6 }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
      $$('.c-burst b', root).forEach((b, k) => b.animate([{ opacity: 0, scale: '.3' }, { opacity: 1, scale: '1.2', offset: .5 }, { opacity: 1, scale: '1' }], { duration: 360, delay: k * 40, fill: 'backwards' }));
    }
  }
  function showLine(ix) {
    const { p, pi } = lineEls[ix]; p.classList.add('show');
    if (pi >= 2 && paraEls[pi - 2]) paraEls[pi - 2].classList.add('gone');   // keep two paragraphs on screen at most
  }

  /* --- sheep sprites for the physics pile --- */
  const sheepImg = document.createElement('canvas'); sheepImg.width = 400; sheepImg.height = 300; sheepImg.complete = false; sheepImg.naturalWidth = 0;
  (() => {
    const load = s => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = s || ''; });
    Promise.all([load(IMG.body), load(IMG.head), load(IMG.leg)]).then(([bd, hd, lg]) => {
      if (!bd || !hd || !lg) return;
      const c = sheepImg.getContext('2d'), u = 2, lw = RIG.legW * u, lh = lw * lg.height / lg.width;
      RIG.legs.forEach(([cls, x], k) => {
        c.save(); c.translate(x * u, RIG.hipY * u + lh * .12); c.rotate((/fr/.test(cls) ? -.5 : .45) * (k % 2 ? 1 : .8));
        if (/far/.test(cls)) c.filter = 'brightness(.6)';
        c.drawImage(lg, -lw / 2, -lh * .12, lw, lh); c.restore();
      });
      const [bx, by, bw] = RIG.body, [hx, hy, hw] = RIG.head;
      c.drawImage(bd, bx * u, by * u, bw * u, bw * u * bd.height / bd.width);
      c.drawImage(hd, hx * u, hy * u, hw * u, hw * u * hd.height / hd.width);
      sheepImg.complete = true; sheepImg.naturalWidth = 400;
    });
  })();
  const sprites = { plain: { im: sheepImg }, staff: STAFF.map(([ch, col]) => ({ im: sheepImg, ch, col })) };

  /* --- physics rush: the remaining 2022 sheep pile up on the hill, roll and bump each other --- */
  const M = window.Matter;
  let eng = null, raf = 0, W = 0, H = 0, dpr = 1, statics = [], sheep = [], fx = [], conf = [], spawned = 0, total = 0, t0 = 0, last = 0, acc = 0, lastMee = 0, lastPoof = 0, shakeT = 0, finished = false;
  function geom() { W = cv.clientWidth; H = cv.clientHeight; dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  function buildStatics() {
    if (statics.length) M.Composite.remove(eng.world, statics);
    const opt = { isStatic: true, friction: .8, restitution: .2 }, k = W / root.clientWidth;
    statics = [];
    // the hill as a chain of tilted slabs
    const segs = 18;
    for (let s = 0; s < segs; s++) {
      const xa = -60 + (W + 120) * s / segs, xb = -60 + (W + 120) * (s + 1) / segs, ya = G.hy(xa / k) * k, yb = G.hy(xb / k) * k;
      const len = Math.hypot(xb - xa, yb - ya) + 6, ang = Math.atan2(yb - ya, xb - xa), th = 80;
      statics.push(M.Bodies.rectangle((xa + xb) / 2 - Math.sin(ang) * th / 2, (ya + yb) / 2 + Math.cos(ang) * th / 2, len, th, Object.assign({ angle: ang }, opt)));
    }
    statics.push(M.Bodies.rectangle(-50, H / 2 - 400, 100, H + 1200, opt), M.Bodies.rectangle(W + 50, H / 2 - 400, 100, H + 1200, opt));
    statics.push(M.Bodies.rectangle(G.fx * k, (G.fTop + G.fh / 2 + 3) * k, G.fw * k, (G.fh - 6) * k, Object.assign({ chamfer: { radius: 4 } }, opt)));
    M.Composite.add(eng.world, statics);
  }
  function addSheep() {
    const pc = W > 700, r = pc ? rand(28, 40) : rand(16, 22);   // big enough to read as sheep (sprite size follows the circle)
    const fromSky = spawned % 3 === 2;
    const x = fromSky ? rand(r * 2, W - r * 2) : -r * 1.5;
    const y = fromSky ? -r * 2 - rand(0, 80) : G.hy(0) - rand(40, H * .35);
    const b = M.Bodies.circle(x, y, r, { restitution: .42, friction: .35, frictionAir: .004, density: .0016, slop: .02 });
    const sp = pc ? 1.6 : 1;
    M.Body.setVelocity(b, fromSky ? { x: rand(-2, 2), y: rand(2, 5) } : { x: rand(6, 11) * sp, y: rand(-11, -6) * sp });
    M.Body.setAngularVelocity(b, rand(-.25, .25));
    b.sprite = photo.checked ? sprites.staff[spawned % sprites.staff.length] : sprites.plain;
    b.r = r;
    M.Composite.add(eng.world, b); sheep.push(b);
    spawned++;
  }
  function puff(x, y, k = 4) { if (RM) return; for (let q = 0; q < k; q++) fx.push({ type: 'p', x, y, vx: rand(-1.4, 1.4), vy: rand(-2.2, -.4), r: rand(2, 5) * (W > 700 ? 1.6 : 1), life: 1 }); }
  let lastBleat = 0;
  function mee(x, y) {
    const now = performance.now(); if (now - lastBleat > 260) { lastBleat = now; SNDX.sfx.bleat({ vol: .4, rate: 1 + Math.random() * .25 }); }
    fx.push({ type: 't', x, y, vy: -.7, life: 1, txt: Math.random() < .5 ? 'メェ' : 'メェ〜！' }); }
  function confetti() {
    if (RM) return;
    const cols = ['#FFD43B', '#0066FF', '#FFFFFF', '#3F9CFF', '#FFE89A'];
    for (let q = 0; q < (W > 700 ? 220 : 110); q++) conf.push({ x: rand(0, W), y: rand(-H * .6, -10), vx: rand(-1, 1), vy: rand(1.5, 4), a: rand(0, 6.28), va: rand(-.2, .2), w: rand(5, 10) * (W > 700 ? 1.4 : 1), h: rand(3, 6), c: cols[q % cols.length] });
  }
  function startRush() {
    if (!M) return fallbackRush();
    phase = 'busy'; btn.disabled = true; finished = false; lastPoof = 0;
    SNDX.play('hooves', { vol: .9 }); setTimeout(() => SNDX.play('hooves', { vol: .7 }), 1500); setTimeout(() => SNDX.play('hooves', { vol: .5 }), 3000);
    cv.classList.add('on'); root.classList.add('rushing'); geom();
    eng = M.Engine.create({ enableSleeping: true }); eng.gravity.y = 1.05;
    buildStatics();
    M.Events.on(eng, 'collisionStart', e => {
      const now = performance.now();
      e.pairs.forEach(p => {
        const a = p.bodyA, b = p.bodyB, rel = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
        if (rel > 4.5 && p.collision && p.collision.supports && p.collision.supports[0]) {
          const s = p.collision.supports[0]; puff(s.x, s.y, rel > 9 ? 6 : 3);
          if (now - lastPoof > 55) { lastPoof = now; SNDX.play('poof', { vol: Math.min(.8, rel / 14) }); }
          if (now - lastMee > 380 && rel > 7) { lastMee = now; mee(s.x, s.y - 10); }
          if ((a.isStatic || b.isStatic) && rel > 12) shakeT = Math.max(shakeT, .12);
        }
      });
    });
    total = RM ? 30 : (W > 700 ? 110 : 55);   // fewer, larger sheep: the pile still fills the hill without burying the message
    spawned = 0; sheep = []; fx = []; conf = [];
    t0 = last = performance.now(); acc = 0;
    raf = requestAnimationFrame(loop);
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const elT = (now - t0) / 1000;
    const want = Math.min(total, Math.floor(total * Math.pow(Math.min(1, elT / 5.2), 1.35)));
    while (spawned < want) addSheep();
    const shown = spawned >= total ? 2027 : NL + Math.floor((2027 - NL) * spawned / total);
    if (+nEl.dataset.v !== shown) { nEl.dataset.v = shown; nEl.textContent = shown.toLocaleString('ja-JP'); if (!RM && spawned % 4 === 0) numEl.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 140 }); }
    if (spawned >= total && !finished && elT > 5.6) finish();
    acc += Math.min(50, now - last); last = now;
    while (acc >= 1000 / 60) { M.Engine.update(eng, 1000 / 60); acc -= 1000 / 60; }
    draw(now);
  }
  function finish() {
    finished = true; n = 2027; bump(2027); SNDX.play('popper', { vol: .9 }); SNDX.sfx.fanfare(6);
    confetti(); shakeT = RM ? 0 : .5;
    paraEls[PARAS.length - 2].classList.add('gone');
    $$('.final', linesEl).forEach((e, ix) => setTimeout(() => e.classList.add('show'), 300 + ix * 500));
    setTimeout(() => sheep.forEach(b => { M.Sleeping.set(b, false); M.Body.setVelocity(b, { x: b.velocity.x + rand(-1.5, 1.5), y: rand(-6, -2) * (W > 700 ? 1.4 : 1) }); }), RM ? 0 : 900);
    setTimeout(() => { phase = 'done'; btn.disabled = false; btn.textContent = '最初から'; }, 1200);
  }
  function draw(now) {
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    let sx = 0, sy = 0;
    if (shakeT > 0) { shakeT -= 1 / 60; const m = 6 * shakeT * (W > 700 ? 2 : 1); sx = rand(-m, m); sy = rand(-m, m); }
    c.translate(sx, sy);
    sheep.forEach(b => {
      const sp = b.sprite, im = sp.im; if (!im.complete || !im.naturalWidth) return;
      const sw = b.r / SH.br, sh = sw * SH.ar;      // sprite size so the wool body matches the physics circle
      c.save(); c.translate(b.position.x, b.position.y); c.rotate(b.angle);
      c.drawImage(im, -SH.bx * sw, -SH.by * sh, sw, sh);
      if (sp.ch) {
        const fx = (SH.fx - SH.bx) * sw, fy = (SH.fy - SH.by) * sh, fr = SH.fr * sw;
        c.fillStyle = sp.col; c.beginPath(); c.arc(fx, fy, fr, 0, 7); c.fill(); c.lineWidth = Math.max(1, fr * .12); c.strokeStyle = '#fff'; c.stroke();
        c.fillStyle = '#fff'; c.font = `900 ${Math.round(fr * 1.1)}px "Noto Sans JP", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(sp.ch, fx, fy + fr * .05);
      }
      c.restore();
    });
    fx = fx.filter(f => (f.life -= f.type === 't' ? .018 : .03) > 0);
    fx.forEach(f => {
      if (f.type === 'p') { f.x += f.vx; f.y += f.vy; f.vy += .05; c.globalAlpha = f.life; c.fillStyle = '#fff'; c.beginPath(); c.arc(f.x, f.y, f.r * (1.4 - f.life * .4), 0, 7); c.fill(); }
      else { f.y += f.vy; c.globalAlpha = Math.min(1, f.life * 1.6); c.font = `900 ${W > 700 ? 22 : 13}px "Noto Sans JP", sans-serif`; c.fillStyle = '#FFD43B'; c.strokeStyle = 'rgba(10,19,48,.85)'; c.lineWidth = 3; c.textAlign = 'center'; c.strokeText(f.txt, f.x, f.y); c.fillText(f.txt, f.x, f.y); }
    });
    c.globalAlpha = 1;
    conf = conf.filter(p => p.y < H + 20);
    conf.forEach(p => {
      p.x += p.vx + Math.sin(now / 400 + p.a) * .4; p.y += p.vy; p.a += p.va;
      c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.scale(1, Math.abs(Math.cos(p.a * 1.7)) + .15);
      c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore();
    });
  }
  cv.addEventListener('pointerdown', e => {
    if (!eng) return;
    const p = local(cv, e), hit = M.Query.point(sheep, p);
    const list = hit.length ? hit : sheep.filter(b => Math.hypot(b.position.x - p.x, b.position.y - p.y) < b.r * 2.2);
    list.forEach(b => { M.Sleeping.set(b, false); M.Body.setVelocity(b, { x: (b.position.x - p.x) * .15 + rand(-1, 1), y: -rand(7, 11) * (W > 700 ? 1.4 : 1) }); M.Body.setAngularVelocity(b, rand(-.4, .4)); });
    if (list.length) { puff(p.x, p.y, 6); mee(p.x, p.y - 14); SNDX.play('boing', { vol: .6 }); }
  });
  new ResizeObserver(() => { if (!eng) return; geom(); buildStatics(); }).observe(cv);
  function stopRush() {
    cancelAnimationFrame(raf); raf = 0;
    if (eng) { M.World.clear(eng.world, false); M.Engine.clear(eng); }
    eng = null; sheep = []; statics = []; fx = []; conf = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    cv.classList.remove('on'); root.classList.remove('rushing');
  }
  function fallbackRush() {   // used only if the physics library failed to load
    phase = 'busy'; btn.disabled = true;
    let k = 0; const iv = setInterval(() => { spawn(1500, false); if (++k >= 18) clearInterval(iv); }, 160);
    const from = n, to = 2027, T = 3400, s0 = performance.now();
    const tick = t => {
      const p = Math.min(1, (t - s0) / T), e = 1 - Math.pow(1 - p, 3);
      nEl.textContent = Math.round(from + (to - from) * e).toLocaleString('ja-JP');
      if (p < 1) return requestAnimationFrame(tick);
      n = to; paraEls[PARAS.length - 2].classList.add('gone'); $$('.final', linesEl).forEach((x, ix) => setTimeout(() => x.classList.add('show'), ix * 500));
      phase = 'done'; btn.disabled = false; btn.textContent = '最初から';
    };
    requestAnimationFrame(tick);
  }
  function reset() {
    stopRush();
    n = 0; i = 0; phase = 'normal'; nEl.textContent = '0'; nEl.dataset.v = '0'; numEl.classList.remove('on'); hint.hidden = false;
    $$('p', linesEl).forEach(p => p.classList.remove('show')); paraEls.forEach(p => p.classList.remove('gone'));
    btn.textContent = 'ひつじを跳ばす';
  }
  // subtle cursor follower so people know the whole screen is tappable
  const cur = $('.c-cursor', root), curLbl = $('.c-cursor span', root);
  let cx = 0, cy = 0, tx = 0, ty = 0, curRaf = 0;
  const curLoop = () => { cx += (tx - cx) * .22; cy += (ty - cy) * .22; cur.style.transform = `translate(${cx}px,${cy}px)`; curRaf = Math.abs(tx - cx) + Math.abs(ty - cy) > .3 ? requestAnimationFrame(curLoop) : 0; };
  root.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const p = local(root, e); tx = p.x; ty = p.y;
    const off = e.target.closest('button, label, input') || phase === 'busy';
    cur.classList.toggle('on', !off); cur.classList.toggle('pile', phase === 'done');
    if (curLbl.textContent !== btn.textContent) curLbl.textContent = btn.textContent;
    if (!curRaf) curRaf = requestAnimationFrame(curLoop);
  });
  root.addEventListener('pointerleave', () => cur.classList.remove('on'));
  root.addEventListener('pointerdown', e => {
    if (e.target.closest('button, label, input')) return;
    const p = local(root, e);
    const rp = document.createElement('span'); rp.className = 'c-ripple'; rp.style.left = p.x + 'px'; rp.style.top = p.y + 'px'; root.appendChild(rp);
    rp.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: .7 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = () => rp.remove();
  });
  root.addEventListener('click', e => {
    if (e.target.closest('button, label, input')) return;
    if (phase === 'normal' || phase === 'rush') btn.click();
  });
  btn.addEventListener('click', () => {
    if (phase === 'done') return reset();
    if (phase === 'rush') return startRush();
    if (phase !== 'normal' || busy) return;
    busy = true; hint.hidden = true;
    const over = spawn(2600);
    setTimeout(() => {
      n++; bump(n);
      showLine(i); i++;
      busy = false;
      if (i === NL) { phase = 'rush'; btn.textContent = '残り2022匹を跳ばす'; }
    }, over);
  });
})();


})();
