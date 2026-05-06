import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { images } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { unlink } from 'fs/promises';
import { join } from 'path';

export const DELETE: RequestHandler = async ({ params }) => {
	const { filename } = params;

	await db.delete(images).where(eq(images.filename, filename));

	try {
		await unlink(join(process.cwd(), 'data', 'uploads', filename));
	} catch {
		// already gone
	}

	return new Response(null, { status: 204 });
};
