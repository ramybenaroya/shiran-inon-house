import * as THREE from 'three';
import { WALLS, WINDOWS, DOORS, STAIR, STAIR_DIVIDER, SLABS, SITE, LEVELS, LOW_WALLS, PARAPETS } from './plan.js';

const EYE = 1.62;
const RADIUS = 0.24;
const STEP_UP = 0.36;

const inRect = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];

// Furniture and fixtures you cannot walk through: [x0, z0, x1, z1, y0, y1]
const U = LEVELS.upper;
const FURNITURE = [
  // kitchen + dining
  [0.1, 3.726, 0.72, 7.2, 0, 1], [0.72, 3.726, 2.99, 4.545, 0, 1], [2.99, 3.925, 3.446, 4.525, 0, 2.4],
  [3.56, 3.73, 4.49, 4.45, 0, 2.4], [1.8, 5.71, 2.8, 6.93, 0, 0.95], [2.8, 5.87, 3.85, 6.77, 0, 0.8],
  // living room
  [1.125, 8.2, 3.475, 9.16, 0, 0.9], [0.1, 8.95, 1.01, 10.57, 0, 0.9], [1.7, 9.5, 2.9, 10.2, 0, 0.45],
  [1.15, 11.38, 3.15, 11.8, 0, 1.8], [3.9, 9.8, 4.7, 10.6, 0, 0.9], [4.985, 7.607, 5.39, 8.453, 0, 2.3],
  // bedroom + en-suite
  [1.303, 0.77, 3.33, 2.52, 0, 0.7], [1.303, 3.22, 3.446, 3.823, 0, 2.5], [4.045, 1.4, 4.495, 2.4, 0, 0.9],
  [3.57, 0.42, 4.33, 1.18, 0, 0.9], [4.65, 1.27, 5.85, 1.751, 0, 0.9], [6.7, 0.203, 7.15, 0.75, 0, 0.5],
  [6.0, 1.03, 6.85, 1.06, 0, 2], [5.99, 1.05, 6.02, 1.751, 0, 2],
  // corridor, closet, WC, safe room
  [4.672, 1.852, 5.898, 2.6, 0, 2.3], [5.9, 2.306, 7.397, 2.61, 0, 2.3], [4.601, 3.726, 5.201, 4.723, 0, 2.4],
  [7.75, 4.0, 8.296, 4.45, 0, 0.5], [7.03, 4.25, 7.48, 4.723, 0, 0.9],
  [9.7, 0.38, 10.7, 2.45, 0, 0.7], [7.604, 0.5, 8.24, 2.1, 0, 0.8], [8.7, 2.92, 10.7, 3.523, 0, 2.3],
  // patio
  [6.6, 8.35, 8.6, 9.3, -0.1, 0.8], [6.4, 10.0, 8.85, 11.75, -0.1, 0.8],
  [8.97, 11.8, 9.09, 11.92, -0.1, 3], [8.97, 8.95, 9.09, 9.07, -0.1, 3], [7.35, 11.8, 7.47, 11.92, -0.1, 3],
  // upper floor
  [1.298, 0.52, 3.33, 1.58, U, U + 0.7], [3.895, 0.525, 4.495, 2.275, U, U + 2.4], [1.3, 2.86, 2.7, 3.519, U, U + 0.8],
  [8.74, 0.2, 10.797, 1.21, U, U + 0.7], [7.397, 0.225, 8.0, 1.975, U, U + 2.4], [9.37, 2.86, 10.77, 3.519, U, U + 0.8],
  [4.601, 0.25, 5.33, 1.95, U, U + 0.55], [5.45, 0.203, 6.25, 0.75, U, U + 1.2], [6.84, 0.55, 7.295, 1.35, U, U + 0.9],
  [6.8, 1.5, 7.295, 2.37, U, U + 2.1], [1.65, 3.8, 3.65, 6.1, U, U + 1.6], [5.75, 5.36, 6.75, 5.719, U, U + 0.7], [4.6, 4.98, 5.32, 5.7, U, U + 0.9],
];

export class Walker {
  constructor(camera, dom, { onExit, onMove } = {}) {
    this.camera = camera;
    this.dom = dom;
    this.onExit = onExit;
    this.onMove = onMove;
    this.enabled = false;
    this.pos = new THREE.Vector3(12.6, LEVELS.courtyard, 6.75);
    this.yaw = Math.PI / 2; // looking west
    this.pitch = -0.05;
    this.keys = new Set();
    this.joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
    this.look = { id: null, x: 0, y: 0 };
    this.vy = 0;
    // no-clip: walk through walls and furniture (floors and stairs still carry you)
    this.noclip = true;
    this.buildColliders();
    this.bind();
  }

