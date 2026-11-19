"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { LibraryNode, OutputType } from "@clauderon/core";
import { outputColor } from "../../../../components/state-pill";
import type { EditorData } from "../../../../server/flows";
import { CanvasHandle, type HandleType } from "./flow-canvas";
import { FIcon, kindIcon } from "./flow-icons";
import type { PreviewNodeState } from "./test-run";

// One Node on the canvas: a card with its title, its kind and its ports (handles on the
// edges, names shown on hover), a toolbar above it while it is the only one selected,
// and "+" buttons on its sides to add the step before or after it.

export type Placement = EditorData["graph"]["nodes"][number];
/** The wire being drawn: from which handle, carrying which Output Type. */
export type WireFrom = { nodeId: string; handleType: HandleType; type: OutputType };
export type NodeAction = "rename" | "details" | "duplicate" | "delete";

export const KIND_LABEL: Record<string, string> = { ticket: "Ticket", agent: "Agent", command: "Command", approve: "Approve", grill: "Grill" };

/** Whether this Node has a handle that would take the wire being drawn. */
export function acceptsWire(id: string, lib: LibraryNode, placement: Placement, wire: WireFrom): boolean {
  if (wire.nodeId === id) return false;
  return wire.handleType === "source"
    ? lib.inputs.some((i) => i.type === wire.type)
    : lib.outputs.some((o) => o.type === wire.type && (!o.optional || placement.enabledOptionalOutputs.includes(o.name)));
}

type Props = {
  id: string;
  lib: LibraryNode;
  placement: Placement;
  selected: boolean;
  /** The only selected Node: it gets the toolbar. */
  focused: boolean;
  readOnly: boolean;
  problems: readonly string[];
  /** Required inputs with no edge: their ports are marked so it is clear where to connect. */
  missingInputs?: ReadonlySet<string>;
  /** Briefly highlighted, after picking its problem from the list. */
  flash?: boolean;
  runState?: PreviewNodeState;
  wire: WireFrom | null;
  renaming: boolean;
  onRename: (label: string | null | undefined) => void;
  onAction: (action: NodeAction) => void;
  onAdd: (side: "next" | "prev") => void;
};

