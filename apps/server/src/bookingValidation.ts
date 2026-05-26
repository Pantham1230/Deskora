const MIN_MEETING_MS = 30 * 60 * 1000;
const MAX_MEETING_MS = 24 * 60 * 60 * 1000;

export function validateMeetingTimeRange(startAt: string, endAt: string, now = new Date()) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid date or time.');
  }
  if (start.getTime() < now.getTime()) {
    throw new Error('Cannot book a time in the past.');
  }
  if (end.getTime() <= start.getTime()) {
    throw new Error('End time must be after start time.');
  }
  const durationMs = end.getTime() - start.getTime();
  if (durationMs < MIN_MEETING_MS) {
    throw new Error('Minimum booking duration is 30 minutes.');
  }
  if (durationMs > MAX_MEETING_MS) {
    throw new Error('Maximum booking duration is 24 hours.');
  }
  return { start, end, durationMs };
}

export function hasTimeOverlap(
  bookings: Array<{ startAt: string; endAt: string; status: string }>,
  startAt: string,
  endAt: string
) {
  return bookings.some(
    (booking) =>
      booking.status !== 'cancelled' &&
      booking.startAt < endAt &&
      startAt < booking.endAt
  );
}
