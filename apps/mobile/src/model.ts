export type Relationship = "incoming" | "outgoing" | "connected";
export type Audience = "university" | "connections" | "nobody";
export type Experience = {
  title: string;
  organization: string;
  when: string;
  description: string;
};
export type Profile = {
  firstName: string;
  lastName: string;
  major: string;
  year: number | null;
  bio: string;
  avatar: number;
  interests: string[];
  clubs: string[];
  experiences: Experience[];
};
export type Person = Profile & {
  id: string;
  position: { lat: number; lng: number };
  sampleConnections: string[];
};
export type Visibility = {
  audience: Audience;
  until: number | null;
  presenceUpdatedAt: number | null;
};
export type Report = {
  id: string;
  personId: string;
  reason: string;
  details: string;
  createdAt: number;
};
export type State = {
  version: 1;
  entered: boolean;
  me: Profile;
  connections: Record<string, Relationship>;
  blocked: string[];
  reports: Report[];
  visibility: Visibility;
  messages?: Record<string, Message[]>;
};
export const FRESHNESS_MS = 15 * 60 * 1000;
export function connectionAction(
  state: State,
  id: string,
  action: "request" | "accept" | "remove",
): State {
  if (id === "you" || state.blocked.includes(id))
    throw new Error("This person is unavailable.");
  const connections = { ...state.connections };
  const status = connections[id];
  if (action === "request") {
    if (status) throw new Error("A request or connection already exists.");
    connections[id] = "outgoing";
  } else if (action === "accept") {
    if (status !== "incoming")
      throw new Error("Only received requests can be accepted.");
    connections[id] = "connected";
  } else delete connections[id];
  return { ...state, connections };
}
export function blockPerson(state: State, id: string): State {
  if (id === "you") throw new Error("You cannot block yourself.");
  const connections = { ...state.connections };
  delete connections[id];
  return {
    ...state,
    connections,
    blocked: [...new Set([...state.blocked, id])],
  };
}
export function unblockPerson(state: State, id: string): State {
  return { ...state, blocked: state.blocked.filter((x) => x !== id) };
}
export function setVisibility(
  state: State,
  audience: Audience,
  minutes: number | null,
  now = Date.now(),
): State {
  if (minutes !== null && (!Number.isFinite(minutes) || minutes <= 0))
    throw new Error("Choose a future expiry.");
  return {
    ...state,
    visibility: {
      audience,
      until:
        audience === "nobody" || minutes === null
          ? null
          : now + minutes * 60000,
      presenceUpdatedAt: audience === "nobody" ? null : now,
    },
  };
}
export function isVisible(visibility: Visibility, now = Date.now()): boolean {
  return (
    visibility.audience !== "nobody" &&
    (visibility.until === null || visibility.until > now) &&
    visibility.presenceUpdatedAt !== null &&
    visibility.presenceUpdatedAt + FRESHNESS_MS > now
  );
}
export function similarity(
  me: Profile,
  person: Person,
  connections: State["connections"],
): string | null {
  const club = person.clubs.find((c) => me.clubs.includes(c));
  if (club) return `You're both in ${club}`;
  const mutuals = person.sampleConnections.filter(
    (id) => connections[id] === "connected",
  ).length;
  if (mutuals) return `${mutuals} mutual connection${mutuals === 1 ? "" : "s"}`;
  if (me.major === person.major && me.major !== "Undeclared")
    return `You both study ${me.major}`;
  const shared = person.interests.filter((i) => me.interests.includes(i));
  return shared.length
    ? `You both like ${shared.slice(0, 2).join(" and ")}`
    : null;
}
export function canDiscover(state: State, id: string): boolean {
  return id !== "you" && !state.blocked.includes(id);
}
export function validateProfile(p: Profile): Profile {
  if (
    !p.firstName.trim() ||
    !p.lastName.trim() ||
    p.firstName.length > 40 ||
    p.lastName.length > 40
  )
    throw new Error("Add a first and last name, up to 40 characters each.");
  if (
    !p.major.trim() ||
    p.bio.length > 240 ||
    p.interests.length > 8 ||
    p.clubs.length > 6
  )
    throw new Error("Check your profile limits.");
  if (
    p.year !== null &&
    (!Number.isInteger(p.year) || p.year < 2020 || p.year > 2040)
  )
    throw new Error("Choose a graduation year between 2020 and 2040.");
  if (
    p.experiences.length > 5 ||
    p.experiences.some(
      (e) =>
        !e.title.trim() ||
        e.title.length > 80 ||
        e.organization.length > 80 ||
        e.when.length > 40 ||
        e.description.length > 240,
    )
  )
    throw new Error("Each experience needs a short title.");
  return {
    ...p,
    firstName: p.firstName.trim(),
    lastName: p.lastName.trim(),
    interests: [...new Set(p.interests)],
    clubs: [...new Set(p.clubs)],
  };
}
export function parseSavedState(raw: string): State {
  const s = JSON.parse(raw) as State;
  if (
    s.version !== 1 ||
    typeof s.entered !== "boolean" ||
    !s.me ||
    !Array.isArray(s.me.interests) ||
    !s.me.interests.every((x) => typeof x === "string") ||
    !Array.isArray(s.me.clubs) ||
    !s.me.clubs.every((x) => typeof x === "string") ||
    !Array.isArray(s.me.experiences) ||
    !Array.isArray(s.blocked) ||
    !Array.isArray(s.reports) ||
    !s.connections ||
    !s.visibility ||
    !["university", "connections", "nobody"].includes(s.visibility.audience) ||
    Object.values(s.connections).some(
      (v) => !["incoming", "outgoing", "connected"].includes(v),
    )
  )
    throw new Error("Saved demo data could not be read.");
  validateProfile(s.me);
  if (
    s.messages !== undefined &&
    (typeof s.messages !== "object" ||
      s.messages === null ||
      Array.isArray(s.messages) ||
      Object.values(s.messages).some(
        (thread) =>
          !Array.isArray(thread) ||
          thread.some(
            (m) =>
              !m ||
              typeof m.id !== "string" ||
              typeof m.text !== "string" ||
              !["you", "them"].includes(m.author) ||
              !Number.isFinite(m.createdAt),
          ),
      ))
  )
    throw new Error("Saved messages could not be read.");
  return s;
}

export type Message = {
  id: string;
  author: "you" | "them";
  text: string;
  createdAt: number;
};
export function addMessage(
  state: State,
  personId: string,
  text: string,
  now = Date.now(),
): State {
  if (
    state.connections[personId] !== "connected" ||
    state.blocked.includes(personId)
  )
    throw new Error("Messaging is available to accepted connections only.");
  const body = text.trim();
  if (!body || body.length > 1000)
    throw new Error("Write a message of 1–1,000 characters.");
  const thread = state.messages?.[personId] || [];
  return {
    ...state,
    messages: {
      ...state.messages,
      [personId]: [
        ...thread,
        {
          id: `${now}-${thread.length}`,
          author: "you",
          text: body,
          createdAt: now,
        },
      ],
    },
  };
}
