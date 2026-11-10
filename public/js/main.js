// Client: input, third-person controller, networking, and glue between the 3D world and the UI.
import * as THREE from 'three';
import { ITEMS, NODES, STRUCTS, ANIMALS, SKILLS } from '/shared/data.js';
import { heightAt, SPAWN } from '/shared/terrain.js';
import * as G from './gfx.js';
import { createUI } from './ui.js';

const $ = id => document.getElementById(id);
const S = window.S = { me: null, id: null, players: new Map(), animals: new Map(), structs: new Map(), dead: new Set(), time: .3, clan: null, invites: [], chest: null, sel: 0, build: null, off: 0, keys: {}, stam: 100, target: null, sneak: false, fishing: false };
const sock = io({ transports: ['websocket', 'polling'] });
const emit = (ev, d, cb) => sock.emit(ev, d ?? {}, cb);

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, .2, 2600);
const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();
const world = G.createWorld(scene);
const cam = { yaw: 2.4, pitch: .38, dist: 7.5 };
const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .06, 6, 28), new THREE.MeshBasicMaterial({ color: '#fff7c2', transparent: true, opacity: .85, depthTest: false })); ring.rotation.x = Math.PI / 2; ring.visible = false; ring.renderOrder = 5; scene.add(ring);

// node lookup grid
const grid = new Map(), gk = (x, z) => (Math.floor(x / 8) + 500) * 1000 + Math.floor(z / 8) + 500;
for (const n of world.nodes) { const k = gk(n.x, n.z); (grid.get(k) || grid.set(k, []).get(k)).push(n); }
function nodesNear(x, z, fn) { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = grid.get(gk(x + i * 8, z + j * 8)); if (a) for (const n of a) if (!S.dead.has(n.id)) fn(n); } }

// ---------- audio (tiny synth, no files) ----------
// ---------- settings (kept in this browser) ----------
const cfg = { vol: 70, music: 50, mute: false, sens: 100, padSens: 100, invY: false, hints: 'auto' };
try { Object.assign(cfg, JSON.parse(localStorage.kwCfg || '{}')); } catch { }
function setCfg(k, d) {
  if (k === 'mute' || k === 'invY') cfg[k] = !cfg[k];
  else if (k === 'hints') cfg.hints = { auto: 'kb', kb: 'pad', pad: 'auto' }[cfg.hints] || 'auto';
  else if (k === 'vol' || k === 'music') { cfg[k] = Math.max(0, Math.min(100, cfg[k] + d * 10)); cfg.mute = false; }
  else cfg[k] = Math.max(20, Math.min(300, cfg[k] + d * 20));
  try { localStorage.kwCfg = JSON.stringify(cfg); } catch { }
  if (k === 'vol' || k === 'mute') sound('pick');
  music.vol();
}
const padUI = () => cfg.hints === 'pad' || (cfg.hints === 'auto' && !!S.pad);     // show controller button names?
function logout() { try { localStorage.removeItem('kwToken'); } catch { } sock.disconnect(); location.href = location.pathname; }

let ac; function beep(f, d = .08, type = 'triangle', v = .06, slide = 0) { v *= cfg.mute ? 0 : cfg.vol / 70; if (v <= 0) return; try { ac ||= new AudioContext(); const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), ac.currentTime + d); g.gain.value = v; g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + d); } catch { } }
// ---------- music: a small generated folk tune (no audio files) ----------
// Plucked melody over bass, arpeggio and a soft pad. Phrases go A A B A, then a short rest; calmer and slower at night.
const music = (() => {
  let out, wet, next = 0, step = 0, started = false, phrases = null, loops = 0, night = false, last = 76;
  const PENT = [0, 2, 4, 7, 9], hz = m => 440 * Math.pow(2, (m - 69) / 12), R = () => Math.random();
  const PROG = { day: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], night: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [52, 55, 59]] };
  const RHY = [[0, 2, 4, 6], [0, 3, 4, 6], [0, 2, 3, 4, 6], [0, 4, 6], [0, 2, 4, 5, 6], [0, 4]];
  const scale = []; for (let o = 5; o <= 7; o++) for (const p of PENT) scale.push(o * 12 + p);      // C major pentatonic, C4..A6
  function phrase(prog, calm) {      // 4 bars of 8 eighth-notes; returns [stepIndex, midiNote] pairs
    const notes = [];
    for (let bar = 0; bar < 4; bar++) {
      const c = prog[bar], rh = bar === 3 ? (calm ? [0] : [0, 2, 4]) : RHY[Math.floor(R() * (calm ? RHY.length : 5))];
      for (const st of rh) {
        let n;
        if (st === 0) { const tones = c.map(x => x + 12).concat(c[0] + 24).filter(x => x >= 67 && x <= 84); n = tones.sort((a, b) => Math.abs(a - last) - Math.abs(b - last))[R() < .7 ? 0 : 1] ?? tones[0]; }
        else { let i = scale.reduce((bi, x, k) => Math.abs(x - last) < Math.abs(scale[bi] - last) ? k : bi, 0); i += (R() < .5 ? 1 : -1) * (R() < .8 ? 1 : 2); n = scale[Math.max(3, Math.min(10, i))]; }
        last = n; notes.push([bar * 8 + st, n]);
      }
    }
    return notes;
  }
  function compose() { night = S.time < .22 || S.time > .79; const pr = PROG[night ? 'night' : 'day']; const A = phrases && loops % 3 ? phrases[0] : phrase(pr, night), B = phrase([pr[2], pr[3], pr[1], pr[3]], night); phrases = [A, A, B, A]; phrases.prog = [pr, pr, [pr[2], pr[3], pr[1], pr[3]], pr]; loops++; }
  function tone(t, m, v, dur, type = 'triangle', att = .012) { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = hz(m); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(out); g.connect(wet); o.start(t); o.stop(t + dur + .05); }
  function schedule(t) {
    const LEN = 4 * 32 + 16, s = step % LEN, rest = s >= 128;       // 16 bars of tune, then 2 quiet bars
    if (s === 0) compose();
    const ph = Math.min(3, Math.floor(s / 32)), ps = s % 32, bar = Math.floor(ps / 8) % 4, b8 = ps % 8, c = phrases.prog[ph][bar], soft = night ? .7 : 1;
    if (b8 === 0) for (const m of c) tone(t, m, .016 * soft, 60 / (night ? 70 : 90) * 4.2, 'sine', .7);           // pad
    if (b8 === 0 || b8 === 4) tone(t, c[0] - 12, .075 * soft, 1.1, 'sine');                                         // bass
    if (!rest && (b8 === 2 || b8 === 6)) tone(t + .004, c[b8 === 2 ? 1 : 2], .028 * soft, .7);                    // arpeggio
    if (!rest) for (const [st, n] of phrases[ph]) if (st === ps) { const v = (b8 === 0 ? .085 : .06) * soft * (.85 + R() * .3), h = t + R() * .012; tone(h, n, v, 1.0); tone(h, n + 12, v * .22, .5, 'sine'); }
    step++;
  }
  function tick() {
    if (!started || !ac || ac.state !== 'running') return;
    if (next < ac.currentTime) next = ac.currentTime + .06;
    while (next < ac.currentTime + .5) { schedule(next); next += 60 / (night ? 70 : 90) / 2; }
  }
  function vol() { if (out) out.gain.value = cfg.mute ? 0 : cfg.music / 100; }
  function start() {
    try {
      ac ||= new AudioContext(); if (ac.state === 'suspended') ac.resume();
      if (started) return; started = true;
      out = ac.createGain(); wet = ac.createGain(); wet.gain.value = .3; vol();
      const dl = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter(), mix = ac.createGain();         // soft echo for a cosy room sound
      dl.delayTime.value = .31; fb.gain.value = .32; lp.type = 'lowpass'; lp.frequency.value = 1800;
      wet.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(mix); mix.connect(out); out.connect(ac.destination);
      setInterval(tick, 100);
    } catch { }
  }
  return { start, vol, get info() { return { started, step, night, state: ac?.state, first: phrases?.[0]?.slice(0, 12) }; } };
})();
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (S.me) music.start(); }, true);

