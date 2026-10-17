import { useRef, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import MapControls from "./MapControls";
import { CAMPUSES, campusFor, type CampusId } from "./campuses";
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
  const [active, setActive] = useState<CampusId | "all">("all");
  const [overview, setOverview] = useState(true);
  const go = (id: CampusId | "all") => {
    setActive(id);
    const c = CAMPUSES.find((c) => c.id === id);
    map.current?.animateToRegion(
      c
        ? {
            latitude: c.lat,
            longitude: c.lng,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          }
        : CAMPUS,
      350,
    );
  };
  useEffect(() => {
    const p = people.find((x) => x.id === selected);
    if (p)
      map.current?.animateToRegion(
        {
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
          latitude: p.position.lat,
          longitude: p.position.lng,
        },
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
        onRegionChangeComplete={(region) =>
          setOverview(region.latitudeDelta > 0.035)
        }
      >
        {overview &&
          CAMPUSES.map((c) => {
            const members = people.filter(
              (p) => campusFor(p.position).id === c.id,
            );
            return members.length ? (
              <Marker
                key={c.id}
                coordinate={{ latitude: c.lat, longitude: c.lng }}
                title={`${c.name} · ${members.length} students`}
                onPress={() => go(c.id)}
              >
                <View
                  style={{
                    backgroundColor: C.surface,
                    padding: 3,
                    borderRadius: 25,
                    borderWidth: 2,
                    borderColor: C.accent,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Avatar person={members[0]} size={30} />
                  <Text
                    style={{
                      color: C.accent,
                      paddingHorizontal: 4,
                      fontWeight: "700",
                      fontSize: 11,
                    }}
                  >
                    {members.length}
                  </Text>
                </View>
              </Marker>
            ) : null;
          })}
        {!overview &&
          ungroupedPeople(people, groups).map((p) => (
            <Marker
              key={p.id}
              coordinate={{
                latitude: p.position.lat,
                longitude: p.position.lng,
              }}
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
                <Avatar person={p} size={28} />
              </View>
            </Marker>
          ))}
        {!overview &&
          groups.map((g) => (
            <Marker
              key={g.id}
              coordinate={{
                latitude: g.position.lat,
                longitude: g.position.lng,
              }}
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
                  padding: 3,
                  borderWidth: 2,
                  borderColor: C.accent,
                }}
              >
                {g.members.slice(0, 1).map((p, i) => (
                  <View key={p.id} style={{ marginLeft: i ? -12 : 0 }}>
                    <Avatar person={p} size={26} />
                  </View>
                ))}
                <View
                  style={{
                    backgroundColor: C.primary,
                    width: 20,
                    height: 20,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: -6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
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
      <MapControls active={active} onChange={go} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Center on Rutgers campus"
        style={styles.center}
        onPress={() => go("all")}
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
      width: 34,
      height: 34,
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
      top: 64,
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
