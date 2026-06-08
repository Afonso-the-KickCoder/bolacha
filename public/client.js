// Cliente 3D: cozinha gigante (estilo "A Webbing Journey") com altura.
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { WORLD, OBSTACLES } from './kitchen.js';

const lobby = document.getElementById('lobby');
const gameEl = document.getElementById('game');
const nameInput = document.getElementById('nameInput');
const nameError = document.getElementById('nameError');
const joinBtn = document.getElementById('joinBtn');
const restartBtn = document.getElementById('restartBtn');
const banner = document.getElementById('banner');
const canvas = document.getElementById('canvas');
const roleEl = document.getElementById('role');
const timerEl = document.getElementById('timer');
const aliveEl = document.getElementById('alive');
const stick = document.getElementById('stick');
const stickBase = document.getElementById('stickBase');
const stickKnob = document.getElementById('stickKnob');

let socket = null;
let myId = null;
let state = null;

// Conversao plano (0..W,0..H) -> coordenadas centradas do 3D.
const toX = (x) => x - WORLD.width / 2;
const toZ = (y) => y - WORLD.height / 2;

// =================== Ligacao ===================
function connectAndJoin() {
  const name = nameInput.value.trim();
  if (!name) {
    // Nome obrigatorio.
    nameInput.classList.add('invalid');
    nameError.classList.remove('hidden');
    nameInput.focus();
    return;
  }
  nameInput.classList.remove('invalid');
  nameError.classList.add('hidden');

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${proto}://${location.host}`);

  socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'join', name })));
  socket.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'welcome') {
      myId = msg.id;
      lobby.classList.add('hidden');
      gameEl.classList.remove('hidden');
      onResize();
    } else if (msg.type === 'state') {
      state = msg;
    }
  });
  socket.addEventListener('close', () => {
    banner.textContent = 'Ligacao perdida. Atualiza a pagina.';
    banner.classList.remove('hidden');
  });
}

joinBtn.addEventListener('click', connectAndJoin);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') connectAndJoin();
});
nameInput.addEventListener('input', () => {
  if (nameInput.value.trim()) {
    nameInput.classList.remove('invalid');
    nameError.classList.add('hidden');
  }
});
restartBtn.addEventListener('click', () => {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'restart' }));
});

// =================== Input (teclado + joystick) ===================
const keys = { up: false, down: false, left: false, right: false };
let jumpHeld = false;
const KEY_MAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { jumpHeld = true; e.preventDefault(); return; }
  const k = KEY_MAP[e.code];
  if (k) { keys[k] = true; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') { jumpHeld = false; e.preventDefault(); return; }
  const k = KEY_MAP[e.code];
  if (k) { keys[k] = false; e.preventDefault(); }
});

let touchVec = { dx: 0, dy: 0 };
let stickActive = false;
let touchJump = false;
const jumpBtn = document.getElementById('jumpBtn');
function isTouch() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
if (isTouch()) {
  stick.classList.remove('hidden');
  jumpBtn.classList.remove('hidden');
}
jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); touchJump = true; }, { passive: false });
jumpBtn.addEventListener('touchend', (e) => { e.preventDefault(); touchJump = false; }, { passive: false });

function handleStick(clientX, clientY, active) {
  const rect = stickBase.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = clientX - cx;
  let dy = clientY - cy;
  const max = rect.width / 2;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
  stickKnob.style.left = `${rect.width / 2 - 28 + dx}px`;
  stickKnob.style.top = `${rect.height / 2 - 28 + dy}px`;
  touchVec = active ? { dx: dx / max, dy: dy / max } : { dx: 0, dy: 0 };
  stickActive = active;
}
stick.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.touches[0]; handleStick(t.clientX, t.clientY, true); }, { passive: false });
stick.addEventListener('touchmove', (e) => { e.preventDefault(); const t = e.touches[0]; handleStick(t.clientX, t.clientY, true); }, { passive: false });
stick.addEventListener('touchend', (e) => {
  e.preventDefault();
  stickKnob.style.left = '32px';
  stickKnob.style.top = '32px';
  touchVec = { dx: 0, dy: 0 };
  stickActive = false;
}, { passive: false });

