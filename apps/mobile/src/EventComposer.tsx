import { useState } from 'react';
import { Modal, View, Text, TextInput, ScrollView } from 'react-native';
import { useTheme, serif } from './theme';
import { useService } from './service';
import { CAMPUSES, type CampusId } from './campuses';
import { Button, Chip, Label } from './ui';
const defaultTime = () => {
  const d = new Date(Date.now() + 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 18:00`;
};
export default function EventComposer({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { colors: C } = useTheme(),
    service = useService();
  const [title, setTitle] = useState(''),
    [venue, setVenue] = useState(''),
    [description, setDescription] = useState(''),
    [starts, setStarts] = useState(defaultTime),
    [campus, setCampus] = useState<CampusId>('college'),
    [kind, setKind] = useState<'public' | 'invite'>('public'),
    [invitees, setInvitees] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const friends =
    service.snapshot?.people.filter(
      (p) => service.snapshot?.state.connections[p.id] === 'connected',
    ) || [];
  const input = {
    color: C.ink,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    padding: 13,
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 26,
          paddingTop: 55,
          paddingBottom: 55,
          gap: 18,
          backgroundColor: C.surface,
          flexGrow: 1,
        }}
      >
        <Text style={{ fontFamily: serif, fontSize: 32, color: C.ink }}>Make a plan.</Text>
        <Text style={{ color: C.muted, fontSize: 12, lineHeight: 20 }}>
          Public plans are visible to Rutgers members. Private invites are for selected connections
          only. Keep private home addresses out of public linkups.
        </Text>
        <Label>What’s happening?</Label>
        <TextInput
          accessibilityLabel="Linkup title"
          placeholder="Pre-football spikeball"
          placeholderTextColor={C.muted}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
          style={input}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip selected={kind === 'public'} onPress={() => setKind('public')}>
            Public linkup
          </Chip>
          <Chip selected={kind === 'invite'} onPress={() => setKind('invite')}>
            Invite only
          </Chip>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {CAMPUSES.map((c) => (
            <Chip key={c.id} selected={campus === c.id} onPress={() => setCampus(c.id)}>
              {c.short}
            </Chip>
          ))}
        </View>
        <TextInput
          accessibilityLabel="Meeting place"
          placeholder="Meeting place"
          placeholderTextColor={C.muted}
          value={venue}
          onChangeText={setVenue}
          maxLength={120}
          style={input}
        />
        <Label>Start time · your local time</Label>
        <TextInput
          accessibilityLabel="Start time YYYY-MM-DD HH:mm"
          placeholder="YYYY-MM-DD HH:mm"
          placeholderTextColor={C.muted}
          value={starts}
          onChangeText={setStarts}
          maxLength={16}
          style={input}
        />
        <Text style={{ color: C.muted, fontSize: 11 }}>
          Format: YYYY-MM-DD HH:mm. Linkups last 3 hours.
        </Text>
        <TextInput
          accessibilityLabel="Linkup description"
          placeholder="What should people know?"
          placeholderTextColor={C.muted}
          value={description}
          onChangeText={setDescription}
          maxLength={1000}
          multiline
          style={[input, { minHeight: 90 }]}
        />
        {kind === 'invite' && (
          <>
            <Label>Invite your connections</Label>
            {!friends.length && (
              <Text style={{ color: C.muted }}>Connect with someone first to send an invite.</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {friends.map((p) => (
                <Chip
                  key={p.id}
                  selected={invitees.includes(p.id)}
                  onPress={() =>
                    setInvitees((ids) =>
                      ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id],
                    )
                  }
                >
                  {p.firstName} {p.lastName}
                </Chip>
              ))}
            </View>
          </>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: C.accent }}>
            {error}
          </Text>
        )}
        <Button
          loading={busy}
          disabled={
            title.trim().length < 3 ||
            venue.trim().length < 2 ||
            (kind === 'invite' && !invitees.length)
          }
          onPress={async () => {
            setError('');
            const date = new Date(starts.replace(' ', 'T'));
            if (
              !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(starts) ||
              !Number.isFinite(date.getTime())
            ) {
              setError('Enter a valid start date and time.');
              return;
            }
            setBusy(true);
            try {
              await service.api('/v1/events', 'POST', {
                title,
                venue,
                description,
                campus,
                kind,
                category: 'Hangout',
                startsAt: date.getTime(),
                endsAt: date.getTime() + 3 * 3600000,
                invitees: kind === 'invite' ? invitees : [],
              });
              setTitle('');
              setVenue('');
              setDescription('');
              setInvitees([]);
              await onCreated();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not create linkup');
            } finally {
              setBusy(false);
            }
          }}
        >
          Create linkup
        </Button>
        <Button secondary disabled={busy} onPress={onClose}>
          Cancel
        </Button>
      </ScrollView>
    </Modal>
  );
}
