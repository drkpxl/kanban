import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { bookmarks, bookmarkTags } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = parseInt(params.id, 10);
	if (isNaN(id)) throw error(400, 'Invalid id');

	const body = await request.json();
	const updates: Partial<typeof bookmarks.$inferInsert> = {};
	if (typeof body.title === 'string') updates.title = body.title.trim();
	if (body.description !== undefined) updates.description = body.description;

	if (Object.keys(updates).length > 0) {
		await db.update(bookmarks).set(updates).where(eq(bookmarks.id, id));
	}

	if (Array.isArray(body.tags)) {
		await db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, id));
		if (body.tags.length > 0) {
			await db.insert(bookmarkTags).values(
				(body.tags as string[]).map((slug) => ({ bookmarkId: id, tagSlug: slug }))
			);
		}
	}

	const [bookmark] = await db.select().from(bookmarks).where(eq(bookmarks.id, id));
	if (!bookmark) throw error(404, 'Bookmark not found');

	const tagRows = await db.select().from(bookmarkTags).where(eq(bookmarkTags.bookmarkId, id));
	return json({ ...bookmark, tags: tagRows.map((t) => t.tagSlug) });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id, 10);
	if (isNaN(id)) throw error(400, 'Invalid id');
	await db.delete(bookmarks).where(eq(bookmarks.id, id));
	return new Response(null, { status: 204 });
};
