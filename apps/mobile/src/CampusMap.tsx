import { createElement, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as L from "leaflet";
import "./map.css";
import portraits from "../assets/portraits.json";
import { useTheme } from "./theme";
import { CAMPUSES, campusFor, type CampusId } from "./campuses";
import MapControls from "./MapControls";
import { groupsFor, groupSummary, ungroupedPeople } from "./gatherings";
import type { MapProps } from "./map-types";
const bounds: L.LatLngBoundsExpression = [
  [40.475, -74.478],
  [40.533, -74.424],
];
export default function CampusMap({
  people,
  selected,
  onSelect,
  onGathering,
}: MapProps) {
  const { colors: C, mode } = useTheme();
  const host = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    layer = useRef<L.LayerGroup | null>(null);
  const callbacks = useRef({ onSelect, onGathering });
  callbacks.current = { onSelect, onGathering };
  const [campus, setCampus] = useState<CampusId | "all">("all"),
    [zoom, setZoom] = useState(12),
    [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
      minZoom: 11,
      maxZoom: 19,
    });
    map.current = m;
    m.fitBounds(bounds, { padding: [20, 60] });
    layer.current = L.layerGroup().addTo(m);
    m.on("zoomend", () => setZoom(m.getZoom()));
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    setTileError(false);
    m.getPane("tilePane")!.style.filter =
      mode === "dark"
        ? "invert(1) hue-rotate(180deg) saturate(0.3) brightness(0.8) contrast(0.9)"
        : "saturate(0.35)";
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',

        maxZoom: 19,
      },
    ).addTo(m);
    tiles.on("tileerror", () => setTileError(true));
    return () => {
      tiles.remove();
    };
  }, [mode]);
  const go = (id: CampusId | "all") => {
    setCampus(id);
    const c = CAMPUSES.find((c) => c.id === id);
    if (c) map.current?.setView([c.lat, c.lng], 16);
    else map.current?.fitBounds(bounds, { padding: [20, 60] });
  };
  useEffect(() => {
    const m = map.current,
      l = layer.current;
    if (!m || !l) return;
    l.clearLayers();
    const pin = (
      position: { lat: number; lng: number },
      label: string,
      avatar: number,
      count: number | null,
      action: () => void,
      tip?: string,
    ) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", label);
      Object.assign(button.style, {
        width: count ? "42px" : "30px",
        height: count ? "42px" : "30px",
        border: `2px solid ${C.surface}`,
        borderRadius: "50%",
        background: C.surface,
        padding: "0",
        position: "relative",
        cursor: "pointer",
        boxShadow: "0 2px 8px #0004",
        outlineOffset: "3px",
      });
      const img = document.createElement("img");
      img.src =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(portraits[avatar] || portraits[0]);
      img.alt = "";
      Object.assign(img.style, {
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        display: "block",
      });
      button.append(img);
      if (count) {
        const badge = document.createElement("span");
        badge.textContent = String(count);
        Object.assign(badge.style, {
          position: "absolute",
          bottom: "-4px",
          right: "-6px",
          background: C.primary,
          color: "#fff",
          border: `2px solid ${C.surface}`,
          borderRadius: "12px",
          fontSize: "10px",
          fontWeight: "700",
          padding: "2px 4px",
        });
        button.append(badge);
      }
      L.DomEvent.disableClickPropagation(button);
      button.addEventListener("click", action);
      const marker = L.marker([position.lat, position.lng], {
        icon: L.divIcon({
          html: button,
          className: "quad-map-marker",
          iconSize: [count ? 42 : 30, count ? 42 : 30],
          iconAnchor: [count ? 21 : 15, count ? 21 : 15],
        }),
        keyboard: false,
      }).addTo(l);
      const tooltip = document.createElement("div");
      tooltip.textContent = tip || label;
      Object.assign(tooltip.style, {
        maxWidth: "210px",
        whiteSpace: "normal",
        lineHeight: "1.5",
      });
      marker.bindTooltip(tooltip, { direction: "top", offset: [0, -16] });
      button.addEventListener("focus", () => marker.openTooltip());
      button.addEventListener("blur", () => marker.closeTooltip());
    };
    if (zoom < 15) {
      CAMPUSES.forEach((c) => {
        const members = people.filter((p) => campusFor(p.position).id === c.id);
        if (!members.length) return;
        pin(
          c,
          `Explore ${c.name}: ${members.length} students`,
          members[0].avatar,
          members.length,
          () => go(c.id),
          `${members
            .slice(0, 2)
            .map((p) => p.firstName)
            .join(
              ", ",
            )}${members.length > 2 ? " and " + (members.length - 2) + " others" : ""} are around ${c.name}. Tap to explore.`,
        );
      });
    } else {
      const groups = groupsFor(people);
      ungroupedPeople(people, groups).forEach((p) =>
        pin(p.position, `View ${p.firstName}'s profile`, p.avatar, null, () =>
          callbacks.current.onSelect(p.id),
        ),
      );
      groups.forEach((g) =>
        pin(
          g.position,
          `${g.members.length} students at ${g.title}, ${g.venue}`,
          g.members[0].avatar,
          g.members.length,
          () => callbacks.current.onGathering?.(g.id),
          groupSummary(g) + " · " + g.venue,
        ),
      );
    }
  }, [people, zoom, C]);
  useEffect(() => {
    const p = people.find((p) => p.id === selected);
    if (p) {
      setCampus(campusFor(p.position).id);
      map.current?.setView([p.position.lat, p.position.lng], 16);
    }
  }, [selected]);
  return (
    <View style={{ flex: 1, minHeight: 380, backgroundColor: C.mapBase }}>
      {createElement("div", {
        ref: host,
        "aria-label": "Interactive Rutgers campus map",
        role: "region",
        style: { position: "absolute", inset: 0, zIndex: 0 },
      })}
      <MapControls active={campus} onChange={go} />
      <View style={styles.zoom}>
        {[
          { label: "Zoom in", text: "+", action: () => map.current?.zoomIn() },
          {
            label: "Zoom out",
            text: "−",
            action: () => map.current?.zoomOut(),
          },
          {
            label: "Show all Rutgers campuses",
            text: "⌖",
            action: () => go("all"),
          },
        ].map((b) => (
          <Pressable
            key={b.label}
            accessibilityRole="button"
            accessibilityLabel={b.label}
            onPress={b.action}
            style={{
              backgroundColor: C.surface,
              padding: 10,
              borderBottomWidth: 1,
              borderColor: C.line,
            }}
          >
            <Text style={{ color: C.ink, fontSize: 20, textAlign: "center" }}>
              {b.text}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text
        pointerEvents="none"
        style={[styles.caption, { color: C.muted, backgroundColor: C.surface }]}
      >
        {tileError
          ? "Map tiles unavailable · Check your connection"
          : "Drag to explore · Pinch or use + / − · Sample students"}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  zoom: {
    position: "absolute",
    right: 10,
    bottom: 60,
    zIndex: 1000,
    borderRadius: 14,
    overflow: "hidden",
  },
  caption: {
    position: "absolute",
    bottom: 22,
    left: 8,
    right: 8,
    fontSize: 9,
    padding: 5,
    borderRadius: 5,
    textAlign: "center",
    zIndex: 1000,
  },
});
