"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { useNeedsYou } from "./needs-you-live";
import { HelpIcon, TakeTourButton } from "./tour/help-icon";
import type { Area } from "./tour/steps";

type Item = { href: string; label: string; icon: React.ReactNode; area: Area; badge?: number };
type Group = { title: string; items: Item[] };

/** `needsYou`: open requests across all Runs, shown beside Needs you (spec M3 §3). */
export function SideNav({ needsYou: initial }: { needsYou: number }) {
  const needsYou = useNeedsYou(initial);
  const path = usePathname();
  const groups: Group[] = [
    {
      title: "Work",
      items: [
        { href: "/tickets", area: "tickets", label: "Tickets", icon: Icon.tickets },
        { href: "/runs", area: "runs", label: "Runs", icon: Icon.runs },
        { href: "/pull-requests", area: "pullRequests", label: "Pull requests", icon: Icon.pullRequests },
        { href: "/needs-you", area: "needsYou", label: "Needs you", icon: Icon.needs, badge: needsYou },
      ],
    },
    {
      title: "Setup",
      items: [
        { href: "/flows", area: "flows", label: "Flows", icon: Icon.flows },
        { href: "/machines", area: "machines", label: "Machines", icon: Icon.host },
        { href: "/projects", area: "projects", label: "Project Settings", icon: Icon.projects },
        { href: "/members", area: "members", label: "Members", icon: Icon.allowlist },
      ],
    },
    { title: "Insight", items: [{ href: "/audit", area: "audit", label: "Audit log", icon: Icon.audit }] },
  ];

  return (
    <nav className="nav" aria-label="Main">
      {groups.map((group) => (
        <div key={group.title} className="nav-group" role="group" aria-label={group.title}>
          <div className="nav-group-title" aria-hidden="true">
            {group.title}
          </div>
          {group.items.map((item) => (
            <div key={item.href} className="nav-row">
              <Link href={item.href} title={item.label} data-tour-nav={item.area} className={path.startsWith(item.href) ? "on" : ""} aria-current={path.startsWith(item.href) ? "page" : undefined}>
                {item.icon}
                <span className="lbl">{item.label}</span>
                {item.badge ? (
                  <span className="badge" aria-label={`${item.badge} waiting`}>
                    {item.badge}
                  </span>
                ) : null}
              </Link>
              <HelpIcon area={item.area} />
            </div>
          ))}
        </div>
      ))}
      <TakeTourButton />
    </nav>
  );
}
