import type { CampusId } from "./campuses";
export type Linkup = {
  id: string;
  title: string;
  kind: "public" | "invite";
  campus: CampusId;
  venue: string;
  time: string;
  host: string;
  going: number;
  category: string;
  description: string;
};
export type RSVP = "going" | "declined";
export const LINKUPS: Linkup[] = [
  {
    id: "spikeball",
    title: "Pre-football spikeball",
    kind: "public",
    campus: "college",
    venue: "The Yard",
    time: "Saturday · 11:00 AM",
    host: "Maya",
    going: 14,
    category: "Game day",
    description:
      "A few friendly rounds before kickoff. Bring a friend or come solo; we’ll make teams when you get here.",
  },
  {
    id: "tailgate",
    title: "Scarlet Saturday tailgate",
    kind: "public",
    campus: "busch",
    venue: "SHI Stadium area",
    time: "Saturday · 12:00 PM",
    host: "Sam",
    going: 28,
    category: "Game day",
    description:
      "Meet other Scarlet Knights before the game. Look for the scarlet picnic blanket; bring your game-day energy.",
  },
  {
    id: "livi",
    title: "Livi lawn games",
    kind: "public",
    campus: "livingston",
    venue: "Livingston Plaza",
    time: "Friday · 4:30 PM",
    host: "Kiara",
    going: 9,
    category: "Hangout",
    description:
      "Cornhole, a playlist, and a low-key start to the weekend. Everyone’s welcome.",
  },
  {
    id: "puddle",
    title: "Golden hour before going out",
    kind: "public",
    campus: "cook",
    venue: "Passion Puddle",
    time: "Friday · 5:00 PM",
    host: "Emily",
    going: 7,
    category: "Hangout",
    description:
      "Catch the sunset, meet some new people, and figure out the rest of the evening together.",
  },
  {
    id: "alex-invite",
    title: "Pre-frat linkup",
    kind: "invite",
    campus: "college",
    venue: "Alex’s place · College Avenue",
    time: "Friday · 8:00 PM",
    host: "Alex",
    going: 6,
    category: "Personal invite",
    description:
      "Alex invited you to meet a few friends before heading out. A small group, a good playlist, and time to catch up.",
  },
  {
    id: "house-invite",
    title: "House party",
    kind: "invite",
    campus: "college",
    venue: "Jordan’s place · College Avenue",
    time: "Saturday · 8:30 PM",
    host: "Jordan",
    going: 12,
    category: "Personal invite",
    description:
      "Jordan invited you over for a house party with friends from around campus. RSVP so your host knows to expect you.",
  },
];
export function parseRSVPs(raw: string | null): Record<string, RSVP> {
  if (!raw) return {};
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid saved RSVPs");
  return Object.fromEntries(
    Object.entries(value).filter(
      ([id, status]) =>
        LINKUPS.some((e) => e.id === id) &&
        (status === "going" || status === "declined"),
    ),
  ) as Record<string, RSVP>;
}
