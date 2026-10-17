import * as THREE from 'three';
import { LEVELS, SITE } from './plan.js';
import { Batch } from './builder.js';
import { foliageBlob, leafCanopy, seeded } from './furniture.js';

const ALL = (m) => ({ px: m, nx: m, py: m, ny: m, pz: m, nz: m });

function mesh(geo, mat, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------
export function oliveTree(M, scale = 1, seed = 1, detailed = false) {
  const g = new THREE.Group();
  const rnd = seeded(seed * 97 + 13);
  // gnarled multi-stem trunk
  const stems = 3;
  for (let s = 0; s < stems; s++) {
    const a = (s / stems) * Math.PI * 2 + rnd();
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      pts.push(new THREE.Vector3(
        Math.cos(a) * (0.08 + t * 0.55) * scale + Math.sin(t * 5 + s) * 0.08 * scale,
        t * 1.9 * scale,
        Math.sin(a) * (0.08 + t * 0.55) * scale + Math.cos(t * 4 + s) * 0.08 * scale,
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = mesh(new THREE.TubeGeometry(curve, 16, 0.09 * scale * (1 - s * 0.15), 8), M.bark);
    g.add(tube);
  }
  // silvery canopy: soft inner clumps wrapped in thousands of narrow leaves
  const n = detailed ? 11 : 16;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = (0.3 + rnd() * 1.0) * scale;
    const r = (0.45 + rnd() * 0.35) * scale;
    const cx = Math.cos(a) * rr, cy = (1.9 + rnd() * 1.1) * scale, cz = Math.sin(a) * rr;
    const b = foliageBlob(M, detailed ? r * 0.55 : r, detailed ? 0x5d6a4a : 0x8e9b74, rnd, 2);
    b.position.set(cx, cy, cz);
    b.scale.y = 0.7;
    g.add(b);
    if (detailed) {
      g.add(leafCanopy(M, {
        count: 520, radius: [r * 1.05, r * 0.8, r * 1.05], center: [cx, cy, cz],
        leaf: [0.04 * scale + 0.012, 0.13 * scale + 0.025], color: 0x9aa483, rnd,
      }));
    }
  }
  return g;
}

// Mediterranean cypress: a slim spire of dense foliage (lathe + leafy noise).
export function cypressTree(M, h = 7, seed = 1) {
  const g = new THREE.Group();
  const rnd = seeded(seed * 31 + 7);
  const trunk = mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.7, 8), M.bark);
  trunk.position.y = 0.35;
  g.add(trunk);
  const R = 0.55 * (h / 7) + rnd() * 0.08;
  const pts = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = R * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.75);
    pts.push(new THREE.Vector2(Math.max(0.001, r), 0.35 + t * (h - 0.35)));
  }
  const geo = new THREE.LatheGeometry(pts, 28);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const base = new THREE.Color(0x2c4627);
  const tmp = new THREE.Color();
  const ph = rnd() * 10;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const tuft = Math.sin(a * 7 + y * 3.1 + ph) * Math.sin(y * 5.3 - a * 3 + ph) * 0.5 + 0.5;
    const k = 1 + (tuft - 0.5) * 0.28 + Math.sin(y * 1.3 + ph) * 0.04;
    pos.setXYZ(i, x * k, y, z * k);
    tmp.copy(base).offsetHSL((rnd() - 0.5) * 0.02, 0.02, (tuft - 0.5) * 0.09 + (y / h) * 0.04);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const crown = mesh(geo, M.cypress);
  crown.rotation.z = (rnd() - 0.5) * 0.04;
  g.add(crown);
  return g;
}

function pineTree(M, h, seed) {
  const g = new THREE.Group();
  const rnd = seeded(seed);
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.2, h * 0.6, 7), M.bark));
  g.children[0].position.y = h * 0.3;
  for (let i = 0; i < 4; i++) {
    const b = foliageBlob(M, h * (0.22 + rnd() * 0.08), 0x3d5a32, rnd, 1);
    b.position.set((rnd() - 0.5) * h * 0.25, h * (0.62 + rnd() * 0.25), (rnd() - 0.5) * h * 0.25);
    b.scale.y = 0.6;
    g.add(b);
  }
  return g;
}

