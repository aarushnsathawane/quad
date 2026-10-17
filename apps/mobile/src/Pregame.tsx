import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme, useThemedStyles, type Palette, serif } from "./theme";
import { Button, Chip, Icon, Label, Empty } from "./ui";
import { CAMPUSES, type CampusId } from "./campuses";
import { LINKUPS, parseRSVPs, type Linkup, type RSVP } from "./pregame-data";
const KEY = "@quad/pregame/v1";
export default function Pregame() {
  const { colors: C } = useTheme(),
    s = useThemedStyles(styles);
  const [feed, setFeed] = useState<"public" | "invite">("public"),
    [campus, setCampus] = useState<CampusId | "all">("all"),
    [selected, setSelected] = useState<Linkup | null>(null);
  const [rsvps, setRSVPs] = useState<Record<string, RSVP>>({}),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const working = useRef(false);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (alive) setRSVPs(parseRSVPs(raw));
      })
      .catch(() => {
        if (alive)
          setError("Saved RSVPs could not be loaded. Please try again.");
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  const respond = async (event: Linkup, status: RSVP | null) => {
    if (!ready || working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    const next = { ...rsvps };
    if (status) next[event.id] = status;
    else delete next[event.id];
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      setRSVPs(next);
    } catch {
      setError("Could not save your RSVP. Please try again.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const pending = LINKUPS.filter(
    (e) => e.kind === "invite" && !rsvps[e.id],
  ).length;
  const events = LINKUPS.filter(
    (e) => e.kind === feed && (campus === "all" || e.campus === campus),
  );
  const campusName = (e: Linkup) =>
    CAMPUSES.find((c) => c.id === e.campus)!.name;
  return (
    <View style={{ gap: 18 }}>
      <View style={s.hero}>
        <View style={s.topRow}>
          <View style={s.ribbon}>
            <Text style={s.ribbonText}>NEW</Text>
          </View>
          <Text style={s.kicker}>THE PLANS BEFORE THE PLANS</Text>
        </View>
        <Text style={s.heroTitle}>Good plans.{`\n`}Better company.</Text>
        <Text style={s.heroCopy}>
          From the first spike to the first hello. Find your people before the
          main event.
        </Text>
        <View style={s.heroBottom}>
          <Icon name="spark" color="#fff" size={17} />
          <Text style={s.heroNote}>Four campuses. One place to link up.</Text>
        </View>
      </View>
      <Text style={s.demo}>
        Sample events & invites · RSVPs stay on this device
      </Text>
      <View style={s.segments}>
        {(
          [
            { id: "public", label: "Public linkups" },
            {
              id: "invite",
              label: `Your invites${pending ? " · " + pending : ""}`,
            },
          ] as const
        ).map((f) => (
          <Pressable
            key={f.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: feed === f.id }}
            accessibilityLabel={f.id === "invite" ? "Your invites" : f.label}
            onPress={() => setFeed(f.id)}
            style={[s.segment, feed === f.id && s.segmentOn]}
          >
            <Text
              style={[
                s.segmentText,
                feed === f.id && { color: C.accent, fontWeight: "700" },
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        <Chip selected={campus === "all"} onPress={() => setCampus("all")}>
          All campuses
        </Chip>
        {CAMPUSES.map((c) => (
          <Chip
            key={c.id}
            selected={campus === c.id}
            onPress={() => setCampus(c.id)}
          >
            {c.short}
          </Chip>
        ))}
      </ScrollView>
      <View style={s.sectionRow}>
        <Label>
          {feed === "public"
            ? "Open invitation"
            : "A spot with your name on it"}
        </Label>
        <Text style={s.meta}>
          {events.length} {feed === "public" ? "linkups" : "invites"}
        </Text>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {events.map((e) => (
        <Pressable
          key={e.id}
          accessibilityRole="button"
          accessibilityLabel={`View ${e.title}`}
          onPress={() => setSelected(e)}
          style={s.card}
        >
          <View style={s.sectionRow}>
            <Text style={s.category}>{e.category.toUpperCase()}</Text>
            <Icon name={e.kind === "invite" ? "users" : "spark"} size={19} />
          </View>
          {e.kind === "invite" && (
            <Text style={s.invited}>{e.host} invited you</Text>
          )}
          <Text style={s.cardTitle}>{e.title}</Text>
          <Text style={s.meta}>{e.time}</Text>
          <View style={s.location}>
            <Icon name="map" size={14} />
            <Text style={s.locationText}>
              {e.kind === "invite" ? campusName(e) : e.venue} ·{" "}
              {e.kind === "public" ? campusName(e) : "Invite only"}
            </Text>
          </View>
          <View style={s.cardBottom}>
            <Text style={s.meta}>
              {e.going + (rsvps[e.id] === "going" ? 1 : 0)} going ·{" "}
              {e.kind === "public"
                ? `Hosted by ${e.host}`
                : "Friends of the host"}
            </Text>
            <Text style={s.action}>
              {rsvps[e.id] === "going"
                ? "✓ You’re going"
                : rsvps[e.id] === "declined"
                  ? "Declined · View"
                  : e.kind === "invite"
                    ? "Respond →"
                    : "See linkup →"}
            </Text>
          </View>
        </Pressable>
      ))}
      {!events.length && (
        <Empty title="No plans here yet">
          Try another campus to see more sample linkups.
        </Empty>
      )}
      <Text style={s.foot}>
        A little less “what’s the move?” A little more showing up.
      </Text>
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        <View style={s.backdrop}>
          <View
            accessibilityViewIsModal
            role="dialog"
            aria-label={selected?.title || "Linkup details"}
            aria-modal={true}
            style={s.sheet}
          >
            <View style={s.sectionRow}>
              <Label>
                {selected?.kind === "invite"
                  ? "Your personal invite"
                  : "Public linkup"}
              </Label>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close linkup"
                disabled={busy}
                onPress={() => setSelected(null)}
                hitSlop={12}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            {selected && (
              <ScrollView contentContainerStyle={{ gap: 18 }}>
                <Text style={s.heroTitleDark}>{selected.title}</Text>
                <Text style={s.invited}>
                  {selected.kind === "invite"
                    ? `${selected.host} invited you`
                    : `Hosted by ${selected.host}`}
                </Text>
                <Text style={s.locationText}>
                  {selected.time}
                  {"\n"}
                  {selected.venue}
                  {"\n"}
                  {campusName(selected)}
                </Text>
                <Text style={s.description}>{selected.description}</Text>
                <Text style={s.meta}>
                  {selected.going + (rsvps[selected.id] === "going" ? 1 : 0)}{" "}
                  going ·{" "}
                  {selected.kind === "invite"
                    ? "Invite only"
                    : "Open to the campus community"}
                </Text>
                <Text style={s.demo}>
                  This is a sample event. Your response is saved locally; no
                  host is notified.
                </Text>
                {!!error && (
                  <Text accessibilityRole="alert" style={s.error}>
                    {error}
                  </Text>
                )}
                <Button
                  loading={busy}
                  disabled={!ready}
                  onPress={() =>
                    respond(
                      selected,
                      rsvps[selected.id] === "going" ? null : "going",
                    )
                  }
                  icon={rsvps[selected.id] === "going" ? "check" : "plus"}
                >
                  {rsvps[selected.id] === "going"
                    ? "You’re going · Undo RSVP"
                    : selected.kind === "invite"
                      ? "Accept invite"
                      : "Join linkup"}
                </Button>
                {selected.kind === "invite" &&
                  rsvps[selected.id] !== "going" && (
                    <Button
                      secondary
                      disabled={busy || !ready}
                      onPress={() =>
                        respond(
                          selected,
                          rsvps[selected.id] === "declined" ? null : "declined",
                        )
                      }
                    >
                      {rsvps[selected.id] === "declined"
                        ? "Undo decline"
                        : "Decline invite"}
                    </Button>
                  )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = (C: Palette) =>
  StyleSheet.create({
    hero: {
      backgroundColor: C.primary,
      borderRadius: 22,
      padding: 24,
      gap: 17,
      overflow: "hidden",
    },
    topRow: { flexDirection: "row", alignItems: "center", gap: 9 },
    ribbon: {
      backgroundColor: "#fff",
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 4,
      transform: [{ rotate: "-5deg" }],
    },
    ribbonText: {
      fontSize: 10,
      letterSpacing: 1,
      fontWeight: "800",
      color: C.primary,
    },
    kicker: { fontSize: 8, letterSpacing: 1.5, color: "#ffe0e8", flex: 1 },
    heroTitle: {
      fontFamily: serif,
      fontSize: 36,
      lineHeight: 40,
      color: "#fff",
    },
    heroCopy: { fontSize: 12, lineHeight: 20, color: "#ffe0e8" },
    heroBottom: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      paddingTop: 8,
      borderTopWidth: 1,
      borderColor: "#ffffff44",
    },
    heroNote: { fontSize: 10, color: "#fff" },
    demo: { fontSize: 10, color: C.muted, lineHeight: 17 },
    segments: {
      flexDirection: "row",
      backgroundColor: C.soft,
      borderRadius: 12,
      padding: 4,
    },
    segment: { flex: 1, padding: 12, alignItems: "center", borderRadius: 9 },
    segmentOn: { backgroundColor: C.surface },
    segmentText: { fontSize: 12, color: C.muted },
    sectionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    meta: { fontSize: 10, color: C.muted, lineHeight: 17 },
    error: { color: C.accent, fontSize: 12 },
    card: {
      padding: 20,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.line,
      backgroundColor: C.surface,
      gap: 10,
    },
    category: {
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 1,
      color: C.accent,
    },
    invited: { fontSize: 12, color: C.accent, fontWeight: "600" },
    cardTitle: { fontFamily: serif, fontSize: 25, color: C.ink },
    location: { flexDirection: "row", gap: 6, alignItems: "center" },
    locationText: { fontSize: 11, color: C.ink, lineHeight: 20, flexShrink: 1 },
    cardBottom: {
      borderTopWidth: 1,
      borderColor: C.line,
      paddingTop: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8,
    },
    action: { color: C.accent, fontWeight: "600", fontSize: 11 },
    foot: {
      textAlign: "center",
      fontFamily: serif,
      fontStyle: "italic",
      color: C.muted,
      fontSize: 13,
      paddingVertical: 16,
    },
    backdrop: {
      flex: 1,
      backgroundColor: C.overlay,
      justifyContent: "flex-end",
      alignItems: "center",
    },
    sheet: {
      width: "100%",
      maxWidth: 520,
      maxHeight: "85%",
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
      gap: 24,
    },
    heroTitleDark: { fontFamily: serif, fontSize: 32, color: C.ink },
    description: { fontSize: 13, lineHeight: 22, color: C.ink },
  });
