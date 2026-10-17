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
  position:
    (
      {
        maya: { lat: 40.5212, lng: -74.464 },
        sam: { lat: 40.5215, lng: -74.4635 },
        daniel: { lat: 40.521, lng: -74.4643 },
        emily: { lat: 40.484, lng: -74.436 },
        priya: { lat: 40.4843, lng: -74.4365 },
        leo: { lat: 40.4836, lng: -74.4355 },
        ava: { lat: 40.523, lng: -74.4375 },
        noah: { lat: 40.5215, lng: -74.4345 },
        arjun: { lat: 40.5235, lng: -74.4605 },
      } as Record<string, { lat: number; lng: number }>
    )[p.id] || p.position,
  sampleConnections: p.id === "maya" ? ["sam"] : [],
}));
const additions = [
  ["kiara", "Kiara", "Singh", 40.5224, -74.438, 2],
  ["ben", "Ben", "Chen", 40.523, -74.4357, 3],
  ["aisha", "Aisha", "Khan", 40.5196, -74.4605, 4],
  ["ethan", "Ethan", "Reed", 40.5245, -74.4658, 5],
  ["sofia", "Sofia", "Garcia", 40.4866, -74.4373, 6],
  ["marcus", "Marcus", "Brown", 40.4807, -74.4329, 7],
  ["nina", "Nina", "Shah", 40.5044, -74.4515, 8],
  ["ryan", "Ryan", "Park", 40.4986, -74.4466, 9],
] as const;
for (const [id, firstName, lastName, lat, lng, avatar] of additions) {
  PEOPLE.push({
    ...PEOPLE[avatar % PEOPLE.length],
    id,
    firstName,
    lastName,
    avatar,
    bio: "Always up for meeting new people around campus.",
    position: { lat, lng },
    sampleConnections: [],
  });
}
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
    messages: {
      sam: [
        {
          id: "sample-sam",
          author: "them",
          text: "Hey! Saw you’re in HackRU too. What are you working on?",
          createdAt: Date.now(),
        },
      ],
      noah: [
        {
          id: "sample-noah",
          author: "them",
          text: "Coffee at The Yard sometime? Would love to hear about your side project.",
          createdAt: Date.now(),
        },
      ],
    },
    visibility: { audience: "nobody", until: null, presenceUpdatedAt: null },
  };
}
export const CAMPUS = {
  latitude: 40.504,
  longitude: -74.449,
  latitudeDelta: 0.062,
  longitudeDelta: 0.062,
};
