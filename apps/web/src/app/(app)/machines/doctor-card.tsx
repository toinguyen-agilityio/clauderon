import type { MachineDoctor } from "@clauderon/db";
import { ago } from "../../../components/format";
import { Icon } from "../../../components/icons";
import { CmdBox } from "./cmd-box";

const ORDER = { fail: 0, warn: 1, ok: 2 } as const;
const DOT = { ok: "succeeded", warn: "warned", fail: "failed" } as const;

/** The doctor writes commands in lower case (`brew install gh`) and steps as sentences ("Run the install command…"). */
const looksLikeCommand = (fix: string) => /^[a-z]/.test(fix);

/**
 * The Agent's doctor (ADR 0007): what this Machine misses, worst first, each
 * with the step that fixes it on its operating system. Only the owner sees
 * the fixes; others see the checks.
 */
export function DoctorCard({ doctor, mine, now }: { doctor: MachineDoctor; mine: boolean; now: Date }) {
  const checks = [...doctor.checks].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const problems = checks.filter((c) => c.status !== "ok").length;
  return (
    <div className="card card-pad stack" data-testid="machine-doctor">
      <div className="row between">
        <span className="eyebrow">Health</span>
        <span className={`pill ${problems === 0 ? "ok plain" : checks.some((c) => c.status === "fail") ? "fail" : "wait"}`}>
          {problems === 0 ? "All good" : `${problems} to fix`}
        </span>
      </div>
      <ul className="checklist left">
        {checks.map((check) => (
          <li key={check.id}>
            <span className={`ndot sm ${DOT[check.status]}`}>{check.status === "ok" ? Icon.check : check.status === "fail" ? Icon.x : null}</span>
            <div className="stack" style={{ gap: 4 }}>
              <span className="small">
                <b>{check.title}</b>
                {check.detail && <span className="faint"> · {check.detail}</span>}
              </span>
              {mine && check.fix && (looksLikeCommand(check.fix) ? <CmdBox command={check.fix} /> : <span className="small muted">{check.fix}</span>)}
            </div>
          </li>
        ))}
      </ul>
      <p className="faint small">Checked {ago(new Date(doctor.checkedAt), now)} on the computer itself. After fixing, press Check logins: it runs these checks again.</p>
    </div>
  );
}
