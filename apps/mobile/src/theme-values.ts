export type ThemeMode = "light" | "dark";
// Keep university branding in one place; the first launch is Rutgers-only.
export const SCHOOL = {
  id: "rutgers",
  name: "Rutgers University",
  primary: "#CC0033",
};
export function palette(mode: ThemeMode) {
  const dark = mode === "dark";
  return {
    primary: SCHOOL.primary,
    onPrimary: "#FFFFFF",
    onPrimaryMuted: "#ffe0e8",
    accent: dark ? "#FF91AD" : "#B4002D",
    ink: dark ? "#F5F5F7" : "#1D2026",
    muted: dark ? "#B7BAC4" : "#666B75",
    paper: dark ? "#101216" : "#F5F5F7",
    surface: dark ? "#1B1E25" : "#FFFFFF",
    line: dark ? "#3A3E49" : "#DFE1E6",
    soft: dark ? "#351F2A" : "#FFF0F3",
    cover: dark ? "#492332" : "#F9DCE4",
    outer: dark ? "#090A0D" : "#E9EAEE",
    overlay: dark ? "#000000B3" : "#16182075",
    danger: "#B4233D",
    mapBase: dark ? "#191D25" : "#ECEEF0",
  };
}
export type Palette = ReturnType<typeof palette>;
