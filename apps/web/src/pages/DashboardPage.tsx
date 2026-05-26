import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getDashboard, listBranches, listMeetingRooms, listSeats } from '../api';
import type { Branch, DashboardResponse, Feedback, MeetingRoom, Notification, Seat, SmartInsight } from '../types';
import { useAuthStore } from '../store/auth';
import { AnimatePresence, motion } from 'framer-motion';

const roleThemes = {
  admin: { accent: '#8b5cf6', accentSoft: '#ede9fe', accentText: '#4c1d95', accentMuted: '#c4b5fd', ring: 'rgba(139,92,246,0.18)' },
  client: { accent: '#fb7185', accentSoft: '#ffe4e6', accentText: '#9f1239', accentMuted: '#fda4af', ring: 'rgba(251,113,133,0.18)' },
  default: { accent: '#60a5fa', accentSoft: '#dbeafe', accentText: '#1d4ed8', accentMuted: '#93c5fd', ring: 'rgba(96,165,250,0.18)' }
} as const;

type Role = keyof typeof roleThemes;

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

function getTheme(role: Role | null | undefined) {
  return role ? roleThemes[role] : roleThemes.default;
}

function panelClassName(extra = '') {
  return `rounded-[28px] border border-slate-200/80 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl ${extra}`;
}

function sectionCardClassName(extra = '') {
  return `rounded-[24px] border border-slate-200/80 bg-white/90 shadow-soft ${extra}`;
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
    tone: 'client',
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
          <div className="mt-4 rounded-2xl bg-[rgb(var(--role-accent-soft))] p-4 text-sm text-[rgb(var(--role-accent-text))]">Try another branch, seat, or invoice to populate this module.</div>
        </div>
      </div>
    </motion.div>
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

function AnimatedStatCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: string }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</div>
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <div className="mt-3 text-3xl font-bold text-slate-900" style={{ color: accent }}>{value}</div>
      <div className="mt-2 text-sm text-slate-500">{hint}</div>
    </motion.div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-soft">
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

  return { data, loading, error };
}

export function DashboardPage() {
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
    { label: 'Revenue', value: `₹${liveData.totals.revenue.toLocaleString()}`, hint: 'Lifetime booked revenue and paid invoices.' },
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
                    {selectedSeats.slice(0, 12).map((seat) => (
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
                  <select value={feedbackDraft.category} onChange={(event) => setFeedbackDraft((current) => ({ ...current, category: event.target.value as Feedback['category'] }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgb(var(--role-accent))] focus:ring-4 focus:ring-[rgb(var(--role-accent))]/10">
                    <option value="workspace">Workspace</option>
                    <option value="meeting_room">Meeting room</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="suggestion">Suggestion</option>
                  </select>
                  <select value={feedbackDraft.sentiment} onChange={(event) => setFeedbackDraft((current) => ({ ...current, sentiment: event.target.value as Feedback['sentiment'] }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgb(var(--role-accent))] focus:ring-4 focus:ring-[rgb(var(--role-accent))]/10">
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                  </select>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[0.5fr,1.5fr]">
                  <input value={feedbackDraft.rating} type="number" onChange={(event) => setFeedbackDraft((current) => ({ ...current, rating: Number(event.target.value) }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgb(var(--role-accent))] focus:ring-4 focus:ring-[rgb(var(--role-accent))]/10" />
                  <input value={feedbackDraft.message} onChange={(event) => setFeedbackDraft((current) => ({ ...current, message: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgb(var(--role-accent))] focus:ring-4 focus:ring-[rgb(var(--role-accent))]/10" />
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
