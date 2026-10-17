import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LEVELS } from './plan.js';
import { paintingTexture, welcomeScreenTexture } from './materials.js';

// ---------------------------------------------------------------------------
// Primitive helpers (all sizes in meters, objects sit on y = 0 unless noted)
// ---------------------------------------------------------------------------
function mesh(geo, mat, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

// box spanning absolute ranges [x0,x1] [y0,y1] [z0,z1]
function bx(x0, y0, z0, x1, y1, z1, mat, r = 0) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const geo = r > 0
    ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2))
    : new THREE.BoxGeometry(w, h, d);
  const m = mesh(geo, mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
}

// centred box: size + centre
function cb(w, h, d, x, y, z, mat, r = 0) {
  return bx(x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2, mat, r);
}

function cyl(rt, rb, h, x, y, z, mat, seg = 24) {
  const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  return m;
}

function group(x = 0, y = 0, z = 0, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return g;
}

// Rotation helpers: furniture is modelled facing +z ("front" toward +z).
const FACE = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };

// ---------------------------------------------------------------------------
// Furniture pieces (local coordinates, facing +z)
// ---------------------------------------------------------------------------
function sofa(M, len, depth, { chaise = 0, chaiseSide = -1, mat = M.fabricSofa, cushions = [] } = {}) {
  const g = new THREE.Group();
  const seatH = 0.42, backH = 0.82, arm = 0.16;
  const z0 = -depth / 2, z1 = depth / 2;
  // base
  g.add(bx(-len / 2, 0.08, z0, len / 2, seatH - 0.12, z1, mat, 0.04));
  // back
  g.add(bx(-len / 2, 0.08, z0, len / 2, backH, z0 + 0.2, mat, 0.06));
  // arms
  if (!(chaise && chaiseSide < 0)) g.add(bx(-len / 2, 0.08, z0, -len / 2 + arm, 0.62, z1, mat, 0.06));
  if (!(chaise && chaiseSide > 0)) g.add(bx(len / 2 - arm, 0.08, z0, len / 2, 0.62, z1, mat, 0.06));
  // seat cushions
  const inner0 = -len / 2 + (chaise && chaiseSide < 0 ? 0 : arm);
  const inner1 = len / 2 - (chaise && chaiseSide > 0 ? 0 : arm);
  const n = Math.max(2, Math.round((inner1 - inner0) / 0.85));
  const cw = (inner1 - inner0) / n;
  for (let i = 0; i < n; i++) {
    g.add(bx(inner0 + i * cw + 0.005, seatH - 0.12, z0 + 0.2, inner0 + (i + 1) * cw - 0.005, seatH + 0.02, z1 - 0.01, mat, 0.05));
    // back cushions
    const bc = bx(inner0 + i * cw + 0.01, seatH, z0 + 0.12, inner0 + (i + 1) * cw - 0.01, backH + 0.05, z0 + 0.34, mat, 0.08);
    bc.rotation.x = -0.12;
    g.add(bc);
  }
  if (chaise) {
    const cx0 = chaiseSide < 0 ? -len / 2 : len / 2 - chaise;
    const cx1 = cx0 + chaise;
    g.add(bx(cx0, 0.08, z1, cx1, seatH - 0.12, z1 + 0.75, mat, 0.04));
    g.add(bx(cx0 + 0.005, seatH - 0.12, z1 - 0.01, cx1 - 0.005, seatH + 0.02, z1 + 0.74, mat, 0.05));
    const ax = chaiseSide < 0 ? cx0 : cx1 - arm;
    g.add(bx(ax, 0.08, z0, ax + arm, 0.62, z1 + 0.75, mat, 0.06));
  }
  // legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(cyl(0.018, 0.014, 0.08, sx * (len / 2 - 0.08), 0.04, sz * (depth / 2 - 0.08), M.blackMetal, 8));
  }
  // throw cushions
  cushions.forEach((c, i) => {
    const p = cb(0.45, 0.42, 0.14, c.x, seatH + 0.22, z0 + 0.36, c.mat, 0.06);
    p.rotation.x = -0.25;
    p.rotation.z = (i % 2 ? 1 : -1) * 0.08;
    g.add(p);
  });
  return g;
}

function armchair(M, mat) {
  const g = new THREE.Group();
  g.add(bx(-0.38, 0.12, -0.36, 0.38, 0.4, 0.36, mat, 0.06));
  g.add(bx(-0.38, 0.12, -0.36, 0.38, 0.85, -0.18, mat, 0.08));
  g.add(bx(-0.38, 0.12, -0.36, -0.26, 0.6, 0.36, mat, 0.05));
  g.add(bx(0.26, 0.12, -0.36, 0.38, 0.6, 0.36, mat, 0.05));
  g.add(bx(-0.26, 0.38, -0.18, 0.26, 0.48, 0.34, mat, 0.05));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = cyl(0.015, 0.012, 0.14, sx * 0.3, 0.06, sz * 0.28, M.veneerDark, 8);
    g.add(l);
  }
  return g;
}

function table(M, w, d, h, { top = M.veneer, legs = M.blackMetal, round = false, thick = 0.035 } = {}) {
  const g = new THREE.Group();
  if (round) {
    g.add(cyl(w / 2, w / 2, thick, 0, h - thick / 2, 0, top, 40));
    g.add(cyl(0.03, 0.03, h - thick, 0, (h - thick) / 2, 0, legs, 12));
    g.add(cyl(0.22, 0.24, 0.02, 0, 0.01, 0, legs, 24));
  } else {
    g.add(bx(-w / 2, h - thick, -d / 2, w / 2, h, d / 2, top, 0.008));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(bx(sx * (w / 2 - 0.06) - 0.02, 0, sz * (d / 2 - 0.06) - 0.02, sx * (w / 2 - 0.06) + 0.02, h - thick, sz * (d / 2 - 0.06) + 0.02, legs));
    }
  }
  return g;
}

function chair(M, seatMat = M.veneer, frame = M.blackMetal) {
  const g = new THREE.Group();
  g.add(bx(-0.22, 0.43, -0.22, 0.22, 0.47, 0.22, seatMat, 0.01));
  g.add(bx(-0.21, 0.6, -0.24, 0.21, 0.85, -0.2, seatMat, 0.01));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(bx(sx * 0.19 - 0.012, 0, sz * 0.19 - 0.012, sx * 0.19 + 0.012, 0.43, sz * 0.19 + 0.012, frame));
  }
  g.add(bx(-0.21, 0.47, -0.235, -0.18, 0.85, -0.205, frame));
  g.add(bx(0.18, 0.47, -0.235, 0.21, 0.85, -0.205, frame));
  return g;
}

function stool(M) {
  const g = new THREE.Group();
  g.add(cyl(0.19, 0.17, 0.06, 0, 0.66, 0, M.veneer, 28));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const l = cyl(0.012, 0.012, 0.68, Math.cos(a) * 0.13, 0.33, Math.sin(a) * 0.13, M.blackMetal, 8);
    l.rotation.z = Math.cos(a) * 0.1;
    l.rotation.x = -Math.sin(a) * 0.1;
    g.add(l);
  }
  const ring = mesh(new THREE.TorusGeometry(0.15, 0.008, 6, 28), M.blackMetal);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  g.add(ring);
  return g;
}