  buildColliders() {
    const c = [];
    for (const r of WALLS.ground) c.push([...r, -0.5, LEVELS.upper]);
    for (const r of WALLS.upper) c.push([...r, LEVELS.upper, LEVELS.roof]);
    c.push([...STAIR_DIVIDER, 0, LEVELS.upper + 1.05]);
    for (const w of LOW_WALLS.ground) c.push([...w.slice(0, 4), -0.5, w[4] - 0.05]);
    for (const w of WINDOWS) {
      const lv = w.floor === 'ground' ? 0 : LEVELS.upper;
      const r = w.rect;
      if (w.open) {
        // only the half with the parked sashes blocks an opened slider
        const alongX = r[2] - r[0] > r[3] - r[1];
        const mid = alongX ? (r[0] + r[2]) / 2 : (r[1] + r[3]) / 2;
        c.push(alongX ? [r[0], r[1], mid - 0.12, r[3], lv - 0.5, lv + 3] : [r[0], r[1], r[2], mid - 0.12, lv - 0.5, lv + 3]);
      } else c.push([...r, lv - 0.5, lv + 3]);
    }
    for (const d of DOORS) if (d.kind === 'double') c.push([...d.rect, -0.5, 2.5]);
    // parapets around the roof terrace
    for (const r of PARAPETS.terrace) c.push([...r, LEVELS.upper - 0.1, LEVELS.terraceParapet]);
    // fences around the lot (the party line is x = 0), gate on the east
    const L = SITE.lot, P = SITE.path;
    c.push([-1, L.z0 - 1.2, L.x1 + 1.2, L.z0, -1, 3]);
    c.push([-1, L.z1, L.x1 + 1.2, L.z1 + 1.2, -1, 3]);
    c.push([L.x1, L.z0 - 1, L.x1 + 1.2, P.z0, -1, 3]);
    c.push([L.x1, P.z1, L.x1 + 1.2, L.z1 + 1, -1, 3]);
    c.push([L.x1 + 6, P.z0 - 2, L.x1 + 7, P.z1 + 2, -1, 3]);
    c.push([-1.2, L.z0 - 1, 0, L.z1 + 1, -1, 3]);
    for (const f of FURNITURE) c.push(f);
    this.colliders = c;
  }

  // Candidate walking surfaces at (x, z); pick the highest reachable one.
  floorAt(x, z, y) {
    const cands = [];
    // outside
    let out = LEVELS.lawn;
    const Pa = SITE.patio, P = SITE.path, T = SITE.techApron;
    if (inRect([Pa.x0, Pa.z0, Pa.x1, Pa.z1], x, z)) out = LEVELS.courtyard;
    else if (inRect([P.x0, P.z0, P.x1, P.z1], x, z)) out = LEVELS.courtyard - 0.01;
    else if (inRect([T.x0, T.z0, T.x1, T.z1], x, z)) out = LEVELS.courtyard - 0.015;
    else if (inRect([1.095, -0.6, 11.6, 0], x, z) || inRect([11.0, 0, 11.6, 3.828], x, z)
      || inRect([0.1, 12.008, Pa.x0, 12.4], x, z) || inRect([0.1, -0.6, 1.095, 3.523], x, z)) out = LEVELS.outside;
    cands.push(out);
    if (SLABS.ground.some((r) => inRect(r, x, z))) cands.push(0);
    // stairs
    const S = STAIR;
    const r = S.rise;
    const f1 = S.flight1, f2 = S.flight2, L = S.landing;
    if (inRect([f1.x0, f1.z0, f1.x1, f1.z1], x, z)) {
      const d = (f1.x1 - f1.x0) / f1.steps;
      cands.push(Math.min(f1.steps, Math.floor((x - f1.x0) / d) + 1) * r);
    }
    const lt = (f1.steps + 1) * r;
    if (inRect([L.x0, L.z0, L.x1, L.z1], x, z)) cands.push(lt);
    if (inRect([f2.x0, f2.z0, f2.x1, f2.z1], x, z)) {
      const d = (f2.x1 - f2.x0) / f2.steps;
      cands.push(lt + Math.min(f2.steps, Math.floor((f2.x1 - x) / d) + 1) * r);
    }
    if (SLABS.upper.some((rr) => inRect(rr, x, z))) cands.push(LEVELS.upper);
    // the roof over the kitchen and living room, through the hall's sliding door
    if (SLABS.terrace.some((rr) => inRect(rr, x, z))) cands.push(LEVELS.upper);
    let best = -Infinity;
    for (const h of cands) if (h <= y + STEP_UP && h > best) best = h;
    if (best === -Infinity) best = Math.min(...cands);
    return best;
  }

