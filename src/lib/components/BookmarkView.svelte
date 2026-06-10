<script lang="ts">
	import { onMount } from 'svelte';
	import type { BookmarkData } from '$lib/types';
	import type { Tag } from '$lib/server/tags';
	import BookmarkItem from './BookmarkItem.svelte';

	interface Props {
		tags: Tag[];
		oncreatetag: (tag: Tag) => void;
	}

	let { tags, oncreatetag }: Props = $props();

	let allBookmarks = $state<BookmarkData[]>([]);
	let loading = $state(true);
	let filterTags = $state<string[]>([]);
	let addUrl = $state('');
	let addLoading = $state(false);
	let addError = $state<string | null>(null);

	const filteredBookmarks = $derived(
		filterTags.length === 0
			? allBookmarks
			: allBookmarks.filter((bm) => filterTags.some((s) => bm.tags.includes(s)))
	);

	async function loadBookmarks() {
		loading = true;
		try {
			const res = await fetch('/api/bookmarks');
			if (res.ok) allBookmarks = await res.json();
		} finally {
			loading = false;
		}
	}

	function toggleFilter(slug: string) {
		if (filterTags.includes(slug)) {
			filterTags = filterTags.filter((s) => s !== slug);
		} else {
			filterTags = [...filterTags, slug];
		}
	}

	async function handleAdd() {
		const url = addUrl.trim();
		if (!url) return;
		try { new URL(url); } catch {
			addError = 'Please enter a valid URL (include https://)';
			return;
		}
		addError = null;
		addLoading = true;
		try {
			// Fetch link preview
			let title = new URL(url).hostname.replace(/^www\./, '');
			let description: string | null = null;
			let favicon: string | null = null;

			try {
				const previewRes = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
				if (previewRes.ok) {
					const preview = await previewRes.json();
					if (preview.title) title = preview.title;
					if (preview.description) description = preview.description;
					if (preview.favicon) favicon = preview.favicon;
				}
			} catch { /* preview is optional */ }

			const res = await fetch('/api/bookmarks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url, title, description, favicon })
			});
			if (res.ok) {
				const created: BookmarkData = await res.json();
				allBookmarks = [created, ...allBookmarks];
				addUrl = '';
			} else {
				addError = 'Failed to save bookmark';
			}
		} finally {
			addLoading = false;
		}
	}

	function handleDelete(id: number) {
		allBookmarks = allBookmarks.filter((b) => b.id !== id);
	}

	function handleUpdate(updated: BookmarkData) {
		allBookmarks = allBookmarks.map((b) => (b.id === updated.id ? updated : b));
	}

	onMount(loadBookmarks);
</script>

<div class="bookmark-view">
	<div class="add-bar">
		<input
			type="url"
			class="url-input"
			bind:value={addUrl}
			placeholder="Paste a URL to bookmark…"
			onkeydown={(e) => e.key === 'Enter' && handleAdd()}
			disabled={addLoading}
		/>
		<button class="save-btn" onclick={handleAdd} disabled={addLoading || !addUrl.trim()}>
			{addLoading ? '…' : 'Save'}
		</button>
	</div>
	{#if addError}
		<p class="add-error">{addError}</p>
	{/if}

	{#if tags.length > 0}
		<div class="filter-strip" role="toolbar" aria-label="Filter by tag">
			<button
				class="filter-btn"
				class:active={filterTags.length === 0}
				onclick={() => (filterTags = [])}
			>All</button>
			{#each tags as tag}
				<button
					class="filter-btn"
					class:active={filterTags.includes(tag.slug)}
					style="--c: {tag.color}"
					onclick={() => toggleFilter(tag.slug)}
				>{tag.label}</button>
			{/each}
		</div>
	{/if}

	<div class="list-wrap">
		{#if loading}
			<div class="empty">Loading…</div>
		{:else if filteredBookmarks.length === 0}
			<div class="empty">
				{filterTags.length > 0 ? 'No bookmarks match this filter.' : 'No bookmarks yet. Paste a URL above.'}
			</div>
		{:else}
			<div class="bookmark-list">
				{#each filteredBookmarks as bm (bm.id)}
					<BookmarkItem
						bookmark={bm}
						{tags}
						ondelete={handleDelete}
						onupdate={handleUpdate}
						{oncreatetag}
					/>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.bookmark-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding: 20px 24px 0;
		max-width: 860px;
		width: 100%;
		margin: 0 auto;
		box-sizing: border-box;
	}

	.add-bar {
		display: flex;
		gap: 10px;
		align-items: center;
		margin-bottom: 4px;
	}

	.url-input {
		flex: 1;
		background: var(--card);
		border: 1px solid var(--border-mid);
		border-radius: 7px;
		color: var(--text);
		font-size: 14px;
		padding: 9px 14px;
		outline: none;
		transition: border-color 0.15s;
	}
	.url-input::placeholder { color: var(--text-3); }
	.url-input:focus { border-color: var(--accent); }
	.url-input:disabled { opacity: 0.6; }

	.save-btn {
		background: var(--accent);
		border: none;
		color: #fff;
		border-radius: 7px;
		padding: 9px 22px;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.3px;
		min-width: 70px;
		transition: background 0.15s;
	}
	.save-btn:hover:not(:disabled) { background: var(--accent-hi); }
	.save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.add-error {
		font-size: 12px;
		color: var(--danger);
		margin: 4px 0 0;
	}

	.filter-strip {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		padding: 14px 0 10px;
	}

	.filter-btn {
		background: none;
		border: 1px solid var(--border-hi);
		color: var(--text-2);
		border-radius: 5px;
		padding: 4px 12px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.3px;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
		min-height: 30px;
	}
	.filter-btn:hover { border-color: var(--text-2); color: var(--text); }
	.filter-btn.active {
		border-color: var(--c, var(--accent));
		color: var(--c, var(--accent));
		background: color-mix(in srgb, var(--c, var(--accent)) 12%, transparent);
	}

	.list-wrap {
		flex: 1;
		overflow-y: auto;
		padding-bottom: 20px;
	}

	.bookmark-list {
		display: flex;
		flex-direction: column;
	}

	.empty {
		padding: 48px 0;
		text-align: center;
		color: var(--text-3);
		font-size: 14px;
	}

	@media (max-width: 768px) {
		.bookmark-view { padding: 14px 14px 0; }
		.add-bar { flex-wrap: wrap; }
		.url-input { min-width: 0; }
		.save-btn { flex: 1; }
	}
</style>
