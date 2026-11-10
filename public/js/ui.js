// HUD and panels (bag, crafting, building, clan, map, help). Pure DOM, driven by the shared state S.
import { ITEMS, RECIPES, STRUCTS, SKILLS, QUESTS, STATION_NAMES, QUAL, STAT_N, CLASSES, ABIL_CD, SET_BONUS, UPGRADE, xpNeed, MAX_LVL, calcStats, combatLevel, gearSt, zoneName, zoneLevel } from '/shared/data.js';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createUI(S, act) {
  let tab = null, pick = null, clanMsg = '', whoSig = '';
  const TABS = [['bag', '🎒 Bag'], ['craft', '🛠️ Craft'], ['build', '🏠 Build'], ['who', '👥 Players'], ['clan', '🚩 Clan'], ['map', '🗺️ Map'], ['help', '❓ Help'], ['menu', '⚙️ Menu']];
  // slots are addressed as (c, s): c 0 = your bag, 1 = open chest or station, 2 = worn gear (s is the slot name), 3 = your trade offer, 4 = their offer
  const ref = el => ({ c: +el.dataset.c, s: el.dataset.c === '2' ? el.dataset.s : +el.dataset.s });
  const getIt = (c, s2) => c === 2 ? S.me.equip[s2] : c === 1 ? S.chest?.inv[s2] : c === 3 ? S.trade?.mine[s2] : c === 4 ? S.trade?.theirs[s2] : S.me.inv[s2];
  const stk = it => it.d == null && !it.st && !ITEMS[it.id].slot;
  function move(f, t) {
    if (f.c === t.c && f.s === t.s) return;
    if (f.c === 2 && t.c === 0) act.emit('invMove', { f: [2, f.s], t: [0, t.s] });        // take off
    else if (t.c === 2 && f.c === 0) act.emit('useItem', { slot: f.s });                    // put on
    else if (f.c <= 1 && t.c <= 1) act.emit('invMove', { f: [f.c, f.s], t: [t.c, t.s] });
  }
  const count = id => S.me.inv.reduce((a, it) => a + (it && it.id === id ? it.n : 0), 0);
  const slot = (it, c, s, cls = '', label = '') => {
    const d = it && ITEMS[it.id];
    return `<div class="slot ${cls} ${d ? 'has' : ''} ${pick && pick.c === c && pick.s === s ? 'pick' : ''}" ${d ? 'draggable="true"' : ''} data-c="${c}" data-s="${s}" ${c === 2 ? `data-l="${s}"` : ''} ${it?.q ? `style="border-color:${QUAL[it.q][1]}"` : ''} title="${d ? esc((it.q ? QUAL[it.q][0] + ' ' : '') + d.n + (d.gear ? ' — ' + statLine(it) : '')) : ''}">${label ? `<em>${label}</em>` : ''}${d ? `<span class="ic">${d.i}</span>${it.n > 1 ? `<b>${it.n}</b>` : ''}${it.d != null ? `<i style="width:${Math.min(100, Math.round(100 * it.d / d.dur))}%"></i>` : ''}${d.tier ? '<u>IRON</u>' : d.tr === 2 ? '<u>T2</u>' : ''}` : ''}</div>`;
  };
  const statLine = it => Object.entries(gearSt(it)).map(([k, v]) => `${STAT_N[k]} ${k === 'dmg' || k === 'hp' ? v : (k === 'arm' ? v + '%' : '+' + v + '%')}`).join(' · ');
  const buffLine = b => Object.entries(b.st).map(([k, v]) => `+${v}${k === 'hp' ? '' : '%'} ${STAT_N[k]}`).join(', ') + ` for ${Math.round(b.t / 60)} min`;
  const describe = (d, it) => d.food ? `Food  🍖+${d.food.h}${d.food.t ? `  💧+${d.food.t}` : ''}${d.food.hp ? `  ❤+${d.food.hp}` : ''}${d.buff ? ` · Buff: ${buffLine(d.buff)}` : ''}` : d.heal ? `Heals ❤+${d.heal}` : d.learn ? 'Use it to learn this recipe for good. Scrolls can be traded' : d.bag ? `Wear it for ${d.bag} more bag slots` :
    d.gear ? `${QUAL[it?.q || 0][0]} ${d.slot ? d.mat + ' armor (' + d.slot + ')' : CLASSES[d.tool][0] + ' weapon'} — ${statLine(it)}${d.tool === 'staff' ? '. Left click heals the most hurt player nearby' : ''}` : d.seed ? 'Plant in a farm plot' :
    d.tool === 'axe' ? 'Chops trees' : d.tool === 'pickaxe' ? 'Mines rock and ore' : d.tool === 'hammer' ? 'Needed to build. Hold it and press K to take things apart' : d.tool === 'hoe' ? 'Lets you place farm plots' : d.tool === 'bow' ? 'Shoots arrows (left click)' : d.tool === 'rod' ? 'Left click facing water to fish' : d.tool === 'water' ? 'Fill at water or a well. Drink it or water crops' : d.tool === 'torch' ? 'Lights the night and keeps wolves away' : d.dmg ? `Weapon — damage ${d.dmg}` : 'Crafting material';

  // ---------- HUD ----------
  function hotbar() {
    $('hotbar').innerHTML = S.me.inv.slice(0, 8).map((it, i) => slot(it, 0, i, i === S.sel ? 'sel' : '', i + 1)).join('');
    const it = S.me.inv[S.sel]; $('heldName').textContent = it ? ITEMS[it.id].n : '';
  }
  function vitals() {
    $('bHp').style.width = Math.min(100, 100 * S.me.hp / (S.me.max || 100)) + '%'; $('hpTxt').textContent = `${Math.max(0, Math.round(S.me.hp))} / ${S.me.max || 100}`; $('bFood').style.width = S.me.hunger + '%'; $('bWater').style.width = S.me.thirst + '%'; $('bStam').style.width = S.stam + '%';
  }
  function quest() {
    const q = QUESTS[S.me.quest];
    $('quest').innerHTML = q ? `<b>Next step ${S.me.quest + 1}/${QUESTS.length}</b>${esc(q.t)}${q.have ? ` <span style="color:var(--gold)">(${Math.min(count(q.have[0]), q.have[1])}/${q.have[1]})</span>` : ''}` : '<b>All steps done!</b>The island is yours. Keep building!';
  }
  function toast(m, k = '') {
    const d = document.createElement('div'); d.className = 'toast ' + k; d.textContent = m; $('toasts').appendChild(d);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => d.remove(), k === 'big' ? 4500 : 3200);
  }
  function feed(html) { const d = document.createElement('div'); d.innerHTML = html; $('feed').appendChild(d); while ($('feed').children.length > 6) $('feed').firstChild.remove(); setTimeout(() => d.remove(), 2600); }
  function chat(c) {
    const d = document.createElement('div'); d.className = c.ch;
    d.textContent = c.ch === 'sys' ? c.m : `${c.ch === 'clan' ? '[Clan] ' : c.ch === 'party' ? '[Party] ' : c.tag ? `[${c.tag}] ` : ''}${c.n}: ${c.m}`;
    $('chatlog').appendChild(d); while ($('chatlog').children.length > 9) $('chatlog').firstChild.remove();
  }
  $('chatin').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { sendChat(); e.target.blur(); }
    if (e.key === 'Escape') e.target.blur();
  });
  $('chatin').addEventListener('keyup', e => e.stopPropagation());
  function sendChat() { const el = $('chatin'); let m = el.value.trim(), ch = 'all'; if (m.startsWith('/c ')) { ch = 'clan'; m = m.slice(3); } else if (m.startsWith('/p ')) { ch = 'party'; m = m.slice(3); } if (m) act.emit('chat', { ch, m }); el.value = ''; }
  $('hotbar').addEventListener('click', e => {
    const s = e.target.closest('.slot'); if (!s) return;
    if (pick) { move(pick, { c: 0, s: +s.dataset.s }); pick = null; render(); } else act.select(+s.dataset.s);
  });
  // drag any item onto any slot: bag, chest, or the action bar at the bottom of the screen
  let drag = null;
  document.addEventListener('dragstart', e => { const s = e.target.closest?.('.slot'); if (!s) return; drag = ref(s); pick = null; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'item'); });
  document.addEventListener('dragover', e => { if (drag && e.target.closest?.('.slot')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } });
  document.addEventListener('drop', e => { const s = e.target.closest?.('.slot'); if (!drag || !s) return; e.preventDefault(); move(drag, ref(s)); });
  document.addEventListener('dragend', () => { drag = null; hotbar(); render(); });
  // point at (or pick) an item in the bag and press 1-8 to drop it on that action-bar slot
  let hover = null;
  $('pbody').addEventListener('mouseover', e => { const s = e.target.closest('.slot'); hover = s ? ref(s) : null; });
  function numKey(i) { if (tab !== 'bag') return; const from = pick || hover; if (!from || !getIt(from.c, from.s)) return; move(from, { c: 0, s: i }); pick = null; render(); }
  const quickSlot = (list, it, from, to) => { let j = -1; for (let i = from; i < to && j < 0; i++) if (list[i] && list[i].id === it.id && stk(it) && stk(list[i]) && list[i].n < 99) j = i; for (let i = from; i < to && j < 0; i++) if (!list[i]) j = i; return j; };

  // ---------- panels ----------
  function statBox() {
    const st = calcStats(S.me.equip, S.me.skills, S.me.buff, S.me.inv[S.sel]), tool = ITEMS[S.me.inv[S.sel]?.id]?.tool, cl = CLASSES[tool], b = S.me.buff && S.me.buff.until > Date.now() ? S.me.buff : null;
    const left = Math.max(0, (S.me.recallAt || 0) - Date.now());
    return `<div class="statbox"><b>${cl ? `${cl[2]} ${cl[0]}` : '🧭 Adventurer'}</b> ${cl ? `<small style="display:inline">(${cl[1]})</small>` : ''} · Level ${combatLevel(S.me.skills)}
      <small>${cl ? `Ability: ${cl[3]} (${act.padUI() ? 'B' : 'Q'}), ready every ${ABIL_CD[tool]}s` : 'Hold a sword, spear, bow or staff to pick your class'}</small>
      <div class="st"><span>❤ Health ${st.hp}</span><span>🛡 Armor ${st.arm}%</span><span>⚔ Power +${st.pow}%</span><span>✨ Healing +${st.mend}%</span></div>
      ${st.set ? `<small style="color:var(--good)">${SET_BONUS[st.set][2]}</small>` : '<small>Wear three pieces of one material for a set bonus</small>'}
      ${b ? `<small style="color:var(--good)">${ITEMS[b.id].i} ${ITEMS[b.id].n}: ${Math.ceil((b.until - Date.now()) / 60000)} min left</small>` : ''}
      <button class="small" style="margin-top:6px" data-act="recall" ${left ? 'disabled' : ''}>🏠 Return Home${left ? ` (${Math.ceil(left / 60000)} min)` : ''}</button></div>`;
  }
  function boxHead() {       // header for the open chest or station storage
    const c = S.chest, d = STRUCTS[c.t], up = d.store && UPGRADE[(c.tier || 1) + 1];
    return `<h3>${d.i} ${c.t === 'chest' ? 'Chest' : `${d.n} storage · tier ${c.tier || 1}`} <small>${c.t === 'chest' ? 'right-click moves an item across' : 'things kept here are used when you craft nearby'}</small></h3>
      <div class="row"><button class="small" data-act="stackNear">⇣ Stack matching items from my bag</button><button class="small" data-act="sort" data-c="1">Sort</button>${up ? `<button class="small" data-act="upgrade" title="+5 storage and unlocks tier ${(c.tier || 1) + 1} recipes">⬆ Upgrade to tier ${(c.tier || 1) + 1}: ${Object.entries(up).map(([k, n]) => `${ITEMS[k].i}${n}`).join(' ')}</button>` : ''}</div>
      <div class="grid">${c.inv.map((it, i) => slot(it, 1, i)).join('')}</div>`;
  }
  function bag() {
    const sel = pick ? getIt(pick.c, pick.s) : null, d = sel && ITEMS[sel.id];
    const usable = d && pick.c === 0 && (d.food || d.heal || d.slot || d.learn || d.tool === 'water');
    return `<div class="cols"><div>
      ${S.chest ? boxHead() : ''}
      <h3>⚡ Action bar <small>drag items here · or point at an item and press 1–8 · or shift-click it</small></h3>
      <div class="grid">${S.me.inv.slice(0, 8).map((it, i) => slot(it, 0, i, 'hb', i + 1)).join('')}</div>
      <h3>🎒 Bag <small>${S.me.inv.length - 8} slots${S.me.equip.bag ? '' : ' — craft a Satchel for more'}</small></h3>
      <div class="row"><button class="small" data-act="sort" data-c="0">Sort bag</button>${S.chest ? '' : '<button class="small" data-act="stackNear">⇣ Stack into nearby chests</button>'}</div>
      <div class="grid">${S.me.inv.slice(8).map((it, i) => slot(it, 0, i + 8)).join('')}</div>
      <div class="info">${d ? `<span style="font-size:34px">${d.i}</span><div class="grow"><b ${sel.q ? `style="color:${QUAL[sel.q][1]}"` : ''}>${esc(d.n)}</b>${sel.n > 1 ? ` ×${sel.n}` : ''}<small>${describe(d, sel)}</small></div>${usable ? `<button data-act="use">${d.slot ? 'Wear' : d.learn ? 'Learn' : d.food ? 'Eat' : 'Use'}</button>` : ''}${pick.c === 2 ? '<button data-act="unequip">Take off</button>' : ''}${pick.c === 0 ? '<button class="danger small" data-act="trash">🗑 Throw away</button>' : ''}` : '<div class="grow"><small>Drag items between slots, or click one and then click where it should go. Shift-click jumps an item between bag and action bar. Right-click eats food or wears gear.</small></div>'}</div>
    </div><div><h3>🧍 Wearing</h3><div class="eq">${['head', 'chest', 'legs', 'bag'].map(k => slot(S.me.equip[k], 2, k)).join('')}</div>${statBox()}
    <h3>⭐ Skills <small>level up by doing</small></h3>${Object.entries(SKILLS).map(([k, v]) => { const s = S.me.skills[k]; return `<div class="skill"><div><span>${v.i} ${v.n}</span><span>Lv ${s.l}</span></div><div class="meter"><i style="width:${s.l >= MAX_LVL ? 100 : 100 * s.x / xpNeed(s.l)}%"></i></div><small>${v.d}</small></div>`; }).join('')}</div></div>`;
  }
  const have = k => count(k) + (S.stock[k] || 0);        // crafting also uses what is in nearby chests and stations
  function craft() {
    const near = act.stations(), box = S.chest && S.chest.t !== 'chest' ? S.chest : null, bd = box && STRUCTS[box.t], up = box && UPGRADE[(box.tier || 1) + 1];
    let h = box ? `<h3>${bd.i} ${bd.n} storage · tier ${box.tier || 1} <small>right-click takes an item out</small></h3>
      <div class="row"><button class="small" data-act="tab" data-t="bag">Open with my bag to put things in</button><button class="small" data-act="stackNear">⇣ Stack matching items from my bag</button>${up ? `<button class="small" data-act="upgrade">⬆ Upgrade to tier ${(box.tier || 1) + 1}: ${Object.entries(up).map(([k, n]) => `${ITEMS[k].i}${n}`).join(' ')}</button>` : ''}</div>
      <div class="grid">${box.inv.map((it, i) => slot(it, 1, i)).join('')}</div>` : '';
    // At a station you see that station's recipes; anywhere else only the hand-made basics plus any station you are standing at.
    const at = box ? STRUCTS[box.t].station : null, all = Object.keys(STATION_NAMES);
    const show = at ? [at, null] : [null, ...all.filter(st => near[st])], away = at ? [] : all.filter(st => !near[st]);
    h += `<p style="margin:0 0 8px;color:var(--dim)">Ingredients come from your bag first, then from your chests and stations within a few steps.</p>`;
    for (const st of show) {
      const tier = st ? near[st] || 0 : 9;
      h += `<h3>${st ? `${STRUCTS[st].i} ${STATION_NAMES[st]}` : '✋ By hand'} <small>${st ? `tier ${tier}` : 'anywhere'}</small></h3>`;
      for (const r of RECIPES.filter(r => r.station === st)) {
        const d = ITEMS[r.out], lv = S.me.skills[r.sk].l >= r.lvl, known = !r.learn || S.me.known?.[r.id], tok = tier >= (r.tier || 1), has = Object.entries(r.in).every(([k, n]) => have(k) >= n), ok = tier && tok && lv && has && known;
        const lock = !known ? '📜 Recipe scroll needed (monster loot)' : !lv ? `🔒 ${SKILLS[r.sk].n} Lv ${r.lvl}` : tier && !tok ? `⬆ needs a tier ${r.tier} ${STATION_NAMES[st]}` : '';
        h += `<div class="rec ${ok ? '' : 'off'}"><span class="ic">${d.i}</span><div><b>${esc(d.n)}${r.n > 1 ? ` ×${r.n}` : ''}</b> ${lock ? `<small>${lock}</small>` : d.gear ? '<small>random quality and stats</small>' : d.buff ? `<small>${buffLine(d.buff)}</small>` : ''}<br>${Object.entries(r.in).map(([k, n]) => `<span class="ing ${have(k) >= n ? 'ok' : 'no'}">${ITEMS[k].i} ${ITEMS[k].n} ${have(k)}/${n}</span>`).join('')}</div><div><button data-act="craft" data-id="${r.id}" data-n="1" ${ok ? '' : 'disabled'}>Make</button> <button class="small" data-act="craft" data-id="${r.id}" data-n="5" ${ok ? '' : 'disabled'}>×5</button></div></div>`;
      }
    }
    if (away.length) h += `<h3>🔨 Other stations</h3><p style="margin:0;color:var(--dim)">${away.map(st => `${STRUCTS[st].i} ${STATION_NAMES[st]} (${RECIPES.filter(r => r.station === st).length} recipes)`).join(' · ')}<br>Walk up to one and press ${act.padUI() ? 'X' : 'E'} to see and make what it can build. Build stations from the Build menu (${act.padUI() ? 'D-pad →' : 'B'}).</p>`;
    return h;
  }
  function who() {
    const pt = S.party, me = pt?.m.find(m => m.id === S.id), lead = pt?.leader === S.id;
    let h = clanMsg ? `<p style="color:var(--gold);font-weight:700;margin-top:0">${esc(clanMsg)}</p>` : '';
    if (S.pinv) h += `<div class="row"><b>📨 ${esc(S.pinv.name)} invited you to a party</b><button data-act="pt" data-op="accept">Join</button><button class="small danger" data-act="pt" data-op="decline">No thanks</button></div>`;
    if (S.tradeAsk) h += `<div class="row"><b>🤝 ${esc(S.tradeAsk.name)} wants to trade</b><button data-act="tr" data-op="accept">Trade</button><button class="small danger" data-act="tr" data-op="decline">No thanks</button></div>`;
    h += `<h3>🎙 Voice chat <small>you hear players within about 40 steps; closer is louder</small></h3><div class="row"><button data-act="voice">${act.voiceOn() ? '🔊 On — click to turn off' : '🔇 Off — click to turn on'}</button><small style="color:var(--dim)">Your browser will ask to use the microphone.</small></div>`;
    h += `<h3>🧑‍🤝‍🧑 Party <small>up to 5 · shared kill XP · party chat with /p</small></h3>`;
    h += pt ? pt.m.map(m => `<div class="who"><span><b>${esc(m.name)}</b> <small>Lv ${m.lv}${m.id === pt.leader ? ' · leader' : ''} · ❤ ${m.hp}/${m.max}</small></span><span>${lead && m.id !== S.id ? `<button class="small danger" data-act="pt" data-op="kick" data-pid="${m.id}">Remove</button>` : ''}</span></div>`).join('') + '<div class="row"><button class="small danger" data-act="pt" data-op="leave">Leave party</button></div>' : '<p style="color:var(--dim);margin:0 0 8px">You are not in a party. Invite someone from the list below.</p>';
    h += `<h3>🌍 Online now <small>${S.who.length} player${S.who.length === 1 ? '' : 's'}</small></h3>`;
    for (const o of S.who) {
      const cl = CLASSES[o.w], self = o.id === S.id;
      h += `<div class="who"><span><b>${esc(o.name)}</b>${o.tag ? ` [${esc(o.tag)}]` : ''}${self ? ' (you)' : ''} <small>Lv ${o.lv} ${cl ? cl[2] + ' ' + cl[0] : 'Adventurer'} · ${zoneName((o.zl - 1) * 45)}${o.voice ? ' · 🎙' : ''}${o.party === 2 ? ' · in your party' : o.party ? ' · in a party' : ''}</small></span>
        <span>${self ? '' : `${!o.party && (!pt || lead) ? `<button class="small" data-act="pt" data-op="invite" data-pid="${o.id}">Invite to party</button> ` : ''}<button class="small" data-act="tr" data-op="ask" data-pid="${o.id}" ${o.near ? '' : 'disabled title="Stand next to them to trade"'}>Trade</button>`}</span></div>`;
    }
    return h;
  }
  function trade() {
    const t = S.trade; if (!t) return '<p>No trade in progress.</p>';
    const col = (list, c) => `<div class="grid">${Array.from({ length: 8 }, (_, i) => slot(list[i], c, i)).join('')}</div>`;
    return `<h3>🤝 Trading with ${esc(t.name)}</h3><div class="tradecols"><div><b>You give</b> ${t.okMe ? '<span class="okd">✔ accepted</span>' : ''}${col(t.mine, 3)}<small style="color:var(--dim)">click an item here to take it back</small></div>
      <div><b>${esc(t.name)} gives</b> ${t.okThem ? '<span class="okd">✔ accepted</span>' : ''}${col(t.theirs, 4)}<small style="color:var(--dim)">point at an item to see its stats</small></div></div>
      <div class="row"><button data-act="tr" data-op="ok" ${t.okMe ? 'disabled' : ''}>✔ Accept trade</button><button class="danger" data-act="tr" data-op="cancel">Cancel</button><small style="color:var(--dim)">Both players must accept. Changing an offer clears both accepts.</small></div>
      <h3>🎒 Your bag <small>click an item to offer it</small></h3><div class="grid">${S.me.inv.map((it, i) => slot(t.slots.includes(i) ? null : it, 0, i)).join('')}</div>`;
  }
  // what a building piece costs, with what you have, and where to get the first thing you are short of
  const costHtml = cost => Object.entries(cost).map(([k, n]) => `<span class="ing ${count(k) >= n ? 'ok' : 'no'}">${ITEMS[k].i} ${ITEMS[k].n} ${count(k)}/${n}</span>`).join('');
  function costHint(d) {
    const tool = d.needs || (d.free ? null : 'hammer');
    if (tool && !count(tool)) return `You need a ${ITEMS[tool].n} in your bag — craft one (C)`;
    const k = Object.keys(d.cost).find(k => count(k) < d.cost[k]); if (!k) return '';
    const r = RECIPES.find(r => r.out === k);
    return r ? `Make ${ITEMS[k].n} ${r.station ? `at a ${STATION_NAMES[r.station]}` : 'by hand'} (C) from ${Object.keys(r.in).map(i => ITEMS[i].n).join(' + ')}` : `Gather more ${ITEMS[k].n}`;
  }
  function build() {
    const lv = S.me.skills.building.l; let h = `<p style="margin-top:0;color:var(--dim)">Pick something, aim where you want it, then place it. Each card lists what it costs and how much you have (green = enough, red = short). You need a Building Hammer in your bag (Building Lv ${lv}).<br>Walls stack by themselves up to 3 high: place a wall where one already stands and it goes on top. Roofs land on the highest wall around them, and a Gable closes the open triangle at each end of a roof.</p>`;
    for (const cat of ['Camp', 'Farm', 'Building', 'Clan']) {
      h += `<h3>${cat}</h3><div class="cards">`;
      for (const [id, d] of Object.entries(STRUCTS)) if (d.cat === cat) {
        const ok = lv >= d.lvl && Object.entries(d.cost).every(([k, n]) => count(k) >= n);
        const hint = lv >= d.lvl ? costHint(d) : '';
        h += `<div class="card ${lv >= d.lvl ? '' : 'off'} ${ok ? 'can' : ''}" data-act="build" data-id="${id}" title="${esc('Needs ' + Object.entries(d.cost).map(([k, n]) => `${n} ${ITEMS[k].n} (you have ${count(k)})`).join(', ') + (hint ? '. ' + hint : ''))}"><span class="ic">${d.i}</span><b>${esc(d.n)}</b><div class="cost">${lv >= d.lvl ? costHtml(d.cost) : `<small>🔒 Building Lv ${d.lvl}</small>`}</div>${hint ? `<small class="hint">${esc(hint)}</small>` : ''}</div>`;
      }
      h += '</div>';
    }
    return h;
  }
  function clan() {
    const c = S.clan, inv = S.invites || [];
    let h = clanMsg ? `<p style="color:var(--gold);font-weight:700;margin-top:0">${esc(clanMsg)}</p>` : '';
    if (!c) {
      h += inv.length ? `<h3>📨 Invitations</h3>${inv.map(i => `<div class="row"><b>${esc(i.name)} [${esc(i.tag)}]</b><button data-act="cl" data-op="accept" data-id="${i.id}">Join</button><button class="small danger" data-act="cl" data-op="decline" data-id="${i.id}">No thanks</button></div>`).join('')}` : '';
      h += `<h3>🚩 Start a clan</h3><p style="color:var(--dim);margin-top:0">Clan members share chests, doors, farms and buildings, see each other on the map, get their own chat (<b>/c hello</b>) and level the clan up together.</p>
        <div class="row"><input id="clName" placeholder="Clan name" maxlength="20"><input id="clTag" placeholder="TAG" maxlength="4" style="width:80px;text-transform:uppercase"><input id="clColor" type="color" value="#2fa866" style="width:54px;height:36px;padding:2px"><button data-act="clCreate">Create clan</button></div>`;
      return h;
    }
    const me = c.members.find(m => m.id === S.id), boss = me.role !== 'member', lead = me.role === 'leader', lvl = 1 + Math.floor(Math.sqrt(c.xp / 150));
    h += `<h3><span style="color:${c.color}">⬤</span> ${esc(c.name)} [${esc(c.tag)}] <small>Clan level ${lvl} · ${c.xp} clan XP · you are ${me.role}</small></h3>
      <div class="meter" style="margin-bottom:10px"><i style="width:${100 * (c.xp - 150 * (lvl - 1) ** 2) / (150 * (lvl ** 2 - (lvl - 1) ** 2))}%"></i></div>
      <div class="row"><b>Notice:</b> <span>${esc(c.motd || '—')}</span>${boss ? `<input id="clMotd" placeholder="Write a clan notice" maxlength="120" style="flex:1"><button class="small" data-act="clMotd">Post</button>` : ''}</div>
      <h3>Members</h3>${c.members.map(m => `<div class="member"><span class="dot ${m.on ? 'on' : ''}"></span><span><b>${esc(m.name)}</b> <small style="color:var(--dim)">${m.role}</small></span>
        <span>${lead && m.id !== S.id ? `<button class="small" data-act="cl" data-op="role" data-pid="${m.id}" data-role="${m.role === 'officer' ? 'member' : 'officer'}">${m.role === 'officer' ? 'Make member' : 'Make officer'}</button> <button class="small" data-act="cl" data-op="role" data-pid="${m.id}" data-role="leader">Make leader</button>` : ''}</span>
        <span>${boss && m.id !== S.id && m.role !== 'leader' ? `<button class="small danger" data-act="cl" data-op="kick" data-pid="${m.id}">Remove</button>` : ''}</span></div>`).join('')}
      ${boss ? `<h3 style="margin-top:12px">Invite a player</h3><div class="row"><input id="clInv" placeholder="Their player name" maxlength="14"><button data-act="clInvite">Invite</button></div>${c.invited.length ? `<div class="row"><small style="color:var(--dim)">Waiting on:</small>${c.invited.map(i => `<span>${esc(i)} <button class="small" data-act="cl" data-op="uninvite" data-pid="${i}">✕</button></span>`).join('')}</div>` : ''}` : ''}
      <div class="row" style="margin-top:14px"><button class="danger" data-act="cl" data-op="leave">Leave clan</button></div>`;
    return h;
  }
  const help = () => `<div class="help">
    <p><kbd>W A S D</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>X</kbd> sneak (animals notice you less)</p>
    <p><kbd>Mouse</kbd> look around (click the game first) · <kbd>Wheel</kbd> or <kbd>1–8</kbd> pick a hotbar item</p>
    <p><kbd>Left click</kbd> use what you hold: swing, chop, mine, shoot, fish, eat, plant</p>
    <p><kbd>E</kbd> pick things up, open chests and doors, drink, harvest, use stations</p>
    <p><kbd>Tab</kbd> bag & skills · <kbd>C</kbd> craft · <kbd>B</kbd> build · <kbd>G</kbd> clan · <kbd>M</kbd> map · <kbd>Esc</kbd> menu & settings · <kbd>Enter</kbd> chat</p>
    <p><kbd>K</kbd> with the hammer in hand: take apart the highlighted piece (half the materials back). Roofs, stairs and floors are offered before the foundation under them; <kbd>T</kbd> steps to the next piece in reach</p>
    <p><b>🎮 Controller:</b> <kbd>Left stick</kbd> move · <kbd>Right stick</kbd> look · <kbd>A</kbd> jump · <kbd>X</kbd> pick up / use · <kbd>RT</kbd> use held item (hold to keep going) · <kbd>LB</kbd> <kbd>RB</kbd> action bar · <kbd>L3</kbd> run · <kbd>LT</kbd> sneak · <kbd>Y</kbd> bag · <kbd>D-pad</kbd> ↑ craft, → build, ← clan, ↓ map · <kbd>Start</kbd> menu · <kbd>R3</kbd> take apart (hammer)</p>
    <p><b>🎮 In menus:</b> <kbd>D-pad</kbd>/<kbd>stick</kbd> move the highlight · <kbd>A</kbd> choose (pick an item, then A on another slot moves it) · <kbd>X</kbd> eat / wear / quick-move · <kbd>LB</kbd> <kbd>RB</kbd> switch tab · <kbd>B</kbd> close. Building: <kbd>RT</kbd> place · <kbd>X</kbd> turn · <kbd>Y</kbd> floor · <kbd>B</kbd> done. An on-screen keyboard opens when you press <kbd>A</kbd> on a text box; <kbd>Back/View</kbd> opens chat.</p>
    <p><kbd>Q</kbd> class ability · <kbd>F</kbd> Return Home (30 min cooldown) · <kbd>P</kbd> players, party, trade and voice · <kbd>V</kbd> free camera while building</p>
    <p><b>Classes</b> follow the weapon in your hand. <b>Sword</b>: Guardian, a tank — Taunt pulls monsters onto you. <b>Spear</b>: Striker, melee damage. <b>Bow</b>: Ranger, ranged damage. <b>Staff</b>: Mender — left click heals the most hurt player nearby. Plate armor suits tanks, leather suits damage, cloth suits healers; three pieces of one kind give a set bonus.</p>
    <p><b>Monster rings</b> show how tough a monster is next to you: grey = far weaker, green = 2 levels below, blue = 1 below, white = your level, yellow = 1 above, red = dangerous. Monsters get tougher, and drop better loot, the farther you go from the starting meadow.</p>
    <p><b>Getting started:</b> punch trees for sticks, grab loose stones and tall grass, then craft a Stone Axe. Follow the “Next step” box — it walks you through everything.</p>
    <p><b>Skills</b> grow by doing the thing. Higher levels give bonus loot, unlock recipes and building pieces.</p>
    <p><b>Food & water:</b> cook meat on a campfire, drink at lakes with E, and build a Well near home.</p>
    <p><b>Farming:</b> craft a Hoe → place a Farm Plot → hold seeds and click the plot. A full waterskin makes it grow faster.</p>
    <p><b>Building:</b> foundations first, then walls, a door and a roof. Walls stack up to 3 high (place again on the same spot), roofs sit on the highest wall, and a Gable fills the triangle at each roof end. Stairs + upper floors make more storeys.</p>
    <p><b>Night:</b> wolves roam the deep woods after dark but never come near a campfire or torch post. Sleep spots: a Bed sets where you wake up.</p>
    <p><b>Clans:</b> press G. Clan-mates share everything you build.</p>
    <p><b>If you get knocked out</b> you wake up at your bed with all your stuff.</p></div>
    <div class="row" style="margin-top:12px"><button data-act="tab" data-t="menu">⚙️ Settings and log out</button></div>`;

  function menu() {
    const c = act.cfg, row = (label, body) => `<div class="mrow"><b>${label}</b><span>${body}</span></div>`;
    const step = (k, txt) => `<button class="small" data-act="cfg" data-k="${k}" data-d="-1">−</button><span class="val">${txt}</span><button class="small" data-act="cfg" data-k="${k}" data-d="1">+</button>`;
    return `<div class="menu"><button data-act="resume" class="big">▶ Back to game</button>
      <h3>Settings</h3>
      ${row('Graphics', `<button data-act="gfx">${localStorage.kwGfx === 'low' ? 'Fast' : 'Pretty'}</button> <small>Fast turns shadows off for slower computers</small>`)}
      ${row('Music volume', step('music', c.mute ? 'Muted' : c.music ? c.music + '%' : 'Off'))}
      ${row('Sound effects', step('vol', c.mute ? 'Muted' : c.vol + '%') + ` <button class="small" data-act="cfg" data-k="mute">${c.mute ? 'Unmute all' : 'Mute all'}</button>`)}
      ${row('Mouse look speed', step('sens', c.sens + '%'))}
      ${row('Controller look speed', step('padSens', c.padSens + '%'))}
      ${row('Look up / down', `<button data-act="cfg" data-k="invY">${c.invY ? 'Inverted' : 'Normal'}</button>`)}
      ${row('My doors, chests and stations', `<button data-act="perm">${{ me: 'Only me', clan: 'Me and my clan', party: 'My clan and my party', all: 'Everyone' }[S.me.perm || 'clan']}</button> <small>who can open and use what you built</small>`)}
      ${row('Voice chat', `<button data-act="voice">${act.voiceOn() ? 'On' : 'Off'}</button> <small>talk to players near you (uses your microphone)</small>`)}
      ${row('Button hints', `<button data-act="cfg" data-k="hints">${{ auto: 'Automatic', kb: 'Keyboard & mouse', pad: 'Controller' }[c.hints]}</button> <small>which controls the on-screen tips show</small>`)}
      <h3>Game</h3>
      <div class="row"><button data-act="tab" data-t="help">❓ Controls & help</button><button class="danger" data-act="logout">Log out</button></div>
      <p style="color:var(--dim)">Playing as <b>${esc(S.me.name)}</b>. Your character and the world save automatically. Logging out returns to the name screen so someone else can play on this computer.</p></div>`;
  }

  function render() {
    if (!tab) return;
    $('tabs').innerHTML = (S.trade ? [['trade', '🤝 Trade'], ...TABS] : TABS).map(([k, n]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('');
    const top = $('pbody').scrollTop;
    $('pbody').innerHTML = tab === 'bag' ? bag() : tab === 'craft' ? craft() : tab === 'build' ? build() : tab === 'clan' ? clan() : tab === 'map' ? '<canvas id="bigmap" width="520" height="520"></canvas><p style="text-align:center;color:var(--dim)">⬤ you · clan-mates in your clan colour · 🏠 your buildings</p>' : tab === 'menu' ? menu() : tab === 'who' ? who() : tab === 'trade' ? trade() : help();
    $('pbody').scrollTop = top;
    if (tab === 'map') act.drawMap($('bigmap'));
  }
  function enter(t) {       // things each tab needs fresh from the server
    if (t === 'craft') act.emit('stock', {}, r => { S.stock = r?.stock || {}; if (tab === 'craft') render(); });
    if (t === 'who') act.emit('who', {}, r => { const sig = JSON.stringify(r?.list); if (sig === whoSig) return; whoSig = sig; S.who = r?.list || []; if (tab === 'who') render(); });
  }
  setInterval(() => { if (tab === 'who' && document.activeElement?.tagName !== 'INPUT') enter('who'); }, 3000);
  function open(t) { if (tab === t) return close(); tab = t; pick = null; clanMsg = ''; $('panel').hidden = false; document.exitPointerLock?.(); enter(t); render(); $('pbody').scrollTop = 0; }
  function close() { if (!tab) return; if (tab === 'trade' && S.trade) act.emit('trade', { op: 'cancel' }); tab = null; pick = null; $('panel').hidden = true; if (S.chest) { S.chest = null; act.emit('closeChest'); } act.lock(); }
  $('pclose').onclick = close;
  $('tabs').addEventListener('click', e => { const t = e.target.dataset.tab; if (t && t !== tab) { tab = t; pick = null; enter(t); render(); $('pbody').scrollTop = 0; } });
  $('pbody').addEventListener('contextmenu', e => {
    e.preventDefault(); const s = e.target.closest('.slot'); if (!s) return; const { c, s: i } = ref(s), it = getIt(c, i); if (!it || c > 2 || tab === 'trade') return;
    if (c === 2) { const j = S.me.inv.findIndex(x => !x); if (j < 0) toast('Your bag is full', 'bad'); else move({ c, s: i }, { c: 0, s: j }); }
    else if (S.chest) { const dest = c ? S.me.inv : S.chest.inv; let j = dest.findIndex(x => x && x.id === it.id && stk(x) && stk(it) && x.n < 99); if (j < 0) j = dest.findIndex(x => !x); if (j >= 0) act.emit('invMove', { f: [c, i], t: [c ? 0 : 1, j] }); }
    else act.emit('useItem', { slot: i });
    pick = null;
  });
  $('pbody').addEventListener('click', e => {
    const s = e.target.closest('.slot');
    if (s) { const { c, s: i } = ref(s), it = getIt(c, i);
      if (tab === 'trade') { if (c === 0 && it) act.emit('trade', { op: 'add', slot: i }); else if (c === 3 && it) act.emit('trade', { op: 'remove', i }); return; }
      if (e.shiftKey && it && c === 0 && !S.chest) { const j = i < 8 ? quickSlot(S.me.inv, it, 8, S.me.inv.length) : quickSlot(S.me.inv, it, 0, 8); if (j >= 0) act.emit('invMove', { f: [0, i], t: [0, j] }); else toast(i < 8 ? 'Your bag is full' : 'Your action bar is full', 'bad'); pick = null; return render(); }
      if (!pick) { if (it) pick = { c, s: i }; } else if (pick.c === c && pick.s === i) pick = null; else { move(pick, { c, s: i }); pick = null; }
      return render(); }
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const d = b.dataset, cb = r => { clanMsg = r?.err || r?.msg || ''; render(); };
    switch (d.act) {
      case 'gfx': act.toggleGfx(); render(); break;
      case 'resume': close(); break;
      case 'cfg': act.setCfg(d.k, +d.d || 0); render(); break;
      case 'tab': tab = d.t; render(); $('pbody').scrollTop = 0; break;
      case 'logout': act.logout(); break;
      case 'use': act.emit('useItem', { slot: pick.s }); pick = null; break;
      case 'trash': act.emit('trash', { slot: pick.s }); pick = null; break;
      case 'unequip': { const j = S.me.inv.findIndex(x => !x); if (j < 0) toast('Your bag is full', 'bad'); else move(pick, { c: 0, s: j }); pick = null; break; }
      case 'craft': act.emit('craft', { id: d.id, n: +d.n }, r => { if (r?.ok) { act.sound('craft'); if (r.stock) S.stock = r.stock; render(); } }); break;
      case 'sort': act.emit('sort', { c: +d.c }); pick = null; break;
      case 'stackNear': act.emit('stackNear', {}, () => enter('craft')); break;
      case 'upgrade': act.emit('upgrade', {}, r => { if (r?.err) toast(r.err, 'bad'); enter('craft'); }); break;
      case 'recall': close(); act.recall(); break;
      case 'perm': act.emit('perm', { v: { me: 'clan', clan: 'party', party: 'all', all: 'me' }[S.me.perm || 'clan'] }); break;
      case 'voice': act.voiceToggle().then(render); break;
      case 'pt': act.emit('party', { op: d.op, pid: d.pid }, cb); break;
      case 'tr': act.emit('trade', { op: d.op, pid: d.pid }, r => { if (d.op !== 'ok') cb(r); }); break;
      case 'build': if (!b.classList.contains('off')) { close(); act.startBuild(d.id); } break;
      case 'clCreate': act.emit('clan', { op: 'create', name: $('clName').value, tag: $('clTag').value, color: $('clColor').value }, cb); break;
      case 'clInvite': act.emit('clan', { op: 'invite', name: $('clInv').value }, cb); break;
      case 'clMotd': act.emit('clan', { op: 'motd', text: $('clMotd').value }, cb); break;
      case 'cl': if (d.op !== 'leave' || confirm('Leave your clan?')) act.emit('clan', { op: d.op, id: d.id, pid: d.pid, role: d.role }, cb); break;
    }
  });
  // typing inside panel inputs must not trigger game hotkeys
  $('panel').addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') e.stopPropagation(); });

  return {
    open, close, render, toast, feed, chat, hotbar, vitals, quest, numKey, costHtml, costHint, sendChat,
    get tab() { return tab; },
    refresh() { if (drag) return; hotbar(); quest(); const a = document.activeElement; if (tab && tab !== 'map' && !(a && a.tagName === 'INPUT' && $('panel').contains(a))) render(); },
  };
}
