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
  if (durationMs < 30 * 60 * 1000) {
    throw new Error('Minimum booking duration is 30 minutes.');
  }
  if (durationMs > 24 * 60 * 60 * 1000) {
    throw new Error('Maximum booking duration is 24 hours.');
  }
}

export function defaultMeetingWindow() {
  const start = new Date();
  start.setMinutes(start.getMinutes() + 60, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    startAt: toLocalInputValue(start),
    endAt: toLocalInputValue(end)
  };
}

export function toLocalInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}
