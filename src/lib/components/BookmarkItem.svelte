<script lang="ts">
	import type { BookmarkData } from '$lib/types';
	import type { Tag } from '$lib/server/tags';

	const TAG_COLORS = [
		'#c17f3f', '#4a7c59', '#6b5a8f', '#3f7fc1', '#c13f3f',
		'#c1a03f', '#3f9fc1', '#8f6b5a'
	];

	interface Props {
		bookmark: BookmarkData;
		tags: Tag[];
		ondelete: (id: number) => void;
		onupdate: (bookmark: BookmarkData) => void;
		oncreatetag: (tag: Tag) => void;
	}

	let { bookmark, tags, ondelete, onupdate, oncreatetag }: Props = $props();

	let editing = $state(false);
	let editTitle = $state('');
	let editTags = $state<string[]>([]);
	let showTagPicker = $state(false);
	let showNewTagForm = $state(false);
	let newTagLabel = $state('');
	let newTagColor = $state('#6b5a8f');
	let newTagError = $state<string | null>(null);
	let newTagSaving = $state(false);
	let saving = $state(false);

	function hostname(url: string) {
		try { return new URL(url).hostname.replace(/^www\./, ''); }
		catch { return url; }
	}

	function getTag(slug: string) {
		return tags.find((t) => t.slug === slug);
	}

	function toggleTag(slug: string) {
		if (editTags.includes(slug)) {
			editTags = editTags.filter((s) => s !== slug);
		} else {
			editTags = [...editTags, slug];
		}
	}

	function startEdit() {
		editTitle = bookmark.title;
		editTags = [...bookmark.tags];
		showTagPicker = false;
		showNewTagForm = false;
		newTagLabel = '';
		newTagError = null;
		editing = true;
	}

	function cancelEdit() {
		editing = false;
		showTagPicker = false;
		showNewTagForm = false;
	}

	async function saveEdit() {
		saving = true;
		try {
			const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: editTitle.trim() || bookmark.title, tags: editTags })
			});
			if (res.ok) {
				onupdate(await res.json());
				editing = false;
				showTagPicker = false;
			}
		} finally {
			saving = false;
		}
	}

	function deriveSlug(label: string) {
		return label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50);
	}

	async function createTag() {
		const slug = deriveSlug(newTagLabel);
		if (!slug || !newTagLabel.trim()) return;
		newTagSaving = true;
		newTagError = null;
		try {
			const res = await fetch('/api/tags', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug, label: newTagLabel.trim(), color: newTagColor })
			});
			if (res.status === 409) { newTagError = 'Tag already exists'; return; }
			if (!res.ok) { newTagError = 'Failed to create tag'; return; }
			const newTag: Tag = await res.json();
			oncreatetag(newTag);
			toggleTag(slug);
			newTagLabel = '';
			newTagError = null;
			showNewTagForm = false;
		} finally {
			newTagSaving = false;
		}
	}

	async function handleDelete() {
		if (!confirm('Delete this bookmark?')) return;
		await fetch(`/api/bookmarks/${bookmark.id}`, { method: 'DELETE' });
		ondelete(bookmark.id);
	}
</script>

