import { describe, expect, it } from "vitest";
import type { Db } from "@clauderon/db";
import { parseGatewayCommand } from "@clauderon/db";
import type { LinkSocket } from "@clauderon/protocol";
import { LiveHub } from "../src/live-hub";

/** A browser socket that records what the hub sends it. */
function socket(): LinkSocket & { sent: unknown[] } {
  const sent: unknown[] = [];
  return { sent, send: (text) => void sent.push(JSON.parse(text)), close: () => {}, onMessage: () => {}, onClose: () => {} };
}

// `subscribe.needs` and `subscribe.run` never read the database.
const hub = () => new LiveHub({} as Db);

describe("LiveHub: Needs you (#197)", () => {
  it("sends needs.changed only to sockets that sent subscribe.needs", async () => {
    const live = hub();
    const needs = socket();
    const run = socket();
    await live.handle(needs, JSON.stringify({ type: "subscribe.needs" }));
    await live.handle(run, JSON.stringify({ type: "subscribe.run", runId: "r-1" }));

    live.needsChanged();
    expect(needs.sent).toEqual([{ type: "needs.changed" }]);
    expect(run.sent).toEqual([]);
  });

  it("runChanged does not send needs.changed", async () => {
    const live = hub();
    const needs = socket();
    await live.handle(needs, JSON.stringify({ type: "subscribe.needs" }));
    live.runChanged("r-1");
    expect(needs.sent).toEqual([]);
  });

  it("drops a closed socket", async () => {
    const live = hub();
    const needs = socket();
    await live.handle(needs, JSON.stringify({ type: "subscribe.needs" }));
    live.drop(needs);
    live.needsChanged();
    expect(needs.sent).toEqual([]);
  });
});

describe("needs.changed Gateway command (#197)", () => {
  it("parses without a machineId; other types still need one", () => {
    expect(parseGatewayCommand(JSON.stringify({ type: "needs.changed" }))).toEqual({ type: "needs.changed" });
    expect(parseGatewayCommand(JSON.stringify({ type: "schedule" }))).toBeNull();
    expect(parseGatewayCommand(JSON.stringify({ type: "schedule", machineId: "m-1" }))).toEqual({ type: "schedule", machineId: "m-1" });
    expect(parseGatewayCommand(JSON.stringify({ type: "unknown" }))).toBeNull();
  });
});
