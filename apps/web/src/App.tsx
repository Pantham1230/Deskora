import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import { BillingPage as BillingPageRoute } from './pages/BillingPage';
import { BookingsPage as BookingsPageRoute } from './pages/BookingsPage';
import { CommandCenterPage as CommandCenterPageRoute } from './pages/CommandCenterPage';
import { FeedbackInsightsPanel, HeatmapAnalyticsPanel } from './pages/DeskoraModules';
import { useToast } from './components/Toast';
import { AreaChart, Area, BarChart, Bar, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bookMeetingRoom, bookSeat, cancelSeat, cancelMeetingRoom, createBranch, createClient, createEmployee, createInvoice, getDashboard, getPublicWorkspaces, listBranches, listClients, listEmployees, listInvoices, listMeetingRooms, listMyBookings, listNotifications, listSeats, listCompanies } from './api';
import type { Booking, Branch, Client, DashboardResponse, Employee, Feedback, HeatmapCell, Invoice, MeetingRoom, Notification, Role, Seat, SmartInsight, Subscription } from './types';
import type { CreateBranchPayload, PublicWorkspaceSummary } from './api';
import { useAuthStore } from './store/auth';
import { io, type Socket } from 'socket.io-client';
import { AnimatePresence, motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import WorkspacePhoto from './components/WorkspacePhoto';
import VisitorsPanel from './components/VisitorsPanel';
import { getSocketUrl } from './lib/runtimeUrls';
const operatorNavItems: Array<{ to: string; label: string; roles: Role[] }> = [
  { to: '/app/dashboard', label: 'Command Center', roles: ['admin'] },
  { to: '/app/branches', label: 'Branches', roles: ['admin'] },
  { to: '/app/bookings', label: 'Bookings', roles: ['admin'] },
  { to: '/app/crm', label: 'CRM', roles: ['admin'] },
  { to: '/app/billing', label: 'Billing', roles: ['admin'] },
  { to: '/app/analytics', label: 'Analytics', roles: ['admin'] },
  { to: '/app/settings', label: 'Settings', roles: ['admin'] }
] as const;

const clientNavItems: Array<{ to: string; label: string; roles: Role[] }> = [
  { to: '/app/explore', label: 'Explore Workspaces', roles: ['client'] },
  { to: '/app/bookings', label: 'Bookings', roles: ['client'] },
  { to: '/app/billing', label: 'Billing & Payments', roles: ['client'] },
  { to: '/app/settings', label: 'Settings', roles: ['client'] }
] as const;

function getAppHomePath(role: Role | null | undefined) {
  return role === 'client' ? '/app/explore' : '/app/dashboard';
}

function getNavItems(role: Role | null | undefined) {
  return role === 'client' ? clientNavItems : operatorNavItems;
}

const roleThemes: Record<Role | 'default', { accent: string; accentSoft: string; accentText: string; accentMuted: string; surface: string; ring: string }> = {
  admin: { accent: '#8b5cf6', accentSoft: '#ede9fe', accentText: '#4c1d95', accentMuted: '#c4b5fd', surface: '#faf7ff', ring: 'rgba(139,92,246,0.18)' },
  client: { accent: '#fb7185', accentSoft: '#ffe4e6', accentText: '#9f1239', accentMuted: '#fda4af', surface: '#fff7f8', ring: 'rgba(251,113,133,0.18)' },
  default: { accent: '#60a5fa', accentSoft: '#dbeafe', accentText: '#1d4ed8', accentMuted: '#93c5fd', surface: '#f8fbff', ring: 'rgba(96,165,250,0.18)' }
};

function getTheme(role: Role | null | undefined) {
  return role ? roleThemes[role] : roleThemes.default;
}

function panelClassName(extra = '') {
  return `rounded-[28px] border border-slate-200/80 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl ${extra}`;
}

function sectionCardClassName(extra = '') {
  return `rounded-[24px] border border-slate-200/80 bg-white/90 shadow-soft ${extra}`;
}

type ActivityEvent = {
  id: string;
  title: string;
  detail: string;
  tone: 'booking' | 'payment' | 'client' | 'renewal' | 'meeting';
  createdAt: string;
};

const activityToneStyles: Record<ActivityEvent['tone'], { label: string; className: string }> = {
  booking: { label: 'Booking', className: 'bg-[rgb(var(--role-accent-soft))] text-[rgb(var(--role-accent-text))]' },
  payment: { label: 'Payment', className: 'bg-emerald-50 text-emerald-700' },
  client: { label: 'Client', className: 'bg-sky-50 text-sky-700' },
  renewal: { label: 'Renewal', className: 'bg-amber-50 text-amber-700' },
  meeting: { label: 'Meeting', className: 'bg-fuchsia-50 text-fuchsia-700' }
};

function pushDeskoraActivity(event: Omit<ActivityEvent, 'id' | 'createdAt'>) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('deskora:activity', { detail: { ...event, id: crypto.randomUUID(), createdAt: new Date().toISOString() } }));
}

function buildActivityFeed(data: DashboardResponse | null): ActivityEvent[] {
  if (!data) return [];
  const paymentEntries: ActivityEvent[] = data.payments.slice(0, 3).map((payment, index) => ({
    id: `payment-${index}`,
    title: payment.status === 'paid' ? 'Invoice paid' : 'Payment pending',
    detail: `Transaction for ₹${payment.amount.toLocaleString()} recorded in billing.`,
    tone: (payment.status === 'paid' ? 'payment' : 'renewal') as ActivityEvent['tone'],
    createdAt: new Date(Date.now() - index * 3600000).toISOString()
  }));

  const clientEntries: ActivityEvent[] = data.clients.slice(0, 2).map((client, index) => ({
    id: `client-${index}`,
    title: 'Client onboarded',
    detail: `${client.name} moved to ${client.stage} stage with Deskora.`,
    tone: 'client' as ActivityEvent['tone'],
    createdAt: new Date(Date.now() - (index + 2) * 5400000).toISOString()
  }));

  const bookingEntries: ActivityEvent[] = data.recentNotifications.slice(0, 3).map((notification, index) => ({
    id: `booking-${index}`,
    title: notification.title,
    detail: notification.body,
    tone: (notification.type === 'payment' ? 'payment' : notification.type === 'renewal' ? 'renewal' : 'booking') as ActivityEvent['tone'],
    createdAt: notification.createdAt
  }));

  return [...paymentEntries, ...clientEntries, ...bookingEntries].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 6);
}

function hashString(value: string) {
  return Array.from(value).reduce((accumulator, character) => ((accumulator << 5) - accumulator) + character.charCodeAt(0), 0);
}

function getBranchPalette(branchName: string) {
  const palette = [
    ['#8b5cf6', '#22c55e'],
    ['#0ea5e9', '#14b8a6'],
    ['#f97316', '#fb7185'],
    ['#22c55e', '#84cc16'],
    ['#ec4899', '#f59e0b']
  ] as const;
  return palette[Math.abs(hashString(branchName)) % palette.length];
}

function getSeatTone(status: Seat['status']) {
  if (status === 'available') return 'bg-emerald-400';
  if (status === 'reserved') return 'bg-amber-300';
  if (status === 'booked') return 'bg-rose-400';
  return 'bg-sky-400';
}

function getZoneTone(type: string) {
  switch (type) {
    case 'private_cabin':
      return 'from-violet-100 to-violet-200 text-violet-900';
    case 'meeting_room':
      return 'from-sky-100 to-sky-200 text-sky-900';
    case 'lounge':
      return 'from-amber-100 to-amber-200 text-amber-900';
    default:
      return 'from-emerald-100 to-emerald-200 text-emerald-900';
  }
}

function loadLocalFeedback(): Feedback[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem('deskora-feedback');
    return raw ? JSON.parse(raw) as Feedback[] : [];
  } catch {
    return [];
  }
}

function saveLocalFeedback(feedback: Feedback[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('deskora-feedback', JSON.stringify(feedback));
}

const premiumRoomTitles = [
  'Atlas Conference Hall',
  'Nova Collaboration Room',
  'Orbit Executive Cabin',
  'Zenith Startup Bay',
  'PixelForge Creative Lounge'
];

function getRoomIntensity(name: string, capacity: number) {
  const hash = Math.abs(hashString(name + String(capacity)));
  return Math.min(94, 38 + (hash % 44));
}

function usePublicWorkspaceCatalog() {
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof getPublicWorkspaces>> | null>(null);

  useEffect(() => {
    let mounted = true;
    getPublicWorkspaces().then((response) => {
      if (mounted) setCatalog(response);
    }).catch(() => {
      if (mounted) setCatalog({ workspaces: [] });
    });
    return () => {
      mounted = false;
    };
  }, []);

  return catalog;
}

function usePublicWorkspaces() {
  const catalog = usePublicWorkspaceCatalog();
  return (catalog?.workspaces ?? []) as PublicWorkspaceSummary[];
}

function getWorkspaceDisplayAmenities(workspace: PublicWorkspaceSummary) {
  return workspace.amenities.slice(0, 3);
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });
}

async function filesToDataUrls(files: FileList | null | undefined) {
  if (!files || files.length === 0) return [];
  return Promise.all(Array.from(files).map((file) => fileToDataUrl(file)));
}

function App() {
  const { user, claims, loading, signOut } = useAuthStore();
  const homePath = getAppHomePath(claims?.role);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-200">Loading Deskora...</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/explore" element={<ExploreWorkspacesPage />} />
      <Route path="/workspace/:companyId/:branchId" element={<WorkspaceDetailPage />} />
      <Route path="/sign-in" element={user ? <Navigate to={getAppHomePath(claims?.role)} replace /> : <SignInPage />} />
      <Route path="/sign-up" element={user ? <Navigate to={getAppHomePath(claims?.role)} replace /> : <SignUpPage />} />
      <Route path="/login" element={<Navigate to="/sign-in" replace />} />
      <Route path="/app" element={user ? <AppShell onSignOut={signOut} /> : <Navigate to="/sign-in" replace />}>
        <Route index element={<Navigate to={claims?.role === 'client' ? 'explore' : 'dashboard'} replace />} />
        <Route path="explore" element={<ClientExplorePage />} />
        <Route path="bookings" element={<BookingsPageRoute />} />
        <Route path="dashboard" element={<OperatorOnly><CommandCenterPageRoute /></OperatorOnly>} />
        <Route path="command-center" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="twin" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="heatmap" element={<Navigate to="/app/analytics" replace />} />
        <Route path="feedback" element={<Navigate to="/app/settings" replace />} />
        <Route path="branches" element={<OperatorOnly><BranchesPage /></OperatorOnly>} />
        <Route path="seats" element={<Navigate to="/app/bookings?tab=desks" replace />} />
        <Route path="meeting-rooms" element={<Navigate to="/app/bookings?tab=rooms" replace />} />
        <Route path="crm" element={<OperatorOnly><CRMPage /></OperatorOnly>} />
        <Route path="billing" element={<BillingPageRoute />} />
        <Route path="staff" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="analytics" element={<OperatorOnly><AnalyticsPage /></OperatorOnly>} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? homePath : '/'} replace />} />
    </Routes>
  );
}

function OperatorOnly({ children }: { children: React.ReactNode }) {
  const role = useAuthStore((state) => state.claims?.role);
  if (role === 'client') return <Navigate to="/app/explore" replace />;
  return <>{children}</>;
}

function VerificationBadge({ status }: { status: 'verified' | 'pending' }) {
  return status === 'verified'
    ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">Verified Workspace</span>
    : <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">Pending Verification</span>;
}

