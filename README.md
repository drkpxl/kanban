# Kanban

A personal Kanban board for two workspaces — Personal and Work. Built with SvelteKit, SQLite, and TipTap. Designed to run self-hosted (behind Tailscale or similar) with no authentication layer.

## Features

- **Two boards** — Personal and Work, switch instantly
- **Three columns** — Idea, In Progress, Complete (top of stack = highest priority)
- **Rich card editor** — TipTap with image upload (drag & drop, paste, or `/` slash command)
- **Slash commands** — type `/` in the editor for headings, lists, code blocks, quotes, images
- **Bubble menu** — select text to apply inline formatting
- **Drag and drop** — reorder cards within and between columns
- **Tags** — configured in `tags.yaml`, displayed as color-coded pills
- **Hide completed** — archive individual cards or all at once; reveal with "Show hidden"
- **Mobile** — single-column view with tap-to-advance between columns

## Requirements

- Node.js 18 or later
- npm

## Setup

```bash
# 1. Clone and install dependencies
git clone https://github.com/drkpxl/kanban
cd kanban
npm install

# 2. Create the database (uses local.db by default)
npm run db:push

# 3. Create the uploads directory (needed for image uploads)
mkdir -p data/uploads

# 4. Start the dev server
npm run dev
```

Open **http://localhost:5173** in your browser.

## Configuration

### Environment variables

Copy `.env.example` to `.env` to override defaults:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `local.db` | Path to the SQLite database file |
| `PORT` | `3000` | Port for the **production** server (`npm start`) |

The dev server ignores `PORT` — use the `--port` flag instead (see below).

### Custom port

```bash
# Dev server on a different port
npm run dev -- --port 8080

# Dev server accessible on your network (e.g. Tailscale)
npm run dev -- --host 0.0.0.0 --port 5173

# Production server on a custom port
PORT=8080 npm start
```

### Tags

Edit `tags.yaml` to define your tags. Restart the server for changes to take effect.

```yaml
tags:
  - slug: design
    label: Design
    color: "#c17f3f"
  - slug: writing
    label: Writing
    color: "#4a7c59"
```

`slug` must be unique and URL-safe. `color` accepts any CSS hex color.

## Database

```bash
# Apply schema changes after pulling updates
npm run db:push

# Open Drizzle Studio to browse data in a GUI
npm run db:studio
```

The database file is created at `DATABASE_URL` (default: `local.db` in the project root). Uploaded images are stored in `data/uploads/` and are never committed to git.

## Production with PM2

```bash
# Build
npm run build

# Start with PM2
pm2 start build/index.js --name kanban

# With a custom port and database path
DATABASE_URL=/data/kanban.db PORT=3000 pm2 start build/index.js --name kanban

# Save and enable on boot
pm2 save
pm2 startup
```

To update after pulling new code:

```bash
npm install
npm run build
pm2 restart kanban
```

## Testing

Tests use Playwright against an isolated `test.db` database.

```bash
# Install browser binaries (first time)
npx playwright install chromium

# Linux only: install system dependencies for Chromium
npx playwright install-deps chromium

# Run all tests
npm test
```

## Project structure

```
src/
  lib/
    components/       # UI components (Board, Column, Card, Editor)
    server/
      db/             # Drizzle schema and client
      tags.ts         # Reads tags.yaml at startup
    types.ts          # Shared TypeScript types
  routes/
    +page.svelte      # Main board page
    api/              # JSON API endpoints (cards, images, uploads)
data/
  uploads/            # Uploaded images — gitignored, create manually
tags.yaml             # Tag definitions — edit to customise
```

## Known Limitations

- **Single-user design** — no authentication, no multi-tenancy. Run this behind a VPN or private network (e.g. Tailscale); do not expose it directly to the internet.
- **Fixed boards and columns** — Personal / Work boards and Idea / In Progress / Complete columns are hardcoded and not configurable through the UI.
- **No real-time sync** — if you open the board in two browser tabs simultaneously, changes in one tab won't push to the other until you refresh.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT — see [LICENSE](LICENSE).
