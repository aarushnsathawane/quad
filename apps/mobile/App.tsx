import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CampusMap from "./src/CampusMap";
import { CATALOG, PEOPLE, initialState } from "./src/data";
import {
  blockPerson,
  canDiscover,
  connectionAction,
  isVisible,
  parseSavedState,
  setVisibility,
  similarity,
  unblockPerson,
  validateProfile,
  type Audience,
  type Person,
  type Profile,
  type State,
} from "./src/model";
import { Avatar, Button, Chip, Empty, Icon, Label, Reason } from "./src/ui";
import { C, serif } from "./src/theme";
const STORAGE_KEY = "@quad/mobile-demo/v1";
type Tab = "map" | "connections" | "profile";
type Dialog =
  | "profile"
  | "edit"
  | "visibility"
  | "report"
  | "block"
  | "disconnect"
  | "about"
  | null;
type Filter = "everyone" | "interests" | "clubs" | "connections";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Quad />
    </SafeAreaProvider>
  );
}
function Quad() {
  const [state, setState] = useState<State>(initialState),
    [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false),
    [toast, setToast] = useState("");
  const [tab, setTab] = useState<Tab>("map"),
    [dialog, setDialog] = useState<Dialog>(null),
    [selected, setSelected] = useState<string | null>(null),
    [subject, setSubject] = useState<string | null>(null),
    [filter, setFilter] = useState<Filter>("everyone"),
    [search, setSearch] = useState(""),
    [connectionTab, setConnectionTab] = useState<
      "connected" | "incoming" | "outgoing"
    >("connected"),
    [now, setNow] = useState(Date.now());
  const working = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) setState(parseSavedState(raw));
      } catch {
        if (!cancelled)
          setToast(
            "Saved demo data could not be loaded. A fresh preview is shown.",
          );
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const subscription = AppState.addEventListener("change", (value) => {
      if (value === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  const update = async (transform: (s: State) => State, message?: string) => {
    if (working.current) return false;
    working.current = true;
    setSaving(true);
    try {
      const next = transform(state);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setState(next);
      if (message) setToast(message);
      return true;
    } catch (e) {
      setToast(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
      return false;
    } finally {
      working.current = false;
      setSaving(false);
    }
  };
  const discoverable = useMemo(
    () => PEOPLE.filter((p) => canDiscover(state, p.id)),
    [state.blocked],
  );
  const people = useMemo(
    () =>
      discoverable
        .filter((p) => {
          const q = search.trim().toLowerCase();
          return (
            (!q ||
              [p.firstName, p.lastName, p.major, ...p.interests, ...p.clubs]
                .join(" ")
                .toLowerCase()
                .includes(q)) &&
            (filter === "everyone" ||
              (filter === "connections" &&
                state.connections[p.id] === "connected") ||
              (filter === "clubs" &&
                p.clubs.some((c) => state.me.clubs.includes(c))) ||
              (filter === "interests" &&
                p.interests.some((i) => state.me.interests.includes(i))))
          );
        })
        .sort(
          (a, b) =>
            Number(!!similarity(state.me, b, state.connections)) -
              Number(!!similarity(state.me, a, state.connections)) ||
            a.firstName.localeCompare(b.firstName),
        ),
    [discoverable, search, filter, state.me, state.connections],
  );
  const current = people.find((p) => p.id === selected);
  const person = PEOPLE.find((p) => p.id === subject);
  const received = discoverable.filter(
    (p) => state.connections[p.id] === "incoming",
  ).length;
  const sharing = isVisible(state.visibility, now);
  const enabled =
    state.visibility.audience !== "nobody" &&
    (state.visibility.until === null || state.visibility.until > now);
  const showPerson = (p: Person) => {
    setSubject(p.id);
    setDialog("profile");
  };
  const connect = async (p: Person) => {
    const status = state.connections[p.id];
    if (status === "connected") {
      setSubject(p.id);
      setDialog("disconnect");
      return;
    }
    const action =
      status === "incoming"
        ? "accept"
        : status === "outgoing"
          ? "remove"
          : "request";
    await update(
      (s) => connectionAction(s, p.id, action),
      action === "request"
        ? `Request sent to ${p.firstName}.`
        : action === "accept"
          ? `You and ${p.firstName} are connected.`
          : "Request withdrawn.",
    );
  };
  const connectionButton = (p: Person) => {
    const status = state.connections[p.id];
    return (
      <Button
        disabled={saving}
        onPress={() => connect(p)}
        secondary={status === "outgoing" || status === "connected"}
        icon={status ? "check" : "plus"}
      >
        {status === "connected"
          ? "Connected"
          : status === "incoming"
            ? "Accept request"
            : status === "outgoing"
              ? "Cancel request"
              : "Connect"}
      </Button>
    );
  };
  if (!ready)
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={C.green} />
        <Text style={styles.loadingText}>Finding your corner of campus…</Text>
      </SafeAreaView>
    );
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <View
        style={styles.frame}
        importantForAccessibility={dialog ? "no-hide-descendants" : "auto"}
        aria-hidden={dialog !== null}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quad home"
            onPress={() => setTab("map")}
            style={styles.brand}
          >
            <View style={styles.logo}>
              <Text style={styles.logoText}>Q</Text>
            </View>
            <Text style={styles.brandText}>
              quad<Text style={{ color: C.accent }}>.</Text>
            </Text>
          </Pressable>
          <View style={styles.headerRight}>
            <Text style={styles.rutgers}>R</Text>
            <Text style={styles.campusName}>Rutgers</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="About this demo"
              onPress={() => setDialog("about")}
            >
              <Text style={styles.demoBadge}>DEMO</Text>
            </Pressable>
          </View>
        </View>
        {!state.entered ? (
          <ScrollView
            contentContainerStyle={styles.welcome}
            showsVerticalScrollIndicator={false}
          >
            <Label>A smaller world starts here</Label>
            <Text style={styles.welcomeTitle}>
              Your campus.{`\n`}Your{" "}
              <Text style={{ color: "#819967", fontStyle: "italic" }}>
                people.
              </Text>
            </Text>
            <Text style={styles.welcomeCopy}>
              There’s a good conversation around every corner. Find the people
              you already have something in common with.
            </Text>
            <View style={styles.welcomeMap}>
              <CampusMap
                people={PEOPLE.slice(0, 7)}
                selected={null}
                onSelect={() => {}}
              />
            </View>
            <Reason text="A familiar face starts with a little common ground." />
            <Button
              loading={saving}
              onPress={() => update((s) => ({ ...s, entered: true }))}
              icon="arrow"
            >
              Explore the campus demo
            </Button>
            <Text style={styles.welcomeNote}>
              Fictional students · No account needed · Saved on this device
            </Text>
          </ScrollView>
        ) : (
          <>
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.intro}>
                <Label>
                  {tab === "map"
                    ? "Your campus, connected"
                    : tab === "connections"
                      ? "A few familiar faces"
                      : "A little more you"}
                </Label>
                <Text style={styles.title}>
                  {tab === "map"
                    ? "Find your people."
                    : tab === "connections"
                      ? "Your campus circle."
                      : "Your corner of campus."}
                </Text>
                <Text style={styles.subtitle}>
                  {tab === "map"
                    ? "A little common ground. A good reason to say hello."
                    : tab === "connections"
                      ? "Good conversations don’t have to end here."
                      : "Keep it casual. Give someone a reason to say hello."}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setDialog("visibility")}
                  style={styles.visibilityPill}
                >
                  <Icon name={sharing ? "shield" : "ghost"} size={15} />
                  <Text style={styles.visibilityText}>
                    {sharing
                      ? "You’re visible"
                      : enabled
                        ? "Presence paused"
                        : "Ghost Mode is on"}
                  </Text>
                  <Icon name="settings" size={13} />
                </Pressable>
              </View>
              {tab === "map" && (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filters}
                  >
                    {(
                      [
                        { id: "everyone", label: "Everyone" },
                        { id: "interests", label: "Shared interests" },
                        { id: "clubs", label: "My organizations" },
                        { id: "connections", label: "Connections" },
                      ] as const
                    ).map((f) => (
                      <Chip
                        key={f.id}
                        selected={filter === f.id}
                        onPress={() => {
                          setFilter(f.id);
                          setSelected(null);
                        }}
                      >
                        {f.label}
                      </Chip>
                    ))}
                  </ScrollView>
                  <View style={styles.mapCard}>
                    <CampusMap
                      people={people}
                      selected={selected}
                      onSelect={setSelected}
                    />
                    <View pointerEvents="none" style={styles.mapLabel}>
                      <Icon name="profile" size={19} />
                      <View>
                        <Text style={styles.mapLabelTitle}>College Avenue</Text>
                        <Text style={styles.mapLabelCopy}>
                          Rutgers University
                        </Text>
                      </View>
                    </View>
                    {current && (
                      <View style={styles.popup}>
                        <Pressable
                          style={styles.popupClose}
                          accessibilityRole="button"
                          accessibilityLabel="Close student popup"
                          onPress={() => setSelected(null)}
                        >
                          <Icon name="close" size={17} />
                        </Pressable>
                        <View style={styles.popupPerson}>
                          <Avatar person={current} size={52} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.personName}>
                              {current.firstName} {current.lastName}
                            </Text>
                            <Text style={styles.personMeta}>
                              {current.major} · ’{String(current.year).slice(2)}
                            </Text>
                          </View>
                        </View>
                        <Reason
                          text={similarity(
                            state.me,
                            current,
                            state.connections,
                          )}
                        />
                        <View style={styles.actions}>
                          <View style={{ flex: 1 }}>
                            <Button
                              secondary
                              onPress={() => showPerson(current)}
                            >
                              View profile
                            </Button>
                          </View>
                          <View style={{ flex: 1 }}>
                            {connectionButton(current)}
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                  <View style={styles.listHeading}>
                    <Text style={styles.sectionTitle}>
                      Around you{" "}
                      <Text style={styles.count}>{people.length}</Text>
                    </Text>
                    <Text style={styles.finePrint}>Sample campus</Text>
                  </View>
                  <View style={styles.search}>
                    <Icon name="search" size={17} color={C.muted} />
                    <TextInput
                      accessibilityLabel="Search students, interests or clubs"
                      placeholder="Search people, interests, clubs"
                      placeholderTextColor="#9aa58b"
                      value={search}
                      onChangeText={setSearch}
                      style={styles.searchInput}
                    />
                    {search.length > 0 && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Clear search"
                        onPress={() => setSearch("")}
                      >
                        <Icon name="close" size={15} />
                      </Pressable>
                    )}
                  </View>
                  {people.map((p) => (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${p.firstName} ${p.lastName}`}
                      style={styles.personCard}
                      onPress={() => showPerson(p)}
                    >
                      <View style={styles.cardTop}>
                        <Avatar person={p} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.personName}>
                            {p.firstName} {p.lastName}
                            {state.connections[p.id] === "connected"
                              ? "  ✓"
                              : ""}
                          </Text>
                          <Text style={styles.personMeta}>
                            {p.major} · {p.year}
                          </Text>
                        </View>
                        <Icon name="arrow" size={17} color="#a1ad92" />
                      </View>
                      <View style={styles.chipRow}>
                        {p.interests.slice(0, 3).map((i) => (
                          <Chip key={i}>{i}</Chip>
                        ))}
                      </View>
                      <Reason
                        text={similarity(state.me, p, state.connections)}
                      />
                    </Pressable>
                  ))}
                  {people.length === 0 && (
                    <Empty title="A quiet corner of campus">
                      Try a different filter or clear your search. Blocked
                      people stay hidden.
                    </Empty>
                  )}
                  <Text style={styles.endNote}>
                    The best part happens in person.
                  </Text>
                </>
              )}
              {tab === "connections" && (
                <>
                  <View style={styles.connectionTabs}>
                    {(["connected", "incoming", "outgoing"] as const).map(
                      (t) => (
                        <Chip
                          key={t}
                          selected={connectionTab === t}
                          onPress={() => setConnectionTab(t)}
                        >
                          {t === "connected"
                            ? "Connected"
                            : t === "incoming"
                              ? "Received"
                              : "Sent"}{" "}
                          ·{" "}
                          {
                            discoverable.filter(
                              (p) => state.connections[p.id] === t,
                            ).length
                          }
                        </Chip>
                      ),
                    )}
                  </View>
                  {discoverable
                    .filter((p) => state.connections[p.id] === connectionTab)
                    .map((p) => (
                      <View key={p.id} style={styles.personCard}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`View ${p.firstName} ${p.lastName}`}
                          onPress={() => showPerson(p)}
                          style={styles.cardTop}
                        >
                          <Avatar person={p} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.personName}>
                              {p.firstName} {p.lastName}
                            </Text>
                            <Text style={styles.personMeta}>{p.major}</Text>
                          </View>
                          <Icon name="arrow" size={17} />
                        </Pressable>
                        <Reason
                          text={similarity(state.me, p, state.connections)}
                        />
                        {connectionButton(p)}
                        {connectionTab === "incoming" && (
                          <Pressable
                            accessibilityRole="button"
                            disabled={saving}
                            style={styles.textLink}
                            onPress={() =>
                              update(
                                (s) => connectionAction(s, p.id, "remove"),
                                "Request declined.",
                              )
                            }
                          >
                            <Text style={styles.textLinkCopy}>
                              Decline request
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    ))}
                  {!discoverable.some(
                    (p) => state.connections[p.id] === connectionTab,
                  ) && (
                    <Empty
                      title={
                        connectionTab === "connected"
                          ? "Your circle starts with a hello"
                          : "You’re all caught up"
                      }
                    >
                      Find someone you have a little something in common with on
                      the map.
                    </Empty>
                  )}
                </>
              )}
              {tab === "profile" && (
                <>
                  <ProfileContent profile={state.me} />
                  <Button
                    secondary
                    icon="settings"
                    onPress={() => setDialog("edit")}
                  >
                    Edit your profile
                  </Button>
                  <View style={styles.privacyCard}>
                    <Icon name="shield" size={27} color={C.accent} />
                    <Text style={styles.smallTitle}>
                      Your location. Your call.
                    </Text>
                    <Text style={styles.bodyCopy}>
                      Choose who can see you and for how long. Ghost Mode is
                      always one tap away.
                    </Text>
                    <Button
                      secondary
                      icon="ghost"
                      onPress={() => setDialog("visibility")}
                    >
                      Visibility & blocked people
                    </Button>
                  </View>
                  <Text style={styles.finePrint}>
                    Demo profile. Verification is simulated; nothing is shared
                    publicly.
                  </Text>
                </>
              )}
            </ScrollView>
            <View style={styles.tabBar}>
              {(
                [
                  { id: "map", icon: "map", label: "Map" },
                  { id: "connections", icon: "users", label: "Connections" },
                  { id: "profile", icon: "profile", label: "Profile" },
                ] as const
              ).map((t) => (
                <Pressable
                  key={t.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === t.id }}
                  accessibilityLabel={t.label}
                  onPress={() => {
                    setTab(t.id);
                    setSelected(null);
                  }}
                  style={[styles.tab, tab === t.id && styles.activeTab]}
                >
                  <Icon
                    name={t.icon}
                    color={tab === t.id ? C.green : "#98a28d"}
                    size={21}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      tab === t.id && { color: C.green, fontWeight: "600" },
                    ]}
                  >
                    {t.label}
                  </Text>
                  {t.id === "connections" && received > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{received}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
      <Sheet
        open={dialog !== null}
        title={
          dialog === "profile"
            ? "A little introduction"
            : dialog === "edit"
              ? "Make it feel like you."
              : dialog === "visibility"
                ? "Your location. Your call."
                : dialog === "report"
                  ? "Report privately"
                  : dialog === "block"
                    ? "Block this person?"
                    : dialog === "disconnect"
                      ? "Remove connection?"
                      : "Your campus. Your people."
        }
        onClose={() => setDialog(null)}
      >
        {dialog === "profile" && person && canDiscover(state, person.id) && (
          <>
            <ProfileContent profile={person} />
            <Reason text={similarity(state.me, person, state.connections)} />
            {connectionButton(person)}
            <View style={styles.actions}>
              <Button secondary icon="flag" onPress={() => setDialog("report")}>
                Report
              </Button>
              <Button
                secondary
                icon="shield"
                onPress={() => setDialog("block")}
              >
                Block
              </Button>
            </View>
          </>
        )}
        {dialog === "edit" && (
          <ProfileEditor
            initial={state.me}
            saving={saving}
            onSave={async (p) => {
              if (
                await update(
                  (s) => ({ ...s, me: validateProfile(p) }),
                  "Your profile is saved.",
                )
              )
                setDialog(null);
            }}
          />
        )}
        {dialog === "visibility" && (
          <VisibilityEditor
            state={state}
            now={now}
            saving={saving}
            onSave={async (a, m) => {
              if (
                await update(
                  (s) => setVisibility(s, a, m),
                  a === "nobody"
                    ? "Ghost Mode is on."
                    : "Visibility saved with a fictional campus position.",
                )
              )
                setDialog(null);
            }}
            onUnblock={(id) =>
              update(
                (s) => unblockPerson(s, id),
                "Unblocked. Previous connections are not restored.",
              )
            }
          />
        )}
        {dialog === "report" && person && (
          <ReportEditor
            person={person}
            saving={saving}
            onSave={async (reason, details) => {
              if (
                await update(
                  (s) => ({
                    ...s,
                    reports: [
                      ...s.reports,
                      {
                        id: `${Date.now()}-${person.id}`,
                        personId: person.id,
                        reason,
                        details,
                        createdAt: Date.now(),
                      },
                    ],
                  }),
                  "Report saved on this device. This demo has no review team.",
                )
              )
                setDialog(null);
            }}
          />
        )}
        {dialog === "block" && person && (
          <>
            <Text style={styles.bodyCopy}>
              You won’t see {person.firstName} in discovery or connections. Any
              existing connection will be removed. You can unblock them in
              Visibility settings.
            </Text>
            <Button
              danger
              icon="shield"
              loading={saving}
              onPress={async () => {
                if (
                  await update(
                    (s) => blockPerson(s, person.id),
                    `${person.firstName} is blocked.`,
                  )
                ) {
                  setSelected(null);
                  setDialog(null);
                }
              }}
            >
              Block {person.firstName}
            </Button>
          </>
        )}
        {dialog === "disconnect" && person && (
          <>
            <Text style={styles.bodyCopy}>
              Remove your connection with {person.firstName}? You can send
              another request later.
            </Text>
            <Button
              secondary
              loading={saving}
              onPress={async () => {
                if (
                  await update(
                    (s) => connectionAction(s, person.id, "remove"),
                    "Connection removed.",
                  )
                )
                  setDialog(null);
              }}
            >
              Remove connection
            </Button>
          </>
        )}
        {dialog === "about" && (
          <>
            <View style={styles.aboutSymbol}>
              <Icon name="leaf" size={42} color={C.accent} />
            </View>
            <Text style={styles.smallTitle}>
              Real conversations start nearby.
            </Text>
            <Text style={styles.bodyCopy}>
              Find a reason to say hello through shared clubs, interests,
              majors, and mutual connections.
            </Text>
            <View style={styles.notice}>
              <Icon name="info" size={20} />
              <Text style={styles.noticeCopy}>
                This is a working mobile demo with fictional students.
                University verification is simulated. Your edits, connections,
                blocks, reports, and visibility choices are saved on this device
                only. They do not sync with the web app.
              </Text>
            </View>
            <Text style={styles.bodyCopy}>
              Native map tiles use Apple Maps on iOS and Google Maps on Android.
              Student positions are approximate sample coordinates at Rutgers.
              The browser uses an illustrated map. No device GPS is requested.
            </Text>
            <Text style={styles.finePrint}>
              Real accounts, a protected shared backend, and live location
              sharing come next.
            </Text>
          </>
        )}
      </Sheet>
      {!!toast && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          onPress={() => setToast("")}
          style={styles.toast}
        >
          <Icon name="info" size={17} color={C.white} />
          <Text accessibilityLiveRegion="polite" style={styles.toastText}>
            {toast}
          </Text>
          <Icon name="close" size={15} color={C.white} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}
function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={["top", "bottom"]} style={styles.modalOverlay}>
        <Pressable
          accessibilityLabel="Dismiss dialog"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheet}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close dialog"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.sheetBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
function ProfileContent({ profile: p }: { profile: Profile }) {
  return (
    <View style={styles.profileContent}>
      <View style={styles.profileCover}>
        <View style={styles.coverCircle} />
        <Icon name="leaf" size={60} color="#98ac7e" />
      </View>
      <View style={styles.profileAvatar}>
        <Avatar person={p} size={86} />
      </View>
      <Text style={styles.profileName}>
        {p.firstName} {p.lastName}
      </Text>
      <View style={styles.cardTop}>
        <Icon name="profile" size={15} color={C.muted} />
        <Text style={styles.finePrint}>Rutgers University</Text>
      </View>
      <Text style={styles.personMeta}>
        {p.major}
        {p.year ? ` · Class of ${p.year}` : ""}
      </Text>
      {!!p.bio && <Text style={styles.profileBio}>{p.bio}</Text>}
      <View style={styles.profileSection}>
        <Text style={styles.sectionTitle}>A few things I’m into</Text>
        <View style={styles.chipRow}>
          {p.interests.map((i) => (
            <Chip key={i}>{i}</Chip>
          ))}
        </View>
        {p.interests.length === 0 && (
          <Text style={styles.finePrint}>Still finding my favorites.</Text>
        )}
      </View>
      <View style={styles.profileSection}>
        <Text style={styles.sectionTitle}>Around campus</Text>
        {p.clubs.map((c) => (
          <View key={c} style={styles.affiliation}>
            <Icon name="users" size={18} color={C.accent} />
            <Text style={styles.clubText}>{c}</Text>
          </View>
        ))}
        {p.clubs.length === 0 && (
          <Text style={styles.finePrint}>No organizations added yet.</Text>
        )}
      </View>
      {p.experiences.length > 0 && (
        <View style={styles.profileSection}>
          <Text style={styles.sectionTitle}>Things I’ve worked on</Text>
          {p.experiences.map((e, i) => (
            <View style={styles.experience} key={i}>
              <Text style={styles.clubText}>{e.title}</Text>
              <Text style={styles.finePrint}>
                {e.organization}
                {e.when ? ` · ${e.when}` : ""}
              </Text>
              {!!e.description && (
                <Text style={styles.bodyCopy}>{e.description}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
function Field({
  label,
  value,
  onChange,
  multiline = false,
  max = 240,
  numeric = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  multiline?: boolean;
  max?: number;
  numeric?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        maxLength={max}
        keyboardType={numeric ? "number-pad" : "default"}
        placeholder={placeholder}
        placeholderTextColor="#a2ab96"
        style={[
          styles.input,
          multiline && { minHeight: 90, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
function ProfileEditor({
  initial,
  saving,
  onSave,
}: {
  initial: Profile;
  saving: boolean;
  onSave: (p: Profile) => void;
}) {
  const [draft, setDraft] = useState<Profile>(() =>
      JSON.parse(JSON.stringify(initial)),
    ),
    [year, setYear] = useState(initial.year?.toString() || "");
  const toggle = (field: "interests" | "clubs", value: string) =>
    setDraft((p) => ({
      ...p,
      [field]: p[field].includes(value)
        ? p[field].filter((x) => x !== value)
        : [...p[field], value],
    }));
  return (
    <>
      <Text style={styles.bodyCopy}>
        A few details are all it takes. Interests, organizations, and experience
        are optional.
      </Text>
      <Field
        label="First name"
        value={draft.firstName}
        onChange={(v) => setDraft({ ...draft, firstName: v })}
        max={40}
      />
      <Field
        label="Last name"
        value={draft.lastName}
        onChange={(v) => setDraft({ ...draft, lastName: v })}
        max={40}
      />
      <Text style={styles.fieldLabel}>Major</Text>
      <View style={styles.chipRow}>
        {CATALOG.majors.map((m) => (
          <Chip
            key={m}
            selected={draft.major === m}
            onPress={() => setDraft({ ...draft, major: m })}
          >
            {m}
          </Chip>
        ))}
      </View>
      <Field
        label="Graduation year"
        value={year}
        onChange={setYear}
        numeric
        max={4}
        placeholder="Optional"
      />
      <Field
        label="A little about you"
        value={draft.bio}
        onChange={(v) => setDraft({ ...draft, bio: v })}
        multiline
      />
      <Text style={styles.finePrint}>
        {draft.bio.length}/240 · A conversation starter, not a résumé.
      </Text>
      {(
        [
          {
            field: "interests",
            label: "Interests & hobbies",
            values: CATALOG.interests,
            max: 8,
          },
          {
            field: "clubs",
            label: "Campus organizations",
            values: CATALOG.clubs,
            max: 6,
          },
        ] as const
      ).map((group) => (
        <View style={styles.profileSection} key={group.field}>
          <Text style={styles.sectionTitle}>
            {group.label} · {draft[group.field].length}/{group.max}
          </Text>
          <View style={styles.chipRow}>
            {group.values.map((v) => (
              <Chip
                key={v}
                selected={draft[group.field].includes(v)}
                disabled={
                  !draft[group.field].includes(v) &&
                  draft[group.field].length >= group.max
                }
                onPress={() => toggle(group.field, v)}
              >
                {v}
              </Chip>
            ))}
          </View>
        </View>
      ))}
      <View style={styles.profileSection}>
        <Text style={styles.sectionTitle}>Experience · Optional</Text>
        {draft.experiences.map((e, i) => (
          <View key={i} style={styles.experienceFields}>
            <Field
              label={`Experience ${i + 1} title`}
              value={e.title}
              max={80}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  experiences: draft.experiences.map((x, n) =>
                    n === i ? { ...x, title: v } : x,
                  ),
                })
              }
            />
            <Field
              label="Organization"
              value={e.organization}
              max={80}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  experiences: draft.experiences.map((x, n) =>
                    n === i ? { ...x, organization: v } : x,
                  ),
                })
              }
            />
            <Field
              label="When"
              value={e.when}
              max={40}
              placeholder="Summer 2026"
              onChange={(v) =>
                setDraft({
                  ...draft,
                  experiences: draft.experiences.map((x, n) =>
                    n === i ? { ...x, when: v } : x,
                  ),
                })
              }
            />
            <Field
              label="A sentence about it"
              value={e.description}
              multiline
              onChange={(v) =>
                setDraft({
                  ...draft,
                  experiences: draft.experiences.map((x, n) =>
                    n === i ? { ...x, description: v } : x,
                  ),
                })
              }
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove experience ${i + 1}`}
              onPress={() =>
                setDraft({
                  ...draft,
                  experiences: draft.experiences.filter((_, n) => n !== i),
                })
              }
            >
              <Text style={styles.textLinkCopy}>Remove experience</Text>
            </Pressable>
          </View>
        ))}
        {draft.experiences.length < 5 && (
          <Button
            secondary
            icon="plus"
            onPress={() =>
              setDraft({
                ...draft,
                experiences: [
                  ...draft.experiences,
                  { title: "", organization: "", when: "", description: "" },
                ],
              })
            }
          >
            Add experience
          </Button>
        )}
      </View>
      <Button
        loading={saving}
        icon="check"
        onPress={() => onSave({ ...draft, year: year ? Number(year) : null })}
      >
        Save profile
      </Button>
    </>
  );
}
function VisibilityEditor({
  state,
  now,
  saving,
  onSave,
  onUnblock,
}: {
  state: State;
  now: number;
  saving: boolean;
  onSave: (a: Audience, m: number | null) => void;
  onUnblock: (id: string) => void;
}) {
  const [audience, setAudience] = useState<Audience>(state.visibility.audience),
    [duration, setDuration] = useState<number | null>(60);
  return (
    <>
      <Text style={styles.bodyCopy}>
        Audience and duration are independent. You decide when you’re
        discoverable.
      </Text>
      <Text style={styles.fieldLabel}>Who can see you?</Text>
      {(
        [
          {
            id: "university",
            icon: "profile",
            title: "Everyone at Rutgers",
            copy: "Meet people beyond your usual circle.",
          },
          {
            id: "connections",
            icon: "users",
            title: "My connections",
            copy: "Keep it to people you’ve connected with.",
          },
          {
            id: "nobody",
            icon: "ghost",
            title: "Nobody · Ghost Mode",
            copy: "Explore campus without appearing on the map.",
          },
        ] as const
      ).map((a) => (
        <Pressable
          key={a.id}
          accessibilityRole="radio"
          accessibilityState={{ checked: audience === a.id }}
          accessibilityLabel={a.title}
          onPress={() => setAudience(a.id)}
          style={[
            styles.audienceOption,
            audience === a.id && styles.audienceSelected,
          ]}
        >
          <Icon name={a.icon} color={C.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.clubText}>{a.title}</Text>
            <Text style={styles.finePrint}>{a.copy}</Text>
          </View>
          {audience === a.id && <Icon name="check" size={17} />}
        </Pressable>
      ))}
      {audience !== "nobody" && (
        <>
          <Text style={styles.fieldLabel}>For how long?</Text>
          <View style={styles.chipRow}>
            {[
              { value: 30, label: "30 minutes" },
              { value: 60, label: "1 hour" },
              { value: 180, label: "3 hours" },
              { value: null, label: "Always enabled" },
            ].map((d) => (
              <Chip
                key={d.label}
                selected={duration === d.value}
                onPress={() => setDuration(d.value)}
              >
                {d.label}
              </Chip>
            ))}
          </View>
        </>
      )}
      <View style={styles.notice}>
        <Icon name="shield" size={18} />
        <Text style={styles.noticeCopy}>
          This demo uses a fictional campus position. No device GPS is
          requested. Presence pauses after 15 minutes without an update, even
          with Always enabled. Save again to refresh sample presence.
        </Text>
      </View>
      {state.visibility.until !== null && state.visibility.until > now && (
        <Text style={styles.finePrint}>
          Current setting expires{" "}
          {new Date(state.visibility.until).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
          .
        </Text>
      )}
      <Button
        loading={saving}
        icon="check"
        onPress={() => onSave(audience, duration)}
      >
        Save visibility
      </Button>
      {state.blocked.length > 0 && (
        <View style={styles.profileSection}>
          <Text style={styles.sectionTitle}>Blocked people</Text>
          {state.blocked.map((id) => {
            const p = PEOPLE.find((x) => x.id === id);
            return (
              <View style={styles.blockedRow} key={id}>
                <Text style={styles.clubText}>
                  {p ? `${p.firstName} ${p.lastName}` : "Student"}
                </Text>
                <Pressable
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock ${p?.firstName || "student"}`}
                  onPress={() => onUnblock(id)}
                >
                  <Text style={styles.textLinkCopy}>Unblock</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}
function ReportEditor({
  person,
  saving,
  onSave,
}: {
  person: Person;
  saving: boolean;
  onSave: (r: string, d: string) => void;
}) {
  const [reason, setReason] = useState("Safety concern"),
    [details, setDetails] = useState("");
  return (
    <>
      <Text style={styles.bodyCopy}>
        Your report about {person.firstName} is private and won’t be shared with
        them.
      </Text>
      <View style={styles.chipRow}>
        {[
          "Safety concern",
          "Harassment",
          "Impersonation",
          "Inappropriate profile",
          "Other",
        ].map((r) => (
          <Chip key={r} selected={reason === r} onPress={() => setReason(r)}>
            {r}
          </Chip>
        ))}
      </View>
      <Field
        label="Anything else? (optional)"
        value={details}
        max={1000}
        multiline
        onChange={setDetails}
      />
      <View style={styles.notice}>
        <Icon name="info" size={18} />
        <Text style={styles.noticeCopy}>
          Demo reports stay on this device. There is no staffed review team.
        </Text>
      </View>
      <Button
        loading={saving}
        icon="flag"
        onPress={() => onSave(reason, details)}
      >
        Save report
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? "#e9ede2" : C.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: 520,
    backgroundColor: C.paper,
    overflow: "hidden",
  },
  header: {
    height: 72,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  brand: { flexDirection: "row", gap: 8, alignItems: "center" },
  logo: {
    backgroundColor: C.green,
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 28,
    lineHeight: 33,
    color: "#e6f1d2",
    fontWeight: "700",
  },
  brandText: {
    fontSize: 31,
    fontWeight: "700",
    letterSpacing: -1.8,
    color: C.ink,
  },
  headerRight: { flexDirection: "row", gap: 8, alignItems: "center" },
  rutgers: {
    fontFamily: serif,
    fontSize: 22,
    color: "#aa4a3e",
    fontWeight: "700",
  },
  campusName: { fontSize: 11, color: C.muted },
  demoBadge: {
    fontSize: 8,
    letterSpacing: 1,
    backgroundColor: "#eef1e4",
    borderRadius: 5,
    padding: 6,
    color: "#83906f",
  },
  content: { flex: 1 },
  contentInner: { padding: 20, gap: 15, paddingBottom: 28 },
  intro: { gap: 9, marginBottom: 2 },
  title: {
    fontFamily: serif,
    fontSize: 32,
    lineHeight: 39,
    color: C.ink,
    letterSpacing: -0.7,
  },
  subtitle: { fontSize: 11, color: C.muted, lineHeight: 18 },
  visibilityPill: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.sage,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    padding: 9,
    marginTop: 5,
  },
  visibilityText: { fontSize: 10, color: "#69815a" },
  filters: { gap: 7, paddingBottom: 2 },
  mapCard: {
    height: 430,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#dce4d3",
    backgroundColor: "#eceee2",
  },
  mapLabel: {
    position: "absolute",
    top: 13,
    left: 12,
    backgroundColor: "#fffefaee",
    borderRadius: 12,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    boxShadow: "0 2px 12px #33422510",
  },
  mapLabelTitle: { fontSize: 11, fontWeight: "600", color: C.ink },
  mapLabelCopy: { fontSize: 8, color: C.muted, marginTop: 4 },
  popup: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 26,
    backgroundColor: C.white,
    padding: 15,
    borderRadius: 17,
    gap: 12,
    boxShadow: "0 4px 24px #2d493028",
  },
  popupClose: { position: "absolute", top: 5, right: 5, padding: 7, zIndex: 2 },
  popupPerson: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 12,
  },
  personName: { fontSize: 14, fontWeight: "600", color: C.ink },
  personMeta: { fontSize: 10, color: C.muted, lineHeight: 16, marginTop: 4 },
  actions: { flexDirection: "row", gap: 9, marginTop: 3 },
  listHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: C.ink },
  count: { fontSize: 11, color: C.accent },
  finePrint: { fontSize: 10, lineHeight: 17, color: "#919e83" },
  search: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    backgroundColor: C.white,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: C.ink,
    padding: 0,
    minHeight: 22,
  },
  personCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    backgroundColor: C.white,
    gap: 12,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  chipRow: { flexDirection: "row", gap: 7, flexWrap: "wrap", marginTop: 4 },
  endNote: {
    textAlign: "center",
    fontFamily: serif,
    fontStyle: "italic",
    fontSize: 16,
    color: "#8da078",
    marginVertical: 15,
  },
  tabBar: {
    height: 67,
    borderTopWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderTopWidth: 2,
    borderTopColor: "transparent",
  },
  activeTab: { borderTopColor: C.green },
  tabText: { fontSize: 9, color: "#96a18b" },
  badge: {
    position: "absolute",
    top: 7,
    right: "28%",
    backgroundColor: "#dce8ca",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { color: C.green, fontSize: 8, fontWeight: "600" },
  connectionTabs: { flexDirection: "row", gap: 7, marginBottom: 8 },
  profileContent: { gap: 9 },
  profileCover: {
    height: 100,
    backgroundColor: "#dce7cb",
    borderRadius: 17,
    overflow: "hidden",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 22,
  },
  coverCircle: {
    position: "absolute",
    height: 180,
    width: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: "#b9caa5",
    right: 30,
    top: -100,
  },
  profileAvatar: { marginTop: -53, marginLeft: 18 },
  profileName: {
    fontFamily: serif,
    fontSize: 30,
    color: C.ink,
    lineHeight: 36,
    marginTop: 1,
  },
  profileBio: { fontSize: 12, lineHeight: 21, color: C.muted, marginTop: 12 },
  profileSection: {
    borderTopWidth: 1,
    borderColor: C.line,
    paddingTop: 18,
    marginTop: 12,
    gap: 13,
  },
  affiliation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f0f4e7",
    padding: 12,
    borderRadius: 11,
  },
  clubText: { fontSize: 12, color: C.ink, fontWeight: "500", lineHeight: 19 },
  experience: {
    gap: 6,
    borderLeftWidth: 2,
    borderColor: "#cbdcba",
    paddingLeft: 12,
  },
  privacyCard: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    marginTop: 6,
  },
  smallTitle: { fontFamily: serif, fontSize: 25, color: C.ink },
  bodyCopy: { fontSize: 12, lineHeight: 21, color: C.muted },
  welcome: { padding: 25, gap: 19, paddingTop: 35 },
  welcomeTitle: {
    fontFamily: serif,
    fontSize: 54,
    color: C.ink,
    lineHeight: 59,
    letterSpacing: -1.5,
  },
  welcomeCopy: { fontSize: 12, lineHeight: 22, color: C.muted },
  welcomeMap: {
    height: 260,
    borderRadius: 75,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.line,
    marginTop: 4,
  },
  welcomeNote: {
    fontSize: 9,
    lineHeight: 17,
    textAlign: "center",
    color: "#98a38b",
    marginBottom: 15,
  },
  loadingText: { fontSize: 12, color: C.muted, marginTop: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#1c33276e",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "94%",
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    boxShadow: "0 -8px 40px #21372a20",
  },
  sheetHeader: {
    paddingVertical: 17,
    paddingHorizontal: 22,
    borderBottomWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetTitle: { fontSize: 14, fontWeight: "600", color: C.ink },
  closeButton: { padding: 5 },
  sheetBody: { padding: 22, paddingBottom: 30, gap: 17 },
  field: { gap: 8, marginTop: 3 },
  fieldLabel: { fontSize: 12, fontWeight: "500", color: C.ink, lineHeight: 19 },
  input: {
    borderWidth: 1,
    borderColor: "#dce4d2",
    borderRadius: 11,
    backgroundColor: "#fff",
    padding: 13,
    color: C.ink,
    fontSize: 14,
    minHeight: 47,
  },
  experienceFields: {
    padding: 13,
    gap: 12,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    backgroundColor: "#f3f6eb",
  },
  textLink: { alignItems: "center", padding: 4 },
  textLinkCopy: { fontSize: 11, color: "#7e965f", fontWeight: "500" },
  audienceOption: {
    flexDirection: "row",
    gap: 11,
    padding: 15,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    alignItems: "center",
  },
  audienceSelected: { backgroundColor: "#eff5e4", borderColor: "#aec594" },
  notice: {
    padding: 15,
    backgroundColor: "#eff4e5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e9d3",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noticeCopy: { fontSize: 11, lineHeight: 19, color: "#81936b", flex: 1 },
  blockedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
  },
  aboutSymbol: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.sage,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  toast: {
    position: "absolute",
    bottom: 85,
    left: 20,
    right: 20,
    maxWidth: 480,
    alignSelf: "center",
    backgroundColor: C.green,
    borderRadius: 13,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 3px 20px #20372930",
  },
  toastText: { flex: 1, color: C.white, fontSize: 12, lineHeight: 18 },
});
