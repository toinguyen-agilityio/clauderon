"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

type Item = { href: string; label: string; icon: React.ReactNode; arrives?: string };

// The prototype's six modules. Those not built yet stay visible but inert, so
// the shell does not shift as milestones land.
const MODULES: Item[] = [
  { href: "/tickets", label: "Tickets", icon: Icon.tickets },
  { href: "/runs", label: "Runs", icon: Icon.runs },
  { href: "/needs-you", label: "Needs you", icon: Icon.needs, arrives: "M3" },
  { href: "/flows", label: "Flows", icon: Icon.flows, arrives: "M2" },
  { href: "/pods", label: "Pods", icon: Icon.pods },
  { href: "/projects", label: "Projects", icon: Icon.projects },
];

export function SideNav({ operator }: { operator: boolean }) {
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
      </Link>
    );

  return (
    <nav className="nav" aria-label="Main">
      {MODULES.map(link)}
      {operator && (
        <>
          <div className="nav-sep" />
          {link({ href: "/allowlist", label: "Allowlist", icon: Icon.allowlist })}
        </>
      )}
    </nav>
  );
}
