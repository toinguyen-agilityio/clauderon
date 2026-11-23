"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LibraryNode, OutputValue as OutputValueType } from "@clauderon/core";
import { OutputValue } from "../../../../components/output-value";
import { outputColor } from "../../../../components/state-pill";
import { FIcon, kindIcon } from "./flow-icons";
import { KIND_LABEL, type Placement } from "./flow-node";
import type { PreviewNodeState } from "./test-run";

/** What this placement may change in this Flow (FLW-6): its label, extra instructions and optional Outputs. */
export type PlacementPatch = Partial<Pick<Placement, "label" | "extraInstructions" | "enabledOptionalOutputs">>;

const STATE_LABEL: Record<PreviewNodeState, string> = { queued: "Queued", running: "Running", waiting: "Waiting for a person", succeeded: "Succeeded" };

/**
 * The details of the selected Node (spec M2 §3, FLW-6), floating over the canvas: a
 * label for this placement, extra instructions that are added to its prompt in this
 * Flow, a switch per optional Output, its ports with the Nodes on their other end, and
 * what the last Test run made up for it. Turning off an Output that has an edge is a problem the badge reports; it is not
 * blocked here.
 */
export function NodePanel({
  placement,
  lib,
  readOnly,
  usedOutputs,
  links,
  problems,
  runState,
  testOutputs,
  onChange,
  onClose,
}: {
  placement: Placement;
  lib: LibraryNode;
  readOnly: boolean;
  /** Names of this Node's Outputs that have an edge. */
  usedOutputs: ReadonlySet<string>;
  /** The Nodes on the other end of each port: who feeds each input, who takes each Output. */
  links: { from: ReadonlyMap<string, readonly string[]>; to: ReadonlyMap<string, readonly string[]> };
  /** Problems this Node is part of, each with what to do about it. */
  problems: readonly ReactNode[];
  runState?: PreviewNodeState;
  testOutputs?: readonly OutputValueType[];
  onChange: (patch: PlacementPatch) => void;
  onClose: () => void;
}) {
  const optional = lib.outputs.filter((o) => o.optional);
  const agentLike = lib.kind === "agent" || lib.kind === "grill";
  return (
    <aside className="fe-panel fc-overlay" aria-label="Node panel" data-testid="node-panel" onPointerDown={(e) => e.stopPropagation()}>
      <header className="fe-panel-h">
        <span className={`fe-panel-ic k-${lib.kind}`} aria-hidden="true">
          {kindIcon(lib.kind)}
        </span>
        <div className="grow">
          <h2>{placement.label || lib.name}</h2>
          <span className="faint small">
            {KIND_LABEL[lib.kind] ?? lib.kind} Node{placement.label ? ` · ${lib.name}` : ""}
          </span>
        </div>
        <button type="button" className="fc-ibtn" aria-label="Close details" title="Close (Esc)" onClick={onClose}>
          {FIcon.close}
        </button>
      </header>

      <div className="fe-panel-body">
        {problems.length > 0 && (
          <section className="fe-panel-problems" aria-label="Problems">
            {problems}
          </section>
        )}

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
            rows={4}
            onChange={(e) => onChange({ extraInstructions: e.target.value })}
          />
          <span className="hint">Added to this Node&apos;s prompt in this Flow only.</span>
        </label>

        <section className="fe-ports" aria-label="Inputs">
          <h3 className="fe-ports-h">Inputs</h3>
          {lib.inputs.length === 0 && <span className="faint small">None: this Node starts the Flow.</span>}
          {lib.inputs.map((i) => {
            const from = links.from.get(i.name) ?? [];
            return (
              <div key={i.name} className="fe-port">
                <div className="fe-port-row">
                  <i style={{ "--c": outputColor(i.type) } as CSSProperties} />
                  <span className="mono">{i.name}</span>
                  {i.name !== i.type && <span className="faint small">{i.type}</span>}
                  <span className="fe-port-tag">{i.required ? "required" : "optional"}</span>
                </div>
                <div className="fe-port-links">
                  {from.length > 0 ? (
                    from.map((n, k) => (
                      <span key={k} className="fe-link">
                        from {n}
                      </span>
                    ))
                  ) : (
                    <span className={i.required ? "fe-link warn" : "faint small"}>Not connected</span>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <section className="fe-ports" aria-label="Outputs">
          <h3 className="fe-ports-h">Outputs</h3>
          {lib.outputs.length === 0 && <span className="faint small">None: this Node ends the Flow.</span>}
          {lib.outputs.map((o) => {
            const on = !o.optional || placement.enabledOptionalOutputs.includes(o.name);
            const to = links.to.get(o.name) ?? [];
            return (
              <div key={o.name} className={`fe-port ${on ? "" : "off"}`}>
                <div className="fe-port-row">
                  <i style={{ "--c": outputColor(o.type) } as CSSProperties} />
                  <span className="mono">{o.name}</span>
                  {o.name !== o.type && <span className="faint small">{o.type}</span>}
                  {o.optional && (
                    <label className="fe-switch">
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
                      <span aria-hidden="true" />
                    </label>
                  )}
                </div>
                <div className="fe-port-links">
                  {to.length > 0 ? (
                    to.map((n, k) => (
                      <span key={k} className="fe-link">
                        to {n}
                      </span>
                    ))
                  ) : (
                    <span className="faint small">{on ? "Not used by another Node" : "Off"}</span>
                  )}
                </div>
                {o.optional && !on && usedOutputs.has(o.name) && <span className="err-text small">Off but has an edge: a problem.</span>}
              </div>
            );
          })}
          {optional.length > 0 && <span className="hint">Optional Outputs are made only when switched on.</span>}
        </section>

        {runState && (
          <section className="fe-ports" aria-label="Test run">
            <h3 className="fe-ports-h">Test run</h3>
            <span className={`fe-run-state ${runState}`}>{STATE_LABEL[runState]}</span>
            {testOutputs && testOutputs.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <span className="hint">Made-up Outputs, as a real Run would pass them on.</span>
                {testOutputs.map((o) => (
                  <div key={o.name} className="stack" style={{ gap: 4 }}>
                    <span className="mono small">{o.name}</span>
                    <OutputValue type={o.type} value={o.value} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}