function shrub(M, r, color, seed, flowers = null) {
  const g = new THREE.Group();
  const rnd = seeded(seed);
  const core = foliageBlob(M, r * 0.7, 0x4d6640, rnd, 1);
  core.scale.y = 0.7;
  core.position.y = r * 0.5;
  g.add(core);
  g.add(leafCanopy(M, { count: 160, radius: [r, r * 0.75, r], center: [0, r * 0.55, 0], leaf: [0.025, 0.09], color, rnd }));
  if (flowers) g.add(leafCanopy(M, { count: 70, radius: [r * 1.02, r * 0.85, r * 1.02], center: [0, r * 0.7, 0], leaf: [0.03, 0.06], color: flowers, rnd }));
  return g;
}

// ---------------------------------------------------------------------------
// Distant terrain: Judean-hills style rolling ground with dry grass colours
// ---------------------------------------------------------------------------
function terrain(M) {
  const R = 900;
  // polar grid: dense rings near the house, sparse toward the horizon
  const radial = 70, segs = 160;
  const pos = [], col = [], idx = [];
  const c1 = new THREE.Color(0xb7ad7f), c2 = new THREE.Color(0x9c9563), c3 = new THREE.Color(0xcfc29a), c4 = new THREE.Color(0x7e8452);
  const tmp = new THREE.Color();
  const h = (x, z) => {
    const d = Math.hypot(x, z);
    const ramp = THREE.MathUtils.smoothstep(d, 30, 220);
    const n = Math.sin(x * 0.012) * Math.cos(z * 0.01) * 18
      + Math.sin(x * 0.031 + 1.3) * Math.sin(z * 0.027 + 0.4) * 8
      + Math.sin(x * 0.07) * Math.cos(z * 0.06) * 2.5;
    // terraces/valleys falling to the east (toward the desert)
    const fall = -Math.max(0, x) * 0.12;
    return LEVELS.lawn - 0.02 + ramp * (n + 6 + fall * ramp);
  };
  for (let i = 0; i <= radial; i++) {
    const t = i / radial;
    const r = 0.5 + Math.pow(t, 1.8) * (R - 0.5);
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const x = 6 + Math.cos(a) * r, z = 6 + Math.sin(a) * r;
      const y = h(x - 6, z - 6);
      pos.push(x, y, z);
      const k = (Math.sin(x * 0.05) * Math.cos(z * 0.045) + 1) / 2;
      tmp.copy(c1).lerp(c2, k);
      if (y > 14) tmp.lerp(c3, 0.4);
      if (((x * 13 + z * 7) | 0) % 9 === 0) tmp.lerp(c4, 0.35);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let i = 0; i < radial; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * segs + j, b = i * segs + ((j + 1) % segs);
      const c = (i + 1) * segs + j, d = (i + 1) * segs + ((j + 1) % segs);
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, M.terrain);
  m.receiveShadow = true;
  return { mesh: m, height: h };
}

