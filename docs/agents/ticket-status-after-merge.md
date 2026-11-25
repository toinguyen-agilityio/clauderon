# Updating tickets after a PR merge

PRs merge into `staging`, the default branch, so `Closes #N` closes the ticket on that merge. A release PR (`release/*` into `main`) closes nothing itself. Applies right after `gh pr merge` succeeds (a hook reminds Claude). First confirm the PR really merged: `gh pr view <n> --json state,body,closingIssuesReferences`.

For each linked ticket (`closingIssuesReferences`, or `#N` in the PR body):

| Situation after the merge | Action |
| --- | --- |
| The PR fully meets the ticket's Acceptance Criteria | Make sure it is closed (`Closes #N` usually does it); if not, `gh issue close <n> --comment "Done in #<pr>"`. |
| Only part of the AC is met | Keep it open. Comment what is done and what is left, as a checklist. |
| The ticket is waiting on a decision or missing info | Add `needs-info`, comment the exact question. Do not close. |
| Another open ticket now blocks it | Add the native blocked-by link (see `issue-tracker.md`, "Blocking") and comment why. |
| The merge unblocks other tickets | Comment on each: "Unblocked by #<pr>". Leave them open. |
| The PR has no linked ticket (`closingIssuesReferences` empty, no `#N` in the body) | Do nothing to tickets: do not guess one, do not create one. Tell the user in one line: "PR #X has no linked ticket". |
| The work turned out not to be needed | `wontfix` label, comment why, close. |

Always comment the PR link on the ticket. If unsure which row applies, ask the user instead of guessing.

## What runs by itself

The workflow `.github/workflows/ticket-on-merge.yml` runs on every merge into `staging`, whoever merges it: it comments the PR link on each `Closes #N` ticket (GitHub closes it) and on each `Refs #N` ticket (left open). It never closes, labels or links anything else. The rest of the table above, such as listing what is left of a partly met ticket, needs judgement and stays with a person or with the after-merge hook in `.claude/hooks/`.
