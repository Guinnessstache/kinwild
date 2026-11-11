// Client: input, third-person controller, networking, and glue between the 3D world and the UI.
import * as THREE from 'three';
import { ITEMS, NODES, STRUCTS, ANIMALS, SKILLS, CLASSES, ABIL_CD, QUAL, conColor, combatLevel, calcStats, mobName, atkSpd, COST, ABIL_COST } from '/shared/data.js';
import { heightAt, zoneAt, ZONES, SPAWN, HALF, SIZE } from '/shared/terrain.js';
import * as G from './gfx.js';
import { createUI } from './ui.js';

const $ = id => document.getElementById(id);
const S = window.S = { me: null, id: null, players: new Map(), animals: new Map(), structs: new Map(), dead: new Set(), time: .3, clan: null, invites: [], chest: null, sel: 0, build: null, off: 0, keys: {}, stam: 100, target: null, sneak: false, fishing: false, stock: {}, who: [], party: null, pinv: null, trade: null, tradeAsk: null, voice: new Set(), cd: {}, fly: null, recall: null };
try { S.view = localStorage.kwView === 'first' ? 'first' : 'third'; } catch { S.view = 'third'; }
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
const act = { emit, sound, select, startBuild, stations, drawMap, toggleGfx, cfg, setCfg, logout, lock, padUI, recall, voiceToggle, voiceOn: () => voice.on, nextMic, micName: () => micName(), refreshMics: () => refreshMics() };
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
const ringGeo = new THREE.RingGeometry(.82, 1, 24); ringGeo.rotateX(-Math.PI / 2);
const myLevel = () => combatLevel(S.me.skills);
function addAnimal(a) {       // every monster stands on a ring coloured by its level next to yours
  const g = G.makeAnimal(a.t), con = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: conColor(a.L, myLevel()), transparent: true, opacity: .9, depthWrite: false }));
  con.position.y = .07; con.scale.setScalar(G.ANIMAL_R[a.t] || .7); g.add(con); g.position.set(a.x, a.y, a.z); g.scale.setScalar(1 + Math.min(.6, (a.L - 1) * .022)); scene.add(g);      // tougher monsters are a bit bigger
  S.animals.set(a.id, { ...a, g, con, tx: a.x, ty: a.y, tz: a.z, tr: a.r || 0, mv: 0 });
}
function recolor() { const l = myLevel(); for (const a of S.animals.values()) a.con.material.color.set(conColor(a.L, l)); }
const col = { surf: [], walls: [], circ: [], ceil: [] };
function addStruct(s) {
  const old = S.structs.get(s.id); if (old) scene.remove(old.g);
  S.structs.set(s.id, s); if (!S.bulk) { s.cap = capsOf(s); s.capKey = s.cap?.join(); }
  placeMesh(s); syncStruct(s); if (!S.bulk) { rebuildCol(); if (['slope', 'roof', 'wall'].includes(STRUCTS[s.t].kind)) refreshCaps(s.x, s.z); }
}
function syncStruct(s) { const u = s.g.userData; if (u.door) u.door.rotation.y = s.d.open ? -1.7 : 0; G.setCrop(s.g, s.d, Date.now() + S.off); }
function rebuildCol() {
  col.surf = []; col.walls = []; col.circ = []; col.ceil = [];
  for (const s of S.structs.values()) {
    const d = STRUCTS[s.t];
    if (d.kind === 'foundation' || d.kind === 'floor') col.surf.push({ x0: s.x - 2, x1: s.x + 2, z0: s.z - 2, z1: s.z + 2, top: s.y, solid: d.kind === 'foundation' });
    if (d.kind === 'floor' || d.kind === 'roof' || d.kind === 'slope') col.ceil.push({ x0: s.x - 2.3, x1: s.x + 2.3, z0: s.z - 2.3, z1: s.z + 2.3, y: s.y });
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
  refreshMe({ name: init.me.name, look: init.me.look, armor: ITEMS[init.me.equip.chest?.id]?.mat, tag: S.clan?.tag, col: S.clan?.color });
  S.party = init.party.party; S.pinv = init.party.inv; S.voice = new Set(init.voice); partyHud();
  for (const id of init.dead) { S.dead.add(id); world.setNode(id, false); }
  init.players.forEach(addPlayer); init.animals.forEach(addAnimal); S.bulk = true; init.structs.forEach(addStruct); S.bulk = false; rebuildCol(); refreshCaps();
  music.start();
  $('login').hidden = true; $('hud').hidden = false; ui.refresh(); ui.vitals();
  ui.toast(`Welcome to Kinwild, ${init.me.name}!`, 'big'); if (init.me.quest === 0) ui.toast('Click the game to look around. Press H for help.');
  if (init.peaceful) ui.chat({ ch: 'sys', m: 'Peaceful mode: wolves will not hunt players.' });
}

// ---------- network events ----------
sock.on('p+', addPlayer); sock.on('p-', id => { const p = S.players.get(id); if (p) { scene.remove(p.char); S.players.delete(id); } });
sock.on('pu', p => { if (p.id === S.id) refreshMe(p); else if (S.me) addPlayer(p); });
sock.on('a+', a => S.me && addAnimal(a)); sock.on('a-', id => { if (id === S.lock) S.lock = null; const a = S.animals.get(id); if (a) { puff(a.g.position.x, a.g.position.y + .5, a.g.position.z, '#ffffff', 10); scene.remove(a.g); S.animals.delete(id); } });
sock.on('s', sn => {
  if (!S.me) return; S.time = sn.t;
  for (const [id, x, y, z, r, a, held] of sn.p) { const p = S.players.get(id); if (p) { p.tx = x; p.ty = y; p.tz = z; p.tr = r; p.a = a; G.setHeld(p.char, held || null, ITEMS[held]); } }
  for (const [id, x, y, z, r, mv] of sn.a) { const a = S.animals.get(id); if (a) { a.tx = x; a.ty = y; a.tz = z; a.tr = r; a.mv = mv; } }
});
sock.on('me', u => { Object.assign(S.me, u); if (u.hp != null || u.max) ui.vitals(); if (u.skills) recolor(); if (u.inv || u.skills || u.quest != null || u.known || u.perm) { ui.refresh(); buildBar(); } });
sock.on('nd', ([id, alive]) => { alive ? S.dead.delete(id) : S.dead.add(id); world.setNode(id, !!alive); });
sock.on('st+', s => S.me && addStruct(s)); sock.on('st-', id => { const s = S.structs.get(id); if (s) { scene.remove(s.g); S.structs.delete(id); rebuildCol(); refreshCaps(s.x, s.z); if (S.build?.hit?.s === s) S.build.hit = null; } });
sock.on('st~', u => { const s = S.structs.get(u.id); if (!s) return; if (u.d) s.d = u.d; if ('c' in u) { s.c = u.c; if (s.t === 'clan_banner' && u.cc !== s.cc) { s.cc = u.cc; return addStruct(s); } } syncStruct(s); rebuildCol(); });
sock.on('toast', t => ui.toast(t.m, t.k)); sock.on('chat', c => ui.chat(c));
sock.on('got', g => { ui.feed(`+${g.n} ${ITEMS[g.id].i} <span ${g.q ? `style="color:${QUAL[g.q][1]}"` : ''}>${g.q ? QUAL[g.q][0] + ' ' : ''}${ITEMS[g.id].n}</span>`); });
sock.on('lvl', l => { ui.toast(`⭐ ${SKILLS[l.sk].n} reached level ${l.l}!`, 'big'); sound('lvl'); });
sock.on('questDone', q => { ui.toast('✔ ' + q.t, 'good'); sound('craft'); });
sock.on('clan', c => { S.clan = c.clan; S.invites = c.invites; if (ui.tab === 'clan') ui.render(); });
sock.on('chest', c => { S.chest = c; if (c.t === 'chest' && ui.tab !== 'bag') ui.open('bag'); else if (ui.tab) ui.render(); });       // station storage shows inside the craft tab
sock.on('hurt', () => { $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 200); sound('hurt'); });
sock.on('tp', t => { me.x = t.x; me.y = t.y; me.z = t.z; me.vy = 0; ui.toast(t.msg, t.good ? 'good' : 'bad'); });
sock.on('ah', ([id, hp]) => { const a = S.animals.get(id); if (a) a.hp = hp; });
sock.on('bolt', b => { const o = new THREE.Vector3(...b.o), t = new THREE.Vector3(...b.t); for (let i = 0; i <= 6; i++) { const q = o.clone().lerp(t, i / 6); puff(q.x, q.y, q.z, '#9be37a', 1); } });
let partySig = '';
sock.on('party', v => { S.party = v.party; S.pinv = v.inv; partyHud(); const sig = JSON.stringify([v.inv, v.party?.leader, v.party?.m.map(m => m.id)]); if (sig !== partySig) { partySig = sig; if (ui.tab === 'who') ui.render(); } });      // health ticks every second; only redraw the panel when the party itself changes
sock.on('trade', v => { S.trade = v; if (v && ui.tab !== 'trade') ui.open('trade'); else if (!v && ui.tab === 'trade') ui.close(); else if (ui.tab) ui.render(); });
sock.on('tradeAsk', v => { S.tradeAsk = v; if (ui.tab === 'who') ui.render(); });
function partyHud() { $('party').innerHTML = (S.party?.m || []).filter(m => m.id !== S.id).map(m => `<div>${m.name} <span style="float:right">Lv ${m.lv}</span><i style="width:${Math.max(0, Math.min(100, 100 * m.hp / m.max))}%"></i></div>`).join(''); }
sock.on('fished', f => { S.fishing = false; if (f.ok) { ui.toast('You caught a fish! 🐟', 'good'); sound('pick'); } });
sock.on('sw', id => { const p = S.players.get(id); if (p) p.char.userData.swing = 1; });
sock.on('fx', f => { if (f.k === 'hit') puff(f.x, f.y, f.z, f.c, 7); else if (f.k === 'heal') puff(f.x, f.y, f.z, '#7dff8a', 9); else if (f.k === 'taunt') puff(f.x, f.y, f.z, '#ffd84a', 14); });
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
  if (e.code === 'Tab') { cycleTarget(e.shiftKey ? -1 : 1); return; }
  const tabs = { KeyI: 'bag', KeyC: 'craft', KeyB: 'build', KeyG: 'clan', KeyM: 'map', KeyH: 'help', KeyP: 'who' };
  if (e.code === 'KeyB' && !ui.tab) { if (S.build) stopBuild(); else startBuild(); return; }
  if (tabs[e.code]) { if (S.build) stopBuild(); ui.open(tabs[e.code]); return; }
  if (ui.tab) { if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 8) ui.numKey(n - 1); } return; }
  if (e.code === 'KeyV' && !S.fly) toggleView();
  if (S.build) {          // build mode has its own keys
    if (e.code.startsWith('Digit')) pickCat(+e.code.slice(5) - 1);
    if (e.code === 'KeyQ') cyclePiece(-1); if (e.code === 'KeyE') cyclePiece(1);
    if (e.code === 'KeyR') { S.build.r = (S.build.r + 1) % 4; S.build.turned = true; }
    if (e.code === 'KeyF') toggleFly();
    if (e.code === 'KeyX' || e.code === 'Delete') removeAimed();
    return;
  }
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 8) select(n - 1); }
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyX') { S.sneak = !S.sneak; ui.toast(S.sneak ? 'Sneaking…' : 'Standing up'); }
  if (e.code === 'KeyQ') ability();
  if (e.code === 'KeyF') recall();
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
  if (e.button === 0) { primary(); S.hold = true; } else if (e.button === 2 && S.build) removeAimed();
});
addEventListener('mouseup', () => { dragging = false; S.hold = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (document.pointerLockElement === canvas || dragging) { const k = cfg.sens / 100; cam.yaw -= e.movementX * .0026 * k; const [lo, hi] = pitchLim(); cam.pitch = Math.min(hi, Math.max(lo, cam.pitch + e.movementY * .0022 * k * (cfg.invY ? -1 : 1))); } });
function pitchLim() { return S.fly || S.view === 'first' ? [-1.45, 1.45] : [-.25, 1.35]; }
addEventListener('wheel', e => { if (!playing() || !e.deltaY) return; if (S.build) cyclePiece(e.deltaY > 0 ? 1 : -1); else select(S.sel + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });

// ---------- tab targeting ----------
// Tab (controller: tap LT) locks onto the nearest monster in front of you; pressing again moves to the next one.
// Arrows then fly straight at it, and melee, staff and abilities use it when it is close enough.
const lockMark = new THREE.Mesh(new THREE.ConeGeometry(.3, .7, 4), new THREE.MeshBasicMaterial({ color: '#ff4040', depthTest: false })); lockMark.rotation.x = Math.PI; lockMark.renderOrder = 6; lockMark.visible = false; scene.add(lockMark);
function lockedAnimal() { const a = S.animals.get(S.lock); if (!a) { S.lock = null; return null; } if (Math.hypot(a.g.position.x - me.x, a.g.position.z - me.z) > 50) { S.lock = null; ui.toast('Target out of range'); return null; } return a; }
function cycleTarget(dir = 1) {
  const [fx, fz] = fwd();
  const list = [...S.animals.values()].map(a => { const p = a.g.position, dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz); return { a, d, dot: d < .1 ? 1 : (dx * fx + dz * fz) / d }; })
    .filter(o => o.d < 40 && (o.dot > .3 || o.d < 8)).sort((p, q) => p.d - q.d);
  if (!list.length) { S.lock = null; return ui.toast('No monsters nearby to target'); }
  const i = list.findIndex(o => o.a.id === S.lock); S.lock = list[i < 0 ? 0 : (i + dir + list.length) % list.length].a.id; sound('pick'); targetFrame();
}
function targetFrame() {
  const a = S.lock != null && lockedAnimal(); if (!a) { $('tframe').innerHTML = ''; return; }
  const d = Math.round(Math.hypot(a.g.position.x - me.x, a.g.position.z - me.z)), p = padUI();
  $('tframe').innerHTML = `<span style="color:${conColor(a.L, myLevel())}">🎯 ${mobName(ANIMALS[a.t].n, a.L)} · Lv ${a.L}</span><span class="mobhp"><i style="width:${a.hp ?? 100}%"></i></span><small>${d} m ${heldDef()?.tool === 'bow' && d > 45 ? '— too far for the bow' : ''} · <kbd>${p ? 'LT' : 'Tab'}</kbd> next</small>`;
}
function shootAt(a, ab) {         // fire at the locked monster: the server aims the arrow itself
  const p = a.g.position, dx = p.x - me.x, dy = p.y + .6 - me.y - 1.4, dz = p.z - me.z, l = Math.hypot(dx, dy, dz) || 1;
  swingAnim(); me.yaw = Math.atan2(dx, dz); sound('bow'); emit('shoot', { dx: dx / l, dy: dy / l, dz: dz / l, tid: a.id, ...(ab ? { ab: 1 } : {}) });
}
const lockInBow = () => { const a = S.lock != null && lockedAnimal(); return a && Math.hypot(a.g.position.x - me.x, a.g.position.z - me.z) <= 45 ? a : null; };

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
  const d = STRUCTS[s.t]; if (d.station && ui.tab !== 'craft') ui.open('craft');        // the server then sends the station's storage if you may use it
  emit('sUse', { id: s.id }, r => { if (r?.ok) sound(r.ok === 'drink' ? 'eat' : 'pick'); if (r?.ok === 'harvest') ui.toast('Harvested! 🌾', 'good'); if (r?.ok === 'water') ui.toast('Watered 💧 — it will grow faster', 'good'); if (r?.ok === 'drink') ui.toast('Ahh, fresh water! 💧', 'good'); });
}
// mana / energy: check before swinging so an empty bar doesn't play the attack for nothing (the server has the final say)
let lowT = 0;
function afford(kind, n) { if ((S.me[kind] ?? 100) >= n) return true; if (performance.now() - lowT > 2500) { lowT = performance.now(); ui.toast(kind === 'mp' ? 'Not enough mana 🔮 — wait a moment or drink a Mana Potion' : 'Not enough energy ⚡ — wait a moment or drink an Energy Tonic', 'bad'); } return false; }
function primary() {
  if (S.build) return placeBuild();
  const def = heldDef(), t = S.target;
  if (def?.tool === 'bow' && !afford('mp', COST.bow[1])) return;
  if (def?.tool === 'staff' && !afford('mp', COST.staff[1])) return;
  if (t?.k === 'a' && COST[def?.tool]?.[0] === 'en' && !afford('en', COST[def.tool][1])) return;
  if (def?.tool === 'bow') { if (performance.now() - me.lastSwing < atkSpd('bow') * 1000) return; const la = lockInBow(); if (la) return shootAt(la); swingAnim(); sound('bow'); const aim = aimPoint(), from = new THREE.Vector3(me.x, me.y + 1.4, me.z), dist = aim.distanceTo(from); aim.y += .0015 * dist * dist; aim.sub(from).normalize(); return emit('shoot', { dx: aim.x, dy: aim.y, dz: aim.z }); }
  if (def?.tool === 'rod') {
    if (S.fishing || performance.now() - me.lastSwing < 700) return; const [fx, fz] = fwd();
    for (let d = 2; d <= 8; d += 1) if (heightAt(me.x + fx * d, me.z + fz * d) < -.1) { swingAnim(); return emit('fish', { x: me.x + fx * d, z: me.z + fz * d }, r => { if (r?.ok) { S.fishing = true; ui.toast('Line is out… stand still and wait for a bite'); } else if (r?.err) ui.toast(r.err); }); }
    return ui.toast('Face the water to cast');
  }
  if (def?.tool === 'staff') { if (performance.now() - me.lastSwing < 1350) return; swingAnim(); return emit('heal', { id: (S.lock != null && lockedAnimal()?.id) ?? (t?.k === 'a' ? t.a.id : null) }, r => { if (r?.ok === 'heal') { sound('eat'); if (r.name) ui.feed(`✨ Healed ${r.name}`); } else if (r?.ok === 'bolt') sound('bow'); }); }
  const plot = t?.k === 's' && t.s.t === 'farm_plot';
  if (def && (def.food || def.heal || def.pot || def.slot || def.learn || def.tool === 'water') && !plot) return emit('useItem', { slot: S.sel }, r => { if (r?.ok) sound('eat'); });
  if (performance.now() - me.lastSwing < (t?.k === 'a' ? atkSpd(def?.tool) * 1000 : 400)) return;       // weapons have attack speeds against monsters
  swingAnim();
  if (t?.k === 'a') { emit('swing', { k: 'a', id: t.a.id }); sound('chop'); }
  else if (t?.k === 'n') { if (NODES[t.node.t].pick) { emit('pick', { id: t.node.id }); sound('pick'); } else { emit('swing', { k: 'n', id: t.node.id }); sound('chop'); } }
  else if (t?.k === 's' && def?.tool === 'hammer') emit('demolish', { id: t.s.id });
  else if (t?.k === 's' && (STRUCTS[t.s.t].door || ['farm_plot', 'chest', 'bed', 'well', 'clan_banner'].includes(t.s.t) || STRUCTS[t.s.t].station) && def?.tool !== 'hammer') useStruct(t.s);
  else emit('swing', {});
}
// Class ability (Q / B): depends on the weapon in hand
function ability() {
  const def = heldDef(), tool = def?.tool, cl = CLASSES[tool]; if (!cl || S.build || ui.tab) return;
  if (performance.now() < (S.cd[tool] || 0)) return ui.toast(`${cl[3]} is not ready yet`);
  if (!afford(...ABIL_COST[tool])) return;
  const done = r => { if (r?.ok) { S.cd[tool] = performance.now() + ABIL_CD[tool] * 1000; sound('lvl'); } else if (r?.err) ui.toast(r.err, 'bad'); };
  if (tool === 'bow') { me.lastSwing = 0; const la = lockInBow(); if (la) { shootAt(la, true); return done({ ok: 1 }); } swingAnim(); sound('bow'); const aim = aimPoint(), from = new THREE.Vector3(me.x, me.y + 1.4, me.z), dist = aim.distanceTo(from); aim.y += .0015 * dist * dist; aim.sub(from).normalize(); emit('shoot', { dx: aim.x, dy: aim.y, dz: aim.z, ab: 1 }); return done({ ok: 1 }); }
  if (tool === 'spear' && S.target?.k !== 'a') return ui.toast('Get close to a monster first');
  swingAnim(); emit('ability', { id: S.target?.k === 'a' ? S.target.a.id : null }, done);
}
// Return Home: stand still for 4 seconds, then the server moves you to your bed (30 minute cooldown)
function recall() {
  if (S.recall || S.build) return; const left = (S.me.recallAt || 0) - (Date.now() + S.off);
  if (left > 0) return ui.toast(`Return Home is ready in ${Math.ceil(left / 60000)} min`);
  S.recall = { t: performance.now() + 4000, x: me.x, z: me.z }; ui.toast('Returning home in 4 seconds — move to cancel');
}
function aimPoint() {      // what is under the crosshair: an animal, the ground, or far away
  const d = new THREE.Vector3(), o = camera.position; camera.getWorldDirection(d);
  for (let t = S.view === 'first' ? .4 : cam.dist * .7; t < 70; t += .5) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    for (const a of S.animals.values()) { const p = a.g.position; if (Math.hypot(p.x - x, p.y + .6 - y, p.z - z) < 1.3) return new THREE.Vector3(a.tx, a.ty + .6, a.tz); }
    if (y < heightAt(x, z)) return new THREE.Vector3(x, y, z);
  }
  return o.clone().addScaledVector(d, 70);
}
function stations() { const out = {}; for (const s of S.structs.values()) { const st = STRUCTS[s.t].station; if (st && Math.hypot(s.x - me.x, s.z - me.z) < 7) out[st] = Math.max(out[st] || 0, s.d.tier || 1); } return out; }       // station -> best tier in reach