// ---------------------------------------------------------------------------
// Neighbourhood: simple stone houses with flat roofs + solar heaters
// ---------------------------------------------------------------------------
function neighbourhood(M, heightAt) {
  const g = new THREE.Group();
  const b = new Batch();
  const rnd = seeded(2024);
  const spots = [];
  // two rows of houses along the street to the east, and scattered beyond
  for (let i = 0; i < 22; i++) {
    let x, z;
    if (i < 8) { x = -34 - (i % 2) * 16; z = -36 + Math.floor(i / 2) * 22; }
    else if (i < 14) { x = 44 + (i % 2) * 16; z = -30 + Math.floor((i - 8) / 2) * 24; }
    else { const a = rnd() * Math.PI * 2, r = 85 + rnd() * 60; x = 6 + Math.cos(a) * r; z = 6 + Math.sin(a) * r; }
    spots.push([x, z]);
  }
  for (const spot of spots) {
    const [x, z] = spot;
    const w = 8 + rnd() * 4, d = 9 + rnd() * 4, h = rnd() > 0.4 ? 6.4 : 3.4;
    spot.push(w, d, h);
    const y0 = heightAt(x - 6, z - 6) - 0.3;
    b.box(x - w / 2, y0, z - d / 2, x + w / 2, y0 + h + 0.3, z + d / 2, { ...ALL(M.stone), py: M.roof });
    // windows as dark insets
    for (let k = 0; k < 3; k++) {
      const wx = x - w / 2 + 1.2 + k * (w - 2.4) / 2;
      b.box(wx - 0.6, y0 + 1.3, z + d / 2, wx + 0.6, y0 + 2.6, z + d / 2 + 0.02, ALL(M.frame));
      if (h > 4) b.box(wx - 0.5, y0 + 4.3, z + d / 2, wx + 0.5, y0 + 5.5, z + d / 2 + 0.02, ALL(M.frame));
    }
    b.box(x - 1, y0 + h + 0.3, z - 1, x + 0.4, y0 + h + 1.2, z + 0.6, ALL(M.white));
  }
  b.build(g);
  // a few red-tiled gable roofs for variety
  const tile = new THREE.MeshStandardMaterial({ color: 0xa9533b, roughness: 0.8 });
  spots.forEach(([x, z, w, d, h], i) => {
    if (i % 3 !== 1) return;
    const hh = 2.2;
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 - 0.4, 0); sh.lineTo(w / 2 + 0.4, 0); sh.lineTo(0, hh); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: d + 0.6, bevelEnabled: false });
    geo.translate(0, 0, -(d + 0.6) / 2);
    const roof = mesh(geo, tile);
    const y0 = heightAt(x - 6, z - 6) - 0.3;
    roof.position.set(x, y0 + h + 0.3, z);
    g.add(roof);
  });
  for (const [x, z] of spots) {
    if (rnd() > 0.5) {
      const t = oliveTree(M, 0.9 + rnd() * 0.4, Math.floor(x * z));
      t.position.set(x + 6, heightAt(x, z - 3), z + 3);
      g.add(t);
    }
  }
  // pine groves on the surrounding hills
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 240;
    const x = 6 + Math.cos(a) * r, z = 6 + Math.sin(a) * r;
    const t = pineTree(M, 7 + rnd() * 6, i + 3);
    t.position.set(x, heightAt(x - 6, z - 6) - 0.2, z);
    g.add(t);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Slatted pergola over the patio (drawn on the upper-floor sheet). It is
