CREATE TABLE users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, verified_at INTEGER NOT NULL,
 profile TEXT NOT NULL, onboarded INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 created_at INTEGER NOT NULL, consented_at INTEGER NOT NULL, policy_version TEXT NOT NULL
);
CREATE TABLE login_codes (email TEXT PRIMARY KEY, nonce TEXT NOT NULL, digest TEXT NOT NULL, expires_at INTEGER NOT NULL, issued_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE sessions (digest TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE visibility (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, audience TEXT NOT NULL DEFAULT 'nobody' CHECK(audience IN ('university','connections','nobody')), until_at INTEGER, lat REAL, lng REAL, updated_at INTEGER);
CREATE TABLE connections (low_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, high_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, initiator TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL CHECK(status IN ('pending','connected')), created_at INTEGER NOT NULL, PRIMARY KEY(low_id,high_id), CHECK(low_id < high_id), CHECK(initiator IN (low_id,high_id)));
CREATE INDEX connections_high ON connections(high_id);
CREATE TABLE blocks (blocker TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, blocked TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(blocker,blocked), CHECK(blocker <> blocked));
CREATE INDEX blocks_reverse ON blocks(blocked,blocker);
CREATE TABLE messages (id TEXT PRIMARY KEY, sender TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, recipient TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, created_at INTEGER NOT NULL, CHECK(sender <> recipient));
CREATE INDEX messages_thread ON messages(sender,recipient,created_at);
CREATE INDEX messages_recipient ON messages(recipient,created_at);
CREATE TABLE events (id TEXT PRIMARY KEY, host TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, campus TEXT NOT NULL CHECK(campus IN ('college','busch','livingston','cook')), venue TEXT NOT NULL, starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('public','invite')), category TEXT NOT NULL, description TEXT NOT NULL, cancelled INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, CHECK(ends_at > starts_at));
CREATE INDEX events_upcoming ON events(cancelled,ends_at,starts_at);
CREATE TABLE invites (event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(event_id,user_id));
CREATE TABLE rsvps (event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL CHECK(status IN ('going','declined')), PRIMARY KEY(event_id,user_id));
CREATE TABLE reports (id TEXT PRIMARY KEY, reporter TEXT REFERENCES users(id) ON DELETE SET NULL, subject TEXT REFERENCES users(id) ON DELETE SET NULL, event_id TEXT REFERENCES events(id) ON DELETE SET NULL, reason TEXT NOT NULL, details TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewed','dismissed')), created_at INTEGER NOT NULL);
CREATE INDEX reports_open ON reports(status,created_at);
CREATE TABLE audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, subject TEXT, created_at INTEGER NOT NULL);
CREATE TABLE throttle (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
