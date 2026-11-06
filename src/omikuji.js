/* ================= H: ひつじみくじ — 3D omikuji tube (modelled in Blender) =================
   grab & shake the tube → it flips upside down → one stick slides out of the hole, drops and tips over
   → the scene wipes to a dark night shrine and the fortune unrolls → tie it to the rope. */
(() => {
const root = document.querySelector('#omikuji'); if (!root) return;
const N3 = window.NENGA && window.NENGA.three, T = window.THREE, FX = (window.NENGA && window.NENGA.fx) || null;
const $ = (s, r = root) => r.querySelector(s), $$ = (s, r = root) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wait = ms => new Promise(r => setTimeout(r, ms));
const tone = FX ? FX.tone : () => {}, sfx = FX ? FX.sfx : new Proxy({}, { get: () => () => {} }), buzz = FX ? FX.buzz : () => {};
const snd = () => FX && FX.SND.on, play = FX ? FX.play : () => false;
const isPC = () => root.clientWidth >= 700;
const KNUM = n => { const d = '〇一二三四五六七八九'; if (n < 10) return d[n]; const t = Math.floor(n / 10), o = n % 10; return (t > 1 ? d[t] : '') + '十' + (o ? d[o] : ''); };

const act = $('.js-act'), again = $('.js-again'), hint = $('.omi-hint'), dots = $$('.omi-meter i'), noEl = $('.omi-no');
const paper = $('.omi-paper'), sheet = $('.omi-sheet'), roll = $('.omi-roll'), tied = $('.omi-tied'), dark = $('.omi-dark'), canvas = $('canvas.gl');
if (FX) FX.soundButton($('.js-snd'));
const setHint = t => { hint.textContent = t; };

/* ---------- fortunes ---------- */
const RANKS = [{ r: '大吉', w: 2 }, { r: '未来吉', w: 4 }, { r: '羊吉', w: 2 }, { r: 'メェ吉', w: 2 }];
const POEMS = ['雪のした|芽ぶく未来を|待つひつじ', '跳ぶまえの|柵はいつでも|低く見ゆ', 'もこもこと|夢ふくらます|未の春', '群れなせば|遠き山へも|道ひらく'];
const ITEMS = {
  願望: ['思いは毛糸のように、長くつむげ', 'メェ一杯ねがえば、かなう'],
  仕事: ['群れで挑めば、道ひらく', '新しい柵を、軽やかに跳べ'],
  学問: ['未知を楽しむ者、伸びる', '数えたひつじの数だけ、身につく'],
  旅行: ['北の牧場に吉あり', '遠くへ跳べ。柵は低い']
};
const CEO = '「未」は「未来」の「未」。<span class="long">まだ誰も見たことのない体験を、</span>皆さまと一緒に。';
const weighted = () => { const tot = RANKS.reduce((s, r) => s + r.w, 0); let x = Math.random() * tot; for (const r of RANKS) { x -= r.w; if (x <= 0) return r.r; } return RANKS[0].r; };

/* ---------- 3D scene ---------- */
let api = null;   // set by the 3D stage
if (T && N3 && N3.stage) N3.stage('#omikuji', (r, renderer, cv) => {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, .1, 60);
  scene.add(new T.HemisphereLight(0xFFF4E0, 0x3A4A70, .55));
  const key = new T.DirectionalLight(0xFFE7C2, .95); key.position.set(-3, 6, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -4, right: 4, top: 5, bottom: -2, near: 1, far: 20 }); key.shadow.bias = -.0008;
  scene.add(key);
  const rim = new T.PointLight(0xFFC970, .7, 12); rim.position.set(3, 3, -2); scene.add(rim);
  const fill = new T.DirectionalLight(0xC9DAFF, .3); fill.position.set(4, 2, 6); scene.add(fill);
  const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: .3 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  /* textures painted in canvas: wood grain, the red 御神籤 plate, the stick */
  const ct = N3.canvasTex;
  const woodTex = ct(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#C9965A'); gr.addColorStop(.5, '#E2B97F'); gr.addColorStop(1, '#C48F52');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) { const x = Math.random() * w; g.strokeStyle = `rgba(${Math.random() < .5 ? '120,75,30' : '250,220,170'},${rand(.08, .22)})`; g.lineWidth = rand(.6, 2.2); g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += 16) g.lineTo(x + Math.sin(y * .02 + i) * 3, y); g.stroke(); }
    for (let i = 0; i < 4; i++) { const x = rand(40, w - 40), y = rand(40, h - 40); g.strokeStyle = 'rgba(110,65,25,.25)'; g.lineWidth = 1.5; for (let k = 1; k < 5; k++) { g.beginPath(); g.ellipse(x, y, 4 * k, 12 * k, 0, 0, 7); g.stroke(); } }
  });
  woodTex.wrapS = woodTex.wrapT = T.RepeatWrapping; woodTex.repeat.set(2, 1);
  const labelTex = ct(160, 480, (g, w, h) => {
    g.fillStyle = '#D9332B'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,230,190,.55)'; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#FFF6E6'; g.font = `900 92px "Noto Serif JP","Hiragino Mincho ProN",serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    ['御', '神', '籤'].forEach((c, i) => g.fillText(c, w / 2, 80 + i * 108));
    g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, h - 62, 28, 0, 7); g.fill(); g.fillStyle = '#0066FF'; g.beginPath(); g.arc(w / 2, h - 62, 18, 0, 7); g.fill();
  });
  labelTex.flipY = false;
  const stickTex = ct(64, 512, (g, w, h) => { g.fillStyle = '#EBD3A6'; g.fillRect(0, 0, w, h); for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(150,105,55,${rand(.1, .25)})`; g.beginPath(); const x = rand(0, w); g.moveTo(x, 0); g.lineTo(x + rand(-3, 3), h); g.stroke(); } });
  let numTex = null;
  const paintNum = txt => ct(64, 320, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#C9302A'; g.font = `900 46px "Noto Serif JP",serif`; g.textAlign = 'center'; g.textBaseline = 'top'; [...txt].forEach((c, i) => g.fillText(c, w / 2, 6 + i * 50)); });

  /* rig: tubeRoot (on the floor) → pivot (held at the middle) → the Blender mesh */
  const tubeRoot = new T.Group(), pivot = new T.Group(); tubeRoot.add(pivot); scene.add(tubeRoot);
  const HH = 1.5, SL = 1.3;   // tube height, stick length (Blender units)
  pivot.position.y = HH / 2;
  const stick = new T.Group(); stick.visible = false; scene.add(stick);
  let ready = false;
  // fallback geometry while (or if) the model is not available
  const fb = new T.Mesh(new T.CylinderGeometry(.5, .5, HH, 6), new T.MeshStandardMaterial({ map: woodTex, roughness: .6 })); fb.castShadow = true; pivot.add(fb);
  const fbStick = new T.Mesh(new T.BoxGeometry(.05, SL, .032), new T.MeshStandardMaterial({ map: stickTex, roughness: .6 })); fbStick.castShadow = true; stick.add(fbStick);
  const numPlane = new T.Mesh(new T.PlaneGeometry(.04, .2), new T.MeshBasicMaterial({ transparent: true })); numPlane.position.set(0, SL / 2 - .13, .0175); stick.add(numPlane);
  (() => {
    const b64 = window.NENGA_OMIKUJI_GLB; if (!b64 || !T.GLTFLoader) return;
    try {
      const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      new T.GLTFLoader().parse(buf.buffer, '', gltf => {
        let tube = null, st = null;
        gltf.scene.traverse(o => {
          if (o.name === 'Tube') tube = o; if (o.name === 'Stick') st = o;
          if (o.isMesh) {
            o.castShadow = true; o.receiveShadow = true;
            const ms = Array.isArray(o.material) ? o.material : [o.material];
            ms.forEach(m => {
              if (/^Wood/.test(m.name)) { m.map = woodTex; m.color.setHex(0xffffff); }
              if (/^Label/.test(m.name)) { m.map = labelTex; m.color.setHex(0xffffff); m.roughness = .5; }
              if (/^StickWood/.test(m.name)) { m.map = stickTex; m.color.setHex(0xffffff); }
              m.needsUpdate = true;
            });
          }
        });
        if (tube) { tube.parent.remove(tube); tube.position.set(0, 0, 0); pivot.add(tube); fb.visible = false; }
        if (st) { st.parent.remove(st); st.position.set(0, 0, 0); stick.add(st); fbStick.visible = false; }
        ready = true;
      }, e => console.warn('omikuji model', e));
    } catch (e) { console.warn('omikuji model', e); }
  })();

  /* ----- layout ----- */
  let aspect = 1, Hv = 4.6, lookY = 1.6;
  const halfW = () => Hv / 2 * aspect;
  const homeX = () => state === 'reveal' || state === 'tie' ? (isPC() ? (-1 + .21 * 2) * halfW() : 0) : 0;
  function resize(w, h) {
    aspect = w / h; camera.aspect = aspect;
    Hv = isPC() ? 4.7 : Math.max(5.4, 2.9 / aspect);
    const D = Hv / 2 / Math.tan(T.MathUtils.degToRad(15));
    lookY = (isPC() ? .36 : .31) * Hv;   // floor sits ~86% (PC) / ~81% (phone) down the screen
    camera.position.set(0, lookY + .5, D); camera.lookAt(0, lookY, 0);
    camera.updateProjectionMatrix();
  }

  /* ----- interaction: grab and shake ----- */
  const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 0, 1), 0), hitV = new T.Vector3();
  const ndc = e => { const rc = cv.getBoundingClientRect(); return new T.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1); };
  const worldAt = e => { ray.setFromCamera(ndc(e), camera); ray.ray.intersectPlane(plane, hitV); return hitV.clone(); };
  let state = 'idle', drag = null;
  const off = new T.Vector3(), vel = new T.Vector3(), tgt = new T.Vector3();   // pivot offset from its rest point (spring)
  let rotZ = 0, rotV = 0, rotX = 0, flipT = 0, flip = null, lastSign = 0, swing = 0, shakes = 0, rattleT = 0;
  let stickSim = null, settleT = 0, revealT = 0;
  // phone sensors (NENGA.motion): the tube leans with the phone's tilt, and shaking the phone shakes the tube
  const MO = window.NENGA && window.NENGA.motion;
  let moSeen = MO ? MO.shakes : 0, moHint = false;
  cv.addEventListener('pointerdown', e => {
    if (state !== 'idle') return;
    const p = worldAt(e);
    drag = { start: p.clone().sub(off), moved: 0, x: e.clientX, y: e.clientY, t: e.timeStamp };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ } cv.classList.add('grab');
    play('omi_clack', { vol: .3, rate: .8 });
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = worldAt(e), k = root.clientWidth / (root.getBoundingClientRect().width || 1);
    const dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k; drag.x = e.clientX; drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    tgt.copy(p).sub(drag.start); tgt.x = clamp(tgt.x, -1.3, 1.3); tgt.y = clamp(tgt.y, -.1, 1.2); tgt.z = 0;
    // a shake = the hand changes direction after a decent swing (horizontal or vertical)
    const d = Math.abs(dx) > Math.abs(dy) ? dx : dy, sgn = Math.sign(d);
    swing += Math.abs(d);
    if (sgn && lastSign && sgn !== lastSign && swing > (isPC() ? 60 : 34)) { swing = 0; onShake(); }
    if (sgn) lastSign = sgn;
  });
  const release = e => {
    if (!drag) return;
    const tap = drag.moved < 8;
    drag = null; cv.classList.remove('grab'); tgt.set(0, 0, 0); lastSign = 0; swing = 0;
    if (tap && state === 'idle') { rotV += rand(-1, 1) < 0 ? -9 : 9; vel.y += 2.2; onShake(); }
  };
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);
  // a random slice of the recorded stick rattle; n ≈ how many clicks, v the loudness (0.03 = a full shake)
  function rattle(n = 6, v = .03) { const d = .06 + n * .045; play('omi_rattle', { offset: rand(0, 1.3 - d), dur: d, vol: Math.min(1, v * 30), rate: rand(.92, 1.1) }); }
  function onShake() {
    if (state !== 'idle') return;
    shakes++; rattle(); buzz(14); rattleT = .4;
    dots.forEach((d, i) => d.classList.toggle('on', i < shakes));
    if (shakes < 3) setHint(`カラカラ… あと${3 - shakes}回`);
    else startFlip();
  }
  function startFlip() {
    state = 'flip'; drag = null; cv.classList.remove('grab'); tgt.set(0, 0, 0);
    setHint('筒を逆さにして…');
    flip = { t: 0, from: rotZ };
  }
  /* stick: two-point verlet so it falls, bounces on its end and tips over naturally */
  function dropStick(holeW) {
    const r = .03, A = holeW.clone(), B = holeW.clone().add(new T.Vector3(0, -SL, 0));
    stickSim = { A, B, pA: A.clone().add(new T.Vector3(rand(-.004, .004), .01, 0)), pB: B.clone().add(new T.Vector3(rand(.006, .012) * (Math.random() < .5 ? -1 : 1), .01, 0)), r, hit: 0 };
  }
  // ground sounds: the first end to touch down plays the full カラン…カラカラ drop, the other end slaps when the stick tips flat;
  // later small bounces only tick. v = impact speed (units/s), so it does not depend on the frame rate.
  function landed(end, v) {
    const s = stickSim; if (v < .15 || s[end + 'Hit']) { if (v > .6 && s.hit < 6) { s.hit++; play('omi_clack', { vol: Math.min(.5, v * .2), rate: rand(.95, 1.15) }); } return; }
    s[end + 'Hit'] = true; s.hit++;
    if (s.hit === 1) { play('omi_drop', { vol: 1, rate: rand(.96, 1.05) }); buzz(14); }
    else { play('omi_flat', { vol: clamp(.35 + v * .25, .35, .8), rate: rand(.95, 1.06) }); buzz(8); }
  }
  function simStick(dt) {
    const s = stickSim, g = -9.8 * .55, sub = 4, h = dt / sub;
    for (let k = 0; k < sub; k++) {
      [['A', 'pA'], ['B', 'pB']].forEach(([p, q]) => {
        const cur = s[p], prev = s[q], vx = (cur.x - prev.x) * .999, vy = (cur.y - prev.y) * .999;
        prev.copy(cur); cur.x += vx; cur.y += vy + g * h * h;
        if (cur.y < s.r) { cur.y = s.r; prev.y = cur.y + vy * .32; prev.x = cur.x - vx * .7; landed(p, -vy / h); }
      });
      for (let it = 0; it < 3; it++) {
        const d = s.A.clone().sub(s.B), L = d.length() || 1e-4, diff = (L - SL) / L / 2;
        s.A.addScaledVector(d, -diff); s.B.addScaledVector(d, diff);
      }
    }
    const d = s.A.clone().sub(s.B);
    stick.position.copy(s.A).add(s.B).multiplyScalar(.5); stick.position.z = .1;
    stick.rotation.set(0, 0, Math.atan2(d.y, d.x) - Math.PI / 2);
    const speed = s.A.distanceTo(s.pA) + s.B.distanceTo(s.pB);
    return speed < .0012 && s.A.y < .08 && s.B.y < .08;
  }
  const ease = t => 1 - Math.pow(1 - t, 3), back = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  let slideT = 0, liftY = 0, numTxt = '';
  function frame(dt, t) {
    dt = dt || 0;
    // spring the held tube toward the hand
    const K = drag ? 160 : 70, Cd = drag ? 16 : 7;
    vel.x += ((tgt.x - off.x) * K - vel.x * Cd) * dt; vel.y += ((tgt.y - off.y) * K - vel.y * Cd) * dt;
    off.addScaledVector(vel, dt);
    let lean = 0;
    if (MO && MO.on) {
      if (!moHint && state === 'idle') { moHint = true; MO.hint('スマホごとふっても、おみくじが引けます'); }
      lean = clamp(-MO.roll * .7, -.5, .5);
      if (MO.fresh(moSeen) && state === 'idle' && !drag) {
        const pw = MO.shakePow, sg = MO.shakeDir.x ? -Math.sign(MO.shakeDir.x) : (Math.random() < .5 ? -1 : 1);
        rotV += sg * (6 + pw * 6); vel.x += sg * pw * 2.5; vel.y += 1.2 + pw * 1.6; onShake();
      }
      moSeen = MO.shakes;
    }
    if (state === 'idle' || state === 'reveal' || state === 'tie') {
      // the tube leans against the motion (inertia) and with the phone's tilt, and wobbles back upright
      const want = clamp(-vel.x * .22 + lean, -.75, .75);
      rotV += ((want - rotZ) * 120 - rotV * 9) * dt; rotZ += rotV * dt;
      rotX += ((clamp(vel.y * .08, -.3, .3)) - rotX) * Math.min(1, dt * 8);
      if (!drag && state === 'idle') { rotZ += Math.sin(t * 1.3) * .0006; }
    }
    if (state === 'flip') {
      flip.t = Math.min(1, flip.t + dt / (RM ? .2 : .85));
      liftY = ease(flip.t) * (SL + .35);
      rotZ = flip.from + (Math.PI - flip.from) * back(flip.t);
      if (flip.t >= 1) { state = 'pour'; slideT = 0; flip.pour = 0; }
    }
    if (state === 'pour') {
      flip.pour += dt;
      rotZ = Math.PI + Math.sin(flip.pour * 26) * .07 * Math.max(0, 1 - flip.pour * 1.1);
      if (Math.floor(flip.pour * 10) !== Math.floor((flip.pour - dt) * 10)) rattle(2, .02);
      if (flip.pour > .55) {
        // the stick slides out of the hole a little at a time
        if (!stick.visible) { stick.visible = true; const n = Math.random() < .45 ? 27 : 1 + Math.floor(Math.random() * 30); numTxt = KNUM(n) + '番'; numTex = paintNum(numTxt); numPlane.material.map = numTex; numPlane.material.needsUpdate = true; api.no = `第${KNUM(n)}番`; setHint('出てきた…！'); }
        slideT = Math.min(1, slideT + dt * (RM ? 4 : .9) * (.6 + Math.random()));
        if (Math.random() < .3) play('omi_rattle', { offset: rand(0, 1.2), dur: .05, vol: .25, rate: rand(.8, 1) });
        if (slideT >= 1) { state = 'fall'; const hole = holeWorld(); dropStick(hole.add(new T.Vector3(0, -SL * .02, 0))); setTimeout(() => { if (state === 'fall' || state === 'settle') flip.back = 0; }, 350); }
      }
    }
    if (state === 'fall' || state === 'settle') {
      if (flip.back !== undefined) { flip.back = Math.min(1, flip.back + dt / .8); liftY = (SL + .35) * (1 - ease(flip.back)); rotZ = Math.PI * (1 - ease(flip.back)); }
      const still = simStick(dt);
      settleT = still ? settleT + dt : 0;
      if (settleT > .35 && state === 'fall') { state = 'settle'; showNumber(); }
    }
    // pose the tube
    tubeRoot.position.x += ((homeX() + (state === 'idle' ? 0 : 0)) - tubeRoot.position.x) * Math.min(1, dt * 4);
    const hideOnPhone = !isPC() && (state === 'reveal' || state === 'tie');
    tubeRoot.position.y += ((hideOnPhone ? -3 : 0) - tubeRoot.position.y) * Math.min(1, dt * 4);
    pivot.position.set(off.x, HH / 2 + off.y + liftY, 0);
    pivot.rotation.set(rotX, 0, rotZ);
    if (rattleT > 0) { rattleT -= dt; pivot.position.x += Math.sin(t * 90) * .008 * rattleT; }
    // stick attached to the tube while sliding out
    if (state === 'pour' && stick.visible) {
      const hole = holeWorld(); stick.position.set(hole.x, hole.y - SL / 2 * slideT * 1.02 + SL * .02 * (1 - slideT), .1); stick.rotation.set(0, 0, 0);
      stick.position.x += Math.sin(t * 60) * .004;
    }
    if (state === 'reveal' || state === 'tie') { revealT = Math.min(1, revealT + dt * 2); stick.scale.setScalar(Math.max(.001, 1 - revealT)); }
    else { revealT = 0; stick.scale.setScalar(1); }
  }
  const holeLocal = new T.Vector3(0, HH / 2, 0);
  function holeWorld() { pivot.updateMatrixWorld(true); return holeLocal.clone().applyMatrix4(pivot.matrixWorld); }
  function showNumber() {
    const p = stick.position.clone().project(camera), rc = root;
    noEl.textContent = api.no;
    noEl.style.left = ((p.x + 1) / 2 * rc.clientWidth) + 'px'; noEl.style.top = ((1 - p.y) / 2 * rc.clientHeight - (isPC() ? 70 : 46)) + 'px';
    noEl.animate([{ opacity: 0, transform: 'translate(-50%,-30%) scale(.5)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.08)', offset: .7 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 420, fill: 'forwards', easing: 'ease-out' });
    sfx.chime(); buzz(20);
    setTimeout(() => reveal(), RM ? 200 : 1300);
  }
  function tubeScreen() { const p = new T.Vector3(tubeRoot.position.x, HH / 2, 0).project(camera); return { x: (p.x + 1) / 2 * 100, y: (1 - p.y) / 2 * 100 }; }
  function reset() {
    state = 'idle'; shakes = 0; dots.forEach(d => d.classList.remove('on'));
    stick.visible = false; stickSim = null; settleT = 0; liftY = 0; rotZ = 0; rotV = 0; flip = null; off.set(0, 0, 0); vel.set(0, 0, 0);
  }
  api = { reset, setState: s => { state = s; }, get state() { return state; }, tubeScreen, no: '' };
  return { scene, camera, frame, resize, onMode() { resize(root.clientWidth, root.clientHeight); } };
});