const sound = k => ({ chop: () => beep(140, .09, 'square', .05, -60), pick: () => beep(620, .07, 'sine', .06, 300), craft: () => { beep(520, .08); setTimeout(() => beep(780, .1), 80); }, lvl: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .16, 'triangle', .08), i * 110)), hurt: () => beep(180, .2, 'sawtooth', .07, -100), eat: () => beep(300, .1, 'sine', .06, 120), place: () => beep(200, .1, 'square', .05, 80), bow: () => beep(700, .12, 'sine', .05, -500) }[k]?.());

// ---------- graphics quality ----------
let sunLight = null; scene.traverse(o => { if (o.isDirectionalLight) sunLight = o; });
function applyGfx() { const low = localStorage.kwGfx === 'low'; renderer.setPixelRatio(low ? Math.min(devicePixelRatio, 1) : Math.min(devicePixelRatio, 1.5)); sunLight.castShadow = !low; resize(); }
function toggleGfx() { localStorage.kwGfx = localStorage.kwGfx === 'low' ? 'high' : 'low'; applyGfx(); ui.toast('Graphics: ' + (localStorage.kwGfx === 'low' ? 'Fast' : 'Pretty')); }
applyGfx();
let fpsN = 0, fpsT = 0;       // if the first seconds run slowly, drop to fast graphics once (unless the player chose)
function fpsWatch(dt) { if (!S.me || localStorage.kwGfx || fpsT < 0) return; fpsN++; fpsT += dt; if (fpsT > 6) { if (fpsN / fpsT < 26 && !navigator.webdriver) { localStorage.kwGfx = 'low'; applyGfx(); ui.toast('Switched to fast graphics for a smoother game (change it in the menu: Esc)'); } fpsT = -1; } }

// ---------- UI ----------
const act = { emit, sound, select, startBuild, stations, drawMap, toggleGfx, cfg, setCfg, logout, lock };
const ui = createUI(S, act);

// ---------- login ----------
const LOOKS = { shirt: ['#d9534f', '#e08a2c', '#e6c229', '#3fa35a', '#2f8fd0', '#7a5cc9', '#d86fa8', '#eeeeee'], hair: ['#5a3a22', '#2a2320', '#c9a24a', '#b5522a', '#8a8f96', '#e87fb0'], skin: ['#f1c7a0', '#e0a878', '#b9794c', '#8a5a3a', '#5e3d27'] };
const look = JSON.parse(localStorage.kwLook || 'null') || { shirt: LOOKS.shirt[0], hair: LOOKS.hair[0], skin: LOOKS.skin[0] };
for (const [k, el] of [['shirt', 'swShirt'], ['hair', 'swHair'], ['skin', 'swSkin']]) {
  $(el).innerHTML = LOOKS[k].map(c => `<b style="background:${c}" data-c="${c}" class="${look[k] === c ? 'on' : ''}"></b>`).join('');
  $(el).onclick = e => { if (!e.target.dataset.c) return; look[k] = e.target.dataset.c; [...$(el).children].forEach(b => b.classList.toggle('on', b === e.target)); };
}
$('lname').value = localStorage.kwName || '';
function doLogin(name, pin, token) {
  $('lerr').textContent = 'Connecting…';
  emit('login', { name, pin, token, look }, r => {
    if (r.err) { $('lerr').textContent = r.err; return; }
    localStorage.kwName = name; localStorage.kwToken = r.token; localStorage.kwLook = JSON.stringify(look);
    start(r.init);
  });
}
$('loginForm').onsubmit = e => { e.preventDefault(); doLogin($('lname').value.trim(), $('lpin').value); };
const qs = new URLSearchParams(location.search);
if (qs.get('name')) doLogin(qs.get('name'), qs.get('pin') || '1234');
else if (localStorage.kwName && localStorage.kwToken) { $('lpin').placeholder = 'PIN (or just press Play)'; $('lpin').required = false; $('loginForm').onsubmit = e => { e.preventDefault(); const n = $('lname').value.trim(); doLogin(n, $('lpin').value, n === localStorage.kwName ? localStorage.kwToken : null); }; }
sock.on('kick', m => { alert(m); location.reload(); });
sock.on('disconnect', () => { if (S.me) { ui.toast('Connection lost — reconnecting…', 'bad'); setTimeout(() => location.reload(), 2500); } });

// ---------- entities ----------
const me = { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, grounded: true, char: null, mode: 0, speed: 0, lastSwing: 0 };
function addPlayer(p) {
  const old = S.players.get(p.id); if (old) scene.remove(old.char);
  const char = G.makeCharacter(p.look, p.armor); char.add(G.makeLabel((p.tag ? `[${p.tag}] ` : '') + p.name, p.col || '#ffffff'));
  char.position.set(p.x, p.y, p.z); scene.add(char);
  S.players.set(p.id, { ...p, char, tx: p.x, ty: p.y, tz: p.z, tr: p.r || 0, a: 0, held: 0 });
}
function refreshMe(p) { const pos = me.char?.position.clone(); if (me.char) scene.remove(me.char); me.char = G.makeCharacter(p.look, p.armor); me.char.add(G.makeLabel((p.tag ? `[${p.tag}] ` : '') + p.name, p.col || '#fff3c4')); if (pos) me.char.position.copy(pos); scene.add(me.char); S.pub = p; }
function addAnimal(a) { const g = G.makeAnimal(a.t); g.position.set(a.x, a.y, a.z); scene.add(g); S.animals.set(a.id, { ...a, g, tx: a.x, ty: a.y, tz: a.z, tr: a.r || 0, mv: 0 }); }
const col = { surf: [], walls: [], circ: [], ceil: [] };
function addStruct(s) {
  const old = S.structs.get(s.id); if (old) scene.remove(old.g);
  s.g = G.makeStruct(s, s.cc); s.g.position.set(s.x, s.y, s.z); s.g.rotation.y = s.r * Math.PI / 2; scene.add(s.g); S.structs.set(s.id, s); syncStruct(s); rebuildCol();
}
function syncStruct(s) { const u = s.g.userData; if (u.door) u.door.rotation.y = s.d.open ? -1.7 : 0; G.setCrop(s.g, s.d, Date.now() + S.off); }
function rebuildCol() {
  col.surf = []; col.walls = []; col.circ = []; col.ceil = [];
  for (const s of S.structs.values()) {
    const d = STRUCTS[s.t];
    if (d.kind === 'foundation' || d.kind === 'floor') col.surf.push({ x0: s.x - 2, x1: s.x + 2, z0: s.z - 2, z1: s.z + 2, top: s.y, solid: d.kind === 'foundation' });
    if (d.kind === 'floor' || d.kind === 'roof') col.ceil.push({ x0: s.x - 2.3, x1: s.x + 2.3, z0: s.z - 2.3, z1: s.z + 2.3, y: s.y });
    if (d.kind === 'stairs') col.surf.push({ x0: s.x - 2, x1: s.x + 2, z0: s.z - 2, z1: s.z + 2, stairs: true, y: s.y, cx: s.x, cz: s.z, dx: Math.sin(s.r * Math.PI / 2), dz: Math.cos(s.r * Math.PI / 2) });
    else if (d.kind === 'wall') {
      const ax = s.r % 2 === 0 ? 1 : 0, az = 1 - ax, seg = (a, b) => col.walls.push({ x1: s.x + ax * a, z1: s.z + az * a, x2: s.x + ax * b, z2: s.z + az * b, y0: s.y, y1: s.y + d.h });
      if (d.door) { seg(-2, -.75); seg(.75, 2); if (!s.d.open) seg(-.75, .75); } else seg(-2, 2);
    } else if (d.r) col.circ.push({ x: s.x, z: s.z, r: d.r, y0: s.y - .5, y1: s.y + 1.4 });
  }
}
function groundAt(x, z, py) {
  let h = heightAt(x, z);
  for (const s of col.surf) {
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    const top = s.stairs ? s.y + 3 * Math.min(1, Math.max(0, ((x - s.cx) * s.dx + (z - s.cz) * s.dz) / 4 + .5)) : s.top;
    if (top <= py + .8 && top > h) h = top;
  }
  return h;
}

