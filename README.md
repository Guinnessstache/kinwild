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
| R / Z | In build mode: turn the piece / change floor level |
| K | With the hammer held: take apart what you are looking at (half the materials back) |
| Enter | Chat. `/c hello` talks to your clan only |
| Esc | Menu: graphics, sound volume, look speed, button hints, log out |

**Controller:** standard Xbox/PlayStation-style gamepads work in the browser (plug in or pair, then press any button). Left stick move, right stick look, A jump, X pick up / use, RT use held item (hold to keep swinging), LB/RB action bar, L3 run, LT sneak, R3 take apart, Y bag, D-pad up/right/left/down for craft/build/clan/map, Start for the menu. In menus: D-pad moves the highlight, A chooses (A on an item, then A on a slot moves it), X eats or quick-moves, LB/RB switch tabs, B closes. Building: RT place, X turn, Y floor, B done. Typing (name, PIN, chat, clan name) still needs a keyboard.

**Moving items:** drag them between the bag, a chest and the action bar (the bar at the bottom of the screen works as a drop target too); or point at an item and press 1-8; or shift-click; or click an item and then click where it goes.

The "Next step" box walks new players through 19 steps from punching a tree to forging iron.

## What is in build 1

- **Skills (9)**: woodcutting, mining, foraging, farming, hunting, fishing, crafting, cooking, building. Levels 1-50, earned by doing. They add bonus loot, speed up crops and bites, toughen crafted tools and unlock recipes and building pieces.
- **Gathering**: 16 kinds of resource nodes that respawn (trees, boulders, iron, coal, clay, berries, mushrooms, tall grass, wild crops).
- **Hunting and fishing**: rabbits, wild hens, deer, boar (fight back), wolves (hunt at night, never near a fire). Spear, sword, bow and arrows, fishing rod.
- **Farming**: farm plots, 6 crops, watering to speed growth, harvests that return seeds.
- **Crafting**: 32 recipes across hand, workbench, campfire, furnace, anvil and loom. Stone and iron tool tiers, armor, 9 cooked meals.
- **Building**: 24 pieces. Snap-together wood and stone foundations, walls, doors, windows, upper floors, stairs and roofs, plus campfire, workbench, chest, bed, furnace, anvil, loom, well, torch post, fences.
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
