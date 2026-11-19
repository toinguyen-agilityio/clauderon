// Small pieces shared by the Machines page and the Machine page.

import { Icon } from "../../../components/icons";

/** Mirrors the server's limits; kept here so client dialogs need no server import. */
export const MACHINE_NAME_MAX = 60;
export { MAX_SLOTS } from "@clauderon/core";

export const defaultMachineName = (owner: { name: string | null; email: string }) => `${owner.name ?? owner.email}'s Machine`;

/** RAM as stored (MB) in GB, with one decimal when needed: 2560 → "2.5 GB". */
export const formatGb = (memoryMb: number) => `${Math.round((memoryMb / 1024) * 10) / 10} GB`;

/** The Machine's own name, or "<owner>'s Machine" when it has none. */
export const machineName = (machine: { name: string | null; owner: { name: string | null; email: string } }) =>
  machine.name ?? defaultMachineName(machine.owner);

/** Pairing from a checkout of this repository, for those who run the Agent by hand (ADR 0006). */
export const pairCommand = (webUrl: string) => `pnpm --filter @clauderon/host-agent pair ${webUrl}`;

const OS_LABEL: Record<string, string> = { darwin: "macOS", linux: "Linux", win32: "Windows" };

/** `darwin` → macOS, with the architecture: "macOS arm64". */
export const osLabel = (os: string | null, arch: string | null) => [os ? (OS_LABEL[os] ?? os) : null, arch].filter(Boolean).join(" ");

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

// Status chips: every Machine state reads as a coloured label, not plain text.

/** Whether its Agent is connected now; an unpaired Machine has no Agent at all. */
export function MachineStatusChip({ connected, paired }: { connected: boolean; paired: boolean }) {
  if (!paired) return <span className="pill plain">Not paired</span>;
  return connected ? <span className="pill ok">Online</span> : <span className="pill intr">Offline</span>;
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
