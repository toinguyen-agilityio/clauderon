// Small pieces shared by the Machines page and the Machine page.

import { Icon } from "../../../components/icons";

/** Mirrors the server's limits; kept here so client dialogs need no server import. */
export const MACHINE_NAME_MAX = 60;
export { MAX_SLOTS } from "@clauderon/core";

export const defaultMachineName = (owner: { name: string | null; email: string }) => `${owner.name ?? owner.email}'s Machine`;

/** RAM as stored (MB) in GB, with one decimal when needed: 2560 → "2.5 GB". */
const toGb = (memoryMb: number) => Math.round((memoryMb / 1024) * 10) / 10;
export const formatGb = (memoryMb: number) => `${toGb(memoryMb)} GB`;

type ResourceMachine = {
  connected: boolean;
  cpus: number | null;
  memoryMb: number | null;
  diskGb: number | null;
  usage: { memoryUsedMb: number; diskFreeGb: number; cpuPercent: number } | null;
};

/** One resource: its label, and the share in use (0-100) when the Agent reports it. */
export type Resource = { text: string; percent: number | null };

const share = (used: number, total: number) => Math.min(100, Math.max(0, Math.round((used / total) * 100)));

/**
 * CPU, RAM and disk as "used / total" while the Agent is online and reports
 * usage; otherwise (offline, or an older Agent) the totals alone, with no share.
 */
export function resourceLabels(machine: ResourceMachine): { cpu: Resource; ram: Resource; disk: Resource } {
  const usage = machine.connected ? machine.usage : null;
  const { cpus, memoryMb, diskGb } = machine;
  const none = { text: "—", percent: null };
  const diskUsed = usage && diskGb ? Math.max(0, diskGb - usage.diskFreeGb) : 0;
  return {
    cpu: !cpus ? none : usage ? { text: `${usage.cpuPercent}% of ${cpus} cores`, percent: share(usage.cpuPercent, 100) } : { text: `${cpus} cores`, percent: null },
    ram: !memoryMb
      ? none
      : usage
        ? { text: `${toGb(usage.memoryUsedMb)} / ${formatGb(memoryMb)}`, percent: share(usage.memoryUsedMb, memoryMb) }
        : { text: formatGb(memoryMb), percent: null },
    disk: !diskGb ? none : usage ? { text: `${diskUsed} / ${diskGb} GB`, percent: share(diskUsed, diskGb) } : { text: `${diskGb} GB`, percent: null },
  };
}

/** Green below 70% in use, amber from 70%, red from 90%. */
export const usageLevel = (percent: number): "ok" | "wait" | "fail" => (percent >= 90 ? "fail" : percent >= 70 ? "wait" : "ok");

/** A resource's label with a bar of its share in use, coloured by how full it is. */
export function ResourceMeter({ label, resource }: { label: string; resource: Resource }) {
  if (resource.percent === null) return <>{resource.text}</>;
  return (
    <span className="meter-row">
      <span>{resource.text}</span>
      <span className="meter" role="meter" aria-label={`${label} in use`} aria-valuenow={resource.percent} aria-valuemin={0} aria-valuemax={100}>
        <span className={`meter-fill ${usageLevel(resource.percent)}`} style={{ width: `${resource.percent}%` }} />
      </span>
    </span>
  );
}

/** CPU, RAM and Disk of one Machine as labelled meters (the list tiles); the same data as the Machine page. */
export function MachineResources({ machine }: { machine: ResourceMachine }) {
  const resources = resourceLabels(machine);
  return (
    <dl className="res-list" aria-label="Resources">
      {([["CPU", resources.cpu], ["RAM", resources.ram], ["Disk", resources.disk]] as const).map(([label, resource]) => (
        <div key={label} className="res-item">
          <dt className="faint">{label}</dt>
          <dd>
            <ResourceMeter label={label} resource={resource} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The Machine's own name, or "<owner>'s Machine" when it has none. */
export const machineName = (machine: { name: string | null; owner: { name: string | null; email: string } }) =>
  machine.name ?? defaultMachineName(machine.owner);

/** The Claude account Runs use, as one short label: "ann · Pro" (the full email goes in a tooltip). */
export function claudeAccountLabel(machine: { claudeLoggedIn: boolean; claudeAccount: string | null; claudePlan: string | null }): string | null {
  if (!machine.claudeLoggedIn || !machine.claudeAccount) return null;
  const name = machine.claudeAccount.split("@")[0] || machine.claudeAccount;
  const plan = machine.claudePlan ? machine.claudePlan.charAt(0).toUpperCase() + machine.claudePlan.slice(1) : null;
  return plan ? `${name} · ${plan}` : name;
}

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
