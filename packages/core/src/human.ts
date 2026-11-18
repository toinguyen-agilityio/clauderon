// Human Nodes and Retry (spec M3 §2, §4): the shapes stored on
// `human_request` and `attempt.retry_context`, and the prompt parts built from
// them. Pure functions, shared by the Gateway and the web app.

export type GrillQuestion = { id: string; text: string };
export type GrillAnswers = Record<string, string>;

/** `human_request.response`: what the person decided, or that a Cancel closed it. */
export type HumanResponse =
  | { decision: "approve" }
  | { decision: "reject"; feedback: string }
  | { decision: "answer"; answers: GrillAnswers }
  | { cancelled: true };

/** What an Approve request holds in `questions`: the input Output it passes through. */
export type ApproveSubject = { input: { name: string; type: string; value: unknown } | null };

/**
 * The questions of a Grill result (M0 §6), or null when the result holds none.
 * Malformed questions (no id, no text, a repeated id) are refused with a reason.
 */
export function parseGrillQuestions(result: unknown): { ok: true; questions: GrillQuestion[] } | { ok: false; reason: string } | null {
  if (!result || typeof result !== "object" || !("questions" in result)) return null;
  const raw = (result as { questions: unknown }).questions;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, reason: "The Grill result holds no questions" };
  const questions: GrillQuestion[] = [];
  const seen = new Set<string>();
  for (const [i, q] of raw.entries()) {
    const text = typeof q === "string" ? q : (q as { text?: unknown })?.text;
    const id = typeof q === "string" ? `q${i + 1}` : (q as { id?: unknown })?.id;
    if (typeof text !== "string" || !text.trim() || typeof id !== "string" || !id.trim()) {
      return { ok: false, reason: "Each Grill question needs an id and a text" };
    }
    if (seen.has(id)) return { ok: false, reason: `Grill question id ${id} is repeated` };
    seen.add(id);
    questions.push({ id, text: text.trim() });
  }
  return { ok: true, questions };
}

/** Every question answered with some text (spec M3 §2.2: each answer required). */
export function checkAnswers(questions: readonly GrillQuestion[], answers: GrillAnswers): { ok: true; answers: GrillAnswers } | { ok: false; error: string } {
  const clean: GrillAnswers = {};
  for (const q of questions) {
    const answer = (answers[q.id] ?? "").trim();
    if (!answer) return { ok: false, error: `Answer every question: “${q.text}” is empty.` };
    clean[q.id] = answer;
  }
  return { ok: true, answers: clean };
}

/** The prompt that resumes a Grill session with a round's answers. */
export function buildGrillAnswerPrompt(questions: readonly GrillQuestion[], answers: GrillAnswers, outputs: readonly string[]): string {
  const sections = ["Here are the answers to your questions."];
  for (const q of questions) sections.push(`### ${q.text}\n\n${answers[q.id] ?? ""}`);
  sections.push(resultContract(outputs, true));
  return `${sections.join("\n\n")}\n`;
}

/**
 * The result contract of M0 §6 at the end of an Agent or Grill prompt. A
 * Grill Node may finish with questions instead of its Outputs.
 */
export function resultContract(outputs: readonly string[], grill: boolean): string {
  const example = Object.fromEntries(outputs.filter((o) => o !== "branch").map((o) => [o, `<${o}>`]));
  const lines = [
    "## Result",
    "",
    "Finish your final message with one fenced JSON block, the last one in the message, naming your Outputs:",
    "",
    "```json",
    JSON.stringify({ outputs: example }),
    "```",
  ];
  if (grill) {
    lines.push(
      "",
      "If you need a person to answer questions before you can produce your Outputs, ask them all in one batch instead, as one fenced JSON block, the last one in the message:",
      "",
      "```json",
      JSON.stringify({ questions: [{ id: "q1", text: "<question>" }] }),
      "```",
    );
  }
  if (outputs.includes("branch")) lines.push("", "Commit your work on the current branch before you finish. The branch is reported for you; do not push.");
  return lines.join("\n");
}

/** `attempt.retry_context` (RUN-7): what a retried Node is told. */
export type RetryContext = {
  /** The Run's latest Reject feedback. */
  feedback: string | null;
  /** Why the failed Node failed. */
  failure: { node: string; exitCode: number | null; error: string | null; lastLines: string } | null;
  note: string | null;
  retriedBy: string;
};

export const FEEDBACK_HEADING = "Feedback from the last review";

/** Lines of log kept for the retry context: 200 for a Command Node (RUN-7), fewer for an Agent's chatty log. */
export function retryLogLines(kind: string): number {
  return kind === "command" ? 200 : 50;
}

/** The retry context as Markdown, for a prompt or the Command Node's file; "" when empty. */
export function renderRetryContext(context: RetryContext | null | undefined): string {
  if (!context) return "";
  const sections: string[] = [];
  if (context.feedback) sections.push(`## ${FEEDBACK_HEADING}\n\n${context.feedback}`);
  if (context.failure) {
    const { node, exitCode, error, lastLines } = context.failure;
    const head = [`“${node}” failed${exitCode !== null ? ` with exit code ${exitCode}` : ""}${error ? `: ${error}` : "."}`];
    if (lastLines.trim()) head.push("", "Its last log lines:", "", "```", lastLines, "```");
    sections.push(`## Why the last attempt failed\n\n${head.join("\n")}`);
  }
  if (context.note) sections.push(`## Note from ${context.retriedBy}\n\n${context.note}`);
  return sections.join("\n\n");
}
