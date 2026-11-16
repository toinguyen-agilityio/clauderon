import Link from "next/link";
import { notFound } from "next/navigation";
import { viewAllowlist } from "../../server/access";
import { deps, requireMember } from "../../server/runtime";
import { removeEmail } from "./actions";
import { AddEmailForm } from "./add-form";

export const dynamic = "force-dynamic";

const formatTime = (date: Date) => date.toISOString().replace("T", " ").slice(0, 16) + " UTC";

export default async function AllowlistPage() {
  const member = await requireMember();
  const view = await viewAllowlist(deps(), member);
  if (view === "not-found") notFound();

  return (
    <main>
      <p>
        <Link href="/">← Clauderon</Link>
      </p>
      <h1>Allowlist</h1>
      <p className="muted">Exact email addresses that can sign in with Google. Removing one ends that Member&apos;s sessions at once.</p>
      <AddEmailForm />
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Added by</th>
            <th>Added</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => (
            <tr key={row.email}>
              <td>{row.email}</td>
              <td className="muted">{row.fromConfiguration ? "from configuration" : row.addedByEmail}</td>
              <td className="muted">{row.addedAt ? formatTime(row.addedAt) : "—"}</td>
              <td>
                {!row.fromConfiguration && (
                  <form action={removeEmail}>
                    <input type="hidden" name="email" value={row.email} />
                    <button type="submit">Remove</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
