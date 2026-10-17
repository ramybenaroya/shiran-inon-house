import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Bake every static mesh under `root` into one mesh per material (and per
// attribute layout / shadow flags). Lights, instanced meshes and points stay
// as they are. Cuts ~1400 furniture and garden meshes down to a few dozen
// draw calls, which matters on phones.
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
    if (Array.isArray(o.material)) return;
    const g = o.geometry;
    const attrs = Object.keys(g.attributes).sort().join(',');
    const key = `${o.material.uuid}|${attrs}|${g.index ? 1 : 0}|${o.castShadow ? 1 : 0}|${o.receiveShadow ? 1 : 0}`;
    let b = buckets.get(key);
    if (!b) { b = { mat: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] }; buckets.set(key, b); }
    const geo = g.clone();
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    geo.applyMatrix4(m);
    // mirrored placements flip winding; keep faces pointing outward
    if (m.determinant() < 0 && geo.index) {
      const idx = geo.index.array;
      for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    }
    for (const name of Object.keys(geo.morphAttributes)) delete geo.morphAttributes[name];
    b.geos.push(geo);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    root.add(mesh);
    for (const g of b.geos) g.dispose();
  }
  // drop empty groups left behind
  const empties = [];
  root.traverse((o) => { if (o !== root && o.isGroup && o.children.length === 0) empties.push(o); });
  for (const e of empties) e.parent?.remove(e);
}
