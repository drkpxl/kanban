# Kanban

A fast, self-hosted personal Kanban board that lives on your own machine and stays out of your way. No accounts, no subscriptions, no cloud — just a clean board you control, accessible from any device on your private network.

Built with SvelteKit 5, SQLite, and TipTap. Designed to run behind [Tailscale](https://tailscale.com) or any private VPN.

![16 themes, rich editor, keyboard shortcuts, link previews](.github/screenshot.png)

## Why this exists

Every hosted Kanban tool eventually wants a credit card, imposes an opinion on your workflow, or stores your notes on someone else's server. This one doesn't. It's a single Node process, a SQLite file, and a browser — fast to start, easy to back up, and entirely yours.

## Features

### Board
- **Two boards** — Personal and Work, switch instantly with zero reload
- **Three columns** — Idea → In Progress → Complete (top of stack = highest priority)
- **Drag and drop** — reorder cards within columns, promote with a single drag
- **Tags** — color-coded pills, defined in `tags.yaml`
- **Archive** — hide individual completed cards or archive all at once; reveal with "Show hidden"
- **Auto-refresh** — when you return focus to the tab (desktop or mobile), the board silently checks for changes and re-hydrates if anything has moved; new cards animate in, removed cards fade out

### Cards
- **Rich editor** — TipTap with full formatting: headings, lists, code blocks, blockquotes, inline code, links
- **Slash commands** — type `/` for a quick-insert menu (headings, lists, code, images, dividers)
- **Bubble menu** — select any text to apply bold, italic, strikethrough, heading, or link formatting instantly
- **Image upload** — drag & drop, paste, or tap the 🖼 button; works on desktop and iPhone; uploading/error status shown inline
- **Image lightbox** — click any image in a card to view it full-screen; Escape to close without losing edits
- **Link preview cards** — paste a URL alone on an empty line and it expands into a rich preview card with title, description, and thumbnail, fetched server-side
- **Auto-save on create** — cards are created automatically 400 ms after you type a title, so image uploads work immediately without a manual save step

### Navigation & shortcuts
| Key | Action |
|-----|--------|
| `n` | New card (Idea column) |
| `j` / `k` | Focus next / previous card |
| `]` or `Shift+→` | Move focused card to next column |
| `[` or `Shift+←` | Move focused card to previous column |
| `Enter` | Open focused card |
| `Escape` | Clear card focus |

All shortcuts are disabled while a modal is open and while typing in any input.

### Themes & mobile
- **16 themes** — Dracula, GitHub Dark/Light, Catppuccin Mocha/Latte, Tokyo Night, Gruvbox, Nord, and more — with dark/light/auto variants; choice persisted to localStorage
- **Mobile** — single-column view with swipe-to-advance between columns; full touch support including image upload from the camera roll

---

## Requirements

- **Node.js 22+** (uses `--env-file` for environment loading)
- npm

---

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/drkpxl/kanban
cd kanban
npm install

# 2. Create the database
npm run db:push

# 3. Create the uploads directory
mkdir -p data/uploads

# 4. Start the dev server
npm run dev
```

Open **http://localhost:5173**.

---

## Configuration

Copy `.env.example` to `.env` to override defaults:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `local.db` | Path to the SQLite database file |
| `PORT` | `3000` | Port for the production server (`npm start`) |
| `BODY_SIZE_LIMIT` | `512K` | Max upload body size — **set to `20971520` (20 MB) for iPhone photos** |

> The dev server ignores `PORT` — use the `--port` flag instead.

### Recommended `.env` for production

```bash
DATABASE_URL=local.db
PORT=3010
BODY_SIZE_LIMIT=20971520
```

### Custom port

```bash
# Dev server on the network (e.g. Tailscale)
npm run dev -- --host 0.0.0.0 --port 5173

# Production on a custom port
PORT=8080 npm start
```

### Tags

Edit `tags.yaml` to define your tags (copy `.tags.example.yaml` as a starting point):

```yaml
tags:
  - slug: design
    label: Design
    color: "#c17f3f"
  - slug: writing
    label: Writing
    color: "#4a7c59"
```

`slug` must be unique and URL-safe. `color` accepts any CSS hex value. Restart the server after editing.

---

## Database

```bash
# Apply schema changes after pulling updates
npm run db:push

# Browse data in a GUI
npm run db:studio
```

The database file lives at `DATABASE_URL` (default: `local.db` in the project root). Uploaded images are stored in `data/uploads/` and are never committed to git.

---

## Production with PM2

```bash
# Build first — always required before restarting
npm run build

# Start with PM2
pm2 start "node --env-file=.env build/index.js" --name kanban

# Persist across reboots
pm2 save
pm2 startup
```

**Updating:** always build before restarting, or changes won't appear:

```bash
npm install        # if dependencies changed
npm run build
pm2 restart kanban
```

### Nightly backup

Register a backup job (runs at 02:00, keeps 3 copies):

```bash
pm2 start "node --env-file=.env scripts/backup-db.js" \
  --name kanban-backup \
  --cron "0 2 * * *" \
  --no-autorestart
pm2 save
```

Run `npm run test:backup` to verify the backup script works correctly.

---

## Testing

End-to-end tests use Playwright against an isolated `test.db` database.

```bash
# Install browser binaries (first time only)
npx playwright install chromium
npx playwright install-deps chromium   # Linux only

# Run all tests
npm test

# Verify backup script
npm run test:backup
```

---

## Project structure

```
src/
  lib/
    actions/          # Svelte actions (focusTrap, swipeable)
    components/       # UI components:
                      #   BoardSwitcher, Column, CardItem, CardModal
                      #   TipTapEditor, ThemeSwitcher
                      #   slash-commands.ts, link-preview-extension.ts
    server/
      db/             # Drizzle schema and client
      tags.ts         # Reads tags.yaml at startup
    stores/           # Theme store (theme.svelte.ts)
    themes/           # 16 theme files + index.ts
    types.ts          # Shared TypeScript types
  routes/
    +page.svelte      # Main board page (keyboard shortcuts, card state)
    api/
      cards/          # CRUD + reorder + version endpoints
      images/         # Image upload endpoint
      link-preview/   # Server-side OG metadata fetcher
      uploads/        # Serves uploaded image files
data/
  uploads/            # Uploaded images — gitignored, create manually
scripts/
  backup-db.js        # Nightly DB backup (run via PM2 cron)
tags.yaml             # Tag definitions — edit to customise
.tags.example.yaml    # Starter tags to copy from
```

---

## Known limitations

- **Single-user** — no authentication or multi-tenancy. Run behind a VPN (Tailscale recommended); do not expose directly to the internet.
- **Fixed boards and columns** — Personal / Work and Idea / In Progress / Complete are hardcoded; not configurable through the UI.
- **No live push** — changes in one open tab don't push to another in real time; the board re-syncs on focus return, so switching back to a tab will pick up any changes.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT — see [LICENSE](LICENSE).