// ---------- building ----------
// Build mode (B) keeps a palette of pieces on screen. You aim with the dot in the middle of the screen: placing
// snaps to what you look at, right-click removes the piece outlined in red, and F flies the camera without leaving.
const BUILD_CATS = [['🧱', 'Walls', ['wood_foundation', 'wood_wall', 'wood_short_wall', 'wood_doorway', 'wood_window', 'wood_floor', 'wood_stairs']],
  ['🏠', 'Roof', ['wood_roof_slope', 'wood_roof', 'wood_gable', 'stone_roof_slope', 'stone_roof', 'stone_gable']],
  ['🪨', 'Stone', ['stone_foundation', 'stone_wall', 'stone_short_wall', 'stone_doorway', 'stone_window']],
  ['🔥', 'Camp', ['campfire', 'workbench', 'chest', 'bed', 'torch_post', 'furnace', 'anvil', 'loom', 'well']],
  ['🌱', 'Farm', ['farm_plot', 'fence']], ['🚩', 'Clan', ['clan_banner']]];
for (const id in STRUCTS) if (!BUILD_CATS.some(c => c[2].includes(id))) BUILD_CATS[3][2].push(id);
const catOf = t => Math.max(0, BUILD_CATS.findIndex(c => c[2].includes(t)));
const lastPick = BUILD_CATS.map(c => c[2][0]);
const hiBox = new THREE.BoxHelper(undefined, '#ff4d3a'); hiBox.visible = false; hiBox.material.depthTest = false; hiBox.renderOrder = 5; scene.add(hiBox);
function startBuild(t) {
  t ||= S.lastBuild || 'wood_foundation';
  if (S.build) { if (S.build.t === t) return; scene.remove(S.build.ghost); Object.assign(S.build, { t, turned: false, v: undefined }); }
  else S.build = { t, r: 0, hit: null };
  S.lastBuild = t; lastPick[catOf(t)] = t;
  S.build.ghost = G.ghostOf({ t, d: {} }); scene.add(S.build.ghost); buildBar(); lock();
}
function ghostShape(v) { const b = S.build; if (!b || b.v === v) return; b.v = v; const pos = b.ghost.position.clone(), rot = b.ghost.rotation.y; scene.remove(b.ghost); b.ghost = G.ghostOf({ t: b.t, d: {}, v }); b.ghost.position.copy(pos); b.ghost.rotation.y = rot; scene.add(b.ghost); }       // gables change shape to fit the roof
function stopBuild() { if (!S.build) return; scene.remove(S.build.ghost); S.build = null; S.fly = null; hiBox.visible = false; $('buildbar').hidden = true; ui.hotbar(); $('hotbar').hidden = false; }
function cyclePiece(dir) { const c = BUILD_CATS[catOf(S.build.t)][2], i = c.indexOf(S.build.t); startBuild(c[(i + dir + c.length) % c.length]); sound('pick'); }
function pickCat(i) { if (!BUILD_CATS[i]) return; startBuild(lastPick[i]); sound('pick'); }
function removeAimed() {
  const s = S.build?.hit?.s; if (!s) return ui.toast('Point the dot at a piece to remove it');
  emit('demolish', { id: s.id }); sound('chop');
}
// Free camera: the view leaves the character and flies around so you can see roofs and tight corners.
function toggleFly() { if (!S.build) return; S.fly = S.fly ? null : { x: camera.position.x, y: camera.position.y, z: camera.position.z }; buildBar(); if (S.fly) ui.toast(padUI() ? 'Flying: left stick moves, A up, LT down, L3 faster. R3 lands.' : 'Flying: WASD moves, Space up, Shift down, Ctrl faster. F lands.'); }
function toggleView() { S.view = S.view === 'first' ? 'third' : 'first'; try { localStorage.kwView = S.view; } catch {} const [lo, hi] = pitchLim(); cam.pitch = Math.min(hi, Math.max(lo, S.view === 'first' ? 0 : .35)); ui.toast(S.view === 'first' ? 'First-person view (V to switch back)' : 'Third-person view'); }
function flyAim(py) {        // where the middle of the screen meets the level being built on (used when the dot points at the sky)
  const d = new THREE.Vector3(); camera.getWorldDirection(d); const o = camera.position;
  const t = d.y < -.05 ? Math.min(60, (py - o.y) / d.y) : 8; return [o.x + d.x * Math.max(1, t), o.z + d.z * Math.max(1, t)];
}
// What the dot in the middle of the screen is pointing at: a building piece or the ground.
const ray = new THREE.Raycaster(), CENTER = new THREE.Vector2(0, 0);
function buildAim() {
  ray.setFromCamera(CENTER, camera); const o = ray.ray.origin, dir = ray.ray.direction;
  const far = S.fly ? 70 : S.view === 'first' ? 11 : cam.dist + 10;
  const near = S.fly || S.view === 'first' ? .2 : Math.max(.2, Math.hypot(o.x - me.x, o.y - me.y - 1.6, o.z - me.z) - .6);      // skip things between the camera and you
  const objs = []; for (const s of S.structs.values()) if (Math.hypot(s.x - o.x, s.z - o.z) < far + 6) objs.push(s.g);
  ray.near = near; ray.far = far; let best = null;
  for (const h of ray.intersectObjects(objs, true)) { let g = h.object; while (g && g.userData.sid == null) g = g.parent; const s = g && S.structs.get(g.userData.sid); if (!s) continue; best = { p: h.point, t: h.distance, s }; break; }
  for (let t = near, lim = best ? best.t : far; t < lim; t += .35) { const x = o.x + dir.x * t, y = o.y + dir.y * t, z = o.z + dir.z * t; if (y < heightAt(x, z)) { best = { p: new THREE.Vector3(x, heightAt(x, z), z), t, s: null }; break; } }
  return best;
}
function buildBar() {
  if (!S.build) return; const b = S.build, d = STRUCTS[b.t], p = padUI(), hint = ui.costHint(d), lv = S.me.skills.building.l, ci = catOf(b.t);
  $('buildbar').hidden = false; $('hotbar').hidden = true;
  const K = (kb, pd) => `<kbd>${p ? pd : kb}</kbd>`;
  const cats = BUILD_CATS.map(([ic, n], i) => `<span class="bcat ${i === ci ? 'on' : ''}">${p ? '' : `<small>${i + 1}</small>`}${ic} ${n}</span>`).join('');
  const tiles = BUILD_CATS[ci][2].map(id => { const sd = STRUCTS[id], lock = lv < sd.lvl, ok = !lock && Object.entries(sd.cost).every(([k, n]) => ui.count(k) >= n); return `<span class="btile ${id === b.t ? 'on' : ''} ${lock ? 'lock' : ok ? '' : 'short'}" title="${sd.n}">${sd.i}${lock ? `<em>Lv ${sd.lvl}</em>` : ''}</span>`; }).join('');
  const rm = b.hit?.s ? ` · ${K('Right-click', 'Y')} remove <b>${STRUCTS[b.hit.s.t].n.replace(/ \(.*\)/, '')}</b>` : '';
  $('buildbar').innerHTML = `<div class="bcats">${p ? '<kbd>◀</kbd>' : ''}${cats}${p ? '<kbd>▶</kbd>' : ''}</div><div class="btiles">${p ? '<kbd>LB</kbd>' : ''}${tiles}${p ? '<kbd>RB</kbd>' : ''}</div>
    <div class="bname">${d.n}${lv < d.lvl ? ` <span class="bad">— needs Building level ${d.lvl}</span>` : ''}</div><div class="need">${ui.costHtml(d.cost)}</div>${hint && lv >= d.lvl ? `<div class="need hint">${hint}</div>` : ''}
    <div class="bkeys">${K('Click', 'RT')} place${rm} · ${p ? '<kbd>LB</kbd><kbd>RB</kbd>' : '<kbd>Wheel</kbd>'} piece · ${K('R', 'X')} turn · ${K('F', 'R3')} ${S.fly ? 'land' : 'fly'}${p ? '' : ` · <kbd>V</kbd> ${S.view === 'first' ? '3rd' : '1st'} person`} · ${K('B', 'B')} done</div>`;
}
// world direction for each rotation: 0 = +z, 1 = +x, 2 = -z, 3 = -x
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const SIDE = r => [DIRS[r][1], -DIRS[r][0]];       // a piece's own +x direction in the world
const faceDir = () => { const [fx, fz] = fwd(); return Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 1 : 3) : (fz > 0 ? 0 : 2); };
const GRID = new Set(['foundation', 'floor', 'slope', 'roof']);
function placement() {
  const b = S.build, d = STRUCTS[b.t], [fx, fz] = fwd(), hit = b.hit, over = d.kind === 'roof' || d.kind === 'slope' || d.kind === 'floor';
  let ax, az, hy = me.y;
  if (hit) {
    ax = hit.p.x; az = hit.p.z; hy = hit.p.y; const hk = hit.s && STRUCTS[hit.s.t].kind;
    if (hit.s && GRID.has(d.kind) && (hk === d.kind || (d.kind === 'roof' && hk === 'slope') || (d.kind === 'slope' && hk === 'roof'))) {
      // aiming at a piece of the same sort adds the next one beside it, on the side nearest the dot
      const ex = hit.p.x - hit.s.x, ez = hit.p.z - hit.s.z; if (Math.abs(ex) > Math.abs(ez)) { ax = hit.s.x + Math.sign(ex) * 4; az = hit.s.z; } else { ax = hit.s.x; az = hit.s.z + Math.sign(ez) * 4; }
      if (d.kind !== 'foundation') hy = hit.s.y;
    } else if (over && hk === 'wall') { const l = Math.hypot(fx, fz) || 1; ax += fx / l * 1.2; az += fz / l * 1.2; }        // looking at a wall top: the piece goes over the room behind it
    else if (d.kind === 'foundation' && hk === 'foundation') { ax -= fx * .5; az -= fz * .5; }
  } else if (S.fly) [ax, az] = flyAim(me.y + (over || d.gable ? 3 : 0));
  else { const reach = d.kind === 'place' || d.kind === 'stairs' ? 2.6 : over ? 1.5 : 3.2; ax = me.x + fx * reach; az = me.z + fz * reach; }
  const cx = Math.round(ax / 4) * 4, cz = Math.round(az / 4) * 4;
  let base = null, bd = 11; for (const s of S.structs.values()) if (STRUCTS[s.t].kind === 'foundation') { const q = Math.hypot(s.x - cx, s.z - cz); if (q < bd && Math.abs(s.y - hy) < 12) { bd = q; base = s.y; } }
  base ??= Math.max(heightAt(cx - 2, cz - 2), heightAt(cx + 2, cz - 2), heightAt(cx - 2, cz + 2), heightAt(cx + 2, cz + 2), .2) + .35;
  const occ = (kind, x, y, z, r) => { for (const s of S.structs.values()) if (STRUCTS[s.t].kind === kind && Math.abs(s.x - x) < .3 && Math.abs(s.z - z) < .3 && Math.abs(s.y - y) < .5 && (kind !== 'wall' || s.r === r)) return true; return false; };
  const wallTop = () => { let top = -1; for (const s of S.structs.values()) { const sd = STRUCTS[s.t]; if (sd.kind !== 'wall' || sd.gable || sd.h === 2 || s.t === 'fence') continue; if (Math.abs(s.x - cx) > 2.3 || Math.abs(s.z - cz) > 2.3 || Math.abs(s.x - cx) + Math.abs(s.z - cz) > 2.3) continue; const L = Math.round((s.y - base) / 3); if (L >= 0 && L <= 2) top = Math.max(top, L); } return top; };
  const lvAt = (max, off = .25) => Math.max(0, Math.min(max, Math.floor((hy - base + off) / 3)));
  switch (d.kind) {
    case 'foundation': return { x: cx, y: base, z: cz, r: 0 };
    case 'wall': {
      // snap to the square edge nearest the dot
      const ex = Math.round((ax - 2) / 4) * 4 + 2, ez = Math.round((az - 2) / 4) * 4 + 2;
      const side = Math.abs(ax - ex) < Math.abs(az - ez), x = side ? ex : Math.round(ax / 4) * 4, z = side ? Math.round(az / 4) * 4 : ez, r = side ? 1 : 0;
      if (b.t === 'fence' && bd > 10) return { x, y: heightAt(x, z), z, r };
      if (d.gable) {          // fit the roof beside this wall: under a slope it is a sloped triangle, under a ridge a peak
        const sides = r === 1 ? [[x - 2, z], [x + 2, z]] : [[x, z - 2], [x, z + 2]], lx = r === 1 ? [0, -1] : [1, 0];
        for (const s of S.structs.values()) { const k = STRUCTS[s.t].kind; if (k !== 'slope' && k !== 'roof') continue; if (!sides.some(([sx, sz]) => Math.abs(s.x - sx) < .3 && Math.abs(s.z - sz) < .3)) continue;
          let shape; if (k === 'slope') { const dv = DIRS[s.r]; if (dv[0] * lx[1] - dv[1] * lx[0] !== 0) continue; shape = dv[0] * lx[0] + dv[1] * lx[1] > 0 ? 0 : 1; } else if (s.r % 2 !== r % 2) shape = 2; else continue;
          let top = s.y; for (const w of S.structs.values()) { const wd = STRUCTS[w.t]; if (wd.kind === 'wall' && !wd.gable && w.t !== 'fence' && w.r === r && Math.abs(w.x - x) < .3 && Math.abs(w.z - z) < .3 && w.y + wd.h <= s.y + .3) top = Math.min(top, Math.max(w.y + wd.h, s.y - 8)); }
          const band = Math.max(0, Math.min(4, Math.round((s.y - top) / 2)));
          return { x, y: s.y - 2 * band, z, r, v: shape + 3 * band };
        }
      }
      if (d.h === 2) {        // a short wall goes on top of the highest wall on this edge, to fill up to the roof
        let top = null; for (const w of S.structs.values()) { const wd = STRUCTS[w.t]; if (wd.kind === 'wall' && !wd.gable && w.t !== 'fence' && w.r === r && Math.abs(w.x - x) < .3 && Math.abs(w.z - z) < .3 && w.y >= base - .3) top = Math.max(top ?? -1e9, w.y + wd.h); }
        return { x, y: top ?? base + 3 * lvAt(2), z, r };
      }
      let L = lvAt(d.gable ? 3 : 2); const max = d.gable ? 3 : 2; while (L < max && occ('wall', x, base + 3 * L, z, r)) L++;
      return { x, y: base + 3 * L, z, r, L };
    }
    case 'floor': { let L = Math.max(0, Math.min(2, Math.round((hy - base) / 3) - 1)); while (L < 2 && occ('floor', cx, base + 3 * (L + 1), cz)) L++; return { x: cx, y: base + 3 * (L + 1), z: cz, r: 0, L }; }
    case 'slope': {           // rises away from where you look (R to turn it); continues the row beside it, or stacks onto the high edge of the slope below
      const want = b.turned ? b.r : faceDir(), hs = hit?.s && STRUCTS[hit.s.t].kind === 'slope' ? hit.s : null;
      // the slope you point at comes first, then slopes facing the way you look
      const cands = [...S.structs.values()].filter(s => STRUCTS[s.t].kind === 'slope' && (!b.turned || s.r === want)).sort((p, q) => (p === hs ? -2 : p.r === want ? -1 : 0) - (q === hs ? -2 : q.r === want ? -1 : 0));
      for (const s of cands) {
        const sv = SIDE(s.r), dv = DIRS[s.r];
        if (Math.abs(Math.abs((cx - s.x) * sv[0] + (cz - s.z) * sv[1]) - 4) < .3 && Math.abs((cx - s.x) * sv[1] - (cz - s.z) * sv[0]) < .3 && (s === hs || Math.abs(s.y - hy) < 1.6)) return { x: cx, y: s.y, z: cz, r: s.r };      // carries on the row beside it
        if (Math.abs(s.x + 4 * dv[0] - cx) < .3 && Math.abs(s.z + 4 * dv[1] - cz) < .3) return { x: cx, y: s.y + 2, z: cz, r: s.r };      // stacks on its high edge
      }
      return { x: cx, y: base + 3 * (wallTop() + 1), z: cz, r: want };
    }
    case 'roof': {            // a ridge sits on the high edges of the slopes beside it, or carries on the ridge next to it
      let r = b.turned ? b.r % 2 : faceDir() % 2, y = base + 3 * (wallTop() + 1), found = false;
      for (const s of S.structs.values()) if (STRUCTS[s.t].kind === 'roof') { const sv = SIDE(s.r); if (Math.abs(Math.abs((cx - s.x) * sv[0] + (cz - s.z) * sv[1]) - 4) < .3 && Math.abs((cx - s.x) * sv[1] - (cz - s.z) * sv[0]) < .3) { r = s.r; y = s.y; found = true; break; } }
      if (!found) for (const s of S.structs.values()) if (STRUCTS[s.t].kind === 'slope') { const dv = DIRS[s.r]; if (Math.abs(s.x + 4 * dv[0] - cx) < .3 && Math.abs(s.z + 4 * dv[1] - cz) < .3) { r = s.r % 2; y = s.y + 2; break; } }
      return { x: cx, y, z: cz, r };
    }
    case 'stairs': {          // a flight placed just past the top of another one continues it: same direction, one level up (4 flights high)
      let r = b.r, L = lvAt(3);
      for (const s of S.structs.values()) if (STRUCTS[s.t].kind === 'stairs') {
        const dx = Math.round(Math.sin(s.r * Math.PI / 2)), dz = Math.round(Math.cos(s.r * Math.PI / 2));
        if (Math.abs(s.x + 4 * dx - cx) < .3 && Math.abs(s.z + 4 * dz - cz) < .3 && (!b.turned || s.r === b.r)) { r = s.r; L = Math.max(L, Math.round((s.y - base) / 3) + 1); }
      }
      L = Math.min(L, 3); while (L < 3 && occ('stairs', cx, base + 3 * L, cz)) L++;
      return { x: cx, y: base + 3 * L, z: cz, r, L };
    }
    default: { const x = Math.round(ax * 2) / 2, z = Math.round(az * 2) / 2; return { x, y: groundAt(x, z, (hit ? hy : me.y) + .5), z, r: b.r }; }
  }
}
function placeBuild() { const { x, y, z, r, v } = placement(); emit('place', { t: S.build.t, x, y, z, r, v }, r => { if (r?.err) ui.toast(r.err, 'bad'); else if (r?.ok) sound('place'); }); }
// Roof ends close themselves: a slope or ridge with no roof piece beside it gets a triangle on that side.
function capsOf(s) {
  const k = STRUCTS[s.t].kind; if (k !== 'slope' && k !== 'roof') return null;
  const dv = DIRS[s.r], lx = SIDE(s.r), roofish = o => { const ok = STRUCTS[o.t].kind; return ok === 'slope' || ok === 'roof'; };
  const at = (x, z, y, f) => { for (const o of S.structs.values()) if (o !== s && Math.abs(o.x - x) < .3 && Math.abs(o.z - z) < .3 && Math.abs(o.y - y) < .3 && f(o)) return true; return false; };
  const chain = (rr, sg) => { let c = 0; while (c < 6 && at(s.x - sg * 4 * (c + 1) * dv[0], s.z - sg * 4 * (c + 1) * dv[1], s.y - 2 * (c + 1), o => STRUCTS[o.t].kind === 'slope' && o.r === rr)) c++; return c; };
  const n = k === 'slope' ? chain(s.r, 1) : Math.max(chain(s.r, 1), chain((s.r + 2) % 4, -1));
  const side = sg => {
    if (at(s.x + sg * 4 * lx[0], s.z + sg * 4 * lx[1], s.y, roofish)) return -1;
    const ex = s.x + sg * 2 * lx[0], ez = s.z + sg * 2 * lx[1];
    let band = n;
    for (const o of S.structs.values()) { const od = STRUCTS[o.t]; if (od.kind !== 'wall' || o.t === 'fence' || Math.abs(o.x - ex) > .3 || Math.abs(o.z - ez) > .3) continue;
      if (od.gable && o.y > s.y - 2 * n - .5 && o.y < s.y + .5) return -1;      // an old gable already closes it
      if (!od.gable && o.y < s.y - .1 && o.y + od.h >= s.y - .1) band = 0; }      // a wall already fills up to the roof: only the triangle is needed
    return band;
  };
  return [side(-1), side(1)];
}
function placeMesh(s) { s.g = G.makeStruct(s, s.cc); s.g.position.set(s.x, s.y, s.z); s.g.rotation.y = s.r * Math.PI / 2; s.g.userData.sid = s.id; scene.add(s.g); }
function refreshCaps(x, z) {
  for (const s of S.structs.values()) {
    if (x != null && Math.hypot(s.x - x, s.z - z) > 30) continue;
    const c = capsOf(s); if (!c) continue; const key = c.join(); if (s.capKey === key) continue;
    s.cap = c; s.capKey = key; scene.remove(s.g); placeMesh(s); syncStruct(s);
  }
}

