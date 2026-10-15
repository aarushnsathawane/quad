import { useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { CAMPUS } from "./data";
import { useTheme, useThemedStyles, type Palette } from "./theme";
import { Icon, Avatar } from "./ui";
import { groupsFor, ungroupedPeople } from "./gatherings";
import type { MapProps } from "./map-types";
export default function CampusMap({
  people,
  selected,
  onSelect,
  onGathering,
}: MapProps) {
  const C = useTheme().colors;
  const styles = useThemedStyles(createStyles);

  const { mode } = useTheme();
  const map = useRef<MapView>(null);
  const groups = groupsFor(people);
  useEffect(() => {
    const p = people.find((x) => x.id === selected);
    if (p)
      map.current?.animateToRegion(
        { ...CAMPUS, latitude: p.position.lat, longitude: p.position.lng },
        350,
      );
  }, [selected]);
  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={CAMPUS}
        userInterfaceStyle={mode}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        rotateEnabled={false}
      >
        {ungroupedPeople(people, groups).map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.position.lat, longitude: p.position.lng }}
            title={`${p.firstName} ${p.lastName}`}
            description={p.major}
            onPress={() => onSelect(p.id)}
            tracksViewChanges={true}
          >
            <View
              style={[
                styles.pin,
                selected === p.id && {
                  borderColor: C.primary,
                  backgroundColor: C.soft,
                },
              ]}
            >
              <Avatar person={p} size={40} />
            </View>
          </Marker>
        ))}
        {groups.map((g) => (
          <Marker
            key={g.id}
            coordinate={{ latitude: g.position.lat, longitude: g.position.lng }}
            title={g.title}
            description={`${g.members.length} students · ${g.venue}`}
            onPress={() => onGathering?.(g.id)}
            tracksViewChanges={true}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: C.surface,
                borderRadius: 28,
                padding: 5,
                borderWidth: 2,
                borderColor: C.accent,
              }}
            >
              {g.members.slice(0, 2).map((p, i) => (
                <View key={p.id} style={{ marginLeft: i ? -12 : 0 }}>
                  <Avatar person={p} size={36} />
                </View>
              ))}
              <View
                style={{
                  backgroundColor: C.primary,
                  width: 27,
                  height: 27,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: -6,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: C.onPrimary,
                  }}
                >
                  {g.members.length}
                </Text>
              </View>
            </View>
          </Marker>
        ))}
      </MapView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Center on Rutgers campus"
        style={styles.center}
        onPress={() => map.current?.animateToRegion(CAMPUS, 350)}
      >
        <Icon name="locate" size={21} />
      </Pressable>
      <Text style={styles.caption}>Tap a group · Sample gatherings</Text>
    </View>
  );
}
const createStyles = (C: Palette) =>
  StyleSheet.create({
    pin: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 3,
      borderColor: C.surface,
      backgroundColor: C.soft,
      alignItems: "center",
      justifyContent: "center",
    },
    initials: { fontSize: 13, fontWeight: "600", color: C.accent },
    center: {
      position: "absolute",
      right: 13,
      top: 16,
      borderRadius: 13,
      backgroundColor: C.surface,
      padding: 12,
      boxShadow: "0 2px 8px #00000022",
    },
    caption: {
      position: "absolute",
      bottom: 8,
      right: 8,
      fontSize: 8,
      color: C.muted,
      backgroundColor: C.surface,
      padding: 4,
      borderRadius: 4,
    },
  });
