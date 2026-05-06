<script lang="ts">
	import { untrack } from 'svelte';
	import TipTapEditor from './TipTapEditor.svelte';
	import type { Tag } from '$lib/server/tags';
	import type { CardData } from '$lib/types';

	// card = null means create mode (new card)
	interface Props {
		card: CardData | null;
		createColumn?: string;
		createBoard?: string;
		tags: Tag[];
		onclose: () => void;
		onsave: (card: CardData) => void;
		ondelete: (id: number) => void;
	}

	let { card, createColumn, createBoard, tags, onclose, onsave, ondelete }: Props = $props();

	const isCreate = $derived(card === null);

	// Use untrack so Svelte knows we intentionally want the initial value only.
	// The modal is destroyed/recreated each open so prop changes after mount don't happen.
	let title = $state(untrack(() => card?.title ?? ''));
	let body = $state(untrack(() => card?.body ?? ''));
	let selectedTags = $state<string[]>(untrack(() => [...(card?.tags ?? [])]));
	let cardId = $state(untrack(() => card?.id ?? null));

	let saving = $state(false);
	let showTagPicker = $state(false);

	// Resolves to the new card id once auto-created, or null on failure.
	let autoCreatePromise: Promise<number | null> | null = null;

	async function postNewCard(): Promise<number | null> {
		const res = await fetch('/api/cards', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ board: createBoard, column: createColumn, title: title.trim() })
		});
		if (!res.ok) return null;
		const created: CardData = await res.json();
		cardId = created.id;
		return created.id;
	}

	// Auto-create card once a title exists so image uploads work immediately.
	$effect(() => {
		if (cardId !== null || !title.trim()) return;
		let timer: ReturnType<typeof setTimeout>;
		timer = setTimeout(() => { autoCreatePromise = postNewCard(); }, 400);
		return () => clearTimeout(timer);
	});

	function toggleTag(slug: string) {
		if (selectedTags.includes(slug)) {
			selectedTags = selectedTags.filter((s) => s !== slug);
		} else {
			selectedTags = [...selectedTags, slug];
		}
	}

	async function save() {
		if (!title.trim()) return;
		saving = true;
		try {
			// Await in-flight auto-create, or create now if user beat the debounce
			if (autoCreatePromise) await autoCreatePromise;
			if (cardId === null) await postNewCard();
			if (cardId === null) return;

			const res = await fetch(`/api/cards/${cardId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: title.trim(), body, tags: selectedTags })
			});
			if (res.ok) onsave(await res.json());
		} finally {
			saving = false;
		}
	}

	async function deleteCard() {
		if (!card) return;
		if (!confirm('Delete this card?')) return;
		await fetch(`/api/cards/${card.id}`, { method: 'DELETE' });
		ondelete(card.id);
	}

	async function cancelAndCleanup() {
		// If we auto-created a card but user cancels, clean it up
		if (isCreate && cardId !== null) {
			await fetch(`/api/cards/${cardId}`, { method: 'DELETE' });
		}
		onclose();
	}

	function backdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) cancelAndCleanup();
	}

	function getTag(slug: string) {
		return tags.find((t) => t.slug === slug);
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && cancelAndCleanup()} />

<div
	class="backdrop"
	role="presentation"
	onclick={backdropClick}
>
	<div class="modal" role="dialog" aria-modal="true" aria-label={isCreate ? 'New card' : 'Edit card'}>
		<div class="modal-header">
			<input
				class="title-input"
				bind:value={title}
				placeholder="Card title"
				aria-label="Card title"
			/>
			<button class="close-btn" onclick={cancelAndCleanup} aria-label="Close">✕</button>
		</div>

		<div class="tags-row">
			{#each selectedTags as slug}
				{@const tag = getTag(slug)}
				<span class="tag-pill" style="--c: {tag?.color ?? '#555'}">
					{tag?.label ?? slug}
					<button onclick={() => toggleTag(slug)} aria-label="Remove tag">×</button>
				</span>
			{/each}
			<button class="add-tag-btn" onclick={() => (showTagPicker = !showTagPicker)}>+ tag</button>
		</div>

		{#if showTagPicker}
			<div class="tag-picker">
				{#each tags as tag}
					<button
						class="tag-option"
						class:selected={selectedTags.includes(tag.slug)}
						onclick={() => toggleTag(tag.slug)}
						style="--tag-color: {tag.color}"
					>
						<span class="tag-dot" style="background: {tag.color}"></span>
						{tag.label}
					</button>
				{/each}
			</div>
		{/if}

		<div class="editor-section">
			<TipTapEditor
				content={body}
				cardId={cardId}
				onchange={(json) => (body = json)}
			/>
		</div>

		<div class="modal-footer">
			{#if !isCreate}
				<button class="delete-btn" onclick={deleteCard}>Delete card</button>
			{:else}
				<div></div>
			{/if}
			<div class="footer-actions">
				<button class="cancel-btn" onclick={cancelAndCleanup}>Cancel</button>
				<button class="save-btn" onclick={save} disabled={saving || !title.trim()}>
					{saving ? 'Saving…' : isCreate ? 'Create' : 'Save'}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 20px;
		backdrop-filter: blur(2px);
	}

	.modal {
		background: var(--surface);
		border: 1px solid var(--border-mid);
		border-radius: 10px;
		width: min(640px, 100%);
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 24px 64px rgba(0,0,0,0.7);
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 24px;
	}

	.modal-header {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.title-input {
		flex: 1;
		background: transparent;
		border: none;
		border-bottom: 2px solid var(--border-mid);
		color: var(--text);
		font-size: 19px;
		font-weight: 700;
		padding: 0 0 8px;
		outline: none;
		transition: border-color 0.15s;
		line-height: 1.3;
	}

	.title-input::placeholder { color: var(--text-3); }
	.title-input:focus { border-bottom-color: var(--accent); }

	.close-btn {
		background: none;
		border: none;
		color: var(--text-2);
		font-size: 18px;
		padding: 0;
		line-height: 1;
		flex-shrink: 0;
		margin-top: 4px;
		min-width: 36px;
		min-height: 36px;
		border-radius: 4px;
		transition: color 0.15s, background 0.15s;
	}

	.close-btn:hover { color: var(--text); background: rgba(255,255,255,0.08); }

	.tags-row {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
		align-items: center;
	}

	.tag-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		border-radius: 4px;
		padding: 4px 10px 4px 12px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: var(--c);
		background: color-mix(in srgb, var(--c) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
	}

	.tag-pill button {
		background: none;
		border: none;
		color: var(--c);
		font-size: 14px;
		line-height: 1;
		padding: 0;
		opacity: 0.7;
		min-width: 20px;
		min-height: 20px;
	}
	.tag-pill button:hover { opacity: 1; }

	.add-tag-btn {
		background: none;
		border: 1px solid var(--border-hi);
		color: var(--text-2);
		border-radius: 4px;
		padding: 4px 12px;
		font-size: 12px;
		font-weight: 600;
		min-height: 30px;
		transition: border-color 0.15s, color 0.15s;
	}
	.add-tag-btn:hover { border-color: var(--text-2); color: var(--text); }

	.tag-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
		background: var(--card);
		border-radius: 7px;
		padding: 12px;
		border: 1px solid var(--border);
	}

	.tag-option {
		display: flex;
		align-items: center;
		gap: 7px;
		background: var(--surface);
		border: 1px solid var(--border-hi);
		color: var(--text);
		border-radius: 5px;
		padding: 5px 12px;
		font-size: 12px;
		font-weight: 600;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
		min-height: 34px;
	}
	.tag-option:hover { border-color: var(--text-2); background: rgba(255,255,255,0.05); }
	.tag-option.selected { border-color: var(--tag-color); background: color-mix(in srgb, var(--tag-color) 14%, transparent); }

	.tag-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.editor-section { flex: 1; }

	.modal-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 6px;
		border-top: 1px solid var(--border);
		margin-top: 4px;
	}

	.delete-btn {
		background: none;
		border: none;
		color: var(--text-2);
		font-size: 12px;
		font-weight: 600;
		padding: 6px 0;
		transition: color 0.15s;
		min-height: 38px;
		letter-spacing: 0.2px;
	}
	.delete-btn:hover { color: var(--danger); }

	.footer-actions { display: flex; gap: 10px; }

	.cancel-btn {
		background: none;
		border: 1px solid var(--border-mid);
		color: var(--text-2);
		border-radius: 6px;
		padding: 8px 20px;
		font-size: 13px;
		font-weight: 500;
		transition: border-color 0.15s, color 0.15s;
		min-height: 40px;
	}
	.cancel-btn:hover { border-color: var(--border-hi); color: var(--text); }

	.save-btn {
		background: var(--accent);
		border: none;
		color: #fff;
		border-radius: 6px;
		padding: 8px 24px;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.3px;
		transition: background 0.15s, box-shadow 0.15s;
		min-height: 40px;
	}
	.save-btn:hover:not(:disabled) {
		background: var(--accent-hi);
		box-shadow: 0 4px 16px var(--accent-glow);
	}
	.save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	@media (max-width: 768px) {
		.backdrop { padding: 0; align-items: flex-end; backdrop-filter: none; }
		.modal {
			width: 100%;
			/* dvh tracks the visual viewport — shrinks when the keyboard opens */
			max-height: 92dvh;
			border-radius: 16px 16px 0 0;
			padding: 20px 18px;
			padding-bottom: max(18px, env(safe-area-inset-bottom));
			overflow: hidden;
		}
		/* Pin title + footer; let only the editor section scroll */
		.editor-section {
			flex: 1;
			min-height: 0;
			overflow-y: auto;
		}
		.title-input { font-size: 17px; }
	}
</style>