function bed(M, w, len, { duvet = M.linen, throwMat = M.fabricTerra, head = M.fabricSofa, headH = 0.95 } = {}) {
  // headboard at local -z, foot toward +z
  const g = new THREE.Group();
  const z0 = -len / 2, z1 = len / 2;
  g.add(bx(-w / 2 - 0.04, 0.06, z0 + 0.06, w / 2 + 0.04, 0.32, z1 + 0.02, head, 0.04));
  g.add(bx(-w / 2 - 0.08, 0.06, z0, w / 2 + 0.08, headH, z0 + 0.09, head, 0.04));
  g.add(bx(-w / 2, 0.32, z0 + 0.1, w / 2, 0.55, z1, M.linen, 0.07));
  // duvet with soft fold
  const dv = bx(-w / 2 - 0.03, 0.5, z0 + 0.55, w / 2 + 0.03, 0.6, z1 + 0.03, duvet, 0.05);
  g.add(dv);
  g.add(bx(-w / 2 - 0.02, 0.58, z0 + 0.55, w / 2 + 0.02, 0.63, z0 + 0.8, duvet, 0.03));
  // throw blanket at the foot
  g.add(bx(-w / 2 - 0.035, 0.595, z1 - 0.55, w / 2 + 0.035, 0.625, z1 + 0.035, throwMat, 0.012));
  // pillows
  const np = w > 1.3 ? 2 : 1;
  for (let i = 0; i < np; i++) {
    const px = np === 1 ? 0 : (i - 0.5) * (w / 2);
    const p = cb(w / np - 0.12, 0.16, 0.42, px, 0.66, z0 + 0.36, M.linen, 0.07);
    p.rotation.x = -0.35;
    g.add(p);
    const p2 = cb(0.42, 0.36, 0.12, px, 0.72, z0 + 0.52, throwMat, 0.05);
    p2.rotation.x = -0.25;
    g.add(p2);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(cyl(0.02, 0.02, 0.06, sx * (w / 2 - 0.05), 0.03, sz * (len / 2 - 0.08), M.veneerDark, 8));
  }
  return g;
}

function nightstand(M, lights, lamp = true) {
  const g = new THREE.Group();
  g.add(bx(-0.24, 0.12, -0.2, 0.24, 0.52, 0.2, M.veneer, 0.01));
  g.add(bx(-0.22, 0.29, 0.199, 0.22, 0.31, 0.205, M.veneerDark));
  for (const sx of [-1, 1]) g.add(bx(sx * 0.2 - 0.012, 0, -0.16, sx * 0.2 + 0.012, 0.12, 0.16, M.blackMetal));
  if (lamp) {
    const l = tableLamp(M, lights);
    l.position.set(0.05, 0.52, -0.02);
    g.add(l);
  }
  return g;
}

function tableLamp(M, lights) {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.09, 0.2, 0, 0.1, 0, M.ceramic, 20));
  g.add(cyl(0.008, 0.008, 0.12, 0, 0.26, 0, M.brass, 8));
  const shade = cyl(0.1, 0.15, 0.18, 0, 0.38, 0, M.lampShade, 28);
  shade.castShadow = false;
  g.add(shade);
  const light = new THREE.PointLight(0xffc98a, 0, 3.5, 2);
  light.position.set(0, 0.36, 0);
  light.userData.night = 2.2;
  g.add(light);
  lights.push(light);
  return g;
}

function floorLamp(M, lights) {
  const g = new THREE.Group();
  g.add(cyl(0.16, 0.17, 0.025, 0, 0.012, 0, M.blackMetal, 24));
  g.add(cyl(0.012, 0.012, 1.45, 0, 0.75, 0, M.blackMetal, 8));
  const shade = cyl(0.18, 0.24, 0.32, 0, 1.55, 0, M.lampShade, 28);
  shade.castShadow = false;
  g.add(shade);
  const light = new THREE.PointLight(0xffc98a, 0, 5, 2);
  light.position.set(0, 1.5, 0);
  light.userData.night = 6;
  g.add(light);
  lights.push(light);
  return g;
}

function pendant(M, lights, drop, { r = 0.16, mat = M.blackMetal, light = true, intensity = 4 } = {}) {
  // hangs from y = 0 downward
  const g = new THREE.Group();
  g.add(cyl(0.004, 0.004, drop, 0, -drop / 2, 0, M.blackMetal, 6));
  const shade = mesh(new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  shade.material.side = THREE.DoubleSide;
  shade.position.y = -drop - 0.02;
  shade.scale.y = 0.7;
  g.add(shade);
  const bulb = mesh(new THREE.SphereGeometry(0.045, 16, 10), M.bulb, false);
  bulb.position.y = -drop - 0.06;
  g.add(bulb);
  if (light) {
    const l = new THREE.PointLight(0xffc98a, 0, 6, 2);
    l.position.y = -drop - 0.12;
    l.userData.night = intensity;
    g.add(l);
    lights.push(l);
  }
  return g;
}

function spot(M) {
  // recessed ceiling spot, faces down from y = 0
  const g = new THREE.Group();
  const ring = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.006, 20), M.white, false);
  ring.position.y = -0.003;
  const lens = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.007, 16), M.bulb, false);
  lens.position.y = -0.004;
  g.add(ring, lens);
  return g;
}

function wardrobe(M, w, h, d, doors, mat = M.cabinetWhite) {
  // front at +z
  const g = new THREE.Group();
  g.add(bx(-w / 2, 0, -d / 2, w / 2, h, d / 2 - 0.02, mat));
  const dw = w / doors;
  for (let i = 0; i < doors; i++) {
    const x0 = -w / 2 + i * dw + 0.002, x1 = -w / 2 + (i + 1) * dw - 0.002;
    g.add(bx(x0, 0.06, d / 2 - 0.02, x1, h - 0.005, d / 2, mat));
    const hx = i % 2 ? x0 + 0.04 : x1 - 0.04;
    g.add(bx(hx - 0.008, h / 2 - 0.25, d / 2, hx + 0.008, h / 2 + 0.25, d / 2 + 0.02, M.blackMetal));
  }
  g.add(bx(-w / 2, 0, d / 2 - 0.05, w / 2, 0.06, d / 2 - 0.02, M.blackMetal));
  return g;
}

function tvUnit(M, w, lights, screenTex) {
  // console + wall TV, front at +z, back against the wall at z = -0.21
  const g = new THREE.Group();
  g.add(bx(-w / 2, 0.12, -0.21, w / 2, 0.5, 0.21, M.veneer, 0.01));
  for (let i = 0; i < 4; i++) {
    const x0 = -w / 2 + (i * w) / 4 + 0.004;
    g.add(bx(x0, 0.14, 0.205, x0 + w / 4 - 0.008, 0.48, 0.215, M.veneerDark));
  }
  for (const sx of [-1, 1]) g.add(bx(sx * (w / 2 - 0.1) - 0.015, 0, -0.15, sx * (w / 2 - 0.1) + 0.015, 0.12, 0.15, M.blackMetal));
  // TV 65"
  g.add(bx(-0.73, 0.95, -0.2, 0.73, 1.78, -0.165, M.screen));
  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTex, emissiveMap: screenTex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.25,
  });
  const scr = mesh(new THREE.PlaneGeometry(1.42, 0.8), screenMat, false);
  scr.position.set(0, 1.365, -0.164);
  g.add(scr);
  g.userData.screen = screenMat;
  // soundbar + decor
  g.add(bx(-0.45, 0.5, -0.15, 0.45, 0.57, -0.05, M.screen, 0.02));
  g.add(cyl(0.06, 0.05, 0.22, w / 2 - 0.25, 0.61, 0.0, M.ceramic, 20));
  g.add(bx(-w / 2 + 0.15, 0.5, -0.1, -w / 2 + 0.45, 0.56, 0.12, M.fabricTerra, 0.01));
  return g;
}

