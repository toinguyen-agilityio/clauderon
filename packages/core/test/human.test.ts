import { describe, expect, it } from "vitest";
import {
  FEEDBACK_HEADING,
  buildAgentPrompt,
  buildGrillAnswerPrompt,
  checkAnswers,
  extractResultBlock,
  parseGrillQuestions,
  renderRetryContext,
  retryLogLines,
} from "../src/index";

describe("Grill results (spec M3 §2.2)", () => {
  it("reads a batch of questions, and none when the result holds Outputs", () => {
    expect(parseGrillQuestions({ questions: [{ id: "q1", text: " Which endpoint? " }] })).toEqual({ ok: true, questions: [{ id: "q1", text: "Which endpoint?" }] });
    expect(parseGrillQuestions({ outputs: { plan: "x" } })).toBeNull();
    expect(parseGrillQuestions(undefined)).toBeNull();
  });

  it("accepts plain strings as questions and numbers them", () => {
    expect(parseGrillQuestions({ questions: ["A?", "B?"] })).toEqual({ ok: true, questions: [{ id: "q1", text: "A?" }, { id: "q2", text: "B?" }] });
  });

  it("refuses empty, malformed or repeated questions with a reason", () => {
    expect(parseGrillQuestions({ questions: [] })).toEqual({ ok: false, reason: "The Grill result holds no questions" });
    expect(parseGrillQuestions({ questions: [{ id: "q1" }] })).toMatchObject({ ok: false });
    expect(parseGrillQuestions({ questions: [{ id: "q1", text: "a" }, { id: "q1", text: "b" }] })).toEqual({ ok: false, reason: "Grill question id q1 is repeated" });
  });

  it("keeps suggested options: one recommendation listed first for a single choice, several for a multi-select", () => {
    const single = parseGrillQuestions({
      questions: [{ id: "q1", text: "Rounding?", options: ["Per line", { label: "Per invoice", recommended: true }, { label: "Per day", recommended: true }, " ", "Per line"] }],
    });
    expect(single).toEqual({
      ok: true,
      questions: [{ id: "q1", text: "Rounding?", options: [{ label: "Per invoice", recommended: true }, { label: "Per line" }, { label: "Per day" }] }],
    });
    const multi = parseGrillQuestions({
      questions: [{ id: "q1", text: "Formats?", multiSelect: true, options: [{ label: "CSV", recommended: true }, { label: "XLSX", recommended: true }] }],
    });
    expect(multi).toEqual({
      ok: true,
      questions: [{ id: "q1", text: "Formats?", multiSelect: true, options: [{ label: "CSV", recommended: true }, { label: "XLSX", recommended: true }] }],
    });
    // multiSelect means nothing without options; too many options are cut.
    expect(parseGrillQuestions({ questions: [{ id: "q1", text: "Open?", multiSelect: true, options: [] }] })).toEqual({ ok: true, questions: [{ id: "q1", text: "Open?" }] });
    const many = parseGrillQuestions({ questions: [{ id: "q1", text: "Pick", options: ["a", "b", "c", "d", "e", "f", "g", "h"] }] });
    expect(many?.ok ? many.questions[0]!.options : []).toHaveLength(6);
  });

  it("requires every answer", () => {
    const questions = [{ id: "q1", text: "A?" }, { id: "q2", text: "B?" }];
    expect(checkAnswers(questions, { q1: " yes ", q2: "no" })).toEqual({ ok: true, answers: { q1: "yes", q2: "no" } });
    expect(checkAnswers(questions, { q1: "yes", q2: "  " })).toMatchObject({ ok: false });
  });

  it("a Grill prompt allows questions; the answer prompt holds every question and answer", () => {
    const prompt = buildAgentPrompt({ instructions: "Plan it.", placementInstructions: "", batchInstructions: "", inputs: [], outputs: ["plan"], grill: true });
    expect(prompt).toContain('"options":[{"label":"<option you recommend>","recommended":true}');
    expect(prompt).toContain('"multiSelect":true');
    const plain = buildAgentPrompt({ instructions: "Plan it.", placementInstructions: "", batchInstructions: "", inputs: [], outputs: ["plan"] });
    expect(plain).not.toContain("questions");

    const answer = buildGrillAnswerPrompt([{ id: "q1", text: "Which endpoint?" }], { q1: "/totals" }, ["plan"]);
    expect(answer).toContain("### Which endpoint?\n\n/totals");
    expect(answer).toContain('{"outputs":{"plan":"<plan>"}}');
  });

  it("reads a bare JSON message as the result, as a resumed session may answer", () => {
    expect(extractResultBlock('{"questions": [{"id": "q1", "text": "Why?"}]}')).toEqual({ questions: [{ id: "q1", text: "Why?" }] });
    expect(extractResultBlock("no json here")).toBeNull();
  });
});

describe("Retry context (RUN-7)", () => {
  const context = {
    feedback: "Use the ledger service.",
    failure: { node: "Run tests", exitCode: 1, error: "Command exited 1", lastLines: "FAIL totals.test.ts" },
    note: "Try again with the fix.",
    retriedBy: "bo@example.com",
  };

  it("renders the feedback heading, exit code, last lines and note", () => {
    const text = renderRetryContext(context);
    expect(text).toContain(`## ${FEEDBACK_HEADING}\n\nUse the ledger service.`);
    expect(text).toContain("“Run tests” failed with exit code 1: Command exited 1");
    expect(text).toContain("FAIL totals.test.ts");
    expect(text).toContain("## Note from bo@example.com\n\nTry again with the fix.");
    expect(renderRetryContext(null)).toBe("");
  });

  it("goes into the Agent prompt before the result contract", () => {
    const prompt = buildAgentPrompt({ instructions: "Code.", placementInstructions: "", batchInstructions: "", inputs: [], outputs: ["summary"], retryContext: context });
    expect(prompt.indexOf(FEEDBACK_HEADING)).toBeGreaterThan(0);
    expect(prompt.indexOf(FEEDBACK_HEADING)).toBeLessThan(prompt.indexOf("## Result"));
  });

  it("keeps 200 lines for a Command Node", () => {
    expect(retryLogLines("command")).toBe(200);
    expect(retryLogLines("agent")).toBeLessThan(200);
  });
});
