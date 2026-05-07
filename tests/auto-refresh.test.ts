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

// ── Integration: auto-refresh on focus ───────────────────────────────────────

test('board re-fetches when a card is added and focus returns', async ({ page, request }) => {
	await page.goto('/');
	await page.waitForSelector('.card-list');

	// Add card via API while "tab is in background"
	await request.post('/api/cards', {
		data: { board: 'personal', column: 'idea', title: 'Focus refresh card' }
	});

	// Simulate returning to tab (window focus event)
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));

	await expect(
		page.locator('.card').filter({ hasText: 'Focus refresh card' })
	).toBeVisible({ timeout: 4000 });
});

test('board re-fetches when a card is deleted and focus returns', async ({ page, request }) => {
	// Create a card first
	const { id } = await request.post('/api/cards', {
		data: { board: 'personal', column: 'idea', title: 'Card to vanish' }
	}).then(r => r.json());

	await page.goto('/');
	await expect(page.locator('.card').filter({ hasText: 'Card to vanish' })).toBeVisible();

	// Delete via API while "in background"
	await request.delete(`/api/cards/${id}`);

	// Simulate focus return
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));

	await expect(
		page.locator('.card').filter({ hasText: 'Card to vanish' })
	).not.toBeVisible({ timeout: 4000 });
});

test('no extra fetch when version has not changed', async ({ page }) => {
	await page.goto('/');
	await page.waitForSelector('.card-list');

	// Count fetch calls to /api/cards before focus trigger
	let fetchCount = 0;
	await page.route('/api/cards?*', route => {
		fetchCount++;
		route.continue();
	});

	// Trigger focus — no data changed, so should NOT call /api/cards
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await page.waitForTimeout(500);

	expect(fetchCount).toBe(0);
});
