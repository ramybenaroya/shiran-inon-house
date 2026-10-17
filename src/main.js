import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { N8AOPass } from 'n8ao';

import { ROOMS, WALLS, LEVELS, SLABS, STAIR_DIVIDER, SITE } from './plan.js';
import { createMaterials } from './materials.js';
import { buildArchitecture, buildOpenings } from './builder.js';
import { furnish, roofEquipment } from './furniture.js';
import { buildSite } from './site.js';
import { Environment } from './sky.js';
import { Walker } from './walk.js';
import { mergeStatic } from './merge.js';

CameraControls.install({ THREE });

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// ---------------------------------------------------------------------------
// Renderer, scene, camera
// ---------------------------------------------------------------------------
const app = $('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
app.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.position = 'fixed';
labelRenderer.domElement.style.inset = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
// the label layer positions children absolutely from the left; keep it LTR in this RTL page
labelRenderer.domElement.dir = 'ltr';
app.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 4000);
camera.position.set(70, 45, 70);

const groups = {
  ground: new THREE.Group(),
  groundCeiling: new THREE.Group(),
  upper: new THREE.Group(),
  roof: new THREE.Group(),
  site: new THREE.Group(),
};
for (const [k, g] of Object.entries(groups)) { g.name = k; scene.add(g); }

let quality = isTouch ? 'low' : 'high';

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
const manager = new THREE.LoadingManager();
let texProgress = 0;
manager.onProgress = (_url, loaded, total) => { texProgress = loaded / total; setProgress(); };
let buildProgress = 0;
function setProgress(label) {
  const p = Math.round((texProgress * 0.6 + buildProgress * 0.4) * 100);
  $('progress-bar').style.width = `${p}%`;
  if (label) $('progress-label').textContent = label;
}
const texturesLoaded = new Promise((resolve) => { manager.onLoad = resolve; });

const M = createMaterials(renderer, manager);
M.lampShade.userData.emissiveNight = 0.9;
M.bulb.userData.emissiveNight = 3.0;

let env, walker, controls, composer, n8ao, smaa, tvScreen;
const labels = [];
const nightLights = [];
const glowMats = [];

async function build() {
  setProgress('בונה קירות מאבן ירושלמית…');
  await nextFrame();
  buildArchitecture(M, groups);
  buildOpenings(M, groups);
  buildTwin();
  buildProgress = 0.35; setProgress('מרהט את החדרים…');
  await nextFrame();
  await Promise.race([document.fonts.load('600 60px Heebo'), sleep(2500)]);
  const f = furnish(M, groups);
  nightLights.push(...f.lights);
  tvScreen = f.tv;
  glowMats.push(...f.glow);
  roofEquipment(M, groups);
  buildProgress = 0.6; setProgress('שותל עצי זית וברושים…');
  await nextFrame();
  buildSite(M, groups, nightLights);
  // bake static furniture, fixtures and planting into a few draw calls
  for (const k of ['ground', 'upper', 'roof']) {
    for (const c of [...groups[k].children]) if (c.isGroup) mergeStatic(c);
  }
  for (const c of [...groups.site.children]) if (c.isGroup && c.name !== 'twin') mergeStatic(c);
  const loose = new THREE.Group();
  for (const c of [...groups.site.children]) if (c.isMesh && !c.isInstancedMesh && c.geometry.attributes.color === undefined) loose.add(c);
  groups.site.add(loose);
  mergeStatic(loose);
  buildProgress = 0.85; setProgress('מכין את השמיים מעל ירושלים…');
  await nextFrame();

  env = new Environment(renderer, scene, { shadowSize: isTouch ? 2048 : 4096 });
  env.setNightLights(nightLights, [M.lampShade, M.bulb, ...glowMats]);
  for (const g of Object.values(groups)) {
    g.traverse((o) => {
      if (o.isPointLight) o.castShadow = false;
    });
  }
  buildLabels();
  buildMenus();
  setupControls();
  setupComposer();
  updateTime();
  buildProgress = 1; setProgress();
}

