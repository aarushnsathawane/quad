import { Platform } from "react-native";
export { ThemeProvider, useTheme, useThemedStyles } from "./ThemeProvider";
export { SCHOOL } from "./theme-values";
export type { Palette, ThemeMode } from "./theme-values";
export const serif = Platform.OS === "android" ? "serif" : "Georgia";
