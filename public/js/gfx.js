// Everything visual: low-poly models built from code (no art files), terrain, sky, water, lighting.
import * as THREE from 'three';
import { heightAt, moistAt, genNodes, zones2, THEMES, N, SIZE, HALF, rnd } from '/shared/terrain.js';
import { CROPS, STRUCTS, ITEMS } from '/shared/data.js';

export const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true });
const GLOW = new THREE.MeshBasicMaterial({ color: '#ffb347' });
const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

// ---- tiny modelling kit: coloured primitives merged into one geometry ----
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (a, b, h, n = 6) => new THREE.CylinderGeometry(a, b, h, n);
const cone = (r, h, n = 6) => new THREE.ConeGeometry(r, h, n);
const ico = r => new THREE.IcosahedronGeometry(r, 0);
const dod = r => new THREE.DodecahedronGeometry(r, 0);
export function P(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo; g.deleteAttribute('uv');
  const n = g.attributes.position.count, a = new Float32Array(n * 3); _c.set(color);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
  return g;
}
export function merge(parts) {
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const p of parts) { pos.set(p.attributes.position.array, o); nor.set(p.attributes.normal.array, o); col.set(p.attributes.color.array, o); o += p.attributes.position.count * 3; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const M = (parts, shadow = true) => { const m = new THREE.Mesh(merge(parts), MAT); m.castShadow = shadow; m.receiveShadow = true; return m; };

// ---- resource nodes ----
function nodeGeo(t) {
  switch (t) {
    case 'oak': return merge([P(cyl(.22, .34, 2.4), '#6b4a2f', 0, 1.2, 0), P(ico(1.5), '#4e9a3e', 0, 3.3, 0), P(ico(1.1), '#5fae4a', .9, 2.9, .4), P(ico(1), '#458b37', -.8, 3, -.5), P(ico(.9), '#67b552', .1, 4.2, .2)]);
    case 'pine': return merge([P(cyl(.16, .28, 2), '#5a3d28', 0, 1, 0), P(cone(1.5, 2.2, 7), '#2f6e3f', 0, 2.6, 0), P(cone(1.15, 2, 7), '#357a45', 0, 3.8, 0), P(cone(.75, 1.7, 7), '#3d8a4e', 0, 4.9, 0)]);
    case 'birch': return merge([P(cyl(.14, .2, 3.2), '#e8e4d8', 0, 1.6, 0), P(box(.3, .08, .3), '#444', 0, 1, 0), P(box(.3, .08, .3), '#444', 0, 2.1, 0), P(ico(1.1), '#9cc94f', 0, 3.6, 0), P(ico(.85), '#b3d75e', .5, 4.2, .3), P(ico(.8), '#8bbd42', -.5, 3.9, -.3)]);
    case 'rock': return merge([P(dod(1), '#8e9499', 0, .5, 0, .3, .4, 0, 1.1, .8, 1), P(dod(.6), '#a3a9ad', .8, .3, .5, 1, 0, .3)]);
    case 'iron': return merge([P(dod(1), '#7b7f85', 0, .5, 0, .3, .4, 0, 1.1, .8, 1), P(box(.35, .35, .35), '#c8763a', .5, .9, .4, .5, .5, 0), P(box(.3, .3, .3), '#d9884a', -.5, .7, .6, .2, .8, 0), P(box(.3, .3, .3), '#c8763a', 0, 1.05, -.4, .7, .1, .4), P(box(.25, .25, .25), '#e09a5c', -.6, .9, -.3, .4, .4, 0)]);
    case 'coal': return merge([P(dod(1), '#6f747a', 0, .5, 0, .3, .4, 0, 1.1, .8, 1), P(box(.35, .35, .35), '#1c1c1f', .5, .9, .4, .5, .5, 0), P(box(.3, .3, .3), '#26262a', -.5, .7, .6, .2, .8, 0), P(box(.3, .3, .3), '#1c1c1f', 0, 1.05, -.4, .7, .1, .4)]);
    case 'pebbles': return merge([P(dod(.25), '#a3a9ad', 0, .12, 0), P(dod(.18), '#8e9499', .35, .09, .15), P(dod(.2), '#b5babd', -.2, .1, .3), P(dod(.14), '#7e8489', .1, .07, -.3)]);
    case 'branch': return merge([P(cyl(.06, .08, 1.5, 5), '#7a5536', 0, .08, 0, 0, 0, 1.5), P(cyl(.04, .05, .7, 5), '#7a5536', .2, .1, .2, 0, .8, 1.3), P(cyl(.04, .05, .6, 5), '#8a6340', -.3, .1, -.15, 0, -.6, 1.4)]);
    case 'bush': return merge([P(ico(.7), '#3f8f3a', 0, .55, 0, 0, 0, 0, 1.2, .9, 1.2), P(ico(.45), '#4da046', .5, .45, .3), ...[[.3, .9, .4], [-.4, .8, .3], [0, 1, -.3], [.6, .6, -.1], [-.2, .7, .65], [.55, .75, .5]].map(([x, y, z]) => P(ico(.1), '#4553c9', x, y, z))]);
    case 'fiber': return merge([0, 1, 2, 3, 4, 5, 6].map(i => P(cone(.07, .9 + (i % 3) * .2, 4), i % 2 ? '#9ccf5a' : '#b8d96a', Math.cos(i) * .25, .5, Math.sin(i * 1.7) * .25, Math.sin(i) * .25, 0, Math.cos(i) * .25)));
    case 'mushroom': return merge([[0, 0, 1], [.3, .2, .7], [-.25, .25, .6]].flatMap(([x, z, s]) => [P(cyl(.06, .08, .3, 5), '#f1ead9', x, .15 * s, z, 0, 0, 0, s, s, s), P(cone(.22, .2, 7), '#d8413a', x, .36 * s, z, 0, 0, 0, s, s, s)]));
    case 'clay': return merge([P(dod(.7), '#b0623f', 0, .12, 0, 0, 0, 0, 1.2, .35, 1), P(dod(.4), '#c4764f', .5, .1, .4, 0, 0, 0, 1, .4, 1)]);
    case 'wild_carrot': return merge([P(cone(.12, .5, 5), '#4da046', 0, .3, 0), P(cone(.1, .4, 5), '#5fae4a', .15, .25, .1, 0, 0, -.4), P(cone(.1, .4, 5), '#5fae4a', -.15, .25, -.1, 0, 0, .4), P(cone(.08, .15, 5), '#f08a2c', 0, .04, 0)]);
    case 'wild_potato': return merge([P(ico(.3), '#5d9c4a', 0, .22, 0, 0, 0, 0, 1.2, .7, 1.2), P(ico(.08), '#f4f1e4', .1, .45, .1), P(ico(.08), '#f4f1e4', -.15, .42, -.05), P(ico(.12), '#b89466', .3, .06, .2)]);
    case 'wild_pumpkin': return merge([P(ico(.34), '#f07a18', 0, .28, 0, 0, 0, 0, 1.15, .85, 1.15), P(cyl(.03, .05, .15, 5), '#4d7a2e', 0, .6, 0), P(ico(.2), '#4da046', .4, .08, .1, 0, 0, 0, 1.4, .3, 1)]);
    case 'wild_corn': return merge([P(cyl(.04, .05, 1.5, 5), '#6aa84f', 0, .75, 0), P(cone(.12, .7, 4), '#7dbb5a', .15, .8, 0, 0, 0, -.7), P(cone(.12, .7, 4), '#7dbb5a', -.15, 1, 0, 0, 0, .7), P(cyl(.07, .07, .3, 6), '#f6d743', .08, 1.1, .05, 0, 0, -.3)]);
  }
}
export const NODE_H = { oak: 3, pine: 3, birch: 3, rock: 1.2, iron: 1.2, coal: 1.2 };

// ---- characters ----
// Gear shows on the body: each material has its own pieces (tier 2 is richer), rarity adds trim (Fine), glowing
// accents (Superior) and a stronger glow (Epic), and Superior/Epic gear gives off particles picked by its strongest
// bonus stat. A full three-piece set adds a glowing ring at the feet.
const GEARC = {
  cloth: [{ base: '#b7a3dc', dark: '#7e6aa8', trim: '#e8dcc0' }, { base: '#3f5fbf', dark: '#283d80', trim: '#e6c34a' }],
  leather: [{ base: '#8a5a33', dark: '#5e3d22', trim: '#c9a26b' }, { base: '#4a3326', dark: '#2c1f17', trim: '#b0b4b8' }],
  plate: [{ base: '#aeb6bf', dark: '#6f7780', trim: '#5e6670' }, { base: '#dfe6ee', dark: '#8a96a8', trim: '#e6c34a' }],
};
export const QCOL = ['#d9d2c2', '#6fd36f', '#5aa9ff', '#c77dff'];
const FXC = { pow: '#ff8a2a', mend: '#6dff8a', mreg: '#5ab8ff', ereg: '#ffe14a', hp: '#ff4d5e', arm: '#e8eef5' };
const GLOWV = new THREE.MeshBasicMaterial({ vertexColors: true });
const MG = parts => { const m = new THREE.Mesh(merge(parts), GLOWV); return m; };       // unlit = looks like it glows
const parseKey = k => { if (!k) return null; const [id, q, st] = String(k).split(':'); const d = ITEMS[id]; return d ? { id, d, q: +q || 0, st: st || '' } : null; };
let _dot = null;
function dotTex() {       // soft round glow for particles
  if (_dot) return _dot; const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  return (_dot = new THREE.CanvasTexture(c));
}
function addFx(u, anchor, type, q, o = {}) {        // a little cloud of particles that move by themselves (see animateCharacter)
  const n = Math.max(3, Math.round((q >= 3 ? 16 : 7) * (o.mul || 1))), pos = new Float32Array(n * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: FXC[type] || '#ffffff', map: dotTex(), size: q >= 3 ? .22 : .16, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; anchor.add(pts);
  u.fx.push({ pts, pos, n, type, seed: Array.from({ length: n }, () => Math.random()), cy: o.cy ?? 0, r: o.r ?? .45, h: o.h ?? 1 });
}
export function makeCharacter(look, armor, eq = []) {
  const g = new THREE.Group(), { shirt, hair, skin } = look;
  const [hd, ch, lg] = [0, 1, 2].map(i => parseKey(eq[i])), C = x => x && GEARC[x.d.mat]?.[(x.d.tr || 1) - 1];
  const cc = C(ch), lc = C(lg), hc = C(hd);
  const torsoC = cc?.base || { plate: '#aeb6bf', leather: '#8a5a33', cloth: '#b7a3dc' }[armor] || shirt, pants = lc?.base || '#3b4a6b', boots = lc ? lc.dark : '#3a2a1e';
  const body = new THREE.Group(); g.add(body);
  body.add(M([P(box(.62, .72, .36), torsoC, 0, 1.16, 0), P(box(.64, .12, .38), cc ? cc.dark : '#4a3221', 0, .82, 0)]));
  const head = M([P(box(.46, .46, .46), skin, 0, 0, 0), P(box(.5, .2, .5), hair, 0, .2, -.02), P(box(.5, .34, .14), hair, 0, 0, -.2), P(box(.07, .09, .03), '#22252b', .11, .02, .235), P(box(.07, .09, .03), '#22252b', -.11, .02, .235), P(box(.14, .03, .03), '#a8443a', 0, -.12, .235)]);
  const headG = new THREE.Group(); headG.position.y = 1.78; headG.add(head); body.add(headG);
  const limb = (x, y, w, h, c1, c2) => { const p = new THREE.Group(); p.position.set(x, y, 0); p.add(M([P(box(w, h * .72, w + .02), c1, 0, -h * .36, 0), P(box(w, h * .28, w + .02), c2, 0, -h * .86, 0)])); body.add(p); return p; };
  const armL = limb(.42, 1.5, .2, .72, torsoC, ch?.d.mat === 'plate' ? cc.dark : skin), armR = limb(-.42, 1.5, .2, .72, torsoC, skin);
  const legL = limb(.17, .8, .25, .8, pants, boots), legR = limb(-.17, .8, .25, .8, pants, boots);
  const hand = new THREE.Group(); hand.position.set(0, -.68, .12); armR.add(hand);
  const u = g.userData = { body, head: headG, armL, armR, legL, legR, hand, phase: Math.random() * 6, swing: 0, held: null, fx: [], t: Math.random() * 10 };
  const qc = x => QCOL[x.q];
  // ---- head ----
  if (hd && hc) {
    const m = hd.d.mat, t2 = hd.d.tr === 2, p = [], gl = [];
    if (m === 'cloth') {
      if (t2) p.push(P(cyl(.4, .4, .05, 10), hc.base, 0, .22, 0), P(cone(.27, .55, 8), hc.base, 0, .5, -.04, -.15), P(cyl(.28, .28, .07, 10), hc.trim, 0, .27, 0));      // wizard hat
      else p.push(P(box(.54, .3, .54), hc.base, 0, .14, -.02), P(box(.54, .44, .14), hc.base, 0, -.04, -.22), P(box(.56, .05, .06), hc.dark, 0, .02, .25));      // hood
    } else if (m === 'leather') {
      p.push(P(box(.52, .18, .52), hc.base, 0, .2, 0), P(box(.55, .06, .55), hc.dark, 0, .12, 0));
      if (t2) p.push(P(box(.5, .14, .06), hc.dark, 0, -.1, .24), P(box(.06, .12, .5), hc.trim, 0, .32, 0));        // face mask and a studded ridge
    } else {
      p.push(P(box(.54, .52, .54), hc.base, 0, .03, 0), P(box(.42, .05, .03), '#1b1d22', 0, .03, .275), P(box(.06, .2, .03), hc.dark, 0, -.06, .278));
      if (t2) p.push(P(box(.06, .22, .46), '#c0392b', 0, .38, -.02), P(box(.56, .05, .56), hc.trim, 0, -.21, 0));          // plume and gold rim
    }
    if (hd.q >= 1) p.push(P(box(.56, .04, .56), qc(hd), 0, m === 'cloth' && t2 ? .3 : .11, 0));
    if (hd.q >= 2) gl.push(P(ico(.055), qc(hd), 0, .16, .29));
    if (hd.q >= 3) gl.push(P(box(.58, .025, .025), qc(hd), 0, .26, .27));
    headG.add(M(p)); if (gl.length) headG.add(MG(gl));
  }
  // ---- chest ----
  if (ch && cc) {
    const m = ch.d.mat, t2 = ch.d.tr === 2, p = [P(box(.66, .7, .4), cc.base, 0, 1.18, 0), P(box(.68, .1, .42), cc.dark, 0, .84, 0)], gl = [];
    if (m === 'cloth') { p.push(P(box(.62, .42, .39), cc.base, 0, .62, 0), P(box(.08, .78, .02), cc.trim, .12, 1.0, .21, 0, 0, .35)); if (t2) p.push(P(box(.7, .08, .42), cc.trim, 0, 1.5, 0)); }
    else if (m === 'leather') { p.push(...[-1, 1].map(sx => P(box(.26, .12, .3), cc.dark, sx * .42, 1.53, 0)), P(box(.06, .72, .02), cc.dark, -.1, 1.18, .21, 0, 0, -.5)); if (t2) p.push(...[-.15, 0, .15].map(y => P(box(.05, .05, .02), cc.trim, .12, 1.18 + y, .215))); }
    else { p.push(...[-1, 1].map(sx => P(box(.34, .2, .42), cc.base, sx * .44, 1.55, 0)), P(box(.3, .52, .04), cc.dark, 0, 1.2, .21)); if (t2) p.push(...[-1, 1].map(sx => P(box(.36, .04, .44), cc.trim, sx * .44, 1.46, 0)), P(box(.12, .12, .03), cc.trim, 0, 1.3, .235)); }
    if (ch.q >= 1) p.push(P(box(.69, .04, .43), qc(ch), 0, 1.0, 0));
    if (ch.q >= 2) gl.push(P(ico(.07), qc(ch), 0, 1.3, .25));
    if (ch.q >= 3) gl.push(...[-1, 1].map(sx => P(box(.36, .03, .03), qc(ch), sx * .44, 1.66, .21)));
    body.add(M(p)); if (gl.length) body.add(MG(gl));
  }
  // ---- legs ----
  if (lg && lc) for (const L of [legL, legR]) {
    const m = lg.d.mat, t2 = lg.d.tr === 2, p = [], gl = [];
    if (m === 'leather') p.push(P(box(.27, .14, .08), lc.dark, 0, -.4, .13));
    if (m === 'plate') p.push(P(box(.29, .16, .1), lc.dark, 0, -.4, .13), P(box(.29, .2, .29), lc.dark, 0, -.7, 0));
    if (m === 'cloth' && t2) p.push(P(box(.27, .05, .27), lc.trim, 0, -.56, 0));
    if (t2 && m !== 'cloth') p.push(P(box(.1, .06, .03), lc.trim, 0, -.4, .185));
    if (lg.q >= 1) p.push(P(box(.27, .04, .27), qc(lg), 0, -.18, 0));
    if (lg.q >= 2) gl.push(P(ico(.04), qc(lg), 0, -.4, .19));
    if (p.length) L.add(M(p)); if (gl.length) L.add(MG(gl));
  }
  // ---- a torch in the off (left) hand ----
  if (String(eq[3] || '').startsWith('torch')) {
    const lh = new THREE.Group(); lh.position.set(0, -.68, .12); lh.rotation.x = Math.PI / 2 - .5; armL.add(lh);
    lh.add(M([P(cyl(.03, .04, .6, 5), '#7a5536', 0, .2, 0)], false)); const fl = new THREE.Mesh(cone(.09, .25, 5), GLOW); fl.position.y = .6; lh.add(fl);
    const l = new THREE.PointLight('#ffb060', 14, 16, 1.6); l.position.y = .7; lh.add(l); u.offFlame = fl;
  }
  // ---- particles from Superior / Epic armor, and a ring for a full set ----
  for (const [x, anchor, o] of [[hd, headG, { cy: .1, r: .35, h: .5, mul: .6 }], [ch, body, { cy: 1.1, r: .5, h: 1 }], [lg, body, { cy: .45, r: .35, h: .5, mul: .6 }]]) if (x && x.q >= 2) addFx(u, anchor, x.st, x.q, o);
  if (hd && ch && lg && hd.d.mat === ch.d.mat && ch.d.mat === lg.d.mat) {
    const best = Math.max(hd.q, ch.q, lg.q), ring = new THREE.Mesh(new THREE.RingGeometry(.55, .68, 24), new THREE.MeshBasicMaterial({ color: best ? QCOL[best] : GEARC[ch.d.mat][0].trim, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .05; g.add(ring); u.ring = ring;
  }
  return g;
}
const HELD = {
  axe: c => [P(cyl(.03, .03, .8, 5), '#7a5536', 0, .25, 0), P(box(.08, .22, .3), c, 0, .58, .12)],
  pickaxe: c => [P(cyl(.03, .03, .8, 5), '#7a5536', 0, .25, 0), P(box(.07, .09, .7), c, 0, .62, 0)],
  hammer: () => [P(cyl(.03, .03, .6, 5), '#7a5536', 0, .2, 0), P(box(.16, .16, .32), '#8e9499', 0, .5, 0)],
  hoe: () => [P(cyl(.03, .03, 1, 5), '#7a5536', 0, .3, 0), P(box(.2, .05, .22), '#8e9499', 0, .8, .1)],
  spear: c => [P(cyl(.025, .025, 1.7, 5), '#7a5536', 0, .5, 0), P(cone(.07, .3, 4), c, 0, 1.5, 0)],
  sword: c => [P(box(.05, .2, .05), '#5a3d28', 0, 0, 0), P(box(.26, .05, .07), '#c9a23a', 0, .12, 0), P(box(.08, .85, .03), c, 0, .57, 0)],
  bow: () => [P(new THREE.TorusGeometry(.5, .025, 4, 10, Math.PI), '#7a5536', 0, .15, 0, 0, Math.PI / 2, -Math.PI / 2), P(box(.012, 1, .012), '#e8e4d8', 0, .15, 0)],
  staff: c => [P(cyl(.03, .035, 1.7, 5), '#7a5536', 0, .45, 0), P(ico(.11), c === '#d7dde2' ? '#7fd4ff' : '#9be37a', 0, 1.38, 0), P(cone(.07, .14, 4), '#7a5536', 0, 1.24, 0)],
  rod: () => [P(cyl(.015, .03, 1.9, 5), '#9a7a4a', 0, .7, .3, .45, 0, 0), P(box(.01, .9, .01), '#e8e4d8', 0, 1.1, 1.05)],
  torch: () => [P(cyl(.03, .04, .6, 5), '#7a5536', 0, .2, 0)],
  water: () => [P(ico(.14), '#8a5a33', 0, 0, .05, 0, 0, 0, 1, 1.3, .7)],
};
// the glowing part of a Superior / Epic weapon: its blade, head or string
const HELD_GLOW = {
  sword: (c, q) => [P(box(q >= 3 ? .1 : .03, .8, q >= 3 ? .04 : .035), c, 0, .58, q >= 3 ? 0 : .02)],
  spear: c => [P(cone(.075, .32, 4), c, 0, 1.5, 0)],
  bow: c => [P(box(.02, 1, .02), c, 0, .15, 0)],
  staff: c => [P(ico(.15), c, 0, 1.38, 0)],
};
const FX_AT = { sword: { cy: .55, r: .12, h: .8 }, spear: { cy: 1.3, r: .15, h: .5 }, bow: { cy: .15, r: .2, h: .9 }, staff: { cy: 1.35, r: .22, h: .4 } };
export function setHeld(char, key) {
  const u = char.userData; if (u.held === key) return; u.held = key;
  u.hand.clear(); u.light = null; u.fx = u.fx.filter(f => f.pts.parent !== u.hand); if (!key) return;
  const x = parseKey(key), def = x?.d; if (!def) return;
  const f = HELD[def.tool], tier = def.tier === 'iron' || def.tr === 2 || String(x.id).startsWith('iron') ? '#d7dde2' : '#8e9499';
  if (f) { u.hand.add(M(f(def.tr === 2 ? '#e8eef5' : tier), false)); u.hand.rotation.x = Math.PI / 2 - .3; }
  else { u.hand.add(M([P(box(.16, .16, .16), def.food ? '#d9534f' : '#c49a6c', 0, 0, .05)], false)); u.hand.rotation.x = 0; }
  if (def.gear && x.q >= 2 && HELD_GLOW[def.tool]) { u.hand.add(MG(HELD_GLOW[def.tool](QCOL[x.q], x.q))); addFx(u, u.hand, x.st, x.q, FX_AT[def.tool]); }
  else if (def.gear && x.q === 1 && HELD_GLOW[def.tool]) u.hand.add(M(HELD_GLOW[def.tool](QCOL[1], 1).map(g => g.scale(1.02, 1.02, 1.02)), false));
  if (def.tool === 'torch') { const fl = new THREE.Mesh(cone(.09, .25, 5), GLOW); fl.position.y = .6; u.hand.add(fl); const l = new THREE.PointLight('#ffb060', 14, 16, 1.6); l.position.y = .7; u.hand.add(l); }
}
// particle motion for each effect type (all positions are local to the anchor, so they follow the body or the weapon)
function stepFx(f, t) {
  const { pos, n, seed, cy, r, h } = f;
  for (let i = 0; i < n; i++) {
    const s = seed[i], k = i * 3; let x, y, z;
    switch (f.type) {
      case 'pow': case 'hp': { const a = (t * (f.type === 'pow' ? .9 : .45) + s) % 1, ang = s * 40; x = Math.cos(ang) * r * (1 - a * .5); z = Math.sin(ang) * r * (1 - a * .5); y = cy - h * .5 + a * h * 1.4; break; }        // embers / life motes rise
      case 'mend': { const a = (t * .35 + s) % 1, ang = s * 30 + t * 1.5; x = Math.cos(ang) * r * .9; z = Math.sin(ang) * r * .9; y = cy - h * .5 + a * h * 1.2; break; }         // healing motes spiral up
      case 'mreg': { const ang = s * 6.283 + t * (1.2 + s); x = Math.cos(ang) * r * 1.1; z = Math.sin(ang) * r * 1.1; y = cy + Math.sin(t * 2 + s * 9) * h * .45; break; }          // arcane orbs circle
      case 'ereg': { const j = Math.floor(t * 14 + s * 7); x = (rnd(i, j, 1) - .5) * r * 2; z = (rnd(i, j, 2) - .5) * r * 2; y = cy + (rnd(i, j, 3) - .5) * h; break; }                  // electric crackle jumps around
      default: { const j = Math.floor(t * 3 + s * 5); x = (rnd(i, j, 4) - .5) * r * 1.8; z = (rnd(i, j, 5) - .5) * r * 1.8; y = cy + (rnd(i, j, 6) - .5) * h; }                      // armor glints
    }
    pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
  }
  f.pts.geometry.attributes.position.needsUpdate = true;
  if (f.type === 'ereg' || f.type === 'arm') f.pts.material.opacity = .55 + .45 * Math.abs(Math.sin(t * 9 + seed[0] * 5));
}
export function animateCharacter(g, dt, speed, mode) {    // mode 0 idle 1 walk 2 run 3 sneak 4 swim
  const u = g.userData; u.phase += dt * (2 + speed * 1.7); u.t += dt;
  if (g.visible) for (const f of u.fx) stepFx(f, u.t);
  if (u.ring) { u.ring.rotation.z += dt * .6; u.ring.material.opacity = .6 + .3 * Math.sin(u.t * 2.5); }
  const amp = Math.min(1, speed / 5) * (mode === 4 ? .5 : .9), s = Math.sin(u.phase);
  u.legL.rotation.x = s * amp; u.legR.rotation.x = -s * amp; u.armL.rotation.x = u.offFlame ? -.35 + s * amp * .15 : -s * amp * .8;
  if (u.offFlame) { const k = 1 + Math.sin(u.t * 13) * .12; u.offFlame.scale.set(k, 1 + Math.sin(u.t * 17) * .2, k); }
  u.swing = Math.max(0, u.swing - dt * 3.2);
  u.armR.rotation.x = u.swing > 0 ? -2.4 * Math.sin(u.swing * Math.PI) - .3 : (u.held ? -.35 : s * amp * .8);
  u.body.position.y = (mode === 3 ? -.22 : 0) + Math.abs(Math.cos(u.phase)) * .05 * amp + (speed < .1 ? Math.sin(u.phase * .5) * .012 : 0);
  u.body.rotation.x = mode === 4 ? .9 : mode === 3 ? .3 : amp * .08;
  u.head.rotation.x = mode === 4 ? -.7 : 0;
}
export function makeLabel(text, color = '#fff') {
  const c = document.createElement('canvas'); c.width = 320; c.height = 64; const x = c.getContext('2d');
  x.font = '700 34px "Trebuchet MS",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 7; x.strokeStyle = 'rgba(20,14,8,.85)'; x.strokeText(text, 160, 32); x.fillStyle = color; x.fillText(text, 160, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true })); s.scale.set(2.6, .52, 1); s.position.y = 2.45; return s;
}

// ---- animals ----
const AN = {
  rabbit: { b: [.3, .28, .46], lh: .16, lw: .08, c: '#b99b7a', h: [.22, .22, .22], x: (y, z) => [P(box(.06, .26, .04), '#b99b7a', .07, y + .25, z), P(box(.06, .26, .04), '#b99b7a', -.07, y + .25, z), P(ico(.07), '#fff', 0, y - .12, -z - .5)] },
  fowl: { b: [.26, .28, .36], lh: .16, lw: .04, c: '#a8572f', h: [.16, .18, .16], two: true, x: (y, z) => [P(cone(.04, .1, 4), '#f0b030', 0, y, z + .12, Math.PI / 2), P(box(.03, .1, .1), '#d8413a', 0, y + .13, z), P(box(.06, .2, .16), '#7a3d1f', 0, y - .1, -z - .35, -.6)] },
  deer: { b: [.45, .5, 1.15], lh: .75, lw: .1, c: '#b07a48', h: [.24, .26, .4], hy: .45, x: (y, z) => [P(cone(.03, .4, 4), '#e8dcc0', .1, y + .32, z - .1, 0, 0, -.4), P(cone(.03, .4, 4), '#e8dcc0', -.1, y + .32, z - .1, 0, 0, .4), P(box(.1, .14, .05), '#fff', 0, y - .5, -z - 1.0)] },
  boar: { b: [.55, .55, 1.05], lh: .32, lw: .13, c: '#5a4636', h: [.36, .36, .4], x: (y, z) => [P(cone(.035, .16, 4), '#f1ead9', .14, y - .08, z + .2, -.6), P(cone(.035, .16, 4), '#f1ead9', -.14, y - .08, z + .2, -.6), P(box(.2, .16, .12), '#7a6350', 0, y - .06, z + .24)] },
  wolf: { b: [.4, .45, 1.05], lh: .5, lw: .1, c: '#7d848c', h: [.3, .28, .4], hy: .15, x: (y, z) => [P(cone(.07, .16, 4), '#5f666e', .1, y + .2, z - .12), P(cone(.07, .16, 4), '#5f666e', -.1, y + .2, z - .12), P(box(.1, .1, .5), '#5f666e', 0, y - .1, -z - .9, .5), P(box(.05, .04, .02), '#ffd84a', .08, y + .04, z + .21), P(box(.05, .04, .02), '#ffd84a', -.08, y + .04, z + .21)] },
};
AN.spider = { b: [.7, .32, .8], lh: .3, lw: .06, c: '#3a2f3f', h: [.34, .28, .3], x: (y, z) => [P(box(.06, .06, .02), '#e5484d', .08, y + .04, z + .16), P(box(.06, .06, .02), '#e5484d', -.08, y + .04, z + .16), P(ico(.42), '#2c2431', 0, y + .05, -z - .55, 0, 0, 0, 1, .8, 1.1), ...[-1, 1].flatMap(s => [.3, 0, -.3].map(q => P(box(.5, .05, .05), '#3a2f3f', s * .55, y - .12, q, 0, 0, s * .5)))] };
AN.bear = { b: [.8, .8, 1.5], lh: .55, lw: .2, c: '#6b4a32', h: [.5, .46, .5], hy: .1, x: (y, z) => [P(box(.12, .12, .06), '#4a3221', .18, y + .28, z - .1), P(box(.12, .12, .06), '#4a3221', -.18, y + .28, z - .1), P(box(.24, .2, .2), '#8a6a4c', 0, y - .08, z + .3), P(box(.08, .06, .04), '#22252b', 0, y - .02, z + .41)] };
export const ANIMAL_R = { rabbit: .45, fowl: .4, deer: .8, boar: .8, wolf: .75, spider: .75, bear: 1.1 };      // radius of the level ring under each kind
export function makeAnimal(t) {
  const a = AN[t], g = new THREE.Group(), [w, h, l] = a.b, by = a.lh + h / 2, hy = by + (a.hy || .1), hz = l / 2 + a.h[2] * .3;
  g.add(M([P(box(w, h, l), a.c, 0, by, 0), P(box(...a.h), a.c, 0, hy, hz), ...a.x(hy, hz)]));
  const legs = []; const lp = a.two ? [[.07, 0], [-.07, 0]] : [[w / 2 - .06, l / 2 - .1], [-w / 2 + .06, l / 2 - .1], [w / 2 - .06, -l / 2 + .1], [-w / 2 + .06, -l / 2 + .1]];
  for (const [x, z] of lp) { const p = new THREE.Group(); p.position.set(x, a.lh, z); p.add(M([P(box(a.lw, a.lh, a.lw), a.two ? '#f0b030' : a.c, 0, -a.lh / 2, 0)])); g.add(p); legs.push(p); }
  g.userData = { legs, phase: Math.random() * 6 }; return g;
}
export function animateAnimal(g, dt, mv) {
  const u = g.userData; u.phase += dt * (mv === 2 ? 16 : mv === 1 ? 7 : 0); const s = Math.sin(u.phase) * (mv ? .7 : 0);
  u.legs.forEach((l, i) => l.rotation.x = (i % 3 === 0 ? s : -s));
}

// ---- structures ----
const WOOD = '#a9744a', PLANK = '#c49a6c', DARK = '#6e4a2e', STONE = '#9aa0a6', STONE2 = '#b3b8bd', THATCH = '#d6b65a';
function wallParts(t, stone) {
  const c = stone ? STONE : PLANK, c2 = stone ? STONE2 : WOOD, T = .26, out = [];
  if (t.endsWith('short_wall')) { out.push(P(box(4, 2, T), c, 0, 1, 0), P(box(4, .2, T + .06), c2, 0, 1.1, 0), P(box(.3, 2, .32), stone ? '#868c92' : DARK, -2, 1, 0), P(box(.3, 2, .32), stone ? '#868c92' : DARK, 2, 1, 0)); return out; }
  const post = x => out.push(P(box(.3, 3, .32), stone ? '#868c92' : DARK, x, 1.5, 0));
  if (t.endsWith('wall')) { out.push(P(box(4, 3, T), c, 0, 1.5, 0), P(box(4, .2, T + .06), c2, 0, 1, 0), P(box(4, .2, T + .06), c2, 0, 2.2, 0)); }
  else if (t.endsWith('window')) { out.push(P(box(4, 1.1, T), c, 0, .55, 0), P(box(4, .7, T), c, 0, 2.65, 0), P(box(1.25, 1.2, T), c, -1.375, 1.7, 0), P(box(1.25, 1.2, T), c, 1.375, 1.7, 0), P(box(1.6, .1, T + .1), c2, 0, 1.12, 0), P(box(.08, 1.2, .08), c2, 0, 1.7, 0)); }
  else { out.push(P(box(1.25, 3, T), c, -1.375, 1.5, 0), P(box(1.25, 3, T), c, 1.375, 1.5, 0), P(box(1.5, .5, T), c, 0, 2.75, 0), P(box(1.7, .12, T + .1), c2, 0, 2.5, 0)); }
  post(-2); post(2); return out;
}
// End caps: where a roof piece is the last one in its row, its open side is closed with a triangle (and, for a row stacked
// higher up, a band reaching down to the wall top). s.cap = [left, right]: -1 = no cap, otherwise the band in 2 m steps.
function roofCaps(s, stone, add, ridge) {
  if (!s.cap) return; const parts = [], col = stone ? STONE : PLANK;
  for (const [i, sg] of [[0, -1], [1, 1]]) {
    const n = s.cap[i]; if (n == null || n < 0) continue; const b = -2 * n;
    const pts = ridge ? (n ? [[-2, b], [2, b], [2, 0], [0, 1], [-2, 0]] : [[-2, 0], [2, 0], [0, 1]]) : (n ? [[-2, b], [2, b], [2, 2], [-2, 0]] : [[-2, 0], [2, 0], [2, 2]]);
    const sh = new THREE.Shape(); sh.moveTo(...pts[0]); for (const q of pts.slice(1)) sh.lineTo(...q); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: .24, bevelEnabled: false }); g.translate(0, 0, -.12); g.rotateY(-Math.PI / 2); g.translate(sg * 2, 0, 0);
    parts.push(P(g, col));
  }
  if (parts.length) add(parts);
}
export function makeStruct(s, clanColor) {
  const t = s.t, g = new THREE.Group(), u = g.userData = {}, stone = t.startsWith('stone');
  const add = (parts, sh = true) => { const m = M(parts, sh); g.add(m); return m; };
  const fire = (y, sz, li) => { const f = new THREE.Mesh(cone(.3 * sz, .8 * sz, 6), GLOW); f.position.y = y; g.add(f); u.flame = f; const l = new THREE.PointLight('#ffa040', li, 20, 1.5); l.position.y = y + .5; g.add(l); u.light = l; };
  switch (STRUCTS[t].kind === 'place' ? t : STRUCTS[t].kind) {
    case 'foundation': add(stone ? [P(box(4, 3.2, 4), STONE, 0, -1.6, 0), P(box(4.1, .2, 4.1), STONE2, 0, -.1, 0)] : [P(box(3.9, 3, 3.9), DARK, 0, -1.6, 0), P(box(4, .2, 4), PLANK, 0, -.1, 0), ...[-1.5, -.5, .5, 1.5].map(x => P(box(.04, .02, 4), DARK, x, .01, 0))]); break;
    case 'wall':
      if (t === 'fence') { add([P(box(.16, 1.2, .16), DARK, -2, .6, 0), P(box(.16, 1.2, .16), DARK, 2, .6, 0), P(box(.14, 1.1, .14), DARK, 0, .55, 0), P(box(4, .12, .08), WOOD, 0, .95, 0), P(box(4, .12, .08), WOOD, 0, .5, 0)]); break; }
      if (STRUCTS[t].gable) {      // triangle that closes the open end under a pitched roof
        // shape = v % 3: 0/1 a triangle rising 2 m toward local +x / -x (under a roof slope), 2 a 1 m peak (under a ridge).
        // Every 3 added to v puts a 2 m solid band underneath, to reach down to the wall top below a higher row of slopes.
        const v = s.v ?? 2, k = v % 3, lift = 2 * Math.floor(v / 3), sh = new THREE.Shape();
        sh.moveTo(-2, 0); sh.lineTo(2, 0); sh.lineTo(2, lift + (k === 0 ? 2 : 0)); if (k === 2) sh.lineTo(0, lift + 1); sh.lineTo(-2, lift + (k === 1 ? 2 : 0)); sh.closePath();
        const tri = new THREE.ExtrudeGeometry(sh, { depth: .26, bevelEnabled: false }); tri.translate(0, 0, -.13);
        const px = k === 0 ? 1.9 : k === 1 ? -1.9 : 0, ph = lift + (k === 2 ? .9 : 1.9);
        add([P(tri, stone ? STONE : PLANK), P(box(4, .14, .32), stone ? STONE2 : WOOD, 0, .07, 0), P(box(.2, ph, .3), stone ? '#868c92' : DARK, px, ph / 2, 0)]); break;
      }
      add(wallParts(t, stone));
      if (STRUCTS[t].door) { const d = new THREE.Group(); d.position.set(-.75, 0, 0); d.add(M([P(box(1.5, 2.45, .1), stone ? WOOD : DARK, .75, 1.23, 0), P(box(.08, .08, .2), '#d9b23a', 1.3, 1.2, 0)])); g.add(d); u.door = d; }
      break;
    case 'floor': add([P(box(4, .2, 4), stone ? STONE2 : PLANK, 0, -.1, 0), P(box(4, .12, .2), DARK, 0, -.24, -1.9), P(box(4, .12, .2), DARK, 0, -.24, 1.9)]); break;
    case 'roof': { const c = stone ? '#59636e' : THATCH, a = Math.atan2(1, 2); roofCaps(s, stone, add, true); add([P(box(4.3, .18, 2.36), c, 0, .55, -1.02, -a), P(box(4.3, .18, 2.36), c, 0, .55, 1.02, a), P(box(4.4, .2, .34), stone ? '#434b54' : '#b89a45', 0, 1.06, 0)]); break; }      // ridge: peaks 1 m up in the middle, same pitch as the slopes
    case 'slope': { const c = stone ? '#59636e' : THATCH, e = stone ? '#434b54' : '#b89a45', a = Math.atan2(2, 4); roofCaps(s, stone, add, false); add([P(box(4.3, .18, 4.62), c, 0, 1.05, 0, -a), P(box(4.3, .12, .22), e, 0, .08, -2.14, -a), P(box(.12, .1, 4.5), e, -2.12, 1.1, 0, -a), P(box(.12, .1, 4.5), e, 2.12, 1.1, 0, -a)]); break; }      // rises 2 m across the square toward local +z
    case 'stairs': add([0, 1, 2, 3, 4, 5].map(i => P(box(3.6, .5, 4 / 6 + .02), i % 2 ? PLANK : WOOD, 0, .25 + i * .5, -2 + (i + .5) * (4 / 6)))); break;
    case 'campfire': add([...[0, 1, 2, 3, 4, 5, 6, 7].map(i => P(dod(.16), i % 2 ? STONE : STONE2, Math.cos(i * .785) * .55, .1, Math.sin(i * .785) * .55)), P(cyl(.08, .08, .9, 5), DARK, 0, .16, 0, 0, 0, 1.3), P(cyl(.08, .08, .9, 5), '#3a2a1e', 0, .16, 0, 1.3, .9, 0), P(cyl(.08, .08, .9, 5), DARK, 0, .2, 0, 1.3, -.9, 0)]); fire(.55, 1, 30); break;
    case 'torch_post': add([P(cyl(.05, .07, 1.7, 5), DARK, 0, .85, 0)]); fire(1.85, .45, 22); break;
    case 'workbench': add([P(box(1.8, .14, .95), PLANK, 0, .95, 0), ...[[-.8, -.38], [.8, -.38], [-.8, .38], [.8, .38]].map(([x, z]) => P(box(.12, .9, .12), DARK, x, .45, z)), P(box(1.6, .08, .1), DARK, 0, .4, 0), P(box(.14, .14, .3), STONE, .5, 1.09, 0), P(cyl(.025, .025, .5, 5), WOOD, .5, 1.06, .1, 1.57), P(box(.5, .04, .3), '#e8dcc0', -.4, 1.04, .1, 0, .3)]); break;
    case 'chest': add([P(box(1, .6, .65), WOOD, 0, .3, 0), P(box(1.04, .25, .69), DARK, 0, .72, 0), P(box(1.06, .08, .7), '#8e9499', 0, .58, 0), P(box(.14, .2, .06), '#d9b23a', 0, .56, .35)]); break;
    case 'bed': add([P(box(1.1, .3, 2), DARK, 0, .25, 0), P(box(1, .18, 1.9), '#e8e4d8', 0, .48, 0), P(box(1.02, .2, 1.2), '#c0392b', 0, .52, .32), P(box(.7, .14, .36), '#fff', 0, .62, -.7), P(box(1.1, .8, .12), DARK, 0, .5, -1)]); break;
    case 'furnace': add([P(box(1.5, 1.5, 1.4), STONE, 0, .75, 0), P(box(1.1, .5, 1), STONE2, 0, 1.75, 0), P(box(.5, 1, .5), '#868c92', 0, 2.5, 0), P(box(.7, .55, .1), '#2a2a2e', 0, .5, .68)]); { const f = new THREE.Mesh(box(.5, .3, .05), GLOW); f.position.set(0, .45, .74); g.add(f); } break;
    case 'anvil': add([P(cyl(.35, .4, .5, 7), DARK, 0, .25, 0), P(box(.3, .3, .5), '#4a4f55', 0, .65, 0), P(box(.36, .16, .95), '#5c626a', 0, .88, 0), P(cone(.08, .3, 4), '#5c626a', 0, .88, .6, 1.57)]); break;
    case 'loom': add([P(box(.1, 1.8, .1), DARK, -.7, .9, 0), P(box(.1, 1.8, .1), DARK, .7, .9, 0), P(box(1.5, .1, .1), DARK, 0, 1.75, 0), P(box(1.5, .1, .1), DARK, 0, .5, 0), P(box(1.3, 1.15, .03), '#e8dcc0', 0, 1.12, 0), P(box(1.3, .3, .04), '#6f9cf0', 0, .8, 0), P(box(.1, .1, .8), DARK, -.7, .05, 0), P(box(.1, .1, .8), DARK, .7, .05, 0)]); break;
    case 'well': add([P(cyl(1, 1.05, .8, 10), STONE, 0, .4, 0), P(cyl(.78, .78, .1, 10), '#3fa7dd', 0, .62, 0), P(box(.12, 2, .12), DARK, -.9, 1.4, 0), P(box(.12, 2, .12), DARK, .9, 1.4, 0), P(box(2.3, .14, 1.1), THATCH, 0, 2.45, -.35, .5), P(box(2.3, .14, 1.1), THATCH, 0, 2.45, .35, -.5), P(cyl(.06, .06, 1.8, 5), WOOD, 0, 1.9, 0, 0, 0, 1.57), P(box(.02, 1, .02), '#e8dcc0', 0, 1.4, 0), P(cyl(.14, .1, .2, 6), WOOD, 0, .95, 0)]); break;
    case 'farm_plot': add([P(box(2.5, .22, 2.5), '#5b3d26', 0, .05, 0), ...[-.9, -.3, .3, .9].map(x => P(box(.3, .1, 2.3), '#4a3020', x, .19, 0)), P(box(2.6, .12, .1), WOOD, 0, .12, 1.25), P(box(2.6, .12, .1), WOOD, 0, .12, -1.25), P(box(.1, .12, 2.6), WOOD, 1.25, .12, 0), P(box(.1, .12, 2.6), WOOD, -1.25, .12, 0)], false); u.crop = new THREE.Group(); g.add(u.crop); break;
    case 'clan_banner': add([P(cyl(.06, .08, 4.2, 6), DARK, 0, 2.1, 0), P(ico(.13), '#d9b23a', 0, 4.25, 0), P(box(1.3, 1.7, .05), clanColor || '#e0a030', .68, 3.2, 0), P(box(.5, .5, .06), '#fff', .68, 3.3, 0, 0, 0, .785)]); break;
  }
  return g;
}
export function setCrop(g, d, now) {
  const u = g.userData; if (!u.crop) return;
  const stage = !d.crop ? -1 : Math.min(3, Math.floor(3 * Math.max(0, now - d.t0) / Math.max(1, d.ready - d.t0)));
  const key = d.crop + stage + (d.w ? 'w' : ''); if (u.cropKey === key) return; u.cropKey = key; u.crop.clear();
  if (stage < 0) return;
  const c = CROPS[d.crop].c, h = [.2, .45, .75, 1][stage] * (d.crop === 'corn' ? 1.6 : d.crop === 'pumpkin' ? .5 : 1), parts = [];
  for (const [x, z] of [[-.6, -.6], [.6, -.6], [-.6, .6], [.6, .6], [0, 0]]) {
    parts.push(P(cone(.13, h, 5), stage === 3 && d.crop === 'wheat' ? c : '#5fae4a', x, .2 + h / 2, z), P(cone(.1, h * .8, 4), '#6dbb55', x + .14, .2 + h * .4, z + .08, 0, 0, -.5));
    if (stage === 3) parts.push(d.crop === 'pumpkin' ? P(ico(.26), c, x + .1, .42, z + .1, 0, 0, 0, 1.1, .85, 1.1) : P(ico(.1), c, x, .25 + h, z));
  }
  if (d.w) parts.push(P(box(2.3, .02, 2.3), '#3a2618', 0, .25, 0));
  u.crop.add(M(parts, false));
}
export function ghostOf(s) {
  const g = makeStruct(s); const m = new THREE.MeshBasicMaterial({ color: '#7dff8a', transparent: true, opacity: .5, depthWrite: false });
  g.traverse(o => { if (o.isMesh) { o.material = m; o.castShadow = false; } if (o.isLight) o.visible = false; }); g.userData.gmat = m; return g;
}

// ---- world ----
export function createWorld(scene) {
  // terrain
  const g = new THREE.PlaneGeometry(SIZE, SIZE, N - 1, N - 1); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), ZC = { a: new THREE.Color(), b: new THREE.Color() };
  const C = { sand: new THREE.Color('#dcc88f'), wet: new THREE.Color('#a89a6c'), grass: new THREE.Color('#7fbf58'), forest: new THREE.Color('#4f9443'), rock: new THREE.Color('#8b8f92'), snow: new THREE.Color('#f3f6f9') }, tc = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z); pos.setY(i, h);
    if (h < 0) tc.copy(C.wet).lerp(C.sand, Math.max(0, 1 + h / 3));
    else if (h < 1.3) tc.copy(C.sand);
    else {
      // grass takes its colour from the zone, blended across zone borders so they fade rather than show a line
      const [za, zb, gap] = zones2(x, z), th = THEMES[za.th]; ZC.a.set(th.grass); ZC.b.set(THEMES[zb.th].grass); ZC.a.lerp(ZC.b, .5 - .5 * Math.min(1, gap / 40));
      tc.copy(ZC.a).lerp(C.forest, Math.min(1, Math.max(0, (moistAt(x, z) - th.moist + .08) * 4)) * (za.th === 'frost' || za.th === 'autumn' ? .3 : .7)); if (h < 2.2) tc.lerp(C.sand, (2.2 - h) / .9); if (h > 13) tc.lerp(C.rock, Math.min(1, (h - 13) / 3)); if (h > 24) tc.lerp(C.snow, Math.min(1, (h - 24) / 3)); }
    const n = .92 + rnd(Math.round(x), Math.round(z), 5) * .16; col[i * 3] = tc.r * n; col[i * 3 + 1] = tc.g * n; col[i * 3 + 2] = tc.b * n;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const terrain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); terrain.receiveShadow = true; scene.add(terrain);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: '#3a9fd6', transparent: true, opacity: .8, roughness: .12, metalness: .15 })); water.rotation.x = -Math.PI / 2; scene.add(water);
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshBasicMaterial({ color: '#1d5f8f' })); deep.rotation.x = -Math.PI / 2; deep.position.y = -9.5; scene.add(deep);

  // Trees, rocks and plants are drawn per 200 m chunk, and only chunks near the camera are shown: the land is too big to draw at once.
  const CH = 200, VIEW = 380, GRASS_VIEW = 250, nodes = genNodes(), chunks = new Map(), where = [], geos = {};
  const chunkOf = (x, z) => { const cx = Math.floor((x + HALF) / CH), cz = Math.floor((z + HALF) / CH), k = cx * 100 + cz; let c = chunks.get(k);
    if (!c) { chunks.set(k, c = { x: -HALF + (cx + .5) * CH, z: -HALF + (cz + .5) * CH, by: {}, g: new THREE.Group(), gg: new THREE.Group() }); c.g.add(c.gg); } return c; };
  for (const n of nodes) (chunkOf(n.x, n.z).by[n.t] ||= []).push(n);
  const mat4 = (n, alive) => _m.compose(_v.set(n.x, n.y - .05, n.z), _q.setFromEuler(_e.set(0, n.ry, 0)), alive ? _s.setScalar(n.s) : _s.set(0, 0, 0));
  for (const c of chunks.values()) {
    for (const t in c.by) {
      const im = new THREE.InstancedMesh(geos[t] ||= nodeGeo(t), MAT, c.by[t].length); im.castShadow = true; im.receiveShadow = true;
      c.by[t].forEach((n, i) => { im.setMatrixAt(i, mat4(n, true)); where[n.id] = [im, i]; }); im.computeBoundingSphere(); c.g.add(im);
    }
    scene.add(c.g);
  }
  const setNode = (id, alive) => { const [im, i] = where[id]; im.setMatrixAt(i, mat4(nodes[id], alive)); im.instanceMatrix.needsUpdate = true; };

  // grass tufts + flowers for a lived-in feel, scattered per chunk too
  const tuft = merge([P(cone(.06, .5, 3), '#8fcc62', 0, .25, 0), P(cone(.05, .4, 3), '#7fbf58', .12, .2, .05, 0, 0, -.3), P(cone(.05, .42, 3), '#9ad36c', -.1, .2, -.06, 0, 0, .3)]);
  const flower = merge([P(cyl(.015, .015, .3, 4), '#5fae4a', 0, .15, 0), P(ico(.07), '#ffffff', 0, .33, 0)]);
  const FLOW = ['#ffffff', '#ffd84a', '#ff8fb3', '#c58cff', '#ff6b5a'];
  for (let cx = 0; cx < SIZE / CH; cx++) for (let cz = 0; cz < SIZE / CH; cz++) {
    const c = chunkOf(-HALF + (cx + .5) * CH, -HALF + (cz + .5) * CH), seed = cx * 31 + cz * 7 + 3;
    for (const [geo, count, colors] of [[tuft, 780, null], [flower, 200, FLOW]]) {
      const im = new THREE.InstancedMesh(geo, MAT, count); im.receiveShadow = true; let k = 0;
      for (let i = 0; k < count && i < count * 3; i++) {
        const x = c.x + (rnd(i, seed, 1) - .5) * CH, z = c.z + (rnd(i, seed, 2) - .5) * CH, h = heightAt(x, z); if (h < 1.6 || h > 14) continue;
        im.setMatrixAt(k, _m.compose(_v.set(x, h, z), _q.setFromEuler(_e.set(0, rnd(i, seed, 3) * 6, 0)), _s.setScalar(.8 + rnd(i, seed, 4) * .7)));
        if (colors) im.setColorAt(k, _c.set(colors[i % colors.length])); k++;
      }
      im.count = k; if (k) { im.computeBoundingSphere(); c.gg.add(im); }
    }
  }
  const showNear = focus => { for (const c of chunks.values()) { const d = Math.hypot(c.x - focus.x, c.z - focus.z); c.g.visible = d < VIEW; c.gg.visible = d < GRASS_VIEW; } };      // small grass only close by
  let lastShow = -1;

  // sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float h; void main(){ gl_FragColor = vec4(mix(bot, top, pow(clamp(h*1.4,0.0,1.0),0.6)),1.0); \n#include <colorspace_fragment>\n }' }));
  sky.renderOrder = -10; scene.add(sky);
  const sp = new Float32Array(900 * 3); for (let i = 0; i < 900; i++) { const a = rnd(i, 1, 7) * 6.283, b = Math.acos(rnd(i, 2, 7)); sp.set([Math.cos(a) * Math.sin(b) * 1100, Math.cos(b) * 1100 + 20, Math.sin(a) * Math.sin(b) * 1100], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff', size: 2.2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false })); scene.add(stars);
  const sunM = new THREE.Mesh(new THREE.SphereGeometry(40, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff3c4', fog: false })); scene.add(sunM);
  const moonM = new THREE.Mesh(new THREE.SphereGeometry(26, 12, 8), new THREE.MeshBasicMaterial({ color: '#dfe8ff', fog: false })); scene.add(moonM);
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9, fog: false }), clouds = new THREE.Group();
  for (let i = 0; i < 30; i++) { const c = new THREE.Mesh(merge([0, 1, 2, 3].map(j => P(ico(14 + rnd(i, j, 8) * 10), '#fff', j * 16 - 24, rnd(i, j, 9) * 6, rnd(i, j, 10) * 14, 0, 0, 0, 1.3, .55, 1))), cloudMat); c.position.set((rnd(i, 1, 12) - .5) * 2400, 150 + rnd(i, 2, 12) * 70, (rnd(i, 3, 12) - .5) * 2400); clouds.add(c); }
  scene.add(clouds);

  const hemi = new THREE.HemisphereLight('#cfe8ff', '#6b7a4a', 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 2.5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 260 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .04; scene.add(sun, sun.target);
  scene.fog = new THREE.Fog('#bfe3ff', 90, 420);
  const K = { nTop: new THREE.Color('#0a1030'), dTop: new THREE.Color('#3f8fe6'), nBot: new THREE.Color('#1e2a52'), dBot: new THREE.Color('#c4e6ff'), dusk: new THREE.Color('#ff9a5a'), sunC: new THREE.Color('#fff4dd'), moonC: new THREE.Color('#8fa8ff') };
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function update(t, time, focus, cam) {
    const ang = (t - .25) * Math.PI * 2, s = Math.sin(ang), c = Math.cos(ang), day = sm(-.12, .25, s), dusk = (1 - sm(0, .4, Math.abs(s))) * .75;
    const U = sky.material.uniforms; U.top.value.copy(K.nTop).lerp(K.dTop, day); U.bot.value.copy(K.nBot).lerp(K.dBot, day).lerp(K.dusk, dusk);
    scene.fog.color.copy(U.bot.value); sky.position.copy(cam.position); stars.position.copy(cam.position); stars.material.opacity = 1 - sm(-.1, .15, s);
    const dir = _v.set(c, s, .35).normalize();
    sunM.position.copy(cam.position).addScaledVector(dir, 1000); moonM.position.copy(cam.position).addScaledVector(dir, -1000);
    if (s > -.05) { sun.color.copy(K.sunC).lerp(K.dusk, dusk); sun.intensity = .3 + 2.6 * day; sun.position.copy(focus).addScaledVector(dir, 120); }
    else { sun.color.copy(K.moonC); sun.intensity = .55; sun.position.copy(focus).addScaledVector(dir, -120); }
    sun.target.position.copy(focus);
    hemi.intensity = .5 + .6 * day; hemi.color.set(day > .5 ? '#cfe8ff' : '#8fa0e0');
    cloudMat.opacity = .25 + .65 * day; clouds.position.x = (time * 3) % 400;
    if (time - lastShow > .5) { lastShow = time; showNear(focus); }
    water.position.y = Math.sin(time * .8) * .04; water.position.x = cam.position.x; water.position.z = cam.position.z;
    return day;
  }
  return { nodes, setNode, update };
}
