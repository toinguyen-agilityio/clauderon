import Link from "next/link";
import { notFound } from "next/navigation";
import { ago, formatTime } from "../../../../../../components/format";
import { compareSnapshots, viewFlowVersion, type ChangeStatus, type LinkChange, type NodeChange } from "../../../../../../server/flows";
import { deps, requireMember } from "../../../../../../server/runtime";
import { VersionActions } from "../version-actions";

export const dynamic = "force-dynamic";

const KIND: Record<string, [letter: string, label: string]> = {
  ticket: ["T", "Ticket"],
  input: ["I", "Input"],
  agent: ["A", "Agent"],
  command: ["$", "Command"],
  approve: ["H", "Human · Approve"],
  grill: ["H", "Human · Grill"],
};

const STATUS: Record<ChangeStatus, [mark: string, label: string]> = {
  added: ["+", "Added"],
  removed: ["−", "Removed"],
  changed: ["~", "Changed"],
  same: ["", "Unchanged"],
};

const FIELD: Record<NodeChange["fields"][number], string> = { kind: "kind", instructions: "instructions", extraInstructions: "extra instructions" };

/** A Node's instructions (or its command), and its extra instructions, as reading blocks. */
function NodeText({ node, kind, tone }: { node: NonNullable<NodeChange["after"]>; kind: string; tone?: "before" | "after" }) {
  const body = node.instructions.trim();
  const extra = node.extraInstructions.trim();
  return (
    <div className={`vd-text${tone ? ` is-${tone}` : ""}`}>
      {tone && <span className="vd-text-tag">{tone === "before" ? "Before" : "After"}</span>}
      {body ? (
        <pre className={kind === "command" ? "vd-cmd" : "vd-prose"}>{body}</pre>
      ) : (
        <p className="vd-empty">{kind === "command" ? "No command." : "No instructions."}</p>
      )}
      {extra && (
        <div className="vd-extra">
          <span>Extra instructions</span>
          <pre className="vd-prose">{extra}</pre>
        </div>
      )}
    </div>
  );
}

function NodeRow({ change }: { change: NodeChange }) {
  const [letter, kindLabel] = KIND[change.kind] ?? ["?", change.kind];
  const [mark, label] = STATUS[change.status];
  const node = (change.after ?? change.before)!;
  return (
    <li className={`vd-row is-${change.status}`} data-testid="version-node">
      <span className="vd-mark" aria-hidden>
        {mark}
      </span>
      <details className="vd-node" open={change.status === "added" || change.status === "changed" || change.status === "removed"}>
        <summary>
          <span className={`kind ${change.kind}`} title={kindLabel}>
            {letter}
          </span>
          <span className="vd-name">{change.name}</span>
          <span className="vd-kind">{kindLabel}</span>
          {change.status !== "same" && <span className="vd-status">{change.status === "changed" ? `Changed ${change.fields.map((f) => FIELD[f]).join(", ")}` : label}</span>}
        </summary>
        {change.status === "changed" ? (
          <div className="vd-split">
            <NodeText node={change.before!} kind={change.before!.kind} tone="before" />
            <NodeText node={change.after!} kind={change.kind} tone="after" />
          </div>
        ) : (
          <NodeText node={node} kind={change.kind} />
        )}
      </details>
    </li>
  );
}

function LinkRow({ change }: { change: LinkChange }) {
  const { from, output, to, input } = change.link;
  return (
    <li className={`vd-link is-${change.status}`}>
      <span className="vd-mark" aria-hidden>
        {STATUS[change.status][0]}
      </span>
      <span className="vd-end vd-from">
        <b>{from}</b> <code>{output}</code>
      </span>
      <span className="vd-arrow" aria-label="to">
        →
      </span>
      <span className="vd-end vd-to">
        <b>{to}</b> <code>{input}</code>
      </span>
      {change.status !== "same" && <span className="vd-status">{STATUS[change.status][1]}</span>}
    </li>
  );
}

