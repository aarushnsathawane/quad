export type Tag = { id: string; name: string; kind?: string };
export type Experience = {
  id?: string;
  title: string;
  organization_name: string;
  time_label: string;
  description: string;
};
export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  major: string;
  majorId: string;
  minorId: string | null;
  graduationYear: number | null;
  bio: string;
  avatarStyle: number;
  university: string;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  tags: Tag[];
  organizations: Tag[];
  experiences: Experience[];
  relationship: 'none' | 'incoming' | 'outgoing' | 'connected';
  similarity: { kind: string; text: string } | null;
  position?: { lat: number; lng: number };
  expiresAt?: string;
};
export type Audience = 'university' | 'connections' | 'nobody';
export type Data = {
  me: Person;
  nearby: Person[];
  connections: Person[];
  settings: { audience: Audience; visibleUntil: string | null };
  catalog: { tags: Tag[]; organizations: Tag[]; majors: Tag[] };
  blocked: { id: string; firstName: string; lastName: string }[];
  demo: boolean;
  campus: { lat: number; lng: number };
  locationFreshUntil: string | null;
};
export async function api<T = unknown>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(
    `/api/${path}`,
    body === undefined
      ? {}
      : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  const data = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(data.error || 'Please try again.'), { status: res.status });
  return data;
}
