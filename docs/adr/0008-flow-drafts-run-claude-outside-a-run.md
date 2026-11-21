# Flow Drafts run Claude Code on the Member's Machine, outside any Run

Building a Flow by hand means knowing the Node library, the Output Types and the edge rules. A Member should be able to describe the Flow they want and get a draft to review instead. Until now Claude Code ran only as an Agent Node inside a Run, and the app never holds a Claude login (ADR 0001, ADR 0006).

- **Where Claude runs**: on the Member's own Machine, under their own Claude Code login, sent through the Gateway like a Node. The web app and the Gateway still hold no Claude token and call no model API.
- **Not a Run**: a Flow Draft has no Ticket, worktree or branch and takes no Slot. Each call runs in its own empty directory `~/.clauderon/drafts/<draft id>`, without `--dangerously-skip-permissions`, so in print mode Claude cannot use a tool that needs permission (no writes, no shell).
- **Protocol**: the browser asks on its `/browser` socket (`draft.start`, `draft.revise`, `draft.cancel`); the Gateway sends `flow.draft` to the Machine and reads `flow.drafted`; `flow.draftKill` stops a call. Agents before 0.5.0 do not know these messages: the web app disables the button for them and the Gateway refuses to send.
- **The answer is a Flow file**: the same format as Import/Export. A Node entry may say `"use": "<library Node name>"`; the Gateway replaces it with that Node's exact definition, so the import reuses it. Anything else is a new Node definition.
- **Checked as an import**: the Gateway checks the answer with `parseFlowFile` plus exactly one Ticket placement. An invalid answer is sent back to the same Claude session once, with the error; a second invalid answer fails the draft.
- **Preview, then create**: the browser lays the draft out, draws it read-only and lists the new library Nodes. Nothing is written until the Member presses Create, which goes through the ordinary import (new Nodes, "Copy of" names, audit).
- **Changes resume the session**: "Suggest changes" resumes the same Claude session with the Member's note. When the session is gone (another Machine, a Gateway restart, Claude Code no longer has it), a fresh call carries the description, the current draft and the note.
- **In memory only**: the Gateway keeps a draft only while its browser socket is open, and the browser keeps the draft it shows. No table, no migration. Closing the dialog or losing the socket kills a running call.
- **Limits**: each call has 3 minutes; there is no limit on changes, since each one is the Member's own Claude usage.

## Considered Options

- **Claude via the Anthropic API from the Gateway**: the smoothest experience, but the app would hold an API key and pay for every draft, against ADR 0001 and NFR-1.
- **Copy a prompt to the Member's own Claude Code and paste the answer into Import**: no new protocol, but a manual round trip for every change.
- **Store drafts in the database**: they would survive a closed tab and a Gateway restart, at the cost of a table, a migration and cleanup for something short-lived.
- **Write the draft into the library at once (like Import)**: simpler, but rejected drafts would leave Nodes behind in the shared library.

## Consequences

- Building a Flow needs the Member's Machine to be ready and on Agent 0.5.0 or later.
- A Flow Draft uses the Member's Claude usage while they wait; it does not delay their Runs.
- A Gateway restart while Claude is drafting loses that call; the Member presses Build again.
- `~/.clauderon/drafts` keeps one small directory per draft, for `--resume`.
