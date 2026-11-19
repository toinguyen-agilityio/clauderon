// PostToolUse hook for `gh pr merge`: reminds Claude to update the linked ticket.
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
let input = {};
try {
  input = JSON.parse(Buffer.concat(chunks).toString() || "{}");
} catch {
  // Malformed input: do nothing rather than fail the hook.
}
const cmd = input.tool_input?.command ?? "";
// Only when `gh pr merge` is a command itself (start of line, or after && ; | ), not text inside a body or message.
if (/(^|&&|\|\||[;|\n])\s*gh\s+pr\s+merge\b/.test(cmd)) {
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
