import { spawnSync } from 'node:child_process';
// Never inherit preview configuration into a deployable web bundle.
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['expo', 'export', '--platform', 'web'],
  {
    cwd: new URL('../apps/mobile/', import.meta.url),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      EXPO_PUBLIC_DEMO_MODE: 'false',
      EXPO_PUBLIC_API_URL: '',
      CI: '1',
    },
  },
);
process.exit(result.status ?? 1);
