import { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import type { Message, Person } from "./model";
import { Avatar, Button, Icon } from "./ui";
import { useTheme, useThemedStyles, type Palette } from "./theme";
export default function Chat({
  person,
  messages,
  saving,
  onSend,
}: {
  person: Person;
  messages: Message[];
  saving: boolean;
  onSend: (text: string) => Promise<boolean>;
}) {
  const C = useTheme().colors;
  const s = useThemedStyles(createStyles);

  const [draft, setDraft] = useState("");
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: false });
  }, [messages.length]);
  const send = async () => {
    if (await onSend(draft)) setDraft("");
  };
  return (
    <View style={s.root}>
      <View style={s.identity}>
        <Avatar person={person} size={42} />
        <View>
          <Text style={s.name}>
            {person.firstName} {person.lastName}
          </Text>
          <Text style={s.caption}>Connected at Rutgers</Text>
        </View>
      </View>
      <View style={s.notice}>
        <Icon name="info" size={15} />
        <Text style={s.noticeText}>
          Demo conversation · Messages stay on this device. No messages are
          delivered to another student; no automatic replies.
        </Text>
      </View>
      <ScrollView
        ref={scroll}
        style={s.thread}
        contentContainerStyle={s.threadContent}
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({ animated: false })
        }
      >
        {messages.length ? (
          messages.map((m) => (
            <View
              key={m.id}
              style={[s.bubble, m.author === "you" ? s.mine : s.theirs]}
            >
              <Text
                style={[
                  s.message,
                  m.author === "you" && { color: C.onPrimary },
                ]}
              >
                {m.text}
              </Text>
              <Text
                style={[
                  s.time,
                  m.author === "you" && { color: C.onPrimaryMuted },
                ]}
              >
                {m.author === "them" ? "Sample message · " : ""}
                {new Date(m.createdAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          ))
        ) : (
          <Text style={s.empty}>A little hello goes a long way.</Text>
        )}
      </ScrollView>
      <TextInput
        accessibilityLabel={`Message ${person.firstName}`}
        value={draft}
        editable={!saving}
        onChangeText={setDraft}
        multiline
        maxLength={1000}
        placeholder={`Say hello to ${person.firstName}…`}
        placeholderTextColor={C.muted}
        style={s.input}
      />
      <Button
        icon="arrow"
        disabled={!draft.trim()}
        loading={saving}
        onPress={send}
      >
        Send message
      </Button>
    </View>
  );
}
const createStyles = (C: Palette) =>
  StyleSheet.create({
    root: { gap: 13 },
    identity: { flexDirection: "row", alignItems: "center", gap: 10 },
    name: { fontSize: 15, fontWeight: "600", color: C.ink },
    caption: { fontSize: 10, color: C.muted, marginTop: 4 },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: C.soft,
      padding: 11,
      borderRadius: 10,
    },
    noticeText: { flex: 1, fontSize: 10, color: C.muted, lineHeight: 16 },
    thread: { height: 265, maxHeight: 330 },
    threadContent: { gap: 12, paddingVertical: 10 },
    bubble: {
      maxWidth: "87%",
      borderRadius: 15,
      paddingHorizontal: 14,
      paddingVertical: 11,
      gap: 6,
    },
    mine: {
      alignSelf: "flex-end",
      backgroundColor: C.primary,
      borderBottomRightRadius: 4,
    },
    theirs: {
      alignSelf: "flex-start",
      backgroundColor: C.soft,
      borderBottomLeftRadius: 4,
    },
    message: { fontSize: 13, color: C.ink, lineHeight: 21 },
    time: { fontSize: 8, color: C.muted },
    empty: {
      color: C.muted,
      fontSize: 12,
      textAlign: "center",
      paddingTop: 60,
    },
    input: {
      borderWidth: 1,
      borderColor: C.line,
      backgroundColor: C.paper,
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      minHeight: 58,
      maxHeight: 125,
      color: C.ink,
      textAlignVertical: "top",
    },
  });