function rug(M, w, d, mat) {
  const m = bx(-w / 2, 0.003, -d / 2, w / 2, 0.015, d / 2, mat, 0.004);
  m.castShadow = false;
  return m;
}

function painting(M, w, h, seed, palette) {
  // hangs on a wall, front facing +z, centre at origin
  const g = new THREE.Group();
  g.add(bx(-w / 2, -h / 2, -0.03, w / 2, h / 2, 0, M.blackMetal));
  const mat = new THREE.MeshStandardMaterial({ map: paintingTexture(seed, palette), roughness: 0.85 });
  const p = mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), mat, false);
  p.position.z = 0.002;
  g.add(p);
  return g;
}

function plant(M, kind = 'fig', scale = 1) {
  const g = new THREE.Group();
  const potH = 0.42 * scale;
  g.add(cyl(0.2 * scale, 0.15 * scale, potH, 0, potH / 2, 0, kind === 'olive' ? M.potGrey : M.pot, 24));
  g.add(cyl(0.185 * scale, 0.185 * scale, 0.02, 0, potH - 0.03, 0, M.soil, 20));
  if (kind === 'snake') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const blade = mesh(new THREE.ConeGeometry(0.035 * scale, (0.6 + (i % 3) * 0.18) * scale, 4), leafMat(M, 0x3f6b3a));
      blade.position.set(Math.cos(a) * 0.07 * scale, potH + 0.3 * scale, Math.sin(a) * 0.07 * scale);
      blade.rotation.set(Math.sin(a) * 0.15, a, Math.cos(a) * 0.15);
      blade.scale.z = 0.3;
      g.add(blade);
    }
    return g;
  }
  const trunkH = (kind === 'fig' ? 1.1 : 0.7) * scale;
  g.add(cyl(0.02 * scale, 0.03 * scale, trunkH, 0, potH + trunkH / 2, 0, M.bark, 8));
  const tone = kind === 'olive' ? 0x8f9a74 : kind === 'lemon' ? 0x4f7a3c : 0x3d6b33;
  const rnd = seeded(kind.length * 31 + Math.round(scale * 10));
  const top = potH + trunkH;
  const size = kind === 'fig' ? [0.13, 0.24] : kind === 'olive' ? [0.035, 0.1] : [0.06, 0.12];
  g.add(leafCanopy(M, {
    count: kind === 'fig' ? 70 : kind === 'olive' ? 420 : 260,
    radius: [0.3 * scale, 0.36 * scale, 0.3 * scale],
    center: [0, top + 0.05 * scale, 0],
    leaf: [size[0] * scale, size[1] * scale],
    color: tone,
    rnd,
  }));
  if (kind === 'lemon') {
    const fruitMat = new THREE.MeshStandardMaterial({ color: 0xf2d13a, roughness: 0.5 });
    for (let i = 0; i < 9; i++) {
      const f = mesh(new THREE.SphereGeometry(0.035 * scale, 10, 8), fruitMat);
      const a = rnd() * Math.PI * 2;
      f.position.set(Math.cos(a) * 0.22 * scale, potH + trunkH + (rnd() - 0.4) * 0.3 * scale, Math.sin(a) * 0.22 * scale);
      g.add(f);
    }
  }
  return g;
}

// Leaf-shaped card used for canopies (pointed ellipse, slightly cupped).
let leafGeo = null;
function getLeafGeo() {
  if (leafGeo) return leafGeo;
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.5);
  sh.quadraticCurveTo(0.55, -0.15, 0.0, 0.5);
  sh.quadraticCurveTo(-0.55, -0.15, 0, -0.5);
  leafGeo = new THREE.ShapeGeometry(sh, 6);
  const pos = leafGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, x * x * 0.6);
  }
  leafGeo.computeVertexNormals();
  return leafGeo;
}
let leafCardMat = null;

// Canopy of individual leaves (one instanced mesh) inside an ellipsoid.
export function leafCanopy(M, { count, radius, center, leaf, color, rnd = Math.random }) {
  if (!leafCardMat) leafCardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, side: THREE.DoubleSide });
  const im = new THREE.InstancedMesh(getLeafGeo(), leafCardMat, count);
  im.castShadow = true;
  im.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const base = new THREE.Color(color);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2;
    const rr = Math.pow(rnd(), 0.35);
    const sq = Math.sqrt(1 - u * u);
    p.set(center[0] + sq * Math.cos(th) * radius[0] * rr, center[1] + u * radius[1] * rr, center[2] + sq * Math.sin(th) * radius[2] * rr);
    e.set(rnd() * Math.PI * 2, th + Math.PI / 2, (rnd() - 0.5) * 1.2);
    q.setFromEuler(e);
    const k = 0.75 + rnd() * 0.5;
    sc.set(leaf[0] * k, leaf[1] * k, leaf[1] * k);
    m.compose(p, q, sc);
    im.setMatrixAt(i, m);
    c.copy(base).offsetHSL((rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.12 + u * 0.04);
    im.setColorAt(i, c);
  }
  im.computeBoundingSphere();
  return im;
}

const leafMats = new Map();
function leafMat(M, color) {
  if (!leafMats.has(color)) leafMats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  return leafMats.get(color);
}

