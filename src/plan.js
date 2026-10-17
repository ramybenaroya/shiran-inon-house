// House plan data, in meters.
// Plan coordinates: x grows east, z grows south (north is -z). Origin = the
// party line of the semi-detached pair (centre line of the shared west wall)
// on the line of the north facade. Values were measured from the architect's
// 1:50 vector drawing (one A2 sheet with both floors side by side); the upper
// floor is aligned to the ground floor by its stacked exterior walls.
// Heights are not stated on the electrical plan: 3.25 m floor to floor (18
// risers of the drawn U-stair), ceilings 2.85 / 5.90, roof slab top 6.15.

export const LEVELS = {
  ground: 0,
  groundCeiling: 2.85,
  upper: 3.25,
  upperCeiling: 5.9,
  roof: 6.15,
  roofParapet: 6.4,
  terraceParapet: 4.3,
  outside: -0.2,
  courtyard: -0.04,
  lawn: -0.26,
};

// ---------------------------------------------------------------------------
// Walls: [x0, z0, x1, z1]
// ---------------------------------------------------------------------------
export const WALLS = {
  ground: [
    // party wall (this house's half; the twin mirrors it) + kitchen window pier
    [0, 3.726, 0.1, 12.008],
    [0, 3.523, 0.152, 3.726],
    // kitchen north window 0.152 .. 1.047, bedroom-wing south-west corner
    [1.047, 3.523, 1.303, 3.925],
    // bedroom wing west wall
    [1.095, 0, 1.303, 3.523],
    // north facade: bedroom window 2.149 .. 3.649, bath window 5.377 .. 6.299,
    // safe-room window 8.601 .. 9.597
    [1.303, 0, 2.149, 0.203],
    [3.649, 0, 5.377, 0.203],
    [6.299, 0, 7.397, 0.203],
    [7.397, 0, 8.601, 0.304],
    [9.597, 0, 11.0, 0.304],
    // bedroom south wall (wardrobe recess) and the fridge niche behind it
    [1.303, 3.823, 3.446, 3.925],
    [3.446, 3.62, 4.495, 3.726],
    [3.446, 3.726, 3.552, 3.925],
    // bedroom east wall (en-suite door 0.287 .. 1.182, door 2.624 .. 3.519)
    [4.495, 0.203, 4.601, 0.287],
    [4.495, 1.182, 4.601, 2.624],
    [4.495, 3.519, 4.601, 4.829],
    // bathroom / laundry partitions
    [4.601, 1.751, 6.003, 1.852],
    [5.898, 1.852, 6.003, 2.152],
    [5.898, 2.152, 7.397, 2.306],
    // safe room (ממ"ד) – reinforced concrete, door 2.58 .. 3.373
    [7.397, 0.304, 7.604, 2.58],
    [7.397, 3.373, 7.604, 3.726],
    [7.604, 3.523, 10.7, 3.726],
    [10.312, 3.726, 10.7, 3.828],
    [10.7, 0.304, 11.0, 3.828],
    // corridor / guest WC (door 3.828 .. 4.621)
    [6.246, 3.523, 7.397, 3.726],
    [6.246, 3.726, 6.347, 3.828],
    [6.246, 4.621, 6.347, 4.829],
    [6.347, 4.723, 8.296, 4.829],
    [8.296, 4.723, 8.98, 4.829], // between the flights, up to the landing
    // coat closet
    [4.601, 3.62, 5.201, 3.726],
    [4.601, 4.723, 5.201, 4.829],
    // technical space east wall (double doors 4.026 .. 5.521) and stair south wall
    [9.95, 3.726, 10.312, 3.828],
    [9.95, 3.828, 10.153, 4.026],
    [9.95, 5.521, 10.153, 5.927],
    [6.047, 5.724, 9.95, 5.927],
    // entrance (door 6.037 .. 7.333)
    [6.047, 5.927, 6.25, 6.037],
    [6.047, 7.333, 6.25, 7.708],
    [5.39, 7.501, 6.047, 7.708],
    // electrical niche opening into the living room
    [4.985, 7.501, 5.39, 7.607],
    [4.985, 8.453, 5.39, 8.559],
    // living room east facade (sliding door 8.559 .. 10.954)
    [5.39, 7.708, 5.598, 8.559],
    [5.598, 8.154, 5.849, 8.559],
    [5.395, 10.954, 5.849, 11.364],
    [5.395, 11.364, 5.584, 12.008],
    // south facade (sliding door 3.3 .. 4.892)
    [0.1, 11.8, 3.3, 12.008],
    [4.892, 11.8, 5.395, 12.008],
  ],
  upper: [
    // north facade: west bedroom set back 0.3 m (window 2.198 .. 3.393)
    [1.095, 0.3, 2.198, 0.503],
    [3.393, 0.3, 4.394, 0.503],
    [4.394, 0, 4.601, 0.503],
    [4.601, 0, 5.399, 0.203], // bath window 5.399 .. 6.294
    [6.294, 0, 8.499, 0.203], // bedroom window 8.499 .. 9.699
    [9.699, 0, 11.0, 0.203],
    // west bedroom
    [1.095, 0.503, 1.298, 3.519],
    [1.095, 3.519, 4.601, 3.722],
    [4.495, 0.503, 4.601, 2.553], // door 2.553 .. 3.448
    [4.495, 3.448, 4.601, 3.519],
    // hall west wall (sliding door to the roof 3.925 .. 4.921) and south wall
    [4.394, 3.722, 4.601, 3.925],
    [4.394, 4.921, 4.601, 5.922],
    [4.601, 5.719, 9.946, 5.922],
    // bathroom (door 5.351 .. 6.145)
    [4.601, 2.399, 5.351, 2.505],
    [6.145, 2.399, 7.295, 2.505],
    [7.295, 0.203, 7.397, 2.553], // east bedroom door 2.553 .. 3.448
    [7.295, 3.448, 7.397, 3.523],
    // east bedroom
    [6.793, 3.519, 10.797, 3.726],
    [10.797, 0.203, 11.0, 3.823],
    // stair core east wall (window 4.471 .. 5.067)
    [9.946, 3.726, 10.797, 3.823],
    [9.946, 3.823, 10.153, 4.471],
    [9.946, 5.067, 10.153, 5.922],
    // partition at the west end of the stair void
    [6.793, 4.718, 6.899, 5.719],
  ],
};

