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
};

export const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
    <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
  </svg>
);
