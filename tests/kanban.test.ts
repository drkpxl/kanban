import { test, expect, type Page } from '@playwright/test';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

// Reset the test database before each test
test.beforeEach(async () => {
	if (existsSync('test.db')) {
		const db = new Database('test.db');
		db.exec('DELETE FROM images; DELETE FROM card_tags; DELETE FROM cards;');
		db.close();
	}
});

async function openModal(page: Page, column = 'idea') {
	await page.locator('.column').filter({ hasText: column === 'idea' ? 'Idea' : column === 'in_progress' ? 'In Progress' : 'Complete' })
		.getByRole('button', { name: '+ Add card' })
		.click();
	await expect(page.getByRole('dialog')).toBeVisible();
}

// ─── Adding a card ────────────────────────────────────────────────────────────

test('can add a card via the modal', async ({ page }) => {
	await page.goto('/');
	await openModal(page, 'idea');

	await page.getByLabel('Card title').fill('My first task');
	await page.getByRole('button', { name: 'Create' }).click();

	await expect(page.getByRole('dialog')).not.toBeVisible();
	await expect(page.locator('.card').filter({ hasText: 'My first task' })).toBeVisible();
});

test('modal closes on Escape without creating a card', async ({ page }) => {
	await page.goto('/');
	await openModal(page, 'idea');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).not.toBeVisible();
	await expect(page.locator('.card')).toHaveCount(0);
});

test('can add a card with a tag', async ({ page }) => {
	await page.goto('/');
	await openModal(page, 'idea');

	await page.getByLabel('Card title').fill('Tagged task');
	await page.getByRole('button', { name: '+ tag' }).click();
	await page.getByRole('button', { name: /Design/ }).click();
	await page.getByRole('button', { name: 'Create' }).click();

	await expect(page.locator('.tag-pill').filter({ hasText: 'Design' })).toBeVisible();
});

// ─── Editing a card ───────────────────────────────────────────────────────────

test('can edit card title and body text persists on reopen', async ({ page }) => {
	await page.goto('/');

	// Create card
	await openModal(page, 'idea');
	await page.getByLabel('Card title').fill('Edit me');
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page.getByRole('dialog')).not.toBeVisible();

	// Open and edit
	await page.locator('.card').filter({ hasText: 'Edit me' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();

	const titleInput = page.getByLabel('Card title');
	await titleInput.fill('Edited title');

	// Type into TipTap editor
	const editor = page.locator('.tiptap');
	await editor.click();
	await editor.type('Some description text');

	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('dialog')).not.toBeVisible();

	// Reopen and verify body text persisted
	await page.locator('.card').filter({ hasText: 'Edited title' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(page.locator('.tiptap')).toContainText('Some description text');
});

// ─── Removing a card ──────────────────────────────────────────────────────────

test('can delete a card', async ({ page }) => {
	await page.goto('/');

	// Create card
	await openModal(page, 'idea');
	await page.getByLabel('Card title').fill('Delete me');
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page.getByRole('dialog')).not.toBeVisible();
	await expect(page.locator('.card').filter({ hasText: 'Delete me' })).toBeVisible();

	// Open and delete
	await page.locator('.card').filter({ hasText: 'Delete me' }).click();
	page.on('dialog', (d) => d.accept());
	await page.getByRole('button', { name: 'Delete card' }).click();

	await expect(page.locator('.card').filter({ hasText: 'Delete me' })).not.toBeVisible();
});

// ─── Image upload and preview ─────────────────────────────────────────────────

test('can upload an image and it appears in the editor', async ({ page }) => {
	await page.goto('/');

	// Create a card first (image upload requires a saved card ID)
	await openModal(page, 'idea');
	await page.getByLabel('Card title').fill('Image card');
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page.getByRole('dialog')).not.toBeVisible();

	// Reopen to edit (now has a real card ID)
	await page.locator('.card').filter({ hasText: 'Image card' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();

	// Intercept the file chooser for the image upload button
	const [fileChooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		page.locator('.toolbar button[title="Upload image"]').click()
	]);
	await fileChooser.setFiles(join(process.cwd(), 'tests/fixtures/test-image.png'));

	// Image should appear in the editor
	await expect(page.locator('.tiptap img')).toBeVisible({ timeout: 5000 });
});

test('uploaded image persists after saving and reopening', async ({ page }) => {
	await page.goto('/');

	// Create card
	await openModal(page, 'idea');
	await page.getByLabel('Card title').fill('Persistent image card');
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page.getByRole('dialog')).not.toBeVisible();

	// Open and upload image
	await page.locator('.card').filter({ hasText: 'Persistent image card' }).click();

	const [fileChooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		page.locator('.toolbar button[title="Upload image"]').click()
	]);
	await fileChooser.setFiles(join(process.cwd(), 'tests/fixtures/test-image.png'));
	await expect(page.locator('.tiptap img')).toBeVisible({ timeout: 5000 });

	// Save
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('dialog')).not.toBeVisible();

	// Reopen — image should still be there
	await page.locator('.card').filter({ hasText: 'Persistent image card' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(page.locator('.tiptap img')).toBeVisible({ timeout: 5000 });

	// Verify the image URL is from our upload endpoint
	const imgSrc = await page.locator('.tiptap img').getAttribute('src');
	expect(imgSrc).toMatch(/^\/api\/uploads\//);
});

test('uploaded image is served correctly', async ({ page }) => {
	await page.goto('/');

	// Create and upload
	await openModal(page, 'idea');
	await page.getByLabel('Card title').fill('Served image card');
	await page.getByRole('button', { name: 'Create' }).click();

	await page.locator('.card').filter({ hasText: 'Served image card' }).click();

	const [fileChooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		page.locator('.toolbar button[title="Upload image"]').click()
	]);
	await fileChooser.setFiles(join(process.cwd(), 'tests/fixtures/test-image.png'));
	await expect(page.locator('.tiptap img')).toBeVisible({ timeout: 5000 });

	const imgSrc = await page.locator('.tiptap img').getAttribute('src');
	expect(imgSrc).toBeTruthy();

	// Fetch the image URL directly — should return 200 with image content-type
	const response = await page.request.get(imgSrc!);
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toMatch(/^image\//);
});

// ─── Board switching ──────────────────────────────────────────────────────────

test('cards are scoped to their board', async ({ page }) => {
	await page.goto('/');

	// Add card on Personal
	await openModal(page, 'idea');
	await page.getByLabel('Card title').fill('Personal task');
	await page.getByRole('button', { name: 'Create' }).click();

	// Switch to Work — card should not appear
	await page.getByRole('tab', { name: 'Work' }).click();
	await expect(page.locator('.card').filter({ hasText: 'Personal task' })).not.toBeVisible();

	// Switch back — card should reappear
	await page.getByRole('tab', { name: 'Personal' }).click();
	await expect(page.locator('.card').filter({ hasText: 'Personal task' })).toBeVisible();
});

// ─── Hide completed ───────────────────────────────────────────────────────────

test('can hide and show completed cards individually', async ({ page }) => {
	await page.goto('/');

	// Create a card in Complete column
	await openModal(page, 'complete');
	await page.getByLabel('Card title').fill('Done task');
	await page.getByRole('button', { name: 'Create' }).click();

	const card = page.locator('.card').filter({ hasText: 'Done task' });
	await expect(card).toBeVisible();

	// Hide it
	await card.hover();
	await card.getByRole('button', { name: 'hide' }).click();
	await expect(card).not.toBeVisible();

	// Show hidden
	await page.getByRole('button', { name: /Show hidden/ }).click();
	await expect(page.locator('.card').filter({ hasText: 'Done task' })).toBeVisible();
});