/** One change of a Flow: what it changed, the Flow's Nodes and connections against the version before, and Restore or Clone (issue #181). */
export default async function FlowVersionPage({ params }: { params: Promise<{ id: string; versionId: string }> }) {
  await requireMember();
  const { id, versionId } = await params;
  const uuid = /^[0-9a-f-]{36}$/i;
  const view = uuid.test(id) && uuid.test(versionId) ? await viewFlowVersion(deps(), id, versionId) : null;
  if (!view) notFound();
  const lockedReason = view.lock ? `Locked by Run ${view.lock.runId.slice(0, 6)} (${view.lock.state.replaceAll("_", " ")}).` : null;
  const { entry } = view;
  const first = view.before === null;
  const diff = compareSnapshots(view.before, view.after);
  const changedNodes = diff.nodes.filter((n) => n.status !== "same");
  const sameNodes = diff.nodes.filter((n) => n.status === "same");
  const changedLinks = diff.links.filter((l) => l.status !== "same");
  const sameLinks = diff.links.filter((l) => l.status === "same");
  const tally = (s: ChangeStatus) => diff.nodes.filter((n) => n.status === s).length;
  const linkTally = (s: ChangeStatus) => diff.links.filter((l) => l.status === s).length;
  const renamed = view.before && view.before.name !== view.after.name;
  const history = `/flows/${id}/history`;

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/flows">Flows</Link> /{" "}
        {view.deleted ? <span>{view.flowName}</span> : <Link href={`/flows/${id}`}>{view.flowName}</Link>} / <Link href={history}>History</Link> /{" "}
        <span>Version {entry.seq}</span>
      </nav>

      <header className="card ver-head">
        <div className="ver-stamp" aria-hidden>
          <span>Ver</span>
          <b>{entry.seq}</b>
          <span>of {view.count}</span>
        </div>
        <div className="ver-title">
          <span className={`ver-kind k-${entry.kind}`}>{entry.label}</span>
          <h1>{view.after.name}</h1>
          <p className="ver-meta">
            by <b>{entry.actorName ?? entry.actorEmail}</b>
            <span aria-hidden>·</span>
            <time dateTime={entry.at.toISOString()} title={formatTime(entry.at)}>
              {formatTime(entry.at)}
            </time>
            <span className="faint">({ago(entry.at)})</span>
          </p>
        </div>
        <VersionActions flowId={id} versionId={versionId} flowExists={!view.deleted} lockedReason={lockedReason} />
      </header>

      {view.deleted && (
        <div className="banner wait">
          <div className="grow small">
            <b>This Flow was deleted.</b> Its history stays here; clone this version to use it again.
          </div>
        </div>
      )}

      <section className="card ver-sheet" aria-labelledby="ver-changed">
        <div className="ver-sheet-h">
          <h2 id="ver-changed">{first ? "The first version" : "What changed"}</h2>
          {!first && (
            <ul className="ver-tally" aria-label="Changes">
              <li className="is-added">
                <b>{tally("added")}</b> added
              </li>
              <li className="is-removed">
                <b>{tally("removed")}</b> removed
              </li>
              <li className="is-changed">
                <b>{tally("changed")}</b> changed
              </li>
              <li>
                <b>{linkTally("added") + linkTally("removed")}</b> connection{linkTally("added") + linkTally("removed") === 1 ? "" : "s"} changed
              </li>
            </ul>
          )}
        </div>
        {entry.summary.length > 0 ? (
          <ul className="ver-summary" data-testid="version-summary">
            {entry.summary.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="ver-none">{first ? "Nothing came before it. Below is the Flow as it was saved." : "No change to the Nodes or connections was recorded."}</p>
        )}
        {renamed && (
          <p className="ver-rename">
            Renamed from <s>{view.before!.name}</s> to <b>{view.after.name}</b>
          </p>
        )}
      </section>

      <section className="card ver-diff" aria-labelledby="ver-nodes" data-testid="graph-after">
        <div className="ver-diff-h">
          <h2 id="ver-nodes">Nodes</h2>
          <span className="faint small">
            {view.after.nodes.length} in this version{view.before ? `, ${view.before.nodes.length} before` : ""}
          </span>
        </div>
        {changedNodes.length > 0 && (
          <ul className="vd-list">
            {changedNodes.map((n, i) => (
              <NodeRow key={`c${i}`} change={n} />
            ))}
          </ul>
        )}
        {sameNodes.length > 0 &&
          (first || changedNodes.length === 0 ? (
            <ul className="vd-list">
              {sameNodes.map((n, i) => (
                <NodeRow key={`s${i}`} change={n} />
              ))}
            </ul>
          ) : (
            <details className="vd-more">
              <summary>
                {sameNodes.length} unchanged Node{sameNodes.length === 1 ? "" : "s"}
              </summary>
              <ul className="vd-list">
                {sameNodes.map((n, i) => (
                  <NodeRow key={`s${i}`} change={n} />
                ))}
              </ul>
            </details>
          ))}
      </section>

      <section className="card ver-diff" aria-labelledby="ver-links">
        <div className="ver-diff-h">
          <h2 id="ver-links">Connections</h2>
          <span className="faint small">{view.after.links.length} in this version</span>
        </div>
        {diff.links.length === 0 && <p className="ver-none">No connections.</p>}
        {changedLinks.length > 0 && (
          <ul className="vd-list">
            {changedLinks.map((l, i) => (
              <LinkRow key={`c${i}`} change={l} />
            ))}
          </ul>
        )}
        {sameLinks.length > 0 &&
          (first || changedLinks.length === 0 ? (
            <ul className="vd-list">
              {sameLinks.map((l, i) => (
                <LinkRow key={`s${i}`} change={l} />
              ))}
            </ul>
          ) : (
            <details className="vd-more">
              <summary>
                {sameLinks.length} unchanged connection{sameLinks.length === 1 ? "" : "s"}
              </summary>
              <ul className="vd-list">
                {sameLinks.map((l, i) => (
                  <LinkRow key={`s${i}`} change={l} />
                ))}
              </ul>
            </details>
          ))}
      </section>

      <nav className="ver-step" aria-label="Versions">
        {view.olderId ? (
          <Link className="btn sm" href={`${history}/${view.olderId}`}>
            ← Older version
          </Link>
        ) : (
          <span />
        )}
        <Link className="btn ghost sm" href={history}>
          All versions
        </Link>
        {view.newerId ? (
          <Link className="btn sm" href={`${history}/${view.newerId}`}>
            Newer version →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
