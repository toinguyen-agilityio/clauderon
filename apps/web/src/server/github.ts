import type { GitHubReader, Issue, OpenPullRequest, PullRequest, Repository } from "@clauderon/core";

// The GitHub reader over the REST API with the app's read-only token
// (`GITHUB_TOKEN`, PRJ-2). Sync never writes to GitHub (TIC-9).

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type ApiIssue = {
  number: number;
  title: string;
  body: string | null;
  labels: (string | { name?: string })[];
  user: { login: string } | null;
  author_association: string;
  state: "open" | "closed";
  html_url: string;
  pull_request?: unknown;
};

function toIssue(i: ApiIssue): Issue {
  return {
    number: i.number,
    title: i.title,
    body: i.body ?? "",
    labels: i.labels.map((l) => (typeof l === "string" ? l : (l.name ?? ""))).filter(Boolean),
    authorLogin: i.user?.login ?? "ghost",
    authorAssociation: i.author_association,
    state: i.state,
    url: i.html_url,
  };
}

const encode = (owner: string, repo: string) => `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

export function gitHubApi(token: string, fetcher: typeof fetch = fetch): GitHubReader {
  async function request<T>(path: string): Promise<{ data: T; next: string | null }> {
    const res = await fetcher(path.startsWith("http") ? path : `${API}${path}`, {
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28" },
      cache: "no-store",
    });
    if (!res.ok) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      const reason =
        res.status === 401 ? "the token was revoked or is invalid" : remaining === "0" ? "the rate limit is used up" : `GitHub answered ${res.status}`;
      throw new GitHubError(`GitHub: ${reason}`, res.status);
    }
    const next = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get("link") ?? "")?.[1] ?? null;
    return { data: (await res.json()) as T, next };
  }

  async function all<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    for (let url: string | null = path; url; ) {
      const page: { data: T[]; next: string | null } = await request<T[]>(url);
      items.push(...page.data);
      url = page.next;
    }
    return items;
  }

  return {
    async listRepositories(): Promise<Repository[]> {
      const repos = await all<{ owner: { login: string }; name: string; default_branch: string }>("/user/repos?per_page=100&sort=full_name");
      return repos.map((r) => ({ owner: r.owner.login, repo: r.name, defaultBranch: r.default_branch }));
    },
    async listBranches(owner, repo) {
      return (await all<{ name: string }>(`/repos/${encode(owner, repo)}/branches?per_page=100`)).map((b) => b.name);
    },
    async listOpenIssues(owner, repo) {
      const issues = await all<ApiIssue>(`/repos/${encode(owner, repo)}/issues?state=open&per_page=100`);
      return issues.filter((i) => !i.pull_request).map(toIssue);
    },
    async getIssue(owner, repo, number) {
      try {
        return toIssue((await request<ApiIssue>(`/repos/${encode(owner, repo)}/issues/${number}`)).data);
      } catch (error) {
        if (error instanceof GitHubError && (error.status === 404 || error.status === 410)) return null;
        throw error;
      }
    },
    async findPullRequest(owner, repo, branch): Promise<PullRequest | null> {
      const head = encodeURIComponent(`${owner}:${branch}`);
      const { data } = await request<{ number: number; state: "open" | "closed"; merged_at: string | null; html_url: string; head: { ref: string } }[]>(
        `/repos/${encode(owner, repo)}/pulls?state=all&head=${head}&per_page=1`,
      );
      const pr = data[0];
      if (!pr) return null;
      return { number: pr.number, branch: pr.head.ref, state: pr.merged_at ? "merged" : pr.state, url: pr.html_url };
    },
    async listOpenPullRequests(owner, repo): Promise<OpenPullRequest[]> {
      type Login = { login: string };
      const pulls = await all<{
        number: number;
        title: string;
        html_url: string;
        created_at: string;
        user: Login | null;
        head: { ref: string };
        requested_reviewers?: Login[] | null;
      }>(
        `/repos/${encode(owner, repo)}/pulls?state=open&per_page=100`,
      );
      return pulls.map((pr) => ({
        number: pr.number,
        branch: pr.head.ref,
        state: "open",
        url: pr.html_url,
        title: pr.title,
        authorLogin: pr.user?.login ?? "ghost",
        createdAt: new Date(pr.created_at),
        reviewers: (pr.requested_reviewers ?? []).map((u) => u.login),
      }));
    },
  };
}
