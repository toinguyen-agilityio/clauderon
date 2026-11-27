import Link from "next/link";
import { Avatar } from "../../../components/brand";
import { ago, formatTime } from "../../../components/format";
import { Icon } from "../../../components/icons";
import { tagColor } from "../../../components/state-pill";
import { SortButton, SortHeader } from "../../../components/sort-header";
import { parseSort, sortRows } from "../../../components/sorting";
import { MEMBER_SORTS, memberSortKeys, viewMembers, type MemberRow } from "../../../server/members";
import { deps, requireMember } from "../../../server/runtime";
import { MachineStatusChip } from "../machines/machine-parts";
import { AddEmailForm, RemoveMachine, RemoveMember } from "./forms";

export const dynamic = "force-dynamic";

const STATUS: Record<MemberRow["status"], [tone: string, label: string, hint: string]> = {
  active: ["ok", "Active", "Has signed in"],
  invited: ["wait", "Invited", "Allowed, has not signed in yet"],
  removed: ["fail", "Removed", "No longer allowed; their Machine is still listed"],
};

function MachineCell({ machine }: { machine: MemberRow["machine"] }) {
  if (!machine) return <span className="faint small">No Machine yet</span>;
  const missing = machine.paired ? [!machine.claudeLoggedIn && "Claude Code", !machine.ghLoggedIn && "gh"].filter(Boolean) : [];
  return (
    <>
      <Link href={`/machines/${machine.id}`} className="members-machine-link">
        <MachineStatusChip connected={machine.connected} paired={machine.paired} />
      </Link>
      {missing.length > 0 && <span className="mem-missing small">{missing.join(" and ")} not logged in</span>}
    </>
  );
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ sort?: string; dir?: string }> }) {
  const viewer = await requireMember();
  const sort = parseSort(await searchParams, MEMBER_SORTS);
  const { rows, canManage, viewerEmail } = await viewMembers(deps(), viewer);
  const now = new Date();
  const team = sortRows(rows.filter((r) => r.status !== "removed"), sort, memberSortKeys);
  const removed = sortRows(rows.filter((r) => r.status === "removed"), sort, memberSortKeys);
  const online = team.filter((r) => r.machine?.connected).length;
  const cols = canManage ? 5 : 4;

  const row = (m: MemberRow) => {
    const [tone, label, hint] = STATUS[m.status];
    const who = m.name ?? m.email;
    const you = m.email === viewerEmail;
    return (
      <tr key={m.email} className={`tk-row tone-${tone} mem-row${m.status === "removed" ? " members-removed" : ""}`} style={{ "--c": tagColor(m.email) } as React.CSSProperties}>
        <td className="tk-stub mem-stub">
          <Avatar name={m.name} email={m.email} picture={m.pictureUrl} />
        </td>
        <td>
          <div className="members-id">
            <span className="members-name">
              {m.name ?? <span className="faint">No name yet</span>}
              {you && <span className="mem-you">you</span>}
              {m.operator && (
                <span className="tag mem-owner" title="Set in the app's configuration; manages members and Projects">
                  Owner
                </span>
              )}
            </span>
            <span className="mono faint">{m.email}</span>
          </div>
        </td>
        <td className="nowrap">
          <span className={`pill ${tone}`} title={hint}>
            {label}
          </span>
          <div className="mem-sub">
            {m.lastSignInAt ? <span title={formatTime(m.lastSignInAt)}>Signed in {ago(m.lastSignInAt, now)}</span> : "Never signed in"}
          </div>
        </td>
        <td>
          <div className="members-machine">
            <MachineCell machine={m.machine} />
            {m.machine && m.machine.activeRuns > 0 && (
              <Link className="members-runs" href={`/runs?machine=${m.machine.id}`} title={`Open ${who}'s Runs`}>
                {Icon.runs}
                {m.machine.activeRuns} active {m.machine.activeRuns === 1 ? "Run" : "Runs"}
              </Link>
            )}
          </div>
        </td>
        {canManage && (
          <td className="actions">
            <div className="row members-actions">
              {m.status === "removed" && m.machine ? (
                <RemoveMachine machineId={m.machine.id} who={who} />
              ) : (
                !m.operator && <RemoveMember email={m.email} who={who} hasMachine={m.machine !== null} />
              )}
            </div>
          </td>
        )}
      </tr>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Members</h1>
          <p className="sub">Everyone who can sign in with Google, and the Machine their Runs run on. {canManage ? "" : "Owners add and remove members."}</p>
        </div>
      </div>

      <section className="tk-board" aria-label="Members">
        <div className="tk-toolbar members-head">
          <h2 className="mem-count">
            Team <span className="n">{team.length}</span>
            <span className="mem-online">
              <i aria-hidden />
              {online} online
            </span>
          </h2>
          {canManage && (
            <div className="tk-tools">
              <AddEmailForm />
            </div>
          )}
        </div>
        <div className="tbl-wrap">
          <table className="tbl tk-table members">
            <thead>
              <tr>
                <th className="tk-stub">
                  <span className="sr-only">Photo</span>
                </th>
                <SortHeader column="member" label="Member" />
                <th aria-label="Status, and last sign-in">
                  <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                    <SortButton column="status" label="Status" />
                    <SortButton column="signin" label="Last sign-in" first="desc" />
                  </div>
                </th>
                <SortHeader column="machine" label="Machine" />
                {canManage && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>{team.map(row)}</tbody>
            {removed.length > 0 && (
              <tbody>
                <tr className="mem-group">
                  <th colSpan={cols} scope="colgroup">
                    No longer on the team <span className="faint">Their Machine is still listed until it is removed.</span>
                  </th>
                </tr>
                {removed.map(row)}
              </tbody>
            )}
          </table>
        </div>
      </section>
    </>
  );
}
