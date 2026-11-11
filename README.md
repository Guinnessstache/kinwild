# Kinwild

A family multiplayer 3D survival game that runs in the browser. Third-person, low-poly island with gathering, hunting, fishing, farming, crafting, base building, use-based skills and clans.

Stack: Node.js + Express + Socket.IO (authoritative server), Three.js (client, no build step, no art files), Neon Postgres for saves, Render for hosting.

## Run it on your PC

    npm install
    npm start

Open http://localhost:3000. With no `DATABASE_URL` set, saves go to JSON files in `./data`, so it works with zero setup. Other computers on your home network can join at `http://<your-pc-ip>:3000`.

## Put it online (Neon + Render)

1. **Neon**: create a free project, copy the *pooled* connection string (`postgresql://...-pooler...neon.tech/neondb?sslmode=require`). The game creates its one table (`kinwild_kv`) by itself on first start.
2. **GitHub**: from this folder, one line at a time:

       git init
       git add .
       git commit -m "Kinwild build 1"
       git branch -M main
       git remote add origin https://github.com/Guinnessstache/kinwild.git
       git push -u origin main

3. **Render**: New > Blueprint > choose the repo (it reads `render.yaml`), paste the Neon string as `DATABASE_URL`. Or New > Web Service with build `npm install`, start `npm start`.

Free Render services sleep after about 15 minutes with nobody connected; the first visit afterwards takes up to a minute to wake. Nothing is lost: the world, players and clans are in Neon.

## Settings (environment variables)

| Variable | Default | What it does |
| --- | --- | --- |
| `DATABASE_URL` | unset | Neon/Postgres connection string. Unset = local files |
| `PEACEFUL` | `0` | `1` stops wolves from hunting players |
| `DAY_MINUTES` | `20` | Real minutes per in-game day |
| `PORT` | `3000` | Set automatically by Render |

## How to play

Each player picks a name and a PIN. Same name + PIN brings the character back on any computer.

| Key | Action |
| --- | --- |
| W A S D, Shift, Space | Move, run, jump |
| Mouse | Look (click the game first) |
| Left click | Use the held item: punch, chop, mine, attack, shoot, fish, eat, plant |
| E | Pick up, open, drink, harvest, use a station |
| 1-8 or wheel | Hotbar |
| Tab / C / B / G / M / H | Bag and skills / Craft / Build / Clan / Map / Help |
| X | Sneak (animals notice you from half as far) |
| R / Z | In build mode: turn the piece / raise the starting level. Walls stack on their own up to 3 high, and roofs land on the highest wall |
| K / T | With the hammer held: K takes apart the highlighted piece (half the materials back), T steps to the next piece in reach |
| Enter | Chat. `/c hello` talks to your clan only |
| Esc | Menu: graphics, sound volume, look speed, button hints, log out |

**Controller:** standard Xbox/PlayStation-style gamepads work in the browser (plug in or pair, then press any button). Left stick move, right stick look, A jump, X pick up / use, RT use held item (hold to keep swinging), LB/RB action bar, L3 run, LT sneak, R3 take apart, Y bag, D-pad up/right/left/down for craft/build/clan/map, Start for the menu. In menus: D-pad moves the highlight, A chooses (A on an item, then A on a slot moves it), X eats or quick-moves, LB/RB switch tabs, B closes. Building: RT place, X turn, Y floor, B done. Typing (name, PIN, chat, clan name) still needs a keyboard.

**Moving items:** drag them between the bag, a chest and the action bar (the bar at the bottom of the screen works as a drop target too); or point at an item and press 1-8; or shift-click; or click an item and then click where it goes.

The "Next step" box walks new players through 19 steps from punching a tree to forging iron.

## Build 13 changes

- The tutorial box under the minimap disappears once every step is done.
- More than twice as much tall grass (plant fiber) everywhere, including some on beaches and rocky ground, and it grows back in 1.5 minutes instead of 3.
- Hunger and thirst drain more slowly: a full belly lasts about 60 minutes (was 26) and full water about 45 minutes (was 18).