// Partitions that stop under the stairs. [x0, z0, x1, z1, top]
export const LOW_WALLS = {
  ground: [
    [8.296, 3.726, 8.446, 4.723, 2.15], // WC / technical space, under flight 2
    [8.98, 4.723, 9.064, 4.829, 1.75], // under the landing
  ],
};

// The wall between the two flights continues above the upper floor as a guard.
export const STAIR_DIVIDER = [6.899, 4.723, 8.98, 4.829];

// ---------------------------------------------------------------------------
// Rooms. `rects` must not overlap within a floor (they also drive floor
// finishes). `floor` and `wall` pick finishes from materials.js.
// ---------------------------------------------------------------------------
export const ROOMS = {
  ground: [
    { id: 'master', he: 'חדר שינה', en: 'Bedroom', floor: 'oak', wall: 'paint',
      rects: [[1.303, 0.203, 4.495, 3.62], [1.303, 3.62, 3.446, 3.823]], label: [3.1, 2.75] },
    { id: 'bath', he: 'חדר רחצה', en: 'Bathroom', floor: 'bathTile', wall: 'bathWall',
      rects: [[4.601, 0.203, 7.397, 1.751], [6.003, 1.751, 7.397, 2.152]], label: [5.6, 0.95] },
    { id: 'corridor', he: 'מסדרון', en: 'Corridor', floor: 'porcelain', wall: 'paint', hidden: true,
      rects: [[4.601, 1.852, 5.898, 3.523], [5.898, 2.306, 7.397, 3.523], [4.601, 3.523, 6.246, 3.62], [5.201, 3.62, 6.246, 4.829]] },
    { id: 'closet', he: 'ארון', en: 'Closet', floor: 'porcelain', wall: 'paint', hidden: true,
      rects: [[4.601, 3.726, 5.201, 4.723]] },
    { id: 'mamad', he: 'ממ״ד', en: 'Safe room', floor: 'oak', wall: 'paint',
      rects: [[7.604, 0.304, 10.7, 3.523]], label: [8.9, 1.9] },
    { id: 'wc', he: 'שירותים', en: 'Guest WC', floor: 'bathTile', wall: 'paint',
      rects: [[6.347, 3.726, 8.296, 4.723]], label: [7.0, 4.25] },
    { id: 'tech', he: 'חלל טכני', en: 'Utility', floor: 'concrete', wall: 'paint', hidden: true,
      rects: [[8.446, 3.726, 9.95, 4.723], [8.98, 4.723, 9.95, 5.724]] },
    { id: 'stair', he: 'מדרגות', en: 'Stairs', floor: 'porcelain', wall: 'paint', hidden: true,
      rects: [[6.181, 4.829, 8.98, 5.724]] },
    { id: 'kitchen', he: 'מטבח', en: 'Kitchen', floor: 'porcelain', wall: 'paint',
      rects: [[0.1, 3.726, 1.047, 3.925], [3.552, 3.726, 4.495, 3.925], [0.1, 3.925, 4.495, 7.5]], label: [2.3, 5.2] },
    { id: 'foyer', he: 'כניסה', en: 'Entrance', floor: 'porcelain', wall: 'paint',
      rects: [[4.495, 4.829, 6.047, 7.501], [6.047, 4.829, 6.181, 5.724]], label: [5.3, 6.4] },
    { id: 'living', he: 'סלון', en: 'Living room', floor: 'porcelain', wall: 'paint',
      rects: [[0.1, 7.5, 4.985, 11.8], [4.985, 8.559, 5.395, 11.8], [4.985, 7.607, 5.39, 8.453]], label: [2.7, 9.9] },
  ],
  upper: [
    { id: 'bedW', he: 'חדר שינה מערבי', en: 'West bedroom', floor: 'oak', wall: 'paint',
      rects: [[1.298, 0.503, 4.495, 3.519]], label: [2.9, 2.0] },
    { id: 'uBath', he: 'חדר רחצה', en: 'Bathroom', floor: 'bathTile', wall: 'bathWall',
      rects: [[4.601, 0.203, 7.295, 2.399]], label: [6.0, 1.4] },
    { id: 'bedE', he: 'חדר שינה מזרחי', en: 'East bedroom', floor: 'oak', wall: 'paint',
      rects: [[7.397, 0.203, 10.797, 3.519]], label: [9.0, 1.9] },
    { id: 'uHall', he: 'מבואה', en: 'Hall', floor: 'porcelain', wall: 'paint',
      rects: [[4.601, 2.505, 7.295, 3.519], [4.601, 3.519, 6.793, 5.719], [6.793, 3.726, 7.311, 4.723]], label: [5.6, 4.5] },
    { id: 'uStair', he: 'חלל מדרגות', en: 'Stairwell', floor: null, wall: 'paint', hidden: true,
      rects: [[7.311, 3.726, 9.946, 4.723], [6.899, 4.723, 9.946, 5.719]] },
  ],
};

