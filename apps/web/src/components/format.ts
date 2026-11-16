/** "3 min ago" style times, for heartbeats and checks. */
export function ago(date: Date | null, now: Date = new Date()): string {
  if (!date) return "never";
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}

export const formatTime = (date: Date | null) => (date ? date.toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—");

export function duration(ms: number | null): string {
  if (ms === null) return "";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