export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// Noisy icosphere with per-vertex colour variation – foliage clump.
export function foliageBlob(M, r, color, rnd = Math.random, detail = 2) {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const base = new THREE.Color(color);
  const tmp = new THREE.Color();
  const seed = rnd() * 100;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = Math.sin(x * 17 + seed) * Math.cos(y * 13 + seed) * Math.sin(z * 19 + seed * 0.5);
    const k = 1 + n * 0.22 + (rnd() - 0.5) * 0.12;
    pos.setXYZ(i, x * k, y * k, z * k);
    tmp.copy(base).offsetHSL((rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * 0.12 + (y / r) * 0.06);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return mesh(geo, M.leaf);
}


// ---------------------------------------------------------------------------
// Kitchen: L-shaped run (sink on the party wall, induction on the north
// wall), tall oven tower, fridge niche, island joined to the dining table.
// ---------------------------------------------------------------------------
function kitchen(M, lights) {
  const g = new THREE.Group();
  const H = 0.9, top = 0.035, toe = 0.1;
  const run = (x0, z0, x1, z1, frontAxis, frontSign, mat = M.cabinetSage) => {
    // carcass + doors; front faces ±x or ±z
    g.add(bx(x0, 0, z0, x1, toe, z1, M.blackMetal));
    const inset = 0.03;
    const cx0 = frontAxis === 'x' && frontSign < 0 ? x0 + inset : x0;
    const cx1 = frontAxis === 'x' && frontSign > 0 ? x1 - inset : x1;
    const cz0 = frontAxis === 'z' && frontSign < 0 ? z0 + inset : z0;
    const cz1 = frontAxis === 'z' && frontSign > 0 ? z1 - inset : z1;
    g.add(bx(cx0, toe, cz0, cx1, H - top, cz1, mat));
    const len = frontAxis === 'x' ? z1 - z0 : x1 - x0;
    const n = Math.max(1, Math.round(len / 0.6));
    const dl = len / n;
    for (let i = 0; i < n; i++) {
      const a = (frontAxis === 'x' ? z0 : x0) + i * dl + 0.002;
      const b = a + dl - 0.004;
      const f = frontAxis === 'x' ? (frontSign > 0 ? x1 : x0) : (frontSign > 0 ? z1 : z0);
      const f0 = f - frontSign * 0.03, f1 = f - frontSign * 0.005;
      const lo = Math.min(f0, f1), hi = Math.max(f0, f1);
      const face = frontSign > 0 ? hi : lo;
      const h0 = Math.min(face, face + frontSign * 0.012), h1 = Math.max(face, face + frontSign * 0.012);
      if (frontAxis === 'x') {
        g.add(bx(lo, toe + 0.005, a, hi, H - top - 0.005, b, mat));
        g.add(bx(h0, H - top - 0.06, a + 0.05, h1, H - top - 0.045, b - 0.05, M.brass));
      } else {
        g.add(bx(a, toe + 0.005, lo, b, H - top - 0.005, hi, mat));
        g.add(bx(a + 0.05, H - top - 0.06, h0, b - 0.05, H - top - 0.045, h1, M.brass));
      }
    }
  };
  // west run along the party wall (sink), front faces +x
  run(0.1, 4.55, 0.7, 7.2, 'x', 1);
  // corner + north run along the bedroom wall (induction), front faces +z
  run(0.1, 3.726, 0.7, 4.55, 'z', 1);
  run(0.7, 3.925, 2.99, 4.525, 'z', 1);
  g.add(bx(0.7, 0, 3.726, 1.047, H - top, 3.925, M.cabinetSage));
  // quartz worktops
  g.add(bx(0.1, H - top, 3.726, 0.72, H, 7.2, M.quartz));
  g.add(bx(0.72, H - top, 3.726, 1.047, H, 4.545, M.quartz));
  g.add(bx(1.047, H - top, 3.925, 2.99, H, 4.545, M.quartz));
  // induction hob + chimney hood
  g.add(bx(1.0, H, 4.0, 1.75, H + 0.006, 4.48, M.screen));
  for (const [x, z] of [[1.17, 4.12], [1.58, 4.12], [1.17, 4.36], [1.58, 4.36]]) {
    g.add(cyl(0.07, 0.07, 0.002, x, H + 0.008, z, M.steelGrey, 24));
  }
  g.add(bx(1.0, 1.6, 3.925, 1.75, 1.7, 4.42, M.steelGrey));
  g.add(bx(1.2, 1.7, 3.925, 1.55, LEVELS.groundCeiling, 4.2, M.steelGrey));
  // sink + faucet in the west run
  g.add(bx(0.22, H, 5.66, 0.6, H + 0.003, 6.2, M.blackMetal));
  g.add(cyl(0.015, 0.018, 0.32, 0.16, 1.06, 5.93, M.brass, 10));
  const spout = cyl(0.012, 0.012, 0.18, 0.24, 1.21, 5.93, M.brass, 10);
  spout.rotation.z = Math.PI / 2;
  g.add(spout);
  // tall oven / microwave tower at the end of the north run (front at z 4.525)
  g.add(bx(2.99, 0, 3.925, 3.446, 2.35, 4.525, M.cabinetSage));
  g.add(bx(3.01, 0.75, 4.525, 3.426, 1.32, 4.54, M.screen));
  g.add(bx(3.01, 1.38, 4.525, 3.426, 1.72, 4.54, M.screen));
  g.add(bx(3.03, 1.25, 4.54, 3.406, 1.265, 4.55, M.steelGrey));
  // fridge in its niche
  g.add(bx(3.58, 0, 3.75, 4.47, 1.95, 4.45, M.steelGrey, 0.01));
  g.add(bx(4.023, 0.05, 4.45, 4.027, 1.93, 4.452, M.blackMetal));
  g.add(bx(3.97, 0.9, 4.452, 3.99, 1.5, 4.47, M.blackMetal));
  g.add(bx(4.06, 0.9, 4.452, 4.08, 1.5, 4.47, M.blackMetal));
  g.add(bx(3.56, 1.97, 3.73, 4.49, 2.4, 4.45, M.cabinetWhite));
  // upper cabinets on the party wall and over the north run, open oak shelf
  g.add(bx(0.1, 1.5, 4.6, 0.45, 2.3, 5.55, M.cabinetWhite));
  g.add(bx(0.1, 1.5, 6.35, 0.45, 2.3, 7.2, M.cabinetWhite));
  for (const [z0, z1] of [[4.6, 5.075], [5.075, 5.55], [6.35, 6.775], [6.775, 7.2]]) {
    g.add(bx(0.45, 1.505, z0 + 0.002, 0.455, 2.295, z1 - 0.002, M.cabinetWhite));
  }
  g.add(bx(0.1, 1.62, 5.6, 0.36, 1.65, 6.3, M.veneer));
  g.add(bx(1.9, 1.5, 3.925, 2.99, 2.3, 4.26, M.cabinetWhite));
  for (let x = 1.9; x < 2.98; x += 0.545) g.add(bx(x + 0.002, 1.505, 4.26, x + 0.543, 2.295, 4.265, M.cabinetWhite));
  // tile backsplash
  g.add(bx(0.1, H, 4.55, 0.11, 1.5, 7.2, M.zellige));
  g.add(bx(0.72, H, 3.925, 2.99, 1.5, 3.935, M.zellige));
  // island joined to the dining table
  const ix0 = 1.8, ix1 = 2.8, iz0 = 5.71, iz1 = 6.93;
  g.add(bx(ix0 + 0.05, 0, iz0 + 0.05, ix1 - 0.05, toe, iz1 - 0.05, M.blackMetal));
  g.add(bx(ix0 + 0.03, toe, iz0 + 0.03, ix1 - 0.02, H - top, iz1 - 0.03, M.cabinetSage));
  for (let i = 0; i < 2; i++) {
    const z0 = iz0 + 0.04 + i * 0.57;
    g.add(bx(ix0 + 0.01, toe + 0.005, z0, ix0 + 0.03, H - top - 0.005, z0 + 0.56, M.cabinetSage));
    g.add(bx(ix0, H - top - 0.06, z0 + 0.08, ix0 + 0.012, H - top - 0.045, z0 + 0.48, M.brass));
  }
  g.add(bx(ix0, H - top, iz0, ix1, H, iz1, M.quartz));
  g.add(bx(ix1 - 0.03, 0, iz0, ix1, H - top, iz1, M.quartz)); // waterfall end
  // dining table (oak) with five chairs
  const tx0 = 2.8, tx1 = 3.85, tz0 = 5.87, tz1 = 6.77;
  g.add(bx(tx0, 0.72, tz0, tx1, 0.76, tz1, M.veneer, 0.008));
  for (const x of [tx1 - 0.08]) for (const z of [tz0 + 0.06, tz1 - 0.1]) g.add(bx(x - 0.02, 0, z, x + 0.02, 0.72, z + 0.04, M.blackMetal));
  const seat = (x, z, rot) => { const c = chair(M, M.fabricSand); c.position.set(x, 0, z); c.rotation.y = rot; g.add(c); };
  seat(2.93, 5.62, 0); seat(3.49, 5.62, 0);
  seat(2.93, 7.02, Math.PI); seat(3.49, 7.02, Math.PI);
  seat(4.1, 6.32, -Math.PI / 2);
  // fruit bowl, herbs, vase
  g.add(cyl(0.13, 0.09, 0.08, 3.3, 0.8, 6.32, M.ceramic, 24));
  for (let i = 0; i < 5; i++) {
    const f = mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xe8a33c : 0x9cbf3a, roughness: 0.5 }));
    f.position.set(3.27 + (i % 3) * 0.04, 0.85 + Math.floor(i / 3) * 0.03, 6.3 + (i % 2) * 0.05);
    g.add(f);
  }
  const herbs = plant(M, 'lemon', 0.35);
  herbs.position.set(0.4, H, 4.3);
  g.add(herbs);
  g.add(cyl(0.05, 0.07, 0.24, 2.3, H + 0.12, 6.1, M.pot, 16));
  // pendants over the island and table
  for (const x of [2.05, 2.6, 3.33]) {
    const p = pendant(M, lights, 1.0, { r: 0.13, mat: M.brass, intensity: 3 });
    p.position.set(x, LEVELS.groundCeiling, 6.32);
    g.add(p);
  }
  // linear LED profiles drawn on the plan
  const led = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffd9a0, emissiveIntensity: 0 });
  led.userData.emissiveNight = 1.6;
  g.add(bx(1.71, LEVELS.groundCeiling - 0.012, 5.085, 3.49, LEVELS.groundCeiling - 0.002, 5.115, led));
  g.add(bx(1.235, LEVELS.groundCeiling - 0.012, 5.1, 1.265, LEVELS.groundCeiling - 0.002, 6.7, led));
  g.userData.glow = [led];
  return g;
}

