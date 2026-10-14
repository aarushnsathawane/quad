import type { Person } from "./model";
export type MapProps = {
  people: Person[];
  selected: string | null;
  onSelect: (id: string) => void;
};
