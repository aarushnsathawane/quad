import type { Person } from "./model";
export type Gathering = {
  id: string;
  title: string;
  venue: string;
  description: string;
  interests: string[];
  memberIds: string[];
  position: { lat: number; lng: number };
};
export type VisibleGathering = Gathering & { members: Person[] };
export const GATHERINGS: Gathering[] = [
  {
    id: "build-night",
    title: "HackRU build night",
    venue: "Busch Student Center",
    description:
      "Bring a side project or a half-formed idea. A casual evening of building, swapping ideas, and meeting other makers.",
    interests: ["AI", "Startups", "Gaming"],
    memberIds: ["maya", "sam", "daniel"],
    position: { lat: 40.5212, lng: -74.464 },
  },
  {
    id: "coffee-walk",
    title: "Coffee & camera walk",
    venue: "The Yard",
    description:
      "Grab a coffee, bring a camera (your phone counts), and find a few new perspectives around campus.",
    interests: ["Coffee", "Photography", "Design"],
    memberIds: ["jordan", "olivia", "zoe"],
    position: { lat: 40.4992, lng: -74.447 },
  },
  {
    id: "sunset-run",
    title: "Easy-paced campus run",
    venue: "Passion Puddle · Cook/Douglass",
    description:
      "A friendly loop around campus. All paces welcome; hang out afterward and find your next running or hiking buddy.",
    interests: ["Running", "Hiking"],
    memberIds: ["emily", "priya", "leo"],
    position: { lat: 40.484, lng: -74.436 },
  },
];
GATHERINGS.push({
  id: "livi-coffee",
  title: "Coffee between classes",
  venue: "Livingston Plaza",
  description:
    "A coffee break and a few new faces. Come hang out between lectures.",
  interests: ["Coffee", "Music"],
  memberIds: ["kiara", "ben"],
  position: { lat: 40.5224, lng: -74.438 },
});
// Membership is explicit sample data, never inferred from someone's coordinates.
// Always build groups from the already-filtered, privacy-eligible discovery result.
export function groupsFor(people: Person[]): VisibleGathering[] {
  return GATHERINGS.map((g) => ({
    ...g,
    members: g.memberIds
      .map((id) => people.find((p) => p.id === id))
      .filter((p): p is Person => !!p),
  })).filter((g) => g.members.length >= 2);
}
export function groupSummary(group: VisibleGathering): string {
  const names = group.members
    .slice(0, 2)
    .map((p) => p.firstName)
    .join(", ");
  const others = group.members.length - 2;
  return `${names}${others ? ` and ${others} other${others === 1 ? "" : "s"}` : ""} are at ${group.title}`;
}
export function ungroupedPeople(
  people: Person[],
  groups: VisibleGathering[],
): Person[] {
  const ids = new Set(groups.flatMap((g) => g.members.map((p) => p.id)));
  return people.filter((p) => !ids.has(p.id));
}
