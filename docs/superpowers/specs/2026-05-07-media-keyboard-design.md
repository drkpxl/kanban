# Media Handling & Keyboard Shortcuts Design

**Date:** 2026-05-07  
**Status:** Approved

## Context

The kanban board works well as a personal tool but two areas of daily friction were identified:

1. **Images paste into the editor at whatever size they are** — no sizing constraints, no way to view them larger without navigating away
2. **Pasted URLs render as plain hyperlinks** — no context about what the link is without clicking it
3. **All card operations require a mouse** — creating, navigating, and moving cards between columns requires clicking

These features keep the app personal and self-hosted while meaningfully improving day-to-day use.

---

## Architecture

Two independent feature tracks that share no code and can be built separately.

**Track A — Media handling:** TipTap layer only  
**Track B — Keyboard shortcuts:** Board page + card components

---

## Track A: Media Handling

### Image improvements

Extend the existing `@tiptap/extension-image` with a custom node view:

- Constrain width to 100% of the editor container
- Add `cursor: pointer` styling
- Click handler sets a `lightboxSrc: string | null` variable inside `TipTapEditor.svelte`
- When `lightboxSrc` is set, a lightbox overlay renders — full-size image, click outside or Escape to dismiss
- The lightbox is portalled to `document.body` to escape the CardModal focus trap (otherwise Escape gets swallowed by the modal before reaching the lightbox)

**Files affected:**
- `src/lib/components/TipTapEditor.svelte` — custom Image node view + lightbox state + Lightbox overlay markup

### Link previews

**Server endpoint:** `GET /api/link-preview?url=...`
- Fetches the target page server-side (avoids CORS)
- Parses `og:title`, `og:description`, `og:image`, favicon (`<link rel="icon">` or `/favicon.ico` fallback)
- Returns `{ title, description, image, favicon, url }`
- Simple in-memory `Map` cache keyed by URL — same link won't re-fetch within a server session

**TipTap `LinkPreview` node:**
- PasteRule detects a URL pasted alone on an empty line → replaces with `linkPreview` node, fetches preview data asynchronously
- URLs pasted inline with other text stay as regular Link marks (no change to existing behavior)
- Renders as a compact card: favicon + title + description + truncated URL
- Clicking the card opens the URL in a new tab
- A small `×` button in edit mode converts it back to a plain link
- Stored as a custom node in TipTap JSON — no changes to the existing body storage format

**Files affected:**
- `src/routes/api/link-preview/+server.ts` — new endpoint
- `src/lib/components/TipTapEditor.svelte` — LinkPreview extension + node view

---

## Track B: Keyboard Shortcuts

### Focused card concept

- `focusedCardId: number | null` as page-level `$state` in `src/routes/+page.svelte`
- Passed as a prop to `Column.svelte` → `CardItem.svelte`
- `CardItem` shows a subtle border ring (using existing workshop theme CSS variables) when its id matches `focusedCardId`
- Document-level `keydown` listener on `+page.svelte`, gated by a `modalOpen` boolean — goes silent when CardModal is open

### Key bindings

| Key | Action |
|-----|--------|
| `n` | Open new card modal (creates in Idea column) |
| `j` or `↓` | Focus next card (down column, wraps to top of next column, wraps from last card of last column to first card of first column) |
| `k` or `↑` | Focus previous card (reverse wrap) |
| `]` or `Shift+→` | Move focused card to next column |
| `[` or `Shift+←` | Move focused card to previous column |
| `Escape` | Clear focused card (only when modal is closed) |

Move operations call the existing `PATCH /api/cards/{id}` with `{ column }` — the same path drag-and-drop already uses. Column order is fixed: Idea → In Progress → Complete.

**Files affected:**
- `src/routes/+page.svelte` — `focusedCardId` state, `modalOpen` gate, `keydown` listener
- `src/lib/components/Column.svelte` — accept + pass down `focusedCardId` prop
- `src/lib/components/CardItem.svelte` — render focus ring when id matches

---

## Verification

1. **Image sizing:** Paste or drag an image into a card — confirm it fills editor width without overflowing, not distorted
2. **Lightbox:** Click an image in the editor (view mode) — confirm full-size overlay appears; Escape and click-outside both dismiss it; does not interfere with card modal close
3. **Link preview:** Paste a URL alone on an empty line — confirm preview card renders with title/description; pasting inline leaves it as a plain link; `×` button reverts to plain link
4. **Link preview endpoint:** `GET /api/link-preview?url=https://example.com` returns valid JSON
5. **Keyboard nav:** `j`/`k` cycle through all cards across columns; focus ring is visible
6. **Keyboard move:** `]` and `[` move a focused card to adjacent columns; board updates immediately
7. **New card:** `n` opens modal pre-set to Idea column
8. **Modal gate:** Shortcuts do nothing while a card modal is open
