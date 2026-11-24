// Icons of the Flow editor's toolbars and Nodes (16×16 strokes, like components/icons.tsx).
import type { ReactNode } from "react";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const svg = (children: ReactNode) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" {...stroke}>
    {children}
  </svg>
);

export const FIcon = {
  back: svg(<path d="M13 8H3M7 4L3 8l4 4" />),
  flow: svg(
    <>
      <rect x="1.5" y="2" width="5" height="4" rx="1" />
      <rect x="9.5" y="10" width="5" height="4" rx="1" />
      <path d="M6.5 4h3a2 2 0 012 2v4" />
    </>,
  ),
  plus: svg(<path d="M8 3v10M3 8h10" />),
  minus: svg(<path d="M3 8h10" />),
  tidy: svg(
    <>
      <rect x="1.5" y="2" width="4" height="4" rx="1" />
      <rect x="1.5" y="10" width="4" height="4" rx="1" />
      <rect x="10.5" y="6" width="4" height="4" rx="1" />
      <path d="M5.5 4h2v8h-2M7.5 8h3" />
    </>,
  ),
  undo: svg(<path d="M5.5 3.5L2.5 6.5l3 3M2.5 6.5H10a3.5 3.5 0 010 7H7" />),
  redo: svg(<path d="M10.5 3.5l3 3-3 3M13.5 6.5H6a3.5 3.5 0 000 7h3" />),
  play: svg(<path d="M4.5 3l8 5-8 5z" />),
  stop: svg(<rect x="4" y="4" width="8" height="8" rx="1.5" />),
  rename: svg(<path d="M10.5 2.5l3 3L6 13H3v-3zM9 4l3 3" />),
  info: svg(
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.25V11M8 5v.01" />
    </>,
  ),
  copy: svg(
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V3.5a1 1 0 00-1-1h-6a1 1 0 00-1 1v6a1 1 0 001 1h2" />
    </>,
  ),
  trash: svg(<path d="M2.5 4.5h11M6.5 4.5V3h3v1.5M4 4.5l.75 9h6.5l.75-9M6.75 7v4M9.25 7v4" />),
  close: svg(<path d="M4 4l8 8M12 4l-8 8" />),
  fit: svg(<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />),
  keyboard: svg(
    <>
      <rect x="1.5" y="4" width="13" height="8" rx="1.5" />
      <path d="M4 6.5h.01M6.5 6.5h.01M9 6.5h.01M11.5 6.5h.01M5 9.5h6" />
    </>,
  ),
  search: svg(
    <>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.25 10.25L13.5 13.5" />
    </>,
  ),
  check: svg(<path d="M3 8.5l3 3 7-7" />),
  alert: svg(
    <>
      <path d="M8 2l6.5 11.5h-13z" />
      <path d="M8 6.5v3M8 11.5v.01" />
    </>,
  ),
  pause: svg(<path d="M6 4v8M10 4v8" />),
  save: svg(<path d="M3 2.5h8l2.5 2.5v8.5h-10.5zM5.5 2.5v3.5h4.5V2.5M5 13.5V9.5h6v4" />),
  // Node kinds
  ticket: svg(
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    </>,
  ),
  agent: svg(<path d="M8 1.75l1.4 3.6 3.6 1.4-3.6 1.4L8 11.75l-1.4-3.6-3.6-1.4 3.6-1.4zM12.5 10.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />),
  command: svg(
    <>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M4.5 6.5l2 1.5-2 1.5M8.5 10h3" />
    </>,
  ),
  approve: svg(<path d="M8 1.75l5 2v4c0 3-2.2 5.1-5 6.5-2.8-1.4-5-3.5-5-6.5v-4zM5.75 8l1.6 1.6 3-3.2" />),
  grill: svg(<path d="M2.5 3.5h11v7.5H7l-3 2.5V11H2.5zM6.5 6a1.5 1.5 0 113 0c0 1-1.5 1.25-1.5 2.25M8 9.75v.01" />),
};

export const kindIcon = (kind: string) => FIcon[(kind === "input" ? "ticket" : kind) as keyof typeof FIcon] ?? FIcon.agent;
