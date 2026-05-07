# Nightly DB Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `scripts/backup-db.js` Node.js script that verifies SQLite integrity, copies the database with a date-stamped filename, and prunes to the 3 most recent backups — registered with PM2 as a nightly cron job.

**Architecture:** A single ESM script exports three testable functions (`findBackups`, `pruneBackups`, `runBackup`) and a `main()` entry point guarded by an `import.meta.url` check so tests can import without triggering side effects. All logic uses Node built-ins (`node:fs`, `node:path`) and `better-sqlite3` which is already a project dependency.

**Tech Stack:** Node 22, `better-sqlite3`, `node:test` (built-in), PM2

---

### Task 1: Write failing tests

**Files:**
- Create: `scripts/backup-db.test.js`

- [ ] **Step 1: Create the test file**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { findBackups, pruneBackups, runBackup } from './backup-db.js';

test('findBackups returns newest-first, ignores unrelated files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backup-test-'));
  writeFileSync(join(dir, 'local.db.bak.2026-05-05'), '');
  writeFileSync(join(dir, 'local.db.bak.2026-05-07'), '');
  writeFileSync(join(dir, 'local.db.bak.2026-05-06'), '');
  writeFileSync(join(dir, 'unrelated.txt'), '');

  const backups = findBackups(dir, 'local.db');

  assert.deepEqual(backups, [
    'local.db.bak.2026-05-07',
    'local.db.bak.2026-05-06',
    'local.db.bak.2026-05-05',
  ]);
});

test('pruneBackups deletes oldest files beyond keep limit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backup-test-'));
  const files = [
    'local.db.bak.2026-05-07',
    'local.db.bak.2026-05-06',
    'local.db.bak.2026-05-05',
    'local.db.bak.2026-05-04',
  ];
  files.forEach(f => writeFileSync(join(dir, f), ''));

  pruneBackups(dir, files, 3);

  assert.ok(existsSync(join(dir, 'local.db.bak.2026-05-07')), 'newest kept');
  assert.ok(existsSync(join(dir, 'local.db.bak.2026-05-06')), '2nd kept');
  assert.ok(existsSync(join(dir, 'local.db.bak.2026-05-05')), '3rd kept');
  assert.ok(!existsSync(join(dir, 'local.db.bak.2026-05-04')), 'oldest pruned');
});

test('pruneBackups keeps all when under limit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backup-test-'));
  const files = ['local.db.bak.2026-05-07', 'local.db.bak.2026-05-06'];
  files.forEach(f => writeFileSync(join(dir, f), ''));

  pruneBackups(dir, files, 3);

  assert.ok(existsSync(join(dir, 'local.db.bak.2026-05-07')));
  assert.ok(existsSync(join(dir, 'local.db.bak.2026-05-06')));
});

test('runBackup creates a backup of a valid database', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backup-test-'));
  const dbPath = join(dir, 'test.db');
  const db = new Database(dbPath);
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
  db.close();

  const ok = runBackup(dbPath, 3);

  assert.equal(ok, true);
  const backups = findBackups(dir, 'test.db');
  assert.equal(backups.length, 1);
  assert.match(backups[0], /test\.db\.bak\.\d{4}-\d{2}-\d{2}/);
});

test('runBackup returns false and writes no backup for a corrupt database', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backup-test-'));
  const dbPath = join(dir, 'corrupt.db');
  writeFileSync(dbPath, 'this is not a sqlite database');

  const ok = runBackup(dbPath, 3);

  assert.equal(ok, false);
  assert.equal(findBackups(dir, 'corrupt.db').length, 0);
});

