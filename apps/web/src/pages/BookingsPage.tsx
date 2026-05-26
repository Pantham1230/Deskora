import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { bookMeetingRoom, bookSeat, cancelSeat, listBranches, listMeetingRooms, listMyBookings, listSeats } from '../api';
import { useToast } from '../components/Toast';
import { defaultMeetingWindow, validateMeetingTimeRange } from '../lib/booking';
import type { Booking, Branch, MeetingRoom, Seat } from '../types';
import { useAuthStore } from '../store/auth';

function getRealtimeSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL as string;
  if (window.location.port === '5173') return 'http://localhost:4000';
  return window.location.origin;
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-soft">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{title}</div>
        <div className="mt-2 text-sm text-slate-500">{description}</div>
      </div>
      {children}
    </div>
  );
}

export function BookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'rooms' ? 'rooms' : 'desks';
  const { user, claims, token } = useAuthStore();
  const toast = useToast();
  const isClient = claims?.role === 'client';
  const customerName = user?.name ?? 'Deskora member';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState(searchParams.get('branchId') ?? '');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const meetingDefaults = defaultMeetingWindow();
  const [startAt, setStartAt] = useState(meetingDefaults.startAt);
  const [endAt, setEndAt] = useState(meetingDefaults.endAt);

  const refresh = async (selectedBranchId?: string) => {
    const branchData = await listBranches();
    setBranches(branchData);
    const preferred = selectedBranchId ?? searchParams.get('branchId') ?? branchId ?? branchData[0]?.id ?? '';
    const active = branchData.some((branch) => branch.id === preferred) ? preferred : branchData[0]?.id ?? '';
    setBranchId(active);
    if (active) {
      const [seatData, roomData] = await Promise.all([listSeats(active), listMeetingRooms(active)]);
      setSeats(seatData);
      setRooms(roomData);
    }
    if (isClient) {
      setBookings((await listMyBookings()).filter((booking) => booking.status === 'booked'));
    }
  };

  useEffect(() => {
    void refresh();
  }, [searchParams]);

  useEffect(() => {
    if (!token || !branchId) return;
    const socket: Socket = io(getRealtimeSocketUrl(), { auth: { token } });
    socket.on('seat:updated', (updatedSeat: Seat) => {
      if (updatedSeat.branchId === branchId) {
        setSeats((current) => current.map((seat) => (seat.id === updatedSeat.id ? updatedSeat : seat)));
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [branchId, token]);

  const selectedBranch = branches.find((branch) => branch.id === branchId);

  const handleBookSeat = async (seat: Seat) => {
    try {
      const booked = await bookSeat(seat.id, customerName);
      setSeats((current) => current.map((item) => (item.id === booked.id ? booked : item)));
      toast.success('Booking confirmed', `${booked.label} reserved. Invoice and payment record created.`);
      if (isClient) void refresh(branchId);
    } catch (error) {
      toast.error('Booking failed', error instanceof Error ? error.message : 'Unable to book seat.');
    }
  };

  const handleCancelSeat = async (seat: Seat) => {
    try {
      await cancelSeat(seat.id);
      await refresh(branchId);
      toast.success('Booking cancelled', `${seat.label} is available again.`);
    } catch (error) {
      toast.error('Cancel failed', error instanceof Error ? error.message : 'Unable to cancel booking.');
    }
  };

  const handleBookRoom = async (roomId: string, roomName: string) => {
    try {
      validateMeetingTimeRange(startAt, endAt);
      await bookMeetingRoom(roomId, customerName, new Date(startAt).toISOString(), new Date(endAt).toISOString());
      toast.success('Meeting room booked', `${roomName} reserved. Invoice generated.`);
      if (isClient) void refresh(branchId);
    } catch (error) {
      toast.error('Booking failed', error instanceof Error ? error.message : 'Unable to book room.');
    }
  };

  const activeBookings = useMemo(() => bookings.slice(0, 6), [bookings]);

  return (
    <Section title="Bookings" description={isClient ? 'Book desks and meeting rooms at any branch. Your account works across every workspace on Deskora.' : 'Manage seat and meeting room reservations across all branches.'}>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSearchParams({ tab: 'desks', branchId })} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === 'desks' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Desks</button>
        <button onClick={() => setSearchParams({ tab: 'rooms', branchId })} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === 'rooms' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Meeting Rooms</button>
      </div>

      <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">Branch</label>
        <select value={branchId} onChange={(event) => {
          const value = event.target.value;
          setBranchId(value);
          setSearchParams({ tab, branchId: value });
          void refresh(value);
        }} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} · {branch.city}</option>)}
        </select>
        <div className="mt-2 text-xs text-slate-500">{selectedBranch?.address ?? 'Select a branch to view availability.'}</div>
      </div>

      {tab === 'desks' ? (
        <div className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">Available</span>
              <span className="rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-700">Occupied</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">Reserved</span>
            </div>
            <div className="grid grid-cols-4 gap-3 md:grid-cols-6 lg:grid-cols-8">
              {seats.map((seat) => {
                const mine = Boolean(seat.bookedByCurrentUser);
                const occupied = seat.status === 'booked' || seat.status === 'reserved';
                return (
                  <div key={seat.id} className="space-y-2">
                    <div className={`flex h-12 items-center justify-center rounded-xl border text-xs font-semibold ${seat.status === 'available' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : seat.status === 'reserved' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{seat.label}</div>
                    {seat.status === 'available' ? (
                      <button onClick={() => void handleBookSeat(seat)} className="w-full rounded-lg bg-slate-900 py-1.5 text-[10px] font-semibold text-white">Book Seat</button>
                    ) : mine && seat.canCancel ? (
                      <button onClick={() => void handleCancelSeat(seat)} className="w-full rounded-lg border border-rose-200 py-1.5 text-[10px] font-semibold text-rose-700">Cancel</button>
                    ) : occupied ? (
                      <div className="rounded-lg bg-slate-100 py-1.5 text-center text-[10px] font-semibold text-slate-500">{seat.status === 'reserved' ? 'Reserved' : 'Occupied'}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">Floor snapshot</div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-400">Available</div><div className="font-semibold">{seats.filter((s) => s.status === 'available').length}</div></div>
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-400">Booked</div><div className="font-semibold">{seats.filter((s) => s.status === 'booked').length}</div></div>
              <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-400">Reserved</div><div className="font-semibold">{seats.filter((s) => s.status === 'reserved').length}</div></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm md:grid-cols-2">
            <label className="block text-sm text-slate-600">Start<input type="datetime-local" value={startAt} min={defaultMeetingWindow().startAt} onChange={(event) => setStartAt(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" /></label>
            <label className="block text-sm text-slate-600">End<input type="datetime-local" value={endAt} min={startAt} onChange={(event) => setEndAt(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" /></label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {rooms.map((room) => (
              <div key={room.id} className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="text-lg font-semibold text-slate-900">{room.name}</div>
                <div className="mt-1 text-sm text-slate-500">Capacity {room.capacity} · ₹{room.hourlyRate}/hr</div>
                <button onClick={() => void handleBookRoom(room.id, room.name)} className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Book room</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isClient && activeBookings.length ? (
        <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="text-sm uppercase tracking-[0.28em] text-slate-400">Your active bookings</div>
          <div className="mt-4 space-y-2">
            {activeBookings.map((booking) => (
              <div key={booking.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {booking.resourceType === 'seat' ? 'Desk' : 'Meeting room'} · {new Date(booking.startAt).toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Section>
  );
}
