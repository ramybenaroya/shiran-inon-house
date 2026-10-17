import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Small deterministic noise helpers for procedural textures
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeValueNoise(size, seed) {
  const rnd = mulberry32(seed);
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const lerp = (a, b, t) => a + (b - a) * t;
  const fade = (t) => t * t * (3 - 2 * t);
  // tileable value noise sampled at (x, y) in grid units
  return function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const x0 = ((xi % size) + size) % size, y0 = ((yi % size) + size) % size;
    const x1 = (x0 + 1) % size, y1 = (y0 + 1) % size;
    const a = g[y0 * size + x0], b = g[y0 * size + x1];
    const c = g[y1 * size + x0], d = g[y1 * size + x1];
    return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
  };
}

function fbm(noise, x, y, oct, period) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    v += amp * noise((x * f) % (period * f), (y * f) % (period * f));
    norm += amp; amp *= 0.5; f *= 2;
  }
  return v / norm;
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Build a tangent-space normal map from a height field (Float32Array 0..1).
function heightToNormal(height, w, h, strength) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const at = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function canvasTexture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------
// Jerusalem stone – ashlar courses of cream limestone with chiselled faces.
// The texture covers 2.0 m x 2.0 m and tiles seamlessly.
// ---------------------------------------------------------------------------
function jerusalemStone() {
  const W = 1024, H = 1024, M = 2.0; // meters covered
  const px = W / M;
  const color = canvas(W, H);
  const ctx = color.getContext('2d');
  const height = new Float32Array(W * H);
  const rough = canvas(W, H);
  const rctx = rough.getContext('2d');
  const rnd = mulberry32(7);
  const noise = makeValueNoise(64, 11);
  const noise2 = makeValueNoise(256, 23);

  const courses = [0.35, 0.3, 0.35, 0.4, 0.3, 0.3];
  const joint = 0.008 * px;
  const img = ctx.createImageData(W, H);
  const blockId = new Int32Array(W * H).fill(-1);
  const blocks = [];
  let y0 = 0;
  for (const ch of courses) {
    const y1 = y0 + ch;
    let x = rnd() * 0.5;
    const start = x;
    while (x < start + M - 0.2) {
      let len = 0.35 + rnd() * 0.5;
      if (x + len > start + M - 0.2) len = start + M - x;
      const tone = rnd();
      blocks.push({ x0: x, x1: x + len, y0, y1, tone, tilt: rnd() * 6.28 });
      x += len;
    }
    // close the course seamlessly
    blocks[blocks.length - 1].x1 = start + M;
    y0 = y1;
  }
  blocks.forEach((b, id) => {
    const X0 = Math.round(b.x0 * px), X1 = Math.round(b.x1 * px);
    const Y0 = Math.round(b.y0 * px), Y1 = Math.round(b.y1 * px);
    for (let yy = Y0; yy < Y1; yy++) {
      for (let xx = X0; xx < X1; xx++) {
        const wx = ((xx % W) + W) % W;
        const wy = ((yy % H) + H) % H;
        const inJoint = xx - X0 < joint || X1 - xx <= joint || yy - Y0 < joint || Y1 - yy <= joint;
        blockId[wy * W + wx] = inJoint ? -2 : id;
      }
    }
  });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const id = blockId[i];
      let r, g, b, h;
      if (id < 0) {
        const n = noise2(x * 0.5, y * 0.5);
        r = 196 + n * 14; g = 186 + n * 14; b = 168 + n * 12; h = 0.0;
      } else {
        const bl = blocks[id];
        const big = fbm(noise, x / 40, y / 40, 4, 64 / 1);
        const fine = noise2(x * 0.9, y * 0.9);
        // chisel ("tubza") strokes – short diagonal grooves
        const s = Math.sin((x * Math.cos(bl.tilt) + y * Math.sin(bl.tilt)) * 0.9 + fine * 6);
        const chisel = Math.max(0, s) * 0.12;
        const pit = fine > 0.93 ? -0.25 : 0;
        const base = 0.9 + (bl.tone - 0.5) * 0.1 + (big - 0.5) * 0.1 + pit * 0.3;
        // warm cream with a slight pink/gold variation per block
        const warm = (bl.tone - 0.5) * 10;
        r = 238 * base + warm + 4; g = 224 * base + warm * 0.4; b = 190 * base - warm * 0.3;
        h = 0.55 + big * 0.25 + chisel + pit * 0.5 + fine * 0.08;
      }
      const j = i * 4;
      img.data[j] = Math.min(255, r); img.data[j + 1] = Math.min(255, g);
      img.data[j + 2] = Math.min(255, b); img.data[j + 3] = 255;
      height[i] = h;
    }
  }
  ctx.putImageData(img, 0, 0);
  rctx.fillStyle = '#d8d8d8';
  rctx.fillRect(0, 0, W, H);
  const normal = heightToNormal(height, W, H, 2.2);
  return { map: canvasTexture(color), normalMap: canvasTexture(normal, false), size: M };
}

