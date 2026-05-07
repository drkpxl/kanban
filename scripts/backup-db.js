#!/usr/bin/env node
import Database from 'better-sqlite3';
import { readdirSync, unlinkSync } from 'node:fs';
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

  try {
    const result = db.pragma('integrity_check', { simple: true });
    if (result !== 'ok') {
      log('ERROR', `integrity_check failed: ${result}`);
      return false;
    }

    const backupPath = join(dir, `${base}.bak.${new Date().toISOString().slice(0, 10)}`);
    db.exec(`VACUUM INTO '${backupPath}'`);
    log('INFO', `backup written: ${backupPath}`);
  } catch (err) {
    log('ERROR', `backup failed: ${err.message}`);
    return false;
  } finally {
    db.close();
  }

  const backups = findBackups(dir, base);
  pruneBackups(dir, backups, keep);
  log('INFO', 'done');
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dbPath = resolve(process.env.DATABASE_URL ?? 'local.db');
  const ok = runBackup(dbPath, 3);
  process.exit(ok ? 0 : 1);
}