function currentInput() {
  const jump = jumpHeld || touchJump;
  if (stickActive) return { dx: touchVec.dx, dy: touchVec.dy, jump };
  return {
    dx: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
    dy: (keys.down ? 1 : 0) - (keys.up ? 1 : 0),
    jump,
  };
}
setInterval(() => {
  if (!socket || socket.readyState !== WebSocket.OPEN || !myId) return;
  const { dx, dy, jump } = currentInput();
  socket.send(JSON.stringify({ type: 'input', dx, dy, jump }));
}, 1000 / 20);

// =================== Cena 3D ===================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0e6d2);
scene.fog = new THREE.Fog(0xf0e6d2, 3400, 9500);

const camera = new THREE.PerspectiveCamera(50, 1, 1, 13000);
camera.position.set(0, 1000, 1060);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.outputColorSpace = THREE.SRGBColorSpace;

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8c6a3a, 0.7));
scene.add(new THREE.AmbientLight(0xffffff, 0.22));

const sun = new THREE.DirectionalLight(0xfff1d0, 1.3);
sun.position.set(900, 1700, 700);
sun.castShadow = true;
sun.shadow.mapSize.set(3072, 3072);
sun.shadow.radius = 4;
sun.shadow.bias = -0.0004;
sun.shadow.camera.near = 100;
sun.shadow.camera.far = 6000;
const sc = 1800;
sun.shadow.camera.left = -sc;
sun.shadow.camera.right = sc;
sun.shadow.camera.top = sc;
sun.shadow.camera.bottom = -sc;
scene.add(sun);

// Luz de preenchimento fria do lado oposto (sem sombra) para suavizar contrastes.
const fill = new THREE.DirectionalLight(0xcfe2ff, 0.4);
fill.position.set(-700, 900, -500);
scene.add(fill);

// Cores por tipo de movel
const KIND_COLOR = {
  counter: 0xb98a55,
  island: 0xa8794a,
  cabinet: 0xf2e6cf,
  pantry: 0xe9dabf,
  cupboard: 0xf5f5f2,
  door: 0xeceae3,
  roof: 0xe6e2d8,
  shelf: 0xcaa46b,
  table: 0x9c6b3f,
  fridge: 0xdfe3e6,
  stove: 0x3e4248,
  cereal: 0xe0573d,
};
// Tampos claros (laminado) por cima das superficies de trabalho.
const HAS_TOP = new Set(['counter', 'island', 'table', 'shelf']);
const HAS_DOORS = new Set(['cabinet', 'pantry', 'fridge']);

function makeFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  // Junta (grout) escura por baixo
  g.fillStyle = '#cdb589';
  g.fillRect(0, 0, 256, 256);
  // 2x2 azulejos com leve variacao e brilho
  const tiles = [['#f2e6cc', 0, 0], ['#ecdcbd', 128, 0], ['#ecdcbd', 0, 128], ['#f2e6cc', 128, 128]];
  for (const [col, x, y] of tiles) {
    g.fillStyle = col;
    g.fillRect(x + 6, y + 6, 116, 116);
    const grad = g.createLinearGradient(x + 6, y + 6, x + 122, y + 122);
    grad.addColorStop(0, 'rgba(255,255,255,0.18)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x + 6, y + 6, 116, 116);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.repeat.set(WORLD.width / 220, WORLD.height / 220);
  return tex;
}

let worldBuilt = false;
function buildWorld() {
  if (worldBuilt) return;
  worldBuilt = true;
  const W = WORLD.width;
  const H = WORLD.height;

  // Chao de azulejos
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Paredes da cozinha
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4d8b0, roughness: 1 });
  const wallH = 420;
  const wallT = 24;
  const addWall = (w, d, x, z) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    wall.position.set(x, wallH / 2, z);
    wall.receiveShadow = true;
    scene.add(wall);
  };
  addWall(W + wallT * 2, wallT, 0, -H / 2 - wallT / 2);
  addWall(wallT, H, -W / 2 - wallT / 2, 0);
  addWall(wallT, H, W / 2 + wallT / 2, 0);

  // Backsplash de azulejos atras das bancadas
  const splash = new THREE.Mesh(
    new THREE.BoxGeometry(W, 140, 10),
    new THREE.MeshStandardMaterial({ color: 0xbfe0d8, roughness: 0.5 }),
  );
  splash.position.set(0, 70, -H / 2 + 6);
  splash.receiveShadow = true;
  scene.add(splash);

  // Rodapes
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.9 });
  const addBase = (w, d, x, z) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 36, d), baseMat);
    b.position.set(x, 18, z);
    scene.add(b);
  };
  addBase(W, 14, 0, -H / 2 + 7);
  addBase(14, H, -W / 2 + 7, 0);
  addBase(14, H, W / 2 - 7, 0);

  // Janela luminosa na parede de tras
  const window = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 240),
    new THREE.MeshBasicMaterial({ color: 0xfdf6e0 }),
  );
  window.position.set(0, 300, -H / 2 - wallT + 2);
  scene.add(window);

  for (const o of OBSTACLES) {
    if (o.shape === 'cyl') addJar(o);
    else addBox(o);
  }
}

function addBox(o) {
  const w = o.x1 - o.x0;
  const d = o.y1 - o.y0;
  const cx = toX((o.x0 + o.x1) / 2);
  const cz = toZ((o.y0 + o.y1) / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: KIND_COLOR[o.kind] || 0xb98a55,
    roughness: o.kind === 'fridge' ? 0.35 : 0.85,
    metalness: o.kind === 'fridge' ? 0.55 : 0.0,
  });
  // Plataformas (ex.: telhado) tem base > 0 -> desenha so a laje [base, top].
  const base = o.base || 0;
  const bh = o.top - base;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, bh, d), mat);
  mesh.position.set(cx, base + bh / 2, cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Tampo de laminado claro nas superficies de trabalho
  if (HAS_TOP.has(o.kind)) {
    const topSlab = new THREE.Mesh(
      new THREE.BoxGeometry(w + 12, 16, d + 12),
      new THREE.MeshStandardMaterial({ color: 0xede3d2, roughness: 0.35, metalness: 0.05 }),
    );
    topSlab.position.set(cx, o.top + 4, cz);
    topSlab.castShadow = true;
    topSlab.receiveShadow = true;
    scene.add(topSlab);
  }

  // Portas com juntas + puxadores na face da frente (lado y1)
  if (HAS_DOORS.has(o.kind)) {
    const doors = Math.max(1, Math.round(w / 230));
    const frontZ = toZ(o.y1) + 1;
    const seamMat = new THREE.MeshStandardMaterial({ color: 0x3a2a16, transparent: true, opacity: 0.25 });
    const knobMat = new THREE.MeshStandardMaterial({ color: 0x5a3d1f, metalness: 0.6, roughness: 0.3 });
    for (let i = 1; i < doors; i++) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(3, o.top * 0.84, 4), seamMat);
      seam.position.set(toX(o.x0 + (w * i) / doors), o.top / 2, frontZ);
      scene.add(seam);
    }
    for (let i = 0; i < doors; i++) {
      const sx = o.x0 + (w * (i + 0.5)) / doors;
      const side = i % 2 === 0 ? 1 : -1;
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 16, 10), knobMat);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(toX(sx) - side * (w / doors) * 0.3, o.top * 0.55, frontZ + 3);
      scene.add(knob);
    }
  }

  // Bicos do fogao
  if (o.kind === 'stove') {
    const burnerMat = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.5 });
    for (const [ox, oz] of [[-60, -45], [60, -45], [-60, 55], [60, 55]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 6, 20), burnerMat);
      b.position.set(cx + ox, o.top + 4, cz + oz);
      scene.add(b);
    }
  }
}

