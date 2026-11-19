"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { LibraryNode } from "@clauderon/core";
import { outputColor } from "../../../../components/state-pill";
import { FIcon, kindIcon } from "./flow-icons";
import { KIND_LABEL } from "./flow-node";

export const NODE_DRAG_TYPE = "application/clauderon-node";

/**
 * The Node library as a popover over the canvas: search, then drag a Node onto the
 * canvas or pick it (click, or arrows and Enter). When it was opened from a Node's "+"
 * button, Nodes that would connect to that Node come first.
 */
export function NodeLibrary({
  library,
  title,
  connects,
  onPick,
  onClose,
}: {
  library: readonly LibraryNode[];
  title: string;
  /** For a "+" button: whether a library Node would connect to the Node it was opened from. */
  connects?: (lib: LibraryNode) => boolean;
  onPick: (lib: LibraryNode) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => search.current?.focus(), []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = library.filter((n) => !q || n.name.toLowerCase().includes(q) || n.kind.includes(q) || [...n.inputs, ...n.outputs].some((p) => p.type.includes(q)));
    const out: { label: string; items: LibraryNode[] }[] = [];
    if (connects) {
      const yes = hit.filter(connects);
      if (yes.length > 0) out.push({ label: "Connects here", items: yes });
      const no = hit.filter((n) => !connects(n));
      if (no.length > 0) out.push({ label: "Other Nodes", items: no });
      return out;
    }
    for (const n of hit) {
      const label = KIND_LABEL[n.kind] ?? n.kind;
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [library, query, connects]);
  const flat = groups.flatMap((g) => g.items);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  let index = -1;
  return (
    <div className="fe-library fc-overlay" role="dialog" aria-label={title} data-testid="node-library" onPointerDown={(e) => e.stopPropagation()}>
      <div className="fe-library-h">
        <span className="fe-library-title">{title}</span>
        <button type="button" className="fc-ibtn" aria-label="Close the library" onClick={onClose}>
          {FIcon.close}
        </button>
      </div>
      <label className="fe-search">
        {FIcon.search}
        <input
          ref={search}
          aria-label="Search Nodes"
          placeholder="Search Nodes, kinds, types…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(flat.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && flat[current]) {
              e.preventDefault();
              onPick(flat[current]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
        />
      </label>
      <div className="fe-library-list" ref={list} role="listbox" aria-label="Nodes">
        {flat.length === 0 && <p className="faint small fe-library-empty">No Node matches “{query}”.</p>}
        {groups.map((g) => (
          <div key={g.label} role="group" aria-label={g.label}>
            <div className="eyebrow fe-library-group">{g.label}</div>
            {g.items.map((n) => {
              index += 1;
              const i = index;
              return (
                <div
                  key={n.id}
                  role="option"
                  aria-selected={i === current}
                  data-index={i}
                  className={`fe-lib-item ${i === current ? "on" : ""}`}
                  draggable
                  title="Drag onto the canvas, or click to add"
                  onDragStart={(e) => {
                    e.dataTransfer.setData(NODE_DRAG_TYPE, n.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => onPick(n)}
                >
                  <span className={`fe-lib-ic k-${n.kind}`} aria-hidden="true">
                    {kindIcon(n.kind)}
                  </span>
                  <span className="fe-lib-name">{n.name}</span>
                  <span className="fe-lib-sig" aria-label={`${n.inputs.length} inputs, ${n.outputs.length} outputs`}>
                    {n.inputs.map((p) => (
                      <i key={`i-${p.name}`} title={`in: ${p.name} (${p.type})`} style={{ "--c": outputColor(p.type) } as CSSProperties} />
                    ))}
                    <span className="arrow">→</span>
                    {n.outputs.map((p) => (
                      <i key={`o-${p.name}`} title={`out: ${p.name} (${p.type})`} style={{ "--c": outputColor(p.type) } as CSSProperties} />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="fe-library-foot faint small">Drag onto the canvas, or press Enter to add.</div>
    </div>
  );
}