// ---------- targeting ----------
function nextPiece() { const l = S.hamList; if (!l || l.length < 2) return; const i = l.findIndex(o => o.s.id === (S.target?.s?.id)); S.hamSel = l[(i + 1) % l.length].s.id; sound('pick'); }
function findTarget() {
  const [fx, fz] = fwd(), def = heldDef(), hammer = def?.tool === 'hammer'; let best = null, bs = 1e9;
  const la = S.lock != null && !hammer && lockedAnimal(); if (la) { const p = la.g.position; if (Math.hypot(p.x - me.x, p.z - me.z) <= (def?.reach || 2.6) + 1) return { k: 'a', a: la, x: p.x, y: p.y, z: p.z, r: .7 }; }
  if (hammer) { const a = buildAim(), s = a?.s; return s ? { k: 's', s, x: s.x, y: s.y, z: s.z, r: 1.2 } : null; }      // the hammer works on exactly the piece under the dot
  const consider = (x, z, reach, obj, bias = 0) => { const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz); if (d > reach) return; const dot = d < .01 ? 1 : (dx * fx + dz * fz) / d; if (dot < .1 && d > 1.4) return; const sc = d - dot * 1.6 + bias; if (sc < bs) { bs = sc; best = obj; } };
  for (const a of S.animals.values()) consider(a.g.position.x, a.g.position.z, (def?.reach || 2.6) + 1, { k: 'a', a, x: a.g.position.x, y: a.g.position.y, z: a.g.position.z, r: .7 }, def?.dmg > 2 ? -1.5 : 0);
  nodesNear(me.x, me.z, n => consider(n.x, n.z, 3.6, { k: 'n', node: n, x: n.x, y: n.y, z: n.z, r: (NODES[n.t].r || .5) * n.s + .25 }));
  // With the hammer every piece in reach is a candidate, and things built on top (roof, stairs, upper floor)
  // are offered before the foundation under them, which sits at the same spot. T / B steps through the rest.
  const HB = { roof: -.9, slope: -.9, stairs: -.7, floor: -.5, place: -.3, wall: -.2, foundation: 0 }, list = [];
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
  if (t.k === 'a') return `<b style="color:${conColor(t.a.L, myLevel())}">${mobName(ANIMALS[t.a.t].n, t.a.L)} · Lv ${t.a.L}</b><span class="mobhp"><i style="width:${t.a.hp ?? 100}%"></i></span>${K('Click')} ${def?.tool === 'staff' ? 'zap (heals come first)' : 'attack'}`;
  if (t.k === 'n') { const nd = NODES[t.node.t]; if (nd.pick) return `${K('E')} ${nd.verb} ${nd.n}`; const ok = def?.tool === nd.tool; return `${nd.n} — ${K('Click')} ${nd.tool === 'axe' ? (ok ? 'chop' : 'punch for sticks (an axe gets wood)') : (ok ? 'mine' : 'needs a pickaxe')}`; }
  const s = t.s, d = STRUCTS[s.t], own = s.o === S.id ? '' : ` <small>(${s.on})</small>`;
  if (def?.tool === 'hammer') return `${d.n}${own} — ${K('Click')} take apart`;
  if (d.station) return `${K('E')} Use ${d.n}`;
  if (d.door) return `${K('E')} ${s.d.open ? 'Close' : 'Open'} door`;
  if (s.t === 'chest') return `${K('E')} Open chest${own}`;
  if (s.t === 'bed' || s.t === 'clan_banner') return `${K('E')} Set as home${own}`;
  if (s.t === 'well') return `${K('E')} Drink from well`;
  if (s.t === 'farm_plot') { if (!s.d.crop) return def?.seed ? `${K('E')} Plant ${def.n}` : 'Empty plot — hold seeds to plant'; const left = s.d.ready - (Date.now() + S.off); return left <= 0 ? `${K('E')} Harvest!` : `Growing… ${Math.ceil(left / 1000)}s${!s.d.w && def?.tool === 'water' ? ` — ${K('E')} water it` : ''}`; }
  return d.n;
}

