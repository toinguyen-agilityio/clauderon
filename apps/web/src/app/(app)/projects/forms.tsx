"use client";

import { useActionState, useEffect, useState } from "react";
import type { Repository } from "@clauderon/core";
import { enableAction, loadBranches, loadRepositories, syncAction, type EnableState, type SyncState } from "./actions";

/** Enable a repository (PRJ-1): pick one the token reads, then its base branch. */
export function EnableForm() {
  const [state, action, pending] = useActionState<EnableState, FormData>(enableAction, { error: null });
  const [repos, setRepos] = useState<Repository[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [branches, setBranches] = useState<string[]>([]);

  useEffect(() => {
    void loadRepositories().then((r) => {
      setRepos(r.repositories);
      setLoadError(r.error);
    });
  }, [state]);

  const repo = repos?.find((r) => `${r.owner}/${r.repo}` === selected);
  useEffect(() => {
    setBranches([]);
    if (repo) void loadBranches(repo.owner, repo.repo).then(setBranches);
  }, [repo]);

  return (
    <form action={action} className="row" style={{ flexWrap: "wrap" }}>
      <select className="input" name="repository" value={selected} onChange={(e) => setSelected(e.target.value)} required aria-label="Repository">
        <option value="">{repos === null ? "Loading repositories…" : repos.length === 0 ? "No repository to enable" : "Enable a repository…"}</option>
        {repos?.map((r) => (
          <option key={`${r.owner}/${r.repo}`} value={`${r.owner}/${r.repo}`}>
            {r.owner}/{r.repo}
          </option>
        ))}
      </select>
      {repo && (
        <select className="input" name="baseBranch" defaultValue={repo.defaultBranch} key={selected} required aria-label="Base branch">
          {(branches.length > 0 ? branches : [repo.defaultBranch]).map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      )}
      <button className="btn primary" type="submit" disabled={pending || !repo}>
        Enable
      </button>
      {(state.error ?? loadError) && <span className="err-text">{state.error ?? loadError}</span>}
    </form>
  );
}

export function SyncForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<SyncState, FormData>(syncAction, { message: null, error: null });
  return (
    <form action={action} className="row" style={{ justifyContent: "flex-end" }}>
      <input type="hidden" name="projectId" value={projectId} />
      {state.message && <span className="faint small">{state.message}</span>}
      {state.error && <span className="err-text small">{state.error}</span>}
      <button className="btn sm" type="submit" disabled={pending}>
        {pending ? "Syncing…" : "Sync"}
      </button>
    </form>
  );
}
