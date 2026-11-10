// All game content lives here: tweak numbers, add items/recipes, and both server and client pick it up.
export const DAY_LEN = 20 * 60;          // seconds per full day
export const MAX_LVL = 50;
export const xpNeed = l => Math.floor(40 * Math.pow(l, 1.5));

export const SKILLS = {
  woodcutting: { n: 'Woodcutting', i: '🪓', d: 'Bonus wood when chopping' },
  mining: { n: 'Mining', i: '⛏️', d: 'Bonus stone and ore' },
  foraging: { n: 'Foraging', i: '🌿', d: 'Bonus berries, fiber and finds' },
  farming: { n: 'Farming', i: '🌾', d: 'Faster crops, bigger harvests' },
  hunting: { n: 'Hunting', i: '🏹', d: 'More damage and loot' },
  fishing: { n: 'Fishing', i: '🎣', d: 'Faster bites' },
  crafting: { n: 'Crafting', i: '🛠️', d: 'New recipes, tougher tools' },
  cooking: { n: 'Cooking', i: '🍲', d: 'New meals, food fills you more' },
  building: { n: 'Building', i: '🏠', d: 'New building pieces' },
};

// Small drawn icons where no emoji fits. Icons are only ever inserted as HTML.
const SVG = b => `<svg class="svgi" viewBox="0 0 24 24" width="1em" height="1em">${b}</svg>`;
const IC_HOE = SVG('<path d="M4.5 21.5 16 6" stroke="#8a5a33" stroke-width="2.6" stroke-linecap="round"/><path d="M13.2 3.2 20.8 8.8 21.6 15.2 17.2 13.6 15.6 9.2 11.6 6z" fill="#c3cad1" stroke="#59616a" stroke-width="1.1" stroke-linejoin="round"/>');
const IC_WOODWALL = SVG('<rect x="2" y="3.5" width="20" height="17" rx="1.5" fill="#b9814f" stroke="#5e3d22" stroke-width="1.4"/><path d="M7 3.5v17M12 3.5v17M17 3.5v17" stroke="#5e3d22" stroke-width="1.2"/><path d="M2.5 8.5h19M2.5 15.5h19" stroke="#8a5a33" stroke-width="1.6"/>');
const IC_GABLE = c => SVG(`<path d="M2 20 12 4 22 20z" fill="${c}" stroke="#3d2a18" stroke-width="1.4" stroke-linejoin="round"/><path d="M7 20v-8M12 20V4M17 20v-8" stroke="#3d2a18" stroke-width="1" opacity=".7"/>`);
const T = (n, i, tool, pow, dmg, dur, reach = 3) => ({ n, i, tool, pow, dmg, dur, reach });
const F = (n, i, h, t = 0, hp = 0, cooked = false) => ({ n, i, food: { h, t, hp }, cooked });
export const ITEMS = {
  // materials
  wood: { n: 'Wood', i: '🪵' }, stick: { n: 'Stick', i: '🥢' }, stone: { n: 'Stone', i: '🪨' }, flint: { n: 'Flint', i: '🔺' },
  fiber: { n: 'Plant Fiber', i: '🌿' }, clay: { n: 'Clay', i: '🟤' }, coal: { n: 'Coal', i: '⚫' }, iron_ore: { n: 'Iron Ore', i: '🟠' },
  plank: { n: 'Plank', i: '🟫' }, rope: { n: 'Rope', i: '🪢' }, cloth: { n: 'Cloth', i: '🧵' }, flax: { n: 'Flax', i: '💠' },
  hide: { n: 'Hide', i: '🦬' }, leather: { n: 'Leather', i: '👜' }, bone: { n: 'Bone', i: '🦴' }, feather: { n: 'Feather', i: '🪶' },
  iron_bar: { n: 'Iron Bar', i: '🔩' }, nails: { n: 'Nails', i: '📌' }, brick: { n: 'Brick', i: '🧱' },
  // food
  berries: F('Berries', '🫐', 8, 4), mushroom: F('Mushroom', '🍄', 6), apple: F('Apple', '🍎', 10, 5),
  raw_meat: F('Raw Meat', '🥩', 6), raw_fish: F('Raw Fish', '🐟', 6),
  wheat: { n: 'Wheat', i: '🌾' }, carrot: F('Carrot', '🥕', 10, 3), potato: F('Potato', '🥔', 6), pumpkin: F('Pumpkin', '🎃', 10, 4), corn: F('Corn', '🌽', 8, 2),
  cooked_meat: F('Cooked Meat', '🍖', 35, 0, 8, true), cooked_fish: F('Grilled Fish', '🍤', 30, 0, 8, true),
  baked_potato: F('Baked Potato', '🥔', 22, 0, 4, true), roasted_corn: F('Roasted Corn', '🌽', 22, 0, 4, true),
  bread: F('Bread', '🍞', 30, 0, 5, true), mushroom_soup: F('Mushroom Soup', '🥣', 28, 20, 8, true),
  berry_juice: F('Berry Juice', '🧃', 8, 45, 5, true), stew: F('Hearty Stew', '🍲', 60, 25, 20, true),
  pumpkin_pie: F('Pumpkin Pie', '🥧', 70, 0, 25, true),
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
  leather_tunic: { n: 'Leather Tunic', i: '🦺', armor: 0.25 }, iron_armor: { n: 'Iron Armor', i: '🛡️', armor: 0.5 },
};
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

