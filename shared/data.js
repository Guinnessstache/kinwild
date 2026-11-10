// All game content lives here: tweak numbers, add items/recipes, and both server and client pick it up.
export const DAY_LEN = 20 * 60;          // seconds per full day
export const MAX_LVL = 50;
export const xpNeed = l => Math.floor(40 * Math.pow(l, 1.5));

export const SKILLS = {
  woodcutting: { n: 'Woodcutting', i: '🪓', d: 'Bonus wood when chopping' },
  mining: { n: 'Mining', i: '⛏️', d: 'Bonus stone and ore' },
  foraging: { n: 'Foraging', i: '🌿', d: 'Bonus berries, fiber and finds' },
  farming: { n: 'Farming', i: '🌾', d: 'Faster crops, bigger harvests' },
  hunting: { n: 'Hunting', i: '🏹', d: 'More loot from animals and monsters' },
  fishing: { n: 'Fishing', i: '🎣', d: 'Faster bites' },
  crafting: { n: 'Crafting', i: '🛠️', d: 'New recipes, tougher tools' },
  cooking: { n: 'Cooking', i: '🍲', d: 'New meals, food fills you more' },
  building: { n: 'Building', i: '🏠', d: 'New building pieces' },
  melee: { n: 'Melee', i: '⚔️', d: 'Damage with swords and spears' },
  archery: { n: 'Archery', i: '🎯', d: 'Damage with bows' },
  defense: { n: 'Defense', i: '🛡️', d: 'More health. Grows when you take hits' },
  healing: { n: 'Healing', i: '✨', d: 'Stronger heals with a staff' },
};