// ---------------------------------------------------------------------------
// Bathrooms
// ---------------------------------------------------------------------------
function toilet(M) {
  // wall-hung, back at local z = 0, bowl toward +z
  const g = new THREE.Group();
  const bowl = mesh(new THREE.SphereGeometry(0.2, 28, 18), M.ceramic);
  bowl.scale.set(0.9, 0.8, 1.35);
  bowl.position.set(0, 0.32, 0.27);
  g.add(bowl);
  g.add(bx(-0.17, 0.3, 0.02, 0.17, 0.42, 0.3, M.ceramic, 0.06));
  const seat = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.025, 28), M.ceramic);
  seat.scale.set(1, 1, 1.3);
  seat.position.set(0, 0.425, 0.27);
  g.add(seat);
  return g;
}

function vanity(M, w, { mirror = true } = {}) {
  // back at local z = 0, front toward +z
  const g = new THREE.Group();
  g.add(bx(-w / 2, 0.45, 0, w / 2, 0.82, 0.46, M.veneer, 0.01));
  g.add(bx(-w / 2, 0.82, 0, w / 2, 0.85, 0.48, M.quartz));
  const basin = mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.12, 32), M.ceramic);
  basin.position.set(0, 0.91, 0.25);
  g.add(basin);
  g.add(cyl(0.012, 0.014, 0.25, 0, 0.97, 0.06, M.blackMetal, 10));
  const sp = cyl(0.01, 0.01, 0.12, 0, 1.08, 0.11, M.blackMetal, 10);
  sp.rotation.x = Math.PI / 2;
  g.add(sp);
  if (mirror) {
    const m = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.02, 48), M.chrome);
    m.rotation.x = Math.PI / 2;
    m.position.set(0, 1.55, 0.015);
    g.add(m);
    const rim = mesh(new THREE.TorusGeometry(0.345, 0.012, 8, 48), M.brass);
    rim.position.set(0, 1.55, 0.025);
    g.add(rim);
  }
  return g;
}

function washer(M, door = true) {
  const g = new THREE.Group();
  g.add(bx(-0.3, 0, -0.3, 0.3, 0.85, 0.3, M.white, 0.02));
  if (door) {
    const ring = mesh(new THREE.TorusGeometry(0.17, 0.03, 10, 32), M.steelGrey);
    ring.position.set(0, 0.42, 0.305);
    g.add(ring);
    const glass = mesh(new THREE.CircleGeometry(0.15, 32), M.screen);
    glass.position.set(0, 0.42, 0.302);
    g.add(glass);
  }
  g.add(bx(-0.28, 0.74, 0.3, 0.1, 0.82, 0.305, M.steelGrey));
  return g;
}


// Walk-in shower: tray, glass panels [x0, z0, x1, z1], rain head at [x, z].
function showerBox(M, tray, panels, headPos, level) {
  const g = new THREE.Group();
  const [x0, z0, x1, z1] = tray;
  g.add(bx(x0 + 0.02, level + 0.004, z0 + 0.02, x1 - 0.02, level + 0.008, z1 - 0.02, M.bathTile));
  for (const [a, b, c, d] of panels) {
    const gl = bx(a, level + 0.01, b, c, level + 2.0, d, M.showerGlass);
    gl.castShadow = false;
    g.add(gl);
    g.add(bx(a - 0.006, level + 2.0, b - 0.006, c + 0.006, level + 2.02, d + 0.006, M.blackMetal));
  }
  const [hx, hz] = headPos;
  g.add(cyl(0.12, 0.12, 0.01, hx, level + 2.15, hz, M.blackMetal, 32));
  g.add(cyl(0.01, 0.01, 0.35, hx, level + 2.3, hz, M.blackMetal, 8));
  // linear drain
  g.add(bx((x0 + x1) / 2 - 0.3, level + 0.009, z1 - 0.14, (x0 + x1) / 2 + 0.3, level + 0.011, z1 - 0.1, M.steelGrey));
  return g;
}

function bathtub(M, x0, z0, x1, z1, level) {
  const g = new THREE.Group();
  const h = 0.55, rim = 0.07;
  g.add(bx(x0, level, z0, x1, level + h - 0.03, z1, M.bathWall));
  g.add(bx(x0, level + h - 0.03, z0, x1, level + h, z0 + rim, M.ceramic));
  g.add(bx(x0, level + h - 0.03, z1 - rim, x1, level + h, z1, M.ceramic));
  g.add(bx(x0, level + h - 0.03, z0 + rim, x0 + rim, level + h, z1 - rim, M.ceramic));
  g.add(bx(x1 - rim, level + h - 0.03, z0 + rim, x1, level + h, z1 - rim, M.ceramic));
  g.add(bx(x0 + rim, level + 0.18, z0 + rim, x1 - rim, level + h - 0.02, z1 - rim, M.ceramic, 0.06));
  const water = bx(x0 + rim + 0.01, level + h - 0.12, z0 + rim + 0.01, x1 - rim - 0.01, level + h - 0.115, z1 - rim - 0.01, M.water);
  water.castShadow = false;
  g.add(water);
  // spout + mixer on the end wall
  const sp = cyl(0.014, 0.014, 0.16, (x0 + x1) / 2, level + h + 0.18, z0 + 0.08, M.chrome, 10);
  sp.rotation.x = Math.PI / 2;
  g.add(sp);
  g.add(cyl(0.03, 0.03, 0.05, (x0 + x1) / 2 + 0.15, level + h + 0.25, z0 + 0.025, M.chrome, 12).rotateX(Math.PI / 2));
  return g;
}

function desk(M, w, d, { top = M.veneer, side = M.cabinetWhite } = {}) {
  // back edge at local -z, user side toward +z
  const g = new THREE.Group();
  g.add(bx(-w / 2, 0.72, -d / 2, w / 2, 0.75, d / 2, top, 0.006));
  g.add(bx(-w / 2, 0, -d / 2 + 0.02, -w / 2 + 0.42, 0.72, d / 2, side));
  for (let i = 0; i < 3; i++) g.add(bx(-w / 2 + 0.03, 0.05 + i * 0.22, d / 2, -w / 2 + 0.39, 0.24 + i * 0.22, d / 2 + 0.01, side));
  for (let i = 0; i < 3; i++) g.add(bx(-w / 2 + 0.17, 0.14 + i * 0.22, d / 2 + 0.01, -w / 2 + 0.25, 0.155 + i * 0.22, d / 2 + 0.02, M.brass));
  g.add(bx(w / 2 - 0.04, 0, -d / 2 + 0.03, w / 2 - 0.01, 0.72, d / 2 - 0.03, M.blackMetal));
  return g;
}

