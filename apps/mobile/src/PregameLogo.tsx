import { View, Text, StyleSheet } from "react-native";
import { SvgXml } from "react-native-svg";
import { useTheme } from "./theme";

export default function PregameLogo() {
  const { colors: C } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel="Pregame by quad"
      style={styles.brand}
    >
      <View style={styles.logo}>
        <SvgXml
          xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="${C.primary}"/><path d="M12 29V11h10a6 6 0 0 1 0 12h-5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="m29 6 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="#fff"/></svg>`}
          width={36}
          height={36}
        />
        <Text style={[styles.wordmark, { color: C.ink }]}>pregame</Text>
      </View>
      <Text style={[styles.byline, { color: C.muted }]}>
        by{" "}
        <Text style={[styles.quad, { color: C.ink }]}>
          quad<Text style={{ color: C.primary }}>.</Text>
        </Text>
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
    flexWrap: "wrap",
  },
  logo: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: {
    fontSize: 32,
    fontWeight: "800",
    fontStyle: "italic",
    letterSpacing: -1.6,
  },
  byline: { fontSize: 13, marginTop: 10 },
  quad: { fontWeight: "800", letterSpacing: -0.4 },
});
