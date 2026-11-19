"use client";

import { useActionState } from "react";
import { approvePairingAction, lookUpPairingAction, type PairFormState } from "./actions";
import type { PairingPreview } from "../../../server/machines";
import { Icon } from "../../../components/icons";
import { osLabel } from "./machine-parts";

/**
 * Pairing in the web app (ADR 0006): the Member checks the computer a code
 * names, then approves it. The Agent opens this page with its code already
 * looked up; a code can also be typed.
 */
export function PairMachine({ opened = null }: { opened?: { pairing: PairingPreview | null; error: string | null } | null }) {
  const initial: PairFormState = { error: opened?.error ?? null, pairing: opened?.pairing ?? null };
  const [found, lookUp, looking] = useActionState<PairFormState, FormData>(lookUpPairingAction, initial);
  const [approved, approve, approving] = useActionState<PairFormState, FormData>(approvePairingAction, { error: null, pairing: null });
  const pairing = found.pairing;
  const error = approved.error ?? found.error;

  return (
    <div className="stack" style={{ gap: 10 }} data-testid="pair-machine">
      <form action={lookUp} className="row" style={{ gap: 8 }}>
        <input
          className="input mono"
          name="code"
          defaultValue={opened?.pairing?.code ?? ""}
          placeholder="ABCD-EFGH"
          aria-label="Pairing code"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          required
          style={{ maxWidth: 160, textTransform: "uppercase" }}
        />
        <button type="submit" className="btn sm" disabled={looking}>
          {looking ? (
            <>
              {Icon.spin}
              Looking up…
            </>
          ) : (
            "Look up"
          )}
        </button>
      </form>
      {pairing && (
        <form action={approve} className="banner wait inset" data-testid="pairing-preview">
          <input type="hidden" name="code" value={pairing.code} />
          <div className="grow small">
            <b className="mono">{pairing.hostname}</b> · {osLabel(pairing.os, pairing.arch)} wants to become your Machine.
            {pairing.replaces && (
              <>
                {" "}
                It replaces <b className="mono">{pairing.replaces}</b>: that computer stops taking Runs, and its Running Runs become Interrupted.
              </>
            )}
          </div>
          <button type="submit" className="btn sm primary" disabled={approving}>
            {approving ? (
              <>
                {Icon.spin}
                Approving…
              </>
            ) : (
              "Approve"
            )}
          </button>
        </form>
      )}
      {error && (
        <span className="err-text small" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
