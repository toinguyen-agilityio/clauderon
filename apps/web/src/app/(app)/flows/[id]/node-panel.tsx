"use client";

import type { LibraryNode } from "@clauderon/core";
import type { EditorData } from "../../../../server/flows";

type Placement = EditorData["graph"]["nodes"][number];

/** What this placement may change in this Flow (FLW-6): its label, extra instructions and optional Outputs. */
export type PlacementPatch = Partial<Pick<Placement, "label" | "extraInstructions" | "enabledOptionalOutputs">>;

/**
 * The panel for the selected Node (spec M2 §3, FLW-6): a label for this
 * placement, extra instructions that are added to its prompt in this Flow, and
 * a switch per optional Output. Turning off an Output that has an edge is a
 * problem the badge reports; it is not blocked here.
 */
export function NodePanel({
  placement,
  lib,
  readOnly,
  usedOutputs,
  onChange,
}: {
  placement: Placement;
  lib: LibraryNode;
  readOnly: boolean;
  /** Names of this Node's Outputs that have an edge. */
  usedOutputs: ReadonlySet<string>;
  onChange: (patch: PlacementPatch) => void;
}) {
  const optional = lib.outputs.filter((o) => o.optional);
  const agentLike = lib.kind === "agent" || lib.kind === "grill";
  return (
    <aside className="card card-pad stack node-panel" style={{ gap: 12 }} aria-label="Node panel" data-testid="node-panel">
      <div>
        <h2 className="small">{lib.name}</h2>
        <span className="faint small">{lib.kind} Node</span>
      </div>

      <label className="field">
        <span className="small">Label</span>
        <input
          className="input"
          aria-label="Label"
          placeholder={lib.name}
          value={placement.label ?? ""}
          readOnly={readOnly}
          maxLength={120}
          onChange={(e) => onChange({ label: e.target.value === "" ? null : e.target.value })}
        />
        <span className="hint">Shown on the canvas and the Run page for this placement.</span>
      </label>

      <label className="field">
        <span className="small">Extra instructions</span>
        <textarea
          className="textarea"
          aria-label="Extra instructions"
          placeholder={agentLike ? "e.g. Follow the existing test style." : "Only Agent Nodes use these."}
          value={placement.extraInstructions}
          readOnly={readOnly}
          onChange={(e) => onChange({ extraInstructions: e.target.value })}
        />
        <span className="hint">Added to this Node&apos;s prompt in this Flow only.</span>
      </label>

      <div className="field">
        <span className="small">Optional Outputs</span>
        {optional.length === 0 && <span className="faint small">This Node has no optional Outputs.</span>}
        {optional.map((o) => {
          const on = placement.enabledOptionalOutputs.includes(o.name);
          return (
            <label key={o.name} className="row" style={{ gap: 8 }}>
              <input
                type="checkbox"
                role="switch"
                aria-label={`Optional Output ${o.name}`}
                checked={on}
                disabled={readOnly}
                onChange={() =>
                  onChange({ enabledOptionalOutputs: on ? placement.enabledOptionalOutputs.filter((n) => n !== o.name) : [...placement.enabledOptionalOutputs, o.name] })
                }
              />
              <span className="small">
                {o.name} <span className="faint">{o.type}</span>
              </span>
              {!on && usedOutputs.has(o.name) && <span className="err-text small">has an edge: a problem</span>}
            </label>
          );
        })}
      </div>
    </aside>
  );
}
