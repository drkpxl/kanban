import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const UPLOADS_DIR = join(process.cwd(), 'data', 'uploads');

const MIME: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml'
};

export const GET: RequestHandler = async ({ params }) => {
	const { filename } = params;

	if (filename.includes('..') || filename.includes('/')) throw error(400, 'Invalid filename');

	try {
		const buf = await readFile(join(UPLOADS_DIR, filename));
		const ext = extname(filename).toLowerCase();
		const contentType = MIME[ext] ?? 'application/octet-stream';
		return new Response(buf, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch {
		throw error(404, 'Not found');
	}
};
