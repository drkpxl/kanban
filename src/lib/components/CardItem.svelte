<script lang="ts">
	import type { Tag } from '$lib/server/tags';
	import type { CardData } from '$lib/types';
	import { swipeable } from '$lib/actions/swipeable';

	interface Props {
		card: CardData;
		tags: Tag[];
		isMobile: boolean;
		canAdvance: boolean;
		canRetreat: boolean;
		focusedCardId: number | null;
		onclick: () => void;
		onhide: () => void;
		onadvance: () => void;
		onretreat: () => void;
	}

	let { card, tags, isMobile, canAdvance, canRetreat, focusedCardId, onclick, onhide, onadvance, onretreat }: Props = $props();

	function getTag(slug: string) { return tags.find(t => t.slug === slug); }

	function getExcerpt(body: string | null): string {
		if (!body) return '';
		try {
			const doc = JSON.parse(body);
			const texts: string[] = [];
			function walk(node: { type?: string; text?: string; content?: unknown[] }) {
				if (node.type === 'text') texts.push(node.text ?? '');
				node.content?.forEach(c => walk(c as typeof node));
			}
			walk(doc);
			return texts.join(' ').slice(0, 130);
		} catch { return ''; }
	}

	const firstTag = $derived(card.tags.length > 0 ? getTag(card.tags[0]) : null);
	const excerpt  = $derived(getExcerpt(card.body));
	const isComplete = $derived(card.column === 'complete');
	const isFocused = $derived(card.id === focusedCardId);
</script>

<div
	class="card"
	class:complete={isComplete}
	class:focused={isFocused}
	data-card-id={card.id}
	style={firstTag ? `--tag-color: ${firstTag.color}` : '--tag-color: transparent'}
	role="button"
	tabindex="0"
	aria-label={card.title}
	onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && onclick()}
	use:swipeable={{ enabled: isMobile && (canAdvance || canRetreat), onLeft: onretreat, onRight: onadvance }}
>
	<div class="card-accent"></div>

	<div class="card-main" onclick={onclick} role="presentation">
		<div class="card-title" class:done={isComplete}>{card.title}</div>

		{#if excerpt && !isComplete}
			<div class="card-excerpt">{excerpt}</div>
		{/if}

		{#if card.tags.length > 0}
			<div class="card-tags">
				{#each card.tags as slug}
					{@const tag = getTag(slug)}
					{#if tag}
						<span class="tag-pill" style="--c: {tag.color}">{tag.label}</span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<div class="card-actions">
		{#if isMobile}
			<div class="mobile-move-btns">
				{#if canRetreat}
					<button class="move-btn" onclick={onretreat} aria-label="Move to previous column">←</button>
				{/if}
				{#if canAdvance}
					<button class="move-btn" onclick={onadvance} aria-label="Move to next column">→</button>
				{/if}
			</div>
		{/if}
		{#if isComplete}
			<button class="hide-btn" onclick={onhide} aria-label="Archive card">Archive</button>
		{/if}
	</div>
</div>

<style>
	.card {
		background: var(--card);
		border-radius: 6px;
		border: 1px solid var(--border);
		display: flex;
		align-items: stretch;
		cursor: grab;
		transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
		user-select: none;
		position: relative;
		overflow: hidden;
	}

	.card:hover {
		border-color: var(--border-mid);
		box-shadow: 0 4px 16px rgba(0,0,0,0.35);
		transform: translateY(-1px);
		background: var(--card-hover);
	}

	.card.focused {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
	}

	.card.complete {
		background: var(--surface);
	}

	.card.complete .card-title {
		text-decoration: line-through;
		color: var(--text-3);
	}

	/* Left accent bar using the tag color */
	.card-accent {
		width: 4px;
		flex-shrink: 0;
		background: var(--tag-color);
		transition: background 0.2s;
	}

	.card.complete .card-accent {
		opacity: 0.35;
	}

	.card-main {
		flex: 1;
		padding: 13px 14px;
		min-width: 0;
	}

	.card-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		line-height: 1.45;
		word-break: break-word;
	}

	.card-excerpt {
		font-size: 12px;
		color: var(--text-2);
		margin-top: 5px;
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 9px;
	}

	.tag-pill {
		border-radius: 3px;
		padding: 2px 8px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: var(--c);
		background: color-mix(in srgb, var(--c) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
	}

	.card-actions {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: flex-end;
		padding: 10px 10px 10px 0;
		gap: 5px;
		opacity: 0;
		transition: opacity 0.15s;
		flex-shrink: 0;
	}

	.card:hover .card-actions,
	.card:focus-within .card-actions { opacity: 1; }

	@media (max-width: 768px) {
		.card { touch-action: none; }
		.card-actions { opacity: 1; }
		/* 44px minimum touch targets */
		.move-btn { min-height: 44px; min-width: 44px; }
		.hide-btn { min-height: 44px; padding: 0 12px; }
	}

	.hide-btn {
		background: none;
		border: 1px solid var(--border-hi);
		color: var(--text-2);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		padding: 3px 8px;
		border-radius: 3px;
		white-space: nowrap;
		min-height: 28px;
		transition: border-color 0.15s, color 0.15s;
	}

	.hide-btn:hover { border-color: var(--text-2); color: var(--text); }

	.mobile-move-btns {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.move-btn {
		background: var(--surface);
		border: 1px solid var(--border-mid);
		color: var(--text-2);
		font-size: 15px;
		padding: 4px 10px;
		border-radius: 4px;
		line-height: 1;
		min-height: 34px;
		transition: background 0.15s, border-color 0.15s;
	}

	.move-btn:hover { background: var(--accent); border-color: var(--accent); color: #fff; }
</style>
