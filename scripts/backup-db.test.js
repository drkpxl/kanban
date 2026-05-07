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
