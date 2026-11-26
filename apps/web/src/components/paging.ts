/** Rows per page a list offers, and the one used when the URL names none. */
export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

export type Paging = { page: number; size: number };

/** Page and page size from a URL, falling back to page 1 and the default size. */
export function parsePaging(params: { page?: string; size?: string }): Paging {
  const size = Number(params.size);
  return {
    page: Math.max(1, Math.floor(Number(params.page)) || 1),
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

/** One page of an in-memory list, with the page clamped to the last one. */
export function pageOf<T>(all: T[], { page, size }: Paging) {
  const last = Math.max(1, Math.ceil(all.length / size));
  const current = Math.min(page, last);
  const start = (current - 1) * size;
  return { rows: all.slice(start, start + size), page: current, total: all.length };
}
