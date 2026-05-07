<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import CardItem from './CardItem.svelte';
	import type { Tag } from '$lib/server/tags';
	import type { CardData } from '$lib/types';

	interface Props {
		id: string;
		label: string;
		cards: CardData[];
		tags: Tag[];
		board: string;
		isMobile: boolean;
		showHidden: boolean;
		hiddenCount: number;
		focusedCardId: number | null;
		onCardClick: (card: CardData) => void;
		onHideCard: (id: number) => void;
		onHideAll: () => void;
		onShowHidden: () => void;
		onAdvanceCard: (card: CardData) => void;
		onRetreatCard: (card: CardData) => void;
		onDrop: (column: string, items: CardData[]) => void;
		onAddCard: () => void;
	}

	let {
		id, label, cards, tags, board, isMobile,
		showHidden, hiddenCount, focusedCardId,
		onCardClick, onHideCard, onHideAll, onShowHidden,
		onAdvanceCard, onRetreatCard, onDrop, onAddCard
	}: Props = $props();

	const COL_ORDER = ['idea', 'in_progress', 'complete'];
	const isComplete = $derived(id === 'complete');
	const canAdvance = $derived(COL_ORDER.indexOf(id) < COL_ORDER.length - 1);
	const canRetreat = $derived(COL_ORDER.indexOf(id) > 0);

	const colColor = $derived(
		id === 'idea'        ? 'var(--col-idea)' :
		id === 'in_progress' ? 'var(--col-progress)' :
		                       'var(--col-done)'
	);

	let dragItems = $state<CardData[]>([]);
	$effect(() => { dragItems = cards.map(c => ({ ...c })); });

	function handleConsider(e: CustomEvent<{ items: CardData[] }>) {
		dragItems = e.detail.items;
	}
	function handleFinalize(e: CustomEvent<{ items: CardData[] }>) {
		dragItems = e.detail.items;
		onDrop(id, e.detail.items);
	}
</script>

<div class="column">
	<!-- Colored top bar -->
	<div class="col-bar" style="background: {colColor}"></div>

	<div class="column-inner">
		<div class="column-header">
			<div class="col-left">
				<span class="col-label">{label}</span>
				<span class="col-count">{cards.length}</span>
			</div>
			{#if isComplete}
				<div class="col-actions">
					{#if hiddenCount > 0}
						<button class="action-btn" onclick={onShowHidden}>
							{showHidden ? 'Hide done' : `Show (${hiddenCount})`}
						</button>
					{/if}
					{#if cards.length > 0}
						<button class="action-btn" onclick={onHideAll}>Archive all</button>
					{/if}
				</div>
			{/if}
		</div>

		<div
			class="card-list"
			use:dndzone={{ items: dragItems, flipDurationMs: 180, type: 'cards', dropTargetStyle: {}, dragDisabled: isMobile }}
			onconsider={handleConsider}
			onfinalize={handleFinalize}
		>
			{#each dragItems as card (card.id)}
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
			{/each}
		</div>

		<button class="add-btn" onclick={onAddCard}>
			<span class="add-icon">+</span>
			<span>Add card</span>
		</button>
	</div>
</div>

<style>
	.column {
		flex: 1;
		background: var(--surface);
		border-radius: 8px;
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		min-height: 200px;
		min-width: 0;
		overflow: hidden;
	}

	.col-bar {
		height: 3px;
		flex-shrink: 0;
	}

	.column-inner {
		padding: 14px 14px 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.column-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.col-left {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.col-label {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--text);
	}

	.col-count {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-2);
	}

	.col-actions {
		display: flex;
		gap: 6px;
	}

	.action-btn {
		background: none;
		border: 1px solid var(--border-hi);
		color: var(--text-2);
		border-radius: 4px;
		padding: 3px 10px;
		font-size: 11px;
		font-weight: 600;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
		min-height: 28px;
	}

	.action-btn:hover {
		border-color: var(--text-2);
		color: var(--text);
		background: rgba(255,255,255,0.06);
	}

	.card-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1;
		min-height: 48px;
		overflow-y: auto;
		touch-action: pan-y;
	}

	.add-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		background: none;
		border: 1px solid var(--border-hi);
		color: var(--text-2);
		border-radius: 6px;
		padding: 10px;
		font-size: 13px;
		font-weight: 600;
		text-align: center;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
		width: 100%;
		min-height: 44px;
		letter-spacing: 0.2px;
	}

	.add-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-faint);
	}

	.add-icon {
		font-size: 18px;
		line-height: 1;
		font-weight: 400;
		color: var(--text-3);
	}

	.add-btn:hover .add-icon {
		color: var(--accent);
	}
</style>
