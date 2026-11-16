import { notFound } from "next/navigation";
import { viewAllowlist } from "../../../server/access";
import { deps, requireMember } from "../../../server/runtime";
import { removeEmail } from "./actions";
import { AddEmailForm } from "./add-form";

export const dynamic = "force-dynamic";

const formatTime = (date: Date) => date.toISOString().replace("T", " ").slice(0, 16) + " UTC";

export default async function AllowlistPage() {
  const member = await requireMember();
  const view = await viewAllowlist(deps(), member);
  if (view === "not-found") notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Allowlist</h1>
          <p className="sub">
            Exact email addresses that can sign in with Google. Operator emails come from configuration and cannot be removed. Removing
            an email ends that Member&apos;s sessions at once; their Pod, Runs and audit entries are kept.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            Allowed emails <span className="faint small num">· {view.rows.length}</span>
          </h2>
          <AddEmailForm />
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Email</th>
                <th>Added by</th>
                <th>Added</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => (
                <tr key={row.email}>
                  <td className="mono">{row.email}</td>
                  <td>{row.fromConfiguration ? <span className="tag">from configuration</span> : <span className="muted">{row.addedByEmail}</span>}</td>
                  <td className="faint small num">{row.addedAt ? formatTime(row.addedAt) : "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    {!row.fromConfiguration && (
                      <form action={removeEmail}>
                        <input type="hidden" name="email" value={row.email} />
                        <button type="submit" className="btn danger sm">
                          Remove
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
