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
  const column = layerOf(
    nodes.map((n) => n.id),
    edges,
  );

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

/**
 * The step of each Node: the length of the longest path that reaches it from a Node
 * with no incoming edges. Nodes on the same step can run side by side. Edges in a cycle
 * are ignored, as in the layout.
 */
export function layerOf(ids: readonly string[], edges: readonly LayoutEdge[]): Map<string, number> {
  const known = new Set(ids);
  const incoming = new Map(ids.map((id) => [id, [] as string[]]));
  for (const e of edges) if (known.has(e.from) && known.has(e.to) && e.from !== e.to) incoming.get(e.to)!.push(e.from);
  const column = new Map<string, number>();
  const visiting = new Set<string>();
  const columnOf = (id: string): number => {
    const seen = column.get(id);
    if (seen !== undefined) return seen;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const c = Math.max(-1, ...incoming.get(id)!.map(columnOf)) + 1;
    visiting.delete(id);
    column.set(id, c);
    return c;
  };
  for (const id of ids) columnOf(id);
  return column;
}

/**
 * Whether most edges run backwards (into a Node that is not to the right of where they
 * start), so wires loop around the cards and Tidy up would help. Outputs sit on a Node's
 * right side and inputs on its left, so a forward edge goes to a Node further right.
 */
export function wiresMostlyBackward(nodes: readonly Pick<LayoutNode, "id" | "x">[], edges: readonly LayoutEdge[]): boolean {
  const x = new Map(nodes.map((n) => [n.id, n.x]));
  const counted = edges.filter((e) => x.has(e.from) && x.has(e.to) && e.from !== e.to);
  if (counted.length < 2) return false;
  const backward = counted.filter((e) => x.get(e.to)! <= x.get(e.from)!).length;
  return backward * 2 > counted.length;
}
