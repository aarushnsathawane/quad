import type { Person } from './model';
// Server presence uses fixed coarse cells. Keep people sharing a cell selectable
// instead of drawing avatars on top of each other. Callers supply authorized peers.
export function clusterPeople(people: Person[], now = Date.now()) {
  const cells = new Map<string, { id: string; position: Person['position']; members: Person[] }>();
  for (const person of people) {
    if (
      person.onMap === false ||
      (person.presenceExpiresAt != null && person.presenceExpiresAt <= now)
    )
      continue;
    const id = `${person.position.lat.toFixed(4)},${person.position.lng.toFixed(4)}`;
    const cell = cells.get(id) || { id, position: person.position, members: [] };
    cell.members.push(person);
    cells.set(id, cell);
  }
  return [...cells.values()];
}