## Build 12 changes

- **Tab targeting.** Tab locks onto the nearest monster in front of you (Tab again for the next, Shift+Tab back). A red marker floats over it and a frame at the top shows its name, level, health and distance. Controller: tap **LT** to target (hold LT to sneak).
- With a target, **bow arrows fly straight at it** (within 45 m, unless a hill is in the way), including Aimed Shot. Melee swings, spear Power Strike and staff zaps go to the target when it's close enough.
- The bag moved to **I** only (Tab is now targeting).

## Build 11 changes

- **Short Walls** (2 m, wood and stone) in the Walls and Stone tabs. Aim at a wall and the short wall sits on top of it — use them to fill the gap under a ridge or a higher row of roof slopes. The roof's end triangle then closes the rest.

## Build 10 changes

- **New build mode.** Press **B** (controller: D-pad →) to start building. A palette at the bottom shows the pieces: **1–6** pick a type, the **mouse wheel** or **Q/E** (LB/RB) pick a piece. No more menus.
- **Aim with the dot.** Pieces snap to what the middle of the screen points at. Point at the edge of a foundation, floor or roof piece to add the next one beside it; point at a wall to stack another on top; point at a wall top to put a roof or ceiling over that room.
- **Right-click removes** the piece outlined in red (controller: Y), anywhere you can see it. You get half the materials back. The hammer also takes apart exactly the piece under the dot with a click.
- **F flies the camera** while building (controller: R3) and stays on while you switch pieces.
- **V toggles first-person view** (controller: R3 outside build mode).
- **Roof ends close themselves.** The last roof slope or ridge in a row gets a triangle end wall automatically, filled down to the wall top on wider houses, so gables are optional.
- The ghost piece turns red when you can't afford it.

## Build 9 changes

- Roofs are now angled **Roof Slope** pieces that snap together. A slope rises away from where you're facing (R turns it), and a slope placed behind another stacks on top of it, so any house width works.
- **Roof Ridge** caps the middle row on odd-width houses. **Gables** (roof end walls) shape themselves to the roof above them and fill down to the wall top.
- Old thatch roof pieces still work and show as ridges.

## Build 8 changes

- **Much bigger land**: about 1.5 km² of land, roughly 7 times the old island. The original island is unchanged in the middle.
- **Zones instead of rings**: 22 named zones with their own ground colour and plants (meadow, forest, marsh, autumn, highland, frost, dark). Monsters run from level 1 to 30; each zone covers three levels, and the outer zones are the toughest. The map shows zone borders, names and levels; the levels are coloured against your own.
- **Harder fights**: monsters above your level hit much harder and take less damage from you. A red monster (2+ levels above) beats a lone player; a yellow one is a fair fight. Weapons have attack speeds (sword 0.9s, spear 1.1s, bow 0.9s, staff 1.3s). Monsters above level 10 are "Dire", above 20 "Ancient", and grow a little with level.
- **Monster health bars** now go down as you hit them.
- **Craft tab** shows only the hand-made basics; everything else is made at its station (press E on it).
- **Microphone choice** in the menu (Esc).

## Build 7 changes

- The craft tab shows hand-made basics anywhere; each station's recipes show only when you are at that station (press E on it).
- Drawn icons for every armor piece (cloth, leather and plate, per slot, lighter for tier 2).
- Wider random stat rolls on crafted and looted gear (base stats -22% to +28%, plus a 50% chance of a bonus stat on top of quality bonuses).
- Free build camera flies up to 40 m out and 35 m up (Ctrl or L3 for double speed), and you can place pieces anywhere you can see within 45 m.

## Build 6 additions

