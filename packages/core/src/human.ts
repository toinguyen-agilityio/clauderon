// Human Nodes and Retry (spec M3 §2, §4): the shapes stored on
// `human_request` and `attempt.retry_context`, and the prompt parts built from
// them. Pure functions, shared by the Gateway and the web app.

/** A suggested answer; Claude may mark the one it recommends. */
export type GrillOption = { label: string; recommended?: boolean };
/**
 * One Grill question. With `options`, the form offers them plus "Other" for a
 * free answer; `multiSelect` lets the person pick several.
 */
export type GrillQuestion = { id: string; text: string; options?: GrillOption[]; multiSelect?: boolean };

/** The most suggested options kept per question. */
export const MAX_GRILL_OPTIONS = 6;

function parseOptions(raw: unknown, multiSelect: boolean): GrillOption[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const options: GrillOption[] = [];
  for (const o of raw) {
    const label = (typeof o === "string" ? o : (o as { label?: unknown })?.label);
    if (typeof label !== "string" || !label.trim()) continue;
    if (options.some((x) => x.label === label.trim())) continue;
    const recommended = typeof o === "object" && (o as { recommended?: unknown }).recommended === true;
    options.push(recommended ? { label: label.trim(), recommended: true } : { label: label.trim() });
  }
  if (options.length === 0) return undefined;
  // A single choice keeps one recommendation, listed first.
  if (!multiSelect) {
    const first = options.findIndex((o) => o.recommended);
    options.forEach((o, i) => {
      if (i !== first) delete o.recommended;
    });
    if (first > 0) options.unshift(...options.splice(first, 1));
  }
  return options.slice(0, MAX_GRILL_OPTIONS);
}
export type GrillAnswers = Record<string, string>;

/** `human_request.response`: what the person decided, or that a Cancel closed it. */
export type HumanResponse =
  | { decision: "approve" }
  | { decision: "reject"; feedback: string }
  | { decision: "answer"; answers: GrillAnswers }
  | { cancelled: true };

/** What a turn-limit request holds in `questions` (#218): the turns the session reached. */
export type TurnsSubject = { turns: number };

/** The prompt that resumes a session a person let go on after its turn limit (#218). */
export const CONTINUE_PROMPT = "You reached the turn limit and a person let you go on. Continue where you left off, then finish with the result block as asked before.\n";

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
    const multiSelect = typeof q === "object" && (q as { multiSelect?: unknown }).multiSelect === true;
    const options = typeof q === "object" ? parseOptions((q as { options?: unknown }).options, multiSelect) : undefined;
    questions.push({ id, text: text.trim(), ...(options ? { options, ...(multiSelect ? { multiSelect } : {}) } : {}) });
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

/** How text Outputs should read: people see them on the Run page, rendered as Markdown. */
export const WRITING = [
  "Write each text Output (a plan, a summary, a review) as GitHub Markdown that a person can scan:",
  "- one numbered item or short heading per point; details go in bullets indented under their point",
  "- start a detail with a bold label, such as **File:**, **Problem:** or **Fix:**",
  "- put file paths (with :line), commands and code names in backticks",
  "- mark a finding's severity as [critical], [major] or [minor] at the start of its item",
  "- keep paragraphs to two or three sentences",
  "In the JSON block a line break is \\n, written once: never escape it twice.",
];

/**
 * The result contract of M0 §6 at the end of an Agent or Grill prompt. A
 * Grill Node may finish with questions instead of its Outputs.
 */
/** How a `context` Output should read (#218): short, for the next Agent, not for people. */
export const CONTEXT_WRITING =
  "A context Output is for the next Agent in this Flow, so it does not explore the repository again: list the files that matter (with :line), the decisions already made and what you ruled out. Keep it under 300 words; no code.";

export function resultContract(outputs: readonly string[], grill: boolean, contextOutputs: readonly string[] = []): string {
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
      JSON.stringify({
        questions: [
          { id: "q1", text: "<question>", options: [{ label: "<option you recommend>", recommended: true }, { label: "<another option>" }] },
          { id: "q2", text: "<question with several answers>", multiSelect: true, options: [{ label: "<option>" }, { label: "<option>" }] },
          { id: "q3", text: "<open question>" },
        ],
      }),
      "```",
      "",
      `Where you can, suggest 2 to 4 short options per question and mark the one you recommend; set "multiSelect": true only when several options can apply together. The person can always write their own answer instead. Leave "options" out for an open question.`,
    );
  }
  if (outputs.some((o) => o !== "branch")) lines.push("", ...WRITING);
  for (const name of contextOutputs) if (outputs.includes(name)) lines.push("", `${name}: ${CONTEXT_WRITING}`);
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
