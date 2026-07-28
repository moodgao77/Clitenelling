// Day boundaries in Dubai time (UTC+4, no DST) so "today" means the
// associate's local day, not the server's UTC day.
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

export function dubaiDayBounds() {
  const now = Date.now();
  const dubaiNow = new Date(now + DUBAI_OFFSET_MS);
  const y = dubaiNow.getUTCFullYear();
  const m = dubaiNow.getUTCMonth();
  const d = dubaiNow.getUTCDate();
  const startUTC = Date.UTC(y, m, d, 0, 0, 0) - DUBAI_OFFSET_MS;
  const endUTC = startUTC + 24 * 60 * 60 * 1000;
  return {
    startISO: new Date(startUTC).toISOString(),
    endISO: new Date(endUTC).toISOString(),
    todayLabel: dubaiNow.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }),
  };
}

/** Time-of-day label for a reminder, in Dubai time. */
export function dueTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
  });
}

export function overdueDays(iso: string) {
  const { startISO } = dubaiDayBounds();
  const diff = new Date(startISO).getTime() - new Date(iso).getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}
