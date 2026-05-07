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
  } catch (err) {
    log('ERROR', `could not read database: ${err.message}`);
    return false;
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
