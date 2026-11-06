(() => {
const T = window.THREE;
const $ = (s, r = document) => r.querySelector(s);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPC = () => window.NENGA && window.NENGA.isPC && window.NENGA.isPC();
const fallback = root => {
  const d = document.createElement('div'); d.className = 'gl-fallback';
  d.textContent = 'この環境では3D表示ができません。本番では静止画を代わりに表示します。';
  root.appendChild(d);
};
if (!T) { document.querySelectorAll('.s-3d').forEach(fallback); return; }

const C = { blue: 0x0066FF, sky: 0x3F9CFF, soft: 0xE5F0FF, ink: 0x161717, navy: 0x253A58, yellow: 0xFFE94A, strong: 0x2247FF };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const JP = '"Noto Sans JP","Hiragino Sans","Yu Gothic",sans-serif';
const MONO = '"Roboto Mono",ui-monospace,Menlo,monospace';

/* ---------- device motion: tilt + shake (phones / tablets) ----------
   NENGA.motion.on becomes true once real sensor data arrives (Android: right away; iOS: after the permission prompt,
   which request() opens — it must run inside a tap, so stage() calls it on the first tap on a 3D demo).
   g      gravity in screen coordinates (x right, y up, z out of the screen; unit length), smoothed
   roll   left/right tilt in radians (0 = level, + = right edge down)
   pitch  front/back tilt relative to how the phone has been held for the last few seconds (+ = top edge toward the user)
   droll  roll relative to that same slowly adapting baseline (for parallax)
   shakes / shakeT / shakePow / shakeDir   the latest jerk: a counter, its time (performance.now), 0.3–1 strength,
          screen-space direction. Demos poll these in frame() (which only runs while the demo is on screen). */
const motion = (() => {
  const M = { on: false, asked: false, g: { x: 0, y: -1, z: 0 }, roll: 0, pitch: 0, droll: 0, shakes: 0, shakeT: -1e9, shakePow: 0, shakeDir: { x: 0, y: 0 } };
  const D = Math.PI / 180, wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  let lastO = 0, baseR = 0, baseP = 0, lp = null, lastShake = 0;
  const hinted = new Set();
  // device axes → screen axes for the current screen rotation (landscape = device turned counter-clockwise)
  const toScreen = (x, y) => {
    const deg = screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : (window.orientation || 0);
    const a = deg * D, c = Math.cos(a), sn = Math.sin(a); return [x * c - y * sn, x * sn + y * c];
  };
  window.addEventListener('deviceorientation', e => {
    if (e.beta == null || e.gamma == null) return;
    const now = performance.now(), dt = lastO ? Math.min(.5, (now - lastO) / 1000) : 0; lastO = now;
    const b = e.beta * D, gm = e.gamma * D;
    const [x, y] = toScreen(Math.sin(gm) * Math.cos(b), -Math.sin(b)), z = -Math.cos(gm) * Math.cos(b);
    const first = !M.on, k = first ? 1 : 1 - Math.exp(-dt / .06);
    M.g.x += (x - M.g.x) * k; M.g.y += (y - M.g.y) * k; M.g.z += (z - M.g.z) * k;
    const roll = Math.asin(clamp(M.g.x, -1, 1)), p = Math.atan2(M.g.z, -M.g.y);
    if (first) { baseR = roll; baseP = p; M.on = true; window.dispatchEvent(new Event('nenga:motion')); }
    const kb = 1 - Math.exp(-dt / 3);
    baseR += (roll - baseR) * kb; baseP = wrap(baseP + wrap(p - baseP) * kb);
    M.roll = roll; M.droll = roll - baseR; M.pitch = clamp(wrap(p - baseP), -1, 1);
  });
  window.addEventListener('devicemotion', e => {
    let ax, ay, az; const a = e.acceleration;
    if (a && a.x != null) { ax = a.x; ay = a.y; az = a.z; }
    else {                                                       // no linear acceleration: high-pass the raw sensor
      const g = e.accelerationIncludingGravity; if (!g || g.x == null) return;
      if (!lp) lp = { x: g.x, y: g.y, z: g.z };
      lp.x += (g.x - lp.x) * .1; lp.y += (g.y - lp.y) * .1; lp.z += (g.z - lp.z) * .1;
      ax = g.x - lp.x; ay = g.y - lp.y; az = g.z - lp.z;
    }
    const m = Math.hypot(ax, ay, az), now = performance.now();
    if (m > 13 && now - lastShake > 260) {
      lastShake = now; M.shakes++; M.shakeT = now; M.shakePow = clamp((m - 9) / 18, .3, 1);
      const [sx, sy] = toScreen(ax, ay), l = Math.hypot(sx, sy) || 1; M.shakeDir = { x: sx / l, y: sy / l };
    }
  });
  // iOS 13+: ask once, from inside a tap. Retry on the next tap if the call itself failed (no tap / not allowed here).
  M.request = () => {
    if (M.asked || M.on) return;
    const DM = window.DeviceMotionEvent, DO = window.DeviceOrientationEvent;
    const asks = [DM, DO].filter(o => o && typeof o.requestPermission === 'function');
    M.asked = true; if (!asks.length) return;
    Promise.all(asks.map(o => o.requestPermission())).catch(() => { M.asked = false; });
  };
  // a shake that happened just now (so a demo coming on screen does not react to an old one)
  M.fresh = seen => M.shakes !== seen && performance.now() - M.shakeT < 250;
  // a short hint the first time each demo with tilt / shake reactions is on screen with the sensors on
  M.hint = txt => {
    if (hinted.has(txt)) return; hinted.add(txt);
    document.querySelectorAll('.mo-toast').forEach(t => t.remove());
    const el = document.createElement('div'); el.className = 'mo-toast'; el.textContent = txt;
    (document.querySelector('.sp-bar') || document.body).appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200); setTimeout(() => el.remove(), 3800);
  };
  return M;
})();
window.NENGA = window.NENGA || {};
window.NENGA.motion = motion;

// gyro parallax: before a frame is drawn the camera orbits a few degrees around the point it looks at, following the
// tilt; it is put back right after, so the demos' own camera logic and picking never see it
const GP = { pos: new T.Vector3(), q: new T.Quaternion(), f: new T.Vector3(), tg: new T.Vector3(), ax: new T.Vector3(), q1: new T.Quaternion(), q2: new T.Quaternion(), v: new T.Vector3() };
function gyroCam(cam, amt) {
  const yaw = clamp(-motion.droll * .45, -.12, .12) * amt, pit = clamp(-motion.pitch * .3, -.09, .09) * amt;
  if (Math.abs(yaw) + Math.abs(pit) < 2e-4) return false;
  GP.pos.copy(cam.position); GP.q.copy(cam.quaternion);
  GP.f.set(0, 0, -1).applyQuaternion(cam.quaternion);
  let d = -cam.position.dot(GP.f); if (!(d > .5)) d = 8;            // pivot: the point on the view line nearest the origin
  GP.tg.copy(cam.position).addScaledVector(GP.f, d);
  GP.q1.setFromAxisAngle(GP.ax.set(0, 1, 0).applyQuaternion(cam.quaternion), yaw);
  GP.q2.setFromAxisAngle(GP.ax.set(1, 0, 0).applyQuaternion(cam.quaternion), pit); GP.q1.multiply(GP.q2);
  GP.v.copy(cam.position).sub(GP.tg).applyQuaternion(GP.q1); cam.position.copy(GP.tg).add(GP.v);
  cam.quaternion.premultiply(GP.q1); cam.updateMatrixWorld();
  return true;
}

/* ---------- render-loop harness (runs only while visible) ---------- */
function stage(sel, setup) {
  const root = $(sel), canvas = $('canvas.gl', root);
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch (e) { fallback(root); return; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  const ctx = setup(root, renderer, canvas);
  // iOS only lets a page read the motion sensors after a prompt that has to come from a tap
  // (not on the mochi game: a prompt over its first beat would wreck the timing; it gets the sensors once another demo asked)
  if (root.id !== 'mochi') ['touchend', 'click'].forEach(ev => root.addEventListener(ev, motion.request, { passive: true }));
  let w = 0, h = 0, visible = false, raf = 0, last = performance.now();
  const resize = force => {
    const nw = root.clientWidth, nh = root.clientHeight;
    if (!nw || !nh || (!force && nw === w && nh === h)) return;
    w = nw; h = nh; renderer.setSize(w, h, false); ctx.resize(w, h);
  };
  const render = () => renderer.render(ctx.scene, ctx.camera);
  const loop = t => {
    raf = 0; if (!visible) return;
    resize();
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    ctx.frame(dt, t / 1000);
    const cam = ctx.camera, tilted = motion.on && ctx.gyro !== 0 && gyroCam(cam, ctx.gyro == null ? 1 : ctx.gyro);
    render();
    if (tilted) { cam.position.copy(GP.pos); cam.quaternion.copy(GP.q); cam.updateMatrixWorld(); }
    raf = requestAnimationFrame(loop);
  };
  new IntersectionObserver(es => {
    visible = es[es.length - 1].isIntersecting;
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }, { rootMargin: '100px' }).observe(root);
  new ResizeObserver(() => { resize(); if (!visible) { ctx.frame(0, performance.now() / 1000); render(); } }).observe(root);
  window.addEventListener('nenga:mode', () => { resize(true); if (ctx.onMode) ctx.onMode(); });
  resize(true); ctx.frame(0, 0); render();
}

/* ---------- procedural sheep ---------- */
const woolGeo = new T.IcosahedronGeometry(1, 1);
const ballGeo = new T.SphereGeometry(1, 18, 12);
const legGeo = new T.CylinderGeometry(.075, .06, .5, 8);
const woolMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .95, flatShading: true });
const inkMat = new T.MeshStandardMaterial({ color: C.ink, roughness: .6 });
const eyeMat = new T.MeshBasicMaterial({ color: 0xffffff });
// parts: [x,y,z,sx,sy,sz]; sheep faces +x
const P_WOOL = [[0, .82, 0, .7, .56, .54], [-.42, .86, 0, .44, .44, .44], [.3, .94, .18, .42, .42, .42], [.3, .94, -.18, .42, .42, .42], [-.08, 1.1, 0, .42, .4, .42], [0, .76, .32, .4, .4, .36], [0, .76, -.32, .4, .4, .36], [.74, 1.3, 0, .17, .15, .17]];
const P_INK = [[.74, 1.0, 0, .26, .32, .24], [.66, 1.14, .27, .16, .06, .1], [.66, 1.14, -.27, .16, .06, .1]];
const P_LEG = [[.3, .26, .2], [.3, .26, -.2], [-.3, .26, .2], [-.3, .26, -.2]];
const woolSmoothGeo = new T.SphereGeometry(1, 18, 12);
const woolSmoothMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .9 });
// smooth fleece: a solid core covered by many small, evenly spread curls (Fibonacci sphere), plus a tuft on the head
const P_WOOL_SMOOTH = (() => {
  const L = [[-.02, .84, 0, .6, .44, .46]], N = 96, ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i + .5) / N * 2, r = Math.sqrt(1 - y * y), a = i * ga;
    const nx = Math.cos(a) * r, nz = Math.sin(a) * r;
    if (y < -.72) continue;                                        // leave the belly flat where the legs attach
    const px = -.02 + nx * .62, py = .84 + y * .46, pz = nz * .48;
    if (px > .45 && Math.abs(pz) < .3 && py > .78 && py < 1.2) continue;   // keep the face clear
    const s = .13 + ((i * 37) % 11) / 11 * .05;
    L.push([px, py, pz, s, s * .95, s]);
  }
  [[.7, 1.3, 0, .1], [.64, 1.27, .08, .08], [.64, 1.27, -.08, .08], [.76, 1.25, 0, .08]].forEach(([x, y, z, r]) => L.push([x, y, z, r, r * .9, r]));
  return L;
})();
function makeSheep(o = {}) {
  const g = new T.Group();
  const add = (geo, mat, p) => { const m = new T.Mesh(geo, mat); m.position.set(p[0], p[1], p[2]); if (p.length > 3) m.scale.set(p[3], p[4], p[5]); m.castShadow = true; g.add(m); return m; };
  (o.smooth ? P_WOOL_SMOOTH : P_WOOL).forEach(p => add(o.smooth ? woolSmoothGeo : woolGeo, o.smooth ? woolSmoothMat : woolMat, p));
  P_INK.forEach(p => add(ballGeo, inkMat, p));
  // legs hang from the hip: each leg mesh sits inside a pivot group placed at the top of the leg
  g.legs = P_LEG.map(p => { const hip = new T.Group(); hip.position.set(p[0], p[1] + .25, p[2]); const m = new T.Mesh(legGeo, inkMat); m.position.y = -.25; m.castShadow = true; hip.add(m); g.add(hip); return hip; });
  [[.97, 1.04, .1], [.97, 1.04, -.1]].forEach(p => add(ballGeo, eyeMat, [...p, .04, .04, .04]));
  return g;
}
const partMatrices = list => list.map(p => new T.Matrix4().compose(new T.Vector3(p[0], p[1], p[2]), new T.Quaternion(), new T.Vector3(p[3] || 1, p[4] || 1, p[5] || 1)));

/* ---------- canvas textures ---------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new T.CanvasTexture(c); t.anisotropy = 4; t._redraw = () => { g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; };
  return t;
}
function wrapJP(g, text, maxW) {
  const out = []; let line = '';
  for (const ch of text) {
    if (ch === '\n') { out.push(line); line = ''; continue; }
    if (g.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; } else line += ch;
  }
  if (line) out.push(line);
  return out;
}
function drawSheep2D(g, x, y, s, wool = '#fff', face = '#161717') {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = face; [[-22, 18], [-8, 20], [10, 20], [24, 18]].forEach(([lx]) => g.fillRect(lx, 14, 6, 22));
  g.fillStyle = wool;
  [[-26, 0, 16], [-12, -12, 18], [8, -14, 18], [24, -4, 16], [24, 12, 15], [6, 18, 16], [-14, 16, 16], [0, 2, 24]].forEach(([cx, cy, r]) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); });
  g.fillStyle = face; g.beginPath(); g.ellipse(44, -4, 14, 17, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(40, -6, 2.4, 0, 7); g.arc(49, -6, 2.4, 0, 7); g.fill();
  g.restore();
}
// same artwork as the card maker's sheep (sheepSVG in app.js, viewBox 124x92), drawn on canvas; x,y = top-left
function drawSheepCard(g, x, y, s) {
  const ink = '#161717';
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = ink;
  [[34, 60, 27], [48, 62, 25], [68, 62, 25], [82, 60, 27]].forEach(([lx, ly, lh]) => { g.beginPath(); if (g.roundRect) g.roundRect(lx, ly, 7, lh, 3); else g.rect(lx, ly, 7, lh); g.fill(); });
  g.fillStyle = '#fff'; g.strokeStyle = '#D3DDEE'; g.lineWidth = 1.5;
  [[30, 46, 14], [44, 31, 16], [64, 27, 17], [82, 35, 14], [84, 54, 14], [64, 62, 15], [42, 60, 15]].forEach(([cx, cy, r]) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.stroke(); });
  g.beginPath(); g.arc(58, 46, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = ink;
  g.beginPath(); g.ellipse(86, 33, 8, 3.6, -25 * Math.PI / 180, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(112, 33, 8, 3.6, 25 * Math.PI / 180, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(99, 43, 14, 17, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(99, 26, 7.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(94, 38, 2.4, 0, Math.PI * 2); g.arc(104, 38, 2.4, 0, Math.PI * 2); g.fill();
  g.restore();
}
const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();

/* ---------- realistic snowflakes ----------
   A 4x4 atlas of hand-drawn six-fold ice crystals (12 designs) and soft clumped flakes (4 designs).
   A small shader gives every flake its own size, design, spin and a gentle twinkle. */
let _seed = 7; const rnd = () => (_seed = (_seed * 16807) % 2147483647) / 2147483647;
const flakeAtlas = canvasTex(1024, 1024, (g, W) => {
  const cell = W / 4;
  for (let v = 0; v < 16; v++) {
    const cx = (v % 4 + .5) * cell, cy = (Math.floor(v / 4) + .5) * cell, R = cell * .4;
    g.save(); g.translate(cx, cy);
    g.shadowColor = 'rgba(70,130,255,.85)'; g.shadowBlur = cell * .06;
    if (v < 12) {
      // dendrite / stellar crystal
      const lw = cell * (.022 + rnd() * .018), nb = 2 + Math.floor(rnd() * 3), bl = .25 + rnd() * .3, plate = rnd() < .45, tipFork = rnd() < .5;
      const brs = Array.from({ length: nb }, (_, i) => [(.3 + i * (.55 / nb)) + rnd() * .08, bl * (1 - i / (nb + 1)) * (.7 + rnd() * .5)]);
      g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = lw;
      for (let a = 0; a < 6; a++) {
        g.save(); g.rotate(a * Math.PI / 3);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -R);
        brs.forEach(([p, l]) => {
          const y = -R * p, L = R * l;
          g.moveTo(0, y); g.lineTo(-L * Math.sin(Math.PI / 3), y - L * Math.cos(Math.PI / 3));
          g.moveTo(0, y); g.lineTo(L * Math.sin(Math.PI / 3), y - L * Math.cos(Math.PI / 3));
        });
        if (tipFork) { const y = -R * .88, L = R * .12; g.moveTo(0, y); g.lineTo(-L, y - L); g.moveTo(0, y); g.lineTo(L, y - L); }
        g.stroke(); g.restore();
      }
      if (plate) {
        const pr = R * (.16 + rnd() * .1);
        g.beginPath(); for (let a = 0; a < 6; a++) { const t = a * Math.PI / 3 - Math.PI / 2; g.lineTo(Math.cos(t) * pr, Math.sin(t) * pr); } g.closePath();
        g.globalAlpha = .55; g.fill(); g.globalAlpha = 1; g.stroke();
      } else { g.beginPath(); g.arc(0, 0, lw * 1.2, 0, 7); g.fill(); }
    } else {
      // soft clumped flake (out-of-focus / wet snow)
      for (let k = 0; k < 7; k++) {
        const a = rnd() * 6.28, d = rnd() * R * .45, r = R * (.22 + rnd() * .25);
        const x = Math.cos(a) * d, y = Math.sin(a) * d;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.6, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
    }
    g.restore();
  }
});
const SNOW_VS = `
attribute float size; attribute float rot; attribute float spin; attribute float variant; attribute float phase;
uniform float time; uniform float scale;
varying float vAng; varying float vVar; varying float vTw;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * scale / -mv.z;
  vAng = rot + time * spin;
  vVar = variant;
  vTw = 0.72 + 0.28 * sin(time * (1.3 + abs(spin) * 2.5) + phase);
}`;
const SNOW_FS = `
uniform sampler2D map; uniform float opacity;
varying float vAng; varying float vVar; varying float vTw;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vAng), s = sin(vAng);
  p = mat2(c, -s, s, c) * p + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) discard;
  vec2 cell = vec2(mod(vVar, 4.0), floor(vVar / 4.0));
  vec4 t = texture2D(map, (cell + p) / 4.0);
  float a = t.a * opacity * vTw;
  if (a < 0.02) discard;
  gl_FragColor = vec4(t.rgb, a);
}`;
function makeSnow(geo, n, minS, maxS) {
  const size = new Float32Array(n), rot = new Float32Array(n), spin = new Float32Array(n), variant = new Float32Array(n), phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const soft = Math.random() < .3;
    variant[i] = soft ? 12 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 12);
    const r = Math.random();
    size[i] = minS + (maxS - minS) * r * r * (soft ? 1.15 : 1);   // many small, a few large
    rot[i] = Math.random() * 6.28; spin[i] = (Math.random() - .5) * 1.6; phase[i] = Math.random() * 6.28;
  }
  [['size', size], ['rot', rot], ['spin', spin], ['variant', variant], ['phase', phase]].forEach(([k, a]) => geo.setAttribute(k, new T.BufferAttribute(a, 1)));
  const mat = new T.ShaderMaterial({
    uniforms: { map: { value: flakeAtlas }, time: { value: 0 }, opacity: { value: 1 }, scale: { value: 500 } },
    vertexShader: SNOW_VS, fragmentShader: SNOW_FS, transparent: true, depthWrite: false
  });
  const pts = new T.Points(geo, mat); pts.frustumCulled = false;
  pts.fit = (renderer, camera, h) => { mat.uniforms.scale.value = h * renderer.getPixelRatio() / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))); };
  return pts;
}

// bravesoft mark (3 swooshes, 646 × 343 units) — used by the flock shapes and the mochi kagami top
const LOGO = ['M238.803 226.184C247.28 230.725 254.62 234.657 260.553 237.505H260.584C307.673 260.083 354.579 253.984 379.947 250.686C385.744 249.932 390.416 249.325 393.709 249.239C393.137 249.781 392.488 250.414 391.758 251.126C379.914 262.683 346.729 295.064 274.808 296.974C192.082 299.186 153.013 332.023 141.93 342.497L70.9648 171.278C133.227 169.629 198.719 204.712 238.803 226.184Z',
  'M322.744 78.019C319.451 78.1047 314.779 78.7122 308.982 79.4659C283.614 82.7645 236.709 88.8635 189.619 66.2848C183.664 63.4295 176.294 59.4823 167.783 54.9238C127.676 33.4418 62.2248 -1.61474 0 0.0577249L70.9648 171.278C82.0483 160.803 121.117 127.966 203.843 125.754C274.811 123.87 306.972 93.086 320.08 80.5394C321.075 79.5874 321.96 78.7404 322.744 78.019Z',
  'M322.744 78.019C322.744 78.019 349.56 104.037 360.828 137.12C366.749 154.571 369.426 170.603 371.924 185.566C374.232 199.389 376.388 212.3 380.809 224.573C388.198 245.092 393.709 249.239 393.709 249.239C404.792 238.764 443.861 205.927 526.587 203.715C598.236 201.813 630.33 170.669 643.197 158.184C644.041 157.365 644.803 156.625 645.488 155.98C642.195 156.066 637.523 156.673 631.726 157.427C606.358 160.726 559.452 166.825 512.363 144.246H512.332C506.399 141.399 499.059 137.467 490.582 132.926C450.498 111.454 385.006 76.3709 322.744 78.019Z'];

