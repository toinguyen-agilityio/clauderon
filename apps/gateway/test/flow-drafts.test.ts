import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FLOW_DRAFT_TIMEOUT_MS } from "@clauderon/core";
import { seedSamples, sql, type Db, type Member } from "@clauderon/db";
import type { BrowserEvent, LinkSocket, Payload } from "@clauderon/protocol";
import { createTestDatabase, machineRow, memberRow, memorySocketPair, type FakeAgent, type TestDatabase } from "@clauderon/testing";
import { startGateway } from "./harness";

const TOKEN = "ann-machine-token";
const DRAFT = "11111111-2222-4333-8444-555555555555";

let test: TestDatabase;
let db: Db;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, machine, node, flow, flow_version cascade`);
  await seedSamples(db);
});

const flowFile = (extra: object[] = []) =>
  JSON.stringify({
    format: "clauderon-flow",
    version: 1,
    name: "Plan it",
    nodes: [{ ref: "n1", use: "Ticket" }, ...extra],
    placements: [{ id: "p1", node: "n1", label: null, extraInstructions: "", enabledOptionalOutputs: [], x: 0, y: 0 }],
    edges: [],
  });
const answer = (json: string) => `Here it is.\n\`\`\`json\n${json}\n\`\`\``;

async function setup() {
  const ann = await memberRow(db, "ann@example.com");
  await machineRow(db, ann.id, { token: TOKEN });
  const started = await startGateway(db, TOKEN);
  const [browser, gatewaySide] = memorySocketPair();
  const events: BrowserEvent[] = [];
  browser.onMessage((text) => events.push(JSON.parse(text) as BrowserEvent));
  const ask = async (request: object, socket: LinkSocket = gatewaySide, member: Member = ann) => {
    await started.gateway.drafts.handle(socket, member, JSON.stringify(request));
    await started.flush();
  };
  return { ...started, ann, events, ask, gatewaySide };
}

/** The fake Agent answers each `flow.draft` with the next reply. */
function answerWith(agent: FakeAgent, replies: Omit<Payload<"flow.drafted">, "jobId">[]) {
  agent.respond("flow.draft", ({ jobId }, a) => {
    const reply = replies.shift();
    if (reply) a.send("flow.drafted", { jobId, ...reply });
  });
}

describe("Flow Drafts (ADR 0008)", () => {
  it("refuses an Agent too old to know flow.draft, and sends nothing to it", async () => {
    const { agent, events, ask } = await setup();
    await ask({ type: "draft.start", draftId: DRAFT, description: "Plan the ticket" });
    expect(events).toEqual([{ type: "draft.failed", draftId: DRAFT, error: expect.stringContaining("too old") }]);
    expect(agent.of("flow.draft")).toEqual([]);
  });

  it("sends the prompt to the Member's Machine and gives the browser the checked file with its new Nodes", async () => {
    const { agent, events, ask, reconnect, flush } = await setup();
    reconnect({ agentVersion: "0.5.0+abc" });
    await flush();
    const newNode = { ref: "n2", name: "Summarise", kind: "agent", instructions: "Sum up.", command: null, inputs: [{ name: "issue", type: "issue", required: true }], outputs: [] };
    answerWith(agent, [{ exitCode: 0, finalText: answer(flowFile([newNode])), sessionId: "sess-1" }]);

    await ask({ type: "draft.start", draftId: DRAFT, description: "Plan the ticket" });
    const [sent] = agent.of("flow.draft");
    expect(sent).toMatchObject({ draftId: DRAFT, prompt: expect.stringContaining("Plan the ticket") });
    expect(sent!.resumeSessionId).toBeUndefined();
    expect(events).toEqual([{ type: "draft.ready", draftId: DRAFT, flow: expect.any(String), newNodes: ["Summarise"] }]);
    const file = JSON.parse((events[0] as { flow: string }).flow) as { nodes: { kind: string }[] };
    expect(file.nodes[0]!.kind).toBe("input");
  });

  it("asks the same session once to fix an invalid answer, then gives up", async () => {
    const { agent, events, ask, reconnect, flush } = await setup();
    reconnect({ agentVersion: "0.5.0" });
    await flush();
    answerWith(agent, [
      { exitCode: 0, finalText: "No JSON here", sessionId: "sess-1" },
      { exitCode: 0, finalText: "Still none", sessionId: "sess-1" },
    ]);
    await ask({ type: "draft.start", draftId: DRAFT, description: "Plan the ticket" });

    const calls = agent.of("flow.draft");
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ resumeSessionId: "sess-1", prompt: expect.stringContaining("not a valid Flow file") });
    expect(events).toEqual([{ type: "draft.failed", draftId: DRAFT, error: expect.stringContaining("not valid") }]);
  });

  it("a change resumes the session; a lost session starts a fresh one carrying the draft and the note", async () => {
    const { agent, events, ask, reconnect, flush } = await setup();
    reconnect({ agentVersion: "0.5.0" });
    await flush();
    answerWith(agent, [
      { exitCode: 0, finalText: answer(flowFile()), sessionId: "sess-1" },
      { exitCode: 1, error: "Claude Code exited 1", unknownSession: true },
      { exitCode: 0, finalText: answer(flowFile()), sessionId: "sess-2" },
    ]);
    await ask({ type: "draft.start", draftId: DRAFT, description: "Plan the ticket" });
    const flow = (events[0] as { flow: string }).flow;
    await ask({ type: "draft.revise", draftId: DRAFT, description: "Plan the ticket", flow, note: "Add a review step" });

    const calls = agent.of("flow.draft");
    expect(calls).toHaveLength(3);
    expect(calls[1]).toMatchObject({ resumeSessionId: "sess-1", prompt: expect.stringContaining("Add a review step") });
    expect(calls[2]!.resumeSessionId).toBeUndefined();
    expect(calls[2]!.prompt).toContain("Your earlier draft");
    expect(calls[2]!.prompt).toContain("Add a review step");
    expect(events.map((e) => e.type)).toEqual(["draft.ready", "draft.ready"]);
  });

  it("kills a call that takes too long, and one whose browser cancels or goes away", async () => {
    const { agent, events, ask, reconnect, flush, clock, gateway, gatewaySide } = await setup();
    reconnect({ agentVersion: "0.5.0" });
    await flush();
    await ask({ type: "draft.start", draftId: DRAFT, description: "Plan the ticket" });
    const [first] = agent.of("flow.draft");
    // In heartbeat-sized steps, so the Machine stays connected.
    for (let t = 0; t <= FLOW_DRAFT_TIMEOUT_MS; t += 5_000) {
      await clock.advance(5_000);
      await flush();
    }
    expect(agent.of("flow.draftKill")).toEqual([{ jobId: first!.jobId }]);
    expect(events).toEqual([{ type: "draft.failed", draftId: DRAFT, error: expect.stringContaining("longer than 3 minutes") }]);

    await ask({ type: "draft.start", draftId: DRAFT, description: "Again" });
    await ask({ type: "draft.cancel", draftId: DRAFT });
    expect(agent.of("flow.draftKill")).toHaveLength(2);

    await ask({ type: "draft.start", draftId: DRAFT, description: "Once more" });
    gateway.drafts.drop(gatewaySide);
    await flush();
    expect(agent.of("flow.draftKill")).toHaveLength(3);
  });
});
