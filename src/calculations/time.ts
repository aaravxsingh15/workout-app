/** "1h 12m", "45m", "38s". Used for workout durations. */
export function formatDurationShort(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** Stopwatch clock: "07:05" or "1:02:03". */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0
    ? `${h}:${mm}:${String(sec).padStart(2, '0')}`
    : `${mm.padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Parses user duration input. "90" -> 90s, "1:30" -> 90s, "1:02:03" -> 3723s.
 * Returns null for empty/invalid input.
 */
export function parseDurationInput(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (t.includes(':')) {
    const parts = t.split(':').map((p) => Number(p));
    if (parts.some((p) => Number.isNaN(p) || p < 0)) return null;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  const n = Number(t);
  return Number.isNaN(n) || n < 0 ? null : Math.round(n);
}

/** Elapsed seconds between two ISO timestamps; open-ended workouts use `now`. */
export function workoutDurationSec(startedAt: string, endedAt: string | null, now: number = Date.now()): number {
  const start = Date.parse(startedAt);
  const end = endedAt ? Date.parse(endedAt) : now;
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function toLocalDateKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const monthName = (i: number) => MONTHS[i] ?? '';
export const dayName = (i: number) => DAYS[i] ?? '';

export function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]?.slice(0, 3)}, ${MONTHS[d.getMonth()]?.slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]?.slice(0, 3)} ${d.getDate()}`;
}

export function formatTimeOfDay(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

export function startOfWeek(d: Date): Date {
  // Monday-based weeks.
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - diff);
  return r;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
