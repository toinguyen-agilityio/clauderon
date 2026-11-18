import { describe, expect, it } from "vitest";
import { OTHER_CHOICE, answersFromForm } from "../src/server/grill-answers";

const form = (fields: [string, string][]) => {
  const data = new FormData();
  for (const [k, v] of fields) data.append(k, v);
  return data;
};

describe("Grill answers from the form", () => {
  it("takes a free answer, a chosen option, several options, and Other's text", () => {
    expect(
      answersFromForm(
        form([
          ["requestId", "r"],
          ["answer:q1", " /totals "],
          ["answer:q2", "Per invoice"],
          ["answer:q3", "CSV"],
          ["answer:q3", "XLSX"],
          ["answer:q4", OTHER_CHOICE],
          ["other:q4", " Ask finance first "],
          ["answer:q5", "CSV"],
          ["answer:q5", OTHER_CHOICE],
          ["other:q5", "ODS"],
        ]),
      ),
    ).toEqual({ q1: "/totals", q2: "Per invoice", q3: "CSV; XLSX", q4: "Ask finance first", q5: "CSV; ODS" });
  });

  it("an empty Other, or text typed beside an unpicked Other, leaves the answer empty so it is refused", () => {
    expect(answersFromForm(form([["answer:q1", OTHER_CHOICE], ["other:q1", "  "]]))).toEqual({ q1: "" });
    expect(answersFromForm(form([["other:q2", "typed but not picked"]]))).toEqual({ q2: "" });
    expect(answersFromForm(form([["answer:q3", "Yes"], ["other:q3", "ignored"]]))).toEqual({ q3: "Yes" });
  });
});
