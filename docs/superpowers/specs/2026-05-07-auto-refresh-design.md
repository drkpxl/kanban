# Auto-Refresh on Focus — Design Spec

**Date:** 2026-05-07

## Overview

When the user returns focus to the kanban tab (desktop or mobile), the board silently checks whether the data has changed. If it has, the board re-hydrates and cards animate in or out to reflect the new state.

## Trigger

- `document.visibilitychange` (hidden → visible) — covers tab switching and app switching on mobile
- `window.focus` — covers alt-tab on desktop
- Throttled: no more than one version check per 2 seconds to handle rapid switching

## Version Endpoint

**New file:** `src/routes/api/cards/version/+server.ts`

`GET /api/cards/version?board=X`

Runs a single SQLite aggregate query: `COUNT(id)` and `MAX(updated_at)` on the cards table for the given board (all cards, including hidden). Returns:

```json
{ "version": "N-TIMESTAMP" }
```

Version string changes on: card created, deleted, edited, moved, hidden/unhidden.

## Client-Side Logic (`+page.svelte`)

1. After each `loadCards()` completes successfully, store the returned version as `lastVersion`.
2. On focus/visibility trigger, call `checkVersion()`:
   - If `Date.now() - lastCheckTime < 2000`, skip.
   - Fetch `/api/cards/version?board=activeBoard`.
   - If `version !== lastVersion`, call `loadCards()`.
   - Otherwise update `lastVersion` and do nothing.
3. Runs in the background regardless of modal state.
4. Version check failures are silent (caught and ignored).

## Animations (`Column.svelte`)

Svelte `in:` / `out:` transition directives on the card `{#each}` items:

- **Enter:** `fly` from y: -12 + `fade` — card slides down and fades in
- **Exit:** `fly` to y: 8 + `fade` — card slides down and fades out

Transitions fire automatically when card ids enter or leave the array. No manual class management needed. `animate:flip` (already present if used) handles reordering.

## Files Changed

| File | Change |
|------|--------|
| `src/routes/api/cards/version/+server.ts` | New — version endpoint |
| `src/routes/+page.svelte` | Add `checkVersion`, focus/visibility listeners, store `lastVersion` |
| `src/lib/components/Column.svelte` | Add `in:`/`out:` transitions to card list items |

## Out of Scope

- Interval polling while tab is active
- Diff-and-merge of in-flight edits (local state wins if modal is open)
- Per-field animations for modified cards (silent update)
