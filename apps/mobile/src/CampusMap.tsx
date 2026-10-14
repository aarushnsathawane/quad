import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SvgXml } from "react-native-svg";
import campus from "../assets/campus";
import { Avatar, Icon } from "./ui";
import { C } from "./theme";
import { groupsFor, groupSummary, ungroupedPeople } from "./gatherings";
import type { MapProps } from "./map-types";
export default function CampusMap({
  people,
  selected,
  onSelect,
  onGathering,
}: MapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const groups = groupsFor(people);
  const active = groups.find((g) => g.id === hovered);
  const position = (point: { lat: number; lng: number }) => ({
    left: `${Math.min(89, Math.max(3, 8 + ((point.lng + 74.456) / 0.011) * 78))}%` as `${number}%`,
    top: `${Math.min(79, Math.max(3, 8 + ((40.506 - point.lat) / 0.01) * 76))}%` as `${number}%`,
  });
  return (
    <View style={s.canvas}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <SvgXml
          xml={campus}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
        />
      </View>
      {ungroupedPeople(people, groups).map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`View ${p.firstName}'s profile`}
          onPress={() => onSelect(p.id)}
          style={[
            s.pin,
            position(p.position),
            selected === p.id && { borderColor: C.green, zIndex: 3 },
          ]}
        >
          <Avatar person={p} size={45} />
          <Text style={s.name}>{p.firstName}</Text>
        </Pressable>
      ))}
      {groups.map((g) => (
        <Pressable
          key={g.id}
          accessibilityRole="button"
          accessibilityLabel={`${g.members.length} students at ${g.title}, ${g.venue}`}
          onHoverIn={() => setHovered(g.id)}
          onHoverOut={() => setHovered(null)}
          onFocus={() => setHovered(g.id)}
          onBlur={() => setHovered(null)}
          onPress={() => onGathering?.(g.id)}
          style={[s.group, position(g.position)]}
        >
          <View style={s.faces}>
            {g.members.slice(0, 2).map((p, i) => (
              <View key={p.id} style={{ marginLeft: i ? -12 : 0 }}>
                <Avatar person={p} size={38} />
              </View>
            ))}
            <View style={s.count}>
              <Text style={s.countText}>{g.members.length}</Text>
            </View>
          </View>
          <Text style={s.groupName}>{g.title}</Text>
        </Pressable>
      ))}
      {active && (
        <View pointerEvents="none" style={s.preview}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Icon name="users" size={16} />
            <Text style={s.previewTitle}>{groupSummary(active)}</Text>
          </View>
          <Text style={s.venue}>{active.venue}</Text>
          <Text style={s.detail}>{active.description}</Text>
          <Text style={s.hint}>Sample gathering · Tap to see who’s here</Text>
        </View>
      )}
      <Text style={s.caption}>Hover or tap groups · Sample gatherings</Text>
    </View>
  );
}
const s = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: "#eeeee5",
    minHeight: 340,
    overflow: "hidden",
  },
  pin: {
    position: "absolute",
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "white",
    backgroundColor: C.white,
    alignItems: "center",
    marginLeft: -24,
    boxShadow: "0 2px 8px #35472a20",
  },
  name: {
    position: "absolute",
    top: 50,
    fontSize: 9,
    backgroundColor: "#fffefaeb",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    color: "#6f7d63",
  },
  group: {
    position: "absolute",
    alignItems: "center",
    marginLeft: -34,
    zIndex: 4,
  },
  faces: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    padding: 5,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#8ca66e",
    boxShadow: "0 3px 10px #3d542d25",
  },
  count: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -7,
    borderWidth: 2,
    borderColor: C.white,
  },
  countText: { fontSize: 12, fontWeight: "700", color: C.white },
  groupName: {
    fontSize: 9,
    color: C.green,
    fontWeight: "600",
    backgroundColor: "#fffefaf0",
    padding: 5,
    borderRadius: 6,
    marginTop: 5,
    maxWidth: 125,
    textAlign: "center",
  },
  preview: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 29,
    backgroundColor: C.white,
    borderRadius: 15,
    padding: 16,
    gap: 8,
    zIndex: 10,
    boxShadow: "0 6px 25px #25462b28",
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: C.green,
    flex: 1,
    lineHeight: 19,
  },
  venue: { fontSize: 11, color: C.ink, fontWeight: "500" },
  detail: { fontSize: 10, color: C.muted, lineHeight: 17 },
  hint: { fontSize: 8, color: "#8da373" },
  caption: {
    position: "absolute",
    bottom: 7,
    right: 8,
    fontSize: 8,
    color: "#829078",
    backgroundColor: "#fffefaab",
    padding: 3,
    borderRadius: 4,
  },
});
