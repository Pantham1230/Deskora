import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { io, type Socket } from 'socket.io-client';
import Skeleton from '../components/Skeleton';
import VisitorsPanel from '../components/VisitorsPanel';
import WorkspacePhoto from '../components/WorkspacePhoto';
import { DigitalTwinFloorPanel } from './DeskoraModules';
import { getDashboard, listBranches, listMeetingRooms, listSeats } from '../api';
import type { Branch, DashboardResponse, MeetingRoom, Seat } from '../types';
import { useAuthStore } from '../store/auth';

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

function formatCompactCurrency(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${value.toLocaleString()}`;
}

function getHealthScore(occupancy: number, rating: number, revenue: number) {
  return Math.max(40, Math.min(99, Math.round((occupancy * 0.35) + (rating * 18) + Math.min(revenue / 10000, 25))));
}

function getRealtimeSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL as string;
  if (window.location.port === '5173') return 'http://localhost:4000';
  return window.location.origin;
}

type ActivityTone = 'booking' | 'payment' | 'client' | 'renewal' | 'meeting';

function buildActivityFeedItems(data: DashboardResponse | null) {
  if (!data) return [];
  const notificationItems = data.recentNotifications.slice(0, 3).map((notification, index) => ({
    id: `notification-${index}`,
    title: notification.title,
    detail: notification.body,
    tone: (notification.type === 'booking' ? 'booking' : notification.type === 'payment' ? 'payment' : 'renewal') as ActivityTone,
    createdAt: notification.createdAt
  }));
  const paymentItems = data.payments.slice(0, 2).map((payment, index) => ({
    id: `payment-${index}`,
    title: payment.status === 'paid' ? 'Invoice paid' : 'Payment status changed',
    detail: `${payment.method.toUpperCase()} · ${formatCompactCurrency(payment.amount)} · ${payment.referenceId || payment.invoiceId}`,
    tone: (payment.status === 'paid' ? 'payment' : 'renewal') as ActivityTone,
    createdAt: payment.paidAt ?? new Date(Date.now() - (index + 2) * 3600000).toISOString()
  }));
  const clientItems = data.clients.slice(0, 2).map((client, index) => ({
    id: `client-${index}`,
    title: 'New client onboarded',
    detail: `${client.name} moved to ${client.stage} stage.`,
    tone: 'client' as ActivityTone,
    createdAt: client.lastTouchAt
  }));
  return [...notificationItems, ...paymentItems, ...clientItems].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 8);
}

function useActivityFeed(data: DashboardResponse | null) {
  const [feed, setFeed] = useState<Array<{ id: string; title: string; detail: string; tone: ActivityTone; createdAt: string }>>([]);

  useEffect(() => {
    setFeed(buildActivityFeedItems(data));
  }, [data]);

  return [feed, setFeed] as const;
}

function HeaderStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[22px] border border-white/60 bg-white/75 px-4 py-3 backdrop-blur-xl shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function MetricCard({ title, value, detail, accent }: { title: string; value: string; detail: string; accent: string }) {
  return (
    <motion.div whileHover={{ y: -4 }} className="rounded-[26px] border border-slate-200/80 bg-white/85 p-4 shadow-[0_18px_55px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{title}</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
          <div className="mt-1 text-sm text-slate-500">{detail}</div>
        </div>
        <div className="h-12 w-12 rounded-2xl" style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}88)` }} />
      </div>
    </motion.div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="text-sm uppercase tracking-[0.3em] text-slate-400">{title}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{subtitle}</div>
    </div>
  );
}

function LivePulseDot() {
  return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />;
}

