export const CAMPUSES = [
  {
    id: "college",
    name: "College Avenue",
    short: "College Ave",
    lat: 40.502,
    lng: -74.4504,
  },
  { id: "busch", name: "Busch", short: "Busch", lat: 40.521, lng: -74.463 },
  {
    id: "livingston",
    name: "Livingston",
    short: "Livingston",
    lat: 40.522,
    lng: -74.436,
  },
  {
    id: "cook",
    name: "Cook/Douglass",
    short: "Cook/Douglass",
    lat: 40.4845,
    lng: -74.436,
  },
] as const;
export type CampusId = (typeof CAMPUSES)[number]["id"];
export function campusFor(position: { lat: number; lng: number }) {
  return CAMPUSES.reduce((best, campus) => {
    const distance = (c: (typeof CAMPUSES)[number]) =>
      (position.lat - c.lat) ** 2 + ((position.lng - c.lng) * 0.76) ** 2;
    return distance(campus) < distance(best) ? campus : best;
  });
}
