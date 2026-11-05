/* ================= sound: effects + per-demo background music (shared by every demo) =================
   Effects and loops are Stable Audio 3 takes (assets/sfx → generated/sfx.js, bgm.js; base64 MP3). Nothing is decoded
   until sound is switched ON with any .js-snd button (one shared setting). Exposed as window.NENGA.snd. */
(() => {
window.NENGA = window.NENGA || {};
const SND = { on: false, ac: null, out: null, buf: {}, takes: {}, last: {}, loading: null };
const jit = (a, b) => a + Math.random() * (b - a);

function audio() {
  if (!SND.ac) {
    SND.ac = new (window.AudioContext || window.webkitAudioContext)();
    SND.out = SND.ac.createGain(); SND.out.gain.value = .7; SND.out.connect(SND.ac.destination);
  }
  if (SND.ac.state === 'suspended' && !document.hidden) SND.ac.resume();
  return SND.ac;
}
function decode(b64) {
  const ac = audio(), bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Promise(res => ac.decodeAudioData(u.buffer, b => {
    // skip MP3 encoder padding so hits land on the frame they are triggered
    const d = b.getChannelData(0); let i = 0; while (i < d.length && Math.abs(d[i]) < .004) i++;
    b._lead = Math.max(0, i / b.sampleRate - .002); res(b);
  }, () => res(null)));
}
function loadSfx() {
  if (SND.loading) return SND.loading;
  const src = window.NENGA_SFX || {};
  SND.loading = Promise.all(Object.keys(src).map(k => decode(src[k]).then(b => {
    if (!b) return;
    const base = k.split('~')[0];                       // "snip~2" is another take of "snip"
    (SND.takes[base] = SND.takes[base] || []).push(b);
    if (base === k) SND.buf[k] = b;
  })));
  return SND.loading;
}
// a random take, never the same one twice in a row
function take(name) {
  const t = SND.takes[name]; if (!t || !t.length) return null;
  if (t.length === 1) return t[0];
  let i; do i = Math.floor(Math.random() * t.length); while (i === SND.last[name]);
  SND.last[name] = i; return t[i];
}
/* play('name', { vol, rate, delay, offset, dur, exact })
   every play varies a little (take, ±4% pitch, −15% volume) unless exact: true (e.g. the rhythm metronome) */
function play(name, o = {}) {
  if (!SND.on) return false;
  const b = o.exact || o.offset != null ? SND.buf[name] : take(name); if (!b) return false;
  try {
    const ac = audio(), t = ac.currentTime + (o.delay || 0), s = ac.createBufferSource(), g = ac.createGain();
    const rate = (o.rate || 1) * (o.exact ? 1 : jit(.96, 1.04)), vol = (o.vol == null ? 1 : o.vol) * (o.exact ? 1 : jit(.85, 1));
    s.buffer = b; s.playbackRate.value = rate;
    g.gain.setValueAtTime(vol, t);
    if (o.dur) { g.gain.setValueAtTime(vol, t + o.dur * .7); g.gain.linearRampToValueAtTime(0, t + o.dur); }
    s.connect(g); g.connect(SND.out); s.start(t, b._lead + (o.offset || 0), o.dur ? o.dur * rate + .01 : undefined);
    return true;
  } catch (e) { return false; /* audio unavailable */ }
}
// short synthetic beep — kept for tiny UI blips
function tone(f, dur, type = 'square', vol = .05, slide = 1, delay = 0) {
  if (!SND.on) return;
  try {
    const ac = audio(), t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + .02);
  } catch (e) { /* audio unavailable */ }
}
const sfx = {
  tick: () => play('tick', { vol: .45 }),
  key: () => play('key', { vol: .5, rate: jit(.92, 1.1) }),
  thud: () => play('thud', { vol: .9 }),
  rattle: () => play('rattle', { vol: .7 }),
  crack: k => play('crack', { vol: .65 + k * .1, rate: .9 + k * .12 }),
  pop: () => play('pop', { vol: .9 }),
  whoosh: () => play('whoosh', { vol: .55 }),
  stamp: () => play('stamp', { vol: 1 }),
  fanfare: (n = 4) => play(n >= 5 ? 'fanfare_l' : 'fanfare_s', { vol: .55 }),
  chime: (o = {}) => play('chime', Object.assign({ vol: .55 }, o)),
  bleat: (o = {}) => play('bleat', Object.assign({ vol: .6, rate: jit(.95, 1.12) }, o)),
  postDrop: () => play('post_drop', { vol: .8 })
};
const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no haptics */ } };

