import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { join } from 'path';

const dbPath = process.env.DATABASE_URL ?? join(process.cwd(), 'local.db');
const client = new Database(dbPath);

client.pragma('journal_mode = WAL');
client.pragma('foreign_keys = ON');

export const db = drizzle(client, { schema });