// ---------------------------------------------------------------------------
// Openings. `rect` is the opening's footprint inside the wall line.
// sill / head are relative to the floor level of that storey.
// ---------------------------------------------------------------------------
export const WINDOWS = [
  // ground floor
  { floor: 'ground', rect: [2.149, 0, 3.649, 0.203], sill: 0.9, head: 2.2, kind: 'casement', panes: 2, shutter: 0.2 },
  { floor: 'ground', rect: [5.377, 0, 6.299, 0.203], sill: 1.4, head: 2.2, kind: 'casement', panes: 1, frosted: true },
  { floor: 'ground', rect: [8.601, 0, 9.597, 0.304], sill: 1.0, head: 2.1, kind: 'mamad', panes: 1 },
  { floor: 'ground', rect: [0.152, 3.523, 1.047, 3.726], sill: 1.05, head: 2.2, kind: 'casement', panes: 1 },
  { floor: 'ground', rect: [5.39, 8.559, 5.598, 10.954], sill: 0.0, head: 2.4, kind: 'slider', panes: 2, door: true, open: true },
  { floor: 'ground', rect: [3.3, 11.8, 4.892, 12.008], sill: 0.0, head: 2.4, kind: 'slider', panes: 2, door: true, shutter: 0.12 },
  // upper floor
  { floor: 'upper', rect: [2.198, 0.3, 3.393, 0.503], sill: 0.9, head: 2.1, kind: 'slider', panes: 2, shutter: 0.25 },
  { floor: 'upper', rect: [5.399, 0, 6.294, 0.203], sill: 1.4, head: 2.1, kind: 'casement', panes: 1, frosted: true },
  { floor: 'upper', rect: [8.499, 0, 9.699, 0.203], sill: 0.9, head: 2.1, kind: 'slider', panes: 2, shutter: 0.3 },
  { floor: 'upper', rect: [9.946, 4.471, 10.153, 5.067], sill: 0.3, head: 2.1, kind: 'fixed', panes: 1 },
  { floor: 'upper', rect: [4.394, 3.925, 4.601, 4.921], sill: 0.0, head: 2.2, kind: 'slider', panes: 2, door: true, open: true },
];