// ---------- maps ----------
// World map: 1 pixel = 2 m. Zone borders are traced on top in a darker line.
const MPP = 2, MAPPX = SIZE / MPP;
const zoneGrid = (() => { const n = SIZE / 8, g = new Int16Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = -HALF + i * 8 + 4, z = -HALF + j * 8 + 4; g[j * n + i] = heightAt(x, z) < .05 ? -1 : zoneAt(x, z).id; } return { n, g }; })();
const mapImg = (() => { const c = document.createElement('canvas'); c.width = c.height = MAPPX; const x = c.getContext('2d'), im = x.createImageData(MAPPX, MAPPX), { n, g } = zoneGrid;
  for (let j = 0; j < MAPPX; j++) for (let i = 0; i < MAPPX; i++) {
    const wx = -HALF + i * MPP, wz = -HALF + j * MPP, h = heightAt(wx, wz), o = (j * MAPPX + i) * 4;
    let c3 = h < 0 ? [42 + h * 2, 120 + h * 5, 172 + h * 4] : h < 1.3 ? [222, 204, 150] : h > 24 ? [240, 244, 248] : h > 14 ? [140, 143, 146] : [96 + h * 3, 168 - h * 2, 84];
    const gi = Math.floor(i * MPP / 8), gj = Math.floor(j * MPP / 8), z0 = g[gj * n + gi];
    if (z0 >= 0 && (i * MPP) % 8 < MPP && gi + 1 < n && gj + 1 < n && (g[gj * n + gi + 1] !== z0 && g[gj * n + gi + 1] >= 0) || z0 >= 0 && (j * MPP) % 8 < MPP && gj + 1 < n && g[(gj + 1) * n + gi] !== z0 && g[(gj + 1) * n + gi] >= 0) c3 = c3.map(v => v * .55);
    im.data[o] = c3[0]; im.data[o + 1] = c3[1]; im.data[o + 2] = c3[2]; im.data[o + 3] = 255;
  }
  x.putImageData(im, 0, 0); return c; })();
