# Media Handling & Keyboard Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image lightbox, URL link-preview cards, and keyboard shortcuts (new/navigate/move cards) to the personal kanban board.

**Architecture:** Two independent tracks — Track A adds richer media rendering inside TipTap (custom lightbox overlay + a `LinkPreview` TipTap node backed by a server-side OG-fetch endpoint); Track B adds a `focusedCardId` Svelte state in the board page plus a document-level keydown listener that drives new-card, navigation, and move-card shortcuts.

**Tech Stack:** SvelteKit 5 (Svelte 5 runes), TipTap v3 (`@tiptap/core`), ProseMirror plugin API (`@tiptap/pm/state`), Playwright for tests.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/routes/api/link-preview/+server.ts` | Server-side OG fetch + in-memory cache |
| Create | `src/lib/components/link-preview-extension.ts` | TipTap `LinkPreview` node + paste plugin |
| Modify | `src/lib/components/TipTapEditor.svelte` | Lightbox state/overlay + register LinkPreview extension |
| Modify | `src/routes/+page.svelte` | `focusedCardId`, `flatCards`, `modalOpen`, keydown listener |
| Modify | `src/lib/components/Column.svelte` | Accept + thread `focusedCardId` prop |
| Modify | `src/lib/components/CardItem.svelte` | Render focus ring when id matches |
| Modify | `tests/kanban.test.ts` | Keyboard shortcut integration tests |
| Modify | `tests/editor.test.ts` | Lightbox + link-preview tests |

---

## Task 1: Link Preview API Endpoint

**Files:**
- Create: `src/routes/api/link-preview/+server.ts`
- Modify: `tests/editor.test.ts`

- [ ] **Step 1: Write failing API tests**

Add to the bottom of `tests/editor.test.ts`:

```typescript
// ── Link preview endpoint ─────────────────────────────────────────────────────

test('link-preview returns JSON with title for a valid URL', async ({ request }) => {
  const res = await request.get('/api/link-preview?url=https://example.com');
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.url).toBe('https://example.com');
  expect(typeof data.title).toBe('string');
  expect(data.title.length).toBeGreaterThan(0);
});

test('link-preview returns 400 when url param is missing', async ({ request }) => {
  const res = await request.get('/api/link-preview');
  expect(res.status()).toBe(400);
});

test('link-preview returns 400 for a non-http URL', async ({ request }) => {
  const res = await request.get('/api/link-preview?url=javascript:alert(1)');
  expect(res.status()).toBe(400);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/gmk_user/kanban && npx playwright test tests/editor.test.ts --grep "link-preview"
```

Expected: 3 failures (route does not exist yet).

- [ ] **Step 3: Create the endpoint**

Create `src/routes/api/link-preview/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface PreviewResult {
  url: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
}

const cache = new Map<string, PreviewResult>();

function extractMeta(html: string, rawUrl: string): PreviewResult {
  const og = (prop: string) =>
    html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'))?.[1] ?? '';

  const title =
    og('title') ||
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ||
    new URL(rawUrl).hostname;

  const description =
    og('description') ||
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    '';

  const image = og('image') || null;

  const iconHref = html.match(
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i
  )?.[1];
  const base = new URL(rawUrl);
  const favicon = iconHref
    ? iconHref.startsWith('http')
      ? iconHref
      : `${base.origin}${iconHref.startsWith('/') ? '' : '/'}${iconHref}`
    : `${base.origin}/favicon.ico`;

  return {
    url: rawUrl,
    title: title.trim(),
    description: description.trim(),
    image,
    favicon,
  };
}

export const GET: RequestHandler = async ({ url }) => {
  const target = url.searchParams.get('url');
  if (!target) throw error(400, 'url parameter required');

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    throw error(400, 'Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw error(400, 'Only http/https URLs allowed');
  }

  if (cache.has(target)) return json(cache.get(target));

  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KanbanBot/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw error(502, 'Could not fetch URL');
    const html = await res.text();
    const result = extractMeta(html, target);
    cache.set(target, result);
    return json(result);
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e) throw e;
    throw error(502, 'Failed to fetch URL');
  }
};
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx playwright test tests/editor.test.ts --grep "link-preview"
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/link-preview/+server.ts tests/editor.test.ts
git commit -m "feat: add server-side link-preview endpoint with OG metadata parsing"
```

---

## Task 2: Image Lightbox

**Files:**
- Modify: `src/lib/components/TipTapEditor.svelte`
- Modify: `tests/editor.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/editor.test.ts` after the existing tests (before the link-preview tests):

```typescript
// ── Image lightbox ────────────────────────────────────────────────────────────

