import { Platform } from "react-native";
export const C = {
  green: "#24523e",
  ink: "#283e34",
  muted: "#788572",
  paper: "#f8f9f3",
  white: "#fffefa",
  line: "#e3e8da",
  sage: "#edf3e3",
  accent: "#85a162",
  red: "#a84e43",
};
export const serif =
  Platform.OS === "ios"
    ? "Georgia"
    : Platform.OS === "android"
      ? "serif"
      : "Georgia";
