import { describe, expect, it } from "vitest";
import { pageOf, parsePaging } from "../src/components/paging";
import { nextSort, parseSort, sortRows } from "../src/components/sorting";
import { MEMBER_SORTS, memberSortKeys, type MemberRow } from "../src/server/members";

const COLUMNS = ["title", "n"] as const;

describe("parseSort", () => {
  it("reads a known column and direction", () => {
    expect(parseSort({ sort: "title", dir: "desc" }, COLUMNS)).toEqual({ by: "title", dir: "desc" });
  });
  it("falls back to the default order for an unknown column, a bad direction or none", () => {
    expect(parseSort({ sort: "nope", dir: "asc" }, COLUMNS)).toBeUndefined();
    expect(parseSort({ sort: "title", dir: "sideways" }, COLUMNS)).toBeUndefined();
    expect(parseSort({ sort: "title" }, COLUMNS)).toBeUndefined();
    expect(parseSort({}, COLUMNS)).toBeUndefined();
  });
});

describe("nextSort", () => {
  it("starts ascending, or in the given first direction, then reverses", () => {
    expect(nextSort(undefined, "n")).toEqual({ by: "n", dir: "asc" });
    expect(nextSort(undefined, "n", "desc")).toEqual({ by: "n", dir: "desc" });
    expect(nextSort({ by: "n", dir: "asc" }, "n")).toEqual({ by: "n", dir: "desc" });
    expect(nextSort({ by: "n", dir: "desc" }, "n")).toEqual({ by: "n", dir: "asc" });
    expect(nextSort({ by: "n", dir: "desc" }, "title")).toEqual({ by: "title", dir: "asc" });
  });
});

type Row = { title: string | null; n: number };
const keys = { title: (r: Row) => r.title, n: (r: Row) => r.n };
const rows: Row[] = [
  { title: "b", n: 10 },
  { title: null, n: 2 },
  { title: "A", n: 3 },
  { title: "c", n: 1 },
];

describe("sortRows", () => {
  it("keeps the given order without a sort or for an unknown column", () => {
    expect(sortRows(rows, undefined, keys)).toEqual(rows);
    expect(sortRows(rows, { by: "zzz", dir: "asc" }, keys)).toEqual(rows);
  });
  it("sorts numbers numerically and text without case, and reverses", () => {
    expect(sortRows(rows, { by: "n", dir: "asc" }, keys).map((r) => r.n)).toEqual([1, 2, 3, 10]);
    expect(sortRows(rows, { by: "n", dir: "desc" }, keys).map((r) => r.n)).toEqual([10, 3, 2, 1]);
    expect(sortRows(rows, { by: "title", dir: "asc" }, keys).map((r) => r.title)).toEqual(["A", "b", "c", null]);
  });
  it("puts empty values last in either direction", () => {
    expect(sortRows(rows, { by: "title", dir: "desc" }, keys).map((r) => r.title)).toEqual(["c", "b", "A", null]);
  });
  it("does not change the input", () => {
    const copy = [...rows];
    sortRows(rows, { by: "n", dir: "asc" }, keys);
    expect(rows).toEqual(copy);
  });
  it("orders the whole list before paging", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ title: `t${i}`, n: i }));
    const sorted = sortRows(many, { by: "n", dir: "desc" }, keys);
    expect(pageOf(sorted, parsePaging({ size: "10" })).rows.map((r) => r.n)).toEqual([29, 28, 27, 26, 25, 24, 23, 22, 21, 20]);
    expect(pageOf(sorted, { page: 3, size: 10 }).rows[0]!.n).toBe(9);
  });
});

describe("Members sort keys", () => {
  const member = (email: string, over: Partial<MemberRow> = {}): MemberRow => ({
    email, name: null, pictureUrl: null, operator: false, status: "active", lastSignInAt: null, machine: null, ...over,
  });
  it("sorts by name or email, status and last sign-in", () => {
    const list = [member("z@x.io", { name: "Ann" }), member("b@x.io", { status: "invited" }), member("c@x.io", { lastSignInAt: new Date(5) })];
    expect(MEMBER_SORTS).toContain("signin");
    expect(sortRows(list, { by: "member", dir: "asc" }, memberSortKeys).map((m) => m.email)).toEqual(["z@x.io", "b@x.io", "c@x.io"]);
    expect(sortRows(list, { by: "status", dir: "desc" }, memberSortKeys)[0]!.status).toBe("invited");
    expect(sortRows(list, { by: "signin", dir: "asc" }, memberSortKeys)[0]!.email).toBe("c@x.io");
  });
});
