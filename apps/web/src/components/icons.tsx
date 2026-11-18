// Icons of the prototype's left rail and actions (16×16 strokes).
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5 } as const;

export const Icon = {
  tickets: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    </svg>
  ),
  runs: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <path d="M3 3l8 5-8 5z" />
      <path d="M13 3v10" />
    </svg>
  ),
  needs: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 14c.7-2.6 2.6-4 5-4s4.3 1.4 5 4" />
    </svg>
  ),
  flows: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <rect x="1.5" y="2" width="5" height="4" rx="1" />
      <rect x="9.5" y="10" width="5" height="4" rx="1" />
      <path d="M6.5 4h3a2 2 0 012 2v4" />
    </svg>
  ),
  pods: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <rect x="2" y="2.5" width="12" height="4.5" rx="1" />
      <rect x="2" y="9" width="12" height="4.5" rx="1" />
      <path d="M4.5 4.75h.01M4.5 11.25h.01" strokeWidth="2" />
    </svg>
  ),
  projects: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <path d="M2 4.5h4l1.5 1.5H14v6.5H2z" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <rect x="3" y="1.5" width="10" height="13" rx="1.5" />
      <path d="M5.5 5h5M5.5 8h5M5.5 11h3" />
    </svg>
  ),
  pullRequests: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <circle cx="4" cy="3.5" r="1.5" />
      <circle cx="4" cy="12.5" r="1.5" />
      <circle cx="12" cy="12.5" r="1.5" />
      <path d="M4 5v6M12 11V6.5A2 2 0 0010 4.5H7.5M9 3l-1.5 1.5L9 6" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <circle cx="8" cy="8" r="2.75" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" />
    </svg>
  ),
  monitor: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <rect x="1.75" y="2.5" width="12.5" height="8.5" rx="1.25" />
      <path d="M5.5 14h5M8 11v3" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <path d="M13.5 9.5A5.5 5.5 0 016.5 2.5a5.5 5.5 0 107 7z" />
    </svg>
  ),
  signOut: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <path d="M6.5 2.5h-3a1 1 0 00-1 1v9a1 1 0 001 1h3M10.5 11l3-3-3-3M13.5 8H6" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.75 9.5h6.5L12 4M6.75 6.5v4.5M9.25 6.5v4.5" />
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <rect x="5" y="5" width="8.5" height="8.5" rx="1.25" />
      <path d="M11 5V3.25A.75.75 0 0010.25 2.5h-7a.75.75 0 00-.75.75v7c0 .41.34.75.75.75H5" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  ),
  allowlist: (
    <svg viewBox="0 0 16 16" {...stroke}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
    </svg>
  ),
  host: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  ),
  spin: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" className="spin" aria-hidden="true">
      <path d="M8 2a6 6 0 016 6" />
    </svg>
  ),
  play: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4 2.5l9 5.5-9 5.5z" />
    </svg>
  ),
  stop: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
    </svg>
  ),
  sync: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M13 5.5A5.5 5.5 0 003 6M3 10.5a5.5 5.5 0 0010-.5" />
      <path d="M13 2.5v3h-3M3 13.5v-3h3" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 3v10M3 8h10" />
    </svg>
  ),
  terminal: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M4.5 6l2 2-2 2M8.5 10.5h3" />
    </svg>
  ),
  cube: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </svg>
  ),
  external: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M9 2.5h4.5V7M13.5 2.5L7 9M11.5 9.5v4h-9v-9h4" />
    </svg>
  ),
};

export const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
    <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
  </svg>
);