/* ---- background music: the demo that fills most of the screen plays its loop; crossfades as you scroll ---- */
const BGM = { level: .32, duck: {}, buf: {}, cur: null, node: null, vis: {} };
function bgmGain(id) { return BGM.level * (BGM.duck[id] == null ? 1 : BGM.duck[id]); }
function bgmBuf(id) {
  if (!BGM.buf[id]) BGM.buf[id] = (window.NENGA_BGM && window.NENGA_BGM[id]) ? decode(window.NENGA_BGM[id]) : Promise.resolve(null);
  return BGM.buf[id];
}
function bgmTarget() {
  if (!SND.on || document.hidden) return null;
  let best = null, r = .3;
  Object.keys(BGM.vis).forEach(id => { if (BGM.vis[id] > r) { r = BGM.vis[id]; best = id; } });
  return best;
}
function bgmUpdate() {
  const id = bgmTarget(); if (id === BGM.cur) return;
  const ac = SND.ac; BGM.cur = id;
  if (BGM.node && ac) {   // fade the old loop out
    const n = BGM.node; n.g.gain.cancelScheduledValues(ac.currentTime); n.g.gain.setValueAtTime(n.g.gain.value, ac.currentTime);
    n.g.gain.linearRampToValueAtTime(0, ac.currentTime + .9); setTimeout(() => { try { n.s.stop(); } catch (e) { /* stopped */ } }, 1000);
    BGM.node = null;
  }
  if (!id) return;
  bgmBuf(id).then(b => {
    if (!b || BGM.cur !== id || BGM.node) return;
    const ac = audio(), s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = b; s.loop = true; s.loopStart = b._lead; s.loopEnd = b.duration;
    g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(bgmGain(id), ac.currentTime + 1.2);
    s.connect(g); g.connect(SND.out); s.start(ac.currentTime, b._lead);
    BGM.node = { s, g, id };
  });
}
// a demo can turn its music down (e.g. while the mochi rhythm game runs) — 1 = normal
function bgmDuck(id, k, sec = .5) {
  BGM.duck[id] = k;
  const n = BGM.node, ac = SND.ac;
  if (n && n.id === id && ac) { n.g.gain.cancelScheduledValues(ac.currentTime); n.g.gain.setValueAtTime(n.g.gain.value, ac.currentTime); n.g.gain.linearRampToValueAtTime(bgmGain(id), ac.currentTime + sec); }
}
function watch() {
  document.querySelectorAll('.js-snd').forEach(soundButton);   // demos without their own wiring (A, B, E, F, G)
  if (!window.IntersectionObserver) return;
  const io = new IntersectionObserver(es => { es.forEach(e => { BGM.vis[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0; }); bgmUpdate(); },
    { threshold: [0, .15, .3, .45, .6, .75, .9, 1] });
  Object.keys(window.NENGA_BGM || {}).forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
  document.addEventListener('visibilitychange', () => {
    if (!SND.ac) return;
    if (document.hidden) SND.ac.suspend(); else if (SND.on) SND.ac.resume();
    bgmUpdate();
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();

function setOn(on) {
  SND.on = on;
  document.querySelectorAll('.js-snd').forEach(b => b._sync && b._sync());
  if (on) { audio(); loadSfx().then(() => { sfx.chime(); bgmUpdate(); }); } else bgmUpdate();
}
function soundButton(btn) {
  if (!btn || btn._sync) return;
  const sync = () => { btn.textContent = SND.on ? 'サウンド ON' : 'サウンド OFF'; btn.setAttribute('aria-pressed', String(SND.on)); };
  btn._sync = sync; sync();
  btn.addEventListener('click', e => { e.stopPropagation(); setOn(!SND.on); });
  btn.addEventListener('pointerdown', e => e.stopPropagation());
}
window.NENGA.snd = { SND, play, tone, sfx, soundButton, buzz, loadSfx, bgmDuck, setOn };
})();
