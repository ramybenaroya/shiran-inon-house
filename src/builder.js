import * as THREE from 'three';
import {
  LEVELS, WALLS, ROOMS, WINDOWS, DOORS, SLABS, PARAPETS, STAIR, STAIR_DIVIDER, STAIR_VOIDS, LOW_WALLS,
} from './plan.js';

// ---------------------------------------------------------------------------
// Batch: accumulates quads per material with world-space UVs and turns them
// into one merged mesh per material (few draw calls, crisp tiling).
// ---------------------------------------------------------------------------
export class Batch {
  constructor() {
    this.buckets = new Map();
  }

  bucket(mat) {
    let b = this.buckets.get(mat);
    if (!b) {
      b = { pos: [], nor: [], uv: [], idx: [] };
      this.buckets.set(mat, b);
    }
    return b;
  }

  // corners: 4 points (CCW when seen from the normal side), n: normal
  quad(mat, a, b, c, d, n) {
    if (!mat) return;
    const s = mat.userData.uvScale ?? 1;
    const bk = this.bucket(mat);
    const base = bk.pos.length / 3;
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]);
    for (const p of [a, b, c, d]) {
      bk.pos.push(p[0], p[1], p[2]);
      bk.nor.push(n[0], n[1], n[2]);
      let u, v;
      if (ay > 0.5) { u = p[0]; v = -p[2]; }
      else if (ax > 0.5) { u = n[0] > 0 ? -p[2] : p[2]; v = p[1]; }
      else { u = n[2] > 0 ? p[0] : -p[0]; v = p[1]; }
      bk.uv.push(u * s, v * s);
    }
    bk.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Axis aligned box with one material per face (null = skip that face).
  // faces: { px, nx, py, ny, pz, nz }
  box(x0, y0, z0, x1, y1, z1, faces) {
    const f = faces;
    if (f.py) this.quad(f.py, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    if (f.ny) this.quad(f.ny, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    if (f.px) this.quad(f.px, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    if (f.nx) this.quad(f.nx, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    if (f.pz) this.quad(f.pz, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    if (f.nz) this.quad(f.nz, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
  }

  // Vertical face split into runs by a classifier along its length.
  // axis 'x' → face lies in a plane x = c, spans z from a to b; dir = ±1 normal
  classifiedFace(axis, c, a, b, y0, y1, dir, classify) {
    const step = 0.04;
    const n = Math.max(2, Math.ceil((b - a) / step));
    let runStart = a, runMat = undefined;
    const emit = (from, to, mat) => {
      if (!mat || to - from < 1e-4) return;
      if (axis === 'x') {
        if (dir > 0) this.quad(mat, [c, y0, to], [c, y0, from], [c, y1, from], [c, y1, to], [1, 0, 0]);
        else this.quad(mat, [c, y0, from], [c, y0, to], [c, y1, to], [c, y1, from], [-1, 0, 0]);
      } else {
        if (dir > 0) this.quad(mat, [from, y0, c], [to, y0, c], [to, y1, c], [from, y1, c], [0, 0, 1]);
        else this.quad(mat, [to, y0, c], [from, y0, c], [from, y1, c], [to, y1, c], [0, 0, -1]);
      }
    };
    for (let i = 0; i < n; i++) {
      const t0 = a + ((b - a) * i) / n;
      const t1 = a + ((b - a) * (i + 1)) / n;
      const tm = (t0 + t1) / 2;
      const off = dir * 0.03;
      const mat = axis === 'x' ? classify(c + off, tm) : classify(tm, c + off);
      if (i === 0) { runMat = mat; runStart = t0; continue; }
      if (mat !== runMat) {
        emit(runStart, t0, runMat);
        runStart = t0; runMat = mat;
      }
    }
    emit(runStart, b, runMat);
  }

  classifiedBox(r, y0, y1, classify, top, bottom) {
    const [x0, z0, x1, z1] = r;
    this.classifiedFace('x', x1, z0, z1, y0, y1, +1, classify);
    this.classifiedFace('x', x0, z0, z1, y0, y1, -1, classify);
    this.classifiedFace('z', z1, x0, x1, y0, y1, +1, classify);
    this.classifiedFace('z', z0, x0, x1, y0, y1, -1, classify);
    if (top) this.quad(top, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    if (bottom) this.quad(bottom, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  }

  build(group, { castShadow = true, receiveShadow = true } = {}) {
    for (const [mat, b] of this.buckets) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setIndex(b.idx);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.castShadow = castShadow && !mat.transparent;
      m.receiveShadow = receiveShadow;
      group.add(m);
    }
    this.buckets.clear();
    return group;
  }
}

const inRect = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
const inRectStrict = (r, x, z) => x > r[0] && x < r[2] && z > r[1] && z < r[3];

// ---------------------------------------------------------------------------
// Classification of wall faces: exterior stone / room finish / hidden.
// ---------------------------------------------------------------------------
export function makeClassifier(M) {
  // low walls are left out: full-height walls next to them keep their faces
  // above the low wall's top
  const solids = {
    ground: [...WALLS.ground],
    upper: [...WALLS.upper, STAIR_DIVIDER],
  };
  const rooms = ROOMS;

  // openings: which side is the exterior, and where the frame plane is
  const openings = { ground: [], upper: [] };
  const rawRoomAt = (floor, x, z) => rooms[floor].find((rm) => rm.rects.some((r) => inRect(r, x, z)));
  for (const o of [...WINDOWS, ...DOORS]) {
    const r = o.depth ? [o.depth[0], o.rect[1], o.depth[1], o.rect[3]] : o.rect;
    const alongX = r[2] - r[0] > r[3] - r[1];
    let extSide = 0;
    if (alongX) {
      const cx = (r[0] + r[2]) / 2;
      const a = rawRoomAt(o.floor, cx, r[1] - 0.1), b = rawRoomAt(o.floor, cx, r[3] + 0.1);
      if (!a && b) extSide = -1; else if (a && !b) extSide = 1;
    } else {
      const cz = (r[1] + r[3]) / 2;
      const a = rawRoomAt(o.floor, r[0] - 0.1, cz), b = rawRoomAt(o.floor, r[2] + 0.1, cz);
      if (!a && b) extSide = -1; else if (a && !b) extSide = 1;
    }
    const plane = alongX ? (r[1] + r[3]) / 2 : (r[0] + r[2]) / 2;
    o.meta = { alongX, extSide, plane, rect: o.rect };
    openings[o.floor].push(o);
  }

  const lowWalls = { ground: LOW_WALLS.ground.map((w) => w.slice(0, 4)), upper: [] };

  function classify(floor, x, z) {
    for (const r of solids[floor]) if (inRectStrict(r, x, z)) return null;
    // above a low wall, an adjoining wall is still an interior face
    for (const r of lowWalls[floor]) if (inRectStrict(r, x, z)) return M.paint;
    const room = rawRoomAt(floor, x, z);
    if (room) return M[room.wall] || M.paint;
    for (const o of openings[floor]) {
      if (inRect(o.meta.rect, x, z)) {
        if (o.meta.extSide === 0) return M.paint;
        const d = o.meta.alongX ? z - o.meta.plane : x - o.meta.plane;
        return d * o.meta.extSide > 0 ? M.stone : M.paint;
      }
    }
    return M.stone;
  }
  return { classify, roomAt: rawRoomAt, openings };
}

// ---------------------------------------------------------------------------
// Build the architecture into groups
// ---------------------------------------------------------------------------
export function buildArchitecture(M, groups) {
  const { classify } = makeClassifier(M);
  const cG = (x, z) => classify('ground', x, z);
  const cU = (x, z) => classify('upper', x, z);

  // --- Ground floor walls ----------------------------------------------------
  const bG = new Batch();
  // wall tops sit 3 mm under the slab top so they never flicker against it
  for (const r of WALLS.ground) bG.classifiedBox(r, LEVELS.outside, LEVELS.upper - 0.003, cG, M.wallTop);
  for (const w of LOW_WALLS.ground) bG.classifiedBox(w.slice(0, 4), LEVELS.outside, w[4], cG, M.paint);
  // openings: sills + lintels
  for (const o of [...WINDOWS, ...DOORS].filter((o) => o.floor === 'ground')) {
    addSillLintel(bG, o, 0, LEVELS.upper, cG, M);
  }
  addFloors(bG, 'ground', 0, M);
  // ground slab plinth
  const plinth = (x, z) => (SLABS.ground.some((r) => inRectStrict(r, x, z)) ? null : M.stone);
  for (const r of SLABS.ground) bG.classifiedBox(r, LEVELS.outside, -0.001, plinth, null);
  buildStairs(bG, M);
  bG.build(groups.ground);

  // --- Terrace + upper slab (ceiling of the ground floor) ---------------------
  const bS = new Batch();
  const allSlabs = [...SLABS.terrace, ...SLABS.upper];
  const voids = STAIR_VOIDS;
  const slabClass = (x, z) => {
    if (allSlabs.some((r) => inRectStrict(r, x, z))) return null;
    if (voids.some((r) => inRect(r, x, z))) return M.paint;
    return M.stone;
  };
  for (const r of SLABS.terrace) bS.classifiedBox(r, LEVELS.groundCeiling, LEVELS.upper, slabClass, M.roofTiles, M.ceiling);
  for (const r of SLABS.upper) bS.classifiedBox(r, LEVELS.groundCeiling, LEVELS.upper, slabClass, M.roofTiles, M.ceiling);
  bS.build(groups.groundCeiling);

  // terrace parapets (belong to the terrace roof)
  const bT = new Batch();
  addParapets(bT, PARAPETS.terrace, LEVELS.upper, LEVELS.terraceParapet, M, [
    ...WALLS.upper,
  ]);
  addParapets(bT, PARAPETS.ledge, LEVELS.upper, LEVELS.upper + 0.22, M, WALLS.upper);
  bT.build(groups.groundCeiling);

  // --- Upper floor ------------------------------------------------------------
  const bU = new Batch();
  for (const r of WALLS.upper) bU.classifiedBox(r, LEVELS.upper, LEVELS.roof - 0.003, cU, M.wallTop);
  // the divider continues above the upper floor as a guard along the void
  bU.classifiedBox(STAIR_DIVIDER, LEVELS.groundCeiling, LEVELS.upper + 1.05, cU, M.veneer);
  for (const o of [...WINDOWS, ...DOORS].filter((o) => o.floor === 'upper')) {
    addSillLintel(bU, o, LEVELS.upper, LEVELS.roof, cU, M);
  }
  addFloors(bU, 'upper', LEVELS.upper, M);
  bU.build(groups.upper);

  // --- Roof -------------------------------------------------------------------
  const bR = new Batch();
  const roofClass = (x, z) => (SLABS.roof.some((r) => inRectStrict(r, x, z)) ? null : M.stone);
  for (const r of SLABS.roof) bR.classifiedBox(r, LEVELS.upperCeiling, LEVELS.roof, roofClass, M.roof, M.ceiling);
  addParapets(bR, PARAPETS.roof, LEVELS.roof, LEVELS.roofParapet, M, []);
  bR.build(groups.roof);
}

function addParapets(batch, rects, y0, y1, M, neighbours) {
  const cls = (x, z) => {
    if (rects.some((r) => inRectStrict(r, x, z))) return null;
    if (neighbours.some((r) => inRectStrict(r, x, z))) return null;
    return M.stone;
  };
  for (const r of rects) {
    batch.classifiedBox(r, y0, y1, cls, null);
    // coping stone with a small drip overhang
    const o = 0.025;
    batch.box(r[0] - o, y1, r[1] - o, r[2] + o, y1 + 0.05, r[3] + o, {
      py: M.coping, ny: M.coping, px: M.coping, nx: M.coping, pz: M.coping, nz: M.coping,
    });
  }
}

function addSillLintel(batch, o, level, top, classify, M) {
  const r = o.rect;
  const sill = o.sill ?? 0;
  const head = o.head;
  if (sill > 0.001) {
    batch.classifiedBox(r, level === 0 ? LEVELS.outside : level, level + sill, classify, M.coping);
  }
  batch.classifiedBox(r, level + head, top, classify, M.wallTop, M.paint);
}

function addFloors(batch, floor, level, M) {
  const y = level + 0.003;
  for (const room of ROOMS[floor]) {
    const mat = room.floor ? M[room.floor] : null;
    if (!mat) continue;
    for (const r of room.rects) {
      batch.quad(mat, [r[0], y, r[3]], [r[2], y, r[3]], [r[2], y, r[1]], [r[0], y, r[1]], [0, 1, 0]);
    }
  }
  // thresholds in door openings
  for (const d of DOORS.filter((d) => d.floor === floor)) {
    const r = d.rect;
    batch.quad(M.quartz, [r[0], y, r[3]], [r[2], y, r[3]], [r[2], y, r[1]], [r[0], y, r[1]], [0, 1, 0]);
  }
}

// ---------------------------------------------------------------------------
// U-shaped stair: flight 1 east from the entrance, landing over the technical
// space, flight 2 back west above the guest WC.
// ---------------------------------------------------------------------------
function buildStairs(batch, M) {
  const S = STAIR;
  const r = S.rise;
  const tread = { py: M.oak, px: M.paint, nx: M.paint, pz: M.paint, nz: M.paint, ny: M.paint };
  const f1 = S.flight1;
  const d1 = (f1.x1 - f1.x0) / f1.steps;
  for (let i = 0; i < f1.steps; i++) {
    const xa = f1.x0 + i * d1, xb = xa + d1;
    const top = (i + 1) * r;
    batch.box(xa, 0, f1.z0, xb, top, f1.z1, { ...tread, nx: M.oak });
  }
  // landing slab
  const L = S.landing;
  const lt = (f1.steps + 1) * r;
  batch.box(L.x0, lt - 0.22, L.z0, L.x1, lt, L.z1, { ...tread, nx: M.oak });
  // flight 2 (going west)
  const f2 = S.flight2;
  const d2 = (f2.x1 - f2.x0) / f2.steps;
  for (let i = 1; i <= f2.steps; i++) {
    const xb = f2.x1 - (i - 1) * d2, xa = xb - d2;
    const top = lt + i * r;
    batch.box(xa, top - 0.3, f2.z0, xb, top, f2.z1, { ...tread, px: M.oak });
  }
  // sloped soffit under flight 2 (ceiling of the guest WC's east end)
  const sx0 = f2.x0, sx1 = f2.x1;
  // through the bottom corners of the treads (0.3 m deep boxes)
  const sy0 = lt + f2.steps * r - 0.3, sy1 = lt - 0.3;
  batch.quad(M.paint,
    [sx1, sy1, f2.z1], [sx0, sy0, f2.z1], [sx0, sy0, f2.z0], [sx1, sy1, f2.z0],
    normalize([sy1 - sy0, -(sx1 - sx0), 0]));
  // wall-mounted handrail along flight 1 (south wall): a sloped square prism
  const hz = f1.z1 - 0.06, t = 0.022;
  const xa = f1.x0 + 0.1, xb = f1.x1 + 0.1;
  const ya = 0.9 + r, yb = 0.9 + r + f1.steps * r;
  const up = normalize([-(yb - ya), xb - xa, 0]);
  const dn = up.map((c) => -c);
  const m = M.blackMetal;
  batch.quad(m, [xa, ya + t, hz + t], [xb, yb + t, hz + t], [xb, yb + t, hz - t], [xa, ya + t, hz - t], up);
  batch.quad(m, [xa, ya - t, hz - t], [xb, yb - t, hz - t], [xb, yb - t, hz + t], [xa, ya - t, hz + t], dn);
  batch.quad(m, [xa, ya - t, hz + t], [xb, yb - t, hz + t], [xb, yb + t, hz + t], [xa, ya + t, hz + t], [0, 0, 1]);
  batch.quad(m, [xb, yb - t, hz - t], [xa, ya - t, hz - t], [xa, ya + t, hz - t], [xb, yb + t, hz - t], [0, 0, -1]);
  for (const x of [xa + 0.3, (xa + xb) / 2, xb - 0.3]) {
    const y = ya + ((x - xa) / (xb - xa)) * (yb - ya);
    batch.box(x - 0.01, y - 0.07, hz, x + 0.01, y - t, f1.z1, ALLM(m));
  }
}

const ALLM = (m) => ({ px: m, nx: m, py: m, ny: m, pz: m, nz: m });

function normalize(v) {
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
}

// ---------------------------------------------------------------------------
// Windows and doors (frames, glass, leaves)
// ---------------------------------------------------------------------------
export function buildOpenings(M, groups) {
  const out = { ground: new THREE.Group(), upper: new THREE.Group() };
  const bf = { ground: new Batch(), upper: new Batch() };
  for (const w of WINDOWS) buildWindow(bf[w.floor], w, M);
  for (const d of DOORS) buildDoor(bf[d.floor], out[d.floor], d, M);
  bf.ground.build(groups.ground);
  bf.upper.build(groups.upper);
  groups.ground.add(out.ground);
  groups.upper.add(out.upper);
}

const ALL = (m) => ({ px: m, nx: m, py: m, ny: m, pz: m, nz: m });

// Box helper in "wall space": u along the wall, w across (depth), y up.
function wallBox(batch, meta, u0, u1, y0, y1, w0, w1, mat) {
  if (meta.alongX) batch.box(u0, y0, w0, u1, y1, w1, ALL(mat));
  else batch.box(w0, y0, u0, w1, y1, u1, ALL(mat));
}

function buildWindow(batch, w, M) {
  const meta = w.meta;
  const level = w.floor === 'ground' ? 0 : LEVELS.upper;
  const r = w.rect;
  const [u0, u1] = meta.alongX ? [r[0], r[2]] : [r[1], r[3]];
  const y0 = level + w.sill, y1 = level + w.head;
  const p = meta.plane;
  const fd = 0.035; // half depth of frame
  const fw = 0.05; // frame profile width
  const frameMat = w.kind === 'mamad' ? M.mamadSteel : M.frame;
  // outer frame
  wallBox(batch, meta, u0, u1, y1 - fw, y1, p - fd, p + fd, frameMat);
  wallBox(batch, meta, u0, u1, y0, y0 + fw, p - fd, p + fd, frameMat);
  wallBox(batch, meta, u0, u0 + fw, y0, y1, p - fd, p + fd, frameMat);
  wallBox(batch, meta, u1 - fw, u1, y0, y1, p - fd, p + fd, frameMat);
  const glass = w.frosted ? M.frosted : M.glass;
  const iu0 = u0 + fw, iu1 = u1 - fw, iy0 = y0 + fw, iy1 = y1 - fw;
  const sash = 0.045;
  if (w.kind === 'slider' && w.panes === 2) {
    const mid = (iu0 + iu1) / 2;
    // an "open" slider has its second sash parked behind the first
    const sashes = [[iu0, mid + 0.03, -0.018], w.open ? [iu0 + 0.03, mid + 0.06, 0.018] : [mid - 0.03, iu1, 0.018]];
    for (const [a, b, off] of sashes) {
      const pp = p + off;
      wallBox(batch, meta, a, b, iy1 - sash, iy1, pp - 0.015, pp + 0.015, frameMat);
      wallBox(batch, meta, a, b, iy0, iy0 + sash, pp - 0.015, pp + 0.015, frameMat);
      wallBox(batch, meta, a, a + sash, iy0, iy1, pp - 0.015, pp + 0.015, frameMat);
      wallBox(batch, meta, b - sash, b, iy0, iy1, pp - 0.015, pp + 0.015, frameMat);
      wallBox(batch, meta, a + sash, b - sash, iy0 + sash, iy1 - sash, pp - 0.004, pp + 0.004, glass);
    }
  } else {
    if (w.kind !== 'fixed') {
      const n = w.panes ?? 1;
      const sw = (iu1 - iu0) / n;
      for (let k = 0; k < n; k++) {
        const a = iu0 + k * sw, b = a + sw;
        wallBox(batch, meta, a, b, iy1 - sash, iy1, p - 0.02, p + 0.02, frameMat);
        wallBox(batch, meta, a, b, iy0, iy0 + sash, p - 0.02, p + 0.02, frameMat);
        wallBox(batch, meta, a, a + sash, iy0, iy1, p - 0.02, p + 0.02, frameMat);
        wallBox(batch, meta, b - sash, b, iy0, iy1, p - 0.02, p + 0.02, frameMat);
        wallBox(batch, meta, a + sash, b - sash, iy0 + sash, iy1 - sash, p - 0.004, p + 0.004, glass);
      }
    } else {
      wallBox(batch, meta, iu0, iu1, iy0, iy1, p - 0.004, p + 0.004, glass);
    }
  }
  // roller shutter partly lowered, on the exterior side
  if (w.shutter && meta.extSide) {
    const sp = p + meta.extSide * 0.07;
    const sh = (w.head - w.sill) * w.shutter;
    wallBox(batch, meta, u0 + 0.02, u1 - 0.02, y1 - sh, y1, sp - 0.006, sp + 0.006, M.shutter);
    wallBox(batch, meta, u0 + 0.02, u0 + 0.05, y0, y1, sp - 0.02, sp + 0.02, M.frame);
    wallBox(batch, meta, u1 - 0.05, u1 - 0.02, y0, y1, sp - 0.02, sp + 0.02, M.frame);
  }
  // stone sill nose on the outside, marble board inside
  if (w.sill > 0.05 && meta.extSide) {
    const ext = meta.alongX
      ? (meta.extSide > 0 ? r[3] : r[1])
      : (meta.extSide > 0 ? r[2] : r[0]);
    const s = meta.extSide;
    const a = Math.min(ext - s * 0.02, ext + s * 0.04), b = Math.max(ext - s * 0.02, ext + s * 0.04);
    wallBox(batch, meta, u0 - 0.04, u1 + 0.04, y0 - 0.04, y0 + 0.005, a, b, M.coping);
  }
  if (w.kind === 'mamad' && meta.extSide) {
    // steel blast shutter rails on the outside
    const sp = p + meta.extSide * 0.09;
    wallBox(batch, meta, u0, u1 + 0.6, y1 - 0.04, y1, sp - 0.02, sp + 0.02, M.mamadSteel);
    wallBox(batch, meta, u0, u1 + 0.6, y0, y0 + 0.04, sp - 0.02, sp + 0.02, M.mamadSteel);
  }
}

function leafMesh(width, height, thick, mat) {
  const g = new THREE.BoxGeometry(width, height, thick);
  g.translate(width / 2, height / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function handle(M, side = 1) {
  const g = new THREE.Group();
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 20), M.chrome);
  rose.rotation.x = Math.PI / 2;
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 10), M.chrome);
  lever.rotation.z = Math.PI / 2;
  lever.position.set(-0.06, 0, 0.035 * side);
  rose.position.z = 0.006 * side;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.035, 10), M.chrome);
  neck.rotation.x = Math.PI / 2;
  neck.position.z = 0.018 * side;
  g.add(rose, lever, neck);
  return g;
}

function buildDoor(batch, group, d, M) {
  const level = d.floor === 'ground' ? 0 : LEVELS.upper;
  const meta = d.meta;
  const r = d.rect;
  const [u0, u1] = meta.alongX ? [r[0], r[2]] : [r[1], r[3]];
  const [w0, w1] = meta.alongX ? [r[1], r[3]] : [r[0], r[2]];
  const head = level + d.head;
  const casing = d.kind === 'interior' || d.kind === 'pocket' ? M.door : M.frame;
  if (d.kind !== 'double') {
    // jamb lining
    wallBox(batch, meta, u0, u0 + 0.025, level, head, w0 - 0.01, w1 + 0.01, casing);
    wallBox(batch, meta, u1 - 0.025, u1, level, head, w0 - 0.01, w1 + 0.01, casing);
    wallBox(batch, meta, u0, u1, head - 0.025, head, w0 - 0.01, w1 + 0.01, casing);
  }

  if (d.kind === 'pocket') {
    // sliding leaf parked mostly inside the pocket wall
    const leafW = d.width;
    const visible = 0.28;
    const pm = (w0 + w1) / 2;
    wallBox(batch, meta, u0 - leafW + visible, u0 + visible, level + 0.01, head - 0.03, pm - 0.02, pm + 0.02, M.door);
    return;
  }

  if (d.kind === 'double') {
    // louvred metal doors of the meter/boiler niche, closed, flush with the facade
    const x = r[2] + 0.005;
    const half = (r[3] - r[1]) / 2;
    for (let k = 0; k < 2; k++) {
      const z0 = r[1] + k * half;
      batch.box(x - 0.03, level, z0 + 0.005, x, head, z0 + half - 0.005, ALL(M.frame));
      batch.box(x, level + 0.15, z0 + 0.06, x + 0.004, head - 0.15, z0 + half - 0.06, ALL(M.shutter));
    }
    return;
  }

  const leafH = (d.head - (d.kind === 'entry' ? 0.03 : 0.02));
  const thick = d.kind === 'entry' ? 0.065 : d.kind === 'mamad' ? 0.07 : 0.042;
  const mat = d.kind === 'entry' ? M.entryDoor : d.kind === 'mamad' ? M.mamadSteel : M.door;
  const leaf = leafMesh(d.width, leafH, thick, mat);
  const pivot = new THREE.Group();
  pivot.add(leaf);
  pivot.position.set(d.hinge[0], level + 0.008, d.hinge[1]);
  const dir = d.open ?? d.closed;
  const ang = Math.atan2(-dir[1], dir[0]);
  pivot.rotation.y = ang;
  // handle near the free edge, both faces
  const hy = 1.02;
  if (d.kind === 'entry') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.2, 0.03), M.blackMetal);
    for (const s of [1, -1]) {
      const b = bar.clone();
      b.position.set(d.width - 0.12, 1.05, s * (thick / 2 + 0.05));
      pivot.add(b);
      for (const yy of [0.5, 1.6]) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.05), M.blackMetal);
        st.position.set(d.width - 0.12, yy, s * (thick / 2 + 0.025));
        pivot.add(st);
      }
    }
  } else {
    for (const s of [1, -1]) {
      const h = handle(M, s);
      h.position.set(d.width - 0.07, hy, s * thick / 2);
      pivot.add(h);
    }
  }
  group.add(pivot);

  if (d.kind === 'entry') {
    // fixed glass side light in the part of the opening the leaf does not cover
    const p = meta.plane;
    const leafEnd = d.hinge[1] + d.closed[1] * d.width;
    const sl0 = d.closed[1] > 0 ? leafEnd + 0.02 : r[1] + 0.03;
    const sl1 = d.closed[1] > 0 ? r[3] - 0.03 : leafEnd - 0.02;
    batch.box(p - 0.035, level, sl0 - 0.03, p + 0.035, head, sl0, ALL(M.frame));
    batch.box(p - 0.006, level + 0.05, sl0, p + 0.006, head - 0.05, sl1, ALL(M.glass));
    batch.box(p - 0.035, level, sl1, p + 0.035, head, sl1 + 0.04, ALL(M.frame));
  }
}
