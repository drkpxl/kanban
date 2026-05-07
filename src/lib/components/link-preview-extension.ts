import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

interface LinkPreviewAttrs {
	url: string;
	title: string;
	description: string;
	image: string | null;
	favicon: string | null;
}

function isHttpUrl(text: string): boolean {
	try {
		const u = new URL(text);
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch {
		return false;
	}
}

async function fetchPreview(url: string): Promise<Partial<LinkPreviewAttrs>> {
	try {
		const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
		if (!res.ok) return {};
		return res.json();
	} catch {
		return {};
	}
}

function buildDom(attrs: LinkPreviewAttrs, editable: boolean): HTMLDivElement {
	const dom = document.createElement('div');
	dom.className = 'lp-card';
	dom.setAttribute('data-link-preview', '');
	dom.setAttribute('contenteditable', 'false');

	const body = document.createElement('div');
	body.className = 'lp-body';

	const header = document.createElement('div');
	header.className = 'lp-header';

	if (attrs.favicon) {
		const fav = document.createElement('img');
		fav.className = 'lp-favicon';
		fav.src = attrs.favicon;
		fav.alt = '';
		fav.onerror = () => (fav.style.display = 'none');
		header.appendChild(fav);
	}

	const titleEl = document.createElement('span');
	titleEl.className = 'lp-title';
	titleEl.textContent = attrs.title || attrs.url;
	header.appendChild(titleEl);
	body.appendChild(header);

	if (attrs.description) {
		const desc = document.createElement('p');
		desc.className = 'lp-desc';
		desc.textContent = attrs.description;
		body.appendChild(desc);
	}

	const urlEl = document.createElement('span');
	urlEl.className = 'lp-url';
	urlEl.textContent = attrs.url;
	body.appendChild(urlEl);
	dom.appendChild(body);

	if (attrs.image) {
		const thumb = document.createElement('img');
		thumb.className = 'lp-thumb';
		thumb.src = attrs.image;
		thumb.alt = '';
		thumb.onerror = () => (thumb.style.display = 'none');
		dom.appendChild(thumb);
	}

	if (editable) {
		const btn = document.createElement('button');
		btn.className = 'lp-remove';
		btn.type = 'button';
		btn.textContent = '×';
		btn.title = 'Convert to plain link';
		dom.appendChild(btn);
	}

	return dom;
}

export const LinkPreviewExtension = Node.create({
	name: 'linkPreview',
	group: 'block',
	atom: true,

	addAttributes() {
		return {
			url: { default: '' },
			title: { default: '' },
			description: { default: '' },
			image: { default: null },
			favicon: { default: null },
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-link-preview]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes(HTMLAttributes, { 'data-link-preview': '' })];
	},

	addNodeView() {
		return ({ node, editor, getPos }) => {
			let attrs = { ...node.attrs } as LinkPreviewAttrs;
			const dom = buildDom(attrs, editor.isEditable);

			dom.addEventListener('click', (e) => {
				if ((e.target as HTMLElement).closest('.lp-remove')) return;
				window.open(attrs.url, '_blank', 'noopener,noreferrer');
			});

			const removeBtn = dom.querySelector('.lp-remove');
			if (removeBtn) {
				removeBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					const pos = typeof getPos === 'function' ? getPos() : undefined;
					if (pos === undefined) return;
					editor
						.chain()
						.deleteRange({ from: pos, to: pos + node.nodeSize })
						.insertContent({
							type: 'paragraph',
							content: [
								{
									type: 'text',
									text: attrs.title || attrs.url,
									marks: [{ type: 'link', attrs: { href: attrs.url } }],
								},
							],
						})
						.run();
				});
			}

			return {
				dom,
				update(updatedNode) {
					if (updatedNode.type.name !== 'linkPreview') return false;
					const newAttrs = updatedNode.attrs as LinkPreviewAttrs;

					const titleEl = dom.querySelector('.lp-title');
					if (titleEl) titleEl.textContent = newAttrs.title || newAttrs.url;

					const urlEl = dom.querySelector('.lp-url');
					if (urlEl) urlEl.textContent = newAttrs.url;

					const descEl = dom.querySelector('.lp-desc');
					if (newAttrs.description && descEl) {
						descEl.textContent = newAttrs.description;
					} else if (newAttrs.description && !descEl) {
						const p = document.createElement('p');
						p.className = 'lp-desc';
						p.textContent = newAttrs.description;
						dom.querySelector('.lp-body')?.insertBefore(p, urlEl ?? null);
					}

					const favEl = dom.querySelector('.lp-favicon') as HTMLImageElement | null;
					if (newAttrs.favicon && !favEl) {
						const fav = document.createElement('img');
						fav.className = 'lp-favicon';
						fav.src = newAttrs.favicon;
						fav.alt = '';
						fav.onerror = () => (fav.style.display = 'none');
						const header = dom.querySelector('.lp-header');
						const titleSpan = dom.querySelector('.lp-title');
						header?.insertBefore(fav, titleSpan ?? null);
					} else if (newAttrs.favicon && favEl) {
						favEl.src = newAttrs.favicon;
					}

					const thumbEl = dom.querySelector('.lp-thumb') as HTMLImageElement | null;
					if (newAttrs.image && !thumbEl) {
						const thumb = document.createElement('img');
						thumb.className = 'lp-thumb';
						thumb.src = newAttrs.image;
						thumb.alt = '';
						thumb.onerror = () => (thumb.style.display = 'none');
						const removeBtn = dom.querySelector('.lp-remove');
						dom.insertBefore(thumb, removeBtn ?? null);
					} else if (newAttrs.image && thumbEl) {
						thumbEl.src = newAttrs.image;
					}

					attrs = { ...newAttrs };
					return true;
				},
				destroy() {},
			};
		};
	},

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey('linkPreviewPaste'),
				props: {
					handlePaste(view, event) {
						const text = event.clipboardData?.getData('text/plain')?.trim() ?? '';
						if (!isHttpUrl(text)) return false;

						const { state } = view;
						const { $from } = state.selection;

						const isEmptyPara =
							$from.parent.type.name === 'paragraph' && $from.parent.nodeSize === 2;
						if (!isEmptyPara) return false;

						const previewNode = state.schema.nodes.linkPreview.create({
							url: text,
							title: text,
							description: '',
							image: null,
							favicon: null,
						});

						view.dispatch(
							state.tr.replaceWith($from.before(), $from.after(), previewNode)
						);

						fetchPreview(text).then((data) => {
							if (view.isDestroyed) return;
							const currentState = view.state;
							let dispatched = false;
							// Scans for the first matching node; if the same URL is pasted twice
							// before either fetch resolves, only the first node gets updated.
							currentState.doc.descendants((n, pos) => {
								if (dispatched) return false;
								if (n.type.name === 'linkPreview' && n.attrs.url === text) {
									view.dispatch(
										currentState.tr.setNodeMarkup(pos, undefined, { ...n.attrs, ...data })
									);
									dispatched = true;
									return false;
								}
							});
						});

						event.preventDefault();
						return true;
					},
				},
			}),
		];
	},
});
