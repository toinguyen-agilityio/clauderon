# Graph Report - clauderon  (2026-11-20)

## Corpus Check
- 313 files · ~224,428 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .example 2, .css 1)

## Summary
- 2463 nodes · 6148 edges · 141 communities (131 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 189 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dbdf5fd8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Gateway tests
- Web auth and access
- Run engine
- Agent smoke and doctor
- Agent node execution
- server/flows.ts
- Needs-you and run pages
- Agent main and CLI
- Web dependencies
- Flow canvas geometry
- Run views (web server)
- icons.tsx
- Node library UI
- Flow and project actions
- Machine page widgets
- CI workflow
- MachineLinks
- Claude CLI wrapper
- Host-agent dependencies
- db/src/human.ts
- src/runs.ts
- Agent service install
- Flow editor
- Root tooling
- createGateway
- pair.ts
- FakeGitHub
- core/src/index.ts
- health.test.ts
- runs/[id]/actions.ts
- db/package.json
- run.ts
- doctor.ts
- flow.ts
- gateway/package.json
- deps
- members.ts
- services
- server/projects.ts
- Clauderon — Requirements v1 (final)
- M1 — Walking skeleton
- agent-dist.ts
- envelope.ts
- pull-requests/page.tsx
- flow-node.tsx
- m2.test.ts
- pairings.ts
- gateway/src/pairing.ts
- Envelope
- ticket-table.tsx
- flow-editor-model.test.ts
- tickets.ts
- schema.ts
- testing/package.json
- bundle.mjs
- deploy.sh
- client.ts
- compilerOptions
- Db
- db/src/machines.ts
- flows/page.tsx
- m2.test.ts
- MemorySocket
- Deploying Clauderon
- human-form.tsx
- runner.ts
- core/src/index.ts
- environment
- postgres
- gateway/test/m3.test.ts
- protocol/package.json
- tasks
- Agent
- server/machines.ts
- compilerOptions
- compose.yml
- log-retention.ts
- core/package.json
- LinkSocket
- agent.ts
- postgres
- Payload
- M4 — Refinement and release
- runs/[id]/page.tsx
- web
- gateway
- backup.sh
- migrate
- healthcheck
- build
- gateway/tsconfig.json
- host-agent/tsconfig.json
- Clauderon
- core/tsconfig.json
- db/tsconfig.json
- protocol/tsconfig.json
- testing/tsconfig.json
- after-pr-merge.mjs
- pnpm-workspace.yaml
- { GET, POST }
- dynamic
- .advance
- run-engine.ts
- M0 — Foundations
- serialize
- auth.ts
- 3. Day by day
- M3 — People in the loop
- web/test/access.test.ts
- dialog.ts
- CONTRIBUTING.md
- cloudflared
- Clauderon at a glance
- flow.test.ts
- ticket-status.test.ts
- Clauderon
- Contributing
- DESIGN.md
- M2 — Flows and scheduling
- Shared conventions
- Contributing guide and team conventions (design)
- app/layout.tsx
- Issue tracker: GitHub
- Language
- protocol.test.ts
- agent-config/route.ts
- Log a bug
- x-app-env
- Domain Docs
- Spike M0-02: Claude Code headless in the Pod image
- categories
- Pods push and open pull requests with their own git/gh login
- Flows are typed DAGs without cycles, run one Node at a time
- Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent
- The web app runs on Vercel, with an always-on Gateway for long-lived connections
- Each Member runs on their own Machine, paired to a public app
- The Agent ships as one bundle with its own Node, and checks its Machine
- AGENTS.md
- Clauderon docs

## God Nodes (most connected - your core abstractions)
1. `deps()` - 83 edges
2. `requireMember()` - 64 edges
3. `next` - 48 edges
4. `vitest` - 46 edges
5. `Db` - 43 edges
6. `RunEngine` - 39 edges
7. `react` - 37 edges
8. `Payload` - 37 edges
9. `FlowEditor()` - 30 edges
10. `recordAudit()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `10. Slices` --references--> `canConnect()`  [INFERRED]
  docs/specs/m2-flows-and-scheduling.md → packages/core/src/flow.ts
- `9. Seeds (FLW-8)` --references--> `validateFlow()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/core/src/flow.ts
- `4.2 Run engine (RUN-2, RUN-3, RUN-16)` --references--> `nextNode()`  [INFERRED]
  docs/specs/m1-walking-skeleton.md → packages/core/src/run.ts
- `Findings` --references--> `extractResultBlock()`  [INFERRED]
  docs/specs/notes/claude-headless.md → packages/core/src/runner.ts
- `11. Slices` --references--> `endMemberAccess()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/db/src/access.ts

## Import Cycles
- None detected.

## Communities (141 total, 10 thin omitted)

### Community 0 - "Gateway tests"
Cohesion: 0.17
Nodes (27): attemptId(), nodeStates(), setup(), setup(), AppDeps, cancelRunAs(), pendingCode(), ready() (+19 more)

### Community 1 - "Web auth and access"
Cohesion: 0.14
Nodes (25): clauderonAdapter(), orNull(), toUser(), AllowlistRow, AuditInput, createSession(), endSession(), findMemberByAccount() (+17 more)

### Community 2 - "Run engine"
Cohesion: 0.19
Nodes (6): RunEngine, getRunContext(), moveRun(), runningRuns(), runsOfMachine(), updateRun()

### Community 3 - "Agent smoke and doctor"
Cohesion: 0.07
Nodes (30): agent, doctor, env, home, nodeVersion, problems, report, server (+22 more)

### Community 4 - "Agent node execution"
Cohesion: 0.14
Nodes (10): EXEC_ARGS, ExecOptions, OutputListener, ProcessHandle, Signal, ExecCall, ExecReply, FakeSystem (+2 more)

### Community 5 - "server/flows.ts"
Cohesion: 0.09
Nodes (32): exportFlowAction(), flowActionAction(), FlowFormState, FlowRowActions(), cleanGraph(), CloneFlowResult, Definition, DeleteFlowOutcome (+24 more)

### Community 6 - "Needs-you and run pages"
Cohesion: 0.12
Nodes (31): dynamic, NeedsYouPage(), retryRunAction(), Input, RetryFromHere(), classify(), KIND, Line (+23 more)

### Community 7 - "Agent main and CLI"
Cohesion: 0.10
Nodes (36): findBash(), localSystem(), registerLoginHandlers(), agentBinDir(), ask(), [command = "run", ...args], doctorCommand(), doctorFor() (+28 more)

### Community 8 - "Web dependencies"
Cohesion: 0.07
Nodes (39): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, next@^16.4.6, next-auth@5.0.0-beta.32, react@^19.3.1, react-dom@^19.3.1 (+31 more)

### Community 9 - "Flow canvas geometry"
Cohesion: 0.11
Nodes (39): boundsOf(), centerOn(), clampZoom(), edgePath(), FAR_ZOOM, fitBounds(), intersects(), MAX_ZOOM (+31 more)

### Community 10 - "Run views (web server)"
Cohesion: 0.10
Nodes (34): openRequest(), dynamic, EMPTY, PullRequestsPage(), Search, TAB_LABEL, CancelOutcome, NeedsYouItem (+26 more)

### Community 11 - "icons.tsx"
Cohesion: 0.10
Nodes (28): AppLayout(), PairingPhase, PairingProgress(), Step, ConfirmState, FormState, AddEmailForm(), Confirm() (+20 more)

### Community 12 - "Node library UI"
Cohesion: 0.12
Nodes (34): cloneNodeAction(), KIND_MARK, LibraryList(), NodeCard(), NodeDialog(), Port, PortChips(), cardMeta() (+26 more)

### Community 13 - "Flow and project actions"
Cohesion: 0.21
Nodes (16): ENABLE_ERRORS, enableAction(), EnableState, loadBranches(), loadRepositories(), syncAction(), SyncState, EnableForm() (+8 more)

### Community 14 - "Machine page widgets"
Cohesion: 0.09
Nodes (41): approvePairingAction(), checkLoginsAction(), lookUpPairingAction(), MachineFormState, PairFormState, setSettingsAction(), SettingsFormState, AutoRefresh() (+33 more)

### Community 15 - "CI workflow"
Cohesion: 0.07
Nodes (32): runs-on, steps, strategy, env, runs-on, services, steps, POSTGRES_DB (+24 more)

### Community 16 - "MachineLinks"
Cohesion: 0.19
Nodes (3): MachineLinks, markAllMachinesDisconnected(), recordMachineDisconnected()

### Community 17 - "Claude CLI wrapper"
Cohesion: 0.08
Nodes (25): CLAUDE_ARGS, claudeCommand(), ClaudeErrorWatch, ClaudeEvent, claudeResult(), Content, firstLine(), inputTokens() (+17 more)

### Community 18 - "Host-agent dependencies"
Cohesion: 0.08
Nodes (30): dependencies, @clauderon/core@workspace:*, @clauderon/protocol@workspace:*, dockerode@^5.0.1, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, esbuild@0.28.2 (+22 more)

### Community 19 - "db/src/human.ts"
Cohesion: 0.13
Nodes (16): checkAnswers(), AskHumanInput, AUDIT_ACTION, HumanAction, HumanRequest, humanRequestsOfRun(), isUuid(), openCondition (+8 more)

### Community 20 - "src/runs.ts"
Cohesion: 0.09
Nodes (21): log(), FlowSnapshot, activeRealRun(), appendLogChunk(), AttemptEnd, AttemptWithOutputs, CancelRunResult, interruptRun() (+13 more)

### Community 21 - "Agent service install"
Cohesion: 0.14
Nodes (24): Exec, installService(), launchdPath(), launchdPlist(), logFile(), SERVICE_LABEL, serviceArgs(), serviceInstalled() (+16 more)

### Community 22 - "Flow editor"
Cohesion: 0.12
Nodes (20): GRID, isTyping(), DEFAULT_NODE, Doc, FlowEditor(), GraphEdge, isMac(), LibraryAnchor (+12 more)

### Community 23 - "Root tooling"
Cohesion: 0.08
Nodes (29): devDependencies, eslint@^10.15.0, tsx@^4.23.15, turbo@^2.11.11, @types/node@^26.6.6, typescript@~6.0.3, typescript-eslint@^8.72.2, vitest@^5.1.0 (+21 more)

### Community 24 - "createGateway"
Cohesion: 0.16
Nodes (13): open(), operators, connect(), flush(), waitFor(), createTestDatabase(), TestDatabase, now (+5 more)

### Community 25 - "pair.ts"
Cohesion: 0.21
Nodes (10): pair(), PAIR_POLL_MS, Paired, PairOptions, resolveGateway(), sha256(), ADR-0006, Call (+2 more)

### Community 26 - "FakeGitHub"
Cohesion: 0.11
Nodes (10): ApiIssue, gitHubApi(), request(), GitHubError, GitHubReader, Issue, PullRequest, Repository (+2 more)

### Community 27 - "core/src/index.ts"
Cohesion: 0.10
Nodes (24): buildFlowFile(), fail(), FATAL, FLOW_FILE_FORMAT, FLOW_FILE_VERSION, FlowFile, FlowToExport, isObject() (+16 more)

### Community 28 - "health.test.ts"
Cohesion: 0.15
Nodes (11): signalGroup(), ADR-0006, memberShell(), mergePaths(), parsePathOutput(), printPathCommand(), refreshToolPath(), shellPath() (+3 more)

### Community 29 - "runs/[id]/actions.ts"
Cohesion: 0.53
Nodes (4): CancelFormState, cancelRunAction(), RetryFormState, CancelRun()

### Community 30 - "db/package.json"
Cohesion: 0.09
Nodes (25): dependencies, @clauderon/core@workspace:*, drizzle-orm@^0.45.4, pg@^8.23.1, devDependencies, drizzle-kit@^0.31.11, @types/pg@^8.23.1, exports (+17 more)

### Community 31 - "run.ts"
Cohesion: 0.17
Nodes (14): 2. Architecture decisions, AttemptState, AttemptView, holdsSlot(), MachineForSchedule, MOVES, RUN_EVENTS, RUN_STATES (+6 more)

### Community 32 - "doctor.ts"
Cohesion: 0.10
Nodes (23): AgentLink, detached(), errorText(), Log, checkClaude(), checkLogins(), CLAUDE_STATUS_SCRIPT, ClaudeLogin (+15 more)

### Community 33 - "flow.ts"
Cohesion: 0.29
Nodes (13): 10. Acceptance tests, 3. Canvas editor (FLW-3 … FLW-6), byCanvas(), canConnect(), compare(), ConnectResult, cycleEdges(), FlowNode (+5 more)

### Community 34 - "gateway/package.json"
Cohesion: 0.10
Nodes (24): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, @types/ws@^8.18.2 (+16 more)

### Community 35 - "deps"
Cohesion: 0.17
Nodes (18): dynamic, GET(), dynamic, GET(), ADR-0006, GET(), AccessDeps, GoogleSignIn (+10 more)

### Community 36 - "members.ts"
Cohesion: 0.12
Nodes (22): databaseUrl, { db }, gateway, port, sessionSecret, MemberMachine, MemberStatus, MembersView (+14 more)

### Community 37 - "services"
Cohesion: 0.07
Nodes (31): databases, databaseName, ipAllowList, name, plan, postgresMajorVersion, region, user (+23 more)

### Community 38 - "server/projects.ts"
Cohesion: 0.17
Nodes (19): EnableRepositoryResult, refreshPullRequest(), syncProject(), SyncResult, enableProject(), EnableResult, getProject(), openTicketsMissingFrom() (+11 more)

### Community 39 - "Clauderon — Requirements v1 (final)"
Cohesion: 0.07
Nodes (30): 10. Glossary, 11. Related documents, 12. Next steps, 1. Overview, 2. Goals and success measures, 3. Scope, 4.1 Members and Projects, 4.2 Pods (+22 more)

### Community 40 - "M1 — Walking skeleton"
Cohesion: 0.08
Nodes (24): 1. Scope, 2.1 Create my Pod (POD-2), 2.2 Start and Stop (POD-6, part), 2.3 Pods page (POD-4), 2.4 Login checks (POD-5), 2.5 Web terminal (POD-9), 2. Pods, 3.1 Enable a Project (PRJ-1, PRJ-2) (+16 more)

### Community 41 - "agent-dist.ts"
Cohesion: 0.10
Nodes (23): CLOCK_SKEW_MS, DoctorInput, firstLine(), fixFor(), LOW_DISK_GB, Platform, runDoctor(), ADR-0007 (+15 more)

### Community 42 - "envelope.ts"
Cohesion: 0.16
Nodes (14): doctorReport, envelopeShape, parseEnvelope(), ParseResult, CONTROL_TYPES, ControlType, isMessageType(), messageSchemas (+6 more)

### Community 43 - "pull-requests/page.tsx"
Cohesion: 0.23
Nodes (12): importFlowAction(), FlowsTabs(), ImportFlow(), dynamic, LibraryPage(), dynamic, FlowsPage(), Tab (+4 more)

### Community 44 - "flow-node.tsx"
Cohesion: 0.22
Nodes (16): CanvasHandle(), FIcon, kindIcon(), stroke, acceptsWire(), KIND_LABEL, NodeView(), Placement (+8 more)

### Community 45 - "m2.test.ts"
Cohesion: 0.19
Nodes (22): deleteNodeAction(), saveNodeAction(), copyName(), cloneMyNode(), CloneNodeOutcome, createMyNode(), deleteMyNode(), LibraryInput (+14 more)

### Community 46 - "pairings.ts"
Cohesion: 0.11
Nodes (19): PAIRING_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_TTL_MS, ADR-0006, MACHINE_DEFAULT_SLOTS, ApprovePairingResult, CreatePairingResult, MAX_PENDING_PAIRINGS (+11 more)

### Community 47 - "gateway/src/pairing.ts"
Cohesion: 0.17
Nodes (15): handlePairing(), json(), PairingHttpOptions, readBody(), ADR-0006, ADR-0007, machineOfTokenHash(), createPairing() (+7 more)

### Community 50 - "ticket-table.tsx"
Cohesion: 0.13
Nodes (25): saveFlowAction(), dynamic, FlowPage(), ADD_ERRORS, addEmail(), refresh(), removeMachineAction(), removeMemberAction() (+17 more)

### Community 51 - "flow-editor-model.test.ts"
Cohesion: 0.18
Nodes (12): layeredLayout(), LAYOUT_GAP_X, LAYOUT_GAP_Y, LayoutEdge, LayoutNode, advanceTestRun(), edgeStates(), nodeStates() (+4 more)

### Community 52 - "tickets.ts"
Cohesion: 0.27
Nodes (11): asPrState(), TicketFilters, TicketRow, viewTickets(), isActive(), RunState, ACTIVE_STATUS, PullRequestState (+3 more)

### Community 53 - "schema.ts"
Cohesion: 0.07
Nodes (26): artifact, attemptState, batch, flow, flowEdge, flowNode, humanRequestKind, logChunk (+18 more)

### Community 54 - "testing/package.json"
Cohesion: 0.13
Nodes (18): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, drizzle-orm@^0.45.4, exports, @clauderon/core, @clauderon/db (+10 more)

### Community 55 - "bundle.mjs"
Cohesion: 0.10
Nodes (16): buildId, bundle, dist, manifest, ADR-0007, root, versionMatch, latestAgent() (+8 more)

### Community 56 - "deploy.sh"
Cohesion: 0.30
Nodes (16): compose(), die(), down(), env_get(), env_set(), init_env(), preflight(), say() (+8 more)

### Community 57 - "client.ts"
Cohesion: 0.12
Nodes (18): ADR-0004, Places to change, AUDIT_PAGE_SIZE, AuditEntry, AuditFilters, handle, connect(), DbHandle (+10 more)

### Community 58 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution (+9 more)

### Community 59 - "Db"
Cohesion: 0.08
Nodes (28): BrowserHub, BrowserHubOptions, add(), LiveHub, LogLine, send(), Handler, HeartbeatListener (+20 more)

### Community 60 - "db/src/machines.ts"
Cohesion: 0.13
Nodes (15): applyMachineDoctor(), DeleteMachineResult, MachineFacts, MachineLogins, MachineRow, MachineRun, MachineRunCounts, machineRunsIn() (+7 more)

### Community 61 - "flows/page.tsx"
Cohesion: 0.29
Nodes (13): EMPTY, FlowCard(), FlowsList(), Pipeline(), SCOPES, filterFlows(), FlowRowView, FlowScope (+5 more)

### Community 62 - "m2.test.ts"
Cohesion: 0.14
Nodes (26): cloneMyFlow(), EditorData, editorData(), saveMyFlow(), keysFor(), startableFlows(), startDialog(), StartInput (+18 more)

### Community 63 - "MemorySocket"
Cohesion: 0.21
Nodes (3): Connector, FakeGateway, MemorySocket

### Community 64 - "Deploying Clauderon"
Cohesion: 0.11
Nodes (18): 1. Prepare the machine (once), 2. Outside accounts (once), 3. Configure, 4. Start the stack, 5. Publish with a Cloudflare Tunnel, 6. Members pair their Machines, 7. Backups, Demo on Render (+10 more)

### Community 65 - "human-form.tsx"
Cohesion: 0.27
Nodes (6): RespondFormState, Choices(), OpenRequest, Question, answersFromForm(), OTHER_CHOICE

### Community 66 - "runner.ts"
Cohesion: 0.08
Nodes (39): 1. Starting point, 3. Dependency graph and order, 4. Changes by layer, 5. Testing strategy, 6. Risks and edge cases, 8. Deployment order, 9. Progress log, M3 execution plan — People in the loop (+31 more)

### Community 67 - "core/src/index.ts"
Cohesion: 0.25
Nodes (4): MAX_SLOTS, SlotsCheck, ADR-0006, valid

### Community 68 - "environment"
Cohesion: 0.19
Nodes (13): AUTH_URL, DATABASE_URL, GATEWAY_PORT, GATEWAY_URL, GITHUB_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPERATOR_EMAILS (+5 more)

### Community 69 - "postgres"
Cohesion: 0.15
Nodes (12): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, name, environment, image, ports, volumes (+4 more)

### Community 70 - "gateway/test/m3.test.ts"
Cohesion: 0.10
Nodes (17): Gateway, GatewayOptions, flusher(), newGateway(), restartGateway(), SESSION_SECRET, startGateway(), Script (+9 more)

### Community 71 - "protocol/package.json"
Cohesion: 0.17
Nodes (11): dependencies, zod@^4.6.7, exports, name, private, scripts, lint, test (+3 more)

### Community 72 - "tasks"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+4 more)

### Community 74 - "server/machines.ts"
Cohesion: 0.10
Nodes (33): removeMachineAction(), unpairAction(), Viewer, approveMyPairing(), ApproveResult, canRemoveMachine(), checkMyLogins(), lookUpPairing() (+25 more)

### Community 75 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, incremental, jsx, lib, plugins, exclude, extends (+2 more)

### Community 76 - "compose.yml"
Cohesion: 0.20
Nodes (9): content, configs, cloudflared, name, name, services, volumes, pgdata (+1 more)

### Community 77 - "log-retention.ts"
Cohesion: 0.24
Nodes (4): LOG_RETENTION_DAYS, LogRetention, LogRetentionOptions, deleteLogChunksBefore()

### Community 78 - "core/package.json"
Cohesion: 0.20
Nodes (9): exports, name, private, scripts, lint, test, typecheck, type (+1 more)

### Community 79 - "LinkSocket"
Cohesion: 0.30
Nodes (3): Member, LinkSocket, WsLike

### Community 80 - "agent.ts"
Cohesion: 0.12
Nodes (10): AgentOptions, BACKOFF_CAP_MS, BACKOFF_START_MS, Handler, HEARTBEAT_MS, MachineFacts, MachineFactsReader, StateStore (+2 more)

### Community 81 - "postgres"
Cohesion: 0.25
Nodes (8): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, environment, image, restart, volumes, postgres

### Community 82 - "Payload"
Cohesion: 0.13
Nodes (7): createGateway(), MachineWatch, MachineService, FakeLink, applyMachineLogins(), setAttemptUsage(), Payload

### Community 83 - "M4 — Refinement and release"
Cohesion: 0.12
Nodes (17): 1. Scope, 2.1 Diff (TRK-3), 2.2 Usage (TRK-4), 2.3 Artifact (TRK-5), 2.4 Batch page (TRK-6), 2.5 Ticket detail (TIC-4), 2. Tracking, 3. Machines (replaces Pods) (+9 more)

### Community 84 - "runs/[id]/page.tsx"
Cohesion: 0.14
Nodes (22): AuditPage(), detailText(), dynamic, Search, SUBJECT_LINK, FilterSelect(), Option, dynamic (+14 more)

### Community 85 - "web"
Cohesion: 0.29
Nodes (7): gateway, condition, web, depends_on, image, ports, restart

### Community 86 - "gateway"
Cohesion: 0.29
Nodes (7): migrate, depends_on, image, ports, restart, condition, gateway

### Community 87 - "backup.sh"
Cohesion: 0.67
Nodes (5): backup(), compose(), install_agent(), restore(), backup.sh script

### Community 88 - "migrate"
Cohesion: 0.33
Nodes (6): postgres, command, depends_on, image, condition, migrate

### Community 89 - "healthcheck"
Cohesion: 0.53
Nodes (6): healthcheck, interval, retries, test, timeout, healthcheck

### Community 90 - "build"
Cohesion: 0.60
Nodes (5): context, dockerfile, target, build, build

### Community 91 - "gateway/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 92 - "host-agent/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 93 - "Clauderon"
Cohesion: 0.12
Nodes (17): Architecture, Clauderon, Contributing, Development commands, Development (`.env`), Documentation, Environment variables, How it works (+9 more)

### Community 94 - "core/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 95 - "db/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 96 - "protocol/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 97 - "testing/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 103 - ".advance"
Cohesion: 0.29
Nodes (5): activeOutputs(), SnapshotNode, attemptsOfRun(), finishAttempt(), getAttempt()

### Community 104 - "run-engine.ts"
Cohesion: 0.16
Nodes (13): MachineBack, RunContext, RunEngineOptions, Sender, ADR-0006, OutputValue, fake(), simulatedDelayMs() (+5 more)

### Community 105 - "M0 — Foundations"
Cohesion: 0.13
Nodes (15): 11. Slices, 1. Scope, 2. Configuration, 5.1 Flow validator (FLW-4, FLW-5, A3), 5.2 Run state machine (RUN-2 … RUN-9, RUN-16), 5.3 Slot scheduler (POD-3), 5.4 Ticket Status (TIC-6), 5.5 Masking (NFR-1) (+7 more)

### Community 106 - "serialize"
Cohesion: 0.27
Nodes (4): recordMachineHeartbeat(), saveMachineLinkIds(), controlMessage(), serialize()

### Community 107 - "auth.ts"
Cohesion: 0.24
Nodes (10): AccessDeniedPage(), dynamic, dynamic, SignInPage(), DENIED_EMAIL_COOKIE, handlers, signIn, Brand() (+2 more)

### Community 108 - "3. Day by day"
Cohesion: 0.14
Nodes (14): 1. At a glance, 2. Before Day 1, 3. Day by day, 4. How the team works with AI agents, 5. Risks and what to cut, 6. Definition of done, Clauderon v1 — seven-day roadmap, Day 1 — Foundations (M0) (+6 more)

### Community 109 - "M3 — People in the loop"
Cohesion: 0.15
Nodes (13): 10. Slices, 1. Scope, 2.1 Approve (FLW-2, RUN-4, RUN-6), 2.2 Grill (FLW-2, RUN-10), 2. Human Nodes, 3. Needs you (RUN-5, MEM-2), 4. Retry (RUN-7, RUN-9), 5. Cancel (RUN-8) (+5 more)

### Community 110 - "web/test/access.test.ts"
Cohesion: 0.26
Nodes (9): sessionFor(), addToAllowlist(), checkGoogleSignIn(), member(), operators, signInWithCookie(), allow(), addAllowlistEntry() (+1 more)

### Community 111 - "dialog.ts"
Cohesion: 0.23
Nodes (8): LeaveDialog(), AnchorLike, ClickLike, hasUnsavedChanges(), leavesPage(), PendingLeave, useLeaveGuard(), closeOnBackdrop

### Community 112 - "CONTRIBUTING.md"
Cohesion: 0.17
Nodes (7): Releases and the repo graph, Updating tickets after a PR merge, Triage Labels, Change, Notes, Test plan, Why

### Community 113 - "cloudflared"
Cohesion: 0.17
Nodes (12): command, configs, depends_on, environment, image, restart, source, target (+4 more)

### Community 114 - "Clauderon at a glance"
Cohesion: 0.17
Nodes (12): Architecture in brief, Clauderon at a glance, Decisions we need from leads, How it works, How we will know it works, In one sentence, Learn more, Roadmap (+4 more)

### Community 115 - "flow.test.ts"
Cohesion: 0.33
Nodes (8): Flow, FlowEdge, LibraryNode, basicDelivery, edge(), fn(), library, planAndDeliver

### Community 116 - "ticket-status.test.ts"
Cohesion: 0.24
Nodes (9): flow(), 3. Database schema, 4.1 Envelope and resuming, 4.2 Messages, 4. Host Agent protocol, RunForStatus, at(), open (+1 more)

### Community 117 - "Clauderon"
Cohesion: 0.20
Nodes (8): Agent skills, Clauderon, Commands, Contributing, Domain docs, Issue tracker, Next.js, Triage labels

### Community 118 - "Contributing"
Cohesion: 0.20
Nodes (10): Branches, Commits, Configuration and secrets, Contributing, Pull requests, Release notes, Releases, Repo graph for Claude (+2 more)

### Community 119 - "DESIGN.md"
Cohesion: 0.20
Nodes (9): Colors, Components, Do's and Don'ts, Elevation & Depth, Layout, Overview, Shapes, Theme (+1 more)

### Community 120 - "M2 — Flows and scheduling"
Cohesion: 0.20
Nodes (10): 10. Slices, 1. Scope, 2. Flows page, 4. Node library (FLW-1, FLW-9, FLW-10), 5. Flow edit lock (FLW-7), 6. Slots, limits and the queue (POD-2, POD-3, POD-6), 7. Dry-run (RUN-1, RUN-13), 8. Second Member (A6) (+2 more)

### Community 121 - "Shared conventions"
Cohesion: 0.22
Nodes (9): Clauderon v1 — milestone specs, Definition of done for every slice, Naming, Repository layout, Requirement coverage, Shared conventions, Slices, The test seam (spec Q1) (+1 more)

### Community 122 - "Contributing guide and team conventions (design)"
Cohesion: 0.22
Nodes (8): Approaches, Branch flow and repo graph (decided), Contributing guide and team conventions (design), Convention (my proposals, to be reviewed), Goals, Intent, Left to the builder, Non-goals / anti-goals

### Community 123 - "app/layout.tsx"
Cohesion: 0.25
Nodes (5): inter, jetbrains, metadata, outfit, THEME_BOOTSTRAP

### Community 124 - "Issue tracker: GitHub"
Cohesion: 0.25
Nodes (7): Conventions, How v1 work is organised, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 125 - "Language"
Cohesion: 0.29
Nodes (7): Clauderon, Execution, Flows, Language, People, Runs, Work

### Community 126 - "protocol.test.ts"
Cohesion: 0.43
Nodes (5): createGatewayTicket(), GATEWAY_TICKET_SECONDS, sign(), verifyGatewayTicket(), hello

### Community 127 - "agent-config/route.ts"
Cohesion: 0.40
Nodes (5): dynamic, GET(), ADR-0006, gatewayUrl(), AgentConfig

### Community 128 - "Log a bug"
Cohesion: 0.33
Nodes (5): Body, File it, Log a bug, Rules, Title

### Community 129 - "x-app-env"
Cohesion: 0.40
Nodes (5): x-app-env, DATABASE_URL, GITHUB_TOKEN, OPERATOR_EMAILS, SESSION_SECRET

### Community 130 - "Domain Docs"
Cohesion: 0.40
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 131 - "Spike M0-02: Claude Code headless in the Pod image"
Cohesion: 0.40
Nodes (4): Findings, Goal, Spike M0-02: Claude Code headless in the Pod image, Steps

### Community 132 - "categories"
Cohesion: 0.40
Nodes (4): labels, title, changelog, categories

### Community 133 - "Pods push and open pull requests with their own git/gh login"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Pods push and open pull requests with their own git/gh login

### Community 134 - "Flows are typed DAGs without cycles, run one Node at a time"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Flows are typed DAGs without cycles, run one Node at a time

### Community 135 - "Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent

### Community 136 - "The web app runs on Vercel, with an always-on Gateway for long-lived connections"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, The web app runs on Vercel, with an always-on Gateway for long-lived connections

### Community 137 - "Each Member runs on their own Machine, paired to a public app"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Each Member runs on their own Machine, paired to a public app

### Community 138 - "The Agent ships as one bundle with its own Node, and checks its Machine"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, The Agent ships as one bundle with its own Node, and checks its Machine

## Knowledge Gaps
- **59 isolated node(s):** `ADR-0006`, `ADR-0006`, `ADR-0007`, `ADR-0006`, `ADR-0007` (+54 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 933 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `createGateway` to `Gateway tests`, `Agent smoke and doctor`, `server/flows.ts`, `Needs-you and run pages`, `Agent main and CLI`, `Flow canvas geometry`, `Node library UI`, `Machine page widgets`, `Claude CLI wrapper`, `Agent service install`, `Root tooling`, `pair.ts`, `core/src/index.ts`, `health.test.ts`, `run.ts`, `doctor.ts`, `pairings.ts`, `flow-editor-model.test.ts`, `Db`, `flows/page.tsx`, `m2.test.ts`, `human-form.tsx`, `runner.ts`, `core/src/index.ts`, `gateway/test/m3.test.ts`, `agent.ts`, `web/test/access.test.ts`, `flow.test.ts`, `ticket-status.test.ts`, `protocol.test.ts`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `deps()` (e.g. with `web/test/access.test.ts` and `m1.test.ts`) actually correct?**
  _`deps()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0006`, `ADR-0006`, `ADR-0007` to the rest of the system?**
  _59 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Web auth and access` be split into smaller, more focused modules?**
  _Cohesion score 0.14245014245014245 - nodes in this community are weakly interconnected._
- **Why does `Member` connect `LinkSocket` to `Web auth and access`, `deps`, `web/test/access.test.ts`, `Contributing`, `Shared conventions`, `Db`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Should `Agent smoke and doctor` be split into smaller, more focused modules?**
  _Cohesion score 0.07435897435897436 - nodes in this community are weakly interconnected._
- **Why does `Contributing` connect `Contributing` to `CONTRIBUTING.md`, `LinkSocket`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._