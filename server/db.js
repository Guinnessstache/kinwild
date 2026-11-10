// Tiny key/value store. Uses Neon (Postgres) when DATABASE_URL is set, otherwise JSON files in ./data.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
let pool = null;

export async function initDb() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: url, max: 3, idleTimeoutMillis: 30000, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
    pool.on('error', e => console.error('db pool error (will reconnect):', e.message));   // Neon closes idle connections
    await pool.query('create table if not exists kinwild_kv (k text primary key, v jsonb not null, updated timestamptz not null default now())');
    console.log('Storage: Neon Postgres');
  } else {
    fs.mkdirSync(DIR, { recursive: true });
    console.log('Storage: local files in ./data (set DATABASE_URL to use Neon)');
  }
}
const file = k => path.join(DIR, k.replace(/[^a-z0-9_]/gi, '_') + '.json');

export async function load(k) {
  if (pool) { const r = await pool.query('select v from kinwild_kv where k=$1', [k]); return r.rows[0]?.v ?? null; }
  try { return JSON.parse(fs.readFileSync(file(k), 'utf8')); } catch { return null; }
}
export async function save(k, v) {
  if (pool) { await pool.query('insert into kinwild_kv (k,v) values ($1,$2) on conflict (k) do update set v=excluded.v, updated=now()', [k, JSON.stringify(v)]); return; }
  fs.writeFileSync(file(k) + '.tmp', JSON.stringify(v)); fs.renameSync(file(k) + '.tmp', file(k));
}