function mapDots(x, toPx, scale) {
  const dot = (wx, wz, c, r) => { const [px, py] = toPx(wx, wz); x.fillStyle = c; x.strokeStyle = '#1b1208'; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.stroke(); };
  for (const s of S.structs.values()) if ((s.o === S.id || (S.clan && s.c === S.clan.id)) && (s.t === 'bed' || s.t === 'campfire' || s.t === 'clan_banner')) dot(s.x, s.z, s.t === 'clan_banner' ? S.clan?.color || '#fff' : '#ffb347', 3 * scale);
  for (const p of S.players.values()) dot(p.char.position.x, p.char.position.z, S.party?.m.some(m => m.id === p.id) ? '#7dff8a' : p.col || '#dddddd', 4 * scale);
  const [px, py] = toPx(me.x, me.z); x.save(); x.translate(px, py); x.rotate(-me.yaw + Math.PI); x.fillStyle = '#fff'; x.strokeStyle = '#1b1208'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -7 * scale); x.lineTo(5 * scale, 6 * scale); x.lineTo(-5 * scale, 6 * scale); x.closePath(); x.fill(); x.stroke(); x.restore();
}
function drawMini() { const c = $('mini'), x = c.getContext('2d'), R = 80, s = 170 / (R * 2); x.fillStyle = '#2a6f9e'; x.fillRect(0, 0, 170, 170); x.drawImage(mapImg, (me.x - R + HALF) / MPP, (me.z - R + HALF) / MPP, 2 * R / MPP, 2 * R / MPP, 0, 0, 170, 170); mapDots(x, (wx, wz) => [(wx - me.x + R) * s, (wz - me.z + R) * s], 1); }
function drawMap(c) {
  const x = c.getContext('2d'), k = c.width / SIZE, lv = combatLevel(S.me.skills); x.imageSmoothingEnabled = true; x.drawImage(mapImg, 0, 0, c.width, c.height);
  x.save(); x.textAlign = 'center'; x.lineJoin = 'round';
  for (const z of ZONES) {         // zone name and levels, coloured like a monster of that zone's lowest level
    const px = (z.x + HALF) * k, py = (z.z + HALF) * k; if (heightAt(z.x, z.z) < .05) continue;
    x.font = '700 11px sans-serif'; x.lineWidth = 3; x.strokeStyle = 'rgba(20,14,8,.85)'; x.strokeText(z.name, px, py); x.fillStyle = '#fff'; x.fillText(z.name, px, py);
    x.font = '700 10px sans-serif'; x.strokeText(`Lv ${z.lo}–${z.hi}`, px, py + 11); x.fillStyle = conColor(z.lo + 1, lv); x.fillText(`Lv ${z.lo}–${z.hi}`, px, py + 11);
  }
  x.restore(); mapDots(x, (wx, wz) => [(wx + HALF) * k, (wz + HALF) * k], 1.1);
}