// Small drawn icons where no emoji fits. Icons are only ever inserted as HTML.
const SVG = b => `<svg class="svgi" viewBox="0 0 24 24" width="1em" height="1em">${b}</svg>`;
const IC_HOE = SVG('<path d="M4.5 21.5 16 6" stroke="#8a5a33" stroke-width="2.6" stroke-linecap="round"/><path d="M13.2 3.2 20.8 8.8 21.6 15.2 17.2 13.6 15.6 9.2 11.6 6z" fill="#c3cad1" stroke="#59616a" stroke-width="1.1" stroke-linejoin="round"/>');
const IC_WOODWALL = SVG('<rect x="2" y="3.5" width="20" height="17" rx="1.5" fill="#b9814f" stroke="#5e3d22" stroke-width="1.4"/><path d="M7 3.5v17M12 3.5v17M17 3.5v17" stroke="#5e3d22" stroke-width="1.2"/><path d="M2.5 8.5h19M2.5 15.5h19" stroke="#8a5a33" stroke-width="1.6"/>');
const IC_GABLE = c => SVG(`<path d="M2 20 12 4 22 20z" fill="${c}" stroke="#3d2a18" stroke-width="1.4" stroke-linejoin="round"/><path d="M7 20v-8M12 20V4M17 20v-8" stroke="#3d2a18" stroke-width="1" opacity=".7"/>`);
const T = (n, i, tool, pow, dmg, dur, reach = 3) => ({ n, i, tool, pow, dmg, dur, reach });
const F = (n, i, h, t = 0, hp = 0, cooked = false) => ({ n, i, food: { h, t, hp }, cooked });
// Armor comes in three materials: cloth (healing), leather (damage), plate (armor and health). tr = tier.
const ARM = { cloth: { arm: 2, mend: 6 }, leather: { arm: 4, pow: 4 }, plate: { arm: 8, hp: 12 } };
// drawn armor icons: one shape per slot and material, coloured by tier
const AC = { cloth: ['#8f7cc8', '#c9b8ff'], leather: ['#9a6235', '#5e3a20'], plate: ['#aeb6bf', '#e3e9ef'] }, OUT = 'stroke="#2a1d12" stroke-width="1.3" stroke-linejoin="round"';
const SHAPE = {
  head: { cloth: c => `<path d="M12 2.5 4.5 15.5c0 3 3.4 5.5 7.5 5.5s7.5-2.5 7.5-5.5z" fill="${c}" ${OUT}/><path d="M8 15.5c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5" fill="#3a2a1e"/><path d="M7.5 15.5c0 2.6 2 4.2 4.5 4.2s4.5-1.6 4.5-4.2" fill="#f1c7a0" opacity=".85"/>`,
    leather: c => `<path d="M3.5 14.5c0-5.5 3.8-9.5 8.5-9.5s8.5 4 8.5 9.5z" fill="${c}" ${OUT}/><path d="M12 5v9.5" stroke="#2a1d12" stroke-width="1"/><path d="M2 14.5h20v2.2H2z" fill="${c}" ${OUT}/>`,
    plate: c => `<path d="M4 13c0-5.5 3.6-9.5 8-9.5s8 4 8 9.5v6.5H4z" fill="${c}" ${OUT}/><path d="M7 11.5h10v2.2H7z" fill="#2a1d12"/><path d="M12 3.5v8" stroke="#2a1d12" stroke-width="1.2"/><path d="M11 13.7h2v5.8h-2z" fill="#2a1d12" opacity=".55"/>` },
  chest: { cloth: c => `<path d="M8 3 4 6.5 2.5 12l3 1.2L7 9v12.5h10V9l1.5 4.2 3-1.2L20 6.5 16 3l-4 3z" fill="${c}" ${OUT}/><path d="M12 6v15.5" stroke="#2a1d12" stroke-width="1"/><path d="M7 14h10" stroke="#e8c84a" stroke-width="1.6"/>`,
    leather: c => `<path d="M7.5 3 3.5 6.5 5 11l2.5-.8V21h9V10.2l2.5.8 1.5-4.5L16.5 3h-2.5c0 1.5-1 2.6-2 2.6S10 4.5 10 3z" fill="${c}" ${OUT}/><path d="M7.5 14.5h9" stroke="#2a1d12" stroke-width="1.6"/><circle cx="12" cy="14.5" r="1.2" fill="#d9b23a"/><path d="M12 6v6.5M10.5 8.5h3M10.5 10.5h3" stroke="#2a1d12" stroke-width=".9"/>`,
    plate: c => `<path d="M5 4.5 2.8 9l2.8 1.2.4 8.3 6 2.5 6-2.5.4-8.3L21.2 9 19 4.5 15 3.2c-.6 1.5-1.7 2.3-3 2.3s-2.4-.8-3-2.3z" fill="${c}" ${OUT}/><path d="M12 5.5v15.2M7 11.5c3 1.2 7 1.2 10 0" stroke="#2a1d12" stroke-width="1.1" fill="none"/>` },
  legs: { cloth: c => `<path d="M6 3h12l1.5 18h-5L12 10l-2.5 11h-5z" fill="${c}" ${OUT}/><path d="M6 5.5h12" stroke="#e8c84a" stroke-width="1.6"/>`,
    leather: c => `<path d="M6.5 3h11l1 18h-4.6L12 10.5 10.1 21H5.5z" fill="${c}" ${OUT}/><path d="M6.5 5.5h11" stroke="#2a1d12" stroke-width="1.6"/><path d="M8.2 13.5h2.2M14.3 13.5h1.8" stroke="#2a1d12" stroke-width=".9"/>`,
    plate: c => `<path d="M6.5 3h11l.8 9.5-1 8.5h-4l-1.3-9-1.3 9H6.7l-1-8.5z" fill="${c}" ${OUT}/><path d="M6 12.5h4.6M13.4 12.5H18" stroke="#2a1d12" stroke-width="1.2"/><circle cx="8.3" cy="12.5" r="1.4" fill="${c}" ${OUT}/><circle cx="15.7" cy="12.5" r="1.4" fill="${c}" ${OUT}/>` },
};
const armIcon = (slot, mat, tr) => SVG(SHAPE[slot][mat](AC[mat][tr - 1]));
const A = (n, i, slot, mat, tr = 1) => { const m = (slot === 'chest' ? 1.5 : 1) * (tr === 2 ? 1.8 : 1), base = {}; for (const k in ARM[mat]) base[k] = Math.round(ARM[mat][k] * m); return { n, i: armIcon(slot, mat, tr), slot, mat, tr, gear: true, base }; };
const BUFF = (it, st, t) => ({ ...it, buff: { st, t } });
export const ITEMS = {
  // materials
  wood: { n: 'Wood', i: '🪵' }, stick: { n: 'Stick', i: '🥢' }, stone: { n: 'Stone', i: '🪨' }, flint: { n: 'Flint', i: '🔺' },
  fiber: { n: 'Plant Fiber', i: '🌿' }, clay: { n: 'Clay', i: '🟤' }, coal: { n: 'Coal', i: '⚫' }, iron_ore: { n: 'Iron Ore', i: '🟠' },
  plank: { n: 'Plank', i: '🟫' }, rope: { n: 'Rope', i: '🪢' }, cloth: { n: 'Cloth', i: '🧵' }, flax: { n: 'Flax', i: '💠' },
  hide: { n: 'Hide', i: '🦬' }, leather: { n: 'Leather', i: '👜' }, bone: { n: 'Bone', i: '🦴' }, feather: { n: 'Feather', i: '🪶' },
  iron_bar: { n: 'Iron Bar', i: '🔩' }, nails: { n: 'Nails', i: '📌' }, brick: { n: 'Brick', i: '🧱' }, steel_bar: { n: 'Steel Bar', i: '⛓️' },
  fang: { n: 'Fang', i: '🦷' }, spider_silk: { n: 'Spider Silk', i: '🕸️' }, thick_hide: { n: 'Thick Hide', i: '🐻' },
  // food
  berries: F('Berries', '🫐', 8, 4), mushroom: F('Mushroom', '🍄', 6), apple: F('Apple', '🍎', 10, 5),
  raw_meat: F('Raw Meat', '🥩', 6), raw_fish: F('Raw Fish', '🐟', 6),
  wheat: { n: 'Wheat', i: '🌾' }, carrot: F('Carrot', '🥕', 10, 3), potato: F('Potato', '🥔', 6), pumpkin: F('Pumpkin', '🎃', 10, 4), corn: F('Corn', '🌽', 8, 2),
  cooked_meat: F('Cooked Meat', '🍖', 35, 0, 8, true), cooked_fish: F('Grilled Fish', '🍤', 30, 0, 8, true),
  baked_potato: F('Baked Potato', '🥔', 22, 0, 4, true), roasted_corn: F('Roasted Corn', '🌽', 22, 0, 4, true),
  // meals with a buff: st = bonus while it lasts, t = seconds. Higher cooking level recipes give bigger buffs.
  bread: BUFF(F('Bread', '🍞', 30, 0, 5, true), { hp: 10 }, 600), mushroom_soup: BUFF(F('Mushroom Soup', '🥣', 28, 20, 8, true), { mend: 10 }, 600),
  berry_juice: BUFF(F('Berry Juice', '🧃', 8, 45, 5, true), { speed: 8 }, 300), stew: BUFF(F('Hearty Stew', '🍲', 60, 25, 20, true), { hp: 20, pow: 10 }, 900),
  pumpkin_pie: BUFF(F('Pumpkin Pie', '🥧', 70, 0, 25, true), { hp: 30, pow: 15, mend: 15 }, 1200),
  hunters_feast: BUFF(F("Hunter's Feast", '🍱', 90, 30, 30, true), { hp: 45, pow: 22, mend: 22, speed: 6 }, 1800),
  // seeds
  wheat_seeds: { n: 'Wheat Seeds', i: '🌱', seed: 'wheat' }, carrot_seeds: { n: 'Carrot Seeds', i: '🌱', seed: 'carrot' },
  potato_seeds: { n: 'Potato Seeds', i: '🌱', seed: 'potato' }, pumpkin_seeds: { n: 'Pumpkin Seeds', i: '🌱', seed: 'pumpkin' },
  corn_seeds: { n: 'Corn Seeds', i: '🌱', seed: 'corn' }, flax_seeds: { n: 'Flax Seeds', i: '🌱', seed: 'flax' },
  // tools & weapons
  stone_axe: T('Stone Axe', '🪓', 'axe', 2, 3, 70), stone_pickaxe: T('Stone Pickaxe', '⛏️', 'pickaxe', 2, 2, 70),
  iron_axe: T('Iron Axe', '🪓', 'axe', 4, 5, 220), iron_pickaxe: T('Iron Pickaxe', '⛏️', 'pickaxe', 4, 4, 220),
  hammer: T('Building Hammer', '🔨', 'hammer', 0, 2, 400), hoe: T('Hoe', IC_HOE, 'hoe', 0, 2, 120),
  stone_spear: T('Stone Spear', '🔱', 'spear', 0, 6, 60, 3.8), iron_sword: T('Iron Sword', '🗡️', 'sword', 0, 11, 200, 3.2),
  bow: T('Bow', '🏹', 'bow', 0, 8, 120), arrow: { n: 'Arrow', i: '➶' },
  fishing_rod: T('Fishing Rod', '🎣', 'rod', 0, 1, 60), torch: T('Torch', '🔥', 'torch', 0, 2, 300),
  waterskin: { n: 'Waterskin', i: '🫗', dur: 5, empty: true, tool: 'water' },
  bandage: { n: 'Bandage', i: '🩹', heal: 35 },
  wood_staff: T('Wooden Staff', '🪄', 'staff', 0, 4, 150, 14), iron_spear: T('Iron Spear', '🔱', 'spear', 0, 10, 200, 3.8),
  steel_sword: T('Steel Sword', '⚔️', 'sword', 0, 17, 320, 3.2), steel_spear: T('Steel Spear', '🔱', 'spear', 0, 16, 320, 3.8),
  longbow: T('Longbow', '🏹', 'bow', 0, 14, 260), runed_staff: T('Runed Staff', '🔮', 'staff', 0, 7, 300, 14),
  // armor
  cloth_hood: A('Cloth Hood', '🎓', 'head', 'cloth'), cloth_robe: A('Cloth Robe', '🥼', 'chest', 'cloth'), cloth_pants: A('Cloth Leggings', '🩳', 'legs', 'cloth'),
  leather_cap: A('Leather Cap', '🧢', 'head', 'leather'), leather_tunic: A('Leather Tunic', '🦺', 'chest', 'leather'), leather_pants: A('Leather Trousers', '👖', 'legs', 'leather'),
  iron_helm: A('Iron Helm', '🪖', 'head', 'plate'), iron_armor: A('Iron Breastplate', '🛡️', 'chest', 'plate'), iron_greaves: A('Iron Greaves', '🦿', 'legs', 'plate'),
  silk_hood: A('Silk Hood', '🎓', 'head', 'cloth', 2), silk_robe: A('Silk Robe', '🥼', 'chest', 'cloth', 2), silk_pants: A('Silk Leggings', '🩳', 'legs', 'cloth', 2),
  hard_cap: A('Hardened Cap', '🧢', 'head', 'leather', 2), hard_tunic: A('Hardened Tunic', '🦺', 'chest', 'leather', 2), hard_pants: A('Hardened Trousers', '👖', 'legs', 'leather', 2),
  steel_helm: A('Steel Helm', '🪖', 'head', 'plate', 2), steel_armor: A('Steel Breastplate', '🛡️', 'chest', 'plate', 2), steel_greaves: A('Steel Greaves', '🦿', 'legs', 'plate', 2),
  // bags add inventory slots while worn
  satchel: { n: 'Leather Satchel', i: '👝', slot: 'bag', bag: 8 }, pack: { n: "Traveler's Pack", i: '🎒', slot: 'bag', bag: 16 },
};
for (const k of ['stone_spear', 'iron_sword', 'bow', 'wood_staff', 'iron_spear', 'steel_sword', 'steel_spear', 'longbow', 'runed_staff']) { ITEMS[k].gear = true; ITEMS[k].base = { dmg: ITEMS[k].dmg }; if (k.startsWith('steel') || k === 'longbow' || k === 'runed_staff') ITEMS[k].tr = 2; }

