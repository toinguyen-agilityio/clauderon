import Link from "next/link";
import { notFound } from "next/navigation";
import { editorData } from "../../../../server/flows";
import { deps, requireMember } from "../../../../server/runtime";
import { FlowEditor } from "./flow-editor";

export const dynamic = "force-dynamic";

export default async function FlowPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMember();
  const { id } = await params;
  // A malformed id is simply not a Flow.
  const data = /^[0-9a-f-]{36}$/i.test(id) ? await editorData(deps(), id) : null;
  if (!data) notFound();

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/flows">Flows</Link> / <span>{data.flow.name}</span>
      </nav>
      {data.flow.isSample && (
        <div className="banner info" data-testid="sample-banner">
          <div className="grow small">
            <b>Sample Flows are read-only.</b> Clone it from the Flows page to change it.
          </div>
        </div>
      )}
      {data.lock && (
        <div className="banner wait" data-testid="lock-banner">
          <div className="grow small">
            <b>
              Locked by Run <Link href={`/runs/${data.lock.runId}`}>{data.lock.runId.slice(0, 6)}</Link> ({data.lock.state.replaceAll("_", " ")}).
            </b>{" "}
            You can look at this Flow, but it can only be changed when that Run ends.
          </div>
        </div>
      )}
      <FlowEditor data={data} />
    </>
  );
}