/* ================= E: flock — a living flock that draws 2027, the bravesoft mark and the icon ================= */
stage('#flock', (root, renderer, canvas) => {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.fog = new T.Fog(0xCFE3FF, 70, 150);
  const camera = new T.PerspectiveCamera(40, 1, .5, 400);
  scene.add(new T.HemisphereLight(0xffffff, 0x7FA868, .72));
  const sun = new T.DirectionalLight(0xffffff, .62); sun.position.set(18, 40, 22); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 120 }); sun.shadow.bias = -.001;
  scene.add(sun);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const S = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .8 }, o));

  /* ---------------- environment ---------------- */
  const FR0 = 29;
  // 新春の牧場: a green winter pasture (mown stripes inside the fence), a dirt path to the gate,
  // snow drifts outside the fence and clumps of 福寿草 — no more "frozen lake"
  const blades = (g, w, n, cols, len) => { for (let i = 0; i < n; i++) { g.strokeStyle = cols[i % cols.length]; g.lineWidth = rnd(1, 2.2); const x = rnd(0, w), y = rnd(0, w), l = rnd(len * .5, len); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-3, 3), y - l); g.stroke(); } };
  const grassTex = canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#6FAE55'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 260; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(255,255,210,.07)' : 'rgba(20,70,20,.08)'; const r = rnd(10, 40); g.beginPath(); g.ellipse(rnd(0, w), rnd(0, w), r, r * rnd(.4, .9), rnd(0, 3), 0, 7); g.fill(); }
    blades(g, w, 2600, ['rgba(40,95,35,.5)', 'rgba(150,200,105,.55)', 'rgba(95,155,70,.6)', 'rgba(205,220,140,.35)'], 9);
  });
  grassTex.wrapS = grassTex.wrapT = T.RepeatWrapping; grassTex.repeat.set(26, 26); grassTex.anisotropy = 4;
  const ground = new T.Mesh(new T.CircleGeometry(160, 96), new T.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // mown pasture inside the fence: soft alternating stripes
  const pastureTex = canvasTex(1024, 1024, (g, w) => {
    const bands = 14;
    for (let i = 0; i < bands; i++) { g.fillStyle = i % 2 ? '#7AB863' : '#70AC5A'; g.fillRect(i * w / bands, 0, w / bands + 1, w); }
    for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(255,255,200,.06)' : 'rgba(30,80,30,.06)'; const r = rnd(10, 50); g.beginPath(); g.ellipse(rnd(0, w), rnd(0, w), r, r * rnd(.4, .9), rnd(0, 3), 0, 7); g.fill(); }
    blades(g, w, 9000, ['rgba(45,105,40,.45)', 'rgba(160,210,115,.5)', 'rgba(100,165,75,.55)'], 7);
    const gr = g.createRadialGradient(w / 2, w / 2, w * .38, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(60,110,45,0)'); gr.addColorStop(1, 'rgba(60,110,45,.35)'); g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const pasture = new T.Mesh(new T.CircleGeometry(FR0 - .2, 96), new T.MeshStandardMaterial({ map: pastureTex, roughness: 1 }));
  pasture.rotation.x = -Math.PI / 2; pasture.rotation.z = .35; pasture.position.y = .015; pasture.receiveShadow = true; scene.add(pasture);
  // dirt path from the gate out to the horizon
  const pathTex = canvasTex(256, 1024, (g, w, h) => {
    g.fillStyle = '#D9C49A'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(120,90,50,.18)' : 'rgba(255,245,220,.35)'; const r = rnd(1.5, 6); g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), r, r * .7, rnd(0, 3), 0, 7); g.fill(); }
    // wheel ruts + grassy edges
    g.fillStyle = 'rgba(150,115,70,.22)'; g.fillRect(w * .28, 0, w * .08, h); g.fillRect(w * .64, 0, w * .08, h);
    const e = g.createLinearGradient(0, 0, w, 0); e.addColorStop(0, '#6FAE55'); e.addColorStop(.12, 'rgba(111,174,85,0)'); e.addColorStop(.88, 'rgba(111,174,85,0)'); e.addColorStop(1, '#6FAE55'); g.fillStyle = e; g.fillRect(0, 0, w, h);
  });
  pathTex.wrapT = T.RepeatWrapping; pathTex.repeat.set(1, 6);
  const path = new T.Mesh(new T.PlaneGeometry(4, 90), new T.MeshStandardMaterial({ map: pathTex, roughness: 1 }));
  path.rotation.x = -Math.PI / 2; path.position.set(0, .02, FR0 + 45); path.receiveShadow = true; scene.add(path);
  // snow drifts outside the fence (soft white mounds) so the winter mood stays
  const driftMat = S(0xffffff, { roughness: .95 });
  for (let i = 0; i < 46; i++) {
    const a = rnd(0, 6.28), r = rnd(FR0 + 4, 95); if (Math.abs(Math.cos(a)) < .08 && Math.sin(a) > 0) continue;
    const d = new T.Mesh(new T.SphereGeometry(1, 16, 8, 0, 6.29, 0, 1.3), driftMat);
    d.scale.set(rnd(2.5, 7), rnd(.25, .6), rnd(1.6, 4)); d.position.set(Math.cos(a) * r, -.15, Math.sin(a) * r); d.rotation.y = rnd(0, 3); d.receiveShadow = true; scene.add(d);
  }
  // 福寿草 (the New Year flower) — little yellow clumps along the fence and path
  const fukuGeo = new T.SphereGeometry(.13, 8, 6); fukuGeo.scale(1, .55, 1);
  const leafGeo = new T.ConeGeometry(.12, .35, 5);
  const fuku = new T.InstancedMesh(fukuGeo, S(0xFFD43B, { emissive: 0x6B4E00, emissiveIntensity: .25 }), 260);
  const fLeaf = new T.InstancedMesh(leafGeo, S(0x3F7F35), 260);
  { const m = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3(1, 1, 1); let k = 0;
    for (let c = 0; c < 52 && k < 255; c++) {
      let cx, cz; if (c < 30) { const a = rnd(0, 6.28); cx = Math.cos(a) * (FR0 + rnd(1.2, 3)); cz = Math.sin(a) * (FR0 + rnd(1.2, 3)); } else { cx = (Math.random() < .5 ? -1 : 1) * rnd(2.4, 3.4); cz = rnd(FR0 + 3, FR0 + 40); }
      for (let j = 0; j < 5 && k < 255; j++, k++) {
        const x = cx + rnd(-.5, .5), z = cz + rnd(-.5, .5);
        fuku.setMatrixAt(k, m.compose(v.set(x, .3, z), q.identity(), sc.setScalar(rnd(.8, 1.3))));
        fLeaf.setMatrixAt(k, m.compose(v.set(x + .08, .17, z), q.setFromEuler(new T.Euler(rnd(-.3, .3), 0, rnd(-.3, .3))), sc.setScalar(1)));
      }
    }
    fuku.count = fLeaf.count = k; scene.add(fuku, fLeaf);
  }
  const shadowed = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
  const OB = [];   // circular obstacles the sheep walk around: [x, z, r]

  // fence ring with a gate facing the camera
  const FR = FR0, postGeo = new T.CylinderGeometry(.12, .14, 1.3, 6), railGeo = new T.BoxGeometry(.08, .1, 1), wood = S(0xF3F8FF);
  const nPosts = 96, posts = new T.InstancedMesh(postGeo, wood, nPosts), rails = new T.InstancedMesh(railGeo, wood, nPosts * 2);
  const m4 = new T.Matrix4(), q4 = new T.Quaternion(), v4 = new T.Vector3(), s4 = new T.Vector3(1, 1, 1);
  let pi = 0, ri = 0;
  for (let i = 0; i < nPosts; i++) {
    const a = i / nPosts * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < .09) continue;
    posts.setMatrixAt(pi++, m4.compose(v4.set(Math.cos(a) * FR, .65, Math.sin(a) * FR), q4.identity(), s4.set(1, 1, 1)));
    const a2 = (i + .5) / nPosts * Math.PI * 2, len = 2 * Math.PI * FR / nPosts;
    if (Math.abs(Math.atan2(Math.sin(a2 - Math.PI / 2), Math.cos(a2 - Math.PI / 2))) < .09) continue;
    q4.setFromAxisAngle(new T.Vector3(0, 1, 0), -a2);
    [.45, .95].forEach(y => rails.setMatrixAt(ri++, m4.compose(v4.set(Math.cos(a2) * FR, y, Math.sin(a2) * FR), q4, s4.set(1, 1, len * 1.02))));
  }
  posts.count = pi; rails.count = ri; [posts, rails].forEach(m => { m.castShadow = true; scene.add(m); });
  // gate arch with a 2027 board
  const gate = new T.Group(); gate.position.set(0, 0, FR);
  [-1.8, 1.8].forEach(x => { const p = new T.Mesh(new T.CylinderGeometry(.16, .18, 3.2, 10), S(C.navy)); p.position.set(x, 1.6, 0); gate.add(p); });
  const beamG = new T.Mesh(new T.BoxGeometry(4.6, .3, .35), S(C.navy)); beamG.position.y = 3.2; gate.add(beamG);
  const board = new T.Mesh(new T.PlaneGeometry(2.6, .8), new T.MeshStandardMaterial({ map: canvasTex(512, 160, (g, w, h) => { g.fillStyle = '#FFE94A'; g.fillRect(0, 0, w, h); g.fillStyle = '#090A0A'; g.font = `700 104px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2027', w / 2, h / 2 + 6); }), side: T.DoubleSide }));
  board.position.set(0, 2.55, .2); gate.add(board);
  scene.add(shadowed(gate));
  // pine trees with snow caps (outside the fence, plus a few clumps inside)
  const tree = (x, z, s) => {
    const t = new T.Group(), m = S(Math.random() < .5 ? C.navy : 0x0B1C3F, { flatShading: true });
    [[.9, 1.6, 1.0], [.7, 1.3, 1.9], [.48, 1.0, 2.7]].forEach(([r, h, y]) => { const c = new T.Mesh(new T.ConeGeometry(r, h, 8), m); c.position.y = y; t.add(c); });
    const cap = new T.Mesh(new T.ConeGeometry(.3, .5, 8), S(0xffffff)); cap.position.y = 3.15; t.add(cap);
    const tr = new T.Mesh(new T.CylinderGeometry(.14, .18, .6, 6), S(C.ink)); tr.position.y = .3; t.add(tr);
    t.position.set(x, 0, z); t.scale.setScalar(s); t.rotation.y = rnd(0, 6); scene.add(t); return t;
  };
  for (let i = 0; i < 70; i++) { const a = rnd(0, 6.28), r = rnd(33, 70); tree(Math.cos(a) * r, Math.sin(a) * r, rnd(1.1, 2.4)); }
  // barn
  const barn = new T.Group(); barn.position.set(-37, 0, -16); barn.rotation.y = .9;
  const walls = new T.Mesh(new T.BoxGeometry(7, 4, 5), S(0xF7F9FA)); walls.position.y = 2; barn.add(walls);
  const rs = new T.Shape(); rs.moveTo(-4, 0); rs.lineTo(0, 2.6); rs.lineTo(4, 0); rs.lineTo(-4, 0);
  const roof = new T.Mesh(new T.ExtrudeGeometry(rs, { depth: 5.6, bevelEnabled: false }), S(C.blue, { flatShading: true })); roof.position.set(0, 4, -2.8); barn.add(roof);
  const door = new T.Mesh(new T.PlaneGeometry(2.2, 2.8), S(C.navy)); door.position.set(0, 1.4, 2.51); barn.add(door);
  const sign = new T.Mesh(new T.PlaneGeometry(3.4, .7), new T.MeshStandardMaterial({ map: canvasTex(512, 110, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#0066FF'; g.font = `900 72px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('bravesoft', w / 2, h / 2 + 3); }) }));
  sign.position.set(0, 3.4, 2.52); barn.add(sign);
  scene.add(shadowed(barn));
  // frozen pond
  const pond = new T.Mesh(new T.CircleGeometry(4.2, 48), new T.MeshStandardMaterial({ color: 0xDDF3FF, roughness: .12, metalness: .2 })); pond.rotation.x = -Math.PI / 2; pond.position.set(-15, .03, -21); scene.add(pond);
  const rim = new T.Mesh(new T.RingGeometry(4.2, 4.9, 48), S(0xffffff)); rim.rotation.x = -Math.PI / 2; rim.position.set(-15, .04, -21); scene.add(rim);
  OB.push([-15, -21, 4.6]);
  // rocks, snowmen, kadomatsu by the gate
  [[18, -19, 1.3], [24, 9, 1.0], [-25, 12, 1.2], [9, -24, .9]].forEach(([x, z, s]) => {
    const r = new T.Mesh(new T.DodecahedronGeometry(s, 0), S(0xA9BCD8, { flatShading: true })); r.position.set(x, s * .55, z); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); scene.add(shadowed(r));
    const sn = new T.Mesh(new T.SphereGeometry(s * .9, 16, 10, 0, 6.29, 0, 1.2), S(0xffffff)); sn.position.set(x, s * .55 + s * .2, z); sn.scale.y = .5; scene.add(sn);
    OB.push([x, z, s * 1.1]);
  });
  const snowman = (x, z, ry) => {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const b1 = new T.Mesh(new T.SphereGeometry(.9, 20, 14), S(0xffffff)); b1.position.y = .8;
    const b2 = new T.Mesh(new T.SphereGeometry(.6, 20, 14), S(0xffffff)); b2.position.y = 2.0;
    const sc = new T.Mesh(new T.TorusGeometry(.5, .13, 8, 20), S(C.blue)); sc.rotation.x = Math.PI / 2; sc.position.y = 1.55;
    const hat = new T.Mesh(new T.CylinderGeometry(.35, .35, .55, 16), S(C.ink)); hat.position.y = 2.75;
    const nose = new T.Mesh(new T.ConeGeometry(.1, .45, 8), S(C.yellow)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.0, .7);
    g.add(b1, b2, sc, hat, nose); scene.add(shadowed(g)); OB.push([x, z, 1.0]);
  };
  snowman(22, -14, -.8); snowman(-21, 19, .6);
  const kado = x => {
    const g = new T.Group(); g.position.set(x, 0, FR + .9);
    const pot = new T.Mesh(new T.CylinderGeometry(.55, .6, .6, 16), S(C.navy)); pot.position.y = .3; g.add(pot);
    [[0, 2.4], [-.22, 1.9], [.22, 1.6]].forEach(([dx, h]) => { const b = new T.Mesh(new T.CylinderGeometry(.14, .14, h, 10), S(0x00A86B)); b.position.set(dx, h / 2, 0); g.add(b); });
    scene.add(shadowed(g));
  };
  kado(-2.8); kado(2.8);
  // distant snowy mountains + drifting clouds
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * 6.28 + .3, r = 120, h = rnd(18, 34);
    const m = new T.Mesh(new T.ConeGeometry(h * .9, h, 7), S(0x7FA9EC, { flatShading: true })); m.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r); scene.add(m);
    const cap = new T.Mesh(new T.ConeGeometry(h * .3, h * .33, 7), S(0xffffff, { flatShading: true })); cap.position.set(m.position.x, h - h * .165 - 1, m.position.z); scene.add(cap);
  }
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const c = new T.Group();
    for (let k = 0; k < 5; k++) { const s = new T.Mesh(new T.SphereGeometry(rnd(1.8, 3), 12, 8), S(0xffffff, { roughness: 1 })); s.position.set(k * 2 - 4, rnd(-.4, .6), rnd(-1, 1)); c.add(s); }
    c.position.set(rnd(-70, 70), rnd(20, 30), rnd(-70, -10)); scene.add(c); clouds.push(c);
  }
  // a light snowfall around the meadow
  const SN = 900, sp = new Float32Array(SN * 3), sv = new Float32Array(SN);
  for (let i = 0; i < SN; i++) { sp[i * 3] = rnd(-45, 45); sp[i * 3 + 1] = rnd(0, 30); sp[i * 3 + 2] = rnd(-45, 45); sv[i] = rnd(1, 2.2); }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
  const snow = makeSnow(sg, SN, .25, .8); snow.material.uniforms.opacity.value = .85; scene.add(snow);

  /* ---------------- sheep (instanced, with legs, head and gait) ---------------- */
  const MAX = 560;
  const mW = partMatrices(P_WOOL), mI = partMatrices(P_INK), mL = partMatrices(P_LEG.map(p => [...p, 1, 1, 1]));
  const mO = P_WOOL.map(p => new T.Matrix4().compose(new T.Vector3(p[0], p[1], p[2]), new T.Quaternion(), new T.Vector3(p[3] * 1.1, p[4] * 1.1, p[5] * 1.1)));
  // lighter geometry for hundreds of sheep: chunky low-poly wool, simple head and legs
  const woolLo = new T.IcosahedronGeometry(1, 1), outLo = new T.IcosahedronGeometry(1, 0), inkLo = new T.SphereGeometry(1, 8, 6), legLo = new T.CylinderGeometry(.075, .06, .5, 5);
  const iWool = new T.InstancedMesh(woolLo, woolMat, MAX * mW.length);
  const iOut = new T.InstancedMesh(outLo, new T.MeshBasicMaterial({ color: C.ink, side: T.BackSide }), MAX * mO.length);
  const iInk = new T.InstancedMesh(inkLo, inkMat, MAX * mI.length);
  const iLeg = new T.InstancedMesh(legLo, inkMat, MAX * mL.length);
  iWool.castShadow = true;
  [iWool, iOut, iInk, iLeg].forEach(m => { m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); });
  const HEADW = new Set([7]);           // wool tuft on the head moves with the head
  const NECK = new T.Vector3(.5, .98, 0), HIPY = .51;
  const N = () => (isPC() ? 480 : 280);
  let count = 0;
  const sh = [];
  const WANDER_R = 25;
  function mkSheep(i) {
    const a = rnd(0, 6.28), r = Math.sqrt(Math.random()) * WANDER_R;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, vx: 0, vz: 0, yaw: rnd(0, 6.28), ph: rnd(0, 6.28), hop: 0, hv: 0,
      mode: Math.random() < .5 ? 'graze' : 'wander', t: rnd(0, 4), wx: 0, wz: 0, tx: 0, tz: 0, ox: 0, oz: 0, delay: 0,
      speed: rnd(.85, 1.15), headP: 0, headY: 0, hpT: 0, hyT: 0, fidget: rnd(2, 9), restless: Math.random() < .35, i };
  }
  function setCount(n) {
    while (sh.length < n) sh.push(mkSheep(sh.length));
    count = n;
    iWool.count = iOut.count = n * mW.length; iInk.count = n * mI.length; iLeg.count = n * mL.length;
  }

  /* ---------------- shapes ---------------- */
  const ICON = 'M114.823 48.5639C112.995 46.7353 110.027 46.7353 108.199 48.5639L61.8158 94.9467C59.9872 96.7753 57.0197 96.7753 55.1911 94.9467L22.0576 61.8132C20.229 59.9846 20.229 57.0205 22.0576 55.1885L28.6856 48.5605L45.2524 65.1272C52.5735 72.4449 64.4368 72.4449 71.7579 65.1272L88.3246 48.5605C95.6457 41.2428 95.6457 29.3761 88.3246 22.055L71.7579 5.48823C64.4402 -1.82941 52.5735 -1.82941 45.2524 5.48823L5.49081 45.2498C-1.83027 52.5675 -1.83027 64.4342 5.49081 71.7553L45.249 111.513C52.5701 118.831 64.4334 118.831 71.7544 111.513L121.451 61.8166C123.28 59.9881 123.28 57.0205 121.451 55.192L114.827 48.5673L114.823 48.5639ZM45.249 31.9971L55.1911 22.055C57.0231 20.2264 59.9872 20.2264 61.8158 22.055L71.7544 31.9937C73.583 33.8222 73.583 36.7898 71.7544 38.6183L61.8123 48.5605C59.9803 50.389 57.0162 50.389 55.1877 48.5605L45.249 38.6218C43.4204 36.7932 43.4204 33.8257 45.249 31.9971Z';
  const SHAPES = [
    { name: '2027', draw(g, W, H) { const two = !isPC(); const lines = two ? ['20', '27'] : ['2027']; const fs = two ? H * .46 : H * .9; g.font = `700 ${fs}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach((l, k) => g.fillText(l, W / 2, two ? H * (.27 + k * .48) : H / 2 + fs * .04)); }, aspect: () => isPC() ? 2.6 : .95 },
    { name: 'bravesoft マーク', draw(g, W, H) { const s = Math.min(W / 646, H / 343) * .96; g.translate((W - 646 * s) / 2, (H - 343 * s) / 2); g.scale(s, s); LOGO.forEach(d => g.fill(new Path2D(d))); }, aspect: () => 646 / 343 },
    { name: 'eventos ロゴ', draw(g, W, H) { const s = Math.min(W / 123, H / 117) * .96; g.translate((W - 123 * s) / 2, (H - 117 * s) / 2); g.scale(s, s); g.fill(new Path2D(ICON)); }, aspect: () => 123 / 117 }
  ];
  // returns exactly n well-spaced points inside the shape, in world units (spacing ≈ 1.05 so the soft collision radius fits)
  function sampleShape(shape, n) {
    const asp = shape.aspect(), W = asp >= 1 ? 640 : Math.round(640 * asp), H = asp >= 1 ? Math.round(640 / asp) : 640;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#000'; shape.draw(g, W, H);
    const d = g.getImageData(0, 0, W, H).data, pts = [];
    for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
    for (let i = pts.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pts[i], pts[j]] = [pts[j], pts[i]]; }
    let s = Math.sqrt(pts.length * 4 / n) * .92, out = [];
    for (let pass = 0; pass < 8 && out.length < n; pass++) {
      const grid = new Map(), key = (x, y) => ((x / s) | 0) + ',' + ((y / s) | 0);
      out.forEach(p => { const k = key(p[0], p[1]); (grid.get(k) || grid.set(k, []).get(k)).push(p); });
      for (const p of pts) {
        if (out.length >= n) break;
        const gx = (p[0] / s) | 0, gy = (p[1] / s) | 0; let ok = true;
        for (let ix = -1; ix <= 1 && ok; ix++) for (let iy = -1; iy <= 1 && ok; iy++) { const b = grid.get((gx + ix) + ',' + (gy + iy)); if (b) for (const q of b) if ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < s * s) { ok = false; break; } }
        if (ok) { out.push(p); const k = key(p[0], p[1]); (grid.get(k) || grid.set(k, []).get(k)).push(p); }
      }
      s *= .9;
    }
    // world scale: ~1.05 between sheep, but never wider than the meadow allows (then the flock packs tighter)
    const spx = s / .9, maxW = isPC() ? 46 : 25, maxH = isPC() ? 34 : 34;
    let k = 1.05 / spx; k = Math.min(k, maxW / W, maxH / H);
    SP = spx * k;
    return out.slice(0, n).map(([x, y]) => [(x - W / 2) * k, (y - H / 2) * k]);
  }
  function assign(targets) {
    const free = new Set(Array.from({ length: count }, (_, i) => i));
    const order = targets.map((_, i) => i).sort(() => Math.random() - .5);
    order.forEach(ti => {
      const [tx, tz] = targets[ti]; let best = -1, bd = 1e9;
      free.forEach(i => { const s = sh[i], dd = (s.x - tx) ** 2 + (s.z - tz) ** 2; if (dd < bd) { bd = dd; best = i; } });
      if (best < 0) return;
      free.delete(best); const s = sh[best];
      s.tx = tx; s.tz = tz; s.ox = 0; s.oz = 0; s.mode = 'go'; s.delay = rnd(0, .9) + Math.sqrt(bd) * .015;
    });
  }

  /* ---------------- UI & cycle ---------------- */
  const msg = $('.ov-msg', root), btn = $('.js-go', root), nextBtn = $('.js-nextshape', root), countEl = $('.js-count', root), shapeEl = $('.js-shape', root);
  let cycling = false, shapeIx = -1, holdT = 0, formedOnce = false, extent = [30, 30], arrivedRatio = 0, shapeT = 0;
  function nextShape() {
    shapeIx = (shapeIx + 1) % SHAPES.length;
    const sh0 = SHAPES[shapeIx], pts = sampleShape(sh0, count);
    let mx = 0, mz = 0; pts.forEach(([x, z]) => { mx = Math.max(mx, Math.abs(x)); mz = Math.max(mz, Math.abs(z)); });
    extent = [mx * 2 + 4, mz * 2 + 4];
    RC = Math.min(.46, SP * .45); SCt = clamp(SP / 1.05, .62, 1); msg.classList.remove('show');
    assign(pts); holdT = 0; shapeT = 0; shotChange(shapeIx === 0 ? 2.6 : 2.1);
    shapeEl.textContent = `かたち ${shapeIx + 1} / ${SHAPES.length}　${sh0.name}`;
  }
  btn.addEventListener('click', () => {
    cycling = !cycling;
    play('hooves', { vol: .8 }); [0, .35, .8].forEach(d => sfx.bleat({ vol: .35, delay: d + Math.random() * .2 }));
    if (cycling) { shapeIx = -1; nextShape(); btn.textContent = '解散する'; btn.classList.add('sec'); nextBtn.hidden = false; }
    else { shotChange(2.4); RC = .46; SCt = 1; sh.forEach(s => { s.mode = Math.random() < .5 ? 'graze' : 'wander'; s.t = rnd(0, 2); }); msg.classList.remove('show'); btn.textContent = 'ひつじを集合させる'; btn.classList.remove('sec'); nextBtn.hidden = true; shapeEl.textContent = ''; }
  });
  nextBtn.addEventListener('click', () => {
    if (!cycling) return;
    nextShape(); popEl(nextBtn, 1.08); sfx.whoosh(); play('hooves', { vol: .5 });
  });

  /* ---------------- camera orbit ---------------- */
  let az = 0, tiltOff = 0, drag = null, aspect = 1;
  // drag = orbit the camera; a tap (barely moved, short) = 集合 / 次のかたち
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, d: 0, t: e.timeStamp }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    drag.d += Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
    az = clamp(az - (e.clientX - drag.x) * .006, -1.3, 1.3); tiltOff = clamp(tiltOff - (e.clientY - drag.y) * .004, -.35, .35);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  // subtle cursor follower: shows what a tap will do; shrinks while dragging the view
  const cur = root.querySelector('.fl-cursor'), curLbl = cur && cur.querySelector('span');
  let ccx = 0, ccy = 0, ctx2 = 0, cty = 0, curRaf = 0;
  const lp = e => { const r = root.getBoundingClientRect(), k = root.clientWidth / (r.width || 1); return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }; };
  const curLoop = () => { ccx += (ctx2 - ccx) * .25; ccy += (cty - ccy) * .25; cur.style.transform = `translate(${ccx}px,${ccy}px)`; curRaf = Math.abs(ctx2 - ccx) + Math.abs(cty - ccy) > .3 ? requestAnimationFrame(curLoop) : 0; };
  const nextName = () => SHAPES[(shapeIx + 1) % SHAPES.length].name;
  const curText = () => cycling ? `タップで次のかたちへ（${nextName()}）` : 'タップでひつじを集合';
  if (cur) {
    root.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const p = lp(e); ctx2 = p.x; cty = p.y;
      const off = !!e.target.closest('button, a, input, label');
      cur.classList.toggle('on', !off); cur.classList.toggle('drag', !!(drag && drag.d > 8));
      const t = curText(); if (curLbl.textContent !== t) curLbl.textContent = t;
      if (!curRaf) curRaf = requestAnimationFrame(curLoop);
    });
    root.addEventListener('pointerleave', () => cur.classList.remove('on'));
  }
  function ripple(e) {
    const p = lp(e), rp = document.createElement('span'); rp.className = 'fl-ripple'; rp.style.left = p.x + 'px'; rp.style.top = p.y + 'px'; root.appendChild(rp);
    rp.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: .9 }, { transform: 'translate(-50%,-50%) scale(1.7)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = () => rp.remove();
  }
  const endDrag = e => {
    const tap = drag && e && e.type === 'pointerup' && drag.d < 8 && e.timeStamp - drag.t < 450;
    if (tap) ripple(e);
    if (cur) cur.classList.remove('drag');
    drag = null; canvas.style.cursor = '';
    if (!tap) return;
    // touch has no hover: the tapped spot gets a random poke too
    if (e.pointerType !== 'mouse' && groundAt(e)) pokeAt(hit.x, hit.z, pick(['scatter', 'wave', 'mixed', 'domino']));
    if (!cycling) btn.click(); else { nextShape(); popEl(nextBtn, 1.08); }
    sfx.bleat();
  };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

  /* ---------------- camera shots: every change is an eased swoop, never a cut ---------------- */
  // `cam` is what is rendered; the live target (fit distance, tilt, azimuth, look-at) is recomputed each frame.
  // shotChange() tweens from wherever the camera is to the new target along an arc: it pulls back, swings
  // sideways and banks a little in the middle of the move, then settles (ease in-out).
  const cam = { d: 0, polar: 1.25, a: 0, lz: 0 };
  let camTw = null, camRoll = 0;
  const easeIO = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  function shotChange(dur) {
    if (!cam.d) return;
    camTw = { from: Object.assign({}, cam), t: 0, dur: RM ? .8 : dur, swing: RM ? 0 : (Math.random() < .5 ? -1 : 1) * rnd(.22, .42), lift: RM ? 0 : rnd(.1, .2) };
  }

  /* ---------------- hover: the flock reacts to the mouse, in changing moods ---------------- */
  // the cursor is projected onto the meadow; sheep near it react. The mood changes every few seconds
  // (and each time the mouse comes back), so the same gesture never gives the same result twice:
  //   scatter — they start and run away, the formation parts like water, then they trot back
  //   wave    — a stadium wave of hops spreads out from the cursor
  //   curious — heads (and bodies) turn to follow the cursor; free sheep walk over to it
  //   domino  — one sheep faints, the ones around it topple over in a ring, then they all get up
  //   mixed   — every sheep picks its own reaction: hop-hop, spin, faint, wool shake, boing, baa
  const ray = new T.Raycaster(), ndc = new T.Vector2(), hit = new T.Vector3(), GROUND = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const hov = { on: false, ok: false, x: 0, z: 0, mood: 'mixed', moodT: 0, waveT: 0, sndT: 0, bubT: 0 };
  const pick = a => a[(Math.random() * a.length) | 0];
  const MOODS = [['mixed', 3], ['scatter', 2], ['wave', 2], ['curious', 1.5], ['domino', 1.5]];
  function pickMood() {
    const pool = MOODS.filter(m => m[0] !== hov.mood), tot = pool.reduce((a, m) => a + m[1], 0);
    let r = Math.random() * tot; hov.mood = pool.find(m => (r -= m[1]) < 0)[0];
    hov.moodT = rnd(3.5, 6);
  }
  const groundAt = e => {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(GROUND, hit);
  };
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (!hov.on) pickMood();
    hov.on = !(drag && drag.d > 8);
  });
  canvas.addEventListener('pointerleave', () => { hov.on = false; });
  // speech bubbles (メェ〜, ばたん, くるっ …) pinned above a sheep's head
  const bubbles = [], BV = new T.Vector3();
  function bubble(s, txt, force) {
    if (!force && (hov.bubT > 0 || Math.random() < .35)) return;
    hov.bubT = .14;
    if (bubbles.length >= 7) bubbles.shift().el.remove();
    const el = document.createElement('span'); el.className = 'fl-baa'; el.textContent = txt; root.appendChild(el);
    bubbles.push({ el, s, t: 0 });
  }
  function noise(name, o) { if (hov.sndT > 0) return; hov.sndT = .16; if (name === 'bleat') sfx.bleat(Object.assign({ vol: .3 }, o)); else play(name, Object.assign({ vol: .35, rate: rnd(.9, 1.15) }, o)); }
  const busy = s => s.rx && s.rx.k !== 'look';
  const rx = (k, d, delay = 0, o) => Object.assign({ k, d, delay, t: 0, go: false, dir: Math.random() < .5 ? -1 : 1 }, o);
  // a sheep's local +z (its right side) in world space is (sin yaw, cos yaw): roll that way = fall away from (x, z)
  const fallDir = (s, x, z) => Math.sign((s.x - x) * Math.sin(s.yaw) + (s.z - z) * Math.cos(s.yaw)) || 1;
  const DUR = { hop: 1.05, spin: .95, flop: 2.6, shake: .85, boing: 1, baa: 1.1 };
  const SAY = { hop: ['ぴょん', 'ぴょんぴょん', '対応完了メェ！', '打てる球は全部打つメェ'], spin: ['くるっ', 'くるりん'], flop: ['ばたん', 'きゅう…', '工数調整メェ…', '取り急ぎメェ〜'], shake: ['ぶるぶる', 'もふもふ'], boing: ['ぽよん', 'ぼよーん', '対応完了メェ！', '打てる球は全部打つメェ'], baa: ['メェ〜', 'メェッ！', 'メ〜', '承知しメェした', '助かりメェす'] };
  function near(x, z, R, fn) {
    const R2 = R * R, seen = new Set();
    for (let cx = Math.floor(x - R); cx <= Math.floor(x + R); cx++) for (let cz = Math.floor(z - R); cz <= Math.floor(z + R); cz++) {
      const b = grid.get((cx * 73856093) ^ (cz * 19349663)); if (!b) continue;
      for (const i of b) { if (seen.has(i)) continue; seen.add(i); const s = sh[i], d2 = (s.x - x) ** 2 + (s.z - z) ** 2; if (d2 < R2) fn(s, Math.sqrt(d2)); }
    }
  }
  function pokeAt(x, z, mood) {
    if (mood === 'scatter') {
      near(x, z, 2.7, (s, d) => {
        if (s.cool > 0 || busy(s)) return;
        const l = d || 1;
        s.rx = rx('flee', rnd(.55, .95), rnd(0, .08), { fx: (s.x - x) / l, fz: (s.z - z) / l, pow: rnd(5.5, 8.5) * (1.15 - d / 2.7 * .5) });
        s.hv = rnd(1.8, 3.2); s.cool = rnd(2.2, 3.6);
        bubble(s, pick(['！', '！？', 'わっ', 'ひゃっ', '連投メェ〜', '念のためメェ'])); noise('bleat', { rate: rnd(1.1, 1.3) });
      });
    } else if (mood === 'wave') {
      let ready = false; near(x, z, 1.3, s => { if (s.cool <= 0 && !busy(s)) ready = true; });
      if (!ready || hov.waveT > 0) return;
      hov.waveT = 1.7; let first = null;
      near(x, z, 9, (s, d) => {
        if (busy(s)) return;
        s.rx = rx('hop', .8, d * .075, { hops: d < 1.6 ? 2 : 1, h: rnd(3.6, 4.6) * (1 - d / 9 * .35), say: false }); s.cool = 2.6;
        if (!first || d < first[1]) first = [s, d];
      });
      if (first) bubble(first[0], pick(['♪', 'それっ', 'ウェーブ！', 'よろしくメェ〜', 'おつかれメェ！']), true);
      noise('pon', { vol: .4 });
    } else if (mood === 'domino') {
      let seed = null; near(x, z, 1.2, (s, d) => { if (s.cool <= 0 && !busy(s) && (!seed || d < seed[1])) seed = [s, d]; });
      if (!seed) return;
      const [s0] = seed;
      near(s0.x, s0.z, 4.2, (s, d) => {
        if (busy(s) || Math.random() < d / 4.2 * .45) return;
        s.rx = rx('flop', DUR.flop + rnd(-.2, .4), d * .13, { dir: fallDir(s, s0.x, s0.z), say: false }); s.cool = DUR.flop + rnd(1.5, 3);
      });
      bubble(s0, pick(['ばたん', 'きゅう…', 'バタバタ', '工数調整メェ…', '取り急ぎメェ〜']), true); noise('poof', { vol: .5 });
    } else if (mood === 'curious') {
      near(x, z, 5.5, s => {
        if (busy(s)) return;
        if (s.rx) { s.rx.t = Math.min(s.rx.t, .2); return; }
        s.rx = rx('look', 1.4, rnd(0, .35));
        if (Math.random() < .05) bubble(s, pick(['？', 'なに？', 'じーっ', 'なるほどメェ〜', 'これでOKメェ？']));
      });
    } else {
      near(x, z, 2, s => {
        if (s.cool > 0 || busy(s)) return;
        const k = pick(['hop', 'hop', 'spin', 'spin', 'flop', 'shake', 'boing', 'boing', 'baa', 'baa']);
        s.rx = rx(k, DUR[k] * rnd(.9, 1.15), rnd(0, .18), { hops: 2, h: rnd(3.8, 4.8) }); s.cool = rnd(3, 5.5);
      });
    }
  }
  // a reaction's first frame (after its delay): sounds, bubbles, hops
  function startRx(s, r) {
    if (r.k === 'hop') { s.hv = r.h; if (r.say !== false) bubble(s, pick(SAY.hop)); }
    else if (r.k === 'boing') { s.hv = 3.2; bubble(s, pick(SAY.boing)); noise('boing'); }
    else if (r.k === 'baa') { bubble(s, pick(SAY.baa), true); noise('bleat'); }
    else if (r.k === 'flop') { if (r.say !== false) bubble(s, pick(SAY.flop)); noise('thud', { vol: .22, rate: rnd(1.2, 1.5) }); }
    else if (r.k in SAY) bubble(s, pick(SAY[r.k]));
  }
  function hoverStep(dt) {
    hov.waveT -= dt; hov.sndT -= dt; hov.bubT -= dt;
    if (!hov.on) return;
    hov.moodT -= dt; if (hov.moodT <= 0) pickMood();
    ray.setFromCamera(ndc, camera); hov.ok = !!ray.ray.intersectPlane(GROUND, hit);
    if (!hov.ok) return;
    hov.x = hit.x; hov.z = hit.z;
    pokeAt(hov.x, hov.z, hov.mood);
  }

  /* ---------------- simulation ---------------- */
  let SP = 1.05, RC = .46, SC = 1, SCt = 1;   // spacing, soft collision radius (smaller than the wool so neighbours squish), sheep scale
  const grid = new Map();
  const M = new T.Matrix4(), Mh = new T.Matrix4(), Ml = new T.Matrix4(), Q = new T.Quaternion(), Qh = new T.Quaternion(), V = new T.Vector3(), ONE = new T.Vector3(1, 1, 1), Y = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1), tmp = new T.Matrix4(), E = new T.Euler();
  const T1 = new T.Matrix4(), T2 = new T.Matrix4();
  // phone tilt / shake. Tilt = the meadow leans: every sheep is pushed downhill (screen right/left = the camera's right,
  // top toward the user = toward the camera), formed sheep get pushed off their spot and walk back when it levels out.
  // A shake startles the whole flock: hops, boings, spins and a few faints, thrown a little against the jerk.
  const mo = { x: 0, z: 0, seen: motion.shakes, talkT: 0, hinted: false };
  const dead = (v, d) => Math.sign(v) * Math.max(0, Math.abs(v) - d);
  function motionStep(dt) {
    mo.x = mo.z = 0;
    if (!motion.on) return;
    if (!mo.hinted) { mo.hinted = true; motion.hint('スマホをかたむけると群れがすべり、ふるとびっくりします'); }
    const ca = Math.cos(cam.a || 0), sa = Math.sin(cam.a || 0);
    const sx = clamp(dead(motion.roll, .06), -.6, .6), sy = clamp(dead(motion.pitch, .06), -.6, .6);
    mo.x = (ca * sx + sa * sy) * 7; mo.z = (-sa * sx + ca * sy) * 7;
    mo.talkT -= dt;
    if (Math.hypot(sx, sy) > .22 && mo.talkT <= 0 && count) {
      mo.talkT = rnd(.5, 1.1); bubble(sh[(Math.random() * count) | 0], pick(['わわっ', 'すべるメェ〜', '坂だメェ', 'ころがるメェ', 'おっとっと']), true);
      if (Math.random() < .4) noise('bleat', { rate: rnd(1.05, 1.3) });
    }
    if (motion.fresh(mo.seen)) shakeAll(motion.shakePow, motion.shakeDir);
    mo.seen = motion.shakes;
  }
  function shakeAll(pw, dir) {
    const ca = Math.cos(cam.a || 0), sa = Math.sin(cam.a || 0);
    const wx = -(ca * dir.x - sa * dir.y), wz = -(-sa * dir.x - ca * dir.y);      // against the jerk (screen up = into the scene)
    let talk = 0;
    for (let i = 0; i < count; i++) {
      const s = sh[i]; s.vx += wx * pw * rnd(1.5, 4); s.vz += wz * pw * rnd(1.5, 4);
      if (busy(s)) continue;
      const r = Math.random(), k = r < .5 ? 'hop' : r < .7 ? 'boing' : r < .85 ? 'spin' : r < .95 && pw > .6 ? 'flop' : 'baa';
      s.rx = rx(k, DUR[k] * rnd(.9, 1.15), rnd(0, .22), { hops: pw > .7 ? 2 : 1, h: rnd(3.4, 4.6) * (.7 + pw * .3), say: false, dir: Math.random() < .5 ? -1 : 1 });
      s.cool = rnd(1.2, 2);
      if (talk < 3 && Math.random() < .02) { talk++; bubble(s, pick(['じしん！？', 'ゆれてるメェ', 'わっ', 'ひゃっ', 'メェ〜！']), true); }
    }
    noise('pon', { vol: .45 }); setTimeout(() => sfx.bleat({ vol: .3, rate: rnd(1.1, 1.3) }), 120);
  }
  function step(dt, t) {
    const n = count;
    let arrived = 0;
    motionStep(dt);
    for (let i = 0; i < n; i++) {
      const s = sh[i];
      let dvx = 0, dvz = 0, maxV = 1;
      s.t -= dt; if (s.cool > 0) s.cool -= dt;
      if (s.mode === 'graze' || s.mode === 'wander') {
        if (s.t <= 0) {
          if (s.mode === 'graze') { s.mode = 'wander'; const a = rnd(0, 6.28), r = Math.sqrt(Math.random()) * WANDER_R; s.wx = Math.cos(a) * r; s.wz = Math.sin(a) * r; s.t = rnd(4, 9); }
          else { s.mode = 'graze'; s.t = rnd(2, 6); }
        }
        if (s.mode === 'wander') { const dx = s.wx - s.x, dz = s.wz - s.z, d = Math.hypot(dx, dz) || 1; if (d < .5) { s.mode = 'graze'; s.t = rnd(2, 5); } else { dvx = dx / d * 1.1 * s.speed; dvz = dz / d * 1.1 * s.speed; } }
        s.hpT = s.mode === 'graze' ? .75 : 0; maxV = 1.4;
      } else if (s.mode === 'go' || s.mode === 'formed') {
        if (s.delay > 0) { s.delay -= dt; s.hpT = .2; s.hyT = Math.sin(t * 2 + s.ph) * .5; }
        else {
          // little fidgets while in formation: shuffle, look around, graze a bit, hop
          s.fidget -= dt;
          if (s.mode === 'formed' && s.fidget <= 0) {
            s.fidget = rnd(2, 8);
            const r = Math.random();
            if (s.restless && r < .45) { s.ox = rnd(-.35, .35); s.oz = rnd(-.35, .35); }
            else if (r < .6) { s.ox = 0; s.oz = 0; }
            if (Math.random() < .3) s.hpT = rnd(.4, .8); else s.hpT = 0;
            s.hyT = rnd(-.6, .6);
            if (Math.random() < .08 && s.hop === 0) s.hv = rnd(3, 4.5);
          }
          const tx = s.tx + s.ox, tz = s.tz + s.oz, dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
          const run = 7.5 * s.speed, wob = Math.sin(t * 1.7 + s.ph) * .35;      // slight curve while running
          if (d > .12) {
            const sp = Math.min(run, d * 2.2);
            dvx = (dx / d) * sp + (-dz / d) * wob * Math.min(1, d / 6); dvz = (dz / d) * sp + (dx / d) * wob * Math.min(1, d / 6);
            if (d > 2) s.hpT = 0;
          }
          if (d < .45) { s.mode = 'formed'; arrived++; } else if (s.mode === 'formed' && d > 1.2) s.mode = 'go';
          maxV = run + 1;
        }
      }
      // hover reactions: timers, extra hops, running away, walking over to look, lying still after a faint
      const r = s.rx;
      if (r) {
        if (r.delay > 0) r.delay -= dt;
        else {
          if (!r.go) { r.go = true; startRx(s, r); }
          r.t += dt;
          if (r.k === 'hop' && r.hops > 1 && r.t > .15 && s.hop === 0 && s.hv === 0) { r.hops--; s.hv = r.h * .8; }
          if (r.k === 'flee') { const f = Math.max(0, 1 - r.t / r.d); dvx += r.fx * r.pow * f; dvz += r.fz * r.pow * f; maxV = Math.max(maxV, r.pow); s.hpT = -.1; }
          else if (r.k === 'flop' || r.k === 'shake') { dvx = dvz = 0; }
          else if (r.k === 'look' && hov.on && (s.mode === 'graze' || s.mode === 'wander')) {
            const dx = hov.x - s.x, dz = hov.z - s.z, d = Math.hypot(dx, dz) || 1;
            if (d > 1.8) { dvx = dx / d * 1.4 * s.speed; dvz = dz / d * 1.4 * s.speed; maxV = Math.max(maxV, 1.6); } else { dvx = dvz = 0; }
            s.t = Math.max(s.t, .5);
          }
          if (r.t >= r.d) s.rx = null;
        }
      }
      if (mo.x || mo.z) { dvx += mo.x * s.speed; dvz += mo.z * s.speed; maxV = Math.max(maxV, Math.hypot(mo.x, mo.z) + 1); }
      // accelerate toward the desired velocity
      const k = Math.min(1, dt * 4);
      s.vx += (dvx - s.vx) * k; s.vz += (dvz - s.vz) * k;
      const sp2 = Math.hypot(s.vx, s.vz); if (sp2 > maxV) { s.vx *= maxV / sp2; s.vz *= maxV / sp2; }
      s.x += s.vx * dt; s.z += s.vz * dt;
    }
    // soft collisions between sheep (spatial hash) and with obstacles
    grid.clear();
    for (let i = 0; i < n; i++) { const s = sh[i], key = (Math.floor(s.x) * 73856093) ^ (Math.floor(s.z) * 19349663); let b = grid.get(key); if (!b) grid.set(key, b = []); b.push(i); }
    for (let i = 0; i < n; i++) {
      const a = sh[i], cx = Math.floor(a.x), cz = Math.floor(a.z);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const b = grid.get(((cx + ox) * 73856093) ^ ((cz + oz) * 19349663)); if (!b) continue;
        for (const j of b) {
          if (j <= i) continue;
          const o = sh[j], dx = o.x - a.x, dz = o.z - a.z, d2 = dx * dx + dz * dz, R2 = (RC * 2) ** 2;
          if (d2 < R2 && d2 > 1e-6) {
            const d = Math.sqrt(d2), push = (RC * 2 - d) * .5, nx = dx / d, nz = dz / d;
            // formed sheep are heavier, so latecomers squeeze in around them
            const wa = a.mode === 'formed' ? .3 : .5, wb = o.mode === 'formed' ? .3 : .5;
            a.x -= nx * push * wa * 1.4; a.z -= nz * push * wa * 1.4; o.x += nx * push * wb * 1.4; o.z += nz * push * wb * 1.4;
          }
        }
      }
      for (const [ox, oz, r] of OB) { const dx = a.x - ox, dz = a.z - oz, d = Math.hypot(dx, dz), rr = r + RC; if (d < rr && d > 1e-4) { a.x = ox + dx / d * rr; a.z = oz + dz / d * rr; } }
      const dc = Math.hypot(a.x, a.z); if (dc > FR - 1.2) { a.x *= (FR - 1.2) / dc; a.z *= (FR - 1.2) / dc; }
    }
    hoverStep(dt);
    return arrived;
  }
  function frame(dt, t) {
    dt = Math.min(dt || 0, .05);
    if (count !== N()) setCount(N());
    SC += (SCt - SC) * Math.min(1, (dt || .016) * 2);
    const arrived = dt ? step(dt, t) : 0;
    // write instance matrices
    const n = count;
    for (let i = 0; i < n; i++) {
      const s = sh[i], spd = Math.hypot(s.vx, s.vz);
      const r = s.rx && s.rx.go ? s.rx : null, u = r ? clamp(r.t / r.d, 0, 1) : 0;
      const looking = r && r.k === 'look' && hov.ok;
      if (spd > .2) { const want = Math.atan2(-s.vz, s.vx); let dy = want - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); s.yaw += dy * Math.min(1, dt * 7); }
      else if (looking && s.mode === 'formed') { let dy = Math.atan2(-(hov.z - s.z), hov.x - s.x) - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); s.yaw += clamp(dy, -.9, .9) * Math.min(1, dt * 3); }
      else if (s.mode === 'formed') { let dy = (-Math.PI / 2 + Math.sin(s.ph) * .35) - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); s.yaw += dy * Math.min(1, dt * 1.5); }
      s.ph += dt * (2 + spd * 2.2);
      // hop (gallop bounce when running fast, occasional happy hop)
      if (s.hv) { s.hop += s.hv * dt; s.hv -= 12 * dt; if (s.hop <= 0) { s.hop = 0; s.hv = 0; } }
      const gallop = spd > 4 ? Math.abs(Math.sin(s.ph)) * .28 : Math.abs(Math.sin(s.ph)) * .05 * Math.min(1, spd);
      // reaction poses: head targets, spin, faint (roll onto the back, legs kicking), wool shake, squash & stretch
      let spin = 0, roll = 0, sx = 1, sy = 1, kick = 0;
      if (looking) { let rel = Math.atan2(-(hov.z - s.z), hov.x - s.x) - s.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel)); s.hyT = clamp(rel, -1.1, 1.1); s.hpT = -.18; }
      else if (r) {
        if (r.k === 'spin') spin = easeIO(u) * Math.PI * 2 * r.dir;
        else if (r.k === 'flop') {
          const f = u < .13 ? (u / .13) ** 2 : u < .24 ? 1 - Math.sin((u - .13) / .11 * Math.PI) * .12 : u < .8 ? 1 : 1 - easeIO((u - .8) / .2);
          roll = f * 2.75 * r.dir; kick = u > .2 && u < .8 ? 1 : 0; s.hpT = 0;
        } else if (r.k === 'shake') { roll = Math.sin(r.t * 40) * .24 * (1 - u); s.hyT = Math.sin(r.t * 40 + 1) * .5 * (1 - u); }
        else if (r.k === 'boing') { const w = Math.sin(u * Math.PI * 3.5) * (1 - u) * .38; sy = 1 + w; sx = 1 - w * .45; }
        else if (r.k === 'baa') { s.hpT = u < .75 ? -.55 : 0; s.hyT = Math.sin(r.t * 22) * .12 * (u < .75 ? 1 : 0); }
      }
      s.headP += (s.hpT - s.headP) * Math.min(1, dt * (r ? 8 : 3)); s.headY += (s.hyT - s.headY) * Math.min(1, dt * (r ? 9 : 2.5));
      if (s.mode !== 'formed' && s.mode !== 'go' && !looking && !r) s.hyT = Math.sin(t * .7 + s.ph) * .3;
      Q.setFromAxisAngle(Y, s.yaw + spin); V.set(s.x, s.hop + gallop, s.z);
      const lean = spd > 4 ? Math.sin(s.ph * 2) * .06 : 0;
      M.compose(V, Q, ONE.set(SC * sx, SC * sy, SC * sx)); if (lean) M.multiply(T1.makeRotationZ(lean));
      if (roll) M.multiply(T1.makeTranslation(0, .85, 0)).multiply(T2.makeRotationX(roll)).multiply(T1.makeTranslation(0, -.85, 0));
      // head: pitch down to graze / yaw to look around, pivoting at the neck
      E.set(0, s.headY, -s.headP); Qh.setFromEuler(E);
      Mh.copy(M).multiply(T1.makeTranslation(NECK.x, NECK.y, NECK.z)).multiply(T2.makeRotationFromQuaternion(Qh)).multiply(T1.makeTranslation(-NECK.x, -NECK.y, -NECK.z));
      for (let j = 0; j < mW.length; j++) {
        const base = HEADW.has(j) ? Mh : M;
        iWool.setMatrixAt(i * mW.length + j, tmp.multiplyMatrices(base, mW[j]));
        iOut.setMatrixAt(i * mO.length + j, tmp.multiplyMatrices(base, mO[j]));
      }
      for (let j = 0; j < mI.length; j++) iInk.setMatrixAt(i * mI.length + j, tmp.multiplyMatrices(Mh, mI[j]));
      // legs swing from the hip; diagonal pairs move together
      const amp = Math.min(.7, spd * .16 + (s.hop > 0 ? .4 : 0));
      for (let j = 0; j < mL.length; j++) {
        const p = P_LEG[j], sw = kick ? Math.sin(t * 17 + j * 1.9) * .55 : Math.sin(s.ph * 1.6 + (j === 0 || j === 3 ? 0 : Math.PI)) * amp;
        Ml.copy(M).multiply(T1.makeTranslation(p[0], HIPY, p[2])).multiply(T2.makeRotationZ(sw)).multiply(T1.makeTranslation(-p[0], -HIPY, -p[2]));
        iLeg.setMatrixAt(i * mL.length + j, tmp.multiplyMatrices(Ml, mL[j]));
      }
    }
    iWool.instanceMatrix.needsUpdate = iOut.instanceMatrix.needsUpdate = iInk.instanceMatrix.needsUpdate = iLeg.instanceMatrix.needsUpdate = true;
    // shape cycle
    if (cycling && dt) {
      shapeT += dt;
      arrivedRatio = arrived / count;
      countEl.textContent = `ひつじ ${count}匹 ・ 到着 ${Math.round(arrivedRatio * 100)}%`;
      if (arrivedRatio > .9 || shapeT > 11) {
        holdT += dt;
        msg.classList.toggle('show', shapeIx === 0); if (shapeIx === 0) formedOnce = true;
        if (holdT > 5.5) nextShape();
      }
    } else if (!cycling) countEl.textContent = `ひつじ ${count}匹`;
    // environment motion
    clouds.forEach((c, k) => { c.position.x += dt * (.6 + k * .1); if (c.position.x > 90) c.position.x = -90; });
    for (let i = 0; i < SN; i++) { sp[i * 3 + 1] -= sv[i] * dt; sp[i * 3] += Math.sin(t * .5 + i) * .4 * dt; if (sp[i * 3 + 1] < 0) { sp[i * 3 + 1] = 30; sp[i * 3] = rnd(-45, 45); sp[i * 3 + 2] = rnd(-45, 45); } }
    sg.attributes.position.needsUpdate = true; snow.material.uniforms.time.value = t;
    // camera: live target for the current shot, reached through the swoop tween after every change
    const fovT = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    const ew = cycling ? extent[0] : (isPC() ? 50 : 28), eh = cycling ? extent[1] : 30;
    const tgt = {
      d: Math.max(ew / 2 / (fovT * aspect), eh / 2 / fovT) * 1.12,
      polar: clamp((cycling ? .42 : 1.25) + tiltOff, .25, 1.4),
      a: az + (cycling ? 0 : Math.sin(t * .07) * .3),
      lz: cycling ? 0 : (isPC() ? 2 : 4)
    };
    camRoll = 0;
    if (!cam.d || !camTw) Object.assign(cam, tgt);
    else {
      camTw.t += dt;
      const u = clamp(camTw.t / camTw.dur, 0, 1), e = easeIO(u), arc = Math.sin(Math.PI * u);
      for (const k in tgt) cam[k] = camTw.from[k] + (tgt[k] - camTw.from[k]) * e;
      cam.d *= 1 + arc * camTw.lift; cam.a += arc * camTw.swing; camRoll = arc * camTw.swing * -.1;
      if (u >= 1) camTw = null;
    }
    const sp_ = Math.sin(cam.polar);
    camera.position.set(Math.sin(cam.a) * sp_ * cam.d, Math.cos(cam.polar) * cam.d + 1, Math.cos(cam.a) * sp_ * cam.d);
    camera.lookAt(0, 0, cam.lz);
    if (camRoll) camera.rotateZ(camRoll);
    // speech bubbles follow their sheep on screen: pop in, float up a little, fade out
    for (let k = bubbles.length - 1; k >= 0; k--) {
      const b = bubbles[k]; b.t += dt;
      const u = b.t / 1.15;
      if (u >= 1) { b.el.remove(); bubbles.splice(k, 1); continue; }
      BV.set(b.s.x, 1.75 * SC + b.s.hop, b.s.z).project(camera);
      if (BV.z > 1) { b.el.style.opacity = 0; continue; }
      const x = (BV.x + 1) / 2 * root.clientWidth, y = (1 - BV.y) / 2 * root.clientHeight - u * 16;
      const sc = u < .16 ? 1 + 2.70158 * Math.pow(u / .16 - 1, 3) + 1.70158 * Math.pow(u / .16 - 1, 2) : 1;
      b.el.style.opacity = u > .72 ? 1 - (u - .72) / .28 : 1;
      b.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%) scale(${Math.max(0, sc).toFixed(3)})`;
    }
  }
  function resize(w, h) { aspect = w / h; camera.aspect = aspect; camera.updateProjectionMatrix(); snow.fit(renderer, camera, h); }
  setCount(N());
  for (let k = 0; k < 30; k++) step(1 / 30, k / 30);
  root._fl = { camera, cam, hov, pokeAt, tween: () => camTw };   // test hook
  return { scene, camera, frame, resize, onMode() { setCount(N()); if (cycling) { shapeIx--; nextShape(); } } };
});

