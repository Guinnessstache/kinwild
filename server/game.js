// Authoritative game simulation: everything that matters (items, skills, world state) is decided here.
import crypto from 'crypto';
import { ITEMS, RECIPES, STRUCTS, NODES, ANIMALS, CROPS, SKILLS, QUESTS, STATION_NAMES, xpNeed, DAY_LEN, MAX_LVL, lvlMods, atkSpd } from '../shared/data.js';
import { install, stk, distSpawn } from './rpg.js';
import { heightAt, biomeAt, genNodes, zoneAt, SPAWN, HALF } from '../shared/terrain.js';
const EDGE = HALF - 40;      // how far out anything may go

const INV = 32, STACK = 99;
const PEACEFUL = process.env.PEACEFUL === '1';
const DAY = (Number(process.env.DAY_MINUTES) || DAY_LEN / 60) * 60;
const r2 = v => Math.round(v * 100) / 100;
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 24).toString('hex');
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Game {
  constructor(io, db) {
    this.io = io; this.db = db;
    this.players = new Map();             // pid -> player
    this.nodes = genNodes(); this.nodeHp = new Map(); this.dead = new Map();
    this.structs = new Map(); this.animals = new Map(); this.clans = {};
    this.nextId = 1; this.time = 0.3; this.dirty = false; this.clanDirty = false;
    this.parties = new Map(); this.perms = {}; this.permDirty = false;      // perms: who may use each player's doors, chests and stations
  }

  async init() {
    const w = await this.db.load('world');
    if (w) {
      for (const s of w.structs || []) this.structs.set(s.id, s);
      for (const [id, t] of w.dead || []) this.dead.set(id, t);
      this.nextId = w.nextId || 1; this.time = w.time ?? 0.3;
    }
    this.clans = (await this.db.load('clans')) || {};
    this.perms = (await this.db.load('perms')) || {};
    for (const st of this.structs.values()) this.clearNodes(st);       // nothing grows through floors (also after a map change)
    for (const t in ANIMALS) for (let i = 0; i < ANIMALS[t].count; i++) this.spawnAnimal(t, true);
    setInterval(() => this.tick(), 100);
    setInterval(() => this.slow(), 1000);
    setInterval(() => this.saveAll().catch(e => console.error('save failed', e.message)), 20000);
    console.log(`World ready: ${this.nodes.length} resource nodes, ${this.structs.size} structures, ${this.animals.size} animals${PEACEFUL ? ' (peaceful)' : ''}`);
  }

  async saveAll() {
    if (this.dirty) { this.dirty = false; await this.db.save('world', { structs: [...this.structs.values()], dead: [...this.dead], nextId: this.nextId, time: this.time }); }
    if (this.clanDirty) { this.clanDirty = false; await this.db.save('clans', this.clans); }
    if (this.permDirty) { this.permDirty = false; await this.db.save('perms', this.perms); }
    for (const p of this.players.values()) await this.savePlayer(p);
  }
  savePlayer(p) {
    const { name, pin, salt, token, x, z, inv, equip, skills, hp, hunger, thirst, look, quest, spawn, done, known, buff, recallAt } = p;
    return this.db.save('player:' + p.id, { name, pin, salt, token, x, z, inv, equip, skills, hp, hunger, thirst, look, quest, spawn, done, known, buff, recallAt });
  }

  // ---------- connection / accounts ----------
  connect(socket) {
    let p = null;
    socket.on('login', async (d, ack) => {
      try { const r = await this.login(socket, d || {}); if (r.p) { p = r.p; delete r.p; } ack?.(r); }
      catch (e) { console.error(e); ack?.({ err: 'Server error, try again' }); }
    });
    const on = (ev, fn) => socket.on(ev, (d, ack) => {
      if (!p || this.players.get(p.id) !== p) return;
      try { const r = fn.call(this, p, d ?? {}); if (typeof ack === 'function') ack(r || {}); } catch (e) { console.error(ev, e); }
      this.flush(p);
    });
    on('mv', this.onMove); on('sel', (p, d) => { p.sel = Math.max(0, Math.min(7, d.i | 0)); });
    on('swing', this.onSwing); on('shoot', this.onShoot); on('pick', this.onPick); on('sUse', this.onStructUse);
    on('drink', this.onDrink); on('useItem', this.onUseItem); on('invMove', this.onInvMove); on('trash', this.onTrash);
    on('craft', this.onCraft); on('place', this.onPlace); on('demolish', this.onDemolish); on('fish', this.onFish);
    on('chat', this.onChat); on('clan', this.onClan); on('closeChest', p => { p.chest = null; });
    on('ability', this.onAbility); on('heal', this.onHeal); on('recall', this.onRecall); on('perm', this.onPerm); on('party', this.onParty); on('who', this.onWho);
    on('trade', this.onTrade); on('voice', this.onVoice); on('rtc', this.onRtc); on('stock', this.onStock); on('sort', this.onSort); on('stackNear', this.onStackNear); on('upgrade', this.onUpgrade);
    socket.on('disconnect', () => { if (p && this.players.get(p.id) === p) { this.endTrade(p, `${p.name} left`); this.leaveParty(p); if (p.voice) this.io.to('game').emit('voice', { id: p.id, on: false }); this.players.delete(p.id); this.savePlayer(p).catch(() => { }); this.io.to('game').emit('p-', p.id); this.sys(`${p.name} left`); this.refreshClan(p.clan); } });
  }

  async login(socket, d) {
    const name = String(d.name || '').trim();
    if (!/^[A-Za-z0-9_]{2,14}$/.test(name)) return { err: 'Name: 2-14 letters or numbers, no spaces' };
    const pid = name.toLowerCase();
    let doc = await this.db.load('player:' + pid);
    if (doc) {
      const ok = (d.token && d.token === doc.token) || (d.pin && hashPin(d.pin, doc.salt) === doc.pin);
      if (!ok) return { err: d.pin ? 'Wrong PIN for that name' : 'Please enter your PIN' };
    } else {
      if (String(d.pin || '').length < 3) return { err: 'Pick a secret PIN (3+ characters)' };
      const salt = crypto.randomBytes(8).toString('hex');
      doc = { name, salt, pin: hashPin(d.pin, salt), token: crypto.randomBytes(16).toString('hex'), x: SPAWN.x + Math.random() * 4 - 2, z: SPAWN.z + Math.random() * 4 - 2,
        inv: Array(INV).fill(null), equip: {}, skills: {}, hp: 100, hunger: 100, thirst: 100, quest: 0, spawn: null };
    }
    if (d.look && typeof d.look === 'object') doc.look = { shirt: clr(d.look.shirt, '#d9534f'), hair: clr(d.look.hair, '#5a3a22'), skin: clr(d.look.skin, '#f1c7a0') };
    doc.look ||= { shirt: '#d9534f', hair: '#5a3a22', skin: '#f1c7a0' };
    for (const k in SKILLS) doc.skills[k] ||= { l: 1, x: 0 };
    doc.done ||= {}; doc.known ||= {}; doc.equip ||= {};
    if (typeof doc.equip.body === 'string') doc.equip.chest = { id: doc.equip.body, n: 1 }; delete doc.equip.body;      // saves from before armor had slots
    const size = INV + (ITEMS[doc.equip.bag?.id]?.bag || 0); while (doc.inv.length < size) doc.inv.push(null);
    const old = this.players.get(pid);
    if (old) { old.socket.emit('kick', 'You logged in somewhere else'); this.players.delete(pid); old.socket.disconnect(true); }
    const p = { ...doc, id: pid, socket, y: heightAt(doc.x, doc.z), r: 0, a: 0, sel: 0, lastSwing: 0, chest: null, fishing: null, clan: this.clanOf(pid), cd: {}, party: null, trade: null, voice: false, perm: this.perms[pid] || 'clan' };
    this.players.set(pid, p); socket.join('game');
    socket.to('game').emit('p+', this.pub(p)); this.sys(`${p.name} joined`);
    this.refreshClan(p.clan);
    return { p, ok: true, token: doc.token, init: {
      id: pid, now: Date.now(), time: this.time, peaceful: PEACEFUL, me: this.priv(p),
      players: [...this.players.values()].filter(o => o !== p).map(o => this.pub(o)),
      structs: [...this.structs.values()].map(s => this.spub(s)), dead: [...this.dead.keys()],
      animals: [...this.animals.values()].map(a => this.apub(a)),
      clan: this.clanView(p), party: this.partyView(p), voice: [...this.players.values()].filter(o => o.voice).map(o => o.id),
    } };
  }
  held(p) { return p.inv[p.sel]; }
  pub(p) { const c = this.clans[p.clan]; return { id: p.id, name: p.name, x: r2(p.x), y: r2(p.y), z: r2(p.z), r: p.r, look: p.look, tag: c?.tag || '', col: c?.color || '', armor: ITEMS[p.equip.chest?.id]?.mat || '', lv: this.plvl(p) }; }
  apub(a) { return { id: a.id, t: a.t, x: r2(a.x), y: r2(a.y), z: r2(a.z), r: a.ang, L: a.L, hp: Math.round(100 * a.hp / a.max) }; }
  priv(p) { return { name: p.name, x: p.x, y: p.y, z: p.z, inv: p.inv, equip: p.equip, skills: p.skills, hp: p.hp, max: this.maxHp(p), hunger: p.hunger, thirst: p.thirst, quest: p.quest, look: p.look, known: p.known, buff: p.buff || null, recallAt: p.recallAt || 0, perm: p.perm }; }
  spub(s) { return { ...s, d: this.pd(s), on: this.players.get(s.o)?.name || s.on, c: this.clanOf(s.o), cc: this.clans[this.clanOf(s.o)]?.color || '' }; }
  toast(p, m, k = '') { p.socket.emit('toast', { m, k }); }
  sys(m) { this.io.to('game').emit('chat', { ch: 'sys', m }); }

  flush(p) {
    this.quest(p, null);
    const u = {};
    if (p._inv) { u.inv = p.inv; u.equip = p.equip; u.max = this.maxHp(p); p._inv = false; if (p.trade) this.tradeTouch(p); }
    if (p._misc) { u.known = p.known; u.buff = p.buff || null; u.recallAt = p.recallAt || 0; u.perm = p.perm; u.max = this.maxHp(p); p._misc = false; }
    if (p._sk) { u.skills = p.skills; u.max = this.maxHp(p); p._sk = false; }
    if (p._vit) { u.hp = p.hp; u.hunger = p.hunger; u.thirst = p.thirst; p._vit = false; }
    if (p._q) { u.quest = p.quest; p._q = false; }
    if (Object.keys(u).length) p.socket.emit('me', u);
  }

  // ---------- inventory helpers ----------
  count(p, id) { let n = 0; for (const it of p.inv) if (it && it.id === id) n += it.n; return n; }
  take(p, id, n) { for (let i = 0; i < p.inv.length && n > 0; i++) { const it = p.inv[i]; if (it && it.id === id) { const k = Math.min(n, it.n); it.n -= k; n -= k; if (it.n <= 0) p.inv[i] = null; } } p._inv = true; }
  missing(p, cost) { return Object.entries(cost).filter(([k, n]) => this.count(p, k) < n).map(([k, n]) => `${n - this.count(p, k)} more ${ITEMS[k].n}`).join(' and '); }
  hasAll(p, cost, mul = 1) { for (const k in cost) if (this.count(p, k) < cost[k] * mul) return false; return true; }
  give(p, id, n = 1, durMul = 1) {
    const def = ITEMS[id]; if (!def || n <= 0) return; let left = n;
    let q;
    if (def.dur || def.slot) {        // tools, weapons, armor and bags never stack; gear gets random stats
      while (left > 0) { const s = p.inv.findIndex(x => !x); if (s < 0) break; p.inv[s] = def.gear ? this.roll(id, this.lvl(p, 'crafting') * .004, durMul) : def.dur ? { id, n: 1, d: def.empty ? 0 : Math.round(def.dur * durMul) } : { id, n: 1 }; q = p.inv[s].q; left--; }
    } else {
      for (const it of p.inv) if (it && it.id === id && it.n < STACK && left > 0) { const k = Math.min(left, STACK - it.n); it.n += k; left -= k; }
      while (left > 0) { const s = p.inv.findIndex(x => !x); if (s < 0) break; const k = Math.min(left, STACK); p.inv[s] = { id, n: k }; left -= k; }
    }
    if (left > 0) this.toast(p, 'Your bag is full!', 'bad');
    if (n - left > 0) p.socket.emit('got', { id, n: n - left, q });
    p._inv = true;
  }
  wear(p, n = 1) {
    const it = this.held(p); if (!it || it.d == null || ITEMS[it.id].empty) return;
    it.d -= n; if (it.d <= 0) { p.inv[p.sel] = null; this.toast(p, `Your ${ITEMS[it.id].n} broke!`, 'bad'); } p._inv = true;
  }
  lvl(p, sk) { return p.skills[sk].l; }
  xp(p, sk, amt) {
    const s = p.skills[sk]; if (!s || s.l >= MAX_LVL) return;
    s.x += amt;
    while (s.l < MAX_LVL && s.x >= xpNeed(s.l)) { s.x -= xpNeed(s.l); s.l++; p.socket.emit('lvl', { sk, l: s.l }); }
    s.x = Math.round(s.x * 10) / 10; p._sk = true;
    const c = this.clans[p.clan]; if (c) { c.xp = (c.xp || 0) + amt * 0.2; this.clanDirty = true; }
  }
  quest(p, ev) {
    if (ev) p.done[ev] = 1;
    for (let g = 0; g < 6; g++) {
      const q = QUESTS[p.quest]; if (!q) return;
      const done = q.have ? this.count(p, q.have[0]) >= q.have[1] : !!p.done[q.ev];
      if (!done) return;
      p.quest++; p._q = true;
      p.socket.emit('questDone', { t: q.t });
      if (q.give) for (const k in q.give) this.give(p, k, q.give[k]);
    }
  }
  fx(k, x, y, z, extra = {}) { this.io.to('game').volatile.emit('fx', { k, x: r2(x), y: r2(y), z: r2(z), ...extra }); }

  // ---------- movement & vitals ----------
  onMove(p, d) {
    if (!Array.isArray(d) || d.some(v => typeof v !== 'number' || !isFinite(v))) return;
    p.x = Math.max(-EDGE, Math.min(EDGE, d[0])); p.y = d[1]; p.z = Math.max(-EDGE, Math.min(EDGE, d[2])); p.r = r2(d[3]); p.a = d[4] | 0;
  }
  hurt(p, dmg, why) {
    const st = this.stats(p), took = dmg * (1 - st.arm / 100) * (Date.now() < (p.guard || 0) ? .5 : 1);
    p.hp -= took; p._vit = true; this.xp(p, 'defense', took * .6);
    p.socket.emit('hurt', {});
    if (p.hp <= 0) this.die(p, why);
  }
  die(p, why) {
    const sp = p.spawn && this.structs.get(p.spawn.id) ? p.spawn : SPAWN;
    p.x = sp.x + 1.5; p.z = sp.z + 1.5; p.y = heightAt(p.x, p.z) + 0.5;
    p.hp = this.maxHp(p) * .6; p.hunger = Math.max(p.hunger, 50); p.thirst = Math.max(p.thirst, 50); p._vit = true; p.fishing = null;
    p.socket.emit('tp', { x: p.x, y: p.y, z: p.z, msg: `${why} You wake up ${sp === SPAWN ? 'on the meadow' : 'at home'} — you kept all your things.` });
  }
  slow() {
    const now = Date.now();
    for (const p of this.players.values()) {
      p.hunger = Math.max(0, p.hunger - 100 / (26 * 60)); p.thirst = Math.max(0, p.thirst - 100 / (18 * 60));
      const max = this.maxHp(p); if (p.hp > max) { p.hp = max; p._vit = true; }
      if (p.hunger > 30 && p.thirst > 30 && p.hp < max) p.hp = Math.min(max, p.hp + 0.7 + max * .002);
      if (p.buff && now > p.buff.until) { p.buff = null; p._misc = true; this.toast(p, 'Your meal buff wore off'); }
      if (p.trade && !this.near(p, this.players.get(p.trade.with) || { x: 1e9, z: 0 }, 14)) this.endTrade(p, 'Trade cancelled — too far apart');
      if (p.hunger <= 0 || p.thirst <= 0) { p.hp -= 0.6; if (p.hp <= 0) this.die(p, p.thirst <= 0 ? 'You got too thirsty.' : 'You got too hungry.'); }
      p._tick = (p._tick || 0) + 1; if (p._tick % 3 === 0) p._vit = true;
      this.flush(p);
    }
    for (const [id, t] of this.dead) if (now > t) {       // regrow, unless something has been built on the spot
      if (this.covered(this.nodes[id])) { this.dead.set(id, now + 120000); continue; }
      this.dead.delete(id); this.io.to('game').emit('nd', [id, 1]); this.dirty = true;
    }
    for (const pt of this.parties.values()) this.sendParty(pt.m);
    const cnt = {}; for (const a of this.animals.values()) cnt[a.t] = (cnt[a.t] || 0) + 1;
    for (const t in ANIMALS) if ((cnt[t] || 0) < ANIMALS[t].count && Math.random() < 0.15) this.spawnAnimal(t, false);
    this.dirty = this.dirty || this.players.size > 0 && now % 60000 < 1000;   // keep time-of-day roughly saved
  }

  // ---------- gathering ----------
  near(p, o, d) { return Math.hypot(p.x - o.x, p.z - o.z) <= d; }
  onSwing(p, d) {
    const now = Date.now(); if (now - p.lastSwing < 350) return; p.lastSwing = now;
    p.socket.to('game').volatile.emit('sw', p.id);
    const it = this.held(p), def = it ? ITEMS[it.id] : null;
    if (d.k === 'n') {
      const node = this.nodes[d.id]; if (!node || this.dead.has(d.id) || !this.near(p, node, 5)) return;
      const nd = NODES[node.t]; if (nd.pick) return;
      if (!def || def.tool !== nd.tool) {
        if (nd.tool === 'axe') { if (Math.random() < 0.6) this.give(p, 'stick', 1); this.xp(p, 'woodcutting', 1); this.fx('hit', node.x, node.y + 1.2, node.z, { c: '#8a5a33' }); }
        else { if (Math.random() < 0.3) this.give(p, 'stone', 1); else if (Math.random() < 0.3) this.toast(p, 'A pickaxe would work much better'); this.fx('hit', node.x, node.y + .6, node.z, { c: '#9aa0a6' }); }
        return;
      }
      let hp = this.nodeHp.get(d.id) ?? nd.hp;
      const dmg = Math.min(def.pow, hp); hp -= dmg;
      let n = Math.ceil(dmg / 2); if (Math.random() < this.lvl(p, nd.skill) * 0.025) n++;
      this.give(p, nd.drop, n);
      for (const [id, ch] of nd.extra || []) if (Math.random() < ch) this.give(p, id, 1);
      this.xp(p, nd.skill, nd.xp * dmg); this.wear(p);
      this.fx('hit', node.x, node.y + 1, node.z, { c: nd.tool === 'axe' ? '#b98450' : '#9aa0a6' });
      if (hp <= 0) this.killNode(d.id, nd); else this.nodeHp.set(d.id, hp);
    } else if (d.k === 'a') {
      if (now - (p.lastAtk || 0) < atkSpd(def?.tool) * 1000 - 120) return; p.lastAtk = now;       // each weapon has its own attack speed
      const a = this.animals.get(d.id); if (!a || !this.near(p, a, (def?.reach || 2.6) + 2)) return;
      const [dmg, sk] = this.dmgOf(p); this.hitAnimal(a, dmg, p, sk); this.wear(p);
    }
  }
  killNode(id, nd) { this.nodeHp.delete(id); this.dead.set(id, Date.now() + nd.respawn * 1000); this.io.to('game').emit('nd', [id, 0]); this.dirty = true; }
  onPick(p, d) {
    const node = this.nodes[d.id]; if (!node || this.dead.has(d.id) || !this.near(p, node, 5)) return;
    const nd = NODES[node.t]; if (!nd.pick) return;
    const bonus = Math.random() < this.lvl(p, nd.skill) * 0.03 ? 1 : 0;
    nd.drops.forEach(([id, a, b, ch], i) => { if (Math.random() < ch) this.give(p, id, ri(a, b) + (i === 0 ? bonus : 0)); });
    this.xp(p, nd.skill, nd.xp * 2); this.fx('hit', node.x, node.y + .4, node.z, { c: '#7dbb5a' });
    this.killNode(d.id, nd);
  }
  onDrink(p) {
    let wet = false; for (let a = 0; a < 6.28 && !wet; a += 0.78) for (const d of [2.5, 5]) if (heightAt(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d) < 0.15) wet = true;
    if (!wet && heightAt(p.x, p.z) > 0.3) return;
    p.thirst = Math.min(100, p.thirst + 35); p._vit = true;
    const it = this.held(p); if (it?.id === 'waterskin') { it.d = ITEMS.waterskin.dur; p._inv = true; this.toast(p, 'Waterskin filled'); }
    return { ok: 1 };
  }
  onFish(p, d) {
    const it = this.held(p); if (it?.id !== 'fishing_rod' || p.fishing) return;
    if (typeof d.x !== 'number' || Math.hypot(d.x - p.x, d.z - p.z) > 9 || heightAt(d.x, d.z) > -0.1) return { err: 'Cast into deeper water' };
    p.fishing = { at: Date.now() + (4500 + Math.random() * 5000) * (1 - 0.015 * this.lvl(p, 'fishing')), x: p.x, z: p.z };
    return { ok: 1 };
  }

  // ---------- animals ----------
  spawnAnimal(t, anywhere) {
    const d = ANIMALS[t];
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() * 2 - 1) * (EDGE - 20), z = (Math.random() * 2 - 1) * (EDGE - 20);
      const zone = zoneAt(x, z); if (!d.biomes.includes(biomeAt(x, z, zone))) continue;
      const L = zone.lo + Math.floor(Math.random() * (zone.hi - zone.lo + 1)); if (L < (d.minL || 1) || distSpawn(x, z) < 12) continue;      // level comes from the zone it lives in
      if (!anywhere) { let close = false; for (const p of this.players.values()) if (Math.hypot(p.x - x, p.z - z) < 45) close = true; if (close) continue; }
      const max = Math.round(d.hp * (1 + .6 * (L - 1)));
      const a = { id: this.nextId++, t, x, z, y: heightAt(x, z), L, hp: max, max, ang: Math.random() * 6.28, spd: 0, tw: Math.random() * 4, target: null, until: 0, atk: 0 };
      this.animals.set(a.id, a); this.dirty = true;
      if (!anywhere) this.io.to('game').emit('a+', this.apub(a));
      return;
    }
  }
  isNight() { return this.time < 0.22 || this.time > 0.79; }
  nearFire(p) { for (const s of this.structs.values()) if ((s.t === 'campfire' || s.t === 'torch_post') && Math.hypot(s.x - p.x, s.z - p.z) < 12) return true; return false; }
  hitAnimal(a, dmg, p, sk = 'melee') {
    const d = ANIMALS[a.t], now = Date.now(); dmg *= lvlMods(a.L - this.plvl(p)).youHit; a.hp -= dmg;
    this.fx('hit', a.x, a.y + .6, a.z, { c: '#c0392b' });
    if (!(a.taunt > now)) { a.target = p.id; a.until = now + 14000; }
    const grey = a.L < this.plvl(p) - 2 ? .1 : 1;          // far weaker monsters teach almost nothing
    this.xp(p, sk, (1 + a.L * .5) * grey);
    if (a.hp > 0) { this.io.to('game').emit('ah', [a.id, Math.round(100 * a.hp / a.max)]); return; }      // not volatile: it is sent in the same instant as the hit sparks, and a second volatile message gets dropped
    this.animals.delete(a.id); this.io.to('game').emit('a-', a.id);
    const lv = this.lvl(p, 'hunting'), more = Math.floor((a.L - 1) / 3);
    for (const [id, lo, hi, ch] of d.drops) if (Math.random() < ch) this.give(p, id, ri(lo, hi) + more + (Math.random() < lv * 0.03 ? 1 : 0));
    this.loot(a, p);
    const xp = d.xp * (1 + .3 * (a.L - 1)) * grey, pt = this.partyOf(p);
    for (const o of pt ? pt.m.map(i => this.players.get(i)).filter(o => o && this.near(p, o, 45)) : [p]) {      // party members nearby all learn from the kill
      this.xp(o, o === p ? sk : this.dmgOf(o)[1], xp * .5); this.xp(o, 'hunting', xp * .5); if (o !== p) this.flush(o);
    }
    this.flush(p);
  }
  onShoot(p, d) {
    const it = this.held(p); if (ITEMS[it?.id]?.tool !== 'bow') return;
    const now = Date.now(); if (now - p.lastSwing < atkSpd('bow') * 1000 - 120) return; p.lastSwing = now;
    let mul = 1; if (d.ab && now >= (p.cd.bow || 0)) { mul = 2.5; p.cd.bow = now + 8000; }          // Aimed Shot
    if (this.count(p, 'arrow') < 1) return this.toast(p, 'No arrows! Craft some at a workbench.', 'bad');
    const len = Math.hypot(d.dx, d.dy, d.dz); if (!(len > 0.5 && len < 1.5)) return;
    this.take(p, 'arrow', 1); this.wear(p);
    const dx = d.dx / len, dy = d.dy / len, dz = d.dz / len, ox = p.x, oy = p.y + 1.4, oz = p.z;
    let dist = 60, hit = null;
    outer: for (let t = 1; t < 60; t += 0.5) {
      const x = ox + dx * t, y = oy + dy * t - 0.0015 * t * t, z = oz + dz * t;
      if (y < heightAt(x, z)) { dist = t; break; }
      for (const a of this.animals.values()) if (Math.hypot(a.x - x, a.y + .6 - y, a.z - z) < 1.1) { hit = a; dist = t; break outer; }
    }
    this.io.to('game').volatile.emit('arrow', { o: [r2(ox), r2(oy), r2(oz)], d: [dx, dy, dz], len: dist });
    if (hit) { const [dmg, sk] = this.dmgOf(p); this.hitAnimal(hit, dmg * mul, p, sk); }
  }
  tickAnimals(dt) {
    const now = Date.now(), night = this.isNight(), P = [...this.players.values()];
    for (const a of this.animals.values()) {
      const d = ANIMALS[a.t];
      let np = null, nd = 1e9; for (const p of P) { const q = Math.hypot(p.x - a.x, p.z - a.z); if (q < nd) { nd = q; np = p; } }
      let tgt = a.target && now < a.until ? this.players.get(a.target) : null; if (!tgt) a.target = null;
      let mode = 'wander';
      if (d.mode === 'flee') { if (tgt || (np && nd < d.sense * (np.a === 3 ? 0.45 : 1))) { mode = 'flee'; tgt = tgt || np; } }
      else if (d.mode === 'defend') { if (tgt) mode = 'chase'; }
      else if (d.mode === 'hunt') {
        if (tgt) mode = 'chase';
        // hunts at night anywhere, and by day in the wilder zones; ignores players far above its level and anyone by a fire
        else if (!PEACEFUL && (night || a.L >= 4) && np && nd < d.sense * (np.a === 3 ? .6 : 1) && a.L >= this.plvl(np) - 2 && !this.nearFire(np)) { tgt = np; mode = 'chase'; }
      }
      if (mode === 'flee') { a.ang = Math.atan2(a.x - tgt.x, a.z - tgt.z) + Math.sin(now / 400 + a.id) * 0.5; a.spd = d.run; }
      else if (mode === 'chase') {
        const q = Math.hypot(tgt.x - a.x, tgt.z - a.z);
        if (q > 45 || (d.mode === 'hunt' && this.nearFire(tgt) && !a.target)) { a.target = null; a.spd = 0; }
        else { a.ang = Math.atan2(tgt.x - a.x, tgt.z - a.z); a.spd = q > 1.5 ? d.run : 0;
          if (q < 2 && now > a.atk) { a.atk = now + 1400; this.hurt(tgt, d.dmg * (1 + .3 * (a.L - 1)) * lvlMods(a.L - this.plvl(tgt)).itHits, `A level ${a.L} ${d.n.toLowerCase()} got you.`); this.flush(tgt); } }
      } else {
        a.tw -= dt; if (a.tw <= 0) { a.tw = 2 + Math.random() * 5; if (Math.random() < 0.5) a.spd = 0; else { a.spd = d.walk; a.ang = Math.random() * 6.28; } }
      }
      if (a.spd > 0) {
        const nx = a.x + Math.sin(a.ang) * a.spd * dt, nz = a.z + Math.cos(a.ang) * a.spd * dt;
        if (heightAt(nx, nz) < 0.4 || Math.abs(nx) > EDGE || Math.abs(nz) > EDGE) { a.ang += 2 + Math.random(); if (mode === 'wander') a.tw = 1.5; }
        else { a.x = nx; a.z = nz; a.y = heightAt(nx, nz); }
      }
    }
  }
  tick() {
    const dt = 0.1, now = Date.now();
    this.time = (this.time + dt / DAY) % 1;
    this.tickAnimals(dt);
    for (const p of this.players.values()) if (p.fishing) {
      if (Math.hypot(p.x - p.fishing.x, p.z - p.fishing.z) > 1.5 || this.held(p)?.id !== 'fishing_rod') { p.fishing = null; p.socket.emit('fished', { ok: 0 }); }
      else if (now > p.fishing.at) { p.fishing = null; this.give(p, 'raw_fish', 1 + (Math.random() < this.lvl(p, 'fishing') * 0.03 ? 1 : 0)); this.xp(p, 'fishing', 14); this.wear(p); p.socket.emit('fished', { ok: 1 }); this.flush(p); }
    }
    if (!this.players.size) return;
    // each player only hears about animals within 220 m: the land is big and far ones are hidden in the fog anyway
    const P = [...this.players.values()].map(p => [p.id, r2(p.x), r2(p.y), r2(p.z), p.r, p.a, this.held(p)?.id || 0]);
    const A = [...this.animals.values()].map(a => [a.id, r2(a.x), r2(a.y), r2(a.z), r2(a.ang), a.spd > 3 ? 2 : a.spd > 0 ? 1 : 0]);
    for (const p of this.players.values()) p.socket.volatile.emit('s', { t: this.time, p: P, a: A.filter(a => Math.abs(a[1] - p.x) < 220 && Math.abs(a[3] - p.z) < 220) });
  }

  // ---------- items ----------
  onUseItem(p, d) {
    const s = d.slot | 0, it = p.inv[s]; if (!it) return; const def = ITEMS[it.id], max = this.maxHp(p);
    if (def.food) {
      const m = def.cooked ? 1 + 0.02 * (this.lvl(p, 'cooking') - 1) : 1;
      if (it.id === 'raw_meat' || it.id === 'raw_fish') this.toast(p, 'Yuck! Cook it on a campfire for a much better meal.');
      p.hunger = Math.min(100, p.hunger + def.food.h * m); p.thirst = Math.min(100, p.thirst + def.food.t * m); p.hp = Math.min(max, p.hp + def.food.hp);
      if (def.buff) { p.buff = { id: it.id, until: Date.now() + def.buff.t * 1000 }; p._misc = true; }
      it.n--; if (it.n <= 0) p.inv[s] = null; p._inv = p._vit = true; return { ok: 'eat' };
    }
    if (def.heal) { if (p.hp >= max) return; p.hp = Math.min(max, p.hp + def.heal); it.n--; if (it.n <= 0) p.inv[s] = null; p._inv = p._vit = true; return { ok: 'eat' }; }
    if (def.learn) {
      if (p.known[def.learn]) return this.toast(p, 'You already know that recipe — trade the scroll to a friend');
      p.known[def.learn] = 1; p.inv[s] = null; p._inv = p._misc = true; this.toast(p, `Learned: ${ITEMS[RECIPES.find(r => r.id === def.learn).out].n}`, 'good'); return { ok: 'equip' };
    }
    if (def.slot) {          // wear armor or a bag; whatever was in that slot comes back to the same bag slot
      const prev = p.equip[def.slot] || null;
      if (def.slot === 'bag') {
        const size = INV + def.bag; if (p.inv.slice(size).some((x, i) => x && i + size !== s)) return this.toast(p, 'Empty the extra bag slots first', 'bad');
        p.equip.bag = it; p.inv[s] = null; while (p.inv.length < size) p.inv.push(null); p.inv.length = size; const j = p.inv.findIndex(x => !x); if (prev) { if (j < 0) { p.equip.bag = prev; p.inv[s] = it; return; } p.inv[j] = prev; }
      } else { p.equip[def.slot] = it; p.inv[s] = prev; }
      p._inv = p._vit = true; this.io.to('game').emit('pu', this.pub(p)); return { ok: 'equip' };
    }
    if (it.id === 'waterskin') { if (it.d <= 0) return this.toast(p, 'It is empty — fill it at water or a well (E).'); it.d--; p.thirst = Math.min(100, p.thirst + 30); p._inv = p._vit = true; return { ok: 'eat' }; }
  }
  cont(p, c) { if (!c) return p.inv; const s = this.structs.get(p.chest); return s && this.near(p, s, 8) && this.canUse(p, s) ? this.inv(s) : null; }
  onInvMove(p, d) {
    if (!Array.isArray(d.f) || !Array.isArray(d.t)) return;
    if (d.f[0] === 2) {           // take off armor or a bag (f[1] is the slot name)
      const k = String(d.f[1]), it = p.equip[k], j = d.t[1] | 0; if (!it || !['head', 'chest', 'legs', 'bag'].includes(k) || d.t[0] !== 0 || j < 0 || j >= p.inv.length || p.inv[j]) return;
      if (k === 'bag') { if (j >= INV || p.inv.slice(INV).some(Boolean)) return this.toast(p, 'Empty the extra bag slots first', 'bad'); p.inv.length = INV; }
      p.inv[j] = it; p.equip[k] = null; p._inv = p._vit = true; this.io.to('game').emit('pu', this.pub(p)); return;
    }
    const A = this.cont(p, d.f[0]), B = this.cont(p, d.t[0]); if (!A || !B) return;
    const i = d.f[1] | 0, j = d.t[1] | 0; if (i < 0 || j < 0 || i >= A.length || j >= B.length || (A === B && i === j)) return;
    const a = A[i], b = B[j]; if (!a) return;
    if (b && b.id === a.id && stk(a) && stk(b)) { const k = Math.min(a.n, STACK - b.n); b.n += k; a.n -= k; if (a.n <= 0) A[i] = null; }
    else { A[i] = b || null; B[j] = a; }
    p._inv = true;
    if (d.f[0] || d.t[0]) { this.dirty = true; this.sendChest(p.chest); }
  }
  sendChest(id) { const s = this.structs.get(id); if (!s) return; for (const o of this.players.values()) if (o.chest === id) o.socket.emit('chest', { id, t: s.t, tier: s.d.tier || 1, inv: this.inv(s) }); }
  onTrash(p, d) { const s = d.slot | 0; if (p.inv[s]) { p.inv[s] = null; p._inv = true; } }

  // ---------- crafting ----------
  stationsNear(p) { const out = {}; for (const s of this.structs.values()) { const st = STRUCTS[s.t]?.station; if (st && this.near(p, s, 7)) out[st] = Math.max(out[st] || 0, s.d.tier || 1); } return out; }      // station -> best tier in reach
  onCraft(p, d) {
    const rc = RECIPES.find(r => r.id === d.id); if (!rc) return;
    const n = Math.max(1, Math.min(20, d.n | 0)), tier = this.stationsNear(p)[rc.station] || 0;
    if (rc.learn && !p.known[rc.id]) return this.toast(p, 'You have not learned that recipe yet — monsters in the wilder zones drop the scroll', 'bad');
    if (this.lvl(p, rc.sk) < rc.lvl) return this.toast(p, `Needs ${SKILLS[rc.sk].n} level ${rc.lvl}`, 'bad');
    if (rc.station && !tier) return this.toast(p, `Stand near a ${STATION_NAMES[rc.station]}`, 'bad');
    if (rc.station && tier < (rc.tier || 1)) return this.toast(p, `Needs a tier ${rc.tier} ${STATION_NAMES[rc.station]} — upgrade it from its storage`, 'bad');
    const boxes = this.boxes(p), srcs = [p.inv, ...boxes.map(s => s.d.inv)];        // ingredients come from your bag, then nearby chests and stations
    let made = 0;
    for (let i = 0; i < n; i++) {
      if (Object.entries(rc.in).some(([k, c]) => this.countIn(srcs, k) < c)) break;
      for (const k in rc.in) this.takeFrom(srcs, k, rc.in[k]);
      p._inv = true; this.give(p, rc.out, rc.n, 1 + 0.02 * (this.lvl(p, 'crafting') - 1)); this.xp(p, rc.sk, rc.xp); made++;
    }
    if (!made) return this.toast(p, `${ITEMS[rc.out].n} needs ` + Object.entries(rc.in).filter(([k, c]) => this.countIn(srcs, k) < c).map(([k, c]) => `${c - this.countIn(srcs, k)} more ${ITEMS[k].n}`).join(' and '), 'bad');
    if (boxes.length) { this.dirty = true; for (const s of boxes) this.sendChest(s.id); }
    this.quest(p, 'craft:' + rc.out);
    if (ITEMS[rc.out].tier === 'iron') this.quest(p, 'craft:iron');
    if (rc.sk === 'cooking') this.quest(p, 'cook');
    return { ok: made, ...this.onStock(p) };
  }

  // ---------- building ----------
  canUse(p, s) {          // the owner decides who else may use their doors, chests and stations (default: clan-mates)
    if (s.o === p.id) return true; const lv = this.perms[s.o] || 'clan';
    if (lv === 'all') return true; if (lv === 'me') return false;
    if (p.clan && this.clanOf(s.o) === p.clan) return true;
    return lv === 'party' && !!p.party && this.players.get(s.o)?.party === p.party;
  }
  onPlace(p, d) {
    const def = STRUCTS[d.t]; if (!def) return;
    if ([d.x, d.y, d.z].some(v => typeof v !== 'number' || !isFinite(v))) return;
    const x = r2(d.x), y = r2(d.y), z = r2(d.z), r = (d.r | 0) & 3;
    if (Math.hypot(x - p.x, z - p.z) > 45 || Math.abs(y - heightAt(x, z)) > 24 || Math.abs(x) > EDGE || Math.abs(z) > EDGE) return { err: 'Too far away' };
    if (heightAt(x, z) < 0.2 && def.kind !== 'foundation') { /* building over water needs a foundation under it */ if (y < 0.5) return { err: 'Too wet here — put a foundation down first' }; }
    if (this.lvl(p, 'building') < def.lvl) return { err: `Needs Building level ${def.lvl}` };
    if (def.needs ? !this.count(p, def.needs) : (!def.free && !this.count(p, 'hammer'))) return { err: def.needs ? 'You need a Hoe for that' : 'You need a Building Hammer (craft one with C)' };
    if (def.clan && !p.clan) return { err: 'Join or create a clan first (G)' };
    if (!this.hasAll(p, def.cost)) return { err: `${def.n} needs ` + this.missing(p, def.cost) };
    for (const s of this.structs.values()) {
      const sd = STRUCTS[s.t]; if (Math.abs(s.x - x) > 0.3 || Math.abs(s.z - z) > 0.3 || Math.abs(s.y - y) > 0.5) continue;
      if (sd.kind === def.kind && (def.kind !== 'wall' || s.r === r)) return { err: 'Something is already built there' };
    }
    for (const k in def.cost) this.take(p, k, def.cost[k]);
    const s = { id: this.nextId++, t: d.t, x, y, z, r, o: p.id, on: p.name, d: {} };
    if (def.gable && Number.isInteger(d.v) && d.v >= 0 && d.v <= 14) s.v = d.v;          // gable shape: sloped left, sloped right, or peak
    this.structs.set(s.id, s); this.dirty = true; this.inv(s); this.clearNodes(s);
    this.io.to('game').emit('st+', this.spub(s));
    this.xp(p, 'building', 6 + Object.values(def.cost).reduce((a, b) => a + b, 0));
    this.quest(p, 'build:' + d.t); if (def.kind === 'roof' || def.kind === 'slope') this.quest(p, 'build:roof');
    return { ok: 1 };
  }
  onDemolish(p, d) {
    const s = this.structs.get(d.id); if (!s || !this.near(p, s, 50)) return;        // build mode can reach as far as the flying camera
    if (!this.canUse(p, s)) return this.toast(p, `That belongs to ${s.on}`, 'bad');
    if (s.d.inv?.some(Boolean)) return this.toast(p, 'Take everything out of its storage first', 'bad');
    if (STRUCTS[s.t].kind === 'foundation') for (const o of this.structs.values()) { const k = STRUCTS[o.t].kind; if (o !== s && (k === 'stairs' || k === 'floor' || k === 'roof' || k === 'slope') && Math.abs(o.x - s.x) < .3 && Math.abs(o.z - s.z) < .3) return this.toast(p, `Take the ${STRUCTS[o.t].n} off this foundation first`, 'bad'); }
    this.structs.delete(s.id); this.dirty = true; this.io.to('game').emit('st-', s.id);
    const cost = STRUCTS[s.t].cost; for (const k in cost) this.give(p, k, Math.floor(cost[k] / 2));
  }
  onStructUse(p, d) {
    const s = this.structs.get(d.id); if (!s || !this.near(p, s, 6)) return;
    const def = STRUCTS[s.t], upd = () => { this.dirty = true; this.io.to('game').emit('st~', { id: s.id, d: this.pd(s) }); };
    if (def.door) { if (!this.canUse(p, s)) return this.toast(p, `This door is locked. It belongs to ${s.on}.`, 'bad'); s.d.open = !s.d.open; return upd(); }
    if (s.t === 'well') { p.thirst = Math.min(100, p.thirst + 40); p._vit = true; const it = this.held(p); if (it?.id === 'waterskin') { it.d = ITEMS.waterskin.dur; p._inv = true; this.toast(p, 'Waterskin filled'); } return { ok: 'drink' }; }
    if (!this.canUse(p, s)) return def.station ? null : this.toast(p, `That belongs to ${s.on}. Join their clan to share!`, 'bad');
    if (this.inv(s)) { p.chest = s.id; this.sendChest(s.id); return; }        // chests and crafting stations hold items
    if (s.t === 'bed' || s.t === 'clan_banner') { p.spawn = { id: s.id, x: s.x, z: s.z }; return this.toast(p, 'Home set! You will wake up here.', 'good'); }
    if (s.t === 'farm_plot') {
      const it = this.held(p), now = Date.now(), fl = this.lvl(p, 'farming');
      if (s.d.crop) {
        const c = CROPS[s.d.crop];
        if (now >= s.d.ready) {
          const n = ri(c.min, c.max) + Math.floor(fl / 8) + (Math.random() < fl * 0.04 ? 1 : 0);
          this.give(p, c.out, n); this.give(p, c.seed, ri(1, 2)); this.xp(p, 'farming', 22); s.d = {}; upd(); this.quest(p, 'harvest'); return { ok: 'harvest' };
        }
        if (it?.id === 'waterskin' && it.d > 0 && !s.d.w) { it.d--; p._inv = true; s.d.w = 1; s.d.ready = now + (s.d.ready - now) * 0.6; this.xp(p, 'farming', 6); upd(); return { ok: 'water' }; }
        return this.toast(p, `${c.n}: ready in ${Math.ceil((s.d.ready - now) / 1000)}s${s.d.w ? '' : ' — water it with a full waterskin to speed it up'}`);
      }
      const seed = it && ITEMS[it.id].seed;
      if (!seed) return this.toast(p, 'Hold seeds in your hand (hotbar) to plant here');
      it.n--; if (it.n <= 0) p.inv[p.sel] = null; p._inv = true;
      s.d = { crop: seed, t0: now, ready: now + CROPS[seed].grow * 1000 / (1 + 0.02 * (fl - 1)) };
      this.xp(p, 'farming', 8); upd(); this.quest(p, 'plant'); return { ok: 'plant' };
    }
  }

  // ---------- chat & clans ----------
  onChat(p, d) {
    const m = String(d.m || '').slice(0, 160).trim(); if (!m) return;
    if (d.ch === 'party') { const pt = this.partyOf(p); if (!pt) return this.toast(p, 'You are not in a party'); for (const i of pt.m) this.players.get(i)?.socket.emit('chat', { ch: 'party', n: p.name, m }); }
    else if (d.ch === 'clan') { if (!p.clan) return this.toast(p, 'You are not in a clan'); for (const o of this.players.values()) if (o.clan === p.clan) o.socket.emit('chat', { ch: 'clan', n: p.name, m }); }
    else this.io.to('game').emit('chat', { ch: 'all', n: p.name, m, tag: this.clans[p.clan]?.tag });
  }
  clanOf(pid) { for (const id in this.clans) if (this.clans[id].members[pid]) return id; return null; }
  clanView(p) {
    const c = this.clans[p.clan];
    const invites = Object.values(this.clans).filter(k => k.invites?.[p.id]).map(k => ({ id: k.id, name: k.name, tag: k.tag }));
    if (!c) return { clan: null, invites };
    return { invites, clan: { id: c.id, name: c.name, tag: c.tag, color: c.color, motd: c.motd || '', xp: Math.floor(c.xp || 0), leader: c.leader,
      members: Object.entries(c.members).map(([id, m]) => ({ id, name: m.name, role: m.role, on: this.players.has(id) })),
      invited: Object.keys(c.invites || {}) } };
  }
  refreshClan(cid, extra = []) {
    for (const p of this.players.values()) if ((cid && p.clan === cid) || extra.includes(p.id)) { p.socket.emit('clan', this.clanView(p)); this.io.to('game').emit('pu', this.pub(p)); }
  }
  onClan(p, d) {
    const c = this.clans[p.clan], me = c?.members[p.id], boss = me && (me.role === 'leader' || me.role === 'officer');
    const done = (cid, extra) => { this.clanDirty = true; this.refreshClan(cid, extra); for (const s of this.structs.values()) if (extra?.includes(s.o) || this.clanOf(s.o) === cid) this.io.to('game').emit('st~', { id: s.id, c: this.clanOf(s.o), cc: this.clans[this.clanOf(s.o)]?.color || '' }); };
    switch (d.op) {
      case 'create': {
        if (c) return { err: 'Leave your clan first' };
        const name = String(d.name || '').trim().slice(0, 20), tag = String(d.tag || '').trim().toUpperCase().slice(0, 4);
        if (name.length < 3 || !/^[A-Z0-9]{2,4}$/.test(tag)) return { err: 'Name needs 3+ letters, tag 2-4 letters' };
        if (Object.values(this.clans).some(k => k.name.toLowerCase() === name.toLowerCase() || k.tag === tag)) return { err: 'That name or tag is taken' };
        const id = 'c' + Date.now().toString(36);
        this.clans[id] = { id, name, tag, color: clr(d.color, '#e0a030'), leader: p.id, members: { [p.id]: { name: p.name, role: 'leader' } }, invites: {}, xp: 0, motd: '' };
        p.clan = id; this.quest(p, 'clan'); this.sys(`${p.name} founded the clan ${name} [${tag}]`); done(id, [p.id]); return { ok: 1 };
      }
      case 'invite': {
        if (!boss) return { err: 'Only leaders and officers can invite' };
        const pid = String(d.name || '').trim().toLowerCase(); if (!/^[a-z0-9_]{2,14}$/.test(pid)) return { err: 'Type their player name' };
        if (this.clanOf(pid)) return { err: 'They are already in a clan' };
        c.invites[pid] = true; const o = this.players.get(pid); if (o) this.toast(o, `${p.name} invited you to ${c.name}! Press G`, 'good');
        done(c.id, [pid]); return { ok: 1, msg: o ? 'Invite sent' : 'Invite saved — they will see it when they log in' };
      }
      case 'accept': {
        const k = this.clans[d.id]; if (!k?.invites?.[p.id] || c) return { err: 'Invite not found' };
        delete k.invites[p.id]; k.members[p.id] = { name: p.name, role: 'member' }; p.clan = k.id;
        this.quest(p, 'clan'); this.sys(`${p.name} joined ${k.name}`); done(k.id, [p.id]); return { ok: 1 };
      }
      case 'decline': { const k = this.clans[d.id]; if (k?.invites) delete k.invites[p.id]; done(null, [p.id]); return { ok: 1 }; }
      case 'leave': {
        if (!c) return;
        if (c.leader === p.id) {
          const others = Object.keys(c.members).filter(i => i !== p.id);
          if (!others.length) { delete this.clans[c.id]; p.clan = null; this.sys(`Clan ${c.name} disbanded`); done(null, [p.id]); return { ok: 1 }; }
          const next = others.find(i => c.members[i].role === 'officer') || others[0]; c.leader = next; c.members[next].role = 'leader';
        }
        delete c.members[p.id]; p.clan = null; done(c.id, [p.id]); return { ok: 1 };
      }
      case 'kick': {
        if (!boss || !c.members[d.pid] || d.pid === c.leader || d.pid === p.id) return { err: 'Cannot remove them' };
        if (c.members[d.pid].role === 'officer' && me.role !== 'leader') return { err: 'Only the leader can remove officers' };
        delete c.members[d.pid]; const o = this.players.get(d.pid); if (o) { o.clan = null; this.toast(o, `You were removed from ${c.name}`); }
        done(c.id, [d.pid]); return { ok: 1 };
      }
      case 'role': {
        if (me?.role !== 'leader' || !c.members[d.pid] || d.pid === p.id) return { err: 'Only the leader can do that' };
        if (d.role === 'leader') { c.members[p.id].role = 'officer'; c.members[d.pid].role = 'leader'; c.leader = d.pid; }
        else c.members[d.pid].role = d.role === 'officer' ? 'officer' : 'member';
        done(c.id); return { ok: 1 };
      }
      case 'motd': { if (!boss) return; c.motd = String(d.text || '').slice(0, 120); done(c.id); return { ok: 1 }; }
      case 'uninvite': { if (!boss) return; delete c.invites[d.pid]; done(c.id, [d.pid]); return { ok: 1 }; }
    }
  }
}
function clr(v, def) { return /^#[0-9a-fA-F]{6}$/.test(v) ? v : def; }
install(Game);
