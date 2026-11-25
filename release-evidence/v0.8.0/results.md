# Release v0.8.0 test results (#194)

**Overall: NOT TESTED. Every case is Blocked, none Pass.** No Fail was found, because no case could be run.

**Reason:** `https://clauderon-web.onrender.com` redirects to `/sign-in`, which offers Google sign-in only. The agent has no Member Google credentials, no paired Machine (Agent 0.6.0+), and no access to `toinguyen-agilityio/my-portfolio` Runs. Every case in the plan needs a signed-in Member, and most need a Machine too.

Screenshot: `194/00-sign-in-blocked.png` (the sign-in page).

## 0. Setup: Blocked
- Machine Ready check (`00-machine-ready.png`): not taken, needs sign-in.

## #188 Start a Flow from the Flows page: Blocked
- Cases 1.1 to 1.5 (Start Run icon, dialogs, PR and plan Inputs, file limits, attached files on the Machine, page tabs): not run. No screenshots.

## #190 Run page Flow diagram: Blocked
- Cases 1 to 12 (layout, edges, node states, live update, long Flow, old Runs): not run. No screenshots.

## 3. Regression: Blocked
- Ticket Flow end to end and Flow editor canvas: not run. No screenshots.

## What is needed to run it
A signed-in Member session (cookie or test login), a paired Machine on Agent 0.6.0+, and permission to open pull requests on my-portfolio.
