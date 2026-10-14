import type { ReactNode } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SvgXml } from "react-native-svg";
import portraits from "../assets/portraits.json";
import { C, serif } from "./theme";
import type { Profile } from "./model";
const paths: Record<string, string> = {
  map: '<path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/>',
  profile: '<path d="m2 9 10-5 10 5-10 5L2 9Zm4 3v5q6 5 12 0v-5m4-3v8"/>',
  spark:
    '<path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z"/>',
  ghost:
    '<path d="M4 21V10a8 8 0 0 1 16 0v11l-4-3-4 3-4-3-4 3Z"/><path d="M9 10v2m6-2v2"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  shield:
    '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z"/><path d="m8 11 3 3 5-5"/>',
  settings:
    '<path d="M3 6h6m4 0h8M3 12h12m4 0h2M3 18h2m4 0h12M9 3v6m6 0v6M5 15v6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  flag: '<path d="M4 22V3q4-3 8 0t8 0v10q-4 3-8 0t-8 0"/>',
  leaf: '<path d="M20 3C5 1 0 13 6 18s17 0 14-15Z"/><path d="M3 22 15 10m-8 8v-6m0 6h6"/>',
  locate:
    '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
};
export function Icon({
  name,
  size = 20,
  color = C.green,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <SvgXml
      xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.info}</svg>`}
      width={size}
      height={size}
    />
  );
}
export function Avatar({
  person,
  size = 50,
}: {
  person: Pick<Profile, "avatar" | "firstName" | "lastName">;
  size?: number;
}) {
  return (
    <View
      accessibilityLabel={`${person.firstName} ${person.lastName}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: C.white,
        backgroundColor: C.sage,
      }}
    >
      <SvgXml
        xml={portraits[person.avatar] || portraits[0]}
        width="100%"
        height="100%"
      />
    </View>
  );
}
export function Button({
  children,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  icon,
  loading = false,
}: {
  children: ReactNode;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: string;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && { backgroundColor: C.red },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? C.green : C.white} />
      ) : (
        !!icon && (
          <Icon name={icon} size={17} color={secondary ? C.green : C.white} />
        )
      )}
      <Text style={[s.buttonText, secondary && { color: C.green }]}>
        {children}
      </Text>
    </Pressable>
  );
}
export function Chip({
  children,
  selected = false,
  onPress,
  disabled = false,
}: {
  children: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[s.chip, selected && s.chosen, disabled && { opacity: 0.4 }]}
    >
      <Text
        style={[s.chipText, selected && { color: C.green, fontWeight: "600" }]}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}
export function Reason({ text }: { text: string | null }) {
  return text ? (
    <View style={s.reason}>
      <Icon name="spark" size={15} color="#66854f" />
      <Text style={s.reasonText}>{text}</Text>
    </View>
  ) : null;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={s.empty}>
      <Icon name="leaf" size={30} color={C.accent} />
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyCopy}>{children}</Text>
    </View>
  );
}
export const s = StyleSheet.create({
  button: {
    backgroundColor: C.green,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 13,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  secondary: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  buttonText: { color: C.white, fontSize: 13, fontWeight: "600" },
  chip: {
    backgroundColor: "#f0f3e8",
    borderColor: "#e4e9d9",
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  chosen: { backgroundColor: "#e0eccd", borderColor: "#b9cf9e" },
  chipText: { fontSize: 11, color: "#75846a" },
  label: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "600",
    color: "#8b9a79",
    textTransform: "uppercase",
  },
  reason: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    padding: 11,
    backgroundColor: C.sage,
    borderRadius: 10,
  },
  reasonText: { fontSize: 11, color: "#68844e", lineHeight: 17, flex: 1 },
  empty: { alignItems: "center", gap: 12, padding: 30 },
  emptyTitle: {
    fontFamily: serif,
    fontSize: 23,
    color: C.ink,
    textAlign: "center",
  },
  emptyCopy: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
  },
});
