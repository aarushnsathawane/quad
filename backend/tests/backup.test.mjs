import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { encryptFile, decryptFile } from '../backup.mjs';
test('online backups restore consistently and reject wrong keys or tampering', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'quad-restore-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const db = new DatabaseSync(join(dir, 'source.sqlite'));
  t.after(() => db.close());
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE records(value TEXT); INSERT INTO records VALUES ('private campus data');",
  );
  const snapshot = join(dir, 'snapshot.sqlite'),
    encrypted = join(dir, 'backup.enc'),
    restored = join(dir, 'restored.sqlite'),
    secret = 'a-random-backup-key-at-least-32-characters';
  await backup(db, snapshot);
  await encryptFile(snapshot, encrypted, secret);
  assert.ok(!(await readFile(encrypted)).includes(Buffer.from('private campus data')));
  await decryptFile(encrypted, restored, secret);
  const check = new DatabaseSync(restored);
  assert.equal(check.prepare('SELECT value FROM records').get().value, 'private campus data');
  check.close();
  await assert.rejects(
    decryptFile(encrypted, join(dir, 'wrong.sqlite'), 'different-key-at-least-32-characters'),
  );
  const bytes = await readFile(encrypted);
  bytes[30] ^= 1;
  await writeFile(join(dir, 'tampered.enc'), bytes);
  await assert.rejects(
    decryptFile(join(dir, 'tampered.enc'), join(dir, 'tampered.sqlite'), secret),
  );
});

test('production snapshots exclude location cells and login sessions while preserving account data', async (t) => {
  const { openDatabase } = await import('../database.mjs');
  const { snapshotDatabase } = await import('../backup.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'quad-scrub-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = openDatabase(':memory:');
  t.after(() => store.db.close());
  store.run("INSERT INTO users VALUES ('test','test@rutgers.edu',1,'{}',1,'active',1,1,'v1')");
  store.run("INSERT INTO visibility VALUES ('test','university',NULL,40.5015,-74.45,1)");
  store.run("INSERT INTO sessions VALUES ('secret-digest','test',100,1)");
  store.run("INSERT INTO login_codes VALUES ('test@rutgers.edu','nonce','digest',100,1,0)");
  const path = join(dir, 'snapshot.sqlite');
  await snapshotDatabase(store.db, path);
  const copy = new DatabaseSync(path);
  t.after(() => copy.close());
  assert.equal(copy.prepare('SELECT COUNT(*) n FROM users').get().n, 1);
  assert.equal(copy.prepare('SELECT lat FROM visibility').get().lat, null);
  assert.equal(copy.prepare('SELECT COUNT(*) n FROM sessions').get().n, 0);
  assert.equal(copy.prepare('SELECT COUNT(*) n FROM login_codes').get().n, 0);
  assert.equal(store.get('SELECT lat FROM visibility').lat, 40.5015);
});