/* ---------- reveal: dark wipe + the fortune unrolls ---------- */
const fitSheet = () => {
  // shrink the type until every column fits inside the paper (no overflow)
  let fs = isPC() ? 15 : 13;
  sheet.style.setProperty('--fs', fs + 'px');
  for (let i = 0; i < 30 && (sheet.scrollWidth > sheet.clientWidth + 1 || sheet.scrollHeight > sheet.clientHeight + 1) && fs > 7.5; i++) { fs -= .5; sheet.style.setProperty('--fs', fs + 'px'); }
};
function darkWipe(on) {
  const c = api ? api.tubeScreen() : { x: 50, y: 60 };
  const from = `circle(0% at ${c.x}% ${c.y}%)`, to = `circle(150% at ${c.x}% ${c.y}%)`;
  root.classList.toggle('dark', on);
  if (RM) { dark.style.clipPath = on ? to : from; return; }
  dark.animate([{ clipPath: on ? from : to }, { clipPath: on ? to : from }], { duration: on ? 1100 : 800, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' });
}
async function reveal() {
  if (!api) return;
  api.setState('reveal'); root.classList.add('reveal');
  noEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
  darkWipe(true);
  play('omi_bell', { vol: .8 });
  const rank = weighted();
  sheet.innerHTML = `<div class="no">${api.no}</div><div class="rank brushf">${rank}</div><div class="poem">${pick(POEMS).split('|').join('<br>')}</div><i class="sep"></i>`
    + Object.entries(ITEMS).map(([k, v]) => `<div class="it${k === '学問' ? ' opt' : ''}"><b>【${k}】</b><span>${pick(v)}</span></div>`).join('')
    + `<div class="ceo"><b>社長より</b>${CEO}</div>`;
  setHint(`${rank}！ 読んだら、上の縄に結んでいきましょう`);
  await wait(RM ? 0 : 500);
  paper.hidden = false; fitSheet();
  const dur = RM ? 1 : 1300, t0 = performance.now();
  play('omi_unroll', { vol: .7 });
  await new Promise(res => {
    const st = t => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      paper.style.clipPath = `inset(-30px -30px -30px ${(1 - e) * 100}%)`;
      roll.style.left = `${(1 - e) * 100}%`; roll.style.opacity = p < 1 ? 1 : 0;
      if (p < 1) requestAnimationFrame(st); else res();
    };
    requestAnimationFrame(st);
  });
  sfx.chime();
  const rk = $('.rank', sheet);
  rk.animate([{ transform: 'scale(1.5)', filter: 'brightness(1.5)' }, { transform: 'scale(1)', filter: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  act.textContent = '結び所に結ぶ'; act.disabled = false; again.hidden = false;
}
async function tie() {
  if (!api || api.state !== 'reveal') return;
  api.setState('tie'); act.disabled = true;
  const rr = root.getBoundingClientRect(), k = root.clientWidth / (rr.width || 1);
  const rect = el => { const b = el.getBoundingClientRect(); return { x: (b.left - rr.left) * k, y: (b.top - rr.top) * k, w: b.width * k, h: b.height * k }; };
  const kn = document.createElement('i'); kn.className = 'omi-knot';
  tied.prepend(kn); if (tied.children.length > 9) tied.lastElementChild.remove();
  const pr = rect(paper), kr = rect(kn); kn.style.visibility = 'hidden';
  const dx = kr.x + kr.w / 2 - (pr.x + pr.w / 2), dy = kr.y + kr.h / 2 - (pr.y + pr.h / 2);
  sfx.whoosh();
  await paper.animate([{ transform: 'none' }, { transform: 'scale(.1,.85) rotate(4deg)', offset: .45 }, { transform: `translate(${dx}px,${dy}px) scale(${kr.w / pr.w},${kr.h / pr.h})` }], { duration: RM ? 1 : 900, easing: 'cubic-bezier(.5,0,.3,1)' }).finished;
  paper.hidden = true; kn.style.visibility = '';
  kn.animate([{ transform: 'rotate(-16deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(0)' }], { duration: 700 });
  play('omi_tie', { vol: .9 }); buzz(20);
  await wait(450);
  back('結べました。もう一度ひくこともできます');
}
function back(msg) {
  paper.hidden = true; paper.style.clipPath = ''; root.classList.remove('reveal');
  darkWipe(false);
  if (api) api.reset();
  act.textContent = '筒をふる'; act.disabled = false; again.hidden = true;
  setHint(msg || '筒をつかんで、左右に振ってください');
}
act.addEventListener('click', () => {
  if (!api) return;
  if (api.state === 'reveal') return tie();
  if (api.state === 'idle') {
    // the button shakes for you (keyboard / quick play)
    const ev = new PointerEvent('pointerdown'); void ev;
    root.dispatchEvent(new CustomEvent('omi:shake'));
  }
});
again.addEventListener('click', () => { if (api && api.state === 'reveal') back(); });
// keyboard / button shake: same as a tap on the tube
root.addEventListener('omi:shake', () => { const c = canvas, r = c.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height * .6; ['pointerdown', 'pointerup'].forEach(t => c.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, bubbles: true, pointerId: 1 }))); });
new ResizeObserver(() => { if (!paper.hidden) fitSheet(); }).observe(root);
})();