// ---------------------------------------------------------------------------
// Large-format porcelain tiles with subtle stone veining
// ---------------------------------------------------------------------------
function porcelainTiles({ tile = 0.8, tiles = 3, base = [222, 216, 206], vein = 0.06, joint = '#b9b3a8', seed = 3 }) {
  const W = 1024;
  const M = tile * tiles;
  const px = W / M;
  const c = canvas(W);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, W);
  const noise = makeValueNoise(128, seed);
  const height = new Float32Array(W * W);
  const rnd = mulberry32(seed + 5);
  const tones = Array.from({ length: tiles * tiles }, () => (rnd() - 0.5) * 0.04);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const tx = Math.floor(x / (tile * px)), ty = Math.floor(y / (tile * px));
      const v = fbm(noise, x / 32, y / 32, 5, 128 / 32 * 32);
      const veins = Math.abs(Math.sin((x * 0.012 + y * 0.004) + v * 9));
      const veinV = Math.pow(1 - veins, 12) * vein * 255;
      const t = 1 + tones[ty * tiles + tx] + (v - 0.5) * 0.05;
      const i = (y * W + x) * 4;
      img.data[i] = base[0] * t - veinV;
      img.data[i + 1] = base[1] * t - veinV;
      img.data[i + 2] = base[2] * t - veinV * 0.9;
      img.data[i + 3] = 255;
      height[y * W + x] = 1;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = joint;
  ctx.lineWidth = Math.max(1.5, 0.003 * px);
  for (let k = 0; k <= tiles; k++) {
    const p = k * tile * px;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
    for (let o = -2; o <= 2; o++) {
      for (let s = 0; s < W; s++) {
        const a = Math.round(p + o);
        if (a >= 0 && a < W) { height[s * W + a] = 0.6; height[a * W + s] = 0.6; }
      }
    }
  }
  const normal = heightToNormal(height, W, W, 1.5);
  return { map: canvasTexture(c), normalMap: canvasTexture(normal, false), size: M };
}

// Rectangular wall tiles (bathrooms)
function wallTiles({ w = 0.3, h = 0.6, base = [228, 224, 216], joint = '#c9c4ba', seed = 9 }) {
  const W = 1024, M = 1.2;
  const px = W / M;
  const c = canvas(W);
  const ctx = c.getContext('2d');
  const noise = makeValueNoise(64, seed);
  const rnd = mulberry32(seed);
  const height = new Float32Array(W * W).fill(1);
  for (let ty = 0; ty < M / h; ty++) {
    for (let tx = 0; tx < M / w; tx++) {
      const t = 1 + (rnd() - 0.5) * 0.05;
      ctx.fillStyle = `rgb(${base[0] * t},${base[1] * t},${base[2] * t})`;
      ctx.fillRect(tx * w * px, ty * h * px, w * px, h * px);
    }
  }
  const img = ctx.getImageData(0, 0, W, W);
  for (let i = 0; i < W * W; i++) {
    const n = (noise((i % W) / 24, Math.floor(i / W) / 24) - 0.5) * 10;
    img.data[i * 4] += n; img.data[i * 4 + 1] += n; img.data[i * 4 + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = joint;
  const jw = Math.max(2, 0.002 * px);
  for (let x = 0; x <= M / w; x++) {
    ctx.fillRect(x * w * px - jw / 2, 0, jw, W);
    for (let y = 0; y < W; y++) for (let o = -1; o <= 1; o++) {
      const a = Math.round(x * w * px + o); if (a >= 0 && a < W) height[y * W + a] = 0.5;
    }
  }
  for (let y = 0; y <= M / h; y++) {
    ctx.fillRect(0, y * h * px - jw / 2, W, jw);
    for (let x = 0; x < W; x++) for (let o = -1; o <= 1; o++) {
      const a = Math.round(y * h * px + o); if (a >= 0 && a < W) height[a * W + x] = 0.5;
    }
  }
  const normal = heightToNormal(height, W, W, 1.2);
  return { map: canvasTexture(c), normalMap: canvasTexture(normal, false), size: M };
}

// Clumpy foliage relief for the cypress crowns
function foliageNormal() {
  const W = 256;
  const noise = makeValueNoise(64, 5);
  const noise2 = makeValueNoise(64, 9);
  const h = new Float32Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const a = fbm(noise, x / 8, y / 8, 3, 32);
    const b = noise2(x / 3, y / 3);
    h[y * W + x] = Math.pow(a, 1.6) * 0.8 + b * 0.25;
  }
  return canvasTexture(heightToNormal(h, W, W, 6), false);
}

// Roller-shutter slats (Israeli "trisim")
function shutterSlats() {
  const W = 64, H = 256;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const height = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const p = (y % 16) / 16;
    const v = Math.sin(p * Math.PI);
    const shade = 150 + v * 60;
    ctx.fillStyle = `rgb(${shade * 0.86},${shade * 0.86},${shade * 0.88})`;
    ctx.fillRect(0, y, W, 1);
    for (let x = 0; x < W; x++) height[y * W + x] = v;
  }
  const normal = heightToNormal(height, W, H, 3);
  return { map: canvasTexture(c), normalMap: canvasTexture(normal, false), size: 0.6 };
}

