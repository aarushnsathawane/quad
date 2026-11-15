import { useState } from 'react';
import { View, Text, TextInput, Linking, Share, Platform } from 'react-native';
import { Button, Label } from './ui';
import { useService } from './service';
import { useTheme } from './theme';
export default function AccountSettings() {
  const { colors: C } = useTheme(),
    service = useService();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState(''),
    [reports, setReports] = useState<any[] | null>(null);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete this action');
    } finally {
      setBusy(false);
    }
  };
  const base =
    process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'web' ? window.location.origin : '');
  const loadReports = async () => {
    const result = await service.api('/v1/admin/reports');
    setReports(result.reports);
  };
  return (
    <View style={{ gap: 15, paddingVertical: 16 }}>
      <Label>Account & privacy</Label>
      <Text style={{ color: C.muted, fontSize: 12, lineHeight: 20 }}>
        Your school email is private. You can export your data, sign out, or delete your account
        here.
      </Text>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <Button secondary onPress={() => void Linking.openURL(base + '/privacy')}>
          Privacy
        </Button>
        <Button secondary onPress={() => void Linking.openURL(base + '/terms')}>
          Terms
        </Button>
      </View>
      {!!service.config?.supportEmail && (
        <Button
          secondary
          onPress={() => void Linking.openURL('mailto:' + service.config!.supportEmail)}
        >
          Contact support
        </Button>
      )}
      <Button
        secondary
        disabled={busy}
        onPress={() =>
          void act(async () => {
            const data = await service.api('/v1/account/export');
            const json = JSON.stringify(data, null, 2);
            if (Platform.OS === 'web') {
              const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
              const link = document.createElement('a');
              link.href = url;
              link.download = 'quad-account.json';
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            } else await Share.share({ message: json, title: 'Your Quad account export' });
          })
        }
      >
        Export my data
      </Button>
      <Button secondary disabled={busy} onPress={() => void act(() => service.logout())}>
        Sign out
      </Button>
      <Button secondary disabled={busy} onPress={() => void act(() => service.logout(true))}>
        Sign out all devices
      </Button>
      <Button danger disabled={busy} onPress={() => setDeleting(!deleting)}>
        Delete account
      </Button>
      {deleting && (
        <View style={{ gap: 12 }}>
          <Text style={{ color: C.ink, lineHeight: 21 }}>
            This permanently deletes your account, profile, connections, messages, and hosted events
            from the live service. Type DELETE to confirm. Limited moderation records and encrypted
            backups may remain until their retention periods end.
          </Text>
          <TextInput
            accessibilityLabel="Type DELETE to confirm account deletion"
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            placeholder="DELETE"
            placeholderTextColor={C.muted}
            style={{
              color: C.ink,
              padding: 12,
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: 9,
            }}
          />
          <Button
            danger
            loading={busy}
            disabled={confirmation !== 'DELETE'}
            onPress={() =>
              void act(async () => {
                await service.api('/v1/account', 'DELETE', { confirmation: 'DELETE' });
                await service.refresh().catch((e) => {
                  if ((e as any).status !== 401) throw e;
                });
              })
            }
          >
            Permanently delete my account
          </Button>
        </View>
      )}
      {service.snapshot?.admin && (
        <View style={{ gap: 12 }}>
          <Label>Moderation</Label>
          <Button secondary disabled={busy} onPress={() => void act(loadReports)}>
            Open report queue
          </Button>
          {reports?.length === 0 && <Text style={{ color: C.muted }}>No open reports.</Text>}
          {reports?.map((r) => (
            <View
              key={r.id}
              style={{
                padding: 14,
                gap: 10,
                borderWidth: 1,
                borderColor: C.line,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: C.ink, fontWeight: '700' }}>{r.reason}</Text>
              {r.subjectProfile && (
                <Text style={{ color: C.ink }}>
                  Reported student: {r.subjectProfile.firstName} {r.subjectProfile.lastName}
                </Text>
              )}
              {r.subject && (
                <Text style={{ color: C.muted, fontSize: 10 }}>Account ID: {r.subject}</Text>
              )}
              {r.event && (
                <Text style={{ color: C.ink }}>
                  Event: {r.event.title} · {r.event.venue}
                </Text>
              )}
              <Text style={{ color: C.ink }}>{r.details}</Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>
                {new Date(r.created_at).toLocaleString()}
              </Text>
              {r.subject && (
                <Button
                  danger
                  disabled={busy}
                  onPress={() =>
                    void act(async () => {
                      await service.api('/v1/admin/users/' + r.subject, 'POST', {
                        status: 'suspended',
                      });
                      await service.api('/v1/admin/reports/' + r.id, 'POST', {
                        status: 'reviewed',
                      });
                      await loadReports();
                    })
                  }
                >
                  Suspend reported account
                </Button>
              )}
              {r.event_id && (
                <Button
                  danger
                  disabled={busy}
                  onPress={() =>
                    void act(async () => {
                      await service.api('/v1/admin/events/' + r.event_id, 'POST', {});
                      await service.api('/v1/admin/reports/' + r.id, 'POST', {
                        status: 'reviewed',
                      });
                      await loadReports();
                    })
                  }
                >
                  Cancel reported event
                </Button>
              )}
              <Button
                secondary
                disabled={busy}
                onPress={() =>
                  void act(async () => {
                    await service.api('/v1/admin/reports/' + r.id, 'POST', { status: 'reviewed' });
                    await loadReports();
                  })
                }
              >
                Mark reviewed
              </Button>
              <Button
                secondary
                disabled={busy}
                onPress={() =>
                  void act(async () => {
                    await service.api('/v1/admin/reports/' + r.id, 'POST', { status: 'dismissed' });
                    await loadReports();
                  })
                }
              >
                Dismiss report
              </Button>
            </View>
          ))}
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: C.accent }}>
          {error}
        </Text>
      )}
    </View>
  );
}
