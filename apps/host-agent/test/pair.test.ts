import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FakeClock, settle } from "@clauderon/testing";
import { PAIR_POLL_MS, httpBase, pair } from "../src/pair";

type Call = { url: string; init?: RequestInit };

/** The Gateway's pairing endpoints, scripted. */
function fakeGateway(statuses: string[], create: { status: number; body: unknown } = { status: 201, body: { pairingId: "p-1", code: "ABCDEFGH", expiresAt: "2026-11-16T09:10:00Z" } }) {
  const calls: Call[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith("/api/agent-config")) return Response.json({ gatewayUrl: "wss://gw.app.test", webUrl: "https://app.test" });
    if (init?.method === "POST") return new Response(JSON.stringify(create.body), { status: create.status });
    return new Response(JSON.stringify({ status: statuses.shift() ?? "pending" }), { status: 200 });
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}

const machine = { hostname: "ann-mac", os: "darwin", arch: "arm64" };

async function waitFor(clock: FakeClock, result: Promise<unknown>, polls: number) {
  for (let i = 0; i < polls; i++) {
    await settle();
    await clock.advance(PAIR_POLL_MS);
  }
  return result;
}

describe("pair (ADR 0006)", () => {
  it("sends only the token's hash, shows the code and resolves with the token once approved", async () => {
    const clock = new FakeClock();
    const gateway = fakeGateway(["pending", "approved"]);
    const lines: string[] = [];
    const result = pair({ url: "wss://gateway.test/", machine, clock, print: (l) => lines.push(l), fetch: gateway.fetch, newToken: () => "tok" });
    expect(await waitFor(clock, result, 3)).toEqual({ gatewayUrl: "wss://gateway.test", token: "tok" });

    const [create, ...checks] = gateway.calls;
    expect(create!.url).toBe("https://gateway.test/pair");
    expect(JSON.parse(String(create!.init!.body))).toEqual({ tokenHash: createHash("sha256").update("tok").digest("hex"), ...machine });
    expect(String(create!.init!.body)).not.toContain('"tok"');
    expect(checks.map((c) => [c.url, (c.init!.headers as Record<string, string>).authorization])).toEqual([
      ["https://gateway.test/pair/p-1", "Bearer tok"],
      ["https://gateway.test/pair/p-1", "Bearer tok"],
    ]);
    expect(lines[0]).toMatch(/^Pairing code: ABCD-EFGH/);
  });

  it("fails when the code expires", async () => {
    const clock = new FakeClock();
    const gateway = fakeGateway(["expired"]);
    const result = pair({ url: "ws://gateway.test", machine, clock, print: () => {}, fetch: gateway.fetch });
    result.catch(() => {});
    await expect(waitFor(clock, result, 2)).rejects.toThrow("expired");
  });

  it("says why the Gateway refused", async () => {
    const gateway = fakeGateway([], { status: 503, body: { error: "too many pending pairings, try again later" } });
    await expect(pair({ url: "ws://gateway.test", machine, clock: new FakeClock(), print: () => {}, fetch: gateway.fetch })).rejects.toThrow(
      "(503): too many pending pairings",
    );
  });

  it("takes the web app's URL: asks it for the Gateway and opens the page that approves the code", async () => {
    const clock = new FakeClock();
    const gateway = fakeGateway(["approved"]);
    const opened: string[] = [];
    const result = pair({ url: "https://app.test/", machine, clock, print: () => {}, fetch: gateway.fetch, newToken: () => "tok", openUrl: (u) => void opened.push(u) });
    expect(await waitFor(clock, result, 2)).toEqual({ gatewayUrl: "wss://gw.app.test", token: "tok" });
    expect(gateway.calls.map((c) => c.url)).toEqual(["https://app.test/api/agent-config", "https://gw.app.test/pair", "https://gw.app.test/pair/p-1"]);
    expect(opened).toEqual(["https://app.test/pair?code=ABCDEFGH"]);
  });

  it("prefers the approve link the Gateway sends", async () => {
    const clock = new FakeClock();
    const body = { pairingId: "p-1", code: "ABCDEFGH", expiresAt: "2026-11-16T09:10:00Z", approveUrl: "https://web.test/pair?code=ABCDEFGH" };
    const gateway = fakeGateway(["approved"], { status: 201, body });
    const opened: string[] = [];
    await waitFor(clock, pair({ url: "wss://gateway.test", machine, clock, print: () => {}, fetch: gateway.fetch, openUrl: (u) => void opened.push(u) }), 2);
    expect(opened).toEqual(["https://web.test/pair?code=ABCDEFGH"]);
  });

  it("refuses something that is not a URL", async () => {
    await expect(pair({ url: "clauderon.example.com", machine, clock: new FakeClock(), print: () => {}, fetch: fakeGateway([]).fetch })).rejects.toThrow("not a URL");
  });

  it("maps the link URL to HTTP", () => {
    expect(httpBase("wss://g.example.com/")).toBe("https://g.example.com");
    expect(httpBase("ws://localhost:4000")).toBe("http://localhost:4000");
    expect(httpBase("http://localhost:4000")).toBe("http://localhost:4000");
  });
});