// Doors. hinge = [x, z] at the jamb; `closed` = unit direction of the leaf
// when closed (along the wall); `open` = direction of the leaf when open.
export const DOORS = [
  { id: 'entry', floor: 'ground', rect: [6.047, 6.037, 6.25, 7.333], head: 2.25, kind: 'entry',
    hinge: [6.12, 7.31], closed: [0, -1], open: [-1, -0.3], width: 0.92 },
  { id: 'tech', floor: 'ground', rect: [9.95, 4.026, 10.153, 5.521], head: 2.0, kind: 'double',
    hinge: [10.153, 4.026], closed: [0, 1], width: 0.747 },
  { id: 'ensuite', floor: 'ground', rect: [4.495, 0.287, 4.601, 1.182], head: 2.1, kind: 'interior',
    hinge: [4.548, 0.287], closed: [0, 1], open: [0.6, 0.8], width: 0.86 },
  { id: 'master', floor: 'ground', rect: [4.495, 2.624, 4.601, 3.519], head: 2.1, kind: 'interior',
    hinge: [4.548, 3.519], closed: [0, -1], open: [-1, 0], width: 0.86 },
  { id: 'mamad', floor: 'ground', rect: [7.397, 2.58, 7.604, 3.373], head: 2.0, kind: 'mamad',
    hinge: [7.397, 3.373], closed: [0, -1], open: [-0.75, -0.66], width: 0.77 },
  { id: 'wc', floor: 'ground', rect: [6.246, 3.828, 6.347, 4.621], head: 2.1, kind: 'interior',
    hinge: [6.297, 3.828], closed: [0, 1], open: [1, 0], width: 0.77 },
  { id: 'bedW', floor: 'upper', rect: [4.495, 2.553, 4.601, 3.448], head: 2.1, kind: 'interior',
    hinge: [4.548, 3.448], closed: [0, -1], open: [-1, 0], width: 0.86 },
  { id: 'uBath', floor: 'upper', rect: [5.351, 2.399, 6.145, 2.505], head: 2.1, kind: 'interior',
    hinge: [5.351, 2.452], closed: [1, 0], open: [0.35, -0.94], width: 0.77 },
  { id: 'bedE', floor: 'upper', rect: [7.295, 2.553, 7.397, 3.448], head: 2.1, kind: 'interior',
    hinge: [7.346, 3.448], closed: [0, -1], open: [1, 0], width: 0.86 },
];

