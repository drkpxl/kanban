import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { existsSync } from 'fs';

test.beforeEach(async () => {
	if (existsSync('test.db')) {
		const db = new Database('test.db');
		db.exec('DELETE FROM images; DELETE FROM card_tags; DELETE FROM cards;');
		db.close();
	}
});

test('GET /api/cards/version returns a version string', async ({ request }) => {
	const res = await request.get('/api/cards/version?board=personal');
	expect(res.status()).toBe(200);
	const body = await res.json();
	expect(typeof body.version).toBe('string');
});

test('version changes after a card is created', async ({ request }) => {
	const v1 = await request.get('/api/cards/version?board=personal').then(r => r.json()).then(b => b.version);

	await request.post('/api/cards', {
		data: { board: 'personal', column: 'idea', title: 'Version test card' }
	});

	const v2 = await request.get('/api/cards/version?board=personal').then(r => r.json()).then(b => b.version);
	expect(v2).not.toBe(v1);
});

test('version changes after a card is deleted', async ({ request }) => {
	const { id } = await request.post('/api/cards', {
		data: { board: 'personal', column: 'idea', title: 'Delete me' }
	}).then(r => r.json());

	const v1 = await request.get('/api/cards/version?board=personal').then(r => r.json()).then(b => b.version);

	await request.delete(`/api/cards/${id}`);

	const v2 = await request.get('/api/cards/version?board=personal').then(r => r.json()).then(b => b.version);
	expect(v2).not.toBe(v1);
});

test('version changes after a card is updated', async ({ request }) => {
	const { id } = await request.post('/api/cards', {
		data: { board: 'personal', column: 'idea', title: 'Update me' }
	}).then(r => r.json());

	const v1 = await request.get('/api/cards/version?board=personal').then(r => r.json()).then(b => b.version);

	await request.patch(`/api/cards/${id}`, {
		data: { title: 'Updated title' }
	});

	const v2 = await request.get('/api/cards/version?board=personal').then(r => r.json()).then(b => b.version);
	expect(v2).not.toBe(v1);
});

test('version is board-scoped (work board unaffected by personal changes)', async ({ request }) => {
	const workV1 = await request.get('/api/cards/version?board=work').then(r => r.json()).then(b => b.version);

	await request.post('/api/cards', {
		data: { board: 'personal', column: 'idea', title: 'Personal only' }
	});

	const workV2 = await request.get('/api/cards/version?board=work').then(r => r.json()).then(b => b.version);
	expect(workV2).toBe(workV1);
});
