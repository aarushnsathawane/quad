const origin = process.argv[2];
if (!origin?.startsWith('https://'))
  throw new Error('Usage: node scripts/smoke-live.mjs https://your-app.example');
const call = async (path) =>
  fetch(new URL(path, origin), { redirect: 'error', signal: AbortSignal.timeout(20000) });
const health = await call('/healthz');
if (!health.ok) throw new Error('Health check failed');
if (!health.headers.get('strict-transport-security')) throw new Error('HSTS missing');
const boot = await call('/v1/bootstrap');
if (boot.status !== 401) throw new Error('Unauthenticated campus access must be denied');
const demo = await fetch(new URL('/api/demo/login', origin), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: new URL(origin).origin },
  body: '{}',
  signal: AbortSignal.timeout(20000),
});
if (demo.status !== 404) throw new Error('Legacy demo login must not be exposed');
const page = await fetch(origin, {
  headers: { Accept: 'text/html' },
  signal: AbortSignal.timeout(20000),
});
if (!page.ok || !page.headers.get('content-security-policy'))
  throw new Error('Web app or CSP missing');
for (const route of ['/privacy', '/terms'])
  if (!(await call(route)).ok) throw new Error(route + ' unavailable');
const ready = await call('/readyz'),
  result = await ready.json();
if (!result.backup?.lastSuccess)
  throw new Error('No successful encrypted offsite backup recorded yet');
console.log(
  'Public endpoint, authorization, demo exclusion, policies, headers, and backup status passed. Still test a real school inbox, two accounts, foreground location, and target devices before launch.',
);