// fixed to the house on the north and west and stands on posts elsewhere.
// ---------------------------------------------------------------------------
function pergola(M, lights) {
  const P = SITE.pergola;
  const g = new THREE.Group();
  const b = new Batch();
  const yTop = P.top, beamH = 0.18, y0 = LEVELS.courtyard;
  // perimeter beams (L-shaped plan with a notch around the entrance)
  b.box(P.notchX, yTop - beamH, P.z0, P.x1, yTop, P.z0 + 0.1, ALL(M.frame));
  b.box(P.x1 - 0.12, yTop - beamH, P.z0, P.x1, yTop, P.z1, ALL(M.frame));
  b.box(P.x0, yTop - beamH, P.z1 - 0.12, P.x1, yTop, P.z1, ALL(M.frame));
  b.box(P.x0, yTop - beamH, P.notchZ, P.x0 + 0.08, yTop, P.z1, ALL(M.frame));
  b.box(P.x0, yTop - beamH, P.notchZ, P.notchX, yTop, P.notchZ + 0.08, ALL(M.frame));
  b.box(P.notchX, yTop - beamH, P.z0, P.notchX + 0.08, yTop, P.notchZ, ALL(M.frame));
  for (const z of P.beams) b.box(P.x0, yTop - beamH, z - 0.04, P.x1, yTop - 0.02, z + 0.04, ALL(M.frame));
  // posts on the free corners
  for (const [x, z] of [[P.x1 - 0.12, P.z1 - 0.12], [P.x1 - 0.12, 8.95], [7.35, P.z1 - 0.12]]) {
    b.box(x, y0, z, x + 0.12, yTop - beamH, z + 0.12, ALL(M.frame));
  }
  // wood-look aluminium slats running north–south, as drawn
  for (let x = P.x0 + 0.1; x < P.x1 - 0.12; x += 0.15) {
    const z0 = x < P.notchX ? P.notchZ + 0.08 : P.z0 + 0.1;
    b.box(x, yTop - 0.02, z0, x + 0.05, yTop + 0.1, P.z1 - 0.12, ALL(M.veneer));
  }
  b.build(g);
  // string lights along the cross beams
  const bulbGeo = new THREE.SphereGeometry(0.035, 10, 8);
  for (const z of P.beams) {
    for (let x = P.x0 + 0.25; x < P.x1 - 0.2; x += 0.35) {
      const sag = Math.sin(((x - P.x0) / (P.x1 - P.x0)) * Math.PI) * 0.18;
      const bulb = mesh(bulbGeo, M.bulb, false);
      bulb.position.set(x, yTop - beamH - 0.08 - sag, z);
      g.add(bulb);
    }
  }
  for (const z of [8.3, 10.6]) {
    const l = new THREE.PointLight(0xffc27a, 0, 7, 2);
    l.position.set((P.x0 + P.x1) / 2 + 0.3, yTop - 0.5, z);
    l.userData.night = 7;
    g.add(l);
    lights.push(l);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Outdoor furniture on the patio
// ---------------------------------------------------------------------------
function outdoorFurniture(M) {
  const g = new THREE.Group();
  const b = new Batch();
  const y = LEVELS.courtyard;
  const teak = M.veneerDark;
  // dining table 2.0 x 0.95 with six chairs
  const tx0 = 6.6, tx1 = 8.6, tz0 = 8.35, tz1 = 9.3;
  b.box(tx0, y + 0.72, tz0, tx1, y + 0.76, tz1, ALL(teak));
  for (const x of [tx0 + 0.1, tx1 - 0.16]) for (const z of [tz0 + 0.1, tz1 - 0.16]) b.box(x, y, z, x + 0.06, y + 0.72, z + 0.06, ALL(teak));
  for (let i = 0; i < 3; i++) {
    const cx = tx0 + 0.35 + i * 0.65;
    for (const side of [-1, 1]) {
      const cz = side < 0 ? tz0 - 0.32 : tz1 + 0.32;
      b.box(cx - 0.22, y + 0.42, cz - 0.21, cx + 0.22, y + 0.46, cz + 0.21, ALL(teak));
      const bz = side < 0 ? cz - 0.21 : cz + 0.17;
      b.box(cx - 0.22, y + 0.46, bz, cx + 0.22, y + 0.88, bz + 0.04, ALL(teak));
      for (const dx of [-0.19, 0.16]) for (const dz of [-0.18, 0.15]) b.box(cx + dx, y, cz + dz, cx + dx + 0.03, y + 0.42, cz + dz + 0.03, ALL(M.blackMetal));
    }
  }
  // lounge corner in the south-east, facing the garden view
  const sx0 = 6.4, sx1 = 8.85, sz0 = 11.0, sz1 = 11.75;
  b.box(sx0, y, sz0, sx1, y + 0.3, sz1, ALL(teak));
  b.box(sx0, y + 0.3, sz1 - 0.18, sx1, y + 0.75, sz1, ALL(M.fabricSofa));
  b.box(sx0 + 0.02, y + 0.3, sz0, sx1 - 0.02, y + 0.45, sz1 - 0.18, ALL(M.fabricSofa));
  b.box(8.15, y, 10.0, 8.85, y + 0.3, sz0, ALL(teak));
  b.box(8.17, y + 0.3, 10.0, 8.83, y + 0.45, sz0, ALL(M.fabricSofa));
  b.box(6.9, y, 10.15, 7.8, y + 0.35, 10.7, ALL(teak));
  b.build(g);
  return g;
}

function wallLight(M, lights, x, y, z, nx, nz) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), M.blackMetal);
  box.castShadow = true;
  g.add(box);
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.09), M.bulb);
  lens.position.y = -0.105;
  g.add(lens);
  g.position.set(x + nx * 0.06, y, z + nz * 0.06);
  const l = new THREE.PointLight(0xffc98a, 0, 6, 2);
  l.position.set(x + nx * 0.3, y - 0.25, z + nz * 0.3);
  l.userData.night = 3.5;
  lights.push(l);
  const out = new THREE.Group();
  out.add(g, l);
  return out;
}

