import { resolve } from 'node:path';
import { rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { decryptFile } from '../backend/backup.mjs';
const [source, target] = process.argv.slice(2);
if (!source || !target || !process.env.BACKUP_KEY)
  throw new Error(
    'Usage: BACKUP_KEY=... node scripts/restore-backup.mjs downloaded.sqlite.enc NEW-DATABASE.sqlite',
  );
if (existsSync(target))
  throw new Error(
    'Refusing to overwrite an existing database. Stop the service and choose a new target.',
  );
const temporary = resolve(target) + '.restoring';
try {
  await decryptFile(resolve(source), temporary, process.env.BACKUP_KEY);
  await rename(temporary, resolve(target));
  console.log(
    'Backup decrypted and SQLite integrity verified. Point QUAD_DB at the restored file while the service is stopped.',
  );
} catch (e) {
  await rm(temporary, { force: true });
  throw e;
}
