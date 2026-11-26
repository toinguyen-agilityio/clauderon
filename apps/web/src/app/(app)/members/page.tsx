import Link from "next/link";
import { Avatar } from "../../../components/brand";
import { ago, formatTime } from "../../../components/format";
import { Icon } from "../../../components/icons";
import { viewMembers, type MemberRow } from "../../../server/members";
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
  if (!machine) return <span className="faint">No Machine</span>;
  const missing = machine.paired ? [!machine.claudeLoggedIn && "Claude Code", !machine.ghLoggedIn && "gh"].filter(Boolean) : [];
  return (
    <div className="members-machine">
      <Link href={`/machines/${machine.id}`} className="members-machine-link">
        <MachineStatusChip connected={machine.connected} paired={machine.paired} />
      </Link>
      {missing.length > 0 && <span className="faint small">{missing.join(" and ")} not logged in</span>}
    </div>
  );
}

export default async function MembersPage() {
  const viewer = await requireMember();
  const { rows, canManage, viewerEmail } = await viewMembers(deps(), viewer);
  const now = new Date();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Members</h1>
          <p className="sub">
            Everyone who can sign in with Google, and their Machine.{" "}
            {canManage
              ? "Removing a member ends their sessions at once and removes their Machine; their Runs and audit entries are kept."
              : "Owners add and remove members."}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head members-head">
          <h2>
            Team <span className="faint small num">{rows.filter((r) => r.status !== "removed").length}</span>
          </h2>
          {canManage && <AddEmailForm />}
        </div>
        <div className="tbl-wrap">
          <table className="tbl members">
            <thead>
              <tr>
                <th>Member</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th>Machine</th>
                <th>Active Runs</th>
                {canManage && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const [tone, label, hint] = STATUS[m.status];
                const who = m.name ?? m.email;
                const you = m.email === viewerEmail;
                return (
                  <tr key={m.email} className={m.status === "removed" ? "members-removed" : undefined}>
                    <td>
                      <div className="members-who">
                        <Avatar name={m.name} email={m.email} picture={m.pictureUrl} />
                        <div className="members-id">
                          <span className="members-name">
                            {m.name ?? <span className="faint">No name yet</span>}
                            {you && <span className="faint small"> (you)</span>}
                          </span>
                          <span className="mono faint">{m.email}</span>
                        </div>
                        {m.operator && (
                          <span className="tag" title="Set in the app's configuration; manages members and Projects">
                            Owner
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`pill ${tone}`} title={hint}>
                        {label}
                      </span>
                    </td>
                    <td className="small nowrap">
                      {m.lastSignInAt ? <span title={formatTime(m.lastSignInAt)}>{ago(m.lastSignInAt, now)}</span> : <span className="faint">Never</span>}
                    </td>
                    <td>
                      <MachineCell machine={m.machine} />
                    </td>
                    <td className="nowrap">
                      {m.machine && m.machine.activeRuns > 0 ? (
                        <Link className="members-runs" href={`/runs?machine=${m.machine.id}`} title={`Open ${who}'s Runs`}>
                          {Icon.runs}
                          {m.machine.activeRuns} {m.machine.activeRuns === 1 ? "Run" : "Runs"}
                        </Link>
                      ) : (
                        <span className="faint">None</span>
                      )}
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
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
