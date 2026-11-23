import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { claudeAccountLabel, diskFree, MachineResources, resourceLabels, usageLevel } from "../src/app/(app)/machines/machine-parts";

describe("claudeAccountLabel", () => {
  it("names the Claude account Runs use by the email's name, with its plan, in one short label", () => {
    expect(claudeAccountLabel({ claudeLoggedIn: true, claudeAccount: "ann@example.com", claudePlan: "pro" })).toBe("ann · Pro");
    expect(claudeAccountLabel({ claudeLoggedIn: true, claudeAccount: "ann@example.com", claudePlan: null })).toBe("ann");
    // Logged out, or an older Agent that does not say: nothing to show.
    expect(claudeAccountLabel({ claudeLoggedIn: false, claudeAccount: "ann@example.com", claudePlan: "pro" })).toBeNull();
    expect(claudeAccountLabel({ claudeLoggedIn: true, claudeAccount: null, claudePlan: null })).toBeNull();
  });
});

describe("resourceLabels", () => {
  const machine = { connected: true, cpus: 10, memoryMb: 24576, diskGb: 460, usage: { memoryUsedMb: 15360, diskFreeGb: 65, cpuPercent: 13 } };

  it("shows usage over the total while the Agent is online and reports it", () => {
    expect(resourceLabels(machine)).toEqual({
      cpu: { text: "13% of 10 cores", percent: 13 },
      ram: { text: "15 / 24 GB", percent: 63 },
      disk: { text: "395 / 460 GB", percent: 86 },
    });
  });

  it("shows the totals alone when the Agent is offline or sends no usage", () => {
    const totals = { cpu: { text: "10 cores", percent: null }, ram: { text: "24 GB", percent: null }, disk: { text: "460 GB", percent: null } };
    expect(resourceLabels({ ...machine, connected: false })).toEqual(totals);
    expect(resourceLabels({ ...machine, usage: null })).toEqual(totals);
    const none = { text: "—", percent: null };
    expect(resourceLabels({ connected: false, cpus: null, memoryMb: null, diskGb: null, usage: null })).toEqual({ cpu: none, ram: none, disk: none });
  });
});

describe("MachineResources (Machines list)", () => {
  const machine = { connected: true, cpus: 10, memoryMb: 24576, diskGb: 460, usage: { memoryUsedMb: 15360, diskFreeGb: 65, cpuPercent: 13 } };
  const html = (m: Parameters<typeof MachineResources>[0]["machine"]) => renderToStaticMarkup(createElement(MachineResources, { machine: m }));

  it("shows CPU, RAM and Disk with their shares and levels", () => {
    const out = html(machine);
    expect(out).toContain("13% of 10 cores");
    expect(out).toContain("15 / 24 GB");
    expect(out).toContain("395 / 460 GB");
    expect(out).toContain('aria-label="Disk in use" aria-valuenow="86"');
    expect(out).toContain("meter-fill wait"); // disk 86% is amber
    expect(html({ ...machine, usage: { ...machine.usage, diskFreeGb: 20 } })).toContain("meter-fill fail");
  });

  it("shows the totals alone, with no meter, when offline or the Agent sends no usage", () => {
    for (const m of [{ ...machine, connected: false }, { ...machine, usage: null }]) {
      const out = html(m);
      expect(out).toContain("10 cores");
      expect(out).toContain("24 GB");
      expect(out).toContain("460 GB");
      expect(out).not.toContain("role=\"meter\"");
      expect(out).not.toContain("0%");
    }
  });

  it("shows a dash for a Machine that has not reported yet", () => {
    const out = html({ connected: false, cpus: null, memoryMb: null, diskGb: null, usage: null });
    expect(out.match(/—/g)).toHaveLength(3);
    expect(out).not.toContain("role=\"meter\"");
  });
});

describe("usageLevel", () => {
  it("is green below 70%, amber from 70% and red from 90%", () => {
    expect([0, 69, 70, 89, 90, 100].map(usageLevel)).toEqual(["ok", "ok", "wait", "wait", "fail", "fail"]);
  });
});

describe("diskFree", () => {
  const base = { connected: true, diskGb: 460 };
  it("shows free over total, with advice only when low or critical", () => {
    expect(diskFree({ ...base, usage: { diskFreeGb: 65 } })).toEqual({ state: "ok", text: "65 GB free of 460 GB", advice: null });
    expect(diskFree({ ...base, usage: { diskFreeGb: 3 } })).toMatchObject({ state: "low", advice: expect.stringContaining("~/.clauderon") });
    expect(diskFree({ ...base, usage: { diskFreeGb: 0.5 } })).toMatchObject({ state: "critical", advice: expect.stringContaining("stop the Run") });
  });
  it("is critical at 0 GB free, not unknown", () => {
    expect(diskFree({ ...base, usage: { diskFreeGb: 0 } }).state).toBe("critical");
  });
  it("is unknown, not 0, when offline, not reported yet, or the disk could not be read", () => {
    const unknown = { state: "unknown", text: "unknown", advice: null };
    expect(diskFree({ ...base, connected: false, usage: { diskFreeGb: 3 } })).toEqual(unknown);
    expect(diskFree({ ...base, usage: null })).toEqual(unknown);
    expect(diskFree({ ...base, usage: {} })).toEqual(unknown);
  });
});