// ---- classes, stats, zones ----
export const QUAL = [['Common', '#d9d2c2'], ['Fine', '#6fd36f'], ['Superior', '#5aa9ff'], ['Epic', '#c77dff']];
export const STAT_N = { dmg: 'Damage', arm: 'Armor', hp: 'Health', pow: 'Power', mend: 'Healing', speed: 'Speed' };
// your class follows the weapon in your hand: [name, role, icon, ability]
export const CLASSES = { sword: ['Guardian', 'Tank', '🛡️', 'Taunt'], spear: ['Striker', 'Melee DPS', '⚔️', 'Power Strike'], bow: ['Ranger', 'Ranged DPS', '🏹', 'Aimed Shot'], staff: ['Mender', 'Healer', '✨', 'Group Heal'] };
export const ABIL_CD = { sword: 12, spear: 8, bow: 8, staff: 20 };
export const WSKILL = { sword: 'melee', spear: 'melee', bow: 'archery', staff: 'healing' };
export const SET_BONUS = { plate: ['hp', 30, 'Plate set: +30 Health'], leather: ['pow', 10, 'Leather set: +10% Power'], cloth: ['mend', 15, 'Cloth set: +15% Healing'] };
export const combatLevel = sk => Math.max(sk.melee?.l || 1, sk.archery?.l || 1, sk.defense?.l || 1, sk.healing?.l || 1);
// Fights against higher-level monsters are hard on purpose: a red (2+ above you) can kill a lone player.
// youHit = how hard you hit it, itHits = how hard it hits you, by how many levels it is above you (d)
export const lvlMods = d => d > 0 ? { youHit: Math.max(.3, 1 - .22 * d), itHits: 1 + .55 * d } : { youHit: 1 + Math.min(.5, -d * .1), itHits: Math.max(.4, 1 + .15 * d) };
export const mobName = (n, L) => (L >= 20 ? 'Ancient ' : L >= 10 ? 'Dire ' : '') + n;
// seconds between attacks: slower, heavier weapons hit less often; fists and tools are quick but weak
export const ATK_SPD = { sword: .9, spear: 1.1, bow: .9, staff: 1.3 };
export const atkSpd = tool => ATK_SPD[tool] || .7;
export const conColor = (mob, me) => { const d = mob - me; return d < -2 ? '#9a9a9a' : d === -2 ? '#4caf50' : d === -1 ? '#4a90e2' : d === 0 ? '#ffffff' : d === 1 ? '#f5d142' : '#e5484d'; };
export const gearSt = it => (it && (it.st || ITEMS[it.id]?.base)) || {};
export function calcStats(equip, skills, buff, held) {
  const s = { arm: 0, hp: 100 + 4 * ((skills.defense?.l || 1) - 1), pow: 0, mend: 0, speed: 0, set: null }, mats = {};
  for (const k of ['head', 'chest', 'legs']) { const it = equip[k]; if (!it || !ITEMS[it.id]) continue; const st = gearSt(it); for (const a in st) if (a in s) s[a] += st[a]; const m = ITEMS[it.id].mat; mats[m] = (mats[m] || 0) + 1; }
  for (const m in mats) if (mats[m] === 3) { s.set = m; s[SET_BONUS[m][0]] += SET_BONUS[m][1]; }
  if (held && ITEMS[held.id]?.gear) { const st = gearSt(held); for (const a in st) if (a !== 'dmg' && a in s) s[a] += st[a]; }
  if (buff && buff.until > Date.now() && ITEMS[buff.id]?.buff) { const st = ITEMS[buff.id].buff.st; for (const a in st) s[a] += st[a]; }
  s.arm = Math.min(70, s.arm); return s;
}
export const UPGRADE = { 2: { plank: 10, iron_bar: 4 }, 3: { plank: 20, steel_bar: 6 } };       // cost to raise a crafting station to that tier (+5 storage each)

