import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { schema, sql, type Db } from "@clauderon/db";
import { FakeClock, FakeGitHub, createTestDatabase, memberRow, type TestDatabase } from "@clauderon/testing";
import { appGitHubToken, removeGitHubToken, saveGitHubToken, viewGitHubAccess, type GitHubAccessDeps } from "../src/server/github-access";
import { GitHubError, gitHubApi } from "../src/server/github";
import { seal, unseal } from "../src/server/secret-box";

const SECRET = "test-session-secret";
const TOKEN = "github_pat_11AAAAAAA0abcdefghijklmnopqrstuvwxyz1234";

let test: TestDatabase;
let db: Db;
let deps: GitHubAccessDeps;
let logins: Record<string, string>;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, github_access, audit_entry cascade`);
  logins = { [TOKEN]: "acme-bot", "ghp_second0000000000000000000000000wxyz": "acme-bot-2" };
  deps = {
    db,
    operators: ["op@example.com"],
    clock: new FakeClock(new Date("2026-11-24T09:00:00Z")),
    publish: () => {},
    command: async () => {},
    github: new FakeGitHub(),
    sessionSecret: SECRET,
    gitHubLogin: async (token) => {
      const login = logins[token];
      if (!login) throw new GitHubError("GitHub: the token was revoked or is invalid", 401);
      return login;
    },
  };
});

describe("Sealing the GitHub token (ADR 0010)", () => {
  it("round-trips with the same secret, and gives nothing back under another one", () => {
    const sealed = seal(TOKEN, SECRET);
    expect(sealed).not.toContain(TOKEN.slice(12));
    expect(seal(TOKEN, SECRET)).not.toBe(sealed);
    expect(unseal(sealed, SECRET)).toBe(TOKEN);
    expect(unseal(sealed, "another-secret")).toBeNull();
    expect(unseal("v1.broken", SECRET)).toBeNull();
  });
});

describe("The app's GitHub token on the Projects page (PRJ-2, ADR 0010)", () => {
  it("an Operator saves a token GitHub accepts; it is stored sealed and shown only by login and last four characters", async () => {
    const op = await memberRow(db, "op@example.com");
    expect(await viewGitHubAccess(deps)).toBeNull();

    expect(await saveGitHubToken(deps, op, `  ${TOKEN}\n`)).toEqual({ ok: true, login: "acme-bot" });

    const [row] = await db.select().from(schema.githubAccess);
    expect(row!.tokenSealed).not.toContain(TOKEN);
    expect(await appGitHubToken(db, SECRET)).toBe(TOKEN);
    expect(await viewGitHubAccess(deps)).toEqual({ login: "acme-bot", last4: "1234", setByEmail: "op@example.com", setAt: new Date("2026-11-24T09:00:00Z") });
    const audit = await db.select().from(schema.auditEntry);
    expect(audit.map((a) => [a.action, a.detail])).toEqual([["github.token.set", { login: "acme-bot" }]]);
    expect(JSON.stringify(audit)).not.toContain(TOKEN);
  });

  it("replaces the token in place, and removes it", async () => {
    const op = await memberRow(db, "op@example.com");
    await saveGitHubToken(deps, op, TOKEN);
    expect(await saveGitHubToken(deps, op, "ghp_second0000000000000000000000000wxyz")).toEqual({ ok: true, login: "acme-bot-2" });
    expect(await db.select().from(schema.githubAccess)).toHaveLength(1);
    expect(await appGitHubToken(db, SECRET)).toBe("ghp_second0000000000000000000000000wxyz");

    expect(await removeGitHubToken(deps, op)).toBe(true);
    expect(await viewGitHubAccess(deps)).toBeNull();
    expect(await removeGitHubToken(deps, op)).toBe(false);
    expect((await db.select().from(schema.auditEntry)).map((a) => a.action)).toEqual(["github.token.set", "github.token.set", "github.token.remove"]);
  });

  it("refuses a token GitHub refuses, an empty one, and any Member who is not an Operator", async () => {
    const op = await memberRow(db, "op@example.com");
    const bob = await memberRow(db, "bob@example.com");
    expect(await saveGitHubToken(deps, op, "ghp_revoked")).toEqual({ ok: false, error: expect.stringContaining("refused") });
    expect(await saveGitHubToken(deps, op, "   ")).toEqual({ ok: false, error: "Paste a token." });
    expect(await saveGitHubToken(deps, op, "two words")).toMatchObject({ ok: false });
    expect(await saveGitHubToken(deps, bob, TOKEN)).toBe("not-found");
    expect(await removeGitHubToken(deps, bob)).toBe("not-found");
    expect(await db.select().from(schema.githubAccess)).toEqual([]);
  });

  it("GitHub reads fail with a pointer to the Projects page when no token is set or SESSION_SECRET changed", async () => {
    await expect(appGitHubToken(db, SECRET)).rejects.toThrow("An Operator adds one on the Projects page");
    const op = await memberRow(db, "op@example.com");
    await saveGitHubToken(deps, op, TOKEN);
    await expect(appGitHubToken(db, "rotated-secret")).rejects.toThrow("SESSION_SECRET changed");
  });

  it("the GitHub reader uses the token saved at the time of each request", async () => {
    const seen: (string | null)[] = [];
    const fetcher = (async (_url: string, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get("authorization"));
      return new Response("[]", { status: 200 });
    }) as typeof fetch;
    let current = "ghp_first";
    const reader = gitHubApi(async () => current, fetcher);
    await reader.listBranches("acme", "web");
    current = "ghp_second";
    await reader.listBranches("acme", "web");
    expect(seen).toEqual(["Bearer ghp_first", "Bearer ghp_second"]);
  });
});
