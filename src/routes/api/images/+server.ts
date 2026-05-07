import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { images } from '$lib/server/db/schema';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const UPLOADS_DIR = join(process.cwd(), 'data', 'uploads');

const MIME_TO_EXT: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/gif': '.gif',
	'image/webp': '.webp',
	'image/heic': '.jpg',
	'image/heif': '.jpg',
};
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const cardIdRaw = formData.get('cardId');

	if (!file || !cardIdRaw) throw error(400, 'Missing file or cardId');

	const cardId = parseInt(String(cardIdRaw));
	if (isNaN(cardId)) throw error(400, 'Invalid cardId');

	// Derive extension from MIME type — iOS sends HEIC filenames even when content is JPEG
	const ext = MIME_TO_EXT[file.type];
	if (!ext) throw error(400, 'File type not allowed');
	if (file.size > MAX_SIZE) throw error(413, 'File too large (max 10 MB)');

	const filename = `${randomUUID()}${ext}`;

	await mkdir(UPLOADS_DIR, { recursive: true });
	const bytes = await file.arrayBuffer();
	await writeFile(join(UPLOADS_DIR, filename), Buffer.from(bytes));

	await db.insert(images).values({ cardId, filename });

	return json({ url: `/api/uploads/${filename}` }, { status: 201 });
};
