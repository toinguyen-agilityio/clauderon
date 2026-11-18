import Link from "next/link";

export type Tab = { href: string; label: string; count?: number; active: boolean };

/** Underlined page tabs; each tab is a link, so the URL keeps the choice. */
export function Tabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  return (
    <nav className="tabs" aria-label={label}>
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={t.active ? "on" : ""} aria-current={t.active ? "page" : undefined}>
          {t.label}
          {t.count !== undefined && <span className="n">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
