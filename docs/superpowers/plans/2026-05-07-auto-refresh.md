# Auto-Refresh on Focus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user returns focus to the kanban tab (desktop or mobile), silently check if the board data changed and re-hydrate with enter/exit card animations if it did.

**Architecture:** A new `GET /api/cards/version` endpoint returns a cheap `COUNT+MAX(updated_at)` aggregate string. On `visibilitychange` and `window.focus` events (throttled 2 s), the client compares the stored version; if changed, calls the existing `loadCards()`. Cards added/removed from the `{#each}` block animate in/out via Svelte `in:`/`out:` transitions.

**Tech Stack:** SvelteKit, Svelte 5 (runes), Drizzle ORM, SQLite, svelte-dnd-action, Playwright (tests)

---

## Files

| Action | Path |
|--------|------|
| Create | `src/routes/api/cards/version/+server.ts` |
| Create | `tests/auto-refresh.test.ts` |
| Modify | `src/routes/+page.svelte` |
| Modify | `src/lib/components/Column.svelte` |

---

### Task 1: Version endpoint

**Files:**
- Create: `src/routes/api/cards/version/+server.ts`
- Create: `tests/auto-refresh.test.ts` (version tests only in this task)

- [ ] **Step 1: Write failing version endpoint tests**

Create `tests/auto-refresh.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/gmk_user/kanban && npx playwright test tests/auto-refresh.test.ts --reporter=line 2>&1 | head -30
```