// The house is one half of a semi-detached pair (the party line is x = 0):
// show the neighbouring unit as a mirrored shell (architecture batches only,
// no interior or furniture).
function buildTwin() {
  const twin = new THREE.Group();
  twin.name = 'twin';
  for (const k of ['ground', 'groundCeiling', 'upper', 'roof']) {
    for (const o of groups[k].children) if (o.isMesh) twin.add(o.clone());
  }
  twin.scale.x = -1;
  groups.site.add(twin);
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------
const area = (rects) => rects.reduce((s, r) => s + (r[2] - r[0]) * (r[3] - r[1]), 0);
const roomList = [];

function buildLabels() {
  for (const floor of ['ground', 'upper']) {
    for (const room of ROOMS[floor]) {
      if (room.hidden) continue;
      const a = area(room.rects);
      const level = floor === 'ground' ? 0 : LEVELS.upper;
      roomList.push({ ...room, floorKey: floor, area: a, level });
      const el = document.createElement('div');
      el.className = 'label';
      el.innerHTML = `${room.he}<small>${a.toFixed(1)} מ״ר</small>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); goToRoom(roomList.find((r) => r.id === room.id)); });
      const obj = new CSS2DObject(el);
      obj.position.set(room.label[0], level + 1.2, room.label[1]);
      obj.userData = { floor, kind: 'room' };
      scene.add(obj);
      labels.push(obj);
    }
  }
  const outdoor = [
    { he: 'פטיו ופרגולה', p: [7.6, 0.4, 10.2] },
    { he: 'גינה', p: [6.0, 0.3, 14.8] },
    { he: 'חצר צפונית', p: [6.5, 0.3, -2.6] },
    { he: 'גג', p: [2.4, 4.3, 9.0] },
    { he: 'שביל הכניסה', p: [11.8, 0.3, 6.75] },
  ];
  for (const o of outdoor) {
    const el = document.createElement('div');
    el.className = 'label outdoor';
    el.textContent = o.he;
    const obj = new CSS2DObject(el);
    obj.position.set(...o.p);
    obj.userData = { floor: 'out', kind: 'out' };
    scene.add(obj);
    labels.push(obj);
  }
}

// Hide labels whose anchor is hidden behind the building (checked a few times a second).
const raycaster = new THREE.Raycaster();
let occluders = [];
let occlusionClock = 0;
function updateOcclusion(dt) {
  occlusionClock += dt;
  if (occlusionClock < 0.25) return;
  occlusionClock = 0;
  if (!occluders.length) {
    for (const k of ['ground', 'groundCeiling', 'upper', 'roof']) {
      // architecture batches are direct children; furniture lives in nested groups
      for (const o of groups[k].children) if (o.isMesh && !o.material.transparent) occluders.push(o);
    }
  }
  const active = occluders.filter((o) => {
    let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true;
  });
  const v = new THREE.Vector3();
  for (const l of labels) {
    if (!l.visible || l.userData.kind === 'room') continue;
    l.getWorldPosition(v);
    const dir = v.clone().sub(camera.position);
    const dist = dir.length();
    raycaster.set(camera.position, dir.normalize());
    raycaster.far = dist - 0.3;
    const hit = raycaster.intersectObjects(active, false).length > 0;
    l.element.style.opacity = hit ? '0' : '1';
    l.element.style.pointerEvents = hit ? 'none' : 'auto';
  }
}

function updateLabels() {
  for (const l of labels) {
    const { floor } = l.userData;
    let v = false;
    if (mode === 'orbit') {
      if (floorMode === 'all') v = floor === 'out';
      else v = floor === floorMode;
    }
    l.visible = v;
    l.element.style.display = v ? '' : 'none';
  }
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------
const VIEWS = [
  { he: 'מבט על', pos: [28, 26, 28], target: [5.5, 1, 6] },
  { he: 'הכניסה מהשביל', pos: [14.2, 1.9, 6.9], target: [6.2, 1.5, 6.7] },
  { he: 'הפטיו והפרגולה', pos: [9.6, 2.3, 15.6], target: [7.4, 1.3, 9.4] },
  { he: 'חזית צפונית', pos: [8.5, 3.0, -13.5], target: [5.8, 2.8, 1.5] },
  { he: 'חזית דרומית וגינה', pos: [5.5, 3.2, 25], target: [4.0, 2.4, 9] },
  { he: 'הגג והדוד', pos: [-5, 13, 17], target: [3.0, 4.0, 6.5] },
  { he: 'תוכנית קומת קרקע', pos: [5.5, 27, 6.01], target: [5.5, 0, 6.0], floor: 'ground' },
  { he: 'תוכנית קומה שנייה', pos: [6.0, 24, 2.96], target: [6.0, 3.25, 2.95], floor: 'upper' },
];

function buildMenus() {
  const rm = $('menu-rooms');
  rm.innerHTML = '';
  const gtotal = { ground: 0, upper: 0 };
  for (const floor of ['ground', 'upper']) {
    const h = document.createElement('div');
    h.className = 'group';
    h.textContent = floor === 'ground' ? 'קומת קרקע' : 'קומה שנייה';
    rm.appendChild(h);
    for (const r of roomList.filter((x) => x.floorKey === floor)) {
      const b = document.createElement('button');
      b.innerHTML = `<span>${r.he}</span><small>${r.area.toFixed(1)} מ״ר</small>`;
      b.onclick = () => { closeMenus(); goToRoom(r); };
      rm.appendChild(b);
      gtotal[floor] += r.area;
    }
  }
  const vm = $('menu-views');
  vm.innerHTML = '';
  for (const v of VIEWS) {
    const b = document.createElement('button');
    b.textContent = v.he;
    b.onclick = () => { closeMenus(); flyTo(v.pos, v.target, v.floor ?? 'all'); };
    vm.appendChild(b);
  }
  $('btn-rooms').onclick = (e) => { e.stopPropagation(); toggleMenu('menu-rooms'); };
  $('btn-views').onclick = (e) => { e.stopPropagation(); toggleMenu('menu-views'); };
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.menu-wrap')) closeMenus();
  });
}

function toggleMenu(id) {
  const m = $(id);
  const open = !m.classList.contains('open');
  closeMenus();
  if (open) m.classList.add('open');
}
function closeMenus() { document.querySelectorAll('.menu').forEach((m) => m.classList.remove('open')); }

// ---------------------------------------------------------------------------
// Modes: orbit / walk, floor visibility
// ---------------------------------------------------------------------------
let mode = 'orbit';
let floorMode = 'all';

function setFloorMode(f) {
  floorMode = f;
  groups.roof.visible = f === 'all';
  groups.upper.visible = f !== 'ground';
  groups.groundCeiling.visible = f !== 'ground';
  document.querySelectorAll('#floor-seg button').forEach((b) => b.classList.toggle('on', b.dataset.floor === f));
  $('brand-sub').textContent = mode === 'walk' ? 'סיור בבית' : f === 'all' ? 'מבט חיצוני' : f === 'upper' ? 'קומה שנייה · מבט מלמעלה' : 'קומת קרקע · מבט מלמעלה';
  updateLabels();
}

function setupControls() {
  controls = new CameraControls(camera, renderer.domElement);
  controls.minDistance = 1.5;
  controls.maxDistance = 140;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.dollyToCursor = true;
  controls.smoothTime = 0.35;
  controls.draggingSmoothTime = 0.12;
  controls.setLookAt(70, 48, 75, 5.5, 1, 6, false);
  controls.addEventListener('controlstart', () => { idleTime = 0; autoRotate = false; });

  walker = new Walker(camera, renderer.domElement, {
    onExit: () => setMode('orbit'),
  });
}

let idleTime = 0;
let autoRotate = false;

function setMode(m) {
  if (m === mode) return;
  mode = m;
  document.querySelectorAll('#mode-seg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  document.querySelectorAll('#floor-seg button').forEach((b) => { b.disabled = m === 'walk'; });
  if (m === 'walk') {
    controls.enabled = false;
    setFloorMode('all');
    camera.fov = 70;
    camera.updateProjectionMatrix();
    walker.isTouch = isTouch;
    walker.enter(pendingWalkStart?.pos ?? new THREE.Vector3(12.6, LEVELS.courtyard, 6.75), pendingWalkStart?.yaw ?? Math.PI / 2);
    pendingWalkStart = null;
    $('minimap').classList.remove('hidden');
    $('btn-noclip').classList.remove('hidden');
    showWalkHint();
    if (!isTouch) addCrosshair();
  } else {
    walker.exit();
    camera.fov = 45;
    camera.updateProjectionMatrix();
    controls.enabled = true;
    // continue orbiting from where the walker stood
    const p = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    controls.setLookAt(p.x, p.y, p.z, p.x + dir.x * 4, p.y + dir.y * 4, p.z + dir.z * 4, false);
    flyTo([28, 26, 28], [5.5, 1, 6], 'all');
    $('minimap').classList.add('hidden');
    $('btn-noclip').classList.add('hidden');
    $('walk-hint').classList.add('hidden');
    removeCrosshair();
  }
  $('brand-sub').textContent = m === 'walk' ? 'סיור בבית' : 'מבט חיצוני';
  updateLabels();
}

let pendingWalkStart = null;

// On tall (portrait) screens pull the camera back so the subject still fits.
function framed(pos, target) {
  const k = camera.aspect < 1 ? Math.min(2.1, 1 / camera.aspect * 0.85) : 1;
  return pos.map((p, i) => target[i] + (p - target[i]) * k);
}

function flyTo(pos, target, floor) {
  if (mode === 'walk') setMode('orbit');
  if (floor) setFloorMode(floor);
  autoRotate = false;
  controls.smoothTime = 0.9;
  controls.setLookAt(...framed(pos, target), ...target, true).then(() => { controls.smoothTime = 0.35; });
  $('room-card').classList.add('hidden');
}

function goToRoom(r) {
  const [x, z] = r.label;
  if (mode === 'walk') {
    walker.teleport(x, z, r.level, walker.yaw);
    return;
  }
  setFloorMode(r.floorKey);
  const y = r.level;
  flyTo([x + 2.6, y + 7.5, z + 6.2], [x, y + 0.4, z], r.floorKey);
  const card = $('room-card');
  card.innerHTML = `<div class="t">${r.he}</div><div class="m">${r.area.toFixed(1)} מ״ר · ${r.floorKey === 'ground' ? 'קומת קרקע' : 'קומה שנייה'}<br/><a href="#" id="walk-here" style="color:var(--accent)">סיור בחדר ←</a></div>`;
  card.classList.remove('hidden');
  $('walk-here').onclick = (e) => {
    e.preventDefault();
    pendingWalkStart = { pos: new THREE.Vector3(x, r.level, z), yaw: Math.PI / 2 };
    setMode('walk');
    card.classList.add('hidden');
  };
}

let hintTimer;
function showWalkHint() {
  const h = $('walk-hint');
  h.innerHTML = isTouch
    ? 'ג׳ויסטיק בצד שמאל להליכה<br/>גרירה בצד ימין להסתכלות<br/>אפשר לעבור דרך קירות — לכיבוי: כפתור 👻'
    : 'קליק על המסך כדי להתחיל<br/><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> או החצים להליכה · עכבר להסתכלות<br/><kbd>Shift</kbd> לריצה · <kbd>Esc</kbd> ליציאה<br/>אפשר לעבור דרך קירות — לכיבוי: כפתור 👻';
  h.classList.remove('hidden', 'fade');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.add('fade'), 5500);
}

let crosshair;
function addCrosshair() {
  crosshair = document.createElement('div');
  crosshair.className = 'crosshair';
  document.body.appendChild(crosshair);
}
function removeCrosshair() { crosshair?.remove(); crosshair = null; }

// ---------------------------------------------------------------------------
// Minimap
// ---------------------------------------------------------------------------
const mm = $('minimap');
const mctx = mm.getContext('2d');
const MM = { x0: -1.5, z0: -3.6, size: 20 };
function drawMinimap() {
  if (mode !== 'walk') return;
  const W = mm.width;
  const s = W / MM.size;
  // north up, east right – the same orientation as the architect's plans
  const px = (x) => (x - MM.x0) * s;
  const pz = (z) => (z - MM.z0) * s;
  mctx.clearRect(0, 0, W, W);
  mctx.fillStyle = 'rgba(150,170,120,0.25)';
  mctx.fillRect(px(SITE.lot.x0), pz(SITE.lot.z0), (SITE.lot.x1 - SITE.lot.x0) * s, (SITE.lot.z1 - SITE.lot.z0) * s);
  mctx.fillStyle = 'rgba(233,220,192,0.25)';
  for (const C of [SITE.patio, SITE.path]) mctx.fillRect(px(C.x0), pz(C.z0), (C.x1 - C.x0) * s, (C.z1 - C.z0) * s);
  const lvl = walker.level;
  mctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (const r of (lvl === 'ground' ? SLABS.ground : SLABS.upper)) mctx.fillRect(px(r[0]), pz(r[1]), (r[2] - r[0]) * s, (r[3] - r[1]) * s);
  mctx.fillStyle = '#e9dcc0';
  for (const r of [...WALLS[lvl], STAIR_DIVIDER]) mctx.fillRect(px(r[0]), pz(r[1]), Math.max(1.5, (r[2] - r[0]) * s), Math.max(1.5, (r[3] - r[1]) * s));
  // player
  const p = walker.pos;
  mctx.save();
  mctx.translate(px(p.x), pz(p.z));
  mctx.rotate(-walker.yaw);
  mctx.fillStyle = 'rgba(226,164,111,0.35)';
  mctx.beginPath(); mctx.moveTo(0, 0); mctx.arc(0, 0, 26, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); mctx.closePath(); mctx.fill();
  mctx.fillStyle = '#e2a46f';
  mctx.beginPath(); mctx.arc(0, 0, 5, 0, Math.PI * 2); mctx.fill();
  mctx.restore();
  mctx.fillStyle = 'rgba(255,255,255,0.7)';
  mctx.font = '600 13px Heebo';
  mctx.fillText('צ', W / 2 - 4, 16);
}
mm.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  const rect = mm.getBoundingClientRect();
  const x = MM.x0 + ((e.clientX - rect.left) / rect.width) * MM.size;
  const z = MM.z0 + ((e.clientY - rect.top) / rect.height) * MM.size;
  walker.teleport(x, z, walker.pos.y + 0.2);
});

// ---------------------------------------------------------------------------
// Post processing
// ---------------------------------------------------------------------------
function setupComposer() {
  composer = new EffectComposer(renderer);
  n8ao = new N8AOPass(scene, camera, innerWidth, innerHeight);
  n8ao.configuration.aoRadius = 0.9;
  n8ao.configuration.distanceFalloff = 0.5;
  n8ao.configuration.intensity = 2.2;
  n8ao.configuration.aoSamples = 16;
  n8ao.configuration.denoiseSamples = 8;
  n8ao.configuration.denoiseRadius = 10;
  n8ao.configuration.gammaCorrection = false;
  composer.addPass(n8ao);
  composer.addPass(new OutputPass());
  smaa = new SMAAPass();
  composer.addPass(smaa);
  applyQuality();
}

function applyQuality() {
  const pr = Math.min(devicePixelRatio, quality === 'high' ? 1.75 : 1.25);
  renderer.setPixelRatio(pr);
  resize();
  $('btn-quality').classList.toggle('off', quality !== 'high');
  $('btn-quality').textContent = quality === 'high' ? 'HD' : 'SD';
}

function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  composer?.setSize(w, h);
}
addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Time of day
// ---------------------------------------------------------------------------
const today = new Date();
let day = today;
const SEASONS = {
  today: () => today,
  summer: () => new Date(today.getFullYear(), 5, 21),
  winter: () => new Date(today.getFullYear(), 11, 21),
};
document.querySelectorAll('#season-seg button').forEach((b) => {
  b.onclick = () => {
    day = SEASONS[b.dataset.season]();
    document.querySelectorAll('#season-seg button').forEach((x) => x.classList.toggle('on', x === b));
    updateTime();
  };
});
let envPending = false;
function updateTime() {
  const t = parseFloat($('time').value);
  const hh = Math.floor(t), mmn = Math.round((t - hh) * 60);
  $('time-label').textContent = `${String(hh).padStart(2, '0')}:${String(mmn === 60 ? 0 : mmn).padStart(2, '0')}`;
  if (envPending) return;
  envPending = true;
  requestAnimationFrame(() => {
    envPending = false;
    env.update(day, parseFloat($('time').value));
    $('time-icon').textContent = env.alt > 0 ? '☀' : '☾';
    if (tvScreen) tvScreen.emissiveIntensity = 0.45 + env.night * 0.6;
  });
}
$('time').addEventListener('input', updateTime);

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------
document.querySelectorAll('#mode-seg button').forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });
document.querySelectorAll('#floor-seg button').forEach((b) => {
  b.onclick = () => {
    setFloorMode(b.dataset.floor);
    if (b.dataset.floor !== 'all') {
      const up = b.dataset.floor === 'upper';
      const lv = up ? LEVELS.upper : 0;
      const t = up ? [6.0, lv, 3.2] : [5.5, lv, 6.2];
      flyTo(up ? [t[0] + 5, lv + 18, t[2] + 10] : [t[0] + 8.5, lv + 16, t[2] + 15], t, b.dataset.floor);
    }
  };
});
$('btn-noclip').onclick = () => {
  walker.noclip = !walker.noclip;
  $('btn-noclip').classList.toggle('on', walker.noclip);
  // leaving no-clip inside furniture or a wall: settle back onto the floor
  if (!walker.noclip) walker.teleport(walker.pos.x, walker.pos.z, walker.pos.y + 0.1);
};
$('btn-help').onclick = () => $('help').classList.remove('hidden');
$('help-close').onclick = () => $('help').classList.add('hidden');
$('btn-quality').onclick = () => { quality = quality === 'high' ? 'low' : 'high'; applyQuality(); };
$('btn-full').onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
};
renderer.domElement.addEventListener('pointerdown', () => { idleTime = 0; autoRotate = false; $('room-card').classList.add('hidden'); });

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document);
let started = false;
function loop() {
  requestAnimationFrame(loop);
  timer.update();
  const dt = timer.getDelta();
  if (!env) return;
  if (mode === 'walk') {
    walker.update(dt);
    drawMinimap();
  } else if (controls) {
    idleTime += dt;
    if (started && idleTime > 14 && !window.__house.noAuto) autoRotate = true;
    if (autoRotate && floorMode === 'all') controls.rotate(dt * 0.06, 0, false);
    controls.update(dt);
  }
  if (quality === 'high' && composer) composer.render(dt);
  else renderer.render(scene, camera);
  if (mode === 'orbit') updateOcclusion(dt);
  labelRenderer.render(scene, camera);
}

async function main() {
  resize();
  await texturesLoaded.catch(() => {});
  await build();
  loop();
  setProgress('הבית מוכן ✨');
  const enter = $('enter');
  enter.disabled = false;
  enter.onclick = () => {
    $('splash').classList.add('gone');
    $('hud').classList.remove('hidden');
    started = true;
    controls.smoothTime = 2.2;
    controls.setLookAt(...framed([24, 14, 27], [5.5, 1.2, 6.0]), 5.5, 1.2, 6.0, true).then(() => { controls.smoothTime = 0.35; });
    setFloorMode('all');
  };
}

main().catch((err) => {
  console.error(err);
  $('progress-label').textContent = 'אופס, משהו השתבש בטעינה. נסו לרענן את הדף.';
});

// handy for debugging from the console
window.__house = { scene, camera, renderer, groups, M, get controls() { return controls; }, get n8ao() { return n8ao; }, get walker() { return walker; }, get env() { return env; }, setMode, setFloorMode, flyTo };
