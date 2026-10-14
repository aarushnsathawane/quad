import fixtures from "./fixtures.json";
import type { Profile, Person, State } from "./model";
const convert = (
  p: Pick<
    typeof fixtures.me,
    | "firstName"
    | "lastName"
    | "major"
    | "graduationYear"
    | "bio"
    | "avatarStyle"
    | "tags"
    | "organizations"
    | "experiences"
  >,
): Profile => ({
  firstName: p.firstName,
  lastName: p.lastName,
  major: p.major,
  year: p.graduationYear,
  bio: p.bio,
  avatar: p.avatarStyle,
  interests: p.tags.map((t) => t.name),
  clubs: p.organizations.map((o) => o.name),
  experiences: p.experiences.map((e) => ({
    title: e.title,
    organization: e.organization_name,
    when: e.time_label,
    description: e.description,
  })),
});
export const PEOPLE: Person[] = fixtures.people.map((p) => ({
  ...convert(p),
  id: p.id,
  position: p.position,
  sampleConnections: p.id === "maya" ? ["sam"] : [],
}));
export const CATALOG = fixtures.catalog;
export function initialState(): State {
  return {
    version: 1,
    entered: false,
    me: convert(fixtures.me),
    connections: {
      sam: "connected",
      noah: "connected",
      jordan: "incoming",
      emily: "incoming",
    },
    blocked: [],
    reports: [],
    visibility: { audience: "nobody", until: null, presenceUpdatedAt: null },
  };
}
export const CAMPUS = {
  latitude: 40.5011,
  longitude: -74.4495,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};
