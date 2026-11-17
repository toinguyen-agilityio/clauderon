"use server";

import { revalidatePath } from "next/cache";
import { enableRepository, enableableRepositories, syncProject } from "../../../server/projects";
import { deps, requireMember } from "../../../server/runtime";

export type EnableState = { error: string | null };
export type SyncState = { message: string | null; error: string | null };

const ENABLE_ERRORS = {
  "other-owner": "All Projects must share one owner.",
  exists: "That repository is already enabled.",
  "not-readable": "The app's token cannot read that repository.",
  "no-branch": "Pick one of the repository's branches.",
} as const;

export async function loadRepositories() {
  await requireMember();
  try {
    return { repositories: await enableableRepositories(deps()), error: null };
  } catch (error) {
    return { repositories: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export async function loadBranches(owner: string, repo: string): Promise<string[]> {
  await requireMember();
  return deps().github.listBranches(owner, repo);
}

export async function enableAction(_state: EnableState, form: FormData): Promise<EnableState> {
  const member = await requireMember();
  const [owner, repo] = String(form.get("repository") ?? "").split("/");
  const result = await enableRepository(deps(), member, { owner: owner ?? "", repo: repo ?? "", baseBranch: String(form.get("baseBranch") ?? "") });
  revalidatePath("/projects");
  return { error: result.ok ? null : ENABLE_ERRORS[result.reason] };
}

export async function syncAction(_state: SyncState, form: FormData): Promise<SyncState> {
  const member = await requireMember();
  const result = await syncProject(deps(), member, String(form.get("projectId") ?? ""));
  revalidatePath("/projects");
  revalidatePath("/tickets");
  if (result === "not-found") return { message: null, error: "That Project no longer exists." };
  if (!result.ok) return { message: null, error: result.error };
  const { added, updated, closed } = result.summary;
  return { message: `${added} added, ${updated} updated, ${closed} closed`, error: null };
}
