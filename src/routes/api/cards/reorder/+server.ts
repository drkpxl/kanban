import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { cards } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	const { updates } = await request.json();
	if (!Array.isArray(updates)) throw error(400, 'updates must be an array');

	await db.transaction(async (tx) => {
		for (const { id, position, column } of updates) {
			await tx
				.update(cards)
				.set({ position, column, updatedAt: Math.floor(Date.now() / 1000) })
				.where(eq(cards.id, id));
		}
	});

	return new Response(null, { status: 204 });
};
