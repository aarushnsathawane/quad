import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import {
  Platform,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
  AppState,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { Button, Icon } from './ui';
import { useTheme, serif } from './theme';
import type { State, Person, Profile } from './model';
export const DEMO = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
const API = process.env.EXPO_PUBLIC_API_URL || '';
const SESSION_KEY = 'quad.session.v1';
export type Bootstrap = { userId: string; admin: boolean; people: Person[]; state: State };
type Config = {
  school: string;
  domains: string[];
  supportEmail: string;
  mapTileUrl: string;
  mapAttribution: string;
};
type Service = {
  online: boolean;
  snapshot: Bootstrap | null;
  config: Config | null;
  api: <T = any>(path: string, method?: string, body?: unknown) => Promise<T>;
  refresh: () => Promise<Bootstrap>;
  commit: (before: State, after: State) => Promise<Bootstrap>;
  logout: () => Promise<void>;
};
const Context = createContext<Service | null>(null);
export function useService() {
  const service = useContext(Context);
  if (!service) throw new Error('ServiceProvider required');
  return service;
}
let nativeToken: string | null = null;
export async function request<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (Platform.OS !== 'web' && !API) throw new Error('This build needs its production API URL.');
  if (API && !API.startsWith('https://') && !__DEV__)
    throw new Error('A secure API URL is required.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(API + path, {
      method,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(Platform.OS !== 'web' ? { 'X-Quad-Client': 'native' } : {}),
        ...(Platform.OS !== 'web' && nativeToken ? { Authorization: `Bearer ${nativeToken}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    if (!res.ok) {
      const error = Object.assign(new Error(data.error || 'Request failed'), {
        status: res.status,
      });
      throw error;
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      throw new Error('Request timed out. Please try again.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
async function locate(ask: boolean) {
  const permission = ask
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted')
    throw new Error('Location is off. Enable it to share your presence, or use Ghost Mode.');
  const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: point.coords.latitude, lng: point.coords.longitude };
}
export function ServiceProvider({ children }: { children: ReactNode }) {
  const { colors: C } = useTheme();
  const [snapshot, setSnapshot] = useState<Bootstrap | null>(null),
    [config, setConfig] = useState<Config | null>(null),
    [loading, setLoading] = useState(!DEMO),
    [error, setError] = useState(''),
    [offline, setOffline] = useState(false),
    [resuming, setResuming] = useState(false);
  const mounted = useRef(true),
    refreshing = useRef(false),
    busy = useRef(false),
    sessionEpoch = useRef(0);
  const refresh = async () => {
    const epoch = sessionEpoch.current;
    try {
      const next = await request<Bootstrap>('/v1/bootstrap');
      if (mounted.current && epoch === sessionEpoch.current) {
        setSnapshot(next);
        setOffline(false);
      }
      return next;
    } catch (e) {
      if (epoch === sessionEpoch.current && (e as any).status === 401) {
        nativeToken = null;
        setSnapshot(null);
        if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(SESSION_KEY);
      } else if (epoch === sessionEpoch.current) setOffline(true);
      throw e;
    }
  };
  const boot = async () => {
    setLoading(true);
    setError('');
    try {
      if (Platform.OS !== 'web') nativeToken = await SecureStore.getItemAsync(SESSION_KEY);
      setConfig(await request<Config>('/v1/config'));
      await refresh();
    } catch (e) {
      if ((e as any).status === 401) {
        setSnapshot(null);
        nativeToken = null;
        if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(SESSION_KEY);
      } else setError(e instanceof Error ? e.message : 'Could not connect.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    if (!DEMO) void boot();
    return () => {
      mounted.current = false;
    };
  }, []);
  const logout = async () => {
    await request('/v1/auth/logout', 'POST', {});
    sessionEpoch.current++;
    nativeToken = null;
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(SESSION_KEY);
    setSnapshot(null);
  };
  useEffect(() => {
    if (DEMO || !snapshot?.state.entered) return;
    const poll = async () => {
      if (refreshing.current || busy.current || AppState.currentState !== 'active') return;
      refreshing.current = true;
      try {
        await refresh();
      } catch {
        // refresh() handles revoked sessions and the offline banner.
      } finally {
        refreshing.current = false;
      }
    };
    const timer = setInterval(poll, 10000);
    const subscription = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setResuming(true);
        void poll().finally(() => setResuming(false));
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [snapshot?.userId, snapshot?.state.entered]);
  useEffect(() => {
    if (DEMO || !snapshot) return;
    const visibility = snapshot.state.visibility;
    if (
      visibility.audience === 'nobody' ||
      (visibility.until !== null && visibility.until <= Date.now())
    )
      return;
    let disposed = false;
    const heartbeat = async () => {
      if (disposed || busy.current || AppState.currentState !== 'active') return;
      try {
        const position = await locate(false);
        if (disposed || AppState.currentState !== 'active') return;
        await request('/v1/presence', 'PUT', { position });
      } catch {
        /* Permission revocation/offline stops updates; server freshness expires presence. */
      }
    };
    const timer = setInterval(heartbeat, 60000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [snapshot?.userId, snapshot?.state.visibility.audience, snapshot?.state.visibility.until]);
  const commit = async (before: State, after: State) => {
    if (busy.current) throw new Error('Please wait for the previous change.');
    busy.current = true;
    try {
      const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
      const addedBlock = after.blocked.find((id) => !before.blocked.includes(id)),
        removedBlock = before.blocked.find((id) => !after.blocked.includes(id));
      if (addedBlock || removedBlock)
        await request('/v1/blocks/' + (addedBlock || removedBlock), 'POST', {
          blocked: !!addedBlock,
        });
      else if (changed(before.me, after.me)) await request('/v1/profile', 'PUT', after.me);
      else if (changed(before.visibility, after.visibility)) {
        const v = after.visibility;
        await request('/v1/visibility', 'PUT', {
          audience: v.audience,
          minutes: v.until === null ? null : Math.max(1, Math.ceil((v.until - Date.now()) / 60000)),
          ...(v.audience !== 'nobody' ? { position: await locate(true) } : {}),
        });
      } else if (changed(before.connections, after.connections)) {
        const id = [
          ...new Set([...Object.keys(before.connections), ...Object.keys(after.connections)]),
        ].find((id) => before.connections[id] !== after.connections[id]);
        if (!id) throw new Error('Connection not found');
        const action = !after.connections[id]
          ? 'remove'
          : after.connections[id] === 'connected'
            ? 'accept'
            : 'request';
        await request('/v1/connections/' + id, 'POST', { action });
      } else if (changed(before.messages, after.messages)) {
        const id = Object.keys(after.messages || {}).find(
          (id) => (after.messages?.[id].length || 0) > (before.messages?.[id]?.length || 0),
        );
        if (!id) throw new Error('Message not found');
        const message = after.messages![id].at(-1)!;
        await request('/v1/messages/' + id, 'POST', {
          text: message.text,
          clientId: Crypto.randomUUID(),
        });
      } else if (after.reports.length > before.reports.length) {
        const report = after.reports.at(-1)!;
        await request('/v1/reports', 'POST', {
          personId: report.personId,
          reason: report.reason,
          details: report.details,
        });
      } else throw new Error('No supported change was found');
      return await refresh();
    } finally {
      busy.current = false;
    }
  };
  const value: Service = {
    online: !offline,
    snapshot,
    config,
    api: request,
    refresh,
    commit,
    logout,
  };
  if (DEMO) return <Context.Provider value={value}>{children}</Context.Provider>;
  return (
    <Context.Provider value={value}>
      {loading || resuming ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: C.paper,
          }}
        >
          <ActivityIndicator color={C.primary} />
        </View>
      ) : error ? (
        <View
          style={{
            flex: 1,
            padding: 30,
            justifyContent: 'center',
            gap: 20,
            backgroundColor: C.paper,
          }}
        >
          <Text style={{ color: C.ink }}>{error}</Text>
          <Button onPress={() => void boot()}>Try again</Button>
        </View>
      ) : !snapshot ? (
        <AuthScreen
          config={config}
          onVerified={async (result) => {
            if (result.token && Platform.OS !== 'web') {
              await SecureStore.setItemAsync(SESSION_KEY, result.token);
              nativeToken = result.token;
            }
            sessionEpoch.current++;
            const { token, ...next } = result;
            setSnapshot(next);
          }}
        />
      ) : !snapshot.state.entered ? (
        <Onboarding
          initial={snapshot.state.me}
          onSave={async (profile) => {
            await request('/v1/profile', 'PUT', profile);
            await refresh();
          }}
        />
      ) : (
        <>
          {offline && (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: C.accent, backgroundColor: C.soft, padding: 10, fontSize: 11 }}
            >
              Connection lost · Retrying. Expired locations disappear automatically.
            </Text>
          )}
          {children}
        </>
      )}
    </Context.Provider>
  );
}
function AuthScreen({
  config,
  onVerified,
}: {
  config: Config | null;
  onVerified: (s: Bootstrap & { token?: string }) => Promise<void>;
}) {
  const { colors: C } = useTheme();
  const [email, setEmail] = useState(''),
    [code, setCode] = useState(''),
    [sent, setSent] = useState(false),
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const act = async () => {
    setBusy(true);
    setError('');
    try {
      if (!sent) {
        await request('/v1/auth/request-code', 'POST', { email });
        setSent(true);
      } else {
        const result = await request<Bootstrap & { token?: string }>('/v1/auth/verify', 'POST', {
          email,
          code,
          termsAccepted: accepted,
        });
        await onVerified(result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };
  const input = {
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    color: C.ink,
    backgroundColor: C.surface,
  };
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: 28,
        gap: 20,
        backgroundColor: C.paper,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontSize: 44, fontWeight: '800', color: C.ink }}>
        quad<Text style={{ color: C.primary }}>.</Text>
      </Text>
      <Text style={{ fontFamily: serif, fontSize: 34, color: C.ink }}>
        Your campus.{`\n`}Your people.
      </Text>
      <Text style={{ color: C.muted, lineHeight: 22 }}>
        Exclusively for Rutgers. Verify your school email to find your campus community.
      </Text>
      <TextInput
        accessibilityLabel="Rutgers school email"
        placeholder="you@rutgers.edu"
        placeholderTextColor={C.muted}
        style={input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!sent && !busy}
      />
      {sent && (
        <>
          <Text style={{ color: C.muted }}>
            Enter the six-digit code sent to {email}. It expires in 10 minutes.
          </Text>
          <TextInput
            accessibilityLabel="Verification code"
            placeholder="000000"
            placeholderTextColor={C.muted}
            style={input}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
        </>
      )}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="I am 18 or older and accept the terms and privacy policy"
        accessibilityState={{ checked: accepted }}
        onPress={() => setAccepted(!accepted)}
        style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}
      >
        <View
          style={{
            borderWidth: 1,
            borderColor: C.accent,
            borderRadius: 4,
            width: 23,
            height: 23,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {accepted && <Icon name="check" size={17} />}
        </View>
        <Text style={{ flex: 1, color: C.ink, fontSize: 12, lineHeight: 19 }}>
          I’m 18 or older, and I agree to Quad’s terms and privacy policy.
        </Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <Pressable onPress={() => void Linking.openURL((API || configOrigin()) + '/terms')}>
          <Text style={{ color: C.accent }}>Terms</Text>
        </Pressable>
        <Pressable onPress={() => void Linking.openURL((API || configOrigin()) + '/privacy')}>
          <Text style={{ color: C.accent }}>Privacy</Text>
        </Pressable>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: C.accent }}>
          {error}
        </Text>
      )}
      <Button
        loading={busy}
        disabled={!accepted || !email || (sent && code.length !== 6)}
        onPress={() => void act()}
      >
        {sent ? 'Verify & sign in' : 'Send sign-in code'}
      </Button>
      {sent && (
        <Button
          secondary
          disabled={busy}
          onPress={() => {
            setSent(false);
            setCode('');
            setError('');
          }}
        >
          Change email or resend code
        </Button>
      )}
      {!!config?.supportEmail && (
        <Text style={{ color: C.muted, fontSize: 11 }}>Need help? {config.supportEmail}</Text>
      )}
    </ScrollView>
  );
}
function configOrigin() {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '';
}
function Onboarding({
  initial,
  onSave,
}: {
  initial: Profile;
  onSave: (p: Profile) => Promise<void>;
}) {
  const { colors: C } = useTheme();
  const [profile, setProfile] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: 28,
        gap: 20,
        backgroundColor: C.paper,
      }}
    >
      <Text style={{ fontFamily: serif, fontSize: 34, color: C.ink }}>A little introduction.</Text>
      <Text style={{ color: C.muted }}>
        Start with your name. Interests, clubs, and experience can wait. You’ll start in Ghost Mode.
      </Text>
      {(['firstName', 'lastName', 'major'] as const).map((key) => (
        <TextInput
          key={key}
          accessibilityLabel={
            key === 'firstName' ? 'First name' : key === 'lastName' ? 'Last name' : 'Major'
          }
          placeholder={
            key === 'firstName'
              ? 'First name'
              : key === 'lastName'
                ? 'Last name'
                : 'Major (or Undeclared)'
          }
          placeholderTextColor={C.muted}
          value={profile[key]}
          maxLength={key === 'major' ? 100 : 40}
          onChangeText={(value) => setProfile({ ...profile, [key]: value })}
          style={{
            color: C.ink,
            borderWidth: 1,
            borderColor: C.line,
            backgroundColor: C.surface,
            padding: 16,
            borderRadius: 12,
          }}
        />
      ))}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: C.accent }}>
          {error}
        </Text>
      )}
      <Button
        loading={busy}
        disabled={!profile.firstName.trim() || !profile.lastName.trim()}
        onPress={async () => {
          setBusy(true);
          try {
            await onSave({ ...profile, major: profile.major.trim() || 'Undeclared' });
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save profile');
          } finally {
            setBusy(false);
          }
        }}
      >
        Explore Quad
      </Button>
    </ScrollView>
  );
}
