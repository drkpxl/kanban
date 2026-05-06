import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { images } from '$lib/server/db/schema';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

const UPLOADS_DIR = join(process.cwd(), 'data', 'uploads');

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const cardIdRaw = formData.get('cardId');

	if (!file || !cardIdRaw) throw error(400, 'Missing file or cardId');

	const cardId = parseInt(String(cardIdRaw));
	if (isNaN(cardId)) throw error(400, 'Invalid cardId');

	const ext = extname(file.name) || '.bin';
	const filename = `${randomUUID()}${ext}`;

	await mkdir(UPLOADS_DIR, { recursive: true });
	const bytes = await file.arrayBuffer();
	await writeFile(join(UPLOADS_DIR, filename), Buffer.from(bytes));

	await db.insert(images).values({ cardId, filename });

	return json({ url: `/api/uploads/${filename}` }, { status: 201 });
};
