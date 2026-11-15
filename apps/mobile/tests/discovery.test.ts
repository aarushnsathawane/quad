import test from 'node:test';
import assert from 'node:assert/strict';
import { campusFor, CAMPUSES } from '../src/campuses.ts';
import { parseRSVPs, LINKUPS } from '../src/pregame-data.ts';
test('campus navigation matches each Rutgers area', () => {
  for (const campus of CAMPUSES)
    assert.equal(campusFor({ lat: campus.lat + 0.0001, lng: campus.lng }).id, campus.id);
});
test('RSVP storage preserves accept and decline, ignores stale events and malformed statuses', () => {
  assert.deepEqual(parseRSVPs(null), {});
  assert.deepEqual(
    parseRSVPs(
      JSON.stringify({
        'alex-invite': 'going',
        'house-invite': 'declined',
        deleted: 'going',
        tailgate: 'nope',
      }),
    ),
    { 'alex-invite': 'going', 'house-invite': 'declined' },
  );
  assert.throws(() => parseRSVPs('[]'));
  assert.throws(() => parseRSVPs('{'));
  assert.equal(new Set(LINKUPS.filter((e) => e.kind === 'public').map((e) => e.campus)).size, 4);
  assert.equal(new Set(LINKUPS.map((e) => e.id)).size, LINKUPS.length);
});

import { clusterPeople } from '../src/map-clusters.ts';
test('students sharing a coarse location stay selectable without including expired or hidden presence', () => {
  const base = {
    id: 'one',
    firstName: 'A',
    lastName: 'Student',
    major: 'Undeclared',
    year: null,
    bio: '',
    avatar: 0,
    interests: [],
    clubs: [],
    experiences: [],
    sampleConnections: [],
    position: { lat: 40.5015, lng: -74.45 },
  };
  const clusters = clusterPeople(
    [
      base,
      { ...base, id: 'two' },
      { ...base, id: 'hidden', onMap: false },
      { ...base, id: 'expired', presenceExpiresAt: 9 },
    ],
    10,
  );
  assert.equal(clusters.length, 1);
  assert.deepEqual(
    clusters[0].members.map((p) => p.id),
    ['one', 'two'],
  );
});