test('clicking an image in the editor opens a lightbox overlay', async ({ page }) => {
  await openEditorOnCard(page);

  // Inject a test image directly into the TipTap DOM
  await page.evaluate(() => {
    const tiptap = document.querySelector('.tiptap')!;
    const img = document.createElement('img');
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    img.alt = 'test';
    tiptap.appendChild(img);
  });

  await page.locator('.tiptap img').first().click();
  await expect(page.locator('.lightbox-overlay')).toBeVisible();
});

test('pressing Escape closes the lightbox without closing the card modal', async ({ page }) => {
  await openEditorOnCard(page);

  await page.evaluate(() => {
    const tiptap = document.querySelector('.tiptap')!;
    const img = document.createElement('img');
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    tiptap.appendChild(img);
  });

  await page.locator('.tiptap img').first().click();
  await expect(page.locator('.lightbox-overlay')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.lightbox-overlay')).not.toBeVisible();
  // Card modal must still be open
  await expect(page.getByRole('dialog')).toBeVisible();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx playwright test tests/editor.test.ts --grep "lightbox"
```

Expected: 2 failures (`.lightbox-overlay` does not exist yet).

- [ ] **Step 3: Add lightbox state and overlay to TipTapEditor.svelte**

In the `<script>` block, after the `linkPopover` state declaration (line 35), add:

```typescript
let lightboxSrc = $state<string | null>(null);
```

After the `onMount` block and before `onDestroy`, add a click handler that attaches to the editor element to intercept image clicks:

```typescript
// Attach after editor is created, inside onMount, after the editor = new Editor({...}) block:
editorEl.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'IMG' && !target.closest('[data-link-preview]')) {
    lightboxSrc = (target as HTMLImageElement).src;
  }
});
```

The full `onMount` becomes:

```typescript
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

  editorEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && !target.closest('[data-link-preview]')) {
      lightboxSrc = (target as HTMLImageElement).src;
    }
  });
});
```

Add the lightbox overlay to the template, just before the closing `</script>`-following markup — place it after the `{#if linkPopover.open}` block and before `<!-- Editor -->`:

```svelte
{#if lightboxSrc}
<div
  class="lightbox-overlay"
  role="dialog"
  aria-modal="true"
  aria-label="Image preview"
  tabindex="-1"
  onclick={() => (lightboxSrc = null)}
  onkeydown={(e) => {
    if (e.key === 'Escape') { e.stopPropagation(); lightboxSrc = null; }
  }}
  use:focusOnMount
>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
  <img src={lightboxSrc} alt="Full size preview" class="lightbox-img" onclick={(e) => e.stopPropagation()} />
</div>
{/if}
```

Add to the `<style>` block (at the end, before the closing `</style>`):

```css
/* ── Lightbox ────────────────────────────────────────────────────── */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 8px;
  cursor: default;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}
```

Also add `cursor: pointer` to the existing `:global(.tiptap img)` rule:

```css
:global(.tiptap img) {
  max-width: 100%;
  border-radius: 6px;
  margin: 0.8em 0;
  display: block;
  border: 1px solid var(--border);
  cursor: pointer;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx playwright test tests/editor.test.ts --grep "lightbox"
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/TipTapEditor.svelte tests/editor.test.ts
git commit -m "feat: add image lightbox overlay in TipTap editor"
```

---

## Task 3: LinkPreview TipTap Extension

**Files:**
- Create: `src/lib/components/link-preview-extension.ts`
- Modify: `src/lib/components/TipTapEditor.svelte`
- Modify: `tests/editor.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/editor.test.ts` (after the lightbox tests, before link-preview endpoint tests):

```typescript
// ── LinkPreview node ──────────────────────────────────────────────────────────

test('pasting a URL alone on an empty line renders a link-preview card', async ({ page }) => {
  const editor = await openEditorOnCard(page);
  await editor.click();

  // Simulate paste of a bare URL onto an empty paragraph
  await page.evaluate(async () => {
    const tiptap = document.querySelector('.tiptap')!;
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', 'https://example.com');
    tiptap.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  });

  // The node should appear (may need to wait for async fetch)
  await expect(page.locator('[data-link-preview]')).toBeVisible({ timeout: 15000 });
});

test('pasting a URL inline with text stays as a plain link', async ({ page }) => {
  const editor = await openEditorOnCard(page);
  await editor.click();
  await page.keyboard.type('Check this out: ');

  await page.evaluate(async () => {
    const tiptap = document.querySelector('.tiptap')!;
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', 'https://example.com');
    tiptap.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  });

  // Should NOT have rendered a preview card (it's inline)
  await expect(page.locator('[data-link-preview]')).not.toBeVisible();
  // Should have a plain link
  await expect(page.locator('.tiptap a')).toBeVisible();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx playwright test tests/editor.test.ts --grep "LinkPreview"
```

Expected: 2 failures.

- [ ] **Step 3: Create the LinkPreview extension**

Create `src/lib/components/link-preview-extension.ts`:

```typescript
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

      function wireRemove(currentDom: HTMLDivElement, currentAttrs: LinkPreviewAttrs) {
        const btn = currentDom.querySelector('.lp-remove');
        if (!btn) return;
        btn.addEventListener('click', (e) => {
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
                  text: currentAttrs.title || currentAttrs.url,
                  marks: [{ type: 'link', attrs: { href: currentAttrs.url } }],
                },
              ],
            })
            .run();
        });
      }

      // Open link on card click (not remove button)
      dom.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.lp-remove')) return;
        window.open(attrs.url, '_blank', 'noopener,noreferrer');
      });

      wireRemove(dom, attrs);

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'linkPreview') return false;
          const newAttrs = updatedNode.attrs as LinkPreviewAttrs;

          // Update DOM in place
          const titleEl = dom.querySelector('.lp-title');
          if (titleEl) titleEl.textContent = newAttrs.title || newAttrs.url;

          const descEl = dom.querySelector('.lp-desc');
          if (newAttrs.description && descEl) {
            descEl.textContent = newAttrs.description;
          } else if (newAttrs.description && !descEl) {
            const p = document.createElement('p');
            p.className = 'lp-desc';
            p.textContent = newAttrs.description;
            dom.querySelector('.lp-body')?.appendChild(p);
          }

          const urlEl = dom.querySelector('.lp-url');
          if (urlEl) urlEl.textContent = newAttrs.url;

          const favEl = dom.querySelector('.lp-favicon') as HTMLImageElement | null;
          if (favEl && newAttrs.favicon) favEl.src = newAttrs.favicon;

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

            // Only intercept when cursor is on a completely empty paragraph
            const isEmptyPara =
              $from.parent.type.name === 'paragraph' && $from.parent.nodeSize === 2;
            if (!isEmptyPara) return false;

            const previewNode = state.schema.nodes['linkPreview'].create({
              url: text,
              title: text,
              description: '',
              image: null,
              favicon: null,
            });

            view.dispatch(
              state.tr.replaceWith($from.before(), $from.after(), previewNode)
            );

            // Fetch real OG data and update node attrs
            fetchPreview(text).then((data) => {
              const currentState = view.state;
              currentState.doc.descendants((n, pos) => {
                if (n.type.name === 'linkPreview' && n.attrs.url === text) {
                  view.dispatch(
                    currentState.tr.setNodeMarkup(pos, undefined, { ...n.attrs, ...data })
                  );
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
```

- [ ] **Step 4: Register the extension and add CSS in TipTapEditor.svelte**

At the top of the `<script>` block, add the import after existing imports:

```typescript
import { LinkPreviewExtension } from './link-preview-extension';
```

In `onMount`, add `LinkPreviewExtension` to the extensions array (after `BubbleMenu.configure(...)`):

```typescript
extensions: [
  StarterKit.configure({ codeBlock: false }),
  Link.configure({ openOnClick: false, autolink: true }),
  Image.configure({ inline: false }),
  CodeBlockLowlight.configure({ lowlight, exitOnArrowDown: true }),
  Placeholder.configure({ placeholder: 'Write something, paste a screenshot, or drag an image in…' }),
  BubbleMenu.configure({ element: bubbleMenuEl }),
  createSlashExtension(openImagePicker),
  LinkPreviewExtension,
],
```

Add to the `<style>` block (before the closing `</style>`):

```css
/* ── Link preview card ───────────────────────────────────────────── */
:global(.lp-card) {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  border: 1px solid var(--border-mid);
  border-radius: 8px;
  padding: 12px 14px;
  margin: 0.8em 0;
  background: var(--surface);
  position: relative;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s;
}

:global(.lp-card:hover) { border-color: var(--accent); }

:global(.lp-body) {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

:global(.lp-header) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

:global(.lp-favicon) {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
}

:global(.lp-title) {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:global(.lp-desc) {
  font-size: 12px;
  color: var(--text-2);
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

:global(.lp-url) {
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:global(.lp-thumb) {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
  border: 1px solid var(--border);
}

:global(.lp-remove) {
  position: absolute;
  top: 6px;
  right: 6px;
  background: var(--surface);
  border: 1px solid var(--border-mid);
  color: var(--text-2);
  width: 22px;
  height: 22px;
  border-radius: 4px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.1s, border-color 0.1s, color 0.1s;
  cursor: pointer;
  padding: 0;
}

:global(.lp-card:hover .lp-remove) { opacity: 1; }
:global(.lp-remove:hover) { border-color: var(--danger); color: var(--danger); }
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx playwright test tests/editor.test.ts --grep "LinkPreview"
```

Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/link-preview-extension.ts src/lib/components/TipTapEditor.svelte tests/editor.test.ts
git commit -m "feat: add LinkPreview TipTap node with OG preview card on URL paste"
```

---

## Task 4: Keyboard Shortcut — New Card

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `tests/kanban.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the bottom of `tests/kanban.test.ts`:

```typescript
// ── Keyboard shortcuts ────────────────────────────────────────────────────────

test('pressing n opens the new-card modal for the Idea column', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('n');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('n key does nothing when a modal is already open', async ({ page }) => {
  await page.goto('/');
  // Open a modal the normal way
  await page.locator('.column').first().getByRole('button', { name: '+ Add card' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // Pressing n should not open a second dialog
  await page.keyboard.press('n');
  await expect(page.getByRole('dialog')).toHaveCount(1);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx playwright test tests/kanban.test.ts --grep "pressing n"
```

Expected: 2 failures.

- [ ] **Step 3: Add focusedCardId state, modalOpen derived, and keydown listener to +page.svelte**

In the `<script>` block, after the `hiddenCount` state declaration (line 19), add:

```typescript
let focusedCardId = $state<number | null>(null);

const modalOpen = $derived(editCard !== null || newCardColumn !== null);

const flatCards = $derived(
  COLUMNS.flatMap((col) =>
    allCards
      .filter((c) => c.column === col.id && c.hidden !== 1)
      .sort((a, b) => a.position - b.position)
  )
);
```

After the `onMount` block (after line 194), add the keyboard effect:

```typescript
$effect(() => {
  function onKeyDown(e: KeyboardEvent) {
    if (modalOpen) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

    if (e.key === 'n') {
      e.preventDefault();
      openNewCard('idea');
    }
  }

  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx playwright test tests/kanban.test.ts --grep "pressing n"
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte tests/kanban.test.ts
git commit -m "feat: add n keyboard shortcut to open new-card modal"
```

---

## Task 5: Card Focus Ring

**Files:**
- Modify: `src/lib/components/Column.svelte`
- Modify: `src/lib/components/CardItem.svelte`

No new tests for this task — the focus ring will be tested as part of Task 6's navigation tests.

- [ ] **Step 1: Add focusedCardId prop to Column.svelte**

In `src/lib/components/Column.svelte`, update the Props interface (around line 7):

```typescript
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
```

Update the destructuring (around line 26):

```typescript
let {
  id, label, cards, tags, board, isMobile,
  showHidden, hiddenCount, focusedCardId,
  onCardClick, onHideCard, onHideAll, onShowHidden,
  onAdvanceCard, onRetreatCard, onDrop, onAddCard
}: Props = $props();
```

Pass `focusedCardId` to each `<CardItem>` in the template (around line 87):

```svelte
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
```

- [ ] **Step 2: Add focusedCardId prop and focus ring to CardItem.svelte**

In `src/lib/components/CardItem.svelte`, update the Props interface (around line 6):

```typescript
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
```

Update the destructuring (line 18):

```typescript
let { card, tags, isMobile, canAdvance, canRetreat, focusedCardId, onclick, onhide, onadvance, onretreat }: Props = $props();
```

Add `focused` derived state after existing derived declarations (after line 39):

```typescript
const isFocused = $derived(card.id === focusedCardId);
```

Add `class:focused={isFocused}` to the card div (around line 43):

```svelte
<div
  class="card"
  class:complete={isComplete}
  class:focused={isFocused}
  data-card-id={card.id}
  ...
>
```

Add to `CardItem.svelte` `<style>` block (after `.card:hover` rule):

```css
.card.focused {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
}
```

- [ ] **Step 3: Pass focusedCardId from +page.svelte to all Column instances**

In `src/routes/+page.svelte`, add `{focusedCardId}` to every `<Column>` component usage. There are two locations: inside `{:else if isMobile}` and inside `{:else}`.

Mobile Column (around line 288):
```svelte
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
```

Desktop Columns (around line 309):
```svelte
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
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /home/gmk_user/kanban && npm run check
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Column.svelte src/lib/components/CardItem.svelte src/routes/+page.svelte
git commit -m "feat: add focusedCardId prop threading and card focus ring"
```

---

## Task 6: Navigation and Move Shortcuts

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `tests/kanban.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/kanban.test.ts` (after the 'pressing n' tests):

```typescript
test('j focuses the first card, second j moves focus to next card', async ({ page }) => {
  await page.goto('/');

  // Create two cards in Idea
  await page.locator('.column').first().getByRole('button', { name: '+ Add card' }).click();
  await page.getByLabel('Card title').fill('Card Alpha');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  await page.locator('.column').first().getByRole('button', { name: '+ Add card' }).click();
  await page.getByLabel('Card title').fill('Card Beta');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // Press j to focus first card
  await page.keyboard.press('j');
  await expect(page.locator('.card.focused')).toHaveCount(1);

  // Press j again to move to next card
  await page.keyboard.press('j');
  await expect(page.locator('.card.focused')).toHaveCount(1);
  // The second card should now be focused
  await expect(page.locator('.card.focused').filter({ hasText: 'Card Beta' })).toBeVisible();
});

test('k moves focus to previous card', async ({ page }) => {
  await page.goto('/');

  await page.locator('.column').first().getByRole('button', { name: '+ Add card' }).click();
  await page.getByLabel('Card title').fill('Card One');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  await page.locator('.column').first().getByRole('button', { name: '+ Add card' }).click();
  await page.getByLabel('Card title').fill('Card Two');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // j, j to reach Card Two, then k to go back to Card One
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  await expect(page.locator('.card.focused').filter({ hasText: 'Card Two' })).toBeVisible();

  await page.keyboard.press('k');
  await expect(page.locator('.card.focused').filter({ hasText: 'Card One' })).toBeVisible();
});

test('Escape clears card focus', async ({ page }) => {
  await page.goto('/');

  await page.locator('.column').first().getByRole('button', { name: '+ Add card' }).click();
  await page.getByLabel('Card title').fill('Escapable');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  await page.keyboard.press('j');
  await expect(page.locator('.card.focused')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(page.locator('.card.focused')).toHaveCount(0);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx playwright test tests/kanban.test.ts --grep "focuses|previous card|Escape clears"
```

Expected: 3 failures.

- [ ] **Step 3: Extend the keydown handler in +page.svelte**

Replace the existing `$effect(() => { function onKeyDown...` block added in Task 4 with this expanded version:

```typescript
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
        const toAdvance = cards.find((c) => c.id === focusedCardId);
        if (toAdvance) advanceCard(toAdvance);
        break;
      }
      case 'ArrowLeft': {
        if (!e.shiftKey) break;
        e.preventDefault();
        if (focusedCardId === null) break;
        const toRetreat = cards.find((c) => c.id === focusedCardId);
        if (toRetreat) retreatCard(toRetreat);
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx playwright test tests/kanban.test.ts --grep "focuses|previous card|Escape clears"
```

Expected: 3 passing.

- [ ] **Step 5: Run the full test suite**

```bash
npx playwright test
```

Expected: All tests passing. If any pre-existing tests fail unrelated to this work, note them but do not fix them here.

- [ ] **Step 6: Final commit**

```bash
git add src/routes/+page.svelte tests/kanban.test.ts
git commit -m "feat: add j/k navigation, ] [ move-card, Enter open, Escape clear keyboard shortcuts"
```

---

## Verification Checklist

After all tasks are complete, manually verify these in the browser:

1. **Image sizing:** paste/drag an image into a card — it fills editor width, is not distorted
2. **Lightbox:** click an image → full-size overlay; Escape dismisses lightbox but card modal stays open; click outside also dismisses
3. **Link preview (empty line):** open a card, click on an empty line, paste `https://github.com` → preview card renders with title/favicon after ~2s
4. **Link preview (inline):** type `see ` then paste a URL → stays as a plain hyperlink, no preview card
5. **Link preview remove:** hover the preview card, click `×` → converts back to a plain hyperlink
6. **`n` shortcut:** press `n` on the board → new card modal opens (Idea column)
7. **`j`/`k` navigation:** create 3+ cards, press `j` to cycle forward, `k` to go back; focus ring is visible
8. **`]`/`[` move:** focus a card in Idea, press `]` → card moves to In Progress immediately
9. **`Shift+→`/`Shift+←`:** same as `]`/`[`
10. **`Enter`:** while a card is focused, press Enter → card modal opens
11. **Modal gate:** while a modal is open, all shortcuts are silent