export function CommandCenterPage() {
  const { data, loading, error } = useDashboardData();
  const token = useAuthStore((state) => state.token);
  const claims = useAuthStore((state) => state.claims);
  const isClient = claims?.role === 'client';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<MeetingRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [feed, setFeed] = useActivityFeed(data);
  const [activeTime, setActiveTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setActiveTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
      if (!selectedRoomId && roomData[0]) {
        setSelectedRoomId(roomData[0].id);
      }
    });
  }, [selectedBranchId]);

  useEffect(() => {
    if (!token || !claims) return;
    const socket: Socket = io(getRealtimeSocketUrl(), { auth: { token } });

    const refreshBranchData = async (branchId: string) => {
      if (!branchId) return;
      const [seatData, roomData] = await Promise.all([listSeats(branchId), listMeetingRooms(branchId)]);
      setSelectedSeats(seatData);
      setSelectedRooms(roomData);
    };

    const handleSeatUpdate = (updatedSeat: Seat) => {
      if (updatedSeat.branchId === selectedBranchId) {
        setSelectedSeats((current) => current.map((seat) => (seat.id === updatedSeat.id ? updatedSeat : seat)));
        setFeed((current) => [{ id: crypto.randomUUID(), title: 'Seat updated live', detail: `${updatedSeat.label} is now ${updatedSeat.status}.`, tone: (updatedSeat.status === 'booked' ? 'booking' : 'renewal') as ActivityTone, createdAt: new Date().toISOString() }, ...current].slice(0, 8));
      }
    };
    socket.on('seat:updated', handleSeatUpdate);
    const handleNotification = (n: any) => {
      setFeed((current) => ([{ id: crypto.randomUUID(), title: n.title, detail: n.body, tone: (n.type === 'payment' ? 'payment' : n.type === 'meeting' ? 'meeting' : n.type === 'renewal' ? 'renewal' : 'booking') as ActivityTone, createdAt: new Date().toISOString() }, ...current].slice(0, 8)));
    };
    const handleDashboardRefresh = async (_: any) => {
      setRefreshing(true);
      try {
        const refreshed = await getDashboard();
        setFeed(buildActivityFeedItems(refreshed));
        await refreshBranchData(selectedBranchId);
      } catch {
        // ignore
      } finally {
        setRefreshing(false);
      }
    };
    socket.on('connect', () => setReconnecting(false));
    socket.on('disconnect', () => setReconnecting(true));
    socket.on('connect_error', () => {
      setReconnecting(true);
      setFeed((current) => [{ id: crypto.randomUUID(), title: 'Realtime reconnecting', detail: 'Command Center is temporarily using the last successful snapshot.', tone: 'renewal' as ActivityTone, createdAt: new Date().toISOString() }, ...current].slice(0, 8));
    });
    socket.on('notification:created', handleNotification);
    socket.on('dashboard:refresh', handleDashboardRefresh);
    return () => {
      socket.off('seat:updated', handleSeatUpdate);
      socket.off('notification:created', handleNotification);
      socket.off('dashboard:refresh', handleDashboardRefresh);
      socket.off('connect_error');
      socket.disconnect();
    };
  }, [claims, selectedBranchId, token]);

  if (loading || !data) return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-soft">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48 rounded-md" />
            <Skeleton className="h-8 w-96 rounded-md" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Skeleton className="h-12 w-36 rounded-lg" />
            <Skeleton className="h-12 w-36 rounded-lg" />
            <Skeleton className="h-12 w-36 rounded-lg" />
            <Skeleton className="h-12 w-36 rounded-lg" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.25fr,0.75fr]">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
  if (error) return <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-soft">{error}</div>;

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0] ?? data.branchStats[0];
  const selectedBranchStat = data.branchStats.find((branch) => branch.id === selectedBranch?.id) ?? data.branchStats[0];
  const palette = getBranchPalette(selectedBranch?.name ?? 'Deskora');
  const zones = Array.from(new Set(selectedSeats.map((seat) => seat.zone)));
  const zoneRows = zones.map((zone) => {
    const zoneSeats = selectedSeats.filter((seat) => seat.zone === zone);
    const occupied = zoneSeats.filter((seat) => seat.status !== 'available').length;
    return { zone, occupancy: zoneSeats.length ? Math.round((occupied / zoneSeats.length) * 100) : 0, total: zoneSeats.length };
  });
  const branchInsights = data.insights.slice(0, 5);
  const topAlerts = [
    { title: 'Payment overdue', detail: 'One invoice is overdue and awaiting finance review.', tone: 'warning' },
    { title: 'Occupancy spike', detail: 'Peak workspace usage is expected around 2 PM today.', tone: 'info' },
    { title: 'Maintenance watch', detail: 'A lounge zone needs a lighting check in the afternoon.', tone: 'warning' },
    { title: 'Renewals due', detail: '12 renewals are due within the next 7 days.', tone: 'accent' }
  ] as const;

  const branchCards = data.branchStats.map((branch) => {
    const branchFeedback = data.feedback.filter((item) => item.branchId === branch.id);
    const rating = branchFeedback.reduce((sum, item) => sum + item.rating, 0) / Math.max(branchFeedback.length, 1);
    const health = getHealthScore(branch.occupancyRate, rating || 4.5, data.invoices.filter((invoice) => invoice.branchId === branch.id && invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0));
    return { ...branch, rating: rating || 4.5, health };
  });

  const heatmapBars = zoneRows.map((zone) => ({ name: zone.zone, value: zone.occupancy }));
  const revenuePulse = Array.from({ length: 6 }, (_, index) => ({
    time: `${String(10 + index * 2).padStart(2, '0')}:00`,
    revenue: Math.max(150000, Math.round(data.totals.revenue * (0.68 + index * 0.06)))
  }));
  const branchComparison = data.branchStats.map((branch, index) => ({ name: branch.name.split(' ')[0], occupancy: branch.occupancyRate, revenue: (index + 1) * 180000 }));
  const peakUsage = data.heatmap.slice(0, 6).map((cell) => ({ name: cell.zone, value: cell.intensity }));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.10),transparent_24%),linear-gradient(180deg,#fbf9f7_0%,#f7f5ff_100%)] px-4 py-4 text-slate-900 md:px-6 md:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1800px] flex-col gap-4">
        <header className="rounded-[30px] border border-slate-200/80 bg-white/75 px-5 py-4 shadow-[0_24px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl md:px-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.45em] text-slate-400">Deskora Command Center</div>
              <div className="mt-2 flex items-center gap-3">
                <h1 className="font-display text-3xl font-bold text-slate-900 md:text-4xl">{isClient ? 'Workspace Explorer' : 'Executive Operations Control Room'}</h1>
                <LivePulseDot />
                <span className="text-xs uppercase tracking-[0.25em] text-emerald-600">Live</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span>{selectedBranch?.name ?? 'No branch selected'} · {claims?.role?.replace('_', ' ')}</span>
                {!isClient && selectedBranchId ? (
                  <a
                    href="#visitors-check-in"
                    className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
                  >
                    Visitor check-in ↓
                  </a>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              <HeaderStat label="Tenant" value={selectedBranch?.companyId?.slice(0, 8) ?? 'Platform'} sub={selectedBranch?.city ?? 'All locations'} />
              <HeaderStat label="Time" value={activeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} sub={activeTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} />
              <HeaderStat label="Occupancy" value={`${data.totals.occupancyRate}%`} sub="Portfolio wide" />
              <HeaderStat label="Health" value={`${selectedBranchStat?.experienceScore ?? 0}`} sub="Branch operating score" />
              <HeaderStat label="Status" value="Nominal" sub="Systems online" />
            </div>
          </div>
        </header>

        {reconnecting ? (
          <div className="mx-auto mt-4 max-w-[1200px] rounded-xl bg-amber-50/60 px-4 py-2 text-sm text-amber-800">Realtime disconnected — showing last known snapshot. Attempting reconnect…</div>
        ) : null}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <WorkspacePhoto
            title={selectedBranch?.name ?? 'Deskora workspace'}
            subtitle={`${selectedBranch?.city ?? 'All branches'} • mission control atmosphere`}
            tag="Command Center"
            seed={selectedBranch?.id ?? 'command-center'}
            className="h-[250px]"
          />
        </motion.div>

        {!isClient && selectedBranchId ? (
          <div id="visitors-check-in">
            <VisitorsPanel branchId={selectedBranchId} branchName={selectedBranch?.name ?? 'Selected branch'} defaultFormOpen />
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[0.9fr,1.45fr,0.95fr]">
          <aside className="space-y-4 rounded-[30px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <PanelTitle title={isClient ? 'Location explorer' : 'Branch monitoring'} subtitle={isClient ? 'Choose a branch and reserve a room' : 'Five live coworking tenants'} />
            <div className="flex flex-wrap gap-2">
              {branchCards.map((branch) => (
                <button key={branch.id} onClick={() => { setSelectedBranchId(branch.id); setSelectedRoomId(''); }} className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${selectedBranchId === branch.id ? 'bg-[rgb(var(--role-accent))] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {branch.name}
                </button>
              ))}
            </div>
            {isClient ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {selectedRooms.map((room) => (
                  <motion.button key={room.id} whileHover={{ y: -4 }} onClick={() => setSelectedRoomId(room.id)} className={`flex aspect-square flex-col overflow-hidden rounded-[28px] border text-left shadow-sm transition ${selectedRoomId === room.id ? 'border-[rgb(var(--role-accent))]/30 bg-[rgb(var(--role-accent-soft))]' : 'border-slate-200/80 bg-white'}`}>
                    <WorkspacePhoto title={room.name} subtitle={`${selectedBranch?.city ?? 'Selected branch'} · ${room.capacity} seats`} tag="Meeting room" src={room.imageUrl} seed={room.id} compact className="h-1/2 rounded-none border-0" />
                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{room.name}</div>
                        <div className="mt-1 text-xs text-slate-500">Capacity {room.capacity} · ₹{room.hourlyRate}/hr</div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <div className="rounded-2xl bg-slate-50 px-3 py-2">Select room</div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-2">{room.hourlyRate >= 2000 ? 'Premium' : 'Ready'}</div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {branchCards.map((branch) => (
                  <motion.button key={branch.id} whileHover={{ y: -2 }} onClick={() => { setSelectedBranchId(branch.id); setSelectedRoomId(''); }} className={`flex aspect-square flex-col overflow-hidden rounded-[28px] border p-0 text-left shadow-sm transition ${selectedBranchId === branch.id ? 'border-[rgb(var(--role-accent))]/30 bg-[rgb(var(--role-accent-soft))]' : 'border-slate-200/80 bg-white'}`}>
                    <WorkspacePhoto title={branch.name} subtitle={branch.city} src={branch.heroImageUrl} seed={branch.id} compact className="h-1/2 rounded-none border-0" />
                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{branch.name}</div>
                          <div className="text-xs text-slate-500">{branch.city}</div>
                        </div>
                        <span className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600 bg-slate-100">{branch.health}</span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <div>Occupancy {branch.occupancyRate}%</div>
                        <div>Clients {data.clients.filter((client) => client.companyId === branch.companyId).length}</div>
                        <div>Seats {branch.seatCount}</div>
                        <div>Revenue {formatCompactCurrency(data.invoices.filter((invoice) => invoice.branchId === branch.id).reduce((sum, invoice) => sum + invoice.total, 0))}</div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </aside>

          <main className="space-y-4 rounded-[30px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PanelTitle title="Digital twin" subtitle={`${selectedBranch?.name ?? 'Workspace'} floor view`} />
              <div className="flex flex-wrap gap-2">
                <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm">Occupancy</button>
                <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm">Rooms</button>
                <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm">Alerts</button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.25fr,0.75fr]">
              <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,255,255,0.82))] p-4 shadow-sm" style={{ backgroundImage: `radial-gradient(circle at 20% 20%, ${palette[0]}16, transparent 35%), radial-gradient(circle at 80% 20%, ${palette[1]}16, transparent 35%)` }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Floor intelligence</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">Spatial live layout</div>
                  </div>
                  <div className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm">{selectedSeats.length} seats</div>
                </div>
                {refreshing ? (
                  <div className="mt-4 grid grid-cols-12 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center justify-center">
                        <Skeleton className="h-8 w-16 rounded-2xl" />
                        <Skeleton className="mt-2 h-3 w-10 rounded-md" />
                      </div>
                    ))}
                  </div>
                ) : selectedSeats.length ? (
                  <div className="mt-4 grid grid-cols-12 gap-3">
                    {selectedSeats.slice(0, 24).map((seat) => (
                      <motion.div key={seat.id} whileHover={{ scale: 1.08, y: -2 }} className={`group flex flex-col items-center justify-center rounded-2xl border border-white/70 bg-white/90 p-3 shadow-sm transition ${getSeatTone(seat.status)}`}>
                        <div className="h-3 w-3 rounded-full bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.55)]" />
                        <div className="mt-2 text-[10px] font-semibold text-slate-700">{seat.label}</div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-white/80 px-4 py-10 text-center text-sm text-slate-500">
                    Floor data is loading for this branch.
                  </div>
                )}
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-white/85 p-3 shadow-sm">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Available</div>
                    <div className="mt-1 text-lg font-semibold text-emerald-600">{selectedSeats.filter((seat) => seat.status === 'available').length}</div>
                  </div>
                  <div className="rounded-2xl bg-white/85 p-3 shadow-sm">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Occupied</div>
                    <div className="mt-1 text-lg font-semibold text-rose-500">{selectedSeats.filter((seat) => seat.status === 'booked').length}</div>
                  </div>
                  <div className="rounded-2xl bg-white/85 p-3 shadow-sm">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Reserved</div>
                    <div className="mt-1 text-lg font-semibold text-amber-500">{selectedSeats.filter((seat) => seat.status === 'reserved').length}</div>
                  </div>
                  <div className="rounded-2xl bg-white/85 p-3 shadow-sm">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Meeting</div>
                    <div className="mt-1 text-lg font-semibold text-sky-500">{selectedSeats.filter((seat) => seat.status === 'cancelled').length}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <PanelTitle title="Branch rooms" subtitle="Active meeting and focus spaces" />
                  <span className="rounded-full bg-[rgb(var(--role-accent-soft))] px-3 py-1 text-xs font-semibold text-[rgb(var(--role-accent-text))]">Realtime</span>
                </div>
                {refreshing ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                  </div>
                ) : selectedRooms.length ? selectedRooms.map((room) => (
                  <div key={room.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-900">{room.name}</div>
                        <div className="text-xs text-slate-500">Capacity {room.capacity}</div>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">₹{room.hourlyRate}/hr</div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white">
                      <div className="h-2 rounded-full bg-sky-400" style={{ width: `${Math.min(100, room.capacity * 6)}%` }} />
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500">
                    No meeting rooms are defined for this branch yet.
                  </div>
                )}
                <div className="rounded-2xl bg-[linear-gradient(180deg,#fff,rgba(255,255,255,0.8))] p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Zone mix</div>
                  <div className="mt-4 space-y-2">
                    {zoneRows.map((zone) => (
                      <div key={zone.zone} className="rounded-2xl border border-slate-100 bg-white p-3">
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <div className="font-semibold text-slate-900">{zone.zone}</div>
                          <div className="text-slate-500">{zone.occupancy}%</div>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-100">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(zone.occupancy, 12)}%` }} className="h-full rounded-full bg-[rgb(var(--role-accent))]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </main>

          <aside className="space-y-4 rounded-[30px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <PanelTitle title="Smart assistant" subtitle="Operational insights and alerts" />
            <div className="space-y-3">
              {branchInsights.map((insight) => (
                <motion.div key={insight.id} whileHover={{ y: -2 }} className="rounded-[24px] border border-slate-100 bg-slate-50 p-4 shadow-sm">
                  <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${insight.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : insight.tone === 'warning' ? 'bg-amber-50 text-amber-700' : insight.tone === 'info' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'}`}>{insight.tone}</div>
                  <div className="mt-2 font-semibold text-slate-900">{insight.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{insight.detail}</div>
                </motion.div>
              ))}
              {topAlerts.map((alert) => (
                <motion.div key={alert.title} whileHover={{ y: -2 }} className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.28em] text-slate-400">{alert.tone}</div>
                      <div className="mt-1 font-semibold text-slate-900">{alert.title}</div>
                    </div>
                    <span className={`h-3 w-3 rounded-full ${alert.tone === 'warning' ? 'bg-amber-400' : alert.tone === 'info' ? 'bg-sky-400' : 'bg-violet-400'}`} />
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{alert.detail}</div>
                </motion.div>
              ))}
            </div>
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.25fr,0.75fr]">
          <div className="space-y-4 rounded-[30px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <PanelTitle title="Business pulse" subtitle="Revenue, occupancy and branch analytics" />
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
              <MetricCard title="Occupancy" value={`${data.totals.occupancyRate}%`} detail="Portfolio utilization" accent="#14b8a6" />
              <MetricCard title="Active clients" value={String(data.totals.activeClients)} detail="Converted members" accent="#fb923c" />
              <MetricCard title="Branch health" value={`${selectedBranchStat?.experienceScore ?? 0}`} detail="Operational score" accent="#fb7185" />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <PanelTitle title="Revenue pulse graph" subtitle="Rolling collected revenue" />
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={revenuePulse}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 18 }} />
                    <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fill="rgba(139,92,246,0.15)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm">
                <PanelTitle title="Occupancy heatmap" subtitle="Zone intensity by selected branch" />
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={heatmapBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 18 }} />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                      {heatmapBars.map((entry, index) => (
                        <Cell key={entry.name} fill={[palette[0], palette[1], '#fb923c', '#fb7185'][index % 4]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm">
                <PanelTitle title="Booking trends" subtitle="Occupancy and room activity" />
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={data.branchStats.map((branch, index) => ({ name: branch.name.split(' ')[0], occupancy: branch.occupancyRate, bookings: branch.bookedSeats + index * 2 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 18 }} />
                    <Line type="monotone" dataKey="occupancy" stroke="#14b8a6" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="bookings" stroke="#fb923c" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm">
                <PanelTitle title="Branch comparison" subtitle="Occupancy and revenue mix" />
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={branchComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 18 }} />
                    <Bar dataKey="occupancy" fill="#8b5cf6" radius={[12, 12, 0, 0]} />
                    <Bar dataKey="revenue" fill="#fb923c" radius={[12, 12, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm">
              <PanelTitle title="Peak usage timings" subtitle="Most intense zones in the selected branch" />
              <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {peakUsage.map((entry) => (
                  <motion.div key={entry.name} whileHover={{ y: -3 }} className="rounded-[22px] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafaff_100%)] p-4 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">{entry.name}</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{entry.value}%</div>
                    <div className="mt-3 h-2 rounded-full bg-slate-100">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${entry.value}%` }} className="h-full rounded-full bg-[rgb(var(--role-accent))]" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-[30px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <PanelTitle title="Live activity" subtitle="Bookings, payments and renewals" />
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {feed.map((event) => (
                  <motion.div key={event.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${event.tone === 'payment' ? 'bg-emerald-50 text-emerald-700' : event.tone === 'booking' ? 'bg-[rgb(var(--role-accent-soft))] text-[rgb(var(--role-accent-text))]' : event.tone === 'renewal' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>{event.tone}</span>
                          <span className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Live</span>
                        </div>
                        <div className="mt-2 font-semibold text-slate-900">{event.title}</div>
                        <div className="mt-1 text-sm text-slate-500">{event.detail}</div>
                      </div>
                      <div className="text-xs text-slate-400">{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {!isClient ? (
          <section className="rounded-[30px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <PanelTitle title="Digital twin" subtitle="Live floor map integrated into Command Center" />
            <div className="mt-4">
              <DigitalTwinFloorPanel />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