export function NodeView({ id, lib, placement, selected, focused, readOnly, problems, missingInputs, flash, runState, wire, renaming, onRename, onAction, onAdd }: Props) {
  const title = placement.label || lib.name;
  const pill = lib.kind === "ticket";
  const dim = wire !== null && wire.nodeId !== id && !acceptsWire(id, lib, placement, wire);
  const rows = Math.max(lib.inputs.length, lib.outputs.length);

  const fitOf = (type: HandleType, t: OutputType, active = true): "fit" | "nofit" | undefined => {
    if (!wire || wire.nodeId === id) return undefined;
    const want: HandleType = wire.handleType === "source" ? "target" : "source";
    return type === want && t === wire.type && active ? "fit" : "nofit";
  };

  return (
    <div
      className={`fnode k-${lib.kind} ${pill ? "pill" : ""}`}
      data-kind={lib.kind}
      data-selected={selected || undefined}
      data-dim={dim || undefined}
      data-problem={problems.length > 0 || undefined}
      data-flash={flash || undefined}
      data-state={runState}
      data-testid={`fnode-${lib.name}`}
    >
      <div className="fnode-h">
        <span className="fnode-ic" aria-hidden="true">
          {kindIcon(lib.kind)}
        </span>
        {renaming ? <RenameInput initial={placement.label ?? ""} placeholder={lib.name} onDone={onRename} /> : <span className="ntitle" title={title}>{title}</span>}
        {problems.length > 0 && !runState && (
          <span className="fnode-flag" title={problems.join("\n")} aria-label={`${problems.length} problem${problems.length === 1 ? "" : "s"}: ${problems.join("; ")}`}>
            {FIcon.alert}
          </span>
        )}
        {runState && runState !== "queued" && (
          <span className={`fnode-state ${runState}`} aria-label={runState === "waiting" ? "Waiting for a person" : runState === "running" ? "Running" : "Succeeded"}>
            {runState === "succeeded" ? FIcon.check : runState === "waiting" ? FIcon.pause : <span className="fnode-spin" />}
          </span>
        )}
      </div>

      {!pill && (
        <div className="fnode-meta">
          <span className="fnode-kind">{KIND_LABEL[lib.kind] ?? lib.kind}</span>
          {placement.label && placement.label !== lib.name && <span className="fnode-lib">{lib.name}</span>}
          {placement.extraInstructions.trim() && (
            <span className="fnode-note" title="Has extra instructions">
              +notes
            </span>
          )}
        </div>
      )}

      {rows > 0 && (
        <div className={`fnode-ports ${pill ? "inline" : ""}`} style={{ "--rows": rows } as CSSProperties}>
          <div className="fnode-col in">
            {lib.inputs.map((i) => (
              <div
                key={i.name}
                className={`fport in ${missingInputs?.has(i.name) ? "missing" : ""}`}
                title={missingInputs?.has(i.name) ? `${i.name}: ${i.type}, required and not connected. Drag an Output of type ${i.type} here.` : `${i.name}: ${i.type}${i.required ? " (required)" : ""}`}
              >
                <CanvasHandle nodeId={id} type="target" name={i.name} fit={fitOf("target", i.type)} color={outputColor(i.type)} label={`Input ${i.name} (${i.type})`} />
                <span className="plabel">
                  {i.name}
                  {i.required ? <i className="req">*</i> : null}
                </span>
              </div>
            ))}
          </div>
          <div className="fnode-col out">
            {lib.outputs.map((o) => {
              const off = o.optional && !placement.enabledOptionalOutputs.includes(o.name);
              return (
                <div key={o.name} className={`fport out ${off ? "off" : ""}`} title={`${o.name}: ${o.type}${o.optional ? (off ? " (optional, off)" : " (optional)") : ""}`}>
                  <span className="plabel">{o.name}</span>
                  <CanvasHandle nodeId={id} type="source" name={o.name} fit={fitOf("source", o.type, !off)} color={outputColor(o.type)} label={`Output ${o.name} (${o.type})`} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {focused && !wire && (
        <div className="fnode-toolbar fc-nodrag" role="toolbar" aria-label={`${title} actions`}>
          {!readOnly && (
            <button type="button" onClick={() => onAction("rename")} title="Rename (Enter)">
              {FIcon.rename}
              <span>Rename</span>
            </button>
          )}
          <button type="button" onClick={() => onAction("details")} title="Details">
            {FIcon.info}
            <span>Details</span>
          </button>
          {!readOnly && (
            <>
              <span className="sep" />
              <button type="button" className="icon" onClick={() => onAction("duplicate")} aria-label="Duplicate" title="Duplicate (⌘D)">
                {FIcon.copy}
              </button>
              <button type="button" className="icon danger" onClick={() => onAction("delete")} aria-label="Delete" title="Delete (⌫)">
                {FIcon.trash}
              </button>
            </>
          )}
        </div>
      )}

      {!readOnly && !wire && (
        <>
          {lib.inputs.length > 0 && (
            <button type="button" className="fnode-add prev fc-nodrag" aria-label={`Add the step before ${title}`} title="Add the step before" onClick={() => onAdd("prev")}>
              {FIcon.plus}
            </button>
          )}
          {lib.outputs.length > 0 && (
            <button type="button" className="fnode-add next fc-nodrag" aria-label={`Add the step after ${title}`} title="Add the step after" onClick={() => onAdd("next")}>
              {FIcon.plus}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Inline rename: Enter or leaving the field keeps it, Escape cancels, an empty name goes back to the library name. */
function RenameInput({ initial, placeholder, onDone }: { initial: string; placeholder: string; onDone: (label: string | null | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    const v = ref.current?.value.trim() ?? "";
    onDone(keep ? (v === "" ? null : v) : undefined);
  };
  return (
    <input
      ref={ref}
      className="fnode-rename fc-nodrag"
      aria-label="Node label"
      defaultValue={initial}
      placeholder={placeholder}
      maxLength={120}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      }}
      onBlur={() => finish(true)}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}
