import Fastify, { LogController } from 'fastify';
import { policyHtml } from './policies.mjs';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { existsSync } from 'node:fs';
import { openDatabase } from './database.mjs';
import { readConfig } from './config.mjs';
import { createMailer } from './mail.mjs';
import {
  parse,
  emailSchema,
  verifySchema,
  profileSchema,
  visibilitySchema,
  eventSchema,
  messageSchema,
  reportSchema,
  emptyProfile,
} from './validation.mjs';
import { z } from 'zod';
const fail = (code, message) => {
  throw Object.assign(new Error(message), { statusCode: code });
};
const hash = (value) => createHash('sha256').update(value).digest('hex');
const pair = (a, b) => [a, b].sort();
const FRESH = 15 * 60 * 1000,
  SESSION = 30 * 86400000;
export async function createApp({
  config = readConfig(),
  deliver = createMailer(config),
  clock = Date.now,
  dbPath = config.dbPath,
  serveWeb = true,
  logger = false,
} = {}) {
  const store = openDatabase(dbPath),
    { get, all, run, transaction } = store;
  const cookieName = config.production ? '__Host-quad_session' : 'quad_session';
  const app = Fastify({
    logger,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 32768,
    trustProxy: config.trustProxy,
    requestTimeout: 20000,
    routerOptions: { maxParamLength: 100 },
  });
  await app.register(cookie);
  await app.register(cors, {
    origin: config.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Quad-Client'],
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.production ? [] : null,
      },
    },
    hsts: config.production ? { maxAge: 31536000, includeSubDomains: true } : false,
  });
  await app.register(rateLimit, {
    max: 180,
    timeWindow: '1 minute',
    cache: 10000,
    keyGenerator: (req) => {
      const token =
        req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1] ||
        req.cookies[cookieName];
      const session = token
        ? get('SELECT user_id FROM sessions WHERE digest=? AND expires_at>?', hash(token), clock())
        : null;
      return session ? 'user:' + session.user_id : 'ip:' + req.ip;
    },
  });
  app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500)
      req.log.error({ requestId: req.id, error: err.name, code: err.code }, 'Request failed');
    reply.code(status).send({
      error: status === 500 ? 'Something went wrong. Please try again.' : err.message,
      requestId: req.id,
    });
  });
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/v1/')) {
      reply.header('Cache-Control', 'no-store');
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        if (req.headers.origin && req.headers.origin !== config.origin)
          fail(403, 'Unrecognized origin');
        if (!req.headers['content-type']?.startsWith('application/json'))
          fail(415, 'JSON required');
        if (
          req.cookies[cookieName] &&
          !req.headers.authorization &&
          req.headers.origin !== config.origin
        )
          fail(403, 'Origin required');
      }
    }
  });
  const schoolEmail = (value) => config.domains.includes(value.split('@')[1]);
  const codeDigest = (email, code, nonce) =>
    createHmac('sha256', config.secret).update(`${email}:${nonce}:${code}`).digest('hex');
  const throttle = (key, max, window) => {
    const now = clock(),
      entry = get('SELECT * FROM throttle WHERE key=?', key);
    if (entry && entry.reset_at > now) {
      if (entry.count >= max) fail(429, 'Too many attempts. Please try again later.');
      run('UPDATE throttle SET count=count+1 WHERE key=?', key);
    } else
      run(
        'INSERT INTO throttle VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,reset_at=excluded.reset_at',
        key,
        now + window,
      );
  };
  const blocked = (a, b) =>
    !!get(
      'SELECT 1 FROM blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)',
      a,
      b,
      b,
      a,
    );
  const connected = (a, b) => {
    const [low, high] = pair(a, b);
    return !!get(
      "SELECT 1 FROM connections WHERE low_id=? AND high_id=? AND status='connected'",
      low,
      high,
    );
  };
  const peer = (me, id) => {
    const user = get("SELECT * FROM users WHERE id=? AND status='active' AND onboarded=1", id);
    if (!user || id === me || blocked(me, id)) fail(404, 'Student unavailable');
    return user;
  };
  const authenticate = async (req) => {
    const bearer = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    const token = bearer || req.cookies[cookieName];
    if (!token || token.length !== 43) fail(401, 'Sign in to continue');
    const session = get(
      "SELECT s.*,u.email,u.profile,u.onboarded FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.digest=? AND s.expires_at>? AND u.status='active'",
      hash(token),
      clock(),
    );
    if (!session) fail(401, 'Session expired. Sign in again.');
    req.user = {
      id: session.user_id,
      email: session.email,
      profile: JSON.parse(session.profile),
      onboarded: !!session.onboarded,
    };
    req.sessionDigest = hash(token);
  };
  const member = async (req) => {
    await authenticate(req);
    if (!req.user.onboarded) fail(403, 'Complete your basic profile first');
  };
  const administrator = async (req) => {
    await member(req);
    if (!config.adminEmails.includes(req.user.email)) fail(403, 'Administrator access required');
  };
  const audit = (actor, action, subject) =>
    run('INSERT INTO audit VALUES (?,?,?,?,?)', randomUUID(), actor, action, subject, clock());
  const canSeeEvent = (me, event) =>
    !!event &&
    !event.cancelled &&
    !!get("SELECT 1 FROM users WHERE id=? AND status='active'", event.host) &&
    !blocked(me, event.host) &&
    (event.kind === 'public' ||
      event.host === me ||
      !!get('SELECT 1 FROM invites WHERE event_id=? AND user_id=?', event.id, me));
  const eventFor = (me, id) => {
    const event = get('SELECT * FROM events WHERE id=?', id);
    if (!canSeeEvent(me, event)) fail(404, 'Linkup unavailable');
    return event;
  };
  const bootstrap = (user) => {
    const me = user.id,
      now = clock(),
      settings = get('SELECT * FROM visibility WHERE user_id=?', me);
    const links = all('SELECT * FROM connections WHERE low_id=? OR high_id=?', me, me);
    const connections = {};
    for (const c of links) {
      const id = c.low_id === me ? c.high_id : c.low_id;
      if (blocked(me, id) || !get("SELECT 1 FROM users WHERE id=? AND status='active'", id))
        continue;
      connections[id] =
        c.status === 'connected' ? 'connected' : c.initiator === me ? 'outgoing' : 'incoming';
    }
    const candidates = all(
      "SELECT u.id,u.profile,v.audience,v.until_at,v.lat,v.lng,v.updated_at FROM users u LEFT JOIN visibility v ON v.user_id=u.id WHERE u.id<>? AND u.status='active' AND u.onboarded=1 AND (EXISTS(SELECT 1 FROM connections c WHERE (c.low_id=? AND c.high_id=u.id) OR (c.high_id=? AND c.low_id=u.id)) OR (v.audience<>'nobody' AND v.updated_at>? AND (v.until_at IS NULL OR v.until_at>?))) ORDER BY u.id LIMIT 500",
      me,
      me,
      me,
      now - FRESH,
      now,
    );
    const people = [];
    for (const p of candidates) {
      if (blocked(me, p.id)) continue;
      const onMap =
        !!p.updated_at &&
        p.updated_at > now - FRESH &&
        (p.until_at === null || p.until_at > now) &&
        p.audience !== 'nobody' &&
        (p.audience === 'university' || connections[p.id] === 'connected') &&
        p.lat !== null;
      if (!onMap && !connections[p.id]) continue;
      people.push({
        ...JSON.parse(p.profile),
        id: p.id,
        onMap,
        presenceExpiresAt: onMap ? Math.min(p.updated_at + FRESH, p.until_at ?? Infinity) : null,
        position: onMap ? { lat: p.lat, lng: p.lng } : { lat: 0, lng: 0 },
        sampleConnections: [],
      });
    }
    const messages = {};
    return {
      userId: me,
      admin: config.adminEmails.includes(user.email),
      people,
      state: {
        version: 1,
        entered: !!user.onboarded,
        me: JSON.parse(get('SELECT profile FROM users WHERE id=?', me).profile),
        connections,
        blocked: all('SELECT blocked FROM blocks WHERE blocker=?', me).map((b) => b.blocked),
        reports: [],
        messages,
        visibility: {
          audience: settings?.audience || 'nobody',
          until: settings?.until_at ?? null,
          presenceUpdatedAt: settings?.updated_at ?? null,
        },
      },
    };
  };
  for (const kind of ['privacy', 'terms'])
    app.get('/' + kind, async (_req, reply) =>
      reply.type('text/html; charset=utf-8').send(policyHtml(kind, config)),
    );
  app.get('/healthz', async () => {
    get('SELECT 1');
    return { ok: true };
  });
  app.get('/v1/config', async () => ({
    school: 'Rutgers University',
    domains: config.domains,
    supportEmail: config.supportEmail,
    mapTileUrl: config.tiles || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    mapAttribution: config.tileAttribution || '© OpenStreetMap contributors',
  }));
  app.post(
    '/v1/auth/request-code',
    {
      config: { rateLimit: { max: 100, timeWindow: '10 minutes', keyGenerator: (req) => req.ip } },
    },
    async (req, reply) => {
      const { email } = parse(emailSchema, req.body);
      if (!schoolEmail(email)) fail(400, 'Use your Rutgers school email');
      throttle('request:' + hash(email), 5, 3600000);
      const previous = get('SELECT issued_at FROM login_codes WHERE email=?', email);
      if (previous && previous.issued_at > clock() - 60000)
        fail(429, 'Wait one minute before requesting another code');
      const code = String(randomInt(0, 1000000)).padStart(6, '0'),
        nonce = randomBytes(16).toString('hex');
      run(
        'INSERT INTO login_codes VALUES (?,?,?,?,?,0) ON CONFLICT(email) DO UPDATE SET nonce=excluded.nonce,digest=excluded.digest,expires_at=excluded.expires_at,issued_at=excluded.issued_at,attempts=0',
        email,
        nonce,
        codeDigest(email, code, nonce),
        clock() + 600000,
        clock(),
      );
      try {
        await deliver(email, code);
      } catch {
        run('DELETE FROM login_codes WHERE email=? AND nonce=?', email, nonce);
        return reply
          .code(503)
          .send({ error: 'Verification email could not be sent. Please try again later.' });
      }
      return { ok: true };
    },
  );
  app.post(
    '/v1/auth/verify',
    {
      config: { rateLimit: { max: 200, timeWindow: '10 minutes', keyGenerator: (req) => req.ip } },
    },
    async (req, reply) => {
      const { email, code } = parse(verifySchema, req.body);
      if (!schoolEmail(email)) fail(400, 'Use your Rutgers school email');
      const c = get('SELECT * FROM login_codes WHERE email=?', email);
      if (!c || c.expires_at <= clock() || c.attempts >= 5) fail(401, 'Code is invalid or expired');
      run('UPDATE login_codes SET attempts=attempts+1 WHERE email=?', email);
      if (
        !timingSafeEqual(
          Buffer.from(c.digest, 'hex'),
          Buffer.from(codeDigest(email, code, c.nonce), 'hex'),
        )
      )
        fail(401, 'Code is invalid or expired');
      const token = randomBytes(32).toString('base64url'),
        now = clock();
      const user = transaction(() => {
        run('DELETE FROM login_codes WHERE email=?', email);
        let u = get('SELECT * FROM users WHERE email=?', email);
        if (u?.status === 'suspended') fail(403, 'Account suspended. Contact support.');
        if (!u) {
          const id = randomUUID();
          run(
            "INSERT INTO users VALUES (?,?,?, ?,0,?,?,?,'2026-11-14')",
            id,
            email,
            now,
            JSON.stringify(emptyProfile()),
            'active',
            now,
            now,
          );
          run('INSERT INTO visibility(user_id) VALUES (?)', id);
          u = get('SELECT * FROM users WHERE id=?', id);
        }
        run(
          'DELETE FROM sessions WHERE user_id=? AND digest NOT IN (SELECT digest FROM sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 19)',
          u.id,
          u.id,
        );
        run('INSERT INTO sessions VALUES (?,?,?,?)', hash(token), u.id, now + SESSION, now);
        return u;
      });
      reply.setCookie(cookieName, token, {
        httpOnly: true,
        secure: config.production,
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION / 1000,
      });
      return {
        ...bootstrap({ id: user.id, email: user.email, onboarded: !!user.onboarded }),
        ...(req.headers['x-quad-client'] === 'native' ? { token } : {}),
      };
    },
  );
  app.get('/v1/bootstrap', { preHandler: authenticate }, async (req) => bootstrap(req.user));
  app.post('/v1/auth/logout', { preHandler: authenticate }, async (req, reply) => {
    run('DELETE FROM sessions WHERE digest=?', req.sessionDigest);
    reply.clearCookie(cookieName, {
      path: '/',
      secure: config.production,
      httpOnly: true,
      sameSite: 'lax',
    });
    return { ok: true };
  });
  app.put('/v1/profile', { preHandler: authenticate }, async (req) => {
    const profile = parse(profileSchema, req.body);
    profile.interests = [...new Set(profile.interests)];
    profile.clubs = [...new Set(profile.clubs)];
    run('UPDATE users SET profile=?,onboarded=1 WHERE id=?', JSON.stringify(profile), req.user.id);
    return { ok: true };
  });
  app.put('/v1/visibility', { preHandler: member }, async (req) => {
    const { audience, minutes, position } = parse(visibilitySchema, req.body),
      id = req.user.id;
    if (audience !== 'nobody' && !position) fail(400, 'Choose location access to share presence');
    if (audience === 'nobody')
      run(
        "UPDATE visibility SET audience='nobody',until_at=NULL,lat=NULL,lng=NULL,updated_at=NULL WHERE user_id=?",
        id,
      );
    else {
      // Fixed ~330m cells: never retain raw GPS, and never jitter on repeated queries.
      const lat = Math.floor(position.lat / 0.003) * 0.003 + 0.0015,
        lng = Math.floor(position.lng / 0.004) * 0.004 + 0.002;
      run(
        'UPDATE visibility SET audience=?,until_at=?,lat=?,lng=?,updated_at=? WHERE user_id=?',
        audience,
        minutes === null ? null : clock() + minutes * 60000,
        lat,
        lng,
        clock(),
        id,
      );
    }
    return { ok: true };
  });
  app.put('/v1/presence', { preHandler: member }, async (req) => {
    const { position } = parse(visibilitySchema.pick({ position: true }), req.body);
    if (!position) fail(400, 'Position required');
    const setting = get('SELECT * FROM visibility WHERE user_id=?', req.user.id);
    if (
      !setting ||
      setting.audience === 'nobody' ||
      (setting.until_at !== null && setting.until_at <= clock())
    )
      fail(409, 'Location sharing is off');
    run(
      'UPDATE visibility SET lat=?,lng=?,updated_at=? WHERE user_id=?',
      Math.floor(position.lat / 0.003) * 0.003 + 0.0015,
      Math.floor(position.lng / 0.004) * 0.004 + 0.002,
      clock(),
      req.user.id,
    );
    return { ok: true };
  });
  app.post('/v1/connections/:id', { preHandler: member }, async (req) => {
    const id = parse(z.string().uuid(), req.params.id),
      me = req.user.id;
    peer(me, id);
    const { action } = parse(
      z.object({ action: z.enum(['request', 'accept', 'remove']) }).strict(),
      req.body,
    );
    const [low, high] = pair(me, id);
    const c = get('SELECT * FROM connections WHERE low_id=? AND high_id=?', low, high);
    if (action === 'request') {
      if (c) fail(409, 'A request or connection already exists');
      if (
        get('SELECT COUNT(*) AS n FROM connections WHERE low_id=? OR high_id=?', me, me).n >= 500 ||
        get('SELECT COUNT(*) AS n FROM connections WHERE low_id=? OR high_id=?', id, id).n >= 500
      )
        fail(409, 'Connection limit reached');
      run("INSERT INTO connections VALUES (?,?,?,'pending',?)", low, high, me, clock());
    }
    if (action === 'accept') {
      if (!c || c.status !== 'pending' || c.initiator === me)
        fail(409, 'Only a received request can be accepted');
      run("UPDATE connections SET status='connected' WHERE low_id=? AND high_id=?", low, high);
    }
    if (action === 'remove') run('DELETE FROM connections WHERE low_id=? AND high_id=?', low, high);
    return { ok: true };
  });
  app.post('/v1/blocks/:id', { preHandler: member }, async (req) => {
    const id = parse(z.string().uuid(), req.params.id),
      me = req.user.id;
    const { blocked: enabled } = parse(z.object({ blocked: z.boolean() }).strict(), req.body);
    if (enabled) {
      if (!get('SELECT 1 FROM users WHERE id=?', id) || id === me) fail(404, 'Student unavailable');
      const [low, high] = pair(me, id);
      transaction(() => {
        run('INSERT OR IGNORE INTO blocks VALUES (?,?)', me, id);
        run('DELETE FROM connections WHERE low_id=? AND high_id=?', low, high);
        run(
          'DELETE FROM invites WHERE (user_id=? AND event_id IN(SELECT id FROM events WHERE host=?)) OR (user_id=? AND event_id IN(SELECT id FROM events WHERE host=?))',
          me,
          id,
          id,
          me,
        );
        run(
          'DELETE FROM rsvps WHERE (user_id=? AND event_id IN(SELECT id FROM events WHERE host=?)) OR (user_id=? AND event_id IN(SELECT id FROM events WHERE host=?))',
          me,
          id,
          id,
          me,
        );
      });
    } else run('DELETE FROM blocks WHERE blocker=? AND blocked=?', me, id);
    return { ok: true };
  });
  app.get('/v1/messages/:id', { preHandler: member }, async (req) => {
    const id = parse(z.string().uuid(), req.params.id),
      me = req.user.id;
    peer(me, id);
    if (!connected(me, id)) fail(403, 'Connect before messaging');
    let rows;
    if (req.query.cursor) {
      const cursor = parse(z.string().uuid(), req.query.cursor),
        point = get(
          'SELECT * FROM messages WHERE id=? AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))',
          cursor,
          me,
          id,
          id,
          me,
        );
      if (!point) fail(400, 'Invalid message cursor');
      rows = all(
        'SELECT * FROM messages WHERE ((sender=? AND recipient=?) OR (sender=? AND recipient=?)) AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 100',
        me,
        id,
        id,
        me,
        point.created_at,
        point.created_at,
        point.id,
      );
    } else
      rows = all(
        'SELECT * FROM messages WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?) ORDER BY created_at DESC,id DESC LIMIT 100',
        me,
        id,
        id,
        me,
      );
    return {
      nextCursor: rows.length === 100 ? rows.at(-1).id : null,
      messages: rows.reverse().map((m) => ({
        id: m.id,
        author: m.sender === me ? 'you' : 'them',
        text: m.body,
        createdAt: m.created_at,
      })),
    };
  });
  app.post(
    '/v1/messages/:id',
    { preHandler: member, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req) => {
      const id = parse(z.string().uuid(), req.params.id),
        me = req.user.id;
      peer(me, id);
      if (!connected(me, id)) fail(403, 'Connect before messaging');
      const { text, clientId } = parse(messageSchema, req.body);
      const existing = get('SELECT sender,recipient FROM messages WHERE id=?', clientId);
      if (existing && (existing.sender !== me || existing.recipient !== id))
        fail(409, 'Message ID already used');
      if (!existing)
        run('INSERT INTO messages VALUES (?,?,?,?,?)', clientId, me, id, text, clock());
      return { ok: true };
    },
  );
  app.post(
    '/v1/reports',
    { preHandler: member, config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (req) => {
      const { personId, eventId, reason, details } = parse(reportSchema, req.body);
      if (personId) peer(req.user.id, personId);
      if (eventId) eventFor(req.user.id, eventId);
      run(
        'INSERT INTO reports VALUES (?,?,?,?,?,?,?,?)',
        randomUUID(),
        req.user.id,
        personId || null,
        eventId || null,
        reason,
        details,
        'open',
        clock(),
      );
      if (deliver.notify)
        void deliver
          .notify()
          .catch(() =>
            app.log.error('Moderation email notification failed; report remains in queue'),
          );
      return { ok: true };
    },
  );
  app.get('/v1/events', { preHandler: member }, async (req) => {
    const me = req.user.id;
    const events = all(
      "SELECT e.*,u.profile FROM events e JOIN users u ON u.id=e.host WHERE e.cancelled=0 AND e.ends_at>? AND u.status='active' AND (e.kind='public' OR e.host=? OR EXISTS(SELECT 1 FROM invites i WHERE i.event_id=e.id AND i.user_id=?)) ORDER BY e.starts_at LIMIT 200",
      clock(),
      me,
      me,
    ).filter((e) => !blocked(me, e.host));
    const rsvps = {};
    return {
      events: events.map((e) => {
        const rsvp = get('SELECT status FROM rsvps WHERE event_id=? AND user_id=?', e.id, me);
        if (rsvp) rsvps[e.id] = rsvp.status;
        const invited =
          e.host === me
            ? all('SELECT user_id FROM invites WHERE event_id=?', e.id).map((i) => i.user_id)
            : undefined;
        const going = all(
          "SELECT r.user_id FROM rsvps r JOIN users u ON u.id=r.user_id WHERE event_id=? AND r.status='going' AND u.status='active'",
          e.id,
        ).filter((p) => !blocked(me, p.user_id)).length;
        return {
          id: e.id,
          title: e.title,
          kind: e.kind,
          campus: e.campus,
          venue: e.venue,
          time: new Date(e.starts_at).toISOString(),
          startsAt: e.starts_at,
          endsAt: e.ends_at,
          host: JSON.parse(e.profile).firstName,
          hostId: e.host,
          going,
          category: e.category,
          description: e.description,
          invitees: invited,
        };
      }),
      rsvps,
    };
  });
  app.post(
    '/v1/events',
    { preHandler: member, config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (req) => {
      const e = parse(eventSchema, req.body),
        now = clock(),
        me = req.user.id;
      if (
        e.startsAt < now ||
        e.startsAt > now + 90 * 86400000 ||
        e.endsAt <= e.startsAt ||
        e.endsAt > e.startsAt + 86400000
      )
        fail(400, 'Choose a future event within 90 days, lasting up to 24 hours');
      if (e.kind === 'public' && e.invitees.length)
        fail(400, 'Public linkups do not need private invites');
      for (const id of e.invitees) {
        peer(me, id);
        if (!connected(me, id)) fail(403, 'Invite accepted connections only');
      }
      const id = randomUUID();
      transaction(() => {
        run(
          'INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,0,?)',
          id,
          me,
          e.title,
          e.campus,
          e.venue,
          e.startsAt,
          e.endsAt,
          e.kind,
          e.category,
          e.description,
          now,
        );
        for (const person of new Set(e.invitees))
          run('INSERT INTO invites VALUES (?,?)', id, person);
        run("INSERT INTO rsvps VALUES (?,?,'going')", id, me);
      });
      return { id };
    },
  );
  app.put('/v1/events/:id/rsvp', { preHandler: member }, async (req) => {
    const event = eventFor(req.user.id, parse(z.string().uuid(), req.params.id));
    if (event.ends_at <= clock()) fail(409, 'This event has ended');
    const { status } = parse(
      z.object({ status: z.enum(['going', 'declined']).nullable() }).strict(),
      req.body,
    );
    if (status)
      run(
        'INSERT INTO rsvps VALUES (?,?,?) ON CONFLICT(event_id,user_id) DO UPDATE SET status=excluded.status',
        event.id,
        req.user.id,
        status,
      );
    else run('DELETE FROM rsvps WHERE event_id=? AND user_id=?', event.id, req.user.id);
    return { ok: true };
  });
  app.delete('/v1/events/:id', { preHandler: member }, async (req) => {
    const event = eventFor(req.user.id, parse(z.string().uuid(), req.params.id));
    if (event.host !== req.user.id) fail(403, 'Only the host can cancel this linkup');
    run('UPDATE events SET cancelled=1 WHERE id=?', event.id);
    return { ok: true };
  });
  app.get('/v1/account/export', { preHandler: authenticate }, async (req) => {
    const me = req.user.id;
    return {
      account: { ...req.user, admin: undefined },
      visibility: get(
        'SELECT audience,until_at,lat,lng,updated_at FROM visibility WHERE user_id=?',
        me,
      ),
      connections: all('SELECT * FROM connections WHERE low_id=? OR high_id=?', me, me),
      messages: all('SELECT * FROM messages WHERE sender=?', me),
      events: all('SELECT * FROM events WHERE host=?', me),
      rsvps: all('SELECT * FROM rsvps WHERE user_id=?', me),
      blocks: all('SELECT * FROM blocks WHERE blocker=?', me),
      reports: all('SELECT * FROM reports WHERE reporter=?', me),
    };
  });
  app.delete('/v1/account', { preHandler: authenticate }, async (req, reply) => {
    const { confirmation } = parse(
      z.object({ confirmation: z.literal('DELETE') }).strict(),
      req.body,
    );
    transaction(() => {
      run('DELETE FROM login_codes WHERE email=?', req.user.email);
      run('DELETE FROM users WHERE id=?', req.user.id);
      audit('deleted-account', 'delete-account', null);
    });
    reply.clearCookie(cookieName, {
      path: '/',
      secure: config.production,
      httpOnly: true,
      sameSite: 'lax',
    });
    return { ok: !!confirmation };
  });
  app.get('/v1/admin/reports', { preHandler: administrator }, async () => ({
    reports: all(
      "SELECT * FROM reports WHERE status='open' ORDER BY created_at DESC LIMIT 100",
    ).map((r) => ({
      ...r,
      subjectProfile: r.subject
        ? JSON.parse(get('SELECT profile FROM users WHERE id=?', r.subject)?.profile || 'null')
        : null,
      event: r.event_id ? get('SELECT title,venue,host FROM events WHERE id=?', r.event_id) : null,
    })),
  }));
  app.post('/v1/admin/reports/:id', { preHandler: administrator }, async (req) => {
    const id = parse(z.string().uuid(), req.params.id),
      { status } = parse(
        z.object({ status: z.enum(['reviewed', 'dismissed']) }).strict(),
        req.body,
      );
    run('UPDATE reports SET status=? WHERE id=?', status, id);
    audit(req.user.id, 'report-' + status, id);
    return { ok: true };
  });
  app.post('/v1/admin/users/:id', { preHandler: administrator }, async (req) => {
    const id = parse(z.string().uuid(), req.params.id),
      { status } = parse(z.object({ status: z.enum(['active', 'suspended']) }).strict(), req.body);
    if (id === req.user.id) fail(400, 'You cannot suspend your own account');
    transaction(() => {
      run('UPDATE users SET status=? WHERE id=?', status, id);
      if (status === 'suspended') {
        run('DELETE FROM sessions WHERE user_id=?', id);
        run(
          "UPDATE visibility SET audience='nobody',lat=NULL,lng=NULL,updated_at=NULL WHERE user_id=?",
          id,
        );
        run('UPDATE events SET cancelled=1 WHERE host=?', id);
      }
      audit(req.user.id, 'account-' + status, id);
    });
    return { ok: true };
  });
  app.post('/v1/admin/events/:id', { preHandler: administrator }, async (req) => {
    const id = parse(z.string().uuid(), req.params.id);
    run('UPDATE events SET cancelled=1 WHERE id=?', id);
    audit(req.user.id, 'cancel-event', id);
    return { ok: true };
  });
  const housekeeping = () => {
    const now = clock();
    transaction(() => {
      run('DELETE FROM sessions WHERE expires_at<=?', now);
      run('DELETE FROM login_codes WHERE expires_at<=?', now);
      run('DELETE FROM throttle WHERE reset_at<=?', now);
      run(
        'UPDATE visibility SET lat=NULL,lng=NULL,updated_at=NULL WHERE updated_at<=? OR (until_at IS NOT NULL AND until_at<=?)',
        now - FRESH,
        now,
      );
      run('DELETE FROM messages WHERE created_at<?', now - 90 * 86400000);
      run('DELETE FROM events WHERE ends_at<?', now - 30 * 86400000);
      run('DELETE FROM reports WHERE created_at<?', now - 180 * 86400000);
      run('DELETE FROM audit WHERE created_at<?', now - 180 * 86400000);
    });
  };
  housekeeping();
  const timer = setInterval(housekeeping, 60000);
  timer.unref();
  app.addHook('onClose', async () => {
    clearInterval(timer);
    store.db.close();
  });
  if (serveWeb && existsSync(config.webRoot)) {
    await app.register(staticFiles, { root: config.webRoot, maxAge: 0, index: 'index.html' });
    app.setNotFoundHandler(async (req, reply) => {
      if (
        req.url.startsWith('/v1/') ||
        req.url.startsWith('/api/') ||
        !['GET', 'HEAD'].includes(req.method) ||
        !req.headers.accept?.includes('text/html')
      )
        return reply.code(404).send({ error: 'Not found' });
      reply.header('Cache-Control', 'no-cache');
      return reply.sendFile('index.html');
    });
  }
  return { app, store, housekeeping };
}
