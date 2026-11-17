"use client";

import { useActionState } from "react";
import { setLimitsAction, type LimitsFormState } from "./actions";

type Limits = { slots: number; cpus: number; memoryMb: number };

/** The owner's Slots, CPU and RAM (POD-2): Slots apply at once, CPU and RAM at the next Recreate. */
export function PodLimits({ podId, limits, ceiling }: { podId: string; limits: Limits; ceiling: Limits }) {
  const [state, action, pending] = useActionState<LimitsFormState, FormData>(setLimitsAction, { error: null, saved: false });
  return (
    <details className="pod-limits">
      <summary className="small">Edit limits</summary>
      <form action={action} className="stack" style={{ gap: 8, marginTop: 8 }}>
        <input type="hidden" name="podId" value={podId} />
        <label className="small">
          Slots <span className="faint">(max {ceiling.slots})</span>
          <input className="input" name="slots" type="number" min={1} max={ceiling.slots} step={1} defaultValue={limits.slots} required />
        </label>
        <label className="small">
          CPU <span className="faint">(max {ceiling.cpus}; applies at next Recreate)</span>
          <input className="input" name="cpus" type="number" min={0.5} max={ceiling.cpus} step={0.5} defaultValue={limits.cpus} required />
        </label>
        <label className="small">
          RAM in MB <span className="faint">(max {ceiling.memoryMb}; applies at next Recreate)</span>
          <input className="input" name="memoryMb" type="number" min={256} max={ceiling.memoryMb} step={256} defaultValue={limits.memoryMb} required />
        </label>
        <button type="submit" className="btn sm" disabled={pending}>
          Save limits
        </button>
        {state.error && (
          <span className="err-text small" role="alert">
            {state.error}
          </span>
        )}
        {state.saved && !state.error && <span className="faint small">Saved. Slots apply now; CPU and RAM at the next Recreate.</span>}
      </form>
    </details>
  );
}
