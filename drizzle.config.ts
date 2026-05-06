import { defineConfig } from 'drizzle-kit';
import { join } from 'path';

const url = process.env.DATABASE_URL ?? join(process.cwd(), 'local.db');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url },
	verbose: true,
	strict: true
});
