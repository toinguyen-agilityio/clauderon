"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { nextSort, type SortDir } from "./sorting";

/**
 * A button that sorts the list by one column: the first click sorts by it, the
 * next reverses it. Writes `sort` and `dir` next to the other search params and
 * goes back to page 1.
 */
export function SortButton({ column, label, first = "asc", className }: { column: string; label: string; first?: SortDir; className?: string }) {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const dir = params.get("sort") === column ? params.get("dir") : null;
  const active = dir === "asc" || dir === "desc" ? dir : null;
  const click = () => {
    const next = nextSort(active ? { by: column, dir: active } : undefined, column, first);
    const query = new URLSearchParams(params);
    query.set("sort", next.by);
    query.set("dir", next.dir);
    query.delete("page");
    router.push(`${path}?${query}`);
  };
  const name = active ? `Sort by ${label}, now ${active === "asc" ? "ascending" : "descending"}; press to reverse` : `Sort by ${label}`;
  return (
    <button type="button" className={`sort-btn${active ? " on" : ""}${className ? ` ${className}` : ""}`} onClick={click} aria-label={name}>
      {label}
      <span className="sort-arrow" aria-hidden>
        {active === "asc" ? "▲" : active === "desc" ? "▼" : "↕"}
      </span>
    </button>
  );
}

/** A table header cell with a sort button; `aria-sort` tells screen readers the active column and direction. */
export function SortHeader({ column, label, first, className }: { column: string; label: string; first?: SortDir; className?: string }) {
  const params = useSearchParams();
  const dir = params.get("sort") === column ? params.get("dir") : null;
  const aria = dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none";
  return (
    <th className={className} aria-sort={aria}>
      <SortButton column={column} label={label} first={first} />
    </th>
  );
}
