# Graph Report - clauderon  (2026-11-24)

## Corpus Check
- 377 files · ~291,279 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 4, .example 2, .cmd 1)

## Summary
- 2887 nodes · 7291 edges · 147 communities (136 shown, 11 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 197 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c9fc42d1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- gateway/test/m3.test.ts
- src/access.ts
- RunEngine
- agent-install.ts
- fakes.ts
- server/library.ts
- runs/[id]/page.tsx
- host-agent/src/main.ts
- web/package.json
- flow-canvas.tsx
- server/runs.ts
- (app)/layout.tsx
- library-view.ts
- projects/page.tsx
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
- build-flow.tsx
- db/package.json
- run.ts
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
- server/flows.ts
- flow-node.tsx
- web/test/m3.test.ts
- server.test.ts
- gateway/src/main.ts
- FakeAgent
- README.md
- next
- flow-editor.tsx
- features/package.json
- db/src/schema.ts
- testing/package.json
- build.ts
- deploy.sh
- db/src/schema.ts
- compilerOptions
- core/src/index.ts
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
- src/runs.ts
- core/package.json
- MemorySocket
- agent.ts
- postgres
- Payload
- M4 — Refinement and release
- handlers.test.ts
- web
- gateway
- backup.sh
- migrate
- healthcheck
- build
- src/library.ts
- Clock
- Clauderon
- Contributing
- run-live.tsx
- server/runtime.ts
- protocol.test.ts
- after-pr-merge.mjs
- pnpm-workspace.yaml
- { GET, POST }
- dynamic
- ListSkeleton
- M2 — Flows and scheduling
- Flow Drafts run Claude Code on the Member's Machine, outside any Run
- The whole app is self-hosted on the Pod Host and reached over Tailscale
- db/test/access.test.ts
- 3. Day by day
- M3 — People in the loop
- Remove Dry-run; keep the editor's Test run
- server/github.ts
- CONTRIBUTING.md
- cloudflared
- Clauderon at a glance
- db/src/human.ts
- projects/actions.ts
- Clauderon
- tickets/page.tsx
- DESIGN.md
- M0 — Foundations
- Shared conventions
- Contributing guide and team conventions (design)
- core/src/human.ts
- Issue tracker: GitHub
- Language
- isActive
- .scheduleNow
- Log a bug
- logins.ts
- Domain Docs
- Spike M0-02: Claude Code headless in the Pod image
- tickets.ts
- Pods push and open pull requests with their own git/gh login
- Flows are typed DAGs without cycles, run one Node at a time
- Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent
- The web app runs on Vercel, with an always-on Gateway for long-lived connections
- The Agent ships as one bundle with its own Node, and checks its Machine
- AGENTS.md
- Clauderon docs
- machine-watch.ts
- run-input.ts
- auth.ts
- flow.test.ts
- disk.ts
- The GitHub token is set on the Projects page, stored encrypted

## God Nodes (most connected - your core abstractions)
1. `deps()` - 101 edges
2. `requireMember()` - 78 edges
3. `vitest` - 57 edges
4. `next` - 57 edges
5. `react` - 51 edges
6. `Db` - 48 edges
7. `Payload` - 41 edges
8. `RunEngine` - 37 edges
9. `Icon` - 36 edges
10. `recordAudit()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Architecture` --references--> `System`  [INFERRED]
  CLAUDE.md → apps/host-agent/src/system.ts
- `11. Slices` --references--> `endMemberAccess()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/db/src/access.ts
- `4.2 Run engine (RUN-2, RUN-3, RUN-16)` --references--> `nextNode()`  [INFERRED]
  docs/specs/m1-walking-skeleton.md → packages/core/src/run.ts
- `Findings` --references--> `extractResultBlock()`  [INFERRED]
  docs/specs/notes/claude-headless.md → packages/core/src/runner.ts
- `4. Changes by layer` --references--> `parseGrillQuestions()`  [INFERRED]
  docs/plans/m3-execution-plan.md → packages/core/src/human.ts

## Import Cycles
- None detected.

## Communities (147 total, 11 thin omitted)

### Community 0 - "gateway/test/m3.test.ts"
Cohesion: 0.21
Nodes (16): answerWith(), attemptId(), Script, scriptPlanAndDeliver(), setup(), signedIn(), startRun(), schema (+8 more)

### Community 1 - "src/access.ts"
Cohesion: 0.13
Nodes (26): clauderonAdapter(), orNull(), toUser(), AllowlistRow, AuditInput, createSession(), endSession(), findMemberByAccount() (+18 more)

### Community 2 - "RunEngine"
Cohesion: 0.17
Nodes (8): createGateway(), RunEngine, askHuman(), latestAnsweredRound(), attemptsOfRun(), finishAttempt(), getRunContext(), updateRun()

### Community 3 - "agent-install.ts"
Cohesion: 0.08
Nodes (31): agent, doctor, env, home, nodeVersion, problems, report, server (+23 more)

### Community 4 - "fakes.ts"
Cohesion: 0.08
Nodes (16): signalGroup(), ADR-0006, EXEC_ARGS, ExecOptions, OutputListener, ProcessHandle, Signal, System (+8 more)

### Community 5 - "server/library.ts"
Cohesion: 0.19
Nodes (23): cloneNodeAction(), deleteNodeAction(), exportNodesAction(), saveNodeAction(), cloneMyNode(), CloneNodeOutcome, createMyNode(), Definition (+15 more)

### Community 6 - "runs/[id]/page.tsx"
Cohesion: 0.14
Nodes (23): AuditPage(), detailText(), dynamic, Search, SUBJECT_LINK, diskFree(), FilterSelect(), Option (+15 more)

### Community 7 - "host-agent/src/main.ts"
Cohesion: 0.09
Nodes (41): registerDraftHandlers(), findBash(), localSystem(), agentBinDir(), ask(), [command = "run", ...args], doctorCommand(), doctorFor() (+33 more)

### Community 8 - "web/package.json"
Cohesion: 0.07
Nodes (39): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, next@^16.4.6, next-auth@5.0.0-beta.32, react@^19.3.1, react-dom@^19.3.1 (+31 more)

### Community 9 - "flow-canvas.tsx"
Cohesion: 0.12
Nodes (35): boundsOf(), centerOn(), clampZoom(), edgePath(), FAR_ZOOM, fitBounds(), GRID, MAX_ZOOM (+27 more)

### Community 10 - "server/runs.ts"
Cohesion: 0.11
Nodes (29): openRequest(), view(), viewMachine(), viewMachines(), CancelOutcome, isUuid(), NeedsYouItem, NodeState (+21 more)

### Community 11 - "(app)/layout.tsx"
Cohesion: 0.10
Nodes (26): AccessDeniedPage(), dynamic, needsYouAction(), AppLayout(), inter, jetbrains, metadata, outfit (+18 more)

### Community 12 - "library-view.ts"
Cohesion: 0.14
Nodes (33): ImportNodes(), LibraryList(), NodeCard(), NodeDialog(), deleteBlocker(), emptyText(), filterNodes(), groupCounts() (+25 more)

### Community 13 - "projects/page.tsx"
Cohesion: 0.22
Nodes (13): enableAction(), EnableState, saveTokenAction(), TokenState, EnableForm(), GitHubTokenForm(), RemoveProjectForm(), RemoveTokenForm() (+5 more)

### Community 14 - "machines/[id]/page.tsx"
Cohesion: 0.09
Nodes (46): MachineFormState, PairFormState, AutoRefresh(), CmdBox(), DoctorCard(), DOT, looksLikeCommand(), ORDER (+38 more)

### Community 15 - "check"
Cohesion: 0.08
Nodes (25): env, runs-on, services, steps, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, TEST_DATABASE_URL (+17 more)

### Community 16 - "machine-link.ts"
Cohesion: 0.10
Nodes (13): Handler, HeartbeatListener, HelloListener, Link, MachineLinks, MachineLinksOptions, ADR-0006, markAllMachinesDisconnected() (+5 more)

### Community 17 - "protocol/src/index.ts"
Cohesion: 0.09
Nodes (33): ClaudeErrorWatch, draftDir(), DraftRunnerOptions, runDraft(), Running, ADR-0008, AgentLink, detached() (+25 more)

### Community 18 - "host-agent/package.json"
Cohesion: 0.08
Nodes (30): dependencies, @clauderon/core@workspace:*, @clauderon/protocol@workspace:*, dockerode@^5.0.1, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, esbuild@0.28.2 (+22 more)

### Community 19 - "members/page.tsx"
Cohesion: 0.20
Nodes (17): ADD_ERRORS, addEmail(), FormState, refresh(), removeMachineAction(), removeMemberAction(), runsOf(), AddEmailForm() (+9 more)

### Community 20 - "update.ts"
Cohesion: 0.32
Nodes (7): latestAgent(), sha256(), ADR-0007, updateAgent(), UpdateOptions, UpdateResult, AgentManifest

### Community 21 - "service.ts"
Cohesion: 0.16
Nodes (25): Exec, installService(), launchdPath(), launchdPlist(), logFile(), SERVICE_LABEL, serviceArgs(), serviceInstalled() (+17 more)

### Community 22 - "react"
Cohesion: 0.18
Nodes (15): FlowFormState, SettingsFormState, MACHINE_NAME_MAX, MachineSettings(), PairingPhase, PairingProgress(), Step, ConfirmProps (+7 more)

### Community 23 - "package.json"
Cohesion: 0.07
Nodes (31): devDependencies, eslint@^10.15.0, tsx@^4.23.15, turbo@^2.11.11, @types/node@^26.6.6, typescript@~6.0.3, typescript-eslint@^8.72.2, vitest@^5.1.0 (+23 more)

### Community 24 - "flow-drafts.ts"
Cohesion: 0.13
Nodes (22): Draft, FlowDraftsOptions, Job, Purpose, ADR-0008, agentSupportsFlowDrafts(), describeLibrary(), DraftLibraryNode (+14 more)

### Community 25 - "pair.ts"
Cohesion: 0.15
Nodes (16): checkGateway(), GatewayCheck, skew(), ADR-0007, httpBase(), pair(), PAIR_POLL_MS, Paired (+8 more)

### Community 26 - "FakeGitHub"
Cohesion: 0.14
Nodes (8): GitHubReader, Issue, OpenPullRequest, PullRequest, Repository, FakeGitHub, FakePullRequest, RepoData

### Community 27 - "flow-file.ts"
Cohesion: 0.14
Nodes (17): buildFlowFile(), ENTRY_KINDS, fail(), FATAL, FLOW_FILE_FORMAT, FLOW_FILE_MAX_BYTES, FLOW_FILE_VERSION, FlowToExport (+9 more)

### Community 28 - "ref_node_path"
Cohesion: 0.20
Nodes (8): memberShell(), mergePaths(), parsePathOutput(), printPathCommand(), refreshToolPath(), shellPath(), ADR-0007, SCRIPT

### Community 29 - "build-flow.tsx"
Cohesion: 0.12
Nodes (21): BuildAvailability, BuildFlow(), Composer(), Draft, DraftPreview(), EXAMPLES, Phase, ADR-0008 (+13 more)

### Community 30 - "db/package.json"
Cohesion: 0.06
Nodes (34): ADR-0004, dependencies, @clauderon/core@workspace:*, drizzle-orm@^0.45.4, pg@^8.23.1, devDependencies, drizzle-kit@^0.31.11, @types/pg@^8.23.1 (+26 more)

### Community 31 - "run.ts"
Cohesion: 0.17
Nodes (14): 2. Architecture decisions, AttemptState, AttemptView, holdsSlot(), MachineForSchedule, MOVES, RUN_EVENTS, RUN_STATES (+6 more)

### Community 32 - "run-engine.ts"
Cohesion: 0.12
Nodes (15): MachineBack, RunContext, RunEngineOptions, Sender, ADR-0006, log(), FlowSnapshot, snapshotFlow() (+7 more)

### Community 33 - "flow.ts"
Cohesion: 0.29
Nodes (11): byCanvas(), compare(), ConnectResult, cycleEdges(), Flow, FlowEdge, FlowNode, groupOutgoing() (+3 more)

### Community 34 - "gateway/package.json"
Cohesion: 0.10
Nodes (24): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, @types/ws@^8.18.2 (+16 more)

### Community 35 - "server/runtime.ts"
Cohesion: 0.17
Nodes (15): dynamic, GET(), dynamic, GET(), ADR-0006, AccessDeps, GoogleSignIn, memberFromCookies() (+7 more)

### Community 36 - "deps"
Cohesion: 0.12
Nodes (33): createFlowAction(), exportFlowAction(), flowActionAction(), importFlowAction(), loadFlowStartAction(), loadFlowStartChoicesAction(), startFromInputAction(), saveFlowAction() (+25 more)

### Community 37 - "services"
Cohesion: 0.07
Nodes (31): databases, databaseName, ipAllowList, name, plan, postgresMajorVersion, region, user (+23 more)

### Community 38 - "server/projects.ts"
Cohesion: 0.12
Nodes (24): enableRepository(), EnableRepositoryResult, lastAttempt, mapLimit(), pullFromGitHub(), refreshPullRequest(), SyncResult, enableProject() (+16 more)

### Community 39 - "Clauderon — Requirements v1 (final)"
Cohesion: 0.07
Nodes (30): 10. Glossary, 11. Related documents, 12. Next steps, 1. Overview, 2. Goals and success measures, 3. Scope, 4.1 Members and Projects, 4.2 Pods (+22 more)

### Community 40 - "M1 — Walking skeleton"
Cohesion: 0.08
Nodes (24): 1. Scope, 2.1 Create my Pod (POD-2), 2.2 Start and Stop (POD-6, part), 2.3 Pods page (POD-4), 2.4 Login checks (POD-5), 2.5 Web terminal (POD-9), 2. Pods, 3.1 Enable a Project (PRJ-1, PRJ-2) (+16 more)

### Community 41 - "doctor.ts"
Cohesion: 0.11
Nodes (17): CLOCK_SKEW_MS, DoctorInput, firstLine(), fixFor(), Platform, runDoctor(), ADR-0007, ClaudeLogin (+9 more)

### Community 42 - "envelope.ts"
Cohesion: 0.16
Nodes (13): envelopeShape, parseEnvelope(), ParseResult, CONTROL_TYPES, ControlType, isMessageType(), messageSchemas, MessageType (+5 more)

### Community 43 - "server/flows.ts"
Cohesion: 0.07
Nodes (30): FlowsTabs(), ImportFlow(), copyName(), dynamic, LibraryPage(), NewFlow(), dynamic, FlowsPage() (+22 more)

### Community 44 - "flow-node.tsx"
Cohesion: 0.13
Nodes (22): CanvasHandle(), HandleType, FIcon, kindIcon(), stroke, acceptsWire(), KIND_LABEL, NodeAction (+14 more)

### Community 45 - "web/test/m3.test.ts"
Cohesion: 0.07
Nodes (37): setup(), AppDeps, Viewer, cloneMyFlow(), deleteMyFlow(), EditorData, editorData(), saveMyFlow() (+29 more)

### Community 46 - "server.test.ts"
Cohesion: 0.14
Nodes (20): handlePairing(), json(), PairingHttpOptions, readBody(), ADR-0006, ADR-0007, pendingCode(), hashToken() (+12 more)

### Community 47 - "gateway/src/main.ts"
Cohesion: 0.14
Nodes (7): databaseUrl, { db }, gateway, port, sessionSecret, ADR-0010, listenMemberRevoked()

### Community 48 - "FakeAgent"
Cohesion: 0.28
Nodes (3): Envelope, serialize(), ResumeBuffer

### Community 49 - "README.md"
Cohesion: 0.30
Nodes (3): Consequences, Considered Options, Each Member runs on their own Machine, paired to a public app

### Community 50 - "next"
Cohesion: 0.11
Nodes (24): loadPullRequestStartDialog(), startPullRequestsAction(), dynamic, PullRequestsPage(), Search, PullRequestListRow, PullRequestTable(), selectable() (+16 more)

### Community 51 - "flow-editor.tsx"
Cohesion: 0.08
Nodes (38): intersects(), isTyping(), Selection, DEFAULT_NODE, Doc, FlowEditor(), GraphEdge, isMac() (+30 more)

### Community 52 - "features/package.json"
Cohesion: 0.14
Nodes (14): dependencies, zod@^4.6.7, exports, zod, name, private, scripts, build:file (+6 more)

### Community 53 - "db/src/schema.ts"
Cohesion: 0.06
Nodes (27): cloneFlow(), copyName(), DeleteFlowResult, FlowGraphInput, FlowListRow, FlowLock, importFlow(), ImportFlowPlan (+19 more)

### Community 54 - "testing/package.json"
Cohesion: 0.13
Nodes (18): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, drizzle-orm@^0.45.4, exports, @clauderon/core, @clauderon/db (+10 more)

### Community 55 - "build.ts"
Cohesion: 0.08
Nodes (33): buildId, bundle, dist, manifest, ADR-0007, root, versionMatch, config (+25 more)

### Community 56 - "deploy.sh"
Cohesion: 0.29
Nodes (16): compose(), die(), down(), env_get(), env_set(), init_env(), preflight(), say() (+8 more)

### Community 57 - "db/src/schema.ts"
Cohesion: 0.08
Nodes (22): AUDIT_PAGE_SIZE, AuditEntry, AuditFilters, GitHubAccess, removeGitHubAccess(), setGitHubAccess(), ADR-0010, artifact (+14 more)

### Community 58 - "compilerOptions"
Cohesion: 0.04
Nodes (40): extends, include, extends, include, compilerOptions, allowJs, incremental, jsx (+32 more)

### Community 59 - "core/src/index.ts"
Cohesion: 0.07
Nodes (25): BrowserHub, BrowserHubOptions, ADR-0008, add(), LiveHub, LogLine, send(), LOG_RETENTION_DAYS (+17 more)

### Community 60 - "steps"
Cohesion: 0.10
Nodes (19): runs-on, steps, strategy, jobs, agent, os, name, on (+11 more)

### Community 61 - "flows-list.tsx"
Cohesion: 0.23
Nodes (16): FlowRowActions(), EMPTY, FlowCard(), FlowsList(), SCOPES, Steps(), deleteRunsNote(), filterFlows() (+8 more)

### Community 62 - "server/machines.ts"
Cohesion: 0.07
Nodes (41): addToAllowlist(), approveMyPairing(), ApproveResult, canRemoveMachine(), checkMyLogins(), LookUpResult, MACHINE_NAME_MAX, MachineSettingsInput (+33 more)

### Community 63 - "db/src/machines.ts"
Cohesion: 0.14
Nodes (15): DeleteMachineResult, MachineFacts, MachineLogins, MachineRun, MachineRunCounts, machineRunsIn(), QueuedRun, queuedRuns() (+7 more)

### Community 64 - "Deploying Clauderon"
Cohesion: 0.14
Nodes (14): 1. Prepare the machine (once), 2. Outside accounts (once), 3. Configure, 4. Start the stack, 5. Publish with a Cloudflare Tunnel, 6. Members pair their Machines, 7. Backups, Demo on Render (+6 more)

### Community 65 - "human-form.tsx"
Cohesion: 0.24
Nodes (9): respondAction(), RespondFormState, Choices(), OpenRequest, Question, answersFromForm(), OTHER_CHOICE, respondAs() (+1 more)

### Community 66 - "runner.ts"
Cohesion: 0.09
Nodes (33): claudeResult(), 1. Starting point, 3. Dependency graph and order, 4. Changes by layer, 5. Testing strategy, 6. Risks and edge cases, 8. Deployment order, 9. Progress log (+25 more)

### Community 67 - "start.ts"
Cohesion: 0.12
Nodes (23): nodeStates(), FlowStartChoice, keysFor(), PullRequestRef, pullRequestStartDialog(), resolveInput(), startableFlows(), startDialog() (+15 more)

### Community 68 - "environment"
Cohesion: 0.20
Nodes (12): AUTH_URL, DATABASE_URL, GATEWAY_PORT, GATEWAY_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPERATOR_EMAILS, SESSION_SECRET (+4 more)

### Community 69 - "postgres"
Cohesion: 0.15
Nodes (12): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, name, environment, image, ports, volumes (+4 more)

### Community 70 - "testing/src/index.ts"
Cohesion: 0.10
Nodes (25): Gateway, GatewayOptions, open(), operators, setup(), flusher(), newGateway(), restartGateway() (+17 more)

### Community 71 - "protocol/package.json"
Cohesion: 0.17
Nodes (12): dependencies, zod@^4.6.7, exports, zod, name, private, scripts, lint (+4 more)

### Community 72 - "tasks"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+4 more)

### Community 74 - "pairings.ts"
Cohesion: 0.13
Nodes (15): PAIRING_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_TTL_MS, ADR-0006, MACHINE_DEFAULT_SLOTS, ApprovePairingResult, CreatePairingResult, MAX_PENDING_PAIRINGS (+7 more)

### Community 75 - "FlowDrafts"
Cohesion: 0.32
Nodes (3): FlowDrafts, sendEvent(), Member

### Community 76 - "compose.yml"
Cohesion: 0.14
Nodes (13): content, configs, cloudflared, name, name, services, volumes, pgdata (+5 more)

### Community 77 - "src/runs.ts"
Cohesion: 0.10
Nodes (17): viewRun(), activeRun(), AttemptEnd, buildRetryContext(), CancelRunResult, getRunView(), isUniqueViolation(), LogStream (+9 more)

### Community 78 - "core/package.json"
Cohesion: 0.20
Nodes (9): exports, name, private, scripts, lint, test, typecheck, type (+1 more)

### Community 79 - "MemorySocket"
Cohesion: 0.21
Nodes (3): Connector, FakeGateway, MemorySocket

### Community 80 - "agent.ts"
Cohesion: 0.11
Nodes (12): AgentOptions, BACKOFF_CAP_MS, BACKOFF_START_MS, Handler, HEARTBEAT_MS, MachineFacts, MachineFactsReader, MachineUsage (+4 more)

### Community 81 - "postgres"
Cohesion: 0.25
Nodes (8): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, environment, image, restart, volumes, postgres

### Community 82 - "Payload"
Cohesion: 0.17
Nodes (8): MachineService, MachineServiceOptions, ADR-0006, ADR-0007, FakeLink, applyMachineDoctor(), applyMachineLogins(), Payload

### Community 83 - "M4 — Refinement and release"
Cohesion: 0.12
Nodes (17): 1. Scope, 2.1 Diff (TRK-3), 2.2 Usage (TRK-4), 2.3 Artifact (TRK-5), 2.4 Batch page (TRK-6), 2.5 Ticket detail (TIC-4), 2. Tracking, 3. Machines (replaces Pods) (+9 more)

### Community 84 - "handlers.test.ts"
Cohesion: 0.13
Nodes (14): CLAUDE_ARGS, claudeCommand(), ClaudeEvent, Content, draftClaudeCommand(), firstLine(), inputTokens(), ModelUsage (+6 more)

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

### Community 91 - "src/library.ts"
Cohesion: 0.09
Nodes (24): describeProblems(), isEntryKind(), NODE_KINDS, NodeInput, NodeKind, NodeOutput, OUTPUT_TYPES, checkNodeDefinition() (+16 more)

### Community 92 - "Clock"
Cohesion: 0.15
Nodes (6): Clock, systemClock, TimerHandle, FakeAgent, HelloOverrides, Responder

### Community 93 - "Clauderon"
Cohesion: 0.12
Nodes (17): Architecture, Clauderon, Contributing, Development commands, Development (`.env`), Documentation, Environment variables, How it works (+9 more)

### Community 94 - "Contributing"
Cohesion: 0.20
Nodes (10): Branches, Commits, Configuration and secrets, Contributing, Pull requests, Release notes, Releases, Repo graph for Claude (+2 more)

### Community 95 - "run-live.tsx"
Cohesion: 0.12
Nodes (32): dynamic, NeedsYouPage(), Input, RetryFromHere(), classify(), KIND, Line, NodeRow() (+24 more)

### Community 96 - "server/runtime.ts"
Cohesion: 0.16
Nodes (12): dynamic, GET(), ADR-0006, GET(), gitHubLogin(), gatewayUrl(), gitHubAccessDeps(), globalForDb (+4 more)

### Community 97 - "protocol.test.ts"
Cohesion: 0.43
Nodes (5): createGatewayTicket(), GATEWAY_TICKET_SECONDS, sign(), verifyGatewayTicket(), hello

### Community 103 - "ListSkeleton"
Cohesion: 0.60
Nodes (3): Loading(), Loading(), ListSkeleton()

### Community 104 - "M2 — Flows and scheduling"
Cohesion: 0.16
Nodes (14): 9. Seeds (FLW-8), 10. Slices, 1. Scope, 2. Flows page, 3. Canvas editor (FLW-3 … FLW-6), 4. Node library (FLW-1, FLW-9, FLW-10), 5. Flow edit lock (FLW-7), 6. Slots, limits and the queue (POD-2, POD-3, POD-6) (+6 more)

### Community 105 - "Flow Drafts run Claude Code on the Member's Machine, outside any Run"
Cohesion: 0.50
Nodes (3): Consequences, Considered Options, Flow Drafts run Claude Code on the Member's Machine, outside any Run

### Community 106 - "The whole app is self-hosted on the Pod Host and reached over Tailscale"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, The whole app is self-hosted on the Pod Host and reached over Tailscale

### Community 107 - "db/test/access.test.ts"
Cohesion: 0.16
Nodes (13): sessionFor(), checkGoogleSignIn(), member(), signInWithCookie(), allow(), addAllowlistEntry(), endMemberAccess(), normalizeEmail() (+5 more)

### Community 108 - "3. Day by day"
Cohesion: 0.14
Nodes (14): 1. At a glance, 2. Before Day 1, 3. Day by day, 4. How the team works with AI agents, 5. Risks and what to cut, 6. Definition of done, Clauderon v1 — seven-day roadmap, Day 1 — Foundations (M0) (+6 more)

### Community 109 - "M3 — People in the loop"
Cohesion: 0.15
Nodes (13): 10. Slices, 1. Scope, 2.1 Approve (FLW-2, RUN-4, RUN-6), 2.2 Grill (FLW-2, RUN-10), 2. Human Nodes, 3. Needs you (RUN-5, MEM-2), 4. Retry (RUN-7, RUN-9), 5. Cancel (RUN-8) (+5 more)

### Community 111 - "server/github.ts"
Cohesion: 0.15
Nodes (8): ApiIssue, fetchJson(), gitHubApi(), request(), ADR-0010, withCachedPullRequests(), pull(), setup()

### Community 112 - "CONTRIBUTING.md"
Cohesion: 0.12
Nodes (11): Releases and the repo graph, Updating tickets after a PR merge, Triage Labels, Change, Notes, Test plan, Why, labels (+3 more)

### Community 113 - "cloudflared"
Cohesion: 0.17
Nodes (12): command, configs, depends_on, environment, image, restart, source, target (+4 more)

### Community 114 - "Clauderon at a glance"
Cohesion: 0.17
Nodes (12): Architecture in brief, Clauderon at a glance, Decisions we need from leads, How it works, How we will know it works, In one sentence, Learn more, Roadmap (+4 more)

### Community 115 - "db/src/human.ts"
Cohesion: 0.14
Nodes (15): checkAnswers(), AskHumanInput, AUDIT_ACTION, HumanRequest, humanRequestsOfRun(), isUuid(), openCondition, RespondResult (+7 more)

### Community 116 - "projects/actions.ts"
Cohesion: 0.23
Nodes (13): ENABLE_ERRORS, loadBranches(), loadRepositories(), removeProjectAction(), removeTokenAction(), ADR-0010, removeGitHubToken(), saveGitHubToken() (+5 more)

### Community 117 - "Clauderon"
Cohesion: 0.18
Nodes (9): Agent skills, Architecture, Clauderon, Commands, Contributing, Domain docs, Issue tracker, Next.js (+1 more)

### Community 118 - "tickets/page.tsx"
Cohesion: 0.25
Nodes (12): dynamic, Search, TicketsPage(), VIEWS, FilterLink(), FilterResults(), Filters, FiltersContext (+4 more)

### Community 119 - "DESIGN.md"
Cohesion: 0.20
Nodes (9): Colors, Components, Do's and Don'ts, Elevation & Depth, Layout, Overview, Shapes, Theme (+1 more)

### Community 120 - "M0 — Foundations"
Cohesion: 0.11
Nodes (18): 11. Slices, 1. Scope, 2. Configuration, 3. Database schema, 4.1 Envelope and resuming, 4.2 Messages, 4. Host Agent protocol, 5.1 Flow validator (FLW-4, FLW-5, A3) (+10 more)

### Community 121 - "Shared conventions"
Cohesion: 0.22
Nodes (9): Clauderon v1 — milestone specs, Definition of done for every slice, Naming, Repository layout, Requirement coverage, Shared conventions, Slices, The test seam (spec Q1) (+1 more)

### Community 122 - "Contributing guide and team conventions (design)"
Cohesion: 0.20
Nodes (9): Approaches, Branch flow and repo graph (decided), Contributing guide and team conventions (design), Convention (my proposals, to be reviewed), Goals, Intent, Left to the builder, Non-goals / anti-goals (+1 more)

### Community 123 - "core/src/human.ts"
Cohesion: 0.16
Nodes (12): ApproveSubject, buildGrillAnswerPrompt(), FEEDBACK_HEADING, GrillAnswers, GrillOption, GrillQuestion, HumanResponse, MAX_GRILL_OPTIONS (+4 more)

### Community 124 - "Issue tracker: GitHub"
Cohesion: 0.25
Nodes (7): Conventions, How v1 work is organised, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 125 - "Language"
Cohesion: 0.29
Nodes (7): Clauderon, Execution, Flows, Language, People, Runs, Work

### Community 126 - "isActive"
Cohesion: 0.21
Nodes (11): 10. Acceptance tests, isActive(), RunState, ACTIVE_STATUS, PullRequestState, RunForStatus, TicketStatus, ticketStatus() (+3 more)

### Community 127 - ".scheduleNow"
Cohesion: 0.24
Nodes (6): interruptRun(), moveRun(), runningAttemptIds(), runningRuns(), runsOfMachine(), runsToCleanUp()

### Community 128 - "Log a bug"
Cohesion: 0.33
Nodes (5): Body, File it, Log a bug, Rules, Title

### Community 129 - "logins.ts"
Cohesion: 0.31
Nodes (9): checkClaude(), checkLogins(), CLAUDE_STATUS_SCRIPT, LoginHooks, Logins, parseClaudeStatus(), registerLoginHandlers(), reportLogins() (+1 more)

### Community 130 - "Domain Docs"
Cohesion: 0.40
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 131 - "Spike M0-02: Claude Code headless in the Pod image"
Cohesion: 0.40
Nodes (4): Findings, Goal, Spike M0-02: Claude Code headless in the Pod image, Steps

### Community 132 - "tickets.ts"
Cohesion: 0.22
Nodes (6): viewProjects(), asPrState(), TicketFilters, TicketRow, viewTickets(), listTicketsWithRuns()

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

### Community 138 - "The Agent ships as one bundle with its own Node, and checks its Machine"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, The Agent ships as one bundle with its own Node, and checks its Machine

### Community 141 - "machine-watch.ts"
Cohesion: 0.29
Nodes (3): HEARTBEAT_TIMEOUT_MS, MachineWatch, MachineWatchOptions

### Community 142 - "run-input.ts"
Cohesion: 0.27
Nodes (7): escapeRegExp(), MASK, TOKEN_PATTERNS, checkRunInput(), RunInput, RunInputCheck, runInputTitle()

### Community 143 - "auth.ts"
Cohesion: 0.36
Nodes (6): dynamic, SignInPage(), handlers, signIn, GoogleLogo(), safeReturnPath()

### Community 144 - "flow.test.ts"
Cohesion: 0.52
Nodes (5): basicDelivery, edge(), fn(), library, planAndDeliver

### Community 145 - "disk.ts"
Cohesion: 0.47
Nodes (4): CRITICAL_DISK_GB, DiskState, diskState(), LOW_DISK_GB

## Knowledge Gaps
- **70 isolated node(s):** `ADR-0010`, `ADR-0010`, `ADR-0010`, `ADR-0008`, `ADR-0010` (+65 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1082 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `testing/src/index.ts` to `gateway/test/m3.test.ts`, `agent-install.ts`, `fakes.ts`, `host-agent/src/main.ts`, `flow-canvas.tsx`, `human.test.ts`, `(app)/layout.tsx`, `library-view.ts`, `machines/[id]/page.tsx`, `run-input.ts`, `flow.test.ts`, `protocol/src/index.ts`, `disk.ts`, `service.ts`, `package.json`, `flow-drafts.ts`, `pair.ts`, `flow-file.ts`, `ref_node_path`, `build-flow.tsx`, `run.ts`, `web/test/m3.test.ts`, `server.test.ts`, `flow-editor.tsx`, `build.ts`, `core/src/index.ts`, `flows-list.tsx`, `server/machines.ts`, `human-form.tsx`, `runner.ts`, `handlers.test.ts`, `src/library.ts`, `run-live.tsx`, `protocol.test.ts`, `db/test/access.test.ts`, `server/github.ts`, `isActive`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `deps()` (e.g. with `web/test/access.test.ts` and `github-access.test.ts`) actually correct?**
  _`deps()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0010`, `ADR-0010`, `ADR-0010` to the rest of the system?**
  _70 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/access.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1349206349206349 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `agent-install.ts`, `server/library.ts`, `runs/[id]/page.tsx`, `web/package.json`, `(app)/layout.tsx`, `library-view.ts`, `projects/page.tsx`, `machines/[id]/page.tsx`, `auth.ts`, `members/page.tsx`, `react`, `build-flow.tsx`, `server/runtime.ts`, `deps`, `server/flows.ts`, `flow-editor.tsx`, `build.ts`, `flows-list.tsx`, `human-form.tsx`, `run-live.tsx`, `server/runtime.ts`, `projects/actions.ts`, `tickets/page.tsx`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `agent-install.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07804878048780488 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `human-form.tsx`, `deps`, `runs/[id]/page.tsx`, `web/package.json`, `flow-canvas.tsx`, `(app)/layout.tsx`, `flow-node.tsx`, `library-view.ts`, `machines/[id]/page.tsx`, `projects/page.tsx`, `build-flow.tsx`, `flow-editor.tsx`, `members/page.tsx`, `next`, `tickets/page.tsx`, `flows-list.tsx`, `run-live.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._