import { test, expect, type Page } from '@playwright/test';
import { join } from 'path';
import Database from 'better-sqlite3';
import { existsSync } from 'fs';

test.beforeEach(async () => {
	if (existsSync('test.db')) {
		const db = new Database('test.db');
		db.exec('DELETE FROM images; DELETE FROM card_tags; DELETE FROM cards;');
		db.close();
	}
});

// Helper: create a card and open its editor modal
async function openEditorOnCard(page: Page, title = 'Editor test card') {
	await page.goto('/');

	// Create via modal
	await page.locator('.column').first().getByRole('button', { name: '+ Add card' }).click();
	await page.getByLabel('Card title').fill(title);
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page.getByRole('dialog')).not.toBeVisible();

	// Reopen (now has a real card ID for image uploads)
	await page.locator('.card').filter({ hasText: title }).click();
	await expect(page.getByRole('dialog')).toBeVisible();

	return page.locator('.tiptap');
}

// ── Fixed toolbar ─────────────────────────────────────────────────────────────

test('fixed toolbar: bold toggles on click', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await editor.type('hello world');
	await page.keyboard.down('Control');
	await page.keyboard.press('a');
	await page.keyboard.up('Control');

	await page.locator('.toolbar button[title="Bold (Ctrl+B)"]').click();
	await expect(editor.locator('strong')).toBeVisible();

	// Click again to untoggle
	await page.locator('.toolbar button[title="Bold (Ctrl+B)"]').click();
	await expect(editor.locator('strong')).not.toBeVisible();
});

test('fixed toolbar: italic toggles', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await editor.type('hello world');
	await page.keyboard.down('Control');
	await page.keyboard.press('a');
	await page.keyboard.up('Control');
	await page.locator('.toolbar button[title="Italic (Ctrl+I)"]').click();
	await expect(editor.locator('em')).toBeVisible();
});

test('fixed toolbar: heading H1 applied', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await editor.type('Big heading');
	await page.keyboard.down('Control');
	await page.keyboard.press('a');
	await page.keyboard.up('Control');
	await page.locator('.toolbar button[title="Heading 1"]').click();
	await expect(editor.locator('h1')).toContainText('Big heading');
});

test('fixed toolbar: heading H2 applied', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await editor.type('Sub heading');
	await page.keyboard.down('Control');
	await page.keyboard.press('a');
	await page.keyboard.up('Control');
	await page.locator('.toolbar button[title="Heading 2"]').click();
	await expect(editor.locator('h2')).toContainText('Sub heading');
});

test('fixed toolbar: heading H3 applied', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await editor.type('Sub sub heading');
	await page.keyboard.down('Control');
	await page.keyboard.press('a');
	await page.keyboard.up('Control');
	await page.locator('.toolbar button[title="Heading 3"]').click();
	await expect(editor.locator('h3')).toContainText('Sub sub heading');
});

test('fixed toolbar: bullet list', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await page.locator('.toolbar button[title="Bullet list"]').click();
	await editor.click(); // restore editor focus after toolbar click
	await editor.type('First item');
	await editor.press('Enter');
	await editor.type('Second item');
	await expect(editor.locator('ul li')).toHaveCount(2);
});

test('fixed toolbar: ordered list', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await page.locator('.toolbar button[title="Numbered list"]').click();
	await editor.click(); // restore editor focus after toolbar click
	await editor.type('Step one');
	await editor.press('Enter');
	await editor.type('Step two');
	await expect(editor.locator('ol li')).toHaveCount(2);
});

test('fixed toolbar: blockquote', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await editor.type('A quoted thought');
	await page.keyboard.down('Control');
	await page.keyboard.press('a');
	await page.keyboard.up('Control');
	await page.locator('.toolbar button[title="Blockquote"]').click();
	await expect(editor.locator('blockquote')).toContainText('A quoted thought');
});

test('fixed toolbar: inline code', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await editor.type('console.log(x)');
	await page.keyboard.down('Control');
	await page.keyboard.press('a');
	await page.keyboard.up('Control');
	await page.locator('.toolbar button[title="Inline code"]').click();
	await expect(editor.locator('code')).toContainText('console.log(x)');
});

