# Graph Report - clauderon  (2026-11-24)

## Corpus Check
- 363 files · ~273,116 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 4, .example 2, .cmd 1)

## Summary
- 2753 nodes · 7123 edges · 133 communities (121 shown, 12 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 195 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3fe9e96a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/test/m3.test.ts
- src/access.ts
- RunEngine
- agent-install.ts
- fakes.ts
- server/library.ts
- run-live.tsx
- host-agent/src/main.ts
- web/package.json
- flow-canvas.tsx
- src/runs.ts
- (app)/layout.tsx
- library-view.ts
- projects/actions.ts
- machines/[id]/page.tsx
- check
- machine-link.ts
- protocol/src/index.ts
- host-agent/package.json
- members/page.tsx
- update.ts
- service.ts
- react
- package.json
- flow-drafts.ts
- pair.ts
- FakeGitHub
- flow-file.ts
- ref_node_path
- draft-view.ts
- db/package.json
- core/src/index.ts
- run-engine.ts
- flow.ts
- gateway/package.json
- server/runtime.ts
- deps
- services
- server/projects.ts
- Clauderon — Requirements v1 (final)
- M1 — Walking skeleton
- doctor.ts
- envelope.ts
- pull-requests/page.tsx
- flow-node.tsx
- server/flows.ts
- server.test.ts
- gateway/src/main.ts
- FakeAgent
- next
- flow-editor.tsx
- features/package.json
- db/src/schema.ts
- testing/package.json
- build.ts
- deploy.sh
- db/src/index.ts
- compilerOptions
- live-hub.ts
- steps
- flows-list.tsx
- server/machines.ts
- db/src/machines.ts
- Deploying Clauderon
- human-form.tsx
- runner.ts
- start.ts
- environment
- postgres
- testing/src/index.ts
- protocol/package.json
- tasks
- Agent
- pairings.ts
- FlowDrafts
- compose.yml
- LinkSocket
- core/package.json
- MemorySocket
- agent.ts
- postgres
- Payload
- M4 — Refinement and release
- members.ts
- web
- gateway
- backup.sh
- migrate
- healthcheck
- build
- mask
- members/actions.ts
- Clauderon
- Contributing
- markdown-text.tsx
- M3 execution plan — People in the loop
- web/test/access.test.ts
- after-pr-merge.mjs
- pnpm-workspace.yaml
- { GET, POST }
- dynamic
- ListSkeleton
- M2 — Flows and scheduling
- Flow Drafts run Claude Code on the Member's Machine, outside any Run
- The whole app is self-hosted on the Pod Host and reached over Tailscale
- .respond
- 3. Day by day
- M3 — People in the loop
- Remove Dry-run; keep the editor's Test run
- CONTRIBUTING.md
- cloudflared
- Clauderon at a glance
- Clauderon
- DESIGN.md
- M0 — Foundations
- Shared conventions
- Contributing guide and team conventions (design)
- Issue tracker: GitHub
- Language
- Log a bug
- x-app-env
- Domain Docs
- Spike M0-02: Claude Code headless in the Pod image
- Pods push and open pull requests with their own git/gh login
- Flows are typed DAGs without cycles, run one Node at a time
- Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent
- The web app runs on Vercel, with an always-on Gateway for long-lived connections
- Each Member runs on their own Machine, paired to a public app
- The Agent ships as one bundle with its own Node, and checks its Machine
- AGENTS.md
- Clauderon docs

## God Nodes (most connected - your core abstractions)
1. `deps()` - 94 edges
2. `requireMember()` - 74 edges
3. `vitest` - 56 edges
4. `next` - 54 edges
5. `react` - 49 edges
6. `Db` - 45 edges
7. `Payload` - 41 edges
8. `RunEngine` - 37 edges
9. `Icon` - 34 edges
10. `recordAudit()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `Architecture` --references--> `System`  [INFERRED]
  CLAUDE.md → apps/host-agent/src/system.ts
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

## Communities (133 total, 12 thin omitted)

### Community 0 - "web/test/m3.test.ts"
Cohesion: 0.13
Nodes (35): attemptId(), nodeStates(), Script, setup(), setup(), checkMyLogins(), ownMachine(), setMyMachineSettings() (+27 more)

### Community 1 - "src/access.ts"
Cohesion: 0.08
Nodes (41): BrowserHub, BrowserHubOptions, ADR-0008, operators, sessionFor(), clauderonAdapter(), orNull(), toUser() (+33 more)

### Community 2 - "RunEngine"
Cohesion: 0.12
Nodes (12): createGateway(), RunEngine, activeOutputs(), checkAgentResult(), commandOutputs(), askHuman(), finishAttempt(), getRunContext() (+4 more)

### Community 3 - "agent-install.ts"
Cohesion: 0.08
Nodes (31): agent, doctor, env, home, nodeVersion, problems, report, server (+23 more)

### Community 4 - "fakes.ts"
Cohesion: 0.08
Nodes (17): NodeHandles, pidFile(), EXEC_ARGS, ExecOptions, OutputListener, ProcessHandle, Signal, DIR (+9 more)

### Community 5 - "server/library.ts"
Cohesion: 0.18
Nodes (25): importNodesAction(), saveNodeAction(), copyName(), cloneMyNode(), CloneNodeOutcome, createMyNode(), Definition, deleteMyNode() (+17 more)

### Community 6 - "run-live.tsx"
Cohesion: 0.06
Nodes (57): AuditPage(), detailText(), dynamic, Search, SUBJECT_LINK, BuildAvailability, BuildFlow(), Composer() (+49 more)

### Community 7 - "host-agent/src/main.ts"
Cohesion: 0.09
Nodes (42): registerDraftHandlers(), findBash(), localSystem(), checkLogins(), agentBinDir(), ask(), [command = "run", ...args], doctorCommand() (+34 more)

### Community 8 - "web/package.json"
Cohesion: 0.07
Nodes (39): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, next@^16.4.6, next-auth@5.0.0-beta.32, react@^19.3.1, react-dom@^19.3.1 (+31 more)

### Community 9 - "flow-canvas.tsx"
Cohesion: 0.11
Nodes (40): boundsOf(), centerOn(), clampZoom(), edgePath(), FAR_ZOOM, fitBounds(), intersects(), MAX_ZOOM (+32 more)

### Community 10 - "src/runs.ts"
Cohesion: 0.05
Nodes (64): openRequest(), CancelOutcome, isUuid(), NeedsYouItem, NodeState, parseRunFilters(), PullRequestQuery, PullRequestRow (+56 more)

### Community 11 - "(app)/layout.tsx"
Cohesion: 0.08
Nodes (31): AccessDeniedPage(), dynamic, needsYouAction(), AppLayout(), inter, jetbrains, metadata, outfit (+23 more)

### Community 12 - "library-view.ts"
Cohesion: 0.11
Nodes (41): acceptsWire(), NodeView(), RenameInput(), cloneNodeAction(), deleteNodeAction(), exportNodesAction(), ImportNodes(), LibraryList() (+33 more)

### Community 13 - "projects/actions.ts"
Cohesion: 0.20
Nodes (20): ENABLE_ERRORS, enableAction(), EnableState, loadBranches(), loadRepositories(), removeProjectAction(), syncAction(), SyncState (+12 more)

### Community 14 - "machines/[id]/page.tsx"
Cohesion: 0.10
Nodes (43): AutoRefresh(), CmdBox(), DoctorCard(), DOT, looksLikeCommand(), ORDER, ADR-0007, ADR-0007 (+35 more)

### Community 15 - "check"
Cohesion: 0.08
Nodes (25): env, runs-on, services, steps, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, TEST_DATABASE_URL (+17 more)

### Community 16 - "machine-link.ts"
Cohesion: 0.12
Nodes (12): Handler, HeartbeatListener, HelloListener, Link, MachineLinks, MachineLinksOptions, ADR-0006, recordMachineConnected() (+4 more)

### Community 17 - "protocol/src/index.ts"
Cohesion: 0.06
Nodes (45): CLAUDE_ARGS, claudeCommand(), ClaudeErrorWatch, ClaudeEvent, claudeResult(), Content, draftClaudeCommand(), firstLine() (+37 more)

### Community 18 - "host-agent/package.json"
Cohesion: 0.06
Nodes (37): dependencies, @clauderon/core@workspace:*, @clauderon/protocol@workspace:*, dockerode@^5.0.1, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, esbuild@0.28.2 (+29 more)

### Community 19 - "members/page.tsx"
Cohesion: 0.35
Nodes (9): AddEmailForm(), RemoveMachine(), RemoveMember(), dynamic, MachineCell(), MembersPage(), STATUS, Confirm() (+1 more)

### Community 20 - "update.ts"
Cohesion: 0.38
Nodes (6): latestAgent(), sha256(), ADR-0007, updateAgent(), UpdateOptions, UpdateResult

### Community 21 - "service.ts"
Cohesion: 0.15
Nodes (25): Exec, installService(), launchdPath(), launchdPlist(), logFile(), SERVICE_LABEL, serviceArgs(), serviceInstalled() (+17 more)

### Community 22 - "react"
Cohesion: 0.15
Nodes (17): setSettingsAction(), SettingsFormState, MACHINE_NAME_MAX, MachineSettings(), PairingPhase, PairingProgress(), Step, CancelFormState (+9 more)

### Community 23 - "package.json"
Cohesion: 0.07
Nodes (31): devDependencies, eslint@^10.15.0, tsx@^4.23.15, turbo@^2.11.11, @types/node@^26.6.6, typescript@~6.0.3, typescript-eslint@^8.72.2, vitest@^5.1.0 (+23 more)

### Community 24 - "flow-drafts.ts"
Cohesion: 0.11
Nodes (24): Draft, FlowDraftsOptions, Job, Purpose, sendEvent(), ADR-0008, FlowBuildAvailability, agentSupportsFlowDrafts() (+16 more)

### Community 25 - "pair.ts"
Cohesion: 0.13
Nodes (19): checkGateway(), GatewayCheck, skew(), ADR-0007, httpBase(), pair(), PAIR_POLL_MS, Paired (+11 more)

### Community 26 - "FakeGitHub"
Cohesion: 0.09
Nodes (15): ApiIssue, gitHubApi(), request(), GitHubError, withCachedPullRequests(), pull(), setup(), GitHubReader (+7 more)

### Community 27 - "flow-file.ts"
Cohesion: 0.14
Nodes (17): buildFlowFile(), ENTRY_KINDS, fail(), FATAL, FLOW_FILE_FORMAT, FLOW_FILE_MAX_BYTES, FLOW_FILE_VERSION, FlowToExport (+9 more)

### Community 28 - "ref_node_path"
Cohesion: 0.14
Nodes (11): signalGroup(), ADR-0006, memberShell(), mergePaths(), parsePathOutput(), printPathCommand(), refreshToolPath(), shellPath() (+3 more)

### Community 29 - "draft-view.ts"
Cohesion: 0.27
Nodes (8): DraftEdge, DraftPlacement, DraftView, layOutDraft(), nodeHeight(), ADR-0008, file, FlowFile

### Community 30 - "db/package.json"
Cohesion: 0.09
Nodes (25): dependencies, @clauderon/core@workspace:*, drizzle-orm@^0.45.4, pg@^8.23.1, devDependencies, drizzle-kit@^0.31.11, @types/pg@^8.23.1, exports (+17 more)

### Community 31 - "core/src/index.ts"
Cohesion: 0.08
Nodes (34): asPrState(), TicketFilters, viewTickets(), 1. Starting point, 2. Architecture decisions, checkSlots(), MAX_SLOTS, SlotsCheck (+26 more)

### Community 32 - "run-engine.ts"
Cohesion: 0.13
Nodes (14): MachineBack, RunContext, RunEngineOptions, Sender, ADR-0006, log(), SnapshotNode, appendLogChunk() (+6 more)

### Community 33 - "flow.ts"
Cohesion: 0.10
Nodes (33): 10. Acceptance tests, 10. Slices, 3. Canvas editor (FLW-3 … FLW-6), byCanvas(), canConnect(), compare(), ConnectResult, cycleEdges() (+25 more)

### Community 34 - "gateway/package.json"
Cohesion: 0.10
Nodes (24): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, @types/ws@^8.18.2 (+16 more)

### Community 35 - "server/runtime.ts"
Cohesion: 0.15
Nodes (18): dynamic, GET(), ADR-0006, dynamic, GET(), dynamic, GET(), ADR-0006 (+10 more)

### Community 36 - "deps"
Cohesion: 0.13
Nodes (30): createFlowAction(), exportFlowAction(), importFlowAction(), loadFlowStartAction(), loadFlowStartChoicesAction(), startFromInputAction(), saveFlowAction(), FlowPage() (+22 more)

### Community 37 - "services"
Cohesion: 0.07
Nodes (31): databases, databaseName, ipAllowList, name, plan, postgresMajorVersion, region, user (+23 more)

### Community 38 - "server/projects.ts"
Cohesion: 0.10
Nodes (30): EnableRepositoryResult, lastAttempt, mapLimit(), pullFromGitHub(), refreshPullRequest(), syncAllProjects(), syncProject(), SyncResult (+22 more)

### Community 39 - "Clauderon — Requirements v1 (final)"
Cohesion: 0.07
Nodes (30): 10. Glossary, 11. Related documents, 12. Next steps, 1. Overview, 2. Goals and success measures, 3. Scope, 4.1 Members and Projects, 4.2 Pods (+22 more)

### Community 40 - "M1 — Walking skeleton"
Cohesion: 0.08
Nodes (24): 1. Scope, 2.1 Create my Pod (POD-2), 2.2 Start and Stop (POD-6, part), 2.3 Pods page (POD-4), 2.4 Login checks (POD-5), 2.5 Web terminal (POD-9), 2. Pods, 3.1 Enable a Project (PRJ-1, PRJ-2) (+16 more)

### Community 41 - "doctor.ts"
Cohesion: 0.09
Nodes (25): CLOCK_SKEW_MS, DoctorInput, firstLine(), fixFor(), Platform, runDoctor(), ADR-0007, checkClaude() (+17 more)

### Community 42 - "envelope.ts"
Cohesion: 0.16
Nodes (11): doctorReport, envelopeShape, ParseResult, CONTROL_TYPES, ControlType, messageSchemas, ADR-0006, ADR-0007 (+3 more)

### Community 43 - "pull-requests/page.tsx"
Cohesion: 0.22
Nodes (11): FlowsTabs(), dynamic, LibraryPage(), dynamic, PullRequestsPage(), Search, Avatar(), Tab (+3 more)

### Community 44 - "flow-node.tsx"
Cohesion: 0.22
Nodes (15): FIcon, kindIcon(), stroke, KIND_LABEL, Placement, Props, NodeLibrary(), Signature() (+7 more)

### Community 45 - "server/flows.ts"
Cohesion: 0.11
Nodes (36): flowActionAction(), FlowFormState, dynamic, AppDeps, Viewer, cleanGraph(), CloneFlowResult, cloneMyFlow() (+28 more)

### Community 46 - "server.test.ts"
Cohesion: 0.12
Nodes (19): handlePairing(), json(), PairingHttpOptions, readBody(), ADR-0006, ADR-0007, createGatewayServer(), GatewayServerOptions (+11 more)

### Community 47 - "gateway/src/main.ts"
Cohesion: 0.10
Nodes (11): LOG_RETENTION_DAYS, LogRetention, LogRetentionOptions, databaseUrl, { db }, gateway, port, sessionSecret (+3 more)

### Community 48 - "FakeAgent"
Cohesion: 0.19
Nodes (7): controlMessage(), Envelope, serialize(), ResumeBuffer, hello, FakeAgent, Responder

### Community 50 - "next"
Cohesion: 0.12
Nodes (23): loadStartDialog(), startAction(), syncTicketsAction(), dynamic, Search, STATUSES, TicketsPage(), FilterLink() (+15 more)

### Community 51 - "flow-editor.tsx"
Cohesion: 0.08
Nodes (40): GRID, isTyping(), DEFAULT_NODE, Doc, FlowEditor(), GraphEdge, isMac(), LibraryAnchor (+32 more)

### Community 52 - "features/package.json"
Cohesion: 0.14
Nodes (14): dependencies, zod@^4.6.7, exports, zod, name, private, scripts, build:file (+6 more)

### Community 53 - "db/src/schema.ts"
Cohesion: 0.05
Nodes (40): NODE_KINDS, cloneFlow(), copyName(), DeleteFlowResult, FlowGraphInput, FlowListRow, FlowLock, ImportFlowPlan (+32 more)

### Community 54 - "testing/package.json"
Cohesion: 0.13
Nodes (18): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, drizzle-orm@^0.45.4, exports, @clauderon/core, @clauderon/db (+10 more)

### Community 55 - "build.ts"
Cohesion: 0.11
Nodes (26): config, rootEnv, buildFeatures(), MAP_PATH, OUTPUT_PATH, read(), renderFeatures(), out (+18 more)

### Community 56 - "deploy.sh"
Cohesion: 0.30
Nodes (16): compose(), die(), down(), env_get(), env_set(), init_env(), preflight(), say() (+8 more)

### Community 57 - "db/src/index.ts"
Cohesion: 0.13
Nodes (19): ADR-0004, AUDIT_PAGE_SIZE, AuditEntry, AuditFilters, handle, connect(), Db, CommandPublish (+11 more)

### Community 58 - "compilerOptions"
Cohesion: 0.04
Nodes (40): extends, include, extends, include, compilerOptions, allowJs, incremental, jsx (+32 more)

### Community 59 - "live-hub.ts"
Cohesion: 0.17
Nodes (9): add(), LiveHub, LogLine, send(), BrowserEvent, browserRequest, BrowserRequest, parseBrowserMessage() (+1 more)

### Community 60 - "steps"
Cohesion: 0.10
Nodes (19): runs-on, steps, strategy, jobs, agent, os, name, on (+11 more)

### Community 61 - "flows-list.tsx"
Cohesion: 0.23
Nodes (16): FlowRowActions(), EMPTY, FlowCard(), FlowsList(), SCOPES, Steps(), filterFlows(), FlowRowView (+8 more)

### Community 62 - "server/machines.ts"
Cohesion: 0.15
Nodes (19): ApproveResult, canRemoveMachine(), LookUpResult, MACHINE_NAME_MAX, MachineSettingsInput, MachineView, QueueEntry, removeMachine() (+11 more)

### Community 63 - "db/src/machines.ts"
Cohesion: 0.13
Nodes (13): DeleteMachineResult, MachineFacts, MachineLogins, MachineRow, MachineRun, MachineRunCounts, markAllMachinesDisconnected(), QueuedRun (+5 more)

### Community 64 - "Deploying Clauderon"
Cohesion: 0.14
Nodes (14): 1. Prepare the machine (once), 2. Outside accounts (once), 3. Configure, 4. Start the stack, 5. Publish with a Cloudflare Tunnel, 6. Members pair their Machines, 7. Backups, Demo on Render (+6 more)

### Community 65 - "human-form.tsx"
Cohesion: 0.26
Nodes (9): respondAction(), RespondFormState, Choices(), HumanForm(), OpenRequest, Question, answersFromForm(), OTHER_CHOICE (+1 more)

### Community 66 - "runner.ts"
Cohesion: 0.10
Nodes (25): 5. Testing strategy, ApproveSubject, buildGrillAnswerPrompt(), FEEDBACK_HEADING, GrillAnswers, GrillOption, GrillQuestion, HumanResponse (+17 more)

### Community 67 - "start.ts"
Cohesion: 0.20
Nodes (22): FlowStartChoice, flowStartChoices(), flowStartDialog(), keysFor(), resolveInput(), startableFlows(), startDialog(), StartFromInput (+14 more)

### Community 68 - "environment"
Cohesion: 0.19
Nodes (13): AUTH_URL, DATABASE_URL, GATEWAY_PORT, GATEWAY_URL, GITHUB_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPERATOR_EMAILS (+5 more)

### Community 69 - "postgres"
Cohesion: 0.15
Nodes (12): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, name, environment, image, ports, volumes (+4 more)

### Community 70 - "testing/src/index.ts"
Cohesion: 0.09
Nodes (21): Gateway, GatewayOptions, open(), setup(), flusher(), newGateway(), restartGateway(), SESSION_SECRET (+13 more)

### Community 71 - "protocol/package.json"
Cohesion: 0.17
Nodes (12): dependencies, zod@^4.6.7, exports, zod, name, private, scripts, lint (+4 more)

### Community 72 - "tasks"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+4 more)

### Community 74 - "pairings.ts"
Cohesion: 0.11
Nodes (21): approveMyPairing(), normalizePairingCode(), PAIRING_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_TTL_MS, ADR-0006, Machine, MACHINE_DEFAULT_SLOTS (+13 more)

### Community 76 - "compose.yml"
Cohesion: 0.20
Nodes (9): content, configs, cloudflared, name, name, services, volumes, pgdata (+1 more)

### Community 78 - "core/package.json"
Cohesion: 0.20
Nodes (9): exports, name, private, scripts, lint, test, typecheck, type (+1 more)

### Community 79 - "MemorySocket"
Cohesion: 0.23
Nodes (3): Connector, FakeGateway, MemorySocket

### Community 80 - "agent.ts"
Cohesion: 0.10
Nodes (13): AgentOptions, BACKOFF_CAP_MS, BACKOFF_START_MS, Handler, HEARTBEAT_MS, MachineFacts, MachineFactsReader, MachineUsage (+5 more)

### Community 81 - "postgres"
Cohesion: 0.25
Nodes (8): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, environment, image, restart, volumes, postgres

### Community 82 - "Payload"
Cohesion: 0.11
Nodes (10): HEARTBEAT_TIMEOUT_MS, MachineWatch, MachineWatchOptions, MachineService, MachineServiceOptions, ADR-0006, ADR-0007, applyMachineDoctor() (+2 more)

### Community 83 - "M4 — Refinement and release"
Cohesion: 0.12
Nodes (17): 1. Scope, 2.1 Diff (TRK-3), 2.2 Usage (TRK-4), 2.3 Artifact (TRK-5), 2.4 Batch page (TRK-6), 2.5 Ticket detail (TIC-4), 2. Tracking, 3. Machines (replaces Pods) (+9 more)

### Community 84 - "members.ts"
Cohesion: 0.29
Nodes (11): MemberMachine, MemberStatus, MembersView, removeMember(), RemoveMemberResult, viewMembers(), isMachineReady(), isOperator() (+3 more)

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

### Community 91 - "mask"
Cohesion: 0.11
Nodes (18): InputType, NodeDefinition, escapeRegExp(), MASK, mask(), TOKEN_PATTERNS, fail(), isObject() (+10 more)

### Community 92 - "members/actions.ts"
Cohesion: 0.33
Nodes (9): ADD_ERRORS, addEmail(), FormState, refresh(), removeMachineAction(), removeMemberAction(), runsOf(), ConfirmState (+1 more)

### Community 93 - "Clauderon"
Cohesion: 0.12
Nodes (17): Architecture, Clauderon, Contributing, Development commands, Development (`.env`), Documentation, Environment variables, How it works (+9 more)

### Community 94 - "Contributing"
Cohesion: 0.20
Nodes (10): Branches, Commits, Configuration and secrets, Contributing, Pull requests, Release notes, Releases, Repo graph for Claude (+2 more)

### Community 95 - "markdown-text.tsx"
Cohesion: 0.42
Nodes (7): ExpandedText(), isLongText(), LONG_TEXT_CHARS, LONG_TEXT_LINES, MarkdownBody(), MarkdownText(), render()

### Community 96 - "M3 execution plan — People in the loop"
Cohesion: 0.33
Nodes (6): 3. Dependency graph and order, 6. Risks and edge cases, 8. Deployment order, 9. Progress log, M3 execution plan — People in the loop, Not covered here

### Community 97 - "web/test/access.test.ts"
Cohesion: 0.15
Nodes (13): AccessDeps, checkGoogleSignIn(), GoogleSignIn, TicketResult, member(), operators, signInWithCookie(), AddResult (+5 more)

### Community 103 - "ListSkeleton"
Cohesion: 0.60
Nodes (3): Loading(), Loading(), ListSkeleton()

### Community 104 - "M2 — Flows and scheduling"
Cohesion: 0.18
Nodes (11): 1. Scope, 2. Flows page, 4. Node library (FLW-1, FLW-9, FLW-10), 5. Flow edit lock (FLW-7), 6. Slots, limits and the queue (POD-2, POD-3, POD-6), 7. Dry-run (removed), 8. Second Member (A6), 9. Acceptance tests (+3 more)

### Community 105 - "Flow Drafts run Claude Code on the Member's Machine, outside any Run"
Cohesion: 0.50
Nodes (3): Consequences, Considered Options, Flow Drafts run Claude Code on the Member's Machine, outside any Run

### Community 106 - "The whole app is self-hosted on the Pod Host and reached over Tailscale"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, The whole app is self-hosted on the Pod Host and reached over Tailscale

### Community 107 - ".respond"
Cohesion: 0.50
Nodes (3): answerWith(), scriptPlanAndDeliver(), succeedEverything()

### Community 108 - "3. Day by day"
Cohesion: 0.14
Nodes (14): 1. At a glance, 2. Before Day 1, 3. Day by day, 4. How the team works with AI agents, 5. Risks and what to cut, 6. Definition of done, Clauderon v1 — seven-day roadmap, Day 1 — Foundations (M0) (+6 more)

### Community 109 - "M3 — People in the loop"
Cohesion: 0.15
Nodes (13): 10. Slices, 1. Scope, 2.1 Approve (FLW-2, RUN-4, RUN-6), 2.2 Grill (FLW-2, RUN-10), 2. Human Nodes, 3. Needs you (RUN-5, MEM-2), 4. Retry (RUN-7, RUN-9), 5. Cancel (RUN-8) (+5 more)

### Community 112 - "CONTRIBUTING.md"
Cohesion: 0.12
Nodes (11): Releases and the repo graph, Updating tickets after a PR merge, Triage Labels, Change, Notes, Test plan, Why, labels (+3 more)

### Community 113 - "cloudflared"
Cohesion: 0.17
Nodes (12): command, configs, depends_on, environment, image, restart, source, target (+4 more)

### Community 114 - "Clauderon at a glance"
Cohesion: 0.17
Nodes (12): Architecture in brief, Clauderon at a glance, Decisions we need from leads, How it works, How we will know it works, In one sentence, Learn more, Roadmap (+4 more)

### Community 117 - "Clauderon"
Cohesion: 0.18
Nodes (9): Agent skills, Architecture, Clauderon, Commands, Contributing, Domain docs, Issue tracker, Next.js (+1 more)

### Community 119 - "DESIGN.md"
Cohesion: 0.20
Nodes (9): Colors, Components, Do's and Don'ts, Elevation & Depth, Layout, Overview, Shapes, Theme (+1 more)

### Community 120 - "M0 — Foundations"
Cohesion: 0.11
Nodes (19): 11. Slices, 1. Scope, 2. Configuration, 3. Database schema, 4.1 Envelope and resuming, 4.2 Messages, 4. Host Agent protocol, 5.1 Flow validator (FLW-4, FLW-5, A3) (+11 more)

### Community 121 - "Shared conventions"
Cohesion: 0.22
Nodes (9): Clauderon v1 — milestone specs, Definition of done for every slice, Naming, Repository layout, Requirement coverage, Shared conventions, Slices, The test seam (spec Q1) (+1 more)

### Community 122 - "Contributing guide and team conventions (design)"
Cohesion: 0.20
Nodes (9): Approaches, Branch flow and repo graph (decided), Contributing guide and team conventions (design), Convention (my proposals, to be reviewed), Goals, Intent, Left to the builder, Non-goals / anti-goals (+1 more)

### Community 124 - "Issue tracker: GitHub"
Cohesion: 0.25
Nodes (7): Conventions, How v1 work is organised, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 125 - "Language"
Cohesion: 0.29
Nodes (7): Clauderon, Execution, Flows, Language, People, Runs, Work

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
- **62 isolated node(s):** `ADR-0008`, `ADR-0008`, `ADR-0006`, `ADR-0006`, `ADR-0007` (+57 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1020 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `web/test/m3.test.ts` to `src/access.ts`, `RunEngine`, `agent-install.ts`, `fakes.ts`, `host-agent/src/main.ts`, `flow-canvas.tsx`, `(app)/layout.tsx`, `library-view.ts`, `machines/[id]/page.tsx`, `service.ts`, `package.json`, `flow-drafts.ts`, `FakeGitHub`, `flow-file.ts`, `ref_node_path`, `draft-view.ts`, `core/src/index.ts`, `flow.ts`, `server/flows.ts`, `server.test.ts`, `FakeAgent`, `flow-editor.tsx`, `build.ts`, `db/src/index.ts`, `flows-list.tsx`, `human-form.tsx`, `runner.ts`, `start.ts`, `testing/src/index.ts`, `agent.ts`, `mask`, `markdown-text.tsx`, `web/test/access.test.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `deps()` (e.g. with `web/test/access.test.ts` and `m1.test.ts`) actually correct?**
  _`deps()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0008`, `ADR-0008`, `ADR-0006` to the rest of the system?**
  _62 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/test/m3.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1320921985815603 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `agent-install.ts`, `server/library.ts`, `run-live.tsx`, `web/package.json`, `(app)/layout.tsx`, `library-view.ts`, `projects/actions.ts`, `machines/[id]/page.tsx`, `members/page.tsx`, `react`, `server/runtime.ts`, `deps`, `pull-requests/page.tsx`, `server/flows.ts`, `flow-editor.tsx`, `build.ts`, `flows-list.tsx`, `human-form.tsx`, `members/actions.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `src/access.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0815686274509804 - nodes in this community are weakly interconnected._
- **Why does `Member` connect `FlowDrafts` to `src/access.ts`, `web/test/access.test.ts`, `Shared conventions`, `LinkSocket`, `flow-drafts.ts`, `db/src/index.ts`, `Contributing`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._