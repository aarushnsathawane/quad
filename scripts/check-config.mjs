import { readConfig } from '../backend/config.mjs';
readConfig({ ...process.env, NODE_ENV: 'production' });
console.log(
  'Production configuration passed. Secret values were not printed. This does not verify external delivery or bucket access.',
);
