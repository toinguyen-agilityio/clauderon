/** The value of the "Other" choice; its text arrives as `other:<question id>`. */
export const OTHER_CHOICE = "__other__";

/**
 * The answers of a Grill form, one text per question: the free answer, the
 * chosen option, or several options joined with "; ". "Other" stands for the
 * text typed next to it. Fields are `answer:<id>` (repeated for a
 * multi-select) and `other:<id>`.
 */
export function answersFromForm(form: Pick<FormData, "getAll" | "keys">): Record<string, string> {
  const ids = new Set<string>();
  for (const key of form.keys()) {
    const [kind, ...rest] = key.split(":");
    if ((kind === "answer" || kind === "other") && rest.length > 0) ids.add(rest.join(":"));
  }
  const answers: Record<string, string> = {};
  for (const id of ids) {
    const other = String(form.getAll(`other:${id}`)[0] ?? "").trim();
    const parts = form
      .getAll(`answer:${id}`)
      .map((v) => (v === OTHER_CHOICE ? other : String(v).trim()))
      .filter(Boolean);
    answers[id] = parts.join("; ");
  }
  return answers;
}
