import { backup, DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, createCipheriv, createDecipheriv, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, appendFile, open, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pipeline } from 'node:stream/promises';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
const MAGIC = Buffer.from('QUADBK01');
const keyFor = (secret) => {
  if (!secret || secret.length < 32) throw new Error('BACKUP_KEY must have at least 32 characters');
  return createHash('sha256').update(secret).digest();
};
export async function encryptFile(source, target, secret) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const handle = await open(target, 'wx', 0o600);
  await handle.write(Buffer.concat([MAGIC, iv]));
  await handle.close();
  await pipeline(
    createReadStream(source),
    cipher,
    createWriteStream(target, { flags: 'a', mode: 0o600 }),
  );
  await appendFile(target, cipher.getAuthTag());
}
export async function decryptFile(source, target, secret) {
  const size = (await stat(source)).size;
  if (size < 36) throw new Error('Invalid backup file');
  const handle = await open(source, 'r'),
    header = Buffer.alloc(20),
    tag = Buffer.alloc(16);
  await handle.read(header, 0, 20, 0);
  await handle.read(tag, 0, 16, size - 16);
  await handle.close();
  if (!header.subarray(0, 8).equals(MAGIC)) throw new Error('Invalid backup format');
  const cipher = createDecipheriv('aes-256-gcm', keyFor(secret), header.subarray(8));
  cipher.setAuthTag(tag);
  try {
    await pipeline(
      createReadStream(source, { start: 20, end: size - 17 }),
      cipher,
      createWriteStream(target, { flags: 'wx', mode: 0o600 }),
    );
  } catch (e) {
    await rm(target, { force: true });
    throw e;
  }
  const db = new DatabaseSync(target, { readOnly: true });
  try {
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok')
      throw new Error('Backup integrity check failed');
  } finally {
    db.close();
  }
}
export async function snapshotDatabase(db, target) {
  await backup(db, target);
  const snapshot = new DatabaseSync(target);
  try {
    snapshot.exec(
      'PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON; BEGIN IMMEDIATE; UPDATE visibility SET lat=NULL,lng=NULL,updated_at=NULL; DELETE FROM sessions; DELETE FROM login_codes; COMMIT; VACUUM;',
    );
  } finally {
    snapshot.close();
  }
}
export async function backupOffsite(db, config) {
  const directory = await mkdtemp(join(tmpdir(), 'quad-backup-'));
  try {
    const plain = join(directory, 'snapshot.sqlite'),
      encrypted = join(directory, 'snapshot.enc');
    await snapshotDatabase(db, plain);
    await encryptFile(plain, encrypted, config.backup.key);
    const client = new S3Client({
      region: config.backup.region,
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 5000, requestTimeout: 15000 },
      endpoint: config.backup.endpoint || undefined,
      credentials: {
        accessKeyId: config.backup.accessKey,
        secretAccessKey: config.backup.secretKey,
      },
    });
    try {
      const key = `quad/${new Date().toISOString()}-${randomUUID()}.sqlite.enc`;
      await client.send(
        new PutObjectCommand({
          Bucket: config.backup.bucket,
          Key: key,
          Body: createReadStream(encrypted),
          ContentLength: (await stat(encrypted)).size,
          ContentType: 'application/octet-stream',
        }),
      );
      // Scope retention to this application's prefix only. Never touch unrelated objects.
      let continuation;
      do {
        const listing = await client.send(
          new ListObjectsV2Command({
            Bucket: config.backup.bucket,
            Prefix: 'quad/',
            ContinuationToken: continuation,
          }),
        );
        const expired = listing.Contents?.filter(
          (o) =>
            o.LastModified &&
            o.LastModified.getTime() < Date.now() - 30 * 86400000 &&
            o.Key?.endsWith('.sqlite.enc'),
        ).map((o) => ({ Key: o.Key }));
        if (expired?.length) {
          const deleted = await client.send(
            new DeleteObjectsCommand({
              Bucket: config.backup.bucket,
              Delete: { Objects: expired },
            }),
          );
          if (deleted.Errors?.length) throw new Error('Backup retention deletion failed');
        }
        continuation = listing.IsTruncated ? listing.NextContinuationToken : undefined;
      } while (continuation);
      return { key, completedAt: Date.now() };
    } finally {
      client.destroy();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
export function startBackups(store, config, log) {
  if (!config.backup.bucket)
    return { stop: () => {}, status: () => ({ configured: false, lastSuccess: null }) };
  let active = false,
    lastSuccess = null,
    pending = Promise.resolve();
  const run = async () => {
    if (active) return;
    active = true;
    try {
      const result = await backupOffsite(store.db, config);
      lastSuccess = result.completedAt;
      log.info({ completedAt: lastSuccess }, 'Encrypted offsite backup complete');
    } catch {
      log.error('Offsite backup failed; inspect storage credentials and connectivity');
    } finally {
      active = false;
    }
  };
  const schedule = () => {
    pending = run();
  };
  const first = setTimeout(schedule, 5000),
    timer = setInterval(schedule, 6 * 3600000);
  first.unref();
  timer.unref();
  return {
    stop: async () => {
      clearTimeout(first);
      clearInterval(timer);
      await pending;
    },
    status: () => ({ configured: true, lastSuccess }),
  };
}
