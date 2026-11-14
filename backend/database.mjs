import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(
    'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;',
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, digest TEXT NOT NULL, applied_at INTEGER NOT NULL)',
  );
  const folder = new URL('./migrations/', import.meta.url);
  for (const name of readdirSync(folder)
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(new URL(name, folder), 'utf8'),
      digest = createHash('sha256').update(sql).digest('hex');
    const existing = db.prepare('SELECT digest FROM migrations WHERE name=?').get(name);
    if (existing) {
      if (existing.digest !== digest) throw new Error(`Migration checksum changed: ${name}`);
      continue;
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO migrations VALUES (?,?,?)').run(name, digest, Date.now());
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      db.close();
      throw e;
    }
  }
  return {
    db,
    get: (sql, ...p) => db.prepare(sql).get(...p),
    all: (sql, ...p) => db.prepare(sql).all(...p),
    run: (sql, ...p) => db.prepare(sql).run(...p),
    transaction(fn) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