for (const k in ITEMS) { if (ITEMS[k].n.includes('Iron') && ITEMS[k].tool) ITEMS[k].tier = 'iron'; }

// World resource nodes.  pick:true = gather with E, otherwise swing the right tool at it.
export const NODES = {
  oak: { n: 'Oak Tree', tool: 'axe', hp: 10, drop: 'wood', skill: 'woodcutting', xp: 4, respawn: 300, r: .55, extra: [['apple', .2], ['stick', .3]] },
  pine: { n: 'Pine Tree', tool: 'axe', hp: 10, drop: 'wood', skill: 'woodcutting', xp: 4, respawn: 300, r: .5, extra: [['stick', .4]] },
  birch: { n: 'Birch Tree', tool: 'axe', hp: 8, drop: 'wood', skill: 'woodcutting', xp: 4, respawn: 260, r: .45, extra: [['stick', .3], ['fiber', .2]] },
  rock: { n: 'Boulder', tool: 'pickaxe', hp: 10, drop: 'stone', skill: 'mining', xp: 4, respawn: 300, r: 1, extra: [['flint', .35], ['coal', .08]] },
  iron: { n: 'Iron Vein', tool: 'pickaxe', hp: 12, drop: 'iron_ore', skill: 'mining', xp: 7, respawn: 480, r: 1, extra: [['stone', .4]] },
  coal: { n: 'Coal Seam', tool: 'pickaxe', hp: 10, drop: 'coal', skill: 'mining', xp: 6, respawn: 420, r: 1, extra: [['stone', .4]] },
  pebbles: { n: 'Loose Stones', pick: true, verb: 'Pick up', skill: 'mining', xp: 5, respawn: 200, drops: [['stone', 2, 3, 1], ['flint', 1, 1, .5]] },
  branch: { n: 'Fallen Branch', pick: true, verb: 'Pick up', skill: 'woodcutting', xp: 5, respawn: 200, drops: [['stick', 2, 4, 1], ['wood', 1, 1, .3]] },
  bush: { n: 'Berry Bush', pick: true, verb: 'Pick', skill: 'foraging', xp: 6, respawn: 240, drops: [['berries', 2, 4, 1]] },
  fiber: { n: 'Tall Grass', pick: true, verb: 'Gather', skill: 'foraging', xp: 5, respawn: 180, drops: [['fiber', 2, 3, 1], ['wheat_seeds', 1, 1, .15], ['flax_seeds', 1, 1, .15]] },
  mushroom: { n: 'Mushrooms', pick: true, verb: 'Pick', skill: 'foraging', xp: 6, respawn: 260, drops: [['mushroom', 1, 3, 1]] },
  clay: { n: 'Clay Deposit', pick: true, verb: 'Dig', skill: 'mining', xp: 6, respawn: 260, drops: [['clay', 2, 3, 1]] },
  wild_carrot: { n: 'Wild Carrots', pick: true, verb: 'Pull up', skill: 'foraging', xp: 8, respawn: 400, drops: [['carrot', 1, 2, 1], ['carrot_seeds', 1, 2, 1]] },
  wild_potato: { n: 'Wild Potatoes', pick: true, verb: 'Dig up', skill: 'foraging', xp: 8, respawn: 400, drops: [['potato', 1, 2, 1], ['potato_seeds', 1, 2, 1]] },
  wild_pumpkin: { n: 'Wild Pumpkin', pick: true, verb: 'Pick', skill: 'foraging', xp: 8, respawn: 400, drops: [['pumpkin', 1, 1, 1], ['pumpkin_seeds', 1, 2, 1]] },
  wild_corn: { n: 'Wild Corn', pick: true, verb: 'Pick', skill: 'foraging', xp: 8, respawn: 400, drops: [['corn', 1, 2, 1], ['corn_seeds', 1, 2, 1]] },
};

