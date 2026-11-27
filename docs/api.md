# API documentation

Clauderon has no public REST API for third parties. Most of the web app's writes are **Next.js server actions** called by its own pages (`apps/web/src/app/(app)/**/actions.ts`); they are internal and can change in any release. This page documents the HTTP endpoints and WebSocket channels that exist as stable contracts: the ones the browser, the Agent installer and the Agent use. Message schemas live in [`packages/protocol`](../packages/protocol/src).

## Authentication at a glance

| Caller | Credential | Where it is checked |
| --- | --- | --- |
| Member's browser | Auth.js session cookie (HTTP-only; only its SHA-256 is stored) | Web app; email must be in `OPERATOR_EMAILS` or the allowlist |
| Browser → Gateway socket | 60-second HMAC ticket from `GET /api/gateway-ticket`, in `?ticket=` | Gateway, which reloads the session and re-checks the allowlist |
| Agent | Machine token as `Authorization: Bearer <token>` (only its SHA-256 is stored) | Gateway |
| Installer | none: the installer and bundle are public and hold no secret | — |

## Web app endpoints

Base URL: `AUTH_URL` (e.g. `http://localhost:3000`).

### `GET /api/auth/*`, `POST /api/auth/*`

Auth.js handlers (Google sign-in, callback, sign-out). The Google redirect URI is `<AUTH_URL>/api/auth/callback/google`.

### `GET /api/gateway-ticket`

Returns a short-lived ticket for the browser's Gateway socket. Requires a session cookie.

```json
// 200
{ "ticket": "eyJzaWQiOiIuLi4iLCJleHAiOjE3...}.p7F3..." }
// 401 (session missing, expired or revoked; stale session cookies are cleared)
{ "error": "unauthorized" }
```

### `GET /api/agent-config`

Public. Tells an Agent pairing with the web app's URL where the Gateway is.

```json
{ "gatewayUrl": "wss://clauderon-gateway.example.com", "webUrl": "https://clauderon.example.com" }
```

### `POST /api/flows/{id}/start`

Starts a Flow whose Input is a plan or a summary, with text, links and attached files, in one `multipart/form-data` request ([ADR 0011](adr/0011-run-attachments-reach-the-machine-through-the-gateway.md)). Requires a session cookie and an `Origin` header whose host matches the request's host (`X-Forwarded-Host` or `Host`). Form fields (`startFromForm` in `apps/web/src/server/start.ts`):

| Field | Description |
| --- | --- |
| `projectId` | Project the Run belongs to |
| `value` | The plan or summary text |
| `extraInstructions` | Optional extra instructions for the Batch |
| `link` | One field per link (repeatable) |
| `file` | One field per attached file (repeatable) |

The Member must have a paired Machine with Claude Code and `gh` logged in.

```bash
curl -X POST "$AUTH_URL/api/flows/<flowId>/start" \
  -H "Origin: $AUTH_URL" -b "<session cookie>" \
  -F projectId=<projectId> -F value="Summarise the release" -F link=https://example.com/spec -F file=@notes.pdf
```

| Status | Body |
| --- | --- |
| 200 | `{ "ok": true, "batchId": "…", "runIds": ["…"] }` |
| 400 | `{ "ok": false, "error": "…", "machinePage"?: "/machines" }`, e.g. "The form could not be read. Try again.", "Write something, add a link or attach a file.", "You have no paired Machine yet." |
| 401 | `{ "ok": false, "error": "Sign in again." }` |
| 403 | `{ "ok": false, "error": "Start the Run from the app." }` (cross-origin request) |
| 413 | `{ "ok": false, "error": "Attached files are at most 25 MB together." }` |

### `GET /pair?code=<code>`

The link a pairing Agent opens. Redirects to `/machines?code=<code>` (through `/sign-in?next=…` when not signed in). Pairing codes are 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` and expire after 10 minutes; the parameter is cut to 12 characters of `A–Z a–z 0–9 -`.

### `GET /session-ended`

Clears session cookies the server no longer accepts and redirects to `/sign-in`.

### Agent distribution (public, no secrets)

| Endpoint | Response |
| --- | --- |
| `GET /agent/install.sh` | POSIX shell installer for macOS and Linux (`text/plain`) |
| `GET /agent/install.ps1` | PowerShell installer for Windows (`text/plain`) |
| `GET /agent/agent.json` | `{ "version", "sha256", "size" }` of the served bundle; `404 { "error": "the Agent bundle is not built (…)" }` when it is missing |
| `GET /agent/agent.mjs` | The Agent bundle (`text/javascript`); `404` when not built |

```bash
curl -fsSL https://<web host>/agent/install.sh | sh
```

## Gateway endpoints

Base URL: the Gateway's `https://` origin (`http://localhost:4000` locally).

