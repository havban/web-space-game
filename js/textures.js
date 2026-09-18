// ===== Procedural textures (no external assets — everything is drawn on canvas) =====
import * as THREE from 'three';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// cheap value noise, tileable horizontally
function noise2D(seed) {
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const size = 64;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const at = (x, y) => grid[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  const smooth = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
  };
}

function fbm(n, x, y, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * n(x * f, y * f); f *= 2; amp *= 0.5; }
  return v;
}

/** Banded gas-giant / rocky planet surface. */
export function planetTexture(p, seedIn = 1) {
  const key = 'p' + p.name;
  if (cache.has(key)) return cache.get(key);

  const W = 512, H = 256;
  const [c, g] = canvas(W, H);
  const seed = seedIn + p.name.length * 977;
  const n = noise2D(seed);
  const cols = p.colors.map(h => new THREE.Color(h));

  // horizontal bands, warped by noise so they look like flow, not stripes
  const img = g.createImageData(W, H);
  const tmp = new THREE.Color();
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const warp = fbm(n, u * 8, v * 8, 4) - 0.5;
      const band = (v + warp * (0.12 + p.rough * 0.25)) * p.bands;
      const bi = Math.floor(((band % cols.length) + cols.length) % cols.length);
      const bn = band - Math.floor(band);
      tmp.copy(cols[bi]).lerp(cols[(bi + 1) % cols.length], bn * bn * (3 - 2 * bn));

      // grain + polar frosting
      const grain = (fbm(n, u * 26, v * 26, 3) - 0.5) * p.rough * 0.34;
      const pole = Math.max(0, Math.abs(v - 0.5) * 2 - 0.78) * 2.6;
      tmp.offsetHSL(0, -pole * 0.5, grain + pole * 0.30);

      const i = (y * W + x) * 4;
      img.data[i] = tmp.r * 255; img.data[i + 1] = tmp.g * 255;
      img.data[i + 2] = tmp.b * 255; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  if (p.continents) {
    // blobby landmasses + a swirl of cloud for the homeworld
    g.globalAlpha = 0.85;
    for (let i = 0; i < 26; i++) {
      const x = (Math.sin(seed + i * 12.9898) * 43758.5453 % 1 + 1) % 1 * W;
      const y = H * 0.5 + (Math.sin(seed + i * 78.233) * 1.2) * H * 0.3;
      const r = 12 + ((i * 37) % 40);
      g.fillStyle = i % 3 ? '#3d8a55' : '#c9b57e';
      g.beginPath(); g.ellipse(x, y, r * 1.7, r, i, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 0.30; g.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 % W), y = H * 0.5 + Math.sin(i * 2.1) * H * 0.42;
      g.beginPath(); g.ellipse(x, y, 30 + (i % 5) * 12, 9, 0, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Turbulent, glowing sun surface. */
export function sunTexture() {
  if (cache.has('sun')) return cache.get('sun');
  const W = 512, H = 256;
  const [c, g] = canvas(W, H);
  const n = noise2D(4242);
  const img = g.createImageData(W, H);
  const hot = new THREE.Color('#fff4c4'), mid = new THREE.Color('#ffb02e'), cool = new THREE.Color('#e2521a');
  const tmp = new THREE.Color();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const f = fbm(n, u * 14, v * 14, 5);
      const g2 = fbm(n, u * 40 + f * 3, v * 40, 3);
      const t = Math.min(1, Math.max(0, f * 0.75 + g2 * 0.45));
      if (t > 0.5) tmp.copy(mid).lerp(hot, (t - 0.5) * 2);
      else tmp.copy(cool).lerp(mid, t * 2);
      const i = (y * W + x) * 4;
      img.data[i] = tmp.r * 255; img.data[i + 1] = tmp.g * 255;
      img.data[i + 2] = tmp.b * 255; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  cache.set('sun', t);
  return t;
}

/** Soft radial sprite used for glows, engine flares and explosions. */
export function glowSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(120,200,255,0)') {
  const key = 'g' + inner + outer;
  if (cache.has(key)) return cache.get(key);
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)'));
  grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Planetary ring band with gaps. */
export function ringTexture(color) {
  const key = 'r' + color;
  if (cache.has(key)) return cache.get(key);
  const [c, g] = canvas(256, 8);
  const base = new THREE.Color(color);
  for (let x = 0; x < 256; x++) {
    const u = x / 256;
    const gap = Math.sin(u * 44) * 0.5 + 0.5;
    const grain = Math.sin(u * 211.7) * 0.5 + 0.5;
    let a = 0.25 + gap * 0.6 + grain * 0.15;
    if (u > 0.42 && u < 0.5) a *= 0.12;          // Cassini-ish division
    if (u < 0.05 || u > 0.97) a *= 0.2;
    const col = base.clone().offsetHSL(0, 0, (grain - 0.5) * 0.12);
    g.fillStyle = `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},${Math.min(1, a)})`;
    g.fillRect(x, 0, 1, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function disposeTextures() {
  cache.forEach(t => t.dispose());
  cache.clear();
}
