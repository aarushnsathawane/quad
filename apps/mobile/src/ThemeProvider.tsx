import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { palette, type Palette, type ThemeMode } from "./theme-values";
const KEY = "@quad/appearance/v1";
type Theme = {
  mode: ThemeMode;
  colors: Palette;
  changing: boolean;
  error: string | null;
  toggleMode: () => Promise<void>;
};
const Context = createContext<Theme | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light"),
    [ready, setReady] = useState(false),
    [changing, setChanging] = useState(false),
    [error, setError] = useState<string | null>(null);
  const working = useRef(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (active && (saved === "light" || saved === "dark")) setMode(saved);
      } catch {
        if (active)
          setError("Appearance could not be loaded. Light mode is shown.");
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const colors = useMemo(() => palette(mode), [mode]);
  const toggleMode = async () => {
    if (working.current) return;
    working.current = true;
    setChanging(true);
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    setError(null);
    try {
      await AsyncStorage.setItem(KEY, next);
    } catch {
      setMode(mode);
      setError("Could not save appearance. Please try again.");
    } finally {
      working.current = false;
      setChanging(false);
    }
  };
  return (
    <Context.Provider value={{ mode, colors, changing, error, toggleMode }}>
      {ready ? (
        children
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.paper,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
    </Context.Provider>
  );
}
export function useTheme() {
  const theme = useContext(Context);
  if (!theme) throw new Error("ThemeProvider is required.");
  return theme;
}
export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
