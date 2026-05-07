<script lang="ts">
	import { onMount } from 'svelte';
	import BoardSwitcher from '$lib/components/BoardSwitcher.svelte';
	import Column from '$lib/components/Column.svelte';
	import CardModal from '$lib/components/CardModal.svelte';
	import type { PageData } from './$types';
	import type { CardData } from '$lib/types';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';

	let { data }: { data: PageData } = $props();
	const tags = $derived(data.tags);

	let activeBoard = $state('personal');
	let allCards = $state<CardData[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let editCard = $state<CardData | null>(null);
	let newCardColumn = $state<string | null>(null);
	let showHidden = $state(false);
	let hiddenCount = $state(0);

	const COLUMNS = [
		{ id: 'idea', label: 'Idea' },
		{ id: 'in_progress', label: 'In Progress' },
		{ id: 'complete', label: 'Complete' }
	];

	let focusedCardId = $state<number | null>(null);

	const modalOpen = $derived(editCard !== null || newCardColumn !== null);

	const flatCards = $derived(
		COLUMNS.flatMap((col) =>
			allCards
				.filter((c) => c.column === col.id && c.hidden !== 1)
				.sort((a, b) => a.position - b.position)
		)
	);

	let isMobile = $state(false);
	let mobileColumn = $state(0);
	const activeMobileColumn = $derived(COLUMNS[mobileColumn]);

	// Mobile touch state
	let mobileBoardEl = $state<HTMLElement | null>(null);
	let dragZone = $state<'left' | 'right' | null>(null);
	let isDragging = $state(false);
	let triggeringEl = $state<HTMLElement | null>(null);

	function cardsForColumn(col: string) {
		return allCards.filter((c) => c.column === col);
	}

	async function loadCards() {
		loading = true;
		loadError = null;
		try {
			const params = new URLSearchParams({ board: activeBoard });
			if (showHidden) params.set('showHidden', 'true');

			if (showHidden) {
				const res = await fetch(`/api/cards?${params}`);
				if (res.ok) {
					allCards = await res.json();
					hiddenCount = allCards.filter((c) => c.column === 'complete' && c.hidden === 1).length;
				}
			} else {
				// Fetch visible cards and all-cards concurrently to get hidden count
				const [visRes, allRes] = await Promise.all([
					fetch(`/api/cards?${params}`),
					fetch(`/api/cards?board=${activeBoard}&showHidden=true`)
				]);
				if (visRes.ok) allCards = await visRes.json();
				if (allRes.ok) {
					const allData: CardData[] = await allRes.json();
					hiddenCount = allData.filter((c) => c.column === 'complete' && c.hidden === 1).length;
				}
			}
		} catch {
			loadError = 'Failed to load cards. Check your connection and try again.';
		} finally {
			loading = false;
		}
	}

	async function switchBoard(board: string) {
		activeBoard = board;
		showHidden = false;
		mobileColumn = 0;
		await loadCards();
	}

	async function toggleShowHidden() {
		showHidden = !showHidden;
		await loadCards();
	}

	async function handleDrop(column: string, items: CardData[]) {
		allCards = allCards
			.filter((c) => c.column !== column)
			.concat(items.map((card, i) => ({ ...card, column, position: i })));

		await fetch('/api/cards/reorder', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ updates: items.map((card, i) => ({ id: card.id, position: i, column })) })
		});
	}

	async function hideCard(id: number) {
		await fetch(`/api/cards/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ hidden: 1 })
		});
		if (!showHidden) {
			allCards = allCards.filter((c) => c.id !== id);
			hiddenCount += 1;
		} else {
			allCards = allCards.map((c) => (c.id === id ? { ...c, hidden: 1 } : c));
		}
	}

	async function hideAll() {
		const completeCards = cardsForColumn('complete');
		await Promise.all(
			completeCards.map((c) =>
				fetch(`/api/cards/${c.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ hidden: 1 })
				})
			)
		);
		hiddenCount += completeCards.length;
		if (!showHidden) {
			allCards = allCards.filter((c) => c.column !== 'complete');
		} else {
			allCards = allCards.map((c) => (c.column === 'complete' ? { ...c, hidden: 1 } : c));
		}
	}

	function openCard(card: CardData) {
		triggeringEl = document.activeElement as HTMLElement;
		newCardColumn = null;
		editCard = { ...card };
	}

	function openNewCard(column: string) {
		triggeringEl = document.activeElement as HTMLElement;
		editCard = null;
		newCardColumn = column;
	}

	function closeModal() {
		editCard = null;
		newCardColumn = null;
		triggeringEl?.focus();
		triggeringEl = null;
	}

	function handleSave(updated: CardData) {
		const existing = allCards.find((c) => c.id === updated.id);
		if (existing) {
			allCards = allCards.map((c) => (c.id === updated.id ? { ...updated } : c));
		} else {
			allCards = [...allCards, updated];
		}
		editCard = null;
		newCardColumn = null;
	}

	function handleDelete(id: number) {
		allCards = allCards.filter((c) => c.id !== id);
		editCard = null;
		newCardColumn = null;
	}

	async function moveCard(card: CardData, direction: 1 | -1) {
		const COLS = COLUMNS.map(c => c.id);
		const nextIdx = COLS.indexOf(card.column) + direction;
		if (nextIdx < 0 || nextIdx >= COLS.length) return;
		const nextCol = COLS[nextIdx];
		const nextCards = cardsForColumn(nextCol);
		const newPosition = nextCards.length;

		await fetch(`/api/cards/${card.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ column: nextCol, position: newPosition })
		});
		allCards = allCards.map((c) =>
			c.id === card.id ? { ...c, column: nextCol, position: newPosition } : c
		);
	}

	const advanceCard = (card: CardData) => moveCard(card, 1);
	const retreatCard = (card: CardData) => moveCard(card, -1);

	onMount(() => {
		const mq = window.matchMedia('(max-width: 767px)');
		isMobile = mq.matches;
		const onResize = () => { isMobile = mq.matches; };
		mq.addEventListener('change', onResize);
		loadCards();

		return () => mq.removeEventListener('change', onResize);
	});

	$effect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (modalOpen) return;
			const target = e.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

			const cards = flatCards;
			const currentIdx = focusedCardId !== null ? cards.findIndex((c) => c.id === focusedCardId) : -1;

			switch (e.key) {
				case 'n': {
					e.preventDefault();
					openNewCard('idea');
					break;
				}
				case 'j': {
					e.preventDefault();
					if (cards.length === 0) break;
					focusedCardId = cards[(currentIdx + 1) % cards.length].id;
					requestAnimationFrame(() => {
						document.querySelector(`[data-card-id="${focusedCardId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
					});
					break;
				}
				case 'k': {
					e.preventDefault();
					if (cards.length === 0) break;
					focusedCardId = cards[(currentIdx - 1 + cards.length) % cards.length].id;
					requestAnimationFrame(() => {
						document.querySelector(`[data-card-id="${focusedCardId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
					});
					break;
				}
				case ']': {
					e.preventDefault();
					if (focusedCardId === null) break;
					const toAdvance = cards.find((c) => c.id === focusedCardId);
					if (toAdvance) advanceCard(toAdvance);
					break;
				}
				case '[': {
					e.preventDefault();
					if (focusedCardId === null) break;
					const toRetreat = cards.find((c) => c.id === focusedCardId);
					if (toRetreat) retreatCard(toRetreat);
					break;
				}
				case 'ArrowRight': {
					if (!e.shiftKey) break;
					e.preventDefault();
					if (focusedCardId === null) break;
					const toAdvanceR = cards.find((c) => c.id === focusedCardId);
					if (toAdvanceR) advanceCard(toAdvanceR);
					break;
				}
				case 'ArrowLeft': {
					if (!e.shiftKey) break;
					e.preventDefault();
					if (focusedCardId === null) break;
					const toRetreatL = cards.find((c) => c.id === focusedCardId);
					if (toRetreatL) retreatCard(toRetreatL);
					break;
				}
				case 'Enter': {
					if (focusedCardId === null) break;
					const toOpen = cards.find((c) => c.id === focusedCardId);
					if (toOpen) openCard(toOpen);
					break;
				}
				case 'Escape': {
					focusedCardId = null;
					break;
				}
			}
		}

		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	});


	$effect(() => {
		if (!isMobile || !mobileBoardEl) return;
		const el = mobileBoardEl;

		function onCardSwipeStart() { isDragging = true; }
		function onCardSwipeMove(e: Event) {
			dragZone = (e as CustomEvent<{ zone: 'left' | 'right' | null }>).detail.zone;
		}
		function onCardSwipeEnd() { isDragging = false; dragZone = null; }

		let swipeStartX = 0;
		let swipeStartY = 0;
		let swipingColumn = false;

		function onTouchStart(e: TouchEvent) {
			if (e.touches.length !== 1) return;
			const target = e.target as Element;
			if (target.closest('[data-card-id]') || target.closest('button')) return;
			swipeStartX = e.touches[0].clientX;
			swipeStartY = e.touches[0].clientY;
			swipingColumn = true;
		}
		function onTouchEnd(e: TouchEvent) {
			if (!swipingColumn) return;
			swipingColumn = false;
			const dx = e.changedTouches[0].clientX - swipeStartX;
			const dy = e.changedTouches[0].clientY - swipeStartY;
			if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
				if (dx < 0 && mobileColumn < COLUMNS.length - 1) mobileColumn += 1;
				else if (dx > 0 && mobileColumn > 0) mobileColumn -= 1;
			}
		}
		function onTouchCancel() { swipingColumn = false; }

		el.addEventListener('cardswipestart', onCardSwipeStart);
		el.addEventListener('cardswipemove', onCardSwipeMove);
		el.addEventListener('cardswipeend', onCardSwipeEnd);
		el.addEventListener('touchstart', onTouchStart, { passive: true });
		el.addEventListener('touchend', onTouchEnd, { passive: true });
		el.addEventListener('touchcancel', onTouchCancel, { passive: true });

		return () => {
			el.removeEventListener('cardswipestart', onCardSwipeStart);
			el.removeEventListener('cardswipemove', onCardSwipeMove);
			el.removeEventListener('cardswipeend', onCardSwipeEnd);
			el.removeEventListener('touchstart', onTouchStart);
			el.removeEventListener('touchend', onTouchEnd);
			el.removeEventListener('touchcancel', onTouchCancel);
		};
	});
</script>

<div class="app">
	<nav class="nav">
		<span class="app-name">Kanban<span>.</span></span>
		<BoardSwitcher active={activeBoard} onchange={switchBoard} />
		<div class="nav-right">
			<ThemeSwitcher />
		</div>
	</nav>

	{#if loading}
		<div class="loading">Loading…</div>
	{:else if loadError}
		<div class="load-error">
			<p>{loadError}</p>
			<button onclick={loadCards}>Retry</button>
		</div>
	{:else if isMobile}
		<div class="mobile-board" bind:this={mobileBoardEl} class:dragging={isDragging}>
			{#if isDragging}
				{#if mobileColumn > 0}
					<div class="drop-zone drop-zone-left" class:active={dragZone === 'left'}>
						<span>←</span>
					</div>
				{/if}
				{#if mobileColumn < COLUMNS.length - 1}
					<div class="drop-zone drop-zone-right" class:active={dragZone === 'right'}>
						<span>→</span>
					</div>
				{/if}
			{/if}
			<div class="mobile-dots">
				{#each COLUMNS as col, i}
					<button
						class="dot"
						class:active={mobileColumn === i}
						onclick={() => (mobileColumn = i)}
						aria-label={col.label}
					></button>
				{/each}
			</div>
			<Column
				id={activeMobileColumn.id}
				label={activeMobileColumn.label}
				cards={cardsForColumn(activeMobileColumn.id)}
				{tags}
				board={activeBoard}
				{isMobile}
				{showHidden}
				{hiddenCount}
				{focusedCardId}
				onCardClick={openCard}
				onHideCard={hideCard}
				onHideAll={hideAll}
				onShowHidden={toggleShowHidden}
				onAdvanceCard={advanceCard}
				onRetreatCard={retreatCard}
				onDrop={handleDrop}
				onAddCard={() => openNewCard(activeMobileColumn.id)}
			/>
		</div>
	{:else}
		<div class="board">
			{#each COLUMNS as col}
				<Column
					id={col.id}
					label={col.label}
					cards={cardsForColumn(col.id)}
					{tags}
					board={activeBoard}
					{isMobile}
					{showHidden}
					{hiddenCount}
					{focusedCardId}
					onCardClick={openCard}
					onHideCard={hideCard}
					onHideAll={hideAll}
					onShowHidden={toggleShowHidden}
					onAdvanceCard={advanceCard}
					onRetreatCard={retreatCard}
					onDrop={handleDrop}
					onAddCard={() => openNewCard(col.id)}
				/>
			{/each}
		</div>
	{/if}
</div>

{#if editCard}
	<CardModal
		card={editCard}
		{tags}
		onclose={closeModal}
		onsave={handleSave}
		ondelete={handleDelete}
	/>
{:else if newCardColumn}
	<CardModal
		card={null}
		createColumn={newCardColumn}
		createBoard={activeBoard}
		{tags}
		onclose={closeModal}
		onsave={handleSave}
		ondelete={handleDelete}
	/>
{/if}

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
		overflow: hidden;
	}

	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px;
		height: 56px;
		background: var(--nav);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.app-name {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 5px;
		text-transform: uppercase;
		color: var(--text);
		width: 120px;
		opacity: 0.9;
	}

	.app-name span {
		color: var(--accent);
	}

	.nav-right {
		width: 120px;
	}

	.board {
		display: flex;
		gap: 14px;
		padding: 20px;
		flex: 1;
		overflow: hidden;
	}

	.loading {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-3);
		font-size: 14px;
		letter-spacing: 0.5px;
	}

	.load-error {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		color: var(--danger);
		font-size: 14px;
	}

	.load-error button {
		border: 1px solid var(--danger);
		color: var(--danger);
		background: none;
		border-radius: 6px;
		padding: 8px 20px;
		font-size: 13px;
		font-weight: 600;
	}

	.mobile-board {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 14px;
		gap: 12px;
		overflow: hidden;
		position: relative;
		touch-action: pan-y;
	}

	.drop-zone {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 42%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-faint);
		border: 2px dashed var(--accent);
		z-index: 20;
		opacity: 0.45;
		transition: background 0.15s, opacity 0.15s;
		pointer-events: none;
	}

	.drop-zone.active {
		background: var(--accent-glow);
		opacity: 1;
	}

	.drop-zone-left  { left: 0; border-radius: 0 10px 10px 0; border-left: none; }
	.drop-zone-right { right: 0; border-radius: 10px 0 0 10px; border-right: none; }

	.drop-zone span {
		font-size: 22px;
		color: var(--accent);
	}

	.mobile-board.dragging :global(.card:not([data-swiping])) {
		opacity: 0.5;
		transition: opacity 0.1s;
	}

	.mobile-dots {
		display: flex;
		justify-content: center;
		gap: 10px;
	}

	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--border-mid);
		border: none;
		padding: 0;
		transition: background 0.2s;
		position: relative;
		flex-shrink: 0;
	}

	/* Invisible extended hit area — keeps visual dot small, tap target 45×45px */
	.dot::before {
		content: '';
		position: absolute;
		inset: -18px;
	}

	.dot.active { background: var(--accent); }

	@media (max-width: 768px) {
		.nav { padding: 0 12px; height: 50px; gap: 8px; }
		.app-name { font-size: 10px; width: auto; }
		.nav-right { width: auto; }
	}
</style>
