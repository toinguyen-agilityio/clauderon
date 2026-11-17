"use client";

import { useActionState, useEffect, useState } from "react";
import type { Repository } from "@clauderon/core";
import { Icon } from "../../../components/icons";
import { enableAction, loadBranches, loadRepositories, syncAction, type EnableState, type SyncState } from "./actions";

/** Enable a repository (PRJ-1): pick one the app's token reads, then its base branch. */
export function EnableForm() {
  const [state, action, pending] = useActionState<EnableState, FormData>(enableAction, { error: null });
  const [repos, setRepos] = useState<Repository[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [branches, setBranches] = useState<string[] | null>(null);

  useEffect(() => {
    void loadRepositories().then((r) => {
      setRepos(r.repositories);
      setLoadError(r.error);
      setSelected("");
    });
  }, [state]);

  const repo = repos?.find((r) => `${r.owner}/${r.repo}` === selected);
  useEffect(() => {
    setBranches(null);
    if (repo) void loadBranches(repo.owner, repo.repo).then(setBranches, () => setBranches([repo.defaultBranch]));
  }, [repo]);

  const placeholder = repos === null ? "Loading repositories…" : loadError ? "Cannot list repositories" : repos.length === 0 ? "No repository left to enable" : "Pick a repository…";
  return (
    <form action={action} className="card-pad row" style={{ borderTop: "1px solid var(--line)", alignItems: "flex-end" }}>
      <div className="field grow" style={{ minWidth: 220 }}>
        <label htmlFor="pj-repo">Enable a repository</label>
        <select id="pj-repo" className="select" style={{ width: "100%" }} name="repository" value={selected} onChange={(e) => setSelected(e.target.value)} required disabled={!repos?.length}>
          <option value="">{placeholder}</option>
          {repos?.map((r) => (
            <option key={`${r.owner}/${r.repo}`} value={`${r.owner}/${r.repo}`}>
              {r.owner}/{r.repo}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ width: 180 }}>
        <label htmlFor="pj-base">Base branch</label>
        <select id="pj-base" className="select" style={{ width: "100%" }} name="baseBranch" key={selected} defaultValue={repo?.defaultBranch} required disabled={!repo}>
          {!repo && <option value="">—</option>}
          {repo && (branches ?? [repo.defaultBranch]).map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <button className="btn primary" type="submit" disabled={pending || !repo}>
        {Icon.plus}
        Enable Project
      </button>
      {(state.error ?? loadError) && (
        <p className="err-text" role="alert" style={{ flexBasis: "100%" }}>
          {state.error ?? loadError}
        </p>
      )}
    </form>
  );
}

export function SyncForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<SyncState, FormData>(syncAction, { message: null, error: null });
  return (
    <form action={action} className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
      <input type="hidden" name="projectId" value={projectId} />
      {state.message && <span className="faint small nowrap">{state.message}</span>}
      <button className="btn sm" type="submit" disabled={pending}>
        <span className={pending ? "spin" : undefined} style={{ display: "inline-flex" }}>
          {Icon.sync}
        </span>
        {pending ? "Syncing…" : "Sync"}
      </button>
    </form>
  );
}
