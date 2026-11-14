import { startBackups } from './backup.mjs';
import { readConfig } from './config.mjs';
import { createApp } from './app.mjs';
process.umask(0o077);
const config = readConfig();
const { app, store } = await createApp({
  config,
  logger: {
    level: 'info',
    redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
  },
});
const backups = startBackups(store, config, app.log);
app.get('/readyz', async () => ({ ok: true, backup: backups.status() }));
await app.listen({ host: config.host, port: config.port });
for (const signal of ['SIGTERM', 'SIGINT'])
  process.once(signal, async () => {
    backups.stop();
    await app.close();
    process.exit(0);
  });