function deskChair(M, mat) {
  const ch = new THREE.Group();
  ch.add(cyl(0.24, 0.24, 0.03, 0, 0.03, 0, M.blackMetal, 5));
  ch.add(cyl(0.025, 0.025, 0.4, 0, 0.23, 0, M.chrome, 8));
  ch.add(bx(-0.23, 0.43, -0.22, 0.23, 0.5, 0.22, mat, 0.04));
  ch.add(bx(-0.21, 0.52, -0.24, 0.21, 0.95, -0.17, mat, 0.05));
  return ch;
}

function laptop(M) {
  const lap = new THREE.Group();
  lap.add(bx(-0.17, 0, -0.12, 0.17, 0.015, 0.12, M.steelGrey));
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, emissive: 0x4a7ad0, emissiveIntensity: 0.5, roughness: 0.2 });
  const scr = bx(-0.17, 0, -0.008, 0.17, 0.23, 0.008, screenMat);
  scr.position.set(0, 0.125, -0.13);
  scr.rotation.x = -0.25;
  lap.add(scr);
  return lap;
}

function deskLamp(M, lights, shadeMat) {
  const lamp = new THREE.Group();
  lamp.add(cyl(0.07, 0.08, 0.02, 0, 0.01, 0, M.blackMetal, 16));
  const arm = cyl(0.01, 0.01, 0.42, 0, 0.22, 0, M.blackMetal, 6);
  arm.rotation.z = 0.25;
  lamp.add(arm);
  const head = mesh(new THREE.ConeGeometry(0.07, 0.12, 16, 1, true), shadeMat);
  head.position.set(-0.1, 0.42, 0);
  head.rotation.z = 0.9;
  lamp.add(head);
  const dl = new THREE.PointLight(0xffd59a, 0, 2.5, 2);
  dl.position.set(-0.16, 0.36, 0);
  dl.userData.night = 1.5;
  lamp.add(dl);
  lights.push(dl);
  return lamp;
}

function books(M, n, seed) {
  const g = new THREE.Group();
  const rnd = seeded(seed);
  const cols = [M.fabricTerra, M.fabricGreen, M.fabricNavy, M.fabricMustard, M.fabricBlush, M.linen];
  let x = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.025 + rnd() * 0.025, h = 0.18 + rnd() * 0.08;
    g.add(bx(x, 0, -0.09, x + w, h, 0.09, cols[i % cols.length]));
    x += w + 0.003;
  }
  return g;
}

function shelf(M, w, books1, seed) {
  // wall shelf, back at local z = 0, front toward +z
  const g = new THREE.Group();
  g.add(bx(-w / 2, 0, 0, w / 2, 0.025, 0.22, M.veneer));
  if (books1) {
    const b = books(M, books1, seed);
    b.position.set(-w / 2 + 0.06, 0.025, 0.11);
    g.add(b);
  }
  return g;
}

function dresser(M, w, d, h, mat = M.veneer) {
  // back at local -z, drawers toward +z
  const g = new THREE.Group();
  g.add(bx(-w / 2, 0.12, -d / 2, w / 2, h, d / 2, mat, 0.01));
  for (let r = 0; r < 3; r++) {
    const y0 = 0.16 + r * ((h - 0.18) / 3);
    g.add(bx(-w / 2 + 0.02, y0, d / 2, w / 2 - 0.02, y0 + (h - 0.18) / 3 - 0.02, d / 2 + 0.01, mat));
    g.add(bx(-0.08, y0 + 0.08, d / 2 + 0.01, 0.08, y0 + 0.095, d / 2 + 0.025, M.brass));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.015, 0.012, 0.12, sx * (w / 2 - 0.05), 0.06, sz * (d / 2 - 0.05), M.blackMetal, 8));
  return g;
}

function acUnit(M) {
  // wall-mounted split unit, back at local z = 0
  const g = new THREE.Group();
  g.add(bx(-0.42, 0, 0, 0.42, 0.29, 0.21, M.white, 0.03));
  g.add(bx(-0.38, 0.03, 0.21, 0.38, 0.06, 0.215, M.steelGrey));
  return g;
}