// mode: flee = runs away, defend = fights back if hit, hunt = attacks players (unless PEACEFUL). minL = lowest zone level it lives in.
// Stats are for level 1; health, damage and xp scale up with the zone level where it spawns.
export const ANIMALS = {
  rabbit: { n: 'Rabbit', hp: 6, walk: 1.6, run: 6, sense: 7, mode: 'flee', xp: 10, count: 60, biomes: ['meadow'], drops: [['raw_meat', 1, 1, 1], ['hide', 1, 1, .5]] },
  fowl: { n: 'Wild Hen', hp: 4, walk: 1.2, run: 4.5, sense: 6, mode: 'flee', xp: 8, count: 45, biomes: ['meadow', 'forest'], drops: [['raw_meat', 1, 1, 1], ['feather', 2, 4, 1]] },
  deer: { n: 'Deer', hp: 18, walk: 1.8, run: 7, sense: 11, mode: 'flee', xp: 22, count: 45, biomes: ['forest', 'meadow'], drops: [['raw_meat', 2, 3, 1], ['hide', 1, 2, 1], ['bone', 1, 2, .6]] },
  boar: { n: 'Boar', hp: 26, walk: 1.4, run: 5, sense: 0, mode: 'defend', dmg: 6, xp: 28, count: 30, biomes: ['forest'], drops: [['raw_meat', 2, 4, 1], ['hide', 1, 1, 1], ['bone', 1, 2, 1]] },
  wolf: { n: 'Wolf', hp: 20, walk: 1.8, run: 5.6, sense: 14, mode: 'hunt', dmg: 6, xp: 35, count: 50, minL: 2, biomes: ['forest', 'rock', 'meadow'], drops: [['hide', 1, 2, 1], ['bone', 1, 2, 1], ['fang', 1, 2, .7], ['raw_meat', 1, 1, .5]] },
  spider: { n: 'Giant Spider', hp: 16, walk: 1.6, run: 5.2, sense: 12, mode: 'hunt', dmg: 5, xp: 32, count: 45, minL: 3, biomes: ['forest'], drops: [['spider_silk', 1, 2, 1], ['fang', 1, 1, .3]] },
  bear: { n: 'Bear', hp: 40, walk: 1.4, run: 5.4, sense: 11, mode: 'hunt', dmg: 9, xp: 60, count: 40, minL: 5, biomes: ['forest', 'rock'], drops: [['raw_meat', 3, 5, 1], ['thick_hide', 1, 2, 1], ['bone', 2, 3, 1], ['fang', 1, 2, .5]] },
};

