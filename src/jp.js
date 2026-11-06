/* ================= 和のデモ I〜J: fukuwarai / mochitsuki (H omikuji lives in omikuji.js) ================= */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wait = ms => new Promise(r => setTimeout(r, ms));
// shared sound helpers from the 3D script (fallback: silent)
const FX = (window.NENGA && window.NENGA.fx) || (() => {
  const SND = { on: false }; const tone = () => {}; const noop = () => {};
  return { SND, tone, sfx: new Proxy({}, { get: () => noop }), buzz: noop, popEl: noop, shakeEl: noop,
    soundButton(b) { if (b) b.hidden = true; } };
})();
const { sfx, buzz, popEl, shakeEl } = FX, play = FX.play || (() => false);
const isPC = () => window.NENGA && window.NENGA.isPC && window.NENGA.isPC();
// unscaled scale factor of a demo screen (PC mode scales the 1280×760 viewport down)
const kOf = root => root.clientWidth / (root.getBoundingClientRect().width || 1);
function localPt(root, e) { const r = root.getBoundingClientRect(), k = root.clientWidth / (r.width || 1); return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }; }
function rectIn(root, el) { const r = root.getBoundingClientRect(), b = el.getBoundingClientRect(), k = root.clientWidth / (r.width || 1); return { x: (b.left - r.left) * k, y: (b.top - r.top) * k, w: b.width * k, h: b.height * k }; }
// run a rAF loop only while the element is on screen
function onScreenLoop(el, step) {
  let vis = false, raf = 0, last = 0;
  const loop = t => { const dt = Math.min(.05, (t - (last || t)) / 1000); last = t; step(dt, t / 1000); if (vis) raf = requestAnimationFrame(loop); };
  new IntersectionObserver(es => es.forEach(e => { vis = e.isIntersecting; if (vis && !raf) { last = 0; raf = requestAnimationFrame(loop); } if (!vis) { cancelAnimationFrame(raf); raf = 0; } }), { rootMargin: '80px' }).observe(el);
}
const KNUM = n => { const d = '〇一二三四五六七八九'; if (n < 10) return d[n]; const t = Math.floor(n / 10), o = n % 10; return (t > 1 ? d[t] : '') + '十' + (o ? d[o] : ''); };
const CEO_SHORT = '2027年は未（ひつじ）年。「未」は「未来」の「未」です。まだ誰も見たことのない体験を、皆さまと一緒に。本年も"ひつじょう"に、よろしくお願いいたします。';
const SIG = 'bravesoft株式会社 代表取締役 〇〇 〇〇';