// ---------------------------------------------------------------------------
// Ground surfaces, boundary walls, planting
// ---------------------------------------------------------------------------
export function buildSite(M, groups, lights) {
  const site = groups.site;
  const L = SITE.lot;
  const { mesh: terr, height } = terrain(M);
  site.add(terr);

  // everything that the semi-detached twin mirrors goes into `yard`
  const yard = new THREE.Group();
  const b = new Batch();
  const Pa = SITE.patio, Pp = SITE.path, T = SITE.techApron;
  // patio paving under the pergola
  b.box(Pa.x0, LEVELS.lawn, Pa.z0, Pa.x1, LEVELS.courtyard, Pa.z1, { py: M.paving, px: M.stone, pz: M.stone });
  // entry path from the gate, apron in front of the technical-space doors
  b.box(Pp.x0, LEVELS.lawn, Pp.z0, Pp.x1, LEVELS.courtyard - 0.01, Pp.z1, { py: M.paving, nz: M.stone, pz: M.stone });
  b.box(T.x0, LEVELS.lawn, T.z0, T.x1, LEVELS.courtyard - 0.015, T.z1, { py: M.paving, px: M.stone, nz: M.stone });
  // concrete aprons around the house, gravel in the narrow side yard
  b.box(1.095, LEVELS.lawn, -0.6, 11.6, LEVELS.outside + 0.01, 0, { py: M.concrete, nz: M.concrete, px: M.concrete });
  b.box(11.0, LEVELS.lawn, 0, 11.6, LEVELS.outside + 0.01, 3.828, { py: M.concrete, px: M.concrete, pz: M.concrete });
  b.box(0.1, LEVELS.lawn, 12.008, Pa.x0, LEVELS.outside + 0.01, 12.4, { py: M.concrete, pz: M.concrete });
  b.box(0.1, LEVELS.lawn, -0.6, 1.095, LEVELS.outside + 0.01, 3.523, { py: M.gravel, nz: M.concrete });
  // stepping stones from the patio into the south garden
  for (let i = 0; i < 4; i++) {
    const z = 12.55 + i * 0.75;
    b.box(7.6 + (i % 2) * 0.25, LEVELS.lawn, z - 0.25, 8.4 + (i % 2) * 0.25, LEVELS.lawn + 0.025, z + 0.25, { py: M.paving, px: M.stone, nx: M.stone, pz: M.stone, nz: M.stone });
  }
  // boundary walls in Jerusalem stone
  const wallH = 1.1, wy = LEVELS.lawn;
  const stoneWall = (x0, z0, x1, z1, h = wallH) => {
    b.box(x0, wy, z0, x1, wy + h, z1, { ...ALL(M.stone), py: M.coping });
  };
  stoneWall(0.1, L.z0 - 0.25, L.x1 + 0.25, L.z0);
  stoneWall(0.1, L.z1, L.x1 + 0.25, L.z1 + 0.25);
  stoneWall(L.x1, L.z0, L.x1 + 0.25, Pp.z0 - 0.3);
  stoneWall(L.x1, Pp.z1 + 0.3, L.x1 + 0.25, L.z1);
  // the party line between the twin houses: tall privacy walls next to the
  // houses, a low garden wall beyond (only this house's half)
  stoneWall(0, L.z0, 0.1, 2.52);
  stoneWall(0, 2.52, 0.1, 3.523, 2.3);
  stoneWall(0, 12.008, 0.1, 13.0, 2.3);
  stoneWall(0, 13.0, 0.1, L.z1);
  b.build(yard);
  // gate pillars at the street entrance
  const gp = new Batch();
  for (const z of [Pp.z0 - 0.3, Pp.z1]) gp.box(L.x1, wy, z, L.x1 + 0.35, wy + 1.5, z + 0.3, { ...ALL(M.stone), py: M.coping });
  gp.build(yard);
  yard.add(pergola(M, lights));
  site.add(yard);

  // the neighbouring twin's yard: a mirrored copy without lights
  const twinYard = yard.clone();
  twinYard.name = 'twinYard';
  const drop = [];
  twinYard.traverse((o) => { if (o.isLight) drop.push(o); });
  for (const o of drop) o.parent.remove(o);
  twinYard.scale.x = -1;
  site.add(twinYard);

  // lawn across both lots
  const lb = new Batch();
  lb.box(-L.x1 - 8, LEVELS.lawn - 0.3, L.z0 - 8, L.x1 + 8, LEVELS.lawn, L.z1 + 8, { py: M.grass });
  lb.build(site);

  site.add(outdoorFurniture(M));
  // outdoor wall lights (H=250 on the plan) around the patio and entrance
  site.add(wallLight(M, lights, 5.6, 2.5, 8.35, 1, 0));
  site.add(wallLight(M, lights, 5.85, 2.5, 11.15, 1, 0));
  site.add(wallLight(M, lights, 8.3, 2.5, 5.927, 0, 1));
  site.add(wallLight(M, lights, 10.153, 1.9, 5.75, 1, 0));
  site.add(wallLight(M, lights, 1.095, 2.3, 1.66, -1, 0));
  site.add(wallLight(M, lights, 5.2, 2.4, 0, 0, -1));
  site.add(wallLight(M, lights, 11.0, 2.4, 1.9, 1, 0));

  // planting
  const put = (obj, x, z, y = LEVELS.lawn, rot = 0) => { obj.position.set(x, y, z); obj.rotation.y = rot; site.add(obj); return obj; };
  put(oliveTree(M, 1.1, 1, true), 4.2, -2.4);
  put(oliveTree(M, 0.9, 2, true), 9.6, -2.2);
  put(oliveTree(M, 1.05, 3, true), 2.6, 14.4);
  put(oliveTree(M, 0.85, 4, true), 11.6, 13.6);
  for (const [x, z, h, s] of [[0.9, -3.3, 7.4, 1], [12.9, -3.2, 7.8, 3], [12.9, 9.0, 8.2, 4], [12.9, 11.0, 7.2, 5], [12.9, 3.0, 7.6, 6], [0.8, 15.4, 6.8, 7]]) {
    put(cypressTree(M, h, s), x, z);
  }
  // lavender & rosemary in front of the living room
  for (let i = 0; i < 4; i++) put(shrub(M, 0.28, 0x6f8a5c, 300 + i, i % 2 ? 0x8b72c4 : null), 0.6 + i * 0.68, 12.75);
  for (let i = 0; i < 6; i++) put(shrub(M, 0.3, 0x5f7f4a, 320 + i, i % 2 ? 0xe9e2d0 : null), 10.6 + (i % 2) * 0.3, 8.0 + i * 0.75);
  // bougainvillea climbing the south-east pergola post
  const bg = new THREE.Group();
  const rnd = seeded(77);
  const clump = (x, y, z, r) => {
    bg.add(leafCanopy(M, { count: 90, radius: [r, r, r], center: [x, y, z], leaf: [0.05, 0.08], color: 0x4f7a3c, rnd }));
    bg.add(leafCanopy(M, { count: 120, radius: [r * 1.05, r * 1.05, r * 1.05], center: [x, y, z], leaf: [0.05, 0.06], color: 0xc42d7e, rnd }));
  };
  for (let i = 0; i < 9; i++) clump((rnd() - 0.5) * 0.35, 0.3 + i * 0.3, (rnd() - 0.5) * 0.4, 0.2 + rnd() * 0.1);
  for (let i = 0; i < 8; i++) clump(-0.3 - rnd() * 1.6, 3.0 + rnd() * 0.12, (rnd() - 0.5) * 0.7 - 0.2, 0.22 + rnd() * 0.1);
  const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 2.9, 6), M.bark);
  vine.position.set(0.05, 1.45, 0.05);
  bg.add(vine);
  put(bg, SITE.pergola.x1 - 0.04, SITE.pergola.z1 + 0.06, LEVELS.courtyard);
  // planters along the north apron
  for (const x of [5.2, 6.4]) put(shrub(M, 0.32, 0x5f7f4a, 900 + x * 10, 0xe9e2d0), x, -0.95);
  // potted plants on the patio
  site.add(potted(M, 'lemon', 9.75, 8.0));
  site.add(potted(M, 'olive', 9.65, 11.55));
  site.add(potted(M, 'fig', 6.55, 7.75));
  // garden light drawn at the patio's south-east corner
  const bol = new THREE.Group();
  bol.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 12), M.blackMetal).translateY(0.3));
  bol.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12), M.bulb).translateY(0.62));
  put(bol, 9.85, 11.73, LEVELS.courtyard);

  // sun loungers in the south garden
  const sl = new Batch();
  for (const x of [4.0, 4.9]) {
    sl.box(x, LEVELS.lawn, 13.6, x + 0.7, LEVELS.lawn + 0.32, 15.55, ALL(M.veneerDark));
    sl.box(x + 0.03, LEVELS.lawn + 0.32, 13.65, x + 0.67, LEVELS.lawn + 0.38, 15.5, ALL(M.fabricSofa));
  }
  sl.build(site);

  site.add(neighbourhood(M, height));
  return { heightAt: height };
}