/* ================= J: pop-up card (5-scene pop-up book) ================= */
stage('#popup', (root, renderer, canvas) => {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(35, 1, .1, 100);
  scene.add(new T.HemisphereLight(0xffffff, 0xB9CCEE, .85));
  const key = new T.DirectionalLight(0xffffff, .65); key.position.set(-4, 10, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); key.shadow.bias = -.0005; key.shadow.radius = 4;
  scene.add(key);
  const catcher = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: .14 }));
  catcher.rotation.x = -Math.PI / 2; catcher.receiveShadow = true; scene.add(catcher);

  const PW = 3.2, PD = 4.4, TH = .04, TW = 1024, TH_ = Math.round(1024 * PD / PW);
  const RED = 0xD63637, GREEN = 0x00A86B;
  const paper = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .85 });
  const std = (color, o = {}) => new T.MeshStandardMaterial(Object.assign({ color, roughness: .75 }, o));
  const mat = t => new T.MeshStandardMaterial({ map: t, roughness: .8 });
  const backTex = t => { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(-1, -1); t.offset.set(1, 1); return t; };
  const book = new T.Group(); scene.add(book);

  /* ----- the message, split across the five left-hand pages ----- */
  const MSG = [
    { lead: 'あけまして\nおめでとうございます', body: '旧年中は格別のご厚情を賜り、誠にありがとうございました。皆さまに支えられ、たくさんの「オモシロイ」を形にできた一年でした。' },
    { lead: '「未」は\n「未来」の「未」', body: '2027年は未（ひつじ）年。新しい年の始まりに、皆さまのご健康とご多幸を心よりお祈り申し上げます。' },
    { lead: 'あしたを\nオモシロク', body: '私たちbravesoftは、アプリやイベントの体験づくりを通して、毎日を少しだけ楽しくすることに挑み続けてまいりました。' },
    { lead: '未来を、\n一緒に描く', body: '今年はその「未来」を、皆さまと一緒にもっと大きく描いていきたいと考えています。まだ誰も見たことのない体験を、ともに。' },
    { lead: '本年も\nよろしくお願いします', body: '本年も変わらぬご愛顧のほど、"ひつじょう"によろしくお願い申し上げます。', sign: true }
  ];
  const msgTex = (m, i) => canvasTex(TW, TH_, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0066FF'; g.fillRect(0, 0, 14, h);
    g.font = `500 30px ${MONO}`; g.fillText(`MESSAGE FROM CEO   ${i + 1} / ${MSG.length}`, 80, 130);
    g.fillStyle = '#090A0A'; g.font = `900 76px ${JP}`;
    m.lead.split('\n').forEach((l, k) => g.fillText(l, 76, 260 + k * 96));
    g.font = `400 42px ${JP}`; g.fillStyle = '#202325';
    let y = 520; wrapJP(g, m.body, w - 160).forEach(l => { g.fillText(l, 80, y); y += 70; });
    if (m.sign) {
      g.fillStyle = '#6C7072'; g.font = `400 36px ${JP}`;
      g.fillText('2027年 元旦', 80, h - 210); g.fillText('bravesoft株式会社', 80, h - 155); g.fillText('代表取締役 〇〇 〇〇', 80, h - 100);
    } else {
      g.fillStyle = '#0066FF'; g.font = `700 32px ${JP}`; g.fillText('つづきは次のページへ →', 80, h - 100);
    }
    drawSheepCard(g, w - 124 * 1.6 - 70, h - 92 * 1.6 - 70, 1.6);
  });

  /* ----- right-hand scene backgrounds ----- */
  const SCN = [
    { title: '初日の出', en: '01 / FIRST SUNRISE', top: '#2247FF', bot: '#0066FF', ink: '#fff' },
    { title: '初詣', en: '02 / SHRINE VISIT', top: '#0B1C3F', bot: '#253A58', ink: '#fff' },
    { title: 'お正月かざり', en: '03 / NEW YEAR DECOR', top: '#3F9CFF', bot: '#0066FF', ink: '#fff' },
    { title: '書き初め', en: '04 / FIRST CALLIGRAPHY', top: '#F7F9FA', bot: '#E5F0FF', ink: '#090A0A' },
    { title: '凧あげ', en: '05 / KITE FLYING', top: '#00BBFF', bot: '#3F9CFF', ink: '#fff' }
  ];
  const sceneTex = s => canvasTex(TW, TH_, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, s.top); gr.addColorStop(1, s.bot);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = s.ink === '#fff' ? 'rgba(255,255,255,.10)' : 'rgba(0,102,255,.08)';
    for (let y = 40; y < h; y += 90) for (let x = (y / 90 % 2) * 45 + 40; x < w; x += 90) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
    g.textAlign = 'center';
    g.fillStyle = s.ink === '#fff' ? '#FFE94A' : '#0066FF'; g.font = `700 36px ${MONO}`; g.fillText(s.en, w / 2, h - 130);
    g.fillStyle = s.ink; g.font = `900 60px ${JP}`; g.fillText(s.title, w / 2, h - 52);
  });
  const texOuter = canvasTex(TW, TH_, (g, w, h) => {
    g.fillStyle = '#0066FF'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.1)'; g.font = `700 ${w * .52}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('20', w / 2, h * .34); g.fillText('27', w / 2, h * .7);
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = `500 34px ${MONO}`; g.fillText('HAPPY NEW YEAR 2027', 80, 150);
    g.font = `900 150px ${JP}`; g.fillText('謹賀新年', 72, 330);
    g.font = `700 44px ${JP}`; g.fillText('未年は、未来の年。', 80, 420);
    drawSheepCard(g, w - 124 * 4.6 - 40, h * .7 - 46 * 4.6, 4.6);
    g.fillStyle = '#FFE94A'; g.font = `700 36px ${JP}`; g.fillText('5つの場面が飛び出します →', 80, h - 200);
    g.fillStyle = '#fff'; g.font = `900 56px ${JP}`; g.fillText('bravesoft', 80, h - 90);
  });
  const allTex = [texOuter];

  /* ----- pages: base (static, scene 5) + 5 turning leaves (cover, scenes 1-4) ----- */
  const LEAVES = 5;
  const sceneTexes = SCN.map(sceneTex), msgTexes = MSG.map(msgTex);
  allTex.push(...sceneTexes, ...msgTexes);
  const base = new T.Group(); book.add(base);
  const baseMesh = new T.Mesh(new T.BoxGeometry(PW, TH, PD), [paper, paper, mat(sceneTexes[4]), paper, paper, paper]);
  baseMesh.position.set(PW / 2, TH / 2, 0); baseMesh.castShadow = baseMesh.receiveShadow = true; base.add(baseMesh);
  const leaves = [];
  for (let i = 0; i < LEAVES; i++) {
    const pivot = new T.Group();
    const front = i === 0 ? mat(texOuter) : mat(sceneTexes[i - 1]);
    const back = mat(backTex(msgTexes[i]));
    const m = new T.Mesh(new T.BoxGeometry(PW, TH, PD), [paper, paper, front, back, paper, paper]);
    m.position.set(PW / 2, TH / 2, 0); m.castShadow = m.receiveShadow = true;
    pivot.add(m); book.add(pivot);
    leaves.push({ pivot, a: 0, target: 0 });
  }
  // scene j (0-4) sits on leaf j+1 (or on the base for the last one)
  const sceneHost = j => (j < 4 ? leaves[j + 1].pivot : base);

  /* ----- pop-up helpers ----- */
  const pops = [];   // { pivot, scene, start, span }
  const addPop = (scn, obj, x, z, start, span = .35) => {
    const pivot = new T.Group(); pivot.position.set(x, TH, z); pivot.add(obj); pivot.visible = false;
    sceneHost(scn).add(pivot); pops.push({ pivot, scn, start, span }); return pivot;
  };
  const outline = new T.MeshBasicMaterial({ color: C.ink, side: T.BackSide });
  const sheepO = (s, ry) => {
    const g = makeSheep();
    g.children.slice().forEach(m => { if (m.material !== woolMat) return; const o = new T.Mesh(m.geometry, outline); o.position.copy(m.position); o.scale.copy(m.scale).multiplyScalar(1.09); g.add(o); });
    g.scale.setScalar(s); g.rotation.y = ry; return g;
  };
  const shadowAll = g => { g.traverse(m => { if (m.isMesh) m.castShadow = true; }); return g; };
  const textPlane = (w, h, draw, pw, ph) => new T.Mesh(new T.PlaneGeometry(pw, ph), new T.MeshStandardMaterial({ map: (() => { const t = canvasTex(w, h, draw); allTex.push(t); return t; })(), side: T.DoubleSide, roughness: .7 }));
  const tree = s => {
    const t = new T.Group(), m = std(0x0B1C3F, { flatShading: true });
    const c1 = new T.Mesh(new T.ConeGeometry(.32, .7, 7), m); c1.position.y = .55;
    const c2 = new T.Mesh(new T.ConeGeometry(.24, .5, 7), m); c2.position.y = .9;
    const tr = new T.Mesh(new T.CylinderGeometry(.05, .06, .25, 6), inkMat); tr.position.y = .12;
    t.add(c1, c2, tr); t.scale.setScalar(s); return shadowAll(t);
  };
  const cloud = (y, s) => {
    const c = new T.Group();
    [[0, 0, .32], [.3, .05, .26], [-.3, .02, .24], [.12, .2, .24], [-.14, .18, .2]].forEach(([cx, cy, r]) => { const m = new T.Mesh(new T.CircleGeometry(r, 24), std(0xC3DEFF, { side: T.DoubleSide })); m.position.set(cx, cy, 0); c.add(m); });
    const wire = new T.Mesh(new T.BoxGeometry(.02, y, .02), paper); wire.position.y = -y / 2; c.add(wire);
    c.position.y = y; c.scale.setScalar(s); return c;
  };
  const signBoard = (text, bg, fg, w = 1.15, hgt = .5, post = .55) => {
    const g = new T.Group();
    const b = textPlane(512, Math.round(512 * hgt / w), (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = fg; c.font = `700 ${H * .62}px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, H / 2 + 6); }, w, hgt);
    b.position.y = post + hgt / 2 - .02;
    const p = new T.Mesh(new T.BoxGeometry(.06, post, .04), std(0xffffff)); p.position.y = post / 2;
    g.add(b, p); return shadowAll(g);
  };
  const anim = [];   // per-frame extras (t) => void

  /* ===== scene 1: first sunrise over Mt. Fuji ===== */
  {
    const fs = new T.Shape(); fs.moveTo(-1.6, 0); fs.lineTo(-.42, 1.35); fs.lineTo(-.22, 1.42); fs.lineTo(0, 1.36); fs.lineTo(.2, 1.44); fs.lineTo(.42, 1.35); fs.lineTo(1.6, 0); fs.lineTo(-1.6, 0);
    const cs = new T.Shape(); cs.moveTo(-.42, 1.35); cs.lineTo(-.22, 1.42); cs.lineTo(0, 1.36); cs.lineTo(.2, 1.44); cs.lineTo(.42, 1.35); cs.lineTo(.62, 1.1); cs.lineTo(.36, 1.0); cs.lineTo(.16, 1.12); cs.lineTo(-.06, .98); cs.lineTo(-.3, 1.1); cs.lineTo(-.62, 1.1);
    const fuji = new T.Mesh(new T.ShapeGeometry(fs), std(C.navy, { side: T.DoubleSide }));
    const cap = new T.Mesh(new T.ShapeGeometry(cs), std(0xffffff, { side: T.DoubleSide })); cap.position.z = .005;
    const sun = new T.Mesh(new T.CircleGeometry(.5, 40), new T.MeshBasicMaterial({ color: C.yellow, side: T.DoubleSide })); sun.position.set(.55, .7, -.02);
    const g = new T.Group(); g.add(sun, fuji, cap); shadowAll(g);
    addPop(0, g, PW / 2, -1.85, .0);
    anim.push((t, f) => { sun.position.y = .3 + .6 * Math.max(0, f[0] - .5) * 2; });
    const c1 = cloud(1.75, .8), c2 = cloud(2.1, .7);
    addPop(0, c1, PW * .22, -1.45, .1); addPop(0, c2, PW * .8, -1.5, .15);
    anim.push(t => { c1.position.x = Math.sin(t * .6) * .08; c2.position.x = Math.sin(t * .5 + 1) * .08; });
    addPop(0, tree(1), PW * .12, -.95, .15); addPop(0, tree(.8), PW * .9, -.75, .2);
    const sh = sheepO(1.05, -Math.PI / 2 + .25); addPop(0, sh, PW * .5, .35, .1);
    const l1 = sheepO(.6, -Math.PI / 2 - .6); addPop(0, l1, PW * .17, 1.15, .25, .3);
    const l2 = sheepO(.55, -Math.PI / 2 + .9); addPop(0, l2, PW * .84, .55, .3, .3);
    const sg = signBoard('2027', '#FFE94A', '#090A0A'); sg.rotation.y = -.25; addPop(0, sg, PW * .74, 1.55, .35, .3);
    anim.push(t => { sh.position.y = Math.abs(Math.sin(t * 3)) * .08; l1.position.y = Math.abs(Math.sin(t * 3.6 + 1)) * .06; l2.position.y = Math.abs(Math.sin(t * 3.3 + 2)) * .06; });
  }

  /* ===== scene 2: shrine visit (hatsumode) ===== */
  {
    const torii = new T.Group(), red = std(RED);
    [-.6, .6].forEach(x => { const p = new T.Mesh(new T.CylinderGeometry(.065, .075, 1.35, 12), red); p.position.set(x, .675, 0); torii.add(p); });
    const kasagi = new T.Mesh(new T.BoxGeometry(1.75, .1, .16), std(C.ink)); kasagi.position.y = 1.42;
    const shimaki = new T.Mesh(new T.BoxGeometry(1.6, .08, .14), red); shimaki.position.y = 1.32;
    const nuki = new T.Mesh(new T.BoxGeometry(1.45, .07, .09), red); nuki.position.y = 1.08;
    const gaku = new T.Mesh(new T.BoxGeometry(.18, .2, .04), std(C.ink)); gaku.position.set(0, 1.2, .05);
    torii.add(kasagi, shimaki, nuki, gaku); shadowAll(torii);
    addPop(1, torii, PW / 2, -.55, .0);
    const shrine = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(.9, .55, .6), std(0xF7F9FA)); body.position.y = .275;
    const rs = new T.Shape(); rs.moveTo(-.62, 0); rs.lineTo(0, .38); rs.lineTo(.62, 0); rs.lineTo(-.62, 0);
    const roof = new T.Mesh(new T.ExtrudeGeometry(rs, { depth: .78, bevelEnabled: false }), std(C.ink, { flatShading: true })); roof.position.set(0, .55, -.39);
    const door = new T.Mesh(new T.PlaneGeometry(.36, .36), std(RED)); door.position.set(0, .2, .301);
    const bell = new T.Mesh(new T.SphereGeometry(.06, 12, 8), std(C.yellow, { metalness: .4, roughness: .3 })); bell.position.set(0, .48, .34);
    shrine.add(body, roof, door, bell); shadowAll(shrine);
    addPop(1, shrine, PW / 2, -1.6, .1);
    // lanterns
    [.18, .82].forEach((fx, k) => {
      const l = new T.Group();
      const post = new T.Mesh(new T.CylinderGeometry(.03, .03, .55, 6), std(C.ink)); post.position.y = .27;
      const lamp = new T.Mesh(new T.CylinderGeometry(.11, .11, .2, 12), new T.MeshBasicMaterial({ color: C.yellow })); lamp.position.y = .64;
      const lid = new T.Mesh(new T.ConeGeometry(.15, .1, 12), std(C.ink)); lid.position.y = .79;
      l.add(post, lamp, lid); shadowAll(l);
      addPop(1, l, PW * fx, .15, .2 + k * .05);
      const pl = new T.PointLight(0xFFE94A, .35, 1.6); pl.position.y = .64; l.add(pl);
    });
    // omikuji rack with tied fortunes
    const rack = new T.Group();
    [-.32, .32].forEach(x => { const p = new T.Mesh(new T.BoxGeometry(.04, .5, .04), std(C.ink)); p.position.set(x, .25, 0); rack.add(p); });
    [.3, .44].forEach(y => { const b = new T.Mesh(new T.BoxGeometry(.68, .02, .02), std(C.ink)); b.position.y = y; rack.add(b); });
    for (let k = 0; k < 9; k++) { const p = new T.Mesh(new T.BoxGeometry(.05, .1, .02), std(0xffffff)); p.position.set(-.26 + k * .065, k % 2 ? .38 : .24, .02); p.rotation.z = (k % 3 - 1) * .2; rack.add(p); }
    shadowAll(rack); addPop(1, rack, PW * .8, -.85, .25);
    const s1 = sheepO(.62, Math.PI / 2 - .35); addPop(1, s1, PW * .3, 1.05, .3);   // facing the shrine
    const s2 = sheepO(.45, Math.PI / 2 + .35); addPop(1, s2, PW * .7, 1.2, .35, .3);
    anim.push(t => { s1.rotation.x = Math.max(0, Math.sin(t * 1.4)) * .25; s2.rotation.x = Math.max(0, Math.sin(t * 1.4 + .6)) * .25; });
  }

  /* ===== scene 3: New Year decorations ===== */
  {
    const kadomatsu = () => {
      const g = new T.Group();
      const pot = new T.Mesh(new T.CylinderGeometry(.22, .24, .26, 16), std(C.navy)); pot.position.y = .13; g.add(pot);
      const rope = new T.Mesh(new T.TorusGeometry(.235, .02, 6, 24), std(C.yellow)); rope.rotation.x = Math.PI / 2; rope.position.y = .2; g.add(rope);
      [[0, .05, 1.05], [-.09, -.05, .85], [.09, -.05, .7]].forEach(([x, z, hgt]) => {
        const b = new T.Mesh(new T.CylinderGeometry(.065, .065, hgt, 12), std(GREEN)); b.position.set(x, hgt / 2, z); g.add(b);
        const cut = new T.Mesh(new T.CircleGeometry(.065, 16), std(0xEAF7EE, { side: T.DoubleSide })); cut.position.set(x, hgt + .01, z); cut.rotation.x = -Math.PI / 2 + .7; g.add(cut);
      });
      for (let k = 0; k < 6; k++) { const p = new T.Mesh(new T.ConeGeometry(.07, .22, 6), std(0x0B1C3F)); const a = k / 6 * 6.28; p.position.set(Math.cos(a) * .2, .32, Math.sin(a) * .2); p.rotation.z = Math.cos(a) * .6; p.rotation.x = -Math.sin(a) * .6; g.add(p); }
      return shadowAll(g);
    };
    addPop(2, kadomatsu(), PW * .14, -1.2, .0);
    addPop(2, kadomatsu(), PW * .86, -1.2, .05);
    // kagami mochi on a stand
    const km = new T.Group();
    const stand = new T.Mesh(new T.BoxGeometry(.6, .22, .6), std(0xffffff)); stand.position.y = .11;
    const tray = new T.Mesh(new T.BoxGeometry(.66, .04, .66), std(C.navy)); tray.position.y = .24;
    const m1 = new T.Mesh(new T.SphereGeometry(.27, 24, 16), std(0xffffff)); m1.scale.y = .5; m1.position.y = .36;
    const m2 = new T.Mesh(new T.SphereGeometry(.2, 24, 16), std(0xffffff)); m2.scale.y = .52; m2.position.y = .5;
    const dai = new T.Mesh(new T.SphereGeometry(.1, 16, 12), std(C.yellow)); dai.position.y = .65;
    const leaf = new T.Mesh(new T.ConeGeometry(.04, .14, 6), std(GREEN)); leaf.position.set(.06, .74, 0); leaf.rotation.z = -.9;
    km.add(stand, tray, m1, m2, dai, leaf); shadowAll(km);
    addPop(2, km, PW / 2, -1.05, .1);
    // 謹賀新年 banner
    const ban = signBoard('謹賀新年', '#FFE94A', '#090A0A', 1.5, .42, .95);
    addPop(2, ban, PW / 2, -1.85, .05);
    const s1 = sheepO(.95, -Math.PI / 2 + .35); addPop(2, s1, PW * .35, .6, .2);
    const s2 = sheepO(.55, -Math.PI / 2 - .7); addPop(2, s2, PW * .72, .9, .3, .3);
    // a hagoita shuttle bouncing between the two sheep
    const shuttle = new T.Mesh(new T.SphereGeometry(.05, 10, 8), std(C.ink)); const feather = new T.Mesh(new T.ConeGeometry(.05, .12, 6), std(C.yellow)); feather.position.y = .08; shuttle.add(feather);
    const shG = new T.Group(); shG.add(shuttle); addPop(2, shG, 0, 0, .35, .3);
    anim.push((t) => { const p = (Math.sin(t * 1.6) + 1) / 2; shuttle.position.set(PW * (.35 + .37 * p), 1.1 + Math.sin(p * Math.PI) * .6, .6 + .3 * p); shuttle.rotation.z = (p - .5) * 2; });
  }

  /* ===== scene 4: first calligraphy (kakizome) ===== */
  {
    const scroll = new T.Group();
    const paperP = textPlane(512, 740, (g, w, h) => {
      g.fillStyle = '#FFFDF7'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#090A0A'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `900 260px ${JP}`; g.fillText('未', w / 2, h * .3); g.fillText('来', w / 2, h * .66);
      g.fillStyle = '#D63637'; g.fillRect(w * .72, h * .86, 60, 60); g.fillStyle = '#fff'; g.font = `700 34px ${JP}`; g.fillText('羊', w * .72 + 30, h * .86 + 32);
      g.fillStyle = '#6C7072'; g.font = `500 26px ${MONO}`; g.textAlign = 'left'; g.fillText('2027.1.2', 30, h - 30);
    }, 1.0, 1.45);
    paperP.position.y = .95;
    const rodT = new T.Mesh(new T.CylinderGeometry(.035, .035, 1.15, 10), std(C.ink)); rodT.rotation.z = Math.PI / 2; rodT.position.y = 1.69;
    const rodB = rodT.clone(); rodB.position.y = .21;
    const hang = new T.Mesh(new T.BoxGeometry(.02, .5, .02), std(C.ink)); hang.position.y = 1.95;
    const stands = [-.6, .6].map(x => { const p = new T.Mesh(new T.BoxGeometry(.05, 2.2, .05), std(C.navy)); p.position.set(x, 1.1, -.05); return p; });
    const top = new T.Mesh(new T.BoxGeometry(1.3, .05, .05), std(C.navy)); top.position.set(0, 2.2, -.05);
    scroll.add(paperP, rodT, rodB, hang, top, ...stands); shadowAll(scroll);
    addPop(3, scroll, PW / 2, -1.45, .0);
    // low desk with brush and inkstone
    const desk = new T.Group();
    const dt = new T.Mesh(new T.BoxGeometry(1.2, .06, .55), std(C.navy)); dt.position.y = .22;
    [[-.52, -.2], [.52, -.2], [-.52, .2], [.52, .2]].forEach(([x, z]) => { const l = new T.Mesh(new T.BoxGeometry(.06, .2, .06), std(C.navy)); l.position.set(x, .1, z); desk.add(l); });
    const sheet = new T.Mesh(new T.BoxGeometry(.5, .005, .38), std(0xFFFDF7)); sheet.position.set(-.15, .255, 0);
    const ink = new T.Mesh(new T.BoxGeometry(.2, .05, .28), std(C.ink)); ink.position.set(.38, .275, 0);
    const brush = new T.Group(); const bh = new T.Mesh(new T.CylinderGeometry(.018, .018, .42, 8), std(0xF3E3C3)); const tip = new T.Mesh(new T.ConeGeometry(.03, .1, 8), std(C.ink)); tip.position.y = -.25; tip.rotation.x = Math.PI; brush.add(bh, tip);
    brush.position.set(-.05, .45, .05); brush.rotation.z = .5;
    desk.add(dt, sheet, ink, brush); shadowAll(desk);
    addPop(3, desk, PW / 2, -.1, .15);
    anim.push(t => { brush.position.x = -.15 + Math.sin(t * 2.2) * .12; brush.position.y = .45 + Math.abs(Math.cos(t * 2.2)) * .05; });
    const s1 = sheepO(.8, -Math.PI / 2 + .1); addPop(3, s1, PW * .22, .95, .25);
    const s2 = sheepO(.5, -Math.PI / 2 - .4); addPop(3, s2, PW * .8, 1.1, .3, .3);
    const sg = signBoard('未来', '#0066FF', '#ffffff', .8, .36, .45); sg.rotation.y = .3; addPop(3, sg, PW * .8, .45, .35, .3);
  }

  /* ===== scene 5: kite flying ===== */
  {
    const banner = new T.Group();
    const b = textPlane(1024, 180, (g, w, h) => { g.fillStyle = '#0066FF'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `900 92px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('あしたをオモシロク', w / 2, h / 2 + 4); }, 2.5, .44);
    b.position.y = 1.3;
    [-1.3, 1.3].forEach(x => { const p = new T.Mesh(new T.BoxGeometry(.05, 1.55, .05), std(0xffffff)); p.position.set(x, .78, 0); banner.add(p); });
    banner.add(b); shadowAll(banner);
    addPop(4, banner, PW / 2, -1.75, .0);
    addPop(4, tree(.8), PW * .1, -1.1, .05); addPop(4, tree(.65), PW * .92, -1.0, .1);
    const kiteTex = ch => (c, w, h) => {
      c.fillStyle = '#FFE94A'; c.fillRect(0, 0, w, h); c.strokeStyle = '#0066FF'; c.lineWidth = 18; c.strokeRect(9, 9, w - 18, h - 18);
      c.fillStyle = '#0066FF'; c.font = `900 ${w * .62}px ${JP}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, w / 2, h / 2 + 8);
    };
    const kites = [];
    [['未', PW * .3, .7, -.6, 2.3], ['来', PW * .7, .45, .5, 2.0], ['羊', PW * .52, 1.2, -.1, 2.6]].forEach(([ch, x, z, dx, hy], k) => {
      const g = new T.Group();
      const sh = sheepO(k === 2 ? .55 : .75, -Math.PI / 2 + (k - 1) * .5); g.add(sh);
      const kite = textPlane(256, 256, kiteTex(ch), .5, .5); kite.rotation.z = Math.PI / 4; kite.position.set(dx, hy, -.4);
      const tail = new T.Mesh(new T.BoxGeometry(.03, .5, .01), std(0xffffff)); tail.position.set(0, -.45, 0); tail.rotation.z = -Math.PI / 4; kite.add(tail);
      g.add(kite);
      const lg = new T.BufferGeometry().setFromPoints([new T.Vector3(.4, .95, 0), kite.position.clone()]);
      const line = new T.Line(lg, new T.LineBasicMaterial({ color: 0xffffff })); g.add(line);
      kites.push({ kite, lg, base: kite.position.clone(), ph: k * 1.7 });
      shadowAll(g);
      addPop(4, g, x, z, .15 + k * .08);
    });
    anim.push(t => kites.forEach(k => {
      k.kite.position.set(k.base.x + Math.sin(t * .9 + k.ph) * .18, k.base.y + Math.sin(t * 1.3 + k.ph) * .1, k.base.z);
      k.kite.rotation.y = Math.sin(t * 1.1 + k.ph) * .3;
      const p = k.lg.attributes.position; p.setXYZ(1, k.kite.position.x, k.kite.position.y, k.kite.position.z); p.needsUpdate = true;
    }));
  }

  /* ----- snow once the book is open ----- */
  const SN = 420, sp = new Float32Array(SN * 3), sv = new Float32Array(SN);
  const resetFlake = (i, top) => { sp[i * 3] = -PW - .4 + Math.random() * (2 * PW + .8); sp[i * 3 + 1] = top ? 3.6 + Math.random() * .6 : Math.random() * 4.2; sp[i * 3 + 2] = -2.6 + Math.random() * 5.2; sv[i] = .25 + Math.random() * .35; };
  for (let i = 0; i < SN; i++) resetFlake(i, false);
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
  const snow = makeSnow(sg, SN, .06, .3); const snowMat = snow.material; snowMat.uniforms.opacity.value = 0; scene.add(snow);

  /* ----- controls ----- */
  const prev = $('.js-prev', root), next = $('.js-next', root), pg = $('.js-pg', root), bm = $('.book-msg', root);
  let spread = 0, yaw = 0, pitch = 0, drag = null, aspect = 1;
  function go(s) {
    const to = clamp(s, 0, LEAVES);
    if (to > spread) { play('page_flip', { vol: .8 }); play('paper_pop', { vol: .7, delay: .32 }); }
    else if (to < spread && to === 0 && spread === LEAVES) { play('page_flip', { vol: .6, rate: .9 }); play('book_close', { vol: .9, delay: .45 }); }
    else if (to < spread) play('page_flip', { vol: .7, rate: .92 });
    spread = to;
    leaves.forEach((l, i) => { l.target = i < spread ? Math.PI : 0; });
    prev.disabled = spread === 0;
    next.textContent = spread === 0 ? '開く' : spread === LEAVES ? '閉じる' : '次のページ';
    pg.textContent = spread === 0 ? '表紙' : `${spread} / ${LEAVES}　${SCN[spread - 1].title}`;
    // readable copy of the current message page (shown on phones, where the printed page is small)
    if (spread === 0) bm.classList.remove('show');
    else {
      const m = MSG[spread - 1];
      bm.innerHTML = `<span class="k">MESSAGE ${spread} / ${LEAVES}</span><p><b>${m.lead.replace('\n', '')}</b><br>${m.body}</p>` + (m.sign ? '<p class="s">bravesoft株式会社 代表取締役 〇〇 〇〇</p>' : '');
      bm.classList.add('show');
    }
  }
  prev.addEventListener('click', () => go(spread - 1));
  next.addEventListener('click', () => go(spread === LEAVES ? 0 : spread + 1));
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, sx: e.clientX }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    yaw = clamp(yaw + (e.clientX - drag.x) * .002, -.4, .4); pitch = clamp(pitch + (e.clientY - drag.y) * .003, -.25, .25);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = e => {
    if (drag) { const dx = e.clientX - drag.sx; if (dx < -60) go(spread + 1); else if (dx > 60) go(spread - 1); else if (Math.abs(dx) < 6) go(spread === LEAVES ? 0 : spread + 1); }
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', () => { drag = null; });
  go(0);

  const backOut = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const sceneF = [0, 0, 0, 0, 0];
  function frame(dt, t) {
    dt = dt || 0;
    // turn the leaves (one after another when jumping several pages)
    leaves.forEach((l, i) => {
      const k = Math.min(1, (dt || .016) * (RM ? 20 : 3.2));
      l.a += (l.target - l.a) * k;
      const f = l.a / Math.PI;
      // stack order: unturned leaves lie on the right (cover on top); turned ones lie on the left (latest on top)
      const yR = TH * (LEAVES - i), yL = TH * (i + 2);
      l.pivot.position.y = yR + (yL - yR) * f + Math.sin(f * Math.PI) * .02;
      l.pivot.rotation.z = l.a;
    });
    // each scene stands up once the page above it is turned, and folds flat when its own page lifts
    for (let j = 0; j < 5; j++) {
      const above = leaves[j].a / Math.PI;
      const own = j < 4 ? leaves[j + 1].a / Math.PI : 0;
      sceneF[j] = clamp((above - .45) / .45, 0, 1) * (1 - clamp(own / .3, 0, 1));
    }
    pops.forEach(p => {
      const f = clamp((sceneF[p.scn] - p.start) / p.span, 0, 1);
      p.pivot.visible = f > .001;
      const s = Math.max(.001, backOut(f));
      p.pivot.scale.set(s, s, s);
      p.pivot.rotation.x = -(1 - Math.min(1, f * 1.15)) * Math.PI / 2;
    });
    anim.forEach(fn => fn(t, sceneF));
    const o = ease(clamp(leaves[0].a / Math.PI, 0, 1));
    // snow
    const so = clamp((o - .5) / .4, 0, 1);
    snowMat.uniforms.opacity.value = so; snowMat.uniforms.time.value = t;
    if (so > 0 && dt) {
      for (let i = 0; i < SN; i++) {
        sp[i * 3 + 1] -= sv[i] * dt;
        sp[i * 3] += Math.sin(t * .8 + i) * .14 * dt; sp[i * 3 + 2] += Math.cos(t * .6 + i * 1.7) * .06 * dt;
        if (sp[i * 3 + 1] < .02) resetFlake(i, true);
      }
      sg.attributes.position.needsUpdate = true;
    }
    book.position.x = -PW / 2 * (1 - o);
    book.rotation.y = yaw + (drag ? 0 : Math.sin(t * .4) * .03);
    book.rotation.x = pitch;
    snow.position.x = book.position.x + PW / 2 * o; snow.rotation.y = book.rotation.y;
    // camera fit
    const fovT = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    const needW = (PW * (1 + o) + 1.2), needH = PD + 1.8 + 1.6 * o;
    const d = Math.max(needW / 2 / (fovT * aspect), needH / 2 / fovT) * (isPC() ? 1.02 : 1.05);
    const pol = isPC() ? .8 : .64;
    camera.position.set(0, Math.cos(pol) * d, Math.sin(pol) * d + (isPC() ? 0 : .6));
    camera.lookAt(0, .55 + .45 * o, isPC() ? .1 : .8 + 1.5 * o);
  }
  function resize(w, h) { aspect = w / h; camera.aspect = aspect; camera.updateProjectionMatrix(); snow.fit(renderer, camera, h); }
  fontsReady.then(() => { allTex.forEach(t => t._redraw && t._redraw()); });
  return { scene, camera, frame, resize };
});

/* ================= game feedback helpers (shared by the gacha and Mirai Post) ================= */
// sound lives in src/sound.js (loaded first) — shared with the 2D demos
const { SND, play, tone, sfx, soundButton, buzz } = window.NENGA.snd;
const STD = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .55 }, o));
function roundedBox(w, h, d, r, mat) {
  const s = new T.Shape(), x = -w / 2, y = -h / 2, bv = Math.min(.06, d / 4);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new T.ExtrudeGeometry(s, { depth: d - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -(d - 2 * bv) / 2);
  return new T.Mesh(g, mat);
}
const starTex = canvasTex(64, 64, (g) => {
  g.translate(32, 32); g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8; g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 9 : 28, a = i * Math.PI / 5 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill();
});
const rayTex = canvasTex(256, 256, (g, w) => {
  g.translate(w / 2, w / 2);
  for (let i = 0; i < 16; i++) {
    g.rotate(Math.PI / 8);
    const gr = g.createLinearGradient(0, 0, 0, -w / 2); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(-w * .06, -w / 2); g.lineTo(w * .06, -w / 2); g.closePath(); g.fill();
  }
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, w * .25); rg.addColorStop(0, 'rgba(255,255,255,.9)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(0, 0, w * .25, 0, 7); g.fill();
});
function makeBurst(parent, cap = 600, size = .16) {
  const pos = new Float32Array(cap * 3), col = new Float32Array(cap * 3), base = new Float32Array(cap * 3), vel = new Float32Array(cap * 3), life = new Float32Array(cap), grav = new Float32Array(cap);
  for (let i = 0; i < cap; i++) pos[i * 3 + 1] = -999;
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
  const pts = new T.Points(geo, new T.PointsMaterial({ size, map: starTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  pts.frustumCulled = false; parent.add(pts);
  let head = 0; const c = new T.Color();
  return {
    emit(p, n, colors, speed = 3, opt = {}) {
      for (let k = 0; k < n; k++) {
        const i = head; head = (head + 1) % cap;
        const a = Math.random() * 6.28, b = Math.acos(2 * Math.random() - 1), s = speed * (.35 + Math.random() * .85);
        pos[i * 3] = p.x + (opt.spread || 0) * (Math.random() - .5); pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z + (opt.spread || 0) * (Math.random() - .5);
        vel[i * 3] = Math.sin(b) * Math.cos(a) * s + (opt.vx || 0); vel[i * 3 + 1] = Math.cos(b) * s + (opt.up || 0); vel[i * 3 + 2] = Math.sin(b) * Math.sin(a) * s;
        life[i] = opt.life || 1; grav[i] = opt.g === undefined ? 4 : opt.g;
        c.set(colors[k % colors.length]); base[i * 3] = c.r; base[i * 3 + 1] = c.g; base[i * 3 + 2] = c.b;
      }
    },
    update(dt) {
      for (let i = 0; i < cap; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt * .9;
        vel[i * 3 + 1] -= grav[i] * dt; vel[i * 3] *= .985; vel[i * 3 + 2] *= .985;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const f = Math.max(0, Math.min(1, life[i] * 1.4));
        col[i * 3] = base[i * 3] * f; col[i * 3 + 1] = base[i * 3 + 1] * f; col[i * 3 + 2] = base[i * 3 + 2] * f;
        if (life[i] <= 0) pos[i * 3 + 1] = -999;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    }
  };
}
function flash(root, color = '#fff') {
  const f = root.querySelector('.g-flash'); if (!f || RM) return;
  f.style.background = color;
  f.animate([{ opacity: .85 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
}
function shakeEl(el, mag = 6, dur = 320) {
  if (RM) return;
  const k = []; for (let i = 0; i <= 8; i++) { const m = mag * (1 - i / 8); k.push({ transform: `translate(${(Math.random() - .5) * 2 * m}px,${(Math.random() - .5) * 2 * m}px)` }); }
  el.animate(k, { duration: dur });
}
function popEl(el, s = 1.25) { if (!RM) el.animate([{ transform: 'scale(1)' }, { transform: `scale(${s})` }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' }); }
function ndcOf(canvas, e) { const r = canvas.getBoundingClientRect(); return new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }

/* ================= C: 3D kanji gacha ================= */
stage('#gacha', (root, renderer, canvas) => {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, .1, 100);
  // night-stage look: a spotlight on the machine, cyan/blue rim lights, a glowing floor disc
  scene.add(new T.HemisphereLight(0x8FB4FF, 0x0B1C3F, .42));
  const key = new T.SpotLight(0xffffff, 1.25, 20, .55, .6, 1); key.position.set(1.5, 8, 5); key.target.position.set(0, 1.6, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0006;
  scene.add(key, key.target);
  const rimL = new T.PointLight(0x00BBFF, 1.1, 10); rimL.position.set(-3, 3, -1.5); scene.add(rimL);
  const rimR = new T.PointLight(0x3366FF, .9, 10); rimR.position.set(3, 2, -1); scene.add(rimR);
  const fill = new T.DirectionalLight(0xC3DEFF, .25); fill.position.set(-2, 3, 6); scene.add(fill);
  const floorTex = canvasTex(256, 256, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(63,156,255,.55)'); gr.addColorStop(.5, 'rgba(0,102,255,.18)'); gr.addColorStop(1, 'rgba(0,102,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const floorGlow = new T.Mesh(new T.PlaneGeometry(7, 7), new T.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false })); floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.y = .005; scene.add(floorGlow);
  const catcher = new T.Mesh(new T.PlaneGeometry(30, 30), new T.ShadowMaterial({ opacity: .45 })); catcher.rotation.x = -Math.PI / 2; catcher.receiveShadow = true; scene.add(catcher);
  const mach = new T.Group(); scene.add(mach);
  const blue = STD(C.blue, { roughness: .28, metalness: .2 }), white = STD(0xDCE6F7, { roughness: .35 }), navy = STD(0x16305C, { roughness: .4, metalness: .2 }), yellow = STD(C.yellow, { roughness: .3, emissive: 0x332A00 }), hole = STD(0x050B1A, { roughness: .9 });
  const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; mach.add(m); return m; };
  add(roundedBox(2.4, .14, 1.7, .07, navy), 0, .07, 0);
  add(roundedBox(2.1, 1.7, 1.5, .24, blue), 0, .99, 0);
  const label = new T.Mesh(new T.PlaneGeometry(1.7, .4), new T.MeshStandardMaterial({ map: (() => canvasTex(512, 120, (g, w, h) => {
    g.fillStyle = '#0B1C3F'; g.beginPath(); if (g.roundRect) g.roundRect(0, 0, w, h, 30); else g.rect(0, 0, w, h); g.fill();
    g.strokeStyle = '#FFE94A'; g.lineWidth = 6; g.beginPath(); if (g.roundRect) g.roundRect(5, 5, w - 10, h - 10, 26); else g.rect(5, 5, w - 10, h - 10); g.stroke();
    g.fillStyle = '#FFE94A'; g.font = `900 64px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('羊入り漢字ガチャ', w / 2, h / 2 + 3);
  }))(), transparent: true })); add(label, 0, 1.58, .755);
  // handle
  const knob = new T.Group(); knob.position.set(-.42, .82, .76); mach.add(knob);
  const disc = new T.Mesh(new T.CylinderGeometry(.36, .36, .1, 40), white); disc.rotation.x = Math.PI / 2; disc.position.z = .05; disc.castShadow = true; knob.add(disc);
  const ringK = new T.Mesh(new T.TorusGeometry(.36, .035, 10, 40), yellow); ringK.position.z = .1; knob.add(ringK);
  const bar = new T.Mesh(new T.BoxGeometry(.6, .13, .13), yellow); bar.position.z = .17; bar.castShadow = true; knob.add(bar);
  const cap0 = new T.Mesh(new T.CylinderGeometry(.08, .08, .08, 20), navy); cap0.rotation.x = Math.PI / 2; cap0.position.z = .26; knob.add(cap0);
  const knobGlow = new T.Mesh(new T.RingGeometry(.42, .5, 48), new T.MeshBasicMaterial({ color: C.yellow, transparent: true, opacity: 0, side: T.DoubleSide })); knobGlow.position.z = .02; knob.add(knobGlow);
  // coin plate + chute + tray
  add(new T.Mesh(new T.BoxGeometry(.34, .42, .04), white), .55, 1.05, .76);
  add(new T.Mesh(new T.BoxGeometry(.06, .24, .02), hole), .55, 1.05, .785);
  add(new T.Mesh(new T.BoxGeometry(.7, .46, .04), hole), .5, .5, .755);
  add(new T.Mesh(new T.BoxGeometry(.8, .07, .44), white), .5, .25, .95);
  add(new T.Mesh(new T.BoxGeometry(.06, .16, .44), white), .13, .32, .95);
  add(new T.Mesh(new T.BoxGeometry(.06, .16, .44), white), .87, .32, .95);
  add(new T.Mesh(new T.BoxGeometry(.8, .16, .05), white), .5, .32, 1.15);
  // globe
  const GY = 2.82, GR = 1.0;
  let procParts = [];
  add(new T.Mesh(new T.CylinderGeometry(1.02, 1.08, .26, 48), navy), 0, 1.92, 0);
  add(new T.Mesh(new T.TorusGeometry(1.03, .05, 10, 48), yellow), 0, 2.05, 0).rotation.x = Math.PI / 2;
  const glass = new T.Mesh(new T.SphereGeometry(GR, 48, 32), new T.MeshPhongMaterial({ color: 0x9CC4FF, transparent: true, opacity: .12, shininess: 160, specular: 0xffffff, depthWrite: false }));
  glass.position.y = GY; mach.add(glass);
  const glassB = new T.Mesh(new T.SphereGeometry(GR * 1.01, 32, 24), new T.MeshBasicMaterial({ color: 0x9CC4FF, transparent: true, opacity: .08, side: T.BackSide, depthWrite: false })); glassB.position.y = GY; mach.add(glassB);
  add(new T.Mesh(new T.SphereGeometry(.34, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), yellow), 0, GY + .93, 0);
  add(new T.Mesh(new T.SphereGeometry(.09, 16, 12), white), 0, GY + 1.3, 0);
  procParts = mach.children.filter(o => o !== label && o !== knob && o !== glass && o !== glassB);
  // the machine body was modelled in Blender (gacha.glb, embedded). The simple parts above stay as a fallback
  // and are hidden once the model is ready; the glass globe, label, capsules and knob pivot stay as they are.
  (function loadBlenderMachine() {
    const b64 = window.NENGA_GACHA_GLB;
    if (!b64 || !T.GLTFLoader) return;
    try {
      const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      new T.GLTFLoader().parse(buf.buffer, '', gltf => {
        // studio reflections for the chrome, gold and clear-coated paint
        const env = (() => {
          const tex = canvasTex(512, 256, (g, w, h) => {
            const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2B4C8F'); gr.addColorStop(.5, '#0E1E44'); gr.addColorStop(1, '#050B1A');
            g.fillStyle = gr; g.fillRect(0, 0, w, h);
            const soft = (x, y, rw, rh, c) => { const r = g.createRadialGradient(x, y, 0, x, y, Math.max(rw, rh)); r.addColorStop(0, c); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(x - rw * 2, y - rh * 2, rw * 4, rh * 4); };
            soft(w * .3, h * .22, 60, 40, 'rgba(255,255,255,.95)'); soft(w * .72, h * .3, 46, 30, 'rgba(200,225,255,.8)');
            soft(w * .1, h * .45, 40, 50, 'rgba(0,187,255,.6)'); soft(w * .9, h * .5, 40, 50, 'rgba(51,102,255,.6)');
            g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, h * .52, w, 3);
          });
          tex.mapping = T.EquirectangularReflectionMapping;
          const pm = new T.PMREMGenerator(renderer), rt = pm.fromEquirectangular(tex); pm.dispose(); return rt.texture;
        })();
        const model = gltf.scene;
        let knobNode = null;
        model.traverse(o => {
          if (o.name === 'Knob') knobNode = o;
          if (o.isMesh) {
            o.castShadow = true; o.receiveShadow = true;
            const m = o.material; m.envMap = env; m.envMapIntensity = /Chrome|Gold/.test(m.name) ? 1.25 : .7; m.needsUpdate = true;
          }
        });
        procParts.forEach(p => { p.visible = false; });
        [disc, ringK, bar, cap0].forEach(p => { p.visible = false; });
        if (knobNode) { knobNode.parent.remove(knobNode); knobNode.position.set(0, 0, 0); knob.add(knobNode); }
        mach.add(model);
        root.classList.add('glb-ready');
      }, err => console.warn('gacha model', err));
    } catch (e) { console.warn('gacha model', e); }
  })();
  // capsules inside the globe (simple sphere physics)
  const CR = .21, NC = 20, PAL = [C.blue, C.yellow, 0x00BBFF, 0xffffff, C.sky, C.strong];
  const halfTop = new T.SphereGeometry(CR, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), halfBot = new T.SphereGeometry(CR, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  // shells are open hemispheres: draw both sides so an opened capsule shows its inside, and give each cut edge a lip
  const clearM = new T.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: .85, shininess: 90, side: T.DoubleSide });
  const lipGeo = new T.RingGeometry(CR * .9, CR * 1.002, 24), lipM = new T.MeshPhongMaterial({ color: 0xffffff, shininess: 40, side: T.DoubleSide });
  function capsule(color) {
    const g = new T.Group();
    const t = new T.Mesh(halfTop, new T.MeshPhongMaterial({ color, shininess: 80, side: T.DoubleSide })), b = new T.Mesh(halfBot, clearM), band = new T.Mesh(new T.TorusGeometry(CR, .012, 6, 24), STD(0xffffff)); band.rotation.x = Math.PI / 2;
    [t, b].forEach(h => { const lip = new T.Mesh(lipGeo, lipM); lip.rotation.x = Math.PI / 2; h.add(lip); });
    t.castShadow = b.castShadow = true; g.add(t, b, band); g.top = t; g.bot = b; g.band = band; return g;
  }
  const globe = new T.Group(); globe.position.y = GY; mach.add(globe);
  const caps = [];
  const spawnCap = (top) => {
    const c = capsule(PAL[(Math.random() * PAL.length) | 0]);
    const p = top ? new T.Vector3(rand(-.2, .2), .6, rand(-.2, .2)) : new T.Vector3(rand(-.6, .6), rand(-.6, .2), rand(-.6, .6));
    c.position.copy(p); c.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6)); globe.add(c);
    caps.push({ m: c, v: new T.Vector3() });
  };
  function rand(a, b) { return a + Math.random() * (b - a); }
  for (let i = 0; i < NC; i++) spawnCap(false);
  const RB = GR - .07 - CR;
  function simCaps(dt) {
    dt = Math.min(dt, .033);
    caps.forEach(c => { c.v.y -= 5.5 * dt; c.v.multiplyScalar(.992); c.m.position.addScaledVector(c.v, dt); });
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < caps.length; i++) {
        const a = caps[i], pa = a.m.position, L = pa.length();
        if (L > RB) { const n = pa.clone().divideScalar(L); pa.copy(n).multiplyScalar(RB); const vn = a.v.dot(n); if (vn > 0) a.v.addScaledVector(n, -vn * 1.35); a.v.multiplyScalar(.96); }
        for (let j = i + 1; j < caps.length; j++) {
          const b = caps[j], d = b.m.position.clone().sub(pa), dl = d.length();
          if (dl < CR * 2 && dl > 1e-4) {
            const n = d.divideScalar(dl), push = (CR * 2 - dl) / 2;
            pa.addScaledVector(n, -push); b.m.position.addScaledVector(n, push);
            const rv = b.v.clone().sub(a.v).dot(n);
            if (rv < 0) { a.v.addScaledVector(n, rv * .65); b.v.addScaledVector(n, -rv * .65); }
          }
        }
      }
    }
    caps.forEach(c => { c.m.rotation.x += c.v.z * dt * 4; c.m.rotation.z -= c.v.x * dt * 4; });
  }
  const stir = p => caps.forEach(c => { const q = c.m.position; c.v.x += -q.z * p * 3 + rand(-1, 1) * p; c.v.z += q.x * p * 3 + rand(-1, 1) * p; c.v.y += rand(.5, 2.4) * p; });
  for (let k = 0; k < 120; k++) simCaps(1 / 60);

  /* prize capsule, beams, particles */
  const prize = capsule(0xffffff); prize.visible = false; scene.add(prize);
  const beam = new T.Mesh(new T.PlaneGeometry(2.4, 2.4), new T.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, color: 0xffffff }));
  beam.renderOrder = 5; scene.add(beam);
  prize.traverse(m => { if (m.isMesh) m.renderOrder = 6; });
  const fx = makeBurst(scene, 700, .17);
  const TRAY = new T.Vector3(.5, .29 + CR, .95);
  // tray glow: lights up while you hover the capsule over the machine, and flashes when it comes back
  const trayGlow = new T.Mesh(new T.PlaneGeometry(.78, .42), new T.MeshBasicMaterial({ color: C.yellow, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
  trayGlow.rotation.x = -Math.PI / 2; trayGlow.position.set(.5, .29, .95); scene.add(trayGlow);
  const trayRing = new T.Mesh(new T.RingGeometry(.2, .26, 40), new T.MeshBasicMaterial({ color: C.yellow, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }));
  trayRing.rotation.x = -Math.PI / 2; trayRing.position.set(.5, .3, .95); scene.add(trayRing);
  let trayFlash = 0, ringT = 1, homeHint = false;
  // the capsule counts as "over the machine" while it is in front of the body, below the globe
  const overMachine = p => Math.abs(p.x) < 1.2 && p.y < 2.0;
  function landHome() {
    sfx.thud(); sfx.chime({ vol: .4, rate: 1.2, delay: .05 }); buzz(20);
    fx.emit(TRAY.clone().add(new T.Vector3(0, .05, 0)), 30, [C.yellow, 0xffffff, C.sky], 1.6, { up: 1.2 });
    trayFlash = 1; ringT = 0; punch = 1;
    prize.top.position.y = 0; prize.top.material.emissive.setHex(RAR[pick.r].col).multiplyScalar(pick.r === 'N' ? 0 : .25);
    prompt.classList.remove('away'); setPhase('ready');
  }

  /* kanji data */
  const K = [
    { k: '美', r: 'SSR', parts: ['羊', '大'], pos: 'top', d: '「羊」と「大」を合わせた形。大きく立派なひつじ＝美しい、という成り立ちの説で知られます。', c: '大きく育てて、美しく仕上げる一年に。' },
    { k: '祥', r: 'SR', parts: ['礻', '羊'], pos: 'right', d: '「めでたいしるし」の意味。吉祥の「祥」です。', c: '皆さまに、吉祥の多い一年を。' },
    { k: '善', r: 'R', parts: ['羊', '言'], pos: 'top', d: '「よい」「正しい」の意味。古い字形「譱」は「羊」と「言」を組み合わせた形です。', c: '善いものを、善い仲間と一緒に。' },
    { k: '義', r: 'R', parts: ['羊', '我'], pos: 'top', d: '「人として正しい道」の意味。「羊」と「我」の組み合わせ。', c: '約束を守る、義のある仕事を。' },
    { k: '洋', r: 'N', parts: ['氵', '羊'], pos: 'right', d: '「大海原」の意味。さんずいに「羊」。', c: 'アイデアの海を、どこまでも。' },
    { k: '群', r: 'N', parts: ['君', '羊'], pos: 'right', d: '「むれ」。ひつじは群れで暮らす動物です。', c: 'ひとりより、群れで遠くへ。' },
    { k: '鮮', r: 'N', parts: ['魚', '羊'], pos: 'right', d: '「あたらしい」「あざやか」。「魚」と「羊」の組み合わせ。', c: '毎日を新鮮に、あしたをオモシロク。' }
  ];
  const RAR = {
    N: { stars: 1, col: 0xffffff, css: '#9FC3FF', taps: 1, name: 'NORMAL', fan: 3 },
    R: { stars: 2, col: 0x3F9CFF, css: '#3F9CFF', taps: 2, name: 'RARE', fan: 4 },
    SR: { stars: 3, col: 0x00BBFF, css: '#00BBFF', taps: 3, name: 'SUPER RARE', fan: 5 },
    SSR: { stars: 4, col: 0xFFE94A, css: '#FFC800', taps: 3, name: 'SSR', fan: 6 }
  };
  const got = new Set();

  /* HUD */
  const coll = root.querySelector('.g-coll'), cnt = root.querySelector('.g-cnt'), prog = root.querySelector('.g-prog i'), prompt = root.querySelector('.g-prompt'), act = root.querySelector('.js-act'), modal = root.querySelector('.gm');
  soundButton(root.querySelector('.js-snd'));
  K.forEach(o => { const i = document.createElement('i'); i.dataset.k = o.k; i.textContent = '？'; coll.appendChild(i); });
  const setPrompt = (t, hot = false) => { prompt.textContent = t; prompt.classList.toggle('hot', hot); if (!RM) prompt.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 220 }); };
  const updHud = () => { cnt.textContent = `${got.size} / ${K.length}`; prog.style.width = (got.size / K.length * 100) + '%'; };
  updHud();

  /* state machine */
  let phase = 'idle', turn = 0, turnAuto = false, ticks = 0, pick = null, taps = 0, prizeV = new T.Vector3(), shakeT = 0, aspect = 1, beamA = 0, punch = 0, halves = null, dragK = null, downAt = null;
  function setPhase(p) {
    phase = p;
    if (p === 'idle') { setPrompt('ハンドルを回そう！'); act.textContent = 'ガチャを回す'; act.disabled = false; }
    if (p === 'ready') { const need = RAR[pick.r].taps; setPrompt(need > 1 ? `タップ${need}回で開く（投げてもOK）` : 'タップで開く（投げてもOK）', true); act.textContent = '開ける'; act.disabled = false; }
  }
  function choose() {
    const left = K.filter(o => !got.has(o.k));
    if (left.length && Math.random() < .72) return left[(Math.random() * left.length) | 0];
    const w = { N: .45, R: .3, SR: .17, SSR: .08 }; let r = Math.random(), tier = 'N';
    for (const t of ['SSR', 'SR', 'R', 'N']) { if (r < w[t]) { tier = t; break; } r -= w[t]; }
    const pool = K.filter(o => o.r === tier); return pool[(Math.random() * pool.length) | 0];
  }
  function onTick() {
    ticks++; sfx.tick(); buzz(8); stir(.55); shakeT = .12;
    knobGlow.material.opacity = 1;
    setPrompt(ticks === 1 ? 'その調子！' : ticks === 2 ? 'あと少し！' : 'ガチャッ！', ticks >= 2);
  }
  function drop() {
    phase = 'drop'; act.disabled = true; sfx.rattle(); stir(1.2); shakeT = .35; shakeEl(root, 4);
    pick = choose();
    const rr = RAR[pick.r];
    // take one capsule out of the globe, refill from the top a moment later
    let low = 0; caps.forEach((c, i) => { if (c.m.position.y < caps[low].m.position.y) low = i; });
    globe.remove(caps[low].m); caps.splice(low, 1); setTimeout(() => spawnCap(true), 900);
    prize.top.material.color.set(rr.col); prize.top.material.emissive = new T.Color(rr.col).multiplyScalar(pick.r === 'N' ? 0 : .25);
    prize.top.position.set(0, 0, 0); prize.bot.position.set(0, 0, 0); prize.band.visible = true; prize.top.rotation.set(0, 0, 0); prize.bot.rotation.set(0, 0, 0);
    setTimeout(() => {
      prize.visible = true; prize.position.set(.5, .55, .7); prize.scale.setScalar(1); prizeV.set(rand(-.3, .3), 1.4, 1.6);
      sfx.thud(); setPrompt('カプセルが出てきた！', true);
    }, RM ? 50 : 520);
  }
  function startAuto() { if (phase !== 'idle') return; phase = 'turning'; turnAuto = true; turn = 0; ticks = 0; act.disabled = true; }
  function tapOpen() {
    if (phase !== 'ready') return;
    const rr = RAR[pick.r]; taps++;
    sfx.crack(taps); buzz(15); punch = 1; shakeT = .15 + taps * .06;
    fx.emit(prize.position, 10 + taps * 6, [0xffffff, rr.col], 2 + taps, { up: 1 });
    if (taps === 1 && (pick.r === 'SR' || pick.r === 'SSR')) { flash(root, rr.css); beamA = 1; setPrompt(pick.r === 'SSR' ? '金色に光った…！？' : 'あ、光った！', true); }
    if (taps < rr.taps) { setPrompt(`もう一回！ あと${rr.taps - taps}回`, true); return; }
    open();
  }
  function open() {
    if (phase === 'open' || phase === 'result') return;
    prompt.classList.remove('away'); prize.top.position.y = 0;
    phase = 'open'; act.disabled = true;
    const rr = RAR[pick.r];
    sfx.pop(); setTimeout(() => sfx.fanfare(rr.fan), 120); buzz(40);
    flash(root, pick.r === 'SSR' ? '#FFE94A' : '#fff'); shakeEl(root, pick.r === 'SSR' ? 10 : 6, 420);
    const n = { N: 60, R: 110, SR: 170, SSR: 260 }[pick.r];
    fx.emit(prize.position, n, [rr.col, 0xffffff, C.yellow, C.sky], 4.5, { up: 1.5 });
    halves = { t: 0, vt: new T.Vector3(rand(-.6, .6), 3.2, 1.2), vb: new T.Vector3(rand(-.6, .6), .8, 1.6) };
    prize.band.visible = false; beamA = Math.max(beamA, pick.r === 'N' ? .35 : .8);
    setTimeout(showResult, RM ? 100 : 650);
  }

  /* result modal (only appears after a pull) */
  const CLIP = { top: 'inset(0 0 47% 0)', right: 'inset(0 0 0 45%)' };
  function showResult() {
    const o = pick, rr = RAR[o.r], isNew = !got.has(o.k);
    got.add(o.k);
    const complete = isNew && got.size === K.length;
    const eq = o.parts.map(p => `<span class="pt${p === '羊' ? ' y' : ''}">${p}</span>`).join('<span class="op">＋</span>');
    modal.innerHTML = `<div class="gm-card r-${o.r}">
      <div class="gm-rar" style="--rc:${rr.css}"><b>${rr.name}</b><span>${'★'.repeat(rr.stars)}</span></div>
      ${isNew ? '<span class="gm-new">NEW!</span>' : '<span class="gm-dup">もう持っている漢字</span>'}
      <div class="kj-eq" aria-label="${o.parts.join('＋')}＝${o.k}">${eq}<span class="op">＝</span>
        <span class="kjb"><span class="g">${o.k}</span><span class="g ov" style="clip-path:${CLIP[o.pos]};-webkit-clip-path:${CLIP[o.pos]}">${o.k}</span><span class="tagy ${o.pos}">羊</span></span></div>
      <p class="gm-where">「${o.k}」の${o.pos === 'top' ? '上' : '右'}に「羊」がいます</p>
      <p class="gm-ceo"><span>社長のひとこと</span>「${o.c}」</p>
      <p class="gm-d">${o.d}</p>
      ${complete ? `<div class="gm-comp"><b>COMPLETE! 7つの「羊」がそろいました</b><p>あけましておめでとうございます。羊が大きくなれば「美」、群れになれば「群」。2027年も皆さまと一緒に、あしたをオモシロクしてまいります。── 代表取締役 〇〇 〇〇</p></div>` : ''}
      <button type="button" class="sbtn blue js-again">${complete ? '最初から遊ぶ' : 'もう一回まわす'}</button>
    </div>`;
    modal.hidden = false;
    const card = modal.querySelector('.gm-card');
    if (!RM) card.animate([{ transform: 'scale(.6) rotate(-4deg)', opacity: 0 }, { transform: 'scale(1.05) rotate(1deg)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 420, easing: 'ease-out' });
    animateEq(card);
    const nw = card.querySelector('.gm-new'); if (nw && !RM) nw.animate([{ transform: 'scale(3) rotate(-25deg)', opacity: 0 }, { transform: 'scale(.9) rotate(-12deg)', opacity: 1, offset: .7 }, { transform: 'scale(1) rotate(-12deg)', opacity: 1 }], { duration: 380, delay: 900, fill: 'backwards', easing: 'ease-in' });
    if (isNew) setTimeout(() => sfx.chime(), 950);
    if (complete) setTimeout(() => { sfx.fanfare(6); for (let k = 0; k < 6; k++) setTimeout(() => fx.emit(new T.Vector3(rand(-2, 2), 4.5, rand(-.5, 1)), 60, [C.yellow, C.blue, 0xffffff, C.sky], 2, { up: -1, g: 1.5, life: 1.6 }), k * 180); }, 600);
    card.querySelector('.js-again').addEventListener('click', e => { e.stopPropagation(); closeResult(o, isNew, complete); });
  }
  function animateEq(card) {
    if (RM) return;
    const eqEl = card.querySelector('.kj-eq'), kjb = card.querySelector('.kjb'), pts = [...eqEl.querySelectorAll('.pt, .op')], ov = kjb.querySelector('.ov'), tag = kjb.querySelector('.tagy');
    pts.forEach((el, i) => el.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 320, delay: 250 + i * 120, fill: 'backwards', easing: 'ease-out' }));
    kjb.style.opacity = '0';
    const t1 = 250 + pts.length * 120 + 200;
    setTimeout(() => {
      [...eqEl.querySelectorAll('.pt')].forEach(pt => {
        const fly = pt.cloneNode(true); fly.classList.add('fly'); fly.style.left = pt.offsetLeft + 'px'; fly.style.top = pt.offsetTop + 'px'; eqEl.appendChild(fly);
        const dx = kjb.offsetLeft + kjb.offsetWidth / 2 - (pt.offsetLeft + pt.offsetWidth / 2), dy = kjb.offsetTop + kjb.offsetHeight / 2 - (pt.offsetTop + pt.offsetHeight / 2);
        fly.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(.5)`, opacity: 0 }], { duration: 480, easing: 'cubic-bezier(.5,0,.7,1)' }).onfinish = () => fly.remove();
      });
    }, t1);
    setTimeout(() => {
      kjb.style.opacity = '1'; sfx.tick();
      kjb.animate([{ transform: 'scale(.3) rotate(-12deg)' }, { transform: 'scale(1.18) rotate(3deg)', offset: .6 }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' });
      ov.animate([{ opacity: 0 }, { opacity: 0, offset: .45 }, { opacity: 1, offset: .6 }, { opacity: .35, offset: .75 }, { opacity: 1 }], { duration: 1400, fill: 'backwards' });
      tag.animate([{ opacity: 0, transform: 'scale(0)' }, { opacity: 0, transform: 'scale(0)', offset: .55 }, { opacity: 1, transform: 'scale(1.3)', offset: .8 }, { opacity: 1, transform: 'scale(1)' }], { duration: 1200, fill: 'backwards' });
    }, t1 + 450);
  }
  function closeResult(o, isNew, complete) {
    modal.hidden = true; modal.innerHTML = '';
    prize.visible = false; beamA = 0; halves = null;
    const chip = coll.querySelector(`[data-k="${o.k}"]`);
    if (isNew) { chip.textContent = o.k; chip.className = 'got r-' + o.r; popEl(chip, 1.6); }
    updHud();
    if (complete) { got.clear(); coll.querySelectorAll('i').forEach(i => { i.textContent = '？'; i.className = ''; }); updHud(); }
    taps = 0; turn = 0; knob.rotation.z = 0; setPhase('idle');
  }

  /* input */
  const ray = new T.Raycaster();
  const knobParts = [disc, ringK, bar, cap0];
  let grab = null, yeetV = new T.Vector3(), yeetT = 0;
  const onPlane = (e, z) => { ray.setFromCamera(ndcOf(canvas, e), camera); const k = (z - ray.ray.origin.z) / ray.ray.direction.z; return ray.ray.origin.clone().addScaledVector(ray.ray.direction, k); };
  const uiRects = () => [root.querySelector('.g-hud'), root.querySelector('.g-prompt'), act, root.querySelector('.js-snd')].filter(Boolean).map(el => el.getBoundingClientRect());
  function screenOf(v) { const p = v.clone().project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, r }; }
  canvas.addEventListener('pointerdown', e => {
    if (!modal.hidden) return;
    downAt = { x: e.clientX, y: e.clientY };
    if (phase === 'ready') {
      // generous screen-space hit test so the capsule is easy to grab with a finger
      const s0 = screenOf(prize.position), s1 = screenOf(prize.position.clone().add(new T.Vector3(CR, 0, 0)));
      const rpx = Math.max(28, Math.hypot(s1.x - s0.x, s1.y - s0.y) * 2);
      if (Math.hypot(e.clientX - s0.x, e.clientY - s0.y) < rpx) {
        canvas.setPointerCapture(e.pointerId);
        grab = { z: prize.position.z, hist: [{ p: prize.position.clone(), t: e.timeStamp }], moved: 0, last: { x: e.clientX, y: e.clientY } };
        phase = 'drag'; prompt.classList.add('away');
        return;
      }
    }
    if (phase === 'idle') {
      ray.setFromCamera(ndcOf(canvas, e), camera);
      if (ray.intersectObjects(knobParts).length) {
        canvas.setPointerCapture(e.pointerId);
        const c = new T.Vector3(); knob.getWorldPosition(c); c.project(camera);
        const r = canvas.getBoundingClientRect();
        dragK = { cx: r.left + (c.x + 1) / 2 * r.width, cy: r.top + (1 - c.y) / 2 * r.height, a: null };
        phase = 'turning'; turnAuto = false; turn = 0; ticks = 0; act.disabled = true;
      }
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (grab) {
      const p = onPlane(e, grab.z); p.y = Math.max(p.y, CR);
      prize.position.lerp(p, .7);
      grab.moved += Math.hypot(e.clientX - grab.last.x, e.clientY - grab.last.y); grab.last = { x: e.clientX, y: e.clientY };
      grab.hist.push({ p: p.clone(), t: e.timeStamp }); while (grab.hist.length > 2 && e.timeStamp - grab.hist[0].t > 120) grab.hist.shift();
      return;
    }
    if (!dragK) return;
    const a = Math.atan2(e.clientY - dragK.cy, e.clientX - dragK.cx);
    if (dragK.a !== null) { let d = a - dragK.a; d = Math.atan2(Math.sin(d), Math.cos(d)); if (d > 0) turn += d; }
    dragK.a = a;
  });
  canvas.addEventListener('pointerup', e => {
    if (grab) {
      const g = grab; grab = null;
      if (g.moved < 8) { homeHint = false; prompt.classList.remove('away'); if (prize.position.distanceTo(TRAY) > .05) { yeetV.set(0, 0, 0); yeetT = 0; phase = 'fall'; return; } phase = 'ready'; tapOpen(); return; }
      const a = g.hist[0], b = g.hist[g.hist.length - 1], dtm = Math.max(16, b.t - a.t) / 1000;
      yeetV.copy(b.p).sub(a.p).divideScalar(dtm).clampLength(0, 16);
      homeHint = false;
      if (yeetV.length() < 1.2) {   // a gentle release: the capsule just drops
        yeetV.multiplyScalar(.6); yeetT = 0; phase = 'fall';
        return;
      }
      phase = 'yeet'; yeetT = 0; sfx.whoosh(); setPrompt('いけーっ！', true);
      return;
    }
    const moved = downAt ? Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) : 99;
    if (dragK) { dragK = null; if (phase === 'turning' && turn < Math.PI * 2) { turnAuto = true; } return; }   // finish the turn for them
    if (moved < 10) { if (phase === 'idle') startAuto(); else if (phase === 'ready') tapOpen(); }
  });
  act.addEventListener('click', e => { e.stopPropagation(); if (phase === 'idle') startAuto(); else if (phase === 'ready') tapOpen(); });

  function frame(dt, t) {
    dt = dt || 0;
    if (phase === 'turning') {
      if (turnAuto) turn += dt * (RM ? 20 : 6);
      const want = Math.floor(turn / (Math.PI * 2 / 3));
      while (ticks < Math.min(3, want)) onTick();
      knob.rotation.z = -Math.min(turn, Math.PI * 2);
      if (turn >= Math.PI * 2) { turn = 0; knob.rotation.z = 0; drop(); }
    }
    knobGlow.material.opacity = Math.max(phase === 'idle' ? .35 + Math.sin(t * 4) * .35 : 0, knobGlow.material.opacity - dt * 2);
    simCaps(dt || 1 / 60);
    // prize physics: out of the chute into the tray
    if (prize.visible && (phase === 'drop' || phase === 'ready' || phase === 'open')) {
      if (phase === 'drop') {
        prizeV.y -= 9 * dt; prize.position.addScaledVector(prizeV, dt);
        prize.rotation.x += prizeV.z * dt * 3; prize.rotation.z -= prizeV.x * dt * 3;
        if (prize.position.z > TRAY.z) { prize.position.z = TRAY.z; prizeV.z *= -.3; }
        prize.position.x = Math.max(.25, Math.min(.75, prize.position.x));
        if (prize.position.y < TRAY.y && prizeV.y < 0) {
          prize.position.y = TRAY.y;
          if (Math.abs(prizeV.y) > .8) { prizeV.y *= -.45; sfx.thud(); fx.emit(prize.position, 6, [0xffffff], 1.2); }
          else { prizeV.set(0, 0, 0); prize.rotation.set(0, 0, 0); setPhase('ready'); }
        }
      } else if (phase === 'ready') {
        const w = Math.sin(t * 6) * .06 * (1 + taps);
        prize.rotation.set(0, Math.sin(t * 1.4) * .4, w);
        prize.position.y = TRAY.y + Math.abs(Math.sin(t * 3)) * .04;
        if (pick && (pick.r === 'SR' || pick.r === 'SSR') && Math.random() < dt * 25) fx.emit(prize.position, 1, [RAR[pick.r].col], .8, { g: 0, spread: .5, life: .8 });
      }
      punch = Math.max(0, punch - dt * 5);
      const s = 1 + punch * .35; prize.scale.set(s, 1 / (1 + punch * .2), s);
    }
    if (phase === 'drag') {
      beam.material.opacity = Math.max(.25, beam.material.opacity);
      // tell the player what a release will do
      // the capsule itself shows what a release will do:
      //  over the machine → calm, soft glow, guide ring pulsing on the tray
      //  anywhere else    → it rattles, the halves start to split, sparks leak out
      const home = overMachine(prize.position); homeHint = home;
      const rc = RAR[pick.r].col;
      if (home) {
        prize.rotation.z = Math.sin(t * 3) * .12; prize.rotation.x = Math.sin(t * 2.2) * .08;
        prize.top.position.y += (0 - prize.top.position.y) * Math.min(1, dt * 12);
        prize.top.material.emissive.setHex(0xFFE94A).multiplyScalar(.25 + Math.sin(t * 5) * .1);
        if (ringT >= 1 || ringT > .6) { ringT = 0; }
      } else {
        prize.rotation.z = Math.sin(t * 46) * .16; prize.rotation.x = Math.sin(t * 37) * .1;
        prize.top.position.y += ((.035 + Math.abs(Math.sin(t * 23)) * .02) - prize.top.position.y) * Math.min(1, dt * 14);
        prize.top.material.emissive.setHex(rc).multiplyScalar(.35 + Math.abs(Math.sin(t * 9)) * .45);
        if (Math.random() < dt * 30) fx.emit(prize.position.clone().add(new T.Vector3(0, .02, 0)), 1, [rc, 0xffffff], 1.4, { g: 2, spread: .2, life: .5 });
      }
      punch = Math.max(punch, home ? .1 + Math.sin(t * 4) * .08 : .3);
      trayGlow.material.opacity += ((home ? .35 + Math.sin(t * 8) * .15 : 0) - trayGlow.material.opacity) * Math.min(1, dt * 10);
    } else if (!trayFlash) trayGlow.material.opacity = Math.max(0, trayGlow.material.opacity - dt * 2);
    if (trayFlash > 0) { trayFlash = Math.max(0, trayFlash - dt * 1.6); trayGlow.material.opacity = trayFlash * .8; }
    if (ringT < 1) { ringT = Math.min(1, ringT + dt * 1.8); trayRing.scale.setScalar(1 + ringT * 2.2); trayRing.material.opacity = (1 - ringT) * .9; }
    if (phase === 'drag') { const s2 = 1 + punch * .35; prize.scale.set(s2, 1 / (1 + punch * .2), s2); punch = Math.max(0, punch - dt * 2); }
    if (phase === 'fall') {
      yeetT += dt;
      yeetV.y -= 9.8 * dt;
      const home = overMachine(prize.position);
      if (home) {   // glide back toward the tray as it falls
        yeetV.x += (TRAY.x - prize.position.x) * 14 * dt; yeetV.z += (TRAY.z - prize.position.z) * 14 * dt;
        yeetV.x *= .92; yeetV.z *= .92;
      }
      prize.position.addScaledVector(yeetV, dt);
      prize.rotation.x += yeetV.z * dt * 3; prize.rotation.z -= yeetV.x * dt * 3;
      const inTray = Math.abs(prize.position.x - TRAY.x) < .36 && Math.abs(prize.position.z - TRAY.z) < .3;
      if (inTray && prize.position.y <= TRAY.y && yeetV.y < 0) {
        prize.position.y = TRAY.y;
        if (Math.abs(yeetV.y) > 1) { yeetV.y *= -.4; yeetV.x *= .5; sfx.tick(); fx.emit(prize.position, 4, [0xffffff], 1); }
        else { yeetV.set(0, 0, 0); prize.position.copy(TRAY); prize.rotation.set(0, 0, 0); landHome(); }
      } else if (!home || prize.position.y < TRAY.y - .15) {
        // missed the machine: it bumps into the floor / edge / UI and pops, same as a throw
        const s = screenOf(prize.position), m = 16;
        let hit = prize.position.y <= CR || s.x < s.r.left + m || s.x > s.r.right - m || s.y > s.r.bottom - m || yeetT > 3;
        if (!hit) hit = uiRects().some(u => s.x > u.left - m && s.x < u.right + m && s.y > u.top - m && s.y < u.bottom + m);
        if (hit) { prize.position.y = Math.max(prize.position.y, CR); sfx.thud(); shakeEl(root, 7); phase = 'ready'; taps = 99; open(); }
      }
    }
    if (phase === 'yeet') {
      yeetT += dt;
      yeetV.y -= 9.8 * dt; prize.position.addScaledVector(yeetV, dt);
      prize.rotation.x += dt * 9; prize.rotation.z += dt * 6;
      if (Math.random() < .7) fx.emit(prize.position, 2, [RAR[pick.r].col, 0xffffff], .5, { g: 0, life: .5 });
      // bump into the floor, the screen edges, or any UI element → pop!
      const s = screenOf(prize.position), m = 16;
      let hit = prize.position.y <= CR || s.x < s.r.left + m || s.x > s.r.right - m || s.y < s.r.top + m || s.y > s.r.bottom - m || yeetT > 2.5;
      if (!hit) hit = uiRects().some(u => s.x > u.left - m && s.x < u.right + m && s.y > u.top - m && s.y < u.bottom + m);
      if (hit) { prize.position.y = Math.max(prize.position.y, CR); sfx.thud(); shakeEl(root, 8); phase = 'ready'; taps = 99; open(); }
    }
    if (halves) {
      halves.t += dt;
      halves.vt.y -= 6 * dt; halves.vb.y -= 6 * dt;
      prize.top.position.addScaledVector(halves.vt, dt); prize.top.rotation.x -= dt * 6; prize.top.rotation.z += dt * 3;
      prize.bot.position.addScaledVector(halves.vb, dt); prize.bot.rotation.x += dt * 5;
      if (prize.bot.position.y < -.25) { prize.bot.position.y = -.25; halves.vb.set(0, 0, 0); }
    }
    // beam behind the capsule
    beam.position.copy(prize.position).add(new T.Vector3(0, 0, -.05)); beam.quaternion.copy(camera.quaternion);
    beam.rotateZ(t * .8);
    beam.material.color.set(pick ? RAR[pick.r].col : 0xffffff);
    beam.material.opacity += ((prize.visible ? beamA : 0) - beam.material.opacity) * Math.min(1, dt * 6);
    beam.scale.setScalar(1 + Math.sin(t * 3) * .05 + (pick && pick.r === 'SSR' ? .35 : 0));
    fx.update(dt);
    // machine shake + idle bob
    shakeT = Math.max(0, shakeT - dt);
    mach.position.x = shakeT > 0 ? (Math.random() - .5) * shakeT * .5 : 0;
    mach.rotation.z = shakeT > 0 ? (Math.random() - .5) * shakeT * .12 : Math.sin(t * 1.2) * .006;
    // camera
    const fovT = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(3.3 / 2 / (fovT * aspect), (isPC() ? 5.7 : 5.0) / 2 / fovT) * (isPC() ? 1.05 : 1.08);
    camera.position.set(0, 2.4, d); camera.lookAt(0, 2.05, 0);
  }
  function resize(w, h) {
    aspect = w / h; camera.aspect = aspect;
    if (isPC() || w > 700) camera.setViewOffset(w, h, -w * .2, 0, w, h); else camera.setViewOffset(w, h, 0, -h * .03, w, h);
    camera.updateProjectionMatrix();
  }
  setPhase('idle');
  return { scene, camera, frame, resize, onMode() { resize(root.clientWidth, root.clientHeight); } };
});

/* ================= D: 3D Mirai Post ================= */
stage('#post', (root, renderer, canvas) => {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(32, 1, .1, 100);
  scene.add(new T.HemisphereLight(0xffffff, 0x9DB8E8, .85));
  const key = new T.DirectionalLight(0xffffff, .7); key.position.set(-3, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 5, bottom: -3 }); key.shadow.bias = -.0006; scene.add(key);
  const ground = new T.Mesh(new T.CircleGeometry(9, 64), STD(0xD9E7FF, { roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  [[-2.6, -1.6, .9], [2.8, -1.8, 1.1], [-1.4, -2.8, .7], [3.4, .2, .6]].forEach(([x, z, s]) => {
    const t = new T.Group(), m = STD(C.navy, { flatShading: true });
    const c1 = new T.Mesh(new T.ConeGeometry(.42, .9, 7), m); c1.position.y = .7; const c2 = new T.Mesh(new T.ConeGeometry(.3, .65, 7), m); c2.position.y = 1.15;
    const cap = new T.Mesh(new T.ConeGeometry(.16, .25, 7), STD(0xffffff)); cap.position.y = 1.42;
    [c1, c2, cap].forEach(o => { o.castShadow = true; t.add(o); }); t.position.set(x, 0, z); t.scale.setScalar(s); scene.add(t);
  });
  // Japanese-style post box: red body with a rounded top, a lid seam, a front window with the collection-time plate,
  // the 〒 mark and 郵便 POST lettering, standing on a black pole
  const PB = new T.Group(); scene.add(PB);
  const red = STD(0xE60012, { roughness: .32, metalness: .05 }), redDark = STD(0xC4000F, { roughness: .35 }), black = STD(0x1A1A1A, { roughness: .45, metalness: .3 }), dark = STD(0x0B0B0F, { roughness: .9 }), greyM = STD(0xC9CED6, { roughness: .4, metalness: .2 });
  const addPB = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; PB.add(m); return m; };
  const BW = .9, BD = .7, BY = .95, BH = 1.18;          // width, depth, bottom height, height
  const prof = new T.Shape(); { const d = BD / 2, h = BH, rf = .09, rb = .32;
    prof.moveTo(-d, 0); prof.lineTo(d, 0); prof.lineTo(d, h - rf); prof.quadraticCurveTo(d, h, d - rf, h); prof.lineTo(-d + rb, h); prof.quadraticCurveTo(-d, h, -d, h - rb); prof.lineTo(-d, 0); }
  const bodyG = new T.ExtrudeGeometry(prof, { depth: BW - .08, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 4, curveSegments: 16 });
  bodyG.translate(0, 0, -(BW - .08) / 2); bodyG.rotateY(Math.PI / 2);   // shape x (depth) → world z, extrusion → world x
  const body = addPB(new T.Mesh(bodyG, red), 0, BY, 0);
  // lid seam and a slightly proud lid front lip
  addPB(new T.Mesh(new T.BoxGeometry(BW + .02, .014, BD + .02), dark), 0, BY + BH - .22, 0);
  addPB(new T.Mesh(new T.BoxGeometry(BW - .04, .06, .03), redDark), 0, BY + BH - .17, BD / 2 + .045);
  // front window: grey frame, angled collection-time plate inside, the slot just under the lid
  const WY = BY + BH - .5;
  addPB(new T.Mesh(new T.BoxGeometry(.76, .48, .03), greyM), 0, WY, BD / 2 + .03);
  const info = new T.Mesh(new T.PlaneGeometry(.64, .3), new T.MeshStandardMaterial({ map: canvasTex(512, 240, (g, w, h) => {
    g.fillStyle = '#F7F8FA'; g.fillRect(0, 0, w, h); g.strokeStyle = '#9AA3AF'; g.lineWidth = 2;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); }
    g.fillStyle = '#4B5563'; g.font = `700 22px ${JP}`; g.fillText('取集時刻', 10, 34); g.font = `500 20px ${MONO}`;
    ['09:00', '12:30', '16:00'].forEach((s, i) => g.fillText(s, w / 4 * (i + 1) + 12, 34));
    g.fillStyle = '#E60012'; g.font = `900 30px ${JP}`; g.fillText('未来便', 10, h - 20); g.fillStyle = '#111'; g.font = `700 24px ${MONO}`; g.fillText('2027.12.25', w / 2 - 20, h - 22);
  }), emissive: 0xffffff, emissiveIntensity: .05, roughness: .5 }));
  info.position.set(0, WY - .04, BD / 2 + .05); info.rotation.x = -.18; PB.add(info);
  const lamp = info;   // the plate lights up while the letter travels
  const slot = addPB(new T.Mesh(new T.BoxGeometry(.6, .05, .05), dark), 0, BY + BH - .29, BD / 2 + .03);
  const slotGlow = addPB(new T.Mesh(new T.PlaneGeometry(.6, .05), new T.MeshBasicMaterial({ color: C.yellow, transparent: true, opacity: 0 })), 0, BY + BH - .29, BD / 2 + .062);
  const decal = (w, h, draw, pw, ph) => new T.Mesh(new T.PlaneGeometry(pw, ph), new T.MeshBasicMaterial({ map: canvasTex(w, h, draw), transparent: true, depthWrite: false }));
  const yubin = decal(256, 300, (g, w, h) => {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `900 74px ${JP}`; g.fillText('郵便', w / 2, 84);
    g.fillRect(w / 2 - 46, 108, 92, 14); g.fillRect(w / 2 - 46, 136, 92, 14); g.fillRect(w / 2 - 7, 136, 14, 64);
    g.font = `500 64px "Roboto","Helvetica Neue",Arial,sans-serif`; g.fillText('POST', w / 2, 272);
  }, .34, .4);
  yubin.position.set(0, BY + .2, BD / 2 + .047); PB.add(yubin);
  const mark = () => decal(128, 128, (g, w) => { g.fillStyle = '#fff'; g.fillRect(22, 26, 84, 12); g.fillRect(22, 52, 84, 12); g.fillRect(58, 52, 12, 52); }, .16, .16);
  const sideMark = mark(); sideMark.position.set(BW / 2 + .045, BY + BH - .38, 0); sideMark.rotation.y = Math.PI / 2; PB.add(sideMark);
  const lidMark = mark(); lidMark.scale.setScalar(.6); lidMark.position.set(0, BY + BH - .1, BD / 2 + .06); PB.add(lidMark);
  // pole
  addPB(new T.Mesh(new T.CylinderGeometry(.13, .13, BY, 24), black), 0, BY / 2, -.05);
  addPB(new T.Mesh(new T.CylinderGeometry(.22, .26, .06, 24), black), 0, .03, -.05);
  const flagP = new T.Group(); flagP.visible = false; PB.add(flagP);   // (the old flag is no longer used)
  const rings = [0, 1, 2].map(() => { const r = new T.Mesh(new T.TorusGeometry(.62, .03, 8, 64), new T.MeshBasicMaterial({ color: C.yellow, transparent: true, opacity: 0, depthWrite: false })); r.rotation.x = Math.PI / 2; r.position.y = 1.0; PB.add(r); return r; });

  // envelope: back side (with flap) faces the camera while writing
  const ENV = new T.Group(); scene.add(ENV);
  const EW = 1.0, EH = .66;
  const addrTex = canvasTex(640, 422, (g, w, h) => {
    g.fillStyle = '#E5F0FF'; g.fillRect(0, 0, w, h);
    // airmail-style striped border so the envelope stands out from the snow
    for (let i = -h; i < w + h; i += 40) { g.fillStyle = (i / 40) % 2 ? '#0066FF' : '#FFE94A'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 20, 0); g.lineTo(i + 20 - h, h); g.lineTo(i - h, h); g.closePath(); g.fill(); }
    g.fillStyle = '#fff'; g.fillRect(22, 22, w - 44, h - 44);
    g.fillStyle = '#0066FF'; g.fillRect(w - 150, 30, 120, 140); g.fillStyle = '#fff'; g.fillRect(w - 140, 40, 100, 120);
    drawSheepCard(g, w - 136, 62, .74);
    g.fillStyle = '#090A0A'; g.font = `900 46px ${JP}`; g.fillText('2027年12月の', 50, 250); g.fillText('わたしへ', 50, 310);
    g.fillStyle = '#6C7072'; g.font = `500 24px ${MONO}`; g.fillText('MIRAI POST / bravesoft', 50, h - 40);
  });
  const envBlue = STD(0xD3DAE5, { roughness: .6 }), envEdge = STD(0xC2C9D3, { roughness: .6 });
  const backM = new T.Mesh(new T.BoxGeometry(EW, EH, .02), [envEdge, envEdge, envEdge, envEdge, envBlue, new T.MeshStandardMaterial({ map: addrTex })]);
  backM.castShadow = true; ENV.add(backM);
  let wish = '';
  // the letter is the input field: what you type is written straight onto the paper, with a blinking caret
  let typed = '', focused = false, caretOn = true;
  const letterTex = canvasTex(640, 472, (g, w, h) => {
    g.fillStyle = '#FFFDF7'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(9,10,10,.14)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.fillStyle = '#0066FF'; g.font = `700 30px ${MONO}`; g.fillText('DEAR 2027 / MY WISH', 34, 58);
    g.font = `700 22px ${JP}`; g.fillStyle = '#6C7072'; g.fillText('2027年にやりたいこと', 34, 94);
    // writing area starts well below the label
    const TOP = 128, LH = 62, Y0 = TOP + 54;
    g.strokeStyle = 'rgba(0,102,255,.18)'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const y = Y0 + 14 + i * LH; g.beginPath(); g.moveTo(34, y); g.lineTo(w - 34, y); g.stroke(); }
    g.font = `700 38px ${JP}`;
    const lines = typed ? wrapJP(g, typed, w - 68).slice(0, 4) : [];
    if (lines.length) { g.fillStyle = '#090A0A'; lines.forEach((l, i) => g.fillText(l, 34, Y0 + i * LH)); }
    else { g.fillStyle = '#979C9E'; g.fillText(focused ? '' : 'ここをタップして書こう', 34, Y0); }
    if (focused && caretOn) {
      const last = lines[lines.length - 1] || '', cx = 34 + g.measureText(last).width + 3, cy = Y0 + Math.max(0, lines.length - 1) * LH;
      g.fillStyle = '#0066FF'; g.fillRect(cx, cy - 34, 4, 42);
    }
    g.font = `500 22px ${MONO}`; g.fillStyle = '#979C9E'; g.textAlign = 'right'; g.fillText(`${typed.length} / 60`, w - 30, h - 20); g.textAlign = 'left';
    if (!focused && !typed) { g.setLineDash([14, 10]); g.strokeStyle = '#0066FF'; g.lineWidth = 4; g.strokeRect(16, TOP, w - 32, h - TOP - 50); g.setLineDash([]); }
  });
  // the letter is a sheet of card with a visible paper edge, standing a little off the envelope's back so it casts a soft shadow on it
  const LW = EW * .84, LH = EW * .62, LT = .012, LET_Z = .036;   // size, thickness, centre depth (back of the envelope is at z .01)
  const paperEdge = STD(0xE9E2CF, { roughness: .9 }), paperBack = STD(0xFBF8F0, { roughness: .9 });
  const letter = new T.Mesh(new T.BoxGeometry(LW, LH, LT), [paperEdge, paperEdge, paperEdge, paperEdge, new T.MeshStandardMaterial({ map: letterTex, roughness: .85 }), paperBack]);
  letter.castShadow = true;
  const LET_UP = .42;                                   // letter sticks out of the open envelope while writing; ends centred inside (y 0)
  letter.position.set(0, LET_UP, LET_Z); ENV.add(letter);
  // its soft shadow: a blurred card (drawn as the canvas shadow of an off-canvas rect, which every browser supports),
  // laid on the envelope back and on the open flap behind it. The shapes clip the shadow to the paper; the texture slides with the letter.
  const SPAD = .09, SW = LW + SPAD * 2, SH = LH + SPAD * 2;
  const shTex = canvasTex(256, Math.round(256 * SH / SW), (g, w, h) => {
    const m = SPAD * w / SW;
    g.shadowColor = 'rgba(11,28,63,.6)'; g.shadowBlur = m * .85; g.shadowOffsetX = w * 2;
    g.fillStyle = '#000'; g.fillRect(m - w * 2, m, w - m * 2, h - m * 2);
  });
  const shTexF = shTex.clone(); shTexF.needsUpdate = true;
  const shMat = tex => new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const backS = new T.Shape(); backS.moveTo(-EW / 2, -EH / 2); backS.lineTo(EW / 2, -EH / 2); backS.lineTo(EW / 2, EH / 2); backS.lineTo(-EW / 2, EH / 2); backS.lineTo(-EW / 2, -EH / 2);
  const letShB = new T.Mesh(new T.ShapeGeometry(backS), shMat(shTex)); letShB.position.z = .0105; ENV.add(letShB);   // ShapeGeometry uv = local x,y
  const pocketS = new T.Shape(); pocketS.moveTo(-EW / 2, -EH / 2); pocketS.lineTo(EW / 2, -EH / 2); pocketS.lineTo(EW / 2, EH * .12); pocketS.lineTo(0, -EH * .12); pocketS.lineTo(-EW / 2, EH * .12); pocketS.lineTo(-EW / 2, -EH / 2);
  const pocket = new T.Mesh(new T.ShapeGeometry(pocketS), STD(0xE6EAF0, { side: T.DoubleSide, roughness: .6 })); pocket.position.z = .052; pocket.castShadow = true; ENV.add(pocket);
  // the pocket stands off the back now, so close its sides and bottom with thin gussets
  { const gm = STD(0xDCE2EB, { roughness: .6 }), gd = .052 - .01, gh = EH / 2 + EH * .12;
    [-1, 1].forEach(sd => { const w = new T.Mesh(new T.BoxGeometry(.004, gh, gd), gm); w.position.set(sd * (EW / 2 - .002), -EH / 2 + gh / 2, .01 + gd / 2); ENV.add(w); });
    const b = new T.Mesh(new T.BoxGeometry(EW, .004, gd), gm); b.position.set(0, -EH / 2 + .002, .01 + gd / 2); ENV.add(b); }
  const edge = new T.LineBasicMaterial({ color: 0x9AA3AF });
  const pocketLine = new T.Line(new T.BufferGeometry().setFromPoints([[-EW / 2, EH * .12], [0, -EH * .12], [EW / 2, EH * .12]].map(([x, y]) => new T.Vector3(x, y, .054))), edge); ENV.add(pocketLine);
  const flapP = new T.Group(); flapP.position.set(0, EH / 2, -.012); ENV.add(flapP);
  // closed, the flap reaches down to the pocket's V (with a little overlap) so the letter is fully hidden
  const FS = EH * .12 - EH / 2 - .012, FC = -EH * .12 - EH / 2 - .012;   // flap bottom at the sides / at the centre point
  const flapS = new T.Shape(); flapS.moveTo(-EW / 2, 0); flapS.lineTo(EW / 2, 0); flapS.lineTo(EW / 2, FS); flapS.lineTo(0, FC); flapS.lineTo(-EW / 2, FS); flapS.lineTo(-EW / 2, 0);
  const flapM = new T.Mesh(new T.ShapeGeometry(flapS), STD(0xDCE2EB, { side: T.DoubleSide, roughness: .6 })); flapP.add(flapM);
  const letShF = new T.Mesh(new T.ShapeGeometry(flapS), shMat(shTexF)); letShF.position.z = -.003; flapP.add(letShF);   // open, local -z faces the camera
  flapP.add(new T.Line(new T.BufferGeometry().setFromPoints([[-EW / 2, FS], [0, FC], [EW / 2, FS]].map(([x, y]) => new T.Vector3(x, y, .002))), edge));
  const seal = new T.Group(); seal.position.set(0, FC + .07, .03); flapP.add(seal);
  const sealDisc = new T.Mesh(new T.CylinderGeometry(.12, .12, .03, 32), new T.MeshStandardMaterial({ color: C.blue, roughness: .35 }));
  sealDisc.rotation.x = Math.PI / 2; seal.add(sealDisc);
  const sealFace = new T.Mesh(new T.CircleGeometry(.1, 32), new T.MeshBasicMaterial({ map: canvasTex(128, 128, (g, w) => { g.fillStyle = '#0066FF'; g.fillRect(0, 0, w, w); g.fillStyle = '#fff'; g.font = `900 70px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('未', w / 2, w / 2 + 4); }) }));
  sealFace.position.z = .017; seal.add(sealFace); seal.scale.setScalar(.001);
  // a soft blue halo + drop shadow behind the envelope so the white paper pops off the snowy backdrop
  const haloTex = canvasTex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,102,255,.55)'); gr.addColorStop(.5, 'rgba(41,102,255,.3)'); gr.addColorStop(.8, 'rgba(63,156,255,.08)'); gr.addColorStop(1, 'rgba(63,156,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const halo = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, fog: false }));
  halo.renderOrder = -1; scene.add(halo);
  const dropTex = canvasTex(256, 192, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(11,28,63,.42)'); gr.addColorStop(.55, 'rgba(11,28,63,.16)'); gr.addColorStop(1, 'rgba(11,28,63,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const drop = new T.Mesh(new T.PlaneGeometry(1, .75), new T.MeshBasicMaterial({ map: dropTex, transparent: true, depthWrite: false, fog: false }));
  drop.renderOrder = -1; scene.add(drop);
  const fx = makeBurst(scene, 700, .15);

  /* HUD */
  const ta = root.querySelector('.js-wish'), sealBtn = root.querySelector('.js-seal'), postBtn = root.querySelector('.js-post'), sugg = root.querySelector('.p-sugg'), prompt = root.querySelector('.g-prompt'), modal = root.querySelector('.gm'), odo = root.querySelector('.p-odo');
  soundButton(root.querySelector('.js-snd'));
  root.querySelectorAll('.p-sugg button').forEach(b => b.addEventListener('click', () => { ta.value = b.textContent; ta.dispatchEvent(new Event('input')); ta.focus(); }));
  ta.addEventListener('focus', () => { focused = true; caretOn = true; letterTex._redraw(); bounce = 1; if (!wish) setPrompt('2027年にやりたいことを書こう'); });
  ta.addEventListener('blur', () => { focused = false; letterTex._redraw(); });
  setInterval(() => { if (focused) { caretOn = !caretOn; letterTex._redraw(); } }, 530);
  // the guide chip doubles as the action button (封をする / 投函する), so there is no second button repeating it
  let chipAct = null;
  const setPrompt = (t, hot = false, act = null) => {
    prompt.textContent = t; prompt.classList.toggle('hot', hot && !act); prompt.classList.toggle('act', !!act);
    chipAct = act; prompt.setAttribute('role', act ? 'button' : 'status'); prompt.tabIndex = act ? 0 : -1;
    if (!RM) prompt.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 220 });
  };
  prompt.addEventListener('click', e => { e.stopPropagation(); if (chipAct) chipAct(); });
  prompt.addEventListener('keydown', e => { if (chipAct && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); chipAct(); } });
  prompt.addEventListener('pointerdown', e => { if (chipAct) e.preventDefault(); });   // keep the keyboard open until the tap lands
  let envS = 1.5, envPos = null;
  let phase = 'write', bounce = 0, flapT = 0, letterT = 0, sealT = 0, flipT = 0, fly = null, travel = null, shakeT = 0, aspect = 1, flagT = 0, lampT = 0;
  const envHome = () => phase === 'write' ? (isPC() ? new T.Vector3(-1.9, 1.12, 2.1) : new T.Vector3(-.1, 1.02, 2.35)) : (isPC() ? new T.Vector3(-.1, 1.0, 1.3) : new T.Vector3(-.3, .95, 1.4));
  const pbHome = () => isPC() ? new T.Vector3(1.75, 0, -.4) : new T.Vector3(.78, 0, -.85);
  ta.addEventListener('input', () => {
    typed = ta.value.replace(/\n/g, ' '); wish = typed.trim(); caretOn = true; letterTex._redraw();
    if (phase === 'write') { bounce = 1; sfx.key(); if (Math.random() < .5) fx.emit(ENV.position.clone().add(new T.Vector3(0, .5, 0)), 3, [C.yellow, C.sky], 1, { g: 2 }); }
    sealBtn.disabled = !wish;
    if (wish) { if (chipAct !== doSeal) setPrompt('封をする', true, doSeal); } else setPrompt('便せんに、2027年にやりたいことを書こう');
  });
  function doSeal() {
    if (phase !== 'write' || !wish) return;
    phase = 'sealing'; ta.blur(); ta.hidden = true; sugg.hidden = true; sealBtn.hidden = true;
    setPrompt('封をしています…');
  }
  function doPost() {
    if (phase !== 'ready') return;
    phase = 'fly'; sfx.whoosh(); setPrompt('いってらっしゃい！', true);
    const from = ENV.position.clone(), to = PB.position.clone().add(new T.Vector3(0, BY + BH - .29, BD / 2 + .1));
    fly = { t: 0, from, to };
  }
  sealBtn.addEventListener('click', e => { e.stopPropagation(); doSeal(); });
  postBtn.addEventListener('click', e => { e.stopPropagation(); doPost(); });
  // swipe the envelope up to post it
  const ray = new T.Raycaster(); let down = null;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, hit: false }; ray.setFromCamera(ndcOf(canvas, e), camera); down.hit = ray.intersectObject(ENV, true).length > 0; });
  canvas.addEventListener('pointerup', e => {
    if (!down) return;
    const dy = e.clientY - down.y, dx = e.clientX - down.x;
    if (phase === 'ready' && (dy < -40 || (down.hit && Math.hypot(dx, dy) < 10))) doPost();
    else if (phase === 'write' && down.hit) { bounce = 1; ta.focus(); }
    down = null;
  });

  function showReceipt() {
    const no = 'MP-2027-' + String(Math.floor(Math.random() * 90000) + 10000);
    modal.innerHTML = `<div class="gm-card post">
      <div class="gm-rar" style="--rc:#0066FF"><b>MIRAI POST 受付票</b><span>${no}</span></div>
      <span class="gm-new">受付完了</span>
      <p class="pr-wish">「${wish.replace(/[<>&]/g, '')}」</p>
      <dl class="pr-dl"><dt>お届け予定</dt><dd class="pr-date">2027.12.25</dd><dt>お届け先</dt><dd>2027年12月のあなた</dd></dl>
      <p class="gm-ceo"><span>社長より</span>あけましておめでとうございます。2027年は未年、「未来」の年です。この願いは、年末に私たちbravesoftがお届けします。一緒に、あしたをオモシロク。</p>
      <p class="gm-d">デモのため、実際には送信・保存されません。</p>
      <button type="button" class="sbtn blue js-again">もう一通書く</button>
    </div>`;
    modal.hidden = false;
    const card = modal.querySelector('.gm-card');
    if (!RM) {
      card.animate([{ transform: 'translateY(40px) rotate(-3deg)', opacity: 0 }, { transform: 'translateY(-6px) rotate(1deg)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: 460, easing: 'ease-out' });
      card.querySelector('.gm-new').animate([{ transform: 'scale(3) rotate(-25deg)', opacity: 0 }, { transform: 'scale(.9) rotate(-12deg)', opacity: 1, offset: .7 }, { transform: 'scale(1) rotate(-12deg)', opacity: 1 }], { duration: 380, delay: 450, fill: 'backwards', easing: 'ease-in' });
    }
    setTimeout(() => sfx.stamp(), 600);
    card.querySelector('.js-again').addEventListener('click', e => { e.stopPropagation(); reset(); });
  }
  function reset() {
    modal.hidden = true; modal.innerHTML = '';
    phase = 'write'; wish = ''; typed = ''; ta.value = ''; letterTex._redraw();
    ta.hidden = false; sugg.hidden = false; sealBtn.hidden = false; sealBtn.disabled = true; postBtn.hidden = true; postBtn.disabled = false;
    flapT = 0; letterT = 0; sealT = 0; flipT = 0; fly = null; travel = null; flagT = 0; lampT = 0; odo.hidden = true;
    ENV.visible = true; ENV.scale.setScalar(1); seal.scale.setScalar(.001);
    setPrompt('便せんをタップして、2027年にやりたいことを書こう');
  }

  const ease2 = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  // an invisible textarea sits exactly over the 3D letter so tapping the paper puts the caret there (and opens the phone keyboard)
  const cornerV = new T.Vector3();
  function placeInput() {
    letter.updateMatrixWorld();
    const r = canvas.getBoundingClientRect(), sr = root.getBoundingClientRect(), k = root.clientWidth / (sr.width || 1);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
      cornerV.set(sx * EW * .42, sy * EW * .31, 0); letter.localToWorld(cornerV); cornerV.project(camera);
      const px = (r.left + (cornerV.x + 1) / 2 * r.width - sr.left) * k, py = (r.top + (1 - cornerV.y) / 2 * r.height - sr.top) * k;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    });
    ta.style.left = x0 + 'px'; ta.style.top = y0 + 'px'; ta.style.width = Math.max(40, x1 - x0) + 'px'; ta.style.height = Math.max(30, y1 - y0) + 'px';
  }
  function frame(dt, t) {
    dt = dt || 0;
    PB.position.copy(pbHome());
    const home = envHome();
    // sealing sequence: letter slides in -> flap closes -> seal stamps -> envelope flips to the address side
    if (phase === 'sealing') {
      letterT = Math.min(1, letterT + dt * 2.2);
      if (letterT >= 1) flapT = Math.min(1, flapT + dt * 2.5);
      if (flapT >= 1 && sealT === 0) { sealT = .001; }
      if (sealT > 0 && sealT < 1) {
        const before = sealT; sealT = Math.min(1, sealT + dt * 3.5);
        if (before < .6 && sealT >= .6) { sfx.stamp(); buzz(30); shakeEl(root, 5); flash(root, '#E5F0FF'); fx.emit(ENV.position.clone().add(new T.Vector3(0, .1, .2)), 50, [C.blue, 0xffffff, C.yellow], 2.5, { up: .5 }); }
      }
      if (sealT >= 1) {
        flipT = Math.min(1, flipT + dt * 1.8);
        if (flipT >= 1) { phase = 'ready'; setPrompt('投函する', true, doPost); prompt.setAttribute('aria-label', '投函する（封筒を上にスワイプでもOK）'); }
      }
    }
    letter.position.y = LET_UP * (1 - ease2(letterT));
    flapP.rotation.x = -Math.PI * (1 - ease2(flapT));
    flapP.position.z = flapT > 0 ? .058 : -.012;
    // letter shadow: the key light is upper-left/front, so it falls down-right, further (and fainter) on the flap, which is further back
    { const ly = letter.position.y, gB = LET_Z - LT / 2 - .01, gF = LET_Z - LT / 2 + .009;
      const cxB = gB * 1.2, cyB = ly - gB * 2, cxF = gF * 1.2, cyF = ly - gF * 2;
      shTex.repeat.set(1 / SW, 1 / SH); shTex.offset.set(-(cxB - SW / 2) / SW, -(cyB - SH / 2) / SH);
      // the open flap is turned over (local y points down), so v runs the other way
      shTexF.repeat.set(1 / SW, -1 / SH); shTexF.offset.set(-(cxF - SW / 2) / SW, (EH / 2 - cyF + SH / 2) / SH);
      letShB.material.opacity = .75; letShF.material.opacity = .6 * Math.max(0, 1 - flapT * 3); letShF.visible = flapT < .34; }
    const ss = sealT <= 0 ? .001 : sealT < .6 ? 2.4 - 1.6 * (sealT / .6) : 1 + Math.sin((sealT - .6) / .4 * Math.PI) * .12;
    seal.scale.setScalar(ss);
    // envelope placement / idle float
    bounce = Math.max(0, bounce - dt * 4);
    if (phase !== 'fly' && phase !== 'travel' && phase !== 'done') {
      envPos = envPos || home.clone(); envPos.lerp(home, Math.min(1, dt * 4));
      ENV.position.set(envPos.x, envPos.y + Math.sin(t * 1.6) * (focused ? .01 : .04) + bounce * .06, envPos.z);
      ENV.rotation.set(-.12 + Math.sin(t * 1.1) * .03, Math.PI * ease2(flipT) + Math.sin(t * .9) * .08, Math.sin(t * 1.3) * .03 + bounce * .05);
      envS += ((phase === 'write' ? (isPC() ? 2.15 : 1.62) : (isPC() ? 1.45 : 1.15)) - envS) * Math.min(1, dt * 4);
      const s = envS * (1 + bounce * .06); ENV.scale.set(s, s, s);
      if (phase === 'ready') ENV.position.y += Math.abs(Math.sin(t * 4)) * .05;
    }
    { const on = ENV.visible && phase !== 'fly' && phase !== 'travel' && phase !== 'done';
      const hs = envS * (phase === 'write' ? 1.7 : 1.5);
      halo.visible = drop.visible = on;
      halo.position.set(ENV.position.x, ENV.position.y + .08, ENV.position.z - .2); halo.scale.set(envS * 2.0, envS * 1.75, 1); halo.quaternion.copy(camera.quaternion);
      halo.material.opacity = .85 + Math.sin(t * 1.8) * .15;
      drop.position.set(ENV.position.x + .07 * envS, ENV.position.y - .12 * envS, ENV.position.z - .1); drop.scale.set(envS * 1.25, envS * 1.25, 1); drop.quaternion.copy(camera.quaternion); }
    // flight into the slot
    if (fly) {
      fly.t = Math.min(1, fly.t + dt * (RM ? 5 : 1.25));
      const k = ease2(fly.t), p = fly.from.clone().lerp(fly.to, k); p.y += Math.sin(k * Math.PI) * .9; p.z += (1 - k) * .3;
      ENV.position.copy(p);
      ENV.rotation.set(-Math.PI / 2 * k, Math.PI * (1 - k) + Math.PI * k, k * Math.PI * 2);
      ENV.scale.setScalar((isPC() ? 1.45 : 1.15) * (1 - .55 * k));
      if (Math.random() < .6) fx.emit(p, 2, [C.yellow, 0xffffff, C.sky], .6, { g: .5, life: .7 });
      if (fly.t >= 1) {
        fly = null; ENV.visible = false; phase = 'travel'; sfx.postDrop(); buzz(25); shakeEl(root, 6);
        travel = { t: 0 }; odo.hidden = false; slotGlow.material.opacity = 1;
        fx.emit(PB.position.clone().add(new T.Vector3(0, BY + BH - .29, BD / 2 + .1)), 60, [C.yellow, 0xffffff], 2.5, { up: 1 });
        setPrompt('2027年12月へワープ中…', true);
      }
    }
    // time travel: rings, sparks streaming up, odometer
    if (travel) {
      travel.t += dt;
      const T2 = RM ? .4 : 2.6, k = Math.min(1, travel.t / T2);
      rings.forEach((r, i) => { const ph = ((travel.t * 1.2) + i / 3) % 1; r.scale.setScalar(1 + ph * 2.4); r.position.y = .4 + ph * 2.2; r.material.opacity = k < 1 ? (1 - ph) * .55 : 0; });
      if (k < 1 && Math.random() < .8) fx.emit(PB.position.clone().add(new T.Vector3(rand(-.4, .4), 1.9, rand(-.3, .3))), 3, [C.yellow, C.sky, 0xffffff], 1.5, { up: 3, g: -.5, life: 1.2 });
      const day = new Date(2027, 0, 1 + Math.floor(358 * ease2(k)));
      odo.querySelector('b').textContent = `${day.getFullYear()}.${String(day.getMonth() + 1).padStart(2, '0')}.${String(day.getDate()).padStart(2, '0')}`;
      if (Math.floor(travel.t * 14) !== Math.floor((travel.t - dt) * 14)) sfx.tick();
      PB.scale.set(1 + Math.sin(travel.t * 30) * .02 * (1 - k), 1 - Math.sin(travel.t * 30) * .02 * (1 - k), 1);
      lampT = 1;
      if (k >= 1 && phase === 'travel') {
        phase = 'done'; odo.querySelector('b').textContent = '2027.12.25'; popEl(odo, 1.25);
        flagT = .001; sfx.fanfare(5); flash(root, '#FFE94A'); buzz(40);
        fx.emit(PB.position.clone().add(new T.Vector3(0, BY + BH + .2, 0)), 200, [C.yellow, C.blue, 0xffffff, C.sky], 4, { up: 2 });
        setTimeout(() => { odo.hidden = true; showReceipt(); }, RM ? 100 : 1100);
        travel = null; PB.scale.set(1, 1, 1);
      }
    }
    if (flagT > 0) flagT = Math.min(1, flagT + dt * 3);
    flagP.rotation.z = -Math.PI / 2 * (1 - (flagT > 0 ? 1 - Math.pow(1 - flagT, 3) * Math.cos(flagT * 8) : 0));
    lampT = Math.max(0, lampT - dt * .6); lamp.material.emissiveIntensity = .05 + lampT * .7 + (phase === 'ready' ? Math.abs(Math.sin(t * 3)) * .15 : 0);
    slotGlow.material.opacity = Math.max(phase === 'ready' ? .35 + Math.sin(t * 5) * .35 : 0, slotGlow.material.opacity - dt * 1.5);
    fx.update(dt);
    if (phase === 'write') placeInput();
    const fovT = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max((isPC() ? 3.6 : 2.7) / 2 / (fovT * aspect), (isPC() ? 4.3 : 3.6) / 2 / fovT) * 1.08;
    camera.position.set(isPC() ? .5 : 0, 2.3, d + .4); camera.lookAt(isPC() ? .5 : 0, 1.2, 0);
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function resize(w, h) {
    aspect = w / h; camera.aspect = aspect;
    if (isPC() || w > 700) camera.setViewOffset(w, h, -w * .17, 0, w, h); else camera.setViewOffset(w, h, 0, h * .14, w, h);
    camera.updateProjectionMatrix();
  }
  reset();
  return { scene, camera, frame, resize, onMode() { resize(root.clientWidth, root.clientHeight); } };
});

