import Link from "next/link";
import { notFound } from "next/navigation";
import { terminalAccess } from "../../../../../server/pods";
import { deps, gatewayUrl, requireMember } from "../../../../../server/runtime";
import { Terminal } from "./terminal";

export const dynamic = "force-dynamic";

/** The Pod terminal (POD-9): the owner's only; anyone else gets 404. */
export default async function TerminalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await requireMember();
  const access = await terminalAccess(deps(), member, id);
  if (access === "not-found") notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pod terminal</h1>
          <p className="sub">
            A shell in your Pod as <span className="mono">pod</span>. Log in with <span className="mono">claude</span> and{" "}
            <span className="mono">gh auth login</span>; logins are checked again when you close this page. Nothing you type is stored.
          </p>
        </div>
        <Link className="btn" href="/pods">
          Back to Pods
        </Link>
      </div>
      {access.pod.status === "running" ? (
        <Terminal gatewayUrl={gatewayUrl()} podId={access.pod.id} />
      ) : (
        <div className="banner info">
          <div className="grow small">Your Pod is {access.pod.status}. Start it from the Pods page to open a terminal.</div>
        </div>
      )}
    </>
  );
}
