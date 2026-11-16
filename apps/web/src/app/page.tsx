import Link from "next/link";
import { getPodHost, isOperator } from "@clauderon/db";
import { signOut } from "../auth";
import { deps, requireMember } from "../server/runtime";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const member = await requireMember();
  const { db, operators } = deps();
  const host = await getPodHost(db);

  return (
    <main>
      <h1>Clauderon</h1>
      <p>
        Signed in as <strong>{member.name ?? member.email}</strong> <span className="muted">({member.email})</span>
      </p>

      {/* Temporary status line for the M0 check; M1 replaces it with the Pod Host card. */}
      <div className="status-line" data-testid="pod-host-status">
        <span className={`dot ${host?.connected ? "ok" : "bad"}`} />
        <span>Pod Host: {host?.connected ? "connected" : "not connected"}</span>
        {host?.lastHeartbeatAt && <span className="muted">· last heartbeat {host.lastHeartbeatAt.toISOString()}</span>}
      </div>

      <div className="row">
        {isOperator(member.email, operators) && (
          <Link className="button" href="/allowlist">
            Allowlist
          </Link>
        )}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/sign-in" });
          }}
        >
          <button type="submit">Sign out</button>
        </form>
      </div>
    </main>
  );
}
