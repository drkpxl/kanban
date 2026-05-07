# Contributing

Thanks for your interest in contributing! This is a personal project, but PRs and issues are welcome.

## Prerequisites

- Node.js 18 or later
- npm

## Dev setup

```bash
git clone https://github.com/drkpxl/kanban
cd kanban
npm install
cp .env.example .env       # adjust DATABASE_URL if needed
npm run db:push            # create / migrate the SQLite database
npm run dev                # http://localhost:5173
```

Uploaded images are stored in `data/uploads/` (gitignored). Create that directory if it doesn't exist:

```bash
mkdir -p data/uploads
```

## Development workflow

- Work on a feature branch (`git checkout -b feat/my-thing`).
- Keep commits focused; squash noise before opening a PR.
- Open a PR against `main` with a brief description of what and why.
- There are no rigid review SLAs — this is a side project, so patience is appreciated.

## Running tests

Tests use Playwright against an isolated `test.db` database.

```bash
npx playwright install chromium   # first time only
npm test
```

## Code style

- **TypeScript strict** — `tsconfig.json` has `"strict": true`; keep it clean.
- **Svelte 5 runes** — use `$state`, `$derived`, `$effect`, etc. throughout. No legacy Options API.
- **No Tailwind** — all styling is scoped CSS inside `.svelte` files. Prefer CSS custom properties from the active theme.
- **Formatting** — no formatter is enforced yet; match the style of the surrounding code.

## Adding a new theme

1. Create `src/lib/themes/<theme-name>.ts` exporting a `Theme` object (copy an existing file as a template).
2. Add the import and include the theme in the exported array in `src/lib/themes/index.ts`.
3. The theme switcher picks it up automatically — no other wiring needed.

## How tags work

Tags are defined in `tags.yaml` at the project root:

```yaml
tags:
  - slug: design      # unique, URL-safe identifier
    label: Design     # display name
    color: "#c17f3f"  # any CSS hex color
```

Edit the file and restart the dev server for changes to take effect. An example file is provided at `.tags.example.yaml`.