  collide(p) {
    const y0 = p.y + 0.3, y1 = p.y + 1.7;
    for (let it = 0; it < 3; it++) {
      for (const c of this.colliders) {
        if (c[5] <= y0 || c[4] >= y1) continue;
        const cx = Math.max(c[0], Math.min(p.x, c[2]));
        const cz = Math.max(c[1], Math.min(p.z, c[3]));
        let dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < RADIUS * RADIUS) {
          if (d2 < 1e-10) {
            // centre inside the box: push out along the shortest axis
            const opts = [[c[0] - RADIUS - p.x, 0], [c[2] + RADIUS - p.x, 0], [0, c[1] - RADIUS - p.z], [0, c[3] + RADIUS - p.z]];
            opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
            p.x += opts[0][0]; p.z += opts[0][1];
          } else {
            const d = Math.sqrt(d2);
            const push = RADIUS - d;
            p.x += (dx / d) * push; p.z += (dz / d) * push;
          }
        }
      }
    }
  }

  bind() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      this.keys.add(e.code);
      if (e.code === 'Escape' && !document.pointerLockElement) this.onExit?.();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    this.dom.addEventListener('click', () => {
      if (this.enabled && !this.isTouch && !document.pointerLockElement) this.dom.requestPointerLock?.();
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.dom) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0022, -1.35, 1.35);
    });
    // drag-to-look for mouse users without pointer lock and for touch
    this.dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'touch') this.isTouch = true;
      if (document.pointerLockElement === this.dom) return;
      if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45 && this.joy.id === null) {
        this.joy.id = e.pointerId; this.joy.ox = e.clientX; this.joy.oy = e.clientY;
        this.showJoystick(e.clientX, e.clientY);
      } else if (this.look.id === null && e.pointerType === 'touch') {
        this.look.id = e.pointerId; this.look.x = e.clientX; this.look.y = e.clientY;
      }
    });
    this.dom.addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      if (e.pointerId === this.joy.id) {
        const dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
        const l = Math.min(1, Math.hypot(dx, dy) / 55);
        const a = Math.atan2(dy, dx);
        this.joy.x = Math.cos(a) * l; this.joy.y = Math.sin(a) * l;
        this.moveKnob(Math.cos(a) * l * 55, Math.sin(a) * l * 55);
      } else if (e.pointerId === this.look.id) {
        this.yaw -= (e.clientX - this.look.x) * 0.005;
        this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - this.look.y) * 0.005, -1.3, 1.3);
        this.look.x = e.clientX; this.look.y = e.clientY;
      }
    });
    const end = (e) => {
      if (e.pointerId === this.joy.id) { this.joy.id = null; this.joy.x = this.joy.y = 0; this.hideJoystick(); }
      if (e.pointerId === this.look.id) this.look.id = null;
    };
    this.dom.addEventListener('pointerup', end);
    this.dom.addEventListener('pointercancel', end);
  }

  showJoystick(x, y) {
    if (!this.joyEl) {
      this.joyEl = document.createElement('div');
      this.joyEl.className = 'joystick';
      this.joyEl.innerHTML = '<div class="knob"></div>';
      document.body.appendChild(this.joyEl);
    }
    this.joyEl.style.display = 'block';
    this.joyEl.style.left = `${x - 60}px`;
    this.joyEl.style.top = `${y - 60}px`;
    this.moveKnob(0, 0);
  }

  moveKnob(dx, dy) {
    if (this.joyEl) this.joyEl.firstChild.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  hideJoystick() {
    if (this.joyEl) this.joyEl.style.display = 'none';
  }

  enter(pos, yaw) {
    if (pos) this.pos.copy(pos);
    if (yaw !== undefined) this.yaw = yaw;
    this.pitch = -0.05;
    this.pos.y = this.floorAt(this.pos.x, this.pos.z, this.pos.y + 0.5);
    this.enabled = true;
    this.apply();
  }

  exit() {
    this.enabled = false;
    this.keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    this.hideJoystick();
  }

  teleport(x, z, level, yaw) {
    this.pos.set(x, level, z);
    if (yaw !== undefined) this.yaw = yaw;
    this.pos.y = this.floorAt(x, z, level + 0.1);
    this.apply();
  }

  update(dt) {
    if (!this.enabled) return;
    dt = Math.min(dt, 0.05);
    let f = 0, s = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyA')) s -= 1;
    if (k.has('KeyD')) s += 1;
    if (k.has('ArrowLeft')) this.yaw += 1.8 * dt;
    if (k.has('ArrowRight')) this.yaw -= 1.8 * dt;
    f -= this.joy.y; s += this.joy.x;
    const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? 3.2 : 1.6);
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const next = this.pos.clone().addScaledVector(fwd, f * speed * dt).addScaledVector(right, s * speed * dt);
    // climb or fall to the walking surface
    const target = this.floorAt(next.x, next.z, this.pos.y);
    if (!this.noclip) {
      if (target > this.pos.y + STEP_UP) { next.x = this.pos.x; next.z = this.pos.z; }
      this.collide(next);
    }
    const ground = this.floorAt(next.x, next.z, this.pos.y);
    if (ground < next.y - 0.01) {
      this.vy -= 9.8 * dt;
      next.y = Math.max(ground, next.y + this.vy * dt);
      if (next.y - ground < 0.4 && f !== 0) next.y = THREE.MathUtils.lerp(next.y, ground, 0.5);
    } else {
      this.vy = 0;
      next.y = THREE.MathUtils.lerp(this.pos.y, ground, Math.min(1, dt * 14));
      if (Math.abs(next.y - ground) < 0.005) next.y = ground;
    }
    this.pos.copy(next);
    this.apply();
  }

  apply() {
    const c = this.camera;
    c.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    c.rotation.order = 'YXZ';
    c.rotation.set(this.pitch, this.yaw, 0);
    this.onMove?.(this.pos, this.yaw);
  }

  get level() {
    return this.pos.y > 2 ? 'upper' : 'ground';
  }
}
