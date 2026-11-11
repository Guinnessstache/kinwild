// Classes, gear, containers, parties, trading, voice signalling and other systems, mixed into Game.
import { ITEMS, STRUCTS, ANIMALS, SCROLLS, UPGRADE, ABIL_CD, WSKILL, COST, ABIL_COST, calcStats, combatLevel, gearSt } from '../shared/data.js';
import { heightAt, zoneAt, SPAWN } from '../shared/terrain.js';

const STACK = 99, HOUR = 3600000;
const r2 = v => Math.round(v * 100) / 100;
export const stk = it => it.d == null && !it.st && !ITEMS[it.id].slot;          // can this item share a stack?
const rank = d => d.gear || d.slot ? 0 : d.tool ? 1 : d.food ? 2 : d.seed ? 3 : d.learn ? 4 : 5;
export const distSpawn = (x, z) => Math.hypot(x - SPAWN.x, z - SPAWN.z);

const methods = {
  // ---------- stats & gear ----------
  stats(p) { return calcStats(p.equip, p.skills, p.buff, this.held(p)); },
  maxHp(p) { return this.stats(p).hp; },
  plvl(p) { return combatLevel(p.skills); },
  invSize(p) { return 32 + (ITEMS[p.equip.bag?.id]?.bag || 0); },
  // Crafted and looted gear gets a random quality and stats. Crafting level (or a tough monster) nudges the roll up.
  roll(id, luck = 0, durMul = 1) {
    const def = ITEMS[id], r = Math.random() - luck, q = r < .04 ? 3 : r < .17 ? 2 : r < .45 ? 1 : 0, qm = [1, 1.15, 1.3, 1.5][q], st = {};
    // base stats swing from -22% to +28%, and a roll can add bonus stats (one per quality step, plus a coin-flip extra)
    for (const k in def.base) { const v = def.base[k] * qm * (.78 + Math.random() * .5); st[k] = k === 'dmg' ? Math.round(v * 10) / 10 : Math.max(1, Math.round(v)); }
    const pool = def.slot ? ['hp', 'pow', 'mend', 'arm', 'mreg', 'ereg'] : ['hp', 'pow', 'mend', 'mreg', 'ereg'], amt = { hp: 6, pow: 3, mend: 3, arm: 2, mreg: 10, ereg: 10 }, tm = def.tr === 2 ? 1.6 : 1;
    for (let i = 0; i < q + (Math.random() < .5 ? 1 : 0); i++) { const k = pool[Math.floor(Math.random() * pool.length)]; st[k] = (st[k] || 0) + Math.max(1, Math.round(amt[k] * tm * (.7 + Math.random() * .6))); }
    const it = { id, n: 1, q, st }; if (def.dur) it.d = Math.round(def.dur * durMul * qm); return it;
  },
  spend(p, kind, n) {        // pay mana or energy; false (with a gentle reminder) when there is not enough
    if (p[kind] >= n) { p[kind] -= n; p._vit = true; this.flush(p); return true; }
    const now = Date.now(); if (now - (p._lowT || 0) > 2500) { p._lowT = now; this.toast(p, kind === 'mp' ? 'Not enough mana 🔮 — wait a moment or drink a Mana Potion' : 'Not enough energy ⚡ — wait a moment or drink an Energy Tonic', 'bad'); }
    return false;
  },
  fixGear(list) {          // gear made before stats were random has none: roll it now (keeping its wear)
    for (const it of list) if (it && ITEMS[it.id]?.gear && !it.st) { const r = this.roll(it.id); it.q = r.q; it.st = r.st; if (it.d == null && r.d != null) it.d = r.d; }
  },
  dmgOf(p) {       // [damage, skill] for the held item
    const it = this.held(p), def = it ? ITEMS[it.id] : null, sk = WSKILL[def?.tool] || 'melee';
    return [(gearSt(it).dmg ?? def?.dmg ?? 1) * (1 + .05 * (this.lvl(p, sk) - 1)) * (1 + this.stats(p).pow / 100), sk];
  },
  heal(p, o, base) {
    const amt = base * (1 + this.stats(p).mend / 100) * (1 + .05 * (this.lvl(p, 'healing') - 1)), max = this.maxHp(o), before = o.hp;
    o.hp = Math.min(max, o.hp + amt); o._vit = true; const got = o.hp - before;
    if (got > 0) { this.xp(p, 'healing', got * .5); this.fx('heal', o.x, o.y + 1, o.z); if (o !== p) this.flush(o); }
    return got;
  },

  // ---------- containers ----------
  inv(s) {
    const d = STRUCTS[s.t], n = d.store ? d.store + 5 * ((s.d.tier || 1) - 1) : s.t === 'chest' ? 16 : 0; if (!n) return null;
    s.d.inv ||= []; while (s.d.inv.length < n) s.d.inv.push(null); return s.d.inv;
  },
  pd(s) { return s.d.inv ? { ...s.d, inv: undefined } : s.d; },                    // struct data safe to broadcast (no contents)
  boxes(p, r = 8) { const out = []; for (const s of this.structs.values()) if (this.near(p, s, r) && this.inv(s) && this.canUse(p, s)) out.push(s); return out; },
  countIn(srcs, id) { let n = 0; for (const a of srcs) for (const it of a) if (it && it.id === id) n += it.n; return n; },
  takeFrom(srcs, id, n) { for (const a of srcs) for (let i = 0; i < a.length && n > 0; i++) { const it = a[i]; if (it && it.id === id) { const k = Math.min(n, it.n); it.n -= k; n -= k; if (it.n <= 0) a[i] = null; } } },
  put(arr, it, from = 0) {         // add to an inventory array, stacking where possible; returns how many did not fit
    if (stk(it)) for (let i = from; i < arr.length && it.n > 0; i++) { const b = arr[i]; if (b && b.id === it.id && stk(b) && b.n < STACK) { const k = Math.min(it.n, STACK - b.n); b.n += k; it.n -= k; } }
    if (it.n > 0) { let j = -1; for (let i = from; i < arr.length; i++) if (!arr[i]) { j = i; break; } if (j >= 0) { arr[j] = { ...it }; it.n = 0; } }
    return it.n;
  },
  onStock(p) { const stock = {}; for (const s of this.boxes(p)) for (const it of s.d.inv) if (it) stock[it.id] = (stock[it.id] || 0) + it.n; return { stock }; },
  onSort(p, d) {
    const arr = d.c ? this.cont(p, 1) : p.inv, from = d.c ? 0 : 8; if (!arr) return;
    const out = Array(200).fill(null);
    for (const it of arr.slice(from)) if (it) this.put(out, { ...it });
    const packed = out.filter(Boolean).sort((a, b) => rank(ITEMS[a.id]) - rank(ITEMS[b.id]) || ITEMS[a.id].n.localeCompare(ITEMS[b.id].n) || (b.q || 0) - (a.q || 0));
    for (let i = from; i < arr.length; i++) arr[i] = packed[i - from] || null;
    p._inv = true; if (d.c) { this.dirty = true; this.sendChest(p.chest); }
    return { ok: 1 };
  },
  onStackNear(p) {          // move bag items into chests that already hold the same kind
    const open = p.chest && this.cont(p, 1) ? [this.structs.get(p.chest)] : this.boxes(p).filter(s => s.t === 'chest'); let moved = 0;
    for (const s of open) {
      const have = new Set(s.d.inv.filter(Boolean).map(it => it.id));
      for (let i = 8; i < p.inv.length; i++) { const it = p.inv[i]; if (!it || !have.has(it.id)) continue; const n0 = it.n, left = this.put(s.d.inv, it); moved += n0 - left; if (left <= 0) p.inv[i] = null; }
      this.sendChest(s.id);
    }
    if (moved) { p._inv = true; this.dirty = true; }
    this.toast(p, moved ? `Stored ${moved} item${moved > 1 ? 's' : ''}` : open.length ? 'Nothing in your bag matches what is stored here' : 'No chest of yours nearby', moved ? 'good' : '');
    return { ok: moved };
  },
  onUpgrade(p) {
    const s = this.structs.get(p.chest); if (!s || !STRUCTS[s.t].store || !this.cont(p, 1)) return;
    const tier = s.d.tier || 1, cost = UPGRADE[tier + 1]; if (!cost) return { err: 'Already at the highest tier' };
    const srcs = [p.inv, ...this.boxes(p).map(b => b.d.inv)];
    for (const k in cost) if (this.countIn(srcs, k) < cost[k]) return { err: `Needs ${cost[k]} ${ITEMS[k].n}` };
    for (const k in cost) this.takeFrom(srcs, k, cost[k]);
    s.d.tier = tier + 1; this.inv(s); p._inv = true; this.dirty = true;
    this.io.to('game').emit('st~', { id: s.id, d: this.pd(s) }); this.sendChest(s.id);
    this.toast(p, `${STRUCTS[s.t].n} is now tier ${tier + 1}: +5 storage and better recipes`, 'good'); return { ok: 1 };
  },

  // ---------- abilities ----------
  onAbility(p, d) {
    const it = this.held(p), tool = ITEMS[it?.id]?.tool, cd = ABIL_CD[tool], now = Date.now(); if (!cd || tool === 'bow') return;
    if (now < (p.cd[tool] || 0)) return { err: 'Not ready yet' };
    if (tool === 'spear') { const a = this.animals.get(d.id); if (!a || !this.near(p, a, ITEMS[it.id].reach + 2)) return { err: 'No target in reach' }; }
    if (!this.spend(p, ...ABIL_COST[tool])) return;
    if (tool === 'sword') {          // Taunt: nearby monsters attack you, and you take half damage for a few seconds
      let n = 0; for (const a of this.animals.values()) if (ANIMALS[a.t].mode !== 'flee' && this.near(p, a, 11)) { a.target = p.id; a.until = a.taunt = now + 8000; n++; }
      p.guard = now + 6000; this.fx('taunt', p.x, p.y + 1, p.z);
    } else if (tool === 'spear') {    // Power Strike
      const a = this.animals.get(d.id); if (!a || !this.near(p, a, ITEMS[it.id].reach + 2)) return { err: 'No target in reach' };
      const [dmg, sk] = this.dmgOf(p); this.hitAnimal(a, dmg * 2.5, p, sk); this.wear(p);
    } else if (tool === 'staff') {    // Group Heal
      for (const o of this.players.values()) if (this.near(p, o, 12)) this.heal(p, o, 28);
    }
    p.cd[tool] = now + cd * 1000; p.socket.to('game').volatile.emit('sw', p.id);
    return { ok: 1 };
  },
  onHeal(p, d) {            // staff: heal the most hurt player nearby, or zap the targeted monster if nobody needs it
    const it = this.held(p); if (ITEMS[it?.id]?.tool !== 'staff') return;
    const now = Date.now(); if (now - p.lastSwing < 1300) return; p.lastSwing = now;
    p.socket.to('game').volatile.emit('sw', p.id);
    let best = null, br = .97; for (const o of this.players.values()) if (this.near(p, o, 14)) { const r = o.hp / this.maxHp(o); if (r < br) { br = r; best = o; } }
    if (best) { if (!this.spend(p, ...COST.heal)) return; this.heal(p, best, 14); this.wear(p); return { ok: 'heal', name: best === p ? null : best.name }; }
    const a = this.animals.get(d.id); if (!a || !this.near(p, a, 15)) return { ok: 'none' };
    if (!this.spend(p, ...COST.staff)) return;
    this.io.to('game').volatile.emit('bolt', { o: [r2(p.x), r2(p.y + 1.5), r2(p.z)], t: [r2(a.x), r2(a.y + .6), r2(a.z)] });
    const [dmg, sk] = this.dmgOf(p); this.hitAnimal(a, dmg, p, sk); this.wear(p); return { ok: 'bolt' };
  },
  onRecall(p) {
    const now = Date.now(); if (now < (p.recallAt || 0)) return { err: `Return Home is ready in ${Math.ceil((p.recallAt - now) / 60000)} min` };
    const home = p.spawn && this.structs.get(p.spawn.id) ? p.spawn : null, sp = home || SPAWN;
    p.x = sp.x + 1.5; p.z = sp.z + 1.5; p.y = heightAt(p.x, p.z) + .5; p.recallAt = now + HOUR / 2; p.fishing = null; p._misc = true;
    p.socket.emit('tp', { x: p.x, y: p.y, z: p.z, msg: home ? 'You return home.' : 'You have no bed yet, so you return to the starting meadow.', good: 1 });
    return { ok: 1 };
  },
  onPerm(p, d) { if (!['me', 'clan', 'party', 'all'].includes(d.v)) return; p.perm = this.perms[p.id] = d.v; this.permDirty = true; p._misc = true; return { ok: 1 }; },

  // ---------- world rules ----------
  covered(n) {             // is a resource node under something that was built?
    for (const s of this.structs.values()) { const k = STRUCTS[s.t].kind, dx = Math.abs(s.x - n.x), dz = Math.abs(s.z - n.z);
      if (k === 'foundation' || k === 'floor' || k === 'stairs' ? dx < 2.5 && dz < 2.5 : k === 'place' ? dx < 1.8 && dz < 1.8 : dx < 1 && dz < 1) return true; }
    return false;
  },
  clearNodes(s) {          // something was built: anything growing under it goes away and stays away
    const k = STRUCTS[s.t].kind, r = k === 'foundation' || k === 'floor' || k === 'stairs' ? 2.5 : k === 'place' ? 1.8 : 1;
    for (const n of this.nodes) if (!this.dead.has(n.id) && Math.abs(n.x - s.x) < r && Math.abs(n.z - s.z) < r) { this.nodeHp.delete(n.id); this.dead.set(n.id, Date.now() + 120000); this.io.to('game').emit('nd', [n.id, 0]); }
  },
  loot(a, p) {             // extra drops from levelled monsters: more materials, recipe scrolls and gear
    const d = ANIMALS[a.t]; if (d.mode !== 'hunt') return;
    if (a.L >= 4 && Math.random() < .05 + .012 * a.L) this.give(p, SCROLLS[Math.floor(Math.random() * SCROLLS.length)], 1);
    if (Math.random() < .04 + .012 * a.L) {
      const t2 = a.L >= 7 && Math.random() < .5, pool = Object.keys(ITEMS).filter(k => ITEMS[k].gear && (ITEMS[k].tr === 2) === t2 && k !== 'stone_spear');
      const it = this.roll(pool[Math.floor(Math.random() * pool.length)], .03 * a.L), j = p.inv.findIndex(x => !x);
      if (j >= 0) { p.inv[j] = it; p._inv = true; p.socket.emit('got', { id: it.id, n: 1, q: it.q }); }
    }
  },

  // ---------- parties ----------
  partyOf(p) { return p.party ? this.parties.get(p.party) : null; },
  partyView(p) {
    const pt = this.partyOf(p), from = p.pinv && this.players.get(p.pinv);
    return { inv: from ? { id: from.id, name: from.name } : null, party: pt ? { leader: pt.leader, m: pt.m.map(id => this.players.get(id)).filter(Boolean).map(o => ({ id: o.id, name: o.name, hp: Math.round(o.hp), max: this.maxHp(o), lv: this.plvl(o) })) } : null };
  },
  sendParty(ids) { for (const id of new Set(ids)) { const o = this.players.get(id); if (o) o.socket.emit('party', this.partyView(o)); } },
  leaveParty(p) {
    const pt = this.partyOf(p); if (!pt) return; pt.m = pt.m.filter(i => i !== p.id); p.party = null;
    if (pt.m.length < 2) { for (const i of pt.m) { const o = this.players.get(i); if (o) o.party = null; } this.parties.delete(pt.id); }
    else if (pt.leader === p.id) pt.leader = pt.m[0];
    this.sendParty([p.id, ...pt.m]);
  },
  onParty(p, d) {
    const pt = this.partyOf(p);
    switch (d.op) {
      case 'invite': {
        const o = this.players.get(d.pid); if (!o || o === p) return { err: 'They are not online' };
        if (o.party) return { err: `${o.name} is already in a party` };
        if (pt && pt.leader !== p.id) return { err: 'Only the party leader can invite' };
        if (pt && pt.m.length >= 5) return { err: 'The party is full (5)' };
        o.pinv = p.id; this.toast(o, `${p.name} invited you to a party — open Players (P) to join`, 'good'); this.sendParty([o.id]); return { ok: 1, msg: `Invited ${o.name}` };
      }
      case 'accept': {
        const from = this.players.get(p.pinv); p.pinv = null; if (!from || p.party) { this.sendParty([p.id]); return { err: 'That invite is no longer good' }; }
        let q = this.partyOf(from); if (!q) { q = { id: 'pt' + this.nextId++, leader: from.id, m: [from.id] }; this.parties.set(q.id, q); from.party = q.id; }
        if (q.m.length >= 5) return { err: 'The party is full' };
        q.m.push(p.id); p.party = q.id; this.sendParty(q.m); for (const i of q.m) { const o = this.players.get(i); if (o && o !== p) this.toast(o, `${p.name} joined the party`, 'good'); } return { ok: 1 };
      }
      case 'decline': p.pinv = null; this.sendParty([p.id]); return { ok: 1 };
      case 'leave': this.leaveParty(p); return { ok: 1 };
      case 'kick': { const o = this.players.get(d.pid); if (!pt || pt.leader !== p.id || !o || o.party !== pt.id || o === p) return; this.leaveParty(o); this.toast(o, 'You were removed from the party'); return { ok: 1 }; }
    }
  },
  onWho(p) {
    return { list: [...this.players.values()].map(o => ({ id: o.id, name: o.name, lv: this.plvl(o), w: ITEMS[this.held(o)?.id]?.tool || '', tag: this.clans[o.clan]?.tag || '', zn: zoneAt(o.x, o.z).name,
      party: o.party ? (o.party === p.party ? 2 : 1) : 0, voice: !!o.voice, near: this.near(p, o, 10) })) };
  },

  // ---------- trading ----------
  tradeView(p) {
    const t = p.trade, o = t && this.players.get(t.with); if (!o?.trade) return null;
    return { id: o.id, name: o.name, slots: t.offer, mine: t.offer.map(i => p.inv[i]), theirs: o.trade.offer.map(i => o.inv[i]), okMe: t.ok, okThem: o.trade.ok };
  },
  sendTrade(p) { const o = this.players.get(p.trade?.with); p.socket.emit('trade', this.tradeView(p)); if (o) o.socket.emit('trade', this.tradeView(o)); },
  endTrade(p, msg, kind = '') {
    const o = this.players.get(p.trade?.with); if (!p.trade) return; p.trade = null; p.socket.emit('trade', null);
    if (o) { o.trade = null; o.socket.emit('trade', null); if (msg) this.toast(o, msg, kind); }
  },
  tradeTouch(p) {          // a trader's bag changed: drop offers that are gone and make both sides confirm again
    const o = this.players.get(p.trade.with); if (!o?.trade) return this.endTrade(p);
    p.trade.offer = p.trade.offer.filter(i => p.inv[i]); p.trade.ok = o.trade.ok = false; this.sendTrade(p);
  },
  onTrade(p, d) {
    const t = p.trade, o = t && this.players.get(t.with);
    switch (d.op) {
      case 'ask': {
        const q = this.players.get(d.pid); if (!q || q === p) return { err: 'They are not online' };
        if (!this.near(p, q, 10)) return { err: `Stand next to ${q.name} to trade` };
        if (p.trade || q.trade) return { err: 'One of you is already trading' };
        q.task = p.id; q.socket.emit('tradeAsk', { id: p.id, name: p.name }); this.toast(q, `${p.name} wants to trade — open Players (P) to accept`, 'good'); return { ok: 1, msg: `Asked ${q.name} to trade` };
      }
      case 'accept': {
        const q = this.players.get(p.task); p.task = null; if (!q || q.trade || p.trade || !this.near(p, q, 12)) return { err: 'They are too far away or busy' };
        p.trade = { with: q.id, offer: [], ok: false }; q.trade = { with: p.id, offer: [], ok: false }; this.sendTrade(p); return { ok: 1 };
      }
      case 'decline': p.task = null; return { ok: 1 };
      case 'add': { const i = d.slot | 0; if (!t || !p.inv[i] || t.offer.includes(i) || t.offer.length >= 8) return; t.offer.push(i); t.ok = o.trade.ok = false; this.sendTrade(p); return { ok: 1 }; }
      case 'remove': { if (!t) return; t.offer.splice(d.i | 0, 1); t.ok = o.trade.ok = false; this.sendTrade(p); return { ok: 1 }; }
      case 'cancel': if (t) this.endTrade(p, `${p.name} cancelled the trade`); return { ok: 1 };
      case 'ok': {
        if (!t || !o?.trade) return; t.ok = true;
        if (!o.trade.ok) { this.sendTrade(p); return { ok: 1 }; }
        const mine = t.offer.map(i => p.inv[i]), theirs = o.trade.offer.map(i => o.inv[i]);
        const room = (q, out, inc) => q.inv.filter(x => !x).length + out.length >= inc.length;
        if (mine.some(x => !x) || theirs.some(x => !x) || !room(p, mine, theirs) || !room(o, theirs, mine)) { t.ok = o.trade.ok = false; this.sendTrade(p); this.toast(p, 'Not enough bag space to finish the trade', 'bad'); this.toast(o, 'Not enough bag space to finish the trade', 'bad'); return; }
        for (const i of t.offer) p.inv[i] = null; for (const i of o.trade.offer) o.inv[i] = null;
        for (const it of theirs) this.put(p.inv, it); for (const it of mine) this.put(o.inv, it);
        p.trade = o.trade = null; p._inv = o._inv = true; p.socket.emit('trade', null); o.socket.emit('trade', null);
        this.toast(p, 'Trade complete', 'good'); this.toast(o, 'Trade complete', 'good'); this.flush(o); return { ok: 1 };
      }
    }
  },

  // ---------- voice chat (the audio goes browser to browser; the server only introduces them) ----------
  onVoice(p, d) { p.voice = !!d.on; this.io.to('game').emit('voice', { id: p.id, on: p.voice }); return { ok: 1 }; },
  onRtc(p, d) { const o = this.players.get(d.to); if (o && o.voice && p.voice) o.socket.emit('rtc', { from: p.id, d: d.d }); },
};
export function install(Game) { Object.assign(Game.prototype, methods); }
