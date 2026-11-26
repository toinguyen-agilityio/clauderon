"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "./paging";

/**
 * A list's footer: which rows are shown, a rows-per-page select and previous/next
 * links. Keeps the other search params; a new page size goes back to page 1.
 */
export function Pager({ page, size, total, prev = "Previous", next = "Next" }: { page: number; size: number; total: number; prev?: string; next?: string }) {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const last = Math.max(1, Math.ceil(total / size));
  const href = (change: { page?: number; size?: number }) => {
    const query = new URLSearchParams(params);
    const p = change.page ?? page;
    const s = change.size ?? size;
    if (p > 1) query.set("page", String(p));
    else query.delete("page");
    if (s !== DEFAULT_PAGE_SIZE) query.set("size", String(s));
    else query.delete("size");
    return query.size ? `${path}?${query}` : path;
  };
  if (total === 0) return null;
  const from = Math.min(total, (page - 1) * size + 1);
  const to = Math.min(total, page * size);

  return (
    <div className="pager">
      <span className="faint small pager-range">
        {from}–{to} of {total}
      </span>
      <label className="pager-size small">
        <span className="faint">Rows per page</span>
        <select className="select" value={size} onChange={(e) => router.push(href({ page: 1, size: Number(e.target.value) }))}>
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      {page > 1 ? (
        <Link className="btn sm" href={href({ page: page - 1 })}>
          {prev}
        </Link>
      ) : (
        <span className="btn sm" aria-disabled>
          {prev}
        </span>
      )}
      <span className="faint small nowrap">
        Page {page} of {last}
      </span>
      {page < last ? (
        <Link className="btn sm" href={href({ page: page + 1 })}>
          {next}
        </Link>
      ) : (
        <span className="btn sm" aria-disabled>
          {next}
        </span>
      )}
    </div>
  );
}
