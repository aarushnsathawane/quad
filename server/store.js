import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const FRESHNESS_MS = 15 * 60 * 1000;
export const CAMPUS = { lat: 40.5011, lng: -74.4495 };
export function createStore(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const transaction = (fn) => {
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
  if (!get('SELECT id FROM universities LIMIT 1')) transaction(() => seed(run));
  const blocked = (a, b) =>
    !!get(
      'SELECT 1 FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)',
      a,
      b,
      b,
      a,
    );
  const pair = (a, b) => [a, b].sort();
  const relationship = (a, b) =>
    get('SELECT * FROM connections WHERE user_low_id=? AND user_high_id=?', ...pair(a, b));
  const connectedIds = (id) =>
    all(
      "SELECT CASE WHEN user_low_id=? THEN user_high_id ELSE user_low_id END AS id FROM connections WHERE (user_low_id=? OR user_high_id=?) AND status='accepted'",
      id,
      id,
      id,
    ).map((x) => x.id);
  const eligible = (id, viewer) =>
    !!get(
      "SELECT 1 FROM users a JOIN users b ON a.university_id=b.university_id WHERE a.id=? AND b.id=? AND a.account_status='active' AND b.account_status='active' AND a.university_verified_at IS NOT NULL AND b.university_verified_at IS NOT NULL",
      id,
      viewer,
    ) && !blocked(id, viewer);
  const profile = (id, viewer) => {
    if (!eligible(id, viewer)) return null;
    const p = get(
      'SELECT p.*, a.name AS major, u.name AS university FROM profiles p JOIN users us ON us.id=p.user_id JOIN universities u ON u.id=us.university_id JOIN academic_programs a ON a.id=p.major_program_id WHERE p.user_id=?',
      id,
    );
    if (!p) return null;
    const tags = all(
      'SELECT t.*, pt.kind FROM tags t JOIN profile_tags pt ON pt.tag_id=t.id WHERE pt.user_id=? ORDER BY t.name',
      id,
    );
    const organizations = all(
      'SELECT o.* FROM organizations o JOIN profile_organizations po ON po.organization_id=o.id WHERE po.user_id=? ORDER BY o.name',
      id,
    );
    const experiences = all(
      'SELECT id,title,organization_name,time_label,description FROM experiences WHERE user_id=? ORDER BY sort_order',
      id,
    );
    const r = relationship(id, viewer);
    const status = r
      ? r.status === 'accepted'
        ? 'connected'
        : r.requested_by === viewer
          ? 'outgoing'
          : 'incoming'
      : 'none';
    let similarity = null;
    if (id !== viewer) {
      const mine = all(
        'SELECT organization_id FROM profile_organizations WHERE user_id=?',
        viewer,
      ).map((x) => x.organization_id);
      const sharedOrg = organizations.find((o) => mine.includes(o.id));
      const mineTags = all('SELECT tag_id FROM profile_tags WHERE user_id=?', viewer).map(
        (x) => x.tag_id,
      );
      const sharedTags = tags.filter((t) => mineTags.includes(t.id));
      const mutuals = connectedIds(id).filter(
        (x) => connectedIds(viewer).includes(x) && eligible(x, viewer),
      );
      const myMajor = get(
        'SELECT major_program_id FROM profiles WHERE user_id=?',
        viewer,
      )?.major_program_id;
      if (sharedOrg)
        similarity = { kind: 'organization', text: `You're both in ${sharedOrg.name}` };
      else if (mutuals.length)
        similarity = {
          kind: 'mutual',
          text: `${mutuals.length} mutual connection${mutuals.length === 1 ? '' : 's'}`,
        };
      else if (myMajor === p.major_program_id)
        similarity = { kind: 'major', text: `You both study ${p.major}` };
      else if (sharedTags.length)
        similarity = {
          kind: 'interest',
          text: `You both like ${sharedTags
            .slice(0, 2)
            .map((x) => x.name)
            .join(' and ')}`,
        };
    }
    return {
      id: p.user_id,
      firstName: p.first_name,
      lastName: p.last_name,
      major: p.major,
      majorId: p.major_program_id,
      minorId: p.minor_program_id,
      graduationYear: p.graduation_year,
      bio: p.bio,
      avatarStyle: p.avatar_style,
      university: p.university,
      instagramUrl: p.instagram_url,
      linkedinUrl: p.linkedin_url,
      tags,
      organizations,
      experiences,
      relationship: status,
      similarity,
    };
  };
  const nearby = (viewer) => {
    const now = Date.now();
    return all(
      'SELECT l.*,v.audience,v.visible_until FROM user_locations l JOIN visibility_settings v ON v.user_id=l.user_id WHERE l.user_id<>?',
      viewer,
    )
      .filter((l) => {
        if (
          !eligible(l.user_id, viewer) ||
          l.audience === 'nobody' ||
          (l.visible_until && Date.parse(l.visible_until) <= now) ||
          now - Date.parse(l.received_at) > FRESHNESS_MS
        )
          return false;
        if (l.audience === 'connections' && relationship(viewer, l.user_id)?.status !== 'accepted')
          return false;
        // The demo is deliberately scoped to the College Avenue map, not device proximity.
        return (
          Math.abs(l.latitude - CAMPUS.lat) < 0.015 && Math.abs(l.longitude - CAMPUS.lng) < 0.015
        );
      })
      .slice(0, 60)
      .map((l) => ({
        ...profile(l.user_id, viewer),
        position: {
          lat: Math.round(l.latitude / 0.0008) * 0.0008,
          lng: Math.round(l.longitude / 0.001) * 0.001,
        },
        expiresAt: new Date(
          Math.min(
            Date.parse(l.received_at) + FRESHNESS_MS,
            l.visible_until ? Date.parse(l.visible_until) : Infinity,
          ),
        ).toISOString(),
      }));
  };
  const refreshDemo = () => {
    // Only fictional fixtures are refreshed. Never refresh the current user's real location.
    const receivedAt = new Date().toISOString();
    transaction(() => {
      for (const [id, , , , , , , , latitude, longitude] of demoPeople) {
        if (id === 'you' || !get('SELECT 1 FROM users WHERE id=? AND is_demo=1', id)) continue;
        run(
          'INSERT INTO user_locations VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET latitude=excluded.latitude, longitude=excluded.longitude, received_at=excluded.received_at',
          id,
          latitude,
          longitude,
          25,
          receivedAt,
        );
      }
    });
  };
  return {
    db,
    all,
    get,
    run,
    transaction,
    blocked,
    pair,
    relationship,
    eligible,
    profile,
    nearby,
    refreshDemo,
  };
}

function seed(run) {
  run(
    'INSERT INTO universities VALUES (?,?,?)',
    'rutgers',
    'Rutgers University',
    '["rutgers.edu"]',
  );
  const majors = [
    ['cs', 'Computer Science'],
    ['ece', 'Electrical & Computer Engineering'],
    ['design', 'Design'],
    ['business', 'Business'],
    ['biology', 'Biological Sciences'],
    ['psychology', 'Psychology'],
    ['undeclared', 'Undeclared'],
  ];
  majors.forEach(([id, name]) =>
    run('INSERT INTO academic_programs VALUES (?,?,?)', id, 'rutgers', name),
  );
  const tags = [
    'AI',
    'Running',
    'Startups',
    'Formula 1',
    'Photography',
    'Coffee',
    'Design',
    'Music',
    'Hiking',
    'Gaming',
    'Film',
    'Skiing',
    'Reading',
    'Basketball',
    'Cooking',
    'Sustainability',
  ];
  tags.forEach((name, i) => run('INSERT INTO tags VALUES (?,?)', `t${i}`, name));
  const orgs = [
    ['hackru', 'HackRU', 'club'],
    ['formula', 'Rutgers Formula Racing', 'project_team'],
    ['photo', 'Rutgers Photography Club', 'club'],
    ['outdoors', 'Rutgers Outdoors Club', 'club'],
    ['radio', 'WRSU Radio', 'club'],
    ['designclub', 'Design Collective', 'club'],
    ['runclub', 'Rutgers Running Club', 'sports_team'],
  ];
  orgs.forEach(([id, name, kind]) =>
    run('INSERT INTO organizations VALUES (?,?,?,?)', id, 'rutgers', name, kind),
  );
  const now = new Date().toISOString();
  demoPeople.forEach(([id, first, last, major, year, bio, tagIds, orgIds, lat, lng], i) => {
    run(
      'INSERT INTO users (id,university_id,university_email,university_verified_at) VALUES (?,?,?,?)',
      id,
      'rutgers',
      `${id}@demo.invalid`,
      now,
    );
    run(
      'INSERT INTO profiles (user_id,first_name,last_name,major_program_id,graduation_year,bio,avatar_style) VALUES (?,?,?,?,?,?,?)',
      id,
      first,
      last,
      major,
      year,
      bio,
      i,
    );
    tagIds.forEach((n) =>
      run('INSERT INTO profile_tags (user_id,tag_id) VALUES (?,?)', id, `t${n}`),
    );
    orgIds.forEach((o) => run('INSERT INTO profile_organizations VALUES (?,?)', id, o));
    run(
      'INSERT INTO visibility_settings (user_id,audience) VALUES (?,?)',
      id,
      id === 'you' ? 'nobody' : 'university',
    );
    if (id !== 'you') run('INSERT INTO user_locations VALUES (?,?,?,?,?)', id, lat, lng, 25, now);
  });
  run(
    'INSERT INTO experiences (id,user_id,title,organization_name,time_label,description) VALUES (?,?,?,?,?,?)',
    'e1',
    'maya',
    'Electrical systems team member',
    'Rutgers Formula Racing',
    '2025 — Present',
    'Working with a student team to bring an electric race car to life.',
  );
  run(
    'INSERT INTO experiences (id,user_id,title,organization_name,time_label,description) VALUES (?,?,?,?,?,?)',
    'e2',
    'you',
    'Built my first campus app',
    'Side project',
    'Summer 2026',
    'Learning by making things people actually want to use.',
  );
  [
    ['sam', 'you', 'sam', 'accepted'],
    ['noah', 'you', 'you', 'accepted'],
    ['jordan', 'you', 'jordan', 'pending'],
    ['emily', 'you', 'emily', 'pending'],
    ['maya', 'sam', 'maya', 'accepted'],
  ].forEach(([a, b, by, status]) =>
    run(
      'INSERT INTO connections (user_low_id,user_high_id,requested_by,status,accepted_at) VALUES (?,?,?,?,?)',
      ...[a, b].sort(),
      by,
      status,
      status === 'accepted' ? now : null,
    ),
  );
}

const demoPeople = [
  [
    'you',
    'Alex',
    'Chen',
    'cs',
    2028,
    'Usually building something, finding a good coffee, or taking the long way home.',
    [0, 1, 2, 3, 5],
    ['hackru', 'formula'],
    40.5011,
    -74.4495,
  ],
  [
    'maya',
    'Maya',
    'Patel',
    'ece',
    2028,
    'Building fast cars and occasionally breaking them. Always up for a coffee and a good idea.',
    [0, 1, 2, 3],
    ['formula', 'hackru'],
    40.5021,
    -74.4503,
  ],
  [
    'jordan',
    'Jordan',
    'Lee',
    'design',
    2027,
    'A sketchbook, an iced matcha, and too many open tabs. Say hi!',
    [4, 5, 6, 10],
    ['designclub', 'photo'],
    40.4998,
    -74.4463,
  ],
  [
    'sam',
    'Sam',
    'Rivera',
    'cs',
    2028,
    'Weekend hikes, late-night side projects, and a slightly unreasonable love of espresso.',
    [0, 5, 8, 9],
    ['hackru', 'outdoors'],
    40.503,
    -74.4463,
  ],
  [
    'emily',
    'Emily',
    'Park',
    'biology',
    2029,
    'Finding little pockets of green on campus. Ask me about my latest trail.',
    [1, 4, 8, 15],
    ['outdoors', 'runclub'],
    40.4989,
    -74.4511,
  ],
  [
    'noah',
    'Noah',
    'Williams',
    'business',
    2027,
    'Ideas person. Pickup basketball regular. Looking for people to build cool things with.',
    [2, 5, 13],
    ['hackru'],
    40.5011,
    -74.4534,
  ],
  [
    'zoe',
    'Zoe',
    'Thompson',
    'psychology',
    2028,
    'Collecting records and making playlists for every possible mood.',
    [7, 10, 12],
    ['radio'],
    40.505,
    -74.4485,
  ],
  [
    'arjun',
    'Arjun',
    'Shah',
    'ece',
    2027,
    'Robots by day. Sim racing by night. Probably in the workshop.',
    [0, 3, 9],
    ['formula'],
    40.5039,
    -74.4523,
  ],
  [
    'olivia',
    'Olivia',
    'Brooks',
    'design',
    2029,
    'Trying to make ordinary things a little more beautiful.',
    [4, 6, 12],
    ['photo', 'designclub'],
    40.4971,
    -74.4482,
  ],
  [
    'daniel',
    'Daniel',
    'Kim',
    'cs',
    2028,
    'One more hackathon. One more run. One more cup of coffee.',
    [0, 1, 5],
    ['hackru', 'runclub'],
    40.4998,
    -74.4553,
  ],
  [
    'ava',
    'Ava',
    'Martinez',
    'business',
    2028,
    'Big on food, small businesses, and meeting people outside my usual circle.',
    [2, 14, 7],
    ['radio'],
    40.506,
    -74.4513,
  ],
  [
    'leo',
    'Leo',
    'Wilson',
    'psychology',
    2029,
    'Here for the conversations, the pickup games, and the good campus food.',
    [13, 10, 5],
    ['outdoors'],
    40.4979,
    -74.4542,
  ],
  [
    'priya',
    'Priya',
    'Nair',
    'biology',
    2027,
    'Research, running, repeat. Looking for a weekend hiking crew.',
    [1, 8, 11],
    ['outdoors', 'runclub'],
    40.5049,
    -74.455,
  ],
];
