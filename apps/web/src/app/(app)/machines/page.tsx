import Link from "next/link";
import { ago } from "../../../components/format";
import { Icon } from "../../../components/icons";
import { installCommandPs1, installCommandSh } from "../../../server/agent-install";
import { lookUpPairing, viewMachines, type MachineView } from "../../../server/machines";
import { deps, pageWebUrl, requireMember } from "../../../server/runtime";
import { CmdBox } from "./cmd-box";
import { claudeAccountLabel, DiskStatus, LoginChip, MachineResources, MachineStatusChip, ReadyChip, SlotBar, SlotChips, machineName, osLabel } from "./machine-parts";
import { PairMachine } from "./pair-machine";
import { tagColor } from "../../../components/state-pill";

export const dynamic = "force-dynamic";

export default async function MachinesPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const member = await requireMember();
  const { code } = await searchParams;
  const [{ machines, mine }, web] = await Promise.all([viewMachines(deps(), member), pageWebUrl()]);
  // The Agent opens this page with its code: show the computer, ready to approve.
  const opened = code ? await lookUpPairing(deps(), member, code) : null;
  const others = machines.filter((m) => !m.mine);
  const now = new Date();

  const pairing = opened ? (
    <section className="card mach-pair" data-testid="approve-opened">
      <h2>Approve this computer</h2>
      <p className="small muted">Your Agent opened this page. Check the computer&apos;s name, then approve it.</p>
      <PairMachine opened={opened.ok ? { pairing: opened.pairing, error: null } : { pairing: null, error: opened.error }} />
    </section>
  ) : (
    <PairSteps web={web} replacing={Boolean(mine?.paired)} />
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Machines</h1>
          <p className="sub">Each Member pairs their own computer. Runs you start run there, under your own Claude Code and gh logins.</p>
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

      {/* Until the viewer has a Machine, pairing is the page's main job; afterwards it folds away below their Machine. */}
      {(opened || !mine?.paired) && pairing}

      {mine && <MachineHero machine={mine} now={now} />}

      {mine?.paired && !opened && (
        <details className="card mach-more">
          <summary>
            {Icon.plus}
            Connect another computer <span className="faint small">Your current Machine is replaced.</span>
          </summary>
          {pairing}
        </details>
      )}

      {others.length > 0 && (
        <section className="tk-board" aria-labelledby="team-machines-h">
          <div className="tk-toolbar">
            <h2 id="team-machines-h" className="mem-count">
              Team Machines <span className="n">{others.length}</span>
              <span className="mem-online">
                <i aria-hidden />
                {others.filter((m) => m.connected).length} online
              </span>
            </h2>
          </div>
          <ul className="mach-rack" data-testid="team-machines">
            {others.map((machine) => (
              <TeamMachineRow key={machine.id} machine={machine} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** How to pair a computer: run the install command, approve it here, and the Agent keeps running. */
function PairSteps({ web, replacing }: { web: string; replacing: boolean }) {
  return (
    <section className="card mach-pair" data-testid="pair">
      {!replacing && <h2>Connect your computer</h2>}
      <ol className="mach-steps">
        <li>
          <b>Run this in a terminal on that computer.</b>
          <span className="small muted">It needs Node 22, git and gh, and logs you in to GitHub if needed.</span>
          <div className="mach-cmds">
            <span className="small">macOS or Linux</span>
            <CmdBox command={installCommandSh(web)} />
            <span className="small">
              Windows <span className="faint">(PowerShell; needs Git for Windows)</span>
            </span>
            <CmdBox command={installCommandPs1(web)} />
          </div>
        </li>
        <li>
          <b>Approve it on the page it opens.</b>
          <details className="small">
            <summary className="faint">The browser did not open? Enter the code</summary>
            <div className="stack" style={{ gap: 8, marginTop: 8 }}>
              <span className="faint">Enter the code the install command shows in your terminal:</span>
              <PairMachine />
            </div>
          </details>
        </li>
        <li>
          <b>That&apos;s it.</b>
          <span className="small muted">The Agent keeps running whenever you are logged in to that computer.</span>
        </li>
      </ol>
    </section>
  );
}

/** The viewer's Machine: who it is, its logins, resources and Slots; the whole panel opens its page. */
function MachineHero({ machine, now }: { machine: MachineView; now: Date }) {
  const state = !machine.paired ? "unpaired" : machine.connected ? "online" : "offline";
  return (
    <Link href={`/machines/${machine.id}`} className={`card mach-hero is-${state}`} data-testid="my-machine">
      <div className="mach-hero-id">
        <span className="mach-icon">
          {Icon.host}
          <i className="mach-led" aria-hidden />
        </span>
        <div className="mach-hero-name">
          <span className="faint small">Your Machine</span>
          <h2>{machineName(machine)}</h2>
          <div className="mach-facts small">
            <span className="mono">{machine.hostname ?? "—"}</span>
            <span>{osLabel(machine.os, machine.arch) || "unknown OS"}</span>
            <span className="faint">checked {ago(machine.loginsCheckedAt, now)}</span>
          </div>
        </div>
        <div className="chips-row mach-hero-state">
          <MachineStatusChip connected={machine.connected} paired={machine.paired} />
          <ReadyChip ready={machine.ready} />
        </div>
      </div>
      <div className="mach-bays">
        <div className="mach-bay">
          <h3>Logins</h3>
          <div className="mach-logins">
            {/* The account Runs use, in the login chip itself: "Claude phamhuyqn92 · Pro". */}
            <LoginChip ok={machine.claudeLoggedIn} label={claudeAccountLabel(machine) ? "Claude" : "Claude Code"} account={claudeAccountLabel(machine)} />
            <LoginChip ok={machine.ghLoggedIn} label="gh" account={machine.ghAccount} />
          </div>
        </div>
        <div className="mach-bay">
          <h3>Resources</h3>
          <MachineResources machine={machine} />
        </div>
        <div className="mach-bay">
          <h3>Slots</h3>
          <SlotBar slots={machine.slots} inUse={machine.inUse} />
          <div className="chips-row">
            <SlotChips inUse={machine.inUse} slots={machine.slots} queued={machine.queued} />
          </div>
          <div className="small">
            <DiskStatus machine={machine} />
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Another Member's Machine as one rack row, in its owner's colour: status, Ready, Slots and resources. */
function TeamMachineRow({ machine }: { machine: MachineView }) {
  const state = !machine.paired ? "unpaired" : machine.connected ? "online" : "offline";
  return (
    <li>
      <Link href={`/machines/${machine.id}`} className={`mach-row is-${state}`} style={{ "--c": tagColor(machine.owner.email) } as React.CSSProperties}>
        <span className="mach-row-stub">
          <i className="mach-led" aria-hidden />
        </span>
        <span className="mach-row-id">
          <b className="clip">{machineName(machine)}</b>
          <span className="small faint clip">{machine.owner.email}</span>
        </span>
        <span className="chips-row mach-row-state">
          <MachineStatusChip connected={machine.connected} paired={machine.paired} />
          <ReadyChip ready={machine.ready} />
        </span>
        <span className="mach-row-slots">
          <SlotBar slots={machine.slots} inUse={machine.inUse} />
          <span className="small faint">
            {machine.inUse}/{machine.slots} busy{machine.queued > 0 ? `, ${machine.queued} queued` : ""}
          </span>
        </span>
        <span className="mach-row-res">
          <MachineResources machine={machine} />
          <span className="small">
            <DiskStatus machine={machine} advice={false} />
          </span>
        </span>
      </Link>
    </li>
  );
}