<div class="bookmark-item" class:editing>
	{#if editing}
		<div class="edit-panel">
			<input class="edit-title" bind:value={editTitle} placeholder="Title" />

			<div class="tags-row">
				{#each editTags as slug}
					{@const tag = getTag(slug)}
					<span class="tag-pill" style="--c: {tag?.color ?? '#555'}">
						{tag?.label ?? slug}
						<button onclick={() => toggleTag(slug)} aria-label="Remove tag">×</button>
					</span>
				{/each}
				<button class="add-tag-btn" onclick={() => { showTagPicker = !showTagPicker; showNewTagForm = false; }}>+ tag</button>
			</div>

			{#if showTagPicker}
				<div class="tag-picker">
					{#each tags as tag}
						<button
							class="tag-option"
							class:selected={editTags.includes(tag.slug)}
							onclick={() => toggleTag(tag.slug)}
							style="--tag-color: {tag.color}"
						>
							<span class="tag-dot" style="background: {tag.color}"></span>
							{tag.label}
						</button>
					{/each}
					<button class="new-tag-btn" onclick={() => { showNewTagForm = !showNewTagForm; newTagError = null; }}>
						+ New tag
					</button>
					{#if showNewTagForm}
						<div class="new-tag-form">
							<input
								class="new-tag-input"
								bind:value={newTagLabel}
								placeholder="Tag name"
								onkeydown={(e) => e.key === 'Enter' && createTag()}
							/>
							<div class="color-swatches">
								{#each TAG_COLORS as c}
									<button
										class="swatch"
										class:selected={newTagColor === c}
										style="background: {c}"
										onclick={() => (newTagColor = c)}
										aria-label={c}
									></button>
								{/each}
							</div>
							{#if newTagError}<p class="tag-error">{newTagError}</p>{/if}
							<button class="new-tag-save" onclick={createTag} disabled={newTagSaving || !newTagLabel.trim()}>
								{newTagSaving ? '…' : 'Add'}
							</button>
						</div>
					{/if}
				</div>
			{/if}

			<div class="edit-actions">
				<button class="cancel-btn" onclick={cancelEdit}>Cancel</button>
				<button class="save-btn" onclick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
			</div>
		</div>
	{:else}
		<div class="row">
			<div class="favicon-wrap">
				{#if bookmark.favicon}
					<img
						src={bookmark.favicon}
						alt=""
						width="16"
						height="16"
						onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
					/>
				{:else}
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						<circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
						<path d="M1 8h14M8 1c-2 2-3 4-3 7s1 5 3 7M8 1c2 2 3 4 3 7s-1 5-3 7" stroke="currentColor" stroke-width="1.2" opacity="0.4"/>
					</svg>
				{/if}
			</div>

			<div class="info">
				<a href={bookmark.url} target="_blank" rel="noopener noreferrer" class="title">{bookmark.title}</a>
				<span class="host">{hostname(bookmark.url)}</span>
			</div>

			<div class="tag-pills">
				{#each bookmark.tags.slice(0, 2) as slug}
					{@const tag = getTag(slug)}
					<span class="tag-pill" style="--c: {tag?.color ?? '#555'}">{tag?.label ?? slug}</span>
				{/each}
				{#if bookmark.tags.length > 2}
					<span class="tag-overflow">+{bookmark.tags.length - 2}</span>
				{/if}
			</div>

			<div class="actions">
				<button class="action-btn" onclick={startEdit} aria-label="Edit bookmark">
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
					</svg>
				</button>
				<button class="action-btn delete-btn" onclick={handleDelete} aria-label="Delete bookmark">×</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.bookmark-item {
		border-bottom: 1px solid var(--border);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		min-height: 48px;
	}

	.favicon-wrap {
		width: 16px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		color: var(--text-3);
	}

	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}
	.title:hover { color: var(--accent); }

	.host {
		font-size: 11px;
		color: var(--text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tag-pills {
		display: flex;
		gap: 5px;
		align-items: center;
		flex-shrink: 0;
	}

	.tag-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		border-radius: 4px;
		padding: 3px 8px;
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
		min-width: 18px;
		min-height: 18px;
	}
	.tag-pill button:hover { opacity: 1; }

	.tag-overflow {
		font-size: 11px;
		color: var(--text-3);
		font-weight: 600;
		white-space: nowrap;
	}

	.actions {
		display: flex;
		gap: 4px;
		align-items: center;
		flex-shrink: 0;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.bookmark-item:hover .actions { opacity: 1; }

	.action-btn {
		background: none;
		border: none;
		color: var(--text-2);
		padding: 4px;
		border-radius: 4px;
		font-size: 16px;
		line-height: 1;
		min-width: 28px;
		min-height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.15s, background 0.15s;
	}
	.action-btn:hover { color: var(--text); background: rgba(255,255,255,0.07); }
	.action-btn.delete-btn:hover { color: var(--danger); }

	/* Edit panel */
	.edit-panel {
		padding: 12px 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.edit-title {
		background: transparent;
		border: 1px solid var(--border-mid);
		border-radius: 5px;
		color: var(--text);
		font-size: 14px;
		font-weight: 600;
		padding: 7px 10px;
		outline: none;
		transition: border-color 0.15s;
		width: 100%;
	}
	.edit-title:focus { border-color: var(--accent); }

	.tags-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}

	.add-tag-btn {
		background: none;
		border: 1px solid var(--border-hi);
		color: var(--text-2);
		border-radius: 4px;
		padding: 3px 10px;
		font-size: 11px;
		font-weight: 600;
		min-height: 26px;
		transition: border-color 0.15s, color 0.15s;
	}
	.add-tag-btn:hover { border-color: var(--text-2); color: var(--text); }

	.tag-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		background: var(--card);
		border-radius: 7px;
		padding: 10px;
		border: 1px solid var(--border);
	}

	.tag-option {
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--surface);
		border: 1px solid var(--border-hi);
		color: var(--text);
		border-radius: 5px;
		padding: 4px 10px;
		font-size: 12px;
		font-weight: 600;
		transition: border-color 0.15s, background 0.15s;
		min-height: 30px;
	}
	.tag-option:hover { border-color: var(--text-2); background: rgba(255,255,255,0.05); }
	.tag-option.selected { border-color: var(--tag-color); background: color-mix(in srgb, var(--tag-color) 14%, transparent); }

	.tag-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.new-tag-btn {
		background: none;
		border: 1px dashed var(--border-hi);
		color: var(--text-3);
		border-radius: 5px;
		padding: 4px 10px;
		font-size: 12px;
		font-weight: 600;
		min-height: 30px;
		transition: border-color 0.15s, color 0.15s;
	}
	.new-tag-btn:hover { border-color: var(--text-2); color: var(--text-2); }

	.new-tag-form {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 7px;
		padding-top: 6px;
		border-top: 1px solid var(--border);
	}

	.new-tag-input {
		background: var(--surface);
		border: 1px solid var(--border-mid);
		border-radius: 5px;
		color: var(--text);
		font-size: 13px;
		padding: 6px 10px;
		outline: none;
		transition: border-color 0.15s;
	}
	.new-tag-input:focus { border-color: var(--accent); }

	.color-swatches {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.swatch {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2px solid transparent;
		padding: 0;
		transition: border-color 0.12s, transform 0.12s;
	}
	.swatch.selected { border-color: var(--text); transform: scale(1.2); }

	.tag-error {
		font-size: 12px;
		color: var(--danger);
		margin: 0;
	}

	.new-tag-save {
		align-self: flex-start;
		background: var(--accent);
		border: none;
		color: #fff;
		border-radius: 5px;
		padding: 5px 14px;
		font-size: 12px;
		font-weight: 700;
		min-height: 30px;
		transition: background 0.15s;
	}
	.new-tag-save:hover:not(:disabled) { background: var(--accent-hi); }
	.new-tag-save:disabled { opacity: 0.4; cursor: not-allowed; }

	.edit-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.cancel-btn {
		background: none;
		border: 1px solid var(--border-mid);
		color: var(--text-2);
		border-radius: 5px;
		padding: 6px 16px;
		font-size: 12px;
		font-weight: 500;
		min-height: 34px;
		transition: border-color 0.15s, color 0.15s;
	}
	.cancel-btn:hover { border-color: var(--border-hi); color: var(--text); }

	.save-btn {
		background: var(--accent);
		border: none;
		color: #fff;
		border-radius: 5px;
		padding: 6px 18px;
		font-size: 12px;
		font-weight: 700;
		min-height: 34px;
		transition: background 0.15s;
	}
	.save-btn:hover:not(:disabled) { background: var(--accent-hi); }
	.save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	@media (max-width: 768px) {
		.actions { opacity: 1; }
		.tag-pills { display: none; }
	}
</style>
