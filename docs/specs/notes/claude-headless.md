# Spike M0-02: Claude Code headless in the Pod image

> **Status:** not run yet. The spike needs a person to log in to Claude Code by hand with their own subscription, so an agent cannot finish it. Fill in the **Findings** section when it is done; M1's runner (spec M1, Agent Nodes) depends on it.

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

To be filled in by the person who runs the spike.

| Question | Answer |
| --- | --- |
| Exact flags that worked | _pending_ |
| Where the session id appears in `stream-json` | _pending_ |
| Does the final message end with the fenced JSON block reliably? | _pending_ |
| Shape of the last `result` event (fallback, §6) | _pending_ |
| Token usage fields and where they appear | _pending_ |
| Does `--resume` keep the conversation and the worktree context? | _pending_ |
| Anything that needed a prompt despite `--dangerously-skip-permissions` | _pending_ |
