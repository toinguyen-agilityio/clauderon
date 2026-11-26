# v0.8.0 manual test results (#194)

Tested on tag `v0.8.0` (d68076f), local dev stack (web :3001, gateway :4010, own database, own Agent home), Windows, Chromium via Playwright.
Folder: `release-evidence/v0.8.0/` (`188-start-button/`, `190-diagram/`, `regression/`, `setup/`).

**Overall: 1 Fail (2.11 long Flow readability), 1 Skipped (1.9), 1 Partial (2.12). Everything else Pass, a few with notes.**

## Setup
- Sign-in: no Google; made a DB session for `qa@example.test` (operator). The GitHub token was taken from the tester's `gh` login (not read-only as the plan asks). Project `my-portfolio` enabled. Machine paired, Online and Ready; the Agent reports `0.6.0-dev` (run from source). Screenshots: `setup/`.
- Ports 3000/4000 were in use by another dev stack, so a separate stack and database were used. Test Flows were inserted straight into the DB (command Nodes, to avoid Claude cost). "Review a pull request and comment on it" and "[Test v0.8.0] Plan" follow the plan.

## #188 Start a Flow from the Flows page

### 1.1 Start Run icon position: Pass
Play icon sits left of Clone on every Flow (light 1280, dark 1280, light 375). Files: `188-start-button/list-light-1280.png`, `list-dark-1280.png`, `list-light-375.png`.
Note: at 375px `/flows` scrolled horizontally by about 29px (scrollWidth 389 vs 360). Not investigated; may be a dev-mode artifact.

### 1.2 PR / plan Flow opens the dialog in place: Pass
Dialog opens over the list, URL stays `/flows`, each Flow has its own form, Esc closes. Files: `dialog-pr.png`, `dialog-plan.png`.

### 1.3 Ticket Flow links to Tickets: Pass
"Start from Tickets" goes to `/tickets`, no dialog. File: `ticket-flow-link.png`.

### 1.4 Editor Start Run disabled while unsaved: Pass
Disabled after moving a Node ("Unsaved changes"), enabled after Save ("All changes saved"). Files: `editor-initial.png`, `editor-unsaved-disabled.png`, `editor-saved-enabled.png`.

### 1.5 Start button visible for PR and plan Flows: Pass
Both show Start Run in the list and in the editor. Files: `start-visible-pr-plan.png`, `editor-initial.png`.

### 1.6 (extra) PR Input, pick several: Pass
Selecting #114 and #111 gave "Start 2 Runs". Two Runs, one per PR, both Succeeded. Each PR got exactly one new comment from its own Run (an extra instruction limited each Run to one short comment). The Batch grouping was not checked beyond the Runs list. Files: `pr-multi-dialog.png`, `pr-multi-runs.png`.

### 1.7 (extra) Plan Input: Write/Preview, links, files: Pass
Preview renders Markdown (h1, bold, list, code). Text alone, a link alone or a file alone enables Start; empty keeps it disabled. A Run with 2 links and PDF/PNG/ZIP succeeded. Its Inputs show "Sources (open these links…)" with both links and "Attachments … `.clauderon/inputs/small.pdf`, `image.png`, `bundle.zip`".
Deviations: the worktree is removed after the Run, so there is no terminal capture of `.clauderon/inputs/`; screenshots replace the screen recording. Files: `plan-write.png`, `plan-preview.png`, `plan-files.png`, `plan-run-inputs.png`.

### 1.8 (extra) Attachment limits: Pass
Clear messages: "big11mb.bin is larger than 10 MB", "Attach at most 10 files.", "Attached files are at most 25 MB together." No Run was started. Note: Start was disabled in these screenshots, but disabled-by-limit was not isolated from the earlier no-project state. Files: `limit-file.png`, `limit-count.png`, `limit-total.png`.

### 1.9 (extra) Agent older than 0.6.0: Skipped
No second Machine with an older Agent.

