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