export const CROPS = {
  wheat: { n: 'Wheat', grow: 180, out: 'wheat', min: 2, max: 4, seed: 'wheat_seeds', c: '#e8c84a' },
  carrot: { n: 'Carrots', grow: 200, out: 'carrot', min: 2, max: 4, seed: 'carrot_seeds', c: '#f08a2c' },
  potato: { n: 'Potatoes', grow: 220, out: 'potato', min: 3, max: 5, seed: 'potato_seeds', c: '#f4f1e4' },
  corn: { n: 'Corn', grow: 260, out: 'corn', min: 2, max: 4, seed: 'corn_seeds', c: '#f6d743' },
  pumpkin: { n: 'Pumpkins', grow: 320, out: 'pumpkin', min: 1, max: 3, seed: 'pumpkin_seeds', c: '#f07a18' },
  flax: { n: 'Flax', grow: 200, out: 'flax', min: 2, max: 4, seed: 'flax_seeds', c: '#6f9cf0' },
};

// station: null = craft anywhere. sk/lvl = skill requirement.
// learn:true = the recipe must first be learned from a Recipe scroll (monster loot). tier = station tier needed.
const R = (out, n, inp, station = null, lvl = 1, sk = 'crafting', xp = 8, o = {}) => ({ id: out, out, n, in: inp, station, lvl, sk, xp, ...o });
const L2 = { learn: true, tier: 2 };
export const RECIPES = [
  R('rope', 1, { fiber: 3 }), R('stone_axe', 1, { stick: 2, stone: 2, fiber: 2 }, null, 1, 'crafting', 15),
  R('stone_pickaxe', 1, { stick: 2, stone: 3, fiber: 2 }, null, 1, 'crafting', 15), R('hammer', 1, { stick: 1, stone: 2, fiber: 1 }, null, 1, 'crafting', 15),
  R('stone_spear', 1, { stick: 2, flint: 1, fiber: 2 }, null, 1, 'crafting', 15), R('torch', 1, { stick: 1, fiber: 2 }), R('bandage', 1, { fiber: 4 }),
  R('plank', 2, { wood: 1 }, 'workbench', 1, 'crafting', 5), R('hoe', 1, { stick: 2, stone: 1, fiber: 2 }, 'workbench', 1, 'crafting', 15),
  R('leather', 1, { hide: 1, fiber: 1 }, 'workbench', 2), R('bow', 1, { stick: 3, rope: 2 }, 'workbench', 2, 'crafting', 20),
  R('arrow', 5, { stick: 1, flint: 1, feather: 1 }, 'workbench', 2), R('fishing_rod', 1, { stick: 2, rope: 1, bone: 1 }, 'workbench', 3, 'crafting', 20),
  R('waterskin', 1, { leather: 1, rope: 1 }, 'workbench', 2, 'crafting', 15), R('leather_tunic', 1, { leather: 4, rope: 1 }, 'workbench', 4, 'crafting', 30),
  R('cooked_meat', 1, { raw_meat: 1 }, 'campfire', 1, 'cooking', 8), R('cooked_fish', 1, { raw_fish: 1 }, 'campfire', 1, 'cooking', 8),
  R('baked_potato', 1, { potato: 1 }, 'campfire', 1, 'cooking', 6), R('roasted_corn', 1, { corn: 1 }, 'campfire', 1, 'cooking', 6),
  R('berry_juice', 1, { berries: 4 }, 'campfire', 2, 'cooking', 8), R('mushroom_soup', 1, { mushroom: 3 }, 'campfire', 2, 'cooking', 10),
  R('bread', 1, { wheat: 3 }, 'campfire', 3, 'cooking', 12), R('stew', 1, { raw_meat: 1, carrot: 1, potato: 1 }, 'campfire', 5, 'cooking', 20),
  R('pumpkin_pie', 1, { pumpkin: 1, wheat: 2 }, 'campfire', 8, 'cooking', 25),
  R('iron_bar', 1, { iron_ore: 2, coal: 1 }, 'furnace', 3, 'crafting', 15), R('brick', 2, { clay: 2, wood: 1 }, 'furnace', 2, 'crafting', 8),
  R('nails', 4, { iron_bar: 1 }, 'anvil', 4), R('iron_axe', 1, { iron_bar: 2, stick: 2 }, 'anvil', 6, 'crafting', 40),
  R('iron_pickaxe', 1, { iron_bar: 3, stick: 2 }, 'anvil', 6, 'crafting', 40), R('iron_sword', 1, { iron_bar: 3, stick: 1, leather: 1 }, 'anvil', 8, 'crafting', 45),
  R('iron_armor', 1, { iron_bar: 6, leather: 2 }, 'anvil', 10, 'crafting', 60), R('iron_helm', 1, { iron_bar: 3 }, 'anvil', 8, 'crafting', 40),
  R('iron_greaves', 1, { iron_bar: 4 }, 'anvil', 9, 'crafting', 45), R('iron_spear', 1, { iron_bar: 2, stick: 3 }, 'anvil', 6, 'crafting', 40),
  R('cloth', 1, { flax: 3 }, 'loom', 3, 'crafting', 10),
  R('cloth_hood', 1, { cloth: 3 }, 'loom', 3, 'crafting', 25), R('cloth_robe', 1, { cloth: 5, rope: 1 }, 'loom', 4, 'crafting', 35), R('cloth_pants', 1, { cloth: 4 }, 'loom', 4, 'crafting', 30),
  R('leather_cap', 1, { leather: 2 }, 'workbench', 3, 'crafting', 25), R('leather_pants', 1, { leather: 3 }, 'workbench', 4, 'crafting', 30),
  R('wood_staff', 1, { stick: 4, rope: 1, feather: 2 }, 'workbench', 2, 'crafting', 20), R('satchel', 1, { leather: 4, rope: 2 }, 'workbench', 4, 'crafting', 35),
  R('hunters_feast', 1, { raw_meat: 2, pumpkin: 1, corn: 1, carrot: 1 }, 'campfire', 12, 'cooking', 40),
  R('steel_bar', 1, { iron_bar: 2, coal: 2 }, 'furnace', 10, 'crafting', 25, { tier: 2 }),
  // tier 2: learned from recipe scrolls
  R('silk_hood', 1, { spider_silk: 3, cloth: 2 }, 'loom', 12, 'crafting', 60, L2), R('silk_robe', 1, { spider_silk: 5, cloth: 3 }, 'loom', 12, 'crafting', 80, L2), R('silk_pants', 1, { spider_silk: 4, cloth: 2 }, 'loom', 12, 'crafting', 70, L2),
  R('hard_cap', 1, { thick_hide: 2, leather: 2 }, 'workbench', 12, 'crafting', 60, L2), R('hard_tunic', 1, { thick_hide: 4, leather: 3 }, 'workbench', 12, 'crafting', 80, L2), R('hard_pants', 1, { thick_hide: 3, leather: 2 }, 'workbench', 12, 'crafting', 70, L2),
  R('steel_helm', 1, { steel_bar: 3 }, 'anvil', 14, 'crafting', 60, L2), R('steel_armor', 1, { steel_bar: 6, leather: 2 }, 'anvil', 14, 'crafting', 80, L2), R('steel_greaves', 1, { steel_bar: 4 }, 'anvil', 14, 'crafting', 70, L2),
  R('steel_sword', 1, { steel_bar: 3, leather: 1, fang: 2 }, 'anvil', 12, 'crafting', 70, L2), R('steel_spear', 1, { steel_bar: 2, stick: 3, fang: 2 }, 'anvil', 12, 'crafting', 70, L2),
  R('longbow', 1, { stick: 4, rope: 2, fang: 2, spider_silk: 2 }, 'workbench', 12, 'crafting', 70, L2), R('runed_staff', 1, { stick: 4, spider_silk: 3, fang: 1 }, 'loom', 12, 'crafting', 70, L2),
  R('pack', 1, { thick_hide: 4, leather: 4, rope: 3 }, 'workbench', 10, 'crafting', 60, L2),
];
// every learnable recipe has a scroll item that monsters can drop
export const SCROLLS = [];
for (const r of RECIPES) if (r.learn) { ITEMS['r_' + r.id] = { n: 'Recipe: ' + ITEMS[r.out].n, i: '📜', learn: r.id }; SCROLLS.push('r_' + r.id); }
export const STATION_NAMES = { workbench: 'Workbench', campfire: 'Campfire', furnace: 'Furnace', anvil: 'Anvil', loom: 'Loom' };

