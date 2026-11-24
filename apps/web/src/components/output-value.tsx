import { MarkdownText } from "./markdown-text";

/** An Output's value as the Run page and Needs you show it (TRK-2). Text (a plan, a spec…) shows as Markdown; `name` titles its expanded view. */
export function OutputValue({ type, value, name }: { type: string; value: unknown; name?: string }) {
  const v = value as Record<string, unknown> | string;
  if (typeof v === "string") return <MarkdownText text={v} title={name} />;
  if (type === "issue") return <div className="outv">#{String(v.number)} {String(v.title ?? "")}</div>;
  if (type === "branch")
    return (
      <div className="outv mono">
        {String(v.branch)}
        {v.headCommit ? <span className="faint"> @ {String(v.headCommit).slice(0, 7)}</span> : null}
      </div>
    );
  if (type === "test-result")
    return (
      <pre className="outv mono">
        Exit code {String(v.exitCode)}
        {"\n\n"}
        {String(v.tail ?? "")}
      </pre>
    );
  if (type === "pull-request")
    return (
      <div className="outv mono">
        <a href={String(v.url)} target="_blank" rel="noreferrer">
          {String(v.url)}
        </a>
      </div>
    );
  return <pre className="outv mono">{JSON.stringify(value, null, 2)}</pre>;
}