function start(init) {
  S.id = init.id; S.me = init.me; S.time = init.time; S.off = init.now - Date.now(); S.clan = init.clan.clan; S.invites = init.clan.invites;
  me.x = init.me.x; me.z = init.me.z; me.y = heightAt(me.x, me.z);
  refreshMe({ name: init.me.name, look: init.me.look, armor: init.me.equip.body, tag: S.clan?.tag, col: S.clan?.color });
  for (const id of init.dead) { S.dead.add(id); world.setNode(id, false); }
  init.players.forEach(addPlayer); init.animals.forEach(addAnimal); init.structs.forEach(addStruct);
  music.start();
  $('login').hidden = true; $('hud').hidden = false; ui.refresh(); ui.vitals();
  ui.toast(`Welcome to Kinwild, ${init.me.name}!`, 'big'); if (init.me.quest === 0) ui.toast('Click the game to look around. Press H for help.');
  if (init.peaceful) ui.chat({ ch: 'sys', m: 'Peaceful mode: wolves will not hunt players.' });
}

// ---------- network events ----------
sock.on('p+', addPlayer); sock.on('p-', id => { const p = S.players.get(id); if (p) { scene.remove(p.char); S.players.delete(id); } });
sock.on('pu', p => { if (p.id === S.id) refreshMe(p); else if (S.me) addPlayer(p); });
sock.on('a+', a => S.me && addAnimal(a)); sock.on('a-', id => { const a = S.animals.get(id); if (a) { puff(a.g.position.x, a.g.position.y + .5, a.g.position.z, '#ffffff', 10); scene.remove(a.g); S.animals.delete(id); } });
sock.on('s', sn => {
  if (!S.me) return; S.time = sn.t;
  for (const [id, x, y, z, r, a, held] of sn.p) { const p = S.players.get(id); if (p) { p.tx = x; p.ty = y; p.tz = z; p.tr = r; p.a = a; G.setHeld(p.char, held || null, ITEMS[held]); } }
  for (const [id, x, y, z, r, mv] of sn.a) { const a = S.animals.get(id); if (a) { a.tx = x; a.ty = y; a.tz = z; a.tr = r; a.mv = mv; } }
});
sock.on('me', u => { Object.assign(S.me, u); if (u.hp != null) ui.vitals(); if (u.inv || u.skills || u.quest != null) { ui.refresh(); buildBar(); } });
sock.on('nd', ([id, alive]) => { alive ? S.dead.delete(id) : S.dead.add(id); world.setNode(id, !!alive); });
sock.on('st+', s => S.me && addStruct(s)); sock.on('st-', id => { const s = S.structs.get(id); if (s) { scene.remove(s.g); S.structs.delete(id); rebuildCol(); } });
sock.on('st~', u => { const s = S.structs.get(u.id); if (!s) return; if (u.d) s.d = u.d; if ('c' in u) { s.c = u.c; if (s.t === 'clan_banner' && u.cc !== s.cc) { s.cc = u.cc; return addStruct(s); } } syncStruct(s); rebuildCol(); });
sock.on('toast', t => ui.toast(t.m, t.k)); sock.on('chat', c => ui.chat(c));
sock.on('got', g => { ui.feed(`+${g.n} ${ITEMS[g.id].i} ${ITEMS[g.id].n}`); });
sock.on('lvl', l => { ui.toast(`⭐ ${SKILLS[l.sk].n} reached level ${l.l}!`, 'big'); sound('lvl'); });
sock.on('questDone', q => { ui.toast('✔ ' + q.t, 'good'); sound('craft'); });
sock.on('clan', c => { S.clan = c.clan; S.invites = c.invites; if (ui.tab === 'clan') ui.render(); });
sock.on('chest', c => { S.chest = c; if (ui.tab !== 'bag') ui.open('bag'); else ui.render(); });
sock.on('hurt', () => { $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 200); sound('hurt'); });
sock.on('tp', t => { me.x = t.x; me.y = t.y; me.z = t.z; me.vy = 0; ui.toast(t.msg, 'bad'); });
sock.on('fished', f => { S.fishing = false; if (f.ok) { ui.toast('You caught a fish! 🐟', 'good'); sound('pick'); } });
sock.on('sw', id => { const p = S.players.get(id); if (p) p.char.userData.swing = 1; });
sock.on('fx', f => { if (f.k === 'hit') puff(f.x, f.y, f.z, f.c, 7); });
sock.on('arrow', a => arrows.push({ m: arrowMesh(a), o: new THREE.Vector3(...a.o), d: new THREE.Vector3(...a.d), t: 0, len: a.len }));

// ---------- particles & arrows ----------
const parts = [], pgeo = new THREE.BoxGeometry(.12, .12, .12), arrows = [];
function puff(x, y, z, c, n) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); scene.add(m); parts.push({ m, vx: (Math.random() - .5) * 4, vy: 2 + Math.random() * 3, vz: (Math.random() - .5) * 4, life: .6 }); } }
function arrowMesh(a) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1, 4), new THREE.MeshBasicMaterial({ color: '#e8dcc0' })); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...a.d)); scene.add(m); return m; }