/* ================= I: ひつじ福笑い ================= */
(() => {
  const root = $('#fuku'); if (!root) return;
  const board = $('.fk-board', root), face = $('.fk-face', root), tray = $('.fk-tray', root), act = $('.js-act', root), hint = $('.fk-hint', root);
  const bubble = $('.fk-bubble', root), result = $('.fk-result', root);
  FX.soundButton($('.js-snd', root));
  // the illustration (head + parts) comes from the user's sprite sheet via tools/fuku_art.py → window.NENGA_FUKU.
  // Everything is in sheet units: H = the head's box; each part's target = where its centre belongs on the head.
  const ART = window.NENGA_FUKU, H = ART.head.box;
  face.innerHTML = `<svg viewBox="${H.join(' ')}" aria-hidden="true">${ART.head.svg}</svg>`;
  const TARGET = { eyeL: ['左目', 560, 480], eyeR: ['右目', 725, 480], nose: ['鼻', 642, 545], mouth: ['口', 642, 615], earL: ['左耳', 363, 485], earR: ['右耳', 920, 485] };
  const PARTS = Object.keys(TARGET).map(id => { const b = ART[id].box, [name, tx, ty] = TARGET[id];
    return { id, name, w: b[2], h: b[3], tx, ty, tr: 0, svg: `<svg viewBox="${b.join(' ')}">${ART[id].svg}</svg>` }; });
  let state = 'start', hidden = { dx: 0, dy: 0, s: 1, r: 0 };
  const els = PARTS.map(p => {
    const el = document.createElement('div'); el.className = 'fk-part home'; el.innerHTML = p.svg; el.setAttribute('aria-label', p.name);
    root.appendChild(el); return { p, el, x: 0, y: 0, rot: 0, placed: false };
  });
  // geometry in screen-local px
  // face position from its layout box (offsets ignore the hidden nudge transform); u = screen px per sheet unit
  const faceBox = () => { const b = rectIn(root, board), fw = face.offsetWidth; return { bx: b.x, by: b.y, bw: b.w, bh: b.h, fx: b.x + face.offsetLeft, fy: b.y + face.offsetTop, fw, fh: fw * H[3] / H[2], u: fw / H[2] }; };
  function place(o, x, y, rot) { o.x = x; o.y = y; o.rot = rot; const g = faceBox(); const w = o.p.w * g.u, h = o.p.h * g.u; Object.assign(o.el.style, { width: w + 'px', height: h + 'px', left: (x - w / 2) + 'px', top: (y - h / 2) + 'px', transform: `rotate(${rot}deg)` }); }
  function homeSlots() {
    const t = rectIn(root, tray), n = els.length, pc = t.w < t.h;
    els.forEach((o, i) => {
      if (o.placed) return;
      const cols = pc ? 2 : 3, rows = Math.ceil(n / cols), c = i % cols, r = Math.floor(i / cols);
      const cw = t.w / cols, ch = (t.h - 14) / rows;
      place(o, t.x + cw * (c + .5), t.y + 14 + ch * (r + .5), 0);
      // in the dock the whole grid cell is the touch area (the eyes alone are tiny); see .fk-part.home::before
      const w = parseFloat(o.el.style.width), h = parseFloat(o.el.style.height);
      o.el.style.setProperty('--hx', Math.max(0, (cw - w) / 2 - 2) + 'px'); o.el.style.setProperty('--hy', Math.max(0, (ch - h) / 2 - 2) + 'px');
    });
  }
  function layout() {
    homeSlots();
    if (root.classList.contains('fk-fin')) return;   // placed parts ride inside the board then
    els.forEach(o => { if (o.placed) place(o, o.fxN * faceBox().bw + faceBox().bx, o.fyN * faceBox().bh + faceBox().by, o.rot); });
  }
  new ResizeObserver(layout).observe(root);
  window.addEventListener('nenga:mode', () => setTimeout(layout, 50));
  setTimeout(layout, 60);
  const setHint = t => { hint.textContent = t; };
  function blindfold() {
    state = 'blind'; board.classList.remove('reveal'); board.classList.add('blind');
    face.classList.remove('laugh'); result.hidden = true; bubble.classList.remove('show');
    sfx.whoosh();
    // once the cloth is down, nudge the hidden face so you can't rely on memory
    setTimeout(() => { hidden = { dx: rand(-.1, .1), dy: rand(-.07, .08), s: rand(.86, 1.08), r: rand(-8, 8) }; face.style.transform = `translate(${hidden.dx * 100}%,${hidden.dy * 100}%) scale(${hidden.s}) rotate(${hidden.r}deg)`; }, 650);
    act.textContent = '目かくしをとる'; act.disabled = true;
    setHint('手ぬぐいの上に、目・鼻・口・耳を置いてください');
  }
  function placedCount() { return els.filter(o => o.placed).length; }
  // dragging parts
  els.forEach(o => {
    o.el.addEventListener('pointerdown', e => {
      if (state === 'done') return;
      if (state === 'start') blindfold();
      e.preventDefault(); o.el.setPointerCapture(e.pointerId); o.el.classList.add('drag'); o.el.classList.remove('home', 'blind');
      const p = localPt(root, e); o.drag = { ox: o.x - p.x, oy: o.y - p.y };
      sfx.tick();
    });
    o.el.addEventListener('pointermove', e => { if (!o.drag) return; const p = localPt(root, e); place(o, p.x + o.drag.ox, p.y + o.drag.oy, o.rot); });
    const up = () => {
      if (!o.drag) return; o.drag = null; o.el.classList.remove('drag');
      const g = faceBox();
      const inside = o.x > g.bx && o.x < g.bx + g.bw && o.y > g.by && o.y < g.by + g.bh;
      if (inside && state === 'blind') {
        // the hand slips a little — that's the fun of it
        const slip = g.fw * .022;
        const nx = clamp(o.x + rand(-slip, slip), g.bx + 8, g.bx + g.bw - 8), ny = clamp(o.y + rand(-slip, slip), g.by + 8, g.by + g.bh - 8);
        o.placed = true; o.fxN = (nx - g.bx) / g.bw; o.fyN = (ny - g.by) / g.bh;
        o.el.style.transition = 'left .25s ease-out, top .25s ease-out, transform .25s ease-out';
        place(o, nx, ny, o.p.tr + rand(-9, 9));
        setTimeout(() => { o.el.style.transition = ''; }, 260);
        o.el.classList.add('placed', 'blind');
        play('stamp', { vol: .45, rate: .95 + placedCount() * .06 }); buzz(10);
        const left = PARTS.length - placedCount();
        act.disabled = false;
        setHint(left ? `あと${left}つ。置けたら「目かくしをとる」` : 'ぜんぶ置けました。「目かくしをとる」でごたいめん！');
        if (!left) popEl(act, 1.12);
      } else {
        o.placed = false; o.el.classList.remove('placed'); o.el.classList.add('home'); homeSlots();
      }
    };
    o.el.addEventListener('pointerup', up); o.el.addEventListener('pointercancel', up);
  });
  function reveal() {
    state = 'done'; board.classList.remove('blind'); board.classList.add('reveal');
    els.forEach(o => o.el.classList.remove('blind'));
    sfx.whoosh();
    // score: distance of each placed part to its target, in face units (taking the hidden nudge into account)
    const g = faceBox(); let err = 0, n = 0;
    const cx = g.fx + g.fw / 2, cy = g.fy + g.fh / 2, ang = -hidden.r * Math.PI / 180;
    els.forEach(o => {
      if (!o.placed) { err += .5; n++; return; }
      let x = o.x - cx - hidden.dx * g.fw, y = o.y - cy - hidden.dy * g.fh;
      const xr = x * Math.cos(ang) - y * Math.sin(ang), yr = x * Math.sin(ang) + y * Math.cos(ang);
      const fx = xr / (g.u * hidden.s) + H[0] + H[2] / 2, fy = yr / (g.u * hidden.s) + H[1] + H[3] / 2;
      err += Math.hypot(fx - o.p.tx, fy - o.p.ty) / H[2]; n++;
    });
    const avg = err / n;
    const R = avg < .07 ? { k: '名人級', s: 'そっくりなひつじになりました', c: '#0066FF' } : avg < .15 ? { k: '福々しい', s: 'なかなか、いい顔です', c: '#D9332B' } : { k: '大わらい', s: 'これは…福がきました', c: '#D9332B' };
    setTimeout(() => {
      face.classList.add('laugh'); bubble.classList.add('show'); sfx.fanfare(4); buzz(40);
      sfx.bleat && sfx.bleat();
      setHint(`そっくり度 ${Math.max(3, Math.round(100 - avg * 320))}%`);
    }, 650);
    setTimeout(() => {
      bubble.classList.remove('show');
      result.innerHTML = `<div class="rk"><b class="brushf" style="color:${R.c}">${R.k}</b><span>FUKUWARAI RESULT</span></div>
        <div class="kw">笑う門には、福来たる。</div>
        <p>${R.s}。あけましておめでとうございます。2027年は未年、「未来」の年。今年もbravesoftは、皆さまと一緒に笑える、オモシロい体験をつくっていきます。</p>
        <span class="sig">${SIG}</span>`;
      fin();
      result.hidden = false;
      if (!RM) result.animate([{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,1.2,.4,1)' });
      act.textContent = 'もう一回あそぶ';
    }, 2400);
    act.textContent = '…'; act.disabled = true; setTimeout(() => { act.disabled = false; }, 2400);
  }
  // result layout: move the placed parts into the board so they travel with it as it shrinks aside
  function fin() {
    const b = rectIn(root, board);
    els.forEach(o => { if (!o.placed) return;
      o.el.style.left = (parseFloat(o.el.style.left) - b.x) + 'px'; o.el.style.top = (parseFloat(o.el.style.top) - b.y) + 'px'; board.appendChild(o.el); });
    root.classList.add('fk-fin');
  }
  function unfin() {
    if (!root.classList.contains('fk-fin')) return;
    root.classList.remove('fk-fin');
    els.forEach(o => { if (o.el.parentNode !== root) root.appendChild(o.el); });
  }
  function again() {
    unfin();
    result.hidden = true; face.classList.remove('laugh'); face.style.transform = '';
    els.forEach(o => { o.placed = false; o.el.classList.remove('placed', 'blind'); o.el.classList.add('home'); });
    homeSlots(); board.classList.remove('reveal'); state = 'start';
    act.textContent = '目かくしをする'; setHint('目かくしをして、顔のパーツを置いてください');
  }
  act.addEventListener('click', () => {
    if (state === 'start') blindfold();
    else if (state === 'blind') { if (placedCount()) reveal(); }
    else if (state === 'done') again();
  });
})();


})();
