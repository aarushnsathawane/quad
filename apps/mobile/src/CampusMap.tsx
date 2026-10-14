import { View, Text, Pressable, StyleSheet } from "react-native";
import { SvgXml } from "react-native-svg";
import campus from "../assets/campus";
import { Avatar } from "./ui";
import { C } from "./theme";
import type { MapProps } from "./map-types";
export default function CampusMap({ people, selected, onSelect }: MapProps) {
  return (
    <View style={styles.canvas}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <SvgXml
          xml={campus}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
        />
      </View>
      {people.map((p) => {
        const x = 8 + ((p.position.lng + 74.456) / 0.011) * 78;
        const y = 8 + ((40.506 - p.position.lat) / 0.01) * 76;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`View ${p.firstName}'s profile`}
            onPress={() => onSelect(p.id)}
            style={[
              styles.pin,
              {
                left: `${Math.min(89, Math.max(3, x))}%`,
                top: `${Math.min(79, Math.max(3, y))}%`,
              },
              selected === p.id && { zIndex: 3, borderColor: C.green },
            ]}
          >
            <Avatar person={p} size={45} />
            <Text style={styles.name}>{p.firstName}</Text>
          </Pressable>
        );
      })}
      <Text style={styles.caption}>
        Illustrated browser map · Fictional students
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
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
  caption: {
    position: "absolute",
    bottom: 7,
    right: 8,
    fontSize: 7,
    color: "#829078",
    backgroundColor: "#fffefaab",
    padding: 3,
    borderRadius: 4,
  },
});
