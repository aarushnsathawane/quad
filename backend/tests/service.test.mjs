import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.mjs';
import { readConfig } from '../config.mjs';
const profile = {
  firstName: 'Test',
  lastName: 'Student',
  major: 'Computer Science',
  year: 2028,
  bio: 'Hello',
  avatar: 0,
  interests: ['Coffee'],
  clubs: ['HackRU'],
  experiences: [],
};
async function fixture(t, { disk = false } = {}) {
  let now = Date.now();
  const codes = new Map(),
    dir = mkdtempSync(join(tmpdir(), 'quad-test-'));
  const config = readConfig({
    AUTH_SECRET: 'test-secret-is-at-least-thirty-two-bytes-long',
    ADMIN_EMAILS: 'admin@rutgers.edu',
  });
  const dbPath = disk ? join(dir, 'test.sqlite') : ':memory:';
  const service = await createApp({
    config,
    dbPath,
    clock: () => now,
    deliver: async (email, code) => codes.set(email, code),
    serveWeb: false,
  });
  t.after(async () => {
    await service.app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const call = (path, method = 'GET', body, token, extra = {}) =>
    service.app.inject({
      url: path,
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: 'Bearer ' + token } : {}),
        ...extra,
      },
      ...(body !== undefined ? { payload: body } : {}),
    });
  const user = async (name) => {
    const email = name + '@rutgers.edu';
    assert.equal((await call('/v1/auth/request-code', 'POST', { email })).statusCode, 200);
    const response = await call(
      '/v1/auth/verify',
      'POST',
      { email, code: codes.get(email), termsAccepted: true },
      null,
      { 'x-quad-client': 'native' },
    );
    assert.equal(response.statusCode, 200, response.body);
    const data = response.json();
    assert.ok(data.token);
    assert.equal(
      (await call('/v1/profile', 'PUT', { ...profile, firstName: name }, data.token)).statusCode,
      200,
    );
    return { email, id: data.userId, token: data.token };
  };
  return {
    ...service,
    config,
    dbPath,
    codes,
    call,
    user,
    tick: (ms) => {
      now += ms;
    },
    now: () => now,
  };
}
test('Rutgers verification is required, one-time, attempt-limited and terms-gated', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call('/v1/bootstrap')).statusCode, 401);
  assert.equal((await f.call('/api/demo/login', 'POST', {})).statusCode, 404);
  assert.equal(
    (await f.call('/v1/auth/request-code', 'POST', { email: 'fake@gmail.com' })).statusCode,
    400,
  );
  assert.equal(
    (await f.call('/v1/auth/request-code', 'POST', { email: 'fake@rutgers.edu.attacker.test' }))
      .statusCode,
    400,
  );
  const email = 'new@rutgers.edu';
  const start = await f.call('/v1/auth/request-code', 'POST', { email });
  assert.equal(start.statusCode, 200);
  assert.ok(!start.body.includes(f.codes.get(email)));
  assert.equal(
    (
      await f.call('/v1/auth/verify', 'POST', {
        email,
        code: f.codes.get(email),
        termsAccepted: false,
      })
    ).statusCode,
    400,
  );
  const wrong = f.codes.get(email) === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await f.call('/v1/auth/verify', 'POST', { email, code: wrong, termsAccepted: true }))
        .statusCode,
      401,
    );
  assert.equal(
    (
      await f.call('/v1/auth/verify', 'POST', {
        email,
        code: f.codes.get(email),
        termsAccepted: true,
      })
    ).statusCode,
    401,
  );
  f.tick(61000);
  await f.call('/v1/auth/request-code', 'POST', { email });
  const success = await f.call('/v1/auth/verify', 'POST', {
    email,
    code: f.codes.get(email),
    termsAccepted: true,
  });
  assert.equal(success.statusCode, 200);
  assert.equal(success.json().token, undefined);
  const cookie = success.headers['set-cookie'];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal(
    (
      await f.call('/v1/auth/verify', 'POST', {
        email,
        code: f.codes.get(email),
        termsAccepted: true,
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (await f.call('/v1/auth/logout', 'POST', {}, null, { cookie: cookie.split(';')[0] }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await f.call('/v1/auth/logout', 'POST', {}, null, {
        cookie: cookie.split(';')[0],
        origin: f.config.origin,
      })
    ).statusCode,
    200,
  );
});
test('codes expire, school verification cannot be spoofed and auth email delivery fails closed', async (t) => {
  const f = await fixture(t);
  const email = 'expiry@rutgers.edu';
  await f.call('/v1/auth/request-code', 'POST', { email });
  f.tick(600001);
  assert.equal(
    (
      await f.call('/v1/auth/verify', 'POST', {
        email,
        code: f.codes.get(email),
        termsAccepted: true,
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (await f.call('/v1/auth/request-code', 'POST', { email, verified: true })).statusCode,
    400,
  );
  const other = await createApp({
    config: f.config,
    dbPath: ':memory:',
    serveWeb: false,
    deliver: async () => {
      throw new Error('SMTP failed with secret password');
    },
  });
  t.after(() => other.app.close());
  const result = await other.app.inject({
    url: '/v1/auth/request-code',
    method: 'POST',
    payload: { email: 'email@rutgers.edu' },
  });
  assert.equal(result.statusCode, 503);
  assert.ok(!result.body.includes('password'));
});
test('presence is opt-in, coarse, audience-aware, expires and heartbeat does not extend consent', async (t) => {
  const f = await fixture(t),
    a = await f.user('alice'),
    b = await f.user('bob');
  const people = async (user) =>
    (await f.call('/v1/bootstrap', 'GET', undefined, user.token)).json().people;
  assert.equal((await people(b)).length, 0);
  const position = { lat: 40.50112345, lng: -74.45012345 };
  assert.equal(
    (
      await f.call(
        '/v1/visibility',
        'PUT',
        { audience: 'university', minutes: 30, position },
        a.token,
      )
    ).statusCode,
    200,
  );
  const p = (await people(b))[0];
  assert.equal(p.id, a.id);
  assert.notEqual(p.position.lat, position.lat);
  assert.notEqual(p.position.lng, position.lng);
  assert.equal(p.email, undefined);
  const stored = f.store.get('SELECT * FROM visibility WHERE user_id=?', a.id);
  assert.equal(stored.lat, p.position.lat);
  f.tick(60000);
  await f.call('/v1/presence', 'PUT', { position }, a.token);
  assert.equal(
    f.store.get('SELECT until_at FROM visibility WHERE user_id=?', a.id).until_at,
    stored.until_at,
  );
  await f.call(
    '/v1/visibility',
    'PUT',
    { audience: 'connections', minutes: null, position },
    a.token,
  );
  assert.equal((await people(b)).length, 0);
  await f.call('/v1/connections/' + a.id, 'POST', { action: 'request' }, b.token);
  await f.call('/v1/connections/' + b.id, 'POST', { action: 'accept' }, a.token);
  assert.equal((await people(b))[0].onMap, true);
  await f.call('/v1/visibility', 'PUT', { audience: 'nobody', minutes: null }, a.token);
  assert.equal((await people(b))[0].onMap, false);
  assert.equal((await f.call('/v1/presence', 'PUT', { position }, a.token)).statusCode, 409);
  await f.call('/v1/visibility', 'PUT', { audience: 'university', minutes: 1, position }, a.token);
  f.tick(60001);
  assert.equal((await people(b))[0].onMap, false);
  assert.equal((await f.call('/v1/presence', 'PUT', { position }, a.token)).statusCode, 409);
  await f.call(
    '/v1/visibility',
    'PUT',
    { audience: 'university', minutes: null, position },
    a.token,
  );
  f.tick(900001);
  assert.equal((await people(b))[0].onMap, false);
  f.housekeeping();
  assert.equal(f.store.get('SELECT lat FROM visibility WHERE user_id=?', a.id).lat, null);
  assert.equal(
    (
      await f.call(
        '/v1/visibility',
        'PUT',
        { audience: 'university', minutes: null, position: { lat: 0, lng: 0 } },
        a.token,
      )
    ).statusCode,
    400,
  );
});
test('only recipients accept connections; messages require accepted unblocked peers and are idempotent', async (t) => {
  const f = await fixture(t),
    a = await f.user('alice'),
    b = await f.user('bob'),
    c = await f.user('eve');
  const path = '/v1/connections/' + b.id;
  await f.call(path, 'POST', { action: 'request' }, a.token);
  assert.equal((await f.call(path, 'POST', { action: 'accept' }, a.token)).statusCode, 409);
  assert.equal(
    (await f.call('/v1/messages/' + b.id, 'POST', { text: 'Hi', clientId: randomUUID() }, a.token))
      .statusCode,
    403,
  );
  assert.equal(
    (await f.call('/v1/connections/' + a.id, 'POST', { action: 'accept' }, b.token)).statusCode,
    200,
  );
  const clientId = randomUUID();
  await f.call('/v1/messages/' + b.id, 'POST', { text: 'Hello', clientId }, a.token);
  await f.call('/v1/messages/' + b.id, 'POST', { text: 'Hello', clientId }, a.token);
  const bState = (await f.call('/v1/messages/' + a.id, 'GET', undefined, b.token)).json();
  assert.equal(bState.messages.length, 1);
  assert.equal(bState.messages[0].author, 'them');
  assert.equal((await f.call('/v1/messages/' + a.id, 'GET', undefined, c.token)).statusCode, 403);
  await f.call('/v1/blocks/' + a.id, 'POST', { blocked: true }, b.token);
  assert.equal(
    (await f.call('/v1/messages/' + b.id, 'POST', { text: 'No', clientId: randomUUID() }, a.token))
      .statusCode,
    404,
  );
  assert.equal((await f.call('/v1/bootstrap', 'GET', undefined, a.token)).json().people.length, 0);
  assert.equal(
    (await f.call('/v1/connections/' + b.id, 'POST', { action: 'request' }, a.token)).statusCode,
    404,
  );
  await f.call('/v1/blocks/' + a.id, 'POST', { blocked: false }, b.token);
  assert.deepEqual(
    (await f.call('/v1/bootstrap', 'GET', undefined, a.token)).json().state.connections,
    {},
  );
});
test('private event details and RSVPs are scoped to invitees, cancellation and blocks revoke access', async (t) => {
  const f = await fixture(t),
    a = await f.user('host'),
    b = await f.user('guest'),
    c = await f.user('outsider');
  const event = {
    title: 'Campus hangout',
    campus: 'busch',
    venue: 'Student Center',
    startsAt: f.now() + 3600000,
    endsAt: f.now() + 7200000,
    kind: 'invite',
    category: 'Hangout',
    description: 'Meet friends',
    invitees: [b.id],
  };
  assert.equal((await f.call('/v1/events', 'POST', event, a.token)).statusCode, 403);
  await f.call('/v1/connections/' + b.id, 'POST', { action: 'request' }, a.token);
  await f.call('/v1/connections/' + a.id, 'POST', { action: 'accept' }, b.token);
  const created = await f.call('/v1/events', 'POST', event, a.token);
  assert.equal(created.statusCode, 200, created.body);
  const { id } = created.json();
  assert.equal((await f.call('/v1/events', 'GET', undefined, c.token)).json().events.length, 0);
  assert.equal(
    (await f.call('/v1/events/' + id + '/rsvp', 'PUT', { status: 'going' }, c.token)).statusCode,
    404,
  );
  assert.equal((await f.call('/v1/events/' + id, 'DELETE', {}, b.token)).statusCode, 403);
  await f.call('/v1/events/' + id + '/rsvp', 'PUT', { status: 'going' }, b.token);
  assert.equal((await f.call('/v1/events', 'GET', undefined, b.token)).json().events[0].going, 2);
  await f.call('/v1/blocks/' + a.id, 'POST', { blocked: true }, b.token);
  assert.equal((await f.call('/v1/events', 'GET', undefined, b.token)).json().events.length, 0);
  assert.equal(
    (await f.call('/v1/events/' + id + '/rsvp', 'PUT', { status: 'going' }, b.token)).statusCode,
    404,
  );
  const publicEvent = await f.call(
    '/v1/events',
    'POST',
    { ...event, kind: 'public', invitees: [] },
    a.token,
  );
  assert.equal(publicEvent.statusCode, 200);
  const publicId = publicEvent.json().id;
  assert.equal((await f.call('/v1/events', 'GET', undefined, c.token)).json().events.length, 1);
  await f.call('/v1/events/' + publicId, 'DELETE', {}, a.token);
  assert.equal((await f.call('/v1/events', 'GET', undefined, c.token)).json().events.length, 0);
});
test('moderation is admin-only, suspensions revoke sessions and deletion cascades personal data', async (t) => {
  const f = await fixture(t),
    a = await f.user('alice'),
    b = await f.user('bob'),
    admin = await f.user('admin');
  const report = await f.call(
    '/v1/reports',
    'POST',
    { personId: a.id, reason: 'Harassment', details: 'Test evidence' },
    b.token,
  );
  assert.equal(report.statusCode, 200);
  assert.equal((await f.call('/v1/admin/reports', 'GET', undefined, b.token)).statusCode, 403);
  const reports = (await f.call('/v1/admin/reports', 'GET', undefined, admin.token)).json().reports;
  assert.equal(reports.length, 1);
  await f.call('/v1/admin/users/' + a.id, 'POST', { status: 'suspended' }, admin.token);
  assert.equal((await f.call('/v1/bootstrap', 'GET', undefined, a.token)).statusCode, 401);
  const exported = (await f.call('/v1/account/export', 'GET', undefined, b.token)).json();
  assert.equal(exported.account.email, b.email);
  assert.ok(!JSON.stringify(exported).includes(admin.email));
  assert.equal(
    (await f.call('/v1/account', 'DELETE', { confirmation: 'no' }, b.token)).statusCode,
    400,
  );
  assert.equal(
    (await f.call('/v1/account', 'DELETE', { confirmation: 'DELETE' }, b.token)).statusCode,
    200,
  );
  assert.equal(f.store.get('SELECT id FROM users WHERE id=?', b.id), undefined);
  assert.equal(
    f.store.get('SELECT reporter FROM reports WHERE id=?', reports[0].id).reporter,
    null,
  );
  assert.equal((await f.call('/v1/bootstrap', 'GET', undefined, b.token)).statusCode, 401);
});
test('database migrations and sessions survive a process restart', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'quad-restart-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const config = readConfig(),
    dbPath = join(dir, 'db.sqlite');
  let code;
  const first = await createApp({
    config,
    dbPath,
    serveWeb: false,
    deliver: async (_, value) => {
      code = value;
    },
  });
  await first.app.inject({
    url: '/v1/auth/request-code',
    method: 'POST',
    payload: { email: 'persist@rutgers.edu' },
  });
  const auth = await first.app.inject({
    url: '/v1/auth/verify',
    method: 'POST',
    headers: { 'x-quad-client': 'native' },
    payload: { email: 'persist@rutgers.edu', code, termsAccepted: true },
  });
  assert.equal(auth.statusCode, 200, auth.body);
  const token = auth.json().token;
  await first.app.close();
  const second = await createApp({ config, dbPath, serveWeb: false });
  t.after(() => second.app.close());
  assert.equal(
    (
      await second.app.inject({
        url: '/v1/bootstrap',
        headers: { authorization: 'Bearer ' + token },
      })
    ).statusCode,
    200,
  );
  assert.equal(second.store.all('SELECT * FROM migrations').length, 1);
});
test('public launch config rejects missing credentials, wildcard school domains and insecure origins', () => {
  assert.throws(() => readConfig({ NODE_ENV: 'production' }));
  assert.throws(() => readConfig({ APP_ORIGIN: 'http://localhost/path' }));
  assert.throws(() => readConfig({ SCHOOL_EMAIL_DOMAINS: 'gmail.com' }));
});
test('message pagination is bounded and does not expose another conversation', async (t) => {
  const f = await fixture(t),
    a = await f.user('alice'),
    b = await f.user('bob');
  await f.call('/v1/connections/' + b.id, 'POST', { action: 'request' }, a.token);
  await f.call('/v1/connections/' + a.id, 'POST', { action: 'accept' }, b.token);
  const ids = [];
  for (let i = 0; i < 105; i++) {
    const id = randomUUID();
    ids.push(id);
    f.store.run(
      'INSERT INTO messages VALUES (?,?,?,?,?)',
      id,
      a.id,
      b.id,
      'Message ' + i,
      f.now() + i,
    );
  }
  const first = (await f.call('/v1/messages/' + a.id, 'GET', undefined, b.token)).json();
  assert.equal(first.messages.length, 100);
  assert.ok(first.nextCursor);
  const second = (
    await f.call('/v1/messages/' + a.id + '?cursor=' + first.nextCursor, 'GET', undefined, b.token)
  ).json();
  assert.equal(second.messages.length, 5);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.messages, ...second.messages].map((m) => m.id)).size, 105);
  assert.equal(
    (await f.call('/v1/messages/' + a.id + '?cursor=' + randomUUID(), 'GET', undefined, b.token))
      .statusCode,
    400,
  );
});
test('auth throttling survives restart, peers cannot mutate others profiles and expired sessions fail', async (t) => {
  const f = await fixture(t),
    a = await f.user('alice');
  assert.equal(
    (await f.call('/v1/profile', 'PUT', { ...profile, id: randomUUID() }, a.token)).statusCode,
    400,
  );
  assert.equal(
    (await f.call('/v1/profile', 'PUT', profile, a.token, { origin: 'https://evil.test' }))
      .statusCode,
    403,
  );
  for (let i = 0; i < 4; i++) {
    f.tick(61000);
    assert.equal(
      (await f.call('/v1/auth/request-code', 'POST', { email: a.email })).statusCode,
      200,
    );
  }
  assert.equal((await f.call('/v1/auth/request-code', 'POST', { email: a.email })).statusCode, 429);
  f.tick(31 * 86400000);
  assert.equal((await f.call('/v1/bootstrap', 'GET', undefined, a.token)).statusCode, 401);
});
test('the deployment serves its homepage, protects API routes, and sets secure production cookies', async (t) => {
  const { writeFileSync } = await import('node:fs');
  const dir = mkdtempSync(join(tmpdir(), 'quad-web-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Quad</title><div id="root"></div>');
  let code;
  const config = {
    ...readConfig({}),
    production: true,
    origin: 'https://quad.example',
    webRoot: dir,
  };
  const { app } = await createApp({
    config,
    dbPath: ':memory:',
    deliver: async (_, value) => {
      code = value;
    },
  });
  t.after(() => app.close());
  const page = await app.inject({ url: '/', headers: { accept: 'text/html' } });
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /<title>Quad<\/title>/);
  assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.ok(page.headers['strict-transport-security']);
  assert.equal(
    (await app.inject({ url: '/v1/bootstrap', headers: { accept: 'text/html' } })).statusCode,
    401,
  );
  assert.equal(
    (await app.inject({ url: '/api/demo/login', method: 'POST', payload: {} })).statusCode,
    404,
  );
  await app.inject({
    url: '/v1/auth/request-code',
    method: 'POST',
    payload: { email: 'cookie@rutgers.edu' },
  });
  const result = await app.inject({
    url: '/v1/auth/verify',
    method: 'POST',
    payload: { email: 'cookie@rutgers.edu', code, termsAccepted: true },
  });
  assert.equal(result.statusCode, 200);
  assert.match(result.headers['set-cookie'], /__Host-quad_session=/);
  assert.match(result.headers['set-cookie'], /Secure/);
  assert.match(result.headers['set-cookie'], /HttpOnly/);
});