// kind: place = free-standing, foundation/wall/floor/roof/stairs = snaps to the 4m building grid.
const B = (n, i, cat, kind, cost, lvl = 1, o = {}) => ({ n, i, cat, kind, cost, lvl, ...o });
export const STRUCTS = {
  campfire: B('Campfire', '🔥', 'Camp', 'place', { stone: 5, wood: 3 }, 1, { station: 'campfire', store: 10, r: .7, free: true }),
  workbench: B('Workbench', '🛠️', 'Camp', 'place', { wood: 10, stone: 4 }, 1, { station: 'workbench', store: 10, r: .9 }),
  chest: B('Storage Chest', '📦', 'Camp', 'place', { plank: 8 }, 1, { r: .6 }),
  bed: B('Bed', '🛏️', 'Camp', 'place', { plank: 8, fiber: 6, hide: 2 }, 1, { r: .9 }),
  torch_post: B('Torch Post', '🕯️', 'Camp', 'place', { stick: 2, fiber: 2 }, 1, { r: .2 }),
  furnace: B('Furnace', '🏭', 'Camp', 'place', { stone: 20, clay: 6 }, 3, { station: 'furnace', store: 10, r: 1 }),
  anvil: B('Anvil', '⚒️', 'Camp', 'place', { iron_bar: 4, wood: 4 }, 4, { station: 'anvil', store: 10, r: .7 }),
  loom: B('Loom', '🧶', 'Camp', 'place', { plank: 12, rope: 4 }, 3, { station: 'loom', store: 10, r: .9 }),
  well: B('Well', '⛲', 'Camp', 'place', { stone: 20, plank: 4, rope: 2 }, 4, { r: 1.2 }),
  farm_plot: B('Farm Plot', '🌱', 'Farm', 'place', { fiber: 2 }, 1, { needs: 'hoe', flat: true }),
  fence: B('Fence', '🚧', 'Farm', 'wall', { stick: 4 }, 1, { h: 1.2 }),
  wood_foundation: B('Wood Foundation', '🟫', 'Building', 'foundation', { wood: 6 }),
  wood_wall: B('Wood Wall', IC_WOODWALL, 'Building', 'wall', { plank: 4 }, 1, { h: 3 }),
  wood_doorway: B('Wood Door', '🚪', 'Building', 'wall', { plank: 5 }, 1, { h: 3, door: true }),
  wood_window: B('Wood Window', '🪟', 'Building', 'wall', { plank: 3 }, 2, { h: 3 }),
  wood_floor: B('Wood Ceiling / Upper Floor', '⬛', 'Building', 'floor', { plank: 4 }, 2),
  wood_stairs: B('Wood Stairs', '🪜', 'Building', 'stairs', { plank: 6 }, 3),
  wood_roof: B('Thatch Roof', '🛖', 'Building', 'roof', { plank: 2, fiber: 6 }, 2),
  wood_gable: B('Wood Gable (roof end)', IC_GABLE('#b9814f'), 'Building', 'wall', { plank: 2 }, 2, { h: 1.5, gable: true }),
  stone_foundation: B('Stone Foundation', '⬜', 'Building', 'foundation', { stone: 12 }, 5),
  stone_wall: B('Stone Wall', '🧱', 'Building', 'wall', { stone: 6, brick: 2 }, 6, { h: 3 }),
  stone_doorway: B('Stone Door', '🚪', 'Building', 'wall', { stone: 5, brick: 2, plank: 2 }, 6, { h: 3, door: true }),
  stone_window: B('Stone Window', '🪟', 'Building', 'wall', { stone: 4, brick: 2 }, 7, { h: 3 }),
  stone_roof: B('Slate Roof', '🏠', 'Building', 'roof', { stone: 4, plank: 2 }, 8),
  stone_gable: B('Stone Gable (roof end)', IC_GABLE('#a3a9ae'), 'Building', 'wall', { stone: 3, brick: 1 }, 6, { h: 1.5, gable: true }),
  clan_banner: B('Clan Banner', '🚩', 'Clan', 'place', { plank: 4, fiber: 8 }, 1, { clan: true, r: .2 }),
};