// ---------- input ----------
const held = () => S.me?.inv[S.sel], heldDef = () => { const it = held(); return it ? ITEMS[it.id] : null; };
function select(i) { S.sel = (i + 8) % 8; emit('sel', { i: S.sel }); ui.hotbar(); }
const playing = () => S.me && !ui.tab;
addEventListener('keydown', e => {
  if (!S.me || e.target.tagName === 'INPUT') return;
  if (performance.now() - pad.lastT > 1500) S.pad = false;
  if (e.code === 'Tab' || (e.code === 'Space') || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return; S.keys[e.code] = true;
  if (e.code === 'Escape') { if (performance.now() - lockLostT < 400) return; escT = performance.now(); if (S.build) stopBuild(); else if (ui.tab) ui.close(); else ui.open('menu'); return; }
  if (e.code === 'Enter') { $('chatin').focus(); document.exitPointerLock?.(); e.preventDefault(); return; }       // focus first so losing the mouse capture is not read as Esc
  const tabs = { Tab: 'bag', KeyI: 'bag', KeyC: 'craft', KeyB: 'build', KeyG: 'clan', KeyM: 'map', KeyH: 'help' };
  if (tabs[e.code]) { if (e.code === 'KeyB' && S.build) return stopBuild(); ui.open(tabs[e.code]); return; }
  if (ui.tab) { if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 8) ui.numKey(n - 1); } return; }
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 8) select(n - 1); }
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyX') { S.sneak = !S.sneak; ui.toast(S.sneak ? 'Sneaking…' : 'Standing up'); }
  if (e.code === 'KeyR' && S.build) S.build.r = (S.build.r + 1) % 4;
  if (e.code === 'KeyZ' && S.build) { S.build.lvl = (S.build.lvl + 1) % 3; buildBar(); }
  if (e.code === 'KeyK' && S.target?.k === 's' && heldDef()?.tool === 'hammer') emit('demolish', { id: S.target.s.id });
  if (e.code === 'KeyT') nextPiece();
});
addEventListener('keyup', e => { S.keys[e.code] = false; });
addEventListener('blur', () => { S.keys = {}; });
// Mouse capture. After Esc the browser refuses a new capture for about a second, so a refused request is retried
// a few times instead of giving up for good (that was why the pointer stayed loose after coming back from Esc).
let dragging = false, lockTries = 0, lockLostT = -1e9, escT = -1e9; const canLock = 'requestPointerLock' in canvas;
function lock(fresh = true) {
  if (!canLock || !S.me || ui.tab || document.pointerLockElement === canvas) return;
  if (fresh) lockTries = 8;
  const again = () => { if (lockTries-- > 0) setTimeout(() => lock(false), 300); };
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(again); } catch { again(); }
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { lockTries = 0; if (ui.tab) document.exitPointerLock(); return; }      // a late capture must not grab the mouse from an open panel
  // capture ended: if the game did not do it itself (opening a panel or chat), the player pressed Esc
  if (!S.me || ui.tab || document.activeElement?.tagName === 'INPUT' || performance.now() - escT < 400) return;      // (the Esc key press itself was already handled)
  lockLostT = performance.now(); lockTries = 0; S.keys = {};
  if (S.build) stopBuild(); else ui.open('menu');
});
canvas.addEventListener('mousedown', e => {
  if (!S.me || ui.tab) return;
  if (performance.now() - pad.lastT > 1500) S.pad = false;
  if (canLock && document.pointerLockElement !== canvas) { lock(); dragging = true; return; }
  dragging = true;
  if (e.button === 0) { primary(); S.hold = true; } else if (e.button === 2 && S.build) stopBuild();
});
addEventListener('mouseup', () => { dragging = false; S.hold = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (document.pointerLockElement === canvas || dragging) { const k = cfg.sens / 100; cam.yaw -= e.movementX * .0026 * k; cam.pitch = Math.min(1.35, Math.max(-.25, cam.pitch + e.movementY * .0022 * k * (cfg.invY ? -1 : 1))); } });
addEventListener('wheel', e => { if (playing()) select(S.sel + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });

// ---------- actions ----------
const fwd = () => [-Math.sin(cam.yaw), -Math.cos(cam.yaw)];
function swingAnim() { me.char.userData.swing = 1; me.yaw = Math.atan2(...fwd()); me.lastSwing = performance.now(); }
function nearWater() { const [fx, fz] = fwd(); for (let d = 0; d <= 4.5; d += .75) if (heightAt(me.x + fx * d, me.z + fz * d) < .15) return true; return false; }
function interact() {
  const t = S.target;
  if (t?.k === 'n') { if (NODES[t.node.t].pick) { emit('pick', { id: t.node.id }); swingAnim(); sound('pick'); } else ui.toast(`Left click to ${NODES[t.node.t].tool === 'axe' ? 'chop' : 'mine'}`); }
  else if (t?.k === 's') useStruct(t.s);
  else if (nearWater()) emit('drink', {}, r => { if (r?.ok) { ui.toast('Ahh, fresh water! 💧', 'good'); sound('eat'); } });
}
function useStruct(s) {
  const d = STRUCTS[s.t]; if (d.station) return ui.open('craft');
  emit('sUse', { id: s.id }, r => { if (r?.ok) sound(r.ok === 'drink' ? 'eat' : 'pick'); if (r?.ok === 'harvest') ui.toast('Harvested! 🌾', 'good'); if (r?.ok === 'water') ui.toast('Watered 💧 — it will grow faster', 'good'); if (r?.ok === 'drink') ui.toast('Ahh, fresh water! 💧', 'good'); });
}
function primary() {
  if (S.build) return placeBuild();
  const def = heldDef(), t = S.target;
  if (def?.tool === 'bow') { if (performance.now() - me.lastSwing < 650) return; swingAnim(); sound('bow'); const aim = aimPoint(), from = new THREE.Vector3(me.x, me.y + 1.4, me.z), dist = aim.distanceTo(from); aim.y += .0015 * dist * dist; aim.sub(from).normalize(); return emit('shoot', { dx: aim.x, dy: aim.y, dz: aim.z }); }
  if (def?.tool === 'rod') {
    if (S.fishing || performance.now() - me.lastSwing < 700) return; const [fx, fz] = fwd();
    for (let d = 2; d <= 8; d += 1) if (heightAt(me.x + fx * d, me.z + fz * d) < -.1) { swingAnim(); return emit('fish', { x: me.x + fx * d, z: me.z + fz * d }, r => { if (r?.ok) { S.fishing = true; ui.toast('Line is out… stand still and wait for a bite'); } else if (r?.err) ui.toast(r.err); }); }
    return ui.toast('Face the water to cast');
  }
  const plot = t?.k === 's' && t.s.t === 'farm_plot';
  if (def && (def.food || def.heal || def.armor || def.tool === 'water') && !plot) return emit('useItem', { slot: S.sel }, r => { if (r?.ok) sound('eat'); });
  if (performance.now() - me.lastSwing < 400) return;
  swingAnim();
  if (t?.k === 'a') { emit('swing', { k: 'a', id: t.a.id }); sound('chop'); }
  else if (t?.k === 'n') { if (NODES[t.node.t].pick) { emit('pick', { id: t.node.id }); sound('pick'); } else { emit('swing', { k: 'n', id: t.node.id }); sound('chop'); } }
  else if (t?.k === 's' && (STRUCTS[t.s.t].door || ['farm_plot', 'chest', 'bed', 'well', 'clan_banner'].includes(t.s.t) || STRUCTS[t.s.t].station) && def?.tool !== 'hammer') useStruct(t.s);
  else emit('swing', {});
}
function aimPoint() {      // what is under the crosshair: an animal, the ground, or far away
  const d = new THREE.Vector3(), o = camera.position; camera.getWorldDirection(d);
  for (let t = cam.dist * .7; t < 70; t += .5) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    for (const a of S.animals.values()) { const p = a.g.position; if (Math.hypot(p.x - x, p.y + .6 - y, p.z - z) < 1.3) return new THREE.Vector3(a.tx, a.ty + .6, a.tz); }
    if (y < heightAt(x, z)) return new THREE.Vector3(x, y, z);
  }
  return o.clone().addScaledVector(d, 70);
}
function stations() { const out = new Set(); for (const s of S.structs.values()) { const st = STRUCTS[s.t].station; if (st && Math.hypot(s.x - me.x, s.z - me.z) < 7) out.add(st); } return out; }

