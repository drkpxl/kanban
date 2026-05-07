import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { cards } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const board = url.searchParams.get('board') ?? 'personal';

	const [row] = await db
		.select({
			total: sql<number>`count(${cards.id})`,
			maxUpdated: sql<number | null>`max(${cards.updatedAt})`
		})
		.from(cards)
		.where(eq(cards.board, board));

	const version = `${row.total}-${row.maxUpdated ?? 0}`;
	return json({ version });
};