// ---------------------------------------------------------------------------
// Public: furnish every room. Returns light list (for night mode) and TV.
// Layouts follow the furniture sketched on the electrical plan.
// ---------------------------------------------------------------------------
export function furnish(M, groups) {
  const lights = [];
  const glow = [];
  const G = new THREE.Group();
  const U = new THREE.Group();
  // Wrap so pieces built in absolute or local coordinates both place correctly.
  const add = (parent, obj, x, y, z, rot = 0) => {
    const holder = new THREE.Group();
    holder.add(obj);
    holder.position.set(x, y, z);
    holder.rotation.y = rot;
    parent.add(holder);
    return obj;
  };
  const abs = (parent, obj) => { parent.add(obj); return obj; };
  const gc = LEVELS.groundCeiling, uc = LEVELS.upperCeiling;
  const up = LEVELS.upper;

  // ======================= GROUND FLOOR =======================
  // Living room: sofa facing the TV wall, loveseat on the party wall
  add(G, rug(M, 3.0, 2.3, M.rugLiving), 2.3, 0, 9.85);
  add(G, sofa(M, 2.35, 0.95, {
    cushions: [{ x: -0.7, mat: M.fabricTerra }, { x: 0.05, mat: M.fabricMustard }, { x: 0.75, mat: M.fabricGreen }],
  }), 2.3, 0, 8.68, FACE.south);
  add(G, sofa(M, 1.62, 0.9, { mat: M.fabricGreen, cushions: [{ x: -0.35, mat: M.fabricBlush }, { x: 0.35, mat: M.fabricSand }] }), 0.56, 0, 9.76, FACE.east);
  add(G, table(M, 1.2, 0.7, 0.38, { top: M.veneer, legs: M.veneerDark }), 2.3, 0, 9.85);
  add(G, cyl(0.09, 0.07, 0.14, 0, 0, 0, M.ceramic), 2.1, 0.45, 9.75);
  add(G, bx(-0.18, 0, -0.13, 0.18, 0.06, 0.13, M.fabricNavy), 2.55, 0.38, 9.95);
  const screenTex = welcomeScreenTexture(['ברוכים הבאים הביתה', 'שירן וינון ♥']);
  const tv = add(G, tvUnit(M, 2.0, lights, screenTex), 2.15, 0, 11.59, FACE.north);
  add(G, armchair(M, M.fabricMustard), 4.3, 0, 10.2, FACE.west + 0.35);
  add(G, floorLamp(M, lights), 4.55, 0, 9.5);
  add(G, plant(M, 'fig', 1.1), 5.12, 0, 11.45);
  add(G, plant(M, 'snake', 0.9), 0.42, 0, 11.4);
  add(G, painting(M, 1.3, 0.75, 7, ['#efe6d6', '#c4734a', '#7c8560', '#d9b26a', '#33415c']), 0.103, 1.65, 9.76, FACE.east);
  add(G, pendant(M, lights, 0.75, { r: 0.32, mat: M.lampShade, intensity: 8 }), 2.25, gc, 9.75);
  for (const [x, z] of [[4.2, 9.64], [4.2, 8.0], [1.0, 8.0]]) add(G, spot(M), x, gc, z);
  // electrical niche closed with a white cabinet facing the living room
  abs(G, bx(4.99, 0, 7.607, 5.39, 2.25, 8.453, M.cabinetWhite));
  abs(G, bx(4.975, 0.04, 7.612, 4.99, 2.24, 8.028, M.cabinetWhite));
  abs(G, bx(4.975, 0.04, 8.032, 4.99, 2.24, 8.448, M.cabinetWhite));
  abs(G, bx(4.962, 1.0, 7.98, 4.975, 1.3, 7.995, M.brass));
  abs(G, bx(4.962, 1.0, 8.065, 4.975, 1.3, 8.08, M.brass));

  // Kitchen + dining
  const k = kitchen(M, lights);
  glow.push(...k.userData.glow);
  G.add(k);

  // Entrance
  abs(G, bx(5.55, 0.003, 6.35, 6.0, 0.007, 7.15, M.fabricNavy));
  add(G, plant(M, 'fig', 0.95), 4.75, 0, 7.22);
  for (const [x, z] of [[5.3, 5.3], [5.3, 6.6], [5.8, 7.1]]) add(G, spot(M), x, gc, z);
  // coat closet, doors facing the hall
  add(G, wardrobe(M, 0.98, 2.4, 0.58, 2), 4.895, 0, 4.2245, FACE.east);

  // Corridor: laundry niche + manifold closet
  add(G, washer(M), 4.98, 0, 2.25);
  add(G, washer(M), 5.6, 0, 2.25);
  abs(G, bx(4.672, 0.88, 1.852, 5.898, 0.92, 2.6, M.veneer));
  abs(G, bx(4.672, 1.55, 1.852, 5.898, 2.3, 2.2, M.cabinetWhite));
  abs(G, bx(5.9, 0, 2.306, 7.397, 2.3, 2.6, M.cabinetWhite));
  for (let x = 5.9; x < 7.39; x += 0.5) abs(G, bx(x + 0.003, 0.02, 2.6, x + 0.497, 2.29, 2.61, M.cabinetWhite));
  // art on the WC's north wall, clear of the safe-room door
  add(G, painting(M, 0.6, 0.8, 12, ['#f3ece2', '#7c8560', '#c4734a', '#e8c37d']), 6.75, 1.5, 3.52, FACE.north);
  for (const [x, z] of [[5.3, 3.05], [6.6, 3.05]]) add(G, spot(M), x, gc, z);

  // Bedroom (double bed against the west wall, wardrobe along the south wall)
  add(G, rug(M, 2.4, 2.3, M.rugMaster), 2.55, 0, 1.645);
  add(G, bed(M, 1.6, 2.0, { throwMat: M.fabricBlush, head: M.fabricSand, headH: 1.0 }), 2.32, 0, 1.645, FACE.east);
  add(G, nightstand(M, lights), 1.53, 0, 0.5, FACE.east);
  add(G, nightstand(M, lights), 1.53, 0, 2.79, FACE.east);
  add(G, painting(M, 1.2, 0.6, 21, ['#f3ece2', '#d9a89a', '#7c8560', '#c9a46a', '#3c4a63']), 1.306, 1.6, 1.645, FACE.east);
  add(G, wardrobe(M, 2.1, 2.5, 0.6, 4), 2.37, 0, 3.523, FACE.north);
  add(G, dresser(M, 1.0, 0.45, 0.8), 4.27, 0, 1.9, FACE.west);
  const mir = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.015, 40), M.chrome);
  mir.rotation.z = Math.PI / 2;
  add(G, mir, 4.488, 1.5, 1.9);
  add(G, cyl(0.06, 0.05, 0.2, 0, 0, 0, M.pot), 4.3, 0.9, 1.6);
  add(G, armchair(M, M.fabricGreen), 3.95, 0, 0.8, FACE.south - 0.6);
  add(G, pendant(M, lights, 0.5, { r: 0.28, mat: M.lampShade, intensity: 5 }), 2.75, gc, 1.7);
  add(G, acUnit(M), 4.49, 2.35, 1.7, FACE.west);

  // Bathroom (en-suite): vanity, walk-in shower, toilet
  add(G, vanity(M, 1.2), 5.25, 0, 1.751, FACE.north);
  G.add(showerBox(M, [6.003, 1.05, 7.397, 2.152], [[6.03, 1.04, 6.85, 1.05], [6.003, 1.05, 6.013, 1.751]], [6.8, 1.75], 0));
  add(G, toilet(M), 6.93, 0, 0.203, FACE.south);
  abs(G, bx(4.62, 1.15, 0.6, 4.65, 1.17, 1.0, M.chrome));
  for (const x of [5.2, 6.6]) add(G, spot(M), x, gc, 0.9);

  // Guest WC (tiled wainscot; the paint above runs on beside flight 2)
  abs(G, bx(6.347, 0, 3.726, 8.296, 1.2, 3.738, M.bathWall));
  abs(G, bx(6.347, 0, 4.711, 8.296, 1.2, 4.723, M.bathWall));
  abs(G, bx(8.284, 0, 3.738, 8.296, 1.2, 4.711, M.bathWall));
  abs(G, bx(6.347, 1.2, 3.726, 8.296, 1.215, 3.75, M.quartz));
  add(G, toilet(M), 8.296, 0, 4.22, FACE.west);
  add(G, vanity(M, 0.45), 7.25, 0, 4.723, FACE.north);
  add(G, spot(M), 6.9, gc, 4.2);

  // Technical space: boiler and manifolds
  abs(G, bx(9.2, 1.0, 3.726, 9.7, 1.7, 4.05, M.white));
  abs(G, cyl(0.05, 0.05, 0.4, 9.45, 1.9, 3.88, M.steelGrey));
  abs(G, bx(8.75, 0.4, 5.6, 9.8, 0.9, 5.724, M.steelGrey));

  // Safe room (ממ"ד): study with a day bed
  add(G, rug(M, 1.8, 1.4, M.rugPlay), 8.95, 0, 1.6);
  add(G, bed(M, 0.95, 2.0, { throwMat: M.fabricNavy, head: M.fabricGreen, headH: 0.9 }), 10.2, 0, 1.42, FACE.south);
  add(G, nightstand(M, lights), 9.42, 0, 0.6, FACE.south);
  add(G, desk(M, 1.6, 0.62), 7.92, 0, 1.3, FACE.east);
  add(G, deskChair(M, M.fabricTerra), 8.6, 0, 1.15, FACE.west);
  add(G, bx(-0.3, 0, -0.02, 0.3, 0.36, 0.02, M.screen), 7.72, 0.82, 1.15, FACE.east);
  add(G, bx(-0.22, 0, -0.08, 0.22, 0.02, 0.08, M.steelGrey), 8.0, 0.75, 1.15, FACE.east);
  add(G, deskLamp(M, lights, M.fabricMustard), 7.78, 0.75, 1.85, FACE.east);
  add(G, wardrobe(M, 2.0, 2.3, 0.6, 3), 9.7, 0, 3.223, FACE.north);
  add(G, painting(M, 0.8, 0.55, 44, ['#e9e4dc', '#7c8560', '#d9b26a', '#33415c']), 7.607, 1.65, 1.0, FACE.east);
  add(G, shelf(M, 0.9, 9, 4), 7.604, 1.25, 2.0, FACE.east);
  abs(G, bx(7.85, 1.95, 0.304, 8.4, 2.4, 0.5, M.white)); // filter-ventilation unit
  add(G, pendant(M, lights, 0.45, { r: 0.22, mat: M.lampShade, intensity: 4 }), 9.0, gc, 1.7);

  // ======================= UPPER FLOOR =======================
  // West bedroom: bed under the window, wardrobe on the east wall, desk on the south wall
  add(U, rug(M, 1.7, 1.2, M.rugSage), 2.7, up, 2.05);
  add(U, bed(M, 0.9, 2.0, { throwMat: M.fabricBlush, head: M.fabricSand, headH: 0.85 }), 2.32, up, 1.05, FACE.east);
  add(U, nightstand(M, lights), 1.52, up, 1.85, FACE.east);
  add(U, wardrobe(M, 1.75, 2.4, 0.6, 3), 4.195, up, 1.4, FACE.west);
  add(U, desk(M, 1.4, 0.65), 2.0, up, 3.19, FACE.north);
  add(U, deskChair(M, M.fabricBlush), 2.05, up, 2.6, FACE.south);
  add(U, laptop(M), 2.15, up + 0.75, 3.12, FACE.north);
  add(U, deskLamp(M, lights, M.fabricBlush), 1.5, up + 0.75, 3.3, FACE.north);
  add(U, shelf(M, 1.2, 14, 21), 2.0, up + 1.4, 3.519, FACE.north);
  add(U, painting(M, 0.7, 0.9, 61, ['#f6efe0', '#d9a89a', '#7c8560', '#e8c37d']), 1.301, up + 1.55, 2.4, FACE.east);
  add(U, plant(M, 'snake', 0.75), 3.45, up, 3.25);
  add(U, pendant(M, lights, 0.5, { r: 0.26, mat: M.lampShade, intensity: 5 }), 2.9, uc, 2.0);
  add(U, acUnit(M), 3.4, up + 2.25, 3.519, FACE.north);

  // East bedroom: bed along the north wall, wardrobe on the west wall, desk in the south-east
  add(U, rug(M, 1.8, 1.3, M.rugPlay), 9.0, up, 2.0);
  add(U, bed(M, 0.95, 2.0, { duvet: M.fabricNavySoft, throwMat: M.fabricMustard, head: M.fabricNavy, headH: 0.85 }), 9.74, up, 0.73, FACE.west);
  add(U, nightstand(M, lights), 10.5, up, 1.55, FACE.west);
  add(U, wardrobe(M, 1.75, 2.4, 0.6, 3), 7.7, up, 1.1, FACE.east);
  add(U, desk(M, 1.4, 0.65), 10.07, up, 3.19, FACE.north);
  add(U, deskChair(M, M.fabricNavy), 10.05, up, 2.6, FACE.south);
  add(U, laptop(M), 9.95, up + 0.75, 3.12, FACE.north);
  add(U, deskLamp(M, lights, M.fabricMustard), 10.55, up + 0.75, 3.3, FACE.north);
  add(U, shelf(M, 1.2, 13, 33), 10.07, up + 1.4, 3.519, FACE.north);
  add(U, painting(M, 0.9, 0.6, 72, ['#eef1f3', '#3c4a63', '#cf9f45', '#5fa8d3', '#c0714f']), 8.9, up + 1.6, 3.516, FACE.north);
  const bag = mesh(new THREE.SphereGeometry(0.34, 24, 16), M.fabricMustard);
  bag.scale.set(1, 0.62, 1);
  add(U, bag, 8.15, up + 0.21, 2.75);
  add(U, pendant(M, lights, 0.5, { r: 0.26, mat: M.lampShade, intensity: 5 }), 9.0, uc, 1.9);
  add(U, acUnit(M), 8.3, up + 2.25, 3.519, FACE.north);

  // Upper bathroom: bathtub on the west wall, wall-hung toilet, vanity on the east wall
  U.add(bathtub(M, 4.601, 0.25, 5.33, 1.95, up));
  abs(U, bx(5.45, up, 0.203, 6.25, up + 1.2, 0.4, M.bathWall));
  abs(U, bx(5.43, up + 1.2, 0.203, 6.27, up + 1.23, 0.42, M.quartz));
  add(U, toilet(M), 5.85, up, 0.4, FACE.south);
  add(U, vanity(M, 0.8), 7.295, up, 0.95, FACE.west);
  abs(U, bx(6.8, up, 1.5, 7.295, up + 2.1, 2.37, M.cabinetWhite));
  abs(U, bx(6.79, up + 0.95, 1.92, 6.8, up + 1.25, 1.94, M.brass));
  for (const [x, z] of [[5.6, 1.2], [6.5, 1.8]]) add(U, spot(M), x, uc, z);

  // Upper hall: reading corner in the south-west, console on the south wall,
  // the way from the stairs to the roof door left clear
  add(U, rug(M, 1.4, 1.0, M.rugLiving), 5.75, up, 4.95);
  add(U, armchair(M, M.fabricTerra), 4.98, up, 5.32, FACE.north + 0.75);
  add(U, floorLamp(M, lights), 4.78, up, 5.58);
  add(U, bx(-0.5, 0.6, -0.17, 0.5, 0.64, 0.17, M.veneer), 6.25, up, 5.53);
  add(U, bx(-0.46, 0, -0.14, -0.42, 0.6, 0.14, M.blackMetal), 6.25, up, 5.53);
  add(U, bx(0.42, 0, -0.14, 0.46, 0.6, 0.14, M.blackMetal), 6.25, up, 5.53);
  add(U, books(M, 9, 9), 5.9, up + 0.64, 5.53);
  add(U, cyl(0.07, 0.05, 0.25, 0, 0, 0, M.ceramic), 6.55, up + 0.765, 5.53);
  add(U, painting(M, 1.0, 0.7, 88, ['#efe6d6', '#33415c', '#c4734a', '#e8c37d', '#7c8560']), 6.25, up + 1.55, 5.716, FACE.north);
  add(U, plant(M, 'fig', 0.85), 4.85, up, 3.65);
  for (const [x, z] of [[5.6, 3.0], [6.7, 3.0], [5.6, 4.4]]) add(U, spot(M), x, uc, z);
  // electrical panel (40x30) on the hall's west wall
  abs(U, bx(4.601, up + 1.5, 5.1, 4.62, up + 1.9, 5.4, M.white));

  groups.ground.add(G);
  groups.upper.add(U);
  return { lights, tv: tv.userData.screen, glow };
}