// ---------- building ----------
function startBuild(t) { stopBuild(); S.build = { t, r: 0, lvl: 0, ghost: G.ghostOf({ t, d: {} }) }; scene.add(S.build.ghost); buildBar(); lock(); }
function stopBuild() { if (!S.build) return; scene.remove(S.build.ghost); S.build = null; $('buildbar').hidden = true; }
function buildBar() {
  if (!S.build) return; const d = STRUCTS[S.build.t], p = padUI(), hint = ui.costHint(d);
  $('buildbar').hidden = false;
  $('buildbar').innerHTML = `${d.i} <b>${d.n}</b> &nbsp; <kbd>${p ? 'RT' : 'Click'}</kbd>place <kbd>${p ? 'X' : 'R'}</kbd>turn ${d.kind !== 'place' && d.kind !== 'foundation' ? `<kbd>${p ? 'Y' : 'Z'}</kbd>level ${(S.build.L ?? S.build.lvl) + 1} ` : ''}<kbd>${p ? 'B' : 'Esc'}</kbd>done<div class="need">Needs: ${ui.costHtml(d.cost)}</div>${hint ? `<div class="need hint">${hint}</div>` : ''}`;
}
function placement() {
  const b = S.build, d = STRUCTS[b.t], [fx, fz] = fwd(), reach = d.kind === 'place' || d.kind === 'stairs' ? 2.6 : d.kind === 'roof' || d.kind === 'floor' ? 1.5 : 4.2 + cam.pitch * 2;      // roofs and ceilings go over the square you stand in (or are stepping into)
  const ax = me.x + fx * reach, az = me.z + fz * reach, cx = Math.round(ax / 4) * 4, cz = Math.round(az / 4) * 4;
  let base = null, bd = 11; for (const s of S.structs.values()) if (STRUCTS[s.t].kind === 'foundation') { const q = Math.hypot(s.x - cx, s.z - cz); if (q < bd && Math.abs(s.y - me.y) < 7) { bd = q; base = s.y; } }
  base ??= Math.max(heightAt(cx - 2, cz - 2), heightAt(cx + 2, cz - 2), heightAt(cx - 2, cz + 2), heightAt(cx + 2, cz + 2), .2) + .35;
  // Pieces stack on their own: placing where a piece already is goes one level up (walls up to 3 high), and a roof
  // lands on top of the highest wall around its square. Z still raises the starting level by hand.
  const occ = (kind, x, y, z, r) => { for (const s of S.structs.values()) if (STRUCTS[s.t].kind === kind && Math.abs(s.x - x) < .3 && Math.abs(s.z - z) < .3 && Math.abs(s.y - y) < .5 && (kind !== 'wall' || s.r === r)) return true; return false; };
  const wallTop = () => { let top = -1; for (const s of S.structs.values()) { const sd = STRUCTS[s.t]; if (sd.kind !== 'wall' || sd.gable || s.t === 'fence') continue; if (Math.abs(s.x - cx) + Math.abs(s.z - cz) > 2.3 || Math.abs(s.x - cx) > 2.3 || Math.abs(s.z - cz) > 2.3) continue; const L = Math.round((s.y - base) / 3); if (L >= 0 && L <= 2) top = Math.max(top, L); } return top; };
  let L = b.lvl;
  switch (d.kind) {
    case 'foundation': return { x: cx, y: base, z: cz, r: 0 };
    case 'wall': {
      // snap to whichever square edge is nearest the spot 3 m in front of the player
      const wx = me.x + fx * 3, wz = me.z + fz * 3, ex = Math.round((wx - 2) / 4) * 4 + 2, ez = Math.round((wz - 2) / 4) * 4 + 2;
      const side = Math.abs(wx - ex) < Math.abs(wz - ez), x = side ? ex : Math.round(wx / 4) * 4, z = side ? Math.round(wz / 4) * 4 : ez, r = side ? 1 : 0;
      if (b.t === 'fence' && bd > 10) return { x, y: heightAt(x, z), z, r };
      const max = d.gable ? 3 : 2; while (L < max && occ('wall', x, base + 3 * L, z, r)) L++;
      return { x, y: base + 3 * L, z, r, L };
    }
    case 'floor': while (L < 2 && occ('floor', cx, base + 3 * (L + 1), cz)) L++; return { x: cx, y: base + 3 * (L + 1), z: cz, r: 0, L };
    case 'roof': L = Math.max(L, wallTop()); return { x: cx, y: base + 3 * (L + 1), z: cz, r: b.r % 2, L };
    case 'stairs': while (L < 2 && occ('stairs', cx, base + 3 * L, cz)) L++; return { x: cx, y: base + 3 * L, z: cz, r: b.r, L };
    default: { const x = Math.round(ax * 2) / 2, z = Math.round(az * 2) / 2; return { x, y: groundAt(x, z, me.y + .5), z, r: b.r }; }
  }
}
function placeBuild() { const { x, y, z, r } = placement(); emit('place', { t: S.build.t, x, y, z, r }, r => { if (r?.err) ui.toast(r.err, 'bad'); else if (r?.ok) sound('place'); }); }