// ---------- gamepad ----------
// Standard (Xbox-style) layout. In the world it drives the character; with a panel open it moves a highlight around the menu.
const KEYS_KB = $('keys').innerHTML, KEYS_PAD = '<span><b>Y</b> Bag</span> <span><b>X</b> Use</span> <span><b>RT</b> Action</span> <span><b>A</b> Jump</span> <span><b>LT</b> Target</span> <span><b>B</b> Ability</span> <span><b>LB RB</b> Items</span> <span><b>↑</b> Craft</span> <span><b>→</b> Build</span> <span><b>R3</b> 1st person</span> <span><b>←</b> Players</span> <span><b>↓</b> Map</span> <span><b>Start</b> Menu</span>';
let keysPad = false;
const pad = { lastT: -1e9, mx: 0, mz: 0, run: false, jump: false, rt: false, prev: [], seen: false, navT: 0, navHeld: false, el: null, pt: null };
const dead = v => Math.abs(v) < .2 ? 0 : (v - Math.sign(v) * .2) / .8;
const canRepeat = () => { const d = heldDef(); return !S.build && !ui.tab && !(d && (d.food || d.heal || d.pot || d.slot || d.learn || d.tool === 'water')); };
const navEls = () => { const r = S.me ? '#pbody' : '#loginForm'; return [...document.querySelectorAll(`${r} .slot, ${r} button:not(:disabled), ${r} .card:not(.off), ${r} input:not([type=color]), ${r} .sw b`)]; };
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
  pad.mx = pad.mz = 0; pad.jump = pad.rt = pad.down = false;
  const gp = [...(navigator.getGamepads?.() || [])].find(g => g && g.connected && g.buttons.length >= 12 && g.axes.length >= 4); if (!gp) return;
  const b = gp.buttons.map(x => x.pressed || x.value > .5), hit = i => b[i] && !pad.prev[i];
  const lx = dead(gp.axes[0]), ly = dead(gp.axes[1]), rx = dead(gp.axes[2]), ry = dead(gp.axes[3]);
  if (b.some(Boolean) || lx || ly || rx || ry) { S.pad = true; pad.lastT = performance.now(); if (!pad.seen && S.me) { pad.seen = true; ui.toast('🎮 Controller ready — Y opens your bag, Start opens the menu'); } }
  if (osk.input) { oskPad(b, hit, lx, ly, dt); pad.prev = b; return; }
  if (document.activeElement?.tagName === 'INPUT' && S.me) { if (hit(1)) document.activeElement.blur(); pad.prev = b; return; }
  if (ui.tab || !S.me) {
    const dx = (b[15] ? 1 : 0) - (b[14] ? 1 : 0) || Math.sign(Math.abs(lx) > .5 ? lx : 0), dy = (b[13] ? 1 : 0) - (b[12] ? 1 : 0) || Math.sign(Math.abs(ly) > .5 ? ly : 0);
    navCur(); pad.navT -= dt;
    if (!dx && !dy) pad.navHeld = false; else if (!pad.navHeld || pad.navT <= 0) { pad.navT = pad.navHeld ? .13 : .32; pad.navHeld = true; navMove(dx, dx ? 0 : dy); }
    if (ry) $('pbody').scrollTop += ry * 900 * dt;
    if (hit(0)) { const el = navCur(); if (el) { if (el.tagName === 'INPUT') oskOpen(el); else el.click(); } }
    if (!S.me) { if (hit(9) && $('lname').value.trim()) $('loginForm').requestSubmit(); pad.prev = b; return; }
    if (hit(2)) navCur()?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    if (hit(4)) cycleTab(-1); if (hit(5)) cycleTab(1);
    if (hit(1) || hit(3) || hit(9)) { ui.close(); pad.el = pad.pt = null; }
    pad.prev = b; return;
  }
  pad.mx = lx; pad.mz = -ly; pad.jump = b[0]; pad.rt = b[7]; pad.down = b[6];
  const ls = cfg.padSens / 100; cam.yaw -= rx * 2.9 * ls * dt; const [plo, phi] = pitchLim(); cam.pitch = Math.min(phi, Math.max(plo, cam.pitch + ry * 1.9 * ls * dt * (cfg.invY ? -1 : 1)));
  if (hit(10)) pad.run = true; if (Math.hypot(lx, ly) < .3) pad.run = false;
  if (hit(7)) primary();
  if (hit(2)) { if (S.build) { S.build.r = (S.build.r + 1) % 4; S.build.turned = true; } else interact(); }
  if (hit(3)) { if (S.build) removeAimed(); else ui.open('bag'); }
  if (hit(1)) { if (S.build) stopBuild(); else ability(); }
  if (!S.fly) { if (b[6]) { pad.lt = (pad.lt || 0) + dt; if (pad.lt > .45 && !pad.ltDone) { pad.ltDone = true; S.sneak = !S.sneak; ui.toast(S.sneak ? 'Sneaking…' : 'Standing up'); } } else { if (pad.lt > 0 && !pad.ltDone) cycleTarget(1); pad.lt = 0; pad.ltDone = false; } }
  if (hit(4)) { if (S.build) cyclePiece(-1); else select(S.sel - 1); } if (hit(5)) { if (S.build) cyclePiece(1); else select(S.sel + 1); }
  if (hit(11)) { if (S.build) toggleFly(); else toggleView(); }
  if (S.build && (hit(14) || hit(15))) { pickCat((catOf(S.build.t) + (hit(15) ? 1 : -1) + BUILD_CATS.length) % BUILD_CATS.length); pad.prev = b; return; }
  if (hit(8)) oskOpen($('chatin'), ui.sendChat);
  if (hit(15)) { startBuild(); pad.prev = b; return; }
  const open = hit(12) ? 'craft' : hit(14) ? 'who' : hit(13) ? 'map' : hit(9) ? 'menu' : null;
  if (open) { if (S.build) stopBuild(); pad.el = pad.pt = null; ui.open(open); }
  pad.prev = b;
}

