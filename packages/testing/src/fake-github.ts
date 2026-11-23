import type { GitHubReader, Issue, OpenPullRequest, PullRequest, Repository } from "@clauderon/core";

type FakePullRequest = PullRequest & Partial<Pick<OpenPullRequest, "title" | "authorLogin" | "createdAt" | "reviewers">>;
type RepoData = Repository & { branches: string[]; issues: Issue[]; pullRequests: FakePullRequest[] };

/** Repositories, branches, issues and pull requests held in memory. */
export class FakeGitHub implements GitHubReader {
  private repos = new Map<string, RepoData>();

  addRepository(repo: Repository & Partial<Pick<RepoData, "branches" | "issues" | "pullRequests">>): this {
    this.repos.set(`${repo.owner}/${repo.repo}`, {
      branches: [repo.defaultBranch],
      issues: [],
      pullRequests: [],
      ...repo,
    });
    return this;
  }

  addIssue(owner: string, repo: string, issue: Partial<Issue> & Pick<Issue, "number" | "title">): this {
    this.get(owner, repo).issues.push({
      body: "",
      labels: [],
      authorLogin: "octocat",
      authorAssociation: "MEMBER",
      state: "open",
      url: `https://github.com/${owner}/${repo}/issues/${issue.number}`,
      ...issue,
    });
    return this;
  }

  addPullRequest(owner: string, repo: string, pullRequest: FakePullRequest): this {
    this.get(owner, repo).pullRequests.push(pullRequest);
    return this;
  }

  async listRepositories(): Promise<Repository[]> {
    return [...this.repos.values()].map(({ owner, repo, defaultBranch }) => ({ owner, repo, defaultBranch }));
  }

  async listBranches(owner: string, repo: string): Promise<string[]> {
    return [...this.get(owner, repo).branches];
  }

  async listOpenIssues(owner: string, repo: string): Promise<Issue[]> {
    return this.get(owner, repo).issues.filter((i) => i.state === "open");
  }

  async getIssue(owner: string, repo: string, number: number): Promise<Issue | null> {
    return this.get(owner, repo).issues.find((i) => i.number === number) ?? null;
  }

  async findPullRequest(owner: string, repo: string, branch: string): Promise<PullRequest | null> {
    return this.get(owner, repo).pullRequests.find((p) => p.branch === branch) ?? null;
  }

  async listOpenPullRequests(owner: string, repo: string): Promise<OpenPullRequest[]> {
    return this.get(owner, repo)
      .pullRequests.filter((p) => p.state === "open")
      .map((p) => ({ title: `Pull request ${p.number}`, authorLogin: "octocat", createdAt: new Date(0), reviewers: [], ...p, state: "open" }));
  }

  private get(owner: string, repo: string): RepoData {
    const data = this.repos.get(`${owner}/${repo}`);
    if (!data) throw new Error(`Repository ${owner}/${repo} is not readable`);
    return data;
  }
}
