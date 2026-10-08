import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
const directory = path.resolve('.local-postgres');
const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'carebodha', password: 'carebodha_local', port: 5432, persistent: true, authMethod: 'scram-sha-256', initdbFlags: ['--encoding=UTF8'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
if (!existsSync(path.join(directory, 'PG_VERSION'))) await pg.initialise();
await pg.start();
const client = pg.getPgClient('postgres');
await client.connect();
const database = new URL(process.env.DATABASE_URL || 'postgresql://localhost/carebodha').pathname.slice(1);
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Invalid local database name');
const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1',[database]);
if (!result.rows.length) await client.query(`CREATE DATABASE "${database}" ENCODING 'UTF8' TEMPLATE template0`);
await client.end();
console.log('Local PostgreSQL listening on 127.0.0.1:5432. Data persists in .local-postgres.');
const timer = setInterval(() => {}, 1000);
async function stop() { clearInterval(timer); await pg.stop(); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
