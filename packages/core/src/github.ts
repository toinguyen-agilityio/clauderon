// What the app reads from GitHub with the read-only token (PRJ-2, TIC-5).
// M0 fixes the seam; M1 implements it against the GitHub API.

export type Repository = { owner: string; repo: string; defaultBranch: string };

export type Issue = {
  number: number;
  title: string;
  body: string;
  labels: string[];
  authorLogin: string;
  authorAssociation: string;
  state: "open" | "closed";
  url: string;
};

export type PullRequest = {
  number: number;
  branch: string;
  state: "open" | "merged" | "closed";
  url: string;
};

/** An open pull request of a repository, whoever opened it; `reviewers` are the logins asked to review it. */
export type OpenPullRequest = PullRequest & { state: "open"; title: string; authorLogin: string; createdAt: Date; reviewers: string[] };

export interface GitHubReader {
  listRepositories(): Promise<Repository[]>;
  listBranches(owner: string, repo: string): Promise<string[]>;
  listOpenIssues(owner: string, repo: string): Promise<Issue[]>;
  getIssue(owner: string, repo: string, number: number): Promise<Issue | null>;
  findPullRequest(owner: string, repo: string, branch: string): Promise<PullRequest | null>;
  listOpenPullRequests(owner: string, repo: string): Promise<OpenPullRequest[]>;
}