// ---------- targeting ----------
function nextPiece() { const l = S.hamList; if (!l || l.length < 2) return; const i = l.findIndex(o => o.s.id === (S.target?.s?.id)); S.hamSel = l[(i + 1) % l.length].s.id; sound('pick'); }
function findTarget() {
  const [fx, fz] = fwd(), def = heldDef(), hammer = def?.tool === 'hammer'; let best = null, bs = 1e9;
  const consider = (x, z, reach, obj, bias = 0) => { const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz); if (d > reach) return; const dot = d < .01 ? 1 : (dx * fx + dz * fz) / d; if (dot < .1 && d > 1.4) return; const sc = d - dot * 1.6 + bias; if (sc < bs) { bs = sc; best = obj; } };
  for (const a of S.animals.values()) consider(a.g.position.x, a.g.position.z, (def?.reach || 2.6) + 1, { k: 'a', a, x: a.g.position.x, y: a.g.position.y, z: a.g.position.z, r: .7 }, def?.dmg > 2 ? -1.5 : 0);
  nodesNear(me.x, me.z, n => consider(n.x, n.z, 3.6, { k: 'n', node: n, x: n.x, y: n.y, z: n.z, r: (NODES[n.t].r || .5) * n.s + .25 }));
  // With the hammer every piece in reach is a candidate, and things built on top (roof, stairs, upper floor)
  // are offered before the foundation under them, which sits at the same spot. T / B steps through the rest.
  const HB = { roof: -.9, stairs: -.7, floor: -.5, place: -.3, wall: -.2, foundation: 0 }, list = [];
  for (const s of S.structs.values()) {
    const d = STRUCTS[s.t];
    const o = { k: 's', s, x: s.x, y: s.y, z: s.z, r: d.kind === 'place' ? (d.r || 1.3) + .3 : 1.2 };
    if (hammer) {
      if (Math.abs(s.y - me.y) > 7) continue;
      const dx = s.x - me.x, dz = s.z - me.z, dist = Math.hypot(dx, dz); if (dist > 4.6) continue;
      const dot = dist < .01 ? 1 : (dx * fx + dz * fz) / dist; if (dot < .1 && dist > 1.4) continue;
      list.push([dist - dot * 1.6 + HB[d.kind], o]);
    } else if (Math.abs(s.y - me.y) <= 3.5 && (d.kind === 'place' || d.door)) consider(s.x, s.z, 3.4, o, .2);
  }
  S.hamList = null;
  if (list.length) { list.sort((a, b) => a[0] - b[0]); S.hamList = list.map(x => x[1]); return S.hamList.find(o => o.s.id === S.hamSel) || S.hamList[0]; }
  return best;
}
function promptFor(t) {
  const def = heldDef(), pu = padUI(), K = k => `<kbd>${pu ? { E: 'X', Click: 'RT', K: 'R3', T: 'B' }[k] || k : k}</kbd>`;
  if (S.fishing) return '🎣 Waiting for a bite…';
  if (!t) return nearWater() ? `${K('E')} Drink` : '';
  if (t.k === 'a') return `${ANIMALS[t.a.t].n} — ${K('Click')} attack`;
  if (t.k === 'n') { const nd = NODES[t.node.t]; if (nd.pick) return `${K('E')} ${nd.verb} ${nd.n}`; const ok = def?.tool === nd.tool; return `${nd.n} — ${K('Click')} ${nd.tool === 'axe' ? (ok ? 'chop' : 'punch for sticks (an axe gets wood)') : (ok ? 'mine' : 'needs a pickaxe')}`; }
  const s = t.s, d = STRUCTS[s.t], own = s.o === S.id ? '' : ` <small>(${s.on})</small>`;
  if (def?.tool === 'hammer') { const l = S.hamList || []; return `${d.n}${own} — ${K('K')} take apart${l.length > 1 ? ` &nbsp; ${K('T')} next piece (${l.findIndex(o => o.s.id === s.id) + 1} of ${l.length})` : ''}`; }
  if (d.station) return `${K('E')} Use ${d.n}`;
  if (d.door) return `${K('E')} ${s.d.open ? 'Close' : 'Open'} door`;
  if (s.t === 'chest') return `${K('E')} Open chest${own}`;
  if (s.t === 'bed' || s.t === 'clan_banner') return `${K('E')} Set as home${own}`;
  if (s.t === 'well') return `${K('E')} Drink from well`;
  if (s.t === 'farm_plot') { if (!s.d.crop) return def?.seed ? `${K('E')} Plant ${def.n}` : 'Empty plot — hold seeds to plant'; const left = s.d.ready - (Date.now() + S.off); return left <= 0 ? `${K('E')} Harvest!` : `Growing… ${Math.ceil(left / 1000)}s${!s.d.w && def?.tool === 'water' ? ` — ${K('E')} water it` : ''}`; }
  return d.n;
}

// ---------- maps ----------
const mapImg = (() => { const c = document.createElement('canvas'); c.width = c.height = 320; const x = c.getContext('2d'), im = x.createImageData(320, 320);
  for (let j = 0; j < 320; j++) for (let i = 0; i < 320; i++) { const h = heightAt(-320 + i * 2, -320 + j * 2), o = (j * 320 + i) * 4; const c3 = h < 0 ? [42 + h * 2, 120 + h * 5, 172 + h * 4] : h < 1.3 ? [222, 204, 150] : h > 24 ? [240, 244, 248] : h > 14 ? [140, 143, 146] : [96 + h * 3, 168 - h * 2, 84]; im.data[o] = c3[0]; im.data[o + 1] = c3[1]; im.data[o + 2] = c3[2]; im.data[o + 3] = 255; }
  x.putImageData(im, 0, 0); return c; })();
function mapDots(x, toPx, scale) {
  const dot = (wx, wz, c, r) => { const [px, py] = toPx(wx, wz); x.fillStyle = c; x.strokeStyle = '#1b1208'; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.stroke(); };
  for (const s of S.structs.values()) if ((s.o === S.id || (S.clan && s.c === S.clan.id)) && (s.t === 'bed' || s.t === 'campfire' || s.t === 'clan_banner')) dot(s.x, s.z, s.t === 'clan_banner' ? S.clan?.color || '#fff' : '#ffb347', 3 * scale);
  for (const p of S.players.values()) dot(p.char.position.x, p.char.position.z, p.col || '#dddddd', 4 * scale);
  const [px, py] = toPx(me.x, me.z); x.save(); x.translate(px, py); x.rotate(-me.yaw + Math.PI); x.fillStyle = '#fff'; x.strokeStyle = '#1b1208'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -7 * scale); x.lineTo(5 * scale, 6 * scale); x.lineTo(-5 * scale, 6 * scale); x.closePath(); x.fill(); x.stroke(); x.restore();
}
function drawMini() { const c = $('mini'), x = c.getContext('2d'), R = 60, s = 170 / (R * 2); x.drawImage(mapImg, (me.x - R + 320) / 2, (me.z - R + 320) / 2, R, R, 0, 0, 170, 170); mapDots(x, (wx, wz) => [(wx - me.x + R) * s, (wz - me.z + R) * s], 1); }
function drawMap(c) { const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(mapImg, 0, 0, c.width, c.height); mapDots(x, (wx, wz) => [(wx + 320) / 640 * c.width, (wz + 320) / 640 * c.height], 1.3); }

