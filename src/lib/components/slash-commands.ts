import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type { Editor, Range } from '@tiptap/core';

interface CommandItem {
	title: string;
	aliases: string[];
	icon: string;
	description: string;
	command: (args: { editor: Editor; range: Range }) => void;
}

export function getCommands(uploadImageFn: () => void): CommandItem[] {
	return [
		{
			title: 'Heading 1',
			aliases: ['h1', 'heading1', 'title'],
			icon: 'H1',
			description: 'Large section heading',
			command: ({ editor, range }) =>
				editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run()
		},
		{
			title: 'Heading 2',
			aliases: ['h2', 'heading2', 'subtitle'],
			icon: 'H2',
			description: 'Medium section heading',
			command: ({ editor, range }) =>
				editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run()
		},
		{
			title: 'Heading 3',
			aliases: ['h3', 'heading3'],
			icon: 'H3',
			description: 'Small section heading',
			command: ({ editor, range }) =>
				editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run()
		},
		{
			title: 'Bullet List',
			aliases: ['ul', 'bullet', 'list', 'unordered'],
			icon: '•',
			description: 'Unordered list',
			command: ({ editor, range }) =>
				editor.chain().focus().deleteRange(range).toggleBulletList().run()
		},
		{
			title: 'Numbered List',
			aliases: ['ol', 'numbered', 'ordered'],
			icon: '1.',
			description: 'Ordered list',
			command: ({ editor, range }) =>
				editor.chain().focus().deleteRange(range).toggleOrderedList().run()
		},
		{
			title: 'Code Block',
			aliases: ['code', 'codeblock', 'pre'],
			icon: '</>',
			description: 'Syntax-highlighted code',
			command: ({ editor, range }) =>
				editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
		},
		{
			title: 'Blockquote',
			aliases: ['quote', 'blockquote', 'bq'],
			icon: '"',
			description: 'Quote or callout',
			command: ({ editor, range }) =>
				editor.chain().focus().deleteRange(range).toggleBlockquote().run()
		},
		{
			title: 'Divider',
			aliases: ['hr', 'divider', 'rule', 'line'],
			icon: '—',
			description: 'Horizontal separator',
			command: ({ editor, range }) =>
				editor.chain().focus().deleteRange(range).setHorizontalRule().run()
		},
		{
			title: 'Image',
			aliases: ['img', 'image', 'photo', 'picture'],
			icon: '📷',
			description: 'Upload or embed an image',
			command: ({ editor, range }) => {
				editor.chain().focus().deleteRange(range).run();
				uploadImageFn();
			}
		}
	];
}

function filterCommands(commands: CommandItem[], query: string): CommandItem[] {
	if (!query) return commands;
	const q = query.toLowerCase();
	return commands.filter(
		(c) =>
			c.title.toLowerCase().includes(q) ||
			c.aliases.some((a) => a.toLowerCase().includes(q))
	);
}

// Builds the suggestion popup as a plain DOM element (framework-agnostic)
function buildPopup() {
	const el = document.createElement('div');
	el.className = 'slash-popup';
	el.setAttribute('role', 'listbox');
	document.body.appendChild(el);
	return el;
}

function positionPopup(el: HTMLElement, rect: DOMRect | null) {
	if (!rect) return;
	const padding = 6;
	el.style.left = `${rect.left + window.scrollX}px`;
	el.style.top = `${rect.bottom + window.scrollY + padding}px`;
}

export function createSlashExtension(uploadImageFn: () => void) {
	return Extension.create({
		name: 'slashCommands',

		addProseMirrorPlugins() {
			const commands = getCommands(uploadImageFn);
			let popup: HTMLElement | null = null;
			let selectedIndex = 0;
			let currentItems: CommandItem[] = [];
			let executeCommand: ((item: CommandItem) => void) | null = null;

			function buildItems() {
				if (!popup) return;
				popup.innerHTML = '';
				if (currentItems.length === 0) {
					const empty = document.createElement('div');
					empty.className = 'slash-empty';
					empty.textContent = 'No commands match';
					popup.appendChild(empty);
					return;
				}
				currentItems.forEach((item, i) => {
					const row = document.createElement('div');
					row.className = 'slash-item' + (i === selectedIndex ? ' slash-item--active' : '');
					row.setAttribute('role', 'option');
					row.setAttribute('aria-selected', String(i === selectedIndex));
					row.dataset.index = String(i);

					const icon = document.createElement('span');
					icon.className = 'slash-icon';
					icon.textContent = item.icon;

					const text = document.createElement('span');
					text.className = 'slash-text';
					const title = document.createElement('span');
					title.className = 'slash-title';
					title.textContent = item.title;
					const desc = document.createElement('span');
					desc.className = 'slash-desc';
					desc.textContent = item.description;

					text.appendChild(title);
					text.appendChild(desc);
					row.appendChild(icon);
					row.appendChild(text);

					row.addEventListener('mousedown', (e) => { e.preventDefault(); executeCommand?.(item); });
					row.addEventListener('mouseover', () => { selectedIndex = i; updateActive(); });

					popup!.appendChild(row);
				});
			}

			function updateActive() {
				if (!popup) return;
				popup.querySelectorAll('.slash-item').forEach((row, i) => {
					const active = i === selectedIndex;
					row.classList.toggle('slash-item--active', active);
					row.setAttribute('aria-selected', String(active));
				});
			}

			return [
				Suggestion({
					editor: this.editor,
					char: '/',
					allowSpaces: false,
					startOfLine: false,
					items: ({ query }) => {
						currentItems = filterCommands(commands, query);
						return currentItems;
					},
					command: ({ editor, range, props }: { editor: Editor; range: Range; props: CommandItem }) => {
						props.command({ editor, range });
					},
					render: () => ({
						onStart(props) {
							selectedIndex = 0;
							currentItems = props.items as CommandItem[];
							executeCommand = (item: CommandItem) => props.command(item);
							popup = buildPopup();
							positionPopup(popup, props.clientRect?.() ?? null);
							buildItems();
						},
						onUpdate(props) {
							currentItems = props.items as CommandItem[];
							executeCommand = (item: CommandItem) => props.command(item);
							if (selectedIndex >= currentItems.length) selectedIndex = 0;
							positionPopup(popup!, props.clientRect?.() ?? null);
							buildItems();
						},
						onKeyDown({ event }) {
							if (!popup) return false;
							if (event.key === 'ArrowUp') {
								selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
								updateActive();
								return true;
							}
							if (event.key === 'ArrowDown') {
								selectedIndex = (selectedIndex + 1) % currentItems.length;
								updateActive();
								return true;
							}
							if (event.key === 'Enter') {
								const item = currentItems[selectedIndex];
								if (item) executeCommand?.(item);
								return true;
							}
							if (event.key === 'Escape') {
								popup.remove();
								popup = null;
								return true;
							}
							return false;
						},
						onExit() {
							popup?.remove();
							popup = null;
						}
					})
				})
			];
		}
	});
}
