import { ScrollView, View, StyleSheet } from "react-native";
import { Chip } from "./ui";
import { CAMPUSES, type CampusId } from "./campuses";
export default function MapControls({
  active,
  onChange,
}: {
  active: CampusId | "all";
  onChange: (id: CampusId | "all") => void;
}) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Chip selected={active === "all"} onPress={() => onChange("all")}>
          All campuses
        </Chip>
        {CAMPUSES.map((c) => (
          <Chip
            key={c.id}
            selected={active === c.id}
            onPress={() => onChange(c.id)}
          >
            {c.short}
          </Chip>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 10, left: 10, right: 10, zIndex: 1000 },
  row: { gap: 6, paddingBottom: 6 },
});