// mode: flee = runs away, defend = fights back if hit, hunt = attacks at night (unless PEACEFUL)
export const ANIMALS = {
  rabbit: { n: 'Rabbit', hp: 6, walk: 1.6, run: 6, sense: 7, mode: 'flee', xp: 10, count: 16, biomes: ['meadow'], drops: [['raw_meat', 1, 1, 1], ['hide', 1, 1, .5]] },
  fowl: { n: 'Wild Hen', hp: 4, walk: 1.2, run: 4.5, sense: 6, mode: 'flee', xp: 8, count: 14, biomes: ['meadow', 'forest'], drops: [['raw_meat', 1, 1, 1], ['feather', 2, 4, 1]] },
  deer: { n: 'Deer', hp: 18, walk: 1.8, run: 7, sense: 11, mode: 'flee', xp: 22, count: 12, biomes: ['forest', 'meadow'], drops: [['raw_meat', 2, 3, 1], ['hide', 1, 2, 1], ['bone', 1, 2, .6]] },
  boar: { n: 'Boar', hp: 26, walk: 1.4, run: 5, sense: 0, mode: 'defend', dmg: 6, xp: 28, count: 8, biomes: ['forest'], drops: [['raw_meat', 2, 4, 1], ['hide', 1, 1, 1], ['bone', 1, 2, 1]] },
  wolf: { n: 'Wolf', hp: 22, walk: 1.8, run: 5.6, sense: 15, mode: 'hunt', dmg: 8, xp: 35, count: 6, biomes: ['forest', 'rock'], drops: [['hide', 1, 2, 1], ['bone', 1, 2, 1], ['raw_meat', 1, 1, .5]] },
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
const R = (out, n, inp, station = null, lvl = 1, sk = 'crafting', xp = 8) => ({ id: out, out, n, in: inp, station, lvl, sk, xp });
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
  R('iron_armor', 1, { iron_bar: 6, leather: 2 }, 'anvil', 12, 'crafting', 60),
  R('cloth', 1, { flax: 3 }, 'loom', 3, 'crafting', 10),
];
export const STATION_NAMES = { workbench: 'Workbench', campfire: 'Campfire', furnace: 'Furnace', anvil: 'Anvil', loom: 'Loom' };

// kind: place = free-standing, foundation/wall/floor/roof/stairs = snaps to the 4m building grid.
const B = (n, i, cat, kind, cost, lvl = 1, o = {}) => ({ n, i, cat, kind, cost, lvl, ...o });
export const STRUCTS = {
  campfire: B('Campfire', '🔥', 'Camp', 'place', { stone: 5, wood: 3 }, 1, { station: 'campfire', r: .7, free: true }),
  workbench: B('Workbench', '🛠️', 'Camp', 'place', { wood: 10, stone: 4 }, 1, { station: 'workbench', r: .9 }),
  chest: B('Storage Chest', '📦', 'Camp', 'place', { plank: 8 }, 1, { r: .6 }),
  bed: B('Bed', '🛏️', 'Camp', 'place', { plank: 8, fiber: 6, hide: 2 }, 1, { r: .9 }),
  torch_post: B('Torch Post', '🕯️', 'Camp', 'place', { stick: 2, fiber: 2 }, 1, { r: .2 }),
  furnace: B('Furnace', '🏭', 'Camp', 'place', { stone: 20, clay: 6 }, 3, { station: 'furnace', r: 1 }),
  anvil: B('Anvil', '⚒️', 'Camp', 'place', { iron_bar: 4, wood: 4 }, 4, { station: 'anvil', r: .7 }),
  loom: B('Loom', '🧶', 'Camp', 'place', { plank: 12, rope: 4 }, 3, { station: 'loom', r: .9 }),
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