function addJar(o) {
  // Vidro
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(o.rr, o.rr, o.top, 28, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0xcdeef6,
      transparent: true,
      opacity: 0.3,
      roughness: 0.06,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      side: THREE.DoubleSide,
    }),
  );
  glass.position.set(toX(o.cx), o.top / 2, toZ(o.cy));
  scene.add(glass);
  // Tampa
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(o.rr + 4, o.rr + 4, 14, 24),
    new THREE.MeshStandardMaterial({ color: 0xc0641f, roughness: 0.6 }),
  );
  lid.position.set(toX(o.cx), o.top + 6, toZ(o.cy));
  lid.castShadow = true;
  scene.add(lid);
  // "Bolachas" la dentro
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(o.rr - 10, o.rr - 10, o.top * 0.5, 18),
    new THREE.MeshStandardMaterial({ color: 0xd98a3d, roughness: 0.9 }),
  );
  inner.position.set(toX(o.cx), o.top * 0.25, toZ(o.cy));
  scene.add(inner);
}

// =================== Bonecos 3D ===================
// Silhueta "raio-x": so aparece onde o boneco esta ESCONDIDO atras de um movel.
// Usa depthFunc GreaterDepth -> o fragmento so desenha quando esta mais longe do
// que o que ja esta no depth buffer (ou seja, ocluido por geometria a frente).
function addSilhouette(group, color, radius, cy, scaleY) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
    depthFunc: THREE.GreaterDepth,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 16), mat);
  mesh.scale.y = scaleY;
  mesh.position.y = cy;
  mesh.renderOrder = 20; // desenhar depois da cena
  group.add(mesh);
}

function makeLimb(length, radius, color) {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, 4, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
  );
  mesh.position.y = -length / 2 - radius;
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

function buildBolacha(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.85 });
  const R = 24;
  const hipY = 16;
  const bodyY = hipY + 24;

  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 13, 30), bodyMat);
  body.rotation.x = Math.PI / 2;
  body.position.y = bodyY;
  body.castShadow = true;
  g.add(body);

  const chipMat = new THREE.MeshStandardMaterial({ color: 0x4a2c12, roughness: 0.6 });
  const chips = [[-9, 7], [9, 10], [5, -6], [-11, -8], [12, -2], [0, 4]];
  for (const [cx, cy] of chips) {
    const chip = new THREE.Mesh(new THREE.SphereGeometry(2.8, 8, 8), chipMat);
    chip.position.set(cx, bodyY + cy, 7);
    g.add(chip);
  }

  addFace(g, bodyY + 4, 8, 4, R);

  const armL = makeLimb(18, 4, color);
  armL.position.set(-R + 2, bodyY + 4, 0);
  armL.rotation.z = 0.5;
  const armR = makeLimb(18, 4, color);
  armR.position.set(R - 2, bodyY + 4, 0);
  armR.rotation.z = -0.5;
  g.add(armL, armR);

  const legL = makeLimb(16, 4.5, 0x7a4a1d);
  legL.position.set(-9, hipY, 0);
  const legR = makeLimb(16, 4.5, 0x7a4a1d);
  legR.position.set(9, hipY, 0);
  g.add(legL, legR);

  g.userData = { arms: [armL, armR], legs: [legL, legR], parts: collectMeshes(g) };
  // Grande o suficiente para conter bracos/pernas (senao a silhueta pinta-os).
  addSilhouette(g, 0xffe000, 40, 32, 0.85); // amarelo (bolacha)
  g.scale.setScalar(32 / 24); // maior (condiz com o raio de colisao = 32)
  return g;
}

