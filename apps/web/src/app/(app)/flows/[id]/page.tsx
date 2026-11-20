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

  // The editor runs edge to edge; why it is read-only floats over the canvas.
  const notice = data.lock ? (
    <div className="fe-notice wait" data-testid="lock-banner">
      <b>
        Locked by Run <Link href={`/runs/${data.lock.runId}`}>{data.lock.runId.slice(0, 6)}</Link> ({data.lock.state.replaceAll("_", " ")}).
      </b>{" "}
      You can look at this Flow, but it can only be changed when that Run ends.
    </div>
  ) : undefined;

  return <FlowEditor data={data} notice={notice} />;
}
