"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

type Item = { href: string; label: string; icon: React.ReactNode; badge?: number };
type Group = { title: string; items: Item[] };

/** `needsYou`: open requests across all Runs, shown beside Needs you (spec M3 §3). */
export function SideNav({ needsYou }: { needsYou: number }) {
  const path = usePathname();
  const groups: Group[] = [
    {
      title: "Work",
      items: [
        { href: "/tickets", label: "Tickets", icon: Icon.tickets },
        { href: "/runs", label: "Runs", icon: Icon.runs },
        { href: "/pull-requests", label: "Pull requests", icon: Icon.pullRequests },
        { href: "/needs-you", label: "Needs you", icon: Icon.needs, badge: needsYou },
      ],
    },
    {
      title: "Setup",
      items: [
        { href: "/flows", label: "Flows", icon: Icon.flows },
        { href: "/machines", label: "Machines", icon: Icon.host },
        { href: "/projects", label: "Projects", icon: Icon.projects },
        { href: "/members", label: "Members", icon: Icon.allowlist },
      ],
    },
    { title: "Insight", items: [{ href: "/audit", label: "Audit log", icon: Icon.audit }] },
  ];

  return (
    <nav className="nav" aria-label="Main">
      {groups.map((group) => (
        <div key={group.title} className="nav-group" role="group" aria-label={group.title}>
          <div className="nav-group-title" aria-hidden="true">
            {group.title}
          </div>
          {group.items.map((item) => (
            <Link key={item.href} href={item.href} className={path.startsWith(item.href) ? "on" : ""} aria-current={path.startsWith(item.href) ? "page" : undefined}>
              {item.icon}
              <span className="lbl">{item.label}</span>
              {item.badge ? (
                <span className="badge" aria-label={`${item.badge} waiting`}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