test('runBackup prunes to keep limit when existing backups are present', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backup-test-'));
  const dbPath = join(dir, 'test.db');
  const db = new Database(dbPath);
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
  db.close();

  // Seed 3 older backups
  writeFileSync(join(dir, 'test.db.bak.2026-05-04'), '');
  writeFileSync(join(dir, 'test.db.bak.2026-05-05'), '');
  writeFileSync(join(dir, 'test.db.bak.2026-05-06'), '');

  runBackup(dbPath, 3);

  const backups = findBackups(dir, 'test.db');
  assert.equal(backups.length, 3, 'exactly 3 kept');
  assert.ok(!existsSync(join(dir, 'test.db.bak.2026-05-04')), 'oldest pruned');
});
```

- [ ] **Step 2: Run tests — confirm they fail with "cannot find module"**

```bash
node --test scripts/backup-db.test.js
```

Expected: error `ERR_MODULE_NOT_FOUND` for `./backup-db.js` — the file doesn't exist yet.

---

### Task 2: Implement the backup script

**Files:**
- Create: `scripts/backup-db.js`

- [ ] **Step 1: Create the script**

```javascript
#!/usr/bin/env node
import Database from 'better-sqlite3';
import { copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function log(level, msg) {
  console.log(`[${new Date().toISOString()}] ${level}: ${msg}`);
}

export function findBackups(dir, base) {
  return readdirSync(dir)
    .filter(f => f.startsWith(`${base}.bak.`))
    .sort()
    .reverse(); // YYYY-MM-DD suffix sorts lexicographically, reverse = newest first
}

export function pruneBackups(dir, backups, keep) {
  const toDelete = backups.slice(keep);
  for (const f of toDelete) {
    try {
      unlinkSync(join(dir, f));
      log('INFO', `pruned: ${f}`);
    } catch (err) {
      log('WARN', `could not prune ${f}: ${err.message}`);
    }
  }
  return toDelete.length;
}

export function runBackup(dbPath, keep = 3) {
  const dir = dirname(dbPath);
  const base = basename(dbPath);

  let db;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch (err) {
    log('ERROR', `could not open database: ${err.message}`);
    return false;
  }

  let integrityResult;
  try {
    integrityResult = db.pragma('integrity_check', { simple: true });
  } finally {
    db.close();
  }

  if (integrityResult !== 'ok') {
    log('ERROR', `integrity_check failed: ${integrityResult}`);
    return false;
  }

  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const backupName = `${base}.bak.${stamp}`;
  const backupPath = join(dir, backupName);

  try {
    copyFileSync(dbPath, backupPath);
  } catch (err) {
    log('ERROR', `copy failed: ${err.message}`);
    return false;
  }

  log('INFO', `backup written: ${backupPath}`);

  const backups = findBackups(dir, base);
  const pruned = pruneBackups(dir, backups, keep);
  if (pruned === 0) log('INFO', 'no old backups to prune');

  log('INFO', 'done');
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dbPath = resolve(process.env.DATABASE_URL ?? 'local.db');
  const ok = runBackup(dbPath, 3);
  process.exit(ok ? 0 : 1);
}
```

- [ ] **Step 2: Run tests — all should pass**

```bash
node --test scripts/backup-db.test.js
```

Expected output (6 passing):
```
✔ findBackups returns newest-first, ignores unrelated files
✔ pruneBackups deletes oldest files beyond keep limit
✔ pruneBackups keeps all when under limit
✔ runBackup creates a backup of a valid database
✔ runBackup returns false and writes no backup for a corrupt database
✔ runBackup prunes to keep limit when existing backups are present
ℹ tests 6
ℹ pass 6
ℹ fail 0
```

- [ ] **Step 3: Commit**

```bash
git add scripts/backup-db.js scripts/backup-db.test.js
git commit -m "feat: add nightly DB backup script with integrity check and 3-backup rotation"
```

---

### Task 3: Wire up the test script in package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the test:backup script**

In `package.json`, inside `"scripts"`, add after the existing `"test:ui"` line:

```json
"test:backup": "node --test scripts/backup-db.test.js"
```

The scripts block should look like:
```json
"scripts": {
  "dev": "vite dev",
  "build": "vite build",
  "preview": "vite preview",
  "prepare": "svelte-kit sync || echo ''",
  "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
  "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
  "db:push": "drizzle-kit push",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "start": "node build",
  "test": "DATABASE_URL=test.db playwright test",
  "test:ui": "DATABASE_URL=test.db playwright test --ui",
  "test:backup": "node --test scripts/backup-db.test.js"
},
```

- [ ] **Step 2: Verify it runs**

```bash
npm run test:backup
```

Expected: 6 passing, 0 failing.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add test:backup npm script"
```

---

### Task 4: Manual smoke test against the real database

- [ ] **Step 1: Run against the live database**

```bash
node --env-file=.env scripts/backup-db.js
```

Expected output (timestamps will differ):
```
[2026-05-07T02:00:00.000Z] INFO: backup written: /home/gmk_user/kanban/local.db.bak.2026-05-07
[2026-05-07T02:00:00.000Z] INFO: no old backups to prune
[2026-05-07T02:00:00.000Z] INFO: done
```

- [ ] **Step 2: Confirm the backup file exists**

```bash
ls -lh local.db local.db.bak.*
```

Expected: both files present, similar sizes.

- [ ] **Step 3: Run twice more to trigger pruning (rename existing backup to fake older date first)**

```bash
mv local.db.bak.$(date +%Y-%m-%d) local.db.bak.2026-05-04
node --env-file=.env scripts/backup-db.js
mv local.db.bak.$(date +%Y-%m-%d) local.db.bak.2026-05-05
node --env-file=.env scripts/backup-db.js
```

Now there are four backups. Run once more:

```bash
node --env-file=.env scripts/backup-db.js
ls local.db.bak.*
```

Expected: exactly 3 backup files present, `local.db.bak.2026-05-04` gone.

---

### Task 5: Register with PM2

- [ ] **Step 1: Register the backup job**

Run from the project root:

```bash
pm2 start "node --env-file=.env scripts/backup-db.js" \
  --name kanban-backup \
  --cron "0 2 * * *" \
  --no-autorestart
```

- [ ] **Step 2: Verify it appears in pm2 list**

```bash
pm2 list
```

Expected: two entries — `kanban` (online) and `kanban-backup` (stopped, which is normal between runs).

- [ ] **Step 3: Trigger a manual run via PM2 to confirm logs are captured**

```bash
pm2 restart kanban-backup
sleep 3
pm2 logs kanban-backup --lines 20
```

Expected: the INFO log lines from the backup appear in PM2's log output.

- [ ] **Step 4: Persist the PM2 process list**

```bash
pm2 save
```

Expected output: `[PM2] Saving current process list...`

---

### Task 6: Update CONTRIBUTING.md

**Files:**
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Add a Backup section**

Open `CONTRIBUTING.md` and add this section after the **Testing** section:

```markdown
## Nightly Backup

A `scripts/backup-db.js` script runs nightly via PM2. It checks database integrity before writing and keeps the 3 most recent backups alongside the live database.

Run the backup tests:

```bash
npm run test:backup
```

To register (or re-register) the PM2 job after a fresh deploy:

```bash
pm2 start "node --env-file=.env scripts/backup-db.js" \
  --name kanban-backup \
  --cron "0 2 * * *" \
  --no-autorestart
pm2 save
```
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: document backup script and PM2 registration in CONTRIBUTING"
```
