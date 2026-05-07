<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import Image from '@tiptap/extension-image';
	import BubbleMenu from '@tiptap/extension-bubble-menu';
	import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
	import { createSlashExtension } from './slash-commands';
	import Placeholder from '@tiptap/extension-placeholder';
	import { common, createLowlight } from 'lowlight';

	const lowlight = createLowlight(common);

	interface Props {
		content: string;
		cardId: number | null;
		onchange: (json: string) => void;
	}

	let { content, cardId, onchange }: Props = $props();

	let editorEl: HTMLDivElement;
	let bubbleMenuEl: HTMLDivElement;
	let editor: Editor | undefined;

	function focusOnMount(node: HTMLElement) { node.focus(); }

	let active = $state({
		bold: false, italic: false, strike: false, code: false,
		link: false, h1: false, h2: false, h3: false,
		bullet: false, ordered: false, blockquote: false, codeBlock: false
	});

	let linkPopover = $state<{ open: boolean; value: string }>({ open: false, value: '' });

	function refreshActive() {
		if (!editor) return;
		active = {
			bold:      editor.isActive('bold'),
			italic:    editor.isActive('italic'),
			strike:    editor.isActive('strike'),
			code:      editor.isActive('code'),
			link:      editor.isActive('link'),
			h1:        editor.isActive('heading', { level: 1 }),
			h2:        editor.isActive('heading', { level: 2 }),
			h3:        editor.isActive('heading', { level: 3 }),
			bullet:    editor.isActive('bulletList'),
			ordered:   editor.isActive('orderedList'),
			blockquote:editor.isActive('blockquote'),
			codeBlock: editor.isActive('codeBlock')
		};
	}

	async function uploadAndInsert(file: File) {
		if (cardId === null || !editor) return;
		const fd = new FormData();
		fd.append('file', file);
		fd.append('cardId', String(cardId));
		const res = await fetch('/api/images', { method: 'POST', body: fd });
		if (res.ok) {
			const { url } = await res.json();
			editor.chain().focus().setImage({ src: url }).run();
		}
	}

	function handleImageFiles(files: FileList | null | undefined): boolean {
		const images = [...(files ?? [])].filter(f => f.type.startsWith('image/'));
		if (images.length && cardId !== null) {
			images.forEach(uploadAndInsert);
			return true;
		}
		return false;
	}

	onMount(() => {
		editor = new Editor({
			element: editorEl,
			extensions: [
				StarterKit.configure({ codeBlock: false }),
				Link.configure({ openOnClick: false, autolink: true }),
				Image.configure({ inline: false }),
				CodeBlockLowlight.configure({ lowlight, exitOnArrowDown: true }),
				Placeholder.configure({ placeholder: 'Write something, paste a screenshot, or drag an image in…' }),
				BubbleMenu.configure({ element: bubbleMenuEl }),
				createSlashExtension(openImagePicker)
			],
			content: content ? JSON.parse(content) : '',
			editorProps: {
				attributes: { class: 'tiptap' },
				handleDrop(view, event) {
					if (handleImageFiles(event.dataTransfer?.files)) {
						event.preventDefault();
						return true;
					}
					return false;
				},
				handlePaste(view, event) {
					if (handleImageFiles(event.clipboardData?.files)) {
						event.preventDefault();
						return true;
					}
					return false;
				}
			},
			onUpdate({ editor }) {
				onchange(JSON.stringify(editor.getJSON()));
				refreshActive();
			},
			onSelectionUpdate() { refreshActive(); }
		});
	});

	onDestroy(() => editor?.destroy());

	function toggleLink() {
		if (editor?.isActive('link')) {
			editor.chain().focus().unsetLink().run();
			linkPopover = { open: false, value: '' };
		} else {
			linkPopover = { open: true, value: '' };
		}
	}

	function confirmLink() {
		const href = linkPopover.value.trim();
		if (href) {
			const url = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')
				? href
				: `https://${href}`;
			editor?.chain().focus().setLink({ href: url }).run();
		}
		linkPopover = { open: false, value: '' };
	}

	function cancelLink() {
		linkPopover = { open: false, value: '' };
	}

	function openImagePicker() {
		if (cardId === null) { alert('Save the card first to enable image upload.'); return; }
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.multiple = true;
		input.onchange = () => [...(input.files ?? [])].forEach(uploadAndInsert);
		input.click();
	}

