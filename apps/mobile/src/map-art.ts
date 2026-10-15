import campus from "../assets/campus";
import type { ThemeMode } from "./theme-values";
const light: Record<string, string> = {
  "#eeeee5": "#eceef0",
  "#a8b697": "#b6bdb6",
  "#b0c5cb": "#aebfc9",
  "#cbdde0": "#d2e0e8",
  "#d9e1c9": "#e1e5df",
  "#d8e1cb": "#e0e5df",
  "#d5d5ca": "#d3d6da",
  "#fcfbf5": "#ffffff",
  "#f7f6ef": "#f8f9fa",
  "#dedfd5": "#d9dde2",
  "#d9dcd0": "#d6dbe0",
  "#e1dfd4": "#e0e2e6",
  "#d9dbd0": "#dadde1",
  "#ced1c5": "#cbd1d7",
  "#b7c9a7": "#bac9bd",
  "#85947b": "#717e78",
  "#a1a49a": "#818891",
  "#8faeb5": "#7d9bab",
};
const dark: Record<string, string> = {
  "#eeeee5": "#191d25",
  "#a8b697": "#34443c",
  "#b0c5cb": "#294453",
  "#cbdde0": "#152d3b",
  "#d9e1c9": "#20312d",
  "#d8e1cb": "#24342f",
  "#d5d5ca": "#3b4350",
  "#fcfbf5": "#303743",
  "#f7f6ef": "#39483f",
  "#dedfd5": "#2a303c",
  "#d9dcd0": "#303644",
  "#e1dfd4": "#2e3541",
  "#d9dbd0": "#333b48",
  "#ced1c5": "#414b59",
  "#b7c9a7": "#3a5145",
  "#85947b": "#a9b6ae",
  "#a1a49a": "#96a4b5",
  "#8faeb5": "#759caf",
};
export function campusArt(mode: ThemeMode) {
  const colors = mode === "dark" ? dark : light;
  return campus.replace(/#[0-9a-fA-F]{6}/g, (color) => colors[color] || color);
}