### 1.10 (extra) API guards and tab styling: Pass, with a note
- No session with same Origin: 401. Foreign Origin: 403. Valid session with same Origin: passes the guard (400 for an empty body).
- Note: a bare `curl` without an `Origin` header gets 403 (origin check runs before auth), not 401 as the plan says.
- Tabs show a rounded underline and count pills (static look; animation not checked). File: `tabs-pill.png`.

## #190 Run page Flow diagram

### 2.1 Horizontal diagram replaces the list: Pass
Files: `190-diagram/run-1280-light.png`, `run-1280-dark.png`.

### 2.2 Edges: Pass
Edges end at the matching input handles. Files: `parallel-column.png`, `active-edge.png`. Minor: handle labels truncate ("test-resul…").

### 2.3 Fixed size, not interactive: Pass
No zoom controls. Drag, Ctrl+wheel and double-click left Node positions unchanged; plain wheel scrolled the page (0 to 300). Measured positions, no recording. File: `no-zoom-check.png`.

### 2.4 Node states: Pass
Seen: queued, running, waiting, succeeded, failed, interrupted, cancelled, not reached. Light: `state-running.png`, `state-running-slow.png`, `state-waiting.png`, `state-failed.png`, `state-interrupted.png`, `state-cancelled.png`. Dark: `state-*-dark.png`.
Note: queued and not-reached Nodes both look faded; cancelled is faded with an x icon.

### 2.5 Active edge highlight: Pass
Dashed highlighted edge into the running and the waiting Node. Files: `active-edge.png`, `state-waiting.png`.

### 2.6 Duration and Attempt count: Pass
After Retry from here: "Failing step, 2s, 2 Attempts". Single-attempt Nodes show only a duration. File: `duration-attempts.png`.

### 2.7 Default selection: Pass
The running, waiting and failed Node were selected on load, with details below. Files: `parallel-column.png`, `state-waiting.png`, `state-failed.png`.

### 2.8 Click another Node: Pass
Clicking Prepare replaced the details. File: `select-other.png`.

### 2.9 Live update: Pass
A Parallel Run went Running to Succeeded on the open page without reload, and my manual selection stayed. Screenshots instead of a recording: `live-update-1.png`, `live-update-2.png`, `live-par-0.png`.

### 2.10 Parallel Nodes: Pass
Three Nodes stacked in one column. File: `parallel-column.png`.

### 2.11 Long Flow (6+ Nodes): **Fail**
- 1280px: a 7-Node chain fits but is scaled so small that Node text is about 6 to 7px (`long-1280.png`).
- 375px: the diagram is clipped, only the middle Nodes show and the text is unreadable. The canvas cannot be panned or zoomed. Files: `long-375.png`, `long-375-full.png`. A 4-Node Flow at 375px fits but is tiny (`run-375-waiting-dark.png`).

### 2.12 Old Runs: Partial
No genuine pre-v0.8.0 Run was available (it would need a v0.7.0 build). I opened the first Run of a Flow that was edited afterwards (snapshot differs from the current Flow): no error, the diagram shows, the Inspector tab shows and the Log/Inspector switch works both ways. Files: `old-run.png`, `old-run-inspector.png`.

## Regression

### 3.1 Ticket Flow end to end: Pass
Ticket #124 through Basic ticket delivery: Succeeded in 35s, pull request #125 opened, then closed with its branch deleted. Files: `regression/ticket-selected.png`, `ticket-run.png`, `ticket-pr.json` (metadata only, no GitHub page screenshot).

### 3.2 Flow editor canvas: Pass
Zoom in/out, drag pan and Fit view all worked. File: `regression/editor-canvas.png`.

## Cleanup
Closed PR #125 and deleted its branch, deleted the two test comments on PR #111 and #114, dropped the test database, removed the test Agent home. The shared dev database and dev stack were not touched. Left over from an earlier QA day (not mine): PR #123 and issue #124 are still open.
Not done: `/log-bug` for the 2.11 failure.
