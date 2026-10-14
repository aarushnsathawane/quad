import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.js';
import { createApi } from '../server/api.js';

async function fixture(t) {
  const store = createStore();
  const handler = createApi(store);
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => {
    server.closeAllConnections();
    server.close();
    store.db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = async (path, body, method = 'POST', extra = {}) => {
    const res = await fetch(base + '/api/' + path, {
      method: body === undefined ? 'GET' : method,
      headers: { 'Content-Type': 'application/json', Cookie: cookie, ...extra },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
    return { status: res.status, data: await res.json() };
  };
  await request('demo/login', {});
  return { store, request, base };
}
test('discovery returns approximate positions and never private account/location fields', async (t) => {
  const { store, request } = await fixture(t);
  const { data, status } = await request('bootstrap');
  assert.equal(status, 200);
  assert.equal(data.nearby.length, 12);
  assert.equal(data.settings.audience, 'nobody');
  const maya = data.nearby.find((p) => p.id === 'maya');
  assert.match(maya.similarity.text, /HackRU|Formula Racing/);
  assert.equal(maya.position.lat, Math.round(40.5021 / 0.0008) * 0.0008);
  const serialized = JSON.stringify(data);
  for (const field of [
    'university_email',
    'university_verified_at',
    'latitude',
    'longitude',
    'received_at',
  ])
    assert.ok(!serialized.includes(`"${field}"`));
  assert.equal((await request('profiles/maya')).data.position, undefined);
  store.run("UPDATE users SET account_status='suspended' WHERE id='maya'");
  assert.equal((await request('profiles/maya')).status, 404);
});
test('visibility is enforced for ghost, expiry, freshness, audience, university, and blocking', async (t) => {
  const { store, request } = await fixture(t);
  const has = async () => (await request('bootstrap')).data.nearby.some((p) => p.id === 'maya');
  assert.equal(await has(), true);
  store.run("UPDATE visibility_settings SET audience='nobody' WHERE user_id='maya'");
  assert.equal(await has(), false);
  store.run(
    "UPDATE visibility_settings SET audience='university',visible_until='2000-01-01T00:00:00.000Z' WHERE user_id='maya'",
  );
  assert.equal(await has(), false);
  store.run("UPDATE visibility_settings SET visible_until=NULL WHERE user_id='maya'");
  store.run(
    "UPDATE user_locations SET received_at='2000-01-01T00:00:00.000Z' WHERE user_id='maya'",
  );
  assert.equal(await has(), false);
  store.refreshDemo();
  store.run("UPDATE visibility_settings SET audience='connections' WHERE user_id='maya'");
  assert.equal(await has(), false);
  store.run(
    "INSERT INTO connections (user_low_id,user_high_id,requested_by,status) VALUES ('maya','you','maya','accepted')",
  );
  assert.equal(await has(), true);
  store.run("INSERT INTO blocks (blocker_id,blocked_id) VALUES ('maya','you')");
  assert.equal(await has(), false);
  assert.equal((await request('profiles/maya')).status, 404);
  store.run("DELETE FROM blocks WHERE blocker_id='maya'");
  store.run("INSERT INTO universities VALUES ('other','Other University','[]')");
  store.run("UPDATE users SET university_id='other' WHERE id='maya'");
  assert.equal(await has(), false);
});
test('connection request lifecycle prevents self, duplicate, and sender acceptance', async (t) => {
  const { request } = await fixture(t);
  assert.equal((await request('connections', { userId: 'you', action: 'request' })).status, 404);
  assert.equal((await request('connections', { userId: 'maya', action: 'request' })).status, 200);
  assert.equal((await request('connections', { userId: 'maya', action: 'request' })).status, 409);
  assert.equal((await request('connections', { userId: 'maya', action: 'accept' })).status, 409);
  assert.equal((await request('connections', { userId: 'jordan', action: 'accept' })).status, 200);
  assert.equal((await request('profiles/jordan')).data.relationship, 'connected');
  await request('connections', { userId: 'maya', action: 'remove' });
  assert.equal((await request('profiles/maya')).data.relationship, 'none');
});
test('blocking removes connections and discovery; unblocking does not restore a connection', async (t) => {
  const { request } = await fixture(t);
  assert.equal((await request('profiles/sam')).data.relationship, 'connected');
  await request('blocks', { userId: 'sam', action: 'block' });
  assert.equal((await request('profiles/sam')).status, 404);
  assert.equal((await request('connections', { userId: 'sam', action: 'request' })).status, 404);
  let data = (await request('bootstrap')).data;
  assert.ok(!data.nearby.some((p) => p.id === 'sam'));
  assert.ok(!data.connections.some((p) => p.id === 'sam'));
  await request('blocks', { userId: 'sam', action: 'unblock' });
  assert.equal((await request('profiles/sam')).data.relationship, 'none');
});
test('ghost mode deletes stored position and rejects new updates; expiry requires a future timestamp', async (t) => {
  const { store, request } = await fixture(t);
  assert.equal((await request('demo/presence', {})).status, 409);
  assert.equal(
    (await request('visibility', { audience: 'university', visibleUntil: 'invalid' }, 'PUT'))
      .status,
    400,
  );
  assert.equal(
    (await request('visibility', { audience: 'university', visibleUntil: '2000-01-01' }, 'PUT'))
      .status,
    400,
  );
  await request('visibility', { audience: 'university', visibleUntil: null }, 'PUT');
  await request('demo/presence', {});
  assert.ok(store.get("SELECT * FROM user_locations WHERE user_id='you'"));
  await request('visibility', { audience: 'nobody', visibleUntil: null }, 'PUT');
  assert.equal(store.get("SELECT * FROM user_locations WHERE user_id='you'"), undefined);
  assert.equal(
    (await request('location', { latitude: 40, longitude: -74, accuracy: 10 }, 'PUT')).status,
    409,
  );
});
test('profile edits are atomic and social URLs are restricted to intended platforms', async (t) => {
  const { request } = await fixture(t);
  const me = (await request('bootstrap')).data.me;
  const body = {
    firstName: 'Taylor',
    lastName: me.lastName,
    majorId: me.majorId,
    graduationYear: 2029,
    bio: 'Hello campus',
    tagIds: ['t0', 't5'],
    organizationIds: ['hackru'],
    instagramUrl: 'https://instagram.com/taylor',
    linkedinUrl: '',
    experiences: [],
  };
  assert.equal((await request('profile', body, 'PUT')).status, 200);
  assert.equal((await request('bootstrap')).data.me.firstName, 'Taylor');
  assert.equal(
    (await request('profile', { ...body, firstName: 'Changed', tagIds: ['unknown'] }, 'PUT'))
      .status,
    400,
  );
  assert.equal((await request('bootstrap')).data.me.firstName, 'Taylor');
  assert.equal(
    (await request('profile', { ...body, instagramUrl: 'javascript:alert(1)' }, 'PUT')).status,
    400,
  );
  assert.equal(
    (
      await request(
        'profile',
        { ...body, instagramUrl: 'https://instagram.com.evil.example' },
        'PUT',
      )
    ).status,
    400,
  );
});
test('reports are stored privately and cross-origin writes are rejected', async (t) => {
  const { store, request } = await fixture(t);
  assert.equal(
    (await request('reports', { userId: 'maya', reason: 'Harassment', details: 'Test report' }))
      .status,
    201,
  );
  assert.equal(store.get('SELECT COUNT(*) AS n FROM reports').n, 1);
  assert.ok(!JSON.stringify((await request('bootstrap')).data).includes('Test report'));
  assert.equal(
    (
      await request('visibility', { audience: 'nobody', visibleUntil: null }, 'PUT', {
        Origin: 'https://example.com',
      })
    ).status,
    403,
  );
  await request('logout', {});
  assert.equal((await request('bootstrap')).status, 401);
});
test('SQLite data survives reopening the database', () => {
  const dir = mkdtempSync(join(tmpdir(), 'quad-test-'));
  const file = join(dir, 'quad.sqlite');
  let store;
  try {
    store = createStore(file);
    store.run("UPDATE profiles SET bio='Persisted profile' WHERE user_id='you'");
    store.db.close();
    store = createStore(file);
    assert.equal(store.profile('you', 'you').bio, 'Persisted profile');
    store.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('demo presence is restored after cleanup without refreshing the viewer or changing profiles', async (t) => {
  const { store, request } = await fixture(t);
  store.run("UPDATE profiles SET bio='Keep my edits' WHERE user_id='you'");
  store.run("DELETE FROM user_locations WHERE user_id<>'you'");
  store.run(
    'INSERT INTO user_locations VALUES (?,?,?,?,?)',
    'you',
    40.5,
    -74.4,
    10,
    '2000-01-01T00:00:00.000Z',
  );
  assert.equal(store.nearby('you').length, 0);
  store.refreshDemo();
  assert.equal(store.nearby('you').length, 12);
  assert.equal(
    store.get("SELECT received_at FROM user_locations WHERE user_id='you'").received_at,
    '2000-01-01T00:00:00.000Z',
  );
  assert.equal((await request('bootstrap')).data.me.bio, 'Keep my edits');
});
