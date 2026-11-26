import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isLegacyAgentVersion } from "@clauderon/protocol";
import { ago } from "../../../../components/format";
import { Icon } from "../../../../components/icons";
import { agentManifest, installCommandPs1, installCommandSh } from "../../../../server/agent-install";
import { viewMachine } from "../../../../server/machines";
import { deps, pageWebUrl, requireMember } from "../../../../server/runtime";
import { AutoRefresh } from "../auto-refresh";
import { CmdBox } from "../cmd-box";
import { DoctorCard } from "../doctor-card";
import { CheckLogins, RemoveMachine, UpdateAgent } from "../machine-actions";
import { claudeAccountLabel, defaultMachineName, machineName, MachineStatusChip, osLabel, DiskStatus, ReadyChip, ResourceMeter, resourceLabels, SlotChips } from "../machine-parts";
import { MachineSettings } from "../machine-settings";
import { PairingProgress } from "../pairing-progress";

export const dynamic = "force-dynamic";

const CHECKING = (
  <span className="pill wait">
    {Icon.spin}
    Checking…
  </span>
);

const loginChip = (ok: boolean, label: string) =>
  ok ? (
    <span className="pill ok plain">
      {Icon.check}
      {label}
    </span>
  ) : (
    <span className="pill fail">Not logged in</span>
  );

