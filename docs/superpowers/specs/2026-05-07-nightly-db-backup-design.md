# Nightly DB Backup — Design Spec

**Date:** 2026-05-07  
**Status:** Approved

## Context

The app runs a single SQLite database (`local.db` by default, overridable via `DATABASE_URL`). There is no existing backup mechanism. The goal is a lightweight nightly backup that detects corruption before writing, keeps only the three most recent copies, and integrates with the existing PM2 process management setup so status and logs are visible in one place.

## What We're Building

A Node.js script (`scripts/backup-db.js`) registered with PM2 as a cron-triggered one-shot job. Each night at 02:00 it:

1. Opens the database read-only with `better-sqlite3`
2. Runs `PRAGMA integrity_check` — if the result is not `"ok"` it logs the error and exits non-zero without touching any backup files (preserving the last known-good copies)
3. Copies the database file to `<db-dir>/<db-name>.bak.YYYY-MM-DD` using `fs.copyFile`
4. Scans the same directory for all `*.bak.*` files belonging to this database, sorts newest-first, and deletes any beyond the three most recent
5. Logs all activity with ISO timestamps to stdout; PM2 captures this in its standard log pipeline

## Files

| Path | Purpose |
|---|---|
| `scripts/backup-db.js` | The backup script (new) |

No ecosystem config file is needed — PM2 registration is a one-time `pm2 start` command (see Deployment below).

## Script Logic

```
resolvedDb  = path.resolve(DATABASE_URL ?? 'local.db')
backupName  = `${basename}.bak.${YYYY-MM-DD}`
backupPath  = join(dirname, backupName)

open DB readonly with better-sqlite3
result = db.pragma('integrity_check', { simple: true })
if result !== 'ok':
    log ERROR with result detail
    exit(1)

fs.copyFileSync(resolvedDb, backupPath)
log "backup written to <backupPath>"

glob all files matching `${basename}.bak.*` in same dir
sort descending (newest first by filename — date suffix sorts lexicographically)
delete entries [3..]
log "pruned N old backup(s)" if any deleted

exit(0)
```

## Environment

The script reads `DATABASE_URL` from the process environment. The PM2 registration command wraps Node with `--env-file=.env` (matching the existing `kanban` process pattern) so the same `.env` the app uses is passed through automatically.

## Deployment

One-time registration (run from the project root after the script is in place):

```bash
pm2 start "node --env-file=.env scripts/backup-db.js" \
  --name kanban-backup \
  --cron "0 2 * * *" \
  --no-autorestart

pm2 save
```

After this, `pm2 list` shows `kanban-backup` alongside `kanban`. Status will be:
- `stopped` between runs (normal)
- `errored` if the last run exited non-zero (corruption detected or copy failed — worth investigating)

## Error Handling

| Situation | Behaviour |
|---|---|
| `integrity_check` returns non-ok | Log details, exit 1, no files written or deleted |
| Database file not found | `better-sqlite3` throws on open; caught, logged, exit 1 |
| Copy fails (disk full, permissions) | `copyFileSync` throws; caught, logged, exit 1 |
| Prune fails for one file | Log warning, continue (don't abort over a stale backup) |

In all failure cases the existing backup files are left untouched.

## Verification

- Run `node --env-file=.env scripts/backup-db.js` manually and confirm a `.bak.YYYY-MM-DD` file appears next to `local.db`
- Run it three more times (changing the date or renaming outputs) and confirm only the three newest survive
- Temporarily corrupt a test DB and confirm the script exits 1 without writing a new backup
- Check `pm2 logs kanban-backup` after registration to confirm output is captured
