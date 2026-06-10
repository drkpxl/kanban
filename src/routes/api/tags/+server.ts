import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { tags } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const SLUG_RE = /^[a-z0-9-]{1,50}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const POST: RequestHandler = async ({ request }) => {
	const { slug, label, color } = await request.json();

	if (!slug || !SLUG_RE.test(slug)) throw error(400, 'Invalid slug (kebab-case, 1–50 chars)');
	if (!label || typeof label !== 'string' || label.trim().length === 0 || label.length > 80)
		throw error(400, 'Invalid label (1–80 chars)');
	if (!color || !HEX_RE.test(color)) throw error(400, 'Invalid color (hex e.g. #a1b2c3)');

	const existing = await db.select().from(tags).where(eq(tags.slug, slug));
	if (existing.length > 0) throw error(409, 'Tag already exists');

	const [tag] = await db
		.insert(tags)
		.values({ slug, label: label.trim(), color })
		.returning({ slug: tags.slug, label: tags.label, color: tags.color });

	return json(tag, { status: 201 });
};
