import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  ChevronDown,
  Compass,
  ExternalLink,
  Flag,
  Ghost,
  GraduationCap,
  HeartHandshake,
  Info,
  Instagram,
  Leaf,
  Linkedin,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  UserPlus,
  X,
} from './icons';
import type L from 'leaflet';
import CampusMap from './Map';
import { api, type Audience, type Data, type Experience, type Person, type Tag } from './types';

type Tab = 'map' | 'connections' | 'profile';
type Filter = 'everyone' | 'interests' | 'clubs' | 'connections';
const avatar = (p: Person) => `/avatars/${p.avatarStyle}.svg`;
function Avatar({ person, size = '' }: { person: Person; size?: string }) {
  return (
    <img
      className={`avatar ${size}`}
      src={avatar(person)}
      alt={`${person.firstName} ${person.lastName}`}
    />
  );
}
function Logo() {
  return (
    <span className="brand">
      <img src="/favicon.svg" alt="" />
      <span>
        quad<span className="brand-period">.</span>
      </span>
    </span>
  );
}
function Similarity({ person }: { person: Person }) {
  return person.similarity ? (
    <div className="similarity">
      <Sparkles size={13} />
      <span>{person.similarity.text}</span>
    </div>
  ) : null;
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <Compass size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
          ) || [],
        );
        const first = items[0],
          last = items.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`modal ${wide ? 'wide' : ''}`}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ConnectButton({
  person,
  onAction,
  busy,
  compact = false,
}: {
  person: Person;
  onAction: (p: Person, action: string) => void;
  busy: boolean;
  compact?: boolean;
}) {
  const status = person.relationship;
  return (
    <button
      disabled={busy}
      className={`${status === 'none' || status === 'incoming' ? 'button primary' : 'button secondary'} ${compact ? 'small' : ''}`}
      onClick={() =>
        onAction(
          person,
          status === 'none' ? 'request' : status === 'incoming' ? 'accept' : 'remove',
        )
      }
    >
      {status === 'none' ? (
        <UserPlus size={16} />
      ) : status === 'connected' ? (
        <CheckCheck size={16} />
      ) : status === 'incoming' ? (
        <Check size={16} />
      ) : (
        <Check size={16} />
      )}
      {status === 'none'
        ? 'Connect'
        : status === 'incoming'
          ? 'Accept request'
          : status === 'outgoing'
            ? 'Cancel request'
            : 'Connected'}
    </button>
  );
}
function PersonDetails({ person }: { person: Person }) {
  return (
    <>
      <div className="profile-hero">
        <div className="cover-art">
          <span />
          <span />
          <Leaf size={58} />
        </div>
        <Avatar person={person} size="xl" />
        <div className="profile-name">
          <h2>
            {person.firstName} {person.lastName}
          </h2>
          <span>
            <GraduationCap size={15} />
            {person.university}
          </span>
          <p>
            {person.major}
            {person.graduationYear ? ` · ’${String(person.graduationYear).slice(2)}` : ''}
          </p>
        </div>
      </div>
      <div className="profile-content">
        <Similarity person={person} />
        {person.bio && <p className="bio">{person.bio}</p>}
        <section>
          <h3>
            <Sparkles size={16} />A few things I’m into
          </h3>
          <div className="tags">
            {person.tags.length ? (
              person.tags.map((t) => (
                <span className="tag" key={t.id}>
                  {t.name}
                </span>
              ))
            ) : (
              <p className="muted">Still finding their favorites.</p>
            )}
          </div>
        </section>
        <section>
          <h3>
            <Users size={16} />
            Around campus
          </h3>
          {person.organizations.length ? (
            person.organizations.map((o) => (
              <div className="affiliation" key={o.id}>
                <span className="org-icon">
                  <Users size={18} />
                </span>
                <div>
                  <strong>{o.name}</strong>
                  <small>Campus organization</small>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No organizations added yet.</p>
          )}
        </section>
        {person.experiences.length > 0 && (
          <section>
            <h3>
              <BriefcaseBusiness size={16} />
              Things I’ve worked on
            </h3>
            {person.experiences.map((e, i) => (
              <div className="experience" key={e.id || i}>
                <strong>{e.title}</strong>
                <span>
                  {e.organization_name}
                  {e.time_label ? ` · ${e.time_label}` : ''}
                </span>
                {e.description && <p>{e.description}</p>}
              </div>
            ))}
          </section>
        )}
        {(person.instagramUrl || person.linkedinUrl) && (
          <section>
            <h3>Find me elsewhere</h3>
            <div className="social-links">
              {person.instagramUrl && (
                <a href={person.instagramUrl} target="_blank" rel="noreferrer">
                  <Instagram size={16} />
                  Instagram
                  <ExternalLink size={12} />
                </a>
              )}
              {person.linkedinUrl && (
                <a href={person.linkedinUrl} target="_blank" rel="noreferrer">
                  <Linkedin size={16} />
                  LinkedIn
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

export default function App() {
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [welcome, setWelcome] = useState(false),
    [tab, setTab] = useState<Tab>('map');
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState<Filter>('everyone'),
    [selected, setSelected] = useState<string | null>(null),
    [profile, setProfile] = useState<Person | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false),
    [editOpen, setEditOpen] = useState(false),
    [aboutOpen, setAboutOpen] = useState(false),
    [reportPerson, setReportPerson] = useState<Person | null>(null),
    [blockPerson, setBlockPerson] = useState<Person | null>(null);
  const [toast, setToast] = useState(''),
    [busy, setBusy] = useState(false),
    [sort, setSort] = useState<'relevance' | 'name'>('relevance'),
    [connectionTab, setConnectionTab] = useState<'connected' | 'incoming' | 'outgoing'>(
      'connected',
    ),
    [now, setNow] = useState(Date.now());
  const mapRef = useRef<L.Map | null>(null);
  const refresh = async () => {
    const next = await api<Data>('bootstrap');
    setData(next);
    return next;
  };
  useEffect(() => {
    refresh()
      .catch((e) => {
        if (e.status === 401) setWelcome(true);
        else setToast(e.message);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!data) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      refresh().catch((e) => {
        if (e.status === 401) {
          setData(null);
          setWelcome(true);
        } else setToast('Could not refresh campus. Your last view is shown.');
      });
    }, 15000);
    return () => clearInterval(timer);
  }, [!!data]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const act = async (work: () => Promise<unknown>, message: string) => {
    if (busy) return false;
    setBusy(true);
    try {
      await work();
      const next = await refresh();
      setProfile((p) =>
        p ? [...next.nearby, ...next.connections].find((x) => x.id === p.id) || null : null,
      );
      setToast(message);
      return true;
    } catch (e) {
      setToast((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const connection = async (p: Person, action: string) => {
    if (
      p.relationship === 'connected' &&
      action === 'remove' &&
      !window.confirm(`Remove your connection with ${p.firstName}?`)
    )
      return;
    await act(
      () => api('connections', { userId: p.id, action }),
      action === 'request'
        ? `Request sent to ${p.firstName}.`
        : action === 'accept'
          ? `You and ${p.firstName} are now connected.`
          : p.relationship === 'incoming'
            ? 'Request declined.'
            : 'Connection updated.',
    );
  };
  const freshPeople = useMemo(
    () => data?.nearby.filter((p) => !p.expiresAt || Date.parse(p.expiresAt) > now) || [],
    [data, now],
  );
  const people = useMemo(() => {
    if (!data) return [];
    const q = query.toLowerCase().trim();
    const myTags = new Set(data.me.tags.map((t) => t.id)),
      myOrgs = new Set(data.me.organizations.map((o) => o.id));
    const weight: Record<string, number> = { organization: 0, mutual: 1, major: 2, interest: 3 };
    return freshPeople
      .filter(
        (p) =>
          (!q ||
            [
              p.firstName,
              p.lastName,
              p.major,
              ...p.tags.map((t) => t.name),
              ...p.organizations.map((o) => o.name),
            ]
              .join(' ')
              .toLowerCase()
              .includes(q)) &&
          (filter === 'everyone' ||
            (filter === 'connections' && p.relationship === 'connected') ||
            (filter === 'interests' && p.tags.some((t) => myTags.has(t.id))) ||
            (filter === 'clubs' && p.organizations.some((o) => myOrgs.has(o.id)))),
      )
      .sort((a, b) =>
        sort === 'name'
          ? a.firstName.localeCompare(b.firstName)
          : (weight[a.similarity?.kind || ''] ?? 4) - (weight[b.similarity?.kind || ''] ?? 4) ||
            a.firstName.localeCompare(b.firstName),
      );
  }, [data, freshPeople, query, filter, sort]);
  const selectedPerson = people.find((p) => p.id === selected);
  const incoming = data?.connections.filter((p) => p.relationship === 'incoming').length || 0;
  const activeSharing =
    !!data &&
    data.settings.audience !== 'nobody' &&
    (!data.settings.visibleUntil || Date.parse(data.settings.visibleUntil) > now);
  const visible =
    activeSharing && !!data?.locationFreshUntil && Date.parse(data.locationFreshUntil) > now;
  const select = (p: Person) => {
    setSelected(p.id);
    if (p.position) mapRef.current?.panTo(p.position, { animate: true });
  };
  const login = async () => {
    setBusy(true);
    try {
      await api('demo/login', {});
      await refresh();
      setWelcome(false);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <header className="app-header">
        <a
          className="logo-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab('map');
          }}
          aria-label="Quad home"
        >
          <Logo />
        </a>
        <nav aria-label="Main navigation">
          {(
            [
              { id: 'map', label: 'Map', icon: MapPin },
              { id: 'connections', label: 'Connections', icon: Users },
              { id: 'profile', label: 'Profile', icon: GraduationCap },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              <item.icon size={17} />
              {item.label}
              {item.id === 'connections' && incoming > 0 && (
                <span className="nav-count">{incoming}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <span className="university">
            <span className="rutgers-mark">R</span>Rutgers University
            <ChevronDown size={13} />
          </span>
          <button className="demo-badge" onClick={() => setAboutOpen(true)}>
            DEMO
          </button>
          {data && (
            <button
              className="avatar-button"
              onClick={() => setTab('profile')}
              aria-label="Your profile"
            >
              <Avatar person={data.me} />
            </button>
          )}
        </div>
      </header>
      {loading ? (
        <div className="loading">
          <LoaderCircle className="spin" />
          <p>Finding your corner of campus…</p>
        </div>
      ) : !data ? (
        <main className="welcome-page">
          <div className="welcome-copy">
            <span className="eyebrow">
              <span className="tiny-dot" /> A SMALLER WORLD STARTS HERE
            </span>
            <h1>
              Your campus.
              <br />
              Your <em>people.</em>
            </h1>
            <p>
              There’s a good conversation around every corner.
              <br className="desktop-break" /> Find the people you already have something in common
              with.
            </p>
            <button className="button primary large" disabled={busy} onClick={login}>
              {busy ? <LoaderCircle className="spin" size={18} /> : <Compass size={18} />}Explore
              the Quad demo
              <ArrowRight size={18} />
            </button>
            <div className="welcome-note">
              <ShieldCheck size={16} />
              <span>Fictional students. Local data. No account needed.</span>
            </div>
          </div>
          <div className="welcome-visual">
            <img className="welcome-map" src="/campus.svg" alt="Illustrated campus map" />
            {[1, 2, 3, 4, 5].map((n, i) => (
              <img
                key={n}
                className={`welcome-pin pin-${i}`}
                src={`/avatars/${n}.svg`}
                alt="Fictional student illustration"
              />
            ))}
            <div className="welcome-card">
              <Sparkles size={17} />
              <div>
                <strong>A familiar face starts with a hello.</strong>
                <p>You’re both in Rutgers Formula Racing</p>
              </div>
            </div>
            <span className="welcome-location">
              <MapPin size={14} />
              College Avenue · Rutgers
            </span>
          </div>
        </main>
      ) : (
        <main className={`app-main ${tab}`}>
          <section className="page-intro">
            <div>
              <span className="eyebrow">
                {tab === 'map'
                  ? 'YOUR CAMPUS, CONNECTED'
                  : tab === 'connections'
                    ? 'GOOD CONNECTIONS START HERE'
                    : 'A LITTLE MORE YOU'}
              </span>
              <h1>
                {tab === 'map' ? (
                  <>
                    A little closer to <em>your people.</em>
                  </>
                ) : tab === 'connections' ? (
                  <>
                    Familiar faces. <em>New possibilities.</em>
                  </>
                ) : (
                  <>
                    Your corner of <em>campus.</em>
                  </>
                )}
              </h1>
              <p>
                {tab === 'map'
                  ? 'Discover the people around you. Find your reason to say hello.'
                  : tab === 'connections'
                    ? 'Keep a good conversation going. Your campus circle starts here.'
                    : 'A few details can be the start of a great conversation.'}
              </p>
            </div>
            <button
              className={`visibility-pill ${visible ? 'is-visible' : ''}`}
              onClick={() => setSettingsOpen(true)}
            >
              {visible ? <span className="tiny-dot" /> : <Ghost size={16} />}
              <span>
                {visible
                  ? 'You’re visible'
                  : activeSharing
                    ? 'Location paused'
                    : 'Ghost Mode is on'}
              </span>
              <ChevronDown size={14} />
            </button>
          </section>
          {tab === 'map' && (
            <>
              <div className="discovery-toolbar">
                <div className="filter-tabs" aria-label="Discovery filters">
                  {(
                    [
                      { id: 'everyone', label: 'Everyone', icon: Compass },
                      { id: 'interests', label: 'Shared interests', icon: Sparkles },
                      { id: 'clubs', label: 'My organizations', icon: Users },
                      { id: 'connections', label: 'Connections', icon: HeartHandshake },
                    ] as const
                  ).map((f) => (
                    <button
                      aria-pressed={filter === f.id}
                      className={filter === f.id ? 'selected' : ''}
                      key={f.id}
                      onClick={() => {
                        setFilter(f.id);
                        setSelected(null);
                      }}
                    >
                      <f.icon size={15} />
                      {f.label}
                    </button>
                  ))}
                </div>
                <span className="discovery-note">
                  <ShieldCheck size={14} />
                  Approximate locations, always.
                </span>
              </div>
              <div className="discovery-layout">
                <aside className="people-panel">
                  <div className="people-panel-top">
                    <div className="section-title">
                      <h2>
                        Around you <span>{people.length}</span>
                      </h2>
                      <button
                        className="icon-button"
                        title={sort === 'relevance' ? 'Sort by name' : 'Sort by relevance'}
                        aria-label={
                          sort === 'relevance'
                            ? 'Sort students by name'
                            : 'Sort students by relevance'
                        }
                        onClick={() => setSort(sort === 'relevance' ? 'name' : 'relevance')}
                      >
                        <ArrowDownUp size={15} />
                      </button>
                    </div>
                    <label className="search-field">
                      <Search size={17} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search people, interests, clubs"
                        aria-label="Search nearby students"
                      />
                      {query && (
                        <button
                          className="clear-search"
                          onClick={() => setQuery('')}
                          aria-label="Clear search"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </label>
                    <div className="list-caption">
                      <span>
                        {sort === 'relevance'
                          ? 'A little common ground first'
                          : 'Sorted by first name'}
                      </span>
                      <span>COLLEGE AVE</span>
                    </div>
                  </div>
                  <div className="people-list">
                    {people.length ? (
                      people.map((p) => (
                        <button
                          key={p.id}
                          className={`person-card ${selected === p.id ? 'selected' : ''}`}
                          onClick={() => select(p)}
                          aria-pressed={selected === p.id}
                        >
                          <div className="person-card-main">
                            <div className="avatar-wrap">
                              <Avatar person={p} />
                              <span />
                            </div>
                            <div className="person-card-copy">
                              <h3>
                                {p.firstName} {p.lastName}
                                {p.relationship === 'connected' && <CheckCheck size={13} />}
                              </h3>
                              <p>{p.major}</p>
                              <span>Class of {p.graduationYear || '—'}</span>
                            </div>
                            <span className="card-arrow">
                              <ArrowRight size={15} />
                            </span>
                          </div>
                          <div className="tags mini">
                            {p.tags.slice(0, 3).map((t) => (
                              <span key={t.id} className="tag">
                                {t.name}
                              </span>
                            ))}
                          </div>
                          <Similarity person={p} />
                        </button>
                      ))
                    ) : (
                      <Empty title="No one here just yet">
                        Try another interest or clear your filters.
                        <button
                          className="text-button"
                          onClick={() => {
                            setQuery('');
                            setFilter('everyone');
                          }}
                        >
                          Show everyone
                        </button>
                      </Empty>
                    )}
                  </div>
                  <div className="list-footer">
                    <Leaf size={15} />
                    <span>A familiar campus. A few new faces.</span>
                  </div>
                </aside>
                <section className="map-panel">
                  <CampusMap
                    people={people}
                    selected={selected}
                    onSelect={select}
                    mapRef={mapRef}
                  />
                  <div className="map-top">
                    <div className="campus-label">
                      <span className="campus-icon">
                        <GraduationCap size={20} />
                      </span>
                      <div>
                        <strong>College Avenue</strong>
                        <span>Rutgers University</span>
                      </div>
                      <ChevronDown size={14} />
                    </div>
                    <button
                      className="map-info"
                      aria-label="About this demo map"
                      onClick={() => setAboutOpen(true)}
                    >
                      <Info size={18} />
                    </button>
                  </div>
                  <div className="map-controls">
                    <button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
                      <Plus size={19} />
                    </button>
                    <button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
                      <Minus size={19} />
                    </button>
                    <span />
                    <button
                      aria-label="Center on campus"
                      onClick={() => mapRef.current?.setView([40.5015, -74.45], 15.5)}
                    >
                      <LocateFixed size={19} />
                    </button>
                  </div>
                  {selectedPerson && (
                    <div className="map-popup">
                      <button
                        className="popup-close icon-button"
                        aria-label="Close student popup"
                        onClick={() => setSelected(null)}
                      >
                        <X size={16} />
                      </button>
                      <div className="popup-identity">
                        <Avatar person={selectedPerson} size="large" />
                        <div>
                          <span className="eyebrow">A FACE AROUND CAMPUS</span>
                          <h3>
                            {selectedPerson.firstName} {selectedPerson.lastName}
                          </h3>
                          <p>
                            {selectedPerson.major} · ’
                            {String(selectedPerson.graduationYear).slice(2)}
                          </p>
                        </div>
                      </div>
                      <Similarity person={selectedPerson} />
                      <div className="popup-actions">
                        <button
                          className="button secondary"
                          onClick={() => setProfile(selectedPerson)}
                        >
                          View profile
                          <ArrowRight size={15} />
                        </button>
                        <ConnectButton person={selectedPerson} onAction={connection} busy={busy} />
                      </div>
                    </div>
                  )}
                  <div className="map-bottom">
                    <div className="map-presence">
                      <span className="tiny-dot" />
                      <strong>{people.length} students to discover</strong>
                      <span className="map-presence-divider" />
                      <span>Sample campus</span>
                    </div>
                    <span className="map-attribution">
                      Illustrated demo map · Not for navigation
                    </span>
                  </div>
                </section>
              </div>
              <div className="page-footer">
                <span>
                  <Sparkles size={14} />
                  The map is just the beginning. The best part happens in person.
                </span>
                <button onClick={() => setAboutOpen(true)}>
                  How Quad works
                  <ArrowRight size={13} />
                </button>
              </div>
            </>
          )}
          {tab === 'connections' && (
            <section className="connections-page">
              <div className="connections-heading">
                <div className="filter-tabs">
                  {(['connected', 'incoming', 'outgoing'] as const).map((t) => (
                    <button
                      key={t}
                      className={connectionTab === t ? 'selected' : ''}
                      onClick={() => setConnectionTab(t)}
                    >
                      {t === 'connected'
                        ? 'My connections'
                        : t === 'incoming'
                          ? 'Received requests'
                          : 'Sent requests'}
                      <span className="count-badge">
                        {data.connections.filter((p) => p.relationship === t).length}
                      </span>
                    </button>
                  ))}
                </div>
                <HeartHandshake size={26} />
              </div>
              <div className="connections-grid">
                {data.connections
                  .filter((p) => p.relationship === connectionTab)
                  .map((p) => (
                    <article key={p.id} className="connection-card">
                      <button className="connection-person" onClick={() => setProfile(p)}>
                        <Avatar person={p} size="large" />
                        <h3>
                          {p.firstName} {p.lastName}
                        </h3>
                        <p>{p.major}</p>
                      </button>
                      <Similarity person={p} />
                      <div className="connection-actions">
                        <ConnectButton person={p} busy={busy} onAction={connection} />
                        {p.relationship === 'incoming' && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => connection(p, 'remove')}
                          >
                            Decline
                          </button>
                        )}
                        {p.relationship === 'connected' && (
                          <button className="text-button" onClick={() => setProfile(p)}>
                            View profile
                            <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
              {!data.connections.some((p) => p.relationship === connectionTab) && (
                <Empty
                  title={
                    connectionTab === 'connected'
                      ? 'Your circle starts with a hello'
                      : connectionTab === 'incoming'
                        ? 'You’re all caught up'
                        : 'No pending hellos'
                  }
                >
                  Discover someone with a little common ground on the map.
                  <button className="button primary" onClick={() => setTab('map')}>
                    Explore campus
                    <ArrowRight size={15} />
                  </button>
                </Empty>
              )}
            </section>
          )}
          {tab === 'profile' && (
            <div className="my-profile-layout">
              <article className="my-profile">
                <PersonDetails person={data.me} />
                <button
                  className="button secondary edit-profile-button"
                  onClick={() => setEditOpen(true)}
                >
                  <Settings2 size={16} />
                  Edit profile
                </button>
              </article>
              <aside className="profile-aside">
                <div className="aside-card">
                  <span className="aside-icon">
                    <ShieldCheck size={25} />
                  </span>
                  <h3>Your location. Your call.</h3>
                  <p>Choose who can find you and for how long. Go invisible whenever you want.</p>
                  <button className="button secondary" onClick={() => setSettingsOpen(true)}>
                    <SlidersHorizontal size={16} />
                    Visibility settings
                  </button>
                </div>
                <div className="aside-card">
                  <span className="eyebrow">YOUR CAMPUS CIRCLE</span>
                  <strong className="big-number">
                    {data.connections.filter((p) => p.relationship === 'connected').length}
                  </strong>
                  <p>Good people, a little closer.</p>
                  <button className="text-button" onClick={() => setTab('connections')}>
                    View connections
                    <ArrowRight size={15} />
                  </button>
                </div>
                <div className="privacy-note">
                  <Info size={16} />
                  <p>
                    This is a local demo profile. University verification is simulated; nothing is
                    posted publicly.
                  </p>
                </div>
              </aside>
            </div>
          )}
        </main>
      )}
      {profile && (
        <Modal title="A little introduction" onClose={() => setProfile(null)}>
          <PersonDetails person={profile} />
          <div className="profile-modal-actions">
            <ConnectButton person={profile} onAction={connection} busy={busy} />
            <button
              className="icon-button"
              aria-label={`Report ${profile.firstName}`}
              onClick={() => {
                setReportPerson(profile);
                setProfile(null);
              }}
            >
              <Flag size={18} />
            </button>
            <button
              className="icon-button"
              aria-label={`Block ${profile.firstName}`}
              onClick={() => {
                setBlockPerson(profile);
                setProfile(null);
              }}
            >
              <Shield size={18} />
            </button>
          </div>
        </Modal>
      )}
      {settingsOpen && data && (
        <VisibilityDialog
          data={data}
          busy={busy}
          act={act}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {editOpen && data && (
        <ProfileEditor data={data} busy={busy} act={act} onClose={() => setEditOpen(false)} />
      )}
      {reportPerson && (
        <ReportDialog
          person={reportPerson}
          busy={busy}
          act={act}
          onClose={() => setReportPerson(null)}
        />
      )}
      {blockPerson && (
        <Modal title={`Block ${blockPerson.firstName}?`} onClose={() => setBlockPerson(null)}>
          <div className="modal-body">
            <p>
              You won’t see each other on the map or be able to connect. Any existing connection
              will be removed.
            </p>
            <p className="muted">You can unblock them in Visibility settings.</p>
            <div className="dialog-actions">
              <button className="button secondary" onClick={() => setBlockPerson(null)}>
                Cancel
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={async () => {
                  if (
                    await act(
                      () => api('blocks', { userId: blockPerson.id, action: 'block' }),
                      `${blockPerson.firstName} has been blocked.`,
                    )
                  ) {
                    setSelected(null);
                    setBlockPerson(null);
                  }
                }}
              >
                Block person
              </button>
            </div>
          </div>
        </Modal>
      )}
      {aboutOpen && (
        <Modal title="Real connections start nearby." onClose={() => setAboutOpen(false)}>
          <div className="modal-body about-content">
            <span className="about-symbol">
              <Compass size={38} />
            </span>
            <h3>Your campus. Your people.</h3>
            <p>
              Quad helps you find a reason to say hello, through shared clubs, interests, majors,
              and mutual connections.
            </p>
            <div className="notice">
              <Info size={18} />
              <div>
                <strong>You’re exploring a working local demo.</strong>
                <p>
                  All students are fictional, university verification is simulated, and the campus
                  illustration isn’t a live street map. Profile edits, connections, blocks, and
                  reports are saved on this computer. Reports have no staffed reviewer in this demo.
                </p>
              </div>
            </div>
            <p className="muted">
              Real sign-in, university email verification, a geographic map, and multi-user location
              updates are the next steps before a campus launch.
            </p>
            <button className="button primary" onClick={() => setAboutOpen(false)}>
              Got it
              <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Info size={18} />
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={16} />
          </button>
        </div>
      )}
      {welcome && data && null}
    </>
  );
}

type Act = (work: () => Promise<unknown>, message: string) => Promise<boolean>;
function VisibilityDialog({
  data,
  busy,
  act,
  onClose,
}: {
  data: Data;
  busy: boolean;
  act: Act;
  onClose: () => void;
}) {
  const [audience, setAudience] = useState<Audience>(data.settings.audience),
    [duration, setDuration] = useState('60'),
    [custom, setCustom] = useState('');
  const save = async () => {
    let expiry: string | null = null;
    if (audience !== 'nobody' && duration !== 'always') {
      const time =
        duration === 'custom' ? new Date(custom).getTime() : Date.now() + Number(duration) * 60000;
      if (!Number.isFinite(time) || time <= Date.now()) return;
      expiry = new Date(time).toISOString();
    }
    if (
      await act(
        async () => {
          await api('visibility', { audience, visibleUntil: expiry }, 'PUT');
          if (audience !== 'nobody') await api('demo/presence', {});
        },
        audience === 'nobody'
          ? 'Ghost Mode is on. Your location was removed.'
          : 'Visibility saved with a fictional campus position.',
      )
    )
      onClose();
  };
  return (
    <Modal title="Your location. Your call." onClose={onClose}>
      <div className="modal-body">
        <p className="dialog-intro">
          Choose your audience and how long you want to be discoverable.
        </p>
        <fieldset className="audience-options">
          <legend>Who can see you?</legend>
          {(
            [
              {
                id: 'university',
                icon: GraduationCap,
                label: 'Everyone at Rutgers',
                description: 'Meet people beyond your usual circle.',
              },
              {
                id: 'connections',
                icon: Users,
                label: 'My connections',
                description: 'Keep it to people you’ve connected with.',
              },
              {
                id: 'nobody',
                icon: Ghost,
                label: 'Nobody · Ghost Mode',
                description: 'Explore campus without appearing on the map.',
              },
            ] as const
          ).map((o) => (
            <label className={`audience-option ${audience === o.id ? 'chosen' : ''}`} key={o.id}>
              <o.icon size={21} />
              <span>
                <strong>{o.label}</strong>
                <small>{o.description}</small>
              </span>
              <input
                type="radio"
                name="audience"
                value={o.id}
                checked={audience === o.id}
                onChange={() => setAudience(o.id)}
              />
            </label>
          ))}
        </fieldset>
        {audience !== 'nobody' && (
          <>
            <label className="field-label">
              For how long?
              <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="180">3 hours</option>
                <option value="custom">Until a specific time</option>
                <option value="always">Always enabled</option>
              </select>
            </label>
            {duration === 'custom' && (
              <label className="field-label">
                Visible until
                <input
                  type="datetime-local"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                />
              </label>
            )}
          </>
        )}
        <div className="notice">
          <ShieldCheck size={18} />
          <p>
            All shared positions are approximate. This demo uses a fictional campus position, never
            your device’s GPS. Presence expires after 15 minutes without an update, even with
            “Always enabled.”
          </p>
        </div>
        <button
          className="button primary full-width"
          disabled={
            busy ||
            (audience !== 'nobody' &&
              duration === 'custom' &&
              (!custom || new Date(custom).getTime() <= Date.now()))
          }
          onClick={save}
        >
          {busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}Save visibility
        </button>
        {data.blocked.length > 0 && (
          <section className="blocked-section">
            <h3>Blocked people</h3>
            {data.blocked.map((p) => (
              <div key={p.id}>
                <span>
                  {p.firstName} {p.lastName}
                </span>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => api('blocks', { userId: p.id, action: 'unblock' }),
                      'Person unblocked. Previous connections are not restored.',
                    )
                  }
                >
                  Unblock
                </button>
              </div>
            ))}
          </section>
        )}
      </div>
    </Modal>
  );
}
function TagPicker({
  label,
  options,
  selected,
  onChange,
  max,
}: {
  label: string;
  options: Tag[];
  selected: string[];
  onChange: (v: string[]) => void;
  max: number;
}) {
  return (
    <fieldset className="tag-picker">
      <legend>
        {label}
        <span>
          {selected.length}/{max}
        </span>
      </legend>
      <div>
        {options.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={selected.includes(t.id)}
            className={`tag ${selected.includes(t.id) ? 'chosen' : ''}`}
            disabled={!selected.includes(t.id) && selected.length >= max}
            onClick={() =>
              onChange(
                selected.includes(t.id) ? selected.filter((x) => x !== t.id) : [...selected, t.id],
              )
            }
          >
            {selected.includes(t.id) && <Check size={12} />} {t.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
function ProfileEditor({
  data,
  busy,
  act,
  onClose,
}: {
  data: Data;
  busy: boolean;
  act: Act;
  onClose: () => void;
}) {
  const p = data.me;
  const [first, setFirst] = useState(p.firstName),
    [last, setLast] = useState(p.lastName),
    [major, setMajor] = useState(p.majorId),
    [year, setYear] = useState(p.graduationYear?.toString() || ''),
    [bio, setBio] = useState(p.bio),
    [tags, setTags] = useState(p.tags.map((t) => t.id)),
    [orgs, setOrgs] = useState(p.organizations.map((o) => o.id)),
    [instagram, setInstagram] = useState(p.instagramUrl || ''),
    [linkedin, setLinkedin] = useState(p.linkedinUrl || ''),
    [experiences, setExperiences] = useState<Experience[]>(p.experiences);
  const changeExperience = (i: number, key: keyof Experience, value: string) =>
    setExperiences(experiences.map((e, n) => (n === i ? { ...e, [key]: value } : e)));
  return (
    <Modal title="Make it feel like you." onClose={onClose} wide>
      <form
        className="modal-body edit-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await act(
              () =>
                api(
                  'profile',
                  {
                    firstName: first,
                    lastName: last,
                    majorId: major,
                    graduationYear: year ? Number(year) : null,
                    bio,
                    tagIds: tags,
                    organizationIds: orgs,
                    instagramUrl: instagram,
                    linkedinUrl: linkedin,
                    experiences,
                  },
                  'PUT',
                ),
              'Profile saved. Your common ground is up to date.',
            )
          )
            onClose();
        }}
      >
        <p className="dialog-intro">Keep it casual. A few details are all it takes.</p>
        <div className="form-grid">
          <label className="field-label">
            First name
            <input
              required
              maxLength={40}
              value={first}
              onChange={(e) => setFirst(e.target.value)}
            />
          </label>
          <label className="field-label">
            Last name
            <input required maxLength={40} value={last} onChange={(e) => setLast(e.target.value)} />
          </label>
          <label className="field-label">
            Major
            <select value={major} onChange={(e) => setMajor(e.target.value)}>
              {data.catalog.majors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Graduation year
            <input
              type="number"
              min="2020"
              max="2040"
              value={year}
              placeholder="Optional"
              onChange={(e) => setYear(e.target.value)}
            />
          </label>
        </div>
        <label className="field-label">
          A little about you
          <textarea
            rows={3}
            maxLength={240}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What should someone know before saying hello?"
          />
          <span className="field-hint">
            {bio.length}/240 · A conversation starter, not a résumé.
          </span>
        </label>
        <TagPicker
          label="Interests & hobbies"
          options={data.catalog.tags}
          selected={tags}
          onChange={setTags}
          max={8}
        />
        <TagPicker
          label="Campus organizations"
          options={data.catalog.organizations}
          selected={orgs}
          onChange={setOrgs}
          max={6}
        />
        <section className="experience-editor">
          <h3>
            Experience <span className="muted">Optional</span>
          </h3>
          {experiences.map((e, i) => (
            <div className="experience-fields" key={i}>
              <button
                type="button"
                className="icon-button remove-experience"
                onClick={() => setExperiences(experiences.filter((_, n) => n !== i))}
                aria-label={`Remove experience ${i + 1}`}
              >
                <X size={16} />
              </button>
              <label className="field-label">
                Role or project
                <input
                  required
                  maxLength={80}
                  value={e.title}
                  onChange={(ev) => changeExperience(i, 'title', ev.target.value)}
                />
              </label>
              <div className="form-grid">
                <label className="field-label">
                  Organization
                  <input
                    maxLength={80}
                    value={e.organization_name}
                    onChange={(ev) => changeExperience(i, 'organization_name', ev.target.value)}
                  />
                </label>
                <label className="field-label">
                  When
                  <input
                    maxLength={40}
                    placeholder="Summer 2026"
                    value={e.time_label}
                    onChange={(ev) => changeExperience(i, 'time_label', ev.target.value)}
                  />
                </label>
              </div>
              <label className="field-label">
                A sentence about it
                <textarea
                  rows={2}
                  maxLength={240}
                  value={e.description}
                  onChange={(ev) => changeExperience(i, 'description', ev.target.value)}
                />
              </label>
            </div>
          ))}
          {experiences.length < 5 && (
            <button
              className="text-button"
              type="button"
              onClick={() =>
                setExperiences([
                  ...experiences,
                  { title: '', organization_name: '', time_label: '', description: '' },
                ])
              }
            >
              <Plus size={14} />
              Add an experience
            </button>
          )}
        </section>
        <div className="form-grid">
          <label className="field-label">
            Instagram URL
            <input
              type="url"
              value={instagram}
              maxLength={250}
              placeholder="https://instagram.com/…"
              onChange={(e) => setInstagram(e.target.value)}
            />
          </label>
          <label className="field-label">
            LinkedIn URL
            <input
              type="url"
              maxLength={250}
              value={linkedin}
              placeholder="https://linkedin.com/in/…"
              onChange={(e) => setLinkedin(e.target.value)}
            />
          </label>
        </div>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}Save profile
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ReportDialog({
  person,
  busy,
  act,
  onClose,
}: {
  person: Person;
  busy: boolean;
  act: Act;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('Safety concern'),
    [details, setDetails] = useState('');
  return (
    <Modal title={`Report ${person.firstName}`} onClose={onClose}>
      <form
        className="modal-body"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await act(
              () => api('reports', { userId: person.id, reason, details }),
              'Report saved locally. This demo has no staffed review team.',
            )
          )
            onClose();
        }}
      >
        <p className="dialog-intro">Your report is private and won’t be shared with this person.</p>
        <label className="field-label">
          What happened?
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {[
              'Safety concern',
              'Harassment',
              'Impersonation',
              'Inappropriate profile',
              'Other',
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Anything else? <span className="muted">Optional</span>
          <textarea
            maxLength={1000}
            rows={4}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>
        <div className="notice">
          <Info size={16} />
          <p>Demo reports are saved on this computer. They are not sent to a moderation team.</p>
        </div>
        <button className="button primary full-width" disabled={busy} type="submit">
          <Flag size={16} />
          Save report
        </button>
      </form>
    </Modal>
  );
}