export default async function MachinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await requireMember();
  const view = await viewMachine(deps(), member, id);
  if (view === "not-found") notFound();
  const { machine, canRemove } = view;
  const now = new Date();
  const [latest, web] = await Promise.all([agentManifest(), pageWebUrl()]);
  // ADR 0007: an old install (a clone run with tsx) cannot update itself; a bundle updates on its next connect.
  const legacy = isLegacyAgentVersion(machine.agentVersion);
  const updating = !legacy && latest && machine.agentVersion && !machine.agentVersion.endsWith("-dev") && machine.agentVersion !== latest.version;
  const canUpdate = Boolean(updating && latest && machine.mine && machine.paired && machine.connected);
  const installCommand = machine.os === "win32" ? installCommandPs1(web) : installCommandSh(web);
  const owner = machine.owner.name ?? machine.owner.email;
  const name = machineName(machine);
  // A heartbeat after the pairing: the new Agent has connected at least once.
  const connectedSincePairing = Boolean(machine.lastHeartbeatAt && machine.pairedAt && machine.lastHeartbeatAt >= machine.pairedAt);
  // Right after Pairing the logins are unknown, not missing: say "Checking…" instead of a red "Not logged in".
  const checkedSincePairing = Boolean(machine.loginsCheckedAt && machine.pairedAt && machine.loginsCheckedAt >= machine.pairedAt);
  const checking = machine.paired && machine.connected && !checkedSincePairing;
  const settingUp = machine.mine && machine.paired && (!connectedSincePairing || checking);
  const justReady = machine.mine && machine.ready && !!machine.pairedAt && now.getTime() - machine.pairedAt.getTime() < 10 * 60_000;
  // Each check ends in a chip: green when done, red or amber with what is wrong.
  const agentReady = machine.paired && machine.connected;
  const checks: [ok: boolean, label: string, chip: ReactNode][] = [
    // One row for the connection: Ready once the computer is paired and its Agent is online.
    [
      agentReady,
      "Connection",
      agentReady ? (
        <span className="pill ok">Ready</span>
      ) : (
        <span className="pill fail" title={machine.paired ? "Paired, but the Agent is offline" : "Not paired"}>
          Not ready
        </span>
      ),
    ],
    [machine.claudeLoggedIn, "Claude Code", checking ? CHECKING : loginChip(machine.claudeLoggedIn, claudeAccountLabel(machine) ?? "Logged in")],
    [machine.ghLoggedIn, "gh", checking ? CHECKING : loginChip(machine.ghLoggedIn, machine.ghAccount ?? "Logged in")],
  ];
  const resources = resourceLabels(machine);
  const facts: [label: string, value: ReactNode][] = [
    ["Hostname", <span key="h" className="mono small">{machine.hostname ?? "—"}</span>],
    ["System", osLabel(machine.os, machine.arch) || "—"],
    ["CPU", <ResourceMeter key="cpu" label="CPU" resource={resources.cpu} />],
    ["RAM", <ResourceMeter key="ram" label="RAM" resource={resources.ram} />],
    ["Disk", <span key="disk" className="stack" style={{ gap: 4 }}>{resources.disk.percent !== null && <ResourceMeter label="Disk" resource={resources.disk} />}<DiskStatus machine={machine} /></span>],
    [
      "Agent",
      <span key="a" className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="mono small">
          {machine.agentVersion ?? "—"}
          {updating && <span className="faint"> · updates to {latest.version} when idle</span>}
        </span>
        {canUpdate && latest && <UpdateAgent machineId={machine.id} latest={latest.version} />}
      </span>,
    ],
    ["Paired", ago(machine.pairedAt, now)],
  ];

  const state = !machine.paired ? "unpaired" : machine.connected ? "online" : "offline";

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/machines">Machines</Link> / <span>{name}</span>
      </nav>
      <header className={`card mach-hero mach-detail-hero is-${state}`}>
        <div className="mach-hero-id">
          <span className="mach-icon">
            {Icon.host}
            <i className="mach-led" aria-hidden />
          </span>
          <div className="mach-hero-name">
            <h1>{name}</h1>
            <div className="mach-facts small">
              <span>
                {machine.mine ? "Yours" : <>Owned by <b>{owner}</b></>}
              </span>
              <span className="mono">{machine.hostname ?? "—"}</span>
              <span>{osLabel(machine.os, machine.arch) || "unknown OS"}</span>
              <span className="faint">last heartbeat {ago(machine.lastHeartbeatAt, now)}</span>
            </div>
            <div className="chips-row" style={{ marginTop: 6 }} data-testid="machine-chips">
              <MachineStatusChip connected={machine.connected} paired={machine.paired} />
              {checking ? CHECKING : <ReadyChip ready={machine.ready} />}
              <SlotChips inUse={machine.inUse} slots={machine.slots} queued={machine.queued} />
            </div>
          </div>
          {machine.mine ? (
            <div className="row mach-hero-actions">
              {machine.paired && <CheckLogins machineId={machine.id} connected={machine.connected} />}
              <MachineSettings machineId={machine.id} name={machine.name} defaultName={defaultMachineName(machine.owner)} slots={machine.slots} label="Settings…" small />
            </div>
          ) : (
            <span className="faint small mach-hero-actions">Only {owner} can manage this Machine.</span>
          )}
        </div>
      </header>

      {machine.mine && machine.paired && !machine.ready && <AutoRefresh everyMs={settingUp ? 2000 : 5000} />}
      {settingUp && <PairingProgress phase={connectedSincePairing ? "checking" : "connecting"} hostname={machine.hostname ?? "This computer"} />}
      {justReady && !settingUp && (
        <div className="banner ok" data-testid="machine-just-ready">
          <div className="grow small">
            <b>Your Machine is Ready.</b> Runs you start now run on <span className="mono">{machine.hostname ?? "it"}</span>.
          </div>
        </div>
      )}
      {machine.mine && machine.paired && !machine.connected && connectedSincePairing && (
        <div className="banner wait" data-testid="machine-offline">
          <div className="grow small">
            <b>The Agent is offline.</b> It comes back by itself when <span className="mono">{machine.hostname ?? "your computer"}</span> is on
            and you are logged in. If it does not, run the install command from the Machines page again on that computer: it keeps the
            pairing and restarts the Agent. Queued Runs wait until it connects.
          </div>
        </div>
      )}
      {machine.mine && machine.paired && legacy && (
        <div className="banner wait" data-testid="machine-legacy-agent">
          <div className="grow small stack" style={{ gap: 8 }}>
            <span>
              <b>This Machine runs the old Agent install</b> ({machine.agentVersion}), which cannot update itself. Run the install command once
              more on {machine.hostname ?? "that computer"}: it keeps the pairing, brings its own Node and from then on updates by itself.
            </span>
            <CmdBox command={installCommand} />
          </div>
        </div>
      )}
      {machine.mine && machine.connected && !checking && (!machine.claudeLoggedIn || !machine.ghLoggedIn) && (
        <div className="banner wait" data-testid="machine-logins">
          <div className="grow small">
            <b>Log in on the computer itself</b>, in your own terminal: {!machine.claudeLoggedIn && <span className="mono">claude</span>}
            {!machine.claudeLoggedIn && !machine.ghLoggedIn && " and "}
            {!machine.ghLoggedIn && <span className="mono">gh auth login</span>}. Then press Check logins.
          </div>
        </div>
      )}

      <div className="mach-detail">
        <section className="card card-pad stack" data-testid="machine-ready" aria-labelledby="mach-ready-h">
          <h2 id="mach-ready-h" className="mach-card-h">
            Ready to run
          </h2>
          <ul className="checklist">
            {checks.map(([ok, label, chip]) => (
              <li key={label}>
                <span className={`ndot ${ok ? "succeeded" : ""}`}>{ok && Icon.check}</span>
                <span className="small">{label}</span>
                {chip}
              </li>
            ))}
          </ul>
          <p className="faint small">
            Last checked {ago(machine.loginsCheckedAt, now)}.{" "}
            {machine.tokenRepos.length > 0 ? `gh reaches ${machine.tokenRepos.join(", ")}.` : "gh reaches no Project yet."}
          </p>
        </section>

        {machine.doctor && <DoctorCard doctor={machine.doctor} mine={machine.mine} now={now} />}

        <section className="card card-pad stack" aria-labelledby="mach-computer-h">
          <h2 id="mach-computer-h" className="mach-card-h">
            Computer
          </h2>
          <dl className="kv">
            {facts.map(([label, value]) => (
              <FactRow key={label} label={label} value={value} />
            ))}
          </dl>
          <p className="faint small">Runs work in the Agent&apos;s own directory, ~/.clauderon: one clone per Project, one worktree per Run.</p>
        </section>
      </div>

      {canRemove ? (
        <section className="mach-danger" aria-label="Remove">
          <RemoveMachine machineId={machine.id} name={name} />
        </section>
      ) : null}
    </>
  );
}

function FactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
