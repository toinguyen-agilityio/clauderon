import { describe, expect, it } from "vitest";
import { ago, formatTime } from "../src/components/format";
import { appVersion } from "../src/server/version";

describe("formatTime", () => {
  it("shows Vietnam time with a zone label", () => {
    expect(formatTime(new Date("2026-11-26T02:15:00Z"))).toBe("2026-11-26 09:15 (GMT+7)");
  });

  it("rolls over to the Vietnam date near midnight UTC", () => {
    expect(formatTime(new Date("2026-11-25T20:30:00Z"))).toBe("2026-11-26 03:30 (GMT+7)");
  });

  it("shows midnight as 00, not 24", () => {
    expect(formatTime(new Date("2026-11-25T17:05:00Z"))).toBe("2026-11-26 00:05 (GMT+7)");
  });

  it("never says UTC", () => {
    expect(formatTime(new Date("2026-01-01T00:00:00Z"))).not.toContain("UTC");
  });

  it("shows a dash for no time", () => {
    expect(formatTime(null)).toBe("—");
  });

  it("leaves relative times unchanged", () => {
    const now = new Date("2026-11-26T02:15:00Z");
    expect(ago(new Date("2026-11-26T02:14:50Z"), now)).toBe("just now");
    expect(ago(new Date("2026-11-26T02:12:00Z"), now)).toBe("3 min ago");
  });
});

describe("appVersion", () => {
  it("uses APP_VERSION when it is set", () => {
    expect(appVersion({ APP_VERSION: "v0.8.0" })).toBe("v0.8.0");
  });

  it("is null when unset, so the sidebar shows no version", () => {
    expect(appVersion({})).toBeNull();
    expect(appVersion({ APP_VERSION: "" })).toBeNull();
    expect(appVersion({ APP_VERSION: "  " })).toBeNull();
  });
});