// ---------------------------------------------------------------------------
// Slabs (structural) – rect lists.
// ---------------------------------------------------------------------------
export const SLABS = {
  // roof of the single-storey kitchen / living wing (reached from the upper hall)
  terrace: [
    [0, 3.523, 1.095, 3.722],
    [0, 3.722, 4.394, 5.922],
    [0, 5.922, 6.25, 7.708],
    [0, 7.708, 5.598, 12.008],
  ],
  // floor of the upper storey (stair opening left out)
  upper: [
    [1.095, 0, 11.0, 3.726],
    [10.153, 3.726, 11.0, 3.828],
    [4.394, 3.726, 6.899, 5.922],
    [6.899, 3.726, 7.311, 4.723],
    [6.899, 5.724, 10.153, 5.922],
    [9.946, 3.726, 10.153, 5.724],
  ],
  roof: [
    [1.095, 0.3, 4.394, 3.722],
    [4.394, 0, 11.0, 3.823],
    [4.394, 3.823, 10.153, 5.922],
  ],
  ground: [
    [1.095, 0, 11.0, 3.523],
    [0, 3.523, 11.0, 3.828],
    [0, 3.828, 10.153, 5.927],
    [0, 5.927, 6.25, 7.708],
    [0, 7.708, 5.598, 12.008],
  ],
};

// Stair opening in the upper slab (painted edges)
export const STAIR_VOIDS = [[7.311, 3.726, 9.946, 4.723], [6.899, 4.723, 9.946, 5.724]];

export const PARAPETS = {
  terrace: [
    [0, 3.523, 0.1, 12.008], // on the party wall (the twin adds the other half)
    [0.1, 3.523, 1.095, 3.722],
    [0.1, 11.8, 5.598, 12.008],
    [5.39, 7.708, 5.598, 11.8],
    [5.39, 7.501, 6.25, 7.708],
    [6.047, 5.927, 6.25, 7.501],
  ],
  roof: [
    [1.095, 0.3, 4.394, 0.503],
    [4.394, 0, 11.0, 0.203],
    [1.095, 0.503, 1.298, 3.722],
    [1.298, 3.519, 4.394, 3.722],
    [4.394, 0.203, 4.601, 0.3],
    [4.394, 3.519, 4.601, 5.922],
    [4.601, 5.719, 10.153, 5.922],
    [9.946, 3.726, 10.153, 5.719],
    [10.153, 3.726, 11.0, 3.823],
    [10.797, 0.203, 11.0, 3.726],
  ],
  // low stone band on the strip in front of the west bedroom
  ledge: [[1.095, 0, 4.394, 0.1]],
};

// ---------------------------------------------------------------------------
// Stair geometry (U-shaped, 18 risers: 11 to the landing over the technical
// space, 7 more on the flight above the guest WC)
// ---------------------------------------------------------------------------
export const STAIR = {
  risers: 18,
  rise: 3.25 / 18,
  flight1: { x0: 6.181, x1: 8.98, z0: 4.829, z1: 5.724, steps: 10 },
  landing: { x0: 8.98, x1: 9.95, z0: 3.726, z1: 5.724 },
  flight2: { x0: 7.311, x1: 8.99, z0: 3.726, z1: 4.723, steps: 6 },
};

// Patio, pergola and lot.
export const SITE = {
  lot: { x0: 0, z0: -4.0, x1: 13.6, z1: 16.2 },
  patio: { x0: 5.598, z0: 5.927, x1: 10.153, z1: 12.008 },
  // slatted pergola drawn on the upper-floor sheet; it steps around the entrance
  pergola: { x0: 5.69, z0: 6.02, x1: 9.09, z1: 11.92, notchX: 6.25, notchZ: 7.8, top: 3.0, beams: [8.3, 9.75, 11.0] },
  path: { x0: 10.153, z0: 6.02, x1: 13.6, z1: 7.45 },
  techApron: { x0: 10.153, z0: 3.828, x1: 11.0, z1: 6.02 },
};
