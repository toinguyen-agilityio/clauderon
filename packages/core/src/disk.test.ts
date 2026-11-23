import { describe, expect, it } from "vitest";
import { diskState } from "./disk";

describe("diskState", () => {
  it("is ok from 5 GB, low below it, critical below 1 GB", () => {
    expect([5, 4.9, 1, 0.9, 0].map(diskState)).toEqual(["ok", "low", "low", "critical", "critical"]);
  });
  it("is unknown, not critical, when the Machine did not say", () => {
    expect([null, undefined, NaN].map(diskState)).toEqual(["unknown", "unknown", "unknown"]);
  });
});
