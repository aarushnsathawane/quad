import { useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { CAMPUS } from "./data";
import { C } from "./theme";
import { Icon, Avatar } from "./ui";
import type { MapProps } from "./map-types";
export default function CampusMap({ people, selected, onSelect }: MapProps) {
  const map = useRef<MapView>(null);
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
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        rotateEnabled={false}
      >
        {people.map((p) => (
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
                  borderColor: C.green,
                  backgroundColor: "#e1edcc",
                },
              ]}
            >
              <Avatar person={p} size={40} />
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
      <Text style={styles.caption}>
        Fictional students · Approximate positions
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  pin: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    borderColor: C.white,
    backgroundColor: "#e8eedf",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontSize: 13, fontWeight: "600", color: C.green },
  center: {
    position: "absolute",
    right: 13,
    top: 16,
    borderRadius: 13,
    backgroundColor: C.white,
    padding: 12,
    boxShadow: "0 2px 8px #35472a20",
  },
  caption: {
    position: "absolute",
    bottom: 8,
    right: 8,
    fontSize: 8,
    color: C.muted,
    backgroundColor: "#fffefaeb",
    padding: 4,
    borderRadius: 4,
  },
});