export const QUESTS = [
  { t: 'Punch a tree (left click) to collect 4 sticks', have: ['stick', 4] },
  { t: 'Find 3 stones — look for loose stones on the ground', have: ['stone', 3] },
  { t: 'Gather 4 plant fiber from tall grass (press E)', have: ['fiber', 4] },
  { t: 'Open crafting (C) and make a Stone Axe', ev: 'craft:stone_axe' },
  { t: 'Chop trees with your axe for 6 wood', have: ['wood', 6] },
  { t: 'Craft a Building Hammer', ev: 'craft:hammer' },
  { t: 'Open the build menu (B) and place a Campfire', ev: 'build:campfire' },
  { t: 'Build a Workbench', ev: 'build:workbench' },
  { t: 'Craft a Stone Pickaxe and a Stone Spear', ev: 'craft:stone_spear', give: { berries: 5 } },
  { t: 'Hunt an animal for raw meat', have: ['raw_meat', 1] },
  { t: 'Cook a meal at your campfire', ev: 'cook' },
  { t: 'Craft a Hoe at the workbench and place a Farm Plot', ev: 'build:farm_plot', give: { wheat_seeds: 3, carrot_seeds: 2 } },
  { t: 'Plant a seed in your farm plot', ev: 'plant' },
  { t: 'Harvest a crop when it is ripe', ev: 'harvest' },
  { t: 'Build a Bed so you wake up at home', ev: 'build:bed' },
  { t: 'Build a house and put a roof on it', ev: 'build:roof' },
  { t: 'Start or join a clan (G) with your family', ev: 'clan' },
  { t: 'Build a Furnace and smelt an Iron Bar', ev: 'craft:iron_bar' },
  { t: 'Forge an iron tool at an Anvil', ev: 'craft:iron' },
];
