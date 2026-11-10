import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import * as db from './db.js';
import { Game } from './game.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
app.use(express.static(path.join(root, 'public')));
app.use('/shared', express.static(path.join(root, 'shared')));
app.use('/vendor', express.static(path.join(root, 'node_modules/three/build')));
app.get('/healthz', (_, res) => res.send('ok'));

const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000 });

await db.initDb();
const game = new Game(io, db);
await game.init();
io.on('connection', s => game.connect(s));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Kinwild running on http://localhost:${PORT}`));

async function shutdown() { try { await game.saveAll(); } catch (e) { console.error(e); } process.exit(0); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
