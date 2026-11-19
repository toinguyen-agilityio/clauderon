import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ago } from "../../../../components/format";
import { Icon } from "../../../../components/icons";
import { StatePill } from "../../../../components/state-pill";
import { viewMachine } from "../../../../server/machines";
import { deps, requireMember } from "../../../../server/runtime";
import { AutoRefresh } from "../auto-refresh";
import { CheckLogins, RemoveMachine, UnpairMachine } from "../machine-actions";
import { defaultMachineName, formatGb, machineName, MachineStatusChip, osLabel, ReadyChip, SlotBar, SlotChips } from "../machine-parts";
import { MachineSettings } from "../machine-settings";

export const dynamic = "force-dynamic";

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
  const { machine, using, canRemove } = view;
  const now = new Date();
  const owner = machine.owner.name ?? machine.owner.email;
  const name = machineName(machine);
  const waiting = using.filter((r) => r.state === "waiting_for_human").length;
  // A heartbeat after the pairing: the new Agent has connected at least once.
  const connectedSincePairing = Boolean(machine.lastHeartbeatAt && machine.pairedAt && machine.lastHeartbeatAt >= machine.pairedAt);
  // Each check ends in a chip: green when done, red or amber with what is wrong.
  const checks: [ok: boolean, label: string, chip: ReactNode][] = [
    [machine.paired, "Paired", machine.paired ? <span className="pill ok">Paired</span> : <span className="pill fail">Not paired</span>],
    [machine.connected, "Agent", machine.connected ? <span className="pill ok">Connected</span> : <span className="pill fail">Offline</span>],
    [machine.claudeLoggedIn, "Claude Code", loginChip(machine.claudeLoggedIn, "Logged in")],
    [machine.ghLoggedIn, "gh", loginChip(machine.ghLoggedIn, machine.ghAccount ?? "Logged in")],
  ];
  const facts: [label: string, value: ReactNode][] = [
    ["Hostname", <span key="h" className="mono small">{machine.hostname ?? "—"}</span>],
    ["System", osLabel(machine.os, machine.arch) || "—"],
    ["CPU", machine.cpus ? `${machine.cpus} cores` : "—"],
    ["RAM", machine.memoryMb ? formatGb(machine.memoryMb) : "—"],
    ["Disk", machine.diskGb ? `${machine.diskGb} GB` : "—"],
    ["Agent", <span key="a" className="mono small">{machine.agentVersion ?? "—"}</span>],
    ["Paired", ago(machine.pairedAt, now)],
  ];

  return (
    <>
      <div>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/machines">Machines</Link> / <span>{name}</span>
        </nav>
        <div className="page-head">
          <div>
            <h1 className="row" style={{ gap: 10 }}>
              <span style={{ color: "var(--fg2)" }}>{Icon.host}</span>
              {name}
            </h1>
            <div className="chips-row" style={{ marginTop: 8 }} data-testid="machine-chips">
              <MachineStatusChip connected={machine.connected} paired={machine.paired} />
              <ReadyChip ready={machine.ready} />
              <SlotChips inUse={machine.inUse} slots={machine.slots} queued={machine.queued} />
            </div>
            <p className="sub small" style={{ marginTop: 8 }}>
              owner <b>{owner}</b>
              {machine.mine ? " (you)" : ""} · last heartbeat {ago(machine.lastHeartbeatAt, now)}
            </p>
          </div>
          {machine.mine ? (
            <div className="row" style={{ gap: 6, alignItems: "flex-start" }}>
              {machine.paired && <CheckLogins machineId={machine.id} connected={machine.connected} />}
              <MachineSettings machineId={machine.id} name={machine.name} defaultName={defaultMachineName(machine.owner)} slots={machine.slots} label="Settings…" small />
            </div>
          ) : (
            <span className="faint small">Only {owner} can manage this Machine.</span>
          )}
        </div>
      </div>

      {machine.mine && machine.paired && !machine.ready && <AutoRefresh everyMs={5000} />}
      {machine.mine && machine.paired && !machine.connected && (
        <div className="banner wait" data-testid="machine-offline">
          {connectedSincePairing ? (
            <div className="grow small">
              <b>The Agent is offline.</b> It comes back by itself when <span className="mono">{machine.hostname ?? "your computer"}</span> is on
              and you are logged in. Run by hand, start it again with <span className="mono">pnpm --filter @clauderon/host-agent start</span>.
              Queued Runs wait until it connects.
            </div>
          ) : (
            <div className="grow small">
              <b>Paired. Waiting for the Agent on {machine.hostname ?? "your computer"} to connect…</b> This page updates by itself.
            </div>
          )}
        </div>
      )}
      {machine.mine && machine.connected && (!machine.claudeLoggedIn || !machine.ghLoggedIn) && (
        <div className="banner wait" data-testid="machine-logins">
          <div className="grow small">
            <b>Log in on the computer itself</b>, in your own terminal: {!machine.claudeLoggedIn && <span className="mono">claude</span>}
            {!machine.claudeLoggedIn && !machine.ghLoggedIn && " and "}
            {!machine.ghLoggedIn && <span className="mono">gh auth login</span>}. Then press Check logins.
          </div>
        </div>
      )}

      <div className="grid g3">
        <div className="card card-pad stack" data-testid="machine-ready">
          <span className="eyebrow">Ready to run</span>
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
            Last checked {ago(machine.loginsCheckedAt, now)}
            {machine.tokenRepos.length > 0 ? ` · gh reaches ${machine.tokenRepos.join(", ")}` : " · gh reaches no Project yet"}
          </p>
        </div>

        <div className="card card-pad stack" data-testid="machine-slots">
          <div className="row between">
            <span className="eyebrow">Slots</span>
            {machine.mine && (
              <MachineSettings machineId={machine.id} name={machine.name} defaultName={defaultMachineName(machine.owner)} slots={machine.slots} label="Change…" small />
            )}
          </div>
          <div className="big-num num">
            {machine.inUse}
            <span className="faint"> / {machine.slots}</span>
          </div>
          <SlotBar slots={machine.slots} inUse={machine.inUse} waiting={waiting} />
          <dl className="kv">
            <dt>Queued</dt>
            <dd>
              {machine.queued > 0 ? <span className="pill wait">{machine.queued} waiting</span> : <span className="pill plain">empty</span>}
              {!machine.connected && machine.queued > 0 && <span className="faint small"> · waits for the Agent to connect</span>}
            </dd>
          </dl>
        </div>

        <div className="card card-pad stack">
          <span className="eyebrow">Computer</span>
          <dl className="kv">
            {facts.map(([label, value]) => (
              <FactRow key={label} label={label} value={value} />
            ))}
          </dl>
          <p className="faint small">Runs work in the Agent&apos;s own directory, ~/.clauderon: one clone per Project, one worktree per Run.</p>
        </div>
      </div>

      <div className="grid g2">
        <div className="card" data-testid="machine-using">
          <div className="card-head">
            <h2>
              Using Slots <span className="faint num">{using.length}</span>
            </h2>
          </div>
          {using.length > 0 ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <tbody>
                  {using.map((r) => (
                    <tr key={r.runId}>
                      <td className="grow-cell">
                        <span className="mono faint small">{r.key}</span>
                        <div>
                          <Link className="plain-link" href={`/runs/${r.runId}`}>
                            {r.ticketTitle}
                          </Link>
                        </div>
                        <div className="small faint">
                          {r.flowName} · {ago(r.startedAt ?? r.queuedAt, now)}
                        </div>
                      </td>
                      <td className="actions">
                        <StatePill state={r.state} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No Runs on this Machine right now.</div>
          )}
        </div>

        <div className="card" data-testid="machine-queue">
          <div className="card-head">
            <h2>
              Queue <span className="faint num">{machine.queue.length}</span>
            </h2>
            <span className="faint small">first-in, first-out</span>
          </div>
          {machine.queue.length > 0 ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <tbody>
                  {machine.queue.map((q) => (
                    <tr key={q.runId}>
                      <td className="num faint">{q.position}</td>
                      <td className="grow-cell">
                        <span className="mono faint small">{q.key}</span> {q.mode === "dry" && <span className="tag dry">Dry-run</span>}
                        <div>
                          <Link className="plain-link" href={`/runs/${q.runId}`}>
                            {q.ticketTitle}
                          </Link>
                        </div>
                        <div className="small faint">
                          {q.flowName} · {ago(q.queuedAt, now)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">Nothing waiting.</div>
          )}
        </div>
      </div>

      {machine.mine && machine.paired && <UnpairMachine machineId={machine.id} name={name} />}
      {canRemove && <RemoveMachine machineId={machine.id} name={name} />}
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