function AppShell({ onSignOut }: { onSignOut: () => void }) {
  const { user, claims } = useAuthStore();
  const location = useLocation();
  const theme = getTheme(claims?.role);

  const items = getNavItems(claims?.role).filter((item) => claims && item.roles.includes(claims.role));
  const isClient = claims?.role === 'client';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.08),transparent_24%),linear-gradient(180deg,#fbf9f7_0%,#f7f5ff_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 p-4 md:p-6" style={{ ['--role-accent' as never]: theme.accent, ['--role-accent-soft' as never]: theme.accentSoft, ['--role-accent-text' as never]: theme.accentText, ['--role-accent-muted' as never]: theme.accentMuted } as React.CSSProperties}>
        <aside className={`${panelClassName('hidden w-72 shrink-0 flex-col p-6 md:flex')}`}>
          <div className="mb-8">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-400">Deskora</div>
            <div className="mt-2 font-display text-2xl font-bold text-slate-900">{isClient ? 'Workspace Marketplace' : 'Coworking OS'}</div>
            <p className="mt-3 text-sm leading-6 text-slate-500">{isClient ? 'Browse verified coworking brands, book desks and rooms, and manage payments from one global account.' : 'A premium operating system for coworking companies with bookings, billing, CRM, and live occupancy in one place.'}</p>
          </div>
          <nav className="flex flex-1 flex-col gap-2">
            {items.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <a key={item.to} href={item.to} className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${active ? 'bg-[rgb(var(--role-accent))]/10 text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-[rgb(var(--role-accent))]/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
                  <span className="flex items-center justify-between gap-3">
                    <span>{item.label}</span>
                    {active ? <span className="h-2 w-2 rounded-full bg-[rgb(var(--role-accent))]" /> : null}
                  </span>
                </a>
              );
            })}
          </nav>
          <div className="mt-6 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-[rgb(var(--role-accent-soft))] p-4 shadow-soft">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Signed in</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{user?.name}</div>
            <div className="text-xs capitalize text-slate-500">{claims?.role?.replace('_', ' ')}</div>
            <button onClick={onSignOut} className="mt-4 w-full rounded-2xl bg-[rgb(var(--role-accent))] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">Sign out</button>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <header className={`${panelClassName('mb-6 px-5 py-4 md:px-7')}`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{isClient ? 'Member workspace' : 'Internal management console'}</div>
                <h1 className="mt-2 font-display text-2xl font-bold text-slate-900 md:text-3xl">{isClient ? 'Book and manage workspaces across every city.' : 'Tenant-safe operations for every branch.'}</h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">Tenant: {claims?.tenantId}</div>
                  <div className="rounded-full border border-slate-200 bg-[rgb(var(--role-accent-soft))] px-4 py-2 font-medium capitalize text-slate-700 shadow-sm">Role: {claims?.role?.replace('_', ' ')}</div>
                </div>
                <button onClick={onSignOut} className="ml-3 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm">Sign out</button>
              </div>
            </div>
          </header>
          <div className={`${panelClassName('p-4 md:p-6')}`}>
            <AnimatePresence mode="wait">
              <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={sectionCardClassName('p-5')}>
      <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-bold text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{hint}</div>
    </div>
  );
}

function AnimatedStatCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: string }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className={sectionCardClassName('overflow-hidden p-5')}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</div>
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <AnimatedCounter value={value} accent={accent} />
      <div className="mt-2 text-sm text-slate-500">{hint}</div>
    </motion.div>
  );
}