// ---------- gamepad ----------
// Standard (Xbox-style) layout. In the world it drives the character; with a panel open it moves a highlight around the menu.
const KEYS_KB = $('keys').innerHTML, KEYS_PAD = '<span><b>Y</b> Bag</span> <span><b>X</b> Use</span> <span><b>RT</b> Action</span> <span><b>A</b> Jump</span> <span><b>LB RB</b> Items</span> <span><b>↑</b> Craft</span> <span><b>→</b> Build</span> <span><b>←</b> Clan</span> <span><b>↓</b> Map</span> <span><b>Start</b> Menu</span>';
let keysPad = false;
const pad = { lastT: -1e9, mx: 0, mz: 0, run: false, jump: false, rt: false, prev: [], seen: false, navT: 0, navHeld: false, el: null, pt: null };
const dead = v => Math.abs(v) < .2 ? 0 : (v - Math.sign(v) * .2) / .8;
const canRepeat = () => { const d = heldDef(); return !S.build && !ui.tab && !(d && (d.food || d.heal || d.armor || d.tool === 'water')); };
const navEls = () => [...document.querySelectorAll('#pbody .slot, #pbody button:not(:disabled), #pbody .card:not(.off), #pbody input')];
const ctr = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
function navFocus(el) { document.querySelectorAll('.gpfocus').forEach(e => e.classList.remove('gpfocus')); pad.el = el; if (!el) return; el.classList.add('gpfocus'); el.scrollIntoView({ block: 'nearest' }); pad.pt = ctr(el); }
function navCur() {        // menus are re-drawn after every action, so re-find the highlight by where it was on screen
  if (pad.el?.isConnected) return pad.el;
  const els = navEls(); if (!els.length) return null; let best = els[0], bd = 1e9;
  if (pad.pt) for (const e of els) { const c = ctr(e), d = Math.hypot(c[0] - pad.pt[0], c[1] - pad.pt[1]); if (d < bd) { bd = d; best = e; } }
  navFocus(best); return best;
}
function navMove(dx, dy) {
  const cur = navCur(); if (!cur) return; const c = ctr(cur); let best = null, bs = 1e9;
  for (const e of navEls()) { if (e === cur) continue; const p = ctr(e), ex = p[0] - c[0], ey = p[1] - c[1], along = ex * dx + ey * dy, across = Math.abs(ex * dy) + Math.abs(ey * dx); if (along < 4) continue; const sc = along + across * 2.5; if (sc < bs) { bs = sc; best = e; } }
  if (best) navFocus(best);
}
function cycleTab(dir) { const t = [...document.querySelectorAll('#tabs button')], i = t.findIndex(b => b.classList.contains('on')); t[(i + dir + t.length) % t.length]?.click(); pad.el = pad.pt = null; }
function pollPad(dt) {
  pad.mx = pad.mz = 0; pad.jump = pad.rt = false;
  const gp = [...(navigator.getGamepads?.() || [])].find(g => g && g.connected && g.buttons.length >= 12 && g.axes.length >= 4); if (!gp) return;
  const b = gp.buttons.map(x => x.pressed || x.value > .5), hit = i => b[i] && !pad.prev[i];
  const lx = dead(gp.axes[0]), ly = dead(gp.axes[1]), rx = dead(gp.axes[2]), ry = dead(gp.axes[3]);
  if (b.some(Boolean) || lx || ly || rx || ry) { S.pad = true; pad.lastT = performance.now(); if (!pad.seen && S.me) { pad.seen = true; ui.toast('🎮 Controller ready — Y opens your bag, Start opens the menu'); } }
  if (!S.me) { if (hit(0) && $('lname').value.trim()) $('loginForm').requestSubmit(); pad.prev = b; return; }
  if (document.activeElement?.tagName === 'INPUT') { if (hit(1)) document.activeElement.blur(); pad.prev = b; return; }
  if (ui.tab) {
    const dx = (b[15] ? 1 : 0) - (b[14] ? 1 : 0) || Math.sign(Math.abs(lx) > .5 ? lx : 0), dy = (b[13] ? 1 : 0) - (b[12] ? 1 : 0) || Math.sign(Math.abs(ly) > .5 ? ly : 0);
    navCur(); pad.navT -= dt;
    if (!dx && !dy) pad.navHeld = false; else if (!pad.navHeld || pad.navT <= 0) { pad.navT = pad.navHeld ? .13 : .32; pad.navHeld = true; navMove(dx, dx ? 0 : dy); }
    if (ry) $('pbody').scrollTop += ry * 900 * dt;
    if (hit(0)) { const el = navCur(); if (el) { if (el.tagName === 'INPUT') el.focus(); else el.click(); } }
    if (hit(2)) navCur()?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    if (hit(4)) cycleTab(-1); if (hit(5)) cycleTab(1);
    if (hit(1) || hit(3) || hit(9)) { ui.close(); pad.el = pad.pt = null; }
    pad.prev = b; return;
  }
  pad.mx = lx; pad.mz = -ly; pad.jump = b[0]; pad.rt = b[7];
  const ls = cfg.padSens / 100; cam.yaw -= rx * 2.9 * ls * dt; cam.pitch = Math.min(1.35, Math.max(-.25, cam.pitch + ry * 1.9 * ls * dt * (cfg.invY ? -1 : 1)));
  if (hit(10)) pad.run = true; if (Math.hypot(lx, ly) < .3) pad.run = false;
  if (hit(7)) primary();
  if (hit(2)) { if (S.build) S.build.r = (S.build.r + 1) % 4; else interact(); }
  if (hit(3)) { if (S.build) { S.build.lvl = (S.build.lvl + 1) % 3; buildBar(); } else ui.open('bag'); }
  if (hit(1)) { if (S.build) stopBuild(); else nextPiece(); }
  if (hit(6)) { S.sneak = !S.sneak; ui.toast(S.sneak ? 'Sneaking…' : 'Standing up'); }
  if (hit(4)) select(S.sel - 1); if (hit(5)) select(S.sel + 1);
  if (hit(11) && S.target?.k === 's' && heldDef()?.tool === 'hammer') emit('demolish', { id: S.target.s.id });
  const open = hit(12) ? 'craft' : hit(15) ? 'build' : hit(14) ? 'clan' : hit(13) || hit(8) ? 'map' : hit(9) ? 'menu' : null;
  if (open) { if (S.build) stopBuild(); pad.el = pad.pt = null; ui.open(open); }
  pad.prev = b;
}

