"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

type Item = { href: string; label: string; icon: React.ReactNode; arrives?: string; badge?: number };

// The prototype's six modules. Those not built yet stay visible but inert, so
// the shell does not shift as milestones land.
const MODULES: Item[] = [
  { href: "/tickets", label: "Tickets", icon: Icon.tickets },
  { href: "/runs", label: "Runs", icon: Icon.runs },
  { href: "/needs-you", label: "Needs you", icon: Icon.needs },
  { href: "/flows", label: "Flows", icon: Icon.flows },
  { href: "/pods", label: "Pods", icon: Icon.pods },
  { href: "/projects", label: "Projects", icon: Icon.projects },
  { href: "/audit", label: "Audit log", icon: Icon.audit },
];

/** `needsYou`: open requests across all Runs, shown beside Needs you (spec M3 §3). */
export function SideNav({ operator, needsYou }: { operator: boolean; needsYou: number }) {
  const path = usePathname();
  const link = (item: Item) =>
    item.arrives ? (
      <span key={item.href} className="soon" title={`Arrives in ${item.arrives}`} aria-disabled="true">
        {item.icon}
        <span className="lbl">{item.label}</span>
      </span>
    ) : (
      <Link key={item.href} href={item.href} className={path.startsWith(item.href) ? "on" : ""}>
        {item.icon}
        <span className="lbl">{item.label}</span>
        {item.badge ? (
          <span className="badge" aria-label={`${item.badge} waiting`}>
            {item.badge}
          </span>
        ) : null}
      </Link>
    );

  return (
    <nav className="nav" aria-label="Main">
      {MODULES.map((item) => link(item.href === "/needs-you" ? { ...item, badge: needsYou } : item))}
      {operator && (
        <>
          <div className="nav-sep" />
          {link({ href: "/allowlist", label: "Allowlist", icon: Icon.allowlist })}
        </>
      )}
    </nav>
  );
}