// ---------- on-screen keyboard (for controller-only players) ----------
const OSK = ['1234567890', 'qwertyuiop', 'asdfghjkl_', 'zxcvbnm /', ['⇧', 'Space', '⌫', 'Done']];
const osk = { input: null, done: null, r: 1, c: 0, shift: false, navT: 0, held: false };
function oskOpen(input, done) { osk.input = input; osk.done = done || null; osk.r = 1; osk.c = 0; $('osk').hidden = false; oskDraw(); }
function oskClose(ok) { const d = osk.done; osk.input = null; $('osk').hidden = true; if (ok && d) d(); }
function oskDraw() {
  const v = osk.input.value, shown = osk.input.type === 'password' ? '•'.repeat(v.length) : v;
  $('osk').innerHTML = `<div class="txt">${shown.replace(/[&<>]/g, '')}</div>` + OSK.map((row, r) => `<div class="row">${[...row].map((k, c) => `<button type="button" data-r="${r}" data-c="${c}" class="${r === osk.r && c === osk.c ? 'on' : ''}">${k.length === 1 && osk.shift ? k.toUpperCase() : k === ' ' ? '␣' : k}</button>`).join('')}</div>`).join('') + '<small>A type · X delete · Y space · Start done · B cancel</small>';
}
function oskKey(k) {
  const el = osk.input, max = el.maxLength > 0 ? el.maxLength : 200;
  if (k === 'Done') return oskClose(true); if (k === '⇧') osk.shift = !osk.shift;
  else if (k === '⌫') el.value = el.value.slice(0, -1);
  else if (el.value.length < max) { el.value += k === 'Space' ? ' ' : osk.shift ? k.toUpperCase() : k; osk.shift = false; }
  el.dispatchEvent(new Event('input', { bubbles: true })); oskDraw();
}
$('osk').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { osk.r = +b.dataset.r; osk.c = +b.dataset.c; oskKey([...OSK[osk.r]][osk.c]); } });
function oskPad(b, hit, lx, ly, dt) {
  const dx = (b[15] ? 1 : 0) - (b[14] ? 1 : 0) || Math.sign(Math.abs(lx) > .5 ? lx : 0), dy = (b[13] ? 1 : 0) - (b[12] ? 1 : 0) || Math.sign(Math.abs(ly) > .5 ? ly : 0);
  osk.navT -= dt;
  if (!dx && !dy) osk.held = false; else if (!osk.held || osk.navT <= 0) {
    osk.navT = osk.held ? .12 : .3; osk.held = true;
    if (dy) { const frac = osk.c / Math.max(1, OSK[osk.r].length - 1); osk.r = (osk.r + dy + OSK.length) % OSK.length; osk.c = Math.round(frac * (OSK[osk.r].length - 1)); }
    else osk.c = (osk.c + dx + OSK[osk.r].length) % OSK[osk.r].length;
    oskDraw();
  }
  if (hit(0)) oskKey([...OSK[osk.r]][osk.c]); if (hit(2)) oskKey('⌫'); if (hit(3)) oskKey('Space'); if (hit(9)) oskClose(true); if (hit(1)) oskClose(false);
}

// ---------- proximity voice chat (WebRTC, browser to browser; the game server only passes the introductions) ----------
const voice = { on: false, stream: null, peers: new Map() };
// microphone choice (Menu): kept in this browser; labels only show once the browser has been allowed to use a mic
let mics = [];
async function refreshMics() { try { mics = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId !== 'communications'); } catch { mics = []; } return mics; }
const micName = () => { const i = mics.findIndex(m => m.deviceId === cfg.mic); const m = i >= 0 ? mics[i] : null; return m ? (m.label || `Microphone ${i + 1}`) : 'System default'; };
const micOpts = () => ({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(cfg.mic ? { deviceId: { exact: cfg.mic } } : {}) } });
async function getMic() { try { return await navigator.mediaDevices.getUserMedia(micOpts()); } catch (e) { if (!cfg.mic) throw e; cfg.mic = ''; return navigator.mediaDevices.getUserMedia(micOpts()); } }      // a saved mic that is unplugged falls back to the default
async function nextMic() {
  await refreshMics(); if (!mics.length) return ui.toast('No microphones found', 'bad');
  const list = ['', ...mics.map(m => m.deviceId)], i = list.indexOf(cfg.mic || ''); cfg.mic = list[(i + 1) % list.length];
  try { localStorage.kwCfg = JSON.stringify(cfg); } catch { }
  if (voice.on) {            // swap the live microphone without hanging up on anyone
    const old = voice.stream; try { voice.stream = await getMic(); } catch { ui.toast('Could not open that microphone', 'bad'); voice.stream = old; return; }
    const tr = voice.stream.getAudioTracks()[0]; for (const p of voice.peers.values()) for (const sd of p.pc.getSenders()) if (sd.track?.kind === 'audio') sd.replaceTrack(tr);
    old?.getTracks().forEach(t => t.stop());
  }
  ui.toast('🎤 Microphone: ' + micName());
}
async function voiceToggle() {
  if (voice.on) { voice.on = false; emit('voice', { on: false }); voice.stream?.getTracks().forEach(t => t.stop()); for (const id of [...voice.peers.keys()]) voiceDrop(id); ui.toast('Voice chat off'); return; }
  try { voice.stream = await getMic(); refreshMics(); }
  catch { ui.toast('No microphone, or the browser was not allowed to use it', 'bad'); return; }
  voice.on = true; emit('voice', { on: true }); for (const id of S.voice) if (id !== S.id) voiceLink(id);
  ui.toast('Voice chat on — players near you can hear you', 'good');
}
function voiceLink(id) {
  if (voice.peers.has(id) || !voice.on) return voice.peers.get(id);
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }), au = new Audio(), peer = { pc, au, q: [] }; au.autoplay = true; voice.peers.set(id, peer);
  voice.stream.getTracks().forEach(t => pc.addTrack(t, voice.stream));
  pc.ontrack = e => { au.srcObject = e.streams[0]; au.play?.().catch(() => { }); };
  pc.onicecandidate = e => { if (e.candidate) emit('rtc', { to: id, d: { ice: e.candidate } }); };
  if (S.id < id) pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => emit('rtc', { to: id, d: { sdp: pc.localDescription } })).catch(() => { });      // the lower name calls, the other answers
  return peer;
}
function voiceDrop(id) { const p = voice.peers.get(id); if (!p) return; p.pc.close(); p.au.srcObject = null; voice.peers.delete(id); }
sock.on('voice', v => { v.on ? S.voice.add(v.id) : S.voice.delete(v.id); if (v.id === S.id) return; if (v.on) voiceLink(v.id); else voiceDrop(v.id); if (ui.tab === 'who') ui.render(); });
sock.on('rtc', async ({ from, d }) => {
  const peer = voiceLink(from); if (!peer) return; const pc = peer.pc;
  try {
    if (d.sdp) { await pc.setRemoteDescription(d.sdp); for (const c of peer.q.splice(0)) await pc.addIceCandidate(c); if (d.sdp.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); emit('rtc', { to: from, d: { sdp: pc.localDescription } }); } }
    else if (d.ice) { if (pc.remoteDescription) await pc.addIceCandidate(d.ice); else peer.q.push(d.ice); }
  } catch (e) { console.warn('voice', e.message); }
});
function voiceVolumes() { for (const [id, p] of voice.peers) { const o = S.players.get(id); p.au.volume = o ? Math.max(0, Math.min(1, 1 - (Math.hypot(o.char.position.x - me.x, o.char.position.z - me.z) - 6) / 34)) : 0; } }      // full volume within 6 m, silent past 40 m
sock.on('p-', id => voiceDrop(id));

