# Spike M0-02: Claude Code headless in the Pod image

> **Status:** run on 2026-11-17 with Claude Code 2.1.325 in `images/pod` (user `pod`). Findings below; the expected flags in `apps/host-agent/src/claude.ts` were confirmed.

## Goal

Confirm, in a container from `images/pod`, the exact CLI flags, the shape of the final result and how token usage is reported, for the agent result contract of [spec M0 §6](../m0-foundations.md#6-agent-result-contract-run-10).

## Steps

1. Build and start a container from the image, with a scratch repository in `/workspace`:

   ```bash
   docker build -t clauderon-pod:spike images/pod
   docker run -it --name claude-spike clauderon-pod:spike bash
   ```

2. Inside it, log in by hand: `claude` and follow the login prompt. Then create a repository: `git init demo && cd demo && echo "hello" > README.md && git add . && git -c user.email=spike@example.com -c user.name=spike commit -m init`.
3. Run one headless prompt that edits a file and ends with the §6 JSON block. Expected flags:

   ```bash
   claude -p --output-format stream-json --verbose --dangerously-skip-permissions \
     'Append a line "world" to README.md and commit it. Finish with one fenced JSON block: {"outputs": {"summary": "<what you did>"}}' \
     > run1.jsonl
   ```

4. Resume the same session with a follow-up, as a Grill round would:

   ```bash
   claude -p --output-format stream-json --verbose --dangerously-skip-permissions \
     --resume <session_id from run1.jsonl> 'Now ask me one question as {"questions": [{"id": "q1", "text": "…"}]}' > run2.jsonl
   ```

5. Record below what actually happened, then remove the container: `docker rm -f claude-spike`.

## Findings

Run once by a person logged in with their own subscription. Two details for M1: a bare (unfenced) `questions` JSON came back on resume, because my spike prompt did not ask for a fence. `extractResultBlock` only reads fenced blocks, so the Grill prompt must ask for one (or the extractor should fall back to bare JSON); `session_id` is stable across resume.

| Question | Answer |
| --- | --- |
| Exact flags that worked | `claude -p --output-format stream-json --verbose --dangerously-skip-permissions` (as expected); resume adds `--resume <session_id>` |
| Where the session id appears in `stream-json` | `session_id` on every event, including the first `system`/`init` and the last `result`; a resumed run keeps the same id |
| Does the final message end with the fenced JSON block reliably? | Yes on the one try: the `result` text ends with a fenced ```json block `{"outputs": {...}}` after a short summary. One run only; reliability over many runs is untested |
| Shape of the last `result` event (fallback, §6) | `{type: "result", subtype: "success", is_error: false, session_id, result: "<final text>", usage, total_cost_usd, duration_ms, ...}` |
| Token usage fields and where they appear | `usage` on the last `result` event: `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`; also `total_cost_usd` |
| Does `--resume` keep the conversation and the worktree context? | Yes: the follow-up answered about the earlier edit ("world") and returned the `{"questions": [...]}` shape as bare JSON, not fenced |
| Anything that needed a prompt despite `--dangerously-skip-permissions` | None seen. Extra event types appear (`rate_limit_event`, `commands_changed`); the parser ignores unknown types |
