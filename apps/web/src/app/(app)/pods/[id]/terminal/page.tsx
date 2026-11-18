import Link from "next/link";
import { notFound } from "next/navigation";
import { isSetupStep, SETUP_COMMANDS } from "../../../../../server/pod-setup";
import { terminalAccess } from "../../../../../server/pods";
import { deps, gatewayUrl, requireMember } from "../../../../../server/runtime";
import { Terminal } from "./terminal";

export const dynamic = "force-dynamic";

/**
 * The Pod terminal (POD-9): the owner's only; anyone else gets 404.
 * `?run=setup|claude|gh` types one of the setup commands once the shell is up.
 */
export default async function TerminalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
  const [{ id }, { run }] = await Promise.all([params, searchParams]);
  const member = await requireMember();
  const access = await terminalAccess(deps(), member, id);
  if (access === "not-found") notFound();
  const command = isSetupStep(run) ? SETUP_COMMANDS[run] : undefined;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pod terminal</h1>
          <p className="sub">
            {command ? (
              <>Running your Pod&apos;s setup. Follow the prompts; when it says Done, go back to your Pod page.</>
            ) : (
              <>
                A shell in your Pod as <span className="mono">pod</span>. Log in with <span className="mono">claude</span> and{" "}
                <span className="mono">gh auth login</span>.
              </>
            )}{" "}
            Logins are checked again when you leave this page. Nothing you type is stored.
          </p>
        </div>
        <Link className="btn" href={`/pods/${id}`}>
          Back to my Pod
        </Link>
      </div>
      {access.pod.status === "running" ? (
        <Terminal gatewayUrl={gatewayUrl()} podId={access.pod.id} command={command} />
      ) : (
        <div className="banner info">
          <div className="grow small">
            Your Pod is {access.pod.status}. Start it from <Link href={`/pods/${id}`}>its page</Link> to open a terminal.
          </div>
        </div>
      )}
    </>
  );
}
