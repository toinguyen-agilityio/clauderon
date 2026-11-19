---
name: log-bug
description: Log a bug as a GitHub issue in this repo, in the team's format (Problem, Acceptance Criteria, How to reproduce, Out of scope). Use when the user asks to file, log or create a bug ticket, or after testing or QA turns up a bug.
---

# Log a bug

Turn "this looks broken" into one GitHub issue a teammate can pick up without asking a question. Issues live in `toinguyen-agilityio/clauderon`; use `gh` from inside the clone.

## Rules

- **Reproduce first.** Describe what you saw, not what the code suggests. If you could not reproduce it, say so and do not file it as a confirmed bug. Code reading may support a claim; say when a step comes from the code or the database and was not clicked through.
- **One bug per ticket.** Several findings from one test session become several tickets. Minor observations (polish, nice-to-haves) are not bugs; list them for the user instead of filing them, unless asked.
- **Check for a duplicate** before filing: `gh issue list --state all --search "<keywords>"`.
- **Do not destroy real data to reproduce.** Reproduce with a clone or a test record and clean it up. If a step would delete or change something real, do not run it; say it was not run.
- **No secrets, tokens or personal data** in the ticket.
- **Write the ticket in English** (the repo's language), whatever language the chat is in.

## Title

`bug(<area>): <what is wrong>`, for example `bug(flows): cloning twice creates Flows with the same name`. Keep it to about 70 characters, state the symptom (not the fix), and leave out the ticket number.

## Body

Four sections, in this order. Leave out "Out of scope" when there is nothing to put in it.

```markdown
## Problem
<One sentence, 10 to 30 words: what is wrong, and why it is a bug (what it affects).>

## Acceptance Criteria
- [ ] <The wanted behaviour, one checkable outcome per line.>
- [ ] <A test covers it.>

## How to reproduce
1. <Where to start, e.g. the page and the route.>
2. <The next action.>
3. <What happens (the wrong result), and what was expected if it is not obvious.>

## Out of scope
<Optional: what this ticket does not cover.>
```

- **Problem:** short and plain. It says what is wrong and who or what it hurts (lost work, a dead end, confusion), so the severity is clear without a label.
- **Acceptance Criteria:** the fix as the user would see it, as `- [ ]` lines. Say what should happen, not how to code it. Include a line for a test.
- **How to reproduce:** a numbered list, simple steps in order, ending with the wrong result. Name the page, the route or the example data used.
- **Out of scope:** only if a reader might otherwise stretch the ticket (a related feature, a bigger redesign).

## File it

1. Look up the milestone name, because names change: `gh api repos/toinguyen-agilityio/clauderon/milestones --jq '.[].title'`. Use the one the user names; if they name none, ask (the usual one for bugs and enhancements is "M5 Fix bug and enhancement").
2. Write the body to a temporary file and create the issue:

   ```sh
   gh issue create --label bug --milestone "<milestone>" \
     --title "bug(<area>): <what is wrong>" --body-file <file>
   ```

3. Report the issue number and link, one line per ticket, and say anything that was not verified.

Do not close, relabel or edit other people's tickets as part of this.
