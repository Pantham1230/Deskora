import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bookMeetingRoom, listBranches, listMeetingRooms, listSeats, getDashboard } from '../api';
import type { Branch, DashboardResponse, Feedback, MeetingRoom, Seat, SmartInsight } from '../types';

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

function SectionLayout({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-soft">
        <div className="text-2xl font-bold text-slate-900">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{description}</div>
      </div>
      {children}
    </div>
  );
}

function PageLoading({ label }: { label: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[24px] border border-slate-200/80 bg-white/90 p-6 shadow-soft">
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[24px] border border-slate-200/80 bg-white/90 p-8 shadow-soft">
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

function TextField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm text-slate-600">{label}</div>
      <input value={value} type={type} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[rgb(var(--role-accent))] focus:ring-4 focus:ring-[rgb(var(--role-accent))]/10" />
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

export function DigitalTwinPage() {
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
        <div className="space-y-4 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {branches.map((branch) => (
              <button key={branch.id} onClick={() => setBranchId(branch.id)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${branchId === branch.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {branch.name}
              </button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-[28px] border border-slate-200/80 p-4" style={{ background: `linear-gradient(135deg, ${palette[0]}12, ${palette[1]}12)` }}>
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

export function HeatmapPage() {
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

export function FeedbackPage() {
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

        </div>
      </div>
    </SectionLayout>
  );
}

export function DigitalTwinFloorPanel() {
  return <DigitalTwinPage />;
}

export function HeatmapAnalyticsPanel() {
  return <HeatmapPage />;
}

export function FeedbackInsightsPanel() {
  return <FeedbackPage />;
}