- **Classes** follow the weapon in hand: sword = Guardian (tank, Taunt), spear = Striker (melee damage, Power Strike), bow = Ranger (ranged damage, Aimed Shot), staff = Mender (healer; left click heals the most hurt player nearby, Group Heal). Ability on Q (controller B). Four combat skills: Melee, Archery, Defense, Healing.
- **Gear**: head, chest and legs in cloth (healing), leather (power) or plate (armor and health), with a set bonus for three of a kind. Crafted and looted gear rolls a quality (Common, Fine, Superior, Epic) and random stats. Tier 2 gear and the Traveler's Pack need recipe scrolls that monsters drop. Bags add inventory slots.
- **Monster levels and zones**: monsters gain a level every 45 m from the starting meadow (1 to 10) and stand on a ring coloured by their level next to yours. New monsters: giant spiders and bears. Tougher monsters drop more, plus scrolls and gear.
- **Storage and crafting**: crafting uses ingredients from your bag and from your chests and stations in reach. Crafting stations hold 10 items and can be upgraded twice (+5 slots, tier 2 recipes). Sort buttons, and "Stack matching items" between bag and chests.
- **Food buffs**: bread, soup, juice, stew, pie and Hunter's Feast give timed bonuses.
- **Return Home** (F): 4 second cast, 30 minute cooldown, takes you to your bed.
- **Players panel** (P): who is online, parties of up to 5 with shared kill XP and party chat (/p), player-to-player trading, and proximity voice chat (WebRTC; needs a microphone and HTTPS or localhost).
- **Permissions**: in the menu, choose who can use your doors, chests and stations: only you, your clan, clan and party, or everyone.
- **Building**: free camera in build mode (V), stairs continue upward when placed past the top of another flight (4 flights), and trees or rocks under a building no longer grow back through it.
- **Controller**: on-screen keyboard for names, PIN and chat (A on a text box; Back/View opens chat).

## What is in build 1

- **Skills (9)**: woodcutting, mining, foraging, farming, hunting, fishing, crafting, cooking, building. Levels 1-50, earned by doing. They add bonus loot, speed up crops and bites, toughen crafted tools and unlock recipes and building pieces.
- **Gathering**: 16 kinds of resource nodes that respawn (trees, boulders, iron, coal, clay, berries, mushrooms, tall grass, wild crops).
- **Hunting and fishing**: rabbits, wild hens, deer, boar (fight back), wolves (hunt at night, never near a fire). Spear, sword, bow and arrows, fishing rod.
- **Farming**: farm plots, 6 crops, watering to speed growth, harvests that return seeds.
- **Crafting**: 32 recipes across hand, workbench, campfire, furnace, anvil and loom. Stone and iron tool tiers, armor, 9 cooked meals.
- **Building**: 26 pieces, including gables that close the triangle at each roof end. Snap-together wood and stone foundations, walls, doors, windows, upper floors, stairs and roofs, plus campfire, workbench, chest, bed, furnace, anvil, loom, well, torch post, fences.
- **Clans**: create, invite (works for offline players), leader/officer/member roles, clan notice, clan chat, clan colour and tag over names, shared chests/doors/farms/buildings, clan-mates on the map, clan XP and level, clan banner as a shared home point.
- **Family-friendly rules**: no PvP, nobody else can open or take apart your things unless they are in your clan, and getting knocked out sends you home with all your items.

## Tuning the game

Everything is data in `shared/data.js`: items, recipes, node drops and respawn times, animals, crops, building costs, XP curve and the tutorial steps. Change a number, restart the server. The island comes from `SEED` in `shared/terrain.js`; a new seed makes a new island (old buildings would then be in odd places, so wipe the `world` row or `data/world.json` if you change it).

## Layout

    server/index.js   web server and sockets
    server/game.js    game rules (authoritative)
    server/db.js      Neon / local-file storage
    shared/           world generation and game data used by both sides
    public/           the client (index.html, style.css, js/main.js, js/gfx.js, js/ui.js)
