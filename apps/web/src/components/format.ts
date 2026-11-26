/** "3 min ago" style times, for heartbeats and checks. */
export function ago(date: Date | null, now: Date = new Date()): string {
  if (!date) return "never";
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}

/** One fixed zone for every Member, so server and browser renders match whatever their own zone is. */
export const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const APP_TIME_ZONE_LABEL = "GMT+7";

const timeParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "2026-11-26 09:15 (GMT+7)": an absolute time in the app's zone. */
export function formatTime(date: Date | null): string {
  if (!date) return "—";
  const part = Object.fromEntries(timeParts.formatToParts(date).map((p) => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day} ${part.hour}:${part.minute} (${APP_TIME_ZONE_LABEL})`;
}

export function duration(ms: number | null): string {
  if (ms === null) return "";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

/** 18234 → "18.2k" tokens. */
export function tokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
