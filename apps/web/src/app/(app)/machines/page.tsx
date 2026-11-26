import Link from "next/link";
import { ago } from "../../../components/format";
import { Icon } from "../../../components/icons";
import { installCommandPs1, installCommandSh } from "../../../server/agent-install";
import { lookUpPairing, viewMachines, type MachineView } from "../../../server/machines";
import { deps, pageWebUrl, requireMember } from "../../../server/runtime";
import { CmdBox } from "./cmd-box";
import { claudeAccountLabel, DiskStatus, LoginChip, MachineResources, MachineStatusChip, ReadyChip, SlotBar, SlotChips, machineName, osLabel } from "./machine-parts";
import { PairMachine } from "./pair-machine";

export const dynamic = "force-dynamic";

export default async function MachinesPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const member = await requireMember();
  const { code } = await searchParams;
  const [{ machines, mine }, web] = await Promise.all([viewMachines(deps(), member), pageWebUrl()]);
  // The Agent opens this page with its code: show the computer, ready to approve.
  const opened = code ? await lookUpPairing(deps(), member, code) : null;
  const others = machines.filter((m) => !m.mine);
  const now = new Date();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Machines</h1>
          <p className="sub">
            Every Member pairs their own computer, their Machine. Runs you start always run there, under your own Claude Code and gh
            logins, with your full user permissions.
          </p>
        </div>
      </div>

      {mine?.paired && !mine.ready && (
        <div className="banner wait">
          <div className="grow small">
            <b>Your Machine is not Ready yet.</b> Runs start once its Agent is connected and Claude Code and gh are logged in on it.
          </div>
          <Link className="btn sm primary" href={`/machines/${mine.id}`}>
            Open my Machine
          </Link>
        </div>
      )}

      {opened ? (
        <div className="card card-pad stack" data-testid="approve-opened">
          <span className="eyebrow">Approve this computer</span>
          <span className="small muted">Your Agent opened this page. Check the computer&apos;s name, then approve it.</span>
          <PairMachine opened={opened.ok ? { pairing: opened.pairing, error: null } : { pairing: null, error: opened.error }} />
        </div>
      ) : (
        <div className="card card-pad stack" data-testid="pair">
          <span className="eyebrow">{mine?.paired ? "Connect another computer" : "Connect your computer"}</span>
          <span className="small muted">
            Run this in a terminal on that computer. It needs Node 22, git and gh; it logs you in to GitHub if needed, opens this page to
            approve, and keeps the Agent running whenever you are logged in.
            {mine?.paired && " Your current Machine is replaced."}
          </span>
          <div className="stack" style={{ gap: 6 }}>
            <span className="small">
              <b>macOS or Linux</b>
            </span>
            <CmdBox command={installCommandSh(web)} />
            <span className="small">
              <b>Windows</b> <span className="faint">(PowerShell; needs Git for Windows)</span>
            </span>
            <CmdBox command={installCommandPs1(web)} />
          </div>
          <details className="small">
            <summary className="faint">The browser did not open? Enter the code</summary>
            <div className="stack" style={{ gap: 8, marginTop: 8 }}>
              <span className="faint">Enter the code the install command shows in your terminal:</span>
              <PairMachine />
            </div>
          </details>
        </div>
      )}

      {mine && (
        <>
          <h2 className="section-title">Your Machine</h2>
          <div className="pod-grid">
            <MachineTile machine={mine} now={now} />
          </div>
        </>
      )}

      {others.length > 0 && (
        <>
          <h2 className="section-title">
            Team Machines <span className="faint num small">{others.length}</span>
          </h2>
          <div className="pod-grid compact" data-testid="team-machines">
            {others.map((machine) => (
              <TeamMachineTile key={machine.id} machine={machine} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** The viewer's Machine; the whole tile opens its page. */
function MachineTile({ machine, now }: { machine: MachineView; now: Date }) {
  return (
    <Link href={`/machines/${machine.id}`} className={`pod-tile mine ${machine.connected ? "" : "off"}`} data-testid="my-machine">
      <div className="row between">
        <span className="pod-icon">{Icon.host}</span>
        <MachineStatusChip connected={machine.connected} paired={machine.paired} />
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <h3>{machineName(machine)}</h3>
        <div className="chips-row">
          <ReadyChip ready={machine.ready} />
          <span className="pill plain">{`${machine.owner.name ?? machine.owner.email} · you`}</span>
        </div>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <div className="chips-row">
          {/* The account Runs use, in the login chip itself: "Claude phamhuyqn92 · Pro". */}
          <LoginChip ok={machine.claudeLoggedIn} label={claudeAccountLabel(machine) ? "Claude" : "Claude Code"} account={claudeAccountLabel(machine)} />
          <LoginChip ok={machine.ghLoggedIn} label="gh" account={machine.ghAccount} />
        </div>
        <div className="small faint">
          <span className="mono">{machine.hostname ?? "—"}</span> · {osLabel(machine.os, machine.arch) || "unknown"} · checked{" "}
          {ago(machine.loginsCheckedAt, now)}
        </div>
      </div>

      <MachineResources machine={machine} />

      <div className="stack" style={{ gap: 6 }}>
        <div className="chips-row">
          <SlotChips inUse={machine.inUse} slots={machine.slots} queued={machine.queued} />
        </div>
        <SlotBar slots={machine.slots} inUse={machine.inUse} />
        <div className="small">
          <DiskStatus machine={machine} />
        </div>
      </div>
    </Link>
  );
}

/** Another Member's Machine: a smaller tile with status, Ready and Slots only. */
function TeamMachineTile({ machine }: { machine: MachineView }) {
  return (
    <Link href={`/machines/${machine.id}`} className={`pod-tile compact ${machine.connected ? "" : "off"}`}>
      <div className="row between" style={{ flexWrap: "nowrap" }}>
        <h3 className="clip">{machineName(machine)}</h3>
        <MachineStatusChip connected={machine.connected} paired={machine.paired} />
      </div>
      <span className="small faint clip">{machine.owner.email}</span>
      <div className="chips-row">
        <ReadyChip ready={machine.ready} />
        <SlotChips inUse={machine.inUse} slots={machine.slots} queued={machine.queued} />
      </div>
      <MachineResources machine={machine} />
      <div className="small">
        <DiskStatus machine={machine} advice={false} />
      </div>
    </Link>
  );
}
