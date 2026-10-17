import test from "node:test";
import assert from "node:assert/strict";
import { campusFor, CAMPUSES } from "../src/campuses.ts";
import { parseRSVPs, LINKUPS } from "../src/pregame-data.ts";
test("campus navigation matches each Rutgers area", () => {
  for (const campus of CAMPUSES)
    assert.equal(
      campusFor({ lat: campus.lat + 0.0001, lng: campus.lng }).id,
      campus.id,
    );
});
test("RSVP storage preserves accept and decline, ignores stale events and malformed statuses", () => {
  assert.deepEqual(parseRSVPs(null), {});
  assert.deepEqual(
    parseRSVPs(
      JSON.stringify({
        "alex-invite": "going",
        "house-invite": "declined",
        deleted: "going",
        tailgate: "nope",
      }),
    ),
    { "alex-invite": "going", "house-invite": "declined" },
  );
  assert.throws(() => parseRSVPs("[]"));
  assert.throws(() => parseRSVPs("{"));
  assert.equal(
    new Set(LINKUPS.filter((e) => e.kind === "public").map((e) => e.campus))
      .size,
    4,
  );
  assert.equal(new Set(LINKUPS.map((e) => e.id)).size, LINKUPS.length);
});