function buildCrianca() {
  const g = new THREE.Group();
  const skin = 0xffd9b3;
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const R = 42;
  const hipY = 26;
  const bodyY = hipY + 34;

  const body = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 24), skinMat);
  body.scale.y = 1.05;
  body.position.y = bodyY;
  body.castShadow = true;
  g.add(body);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(R + 2, 24, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x5a3b1a, roughness: 0.9 }),
  );
  hair.position.y = bodyY + 6;
  hair.castShadow = true;
  g.add(hair);

  const blushMat = new THREE.MeshStandardMaterial({ color: 0xf08a78 });
  for (const sx of [-18, 18]) {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 10), blushMat);
    blush.position.set(sx, bodyY - 4, R - 6);
    g.add(blush);
  }

  addFace(g, bodyY + 2, 14, 8, R, true);

  const armL = makeLimb(30, 6, skin);
  armL.position.set(-R + 6, bodyY, 6);
  armL.rotation.x = -1.2;
  const armR = makeLimb(30, 6, skin);
  armR.position.set(R - 6, bodyY, 6);
  armR.rotation.x = -1.2;
  g.add(armL, armR);

  const legL = makeLimb(26, 7, 0x3b6fb0);
  legL.position.set(-15, hipY, 0);
  const legR = makeLimb(26, 7, 0x3b6fb0);
  legR.position.set(15, hipY, 0);
  g.add(legL, legR);

  g.userData = { arms: [armL, armR], legs: [legL, legR], parts: collectMeshes(g), isCrianca: true };
  // Grande o suficiente para conter bracos/pernas/olhos (senao a silhueta pinta-os).
  addSilhouette(g, 0xff2a1a, 60, 56, 0.95); // vermelho (crianca)
  return g;
}

function addFace(g, y, eyeSize, gap, R, openMouth = false) {
  // Branco ligeiramente emissivo para os olhos lerem como brancos sob a luz.
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 1 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a });
  for (const sx of [-gap - eyeSize / 2, gap + eyeSize / 2]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(eyeSize, 14, 14), whiteMat);
    white.position.set(sx, y, R - 4);
    g.add(white);
    // Pupila pequena, assente a superficie do olho -> o branco domina.
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeSize * 0.4, 10, 10), pupilMat);
    pupil.position.set(sx, y, R - 4 + eyeSize * 0.88);
    g.add(pupil);
  }
  if (openMouth) {
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 12), new THREE.MeshStandardMaterial({ color: 0x7a2e2e }));
    mouth.position.set(0, y - 22, R - 6);
    g.add(mouth);
  }
}

function collectMeshes(group) {
  const meshes = [];
  group.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  return meshes;
}

function setAlive(group, alive) {
  for (const m of group.userData.parts) {
    if (m.material.opacity !== undefined) {
      m.material.transparent = !alive;
      m.material.opacity = alive ? 1 : 0.3;
    }
  }
}

function animateLimbs(group, walk, grounded) {
  const { legs, arms, isCrianca } = group.userData;
  if (!grounded) {
    // Pose de salto: pernas recolhidas, bracos para cima.
    legs[0].rotation.x = -0.85;
    legs[1].rotation.x = -0.85;
    if (!isCrianca) {
      arms[0].rotation.x = -1.5;
      arms[1].rotation.x = -1.5;
    }
    return;
  }
  const swing = Math.sin(walk) * 0.6;
  legs[0].rotation.x = swing;
  legs[1].rotation.x = -swing;
  if (!isCrianca) {
    arms[0].rotation.x = -swing;
    arms[1].rotation.x = swing;
  }
}

// =================== Reconciliacao estado -> cena ===================
const objects = new Map(); // id -> { group, role, prev, heading }

// Etiqueta com o nome, sempre virada para a camara (sprite), por cima da cabeca.
function makeNameSprite(name, role) {
  const team = role === 'crianca' ? '#ff3322' : '#ffcf00'; // vermelho / amarelo
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const c = canvas.getContext('2d');
  c.font = 'bold 38px Trebuchet MS, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineWidth = 8;
  c.strokeStyle = '#2a1a0a'; // contorno escuro para contraste
  c.strokeText(name, 128, 34);
  c.fillStyle = team;
  c.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(170, 42, 1);
  sprite.renderOrder = 30;
  return sprite;
}

