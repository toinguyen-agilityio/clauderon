# Graph Report - clauderon  (2026-11-20)

## Corpus Check
- 312 files · ~223,942 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .example 2, .css 1)

## Summary
- 2456 nodes · 6142 edges · 130 communities (117 shown, 13 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 189 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0d680d70`
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
- App layout and sign-in
- Node library UI
- Flow and project actions
- Machine page widgets
- CI workflow
- Machine links (gateway)
- Claude CLI wrapper
- Host-agent dependencies
- core/src/human.ts
- src/runs.ts
- Agent service install
- Flow editor
- Root tooling
- createGateway
- pair.ts
- FakeGitHub
- core/src/index.ts
- bundle.mjs
- services
- db/package.json
- run.ts
- doctor.ts
- flow.ts
- gateway/package.json
- deps
- server/machines.ts
- server.test.ts
- server/projects.ts
- seed.ts
- Db
- agent-dist.ts
- envelope.ts
- pull-requests/page.tsx
- flow-node.tsx
- m2.test.ts
- pairings.ts
- pairings.test.ts
- Envelope
- requireMember
- ticket-table.tsx
- flow-editor-model.test.ts
- tickets.ts
- schema.ts
- testing/package.json
- health.test.ts
- deploy.sh
- client.ts
- compilerOptions
- Clauderon — Requirements v1 (final)
- db/src/machines.ts
- flows/page.tsx
- start.ts
- MemorySocket
- Icon
- human-form.tsx
- runner.ts
- M0 — Foundations
- environment
- postgres
- serialize
- protocol/package.json
- tasks
- Agent
- validateFlow
- compilerOptions
- compose.yml
- log-retention.ts
- core/package.json
- LinkSocket
- agent.ts
- postgres
- MachineWatch
- M1 — Walking skeleton
- web
- gateway
- backup.sh
- migrate
- healthcheck
- build
- gateway/tsconfig.json
- host-agent/tsconfig.json
- run-engine.ts
- core/tsconfig.json
- db/tsconfig.json
- protocol/tsconfig.json
- testing/tsconfig.json
- after-pr-merge.mjs
- pnpm-workspace.yaml
- { GET, POST }
- dynamic
- CONTRIBUTING.md
- Deploying Clauderon
- M4 — Refinement and release
- Clauderon
- 3. Day by day
- M3 — People in the loop
- cloudflared
- Clauderon at a glance
- Clauderon
- DESIGN.md
- Contributing guide and team conventions (design)
- Shared conventions
- Issue tracker: GitHub
- Language
- protocol.test.ts
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
- `9. Seeds (FLW-8)` --references--> `validateFlow()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/core/src/flow.ts
- `4.2 Run engine (RUN-2, RUN-3, RUN-16)` --references--> `nextNode()`  [INFERRED]
  docs/specs/m1-walking-skeleton.md → packages/core/src/run.ts
- `Findings` --references--> `extractResultBlock()`  [INFERRED]
  docs/specs/notes/claude-headless.md → packages/core/src/runner.ts
- `11. Slices` --references--> `endMemberAccess()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/db/src/access.ts
- `Places to change` --references--> `migrate()`  [INFERRED]
  docs/superpowers/specs/2026-11-20-contributing-conventions-design.md → packages/db/src/migrate.ts

## Import Cycles
- None detected.

## Communities (130 total, 13 thin omitted)

### Community 0 - "Gateway tests"
Cohesion: 0.16
Nodes (28): attemptId(), Script, setup(), setup(), AppDeps, ready(), withDryRun(), audit() (+20 more)

### Community 1 - "Web auth and access"
Cohesion: 0.08
Nodes (47): BrowserHubOptions, operators, sessionFor(), AccessDeps, checkGoogleSignIn(), GoogleSignIn, clauderonAdapter(), orNull() (+39 more)

### Community 2 - "Run engine"
Cohesion: 0.16
Nodes (8): RunEngine, askHuman(), finishAttempt(), getAttempt(), getRunContext(), moveRun(), runningRuns(), updateRun()

### Community 3 - "Agent smoke and doctor"
Cohesion: 0.06
Nodes (37): agent, doctor, env, home, nodeVersion, problems, report, server (+29 more)

### Community 4 - "Agent node execution"
Cohesion: 0.09
Nodes (14): signalGroup(), ADR-0006, EXEC_ARGS, ExecOptions, OutputListener, ProcessHandle, Signal, System (+6 more)

### Community 5 - "server/flows.ts"
Cohesion: 0.10
Nodes (29): dynamic, FlowPage(), cleanGraph(), CloneFlowResult, Definition, DeleteFlowOutcome, EditorData, editorData() (+21 more)

### Community 6 - "Needs-you and run pages"
Cohesion: 0.09
Nodes (46): dynamic, NeedsYouPage(), CancelFormState, cancelRunAction(), RetryFormState, retryRunAction(), CancelRun(), dynamic (+38 more)

### Community 7 - "Agent main and CLI"
Cohesion: 0.11
Nodes (34): findBash(), localSystem(), agentBinDir(), ask(), [command = "run", ...args], doctorCommand(), doctorFor(), gatewayOf() (+26 more)

### Community 8 - "Web dependencies"
Cohesion: 0.07
Nodes (39): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, next@^16.4.6, next-auth@5.0.0-beta.32, react@^19.3.1, react-dom@^19.3.1 (+31 more)

### Community 9 - "Flow canvas geometry"
Cohesion: 0.11
Nodes (38): boundsOf(), centerOn(), clampZoom(), edgePath(), FAR_ZOOM, fitBounds(), intersects(), MAX_ZOOM (+30 more)

### Community 10 - "Run views (web server)"
Cohesion: 0.13
Nodes (30): openRequest(), executionOrder(), CancelOutcome, isUuid(), NeedsYouItem, NodeState, parseRunFilters(), RespondOutcome (+22 more)

### Community 11 - "App layout and sign-in"
Cohesion: 0.09
Nodes (27): AccessDeniedPage(), dynamic, AppLayout(), inter, jetbrains, metadata, outfit, dynamic (+19 more)

### Community 12 - "Node library UI"
Cohesion: 0.12
Nodes (32): deleteNodeAction(), KIND_MARK, LibraryList(), NodeCard(), NodeDialog(), Port, PortChips(), cardMeta() (+24 more)

### Community 13 - "Flow and project actions"
Cohesion: 0.22
Nodes (16): ENABLE_ERRORS, enableAction(), EnableState, loadBranches(), loadRepositories(), syncAction(), SyncState, EnableForm() (+8 more)

### Community 14 - "Machine page widgets"
Cohesion: 0.10
Nodes (36): approvePairingAction(), lookUpPairingAction(), PairFormState, AutoRefresh(), CmdBox(), DoctorCard(), DOT, looksLikeCommand() (+28 more)

### Community 15 - "CI workflow"
Cohesion: 0.07
Nodes (32): runs-on, steps, strategy, env, runs-on, services, steps, POSTGRES_DB (+24 more)

### Community 16 - "Machine links (gateway)"
Cohesion: 0.17
Nodes (4): MachineLinks, recordMachineDisconnected(), recordMachineHeartbeat(), saveMachineLinkIds()

### Community 17 - "Claude CLI wrapper"
Cohesion: 0.06
Nodes (30): CLAUDE_ARGS, claudeCommand(), ClaudeErrorWatch, ClaudeEvent, claudeResult(), Content, firstLine(), inputTokens() (+22 more)

### Community 18 - "Host-agent dependencies"
Cohesion: 0.08
Nodes (30): dependencies, @clauderon/core@workspace:*, @clauderon/protocol@workspace:*, dockerode@^5.0.1, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, esbuild@0.28.2 (+22 more)

### Community 19 - "core/src/human.ts"
Cohesion: 0.19
Nodes (13): ApproveSubject, buildGrillAnswerPrompt(), checkAnswers(), FEEDBACK_HEADING, GrillAnswers, GrillOption, GrillQuestion, HumanResponse (+5 more)

### Community 20 - "src/runs.ts"
Cohesion: 0.09
Nodes (20): log(), activeRealRun(), appendLogChunk(), AttemptEnd, CancelRunResult, isUniqueViolation(), LogStream, NewAttempt (+12 more)

### Community 21 - "Agent service install"
Cohesion: 0.14
Nodes (25): installCommand(), Exec, installService(), launchdPath(), launchdPlist(), logFile(), SERVICE_LABEL, serviceArgs() (+17 more)

### Community 22 - "Flow editor"
Cohesion: 0.11
Nodes (25): GRID, isTyping(), DEFAULT_NODE, Doc, FlowEditor(), GraphEdge, isMac(), LibraryAnchor (+17 more)

### Community 23 - "Root tooling"
Cohesion: 0.08
Nodes (29): devDependencies, eslint@^10.15.0, tsx@^4.23.15, turbo@^2.11.11, @types/node@^26.6.6, typescript@~6.0.3, typescript-eslint@^8.72.2, vitest@^5.1.0 (+21 more)

### Community 24 - "createGateway"
Cohesion: 0.08
Nodes (24): createGateway(), open(), flusher(), newGateway(), restartGateway(), SESSION_SECRET, startGateway(), scriptPlanAndDeliver() (+16 more)

### Community 25 - "pair.ts"
Cohesion: 0.15
Nodes (16): checkGateway(), GatewayCheck, skew(), ADR-0007, httpBase(), pair(), PAIR_POLL_MS, Paired (+8 more)

### Community 26 - "FakeGitHub"
Cohesion: 0.12
Nodes (9): ApiIssue, request(), GitHubError, GitHubReader, Issue, PullRequest, Repository, FakeGitHub (+1 more)

### Community 27 - "core/src/index.ts"
Cohesion: 0.10
Nodes (22): buildFlowFile(), fail(), FATAL, FLOW_FILE_FORMAT, FLOW_FILE_MAX_BYTES, FLOW_FILE_VERSION, FlowFile, FlowToExport (+14 more)

### Community 28 - "bundle.mjs"
Cohesion: 0.15
Nodes (9): buildId, bundle, dist, manifest, ADR-0007, root, versionMatch, config (+1 more)

### Community 29 - "services"
Cohesion: 0.07
Nodes (31): databases, databaseName, ipAllowList, name, plan, postgresMajorVersion, region, user (+23 more)

### Community 30 - "db/package.json"
Cohesion: 0.09
Nodes (25): dependencies, @clauderon/core@workspace:*, drizzle-orm@^0.45.4, pg@^8.23.1, devDependencies, drizzle-kit@^0.31.11, @types/pg@^8.23.1, exports (+17 more)

### Community 31 - "run.ts"
Cohesion: 0.11
Nodes (24): 1. Starting point, 2. Architecture decisions, 3. Dependency graph and order, 6. Risks and edge cases, 8. Deployment order, 9. Progress log, M3 execution plan — People in the loop, Not covered here (+16 more)

### Community 32 - "doctor.ts"
Cohesion: 0.11
Nodes (29): CLOCK_SKEW_MS, DoctorInput, firstLine(), fixFor(), LOW_DISK_GB, Platform, runDoctor(), ADR-0007 (+21 more)

### Community 33 - "flow.ts"
Cohesion: 0.14
Nodes (21): byCanvas(), compare(), ConnectResult, cycleEdges(), FlowEdge, groupOutgoing(), NODE_KINDS, NodeInput (+13 more)

### Community 34 - "gateway/package.json"
Cohesion: 0.10
Nodes (24): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, @types/ws@^8.18.2 (+16 more)

### Community 35 - "deps"
Cohesion: 0.09
Nodes (30): dynamic, GET(), AuditPage(), detailText(), dynamic, Search, SUBJECT_LINK, saveFlowAction() (+22 more)

### Community 36 - "server/machines.ts"
Cohesion: 0.10
Nodes (28): Viewer, ApproveResult, checkMyLogins(), LookUpResult, MACHINE_NAME_MAX, MachineSettingsInput, MachineView, ownMachine() (+20 more)

### Community 37 - "server.test.ts"
Cohesion: 0.11
Nodes (11): BrowserHub, databaseUrl, { db }, gateway, port, sessionSecret, createGatewayServer(), GatewayServerOptions (+3 more)

### Community 38 - "server/projects.ts"
Cohesion: 0.17
Nodes (19): EnableRepositoryResult, refreshPullRequest(), syncProject(), SyncResult, enableProject(), EnableResult, getProject(), openTicketsMissingFrom() (+11 more)

### Community 39 - "seed.ts"
Cohesion: 0.13
Nodes (13): FlowLock, ChangeNodeResult, LibraryRow, flow, flowEdge, flowNode, node, SampleEdge (+5 more)

### Community 40 - "Db"
Cohesion: 0.08
Nodes (25): Gateway, GatewayOptions, add(), LiveHub, LogLine, send(), Handler, HeartbeatListener (+17 more)

### Community 41 - "agent-dist.ts"
Cohesion: 0.12
Nodes (15): latestAgent(), sha256(), ADR-0007, updateAgent(), UpdateOptions, UpdateResult, AgentCheck, AgentManifest (+7 more)

### Community 42 - "envelope.ts"
Cohesion: 0.17
Nodes (12): doctorReport, envelopeShape, parseEnvelope(), ParseResult, CONTROL_TYPES, ControlType, isMessageType(), messageSchemas (+4 more)

### Community 43 - "pull-requests/page.tsx"
Cohesion: 0.22
Nodes (10): dynamic, EMPTY, PullRequestsPage(), Search, TAB_LABEL, parsePullRequestTab(), PULL_REQUEST_TABS, viewPullRequests() (+2 more)

### Community 44 - "flow-node.tsx"
Cohesion: 0.15
Nodes (21): CanvasHandle(), HandleType, FIcon, kindIcon(), stroke, acceptsWire(), KIND_LABEL, NodeView() (+13 more)

### Community 45 - "m2.test.ts"
Cohesion: 0.18
Nodes (23): cloneNodeAction(), saveNodeAction(), cloneMyFlow(), saveMyFlow(), cloneMyNode(), CloneNodeOutcome, createMyNode(), deleteMyNode() (+15 more)

### Community 46 - "pairings.ts"
Cohesion: 0.12
Nodes (19): approveMyPairing(), normalizePairingCode(), PAIRING_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_TTL_MS, ADR-0006, MACHINE_DEFAULT_SLOTS, approvePairing() (+11 more)

### Community 47 - "pairings.test.ts"
Cohesion: 0.14
Nodes (20): handlePairing(), json(), PairingHttpOptions, readBody(), ADR-0006, ADR-0007, pendingCode(), hashToken() (+12 more)

### Community 49 - "requireMember"
Cohesion: 0.24
Nodes (13): checkLoginsAction(), MachineFormState, removeMachineAction(), setSettingsAction(), SettingsFormState, unpairAction(), CheckLogins(), Confirmed() (+5 more)

### Community 50 - "ticket-table.tsx"
Cohesion: 0.18
Nodes (14): loadStartDialog(), startAction(), dynamic, Search, STATUSES, TicketsPage(), Dialog, selectable() (+6 more)

### Community 51 - "flow-editor-model.test.ts"
Cohesion: 0.18
Nodes (12): layeredLayout(), LAYOUT_GAP_X, LAYOUT_GAP_Y, LayoutEdge, LayoutNode, advanceTestRun(), edgeStates(), nodeStates() (+4 more)

### Community 52 - "tickets.ts"
Cohesion: 0.26
Nodes (14): viewMachine(), viewMachines(), viewProjects(), asPrState(), TicketFilters, viewTickets(), isActive(), ticketKeys() (+6 more)

### Community 53 - "schema.ts"
Cohesion: 0.08
Nodes (24): AskHumanInput, AUDIT_ACTION, HumanRequest, openCondition, RespondResult, artifact, attempt, attemptState (+16 more)

### Community 54 - "testing/package.json"
Cohesion: 0.13
Nodes (18): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, drizzle-orm@^0.45.4, exports, @clauderon/core, @clauderon/db (+10 more)

### Community 55 - "health.test.ts"
Cohesion: 0.20
Nodes (8): memberShell(), mergePaths(), parsePathOutput(), printPathCommand(), refreshToolPath(), shellPath(), ADR-0007, SCRIPT

### Community 56 - "deploy.sh"
Cohesion: 0.30
Nodes (16): compose(), die(), down(), env_get(), env_set(), init_env(), preflight(), say() (+8 more)

### Community 57 - "client.ts"
Cohesion: 0.13
Nodes (17): ADR-0004, AUDIT_PAGE_SIZE, AuditEntry, AuditFilters, handle, connect(), DbHandle, CommandPublish (+9 more)

### Community 58 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution (+9 more)

### Community 59 - "Clauderon — Requirements v1 (final)"
Cohesion: 0.07
Nodes (30): 10. Glossary, 11. Related documents, 12. Next steps, 1. Overview, 2. Goals and success measures, 3. Scope, 4.1 Members and Projects, 4.2 Pods (+22 more)

### Community 60 - "db/src/machines.ts"
Cohesion: 0.12
Nodes (16): deleteMachine(), DeleteMachineResult, MachineFacts, MachineLogins, MachineRow, MachineRun, MachineRunCounts, machineRunsIn() (+8 more)

### Community 61 - "flows/page.tsx"
Cohesion: 0.11
Nodes (30): exportFlowAction(), flowActionAction(), FlowFormState, importFlowAction(), FlowRowActions(), EMPTY, FlowCard(), FlowsList() (+22 more)

### Community 62 - "start.ts"
Cohesion: 0.18
Nodes (18): nodeStates(), keysFor(), startableFlows(), startDialog(), startRuns(), TRUSTED, checkSlots(), MAX_SLOTS (+10 more)

### Community 63 - "MemorySocket"
Cohesion: 0.21
Nodes (3): Connector, FakeGateway, MemorySocket

### Community 64 - "Icon"
Cohesion: 0.16
Nodes (23): ADD_ERRORS, addEmail(), ConfirmState, FormState, refresh(), removeMachineAction(), removeMemberAction(), runsOf() (+15 more)

### Community 65 - "human-form.tsx"
Cohesion: 0.24
Nodes (9): respondAction(), RespondFormState, Choices(), OpenRequest, Question, answersFromForm(), OTHER_CHOICE, respondAs() (+1 more)

### Community 66 - "runner.ts"
Cohesion: 0.16
Nodes (15): 5. Testing strategy, OutputType, BranchFacts, branchName(), buildAgentPrompt(), CheckResult, CommandFacts, commandOutputs() (+7 more)

### Community 67 - "M0 — Foundations"
Cohesion: 0.09
Nodes (23): flow(), 11. Slices, 1. Scope, 2. Configuration, 3. Database schema, 4.1 Envelope and resuming, 4. Host Agent protocol, 5.1 Flow validator (FLW-4, FLW-5, A3) (+15 more)

### Community 68 - "environment"
Cohesion: 0.19
Nodes (13): AUTH_URL, DATABASE_URL, GATEWAY_PORT, GATEWAY_URL, GITHUB_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPERATOR_EMAILS (+5 more)

### Community 69 - "postgres"
Cohesion: 0.15
Nodes (12): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, name, environment, image, ports, volumes (+4 more)

### Community 71 - "protocol/package.json"
Cohesion: 0.17
Nodes (12): dependencies, zod@^4.6.7, exports, name, private, scripts, lint, test (+4 more)

### Community 72 - "tasks"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+4 more)

### Community 74 - "validateFlow"
Cohesion: 0.12
Nodes (22): 10. Acceptance tests, 10. Slices, 1. Scope, 2. Flows page, 3. Canvas editor (FLW-3 … FLW-6), 4. Node library (FLW-1, FLW-9, FLW-10), 5. Flow edit lock (FLW-7), 6. Slots, limits and the queue (POD-2, POD-3, POD-6) (+14 more)

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

### Community 80 - "agent.ts"
Cohesion: 0.12
Nodes (10): AgentOptions, BACKOFF_CAP_MS, BACKOFF_START_MS, Handler, HEARTBEAT_MS, MachineFacts, MachineFactsReader, StateStore (+2 more)

### Community 81 - "postgres"
Cohesion: 0.25
Nodes (8): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, environment, image, restart, volumes, postgres

### Community 83 - "M1 — Walking skeleton"
Cohesion: 0.08
Nodes (24): 1. Scope, 2.1 Create my Pod (POD-2), 2.2 Start and Stop (POD-6, part), 2.3 Pods page (POD-4), 2.4 Login checks (POD-5), 2.5 Web terminal (POD-9), 2. Pods, 3.1 Enable a Project (PRJ-1, PRJ-2) (+16 more)

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

### Community 93 - "run-engine.ts"
Cohesion: 0.12
Nodes (17): MachineBack, RunContext, RunEngineOptions, Sender, ADR-0006, activeOutputs(), SnapshotNode, latestAnsweredRound() (+9 more)

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

### Community 103 - "CONTRIBUTING.md"
Cohesion: 0.10
Nodes (15): Releases and the repo graph, Branches, Commits, Configuration and secrets, Contributing, Pull requests, Releases, Repo graph for Claude (+7 more)

### Community 104 - "Deploying Clauderon"
Cohesion: 0.11
Nodes (18): 1. Prepare the machine (once), 2. Outside accounts (once), 3. Configure, 4. Start the stack, 5. Publish with a Cloudflare Tunnel, 6. Members pair their Machines, 7. Backups, Demo on Render (+10 more)

### Community 105 - "M4 — Refinement and release"
Cohesion: 0.12
Nodes (17): 1. Scope, 2.1 Diff (TRK-3), 2.2 Usage (TRK-4), 2.3 Artifact (TRK-5), 2.4 Batch page (TRK-6), 2.5 Ticket detail (TIC-4), 2. Tracking, 3. Machines (replaces Pods) (+9 more)

### Community 106 - "Clauderon"
Cohesion: 0.12
Nodes (17): Architecture, Clauderon, Contributing, Development commands, Development (`.env`), Documentation, Environment variables, How it works (+9 more)

### Community 107 - "3. Day by day"
Cohesion: 0.14
Nodes (14): 1. At a glance, 2. Before Day 1, 3. Day by day, 4. How the team works with AI agents, 5. Risks and what to cut, 6. Definition of done, Clauderon v1 — seven-day roadmap, Day 1 — Foundations (M0) (+6 more)

### Community 108 - "M3 — People in the loop"
Cohesion: 0.15
Nodes (13): 10. Slices, 1. Scope, 2.1 Approve (FLW-2, RUN-4, RUN-6), 2.2 Grill (FLW-2, RUN-10), 2. Human Nodes, 3. Needs you (RUN-5, MEM-2), 4. Retry (RUN-7, RUN-9), 5. Cancel (RUN-8) (+5 more)

### Community 109 - "cloudflared"
Cohesion: 0.17
Nodes (12): command, configs, depends_on, environment, image, restart, source, target (+4 more)

### Community 110 - "Clauderon at a glance"
Cohesion: 0.17
Nodes (12): Architecture in brief, Clauderon at a glance, Decisions we need from leads, How it works, How we will know it works, In one sentence, Learn more, Roadmap (+4 more)

### Community 111 - "Clauderon"
Cohesion: 0.18
Nodes (9): Agent skills, Architecture, Clauderon, Commands, Contributing, Domain docs, Issue tracker, Next.js (+1 more)

### Community 112 - "DESIGN.md"
Cohesion: 0.20
Nodes (9): Colors, Components, Do's and Don'ts, Elevation & Depth, Layout, Overview, Shapes, Theme (+1 more)

### Community 113 - "Contributing guide and team conventions (design)"
Cohesion: 0.20
Nodes (9): Approaches, Branch flow and repo graph (decided), Contributing guide and team conventions (design), Convention (my proposals, to be reviewed), Goals, Intent, Left to the builder, Non-goals / anti-goals (+1 more)

### Community 114 - "Shared conventions"
Cohesion: 0.22
Nodes (9): Clauderon v1 — milestone specs, Definition of done for every slice, Naming, Repository layout, Requirement coverage, Shared conventions, Slices, The test seam (spec Q1) (+1 more)

### Community 115 - "Issue tracker: GitHub"
Cohesion: 0.25
Nodes (7): Conventions, How v1 work is organised, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 116 - "Language"
Cohesion: 0.29
Nodes (7): Clauderon, Execution, Flows, Language, People, Runs, Work

### Community 117 - "protocol.test.ts"
Cohesion: 0.43
Nodes (5): createGatewayTicket(), GATEWAY_TICKET_SECONDS, sign(), verifyGatewayTicket(), hello

### Community 118 - "Log a bug"
Cohesion: 0.33
Nodes (5): Body, File it, Log a bug, Rules, Title

### Community 119 - "x-app-env"
Cohesion: 0.40
Nodes (5): x-app-env, DATABASE_URL, GITHUB_TOKEN, OPERATOR_EMAILS, SESSION_SECRET

### Community 120 - "Domain Docs"
Cohesion: 0.40
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 121 - "Spike M0-02: Claude Code headless in the Pod image"
Cohesion: 0.40
Nodes (4): Findings, Goal, Spike M0-02: Claude Code headless in the Pod image, Steps

### Community 122 - "Pods push and open pull requests with their own git/gh login"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Pods push and open pull requests with their own git/gh login

### Community 123 - "Flows are typed DAGs without cycles, run one Node at a time"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Flows are typed DAGs without cycles, run one Node at a time

### Community 124 - "Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent

### Community 125 - "The web app runs on Vercel, with an always-on Gateway for long-lived connections"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, The web app runs on Vercel, with an always-on Gateway for long-lived connections

### Community 126 - "Each Member runs on their own Machine, paired to a public app"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Each Member runs on their own Machine, paired to a public app

### Community 127 - "The Agent ships as one bundle with its own Node, and checks its Machine"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, The Agent ships as one bundle with its own Node, and checks its Machine

## Knowledge Gaps
- **59 isolated node(s):** `ADR-0006`, `ADR-0006`, `ADR-0007`, `ADR-0006`, `ADR-0007` (+54 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 928 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Gateway tests` to `Web auth and access`, `Agent smoke and doctor`, `Agent node execution`, `Needs-you and run pages`, `Agent main and CLI`, `Flow canvas geometry`, `Node library UI`, `Machine page widgets`, `Claude CLI wrapper`, `core/src/human.ts`, `Agent service install`, `Root tooling`, `createGateway`, `pair.ts`, `core/src/index.ts`, `run.ts`, `flow.ts`, `server.test.ts`, `m2.test.ts`, `pairings.test.ts`, `flow-editor-model.test.ts`, `health.test.ts`, `flows/page.tsx`, `start.ts`, `human-form.tsx`, `runner.ts`, `M0 — Foundations`, `validateFlow`, `protocol.test.ts`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `deps()` (e.g. with `web/test/access.test.ts` and `m1.test.ts`) actually correct?**
  _`deps()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0006`, `ADR-0006`, `ADR-0007` to the rest of the system?**
  _59 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Web auth and access` be split into smaller, more focused modules?**
  _Cohesion score 0.07562008469449485 - nodes in this community are weakly interconnected._
- **Why does `Member` connect `Web auth and access` to `Shared conventions`, `CONTRIBUTING.md`, `LinkSocket`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Should `Agent smoke and doctor` be split into smaller, more focused modules?**
  _Cohesion score 0.06294326241134751 - nodes in this community are weakly interconnected._
- **Why does `Contributing` connect `CONTRIBUTING.md` to `Web auth and access`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._