// ---------------------------------------------------------------------------
// Roof equipment: AC condensers on the upper roof; the solar water heater
// sits where the plan prepares hot/cold water and power on the lower roof.
// ---------------------------------------------------------------------------
export function roofEquipment(M, groups) {
  const g = new THREE.Group();
  const y = LEVELS.roof;
  for (const [x, z] of [[5.3, 1.2], [5.3, 2.3], [9.4, 4.6]]) {
    g.add(bx(x - 0.15, y, z - 0.42, x + 0.15, y + 0.6, z + 0.42, M.white, 0.02));
    const fan = mesh(new THREE.CircleGeometry(0.22, 24), M.blackMetal);
    fan.position.set(x + 0.152, y + 0.3, z);
    fan.rotation.y = Math.PI / 2;
    g.add(fan);
  }
  groups.roof.add(g);

  const s = new THREE.Group();
  const t = LEVELS.upper;
  // tank on its stand
  for (const x of [2.2, 3.0]) s.add(bx(x - 0.03, t, 3.85, x + 0.03, t + 0.45, 4.45, M.frame));
  const tank = cyl(0.3, 0.3, 1.2, 2.6, t + 0.75, 4.15, M.white, 32);
  tank.rotation.z = Math.PI / 2;
  s.add(tank);
  // two collectors tilted toward the south
  for (const x of [2.15, 3.15]) {
    const p = new THREE.Group();
    p.add(bx(-0.46, 0, -1.0, 0.46, 0.06, 1.0, M.frame));
    p.add(bx(-0.44, 0.06, -0.98, 0.44, 0.065, 0.98, M.solar));
    p.position.set(x, t + 0.8, 5.25);
    p.rotation.x = 0.6;
    s.add(p);
    s.add(bx(x - 0.44, t, 4.42, x - 0.41, t + 1.4, 4.47, M.frame));
    s.add(bx(x + 0.41, t, 4.42, x + 0.44, t + 1.4, 4.47, M.frame));
  }
  groups.groundCeiling.add(s);
}
