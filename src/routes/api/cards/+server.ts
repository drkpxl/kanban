import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { cards, cardTags } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';

const VALID_BOARDS = ['personal', 'work'];
const VALID_COLUMNS = ['idea', 'in-progress', 'complete'];

export const GET: RequestHandler = async ({ url }) => {
	const board = url.searchParams.get('board') ?? 'personal';
	const showHidden = url.searchParams.get('showHidden') === 'true';

	const conditions = [eq(cards.board, board)];
	if (!showHidden) conditions.push(eq(cards.hidden, 0));

	const rows = await db
		.select()
		.from(cards)
		.where(and(...conditions))
		.orderBy(asc(cards.position));

	const tags = await db.select().from(cardTags);
	const tagsByCard = tags.reduce(
		(acc, t) => {
			if (!acc[t.cardId]) acc[t.cardId] = [];
			acc[t.cardId].push(t.tagSlug);
			return acc;
		},
		{} as Record<number, string[]>
	);

	const result = rows.map((card) => ({ ...card, tags: tagsByCard[card.id] ?? [] }));
	return json(result);
};

export const POST: RequestHandler = async ({ request }) => {
	const { board, column, title } = await request.json();

	if (!VALID_BOARDS.includes(board)) throw error(400, 'Invalid board');
	if (!VALID_COLUMNS.includes(column)) throw error(400, 'Invalid column');
	if (!title || typeof title !== 'string') throw error(400, 'Title is required');
	if (title.trim().length === 0) throw error(400, 'Title cannot be empty');
	if (title.length > 500) throw error(400, 'Title too long (max 500 characters)');

	const existing = await db
		.select({ position: cards.position })
		.from(cards)
		.where(and(eq(cards.board, board), eq(cards.column, column)))
		.orderBy(asc(cards.position));

	const maxPosition = existing.length > 0 ? Math.max(...existing.map((r) => r.position)) + 1 : 0;

	const [card] = await db
		.insert(cards)
		.values({ board, column, title, position: maxPosition })
		.returning();

	return json({ ...card, tags: [] }, { status: 201 });
};
