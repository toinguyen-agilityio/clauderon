/** A list's chosen order: a column and a direction, both read from the URL. */
export type SortDir = "asc" | "desc";
export type Sort = { by: string; dir: SortDir };

/**
 * The sort from a URL (`sort` and `dir`). An unknown column or direction gives
 * undefined, which means the list's default order.
 */
export function parseSort(params: { sort?: string; dir?: string }, columns: readonly string[]): Sort | undefined {
  const { sort, dir } = params;
  if (!sort || !columns.includes(sort)) return undefined;
  if (dir !== "asc" && dir !== "desc") return undefined;
  return { by: sort, dir };
}

/** What a click on a column header asks for: the other direction on the active column, else `first` (ascending by default). */
export function nextSort(current: Sort | undefined, column: string, first: SortDir = "asc"): Sort {
  if (current?.by !== column) return { by: column, dir: first };
  return { by: column, dir: current.dir === "asc" ? "desc" : "asc" };
}

type Key = string | number | Date | boolean | null | undefined;

const compare = (a: NonNullable<Key>, b: NonNullable<Key>) => {
  const x = a instanceof Date ? a.getTime() : typeof a === "boolean" ? Number(a) : a;
  const y = b instanceof Date ? b.getTime() : typeof b === "boolean" ? Number(b) : b;
  return typeof x === "string" && typeof y === "string" ? x.localeCompare(y, undefined, { sensitivity: "base", numeric: true }) : (x as number) - (y as number);
};

/**
 * The rows in the chosen order, a new array; without a sort, the rows as given
 * (the list's default order). Rows with no value go last in either direction,
 * and rows that tie keep their order. Apply before paging.
 */
export function sortRows<T>(rows: readonly T[], sort: Sort | undefined, keys: Record<string, (row: T) => Key>): T[] {
  const key = sort && keys[sort.by];
  if (!sort || !key) return [...rows];
  const sign = sort.dir === "asc" ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i, k: key(row) }))
    .sort((a, b) => {
      const none = Number(a.k == null) - Number(b.k == null);
      if (none !== 0) return none;
      if (a.k == null || b.k == null) return a.i - b.i;
      return sign * compare(a.k, b.k) || a.i - b.i;
    })
    .map((e) => e.row);
}
