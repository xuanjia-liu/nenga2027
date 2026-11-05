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
const { tone, sfx, buzz, popEl, shakeEl } = FX;
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
  const INKC = '#161717';
  // parts in face-SVG units (200 × 220 face); target = where they belong
  const PARTS = [
    { id: 'eyeL', name: '左目', w: 22, h: 28, tx: 76, ty: 118, tr: 0, svg: `<svg viewBox="0 0 22 28"><ellipse cx="11" cy="14" rx="10" ry="13" fill="${INKC}"/><circle cx="14" cy="9" r="3.5" fill="#fff"/></svg>` },
    { id: 'eyeR', name: '右目', w: 22, h: 28, tx: 124, ty: 118, tr: 0, svg: `<svg viewBox="0 0 22 28"><ellipse cx="11" cy="14" rx="10" ry="13" fill="${INKC}"/><circle cx="14" cy="9" r="3.5" fill="#fff"/></svg>` },
    { id: 'nose', name: '鼻', w: 30, h: 22, tx: 100, ty: 152, tr: 0, svg: `<svg viewBox="0 0 30 22"><path d="M3 4 Q15 -1 27 4 Q24 14 15 19 Q6 14 3 4Z" fill="#F08C97" stroke="${INKC}" stroke-width="2"/></svg>` },
    { id: 'mouth', name: '口', w: 40, h: 18, tx: 100, ty: 178, tr: 0, svg: `<svg viewBox="0 0 40 18"><path d="M3 4 Q11 15 20 6 Q29 15 37 4" fill="none" stroke="${INKC}" stroke-width="3.2" stroke-linecap="round"/></svg>` },
    { id: 'earL', name: '左耳', w: 54, h: 24, tx: 30, ty: 104, tr: -25, svg: `<svg viewBox="0 0 54 24"><path d="M52 12 Q30 -2 4 8 Q-1 12 4 16 Q30 26 52 12Z" fill="${INKC}"/><path d="M44 12 Q28 4 10 10 Q8 12 10 14 Q28 20 44 12Z" fill="#F7A9B4"/></svg>` },
    { id: 'earR', name: '右耳', w: 54, h: 24, tx: 170, ty: 104, tr: 25, svg: `<svg viewBox="0 0 54 24"><path d="M2 12 Q24 -2 50 8 Q55 12 50 16 Q24 26 2 12Z" fill="${INKC}"/><path d="M10 12 Q26 4 44 10 Q46 12 44 14 Q26 20 10 12Z" fill="#F7A9B4"/></svg>` }
  ];
  let state = 'start', hidden = { dx: 0, dy: 0, s: 1, r: 0 };
  const els = PARTS.map(p => {
    const el = document.createElement('div'); el.className = 'fk-part home'; el.innerHTML = p.svg; el.setAttribute('aria-label', p.name);
    root.appendChild(el); return { p, el, x: 0, y: 0, rot: 0, placed: false };
  });
  // geometry in screen-local px
  const faceBox = () => { const b = rectIn(root, board); const fw = b.w * .84; return { bx: b.x, by: b.y, bw: b.w, bh: b.h, fx: b.x + b.w * .08, fy: b.y + b.h * .06, fw, u: fw / 200 }; };
  function place(o, x, y, rot) { o.x = x; o.y = y; o.rot = rot; const g = faceBox(); const w = o.p.w * g.u * 1.12, h = o.p.h * g.u * 1.12; Object.assign(o.el.style, { width: w + 'px', height: h + 'px', left: (x - w / 2) + 'px', top: (y - h / 2) + 'px', transform: `rotate(${rot}deg)` }); }
  function homeSlots() {
    const t = rectIn(root, tray), n = els.length, pc = t.w < t.h;
    els.forEach((o, i) => {
      if (o.placed) return;
      const cols = pc ? 2 : 3, rows = Math.ceil(n / cols), c = i % cols, r = Math.floor(i / cols);
      place(o, t.x + t.w * (c + .5) / cols, t.y + 14 + (t.h - 14) * (r + .5) / rows, 0);
    });
  }
  function layout() {
    homeSlots();
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
        const slip = g.fw * .05;
        const nx = clamp(o.x + rand(-slip, slip), g.bx + 8, g.bx + g.bw - 8), ny = clamp(o.y + rand(-slip, slip), g.by + 8, g.by + g.bh - 8);
        o.placed = true; o.fxN = (nx - g.bx) / g.bw; o.fyN = (ny - g.by) / g.bh;
        o.el.style.transition = 'left .25s ease-out, top .25s ease-out, transform .25s ease-out';
        place(o, nx, ny, o.p.tr + rand(-22, 22));
        setTimeout(() => { o.el.style.transition = ''; }, 260);
        o.el.classList.add('placed', 'blind');
        tone(500 + placedCount() * 80, .07, 'triangle', .05); buzz(10);
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
    const cx = g.fx + g.fw / 2, cy = g.fy + g.fw * 1.1 / 2, ang = -hidden.r * Math.PI / 180;
    els.forEach(o => {
      if (!o.placed) { err += .5; n++; return; }
      let x = o.x - cx - hidden.dx * g.fw, y = o.y - cy - hidden.dy * g.fw * 1.1;
      const xr = x * Math.cos(ang) - y * Math.sin(ang), yr = x * Math.sin(ang) + y * Math.cos(ang);
      const fx = xr / (g.u * hidden.s) + 100, fy = yr / (g.u * hidden.s) + 110;
      err += Math.hypot(fx - o.p.tx, fy - o.p.ty) / 200; n++;
    });
    const avg = err / n;
    const R = avg < .07 ? { k: '名人級', s: 'そっくりなひつじになりました', c: '#0066FF' } : avg < .15 ? { k: '福々しい', s: 'なかなか、いい顔です', c: '#D9332B' } : { k: '大わらい', s: 'これは…福がきました', c: '#D9332B' };
    setTimeout(() => {
      face.classList.add('laugh'); bubble.classList.add('show'); sfx.fanfare(4); buzz(40);
      if (FX.SND.on) [0, .14, .28].forEach(d => tone(620, .12, 'triangle', .05, .7, d));
      setHint(`そっくり度 ${Math.max(3, Math.round(100 - avg * 320))}%`);
    }, 650);
    setTimeout(() => {
      bubble.classList.remove('show');
      result.innerHTML = `<div class="rk"><b class="brushf" style="color:${R.c}">${R.k}</b><span>FUKUWARAI RESULT</span></div>
        <div class="kw">笑う門には、福来たる。</div>
        <p>${R.s}。あけましておめでとうございます。2027年は未年、「未来」の年。今年もbravesoftは、皆さまと一緒に笑える、オモシロい体験をつくっていきます。</p>
        <span class="sig">${SIG}</span>`;
      result.hidden = false;
      if (!RM) result.animate([{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,1.2,.4,1)' });
      act.textContent = 'もう一回あそぶ';
    }, 2400);
    act.textContent = '…'; act.disabled = true; setTimeout(() => { act.disabled = false; }, 2400);
  }
  function again() {
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