</script>

<!-- Bubble menu: rendered off-screen until TipTap positions and shows it -->
<div bind:this={bubbleMenuEl} class="bubble-menu">
	<button class:active={active.bold}   onclick={() => editor?.chain().focus().toggleBold().run()}   title="Bold"><strong>B</strong></button>
	<button class:active={active.italic} onclick={() => editor?.chain().focus().toggleItalic().run()} title="Italic"><em>I</em></button>
	<button class:active={active.strike} onclick={() => editor?.chain().focus().toggleStrike().run()} title="Strikethrough"><s>S</s></button>
	<button class:active={active.code}   onclick={() => editor?.chain().focus().toggleCode().run()}   title="Inline code"><code>`</code></button>
	<div class="bmenu-sep"></div>
	<button class:active={active.h2} onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">H2</button>
	<button class:active={active.h3} onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">H3</button>
	<div class="bmenu-sep"></div>
	<button class:active={active.link} onclick={toggleLink} title="Link">↗</button>
</div>


{#if linkPopover.open}
<div class="link-popover" role="dialog" aria-label="Enter link URL">
	<input
		type="url"
		class="link-input"
		placeholder="https://example.com"
		bind:value={linkPopover.value}
		onkeydown={(e) => {
			if (e.key === 'Enter') { e.preventDefault(); confirmLink(); }
			if (e.key === 'Escape') cancelLink();
		}}
		use:focusOnMount
	/>
	<button class="link-confirm" onclick={confirmLink} title="Apply link">↵</button>
	<button class="link-cancel" onclick={cancelLink} title="Cancel">✕</button>
</div>
{/if}

<!-- Editor -->
<div class="editor-wrap">
	<div class="editor-body">
		<div bind:this={editorEl}></div>
		{#if cardId !== null}
			<p class="drop-hint">Drop or paste images directly into the editor</p>
		{:else}
			<p class="drop-hint dim">Save the card to enable image upload</p>
		{/if}
	</div>
</div>

<style>
	/* ── Bubble menu ─────────────────────────────────────────────────── */
	:global(.bubble-menu) {
		position: fixed;
		top: -9999px;
		left: -9999px;
		display: flex;
		align-items: center;
		gap: 1px;
		background: var(--surface);
		border: 1px solid var(--border-mid);
		border-radius: 7px;
		padding: 4px 6px;
		box-shadow: 0 8px 28px rgba(0,0,0,0.25);
		z-index: 9999;
		font-family: var(--font);
	}

	:global(.bubble-menu button) {
		background: none;
		border: none;
		color: var(--text-2);
		font-size: 12px;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 4px;
		cursor: pointer;
		min-height: 32px;
		font-family: inherit;
		transition: background 0.1s, color 0.1s;
	}

	:global(.bubble-menu button:hover)  { background: var(--card); color: var(--text); }
	:global(.bubble-menu button.active) { background: var(--accent); color: #fff; }

	:global(.bubble-menu .bmenu-sep) {
		width: 1px;
		height: 18px;
		background: var(--border-mid);
		margin: 0 2px;
		flex-shrink: 0;
	}

	/* ── Editor wrapper ──────────────────────────────────────────────── */
	.editor-wrap {
		background: var(--card);
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid var(--border-mid);
		transition: border-color 0.15s;
	}

	.editor-wrap:focus-within { border-color: var(--accent); }

	/* ── Editor body ─────────────────────────────────────────────────── */
	.editor-body {
		padding: 14px 16px 8px;
		min-height: 195px;
	}

	.drop-hint {
		font-size: 11px;
		color: var(--text-3);
		text-align: center;
		padding: 6px 0 2px;
		letter-spacing: 0.3px;
	}

	.drop-hint.dim { opacity: 0.5; }

	/* ── TipTap content ──────────────────────────────────────────────── */
	:global(.tiptap) {
		outline: none;
		min-height: 145px;
		font-size: 14px;
		line-height: 1.7;
		color: var(--text);
	}

	:global(.tiptap h1) { font-size: 22px; font-weight: 800; margin: 0.7em 0 0.35em; color: var(--text); }
	:global(.tiptap h2) { font-size: 17px; font-weight: 700; margin: 0.65em 0 0.3em;  color: var(--text); }
	:global(.tiptap h3) { font-size: 15px; font-weight: 700; margin: 0.5em 0 0.25em;  color: var(--text-2); }

	:global(.tiptap p)  { margin-bottom: 0.55em; }
	:global(.tiptap p:last-child) { margin-bottom: 0; }

	:global(.tiptap strong) { font-weight: 800; color: var(--text); }
	:global(.tiptap em)     { font-style: italic; color: var(--text-2); }
	:global(.tiptap s)      { text-decoration: line-through; color: var(--text-3); }

	:global(.tiptap a)       { color: var(--accent); text-decoration: underline; }
	:global(.tiptap a:hover) { color: var(--accent-hi); }

	:global(.tiptap code) {
		background: var(--accent-faint);
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 2px 6px;
		font-size: 13px;
		font-family: inherit;
		color: var(--accent);
	}

	/* Code blocks use --surface-code so each theme controls the background */
	:global(.tiptap pre) {
		background: var(--surface-code);
		border: 1px solid var(--surface-code-border);
		border-radius: 7px;
		padding: 14px 16px;
		margin: 0.8em 0;
		overflow-x: auto;
	}

	:global(.tiptap pre code) {
		background: none;
		border: none;
		padding: 0;
		font-size: 13px;
		color: #bdb5a8;
		font-family: inherit;
	}

	:global(.tiptap .hljs-keyword)  { color: #d4924e; font-weight: 700; }
	:global(.tiptap .hljs-string)   { color: #7db87d; }
	:global(.tiptap .hljs-number)   { color: #7aaed4; }
	:global(.tiptap .hljs-comment)  { color: #666; font-style: italic; }
	:global(.tiptap .hljs-function) { color: #c8a87a; }
	:global(.tiptap .hljs-built_in) { color: #b07fc8; }

	:global(.tiptap ul)  { padding-left: 1.5em; margin-bottom: 0.6em; }
	:global(.tiptap ol)  { padding-left: 1.5em; margin-bottom: 0.6em; }
	:global(.tiptap li)  { margin-bottom: 0.25em; }
	:global(.tiptap li > p) { margin-bottom: 0; }

	:global(.tiptap blockquote) {
		border-left: 4px solid var(--accent);
		padding-left: 14px;
		margin: 0.8em 0;
		color: var(--text-2);
		font-style: italic;
	}

	:global(.tiptap hr) {
		border: none;
		border-top: 1px solid var(--border);
		margin: 1.2em 0;
	}

	:global(.tiptap img) {
		max-width: 100%;
		border-radius: 6px;
		margin: 0.8em 0;
		display: block;
		border: 1px solid var(--border);
	}

	:global(.tiptap img.ProseMirror-selectednode) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	:global(.tiptap p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		color: var(--text-3);
		pointer-events: none;
		float: left;
		height: 0;
	}

	@media (max-width: 768px) {
		.editor-body { min-height: 80px; }
		/* 16px prevents iOS Safari auto-zoom on focus */
		:global(.tiptap) { min-height: 60px; font-size: 16px; }
	}

	/* ── Link popover ────────────────────────────────────────────────── */
	.link-popover {
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--surface);
		border: 1px solid var(--border-mid);
		border-radius: 7px;
		padding: 6px 8px;
		margin-top: 6px;
		box-shadow: 0 4px 16px rgba(0,0,0,0.3);
	}

	.link-input {
		flex: 1;
		background: var(--card);
		border: 1px solid var(--border-mid);
		border-radius: 4px;
		color: var(--text);
		padding: 4px 8px;
		font-size: 12px;
		min-width: 200px;
	}

	.link-input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.link-confirm,
	.link-cancel {
		background: none;
		border: none;
		color: var(--text-2);
		font-size: 14px;
		padding: 4px 8px;
		border-radius: 4px;
		min-height: 28px;
		transition: color 0.1s, background 0.1s;
	}

	.link-confirm:hover { color: var(--accent); background: var(--accent-faint); }
	.link-cancel:hover  { color: var(--danger); background: var(--danger-faint); }
</style>
