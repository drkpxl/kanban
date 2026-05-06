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
	let editCard = $state<CardData | null>(null);
	let newCardColumn = $state<string | null>(null);
	let showHidden = $state(false);
	let hiddenCount = $state(0);
	const COLUMNS = [
		{ id: 'idea', label: 'Idea' },
		{ id: 'in_progress', label: 'In Progress' },
		{ id: 'complete', label: 'Complete' }
	];

	let isMobile = $state(false);
	let mobileColumn = $state(0);
	const activeMobileColumn = $derived(COLUMNS[mobileColumn]);

	function cardsForColumn(col: string) {
		return allCards.filter((c) => c.column === col);
	}

	async function loadCards() {
		loading = true;
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
		newCardColumn = null;
		editCard = { ...card };
	}

	function openNewCard(column: string) {
		editCard = null;
		newCardColumn = column;
	}

	function closeModal() {
		editCard = null;
		newCardColumn = null;
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

	async function advanceCard(card: CardData) {
		const COLS = ['idea', 'in_progress', 'complete'];
		const nextIdx = COLS.indexOf(card.column) + 1;
		if (nextIdx >= COLS.length) return;
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

	onMount(async () => {
		isMobile = window.innerWidth < 768;
		window.addEventListener('resize', () => {
			isMobile = window.innerWidth < 768;
		});
		await loadCards();
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
	{:else if isMobile}
		<div class="mobile-board">
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
				onCardClick={openCard}
				onHideCard={hideCard}
				onHideAll={hideAll}
				onShowHidden={toggleShowHidden}
				onAdvanceCard={advanceCard}
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
					onCardClick={openCard}
					onHideCard={hideCard}
					onHideAll={hideAll}
					onShowHidden={toggleShowHidden}
					onAdvanceCard={advanceCard}
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

	.mobile-board {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 14px;
		gap: 12px;
		overflow: hidden;
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
	}

	.dot.active { background: var(--accent); }

	@media (max-width: 768px) {
		.nav { padding: 0 16px; height: 50px; }
		.app-name { font-size: 10px; width: auto; }
		.nav-right { display: none; }
	}
</style>