// Berber-style rug with a soft geometric pattern
function rugTexture(colors, seed = 1) {
  const W = 512;
  const c = canvas(W);
  const ctx = c.getContext('2d');
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, W, W);
  ctx.strokeStyle = colors[1];
  ctx.lineWidth = 6;
  const n = 6;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cx = (i + 0.5) * W / n, cy = (j + 0.5) * W / n, r = W / n * 0.38;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.strokeStyle = colors[2];
  ctx.lineWidth = 10;
  ctx.strokeRect(18, 18, W - 36, W - 36);
  const img = ctx.getImageData(0, 0, W, W);
  const rnd = mulberry32(seed);
  for (let i = 0; i < W * W; i++) {
    const n = (rnd() - 0.5) * 22;
    img.data[i * 4] += n; img.data[i * 4 + 1] += n; img.data[i * 4 + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const t = canvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Abstract painting for wall art
export function paintingTexture(seed, palette) {
  const W = 512, H = 384;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = palette[1 + (i % (palette.length - 1))];
    ctx.globalAlpha = 0.55 + rnd() * 0.4;
    ctx.beginPath();
    if (rnd() > 0.5) {
      ctx.arc(rnd() * W, rnd() * H, 30 + rnd() * 120, 0, Math.PI * 2);
    } else {
      ctx.ellipse(rnd() * W, rnd() * H, 40 + rnd() * 160, 20 + rnd() * 60, rnd() * 3, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // hills line, a nod to the Jerusalem landscape
  ctx.strokeStyle = palette[palette.length - 1];
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const y = H * 0.68 + Math.sin(x * 0.015 + seed) * 22 + Math.sin(x * 0.041) * 9;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  return canvasTexture(c);
}

// "Welcome home" screen for the TV
export function welcomeScreenTexture(lines) {
  const W = 1024, H = 576;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#16324a');
  g.addColorStop(0.55, '#c4734a');
  g.addColorStop(1, '#f1c27d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // stylised hills
  ctx.fillStyle = 'rgba(30,40,40,0.35)';
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) ctx.lineTo(x, H * 0.72 + Math.sin(x * 0.008) * 40 + Math.sin(x * 0.021) * 14);
  ctx.lineTo(W, H);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.font = '600 78px "Heebo", "Assistant", "Arial Hebrew", sans-serif';
  ctx.fillText(lines[0], W / 2, H * 0.42);
  ctx.font = '400 40px "Heebo", "Assistant", "Arial Hebrew", sans-serif';
  ctx.fillText(lines[1], W / 2, H * 0.58);
  const t = canvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------------------------------------------------------------------------
// Material library
// ---------------------------------------------------------------------------
export function createMaterials(renderer, manager) {
  const loader = new THREE.TextureLoader(manager);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const base = import.meta.env.BASE_URL + 'textures/';

  function tex(name, srgb) {
    const t = loader.load(base + name);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(8, maxAniso);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function pbr(id, size, opts = {}) {
    const m = new THREE.MeshStandardMaterial({
      map: tex(`${id}_diff.jpg`, true),
      normalMap: tex(`${id}_nor_gl.jpg`, false),
      roughnessMap: tex(`${id}_rough.jpg`, false),
      ...opts,
    });
    m.userData.uvScale = 1 / size;
    return m;
  }
  function withScale(m, size) {
    m.userData.uvScale = 1 / size;
    return m;
  }

  const stone = jerusalemStone();
  const porcelain = porcelainTiles({});
  const bathFloor = porcelainTiles({ tile: 0.6, tiles: 4, base: [122, 120, 116], vein: 0.03, joint: '#5d5a55', seed: 17 });
  const bathWall = wallTiles({});
  const slats = shutterSlats();

  const plaster = {
    normalMap: tex('plastered_wall_nor_gl.jpg', false),
  };

  const M = {};
  M.stone = withScale(new THREE.MeshStandardMaterial({
    map: stone.map, normalMap: stone.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.88,
  }), stone.size);
  M.stone.color.setRGB(1.12, 1.1, 1.06);
  M.coping = new THREE.MeshStandardMaterial({ color: 0xece2cc, roughness: 0.7, normalMap: stone.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) });
  M.coping.userData.uvScale = 0.5;
  M.paint = withScale(new THREE.MeshStandardMaterial({
    color: 0xf5efe5, roughness: 0.93, normalMap: plaster.normalMap, normalScale: new THREE.Vector2(0.12, 0.12),
  }), 2.5);
  M.ceiling = new THREE.MeshStandardMaterial({ color: 0xf7f6f3, roughness: 0.95 });
  M.wallTop = new THREE.MeshStandardMaterial({ color: 0x3b3a38, roughness: 0.9 });
  M.porcelain = withScale(new THREE.MeshStandardMaterial({
    map: porcelain.map, normalMap: porcelain.normalMap, roughness: 0.32, envMapIntensity: 0.8,
  }), porcelain.size);
  M.bathTile = withScale(new THREE.MeshStandardMaterial({
    map: bathFloor.map, normalMap: bathFloor.normalMap, roughness: 0.45,
  }), bathFloor.size);
  M.bathWall = withScale(new THREE.MeshStandardMaterial({
    map: bathWall.map, normalMap: bathWall.normalMap, roughness: 0.22,
  }), bathWall.size);
  M.oak = pbr('oak_wood_planks', 2.0, { roughness: 0.75 });
  M.concrete = pbr('concrete_floor_02', 3.0, { color: 0xd8d6d0 });
  M.roof = withScale(new THREE.MeshStandardMaterial({
    color: 0xdcdad3, roughness: 0.92, normalMap: tex('concrete_floor_02_nor_gl.jpg', false), normalScale: new THREE.Vector2(0.5, 0.5),
  }), 3.0);
  const roofTiles = porcelainTiles({ tile: 0.5, tiles: 4, base: [206, 203, 196], vein: 0.0, joint: '#a19d95', seed: 31 });
  M.roofTiles = withScale(new THREE.MeshStandardMaterial({
    map: roofTiles.map, normalMap: roofTiles.normalMap, roughness: 0.85,
  }), roofTiles.size);
  M.paving = pbr('rectangular_paving', 2.4, { color: 0xf2e9da });
  M.gravel = pbr('gravel_floor', 2.0, { color: 0xe8dcc6 });
  M.grass = pbr('leafy_grass', 3.0, { color: 0xa9c27a });
  M.bark = pbr('bark_brown_02', 1.2, { color: 0x9c9284 });
  M.veneer = pbr('white_oak_veneer', 1.2, { roughness: 0.6 });
  M.veneerDark = pbr('white_oak_veneer', 1.2, { roughness: 0.55, color: 0x8d6f55 });
  M.fabric = withScale(new THREE.MeshStandardMaterial({
    color: 0xe9e2d4, roughness: 1, normalMap: tex('denim_fabric_nor_gl.jpg', false), normalScale: new THREE.Vector2(0.6, 0.6),
  }), 0.5);
  M.fabricSofa = M.fabric.clone();
  M.fabricSofa.color.set(0xd9d0c1);
  M.fabricGreen = M.fabric.clone(); M.fabricGreen.color.set(0x7c8560);
  M.fabricTerra = M.fabric.clone(); M.fabricTerra.color.set(0xc0714f);
  M.fabricMustard = M.fabric.clone(); M.fabricMustard.color.set(0xcf9f45);
  M.fabricNavy = M.fabric.clone(); M.fabricNavy.color.set(0x3c4a63);
  M.fabricBlush = M.fabric.clone(); M.fabricBlush.color.set(0xd9a89a);
  M.fabricSand = M.fabric.clone(); M.fabricSand.color.set(0xcdb99c);
  M.fabricNavySoft = M.fabric.clone(); M.fabricNavySoft.color.set(0x5d6f8c);
  M.linen = new THREE.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.95 });
  M.frame = new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.42, metalness: 0.55 });
  M.blackMetal = new THREE.MeshStandardMaterial({ color: 0x1e1e20, roughness: 0.38, metalness: 0.7 });
  M.steelGrey = new THREE.MeshStandardMaterial({ color: 0xc4c8cb, roughness: 0.32, metalness: 0.45 });
  M.chrome = new THREE.MeshStandardMaterial({ color: 0xe9e9ea, roughness: 0.12, metalness: 1.0 });
  M.brass = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.3, metalness: 1.0 });
  M.ceramic = new THREE.MeshStandardMaterial({ color: 0xfbfbfa, roughness: 0.12 });
  M.quartz = new THREE.MeshStandardMaterial({ color: 0xefede8, roughness: 0.2 });
  M.cabinetWhite = new THREE.MeshStandardMaterial({ color: 0xf1efea, roughness: 0.4 });
  M.cabinetOlive = new THREE.MeshStandardMaterial({ color: 0x66704f, roughness: 0.55 });
  M.cabinetSage = new THREE.MeshStandardMaterial({ color: 0x8c9a7e, roughness: 0.5 });
  const zel = wallTiles({ w: 0.1, h: 0.1, base: [150, 176, 160], joint: '#e9e5dc', seed: 41 });
  M.zellige = withScale(new THREE.MeshStandardMaterial({
    map: zel.map, normalMap: zel.normalMap, roughness: 0.15,
  }), zel.size);
  M.door = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.45 });
  M.entryDoor = M.veneerDark;
  M.mamadSteel = new THREE.MeshStandardMaterial({ color: 0xb9bcbe, roughness: 0.5, metalness: 0.5 });
  M.glass = new THREE.MeshPhysicalMaterial({
    color: 0xd5e6ec, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.1,
    envMapIntensity: 0.7, depthWrite: false, side: THREE.DoubleSide,
  });
  M.frosted = new THREE.MeshPhysicalMaterial({
    color: 0xf2f4f4, roughness: 0.6, transparent: true, opacity: 0.72, side: THREE.DoubleSide,
  });
  M.showerGlass = new THREE.MeshPhysicalMaterial({
    color: 0xe3eef0, roughness: 0.05, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide,
  });
  M.shutter = withScale(new THREE.MeshStandardMaterial({
    map: slats.map, normalMap: slats.normalMap, roughness: 0.5, metalness: 0.3, color: 0xeeeeee,
  }), slats.size);
  M.screen = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.15, metalness: 0.2 });
  M.rugLiving = new THREE.MeshStandardMaterial({ map: rugTexture(['#e9e1d2', '#b9a78f', '#8b6f55'], 4), roughness: 1 });
  M.rugMaster = new THREE.MeshStandardMaterial({ map: rugTexture(['#d8c8b8', '#a98a79', '#7a5d52'], 8), roughness: 1 });
  M.rugPlay = new THREE.MeshStandardMaterial({ map: rugTexture(['#a9c4c2', '#f1e7c9', '#e09f7d'], 12), roughness: 1 });
  M.rugSage = new THREE.MeshStandardMaterial({ map: rugTexture(['#dfe3d3', '#9aa889', '#d9a89a'], 16), roughness: 1 });
  M.leaf = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, vertexColors: true });
  const fol = foliageNormal();
  fol.repeat.set(7, 24);
  M.cypress = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, vertexColors: true, normalMap: fol, normalScale: new THREE.Vector2(1.6, 1.6) });
  M.pot = new THREE.MeshStandardMaterial({ color: 0xb8714d, roughness: 0.85 });
  M.potGrey = new THREE.MeshStandardMaterial({ color: 0x9a968f, roughness: 0.8 });
  M.soil = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 });
  M.lampShade = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.9, emissive: 0xffd9a0, emissiveIntensity: 0 });
  M.bulb = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffd9a0, emissiveIntensity: 0 });
  M.solar = new THREE.MeshStandardMaterial({ color: 0x1b2633, roughness: 0.2, metalness: 0.4 });
  M.white = new THREE.MeshStandardMaterial({ color: 0xf6f6f4, roughness: 0.6 });
  M.water = new THREE.MeshStandardMaterial({ color: 0x5aa2b5, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85 });
  M.cedar = new THREE.MeshStandardMaterial({ color: 0xb7835a, roughness: 0.7, map: M.veneer.map });
  M.terrain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  M.toy = [0xe0624a, 0xf2c14e, 0x5fa8d3, 0x7bc47f, 0xb388eb].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }),
  );

  // Materials that receive world-space UVs from the builders
  for (const m of Object.values(M)) {
    if (m && m.isMaterial && m.userData.uvScale === undefined) m.userData.uvScale = 1;
  }
  return M;
}