Expected: all 5 tests fail with 404 or similar (endpoint doesn't exist yet).

- [ ] **Step 3: Implement the version endpoint**

Create `src/routes/api/cards/version/+server.ts`:

```ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { cards } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const board = url.searchParams.get('board') ?? 'personal';

	const [row] = await db
		.select({
			total: sql<number>`count(${cards.id})`,
			maxUpdated: sql<number>`max(${cards.updatedAt})`
		})
		.from(cards)
		.where(eq(cards.board, board));

	const version = `${row.total}-${row.maxUpdated ?? 0}`;
	return json({ version });
};
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd /home/gmk_user/kanban && npx playwright test tests/auto-refresh.test.ts --reporter=line 2>&1 | head -40
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/gmk_user/kanban && git add src/routes/api/cards/version/+server.ts tests/auto-refresh.test.ts && git commit -m "feat: add /api/cards/version endpoint for lightweight change detection"
```

---

### Task 2: Client-side refresh logic

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `tests/auto-refresh.test.ts` (append integration tests)

- [ ] **Step 1: Append failing integration tests to `tests/auto-refresh.test.ts`**

Append to `tests/auto-refresh.test.ts` after the last test:

```ts
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
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
cd /home/gmk_user/kanban && npx playwright test tests/auto-refresh.test.ts --reporter=line 2>&1 | grep -E "passed|failed|error" | head -10
```

Expected: 5 existing pass, 3 new fail.

- [ ] **Step 3: Add version tracking and refresh logic to `+page.svelte`**

In the `<script>` block, after the existing state declarations (around line 20), add:

```ts
let lastVersion = $state<string | null>(null);
let lastVersionCheckTime = 0;

async function fetchVersion(): Promise<string | null> {
	try {
		const res = await fetch(`/api/cards/version?board=${activeBoard}`);
		if (!res.ok) return null;
		const { version } = await res.json();
		return version;
	} catch {
		return null;
	}
}

async function checkAndRefresh() {
	const now = Date.now();
	if (now - lastVersionCheckTime < 2000) return;
	lastVersionCheckTime = now;
	const version = await fetchVersion();
	if (version !== null && lastVersion !== null && version !== lastVersion) {
		await loadCards();
	} else if (version !== null && lastVersion === null) {
		lastVersion = version;
	}
}
```

- [ ] **Step 4: Capture version at end of `loadCards()`**

In `loadCards()`, in the `finally` block, after `loading = false;`, add a version capture. The full `finally` block becomes:

```ts
	} finally {
		loading = false;
		lastVersion = await fetchVersion();
	}
```

- [ ] **Step 5: Reset lastVersion on board switch**

In `switchBoard()`, add `lastVersion = null;` before the `await loadCards()` call:

```ts
async function switchBoard(board: string) {
	activeBoard = board;
	showHidden = false;
	mobileColumn = 0;
	lastVersion = null;
	await loadCards();
}
```

- [ ] **Step 6: Register and clean up focus/visibility listeners in `onMount`**

Replace the existing `onMount` block with:

```ts
onMount(() => {
	const mq = window.matchMedia('(max-width: 767px)');
	isMobile = mq.matches;
	const onResize = () => { isMobile = mq.matches; };
	mq.addEventListener('change', onResize);
	loadCards();

	const onVisibility = () => { if (!document.hidden) checkAndRefresh(); };
	const onFocus = () => checkAndRefresh();
	document.addEventListener('visibilitychange', onVisibility);
	window.addEventListener('focus', onFocus);

	return () => {
		mq.removeEventListener('change', onResize);
		document.removeEventListener('visibilitychange', onVisibility);
		window.removeEventListener('focus', onFocus);
	};
});
```

- [ ] **Step 7: Run all auto-refresh tests**

```bash
cd /home/gmk_user/kanban && npx playwright test tests/auto-refresh.test.ts --reporter=line 2>&1 | tail -20
```

Expected: all 8 tests pass.

- [ ] **Step 8: Commit**

```bash
cd /home/gmk_user/kanban && git add src/routes/+page.svelte tests/auto-refresh.test.ts && git commit -m "feat: auto-refresh board on focus using version endpoint"
```

---

### Task 3: Card enter/exit animations

**Files:**
- Modify: `src/lib/components/Column.svelte`

No automated tests — animations are visual. Verify manually by running the dev server.

- [ ] **Step 1: Add transition imports to `Column.svelte`**

At the top of the `<script>` block in `Column.svelte`, add after the existing imports:

```ts
import { fly, fade } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
```

The full script imports section becomes:

```ts
import { dndzone } from 'svelte-dnd-action';
import { fly, fade } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import CardItem from './CardItem.svelte';
import type { Tag } from '$lib/server/tags';
import type { CardData } from '$lib/types';
```

- [ ] **Step 2: Wrap each card item in a transition div**

In `Column.svelte`, replace the `{#each}` block (lines 87–99):

```svelte
{#each dragItems as card (card.id)}
	<div
		in:fly={{ y: -10, duration: 220, easing: cubicOut }}
		out:fade={{ duration: 180 }}
	>
		<CardItem
			{card}
			{tags}
			{isMobile}
			{canAdvance}
			{canRetreat}
			{focusedCardId}
			onclick={() => onCardClick(card)}
			onhide={() => onHideCard(card.id)}
			onadvance={() => onAdvanceCard(card)}
			onretreat={() => onRetreatCard(card)}
		/>
	</div>
{/each}
```

- [ ] **Step 3: Build and verify visually**

```bash
cd /home/gmk_user/kanban && npm run build 2>&1 | tail -10
```

Expected: build completes with no errors.

Open the dev server and verify:
1. Load the board — no animations fire on initial load (cards are already present, no enters trigger)
2. Add a card via the modal — the new card slides in from above
3. Delete a card via the modal — the card fades out before removal
4. Return from another tab after adding a card via API (`curl -X POST http://localhost:5173/api/cards -H 'Content-Type: application/json' -d '{"board":"personal","column":"idea","title":"Test refresh"}'`) — new card slides in

- [ ] **Step 4: Commit**

```bash
cd /home/gmk_user/kanban && git add src/lib/components/Column.svelte && git commit -m "feat: animate card enter/exit on board refresh"
```

---

### Task 4: Production build and restart

- [ ] **Step 1: Build**

```bash
cd /home/gmk_user/kanban && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 2: Restart PM2**

```bash
pm2 restart kanban
```

- [ ] **Step 3: Run full test suite**

```bash
cd /home/gmk_user/kanban && npx playwright test --reporter=line 2>&1 | tail -15
```

Expected: all tests pass.
