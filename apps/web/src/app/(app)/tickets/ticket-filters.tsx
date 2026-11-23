"use client";

import Link from "next/link";
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

export function FilterLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const { pending, target, go } = use(FiltersContext);
  const loading = pending && target === href;
  return (
    <Link
      href={href}
      className={`${className ?? ""}${loading ? " filter-pending" : ""}`}
      aria-busy={loading || undefined}
      onNavigate={(e) => {
        e.preventDefault();
        go(href);
      }}
    >
      {children}
    </Link>
  );
}

export function TicketSearch({ project, status, q }: { project?: string; status?: string; q?: string }) {
  const { pending, target, go } = use(FiltersContext);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    const query = new URLSearchParams(Object.entries({ project, status, q: value }).filter(([, v]) => v) as [string, string][]);
    const href = `/tickets${query.size ? `?${query}` : ""}`;
    setSubmitted(href);
    go(href);
  };
  return (
    <form
      method="get"
      role="search"
      className="filter-search"
      style={{ width: "min(320px, 100%)" }}
      aria-busy={(pending && target === submitted) || undefined}
      onSubmit={submit}
    >
      {project && <input type="hidden" name="project" value={project} />}
      {status && <input type="hidden" name="status" value={status} />}
      <input className="input" name="q" defaultValue={q ?? ""} placeholder="Search title or key…" aria-label="Search Tickets" />
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
