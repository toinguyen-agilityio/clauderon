// "Tidy up" for the Flow canvas: lays the Nodes out left to right in columns, one
// column per step of the longest path that reaches them. Pure, so it is unit-tested.

export type LayoutNode = { id: string; x: number; y: number; w: number; h: number };
export type LayoutEdge = { from: string; to: string };

export const LAYOUT_GAP_X = 96;
export const LAYOUT_GAP_Y = 40;

/**
 * New top-left positions for every Node. Each column is centred on the same line, keeps
 * the Nodes in their current top-to-bottom order, and the whole layout starts where
 * the current one does, so tidying does not throw the view somewhere else. Edges in a
 * cycle are ignored (a cycle is already a problem the editor reports).
 */
export function layeredLayout(nodes: readonly LayoutNode[], edges: readonly LayoutEdge[]): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return result;
  const ids = new Set(nodes.map((n) => n.id));
  const incoming = new Map(nodes.map((n) => [n.id, [] as string[]]));
  for (const e of edges) if (ids.has(e.from) && ids.has(e.to) && e.from !== e.to) incoming.get(e.to)!.push(e.from);

  // Column = length of the longest path from a Node with no incoming edges.
  const column = new Map<string, number>();
  const visiting = new Set<string>();
  const columnOf = (id: string): number => {
    const known = column.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const c = Math.max(-1, ...incoming.get(id)!.map(columnOf)) + 1;
    visiting.delete(id);
    column.set(id, c);
    return c;
  };
  for (const n of nodes) columnOf(n.id);

  const columns: LayoutNode[][] = [];
  for (const n of nodes) (columns[column.get(n.id)!] ??= []).push(n);

  const left = Math.min(...nodes.map((n) => n.x));
  const top = Math.min(...nodes.map((n) => n.y));
  const heightOf = (col: LayoutNode[]) => col.reduce((s, n) => s + n.h, 0) + LAYOUT_GAP_Y * (col.length - 1);
  const tallest = Math.max(...columns.map((c) => (c ? heightOf(c) : 0)));
  const middle = top + tallest / 2;

  let x = left;
  for (const col of columns) {
    if (!col) continue;
    col.sort((a, b) => a.y - b.y || a.x - b.x);
    let y = middle - heightOf(col) / 2;
    for (const n of col) {
      result.set(n.id, { x: Math.round(x), y: Math.round(y) });
      y += n.h + LAYOUT_GAP_Y;
    }
    x += Math.max(...col.map((n) => n.w)) + LAYOUT_GAP_X;
  }
  return result;
}