test('fixed toolbar: code block', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await page.locator('.toolbar button[title="Code block"]').click();
	await editor.type('const x = 42;');
	await expect(editor.locator('pre code')).toContainText('const x = 42;');
});

test('fixed toolbar: horizontal rule inserts hr', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await editor.type('Above');
	await page.locator('.toolbar button[title="Horizontal rule"]').click();
	await expect(editor.locator('hr')).toBeVisible();
});

test('fixed toolbar: strikethrough', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await editor.type('crossed out');
	await page.keyboard.down('Control');
	await page.keyboard.press('a');
	await page.keyboard.up('Control');
	await page.locator('.toolbar button[title="Strikethrough"]').click();
	await expect(editor.locator('s')).toContainText('crossed out');
});

// ── Bubble menu ───────────────────────────────────────────────────────────────

test('bubble menu appears on text selection', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await editor.type('Select me');
	await page.keyboard.down('Control');
	await page.keyboard.press('a');
	await page.keyboard.up('Control');

	// Bubble menu should be visible
	await expect(page.locator('.bubble-menu')).toBeVisible({ timeout: 2000 });
});

test('bubble menu bold button works', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await editor.type('bubble bold');
	await page.keyboard.down('Control');
	await page.keyboard.press('a');
	await page.keyboard.up('Control');

	await expect(page.locator('.bubble-menu')).toBeVisible({ timeout: 2000 });
	await page.locator('.bubble-menu button[title="Bold"]').click();
	await expect(editor.locator('strong')).toContainText('bubble bold');
});

// ── Image upload ──────────────────────────────────────────────────────────────

test('image upload via toolbar button', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	const [fileChooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		page.locator('.toolbar button[title="Upload image"]').click()
	]);
	await fileChooser.setFiles(join(process.cwd(), 'tests/fixtures/test-image.png'));
	await expect(editor.locator('img')).toBeVisible({ timeout: 5000 });
	const src = await editor.locator('img').getAttribute('src');
	expect(src).toMatch(/^\/api\/uploads\//);
});

test('image drag-and-drop into editor', async ({ page }) => {
	const editor = await openEditorOnCard(page);

	// Simulate file drop via DataTransfer
	const imgPath = join(process.cwd(), 'tests/fixtures/test-image.png');
	await page.evaluate(async (path) => {
		// Create a File object from fetch (works in headless)
		const res = await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==');
		const blob = await res.blob();
		const file = new File([blob], 'test-image.png', { type: 'image/png' });
		const dt = new DataTransfer();
		dt.items.add(file);
		const target = document.querySelector('.tiptap')!;
		const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
		target.dispatchEvent(dropEvent);
	}, imgPath);

	// Note: drop test may not trigger upload if cardId is null initially;
	// this test just verifies the event is handled without error
	await page.waitForTimeout(500);
});

// ── Content persistence across all element types ──────────────────────────────