// ---------- main loop ----------
const clock = new THREE.Clock(); let netT = 0, slowT = 0, time = 0, lastSent = '';
const lerpAng = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
function updateMe(dt) {
  const k = S.keys, typing = document.activeElement?.tagName === 'INPUT';
  let ix = 0, iz = 0; if (!typing && !ui.tab && !S.fly) { ix = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + pad.mx; iz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + pad.mz; }
  const [fx, fz] = fwd(); let mx = fx * iz - fz * ix, mz = fz * iz + fx * ix; const ml = Math.hypot(mx, mz), mag = Math.min(1, ml); if (ml > 0) { mx *= mag / ml; mz *= mag / ml; }
  const swim = heightAt(me.x, me.z) < -1.15 && me.y < -.6;
  const run = (k.ShiftLeft || k.ShiftRight || pad.run) && ml > .6 && S.stam > 1 && !swim && !S.sneak;
  S.stam = Math.max(0, Math.min(100, S.stam + (run ? -14 : 11) * dt));
  const sp = (swim ? 3.2 : S.sneak ? 2.4 : run ? 8.8 : 5.4) * (1 + (S.speed || 0) / 100), f = Math.min(1, dt * 12);
  me.vx += (mx * sp - me.vx) * f; me.vz += (mz * sp - me.vz) * f;
  let nx = me.x + me.vx * dt, nz = me.z + me.vz * dt;
  nodesNear(nx, nz, n => { const r = NODES[n.t].r; if (!r) return; const R = r * n.s + .35, dx = nx - n.x, dz = nz - n.z, d = Math.hypot(dx, dz); if (d < R && d > .001 && me.y < n.y + (G.NODE_H[n.t] || 1) * n.s) { nx = n.x + dx / d * R; nz = n.z + dz / d * R; } });
  for (const c of col.circ) { if (me.y > c.y1 || me.y + 1.7 < c.y0) continue; const R = c.r + .35, dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz); if (d < R && d > .001) { nx = c.x + dx / d * R; nz = c.z + dz / d * R; } }
  for (const w of col.walls) { if (me.y >= w.y1 - .05 || me.y + 1.7 <= w.y0) continue; const ex = w.x2 - w.x1, ez = w.z2 - w.z1, t = Math.min(1, Math.max(0, ((nx - w.x1) * ex + (nz - w.z1) * ez) / (ex * ex + ez * ez))), qx = w.x1 + ex * t, qz = w.z1 + ez * t, dx = nx - qx, dz = nz - qz, d = Math.hypot(dx, dz); if (d < .42) { if (d > .001) { nx = qx + dx / d * .42; nz = qz + dz / d * .42; } else { nx = me.x; nz = me.z; } } }
  for (const s of col.surf) if (s.solid && nx > s.x0 - .3 && nx < s.x1 + .3 && nz > s.z0 - .3 && nz < s.z1 + .3 && me.y + .8 < s.top && me.y > s.top - 3.4) { nx = me.x; nz = me.z; break; }
  nx = Math.max(-(HALF - 42), Math.min(HALF - 42, nx)); nz = Math.max(-(HALF - 42), Math.min(HALF - 42, nz));
  me.x = nx; me.z = nz;
  const gy = groundAt(nx, nz, me.y);
  if (swim) { me.y += (-1.2 - me.y) * Math.min(1, dt * 6); me.vy = 0; me.grounded = false; }
  else {
    if (me.grounded && me.vy <= 0 && gy > me.y - .7) me.y = gy;
    else { me.vy -= 24 * dt; me.y += me.vy * dt; }
    if (me.y <= gy) { me.y = gy; me.vy = 0; me.grounded = true; } else if (me.y - gy > .05) me.grounded = false;
    if ((k.Space || pad.jump) && me.grounded && !typing && !ui.tab && !S.fly) { me.vy = 8; me.grounded = false; me.y += .02; }
  }
  me.speed = Math.hypot(me.vx, me.vz); me.mode = swim ? 4 : S.sneak ? 3 : me.speed > 6.5 ? 2 : me.speed > .4 ? 1 : 0;
  if (S.view === 'first' && !S.fly) me.yaw = Math.atan2(fx, fz);
  else if (performance.now() - me.lastSwing < 500 || (heldDef()?.tool === 'bow' && ml === 0)) me.yaw = lerpAng(me.yaw, Math.atan2(fx, fz), Math.min(1, dt * 14));
  else if (ml > .05) me.yaw = lerpAng(me.yaw, Math.atan2(mx, mz), Math.min(1, dt * 10));
  me.char.position.set(me.x, me.y, me.z); me.char.rotation.y = me.yaw;
  G.setHeld(me.char, held()?.id || null, heldDef()); G.animateCharacter(me.char, dt, me.speed, me.mode);
  if (S.fishing && me.speed > 1) S.fishing = false;
}
// free build camera: fly anywhere within 40 m of the character and up to 35 m above, to look over a whole house
const FLY_R = 40, FLY_UP = 35;
function updateFly(dt) {
  const k = S.keys, f = S.fly, sp = (k.ControlLeft || pad.run ? 26 : 13) * dt, [fx, fz] = fwd(), typing = document.activeElement?.tagName === 'INPUT' || ui.tab;
  const ix = typing ? 0 : (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + pad.mx, iz = typing ? 0 : (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) + pad.mz, iy = typing ? 0 : (k.Space || pad.jump ? 1 : 0) - (k.ShiftLeft || k.ShiftRight || pad.down ? 1 : 0);
  f.x += (fx * iz - fz * ix) * sp; f.z += (fz * iz + fx * ix) * sp; f.y += iy * sp;
  const dx = f.x - me.x, dz = f.z - me.z, d = Math.hypot(dx, dz); if (d > FLY_R) { f.x = me.x + dx / d * FLY_R; f.z = me.z + dz / d * FLY_R; }
  f.y = Math.min(me.y + FLY_UP, Math.max(Math.max(heightAt(f.x, f.z), 0) + .6, f.y));
  const cp = Math.cos(cam.pitch); camera.position.set(f.x, f.y, f.z); camera.lookAt(f.x - Math.sin(cam.yaw) * cp, f.y - Math.sin(cam.pitch), f.z - Math.cos(cam.yaw) * cp); me.char.visible = true;
}
function updateCamera(dt, focus) {
  if (S.fly && S.me) return updateFly(dt);
  if (S.view === 'first' && S.me) {        // first person: the camera is your eyes
    const cp = Math.cos(cam.pitch), ey = me.y + (S.sneak ? 1.2 : 1.62), dx = -Math.sin(cam.yaw), dz = -Math.cos(cam.yaw);
    camera.position.set(me.x + dx * .12, ey, me.z + dz * .12); camera.lookAt(me.x + dx * cp, ey - Math.sin(cam.pitch), me.z + dz * cp); me.char.visible = false; return;
  }
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
    if (S.recall) { if (Math.hypot(me.x - S.recall.x, me.z - S.recall.z) > .6) { S.recall = null; ui.toast('Return Home cancelled'); } else if (performance.now() > S.recall.t) { S.recall = null; emit('recall', {}, r => { if (r?.err) ui.toast(r.err, 'bad'); else sound('lvl'); }); } }
    updateMe(dt); focus = me.char.position;
    const f = 1 - Math.exp(-dt * 12);
    for (const p of S.players.values()) { const c = p.char.position, moved = Math.hypot(p.tx - c.x, p.tz - c.z); c.x += (p.tx - c.x) * f; c.y += (p.ty - c.y) * f; c.z += (p.tz - c.z) * f; p.char.rotation.y = lerpAng(p.char.rotation.y, p.tr, f); G.animateCharacter(p.char, dt, [0, 5, 8.5, 2.4, 3][p.a] || (moved > .05 ? 4 : 0), p.a); }
    for (const a of S.animals.values()) { const c = a.g.position; c.x += (a.tx - c.x) * f; c.y += (a.ty - c.y) * f; c.z += (a.tz - c.z) * f; a.g.rotation.y = lerpAng(a.g.rotation.y, a.tr, f); G.animateAnimal(a.g, dt, a.mv); }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; p.vy -= 12 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); } }
    for (let i = arrows.length - 1; i >= 0; i--) { const a = arrows[i]; a.t += dt * 70; const t = Math.min(a.t, a.len); a.m.position.copy(a.o).addScaledVector(a.d, t); a.m.position.y -= .0015 * t * t; if (a.t > a.len + 30) { scene.remove(a.m); arrows.splice(i, 1); } }
    for (const s of S.structs.values()) { const u = s.g.userData; if (u.flame) { const k = 1 + Math.sin(time * 11 + s.id) * .12 + Math.sin(time * 23 + s.id) * .08; u.flame.scale.set(k, 1 + Math.sin(time * 15 + s.id) * .2, k); } }
    // targeting + prompt
    S.target = S.build ? null : findTarget();
    { const la = S.lock != null && S.animals.get(S.lock); lockMark.visible = !!la; if (la) { lockMark.position.set(la.g.position.x, la.g.position.y + 1.9 * la.g.scale.y + Math.sin(time * 4) * .12, la.g.position.z); lockMark.rotation.y = time * 2; } }
    if (!S.build) { const hs = heldDef()?.tool === 'hammer' && S.target?.s; hiBox.visible = !!hs; if (hs) hiBox.setFromObject(hs.g); }
    if (S.target && !(S.target.k === 's' && heldDef()?.tool === 'hammer')) { const t = S.target; ring.visible = true; ring.position.set(t.x, Math.max(t.y, groundAt(t.x, t.z, me.y + 2)) + .12, t.z); ring.scale.setScalar(t.r * (1 + Math.sin(time * 5) * .05)); } else ring.visible = false;
    if (S.build) {
      const b = S.build, prev = b.hit?.s; b.hit = buildAim(); const p = placement(); if (STRUCTS[b.t].gable) ghostShape(p.v);
      const g = b.ghost; g.position.set(p.x, p.y, p.z); g.rotation.y = p.r * Math.PI / 2;
      const d = STRUCTS[b.t], ok = S.me.skills.building.l >= d.lvl && Object.entries(d.cost).every(([k, n]) => ui.count(k) >= n); g.userData.gmat.color.set(ok ? '#7dff8a' : '#ff8a6a');
      const hs = b.hit?.s; hiBox.visible = !!hs; if (hs) hiBox.setFromObject(hs.g); if (hs !== prev) buildBar();
    }
    netT += dt; if (netT > .08) { netT = 0; const m = [+me.x.toFixed(2), +me.y.toFixed(2), +me.z.toFixed(2), +me.yaw.toFixed(2), me.mode]; const key = m.join(); if (key !== lastSent) { lastSent = key; sock.volatile.emit('mv', m); } }
    slowT += dt; if (slowT > .25) {
      slowT = 0; targetFrame(); $('prompt').innerHTML = ui.tab ? '' : promptFor(S.target); $('bStam').style.width = S.stam + '%'; drawMini();
      // zone, class ability and buff readouts
      const zo = zoneAt(me.x, me.z), zn = zo.name;
      if (S.zone !== zn) { if (S.zone) ui.toast(`Entering ${zn} — monsters level ${zo.lo}–${zo.hi}`, zo.lo > myLevel() + 1 ? 'bad' : ''); S.zone = zn; }
      const tool = heldDef()?.tool, cl = CLASSES[tool], cdl = Math.ceil(((S.cd[tool] || 0) - performance.now()) / 1000), bf = S.me.buff && S.me.buff.until > Date.now() + S.off ? S.me.buff : null;
      S.speed = bf ? ITEMS[bf.id].buff.st.speed || 0 : 0;
      $('abil').innerHTML = (cl ? `<div class="${cdl > 0 ? 'cd' : ''}">${cl[2]} ${cl[3]}<small>${cdl > 0 ? cdl + 's' : padUI() ? 'B' : 'Q'}</small></div>` : '') + (bf ? `<div class="buff">${ITEMS[bf.id].i} Buff<small>${Math.ceil((bf.until - Date.now() - S.off) / 60000)} min</small></div>` : '') + (S.recall ? `<div>🏠 Home<small>${Math.ceil((S.recall.t - performance.now()) / 1000)}s</small></div>` : '');
      voiceVolumes();
      const hr = Math.floor(S.time * 24), mn = Math.floor((S.time * 24 % 1) * 60 / 10) * 10; $('clock').textContent = `${S.time > .23 && S.time < .77 ? '☀️' : '🌙'} ${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')} · ${zn} Lv ${zo.lo}–${zo.hi}`;
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
window.KW = { toggleView, buildAim, me, cam, S, primary, interact, startBuild, placement, select, ui, cfg, music, emit, voice, osk, oskOpen, ability, recall, toggleFly };
