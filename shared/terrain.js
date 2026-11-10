// Deterministic world shared by server and client. Same seed -> same island everywhere.
export const SIZE = 640, HALF = 320, STEP = 2, N = SIZE / STEP + 1, SEED = 4242;

function hash(ix, iz, s) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export const rnd = hash;

function vnoise(x, z, s) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, s), b = hash(ix + 1, iz, s), c = hash(ix, iz + 1, s), d = hash(ix + 1, iz + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, s, o = 4) {
  let a = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < o; i++) { a += amp * vnoise(x * f, z * f, s + i * 17); n += amp; amp *= 0.5; f *= 2; }
  return a / n;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function rawHeight(x, z) {
  const n = fbm(x * 0.0065, z * 0.0065, SEED, 5);
  const m = fbm(x * 0.012 + 50, z * 0.012 + 50, SEED + 99, 3);
  let h = (n - 0.4) * 52;
  h += Math.max(0, m - 0.56) * 70;
  if (h > 0 && h < 3) h = h * 0.55 + 0.25;            // gentle beaches
  const f = sstep(0.7, 1, Math.hypot(x, z) / 300);
  return h * (1 - f) - f * 9;
}

const H = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = rawHeight(-HALF + i * STEP, -HALF + j * STEP);

export function heightAt(x, z) {
  let gx = (x + HALF) / STEP, gz = (z + HALF) / STEP;
  gx = Math.min(N - 1.001, Math.max(0, gx)); gz = Math.min(N - 1.001, Math.max(0, gz));
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, k = j * N + i;
  return H[k] * (1 - fx) * (1 - fz) + H[k + 1] * fx * (1 - fz) + H[k + N] * (1 - fx) * fz + H[k + N + 1] * fx * fz;
}
export const moistAt = (x, z) => fbm(x * 0.009 + 300, z * 0.009 - 200, SEED + 7, 3);
export function biomeAt(x, z) {
  const h = heightAt(x, z);
  if (h < 0.05) return 'water';
  if (h < 1.3) return 'beach';
  if (h > 15) return 'rock';
  return moistAt(x, z) > 0.5 ? 'forest' : 'meadow';
}

// Spawn: first calm meadow spot spiralling out from the island centre.
export const SPAWN = (() => {
  for (let r = 0; r < 200; r += 4) for (let a = 0; a < 6.28; a += 0.3) {
    const x = Math.cos(a) * r, z = Math.sin(a) * r, h = heightAt(x, z);
    if (biomeAt(x, z) === 'meadow' && h > 2 && h < 9 && Math.abs(heightAt(x + 4, z) - h) < 1 && Math.abs(heightAt(x, z + 4) - h) < 1) return { x, z };
  }
  return { x: 0, z: 0 };
})();

const TABLE = {
  forest: [['pine', .2], ['oak', .15], ['birch', .1], ['bush', .05], ['mushroom', .05], ['branch', .05], ['fiber', .05], ['rock', .02], ['pebbles', .02]],
  meadow: [['oak', .04], ['birch', .03], ['fiber', .08], ['bush', .045], ['pebbles', .05], ['branch', .04], ['rock', .025], ['wild_carrot', .012], ['wild_potato', .012], ['wild_pumpkin', .008], ['wild_corn', .01], ['mushroom', .01]],
  rock: [['rock', .14], ['iron', .07], ['coal', .06], ['pine', .05], ['pebbles', .04]],
  beach: [['clay', .08], ['pebbles', .05], ['fiber', .04]],
};
export function genNodes() {
  const out = [], G = 6;
  for (let gx = -51; gx <= 51; gx++) for (let gz = -51; gz <= 51; gz++) {
    const x = gx * G + (hash(gx, gz, SEED + 1) - .5) * G * .8, z = gz * G + (hash(gx, gz, SEED + 2) - .5) * G * .8;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 4) continue;
    const tab = TABLE[biomeAt(x, z)]; if (!tab) continue;
    let r = hash(gx, gz, SEED + 3), t = null;
    for (const [k, p] of tab) { if (r < p) { t = k; break; } r -= p; }
    if (!t) continue;
    const q = hash(gx, gz, SEED + 4);
    out.push({ id: out.length, t, x: +x.toFixed(2), z: +z.toFixed(2), y: heightAt(+x.toFixed(2), +z.toFixed(2)), s: 0.8 + q * 0.5, ry: q * 6.283 });
  }
  return out;
}
