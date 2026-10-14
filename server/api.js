import { randomUUID } from 'node:crypto';
import { CAMPUS } from './store.js';
const fail = (status, message) => Object.assign(new Error(message), { status });
const text = (v, max, required = false) => {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim()))
    throw fail(
      400,
      `Please enter ${required ? 'a nonempty value' : 'text'} of at most ${max} characters.`,
    );
  return v.trim();
};
const readBody = async (req) => {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32_000) throw fail(413, 'Request too large.');
  }
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw fail(400, 'Invalid JSON.');
  }
};
export function createApi(store) {
  const sessions = new Map();
  const { get, all, run, transaction, profile, eligible, relationship, pair } = store;
  return async function api(req, res) {
    if (!req.url.startsWith('/api/')) return false;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, value) => {
      res.writeHead(status);
      res.end(JSON.stringify(value));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      const method = req.method;
      if (!['GET', 'HEAD'].includes(method)) {
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
          throw fail(403, 'Unrecognized origin.');
        if (!req.headers['content-type']?.startsWith('application/json'))
          throw fail(415, 'JSON requests required.');
      }
      if (path === '/api/demo/login' && method === 'POST') {
        const token = randomUUID();
        sessions.set(token, { userId: 'you', expires: Date.now() + 86400000 });
        res.setHeader(
          'Set-Cookie',
          `quad_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`,
        );
        store.refreshDemo();
        send(200, { ok: true });
        return true;
      }
      const token = req.headers.cookie
        ?.split('; ')
        .find((v) => v.startsWith('quad_session='))
        ?.split('=')[1];
      const session = sessions.get(token);
      if (!session || session.expires < Date.now()) throw fail(401, 'Open the demo to continue.');
      const me = session.userId;
      if (!eligible(me, me)) throw fail(403, 'This account cannot access campus discovery.');
      if (path === '/api/bootstrap' && method === 'GET') {
        const peers = all('SELECT id FROM users WHERE id<>?', me)
          .map((x) => profile(x.id, me))
          .filter(Boolean);
        const settings = get(
          'SELECT audience,visible_until AS visibleUntil FROM visibility_settings WHERE user_id=?',
          me,
        );
        const loc = get('SELECT received_at FROM user_locations WHERE user_id=?', me);
        send(200, {
          me: profile(me, me),
          nearby: store.nearby(me),
          connections: peers.filter((p) => p.relationship !== 'none'),
          settings,
          catalog: {
            tags: all('SELECT * FROM tags ORDER BY name'),
            organizations: all('SELECT * FROM organizations ORDER BY name'),
            majors: all('SELECT * FROM academic_programs ORDER BY name'),
          },
          blocked: all(
            'SELECT b.blocked_id AS id,p.first_name AS firstName,p.last_name AS lastName FROM blocks b JOIN profiles p ON p.user_id=b.blocked_id WHERE b.blocker_id=?',
            me,
          ),
          demo: true,
          campus: CAMPUS,
          locationFreshUntil: loc
            ? new Date(Date.parse(loc.received_at) + 900000).toISOString()
            : null,
        });
        return true;
      }
      if (path.startsWith('/api/profiles/') && method === 'GET') {
        const p = profile(decodeURIComponent(path.split('/')[3]), me);
        if (!p) throw fail(404, 'Profile unavailable.');
        send(200, p);
        return true;
      }
      const body = await readBody(req);
      if (path === '/api/profile' && method === 'PUT') {
        const first = text(body.firstName, 40, true),
          last = text(body.lastName, 40, true),
          bio = text(body.bio, 240);
        const uni = get('SELECT university_id FROM users WHERE id=?', me).university_id;
        if (
          !get('SELECT 1 FROM academic_programs WHERE id=? AND university_id=?', body.majorId, uni)
        )
          throw fail(400, 'Choose a valid major.');
        const year = body.graduationYear === null ? null : Number(body.graduationYear);
        if (year !== null && (!Number.isInteger(year) || year < 2020 || year > 2040))
          throw fail(400, 'Choose a graduation year between 2020 and 2040.');
        const validateIds = (ids, table, max) => {
          if (
            !Array.isArray(ids) ||
            ids.length > max ||
            new Set(ids).size !== ids.length ||
            ids.some(
              (id) => typeof id !== 'string' || !get(`SELECT 1 FROM ${table} WHERE id=?`, id),
            )
          )
            throw fail(400, 'Choose valid, unique profile selections.');
        };
        validateIds(body.tagIds, 'tags', 8);
        validateIds(body.organizationIds, 'organizations', 6);
        if (
          body.organizationIds.some(
            (id) => !get('SELECT 1 FROM organizations WHERE id=? AND university_id=?', id, uni),
          )
        )
          throw fail(400, 'Choose organizations at your university.');
        const social = (value, domain) => {
          if (!value) return null;
          const input = text(value, 250);
          let u;
          try {
            u = new URL(input);
          } catch {
            throw fail(400, `Enter a full https://${domain} URL.`);
          }
          if (
            u.protocol !== 'https:' ||
            ![domain, `www.${domain}`].includes(u.hostname) ||
            u.username ||
            u.password
          )
            throw fail(400, `Use an https://${domain} link.`);
          return u.href;
        };
        const instagram = social(body.instagramUrl, 'instagram.com'),
          linkedin = social(body.linkedinUrl, 'linkedin.com');
        if (!Array.isArray(body.experiences) || body.experiences.length > 5)
          throw fail(400, 'Add up to five experiences.');
        const experiences = body.experiences.map((e) => ({
          title: text(e.title, 80, true),
          organization: text(e.organization_name, 80),
          time: text(e.time_label, 40),
          description: text(e.description, 240),
        }));
        transaction(() => {
          run(
            'UPDATE profiles SET first_name=?,last_name=?,major_program_id=?,graduation_year=?,bio=?,instagram_url=?,linkedin_url=?,updated_at=? WHERE user_id=?',
            first,
            last,
            body.majorId,
            year,
            bio,
            instagram,
            linkedin,
            new Date().toISOString(),
            me,
          );
          run('DELETE FROM profile_tags WHERE user_id=?', me);
          body.tagIds.forEach((id) =>
            run('INSERT INTO profile_tags (user_id,tag_id) VALUES (?,?)', me, id),
          );
          run('DELETE FROM profile_organizations WHERE user_id=?', me);
          body.organizationIds.forEach((id) =>
            run('INSERT INTO profile_organizations VALUES (?,?)', me, id),
          );
          run('DELETE FROM experiences WHERE user_id=?', me);
          experiences.forEach((e, i) =>
            run(
              'INSERT INTO experiences (id,user_id,title,organization_name,time_label,description,sort_order) VALUES (?,?,?,?,?,?,?)',
              randomUUID(),
              me,
              e.title,
              e.organization,
              e.time,
              e.description,
              i,
            ),
          );
        });
        send(200, { ok: true });
        return true;
      }
      if (path === '/api/visibility' && method === 'PUT') {
        if (!['university', 'connections', 'nobody'].includes(body.audience))
          throw fail(400, 'Choose a valid audience.');
        let until = null;
        if (body.visibleUntil !== null && body.audience !== 'nobody') {
          if (
            typeof body.visibleUntil !== 'string' ||
            !Number.isFinite(Date.parse(body.visibleUntil)) ||
            Date.parse(body.visibleUntil) <= Date.now()
          )
            throw fail(400, 'Choose a future expiry time.');
          until = new Date(body.visibleUntil).toISOString();
        }
        transaction(() => {
          run(
            'UPDATE visibility_settings SET audience=?,visible_until=?,updated_at=? WHERE user_id=?',
            body.audience,
            until,
            new Date().toISOString(),
            me,
          );
          if (body.audience === 'nobody') run('DELETE FROM user_locations WHERE user_id=?', me);
        });
        send(200, { ok: true });
        return true;
      }
      if (path === '/api/location' && method === 'PUT') {
        const { latitude, longitude, accuracy } = body;
        if (
          !Number.isFinite(latitude) ||
          latitude < -90 ||
          latitude > 90 ||
          !Number.isFinite(longitude) ||
          longitude < -180 ||
          longitude > 180 ||
          !Number.isFinite(accuracy) ||
          accuracy < 0
        )
          throw fail(400, 'Invalid location.');
        const v = get('SELECT * FROM visibility_settings WHERE user_id=?', me);
        if (
          v.audience === 'nobody' ||
          (v.visible_until && Date.parse(v.visible_until) <= Date.now())
        )
          throw fail(409, 'Enable visibility before sharing your location.');
        run(
          'INSERT INTO user_locations VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,accuracy_meters=excluded.accuracy_meters,received_at=excluded.received_at',
          me,
          latitude,
          longitude,
          accuracy,
          new Date().toISOString(),
        );
        send(200, { ok: true });
        return true;
      }
      if (path === '/api/demo/presence' && method === 'POST') {
        const v = get('SELECT * FROM visibility_settings WHERE user_id=?', me);
        if (
          v.audience === 'nobody' ||
          (v.visible_until && Date.parse(v.visible_until) <= Date.now())
        )
          throw fail(409, 'Choose visibility first.');
        run(
          'INSERT INTO user_locations VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,accuracy_meters=excluded.accuracy_meters,received_at=excluded.received_at',
          me,
          CAMPUS.lat,
          CAMPUS.lng,
          100,
          new Date().toISOString(),
        );
        send(200, { ok: true });
        return true;
      }
      if (path === '/api/connections' && method === 'POST') {
        const target = body.userId;
        if (typeof target !== 'string' || target === me || !eligible(target, me))
          throw fail(404, 'This person is unavailable.');
        const r = relationship(me, target),
          ids = pair(me, target);
        if (body.action === 'request') {
          if (r) throw fail(409, 'A request or connection already exists.');
          run(
            "INSERT INTO connections (user_low_id,user_high_id,requested_by,status) VALUES (?,?,?,'pending')",
            ...ids,
            me,
          );
        } else if (body.action === 'accept') {
          if (!r || r.status !== 'pending' || r.requested_by === me)
            throw fail(409, 'No incoming request to accept.');
          run(
            "UPDATE connections SET status='accepted',accepted_at=? WHERE user_low_id=? AND user_high_id=?",
            new Date().toISOString(),
            ...ids,
          );
        } else if (body.action === 'remove')
          run('DELETE FROM connections WHERE user_low_id=? AND user_high_id=?', ...ids);
        else throw fail(400, 'Unknown connection action.');
        send(200, { ok: true });
        return true;
      }
      if (path === '/api/blocks' && method === 'POST') {
        const target = body.userId;
        if (
          typeof target !== 'string' ||
          target === me ||
          !get('SELECT 1 FROM users WHERE id=?', target)
        )
          throw fail(400, 'Invalid user.');
        transaction(() => {
          if (body.action === 'unblock')
            run('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?', me, target);
          else if (body.action === 'block') {
            run('INSERT OR IGNORE INTO blocks (blocker_id,blocked_id) VALUES (?,?)', me, target);
            run(
              'DELETE FROM connections WHERE user_low_id=? AND user_high_id=?',
              ...pair(me, target),
            );
          } else throw fail(400, 'Unknown block action.');
        });
        send(200, { ok: true });
        return true;
      }
      if (path === '/api/reports' && method === 'POST') {
        if (
          ![
            'Harassment',
            'Impersonation',
            'Inappropriate profile',
            'Safety concern',
            'Other',
          ].includes(body.reason) ||
          body.userId === me ||
          typeof body.userId !== 'string' ||
          !get('SELECT 1 FROM users WHERE id=?', body.userId)
        )
          throw fail(400, 'Choose a person and a report reason.');
        run(
          'INSERT INTO reports (id,reporter_id,reported_user_id,reason,details) VALUES (?,?,?,?,?)',
          randomUUID(),
          me,
          body.userId,
          body.reason,
          text(body.details ?? '', 1000),
        );
        send(201, { ok: true });
        return true;
      }
      if (path === '/api/logout' && method === 'POST') {
        sessions.delete(token);
        res.setHeader('Set-Cookie', 'quad_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        send(200, { ok: true });
        return true;
      }
      throw fail(404, 'Not found.');
    } catch (e) {
      if (!e.status) console.error(e);
      send(e.status || 500, {
        error: e.status ? e.message : 'Something went wrong. Please try again.',
      });
    }
    return true;
  };
}