function AnimatedCounter({ value, accent }: { value: string; accent: string }) {
  const prefix = value.match(/^[^\d-]+/)?.[0] ?? '';
  const suffix = value.match(/[^\d.]+$/)?.[0] ?? '';
  const target = Number(value.replace(/[^\d.]/g, ''));
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let animationFrame = 0;
    const startedAt = performance.now();
    const duration = 850;

    const tick = (timestamp: number) => {
      const progress = Math.min((timestamp - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(target * eased);
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [target]);

  return (
    <div className="mt-3 flex items-end gap-1">
      <div className="text-3xl font-bold text-slate-900" style={{ color: accent }}>
        {prefix}
        {Number.isFinite(target) ? Math.round(current).toLocaleString() : value}
        {suffix}
      </div>
    </div>
  );
}

function useDashboardData() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getDashboard()
      .then((response) => {
        if (mounted) setData(response);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Unable to load dashboard');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { data, loading, error, setData };
}

function DashboardPage() {
  const role = useAuthStore((state) => state.claims?.role);
  const theme = getTheme(role);
  const { data, loading, error } = useDashboardData();
  const [liveData, setLiveData] = useState<DashboardResponse | null>(null);
  const [liveFeed, setLiveFeed] = useState<ActivityEvent[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<MeetingRoom[]>([]);
  const [localFeedback, setLocalFeedback] = useState<Feedback[]>(loadLocalFeedback);
  const [feedbackDraft, setFeedbackDraft] = useState({ rating: 5, category: 'workspace' as Feedback['category'], message: '', sentiment: 'positive' as Feedback['sentiment'] });

  useEffect(() => {
    setLiveData(data);
    setLiveFeed(buildActivityFeed(data));
  }, [data]);

  useEffect(() => {
    listBranches().then((branchData) => {
      setBranches(branchData);
      if (!selectedBranchId && branchData[0]) {
        setSelectedBranchId(branchData[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedBranchId) return;
    Promise.all([listSeats(selectedBranchId), listMeetingRooms(selectedBranchId)]).then(([seatData, roomData]) => {
      setSelectedSeats(seatData);
      setSelectedRooms(roomData);
    });
  }, [selectedBranchId]);

  useEffect(() => {
    const handleActivity = (event: Event) => {
      const customEvent = event as CustomEvent<ActivityEvent>;
      setLiveFeed((current) => [customEvent.detail, ...current].slice(0, 6));
    };

    window.addEventListener('deskora:activity', handleActivity);
    return () => window.removeEventListener('deskora:activity', handleActivity);
  }, []);

  if (loading) return <PageLoading label="Loading dashboard" />;
  if (error) return <PageEmpty title="Dashboard unavailable" description={error} />;
  if (!data || !liveData) return null;

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0] ?? liveData.branchStats[0];
  const selectedBranchStat = liveData.branchStats.find((branch) => branch.id === selectedBranch?.id) ?? liveData.branchStats[0];
  const palette = getBranchPalette(selectedBranch?.name ?? 'Deskora');
  const combinedFeedback = [...localFeedback, ...liveData.feedback].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const branchFeedback = combinedFeedback.filter((item) => item.branchId === selectedBranch?.id);
  const averageRating = branchFeedback.length === 0 ? 0 : branchFeedback.reduce((sum, item) => sum + item.rating, 0) / branchFeedback.length;
  const topHeatmapCells = [...liveData.heatmap].filter((cell) => cell.branchId === selectedBranch?.id).sort((left, right) => right.intensity - left.intensity).slice(0, 4);
  const branchSubscription = liveData.subscriptions.find((subscription) => subscription.companyId === selectedBranch?.companyId);

  const trend = liveData.branchStats.map((branch) => ({ name: branch.name, occupancy: branch.occupancyRate, booked: branch.bookedSeats }));
  const pieData = [
    { name: 'Occupied', value: liveData.totals.occupancyRate },
    { name: 'Available', value: Math.max(100 - liveData.totals.occupancyRate, 0) }
  ];
  const statTargets = [
    { label: 'Occupancy', value: `${liveData.totals.occupancyRate}%`, hint: 'Across every branch under the tenant.' },
    { label: 'Active clients', value: String(liveData.totals.activeClients), hint: 'Converted clients currently on contract.' },
    { label: 'Branches', value: String(liveData.totals.branches), hint: 'Multi-branch footprint across the tenant.' },
    { label: 'Seats', value: String(liveData.totals.seats), hint: 'Total seats tracked with live status updates.' }
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[rgb(var(--role-accent-soft))] to-white px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.35em] text-slate-400">Digital Twin Control Room</div>
                <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">{selectedBranch?.name ?? 'Branch overview'} · {selectedBranch?.city ?? 'Live location'}</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">Spatial workspace intelligence with live occupancy, room activity, and premium coworking branding.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Rating" value={averageRating ? `${averageRating.toFixed(1)} / 5` : 'New'} />
                <MiniStat label="Occupancy" value={`${selectedBranchStat?.occupancyRate ?? 0}%`} />
                <MiniStat label="Rooms" value={String(selectedRooms.length)} />
                <MiniStat label="Subscription" value={branchSubscription?.tier ?? 'business'} />
              </div>
            </div>
          </div>
          <div className="grid gap-5 p-6 xl:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {branches.map((branch) => (
                  <button key={branch.id} onClick={() => setSelectedBranchId(branch.id)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selectedBranchId === branch.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {branch.name}
                  </button>
                ))}
              </div>
              <div className={`rounded-[28px] border border-slate-200/80 p-4 shadow-sm`} style={{ background: `linear-gradient(135deg, ${palette[0]}10, ${palette[1]}10)` }}>
                <div className="grid gap-3 lg:grid-cols-[1.2fr,0.8fr]">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                    {selectedSeats.slice(0, 12).map((seat, index) => (
                      <motion.div key={seat.id} whileHover={{ scale: 1.03, y: -3 }} className="rounded-2xl border border-white/70 bg-white/90 p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">{seat.label}</div>
                          <span className={`h-2.5 w-2.5 rounded-full ${getSeatTone(seat.status)}`} />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span>Floor {seat.floor}</span>
                          <span>{seat.zone}</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                          <motion.div initial={{ width: 0 }} animate={{ width: seat.status === 'available' ? '18%' : seat.status === 'reserved' ? '58%' : seat.status === 'booked' ? '92%' : '76%' }} className={`${getSeatTone(seat.status)} h-full`} />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="text-sm uppercase tracking-[0.25em] text-slate-400">Zone heatmap</div>
                      <div className="mt-4 space-y-2">
                        {topHeatmapCells.map((cell) => (
                          <div key={cell.id} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                            <div>
                              <div className="font-semibold text-slate-900">{cell.zone}</div>
                              <div className="text-xs text-slate-500">{cell.label}</div>
                            </div>
                            <div className="h-10 w-10 rounded-full" style={{ background: `radial-gradient(circle, ${palette[0]} ${Math.max(cell.intensity, 20)}%, ${palette[1]} 100%)` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="text-sm uppercase tracking-[0.25em] text-slate-400">Meeting rooms</div>
                      <div className="mt-3 space-y-2">
                        {selectedRooms.map((room) => (
                          <div key={room.id} className="rounded-2xl border border-slate-100 bg-[rgb(var(--role-accent-soft))] px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold text-slate-900">{room.name}</div>
                              <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">₹{room.hourlyRate}/hr</div>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Capacity {room.capacity} · live occupancy layer active</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="text-sm uppercase tracking-[0.25em] text-slate-400">Smart Insights</div>
                <div className="mt-4 space-y-3">
                  {liveData.insights.map((insight: SmartInsight) => (
                    <motion.div key={insight.id} whileHover={{ y: -2 }} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${insight.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : insight.tone === 'warning' ? 'bg-amber-50 text-amber-700' : insight.tone === 'info' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'}`}>{insight.tone}</div>
                          <div className="mt-2 font-semibold text-slate-900">{insight.title}</div>
                          <div className="mt-1 text-sm text-slate-500">{insight.detail}</div>
                        </div>
                        <span className="h-3 w-3 rounded-full bg-[rgb(var(--role-accent))] shadow-[0_0_18px_rgba(15,23,42,0.2)]" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm uppercase tracking-[0.25em] text-slate-400">Feedback & Experience</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">Branch experience score</div>
                  </div>
                  <div className="rounded-full bg-[rgb(var(--role-accent-soft))] px-3 py-1 text-sm font-semibold text-[rgb(var(--role-accent-text))]">{branchFeedback.length} reviews</div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MiniStat label="Average rating" value={averageRating ? averageRating.toFixed(1) : '0.0'} />
                  <MiniStat label="Positive sentiment" value={`${Math.round((branchFeedback.filter((item) => item.sentiment === 'positive').length / Math.max(branchFeedback.length, 1)) * 100)}%`} />
                  <MiniStat label="Experience score" value={String(Math.round((averageRating * 18) + (selectedBranchStat?.experienceScore ?? 0) / 2))} />
                </div>
                <div className="mt-4 grid gap-2">
                  {combinedFeedback.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span>{item.sentiment === 'positive' ? '😊' : item.sentiment === 'neutral' ? '🙂' : '⚠️'}</span>
                          <div className="font-semibold text-slate-900">{item.message}</div>
                        </div>
                        <div className="text-xs text-slate-400">{item.rating}/5</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <SelectField label="Category" value={feedbackDraft.category} onChange={(value) => setFeedbackDraft((current) => ({ ...current, category: value as Feedback['category'] }))} options={[{ label: 'Workspace', value: 'workspace' }, { label: 'Meeting room', value: 'meeting_room' }, { label: 'Maintenance', value: 'maintenance' }, { label: 'Suggestion', value: 'suggestion' }]} />
                  <SelectField label="Sentiment" value={feedbackDraft.sentiment} onChange={(value) => setFeedbackDraft((current) => ({ ...current, sentiment: value as Feedback['sentiment'] }))} options={[{ label: 'Positive', value: 'positive' }, { label: 'Neutral', value: 'neutral' }, { label: 'Negative', value: 'negative' }]} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[0.5fr,1.5fr]">
                  <NumberField label="Rating" value={feedbackDraft.rating} onChange={(value) => setFeedbackDraft((current) => ({ ...current, rating: value }))} />
                  <TextField label="Feedback" value={feedbackDraft.message} onChange={(value) => setFeedbackDraft((current) => ({ ...current, message: value }))} />
                </div>
                <button onClick={() => {
                  const nextFeedback: Feedback = {
                    id: crypto.randomUUID(),
                    tenantId: selectedBranch?.tenantId ?? 'tenant-demo',
                    companyId: selectedBranch?.companyId ?? 'company-demo',
                    branchId: selectedBranch?.id ?? 'branch-demo',
                    clientId: liveData.clients[0]?.id ?? 'client-demo',
                    rating: feedbackDraft.rating,
                    category: feedbackDraft.category,
                    message: feedbackDraft.message || 'Workspace experience feedback captured.',
                    sentiment: feedbackDraft.sentiment,
                    createdAt: new Date().toISOString()
                  };
                  const nextList = [nextFeedback, ...localFeedback].slice(0, 24);
                  setLocalFeedback(nextList);
                  saveLocalFeedback(nextList);
                  setFeedbackDraft((current) => ({ ...current, message: '' }));
                  pushDeskoraActivity({ title: 'Feedback submitted', detail: `${nextFeedback.rating}/5 experience review captured for ${selectedBranch?.name}.`, tone: 'client' });
                }} className="mt-4 rounded-2xl bg-[rgb(var(--role-accent))] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90">Submit feedback</button>
              </div>

              <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="text-sm uppercase tracking-[0.25em] text-slate-400">Subscription lifecycle</div>
                <div className="mt-4 space-y-3">
                  {liveData.subscriptions.map((subscription) => (
                    <div key={subscription.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-semibold text-slate-900">{subscription.tier}</div>
                          <div className="mt-1 text-sm text-slate-500">Renews on {new Date(subscription.renewalDate).toLocaleDateString()} · auto-renew {subscription.autoRenew ? 'on' : 'off'}</div>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${subscription.status === 'active' ? 'bg-emerald-50 text-emerald-700' : subscription.status === 'expiring' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{subscription.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.3em] text-slate-400">Realtime pulse</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">Operational overview</div>
            </div>
            <div className="rounded-full bg-[rgb(var(--role-accent-soft))] px-3 py-1 text-xs font-semibold text-[rgb(var(--role-accent-text))]">{liveData.recentNotifications.length} updates</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2">
            <AnimatedStatCard label="Revenue" value={`₹${liveData.totals.revenue.toLocaleString()}`} hint="Collected invoice and payment value." accent={theme.accent} />
            <AnimatedStatCard label="Occupancy" value={`${liveData.totals.occupancyRate}%`} hint="Across every active branch." accent={theme.accentMuted} />
            <AnimatedStatCard label="Clients" value={String(liveData.totals.activeClients)} hint="Active tenants and member accounts." accent={theme.accent} />
            <AnimatedStatCard label="Branches" value={String(liveData.totals.branches)} hint="Cross-location portfolio footprint." accent={theme.accentMuted} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statTargets.map((metric) => (
          <AnimatedStatCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} accent={theme.accent} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
        <ChartCard title="Branch performance" subtitle="Occupancy and booking depth by branch">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18 }} />
              <Legend />
              <Bar dataKey="occupancy" fill={theme.accent} radius={[12, 12, 0, 0]} />
              <Bar dataKey="booked" fill={theme.accentMuted} radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <ChartCard title="Occupancy split" subtitle="Booked vs available capacity">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={78} outerRadius={118} paddingAngle={4}>
                {pieData.map((entry, index) => (
                  <Cell key={entry.name} fill={index === 0 ? theme.accent : theme.accentMuted} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Live activity feed" subtitle="Recent bookings, payments, renewals and client events">
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {liveFeed.map((event) => (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${activityToneStyles[event.tone].className}`}>{activityToneStyles[event.tone].label}</span>
                        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Live</span>
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{event.title}</div>
                      <div className="mt-1 text-sm text-slate-500">{event.detail}</div>
                    </div>
                    <div className="text-xs text-slate-400">{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ChartCard>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue momentum" subtitle="Seeded paid invoices and pending payments">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={liveData.branchStats.map((branch, index) => ({ name: branch.name, value: (index + 1) * 35000 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18 }} />
              <Area type="monotone" dataKey="value" stroke={theme.accent} fill={theme.ring} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <div className="space-y-4 rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Notifications</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">Operational pulse</div>
            </div>
            <div className="rounded-full bg-[rgb(var(--role-accent-soft))] px-3 py-1 text-xs font-semibold text-[rgb(var(--role-accent-text))]">{liveData.recentNotifications.length} updates</div>
          </div>
          <div className="space-y-3">
            {liveData.recentNotifications.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className={sectionCardClassName('p-5')}>
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function NotificationRow({ notification }: { notification: Notification }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold text-slate-900">{notification.title}</div>
          <div className="mt-1 text-sm text-slate-500">{notification.body}</div>
        </div>
        <span className="rounded-full bg-[rgb(var(--role-accent-soft))] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[rgb(var(--role-accent-text))]">{notification.type}</span>
      </div>
    </div>
  );
}

function BranchesPage() {
  const toast = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [visitorBranchId, setVisitorBranchId] = useState('');
  const [form, setForm] = useState<CreateBranchPayload>({ companyId: '', name: '', city: '', address: '', description: '', floors: 1, seatCount: 12, pricingPerSeat: 12000, meetingRoomCount: 2, heroImageUrl: '', galleryImageUrls: [] });

  useEffect(() => {
    Promise.all([listBranches(), listCompanies()]).then(([branchData, companyData]) => {
      setBranches(branchData);
      setCompanies(companyData);
      setVisitorBranchId((current) => current || branchData[0]?.id || '');
      setForm((current) => ({ ...current, companyId: companyData[0]?.id ?? current.companyId }));
    });
  }, []);

  const visitorBranch = branches.find((branch) => branch.id === visitorBranchId) ?? branches[0];

  const submit = async () => {
    try {
      const created = await createBranch(form);
      pushDeskoraActivity({ title: 'Branch created', detail: `${created.name} is now active under the tenant workspace.`, tone: 'client' });
      setBranches((current) => [...current, created]);
      toast.success('Workspace branch added', `${created.name} is now available in the marketplace.`);
    } catch (error) {
      toast.error('Unable to create branch', error instanceof Error ? error.message : 'Please check the form and try again.');
    }
  };

  return (
    <SectionLayout title="Multi-branch management" description="Create branches, track pricing, and centralize each location under one tenant.">
      {visitorBranch ? (
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-700">Visitor check-in</div>
            <select
              value={visitorBranchId}
              onChange={(event) => setVisitorBranchId(event.target.value)}
              className="rounded-2xl border border-violet-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-violet-400"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name} · {branch.city}</option>
              ))}
            </select>
          </div>
          <VisitorsPanel branchId={visitorBranch.id} branchName={visitorBranch.name} defaultFormOpen />
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="grid gap-3 md:grid-cols-2">
          {branches.map((branch) => {
            const company = companies.find((item) => item.id === branch.companyId);
            return (
              <div key={branch.id} className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                <WorkspacePhoto
                  title={branch.name}
                  subtitle={`${company?.name ?? 'Branch'} · ${branch.city}`}
                  tag={branch.description?.split('.')[0] ?? 'Branch workspace'}
                  src={branch.heroImageUrl}
                  seed={branch.id}
                  className="h-44 rounded-none border-0"
                  compact
                />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{branch.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{company?.name ?? 'Tenant branch'} · {branch.city}</div>
                      {branch.description ? <div className="mt-2 text-sm leading-6 text-slate-500">{branch.description}</div> : null}
                    </div>
                    <div className="rounded-full bg-[rgb(var(--role-accent-soft))] px-3 py-1 text-xs font-semibold text-[rgb(var(--role-accent-text))]">Live</div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                    <MiniStat label="Floors" value={String(branch.floors)} />
                    <MiniStat label="Seats" value={String(branch.seatCount)} />
                    <MiniStat label="Price" value={`₹${branch.pricingPerSeat.toLocaleString()}`} />
                    <MiniStat label="Rooms" value={String(branch.meetingRoomCount ?? 0)} />
                    <MiniStat label="Address" value={branch.address} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Add branch</div>
          <div className="mt-4 space-y-3">
            <SelectField label="Company" value={form.companyId} onChange={(value) => setForm((current) => ({ ...current, companyId: value }))} options={companies.map((company) => ({ label: company.name, value: company.id }))} />
            <TextField label="Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
            <TextField label="City" value={form.city} onChange={(value) => setForm((current) => ({ ...current, city: value }))} />
            <TextField label="Address" value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} />
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
              <textarea value={form.description ?? ''} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[rgb(var(--role-accent))]" placeholder="Describe the workspace vibe, layout, and audience." />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <NumberField label="Floors" value={form.floors} onChange={(value) => setForm((current) => ({ ...current, floors: value }))} />
              <NumberField label="Seats" value={form.seatCount} onChange={(value) => setForm((current) => ({ ...current, seatCount: value }))} />
              <NumberField label="Seat price" value={form.pricingPerSeat} onChange={(value) => setForm((current) => ({ ...current, pricingPerSeat: value }))} />
            </div>
            <NumberField label="Meeting room count" value={form.meetingRoomCount ?? 0} onChange={(value) => setForm((current) => ({ ...current, meetingRoomCount: value }))} />
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Workspace hero image</label>
              <input type="file" accept="image/*" onChange={async (event) => {
                const [heroImageUrl] = await filesToDataUrls(event.target.files);
                setForm((current) => ({ ...current, heroImageUrl: heroImageUrl ?? '', galleryImageUrls: current.galleryImageUrls ?? [] }));
              }} className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Gallery images</label>
              <input type="file" accept="image/*" multiple onChange={async (event) => {
                const galleryImageUrls = await filesToDataUrls(event.target.files);
                setForm((current) => ({ ...current, galleryImageUrls }));
              }} className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm" />
            </div>
            <button onClick={submit} className="rounded-2xl bg-teal-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-teal-400">Create branch</button>
          </div>
        </div>
      </div>
    </SectionLayout>
  );
}

function SeatsPage() {
  const [searchParams] = useSearchParams();
  const { user, claims } = useAuthStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState(searchParams.get('branchId') ?? '');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const token = useAuthStore((state) => state.token);
  const isClient = claims?.role === 'client';
  const customerName = user?.name ?? 'Deskora member';

  const refresh = async (selectedBranchId?: string) => {
    const branchData = await listBranches();
    setBranches(branchData);
    const preferredBranch = selectedBranchId ?? searchParams.get('branchId') ?? branchId ?? branchData[0]?.id ?? '';
    const activeBranch = branchData.some((branch) => branch.id === preferredBranch) ? preferredBranch : branchData[0]?.id ?? '';
    setBranchId(activeBranch);
    if (activeBranch) {
      setSeats(await listSeats(activeBranch));
    }
  };

  useEffect(() => {
    void refresh();
  }, [searchParams]);

  useEffect(() => {
    if (!token || !branchId) return;
    const socket: Socket = io(getSocketUrl(), { auth: { token } });

    const handleSeatUpdate = (updatedSeat: Seat) => {
      if (updatedSeat.branchId === branchId) {
        setSeats((current) => current.map((seat) => (seat.id === updatedSeat.id ? updatedSeat : seat)));
        pushDeskoraActivity({ title: 'Seat updated live', detail: `${updatedSeat.label} is now ${updatedSeat.status}.`, tone: updatedSeat.status === 'booked' ? 'booking' : 'renewal' });
      }
    };

    socket.on('seat:updated', handleSeatUpdate);
    const handleNotification = (n: any) => {
      pushDeskoraActivity({ title: n.title, detail: n.body, tone: n.type === 'payment' ? 'payment' : 'booking' });
    };
    const handleDashboardRefresh = (_: any) => {
      if (branchId) listSeats(branchId).then(setSeats);
    };
    socket.on('notification:created', handleNotification);
    socket.on('dashboard:refresh', handleDashboardRefresh);
    return () => {
      socket.off('seat:updated', handleSeatUpdate);
      socket.off('notification:created', handleNotification);
      socket.off('dashboard:refresh', handleDashboardRefresh);
      socket.disconnect();
    };
  }, [branchId, token]);

  const selectedBranch = branches.find((branch) => branch.id === branchId);

  const handleBook = async (seat: Seat) => {
    try {
      setBookingMessage(null);
      const booked = await bookSeat(seat.id, customerName);
      pushDeskoraActivity({ title: 'Booking confirmed', detail: `${booked.label} booked for ${customerName}. Invoice generated automatically.`, tone: 'booking' });
      setSeats((current) => current.map((item) => (item.id === booked.id ? booked : item)));
      setBookingMessage(`${booked.label} confirmed. Invoice and payment record created.`);
    } catch (error) {
      setBookingMessage(error instanceof Error ? error.message : 'Booking failed.');
    }
  };

  const handleCancel = async (seat: Seat) => {
    try {
      setBookingMessage(null);
      const refreshed = await cancelSeat(seat.id);
      void refreshed;
      await refresh(branchId);
      pushDeskoraActivity({ title: 'Booking cancelled', detail: `${seat.label} booking cancelled.`, tone: 'booking' });
      setBookingMessage(`${seat.label} released.`);
    } catch (error) {
      setBookingMessage(error instanceof Error ? error.message : 'Cancel failed.');
    }
  };

  return (
    <SectionLayout title={isClient ? 'Book a desk' : 'Interactive seat booking'} description={isClient ? 'Choose a branch, pick an open seat, and confirm your booking. Billing is generated automatically after confirmation.' : 'Click any seat on the floor grid. Seat status updates after booking and double-booking is blocked by the API.'}>
      <div className="grid gap-5 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="space-y-4 rounded-[32px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <SelectField label="Branch" value={branchId} onChange={(value) => {
            setBranchId(value);
            void listSeats(value).then(setSeats);
          }} options={branches.map((branch) => ({ label: branch.name, value: branch.id }))} />
          {!isClient ? <TextField label="Booking name" value={customerName} onChange={() => undefined} /> : null}
          {bookingMessage ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{bookingMessage}</div> : null}
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <LegendDot color="bg-emerald-400" label="Available" />
            <LegendDot color="bg-rose-400" label="Occupied" />
            <LegendDot color="bg-amber-300" label="Reserved" />
          </div>
          <div className="grid grid-cols-6 gap-3 md:grid-cols-8">
            {seats.map((seat) => {
              const occupied = seat.status === 'booked' || seat.status === 'reserved';
              const mine = Boolean(seat.bookedByCurrentUser);
              return (
                <div key={seat.id} className="relative space-y-2">
                  <div className={`flex h-14 w-full items-center justify-center rounded-2xl border text-xs font-semibold ${seat.status === 'available' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : seat.status === 'reserved' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
                    {seat.label}
                  </div>
                  {seat.status === 'available' ? (
                    <button onClick={() => void handleBook(seat)} className="w-full rounded-xl bg-slate-900 px-2 py-1.5 text-[10px] font-semibold text-white">Book Seat</button>
                  ) : mine && seat.canCancel ? (
                    <button onClick={() => void handleCancel(seat)} className="w-full rounded-xl border border-rose-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-rose-700">Cancel Booking</button>
                  ) : occupied ? (
                    <div className="w-full rounded-xl bg-slate-100 px-2 py-1.5 text-center text-[10px] font-semibold text-slate-500">{seat.status === 'reserved' ? 'Reserved' : 'Occupied'}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-[32px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="text-lg font-semibold text-slate-900">Branch summary</div>
          <div className="mt-3 text-sm text-slate-500">{selectedBranch?.name ?? 'Choose a branch to inspect seat layout.'}</div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MiniStat label="Available" value={String(seats.filter((seat) => seat.status === 'available').length)} />
            <MiniStat label="Reserved" value={String(seats.filter((seat) => seat.status === 'reserved').length)} />
            <MiniStat label="Booked" value={String(seats.filter((seat) => seat.status === 'booked').length)} />
          </div>
          <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(139,92,246,0.08),rgba(96,165,250,0.08),rgba(251,146,60,0.06))] p-4">
            <div className="text-sm uppercase tracking-[0.25em] text-slate-500">Floor map</div>
            <div className="mt-4 grid grid-cols-4 gap-3 text-sm text-slate-600">
              {seats.slice(0, 12).map((seat) => (
                <div key={seat.id} className="rounded-2xl border border-white/80 bg-white/90 p-3 shadow-sm">
                  <div className="font-semibold text-slate-900">{seat.label}</div>
                  <div className="mt-1 text-xs text-slate-500">Floor {seat.floor}</div>
                  <div className="mt-1 text-xs text-slate-500">{seat.zone}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionLayout>
  );
}

function MeetingRoomsPage() {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [customerName, setCustomerName] = useState('Acme Product Team');
  const [startAt, setStartAt] = useState(new Date().toISOString().slice(0, 16));
  const [endAt, setEndAt] = useState(new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16));

  useEffect(() => {
    listBranches().then((data) => {
      setBranches(data);
      const nextBranchId = data[0]?.id ?? '';
      setBranchId(nextBranchId);
      return listMeetingRooms(nextBranchId).then(setRooms);
    });
  }, []);

  const submit = async (roomId: string) => {
    const room = await bookMeetingRoom(roomId, customerName, new Date(startAt).toISOString(), new Date(endAt).toISOString());
    pushDeskoraActivity({ title: 'Meeting room booked', detail: `${room.name} reserved for ${customerName}.`, tone: 'meeting' });
  };

  return (
    <SectionLayout title="Meeting room booking" description="Time slot conflicts are prevented on the API before a reservation is confirmed.">
      <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-4 rounded-[32px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <SelectField label="Branch" value={branchId} onChange={(value) => {
            setBranchId(value);
            void listMeetingRooms(value).then(setRooms);
          }} options={branches.map((branch) => ({ label: branch.name, value: branch.id }))} />
          <TextField label="Booking name" value={customerName} onChange={setCustomerName} />
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Start" value={startAt} onChange={setStartAt} type="datetime-local" />
            <TextField label="End" value={endAt} onChange={setEndAt} type="datetime-local" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {rooms.map((room, index) => {
              const roomTitle = premiumRoomTitles[index % premiumRoomTitles.length];
              const intensity = getRoomIntensity(room.name, room.capacity);
              const amenityLabels = ['4K display', 'Whiteboard', 'Video call', 'Coffee service'].slice(0, room.capacity > 10 ? 4 : 3);
              return (
                <motion.div key={room.id} whileHover={{ y: -4 }} className="overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                  <WorkspacePhoto title={roomTitle} subtitle={room.name} tag={`${room.capacity} seats`} src={room.imageUrl} seed={`${room.name}-${index}`} className="h-52 rounded-none border-0" />
                  <div className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold text-slate-900">{roomTitle}</div>
                        <div className="mt-1 text-sm text-slate-500">{room.name}</div>
                      </div>
                      <div className="rounded-full bg-[rgb(var(--role-accent-soft))] px-4 py-2 text-sm font-semibold text-[rgb(var(--role-accent-text))]">₹{room.hourlyRate}/hr</div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MiniStat label="Capacity" value={String(room.capacity)} />
                      <MiniStat label="Occupancy" value={`${intensity}%`} />
                      <MiniStat label="Availability" value={intensity > 70 ? 'Busy' : 'Open'} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {amenityLabels.map((amenity) => (
                        <span key={amenity} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{amenity}</span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={async () => { try { await cancelMeetingRoom(room.id); pushDeskoraActivity({ title: 'Meeting cancelled', detail: `${room.name} booking cancelled.`, tone: 'meeting' }); } catch (e) { alert((e as Error).message || 'Cancel failed'); } }} className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600">Cancel current booking</button>
                      <button onClick={() => void submit(room.id)} className="rounded-full bg-[linear-gradient(135deg,rgba(45,212,191,1),rgba(96,165,250,1))] px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm">Book room</button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        <div className="rounded-[32px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="text-lg font-semibold text-slate-900">Booking history</div>
          <div className="mt-4 grid gap-3">
            {rooms.map((room) => (
              <div key={room.id} className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fafaff_100%)] p-4 text-sm text-slate-600 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900">{room.name}</div>
                  <div className="text-slate-500">Live availability via API</div>
                </div>
                <div className="mt-2 text-slate-500">Confirm a slot, then reopen the page to see the room reflected in booking history and analytics.</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionLayout>
  );
}

function CRMPage() {
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>(loadLocalFeedback);
  const [form, setForm] = useState({ companyId: '', name: '', contactName: '', email: '', stage: 'lead' });

  useEffect(() => {
    Promise.all([listClients(), getDashboard()]).then(([clientData, dashboard]) => {
      setClients(clientData);
      setFeedback([...loadLocalFeedback(), ...dashboard.feedback].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()));
      setForm((current) => ({ ...current, companyId: clientData[0]?.companyId ?? current.companyId }));
    });
  }, []);

  const submit = async () => {
    try {
      const created = await createClient(form);
      pushDeskoraActivity({ title: 'Client onboarded', detail: `${created.name} entered the ${created.stage} stage.`, tone: 'client' });
      setClients((current) => [created, ...current]);
      toast.success('Client added', `${created.name} is now in the pipeline.`);
    } catch (error) {
      toast.error('Unable to add client', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const stages = ['lead', 'contacted', 'converted', 'active'] as const;

  return (
    <SectionLayout title="CRM pipeline" description="Track prospects from lead to active client, plus workspace feedback signals.">
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="text-sm uppercase tracking-[0.28em] text-slate-400">Recent feedback</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {feedback.slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">{item.rating}/5 · {item.category}</div>
              <div className="mt-2">{item.message}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr,0.9fr]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stages.map((stage) => (
            <div key={stage} className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="text-sm uppercase tracking-[0.25em] text-slate-500">{stage}</div>
              <div className="mt-4 space-y-3">
                {clients.filter((client) => client.stage === stage).map((client) => (
                  <div key={client.id} className="rounded-2xl border border-slate-200/80 bg-[rgb(var(--role-accent-soft))] p-4 shadow-sm">
                    <div className="font-semibold text-slate-900">{client.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{client.contactName}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Add client</div>
          <div className="mt-4 space-y-3">
            <TextField label="Company ID" value={form.companyId} onChange={(value) => setForm((current) => ({ ...current, companyId: value }))} />
            <TextField label="Client company" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
            <TextField label="Contact name" value={form.contactName} onChange={(value) => setForm((current) => ({ ...current, contactName: value }))} />
            <TextField label="Email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
            <SelectField label="Stage" value={form.stage} onChange={(value) => setForm((current) => ({ ...current, stage: value }))} options={stages.map((stage) => ({ label: stage, value: stage }))} />
            <button onClick={submit} className="rounded-2xl bg-teal-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-teal-400">Create client</button>
          </div>
        </div>
      </div>
    </SectionLayout>
  );
}

function DigitalTwinPage() {
  const { data, loading, error } = useDashboardData();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);

  useEffect(() => {
    listBranches().then((branchData) => {
      setBranches(branchData);
      setBranchId((current) => current || branchData[0]?.id || '');
    });
  }, []);

  useEffect(() => {
    if (!branchId) return;
    Promise.all([listSeats(branchId), listMeetingRooms(branchId)]).then(([seatData, roomData]) => {
      setSeats(seatData);
      setRooms(roomData);
    });
  }, [branchId]);

  if (loading || !data) return <PageLoading label="Loading digital twin" />;
  if (error) return <PageEmpty title="Digital twin unavailable" description={error} />;

  const selectedBranch = branches.find((branch) => branch.id === branchId) ?? branches[0] ?? data.branchStats[0];
  const selectedStat = data.branchStats.find((branch) => branch.id === selectedBranch?.id);
  const palette = getBranchPalette(selectedBranch?.name ?? 'Deskora');
  const groupedSeats = seats.reduce<Record<string, Seat[]>>((accumulator, seat) => {
    accumulator[seat.zone] = accumulator[seat.zone] ?? [];
    accumulator[seat.zone].push(seat);
    return accumulator;
  }, {});
  const zones = [
    { key: 'open_workspace', label: 'Open Workspace', span: 'col-span-7 row-span-2', tone: 'open_workspace' },
    { key: 'private_cabin', label: 'Private Cabins', span: 'col-span-5 row-span-2', tone: 'private_cabin' },
    { key: 'meeting_room', label: 'Meeting Rooms', span: 'col-span-5 row-span-2', tone: 'meeting_room' },
    { key: 'lounge', label: 'Lounge Area', span: 'col-span-7 row-span-2', tone: 'lounge' }
  ];

  return (
    <SectionLayout title="Digital twin floor system" description="Spatial coworking visibility with live occupancy, room activity, and branch-specific branding.">
      <div className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4 rounded-[32px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap gap-2">
            {branches.map((branch) => (
              <button key={branch.id} onClick={() => setBranchId(branch.id)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${branchId === branch.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {branch.name}
              </button>
            ))}
          </div>
          <WorkspacePhoto
            title={selectedBranch?.name ?? 'Workspace overview'}
            subtitle={`${selectedBranch?.city ?? 'Workspace'} • live floor intelligence`}
            tag="Digital twin"
            src={selectedBranch?.heroImageUrl}
            seed={selectedBranch?.id ?? 'deskora'}
            className="h-56"
          />
          <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-[28px] border border-slate-200/80 p-4" style={{ background: `linear-gradient(135deg, ${palette[0]}10, ${palette[1]}10)` }}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{selectedBranch?.city ?? 'Workspace'}</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{selectedBranch?.name ?? 'Branch overview'}</div>
                </div>
                <MiniStat label="Occupancy" value={`${selectedStat?.occupancyRate ?? 0}%`} />
              </div>
              <div className="mt-4 grid grid-cols-12 gap-3">
                {zones.map((zone) => {
                  const zoneSeats = groupedSeats[zone.key] ?? [];
                  const occupied = zoneSeats.filter((seat) => seat.status !== 'available').length;
                  const intensity = zoneSeats.length ? Math.round((occupied / zoneSeats.length) * 100) : 0;
                  return (
                    <motion.div key={zone.key} whileHover={{ y: -4 }} className={`rounded-[24px] border border-white/70 bg-white/90 p-4 shadow-sm ${zone.span}`}>
                      <div className={`rounded-[22px] bg-gradient-to-br ${getZoneTone(zone.tone)} p-4`}>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold uppercase tracking-[0.25em] opacity-70">Zone</div>
                            <div className="mt-1 text-xl font-bold">{zone.label}</div>
                          </div>
                          <div className="text-right text-sm font-semibold">{intensity}%</div>
                        </div>
                        <div className="mt-4 h-2 rounded-full bg-white/35">
                          <div className="h-2 rounded-full bg-white" style={{ width: `${Math.max(intensity, 12)}%` }} />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {zoneSeats.slice(0, 8).map((seat) => (
                            <span key={seat.id} className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${getSeatTone(seat.status)}`}>{seat.label}</span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
            <div className="space-y-3 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm uppercase tracking-[0.28em] text-slate-400">Live occupancy</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">Realtime floor pulse</div>
                </div>
                <div className="rounded-full bg-[rgb(var(--role-accent-soft))] px-3 py-1 text-xs font-semibold text-[rgb(var(--role-accent-text))]">{rooms.length} rooms</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <MiniStat label="Available" value={String(seats.filter((seat) => seat.status === 'available').length)} />
                <MiniStat label="Reserved" value={String(seats.filter((seat) => seat.status === 'reserved').length)} />
                <MiniStat label="Occupied" value={String(seats.filter((seat) => seat.status !== 'available').length)} />
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50 p-4">
                <div className="text-sm uppercase tracking-[0.25em] text-slate-500">Meeting rooms</div>
                <div className="mt-3 space-y-2">
                  {rooms.map((room) => (
                    <div key={room.id} className="rounded-2xl border border-white bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div className="font-semibold text-slate-900">{room.name}</div>
                        <div className="text-sm text-slate-500">₹{room.hourlyRate}/hr</div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Capacity {room.capacity} · live status layer active</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fafaff_100%)] p-4">
                <div className="text-sm uppercase tracking-[0.25em] text-slate-500">Operational notes</div>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div>Green seats are available for booking.</div>
                  <div>Red seats are already occupied.</div>
                  <div>Yellow seats are reserved and awaiting confirmation.</div>
                  <div>Blue indicates meeting activity or live scheduling.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionLayout>
  );
}

function HeatmapPage() {
  const { data, loading, error } = useDashboardData();

  if (loading || !data) return <PageLoading label="Loading heatmap analytics" />;
  if (error) return <PageEmpty title="Heatmap unavailable" description={error} />;

  const branchTrend = data.branchStats.map((branch, index) => ({ name: branch.name, occupancy: branch.occupancyRate, revenue: Math.round((data.totals.revenue / Math.max(data.branchStats.length, 1)) + index * 18000) }));
  const hourlyData = Array.from({ length: 12 }, (_, index) => ({
    hour: `${String(9 + index).padStart(2, '0')}:00`,
    occupancy: Math.min(100, Math.round(35 + index * 5 + (data.totals.occupancyRate / 2)))
  }));

  return (
    <SectionLayout title="Occupancy heatmap analytics" description="Branch trends, zone intensity, peak usage windows, and floor utilization in one analytics surface.">
      <div className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <AnimatedStatCard label="Peak usage" value={`${Math.max(...data.heatmap.map((cell) => cell.intensity), 0)}%`} hint="Most occupied zone intensity across the portfolio." accent="#fb923c" />
            <AnimatedStatCard label="Avg. occupancy" value={`${data.totals.occupancyRate}%`} hint="Tenant-wide floor utilization at a glance." accent="#60a5fa" />
            <AnimatedStatCard label="Best branch" value={data.branchStats.sort((left, right) => right.experienceScore - left.experienceScore)[0]?.name ?? 'N/A'} hint="Highest experience score and booking density." accent="#34d399" />
          </div>

          <ChartCard title="Hourly occupancy graph" subtitle="Peak usage typically clusters around midday and early afternoon">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
                <XAxis dataKey="hour" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 18 }} />
                <Area type="monotone" dataKey="occupancy" stroke="#8b5cf6" fill="rgba(139,92,246,0.18)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Branch occupancy trends" subtitle="Workspace density and revenue storytelling across each location">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={branchTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 18 }} />
                <Bar dataKey="occupancy" fill="#14b8a6" radius={[12, 12, 0, 0]} />
                <Bar dataKey="revenue" fill="#f59e0b" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-sm uppercase tracking-[0.28em] text-slate-400">Zone intensity map</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2">
              {data.heatmap.map((cell) => (
                <motion.div key={cell.id} whileHover={{ y: -3 }} className="rounded-2xl border border-slate-100 p-4 shadow-sm" style={{ background: `linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(139,92,246,${Math.max(cell.intensity, 15) / 240}) 100%)` }}>
                  <div className="text-sm font-semibold text-slate-900">{cell.zone}</div>
                  <div className="mt-1 text-xs text-slate-500">{cell.label}</div>
                  <div className="mt-4 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-[rgb(var(--role-accent))]" style={{ width: `${Math.max(cell.intensity, 8)}%` }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-sm uppercase tracking-[0.28em] text-slate-400">Smart indicators</div>
            <div className="mt-4 space-y-3">
              {data.insights.slice(0, 4).map((insight: SmartInsight) => (
                <div key={insight.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${insight.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : insight.tone === 'warning' ? 'bg-amber-50 text-amber-700' : insight.tone === 'info' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'}`}>{insight.tone}</div>
                  <div className="mt-2 font-semibold text-slate-900">{insight.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{insight.detail}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-sm uppercase tracking-[0.28em] text-slate-400">Floor utilization</div>
            <div className="mt-4 space-y-3">
              {data.branchStats.map((branch) => (
                <div key={branch.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">{branch.name}</div>
                      <div className="text-sm text-slate-500">{branch.bookedSeats} booked · {branch.reservedSeats} reserved</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{branch.occupancyRate}%</div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white">
                    <div className="h-2 rounded-full bg-[rgb(var(--role-accent))]" style={{ width: `${branch.occupancyRate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionLayout>
  );
}

function FeedbackPage() {
  const { data, loading, error } = useDashboardData();
  const [localFeedback, setLocalFeedback] = useState<Feedback[]>(loadLocalFeedback);
  const [draft, setDraft] = useState({ rating: 5, category: 'workspace' as Feedback['category'], sentiment: 'positive' as Feedback['sentiment'], message: '' });

  if (loading || !data) return <PageLoading label="Loading feedback center" />;
  if (error) return <PageEmpty title="Feedback unavailable" description={error} />;

  const feedback = [...localFeedback, ...data.feedback].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const averageRating = feedback.length === 0 ? 0 : feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length;
  const sentimentCount = {
    positive: feedback.filter((item) => item.sentiment === 'positive').length,
    neutral: feedback.filter((item) => item.sentiment === 'neutral').length,
    negative: feedback.filter((item) => item.sentiment === 'negative').length
  };
  const topBranches = data.branchStats
    .map((branch) => ({ ...branch, rating: feedback.filter((item) => item.branchId === branch.id).reduce((sum, item) => sum + item.rating, 0) / Math.max(feedback.filter((item) => item.branchId === branch.id).length, 1) }))
    .sort((left, right) => right.rating - left.rating)
    .slice(0, 3);

  return (
    <SectionLayout title="Customer feedback and experience" description="Ratings, maintenance reports, review cards, and satisfaction trends for a premium client experience.">
      <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <AnimatedStatCard label="Average rating" value={averageRating ? averageRating.toFixed(1) : '0.0'} hint="Branch-wide experience score from client reviews." accent="#8b5cf6" />
            <AnimatedStatCard label="Positive reviews" value={String(sentimentCount.positive)} hint="Clients reporting a strong workspace experience." accent="#34d399" />
            <AnimatedStatCard label="Open issues" value={String(sentimentCount.negative)} hint="Maintenance and service items requiring attention." accent="#fb923c" />
          </div>

          <ChartCard title="Satisfaction trend" subtitle="Overall sentiment across recent client submissions">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { name: 'Positive', value: sentimentCount.positive },
                { name: 'Neutral', value: sentimentCount.neutral },
                { name: 'Negative', value: sentimentCount.negative }
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 18 }} />
                <Bar dataKey="value" fill="#14b8a6" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {feedback.slice(0, 6).map((item) => (
              <motion.div key={item.id} whileHover={{ y: -3 }} className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-lg">{item.sentiment === 'positive' ? '😊' : item.sentiment === 'neutral' ? '🙂' : '⚠️'}</div>
                  <div className="rounded-full bg-[rgb(var(--role-accent-soft))] px-3 py-1 text-xs font-semibold text-[rgb(var(--role-accent-text))]">{item.category}</div>
                </div>
                <div className="mt-3 font-semibold text-slate-900">{item.message}</div>
                <div className="mt-2 text-sm text-slate-500">Rating {item.rating}/5</div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">Submit feedback</div>
            <div className="mt-4 space-y-3">
              <NumberField label="Rating" value={draft.rating} onChange={(value) => setDraft((current) => ({ ...current, rating: value }))} />
              <SelectField label="Category" value={draft.category} onChange={(value) => setDraft((current) => ({ ...current, category: value as Feedback['category'] }))} options={[{ label: 'Workspace', value: 'workspace' }, { label: 'Meeting room', value: 'meeting_room' }, { label: 'Maintenance', value: 'maintenance' }, { label: 'Suggestion', value: 'suggestion' }]} />
              <SelectField label="Sentiment" value={draft.sentiment} onChange={(value) => setDraft((current) => ({ ...current, sentiment: value as Feedback['sentiment'] }))} options={[{ label: 'Positive', value: 'positive' }, { label: 'Neutral', value: 'neutral' }, { label: 'Negative', value: 'negative' }]} />
              <TextField label="Feedback" value={draft.message} onChange={(value) => setDraft((current) => ({ ...current, message: value }))} />
              <button onClick={() => {
                const nextFeedback: Feedback = {
                  id: crypto.randomUUID(),
                  tenantId: data.clients[0]?.tenantId ?? 'tenant-demo',
                  companyId: data.clients[0]?.companyId ?? 'company-demo',
                  branchId: data.branchStats[0]?.id ?? 'branch-demo',
                  clientId: data.clients[0]?.id ?? 'client-demo',
                  rating: draft.rating,
                  category: draft.category,
                  message: draft.message || 'Workspace experience feedback captured.',
                  sentiment: draft.sentiment,
                  createdAt: new Date().toISOString()
                };
                const nextFeedbackList = [nextFeedback, ...localFeedback].slice(0, 24);
                setLocalFeedback(nextFeedbackList);
                saveLocalFeedback(nextFeedbackList);
                setDraft((current) => ({ ...current, message: '' }));
                pushDeskoraActivity({ title: 'Feedback submitted', detail: `${nextFeedback.rating}/5 review captured from the experience module.`, tone: 'client' });
              }} className="rounded-2xl bg-[rgb(var(--role-accent))] px-4 py-3 font-semibold text-white transition hover:opacity-90">Save review</button>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">Top-rated branches</div>
            <div className="mt-4 space-y-3">
              {topBranches.map((branch) => (
                <div key={branch.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">{branch.name}</div>
                      <div className="text-sm text-slate-500">Experience score {branch.experienceScore}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{branch.rating ? branch.rating.toFixed(1) : '0.0'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">Subscription pulse</div>
            <div className="mt-3 space-y-2">
              {data.subscriptions.map((subscription) => (
                <div key={subscription.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">{subscription.tier.toUpperCase()}</div>
                      <div className="text-sm text-slate-500">Renews on {new Date(subscription.renewalDate).toLocaleDateString()}</div>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${subscription.status === 'active' ? 'bg-emerald-50 text-emerald-700' : subscription.status === 'expiring' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{subscription.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionLayout>
  );
}

function BillingPage() {
  const role = useAuthStore((state) => state.claims?.role);
  const theme = getTheme(role);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ branchId: '', clientId: '', quantity: 1, rate: 14500 });

  useEffect(() => {
    Promise.all([getDashboard(), listInvoices(), listBranches(), listClients()]).then(([dashboardData, invoiceData, branchData, clientData]) => {
      setDashboard(dashboardData);
      setInvoices(invoiceData);
      setBranches(branchData);
      setClients(clientData);
      setForm((current) => ({ ...current, branchId: branchData[0]?.id ?? current.branchId, clientId: clientData[0]?.id ?? current.clientId }));
    });
  }, []);

  const submit = async () => {
    const invoice = await createInvoice(form);
    pushDeskoraActivity({ title: 'Invoice generated', detail: `${invoice.invoiceNumber} created for ₹${invoice.total.toLocaleString()}.`, tone: invoice.status === 'paid' ? 'payment' : 'renewal' });
    setInvoices((current) => [invoice, ...current]);
  };

  const paymentByInvoice = useMemo(() => new Map((dashboard?.payments ?? []).map((payment) => [payment.invoiceId, payment])), [dashboard]);

  const invoiceCards = useMemo(() => invoices.map((invoice, index) => {
    const payment = paymentByInvoice.get(invoice.id);
    const dueInDays = payment?.status === 'paid' ? 0 : Math.max(1, 5 - index);
    return { invoice, payment, dueInDays };
  }), [invoices, paymentByInvoice]);

  const transactionMetrics = useMemo(() => {
    const total = (dashboard?.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0);
    const paid = (dashboard?.payments ?? []).filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0);
    const pending = (dashboard?.payments ?? []).filter((payment) => payment.status === 'pending' || payment.status === 'overdue').reduce((sum, payment) => sum + payment.amount, 0);
    const refunded = (dashboard?.payments ?? []).filter((payment) => payment.status === 'refunded').reduce((sum, payment) => sum + payment.amount, 0);
    return { total, paid, pending, refunded };
  }, [invoiceCards]);

  const methodChart = useMemo(() => [
    { name: 'Razorpay', value: Math.max(1, (dashboard?.payments ?? []).filter((payment) => payment.method === 'razorpay').length) },
    { name: 'Stripe', value: Math.max(1, (dashboard?.payments ?? []).filter((payment) => payment.method === 'stripe').length) },
    { name: 'UPI', value: Math.max(1, (dashboard?.payments ?? []).filter((payment) => payment.method === 'upi').length) },
    { name: 'Cards', value: Math.max(1, (dashboard?.payments ?? []).filter((payment) => payment.method === 'card').length) },
    { name: 'Net Banking', value: Math.max(1, (dashboard?.payments ?? []).filter((payment) => payment.method === 'net_banking').length) },
    { name: 'Wallets', value: Math.max(1, (dashboard?.payments ?? []).filter((payment) => payment.method === 'wallet').length) }
  ], [dashboard]);

  const subscriptionPlans = [
    { name: 'Starter', price: '₹4,999', cap: 'Up to 2 branches', tone: 'bg-sky-50 text-sky-700', features: ['Bookings and seat maps', 'Basic invoices', 'Email support'] },
    { name: 'Business', price: '₹14,999', cap: 'Most popular for operators', tone: 'bg-[rgb(var(--role-accent-soft))] text-[rgb(var(--role-accent-text))]', features: ['Multi-branch operations', 'Recurring billing', 'CRM and analytics'] },
    { name: 'Enterprise', price: 'Custom', cap: 'Advanced controls and SLAs', tone: 'bg-emerald-50 text-emerald-700', features: ['SSO and audit logs', 'Dedicated onboarding', 'Custom integrations'] }
  ] as const;

  const downloadInvoice = (invoice: Invoice) => {
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text('Deskora Invoice', 14, 18);
    pdf.setFontSize(11);
    pdf.text(`Invoice: ${invoice.invoiceNumber}`, 14, 32);
    pdf.text(`Status: ${invoice.status}`, 14, 40);
    pdf.text(`Due date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 14, 48);
    pdf.text(`Total: ₹${invoice.total.toLocaleString()}`, 14, 56);
    pdf.text('Line items', 14, 72);
    invoice.lineItems.forEach((item, index) => {
      pdf.text(`${index + 1}. ${item.label} x ${item.quantity} @ ₹${item.rate.toLocaleString()}`, 18, 82 + index * 8);
    });
    pdf.save(`${invoice.invoiceNumber}.pdf`);
  };

  return (
    <SectionLayout title="Billing and invoicing" description="Manage subscriptions, recurring billing, payment methods, and downloadable invoices in one finance workspace.">
      <div className="grid gap-4 md:grid-cols-4">
        <AnimatedStatCard label="Total billing" value={`₹${transactionMetrics.total.toLocaleString()}`} hint="Combined invoice value across active billing cycles." accent="#60a5fa" />
        <AnimatedStatCard label="Collected" value={`₹${transactionMetrics.paid.toLocaleString()}`} hint="Paid invoices and settled transactions." accent="#34d399" />
        <AnimatedStatCard label="Pending" value={`₹${transactionMetrics.pending.toLocaleString()}`} hint="Outstanding recurring payments and follow-ups." accent="#fb923c" />
        <AnimatedStatCard label="Refunded" value={`₹${transactionMetrics.refunded.toLocaleString()}`} hint="Payments reversed or adjusted by finance." accent="#fb7185" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            {subscriptionPlans.map((plan) => (
              <motion.div key={plan.name} whileHover={{ y: -4 }} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${plan.tone}`}>{plan.name}</div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{plan.price}</div>
                <div className="mt-1 text-sm text-slate-500">{plan.cap}</div>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[rgb(var(--role-accent))]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">Invoice history</div>
                <div className="mt-1 text-sm text-slate-500">Download PDF invoices and track payment states across all methods.</div>
              </div>
              <div className="rounded-full bg-[rgb(var(--role-accent-soft))] px-3 py-1 text-xs font-semibold text-[rgb(var(--role-accent-text))]">Recurring enabled</div>
            </div>
            <div className="mt-4 space-y-3">
              <AnimatePresence initial={false}>
                {invoiceCards.map(({ invoice, payment, dueInDays }) => {
                  const paymentStatus = payment?.status ?? 'pending';
                  const paymentMethod = payment?.method ?? 'upi';
                  return (
                  <motion.div key={invoice.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fafaff_100%)] p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="text-lg font-semibold text-slate-900">{invoice.invoiceNumber}</div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : paymentStatus === 'pending' ? 'bg-amber-50 text-amber-700' : paymentStatus === 'failed' ? 'bg-rose-50 text-rose-700' : paymentStatus === 'refunded' ? 'bg-fuchsia-50 text-fuchsia-700' : 'bg-slate-100 text-slate-600'}`}>{paymentStatus}</span>
                        </div>
                        <div className="mt-2 text-sm text-slate-500">Due in {dueInDays} days • Method: {paymentMethod}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => downloadInvoice(invoice)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Download PDF</button>
                        <div className="rounded-2xl bg-[rgb(var(--role-accent-soft))] px-4 py-2 text-sm font-semibold text-[rgb(var(--role-accent-text))]">₹{invoice.total.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <MiniStat label="Issue date" value={new Date(invoice.issueDate).toLocaleDateString()} />
                      <MiniStat label="Payment method" value={paymentMethod.toUpperCase()} />
                      <MiniStat label="Status" value={paymentStatus.toUpperCase()} />
                    </div>
                  </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">Generate invoice</div>
            <div className="mt-4 space-y-3">
              <SelectField label="Branch" value={form.branchId} onChange={(value) => setForm((current) => ({ ...current, branchId: value }))} options={branches.map((branch) => ({ label: branch.name, value: branch.id }))} />
              <SelectField label="Client" value={form.clientId} onChange={(value) => setForm((current) => ({ ...current, clientId: value }))} options={clients.map((client) => ({ label: client.name, value: client.id }))} />
              <NumberField label="Seat quantity" value={form.quantity} onChange={(value) => setForm((current) => ({ ...current, quantity: value }))} />
              <NumberField label="Seat rate" value={form.rate} onChange={(value) => setForm((current) => ({ ...current, rate: value }))} />
              <button onClick={submit} className="rounded-2xl bg-[rgb(var(--role-accent))] px-4 py-3 font-semibold text-white transition hover:opacity-90">Generate invoice</button>
            </div>
          </div>

          <ChartCard title="Payment mix" subtitle="Razorpay, Stripe, UPI, cards and net banking">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={methodChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 18 }} />
                <Bar dataKey="value" fill={theme.accent} radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">Recent transactions</div>
            <div className="mt-4 space-y-3">
              {(dashboard?.payments ?? []).map((payment) => (
                <div key={payment.referenceId || payment.invoiceId} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">₹{payment.amount.toLocaleString()}</div>
                      <div className="text-sm text-slate-500">{payment.method.toUpperCase()} • {payment.referenceId || payment.invoiceId}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${payment.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : payment.status === 'pending' ? 'bg-amber-50 text-amber-700' : payment.status === 'failed' ? 'bg-rose-50 text-rose-700' : payment.status === 'refunded' ? 'bg-fuchsia-50 text-fuchsia-700' : 'bg-slate-100 text-slate-600'}`}>{payment.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">Subscriptions</div>
            <div className="mt-3 space-y-3">
              {(dashboard?.subscriptions ?? []).map((subscription) => (
                <div key={subscription.id} className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">{subscription.tier.toUpperCase()}</div>
                      <div className="text-sm text-slate-500">Renews on {new Date(subscription.renewalDate).toLocaleDateString()} · auto-renew {subscription.autoRenew ? 'on' : 'off'}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${subscription.status === 'active' ? 'bg-emerald-50 text-emerald-700' : subscription.status === 'expiring' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{subscription.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionLayout>
  );
}

function StaffPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState({ companyId: '', branchId: '', name: '', role: 'staff', title: '', email: '' });

  useEffect(() => {
    Promise.all([listEmployees(), listBranches()]).then(([employeeData, branchData]) => {
      setEmployees(employeeData);
      setBranches(branchData);
      setForm((current) => ({ ...current, companyId: branchData[0]?.companyId ?? current.companyId, branchId: branchData[0]?.id ?? current.branchId }));
    });
  }, []);

  const submit = async () => {
    const employee = await createEmployee(form);
    pushDeskoraActivity({ title: 'Team member added', detail: `${employee.name} joined as ${employee.title}.`, tone: 'renewal' });
    setEmployees((current) => [employee, ...current]);
  };

  return (
    <SectionLayout title="Employee management" description="Assign roles, set branch ownership, and keep staff permissions aligned with the tenant structure.">
      <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="grid gap-3 md:grid-cols-2">
          {employees.map((employee) => (
            <div key={employee.id} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold text-slate-900">{employee.name}</div>
              <div className="mt-1 text-sm text-slate-500">{employee.title}</div>
              <div className="mt-4 text-sm text-slate-600">Role: {employee.role}</div>
              <div className="text-sm text-slate-600">Branch: {employee.branchId ?? 'Unassigned'}</div>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Add employee</div>
          <div className="mt-4 space-y-3">
            <SelectField label="Branch" value={form.branchId} onChange={(value) => setForm((current) => ({ ...current, branchId: value }))} options={branches.map((branch) => ({ label: branch.name, value: branch.id }))} />
            <TextField label="Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
            <SelectField label="Role" value={form.role} onChange={(value) => setForm((current) => ({ ...current, role: value }))} options={[{ label: 'Admin', value: 'admin' }, { label: 'Staff', value: 'staff' }]} />
            <TextField label="Title" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
            <TextField label="Email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
            <button onClick={submit} className="rounded-2xl bg-teal-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-teal-400">Add employee</button>
          </div>
        </div>
      </div>
    </SectionLayout>
  );
}

function AnalyticsPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  useEffect(() => {
    getDashboard().then(setData);
  }, []);

  if (!data) return <PageLoading label="Loading analytics" />;

  return (
    <SectionLayout title="Analytics dashboard" description="Revenue, occupancy, heatmaps, and client feedback in one reporting surface.">
      <HeatmapAnalyticsPanel />
      <FeedbackInsightsPanel />
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Branch comparison" subtitle="Occupancy by branch">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.branchStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18 }} />
              <Bar dataKey="occupancyRate" fill="#19c8b3" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top branches" subtitle="Revenue strength indexed from tenant data">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.branchStats.map((branch, index) => ({ name: branch.name, value: data.totals.revenue / Math.max(data.branchStats.length, 1) + index * 12000 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18 }} />
              <Area type="monotone" dataKey="value" stroke="#f59e0b" fill="rgba(245,158,11,0.22)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </SectionLayout>
  );
}

function SignInPage() {
  const navigate = useNavigate();
  const signIn = useAuthStore((state) => state.signIn);
  const authError = useAuthStore((state) => state.error);
  const role = useAuthStore((state) => state.claims?.role);
  const theme = getTheme(role);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    try {
      await signIn(email, password);
      const role = useAuthStore.getState().claims?.role;
      const redirect = new URLSearchParams(window.location.search).get('redirect');
      navigate(redirect ?? getAppHomePath(role));
    } catch {
      // auth store already exposes the backend message
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.08),transparent_24%),linear-gradient(180deg,#fbf9f7_0%,#f7f5ff_100%)] px-4 py-8 text-slate-900 md:px-8" style={{ ['--role-accent' as never]: theme.accent, ['--role-accent-soft' as never]: theme.accentSoft, ['--role-accent-text' as never]: theme.accentText } as React.CSSProperties}>
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-8 lg:grid-cols-[0.95fr,1.05fr]">
        <div className="flex flex-col justify-between rounded-[32px] border border-slate-200/80 bg-white/90 p-8 shadow-soft backdrop-blur-xl">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-slate-400">Deskora</div>
            <h1 className="mt-4 max-w-lg font-display text-5xl font-bold leading-tight text-slate-900">WeWork-style coworking operations for closed SaaS teams.</h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">Manage workspaces, bookings, billing, and client relationships from one coworking operating system.</p>
          </div>
        </div>
        <div className="flex items-center justify-center rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-soft backdrop-blur-xl">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="text-sm uppercase tracking-[0.3em] text-slate-400">Sign in</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">Welcome back</div>
            <div className="mt-6 space-y-4">
              <TextField label="Email" value={email} onChange={setEmail} type="email" />
              <TextField label="Password" value={password} onChange={setPassword} type="password" />
              {authError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{authError}</div> : null}
              <button onClick={submit} className="w-full rounded-2xl bg-teal-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-teal-400">Enter Deskora</button>
              <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
                <span>New here?</span>
                <Link to="/sign-up" className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4">Create an account</Link>
              </div>
              <div className="text-sm text-slate-500">
                <Link to="/explore" className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4">Browse workspaces first</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClientExplorePage() {
  return (
    <SectionLayout title="Explore workspaces" description="Browse coworking companies and branches across cities. Your Deskora account works everywhere — switch branches anytime.">
      <ExploreWorkspaceGrid embedded />
    </SectionLayout>
  );
}

function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);

  useEffect(() => {
    Promise.all([listMyBookings(), listBranches(), listSeats(), listMeetingRooms()]).then(([bookingData, branchData, seatData, roomData]) => {
      setBookings(bookingData.filter((booking) => booking.status === 'booked'));
      setBranches(branchData);
      setSeats(seatData);
      setRooms(roomData);
    });
  }, []);

  const branchName = (branchId: string) => branches.find((branch) => branch.id === branchId)?.name ?? 'Workspace branch';
  const resourceLabel = (booking: Booking) => {
    if (booking.resourceType === 'seat') {
      return seats.find((seat) => seat.id === booking.resourceId)?.label ?? 'Desk seat';
    }
    return rooms.find((room) => room.id === booking.resourceId)?.name ?? 'Meeting room';
  };

  return (
    <SectionLayout title="My bookings" description="Active reservations across every coworking brand you have booked with Deskora.">
      <div className="space-y-3">
        {bookings.length ? bookings.map((booking) => (
          <div key={booking.id} className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-slate-400">{booking.resourceType === 'seat' ? 'Desk booking' : 'Meeting room'}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{resourceLabel(booking)}</div>
                <div className="mt-1 text-sm text-slate-500">{branchName(booking.branchId)} · {new Date(booking.startAt).toLocaleString()} – {new Date(booking.endAt).toLocaleString()}</div>
              </div>
              <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">Active</span>
            </div>
          </div>
        )) : (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
            No active bookings yet. <Link to="/app/explore" className="font-semibold text-slate-900 underline">Explore workspaces</Link> to book your first desk or meeting room.
          </div>
        )}
      </div>
    </SectionLayout>
  );
}

function ExploreWorkspaceGrid({ embedded = false }: { embedded?: boolean }) {
  const workspaces = usePublicWorkspaces();
  const [cityFilter, setCityFilter] = useState('all');
  const cities = useMemo(() => ['all', ...Array.from(new Set(workspaces.map((workspace) => workspace.branch.city)))], [workspaces]);
  const filtered = useMemo(() => workspaces.filter((workspace) => cityFilter === 'all' || workspace.branch.city === cityFilter), [workspaces, cityFilter]);

  const grid = (
        <section className={`space-y-4 ${embedded ? '' : 'rounded-[34px] border border-white/70 bg-white/78 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl md:p-6'}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.32em] text-slate-400">Available spaces</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">Live workspace marketplace</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {cities.map((city) => (
                <button key={city} onClick={() => setCityFilter(city)} className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${cityFilter === city ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {city === 'all' ? 'All cities' : city}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((workspace) => (
              <div key={workspace.branch.id} className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm">
                <WorkspacePhoto title={workspace.branch.name} subtitle={`${workspace.company.name} · ${workspace.branch.city}`} tag={workspace.company.industry} src={workspace.heroImageUrl} seed={workspace.gallerySeed} compact className="aspect-square rounded-none border-0" />
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-lg font-semibold text-slate-900">{workspace.branch.name}</div>
                    <VerificationBadge status={workspace.verificationStatus} />
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{workspace.company.name} · {workspace.branch.address}</div>
                  <div className="mt-3 text-sm leading-6 text-slate-500 line-clamp-3">{workspace.description}</div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">Occupancy {workspace.occupancyRate}%</div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">Desks {workspace.availableDesks} open</div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">Rooms {workspace.meetingRoomCount}</div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">₹{workspace.pricingMin} - ₹{workspace.pricingMax}</div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">Rating {workspace.rating}/5</div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">{workspace.operatingHours}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {getWorkspaceDisplayAmenities(workspace).map((amenity) => (
                      <span key={amenity} className="rounded-full bg-[rgb(var(--role-accent-soft))] px-3 py-1 text-[11px] font-semibold text-[rgb(var(--role-accent-text))]">{amenity}</span>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Link to={`/workspace/${workspace.company.id}/${workspace.branch.id}`} className="rounded-full bg-[linear-gradient(135deg,rgba(139,92,246,0.95),rgba(96,165,250,0.95))] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(139,92,246,0.24)]">Explore Workspace</Link>
                    <Link to="/sign-in" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">Sign in</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
  );

  if (embedded) return <div className="space-y-4">{grid}</div>;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.10),transparent_24%),linear-gradient(180deg,#fbf9f7_0%,#f4efe8_100%)] px-4 py-6 text-slate-900 md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[32px] border border-white/70 bg-white/80 px-5 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl md:px-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-slate-400">Explore Workspaces</div>
              <h1 className="mt-2 font-display text-3xl font-bold text-slate-900 md:text-4xl">Browse coworking brands and branches before you book.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Create one global client account, then book desks and rooms at any verified workspace. Operators can still onboard new companies separately.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/sign-up?role=admin" className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.14)]">List your workspace</Link>
              <Link to="/sign-up?role=client" className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm">Create client account</Link>
              <Link to="/sign-in" className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm">Sign in</Link>
            </div>
          </div>
        </header>
        {grid}
      </div>
    </div>
  );
}

function ExploreWorkspacesPage() {
  return <ExploreWorkspaceGrid />;
}

function WorkspaceDetailPage() {
  const { user } = useAuthStore();
  const { companyId, branchId } = useParams();
  const workspaces = usePublicWorkspaces();
  const workspace = workspaces.find((item) => item.company.id === companyId && item.branch.id === branchId);

  if (!workspace) {
    return <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-soft">Workspace not found.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="space-y-4">
          <WorkspacePhoto title={workspace.branch.name} subtitle={`${workspace.company.name} · ${workspace.branch.city}`} tag="Branch spotlight" src={workspace.heroImageUrl} seed={workspace.gallerySeed} className="min-h-[420px]" />
          <div className="grid gap-4 sm:grid-cols-3">
            {workspace.galleryImageUrls.slice(0, 3).map((imageUrl, index) => (
              <WorkspacePhoto key={`${workspace.branch.id}-gallery-${index}`} title={`${workspace.branch.name} view ${index + 1}`} subtitle={index === 0 ? 'Arrival and lobby' : index === 1 ? 'Collaborative interiors' : 'Premium workspace atmosphere'} src={imageUrl} seed={`${workspace.gallerySeed}-${index}`} className="aspect-[4/3]" compact />
            ))}
          </div>
        </div>
        <div className="space-y-4 rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-400">Hero overview</div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-3xl font-bold text-slate-900">{workspace.branch.name}</h2>
            <VerificationBadge status={workspace.verificationStatus} />
          </div>
          <div className="text-sm text-slate-500">{workspace.company.name} · {workspace.branch.address}</div>
          <p className="text-sm leading-7 text-slate-600">{workspace.description}</p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <MiniStat label="Occupancy" value={`${workspace.occupancyRate}%`} />
            <MiniStat label="Rating" value={`${workspace.rating}/5`} />
            <MiniStat label="Open desks" value={String(workspace.availableDesks)} />
            <MiniStat label="Rooms" value={String(workspace.meetingRoomCount)} />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Operating hours</div>
              <div className="mt-1 font-semibold text-slate-900">{workspace.operatingHours}</div>
            </div>
            <a href={workspace.locationMapUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-slate-100">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Map</div>
              <div className="mt-1 font-semibold text-slate-900">Open in Maps</div>
            </a>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {workspace.amenities.map((amenity) => <span key={amenity} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{amenity}</span>)}
          </div>
          <div className="flex gap-3 pt-2">
            {user ? (
              <Link to={`/app/bookings?tab=desks&branchId=${workspace.branch.id}`} className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Book a desk</Link>
            ) : (
              <Link to={`/sign-in?redirect=${encodeURIComponent(`/app/bookings?tab=desks&branchId=${workspace.branch.id}`)}`} className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Sign in to book</Link>
            )}
            <Link to={`/app/bookings?tab=rooms&branchId=${workspace.branch.id}`} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">Meeting rooms</Link>
            <Link to="/explore" className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">Back to explore</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-400">Available spaces inside</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workspace.spaces.map((space) => (
              <div key={space.id} className="overflow-hidden rounded-[26px] border border-slate-100 bg-slate-50 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <WorkspacePhoto title={space.name} subtitle={space.category} src={space.imageUrl} seed={space.id} compact className="h-44 rounded-none border-0" />
                <div className="p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{space.category}</div>
                  <div className="mt-1 font-semibold text-slate-900">{space.name}</div>
                  <div className="mt-2 text-sm text-slate-500">Capacity {space.capacity}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{space.pricingLabel}</div>
                  <div className="mt-2 text-xs text-slate-500">{space.availabilityLabel}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {space.amenities.slice(0, 3).map((amenity) => <span key={amenity} className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">{amenity}</span>)}
                  </div>
                  <div className="mt-4">
                    {user ? (
                      <Link to={`/app/bookings?tab=desks&branchId=${workspace.branch.id}`} className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Select seat</Link>
                    ) : (
                      <Link to={`/sign-up?role=client&branchId=${workspace.branch.id}`} className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Sign up to book</Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-400">Seats preview</div>
          <div className="mt-4 space-y-3">
            {workspace.seatPreview.map((seat) => (
              <div key={seat.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <div className="font-semibold text-slate-900">{seat.label}</div>
                <div className="text-slate-500">Floor {seat.floor} · {seat.zone} · {seat.status}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-400">Workspace gallery</div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {workspace.galleryImageUrls.map((imageUrl, index) => (
              <WorkspacePhoto key={`${workspace.branch.id}-gallery-${index}`} title={`${workspace.branch.name} gallery ${index + 1}`} subtitle={index === 0 ? 'Lobby and reception' : index === 1 ? 'Shared work zones' : 'Lounge and event atmosphere'} src={imageUrl} seed={`${workspace.gallerySeed}-gallery-${index}`} className="aspect-square" />
            ))}
          </div>
        </div>
        <div className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-400">Reviews</div>
          <div className="mt-4 space-y-3">
            {workspace.reviews.length ? workspace.reviews.map((review, index) => (
              <div key={`${review.createdAt}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">{review.rating}/5</div>
                <div className="mt-1 text-sm text-slate-600">{review.message}</div>
              </div>
            )) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No public reviews yet.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

function SignUpPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const signUp = useAuthStore((state) => state.signUp);
  const authError = useAuthStore((state) => state.error);
  const role = useAuthStore((state) => state.claims?.role);
  const theme = getTheme(role);
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(() => ({
    role: (searchParams.get('role') === 'admin' ? 'admin' : 'client') as 'admin' | 'client',
    companyName: '',
    industry: '',
    name: '',
    email: '',
    password: ''
  }));

  const submit = async () => {
    try {
      if (form.role === 'admin') {
        await signUp({ role: 'admin', companyName: form.companyName, industry: form.industry, name: form.name, email: form.email, password: form.password });
        navigate('/app/dashboard');
        return;
      }
      await signUp({ role: 'client', name: form.name, email: form.email, password: form.password });
      const branchId = searchParams.get('branchId');
      navigate(branchId ? `/app/bookings?tab=desks&branchId=${branchId}` : '/app/explore');
      toast.success('Account created', 'Your Deskora account is ready.');
    } catch (error) {
      toast.error('Sign up failed', error instanceof Error ? error.message : 'Unable to create account.');
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.08),transparent_24%),linear-gradient(180deg,#fbf9f7_0%,#f7f5ff_100%)] px-4 py-8 text-slate-900 md:px-8" style={{ ['--role-accent' as never]: theme.accent, ['--role-accent-soft' as never]: theme.accentSoft, ['--role-accent-text' as never]: theme.accentText } as React.CSSProperties}>
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-8 lg:grid-cols-[0.95fr,1.05fr]">
        <div className="flex flex-col justify-between rounded-[32px] border border-slate-200/80 bg-white/90 p-8 shadow-soft backdrop-blur-xl">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-slate-400">Deskora</div>
            <h1 className="mt-4 max-w-lg font-display text-5xl font-bold leading-tight text-slate-900">{form.role === 'admin' ? 'Create a coworking organization.' : 'Create your global Deskora account.'}</h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">{form.role === 'admin' ? 'Company admins create the tenant, branches, and workspace structure.' : 'One account works across every public workspace. Pick a branch during booking, not during signup.'}</p>
          </div>
          <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(139,92,246,0.08),rgba(96,165,250,0.08),rgba(45,212,191,0.08))] p-5 text-sm text-slate-600">
            Already have access? Use the sign-in page to log in with an existing account.
          </div>
        </div>
        <div className="flex items-center justify-center rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-soft backdrop-blur-xl">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="text-sm uppercase tracking-[0.3em] text-slate-400">Sign up</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">Start your Deskora workspace</div>
            <div className="mt-6 space-y-4">
              <SelectField label="Signup type" value={form.role} onChange={(value) => setForm((current) => ({ ...current, role: value as 'admin' | 'client' }))} options={[{ label: 'Company admin', value: 'admin' }, { label: 'Client', value: 'client' }]} />
              {form.role === 'admin' ? (
                <>
                  <TextField label="Company name" value={form.companyName} onChange={(value) => setForm((current) => ({ ...current, companyName: value }))} />
                  <TextField label="Industry" value={form.industry} onChange={(value) => setForm((current) => ({ ...current, industry: value }))} />
                </>
              ) : null}
              <TextField label="Your name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
              <TextField label="Work email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} type="email" />
              <TextField label="Password" value={form.password} onChange={(value) => setForm((current) => ({ ...current, password: value }))} type="password" />
              {authError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{authError}</div> : null}
              <button onClick={submit} className="w-full rounded-2xl bg-teal-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-teal-400">{form.role === 'admin' ? 'Create company account' : 'Create client account'}</button>
              <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
                <span>Already registered?</span>
                <Link to="/sign-in" className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4">Back to sign in</Link>
              </div>
              <div className="text-sm text-slate-500">
                <Link to="/explore" className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4">Explore workspaces first</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPage() {
  const toast = useToast();
  const { user, claims } = useAuthStore();
  const theme = getTheme(claims?.role);
  const [feedbackDraft, setFeedbackDraft] = useState({ rating: 5, message: '', category: 'workspace' as Feedback['category'] });

  const submitFeedback = () => {
    const entry: Feedback = {
      id: crypto.randomUUID(),
      tenantId: user?.tenantId ?? 'platform',
      companyId: user?.companyId ?? 'company-demo',
      branchId: user?.branchId ?? 'branch-demo',
      clientId: user?.id ?? 'client-demo',
      rating: feedbackDraft.rating,
      category: feedbackDraft.category,
      message: feedbackDraft.message || 'Great workspace experience.',
      sentiment: feedbackDraft.rating >= 4 ? 'positive' : feedbackDraft.rating === 3 ? 'neutral' : 'negative',
      createdAt: new Date().toISOString()
    };
    const next = [entry, ...loadLocalFeedback()].slice(0, 24);
    saveLocalFeedback(next);
    setFeedbackDraft((current) => ({ ...current, message: '' }));
    toast.success('Feedback submitted', 'Thank you for sharing your workspace experience.');
  };

  return (
    <SectionLayout title="Profile & settings" description={claims?.role === 'client' ? 'Manage your global Deskora profile and share workspace feedback.' : 'Workspace branding and operational defaults.'}>
      <div className="grid gap-5 xl:grid-cols-2" style={{ ['--role-accent' as never]: theme.accent, ['--role-accent-soft' as never]: theme.accentSoft, ['--role-accent-text' as never]: theme.accentText } as React.CSSProperties}>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Profile</div>
          <div className="mt-5 grid gap-3">
            <TextField label="Name" value={user?.name ?? ''} onChange={() => undefined} />
            <TextField label="Email" value={user?.email ?? ''} onChange={() => undefined} />
            <TextField label="Role" value={claims?.role ?? ''} onChange={() => undefined} />
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Workspace feedback</div>
          <div className="mt-5 grid gap-3">
            <NumberField label="Rating" value={feedbackDraft.rating} onChange={(value) => setFeedbackDraft((current) => ({ ...current, rating: value }))} />
            <SelectField label="Category" value={feedbackDraft.category} onChange={(value) => setFeedbackDraft((current) => ({ ...current, category: value as Feedback['category'] }))} options={[{ label: 'Workspace', value: 'workspace' }, { label: 'Meeting room', value: 'meeting_room' }, { label: 'Maintenance', value: 'maintenance' }, { label: 'Suggestion', value: 'suggestion' }]} />
            <TextField label="Message" value={feedbackDraft.message} onChange={(value) => setFeedbackDraft((current) => ({ ...current, message: value }))} />
            <button onClick={submitFeedback} className="rounded-2xl bg-[rgb(var(--role-accent))] px-4 py-3 font-semibold text-white">Submit feedback</button>
          </div>
        </div>
      </div>
    </SectionLayout>
  );
}

function SectionLayout({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className={sectionCardClassName('p-5')}>
        <div className="text-2xl font-bold text-slate-900">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{description}</div>
      </div>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm text-slate-600">{label}</div>
      <input value={value} type={type} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[rgb(var(--role-accent))] focus:ring-4 focus:ring-[rgb(var(--role-accent))]/10" />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <TextField label={label} value={String(value)} onChange={(next) => onChange(Number(next))} type="number" />;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm text-slate-600">{label}</div>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgb(var(--role-accent))] focus:ring-4 focus:ring-[rgb(var(--role-accent))]/10">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function PageLoading({ label }: { label: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={sectionCardClassName('p-6')}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-slate-900">{label}</div>
          <div className="mt-1 text-sm text-slate-500">Preparing your workspace view</div>
        </div>
        <div className="h-3 w-24 rounded-full bg-slate-100" />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </motion.div>
  );
}

function PageEmpty({ title, description }: { title: string; description: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={sectionCardClassName('overflow-hidden p-8')}>
      <div className="grid gap-6 md:grid-cols-[0.8fr,1.2fr] md:items-center">
        <div className="rounded-[28px] bg-[linear-gradient(135deg,rgba(139,92,246,0.12),rgba(96,165,250,0.12),rgba(251,146,60,0.08))] p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 rounded-2xl bg-white/80 shadow-sm" />
            <div className="h-20 rounded-2xl bg-white/80 shadow-sm" />
            <div className="h-20 rounded-2xl bg-white/80 shadow-sm" />
            <div className="h-20 rounded-2xl bg-white/80 shadow-sm" />
          </div>
        </div>
        <div>
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <div className="mt-2 text-sm text-slate-500">{description}</div>
          <div className="mt-4 rounded-2xl bg-[rgb(var(--role-accent-soft))] p-4 text-sm text-[rgb(var(--role-accent-text))]">Try creating a branch, booking a seat, or generating an invoice to populate this area.</div>
        </div>
      </div>
    </motion.div>
  );
}

export default App;
