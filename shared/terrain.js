// Deterministic world shared by server and client. Same seed -> same land everywhere.
// The land is 1.6 km across. The middle (the original island) is unchanged; the new land around it is split into
// named zones, each with its own monster levels and look.
export const SIZE = 1600, HALF = 800, STEP = 4, N = SIZE / STEP + 1, SEED = 4242;

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

// ---------- zones ----------
// Each zone grows around a seed point. Rings of seeds go outward from the home meadow, and every ring is tougher.
// t = tier: monsters are level 3t+1 to 3t+3. th = theme, which sets the ground colour and what grows there.
const ZDEF = [
  [0, 0, 0, 'Home Meadows', 'meadow'],
  [230, 0, 1, 'Willow Fen', 'marsh'], [230, 1, 2, 'Amber Hills', 'autumn'], [230, 2, 1, 'Foxglove Woods', 'forest'], [230, 3, 2, 'Stoneford', 'highland'], [230, 4, 1, 'Sunny Downs', 'meadow'],
  [430, 0, 3, 'Mistvale', 'marsh'], [430, 1, 4, 'Thornwood', 'forest'], [430, 2, 5, 'Copper Ridge', 'highland'], [430, 3, 3, 'Goldleaf Glade', 'autumn'],
  [430, 4, 4, 'Raven Hollow', 'dark'], [430, 5, 5, 'Frostfall', 'frost'], [430, 6, 4, 'Bramblemoor', 'marsh'],
  [610, 0, 6, 'Shadowfen', 'dark'], [610, 1, 7, 'Ember Crags', 'highland'], [610, 2, 8, 'Wolfpine Deep', 'forest'], [610, 3, 9, 'Frostpeak', 'frost'],
  [610, 4, 6, 'Ashen Wastes', 'autumn'], [610, 5, 7, 'Grimwild', 'dark'], [610, 6, 8, 'Kingsgrave', 'highland'], [610, 7, 9, 'Dragonspine', 'frost'], [610, 8, 7, 'Starfall Reach', 'forest'],
];
const RING_N = { 0: 1, 230: 5, 430: 7, 610: 9 }, RING_OFF = { 0: 0, 230: .4, 430: 1.1, 610: .2 };
export const ZONES = ZDEF.map(([r, i, t, name, th], id) => {
  const a = RING_OFF[r] + (i + (hash(id, 7, SEED) - .5) * .35) / RING_N[r] * Math.PI * 2, rr = r * (.9 + hash(id, 9, SEED) * .12);
  return { id, name, th, t, lo: 3 * t + 1, hi: 3 * t + 3, x: Math.cos(a) * rr, z: Math.sin(a) * rr };
});
export const THEMES = {
  meadow: { grass: '#7fbf58', moist: .5, rock: 15 }, forest: { grass: '#4f9443', moist: .38, rock: 15 }, marsh: { grass: '#6f9a5c', moist: .44, rock: 18 },
  autumn: { grass: '#b3a24e', moist: .48, rock: 15 }, highland: { grass: '#8fa36a', moist: .58, rock: 9 }, frost: { grass: '#c8d5cf', moist: .5, rock: 10 },
  dark: { grass: '#4a5c43', moist: .4, rock: 13 },
};
// Nearest two zones, measured through a gently warped map so the borders wander instead of being straight lines.
// The home zone gets a head start so it stays a good size around the starting meadow.
export function zones2(x, z) {
  const wx = x + (fbm(x * .004, z * .004, SEED + 11, 3) - .5) * 160, wz = z + (fbm(x * .004 + 40, z * .004, SEED + 12, 3) - .5) * 160;
  let a = null, da = 1e9, b = null, db = 1e9;
  for (const q of ZONES) { const d = Math.hypot(wx - q.x, wz - q.z) - (q.id === 0 ? 45 : 0); if (d < da) { b = a; db = da; a = q; da = d; } else if (d < db) { b = q; db = d; } }
  return [a, b, db - da];
}
export const zoneAt = (x, z) => zones2(x, z)[0];

// ---------- height ----------
function rawHeight(x, z) {
  const n = fbm(x * 0.0065, z * 0.0065, SEED, 5);
  const m = fbm(x * 0.012 + 50, z * 0.012 + 50, SEED + 99, 3);
  const dc = Math.hypot(x, z);
  const out = sstep(220, 420, dc);        // 0 in the original island, 1 in the new land around it
  let h = (n - 0.4) * 52 * (1 - .25 * out) + 4 * out;       // outer land: a little higher so it is mostly dry, and a little flatter
  h += Math.max(0, m - 0.56) * 70 * (1 - .45 * out);
  if (h > 0 && h < 3) h = h * 0.55 + 0.25;            // gentle beaches
  const r = dc / (780 * (.88 + .22 * fbm(x * .0025 + 9, z * .0025 - 4, SEED + 21, 3)));     // wavy coastline, sea all round
  const f = sstep(0.86, 1, r);
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
export function biomeAt(x, z, zone = zoneAt(x, z)) {
  const h = heightAt(x, z), th = THEMES[zone.th];
  if (h < 0.05) return 'water';
  if (h < 1.3) return 'beach';
  if (h > th.rock) return 'rock';
  return moistAt(x, z) > th.moist ? 'forest' : 'meadow';
}

// Spawn: first calm meadow spot spiralling out from the centre.
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
const FROST_TREES = { oak: 'pine', birch: 'pine' }, DARK_TREES = { birch: 'pine' };
export function genNodes() {
  const out = [], G = 7, R = Math.floor((HALF - 30) / G);
  for (let gx = -R; gx <= R; gx++) for (let gz = -R; gz <= R; gz++) {
    const x = gx * G + (hash(gx, gz, SEED + 1) - .5) * G * .8, z = gz * G + (hash(gx, gz, SEED + 2) - .5) * G * .8;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 4 || Math.hypot(x, z) > HALF - 40) continue;
    const zone = zoneAt(x, z), tab = TABLE[biomeAt(x, z, zone)]; if (!tab) continue;
    let r = hash(gx, gz, SEED + 3), t = null;
    for (const [k, p] of tab) { if (r < p) { t = k; break; } r -= p; }
    if (!t) continue;
    if (zone.th === 'frost') t = FROST_TREES[t] || t; else if (zone.th === 'dark') t = DARK_TREES[t] || t;
    const q = hash(gx, gz, SEED + 4);
    out.push({ id: out.length, t, x: +x.toFixed(2), z: +z.toFixed(2), y: heightAt(+x.toFixed(2), +z.toFixed(2)), s: 0.8 + q * 0.5, ry: q * 6.283 });
  }
  return out;
}
