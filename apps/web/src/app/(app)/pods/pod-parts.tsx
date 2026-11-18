// Small pieces shared by the Pods page and the Pod page.

import { Icon } from "../../../components/icons";
import { PodPill } from "../../../components/state-pill";

/** Mirrors the server's limit; kept here so client dialogs need no server import. */
export const POD_NAME_MAX = 60;

export const defaultPodName = (owner: { name: string | null; email: string }) => `${owner.name ?? owner.email}'s Pod`;

/** RAM as stored (MB) in GB, with one decimal when needed: 2560 → "2.5 GB". */
export const formatGb = (memoryMb: number) => `${Math.round((memoryMb / 1024) * 10) / 10} GB`;

/** The Pod's own name, or "<owner>'s Pod" when it has none. */
export const podName = (pod: { name: string | null; owner: { name: string | null; email: string } }) => pod.name ?? defaultPodName(pod.owner);

/** One box per Slot: Running fills it blue, Waiting for a human amber. */
export function SlotBar({ slots, inUse, waiting = 0 }: { slots: number; inUse: number; waiting?: number }) {
  return (
    <div className="slots" aria-label={`${inUse} of ${slots} Slots busy`}>
      {Array.from({ length: Math.max(slots, inUse) }, (_, i) => (
        <span key={i} className={`slot ${i < waiting ? "wait" : i < inUse ? "run" : ""}`} />
      ))}
    </div>
  );
}


// Status chips: every Pod state reads as a coloured label, not plain text.

/** The container's state, or the Host Agent being offline (then the state is unknown). */
export function PodStatusChip({ status, hostConnected }: { status: string; hostConnected: boolean }) {
  if (!hostConnected) return <span className="pill intr">Host Agent offline</span>;
  return <PodPill status={status} />;
}

export function ReadyChip({ ready }: { ready: boolean }) {
  return ready ? <span className="pill ok plain">{Icon.check}Ready</span> : <span className="pill wait">Not ready</span>;
}

/** One login: green with the account when logged in, red when not. */
export function LoginChip({ ok, label, account }: { ok: boolean; label: string; account?: string | null }) {
  return (
    <span className={`pill plain ${ok ? "ok" : "fail"}`} title={ok ? `${label} logged in` : `${label} not logged in`}>
      {ok ? Icon.check : Icon.x}
      {label}
      {ok && account ? <span className="mono chip-sub">{account}</span> : null}
      {!ok && <span className="chip-sub">not logged in</span>}
    </span>
  );
}

/** Slots in use (blue while any Run holds one) and the queue (amber while anything waits). */
export function SlotChips({ inUse, slots, queued }: { inUse: number; slots: number; queued: number }) {
  return (
    <>
      <span className={`pill plain ${inUse > 0 ? "run" : ""}`}>
        {inUse}/{slots} Slots busy
      </span>
      {queued > 0 ? <span className="pill wait">{queued} queued</span> : <span className="pill plain">queue empty</span>}
    </>
  );
}
