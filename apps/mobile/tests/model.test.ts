import test from "node:test";
import assert from "node:assert/strict";
import {
  blockPerson,
  canDiscover,
  connectionAction,
  FRESHNESS_MS,
  isVisible,
  parseSavedState,
  setVisibility,
  similarity,
  unblockPerson,
  validateProfile,
  type Profile,
  type State,
  type Person,
} from "../src/model.ts";
const profile: Profile = {
  firstName: "Alex",
  lastName: "Chen",
  major: "Computer Science",
  year: 2028,
  bio: "Hello campus",
  avatar: 0,
  interests: ["AI", "Coffee"],
  clubs: ["HackRU"],
  experiences: [],
};
const seed = (): State => ({
  version: 1,
  entered: true,
  me: structuredClone(profile),
  connections: { sam: "connected", jordan: "incoming" },
  blocked: [],
  reports: [],
  visibility: { audience: "nobody", until: null, presenceUpdatedAt: null },
});
const person: Person = {
  ...profile,
  id: "maya",
  firstName: "Maya",
  position: { lat: 40.5, lng: -74.4 },
  sampleConnections: ["sam"],
};
test("requests can be sent and withdrawn; senders cannot accept their own request", () => {
  const s = connectionAction(seed(), "maya", "request");
  assert.equal(s.connections.maya, "outgoing");
  assert.throws(() => connectionAction(s, "maya", "accept"));
  assert.throws(() => connectionAction(s, "maya", "request"));
  assert.equal(
    connectionAction(s, "maya", "remove").connections.maya,
    undefined,
  );
  assert.throws(() => connectionAction(s, "you", "request"));
});
test("received requests can be accepted or declined", () => {
  assert.equal(
    connectionAction(seed(), "jordan", "accept").connections.jordan,
    "connected",
  );
  assert.equal(
    connectionAction(seed(), "jordan", "remove").connections.jordan,
    undefined,
  );
});
test("blocks hide discovery, remove relationships, and prevent requests; unblocking does not restore them", () => {
  const s = blockPerson(seed(), "sam");
  assert.equal(canDiscover(s, "sam"), false);
  assert.equal(s.connections.sam, undefined);
  assert.throws(() => connectionAction(s, "sam", "request"));
  const unblocked = unblockPerson(s, "sam");
  assert.equal(canDiscover(unblocked, "sam"), true);
  assert.equal(unblocked.connections.sam, undefined);
  assert.throws(() => blockPerson(s, "you"));
});
test("duration, audience, and location freshness independently determine presence", () => {
  const now = 1000000;
  const s = setVisibility(seed(), "university", 30, now);
  assert.equal(isVisible(s.visibility, now), true);
  assert.equal(isVisible(s.visibility, now + FRESHNESS_MS), false);
  const always = setVisibility(seed(), "connections", null, now);
  assert.equal(always.visibility.until, null);
  assert.equal(isVisible(always.visibility, now + FRESHNESS_MS), false);
  const ghost = setVisibility(s, "nobody", null, now);
  assert.equal(ghost.visibility.presenceUpdatedAt, null);
  assert.equal(isVisible(ghost.visibility, now), false);
  assert.equal(isVisible({ ...s.visibility, until: now }, now), false);
  assert.throws(() => setVisibility(seed(), "university", -5));
});
test("similarities are explicit and rank organizations before mutuals, major and interests", () => {
  assert.match(similarity(profile, person, seed().connections)!, /HackRU/);
  assert.equal(
    similarity(profile, { ...person, clubs: [] }, seed().connections),
    "1 mutual connection",
  );
  assert.equal(
    similarity(profile, { ...person, clubs: [], sampleConnections: [] }, {}),
    "You both study Computer Science",
  );
  assert.equal(
    similarity(
      profile,
      { ...person, clubs: [], sampleConnections: [], major: "Design" },
      {},
    ),
    "You both like AI and Coffee",
  );
  assert.equal(
    similarity(
      profile,
      {
        ...person,
        clubs: [],
        sampleConnections: [],
        major: "Design",
        interests: [],
      },
      {},
    ),
    null,
  );
});
test("profile validation prevents empty names, invalid years, and incomplete experiences", () => {
  assert.throws(() => validateProfile({ ...profile, firstName: " " }));
  assert.throws(() => validateProfile({ ...profile, year: 1 }));
  assert.throws(() =>
    validateProfile({
      ...profile,
      experiences: [{ title: "", organization: "", when: "", description: "" }],
    }),
  );
  assert.equal(
    validateProfile({ ...profile, firstName: " Alex " }).firstName,
    "Alex",
  );
  assert.deepEqual(
    validateProfile({ ...profile, interests: ["AI", "AI"] }).interests,
    ["AI"],
  );
});
test("serialization preserves independent saved data and detects invalid storage", () => {
  const s = seed();
  s.reports.push({
    id: "r1",
    personId: "maya",
    reason: "Other",
    details: "Saved locally",
    createdAt: 1,
  });
  assert.deepEqual(parseSavedState(JSON.stringify(s)), s);
  assert.throws(() => parseSavedState("{broken"));
  assert.throws(() => parseSavedState(JSON.stringify({ ...s, version: 2 })));
  assert.throws(() =>
    parseSavedState(JSON.stringify({ ...s, connections: { sam: "invalid" } })),
  );
});
