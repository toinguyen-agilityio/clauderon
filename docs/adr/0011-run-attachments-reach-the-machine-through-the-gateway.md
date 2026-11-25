# Run attachments reach the Machine through the Gateway, stored encrypted until delivered

A Flow whose Input Node gives a plan or a summary starts from text the Member types. Members also want to start one from a document they already have: a PDF spec, a screenshot, a Word file, a log. Claude Code on the Machine reads such files itself, so the file has to reach the Run's worktree. A Run can wait in the queue while its Machine is offline, so the file cannot go straight from the browser to the Machine; and NFR-1 keeps secrets out of the database in the clear, while a binary file cannot be masked.

**Decision:** files attached when starting a plan or summary Flow are stored encrypted in Postgres until the Agent has downloaded them, then their contents are deleted.

- **Start**: the Start Run dialog sends the text, the links and the files in one multipart request to a web route handler (a server action accepts 1 MB). It checks the limits (10 MB per file, 25 MB and 10 files per Run), cleans each file name, and creates the Run with its attachments in one transaction. Only plan and summary Inputs take attachments for now.
- **Storage**: one `run_attachment` row per file with its name, size and SHA-256, and its contents sealed with AES-256-GCM under a key derived with HKDF from `SESSION_SECRET`, as the GitHub token is (ADR 0010).
- **Input text**: the Input's text lists the links under "Sources:" and the files under "Attachments:" with their paths in the worktree, so every Node that takes the Input sees them. Links are never fetched by the app: Claude reads them on the Machine, with the Member's own access.
- **Delivery**: `workspace.prepare` names the Run's attachments. After making the worktree the Agent downloads each one from the Gateway (`GET /agent/attachments/<id>`, the Machine's token as `Bearer`), checks its SHA-256 and writes it to `.clauderon/inputs/` in the worktree; `.clauderon/` goes into the clone's `.git/info/exclude`, so the files are never committed or pushed. The Gateway serves only attachments of a Run on that Machine.
- **Deletion**: when `workspace.ready` says the files were delivered, the Gateway deletes their contents and keeps the name and SHA-256. A retry relies on the files still in the worktree: before each Node the Agent checks they are there, and fails the Node with "start a new Run" when they are not.
- **Old Agents**: an Agent older than 0.6.0 cannot download attachments; the Gateway fails such a Run at once and tells the Member to update the Agent.

## Considered Options

- **Object storage (S3, R2)**: suits large files, but adds a service, its credentials and an SDK to a self-hosted app. Postgres with tight limits and deletion on delivery is enough.
- **Files over the Agent's WebSocket**: no new route, but a message is capped at 16 MB and a large file holds up the socket that also carries logs and heartbeats.
- **Download from the web app**: the Gateway already checks Machine tokens (`/agent/check`) and holds `SESSION_SECRET`, so it needs no new kind of authentication.
- **Keep the contents until the Run ends**: a retry would download again after a lost worktree, but a Failed Run nobody retries would keep its files forever.
- **Fill text files into the plan instead**: lets the Member edit them, but gives two paths for files; every file is an attachment.
