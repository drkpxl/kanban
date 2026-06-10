import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { join } from 'path';

const dbPath = process.env.DATABASE_URL ?? join(process.cwd(), 'local.db');
const client = new Database(dbPath);

client.pragma('journal_mode = WAL');
client.pragma('foreign_keys = ON');

export const db = drizzle(client, { schema });

// One-time seed: populate tags table from built-in defaults if empty
try {
	const count = (client.prepare('SELECT count(*) as n FROM tags').get() as { n: number } | undefined)?.n ?? -1;
	if (count === 0) {
		const stmt = client.prepare('INSERT INTO tags (slug, label, color) VALUES (?, ?, ?)');
		const seedTags = [
			['design',   'Design',   '#c17f3f'],
			['writing',  'Writing',  '#4a7c59'],
			['research', 'Research', '#6b5a8f'],
			['code',     'Code',     '#3f7fc1'],
			['urgent',   'Urgent',   '#c13f3f'],
		];
		for (const [slug, label, color] of seedTags) stmt.run(slug, label, color);
	}
} catch {
	// Table may not exist yet (before first db:push) — ignore
}