function potted(M, kind, x, z) {
  const g = new THREE.Group();
  const pot = mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.55, 24), M.potGrey);
  pot.position.y = 0.275;
  g.add(pot);
  if (kind === 'olive') {
    const t = oliveTree(M, 0.55, 9, true);
    t.position.y = 0.5;
    g.add(t);
  } else {
    const rnd = seeded(kind.length * 7 + Math.round(x));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 8), M.bark).translateY(0.95));
    g.add(leafCanopy(M, {
      count: kind === 'lemon' ? 520 : 140,
      radius: [0.42, 0.42, 0.42],
      center: [0, 1.5, 0],
      leaf: kind === 'lemon' ? [0.07, 0.13] : [0.14, 0.24],
      color: kind === 'lemon' ? 0x4f7a3c : 0x456e34,
      rnd,
    }));
    if (kind === 'lemon') {
      const fruit = new THREE.MeshStandardMaterial({ color: 0xf2d13a, roughness: 0.45 });
      for (let i = 0; i < 10; i++) {
        const f = mesh(new THREE.SphereGeometry(0.04, 10, 8), fruit);
        const a = rnd() * Math.PI * 2;
        f.position.set(Math.cos(a) * 0.3, 1.3 + rnd() * 0.4, Math.sin(a) * 0.3);
        g.add(f);
      }
    }
  }
  g.position.set(x, LEVELS.courtyard, z);
  return g;
}
