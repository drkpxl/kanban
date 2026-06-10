import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { bookmarks, bookmarkTags } from '$lib/server/db/schema';
import { desc, asc } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
	const rows = await db.select().from(bookmarks).orderBy(desc(bookmarks.position));
	const tagRows = await db.select().from(bookmarkTags);

	const tagsByBookmark = tagRows.reduce(
		(acc, t) => {
			if (!acc[t.bookmarkId]) acc[t.bookmarkId] = [];
			acc[t.bookmarkId].push(t.tagSlug);
			return acc;
		},
		{} as Record<number, string[]>
	);

	return json(rows.map((b) => ({ ...b, tags: tagsByBookmark[b.id] ?? [] })));
};

export const POST: RequestHandler = async ({ request }) => {
	const { url, title, description, favicon } = await request.json();

	if (!url || typeof url !== 'string') throw error(400, 'url is required');
	try { new URL(url); } catch { throw error(400, 'Invalid URL'); }
	if (!title || typeof title !== 'string' || !title.trim()) throw error(400, 'title is required');

	const existing = await db.select({ position: bookmarks.position }).from(bookmarks).orderBy(asc(bookmarks.position));
	const nextPosition = existing.length > 0 ? Math.max(...existing.map((r) => r.position)) + 1 : 0;

	const [bookmark] = await db
		.insert(bookmarks)
		.values({ url, title: title.trim(), description: description ?? null, favicon: favicon ?? null, position: nextPosition })
		.returning();

	return json({ ...bookmark, tags: [] }, { status: 201 });
};