// ---------- main loop ----------
const clock = new THREE.Clock(); let netT = 0, slowT = 0, time = 0, lastSent = '';
const lerpAng = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
function updateMe(dt) {
  const k = S.keys, typing = document.activeElement?.tagName === 'INPUT';
  let ix = 0, iz = 0; if (!typing && !ui.tab) { ix = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + pad.mx; iz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + pad.mz; }
  const [fx, fz] = fwd(); let mx = fx * iz - fz * ix, mz = fz * iz + fx * ix; const ml = Math.hypot(mx, mz), mag = Math.min(1, ml); if (ml > 0) { mx *= mag / ml; mz *= mag / ml; }
  const swim = heightAt(me.x, me.z) < -1.15 && me.y < -.6;
  const run = (k.ShiftLeft || k.ShiftRight || pad.run) && ml > .6 && S.stam > 1 && !swim && !S.sneak;
  S.stam = Math.max(0, Math.min(100, S.stam + (run ? -14 : 11) * dt));
  const sp = swim ? 3.2 : S.sneak ? 2.4 : run ? 8.8 : 5.4, f = Math.min(1, dt * 12);
  me.vx += (mx * sp - me.vx) * f; me.vz += (mz * sp - me.vz) * f;
  let nx = me.x + me.vx * dt, nz = me.z + me.vz * dt;
  nodesNear(nx, nz, n => { const r = NODES[n.t].r; if (!r) return; const R = r * n.s + .35, dx = nx - n.x, dz = nz - n.z, d = Math.hypot(dx, dz); if (d < R && d > .001 && me.y < n.y + (G.NODE_H[n.t] || 1) * n.s) { nx = n.x + dx / d * R; nz = n.z + dz / d * R; } });
  for (const c of col.circ) { if (me.y > c.y1 || me.y + 1.7 < c.y0) continue; const R = c.r + .35, dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz); if (d < R && d > .001) { nx = c.x + dx / d * R; nz = c.z + dz / d * R; } }
  for (const w of col.walls) { if (me.y >= w.y1 - .05 || me.y + 1.7 <= w.y0) continue; const ex = w.x2 - w.x1, ez = w.z2 - w.z1, t = Math.min(1, Math.max(0, ((nx - w.x1) * ex + (nz - w.z1) * ez) / (ex * ex + ez * ez))), qx = w.x1 + ex * t, qz = w.z1 + ez * t, dx = nx - qx, dz = nz - qz, d = Math.hypot(dx, dz); if (d < .42) { if (d > .001) { nx = qx + dx / d * .42; nz = qz + dz / d * .42; } else { nx = me.x; nz = me.z; } } }
  for (const s of col.surf) if (s.solid && nx > s.x0 - .3 && nx < s.x1 + .3 && nz > s.z0 - .3 && nz < s.z1 + .3 && me.y + .8 < s.top && me.y > s.top - 3.4) { nx = me.x; nz = me.z; break; }
  nx = Math.max(-316, Math.min(316, nx)); nz = Math.max(-316, Math.min(316, nz));
  me.x = nx; me.z = nz;
  const gy = groundAt(nx, nz, me.y);
  if (swim) { me.y += (-1.2 - me.y) * Math.min(1, dt * 6); me.vy = 0; me.grounded = false; }
  else {
    if (me.grounded && me.vy <= 0 && gy > me.y - .7) me.y = gy;
    else { me.vy -= 24 * dt; me.y += me.vy * dt; }
    if (me.y <= gy) { me.y = gy; me.vy = 0; me.grounded = true; } else if (me.y - gy > .05) me.grounded = false;
    if ((k.Space || pad.jump) && me.grounded && !typing && !ui.tab) { me.vy = 8; me.grounded = false; me.y += .02; }
  }
  me.speed = Math.hypot(me.vx, me.vz); me.mode = swim ? 4 : S.sneak ? 3 : me.speed > 6.5 ? 2 : me.speed > .4 ? 1 : 0;
  if (performance.now() - me.lastSwing < 500 || (heldDef()?.tool === 'bow' && ml === 0)) me.yaw = lerpAng(me.yaw, Math.atan2(fx, fz), Math.min(1, dt * 14));
  else if (ml > .05) me.yaw = lerpAng(me.yaw, Math.atan2(mx, mz), Math.min(1, dt * 10));
  me.char.position.set(me.x, me.y, me.z); me.char.rotation.y = me.yaw;
  G.setHeld(me.char, held()?.id || null, heldDef()); G.animateCharacter(me.char, dt, me.speed, me.mode);
  if (S.fishing && me.speed > 1) S.fishing = false;
}
function updateCamera(dt, focus) {
  const cp = Math.cos(cam.pitch), tx = focus.x, ty = focus.y + 1.7, tz = focus.z;
  let d = cam.dist; let x, y, z; const dx = Math.sin(cam.yaw) * cp, dz = Math.cos(cam.yaw) * cp, sy = Math.sin(cam.pitch);
  if (S.me) {
    for (const w of col.walls) { if (ty < w.y0 || ty > w.y1 + .6) continue; const ex = w.x2 - w.x1, ez = w.z2 - w.z1, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-6) continue; const s = ((w.x1 - tx) * ez - (w.z1 - tz) * ex) / den, u = ((w.x1 - tx) * dz - (w.z1 - tz) * dx) / den; if (s > 0 && s < d && u >= -.05 && u <= 1.05) d = Math.max(.5, s - .35); }
    if (sy > 0) for (const c of col.ceil) if (c.y > ty && c.y < ty + 6 && tx > c.x0 && tx < c.x1 && tz > c.z0 && tz < c.z1) d = Math.min(d, Math.max(.5, (c.y - .4 - ty) / Math.max(.05, sy)));
    me.char.visible = d > 1.3;
  }
  for (let i = 0; i < 6; i++) { x = tx + Math.sin(cam.yaw) * cp * d; y = ty + Math.sin(cam.pitch) * d; z = tz + Math.cos(cam.yaw) * cp * d; if (y > Math.max(heightAt(x, z), -.2) + .5) break; d *= .8; }
  y = Math.max(y, Math.max(heightAt(x, z), 0) + .4);
  camera.position.set(x, y, z); camera.lookAt(tx, ty, tz);
}
function frame() {
  requestAnimationFrame(frame);
  const raw = clock.getDelta(), dt = Math.min(.05, raw); time += dt; fpsWatch(raw);
  let focus; pollPad(raw); if (keysPad !== padUI()) { keysPad = padUI(); $('keys').innerHTML = keysPad ? KEYS_PAD : KEYS_KB; $('keys').classList.toggle('pad', keysPad); buildBar(); }
  if (S.me) {
    if ((S.hold || pad.rt) && canRepeat()) primary();
    updateMe(dt); focus = me.char.position;
    const f = 1 - Math.exp(-dt * 12);
    for (const p of S.players.values()) { const c = p.char.position, moved = Math.hypot(p.tx - c.x, p.tz - c.z); c.x += (p.tx - c.x) * f; c.y += (p.ty - c.y) * f; c.z += (p.tz - c.z) * f; p.char.rotation.y = lerpAng(p.char.rotation.y, p.tr, f); G.animateCharacter(p.char, dt, [0, 5, 8.5, 2.4, 3][p.a] || (moved > .05 ? 4 : 0), p.a); }
    for (const a of S.animals.values()) { const c = a.g.position; c.x += (a.tx - c.x) * f; c.y += (a.ty - c.y) * f; c.z += (a.tz - c.z) * f; a.g.rotation.y = lerpAng(a.g.rotation.y, a.tr, f); G.animateAnimal(a.g, dt, a.mv); }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; p.vy -= 12 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); } }
    for (let i = arrows.length - 1; i >= 0; i--) { const a = arrows[i]; a.t += dt * 70; const t = Math.min(a.t, a.len); a.m.position.copy(a.o).addScaledVector(a.d, t); a.m.position.y -= .0015 * t * t; if (a.t > a.len + 30) { scene.remove(a.m); arrows.splice(i, 1); } }
    for (const s of S.structs.values()) { const u = s.g.userData; if (u.flame) { const k = 1 + Math.sin(time * 11 + s.id) * .12 + Math.sin(time * 23 + s.id) * .08; u.flame.scale.set(k, 1 + Math.sin(time * 15 + s.id) * .2, k); } }
    // targeting + prompt
    S.target = S.build ? null : findTarget();
    if (S.target) { const t = S.target; ring.visible = true; ring.position.set(t.x, Math.max(t.y, groundAt(t.x, t.z, me.y + 2)) + .12, t.z); ring.scale.setScalar(t.r * (1 + Math.sin(time * 5) * .05)); } else ring.visible = false;
    if (S.build) { const p = placement(), g = S.build.ghost; g.position.set(p.x, p.y, p.z); g.rotation.y = p.r * Math.PI / 2; if ((p.L ?? null) !== (S.build.L ?? null)) { S.build.L = p.L; buildBar(); } }
    netT += dt; if (netT > .08) { netT = 0; const m = [+me.x.toFixed(2), +me.y.toFixed(2), +me.z.toFixed(2), +me.yaw.toFixed(2), me.mode]; const key = m.join(); if (key !== lastSent) { lastSent = key; sock.volatile.emit('mv', m); } }
    slowT += dt; if (slowT > .25) {
      slowT = 0; $('prompt').innerHTML = ui.tab ? '' : promptFor(S.target); $('bStam').style.width = S.stam + '%'; drawMini();
      const hr = Math.floor(S.time * 24), mn = Math.floor((S.time * 24 % 1) * 60 / 10) * 10; $('clock').textContent = `${S.time > .23 && S.time < .77 ? '☀️' : '🌙'} ${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
      const now = Date.now() + S.off; let lights = [];
      for (const s of S.structs.values()) { if (s.t === 'farm_plot') G.setCrop(s.g, s.d, now); if (s.g.userData.light) lights.push(s); }
      lights.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z)).forEach((s, i) => s.g.userData.light.visible = i < 5);
    }
  } else { cam.yaw += dt * .04; focus = new THREE.Vector3(SPAWN.x, heightAt(SPAWN.x, SPAWN.z), SPAWN.z); cam.dist = 26; }
  if (S.me) cam.dist = 7.5;
  updateCamera(dt, focus);
  world.update(S.time, time, focus, camera);
  renderer.render(scene, camera);
}
frame();
window.KW = { me, cam, S, primary, interact, startBuild, placement, select, ui, cfg, music, emit };
