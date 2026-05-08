import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { cards, cardTags, images } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { unlink } from 'fs/promises';
import { join } from 'path';

const VALID_COLUMNS = ['idea', 'in-progress', 'complete'];

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) throw error(400, 'Invalid id');

	const body = await request.json();
	const { tags: tagSlugs, ...fields } = body;

	if (fields.column !== undefined && !VALID_COLUMNS.includes(fields.column as string)) {
		throw error(400, 'Invalid column');
	}
	if (fields.title !== undefined) {
		if (typeof fields.title !== 'string' || fields.title.trim().length === 0) {
			throw error(400, 'Title cannot be empty');
		}
		if ((fields.title as string).length > 500) {
			throw error(400, 'Title too long');
		}
	}

	const updateData: Record<string, unknown> = {
		...fields,
		updatedAt: sql`max(${cards.updatedAt} + 1, unixepoch())`
	};

	const [card] = await db.update(cards).set(updateData).where(eq(cards.id, id)).returning();
	if (!card) throw error(404, 'Card not found');

	if (Array.isArray(tagSlugs)) {
		await db.delete(cardTags).where(eq(cardTags.cardId, id));
		if (tagSlugs.length > 0) {
			await db.insert(cardTags).values(tagSlugs.map((slug: string) => ({ cardId: id, tagSlug: slug })));
		}
	}

	const currentTags = await db.select().from(cardTags).where(eq(cardTags.cardId, id));
	return json({ ...card, tags: currentTags.map((t) => t.tagSlug) });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) throw error(400, 'Invalid id');

	const cardImages = await db.select().from(images).where(eq(images.cardId, id));
	for (const img of cardImages) {
		try {
			await unlink(join(process.cwd(), 'data', 'uploads', img.filename));
		} catch {
			// file already gone — ignore
		}
	}

	await db.delete(cards).where(eq(cards.id, id));
	return new Response(null, { status: 204 });
};
