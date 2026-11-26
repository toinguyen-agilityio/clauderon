"use client";

import Link from "next/link";
import { Icon } from "../../../components/icons";
import { useRouter } from "next/navigation";
import { createContext, use, useState, useTransition, type FormEvent, type ReactNode } from "react";

type Filters = { pending: boolean; target: string | null; go: (href: string) => void };

const FiltersContext = createContext<Filters>({ pending: false, target: null, go: () => {} });

/** Runs filter changes in one transition, so the page can show them loading until the new rows arrive. */
export function TicketFilters({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const go = (href: string) => {
    setTarget(href);
    startTransition(() => router.push(href));
  };
  return <FiltersContext value={{ pending, target, go }}>{children}</FiltersContext>;
}

export function FilterLink({ href, className, current, children }: { href: string; className?: string; current?: boolean; children: ReactNode }) {
  const { pending, target, go } = use(FiltersContext);
  const loading = pending && target === href;
  return (
    <Link
      href={href}
      className={`${className ?? ""}${loading ? " filter-pending" : ""}`}
      aria-busy={loading || undefined}
      aria-current={current || undefined}
      onNavigate={(e) => {
        e.preventDefault();
        go(href);
      }}
    >
      {children}
    </Link>
  );
}

export function TicketSearch({ project, status, size, q }: { project?: string; status?: string; size?: string; q?: string }) {
  const { pending, target, go } = use(FiltersContext);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    const query = new URLSearchParams(Object.entries({ project, status, size, q: value }).filter(([, v]) => v) as [string, string][]);
    const href = `/tickets${query.size ? `?${query}` : ""}`;
    setSubmitted(href);
    go(href);
  };
  return (
    <form
      method="get"
      role="search"
      className="filter-search tk-search"
      aria-busy={(pending && target === submitted) || undefined}
      onSubmit={submit}
    >
      {project && <input type="hidden" name="project" value={project} />}
      {status && <input type="hidden" name="status" value={status} />}
      {size && <input type="hidden" name="size" value={size} />}
      {Icon.search}
      <input className="input" type="search" name="q" defaultValue={q ?? ""} placeholder="Search title or #number" aria-label="Search Tickets" />
    </form>
  );
}

export function FilterResults({ children }: { children: ReactNode }) {
  const { pending } = use(FiltersContext);
  return (
    <div className="filter-results" aria-busy={pending}>
      {children}
    </div>
  );
}
