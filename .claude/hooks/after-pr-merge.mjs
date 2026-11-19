// PostToolUse hook for `gh pr merge`: reminds Claude to update the linked ticket.
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const input = JSON.parse(Buffer.concat(chunks).toString() || "{}");
const cmd = input.tool_input?.command ?? "";
if (/\bgh\s+pr\s+merge\b/.test(cmd)) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext:
          "A `gh pr merge` just ran. If the PR merged, update its linked ticket(s) now by following docs/agents/ticket-status-after-merge.md, then tell the user what status you set.",
      },
    }),
  );
}
