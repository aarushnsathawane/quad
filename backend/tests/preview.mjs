// Test-only, loopback-only capture transport. Not copied into the production image.
// This is a QA harness, never a production login path or a real email transport.
import { writeFile } from 'node:fs/promises';
import { createApp } from '../app.mjs';
import { readConfig } from '../config.mjs';
if (process.env.NODE_ENV === 'production' || process.env.QUAD_ALLOW_TEST_MAIL_CAPTURE !== '1')
  throw new Error('Explicit local QA capture opt-in required');
const config = readConfig({
  ...process.env,
  NODE_ENV: 'development',
  APP_ORIGIN: 'http://localhost:8080',
  ADMIN_EMAILS: 'qa.admin@rutgers.edu',
  SUPPORT_EMAIL: 'support@example.test',
});
const codes = {};
const { app } = await createApp({
  config,
  dbPath: ':memory:',
  deliver: async (email, code) => {
    codes[email] = code;
    await writeFile('/private/tmp/quad-qa-mail.json', JSON.stringify(codes), { mode: 0o600 });
  },
});
await app.listen({ host: '127.0.0.1', port: 8080 });
console.log(
  'Local QA only: synthetic accounts and captured verification emails. Do not use real student data.',
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