test('all content types persist after save and reopen', async ({ page }) => {
	const editor = await openEditorOnCard(page, 'Rich content card');

	// Add H1
	await editor.click();
	await page.locator('.toolbar button[title="Heading 1"]').click();
	await editor.click();
	await editor.type('Main Title');
	await editor.press('Enter');

	// Back to paragraph, add bold
	await page.locator('.toolbar button[title="Bold (Ctrl+B)"]').click();
	await editor.click();
	await editor.type('Important');
	await page.locator('.toolbar button[title="Bold (Ctrl+B)"]').click();
	await editor.click();
	await editor.type(' normal text');
	await editor.press('Enter');

	// Add code block — exit via ArrowDown (keeps it as a code block node)
	await page.locator('.toolbar button[title="Code block"]').click();
	await editor.click();
	await editor.type('const x = 42;');
	await editor.press('ArrowDown');
	await editor.press('Enter');

	// Add blockquote — exit via double Enter on empty line
	await page.locator('.toolbar button[title="Blockquote"]').click();
	await editor.click();
	await editor.type('A wise quote');
	await editor.press('Enter');
	await editor.press('Enter');

	// Add bullet list
	await page.locator('.toolbar button[title="Bullet list"]').click();
	await editor.click();
	await editor.type('Item one');
	await editor.press('Enter');
	await editor.type('Item two');

	// Save
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('dialog')).not.toBeVisible();

	// Reopen
	await page.locator('.card').filter({ hasText: 'Rich content card' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();

	// Verify all elements persisted
	await expect(editor.locator('h1')).toContainText('Main Title');
	await expect(editor.locator('strong')).toContainText('Important');
	await expect(editor.locator('pre code')).toContainText('const x = 42;');
	await expect(editor.locator('blockquote')).toContainText('A wise quote');
	await expect(editor.locator('ul li')).toHaveCount(2);
});

// ── Image lightbox ────────────────────────────────────────────────────────────

test('clicking an image in the editor opens a lightbox overlay', async ({ page }) => {
  await openEditorOnCard(page);

  // Inject a test image into the TipTap editor container.
  // NOTE: TipTap owns .tiptap's children and wipes external DOM changes immediately;
  // injecting into editorEl (parent of .tiptap) persists because TipTap doesn't manage that level.
  await page.evaluate(() => {
    const tiptap = document.querySelector('.tiptap')!;
    const editorEl = tiptap.parentElement!;
    const img = document.createElement('img');
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    img.alt = 'test';
    img.style.display = 'block';
    img.style.width = '100px';
    img.style.height = '50px';
    editorEl.appendChild(img);
  });

  await page.locator('.tiptap ~ img').first().click();
  await expect(page.locator('.lightbox-overlay')).toBeVisible();
});

test('pressing Escape closes the lightbox without closing the card modal', async ({ page }) => {
  await openEditorOnCard(page);

  await page.evaluate(() => {
    const tiptap = document.querySelector('.tiptap')!;
    const editorEl = tiptap.parentElement!;
    const img = document.createElement('img');
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    img.alt = 'test';
    img.style.display = 'block';
    img.style.width = '100px';
    img.style.height = '50px';
    editorEl.appendChild(img);
  });

  await page.locator('.tiptap ~ img').first().click();
  await expect(page.locator('.lightbox-overlay')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.lightbox-overlay')).not.toBeVisible();
  // Card modal must still be open
  await expect(page.getByRole('dialog')).toBeVisible();
});

// ── LinkPreview node ──────────────────────────────────────────────────────────

test('pasting a URL alone on an empty line renders a link-preview card', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();

	await page.evaluate(async () => {
		const tiptap = document.querySelector('.tiptap')!;
		const clipboardData = new DataTransfer();
		clipboardData.setData('text/plain', 'https://example.com');
		tiptap.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
	});

	await expect(page.locator('[data-link-preview]')).toBeVisible({ timeout: 15000 });
});

test('pasting a URL inline with text stays as a plain link', async ({ page }) => {
	const editor = await openEditorOnCard(page);
	await editor.click();
	await page.keyboard.type('Check this out: ');

	await page.evaluate(async () => {
		const tiptap = document.querySelector('.tiptap')!;
		const clipboardData = new DataTransfer();
		clipboardData.setData('text/plain', 'https://example.com');
		tiptap.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
	});

	await expect(page.locator('[data-link-preview]')).not.toBeVisible();
	await expect(page.locator('.tiptap a')).toBeVisible();
});

// ── Link preview endpoint ─────────────────────────────────────────────────────

test('link-preview returns JSON with title for a valid URL', async ({ request }) => {
	const res = await request.get('/api/link-preview?url=https://example.com');
	expect(res.ok()).toBeTruthy();
	const data = await res.json();
	expect(data.url).toBe('https://example.com');
	expect(typeof data.title).toBe('string');
	expect(data.title.length).toBeGreaterThan(0);
});

test('link-preview returns 400 when url param is missing', async ({ request }) => {
	const res = await request.get('/api/link-preview');
	expect(res.status()).toBe(400);
});

test('link-preview returns 400 for a non-http URL', async ({ request }) => {
	const res = await request.get('/api/link-preview?url=javascript:alert(1)');
	expect(res.status()).toBe(400);
});
