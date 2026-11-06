/* ================= J: ぺったん餅つき — voxel stage (three.js) =================
   A bipedal voxel sheep in a hachimaki swings the kine on your tap; the usu, the mochi and the floor are built
   from cubes that each react to the impact (springs), so every hit ripples through the whole stage.
   Judgements: PERFECT (ぺったん!) / GOOD (いいね!) / EARLY・LATE (はやい / おそい) / MISS (すかっ…) / DANGER (あぶない!) */
(() => {
const root = document.querySelector('#mochi'); if (!root) return;
const T = window.THREE, N3 = window.NENGA && window.NENGA.three, FX = (window.NENGA && window.NENGA.fx) || null;
if (!T || !N3) return;
const $ = (s, r = root) => r.querySelector(s), $$ = (s, r = root) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const play = FX ? FX.play : () => false, sfx = FX ? FX.sfx : new Proxy({}, { get: () => () => {} }), buzz = FX ? FX.buzz : () => {}, snd = () => FX && FX.SND.on;
if (FX) FX.soundButton($('.js-snd'));
const duck = k => { const S = window.NENGA && window.NENGA.snd; if (S) S.bgmDuck('mochi', k); };
const isPC = () => root.clientWidth >= 700;

const btn = $('.js-act'), judgeEl = $('.mc-judge'), comboEl = $('.mc-combo'), comboN = $('.mc-combo b'), gaugeI = $('.mc-gauge i'), pctEl = $('.mc-pct');
const msgEl = $('.mc-msg'), msgN = $('.mc-msg-n'), msgP = $('.mc-msg p'), flashEl = $('.mc-flash'), finalEl = $('.mc-final'), howEl = $('.mc-how');
const LINES = ['あけましておめでとうございます。', '2027年は未（ひつじ）年。', '「未」は「未来」の「未」です。', '息を合わせて、ぺったんと。', '皆さまと、オモシロい一年をつき上げます。'];
const SIG = 'bravesoft株式会社 代表取締役 〇〇 〇〇';

N3.stage('#mochi', (r, renderer, cv) => {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-5, 5, 5, -5, .1, 100);
  scene.add(new T.HemisphereLight(0xFFFFFF, 0x2A5FD0, .75));
  const sun = new T.DirectionalLight(0xFFFFFF, .75); sun.position.set(-5, 11, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 }); sun.shadow.bias = -.0015; sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new T.DirectionalLight(0xBFE0FF, .35); fill.position.set(6, 4, 8); scene.add(fill);

  /* ---------- voxel kit: one chamfered cube geometry, instanced per object, every cube on a spring ---------- */
  const cubeGeo = (() => {
    const s = new T.Shape(), h = .5, r = .09;
    s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h); s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
    const g = new T.ExtrudeGeometry(s, { depth: 1 - .16, bevelEnabled: true, bevelThickness: .08, bevelSize: .0, bevelSegments: 1, curveSegments: 2 });
    g.translate(0, 0, -(1 - .16) / 2); g.computeVertexNormals(); return g;
  })();
  const cubeMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .62, metalness: 0 });
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(), COL = new T.Color();
  function vox(cells, parent, opt = {}) {
    const n = cells.length, mesh = new T.InstancedMesh(cubeGeo, opt.mat || cubeMat, n);
    mesh.castShadow = opt.shadow !== false; mesh.receiveShadow = true; mesh.frustumCulled = false;
    cells.forEach((c, i) => { COL.set(c.c); mesh.setColorAt(i, COL); });
    const v = { mesh, cells, n, off: new Float32Array(n * 3), vel: new Float32Array(n * 3), sc: new Float32Array(n).fill(1), k: opt.k || 260, d: opt.d || 13, rest: new Float32Array(n * 3) };
    parent.add(mesh); writeVox(v); return v;
  }
  function writeVox(v) {
    for (let i = 0; i < v.n; i++) {
      const c = v.cells[i], s = c.s * v.sc[i];
      V.set(c.x + v.off[i * 3], c.y + v.off[i * 3 + 1], c.z + v.off[i * 3 + 2]);
      S.set(s * (c.sx || 1), s * (c.sy || 1), s * (c.sz || 1));
      v.mesh.setMatrixAt(i, M4.compose(V, Q.identity(), S));
    }
    v.mesh.instanceMatrix.needsUpdate = true;
  }
  function stepVox(v, dt) {
    const k = v.k, d = v.d;
    for (let i = 0; i < v.n * 3; i++) { const x = v.off[i] - v.rest[i]; v.vel[i] += (-k * x - d * v.vel[i]) * dt; v.off[i] += v.vel[i] * dt; }
    writeVox(v);
  }
  function kick(v, cx, cy, cz, power, radius, up = .6, out = 1) {
    for (let i = 0; i < v.n; i++) {
      const c = v.cells[i], dx = c.x - cx, dy = c.y - cy, dz = c.z - cz, dist = Math.hypot(dx, dy, dz);
      if (dist > radius) continue;
      const f = power * (1 - dist / radius) * (.7 + Math.random() * .6), h = Math.hypot(dx, dz) || 1;
      v.vel[i * 3] += dx / h * f * out; v.vel[i * 3 + 2] += dz / h * f * out; v.vel[i * 3 + 1] += f * up * (Math.random() < .5 ? 1 : .6);
    }
  }
  const hex = (h, j = 0) => { const c = new T.Color(h); if (j) c.offsetHSL(0, 0, rand(-j, j)); return c; };

  /* ---------- stage: a floating tiled platform ---------- */
  const world = new T.Group(); scene.add(world);
  const tiles = [];
  for (let ix = -4; ix <= 4; ix++) for (let iz = -3; iz <= 3; iz++) tiles.push({ x: ix, y: -.18, z: iz, s: .96, sy: .36 / .96, c: hex((ix + iz) & 1 ? 0x77B4FF : 0x8CC2FF, .015) });
  // a rim of lighter edge blocks along the front edges
  const tileV = vox(tiles, world, { k: 180, d: 9 });
  const tileWave = [];   // impact waves travelling across the floor
  const tileHit = new Float32Array(tiles.length);

  /* ---------- usu (octagonal wooden mortar) ---------- */
  const U = { x: 1.15, z: .25 }, CU = .22, R_OUT = 1.08, R_IN = .74, U_LAYERS = 6;
  const oct = (x, z) => Math.max(Math.abs(x), Math.abs(z), (Math.abs(x) + Math.abs(z)) / 1.32);
  const usuCells = [];
  for (let ly = 0; ly < U_LAYERS; ly++) for (let ix = -6; ix <= 6; ix++) for (let iz = -6; iz <= 6; iz++) {
    const x = ix * CU, z = iz * CU, f = oct(x, z);
    if (f > R_OUT) continue;
    if (ly > 0 && f < R_IN) continue;
    const sector = Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 4));
    const band = ly === 1 || ly === U_LAYERS - 2;
    usuCells.push({ x: U.x + x, y: CU / 2 + ly * CU, z: U.z + z, s: CU * .98, c: hex(band ? 0xA9653A : (sector % 2 ? 0xDB9A63 : 0xC8844F), .025) });
  }
  const usuV = vox(usuCells, world, { k: 300, d: 14 });
  const USU_TOP = U_LAYERS * CU;
  /* ---------- mochi (a dome of small cubes; bumpy at first, smooth when done) ---------- */
  const CM = .16, MR = .8, MOCHI_Y = USU_TOP - .12;
  const mochiCells = [];
  for (let ix = -5; ix <= 5; ix++) for (let iz = -5; iz <= 5; iz++) for (let iy = 0; iy <= 5; iy++) {
    const x = ix * CM, z = iz * CM, y = iy * CM, d = Math.hypot(x / MR, y / (MR * .62), z / MR);
    if (d > 1 || oct(x, z) > R_IN + .02) continue;
    if (d < .72 && iy < 4) continue;     // hollow inside (never visible)
    mochiCells.push({ x: U.x + x, y: MOCHI_Y + y, z: U.z + z, bx: U.x + x, by: MOCHI_Y + y, bz: U.z + z, s: CM * .99, c: hex(0xF3F1EA, .02), bump: Math.random() < .35 ? rand(.03, .09) : 0 });
  }
  const mochiG = new T.Group(); world.add(mochiG);
  const mochiV = vox(mochiCells, mochiG, { k: 210, d: 11 });
  const MOCHI_TOP = MOCHI_Y + MR * .62 + CM / 2;
  mochiG.position.set(U.x, 0, U.z); mochiV.mesh.position.set(-U.x, 0, -U.z);   // squash around the mortar's axis
  const setMochiLook = p => {
    for (let i = 0; i < mochiV.n; i++) {
      const c = mochiV.cells[i]; mochiV.rest[i * 3 + 1] = c.bump * (1 - p);
      COL.set(0xFFFFFF).lerp(new T.Color(0xE9E3D3), (1 - p) * (.35 + ((i * 7) % 5) * .1)); mochiV.mesh.setColorAt(i, COL);
    }
    mochiV.mesh.instanceColor.needsUpdate = true;
  };
  setMochiLook(0);

  /* ---------- character kit: clean voxel bodies + a smooth drawn face on one rounded head block ---------- */
  const DARK = 0x2E3047;
  const darkMat = new T.MeshStandardMaterial({ color: DARK, roughness: .55 });
  const faceTex = N3.canvasTex(256, 224, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.lineCap = 'round';
    g.strokeStyle = '#fff'; g.lineWidth = 15;
    [78, 178].forEach(x => { g.beginPath(); g.arc(x, 112, 25, Math.PI * 1.14, Math.PI * 1.86); g.stroke(); });   // happy ∩ eyes
    g.fillStyle = '#FF9DB5'; [[40, 128], [178, 128]].forEach(([x, y]) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, 40, 21, 10); else g.rect(x, y, 40, 21); g.fill(); });
    g.fillStyle = '#3A1220'; g.beginPath(); g.moveTo(102, 140); g.quadraticCurveTo(128, 136, 154, 140); g.quadraticCurveTo(152, 184, 128, 186); g.quadraticCurveTo(104, 184, 102, 140); g.fill();   // open smile
    g.fillStyle = '#FF7E9A'; g.beginPath(); g.ellipse(128, 173, 14, 9, 0, 0, Math.PI * 2); g.fill();
  });
  const faceMat = new T.MeshBasicMaterial({ map: faceTex, transparent: true });
  function makeHead(parent, x, y, z, d, hgt, w) {
    const head = new T.Mesh(cubeGeo, darkMat); head.scale.set(d, hgt, w); head.position.set(x, y, z); head.castShadow = true; parent.add(head);
    const face = new T.Mesh(new T.PlaneGeometry(w * .94, hgt * .86), faceMat); face.rotation.y = Math.PI / 2; face.position.set(x + d / 2 + .006, y - hgt * .03, z); parent.add(face);
    return head;
  }
  const roundBox = (cells, cx, cy, cz, rx, ry, rz, cs, white = true) => {
    const nx = Math.ceil(rx / cs), ny = Math.ceil(ry / cs), nz = Math.ceil(rz / cs);
    for (let ix = -nx; ix <= nx; ix++) for (let iy = -ny; iy <= ny; iy++) for (let iz = -nz; iz <= nz; iz++) {
      const x = ix * cs, y = iy * cs, z = iz * cs, f = Math.pow(Math.abs(x) / rx, 3) + Math.pow(Math.abs(y) / ry, 3) + Math.pow(Math.abs(z) / rz, 3);
      if (f > 1 || f < .4) continue;
      const puff = ((ix + iy + iz) & 1) ? cs * .14 : 0, n = Math.hypot(x / rx, y / ry, z / rz) || 1;
      cells.push({ x: cx + x + x / rx / n * puff, y: cy + y + y / ry / n * puff, z: cz + z + z / rz / n * puff, s: cs * 1.02, c: hex(((ix * 3 + iy * 5 + iz * 7) & 3) ? 0xFFFFFF : 0xEDF1F9) });
    }
  };

  /* ---------- the sheep (stands on two legs, hachimaki, holds the kine in front of its chest) ---------- */
  const SH = new T.Group(); SH.position.set(-1.8, 0, -.12); SH.rotation.y = -.62; world.add(SH); SH.updateMatrixWorld(true);
  const sheepCells = [], CS = .18;
  const put = (x, y, z, c, s = CS) => sheepCells.push({ x, y, z, s, c: hex(c) });
  // legs + chunky feet
  [-.22, .22].forEach(z => { for (let y = 0; y < 3; y++) { put(-.04, .09 + y * CS, z, DARK); put(.14, .09 + y * CS, z, DARK); } put(.3, .09, z, DARK); });
  // wool body: a rounded box on a clean grid (every other cube puffed out a touch)
  roundBox(sheepCells, 0, 1.24, 0, .74, .72, .8, CS);
  // head with a drawn face, ears, wool tuft
  const HEADP = new T.Vector3(.62, 2.1, 0);
  const sheepHead = makeHead(SH, HEADP.x, HEADP.y, 0, .72, .68, .84);
  [-1, 1].forEach(s => { put(.52, 2.2, s * .52, DARK, .2); put(.5, 2.1, s * .66, DARK, .16); });
  for (let ix = 0; ix < 3; ix++) for (let iz = -1; iz <= 1; iz++) put(.42 + ix * .17, 2.5, iz * .2, 0xFFFFFF, .2);
  [[.5, -.1], [.62, .1], [.7, -.05]].forEach(([x, z]) => put(x, 2.66, z, 0xFFFFFF, .18));
  // hachimaki: red/white band around the head + a knot with tails at the back
  const hb = (x, z, k) => put(x, 2.34, z, k & 1 ? 0xE5322D : 0xFFFFFF, .14);
  let kk = 0;
  for (let x = .28; x <= .98; x += .14) { hb(x, -.44, kk++); hb(x, .44, kk); }
  for (let z = -.42; z <= .43; z += .14) hb(.99, z, kk++);
  for (let z = -.42; z <= .43; z += .14) hb(.26, z, kk++);
  [[.12, 2.38, .08], [0, 2.3, .12], [-.1, 2.2, .16], [.1, 2.26, -.1], [0, 2.14, -.14]].forEach(([x, y, z]) => put(x, y, z, 0xE5322D, .15));
  // arms: from the shoulders down to the hands that grip the handle (static, so they never detach)
  const HAND = new T.Vector3(.98, 1.38, -.3);
  [-1, 1].forEach(s => {
    const a = new T.Vector3(.55, 1.62, s * .5), b = new T.Vector3(HAND.x - .04, HAND.y, HAND.z + s * .13);
    for (let k = 0; k <= 4; k++) { const p = a.clone().lerp(b, k / 4); put(p.x, p.y, p.z, DARK, .19); }
  });
  const sheepV = vox(sheepCells, SH, { k: 160, d: 10 });

  /* ---------- kine (mallet): pivot at the hands; length chosen so the head lands flat on the mochi ---------- */
  const PIV = SH.localToWorld(HAND.clone());
  const DH = Math.hypot(U.x - PIV.x, U.z - PIV.z);
  let A0 = 0; for (let a = 0; a < 1.2; a += .002) { if (PIV.y + DH * Math.tan(a) - .5 * Math.cos(a) >= MOCHI_TOP) { A0 = a; break; } }
  const KL = DH / Math.cos(A0), YAW = Math.atan2(-(U.z - PIV.z), U.x - PIV.x);
  const kine = new T.Group(); kine.rotation.order = 'YZX'; kine.position.copy(PIV); kine.rotation.y = YAW; world.add(kine);
  const kineCells = [];
  for (let x = -.22; x <= KL - .3; x += .14) kineCells.push({ x, y: 0, z: 0, s: .13, c: hex(Math.round(x / .14) & 1 ? 0xE3AE78 : 0xD69C64, .015) });
  for (let ix = -1; ix <= 1; ix++) for (let iy = -2; iy <= 2; iy++) for (let iz = -1; iz <= 1; iz++) kineCells.push({ x: KL + ix * .2, y: iy * .2, z: iz * .2, s: .2, c: hex(iy === -2 || iy === 2 ? 0xC98A55 : 0xE2AA73, .03) });
  [[-.02, .13], [.24, -.13]].forEach(([x, z]) => kineCells.push({ x, y: 0, z, s: .22, c: hex(DARK) }));   // hooves on the grip
  const kineV = vox(kineCells, kine, { k: 240, d: 12 });

  /* ---------- the helper lamb who turns the mochi between beats ----------
     Built from parts so it can move like an animal: hind legs stay planted, the torso (body, wool, head, front legs)
     pivots at the hip. While the game runs it walks up to the mortar and stands on its hind legs; on each beat's
     "hand in" window it leans over the rim and puts both front hooves (wrapped in white tenugui) on the mochi. */
  const LS = 1.3, CL = .15;                                  // lamb scale, cube size
  const LB = new T.Group(); LB.scale.setScalar(LS); world.add(LB);
  const LB_HOME = new T.Vector3(2.7, 0, -1.25), LB_YAW0 = -1.85;
  // it works from the mortar's right-hand side, so the camera sees it side-on (front legs and hooves against the mochi)
  const toLamb = new T.Vector3(1, 0, -.3).normalize();
  const LB_YAW1 = Math.atan2(toLamb.z, -toLamb.x);        // facing the mortar (local +x → toward its centre)
  const HIP = new T.Vector3(-.24, .45, 0), SHO = new T.Vector3(.22, .45, 0), NECK = new T.Vector3(.36, .8, 0), LEG = .45;
  const HIP_D = 1.5;                                          // hip's distance from the mortar's axis while standing beside it
  const LB_NEAR = new T.Vector3(U.x, 0, U.z).addScaledVector(toLamb, HIP_D + HIP.x * LS);   // origin there (hip is behind the origin)
  // hind legs (planted)
  const hindCells = [];
  [-.16, .16].forEach(z => [0, 1, 2].forEach(y => hindCells.push({ x: HIP.x, y: .075 + y * CL, z, s: CL, c: hex(DARK) })));
  const hindV = vox(hindCells, LB, { k: 160, d: 10 });
  // torso: pivots at the hip; cells are relative to the hip
  const torso = new T.Group(); torso.position.copy(HIP); LB.add(torso);
  const torsoCells = [];
  roundBox(torsoCells, -HIP.x, .62 - HIP.y, 0, .5, .36, .38, CL);
  [[.0, -.08], [.12, .08], [-.1, .06]].forEach(([x, z]) => torsoCells.push({ x: x - HIP.x, y: 1.0 - HIP.y, z, s: .16, c: hex(0xFFFFFF) }));
  const torsoV = vox(torsoCells, torso, { k: 160, d: 10 });
  // head: pivots at the neck so it can keep looking at the mochi while the body rears up
  const headG = new T.Group(); headG.position.copy(NECK).sub(HIP); torso.add(headG);
  makeHead(headG, .5 - NECK.x, .92 - NECK.y, 0, .46, .44, .5);
  const headV = vox([-1, 1].map(s => ({ x: .4 - NECK.x, y: .98 - NECK.y, z: s * .32, s: .14, c: hex(DARK) })), headG, { k: 160, d: 10 });
  // front legs: pivot at the shoulder, hang along local -y; a white tenugui band above the dark hoof
  const legs = [-.16, .16].map(z => {
    const g = new T.Group(); g.position.set(SHO.x - HIP.x, SHO.y - HIP.y, z); torso.add(g);
    const v = vox([0, 1, 2].map(k => ({ x: 0, y: -.075 - k * CL, z: 0, s: CL, c: hex(k === 1 ? 0xFFFFFF : DARK) })), g, { k: 200, d: 12 });
    return { g, v, z };
  });
  // where the hooves go: on the mochi just inside the rim, on the lamb's side (world), one per leg
  const hoofAt = (r, side) => { const perp = new T.Vector3(-toLamb.z, 0, toLamb.x);
    return new T.Vector3(U.x, MOCHI_Y + MR * .62 * Math.sqrt(Math.max(0, 1 - (r / MR) ** 2)) - .02, U.z).addScaledVector(toLamb, r).addScaledVector(perp, side * .3); };
  const HOOF = legs.map(l => hoofAt(.66, -Math.sign(l.z)));   // local +z points to -perp in world
  // stance helpers: torso pitch while standing up (waiting) and while reaching (solved so the legs just reach the hooves' spot)
  const PITCH_UP = 1.3;
  let PITCH_REACH = 1.0;
  { // with the lamb at LB_NEAR, pick the pitch whose shoulder→hoof distance is closest to the leg length
    const tgtD = (HIP_D - .66) / LS, tgtY = (HOOF[0].y) / LS - HIP.y;   // hoof relative to the hip, in lamb units (x toward the mortar)
    let best = 1e9;
    for (let ph = 1.05; ph <= 1.5; ph += .01) {   // never lean further than this: the front legs reach, the face stays back from the mortar
      const sx = (SHO.x - HIP.x) * Math.cos(ph), sy = (SHO.x - HIP.x) * Math.sin(ph), d = Math.abs(Math.hypot(tgtD - sx, tgtY - sy) - LEG);
      if (d < best) { best = d; PITCH_REACH = ph; }
    }
  }
  let ready = 0, testHand = null;   // testHand: test hook override for the lamb's reach (0–1)
  const _v = new T.Vector3();

  /* ---------- rings, steam, debris ---------- */
  // ring colours are picked to stand out from the blue floor and the white mochi: solid (not additive) strokes with a
  // navy outline underneath; yellow while closing in, green = tap now, red = あぶない, pink in FEVER
  const RC = { idle: 0xFFE14A, hit: 0x22E07A, danger: 0xFF3344, fever: 0xFF5FD2, base: 0xFFFFFF, line: 0x0B1C3F };
  const ringMat = (c, add = true) => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: .9, blending: add ? T.AdditiveBlending : T.NormalBlending, depthWrite: false, side: T.DoubleSide });
  const flat = (m, y = 0) => { m.rotation.x = -Math.PI / 2; m.position.set(U.x, MOCHI_TOP + .03 + y, U.z); world.add(m); return m; };
  const targetLine = flat(new T.Mesh(new T.RingGeometry(.9, 1.03, 64), ringMat(RC.line, false)), -.003); targetLine.material.opacity = .6;
  const approachLine = flat(new T.Mesh(new T.RingGeometry(.92, 1.07, 64), ringMat(RC.line, false)), -.002); approachLine.material.opacity = .6;
  const target = new T.Mesh(new T.RingGeometry(.93, 1.0, 64), ringMat(RC.base, false)); target.rotation.x = -Math.PI / 2; target.position.set(U.x, MOCHI_TOP + .03, U.z); world.add(target);
  const targetGlow = new T.Mesh(new T.RingGeometry(.86, 1.08, 64), ringMat(0x3FA0FF)); targetGlow.rotation.x = -Math.PI / 2; targetGlow.position.copy(target.position); targetGlow.material.opacity = .25; world.add(targetGlow);
  const approach = new T.Mesh(new T.RingGeometry(.95, 1.04, 64), ringMat(RC.idle, false)); approach.rotation.x = -Math.PI / 2; approach.position.copy(target.position); world.add(approach);
  const approachGlow = new T.Mesh(new T.RingGeometry(.88, 1.12, 64), ringMat(0x3FA0FF)); approachGlow.rotation.x = -Math.PI / 2; approachGlow.position.copy(target.position); approachGlow.material.opacity = .2; world.add(approachGlow);
  const zone = new T.Mesh(new T.RingGeometry(.86, 1.24, 64), ringMat(0x7FE0FF)); zone.rotation.x = -Math.PI / 2; zone.position.copy(target.position); zone.position.y -= .005; zone.material.opacity = .12; world.add(zone);
  const starTex2 = N3.canvasTex(256, 256, (g, w) => { const c = w / 2; const gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(200,240,255,.6)'); gr.addColorStop(1, 'rgba(120,200,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.fillStyle = 'rgba(255,255,255,.95)'; for (let k = 0; k < 8; k++) { g.save(); g.translate(c, c); g.rotate(k * Math.PI / 4); g.beginPath(); g.moveTo(0, -c * (k & 1 ? .55 : .95)); g.lineTo(9, 0); g.lineTo(0, c * .1); g.lineTo(-9, 0); g.fill(); g.restore(); } });
  const star = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: starTex2, transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false })); star.renderOrder = 9; star.position.set(U.x, MOCHI_TOP + .15, U.z); star.visible = false; world.add(star);
  let starT = 9;
  const shock = new T.Mesh(new T.RingGeometry(.9, 1.0, 64), ringMat(0xFFFFFF)); shock.rotation.x = -Math.PI / 2; shock.position.set(U.x, .02, U.z); shock.material.opacity = 0; world.add(shock);
  const steam = [];
  const steamMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, depthWrite: false });
  for (let k = 0; k < 18; k++) { const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), steamMat.clone()); m.visible = false; world.add(m); steam.push({ m, life: 0 }); }
  const DEB = 160, debris = new T.InstancedMesh(cubeGeo, cubeMat, DEB); debris.castShadow = true; world.add(debris); debris.frustumCulled = false;
  const deb = Array.from({ length: DEB }, () => ({ life: 0, p: new T.Vector3(), v: new T.Vector3(), s: .1, r: 0 }));
  for (let i = 0; i < DEB; i++) { debris.setColorAt(i, COL.set(0xffffff)); debris.setMatrixAt(i, M4.makeScale(0, 0, 0)); }
  let debI = 0;
  const burst = (p, n, cols, sp = 3, size = .1, up = 3) => {
    for (let k = 0; k < n; k++) {
      const d = deb[debI = (debI + 1) % DEB]; d.life = rand(.6, 1.1); d.p.copy(p); d.s = size * rand(.6, 1.3); d.r = rand(0, 6);
      d.v.set(rand(-1, 1) * sp, rand(.4, 1) * up, rand(-1, 1) * sp); debris.setColorAt(debI, COL.set(cols[k % cols.length]));
    }
    debris.instanceColor.needsUpdate = true;
  };
  // kagami-mochi targets (the mochi cubes regroup into this on completion) + the bravesoft mark on top
  const kagami = [];
  [[.62, 0, .3], [.46, .34, .26]].forEach(([rr, y0, h]) => {
    for (let ix = -6; ix <= 6; ix++) for (let iz = -6; iz <= 6; iz++) for (let iy = 0; iy * CM < h; iy++) {
      const x = ix * CM, z = iz * CM, d = Math.hypot(x, z) / rr, top = Math.sqrt(Math.max(0, 1 - d * d));
      if (d > 1 || iy * CM > h * (.55 + .45 * top)) continue; kagami.push(new T.Vector3(U.x + x, USU_TOP + .02 + y0 + iy * CM + CM / 2, U.z + z));
    }
  });
  // the bravesoft mark, voxelised from its SVG paths, stands on top in place of the mikan (faces the camera)
  const MK_W = 1.34, MK_COLS = 40, MK_C = MK_W / MK_COLS, MK_ROWS = Math.round(MK_COLS * 343 / 646), MK_Y = .05;   // local y of the mark's bottom row (group sits on the top tier)
  const markCells = [];
  if (N3 && N3.LOGO) {
    const SS = 8, cw = MK_COLS * SS, ch = MK_ROWS * SS, cvs = document.createElement('canvas'); cvs.width = cw; cvs.height = ch;
    const g = cvs.getContext('2d'); g.scale(cw / 646, ch / 343); N3.LOGO.forEach(d => g.fill(new Path2D(d)));
    const px = g.getImageData(0, 0, cw, ch).data;
    for (let r = 0; r < MK_ROWS; r++) for (let q = 0; q < MK_COLS; q++) {
      let a = 0; for (let y = 0; y < SS; y++) for (let x = 0; x < SS; x++) a += px[((r * SS + y) * cw + q * SS + x) * 4 + 3];
      if (a / (SS * SS * 255) < .42) continue;
      const x = (q + .5 - MK_COLS / 2) * MK_C, y = MK_Y + (MK_ROWS - r - .5) * MK_C;
      [-.5, .5].forEach(k => markCells.push({ x, y, z: k * MK_C, s: MK_C * 1.02, c: hex(k > 0 ? 0x0066FF : 0x003FA8, .02) }));
    }
  }
  // pivot on the top of the upper tier, turned toward the camera (offset direction in resize) and leaning back a little
  const markG = new T.Group(); markG.position.set(U.x, USU_TOP + .58, U.z - .06); markG.rotation.order = 'YXZ'; markG.rotation.set(-.32, Math.atan2(7.2, 10.5), 0); world.add(markG);
  const markV = vox(markCells.length ? markCells : [{ x: 0, y: MK_Y, z: 0, s: 0, c: hex(0x0066FF) }], markG, { k: 200, d: 10 }); markV.mesh.visible = false;

  /* ---------- camera / layout ---------- */
  let W = 1, H = 1;
  function resize(w, h) {
    W = w; H = h;
    const pc = isPC(), vh = pc ? 7.6 : 11.2, aspect = w / h;
    camera.left = -vh * aspect / 2; camera.right = vh * aspect / 2; camera.top = vh / 2; camera.bottom = -vh / 2;
    const tgt = new T.Vector3(pc ? .05 : .3, pc ? .95 : .55, .1);
    camera.position.copy(tgt).add(new T.Vector3(7.2, 7.6, 10.5)); camera.lookAt(tgt);
    if (pc) camera.setViewOffset(w, h, -150, 6, w, h); else camera.setViewOffset(w, h, 0, -h * .1, w, h);
    camera.updateProjectionMatrix();
  }

  /* ---------- game state ---------- */
  let lastTap = -9, missedUpTo = -1, state = 'idle', t0 = 0, now = 0, period = 1.2, prog = 0, combo = 0, maxCombo = 0, shown = 0, lastBeat = -1, judgedBeat = -1;
  let swingT = 9, hitStop = 0, slowT = 0, slowDur = 1, slowMin = 1, slowAmt = 0, shakeA = 0, squashV = 0, squashY = 0, flashT = 0, doneT = 0, fever = false;
  const stats = { perfect: 0, good: 0, weak: 0, miss: 0, danger: 0 };
  const beatAt = n => t0 + n * period;
  const phase = () => (now - t0) / period;                         // beat n happens at integer phases
  // one cycle per beat (p: 0 → 1):
  //   p 0–TRAIL     the ring that just hit shrinks inside the target and fades (late window)
  //   p TRAIL–APP0  quiet: after a good hit the target stays green through the slow-mo
  //   p APP0        the next ring appears big; the lamb's hooves are in the mortar until HAND1 → red ring, tapping is あぶない
  //   p APP0–1      it shrinks and slows down as it nears the target (ease-out), so it sits in the green zone longer;
  //                 it meets the target at p = 1 (the beat)
  const TRAIL = .12, APP0 = .45, HAND1 = .66, ZONE_R = 1.15;
  const cyc = () => ((phase() % 1) + 1) % 1;
  const ringR = p => p < TRAIL ? 1 - p / TRAIL * .32 : p < APP0 ? 2.6 : 1 + 1.6 * Math.pow(1 - (p - APP0) / (1 - APP0), 2.2);
  const handIn = () => { if (state !== 'play' || now < t0 - period) return 0; const p = cyc(); return clamp((p - APP0) / .04, 0, 1) * clamp((HAND1 - p) / .04, 0, 1); };
  // the beat slows down at the start and quickens a little as the mochi gets smoother; re-anchor t0 so the phase never jumps
  const PERIOD0 = 1.2, PERIOD1 = 1.0;
  const setPeriod = v => { const ph = phase(); period = v; t0 = now - ph * period; };

  function start() {
    duck(.3);                                             // music steps back so the beat leads
    state = 'play'; missedUpTo = -1; prog = 0; combo = 0; maxCombo = 0; shown = 0; fever = false; root.classList.remove('fever', 'done');
    Object.keys(stats).forEach(k => stats[k] = 0);
    period = PERIOD0; t0 = now + period * 1.6; lastBeat = -1; judgedBeat = -1;
    finalEl.hidden = true; msgEl.classList.remove('on'); updHud();
    markV.mesh.visible = false; mochiV.cells.forEach((c, i) => { mochiV.sc[i] = 1; c.x = c.bx; c.y = c.by; c.z = c.bz; });
    setMochiLook(0);
    btn.textContent = 'ぺったん!'; howEl.innerHTML = '<b>黄色い輪</b>が重なった<br>瞬間にタップ';
    judge('よーい…', '', 'weak', 900);
  }
  function updHud() {
    const p = Math.floor(prog);
    if (isPC()) { gaugeI.style.height = `calc(${p}% - ${p ? 8 * p / 100 : 0}px)`; gaugeI.style.width = ''; }
    else { gaugeI.style.width = p + '%'; gaugeI.style.height = ''; }
    pctEl.textContent = p + '%';
    comboN.textContent = combo; comboEl.classList.toggle('on', combo >= 2);
  }
  // judgement label floating above the mortar
  let judgeAnim = null;
  function judge(text, sub, cls, dur = 700) {
    const p = new T.Vector3(U.x, MOCHI_TOP + 1.25, U.z).project(camera);
    judgeEl.style.left = ((p.x + 1) / 2 * W) + 'px'; judgeEl.style.top = ((1 - p.y) / 2 * H) + 'px';
    judgeEl.className = 'mc-judge ' + cls + (fever ? ' fever' : '');
    const letters = (cls === 'perfect' || cls === 'danger') ? [...text].map((c, i) => `<i style="animation-delay:${i * 35}ms">${c}</i>`).join('') : text;
    judgeEl.innerHTML = `<span class="j">${letters}</span>${sub ? `<span class="s">${sub}</span>` : ''}`;
    if (judgeAnim) judgeAnim.cancel();
    const big = cls === 'perfect' || cls === 'danger';
    judgeAnim = judgeEl.animate([
      { opacity: 0, transform: `translate(-50%,-30%) scale(${big ? .4 : .7}) rotate(${cls === 'danger' ? -8 : 0}deg)` },
      { opacity: 1, transform: `translate(-50%,-55%) scale(${big ? 1.18 : 1.05}) rotate(${cls === 'danger' ? 4 : 0}deg)`, offset: .18 },
      { opacity: 1, transform: 'translate(-50%,-60%) scale(1)', offset: .7 },
      { opacity: 0, transform: `translate(-50%,-${cls === 'miss' ? 40 : 90}%) scale(${cls === 'miss' ? .9 : 1})` }
    ], { duration: dur, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
  }
  const burstEl = root.querySelector('.mc-burst'), bannerEl = root.querySelector('.mc-banner'), plusEl = root.querySelector('.mc-plus'), vigEl = root.querySelector('.mc-vig');
  function screenAt(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }; }
  // speed-line burst around the impact point
  function fx2d(kind) {
    const s = screenAt(new T.Vector3(U.x, MOCHI_TOP, U.z));
    burstEl.className = 'mc-burst ' + kind + (fever ? ' fever' : ''); burstEl.style.left = s.x + 'px'; burstEl.style.top = s.y + 'px';
    burstEl.getAnimations().forEach(a => a.cancel());
    burstEl.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(.45) rotate(0deg)' }, { opacity: 0, transform: `translate(-50%,-50%) scale(${kind === 'perfect' ? 1.5 : 1.15}) rotate(8deg)` }], { duration: kind === 'perfect' ? 420 : 320, easing: 'cubic-bezier(.1,.9,.3,1)' });
  }
  function banner(t, sub, kind) {
    bannerEl.className = 'mc-banner ' + kind; bannerEl.innerHTML = `<b>${t}</b><span>${sub}</span>`;
    bannerEl.getAnimations().forEach(a => a.cancel());
    bannerEl.animate([{ opacity: 0, transform: 'translate(-50%,-50%) skewX(-12deg) translateX(-60%)' }, { opacity: 1, transform: 'translate(-50%,-50%) skewX(-12deg) translateX(0)', offset: .18 }, { opacity: 1, transform: 'translate(-50%,-50%) skewX(-12deg) translateX(4%)', offset: .78 }, { opacity: 0, transform: 'translate(-50%,-50%) skewX(-12deg) translateX(60%)' }], { duration: 1200, easing: 'cubic-bezier(.2,.8,.3,1)' });
  }
  function plus(t) {
    const g = root.querySelector('.mc-gauge').getBoundingClientRect(), rr = root.getBoundingClientRect(), k = root.clientWidth / (rr.width || 1);
    plusEl.textContent = t; plusEl.style.left = ((g.left - rr.left + g.width / 2) * k) + 'px'; plusEl.style.top = ((g.top - rr.top) * k) + 'px';
    plusEl.getAnimations().forEach(a => a.cancel());
    plusEl.animate([{ opacity: 0, transform: 'translate(-50%,0) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-14px) scale(1.15)', offset: .3 }, { opacity: 0, transform: 'translate(-50%,-40px) scale(1)' }], { duration: 700, easing: 'ease-out' });
    const gg = root.querySelector('.mc-gauge'); gg.animate([{ boxShadow: 'inset 0 0 0 3px #fff, 0 0 0 0 rgba(127,224,255,.9)' }, { boxShadow: 'inset 0 0 0 3px #fff, 0 0 0 10px rgba(127,224,255,0)' }], { duration: 450 });
  }
  function vignette(kind) { vigEl.className = 'mc-vig ' + kind; vigEl.getAnimations().forEach(a => a.cancel()); vigEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: kind === 'danger' ? 700 : 450, easing: 'ease-out' }); }
  function flash(color, a = .35) { flashEl.style.background = color; flashEl.animate([{ opacity: a }, { opacity: 0 }], { duration: 260, easing: 'ease-out' }); }
  function press() { btn.classList.add('press'); setTimeout(() => btn.classList.remove('press'), 90); }

  function tap() {
    press();
    if (state === 'idle' || state === 'done') { if (state === 'done' && doneT < 1.2) return; start(); return; }
    if (state !== 'play' || now - lastTap < .14) return;   // real-time lockout (the swing itself may be in slow-mo)
    if (now < t0 - period * .5) return;
    lastTap = now; swingT = 0;                            // the sheep swings
    const ph = phase(), n = cyc() >= .5 ? Math.floor(ph) + 1 : Math.floor(ph), off = (ph - n) * period;
    const held = hitStop > 0 || slowT > 0;                // the green hold after a good hit: the hooves don't count
    if (handIn() > .3 && !held) { setTimeout(() => impact('danger', 0), 60); return; }
    if (n === judgedBeat) { setTimeout(() => impact('extra', 0), 70); return; }   // double tap on one beat
    // windows in seconds: a little wider on the early side, where the ring is visibly sitting in the green zone
    let q;
    if (Math.abs(off) < .08) q = 'perfect'; else if (off > -.2 && off < .15) q = 'good'; else if (off < 0 && cyc() > HAND1) q = 'early'; else if (off > 0) q = 'late'; else q = 'extra';
    if (q !== 'extra') judgedBeat = n;
    setTimeout(() => impact(q, off), 60);
  }
  function impact(q, off) {
    const top = new T.Vector3(U.x, MOCHI_TOP, U.z);
    const P = { perfect: 1, good: .75, early: .4, late: .4, extra: .3, danger: .5 }[q];
    // the hit itself: squash the mochi, jolt every cube, ripple the floor
    squashV -= 6 * P;
    kick(mochiV, U.x, MOCHI_TOP - .1, U.z, 4.2 * P, 1.2, -.3, 1);
    kick(usuV, U.x, USU_TOP, U.z, 2.4 * P, 2.0, .9, .45);
    kick(kineV, KL, 0, 0, 2.4 * P, .7, .6, .6);
    tileWave.push({ t: 0, x: U.x, z: U.z, a: 2.2 * P });
    tileHit.fill(0);
    shakeA = Math.max(shakeA, .12 * P);
    if (q === 'danger') {
      stats.danger++; combo = 0; fever = false; root.classList.remove('fever');
      kick(torsoV, .3, .3, 0, 4, 2, 1.4, .5); armRecoil = 1; rebound = 1; shakeA = .3;
      judge('あぶない!', 'こひつじの手が！', 'danger', 1000); vignette('danger'); buzz([50, 40, 50]);
      fx2d('danger');
      play('mc_danger', { vol: .7 });
      updHud(); return;
    }
    let gain = 0;
    if (q === 'perfect') { stats.perfect++; combo++; gain = 7; hitStop = .11; slowmo(.5, .2); judge('ぺったん!', combo > 1 ? `PERFECT ・ ${combo} COMBO` : 'PERFECT', 'perfect', 900); flash('#FFFFFF', .5); buzz(35);
      burst(top, 34, fever ? [0xFFFFFF, 0xFFE94A, 0xFFB800] : [0xFFFFFF, 0xF3F1EA, 0x9FEAFF, 0x3FA0FF], 3.4, .13, 5.5); shock.material.opacity = 1; shock.scale.setScalar(.6); shockT = 0;
      zoomP = .09; starT = 0; starK = 1.2; sheepHop = 1; shakeA = .22; fx2d('perfect');
      play('mc_pound', { vol: 1 }); play('mc_kiran', { vol: .5, rate: lift() }); play('mc_good', { vol: .45, rate: 1.19 * lift(), delay: .03 }); }
    else if (q === 'good') { stats.good++; combo++; gain = 4.5; hitStop = .05; slowmo(.34, .4); judge('いいね!', combo > 1 ? `GOOD ・ ${combo} COMBO` : 'GOOD', 'good', 750); buzz(20);
      burst(top, 16, [0xFFFFFF, 0xF3F1EA, 0x9FEAFF], 2.4, .11, 3.8); zoomP = .045; starT = 0; starK = .7; fx2d('good'); play('mc_pound', { vol: .85, rate: .98 }); play('mc_good', { vol: .55, rate: lift(), delay: .01 }); }
    else if (q === 'early' || q === 'late') { stats.weak++; combo = 0; gain = 1.5; judge(q === 'early' ? 'はやい' : 'おそい', q === 'early' ? '◀ EARLY' : 'LATE ▶', 'weak', 620); buzz(8);
      burst(top, 5, [0xF3F1EA], 1.4, .08, 2); zoomP = .015; play('mc_pound', { vol: .45, rate: 1.1 }); }
    else { gain = .5; play('mc_pound', { vol: .3, rate: 1.2 }); }
    if (q !== 'perfect' && q !== 'good') { fever = false; root.classList.remove('fever'); }
    if (combo >= 8 && !fever) { fever = true; root.classList.add('fever'); banner('FEVER!!', 'つき具合 ×1.5', 'fever'); play('mc_fever', { vol: .6 }); }
    else if (combo > 0 && combo % 5 === 0 && (q === 'perfect' || q === 'good')) { banner(`${combo} COMBO!`, combo >= 10 ? 'すごい！' : 'いい調子', 'combo'); play('mc_combo', { vol: .5, delay: .1 }); }
    if (gain >= 4) plus(`+${Math.round(gain * (fever ? 1.5 : 1))}`);
    maxCombo = Math.max(maxCombo, combo);
    prog = Math.min(100, prog + gain * (fever ? 1.5 : 1) * (1 + Math.min(combo, 10) * .03));
    setMochiLook(prog / 100);
    setPeriod(PERIOD0 - (PERIOD0 - PERIOD1) * (prog / 100));   // the rhythm quickens a little as the mochi gets smoother
    while (shown < Math.min(LINES.length, Math.floor(prog / 20 + 1e-6))) showLine(shown++);
    updHud();
    if (prog >= 100) finish();
  }
  // slow motion after a solid hit: animation time drops to `min` and eases back to full speed over `dur` seconds.
  // Only the picture slows down (cube springs, particles, squash, the swing, the camera punch) — the beat clock,
  // the rings and the judgement windows keep real time, so the rhythm never drifts.
  function slowmo(dur, min) {
    slowDur = slowT = dur; slowMin = min;
    // the slow-mo swell (3 takes, picked at random); cut off with the slow-mo so it never piles up over the next beat
    play('mc_slowmo', { vol: min < .3 ? .5 : .35, rate: .96 + Math.random() * .06, dur: dur + .45 });
  }
  // reward sparkles climb a little in pitch as the combo builds (up to ~a minor third at 10)
  function lift() { return 1 + Math.min(combo, 10) * .019; }
  function showLine(i) {
    msgN.textContent = `${i + 1} / ${LINES.length}`; msgP.textContent = LINES[i]; msgEl.classList.add('on');
    msgEl.animate([{ opacity: 0, transform: 'translate(-50%,-12px) scale(.9)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1.04)', offset: .6 }, { opacity: 1, transform: 'translate(-50%,0) scale(1)' }], { duration: 420, easing: 'ease-out' });
    sfx.chime({ vol: .4 });
  }
  function miss() {
    stats.miss++; combo = 0; fever = false; root.classList.remove('fever');
    judge('すかっ…', 'MISS', 'miss', 700); updHud(); vignette('miss');
    play('mc_miss', { vol: .6 });
  }
  let shockT = 9, armRecoil = 0, rebound = 0, sheepHop = 0, zoomP = 0, starK = 1;
  function finish() {
    duck(1);
    state = 'done'; doneT = 0; fever = false; root.classList.remove('fever'); root.classList.add('done');
    btn.textContent = 'もう一回つく';
    howEl.innerHTML = 'つきあがり！<br>鏡餅のできあがり';
    // mochi cubes regroup into kagami-mochi
    mochiV.cells.forEach((c, i) => { c.from = new T.Vector3(c.x, c.y, c.z); c.to = kagami[i] ? kagami[i].clone() : null; c.delay = rand(0, .35); });
    play('fanfare_l', { vol: .6, delay: .4 });
    buzz([30, 40, 60]);
    setTimeout(() => {
      finalEl.innerHTML = `<span class="k">MOCHITSUKI COMPLETE</span><h5>つきたての一年を。</h5><ol>${LINES.map(l => `<li>${l}</li>`).join('')}</ol><span class="sig">${SIG}</span>
        <div class="stats"><span>ぺったん ${stats.perfect}</span><span>いいね ${stats.good}</span><span>最大 ${maxCombo} コンボ</span>${stats.danger ? `<span>あぶない ${stats.danger}</span>` : ''}</div>`;
      finalEl.hidden = false;
      if (!RM) finalEl.animate([{ opacity: 0, transform: 'translateY(24px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,1.2,.4,1)' });
    }, RM ? 100 : 2200);
  }

  cv.addEventListener('pointerdown', e => { e.preventDefault(); tap(); });
  btn.addEventListener('pointerdown', e => { e.preventDefault(); tap(); });
  btn.addEventListener('click', e => { if (e.detail === 0) tap(); });   // keyboard activation
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    const rr = root.getBoundingClientRect(); if (rr.bottom < 0 || rr.top > innerHeight) return;
    if (e.code === 'Space' && !root.matches(':hover') && document.activeElement !== btn) return;
    e.preventDefault(); if (!e.repeat) tap();
  });

  /* ---------- per-frame ---------- */
  const UP = new T.Vector3(0, 1, 0);
  let lastT = 0;
  function frame(dt, t) {
    dt = dt || 0; now = t; if (!lastT) lastT = t;
    if (hitStop > 0) { hitStop -= dt; dt *= .05; slowAmt = 1; }     // brief freeze-frame on a solid hit…
    else if (slowT > 0) {                                             // …then slow motion easing back to normal speed
      slowT = Math.max(0, slowT - dt); const u = 1 - slowT / slowDur;
      dt *= slowMin + (1 - slowMin) * u * u; slowAmt = 1 - u;
    } else slowAmt = 0;
    // beats: tick + miss detection
    if (state === 'play' && now >= t0 - .001) {
      const n = Math.floor(phase() + .5);
      if (n !== lastBeat) {
        lastBeat = n;
        play('mc_beat', n % 4 === 0 ? { vol: .45, rate: 1.25, exact: true } : { vol: .28, exact: true });
      }
      const passed = Math.floor(phase() - .17);            // beats whose window has closed
      if (passed >= 0 && passed > missedUpTo) { missedUpTo = passed; if (passed > judgedBeat) miss(); }
    }
    // rings + the swing (both follow the same cycle so the picture is consistent)
    const playing = state === 'play' && now >= t0 - period, p = cyc(), rr = ringR(p), trailing = p < TRAIL, quiet = p >= TRAIL && p < APP0;
    // hold: right after a PERFECT/GOOD (freeze + slow-mo) the target stays green — never flips to red under the slow-mo
    const hold = playing && (hitStop > 0 || slowT > 0) && judgedBeat >= Math.floor(phase());
    const danger = playing && !hold && handIn() > .15, closing = playing && !trailing && !quiet ? clamp(1 - (rr - 1) / 1.6, 0, 1) : 0;
    const inZone = playing && !danger && (hold || trailing || (!quiet && rr < ZONE_R));
    // the sheep winds up as the ring closes in, then slams on the tap (and rebounds hard on あぶない)
    const RA = A0 + 1.0 + .22 * closing * closing;
    let ang;
    if (swingT < .06) ang = RA + (A0 - RA) * Math.pow(swingT / .06, 2);
    else if (swingT < .15) ang = A0 - .04 * Math.sin((swingT - .06) / .09 * Math.PI);
    else if (swingT < .55) ang = A0 + (RA - A0) * (1 - Math.pow(1 - (swingT - .15) / .4, 3));
    else ang = RA;
    if (rebound > 0) { ang = A0 + (RA - A0) * Math.min(1, (1 - rebound) * 3) + Math.sin(rebound * 30) * .08 * rebound; rebound = Math.max(0, rebound - dt * 2); }
    if (state === 'done') ang = A0 + .8 + Math.sin(t * 2) * .05;
    if (state === 'idle') ang = A0 + .95 + Math.sin(t * 1.6) * .06;
    swingT += dt;
    kine.rotation.z = ang;
    // the sheep leans into the swing and hops on a perfect hit
    sheepHop = Math.max(0, sheepHop - dt * 3);
    SH.rotation.z = -clamp((RA - ang) / 1.5, 0, 1) * .12;
    SH.position.y = Math.sin(sheepHop * Math.PI) * .25 + (playing ? Math.abs(Math.sin(t * Math.PI / period)) * .03 : Math.sin(t * 2) * .02);
    sheepHead.rotation.z = Math.sin(t * 3) * .03 + (danger ? .08 : 0);
    // the lamb: walks up to the mortar and stands on its hind legs while the game runs; on each "hand in" window it
    // leans over the rim and puts both front hooves on the mochi. あぶない → it jerks its hooves back and hops.
    const hand = (testHand == null ? handIn() : testHand) * (1 - armRecoil);
    armRecoil = Math.max(0, armRecoil - dt * 2.5);
    ready += ((state === 'play' ? 1 : 0) - ready) * Math.min(1, dt * 2.2);
    const rear = clamp(ready * 1.7, 0, 1), walk = clamp((ready - .25) / .75, 0, 1), ew = walk * walk * (3 - 2 * walk);
    LB.position.lerpVectors(LB_HOME, LB_NEAR, ew);
    LB.rotation.y = LB_YAW0 + (LB_YAW1 - LB_YAW0) * clamp(ready * 1.4, 0, 1);
    const stepBob = ready > .02 && ready < .98 ? Math.abs(Math.sin(t * 14)) * .05 : 0;
    LB.position.y = stepBob + Math.abs(Math.sin(t * Math.PI / period + 1.2)) * .02 + Math.sin(Math.min(1, armRecoil * 1.2) * Math.PI) * .4;
    const eh = hand * hand * (3 - 2 * hand);
    const pitch = rear * (PITCH_UP + (PITCH_REACH - PITCH_UP) * eh) + Math.sin(t * 2.4) * .03 * rear;
    torso.rotation.z = pitch;
    headG.rotation.z = -pitch * .75 + Math.sin(t * 3) * .04;                // keep looking at the mochi
    LB.updateMatrixWorld(true);
    legs.forEach((l, k) => {
      // rest: hanging along the torso (standing on four legs it is straight down; reared up it is a "begging" paw)
      // reach: aim the leg at its hoof spot; length follows the distance (only a few % either way)
      _v.copy(HOOF[k]); l.g.parent.worldToLocal(_v); _v.sub(l.g.position);
      const aim = Math.atan2(_v.x, -_v.y), len = clamp(Math.hypot(_v.x, _v.y) / LEG, .8, 1.2);
      const beg = rear * (.35 + Math.sin(t * 5 + k) * .06);
      l.g.rotation.z = beg + (aim - beg) * eh;
      l.g.scale.y = 1 + (len - 1) * eh;
    });
    // ring visuals
    const ringC = danger ? RC.danger : inZone ? RC.hit : fever ? RC.fever : RC.idle;
    approach.visible = approachGlow.visible = approachLine.visible = playing && !quiet && !(hold && !trailing);
    approach.scale.setScalar(rr); approachGlow.scale.setScalar(rr); approachLine.scale.setScalar(rr);
    approach.material.color.setHex(ringC); approachGlow.material.color.setHex(ringC);
    approach.material.opacity = trailing ? (1 - p / TRAIL) : .55 + .45 * closing;
    approachLine.material.opacity = approach.material.opacity * .6;
    approachGlow.material.opacity = trailing ? (1 - p / TRAIL) * .3 : .12 + .25 * closing;
    target.material.color.setHex(danger ? RC.danger : inZone ? RC.hit : fever ? RC.fever : RC.base);
    targetGlow.material.color.setHex(danger ? RC.danger : inZone ? RC.hit : fever ? RC.fever : RC.idle);
    const ts = inZone ? 1.04 + Math.sin(t * 30) * .01 : 1; target.scale.setScalar(ts); targetLine.scale.setScalar(ts);
    targetGlow.material.opacity = inZone ? .6 : .22;
    zone.material.color.setHex(danger ? RC.danger : inZone ? RC.hit : fever ? RC.fever : RC.idle); zone.material.opacity = !playing ? .1 : danger ? .16 : inZone ? .35 : .08 + .1 * closing;
    target.visible = targetGlow.visible = targetLine.visible = zone.visible = state !== 'done';
    // impact star
    starT += dt; if (starT < .35) { const u = starT / .35; star.visible = true; star.scale.setScalar(.6 + u * 2.4 * starK); star.material.opacity = 1 - u; star.quaternion.copy(camera.quaternion); } else star.visible = false;
    // camera punch
    zoomP = Math.max(0, zoomP - dt * .5); camera.zoom = 1 + zoomP + slowAmt * slowAmt * .05; camera.updateProjectionMatrix();
    // shockwave on the floor
    shockT += dt; if (shockT < .6) { shock.scale.setScalar(.8 + shockT * 6); shock.material.opacity = 1 - shockT / .6; } else shock.material.opacity = 0;
    // squash the whole mochi (spring)
    squashV += (-squashY * 260 - squashV * 13) * dt; squashY += squashV * dt;
    mochiG.scale.set(1 - squashY * .5, 1 + squashY, 1 - squashY * .5);
    // floor waves: each tile gets a kick when the wavefront passes under it
    for (let w = tileWave.length - 1; w >= 0; w--) {
      const wv = tileWave[w]; wv.t += dt; const front = wv.t * 9;
      for (let i = 0; i < tileV.n; i++) {
        const c = tileV.cells[i], d = Math.hypot(c.x - wv.x, c.z - wv.z);
        if (tileHit[i] < w + 1 && d < front) { tileHit[i] = w + 1; tileV.vel[i * 3 + 1] += wv.a * Math.max(0, 1 - d / 7); }
      }
      if (front > 9) tileWave.splice(w, 1);
    }
    // completion: mochi cubes fly into the kagami-mochi shape, the bravesoft mark pops on top
    if (state === 'done') {
      doneT += dt;
      mochiV.cells.forEach((c, i) => {
        const u = clamp((doneT - .35 - c.delay) / .7, 0, 1), e = u * u * (3 - 2 * u);
        if (c.to) { c.x = c.from.x + (c.to.x - c.from.x) * e; c.y = c.from.y + (c.to.y - c.from.y) * e + Math.sin(e * Math.PI) * .8; c.z = c.from.z + (c.to.z - c.from.z) * e; }
        else mochiV.sc[i] = 1 - e;
      });
      if (doneT > 1.4 && !markV.mesh.visible) { markV.mesh.visible = true; kick(markV, 0, MK_Y + .25, 0, 3, 1.2, 1.5, .3); burst(new T.Vector3(U.x, USU_TOP + .95, U.z), 40, [0xFFE94A, 0x0066FF, 0xFFFFFF, 0xE5322D], 3.5, .12, 5); sfx.pop(); }
      if (Math.random() < .2) burst(new T.Vector3(rand(-3, 3), 4.5, rand(-2, 2)), 1, [0xFFE94A, 0x7FE0FF, 0xFFFFFF, 0xE5322D], .6, .1, -.2);
    }
    // steam rising from the mochi (more when the mochi is hot / fever)
    if (Math.random() < (fever ? .5 : .22)) { const s = steam.find(o => o.life <= 0); if (s) { s.life = 1; s.m.visible = true; s.x = U.x + rand(-.4, .4); s.z = U.z + rand(-.4, .4); s.y = MOCHI_TOP + .1; s.sz = rand(.08, .18); } }
    steam.forEach(s => { if (s.life <= 0) return; s.life -= dt * .7; s.y += dt * .9; s.x += Math.sin(t * 2 + s.z) * dt * .1; s.m.position.set(s.x, s.y, s.z); s.m.scale.setScalar(s.sz * (.6 + (1 - s.life))); s.m.material.opacity = Math.max(0, s.life) * .55; s.m.material.color.setHex(fever ? 0xFFF3B0 : 0xffffff); if (s.life <= 0) s.m.visible = false; });
    // debris physics
    for (let i = 0; i < DEB; i++) {
      const d = deb[i]; if (d.life <= 0) continue;
      d.life -= dt; d.v.y -= 12 * dt; d.p.addScaledVector(d.v, dt);
      if (d.p.y < .05 && d.v.y < 0) { d.p.y = .05; d.v.y *= -.35; d.v.x *= .6; d.v.z *= .6; }
      d.r += dt * 6; const s = d.s * Math.min(1, d.life * 2);
      debris.setMatrixAt(i, M4.compose(d.p, Q.setFromAxisAngle(UP, d.r), S.set(s, s, s)));
    }
    debris.instanceMatrix.needsUpdate = true;
    // springs
    [tileV, usuV, mochiV, sheepV, kineV, hindV, torsoV, headV, legs[0].v, legs[1].v, markV].forEach(v => stepVox(v, dt));
    // camera shake
    shakeA = Math.max(0, shakeA - dt * .6);
    world.position.set(rand(-1, 1) * shakeA, rand(-1, 1) * shakeA * .6, 0);
  }
  root._mc = { hit: q => { swingT = 0; judgedBeat = Math.round(phase()); impact(q, 0); }, get ring() { return { p: cyc(), hold: hitStop > 0 || slowT > 0, hand: handIn(), color: target.material.color.getHexString(), approach: approach.visible }; }, setProg: v => { prog = v; }, get state() { return state; }, get beat() { return { t0, period, now }; }, get lamb() { return { ready, pitch: torso.rotation.z, hand: handIn() }; }, set testHand(v) { testHand = v; }, get legs() { return legs.map((l, k) => ({ tip: l.g.localToWorld(new T.Vector3(0, -LEG, 0)).toArray().map(v => +v.toFixed(2)), hoof: HOOF[k].toArray().map(v => +v.toFixed(2)), rot: +l.g.rotation.z.toFixed(2), sy: +l.g.scale.y.toFixed(2) })); }, get lambPos() { return { lb: LB.position.toArray().map(v => +v.toFixed(2)), yaw: +LB.rotation.y.toFixed(2), U: [U.x, U.z] }; } };   // test hook
  resize(root.clientWidth || 322, root.clientHeight || 608);
  return { scene, camera, frame, resize, onMode() { resize(root.clientWidth, root.clientHeight); updHud(); } };
});
})();
