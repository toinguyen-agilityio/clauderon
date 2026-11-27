import { describe, expect, it } from "vitest";
import { readTour, TOUR_KEY, writeTour } from "../src/components/tour/storage";

const memory = (initial?: string) => {
  const data = new Map<string, string>(initial === undefined ? [] : [[TOUR_KEY, initial]]);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe("tour storage", () => {
  it("treats a missing value as a new Member", () => {
    expect(readTour(memory())).toEqual({ status: "new", step: 0 });
    expect(readTour(null)).toEqual({ status: "new", step: 0 });
  });

  it("falls back to new on corrupt JSON or a wrong shape", () => {
    for (const bad of ["{nope", "42", "null", '{"status":"done"}', '{"status":"inProgress","step":-3}', '{"status":"skipped","lang":"fr"}']) {
      expect(readTour(memory(bad)).status).toBe("new");
    }
  });

  it("never throws when storage itself throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(readTour(broken).status).toBe("new");
    expect(() => writeTour(broken, { status: "skipped", step: 0 })).not.toThrow();
  });

  it("round-trips finished, skipped and in progress", () => {
    for (const status of ["finished", "skipped", "inProgress"] as const) {
      const store = memory();
      writeTour(store, { status, step: 3, lang: "vi" });
      expect(readTour(store)).toEqual({ status, step: 3, lang: "vi" });
    }
  });
});