function syncScene() {
  const present = new Set(state.players.map((p) => p.id));
  for (const [id, obj] of objects) {
    if (!present.has(id)) {
      scene.remove(obj.group);
      scene.remove(obj.label);
      objects.delete(id);
    }
  }

  for (const p of state.players) {
    let obj = objects.get(p.id);
    if (!obj) {
      const group = p.role === 'crianca' ? buildCrianca() : buildBolacha(p.color);
      scene.add(group);
      const label = makeNameSprite(p.name, p.role);
      scene.add(label);
      obj = { group, role: p.role, prev: null, heading: 0, label };
      objects.set(p.id, obj);
    } else if (obj.role !== p.role) {
      // Mudou de papel -> reconstroi o boneco e a etiqueta (cor da equipa).
      scene.remove(obj.group);
      obj.group = p.role === 'crianca' ? buildCrianca() : buildBolacha(p.color);
      scene.add(obj.group);
      scene.remove(obj.label);
      obj.label = makeNameSprite(p.name, p.role);
      scene.add(obj.label);
      obj.role = p.role;
    }

    const wx = toX(p.x);
    const wz = toZ(p.y);
    obj.group.position.set(wx, p.h - (p.alive ? 0 : 6), wz);

    if (obj.prev) {
      const dx = wx - obj.prev.x;
      const dz = wz - obj.prev.z;
      if (Math.hypot(dx, dz) > 0.6) obj.heading = Math.atan2(dx, dz);
    }
    obj.prev = { x: wx, z: wz };
    obj.group.rotation.y = obj.heading;

    // Etiqueta por cima da cabeca.
    const headY = p.h + (p.role === 'crianca' ? 155 : 115);
    obj.label.position.set(wx, headY, wz);
    obj.label.material.opacity = p.alive ? 1 : 0.4;

    animateLimbs(obj.group, p.walk, p.grounded !== false);
    setAlive(obj.group, p.alive);
  }
}

// =================== HUD ===================
function updateHud() {
  const self = state.players.find((p) => p.id === myId);
  if (self) {
    roleEl.textContent = self.role === 'crianca'
      ? '👶 Es a CRIANCA — apanha as bolachas!'
      : '🍪 Es uma BOLACHA — foge e sobe aos armarios!';
  }
  timerEl.textContent = state.phase === 'playing' ? `⏱️ ${state.timeLeft}s` : '';
  const bolachas = state.players.filter((p) => p.role === 'bolacha');
  const vivas = bolachas.filter((p) => p.alive).length;
  aliveEl.textContent = bolachas.length ? `Bolachas: ${vivas}/${bolachas.length}` : '';

  if (state.phase === 'countdown') {
    banner.textContent = state.countdown > 0 ? state.countdown : 'Vai!';
    banner.classList.remove('hidden');
    restartBtn.classList.add('hidden');
  } else if (state.phase === 'over') {
    banner.textContent = state.message;
    banner.classList.remove('hidden');
    restartBtn.classList.remove('hidden');
  } else if (state.phase === 'waiting') {
    banner.textContent = state.message;
    banner.classList.remove('hidden');
    restartBtn.classList.add('hidden');
  } else {
    banner.classList.add('hidden');
    restartBtn.classList.add('hidden');
  }
}

// =================== Loop de render ===================
const camTarget = new THREE.Vector3();
const camOffset = new THREE.Vector3(0, 900, 980);
const desired = new THREE.Vector3();

function render() {
  requestAnimationFrame(render);
  buildWorld();
  if (!state) {
    renderer.render(scene, camera);
    return;
  }
  syncScene();
  updateHud();

  const self = objects.get(myId);
  if (self) camTarget.copy(self.group.position);
  else camTarget.set(0, 0, 0);

  desired.copy(camTarget).add(camOffset);
  camera.position.lerp(desired, 0.08);
  camera.lookAt(camTarget.x, camTarget.y + 40, camTarget.z);

  renderer.render(scene, camera);
}
render();
