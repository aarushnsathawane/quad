import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createStore } from './store.js';
import { createApi } from './api.js';

const store = createStore(process.env.QUAD_DB || './data/quad.sqlite');
store.refreshDemo();
const api = createApi(store);
const dev = process.argv.includes('--dev');
const vite = dev
  ? await (await import('vite')).createServer({ server: { middlewareMode: true }, appType: 'spa' })
  : null;
const root = resolve('dist');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
const server = http.createServer(async (req, res) => {
  const host = req.headers.host?.split(':')[0];
  if (!['localhost', '127.0.0.1'].includes(host)) {
    res.writeHead(403);
    res.end('Local preview only.');
    return;
  }
  if (await api(req, res)) return;
  if (vite) {
    vite.middlewares(req, res);
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      if (!(await stat(file)).isFile()) file = resolve(root, 'index.html');
    } catch {
      file = resolve(root, 'index.html');
    }
    const data = await readFile(file);
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(data);
  } catch {
    res.writeHead(503);
    res.end('Build Quad first: npm run build');
  }
});
server.listen(Number(process.env.PORT || 5173), '127.0.0.1', () =>
  console.log(`Quad preview: http://localhost:${server.address().port}`),
);
const cleanup = setInterval(() => {
  store.run(
    'DELETE FROM user_locations WHERE received_at<?',
    new Date(Date.now() - 900000).toISOString(),
  );
  // Refresh fictional students for a useful demo; no real user presence is refreshed.
  store.refreshDemo();
}, 60000);
cleanup.unref();
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, async () => {
    clearInterval(cleanup);
    await vite?.close();
    server.close(() => {
      store.db.close();
      process.exit(0);
    });
  });
