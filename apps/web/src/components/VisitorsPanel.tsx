import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { checkInVisitor, checkOutVisitor, listMeetingRooms, listVisitors } from '../api';
import { useToast } from './Toast';
import type { MeetingRoom, Visitor } from '../types';

type VisitorsPanelProps = {
  branchId: string;
  branchName: string;
  defaultFormOpen?: boolean;
  compact?: boolean;
};

export default function VisitorsPanel({ branchId, branchName, defaultFormOpen = false, compact = false }: VisitorsPanelProps) {
  const toast = useToast();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [showForm, setShowForm] = useState(defaultFormOpen);
  const [form, setForm] = useState({
    visitorName: '',
    purpose: '',
    hostName: '',
    workspaceLocation: ''
  });

  const refresh = async () => {
    if (!branchId) return;
    const [visitorData, roomData] = await Promise.all([listVisitors(branchId), listMeetingRooms(branchId)]);
    setVisitors(visitorData);
    setRooms(roomData);
  };

  useEffect(() => {
    void refresh();
  }, [branchId]);

  useEffect(() => {
    if (defaultFormOpen) setShowForm(true);
  }, [branchId, defaultFormOpen]);

  const activeVisitors = useMemo(() => visitors.filter((visitor) => visitor.status === 'checked_in'), [visitors]);
  const recentVisitors = useMemo(() => visitors.filter((visitor) => visitor.status === 'checked_out').slice(0, 5), [visitors]);

  const submitCheckIn = async () => {
    try {
      const visitor = await checkInVisitor({ branchId, ...form });
      setVisitors((current) => [visitor, ...current]);
      setForm({ visitorName: '', purpose: '', hostName: '', workspaceLocation: '' });
      setShowForm(false);
      toast.success('Visitor checked in', `${visitor.visitorName} · Pass ${visitor.passId}`);
    } catch (error) {
      toast.error('Check-in failed', error instanceof Error ? error.message : 'Unable to check in visitor.');
    }
  };

  const handleCheckOut = async (visitorId: string, visitorName: string) => {
    try {
      const updated = await checkOutVisitor(visitorId);
      setVisitors((current) => current.map((visitor) => (visitor.id === updated.id ? updated : visitor)));
      toast.success('Visitor checked out', `${visitorName} has left the workspace.`);
    } catch (error) {
      toast.error('Check-out failed', error instanceof Error ? error.message : 'Unable to check out visitor.');
    }
  };

  return (
    <div className={`space-y-4 rounded-[28px] border-2 border-violet-200/90 bg-[linear-gradient(135deg,rgba(237,233,254,0.85),rgba(255,255,255,0.98))] p-5 shadow-[0_20px_60px_rgba(139,92,246,0.12)] ${compact ? '' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.32em] text-violet-400">Today&apos;s visitors</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{branchName}</div>
          <div className="mt-1 text-sm text-slate-500">{activeVisitors.length} on-site · {recentVisitors.length} recent check-outs</div>
        </div>
        <button
          onClick={() => setShowForm((current) => !current)}
          className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(139,92,246,0.22)] transition hover:bg-violet-500"
        >
          {showForm ? 'Close' : 'Check in visitor'}
        </button>
      </div>

      <AnimatePresence>
        {showForm ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="grid gap-3 rounded-2xl border border-white/80 bg-white/90 p-4 md:grid-cols-2">
              <label className="block text-sm text-slate-600">
                Visitor name
                <input value={form.visitorName} onChange={(event) => setForm((current) => ({ ...current, visitorName: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. Ananya Reddy" />
              </label>
              <label className="block text-sm text-slate-600">
                Purpose
                <input value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Client meeting" />
              </label>
              <label className="block text-sm text-slate-600">
                Visiting host / company
                <input value={form.hostName} onChange={(event) => setForm((current) => ({ ...current, hostName: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="NovaHub Operations" />
              </label>
              <label className="block text-sm text-slate-600">
                Workspace / room
                <input list="visitor-room-options" value={form.workspaceLocation} onChange={(event) => setForm((current) => ({ ...current, workspaceLocation: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Atlas Meeting Room" />
                <datalist id="visitor-room-options">
                  {rooms.map((room) => <option key={room.id} value={room.name} />)}
                  <option value="Open Desk Area" />
                  <option value="Reception Lounge" />
                </datalist>
              </label>
              <div className="md:col-span-2">
                <button onClick={() => void submitCheckIn()} className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Confirm check-in</button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">Checked in</div>
          {activeVisitors.length ? activeVisitors.map((visitor) => (
            <motion.div key={visitor.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{visitor.visitorName}</span>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold text-violet-700">{visitor.passId}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{visitor.purpose}</div>
                  <div className="mt-1 text-xs text-slate-500">Host: {visitor.hostName} · {visitor.workspaceLocation}</div>
                  <div className="mt-1 text-xs text-slate-400">In since {new Date(visitor.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <button onClick={() => void handleCheckOut(visitor.id, visitor.visitorName)} className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700">Check out</button>
              </div>
            </motion.div>
          )) : (
            <div className="rounded-2xl border border-dashed border-emerald-200 bg-white/70 p-4 text-sm text-slate-500">No active visitors at this branch.</div>
          )}
        </div>

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Recent</div>
          {recentVisitors.length ? recentVisitors.map((visitor) => (
            <div key={visitor.id} className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{visitor.visitorName}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">Checked out</span>
              </div>
              <div className="mt-1 text-slate-500">{visitor.purpose} · {visitor.passId}</div>
              <div className="mt-1 text-xs text-slate-400">
                {visitor.checkOutAt ? new Date(visitor.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm text-slate-500">Recent check-outs will appear here.</div>
          )}
        </div>
      </div>
    </div>
  );
}