/* ================= K: snow dome ================= */
stage('#dome', (root, renderer, canvas) => {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, .1, 100);
  scene.add(new T.HemisphereLight(0xEAF2FF, 0x253A58, .8));
  const key = new T.DirectionalLight(0xffffff, .8); key.position.set(3, 6, 5); scene.add(key);
  const rim = new T.PointLight(0x3F9CFF, .9, 12); rim.position.set(-3, 2, -2); scene.add(rim);

  const dome = new T.Group(); scene.add(dome);
  const baseMat = new T.MeshStandardMaterial({ color: C.navy, roughness: .45, metalness: .1 });
  const base = new T.Mesh(new T.CylinderGeometry(2.06, 2.32, .66, 72), baseMat); base.position.y = -.33; dome.add(base);
  const ring = new T.Mesh(new T.TorusGeometry(2.0, .065, 12, 96), new T.MeshStandardMaterial({ color: C.blue, roughness: .3 })); ring.rotation.x = Math.PI / 2; ring.position.y = .01; dome.add(ring);
  const texPlate = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#FFE94A'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#090A0A'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 52px ${JP}`; g.fillText('bravesoft 2027', w / 2, h / 2 + 2);
  });
  const plate = new T.Mesh(new T.PlaneGeometry(1.25, .31), new T.MeshStandardMaterial({ map: texPlate, roughness: .5 }));
  plate.position.set(0, -.32, 2.21); plate.rotation.x = -.18; plate.scale.setScalar(1.15); dome.add(plate);

  const inner = new T.Group(); dome.add(inner);
  const snowMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const disk = new T.Mesh(new T.CylinderGeometry(1.95, 1.95, .08, 72), snowMat); disk.position.y = .04; inner.add(disk);
  const mound = new T.Mesh(new T.SphereGeometry(1.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), snowMat); mound.scale.y = .28; mound.position.y = .06; inner.add(mound);
  // snow surface height of the mound / floor at (x,z) — objects stand on it
  const floorH = (x, z) => { const d2 = x * x + z * z; return d2 < 1.44 ? Math.max(.08, .06 + .28 * Math.sqrt(1.44 - d2)) : .08; };
  // colliders: snowflakes land on the top surface of these (inner-local coordinates)
  const COL = [];
  const colSphere = (x, y, z, r) => COL.push({ t: 's', x, y, z, r });
  const colCone = (x, z, r, y0, h) => COL.push({ t: 'k', x, z, r, y0, h });
  const colBox = (x, z, hx, hz, top, ry = 0) => COL.push({ t: 'b', x, z, hx, hz, top, c: Math.cos(ry), s: Math.sin(ry) });
  const colRoof = (x, z, hx, hz, eave, ridge, ry = 0) => COL.push({ t: 'r', x, z, hx, hz, eave, ridge, c: Math.cos(ry), s: Math.sin(ry) });
  const std = (color, o = {}) => new T.MeshStandardMaterial(Object.assign({ color, roughness: .7 }, o));

  // main sheep + lamb
  const sheep = makeSheep({ smooth: true }); sheep.scale.setScalar(.62); sheep.position.set(-.05, floorH(-.05, .2) - .1, .2); sheep.rotation.y = -Math.PI / 2 + .45; inner.add(sheep);
  colSphere(-.05, sheep.position.y + .53, .2, .44); const sheepCol = COL[COL.length - 1];
  const lamb = makeSheep({ smooth: true }); lamb.scale.setScalar(.36); lamb.position.set(.55, floorH(.55, .62) - .05, .62); lamb.rotation.y = -Math.PI / 2 - .9; inner.add(lamb);
  colSphere(.55, lamb.position.y + .31, .62, .26); const lambCol = COL[COL.length - 1];
  // the two sheep wander around their spot and react when the dome is shaken
  const critters = [
    { o: sheep, col: sheepCol, hx: -.05, hz: .2, roam: .45, yOff: -.1, colY: .53, sp: .16, x: -.05, z: .2, fr: .3, mass: 1 },
    { o: lamb, col: lambCol, hx: .55, hz: .62, roam: .3, yOff: -.05, colY: .31, sp: .22, x: .55, z: .62, fr: .18, mass: .45 }
  ].map(c => Object.assign(c, { tx: c.x, tz: c.z, wait: Math.random() * 2, hop: 0, hv: 0, tilt: 0, tiltV: 0, roll: 0, rollV: 0, ph: 0, vx: 0, vz: 0, legs: c.o.legs }));

  // little house with a glowing window
  const hx = -.72, hz = -.58, hry = .55, hb = floorH(hx, hz) - .02;
  const house = new T.Group(); house.position.set(hx, hb, hz); house.rotation.y = hry; inner.add(house);
  const wallsH = .34, hw = .3, hd = .24;
  const walls = new T.Mesh(new T.BoxGeometry(hw * 2, wallsH, hd * 2), std(0xF3F8FF)); walls.position.y = wallsH / 2; house.add(walls);
  const roofShape = new T.Shape(); roofShape.moveTo(-hw - .07, 0); roofShape.lineTo(0, .26); roofShape.lineTo(hw + .07, 0); roofShape.lineTo(-hw - .07, 0);
  const roof = new T.Mesh(new T.ExtrudeGeometry(roofShape, { depth: hd * 2 + .12, bevelEnabled: false }), std(C.blue, { flatShading: true }));
  roof.position.set(0, wallsH, -hd - .06); house.add(roof);
  const win = new T.Mesh(new T.PlaneGeometry(.13, .12), new T.MeshBasicMaterial({ color: C.yellow })); win.position.set(.12, .2, hd + .002); house.add(win);
  const door = new T.Mesh(new T.PlaneGeometry(.11, .2), std(C.navy)); door.position.set(-.12, .1, hd + .002); house.add(door);
  const chim = new T.Mesh(new T.BoxGeometry(.07, .16, .07), std(C.navy)); chim.position.set(.16, wallsH + .2, -.05); house.add(chim);
  const lampLight = new T.PointLight(0xFFE94A, .5, 1.2); lampLight.position.set(.12, .2, hd + .15); house.add(lampLight);
  // roof collider: ridge runs along the house's local z axis (gable faces front)
  colRoof(hx, hz, hw + .07, hd + .06, hb + wallsH, hb + wallsH + .26, hry);
  colBox(hx + .16 * Math.cos(hry) - .05 * Math.sin(hry), hz - .16 * Math.sin(hry) - .05 * Math.cos(hry), .035, .035, hb + wallsH + .28, hry);

  // snowman with a blue scarf
  const sx = .92, sz = .02, sb = floorH(sx, sz);
  const snowman = new T.Group(); snowman.position.set(sx, sb - .03, sz); snowman.rotation.y = -.5; inner.add(snowman);
  const b1 = new T.Mesh(new T.SphereGeometry(.2, 24, 16), snowMat); b1.position.y = .18;
  const b2 = new T.Mesh(new T.SphereGeometry(.13, 24, 16), snowMat); b2.position.y = .45;
  const scarf = new T.Mesh(new T.TorusGeometry(.11, .03, 8, 24), std(C.blue)); scarf.rotation.x = Math.PI / 2; scarf.position.y = .35;
  const tail = new T.Mesh(new T.BoxGeometry(.05, .14, .025), std(C.blue)); tail.position.set(.06, .28, .1);
  const hatG = new T.Group(); hatG.position.y = .54;
  const hat = new T.Mesh(new T.CylinderGeometry(.075, .075, .12, 16), std(C.ink)); hat.position.y = .06;
  const brim = new T.Mesh(new T.CylinderGeometry(.12, .12, .02, 20), std(C.ink)); hatG.add(hat, brim);
  const hatS = { h: 0, hv: 0, tilt: 0, tiltV: 0 };
  const nose = new T.Mesh(new T.ConeGeometry(.025, .1, 8), std(C.yellow)); nose.rotation.x = Math.PI / 2; nose.position.set(0, .45, .16);
  const eyeG = new T.SphereGeometry(.018, 8, 6), eyeM = std(C.ink);
  const e1 = new T.Mesh(eyeG, eyeM); e1.position.set(-.045, .49, .115); const e2 = e1.clone(); e2.position.x = .045;
  snowman.add(b1, b2, scarf, tail, hatG, nose, e1, e2);
  colSphere(sx, sb - .03 + .18, sz, .2); colSphere(sx, sb - .03 + .45, sz, .13); colBox(sx, sz, .12, .12, sb - .03 + .55); colBox(sx, sz, .075, .075, sb - .03 + .66); const hatCol = COL[COL.length - 1], hatTop = hatCol.top;

  // gift box
  const gx = -.6, gz = .82, gb = floorH(gx, gz), gs = .13;
  const gift = new T.Group(); gift.position.set(gx, gb - .01, gz); gift.rotation.y = .4; inner.add(gift);
  const box = new T.Mesh(new T.BoxGeometry(gs * 2, gs * 1.6, gs * 2), std(C.blue)); box.position.y = gs * .8;
  const rib1 = new T.Mesh(new T.BoxGeometry(gs * 2.02, gs * 1.62, .04), std(C.yellow)); rib1.position.y = gs * .8;
  const rib2 = new T.Mesh(new T.BoxGeometry(.04, gs * 1.62, gs * 2.02), std(C.yellow)); rib2.position.y = gs * .8;
  const bow = new T.Mesh(new T.TorusGeometry(.045, .015, 6, 16), std(C.yellow)); bow.position.y = gs * 1.6 + .03;
  gift.add(box, rib1, rib2, bow);
  const giftS = { base: gift.position.y, h: 0, hv: 0, tilt: 0, tiltV: 0, spin: 0, x: gift.position.x, z: gift.position.z, vx: 0, vz: 0 };
  colBox(gx, gz, gs, gs, gb - .01 + gs * 1.6, .4); const giftCol = COL[COL.length - 1];

  // 2027 sign on a post
  const texSign = canvasTex(256, 112, (g, w, h) => { g.fillStyle = '#0066FF'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `700 76px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2027', w / 2, h / 2 + 4); });
  const signX = .4, signZ = -.62, signB = floorH(signX, signZ);
  const signBoard = new T.Mesh(new T.BoxGeometry(.56, .25, .03), [std(C.blue), std(C.blue), std(C.blue), std(C.blue), new T.MeshStandardMaterial({ map: texSign }), std(C.blue)]);
  signBoard.position.set(signX, signB + .5, signZ); signBoard.rotation.y = -.3; inner.add(signBoard);
  const stick = new T.Mesh(new T.CylinderGeometry(.02, .02, .45, 6), inkMat); stick.position.set(signX, signB + .2, signZ); inner.add(stick);
  colBox(signX, signZ, .28, .02, signB + .625, -.3);

  // pine trees (two tiers)
  const domeTrees = [];
  [[-1.1, .28, .95, C.navy], [.08, -1.12, .8, 0x0B1C3F], [1.05, -.62, .62, C.navy], [1.12, .62, .5, 0x0B1C3F]].forEach(([x, z, s, col]) => {
    const b = floorH(x, z);
    const t = new T.Group(); t.position.set(x, b - .02, z); t.scale.setScalar(s); inner.add(t); domeTrees.push(t);
    const m = std(col, { flatShading: true });
    const c1 = new T.Mesh(new T.ConeGeometry(.3, .5, 8), m); c1.position.y = .35;
    const c2 = new T.Mesh(new T.ConeGeometry(.22, .4, 8), m); c2.position.y = .62;
    const tr = new T.Mesh(new T.CylinderGeometry(.04, .05, .14, 6), inkMat); tr.position.y = .07;
    t.add(c1, c2, tr);
    colCone(x, z, .3 * s, b - .02 + .1 * s, .35 * s); colCone(x, z, .22 * s, b - .02 + .42 * s, .4 * s);
  });

  // footprints on the snow floor that the sheep and the present bump into (inner-local):
  // circles {x,z,r} and rotated boxes {x,z,hx,hz} (same rotation convention as colBox); h = height, so a hop can clear low ones
  const OBS = [];
  const obC = (x, z, r, h, tag, o) => OBS.push(Object.assign({ k: 'c', x, z, r, h, tag }, o));
  const obB = (x, z, hx_, hz_, ry, h, tag) => OBS.push({ k: 'b', x, z, hx: hx_, hz: hz_, c: Math.cos(ry), s: Math.sin(ry), h, tag });
  obB(hx, hz, hw + .03, hd + .03, hry, 9, 'house');
  obC(sx, sz, .21, .6, 'snowman');
  obC(signX, signZ, .045, 9, 'sign'); obB(signX, signZ, .28, .03, -.3, 9, 'sign');
  [[-1.1, .28, .95], [.08, -1.12, .8], [1.05, -.62, .62], [1.12, .62, .5]].forEach(([x, z, s], k) => obC(x, z, .25 * s, 9, 'tree', { tree: domeTrees[k], w: 0, wv: 0 }));
  // push a circle (x, z, r) out of every obstacle it overlaps → { x, z, nx, nz, hit } (n = outward normal of the last hit)
  function pushOut(x, z, r, hop) {
    let hit = null, nx = 0, nz = 0;
    for (const o of OBS) {
      if (hop > o.h) continue;
      const dx = x - o.x, dz = z - o.z;
      if (o.k === 'c') {
        const d = Math.hypot(dx, dz), m = o.r + r;
        if (d < m) { const ux = d > 1e-5 ? dx / d : 1, uz = d > 1e-5 ? dz / d : 0; x = o.x + ux * m; z = o.z + uz * m; nx = ux; nz = uz; hit = o; }
      } else {
        const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
        const qx = clamp(lx, -o.hx, o.hx), qz = clamp(lz, -o.hz, o.hz), ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
        if (d >= r) continue;
        let ux, uz, nlx, nlz;
        if (d > 1e-5) { ux = ex / d; uz = ez / d; nlx = qx + ux * r; nlz = qz + uz * r; }
        else if (o.hx - Math.abs(lx) < o.hz - Math.abs(lz)) { ux = Math.sign(lx) || 1; uz = 0; nlx = ux * (o.hx + r); nlz = lz; }   // centre inside: leave by the nearest face
        else { ux = 0; uz = Math.sign(lz) || 1; nlx = lx; nlz = uz * (o.hz + r); }
        x = o.x + nlx * o.c + nlz * o.s; z = o.z - nlx * o.s + nlz * o.c;
        nx = ux * o.c + uz * o.s; nz = -ux * o.s + uz * o.c; hit = o;
      }
    }
    return { x, z, nx, nz, hit };
  }

  // props modelled in Blender (snowdome.glb): turned lacquer base, cottage, pines, gift.
  // The simple shapes above stay as the fallback; colliders and animation targets are unchanged.
  (function loadDomeProps() {
    const b64 = window.NENGA_DOME_GLB; if (!b64 || !T.GLTFLoader) return;
    try {
      const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      new T.GLTFLoader().parse(buf.buffer, '', gltf => {
        const P = {}; gltf.scene.children.forEach(o => { P[o.name] = o; });
        const swap = (grp, src) => { if (!src) return null; grp.children.forEach(ch => { if (!ch.isLight) ch.visible = false; }); const c = src.clone(true); grp.add(c); return c; };
        if (P.DomeBase) { base.visible = false; ring.visible = false; dome.add(P.DomeBase.clone(true)); plate.position.set(0, -.36, 2.2); plate.rotation.x = -.06; }
        swap(house, P.Cottage);
        domeTrees.forEach(t => swap(t, P.Pine));
        swap(gift, P.Gift);
        root.classList.add('glb-ready');
      }, e => console.warn('dome props', e));
    } catch (e) { console.warn('dome props', e); }
  })();

  // top-surface height at (x,z): the highest collider surface, or the snowy floor
  function surfaceH(x, z) {
    let h = floorH(x, z);
    for (const c of COL) {
      let v = -1;
      if (c.t === 's') { const d2 = (x - c.x) ** 2 + (z - c.z) ** 2; if (d2 < c.r * c.r) v = c.y + Math.sqrt(c.r * c.r - d2); }
      else if (c.t === 'k') { const d = Math.hypot(x - c.x, z - c.z); if (d < c.r) v = c.y0 + c.h * (1 - d / c.r); }
      else {
        const dx = x - c.x, dz = z - c.z, lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
        if (Math.abs(lx) < c.hx && Math.abs(lz) < c.hz) v = c.t === 'b' ? c.top : c.ridge - (c.ridge - c.eave) * Math.abs(lx) / c.hx;
      }
      if (v > h) h = v;
    }
    return h;
  }
  const R = 1.98;
  // glass: transparent in the middle, thicker-looking at the rim (fresnel), with soft studio reflections and sharp highlights
  const glassMat = (strength, side) => new T.ShaderMaterial({
    transparent: true, depthWrite: false, side,
    uniforms: { strength: { value: strength }, tint: { value: new T.Color(0xBFD9FF) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float strength; uniform vec3 tint; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
        float ndv = clamp(dot(N, vV), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 3.0);
        vec3 Rf = reflect(-vV, N);
        // studio environment: bright sky above, a tall softbox on the left, a small window on the right
        float sky = smoothstep(-0.2, 0.9, Rf.y);
        float box1 = smoothstep(0.55, 0.75, -Rf.x) * smoothstep(-0.3, 0.1, Rf.y) * smoothstep(0.9, 0.5, Rf.y);
        float box2 = smoothstep(0.7, 0.85, Rf.x) * smoothstep(0.25, 0.45, Rf.y) * smoothstep(0.75, 0.55, Rf.y);
        vec3 env = mix(vec3(0.05,0.12,0.3), vec3(0.75,0.85,1.0), sky) + vec3(1.0) * (box1 * 1.4 + box2 * 1.1);
        vec3 L1 = normalize(vec3(-0.5, 0.7, 0.6)), L2 = normalize(vec3(0.6, 0.4, 0.7));
        float spec = pow(max(dot(Rf, L1), 0.0), 120.0) * 1.6 + pow(max(dot(Rf, L2), 0.0), 60.0) * 0.6;
        float a = (0.035 + fres * 0.55 + (box1 + box2) * 0.35 * (0.3 + fres)) * strength + spec;
        vec3 col = mix(tint, env, 0.6 + fres * 0.4) + spec;
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.92));
      }`
  });
  const glass = new T.Mesh(new T.SphereGeometry(R, 72, 54, 0, Math.PI * 2, 0, Math.PI * .56), glassMat(1, T.FrontSide));
  glass.position.y = .45; glass.renderOrder = 10; dome.add(glass);
  const glassIn = new T.Mesh(new T.SphereGeometry(R * .965, 64, 48, 0, Math.PI * 2, 0, Math.PI * .56), glassMat(.55, T.BackSide));
  glassIn.position.y = .45; glassIn.renderOrder = 9; dome.add(glassIn);
  const lip = new T.Mesh(new T.TorusGeometry(R * .985, .045, 12, 96), new T.MeshPhysicalMaterial({ color: 0xDCEBFF, roughness: .05, metalness: 0, clearcoat: 1, transparent: true, opacity: .55 }));
  lip.rotation.x = Math.PI / 2; lip.position.y = .03; dome.add(lip);

  // snow particles (in dome local space, center at y=.45)
  const NP = 5600, pos = new Float32Array(NP * 3), vel = new Float32Array(NP * 3);   // 8× the original 700
  const CY = .45, RIN = R - .1;
  const rest = new Uint8Array(NP);
  for (let i = 0; i < NP; i++) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 1.4;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    pos[i * 3] = x; pos[i * 3 + 1] = surfaceH(x, z) + .01; pos[i * 3 + 2] = z; rest[i] = 1;
  }
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
  const snow = makeSnow(pg, NP, .035, .15);
  inner.add(snow);
  // each flake sinks at its own speed (big ones faster, soft fluffy ones slower) and flutters side to side as it falls
  const vt = new Float32Array(NP), flF = new Float32Array(NP), flP = new Float32Array(NP);
  { const sz = pg.attributes.size.array, vr = pg.attributes.variant.array;
    for (let i = 0; i < NP; i++) { vt[i] = (.1 + sz[i] * 1.25) * (.8 + Math.random() * .4) * (vr[i] >= 12 ? .75 : 1); flF[i] = 1.4 + Math.random() * 2.2; flP[i] = Math.random() * 6.28; } }
  // the water: flakes are carried by it. W = its spin relative to the glass (angular velocity, local axes) + turbulence;
  // both die down over a couple of seconds like a real globe
  // + two turbulence modes whose phases and scales are re-rolled on every big shake, so each shake swirls differently
  // + a ring-shaped overturn (Hill's vortex: up through the middle, out over the top, down along the glass) that lifts the snow
  const W = { x: 0, y: 0, z: 0, turb: 0, up: 0, k1: 1, k2: 2.2, p: [0, 1, 2, 3, 4, 5] };
  const rerollWater = () => { W.k1 = .8 + Math.random() * .7; W.k2 = 1.9 + Math.random() * 1.2; for (let k = 0; k < 6; k++) W.p[k] = Math.random() * 6.28; };
  let pOX = 0, pOY = 0, pVX = 0, pVY = 0, pWZ = 0, pWX = 0, bumpSnd = 0, snowFC = 0;

  const LINES = ['あけましておめでとうございます。', '2027年は未年。「未」は「未来」の「未」です。', '雪がとけたら、新しいことが芽吹く季節。', '今年も皆さまと一緒に、あしたをオモシロク。'];
  const msg = $('.ov-msg', root), linesEl = $('.js-lines', root), sigEl = $('.js-sig', root), shakesEl = $('.js-shakes', root), btn = $('.js-shake', root), allBtn = $('.js-all', root);
  let offX = 0, offY = 0, offVX = 0, offVY = 0, prevRZ = 0, prevRX = 0;
  let hintedMo = false, shown = 1, wob = 0, wobV = 0, tiltX = 0, tiltZ = 0, drag = null, dragDist = 0, counted = false, aspect = 1, lock = false;
  let lastSlosh = 0, moSeen = motion.shakes, moReveal = 0;
  function shake(power) {
    const now = performance.now();
    if (now - lastSlosh > 380 || power >= 1) { lastSlosh = now; play('globe', { vol: Math.min(1, .35 + power * .65) }); }
    // stir the water (a spin around a random axis + turbulence); the flakes on the floor are swept up by it
    const sgn = Math.random() < .5 ? -1 : 1;
    W.x += (Math.random() - .5) * power * 2.4; W.y += sgn * power * (1.4 + Math.random()); W.z += (Math.random() - .5) * power * 2.4;
    if (power > .5 || W.turb < .2) rerollWater();
    W.turb = Math.min(1.1, W.turb + power * 1.0); W.up = Math.min(1.3, W.up + power * 1.1);
    // flakes are thrown every which way (mostly up), so they fill the globe instead of rising as one sheet
    for (let i = 0; i < NP; i++) {
      if (rest[i] && Math.random() > .25 + power * .7) continue;
      rest[i] = 0;
      vel[i * 3] += (Math.random() - .5) * power * 1.6;
      vel[i * 3 + 1] += (.3 + Math.random() * 1.6) * power;
      vel[i * 3 + 2] += (Math.random() - .5) * power * 1.6;
    }
    wobV += power * 4 * sgn;
    critters.forEach(c => { c.hv += power * (1.2 + Math.random() * 1.2); c.tiltV += (Math.random() - .5) * power * 14; c.rollV += (Math.random() - .5) * power * 10; c.wait = 0; });
    giftS.hv += power * (1 + Math.random()); giftS.tiltV += (Math.random() - .5) * power * 16; giftS.spin += (Math.random() - .5) * power * 3;
    hatS.hv += power * (1.4 + Math.random() * .8); hatS.tiltV += (Math.random() - .5) * power * 18;
  }
  function render() {
    const done = shown >= LINES.length;
    // brush-written lines; the newest one is "written" with a stroke-by-stroke wipe
    const prev = linesEl.querySelectorAll('.ln:not(.ghost)').length;
    linesEl.innerHTML = LINES.map((l, i) => i < shown
      ? `<span class="ln${i >= prev ? ' new' : ''}" style="--n:${[...l].length}">${l}</span>`
      : (i === shown ? '<span class="ln ghost">ドームを振ると、続きが読めます</span>' : '')).join('');
    sigEl.hidden = !done; allBtn.hidden = done;
    shakesEl.textContent = done ? 'すべて読みました' : `メッセージ ${shown} / ${LINES.length}`;
    btn.textContent = done ? 'もう一度最初から' : 'ドームを振る';
  }
  // one shake = one new line, shown right away (no waiting for the snow to settle)
  function reveal() {
    if (lock || shown >= LINES.length) return;
    lock = true;
    setTimeout(() => { shown++; render(); lock = false; sfx.chime({ vol: .35, rate: 1 + shown * .06 }); if (shown >= LINES.length) sfx.fanfare(4); }, RM ? 0 : 300);
  }
  btn.addEventListener('click', () => {
    if (shown >= LINES.length) { shown = 1; render(); return; }
    shake(1); reveal();
  });
  allBtn.addEventListener('click', () => { shake(.8); shown = LINES.length; render(); });
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; dragDist = 0; counted = false; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
    dragDist += Math.hypot(dx, dy);
    tiltZ = clamp(tiltZ - dx * .006, -.5, .5); tiltX = clamp(tiltX + dy * .006, -.4, .4);
    offX = clamp(offX + dx * .0035, -.35, .35); offY = clamp(offY - dy * .0025, -.22, .22);
    const sp = Math.min(1, Math.hypot(dx, dy) / 30); if (sp > .1) shake(sp * .4);
    if (!counted && dragDist > 24) { counted = true; reveal(); }
  });
  const end = () => {
    if (drag && !counted) { shake(1); reveal(); } // a simple tap also shakes
    drag = null; canvas.style.cursor = '';
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', () => { drag = null; canvas.style.cursor = ''; });
  render();

  const GIFT_R = gs * 1.25;
  // what happens when something runs into an obstacle: the sheep wobbles, a tree shakes its snow off,
  // the snowman's hat jumps, the cottage roof sheds a little
  function bumped(c, o, speed) {
    if (c) { c.tiltV += (Math.random() - .5) * speed * 14; c.rollV += (Math.random() - .5) * speed * 10; c.hv += speed * .5; }
    if (o.tag === 'tree') o.wv += speed * (Math.random() < .5 ? -6 : 6);
    if (o.tag === 'snowman') { hatS.hv += speed * 1.2; hatS.tiltV += (Math.random() - .5) * speed * 20; }
    const rad = o.tag === 'tree' ? o.r * 1.6 : o.tag === 'house' ? .45 : .3, share = o.tag === 'house' ? .3 : 1;
    for (let i = 0; i < NP; i++) if (rest[i] && Math.random() < share) { const ex = pos[i * 3] - o.x, ez = pos[i * 3 + 2] - o.z; if (ex * ex + ez * ez < rad * rad && pos[i * 3 + 1] > floorH(pos[i * 3], pos[i * 3 + 2]) + .05) { rest[i] = 0; vel[i * 3 + 1] = .1 + Math.random() * .3 * speed; vel[i * 3] = (Math.random() - .5) * .3; vel[i * 3 + 2] = (Math.random() - .5) * .3; } }
    const now = performance.now(); if (now - bumpSnd > 280) { bumpSnd = now; play('thud', { vol: Math.min(.4, .12 + speed * .3), rate: 1.3 + Math.random() * .3 }); }
  }
  function frame(dt, t) {
    dt = dt || .016;
    // trees that were bumped sway back on a spring
    OBS.forEach(o => { if (!o.tree) return; o.wv += (-o.w * 70 - o.wv * 5) * dt; o.w += o.wv * dt; o.tree.rotation.z = o.w * .12; o.tree.rotation.x = o.w * .06; });
    // wobble spring
    wobV += (-wob * 30 - wobV * 4) * dt; wob += wobV * dt;
    if (!drag && motion.on) {
      // the phone is the globe: tilting it tilts the globe (so the snow, the sheep and the gift slide), and a shake
      // jolts it sideways, stirs the water and — like a tap — brings the next line (at most one per second)
      if (!hintedMo) { hintedMo = true; motion.hint('スマホをかたむける・ふるとドームが動きます'); }
      const k = Math.min(1, dt * 6);
      tiltZ += (clamp(-motion.roll * .8, -.5, .5) - tiltZ) * k; tiltX += (clamp(motion.pitch * .6, -.4, .4) - tiltX) * k;
      offVX += (-offX * 40 - offVX * 6) * dt; offVY += (-offY * 40 - offVY * 6) * dt; offX += offVX * dt; offY += offVY * dt;
      if (motion.fresh(moSeen)) {
        const pw = motion.shakePow, now = performance.now();
        offVX += motion.shakeDir.x * pw * 2.6; offVY += motion.shakeDir.y * pw * 1.8;
        shake(pw * .9);
        if (now - moReveal > 1000 && shown < LINES.length) { moReveal = now; reveal(); }
      }
      moSeen = motion.shakes;
    } else if (!drag) {
      tiltX *= .9; tiltZ *= .9;
      // the globe springs back to its place with a little overshoot
      offVX += (-offX * 40 - offVX * 6) * dt; offVY += (-offY * 40 - offVY * 6) * dt; offX += offVX * dt; offY += offVY * dt;
    }
    dome.position.x = offX; dome.position.y = offY;
    dome.rotation.z = wob * .25 + tiltZ + offVX * .02; dome.rotation.x = tiltX * .6;
    inner.rotation.y = Math.sin(t * .3) * .12;
    // how much the globe turned this frame
    const dRZ = dome.rotation.z - prevRZ, dRX = dome.rotation.x - prevRX; prevRZ = dome.rotation.z; prevRX = dome.rotation.x;
    // "down" inside the globe follows its tilt
    const gx = -Math.sin(dome.rotation.z), gy = -Math.cos(dome.rotation.z) * Math.cos(dome.rotation.x), gz = Math.sin(dome.rotation.x);
    // the water: when the glass changes its spin, the water keeps going (so relative to the glass it spins the other way);
    // when the globe is jerked sideways the water sloshes into a swirl. Viscosity brings it back to rest.
    { const ide = 1 / Math.max(dt, .008), wz = dRZ * ide, wx = dRX * ide;
      W.z -= (wz - pWZ) * 1.3; W.x -= (wx - pWX) * 1.3; pWZ = wz; pWX = wx;
      const vX = (offX - pOX) * ide, vY = (offY - pOY) * ide, aX = vX - pVX, aY = vY - pVY; pOX = offX; pOY = offY; pVX = vX; pVY = vY;
      W.z += aX * .9; W.x -= aY * .5; W.turb = Math.min(.9, W.turb + (Math.abs(aX) + Math.abs(aY)) * .25);
      // the flakes are a touch heavier than water, so they lag behind a jerk of the glass
      if (Math.abs(aX) + Math.abs(aY) > .01) for (let i = 0; i < NP; i++) if (!rest[i]) { vel[i * 3] -= aX * .35; vel[i * 3 + 1] -= aY * .35; }
      const wd = Math.exp(-dt / 1.7); W.x *= wd; W.y *= wd; W.z *= wd; W.turb *= Math.exp(-dt / 1.4); W.up *= Math.exp(-dt / 1.5);
      const lim = 3.2, wm = Math.hypot(W.x, W.y, W.z); if (wm > lim) { W.x *= lim / wm; W.y *= lim / wm; W.z *= lim / wm; } }
    hatCol.top = hatTop + hatS.h;
    // the sheep stroll, hop when shaken, wobble, and settle again
    critters.forEach(c => {
      c.wait -= dt;
      if (c.wait <= 0 && Math.hypot(c.tx - c.x, c.tz - c.z) < .03) {
        // next spot to stroll to: somewhere free (not inside the cottage, a tree, the snowman…)
        for (let k = 0; k < 8; k++) { const a = Math.random() * 6.28, r = Math.random() * c.roam, tx = c.hx + Math.cos(a) * r, tz = c.hz + Math.sin(a) * r; if (!pushOut(tx, tz, c.fr, 0).hit) { c.tx = tx; c.tz = tz; break; } }
        c.wait = 1.5 + Math.random() * 3;
      }
      const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
      const v = c.wait > 0 && d < .03 ? 0 : c.sp;
      c.vx += ((d > .01 ? dx / d * v : 0) - c.vx) * Math.min(1, dt * 4); c.vz += ((d > .01 ? dz / d * v : 0) - c.vz) * Math.min(1, dt * 4);
      // tilting the globe makes them slide downhill (hooves grip a little, so a small tilt does nothing)
      const sx = -Math.sin(dome.rotation.z), sz = Math.sin(dome.rotation.x), slope = Math.hypot(sx, sz);
      if (slope > .06) { c.vx += sx * 3.2 * dt; c.vz += sz * 3.2 * dt; c.wait = Math.max(c.wait, .6); c.tx = c.x; c.tz = c.z; }
      // inertia: when the globe turns, the sheep slide the other way a little
      c.vx += -dRZ * 1.8 / Math.max(dt, .008) * dt; c.vz += dRX * 1.2 / Math.max(dt, .008) * dt;
      c.x += c.vx * dt; c.z += c.vz * dt;
      // bump into the cottage, trees, snowman and sign
      const P = pushOut(c.x, c.z, c.fr, c.hop);
      if (P.hit) {
        c.x = P.x; c.z = P.z;
        const vn = c.vx * P.nx + c.vz * P.nz;
        if (vn < 0) { c.vx -= vn * P.nx * 1.35; c.vz -= vn * P.nz * 1.35; }        // stop, bounce back a little
        if (vn < -.2) bumped(c, P.hit, -vn);
        // walking into it: give up on that spot, look around, pick another
        if ((c.tx - c.x) * P.nx + (c.tz - c.z) * P.nz < -.02) { c.tx = c.x; c.tz = c.z; c.wait = Math.max(c.wait, .5); }
      }
      // ewe and lamb jostle (the lamb gives way more)
      critters.forEach(o => {
        if (o === c || Math.abs(o.hop - c.hop) > .3) return;
        const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz), m = c.fr + o.fr;
        if (d >= m || d < 1e-5) return;
        const ux = dx / d, uz = dz / d, k = o.mass / (o.mass + c.mass);
        c.x += ux * (m - d) * k; c.z += uz * (m - d) * k;
        const rv = (c.vx - o.vx) * ux + (c.vz - o.vz) * uz;
        if (rv < 0) { c.vx -= rv * ux * k * 1.4; c.vz -= rv * uz * k * 1.4; if (rv < -.3) { c.tiltV += (Math.random() - .5) * 8; c.rollV += (Math.random() - .5) * 6; } }
      });
      // nudge the present: it is light, so it slides away and the sheep barely slows down
      if (c.hop < .2 + giftS.h) {
        const dx = giftS.x - c.x, dz = giftS.z - c.z, d = Math.hypot(dx, dz), m = c.fr + GIFT_R;
        if (d < m && d > 1e-5) {
          const ux = dx / d, uz = dz / d, p = m - d;
          giftS.x += ux * p * .8; giftS.z += uz * p * .8; c.x -= ux * p * .2; c.z -= uz * p * .2;
          const rv = (c.vx - giftS.vx) * ux + (c.vz - giftS.vz) * uz;
          if (rv > 0) { giftS.vx += ux * rv * 1.5; giftS.vz += uz * rv * 1.5; if (rv > .25) { giftS.tiltV += (Math.random() - .5) * rv * 20; giftS.hv += rv * .6; } }
        }
      }
      const rr = Math.hypot(c.x, c.z); if (rr > 1.35) { c.x *= 1.35 / rr; c.z *= 1.35 / rr; }
      c.hv -= 9 * dt; c.hop += c.hv * dt; if (c.hop < 0) { c.hop = 0; c.hv = Math.abs(c.hv) > 1 ? -c.hv * .3 : 0; }
      c.tiltV += (-c.tilt * 60 - c.tiltV * 5) * dt; c.tilt += c.tiltV * dt;
      c.rollV += (-c.roll * 60 - c.rollV * 5) * dt; c.roll += c.rollV * dt;
      const spd = Math.hypot(c.vx, c.vz);
      if (spd > .02) { const want = Math.atan2(-c.vz, c.vx); let dy = want - c.o.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.o.rotation.y += dy * Math.min(1, dt * 5); }
      c.ph += dt * (spd * 40 + (c.hop > 0 ? 10 : 0));
      c.legs.forEach((l, j) => { l.rotation.z = Math.sin(c.ph + (j === 0 || j === 3 ? 0 : Math.PI)) * Math.min(.6, spd * 4 + (c.hop > 0 ? .4 : 0)); });
      // never poke out of the glass: limit the hop (and push inward) so the woolly body stays inside the dome
      const ins = R - .12 - c.col.r;
      let cy = floorH(c.x, c.z) + c.yOff + c.colY + c.hop, dd = Math.hypot(c.x, cy - CY, c.z);
      if (dd > ins) {
        const room = Math.sqrt(Math.max(0, ins * ins - c.x * c.x - c.z * c.z)) + CY - (floorH(c.x, c.z) + c.yOff + c.colY);
        if (room > 0) { c.hop = Math.min(c.hop, room); if (c.hv > 0 && c.hop >= room) c.hv = -c.hv * .3; }
        else { const k2 = .97; c.x *= k2; c.z *= k2; }
      }
      c.o.position.set(c.x, floorH(c.x, c.z) + c.yOff + c.hop + Math.abs(Math.sin(c.ph)) * .01, c.z);
      c.o.rotation.x = c.roll; c.o.rotation.z = c.tilt;
      c.col.x = c.x; c.col.z = c.z; c.col.y = c.o.position.y + c.colY;
    });
    // the gift box hops and the snowman's hat pops up
    giftS.hv -= 9 * dt; giftS.h += giftS.hv * dt; if (giftS.h < 0) { giftS.h = 0; giftS.hv = Math.abs(giftS.hv) > .8 ? -giftS.hv * .35 : 0; }
    giftS.tiltV += (-giftS.tilt * 70 - giftS.tiltV * 6) * dt; giftS.tilt += giftS.tiltV * dt; giftS.spin *= .96;
    giftS.h = Math.min(giftS.h, .55); if (giftS.h >= .55 && giftS.hv > 0) giftS.hv = -giftS.hv * .3;
    // the present slides on the snow when the globe tilts
    { const sx = -Math.sin(dome.rotation.z), sz = Math.sin(dome.rotation.x);
      if (Math.hypot(sx, sz) > .05) { giftS.vx += sx * 3.6 * dt; giftS.vz += sz * 3.6 * dt; }
      giftS.vx += -dRZ * 1.5 / Math.max(dt, .008) * dt; giftS.vz += dRX * 1.0 / Math.max(dt, .008) * dt;
      giftS.vx *= Math.pow(.15, dt); giftS.vz *= Math.pow(.15, dt);
      giftS.x += giftS.vx * dt; giftS.z += giftS.vz * dt;
      const gr = Math.hypot(giftS.x, giftS.z); if (gr > 1.45) { giftS.x *= 1.45 / gr; giftS.z *= 1.45 / gr; giftS.vx *= -.3; giftS.vz *= -.3; }
      // the present bumps into the cottage, trees, snowman, sign and the sheep
      const P = pushOut(giftS.x, giftS.z, GIFT_R, giftS.h);
      if (P.hit) {
        giftS.x = P.x; giftS.z = P.z;
        const vn = giftS.vx * P.nx + giftS.vz * P.nz;
        if (vn < 0) { giftS.vx -= vn * P.nx * 1.4; giftS.vz -= vn * P.nz * 1.4; if (vn < -.25) { giftS.tiltV += (Math.random() - .5) * -vn * 18; bumped(null, P.hit, -vn * .6); } }
      }
      critters.forEach(c => { if (c.hop > .2 + giftS.h) return; const dx = giftS.x - c.x, dz = giftS.z - c.z, d = Math.hypot(dx, dz), m = c.fr + GIFT_R; if (d < m && d > 1e-4) { giftS.x = c.x + dx / d * m; giftS.z = c.z + dz / d * m; } });
      gift.position.x = giftS.x; gift.position.z = giftS.z; giftS.base = floorH(giftS.x, giftS.z) - .01;
      giftCol.x = giftS.x; giftCol.z = giftS.z; giftCol.top = giftS.base + gs * 1.6 + giftS.h; }
    gift.position.y = giftS.base + giftS.h; gift.rotation.z = giftS.tilt; gift.rotation.y += giftS.spin * dt;
    hatS.hv -= 9 * dt; hatS.h += hatS.hv * dt; if (hatS.h < 0) { hatS.h = 0; hatS.hv = Math.abs(hatS.hv) > .8 ? -hatS.hv * .3 : 0; }
    hatS.tiltV += (-hatS.tilt * 50 - hatS.tiltV * 4) * dt; hatS.tilt += hatS.tiltV * dt;
    hatS.h = Math.min(hatS.h, .45); if (hatS.h >= .45 && hatS.hv > 0) hatS.hv = -hatS.hv * .3;
    hatG.position.y = .54 + hatS.h; hatG.rotation.z = hatS.tilt; hatG.rotation.x = hatS.tilt * .6;
    // flakes: each one relaxes toward (water velocity + its own sinking speed + flutter); they settle on whatever is below,
    // slide off when what held them moves away, get kicked up when something moves into them and are swept up again by fast water
    const relax = 1 - Math.exp(-dt / .2), tiltS = Math.hypot(gx, gz);
    // each flake also drifts a little on its own (more while the water is stirred), so neighbours don't stay in lock-step
    const wSpin = Math.hypot(W.x, W.y, W.z), jit = (.03 + .35 * W.turb + .08 * wSpin) * Math.sqrt(dt) * 3.4, RIN2 = RIN * RIN;
    const k1 = W.k1, k2 = W.k2, P = W.p;
    // settled flakes are checked on every 3rd frame only (a third of them each frame), which keeps 5600 flakes cheap
    snowFC = (snowFC + 1) % 3; const rdt = dt * 3;
    for (let i = 0; i < NP; i++) {
      if (rest[i] && (i + snowFC) % 3) continue;
      const ix = i * 3;
      let x = pos[ix], y = pos[ix + 1], z = pos[ix + 2];
      let vx = vel[ix], vy = vel[ix + 1], vz = vel[ix + 2];
      const ry0 = y - CY;
      // water velocity here: spin (W × r), fading to zero at the glass (water clings to the wall, so flakes are not
      // flung into one stream along it) + a two-scale divergence-free wobble (each component ignores its own axis)
      const tb = W.turb, ns = Math.max(0, 1 - (x * x + ry0 * ry0 + z * z) / RIN2) * 1.4;
      const ux = (W.y * z - W.z * ry0) * ns + tb * (.65 * Math.sin(k1 * (1.7 * ry0 + 2.1 * z) + P[0] + t * 1.1) + .35 * Math.sin(k2 * (1.3 * ry0 - 1.6 * z) + P[3] + t * 1.7));
      const uy = (W.z * x - W.x * z) * ns + tb * .8 * (.65 * Math.sin(k1 * (1.9 * z + 1.3 * x) + P[1] + t * .9) + .35 * Math.sin(k2 * (1.5 * x - 1.2 * z) + P[4] + t * 1.5));
      const uz = (W.x * ry0 - W.y * x) * ns + tb * (.65 * Math.sin(k1 * (1.5 * x + 1.8 * ry0) + P[2] + t * 1.3) + .35 * Math.sin(k2 * (1.4 * ry0 - 1.7 * x) + P[5] + t * 1.9));
      if (rest[i]) {
        const h = surfaceH(x, z);
        if (y > h + .03) rest[i] = 0;                                                     // its support moved away: fall
        else if (y < h - .015) {
          // something moved into it. A sheep walking through floor snow ploughs it aside (now and then a little puff);
          // anything else (the present hopping, the hat landing) tosses it up
          const c = y < floorH(x, z) + .03 && critters.find(c => (x - c.x) ** 2 + (z - c.z) ** 2 < (c.fr + .15) ** 2);
          if (c) {
            const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz) || 1, m = c.fr + .03;
            x = c.x + dx / d * m; z = c.z + dz / d * m; y = floorH(x, z) + .006;
            if (Math.random() < .12) { rest[i] = 0; vy = .12 + Math.random() * .15; vx = dx / d * .2; vz = dz / d * .2; }
          } else { y = h + .01; rest[i] = 0; vy = .2 + Math.random() * .3; vx = (Math.random() - .5) * .25; vz = (Math.random() - .5) * .25; }
        }
        else if (Math.hypot(ux, uy, uz) > .3 + vt[i] && Math.random() < rdt * 6) { rest[i] = 0; vy = .15; }   // swept up by the water
        else if (tiltS > .3 && Math.random() < (tiltS - .3) * rdt * 3) { rest[i] = 0; }   // steep tilt: it slides
        if (rest[i]) { pos[ix] = x; pos[ix + 1] = y; pos[ix + 2] = z; continue; }
      }
      const fa = vt[i] * .7, fs = Math.sin(t * flF[i] + flP[i]) * fa, fc = Math.cos(t * flF[i] * .77 + flP[i] * 1.3) * fa;
      // overturn: u_ρ = A·ρ·h/R², u_y = A·(1 − (2ρ² + h²)/R²) — divergence-free and tangent to the glass
      const A = W.up, ho = A * ry0 / RIN2, uyo = A * (1 - (2 * (x * x + z * z) + ry0 * ry0) / RIN2);
      vx += (ux + x * ho + gx * vt[i] + fs - vx) * relax;
      vy += (uy + uyo + gy * vt[i] - vy) * relax;
      vz += (uz + z * ho + gz * vt[i] + fc - vz) * relax;
      vx += (Math.random() - .5) * jit; vy += (Math.random() - .5) * jit * .6; vz += (Math.random() - .5) * jit;
      const px = x, py = y, pz = z;
      x += vx * dt; y += vy * dt; z += vz * dt;
      // glass: stay inside, lose the outward part of the velocity, slide along the wall with a little friction
      const ry = y - CY, rr = Math.sqrt(x * x + ry * ry + z * z);
      if (rr > RIN) {
        const nx = x / rr, ny = ry / rr, nz = z / rr; x = nx * RIN; y = CY + ny * RIN; z = nz * RIN;
        const vn = vx * nx + vy * ny + vz * nz; if (vn > 0) { vx -= vn * nx * 1.15; vy -= vn * ny * 1.15; vz -= vn * nz * 1.15; }
        vx *= .85; vy *= .85; vz *= .85;
      }
      // a thin layer of still water at the glass nudges flakes back into the open
      { const wall = rr - (RIN - .12); if (wall > 0) { const k = wall * 3.5 / (rr || 1); vx -= x * k; vy -= ry * k; vz -= z * k; } }
      // land on whatever is below: roofs, the sheep's back, tree tops, the snowman's hat, the present, or the floor
      const fh = floorH(x, z), h = surfaceH(x, z);
      if (y <= h) {
        if (h <= fh + .001 || ((py >= h - .02 || h - y < .05) && vy <= .05)) { y = h + .006; vx = vy = vz = 0; rest[i] = 1; }
        else {
          // came in from the side: bounce off the wall instead of passing through
          x = px; z = pz; vx *= -.25; vz *= -.25;
          const h2 = surfaceH(x, z); if (y < h2) { y = h2 + .006; vx = vy = vz = 0; rest[i] = 1; }
        }
      }
      pos[ix] = x; pos[ix + 1] = y; pos[ix + 2] = z; vel[ix] = vx; vel[ix + 1] = vy; vel[ix + 2] = vz;
    }
    pg.attributes.position.needsUpdate = true; snow.material.uniforms.time.value = t;
    // camera framing
    const fovT = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(2.85 / (fovT * aspect), 3.1 / fovT) * (isPC() ? .92 : 1.0);
    camera.position.set(0, .9 + d * .22, d);
    camera.lookAt(0, .55, 0);
  }
  function resize(w, h) {
    aspect = w / h; camera.aspect = aspect;
    if (isPC() || w > 700) camera.setViewOffset(w, h, w * .2, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * .17, w, h);
    camera.updateProjectionMatrix(); snow.fit(renderer, camera, h);
  }
  fontsReady.then(() => { texPlate._redraw(); texSign._redraw(); });
  root._dm = { pos, rest, W, critters, giftS, OBS, pushOut, surfaceH, shake };   // test hook
  return { scene, camera, frame, resize, onMode() { resize(root.clientWidth, root.clientHeight); } };
});
window.NENGA.fx = { SND, tone, play, sfx, soundButton, buzz, shakeEl, popEl };
window.NENGA.three = { stage, canvasTex, makeBurst, ndcOf, LOGO };
})();