### `GET /health`

Health check for the hosting platform.

```json
{ "ok": true }
```

### `POST /pair`

Starts a Pairing. The body is at most 4 KB.

```json
// request
{ "tokenHash": "<64 hex chars: SHA-256 of the Agent's new token>", "hostname": "alice-mbp", "os": "darwin", "arch": "arm64" }
// 201
{ "pairingId": "5b0c…", "code": "K7PQ2XMA", "expiresAt": "2026-11-27T10:15:00.000Z", "approveUrl": "https://clauderon.example.com/pair?code=K7PQ2XMA" }
```

`approveUrl` is present when the Gateway knows `WEB_URL` or `AUTH_URL`. Errors: `400 { "error": "invalid pairing request" }`, `409 { "error": "this token is already in use" }`, `503 { "error": "too many pending pairings, try again later" }`.

### `GET /pair/{pairingId}`

With `Authorization: Bearer <token>` (the token whose hash was sent). Returns `{ "status": "pending" | "approved" | "expired" }`; `401 { "error": "unauthorized" }` without a token.

### `GET /agent/check`

With a Machine token. `200 { "paired": true, "webUrl": "https://…" | null }`, or `401 { "error": "not paired" }`. Used by the installer (to keep a working pairing) and the Doctor.

### `GET /agent/attachments/{id}`

With a Machine token. Returns the decrypted file (`application/octet-stream`) once, only for a Run on that Machine.

| Status | Body |
| --- | --- |
| 401 | `{ "error": "not paired" }` |
| 404 | `{ "error": "no such attachment" }` (unknown, another Machine's, or already delivered) |
| 410 | `{ "error": "the attachment cannot be read since SESSION_SECRET changed; start a new Run" }` |

Any other path returns `404`; an unexpected error returns `500` and is logged.

## WebSocket channels (Gateway)

Maximum message size: 16 MB. Any other upgrade path is refused.

### `/agent` (Agent ⇄ Gateway)

Opened by the Agent with `Authorization: Bearer <machine token>`. Every message is an envelope:

```json
{ "id": 42, "re": 17, "type": "node.log", "payload": { } }
```

`id` grows by 1 per sender (control messages use `0` and are never resent); `re` points at the message being answered. Message types (`packages/protocol/src/messages.ts`): control `hello`, `welcome`, `ack`, `heartbeat`; `machine.checkLogins`, `machine.logins`; `workspace.prepare`, `workspace.ready`, `workspace.failed`, `workspace.cleanup`, `workspace.cleaned`; `node.run`, `node.log`, `node.usage`, `node.turns`, `node.result`, `node.kill`; `pr.writeBody`; `flow.draft`, `flow.drafted`, `flow.draftKill`; `machine.doctor` (the Doctor report). An unknown `type` is accepted and ignored, so a newer Gateway can talk to an older Agent during a deploy.

### `/browser?ticket=<ticket>` (browser ⇄ Gateway)

Requests from the browser (`packages/protocol/src/browser.ts`):

| Type | Fields | Effect |
| --- | --- | --- |
| `subscribe.log` / `unsubscribe.log` | `attemptId`, optional `afterSeq` | Live log lines of one Attempt |
| `subscribe.run` | `runId` | `run.changed` events for a Run |
| `subscribe.needs` | — | `needs.changed` events |
| `draft.start` | `draftId` (uuid), `description` (≤ 4000 chars) | Build a Flow draft with Claude on the Member's Machine |
| `draft.revise` | `draftId`, `description`, `flow`, `note` | Revise a draft |
| `draft.cancel` | `draftId` | Stop a draft |

Events to the browser: `log` (`attemptId`, `seq`, `stream`: `stdout`/`stderr`/`system`, `text`), `run.changed`, `needs.changed`, `draft.ready`, `draft.failed`, and `notify` (sent only to the Run's Starter; `kind` is one of `needs_human`, `succeeded`, `failed`, `interrupted`, `approved`, `rejected`, `answered`, `cancelled`, `retried`). Invalid messages are ignored.

## Error handling conventions

- JSON errors have the shape `{ "error": "<message>" }`, or `{ "ok": false, "error": "<message>" }` for the start endpoint. Messages are written for a Member to read.
- Responses that carry state or secrets-adjacent data send `cache-control: no-store`.
- Log lines are masked for known token patterns before they are stored or streamed.
