import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

const LAT = 31.74; // Jerusalem hills
const LON = 35.22;
const RAD = Math.PI / 180;

// Israel switches to summer time (UTC+3) from late March to late October.
function israelOffsetHours(date) {
  const y = date.getFullYear();
  const lastSunday = (month) => {
    const d = new Date(y, month + 1, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  };
  const start = lastSunday(2); start.setDate(start.getDate() - 2); // Friday before
  const end = lastSunday(9);
  return date >= start && date < end ? 3 : 2;
}

// Solar altitude/azimuth (radians; azimuth clockwise from north).
export function sunPosition(day, hoursLocal) {
  const off = israelOffsetHours(day);
  const utc = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) + (hoursLocal - off) * 3600000;
  const d = (utc - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
  const H = (gmst + LON / 15) * 15 * RAD - ra;
  const phi = LAT * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
  return { alt, az: (az + Math.PI * 2) % (Math.PI * 2) };
}

function stars() {
  const n = 1800;
  const pos = new Float32Array(n * 3);
  const rnd = (() => { let s = 12345; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < n; i++) {
    const u = rnd(), v = rnd() * 0.95 + 0.05;
    const th = u * Math.PI * 2, ph = Math.acos(v);
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * 1500;
    pos[i * 3 + 1] = Math.cos(ph) * 1500;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 1500;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  return new THREE.Points(g, m);
}

function cloudTexture(seed) {
  const W = 256, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const x = W * (0.18 + rnd() * 0.64), y = H * (0.45 + (rnd() - 0.5) * 0.35);
    const r = 18 + rnd() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function clouds() {
  const g = new THREE.Group();
  const mats = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTexture(1000 + i * 77), transparent: true, depthWrite: false, fog: false, opacity: 0.8 });
    mats.push(m);
    const sp = new THREE.Sprite(m);
    const a = (i / 14) * Math.PI * 2 + Math.sin(i * 3.1) * 0.3;
    const r = 900 + (i % 4) * 220;
    sp.position.set(Math.cos(a) * r, 260 + (i % 5) * 70, Math.sin(a) * r);
    const sc = 420 + (i % 3) * 180;
    sp.scale.set(sc, sc * 0.42, 1);
    g.add(sp);
  }
  g.userData.mats = mats;
  return g;
}

export class Environment {
  constructor(renderer, scene, { shadowSize = 4096 } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.pmrem = new THREE.PMREMGenerator(renderer);

    this.sky = new Sky();
    this.sky.scale.setScalar(4000);
    scene.add(this.sky);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 3.2;
    u.rayleigh.value = 0.85;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.82;

    // a second sky used only to bake the image based lighting
    this.envScene = new THREE.Scene();
    this.envSky = new Sky();
    this.envSky.scale.setScalar(50);
    this.envScene.add(this.envSky);
    const groundDisc = new THREE.Mesh(
      new THREE.CircleGeometry(40, 32),
      new THREE.MeshBasicMaterial({ color: 0xb8ad93, side: THREE.DoubleSide }),
    );
    groundDisc.rotation.x = -Math.PI / 2;
    groundDisc.position.y = -2;
    this.envGround = groundDisc;
    this.envScene.add(groundDisc);
    // warm band around the horizon: light bounced off stone houses and dry hills
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(35, 35, 14, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xd2c8b6, side: THREE.BackSide, transparent: true, opacity: 0.85 }),
    );
    band.position.y = 3;
    this.envBand = band;
    this.envScene.add(band);

    this.stars = stars();
    scene.add(this.stars);
    this.clouds = clouds();
    scene.add(this.clouds);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const sc = this.sun.shadow.camera;
    sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17;
    sc.near = 1; sc.far = 120;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    this.target = new THREE.Object3D();
    this.target.position.set(6, 1.5, 5.5);
    scene.add(this.target);
    this.sun.target = this.target;
    scene.add(this.sun);

    this.moon = new THREE.DirectionalLight(0x9db4ff, 0);
    this.moon.position.set(-30, 40, 20);
    scene.add(this.moon);

    this.hemi = new THREE.HemisphereLight(0xfff3e2, 0xe2d6c4, 0.5);
    scene.add(this.hemi);

    scene.fog = new THREE.Fog(0xcfd8de, 160, 1300);
    this.lights = [];
    this.emissives = [];
    this.nightColor = new THREE.Color(0x0b1426);
    this.envRT = null;
    this.night = 0;
  }

  setNightLights(lights, emissiveMats) {
    this.lights = lights;
    this.emissives = emissiveMats;
  }

  update(day, hours) {
    const { alt, az } = sunPosition(day, hours);
    this.alt = alt;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
    // sky uses the true direction, even below the horizon (twilight)
    this.sky.material.uniforms.sunPosition.value.copy(dir);
    this.envSky.material.uniforms.sunPosition.value.copy(dir);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) {
      this.envSky.material.uniforms[k].value = this.sky.material.uniforms[k].value;
    }

    const day01 = THREE.MathUtils.smoothstep(alt, -0.03, 0.12);
    const golden = 1 - THREE.MathUtils.smoothstep(alt, 0.05, 0.45);
    this.night = 1 - THREE.MathUtils.smoothstep(alt, -0.12, 0.02);

    const sunCol = new THREE.Color(0xffffff).lerp(new THREE.Color(0xffa45c), golden * 0.85);
    this.sun.color.copy(sunCol);
    this.sun.intensity = 4.5 * day01;
    this.sun.position.copy(this.target.position).addScaledVector(dir, 60);
    this.sun.visible = day01 > 0.001;

    this.moon.intensity = 0.7 * this.night;
    this.hemi.intensity = 0.06 + 0.5 * day01;
    this.hemi.color.set(0xfff3e2).lerp(new THREE.Color(0x3a4a7a), this.night);
    this.hemi.groundColor.set(0xe2d6c4).lerp(new THREE.Color(0x15161a), this.night);
    this.stars.material.opacity = this.night * 0.9;
    const cloudCol = new THREE.Color(0xffffff).lerp(new THREE.Color(0xffb07a), golden * 0.7).lerp(new THREE.Color(0x2a3248), this.night);
    for (const m of this.clouds.userData.mats) { m.color.copy(cloudCol); m.opacity = 0.75 * (1 - this.night * 0.8); }

    const fogDay = new THREE.Color(0xc5d0d6).lerp(new THREE.Color(0xe0b08a), golden * 0.5);
    const fogNight = new THREE.Color(0x0d1424);
    this.scene.fog.color.copy(fogDay).lerp(fogNight, this.night);
    this.envGround.material.color.set(0xb8ad93).lerp(new THREE.Color(0x111318), this.night);
    this.envBand.material.color.set(0xd2c8b6).lerp(new THREE.Color(0xe6a874), golden * 0.4).lerp(new THREE.Color(0x0c0f16), this.night);

    this.scene.environmentIntensity = 0.16 + 0.29 * day01;
    // deep navy night sky once the twilight is gone
    this.sky.visible = this.night < 0.97;
    this.scene.background = this.sky.visible ? null : this.nightColor;
    for (const l of this.lights) l.intensity = (l.userData.night ?? 3) * this.night;
    for (const m of this.emissives) m.emissiveIntensity = m.userData.emissiveNight * this.night;

    this.bakeEnvironment();
  }

  bakeEnvironment() {
    const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 200);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
  }
}
