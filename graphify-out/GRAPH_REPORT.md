# Graph Report - clauderon-pair  (2026-11-20)

## Corpus Check
- 315 files · ~226,412 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .example 2, .css 1)

## Summary
- 2470 nodes · 6219 edges · 114 communities (106 shown, 8 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 177 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b0c1a472`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/test/m3.test.ts
- src/access.ts
- RunEngine
- agent-install.ts
- fakes.ts
- src/flows.ts
- run-live.tsx
- host-agent/src/main.ts
- web/package.json
- flow-canvas.tsx
- src/runs.ts
- (app)/layout.tsx
- library-view.ts
- requireMember
- machines/[id]/page.tsx
- check
- machine-link.ts
- host-agent/src/nodes.ts
- host-agent/package.json
- members/page.tsx
- update.ts
- service.ts
- flow-editor.tsx
- package.json
- The whole app is self-hosted on the Pod Host and reached over Tailscale
- pair.ts
- FakeGitHub
- flow-file.ts
- health.test.ts
- db/package.json
- run.ts
- workspace.ts
- flow.ts
- gateway/package.json
- deps
- services
- server/projects.ts
- Clauderon — Requirements v1 (final)
- M1 — Walking skeleton
- doctor.ts
- protocol/src/index.ts
- flows/page.tsx
- flow-node.tsx
- server/flows.ts
- core/src/index.ts
- ticket-table.tsx
- flow-editor-model.test.ts
- tickets.ts
- schema.ts
- testing/package.json
- bundle.mjs
- deploy.sh
- Db
- compilerOptions
- LinkSocket
- flows-list.tsx
- start.ts
- Deploying Clauderon
- human-form.tsx
- run-engine.ts
- limits.ts
- environment
- postgres
- gateway.ts
- protocol/package.json
- tasks
- serialize
- server/machines.ts
- compose.yml
- core/package.json
- agent.ts
- postgres
- Payload
- M4 — Refinement and release
- runs/page.tsx
- web
- gateway
- backup.sh
- migrate
- healthcheck
- build
- Clauderon
- after-pr-merge.mjs
- pnpm-workspace.yaml
- { GET, POST }
- dynamic
- M0 — Foundations
- 3. Day by day
- M3 — People in the loop
- next
- Contributing
- cloudflared
- Clauderon at a glance
- Clauderon
- DESIGN.md
- validateFlow
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
1. `deps()` - 85 edges
2. `requireMember()` - 66 edges
3. `next` - 49 edges
4. `vitest` - 46 edges
5. `Db` - 43 edges
6. `RunEngine` - 39 edges
7. `react` - 39 edges
8. `Payload` - 37 edges
9. `recordAudit()` - 32 edges
10. `FlowEditor()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `Architecture` --references--> `System`  [INFERRED]
  CLAUDE.md → apps/host-agent/src/system.ts
- `4.2 Run engine (RUN-2, RUN-3, RUN-16)` --references--> `nextNode()`  [INFERRED]
  docs/specs/m1-walking-skeleton.md → packages/core/src/run.ts
- `5. Testing strategy` --references--> `extractResultBlock()`  [INFERRED]
  docs/plans/m3-execution-plan.md → packages/core/src/runner.ts
- `Findings` --references--> `extractResultBlock()`  [INFERRED]
  docs/specs/notes/claude-headless.md → packages/core/src/runner.ts
- `11. Slices` --references--> `endMemberAccess()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/db/src/access.ts

## Import Cycles
- None detected.

## Communities (114 total, 8 thin omitted)

### Community 0 - "web/test/m3.test.ts"
Cohesion: 0.09
Nodes (40): open(), operators, attemptId(), nodeStates(), Script, scriptPlanAndDeliver(), setup(), connect() (+32 more)

### Community 1 - "src/access.ts"
Cohesion: 0.08
Nodes (43): sessionFor(), addToAllowlist(), checkGoogleSignIn(), GoogleSignIn, clauderonAdapter(), orNull(), toUser(), removeMember() (+35 more)

### Community 2 - "RunEngine"
Cohesion: 0.14
Nodes (10): RunEngine, SnapshotNode, finishAttempt(), getAttempt(), getRunContext(), interruptRun(), moveRun(), runningRuns() (+2 more)

### Community 3 - "agent-install.ts"
Cohesion: 0.07
Nodes (30): agent, doctor, env, home, nodeVersion, problems, report, server (+22 more)

### Community 4 - "fakes.ts"
Cohesion: 0.14
Nodes (10): EXEC_ARGS, ExecOptions, OutputListener, ProcessHandle, Signal, ExecCall, ExecReply, FakeSystem (+2 more)

### Community 5 - "src/flows.ts"
Cohesion: 0.09
Nodes (24): FlowSnapshot, buildFlowSnapshot(), DeleteFlowResult, FlowGraphInput, FlowListRow, FlowLock, importFlow(), ImportFlowPlan (+16 more)

### Community 6 - "run-live.tsx"
Cohesion: 0.10
Nodes (39): dynamic, NeedsYouPage(), CancelFormState, cancelRunAction(), RetryFormState, retryRunAction(), CancelRun(), dynamic (+31 more)

### Community 7 - "host-agent/src/main.ts"
Cohesion: 0.11
Nodes (33): findBash(), localSystem(), signalGroup(), agentBinDir(), ask(), [command = "run", ...args], doctorCommand(), doctorFor() (+25 more)

### Community 8 - "web/package.json"
Cohesion: 0.07
Nodes (39): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, next@^16.4.6, next-auth@5.0.0-beta.32, react@^19.3.1, react-dom@^19.3.1 (+31 more)

### Community 9 - "flow-canvas.tsx"
Cohesion: 0.12
Nodes (36): boundsOf(), centerOn(), clampZoom(), edgePath(), FAR_ZOOM, fitBounds(), intersects(), MAX_ZOOM (+28 more)

### Community 10 - "src/runs.ts"
Cohesion: 0.08
Nodes (45): viewMachine(), viewMachines(), CancelOutcome, isUuid(), NeedsYouItem, NodeState, parseRunFilters(), RespondOutcome (+37 more)

### Community 11 - "(app)/layout.tsx"
Cohesion: 0.09
Nodes (26): AccessDeniedPage(), dynamic, AppLayout(), inter, jetbrains, metadata, outfit, dynamic (+18 more)

### Community 12 - "library-view.ts"
Cohesion: 0.12
Nodes (33): cloneNodeAction(), deleteNodeAction(), KIND_MARK, LibraryList(), NodeCard(), NodeDialog(), Port, PortChips() (+25 more)

### Community 13 - "requireMember"
Cohesion: 0.21
Nodes (21): ENABLE_ERRORS, enableAction(), EnableState, loadBranches(), loadRepositories(), removeProjectAction(), syncAction(), SyncState (+13 more)

### Community 14 - "machines/[id]/page.tsx"
Cohesion: 0.08
Nodes (50): approvePairingAction(), checkLoginsAction(), lookUpPairingAction(), MachineFormState, PairFormState, removeMachineAction(), setSettingsAction(), SettingsFormState (+42 more)

### Community 15 - "check"
Cohesion: 0.07
Nodes (32): runs-on, steps, strategy, env, runs-on, services, steps, POSTGRES_DB (+24 more)

### Community 16 - "machine-link.ts"
Cohesion: 0.12
Nodes (12): Handler, HeartbeatListener, HelloListener, Link, MachineLinks, MachineLinksOptions, ADR-0006, markAllMachinesDisconnected() (+4 more)

### Community 17 - "host-agent/src/nodes.ts"
Cohesion: 0.07
Nodes (29): CLAUDE_ARGS, claudeCommand(), ClaudeErrorWatch, ClaudeEvent, claudeResult(), Content, firstLine(), inputTokens() (+21 more)

### Community 18 - "host-agent/package.json"
Cohesion: 0.08
Nodes (30): dependencies, @clauderon/core@workspace:*, @clauderon/protocol@workspace:*, dockerode@^5.0.1, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, esbuild@0.28.2 (+22 more)

### Community 19 - "members/page.tsx"
Cohesion: 0.22
Nodes (16): ADD_ERRORS, addEmail(), FormState, refresh(), removeMachineAction(), removeMemberAction(), runsOf(), AddEmailForm() (+8 more)

### Community 20 - "update.ts"
Cohesion: 0.32
Nodes (7): latestAgent(), sha256(), ADR-0007, updateAgent(), UpdateOptions, UpdateResult, AgentManifest

### Community 21 - "service.ts"
Cohesion: 0.14
Nodes (25): installCommand(), Exec, installService(), launchdPath(), launchdPlist(), logFile(), SERVICE_LABEL, serviceArgs() (+17 more)

### Community 22 - "flow-editor.tsx"
Cohesion: 0.10
Nodes (25): GRID, CanvasConnection, FlowCanvasHandle, isTyping(), DEFAULT_NODE, Doc, FlowEditor(), GraphEdge (+17 more)

### Community 23 - "package.json"
Cohesion: 0.08
Nodes (29): devDependencies, eslint@^10.15.0, tsx@^4.23.15, turbo@^2.11.11, @types/node@^26.6.6, typescript@~6.0.3, typescript-eslint@^8.72.2, vitest@^5.1.0 (+21 more)

### Community 24 - "The whole app is self-hosted on the Pod Host and reached over Tailscale"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, The whole app is self-hosted on the Pod Host and reached over Tailscale

### Community 25 - "pair.ts"
Cohesion: 0.19
Nodes (12): httpBase(), pair(), PAIR_POLL_MS, Paired, PairOptions, resolveGateway(), sha256(), ADR-0006 (+4 more)

### Community 26 - "FakeGitHub"
Cohesion: 0.12
Nodes (9): ApiIssue, request(), GitHubError, GitHubReader, Issue, PullRequest, Repository, FakeGitHub (+1 more)

### Community 27 - "flow-file.ts"
Cohesion: 0.12
Nodes (20): buildFlowFile(), fail(), FATAL, FLOW_FILE_FORMAT, FLOW_FILE_MAX_BYTES, FLOW_FILE_VERSION, FlowFile, FlowToExport (+12 more)

### Community 28 - "health.test.ts"
Cohesion: 0.15
Nodes (10): ADR-0006, memberShell(), mergePaths(), parsePathOutput(), printPathCommand(), refreshToolPath(), shellPath(), ADR-0007 (+2 more)

### Community 30 - "db/package.json"
Cohesion: 0.09
Nodes (25): dependencies, @clauderon/core@workspace:*, drizzle-orm@^0.45.4, pg@^8.23.1, devDependencies, drizzle-kit@^0.31.11, @types/pg@^8.23.1, exports (+17 more)

### Community 31 - "run.ts"
Cohesion: 0.11
Nodes (25): 1. Starting point, 2. Architecture decisions, 3. Dependency graph and order, 5. Testing strategy, 6. Risks and edge cases, 8. Deployment order, 9. Progress log, M3 execution plan — People in the loop (+17 more)

### Community 32 - "workspace.ts"
Cohesion: 0.12
Nodes (22): AgentLink, detached(), errorText(), Log, checkClaude(), checkLogins(), CLAUDE_STATUS_SCRIPT, ClaudeLogin (+14 more)

### Community 33 - "flow.ts"
Cohesion: 0.15
Nodes (20): startTestRun(), byCanvas(), compare(), ConnectResult, cycleEdges(), FlowEdge, groupOutgoing(), NODE_KINDS (+12 more)

### Community 34 - "gateway/package.json"
Cohesion: 0.10
Nodes (24): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, @types/ws@^8.18.2 (+16 more)

### Community 35 - "deps"
Cohesion: 0.10
Nodes (29): dynamic, GET(), ADR-0006, dynamic, GET(), saveFlowAction(), dynamic, FlowPage() (+21 more)

### Community 37 - "services"
Cohesion: 0.07
Nodes (31): databases, databaseName, ipAllowList, name, plan, postgresMajorVersion, region, user (+23 more)

### Community 38 - "server/projects.ts"
Cohesion: 0.13
Nodes (24): EnableRepositoryResult, refreshPullRequest(), syncProject(), SyncResult, enableProject(), EnableResult, getProject(), openTicketsMissingFrom() (+16 more)

### Community 39 - "Clauderon — Requirements v1 (final)"
Cohesion: 0.07
Nodes (30): 10. Glossary, 11. Related documents, 12. Next steps, 1. Overview, 2. Goals and success measures, 3. Scope, 4.1 Members and Projects, 4.2 Pods (+22 more)

### Community 40 - "M1 — Walking skeleton"
Cohesion: 0.08
Nodes (24): 1. Scope, 2.1 Create my Pod (POD-2), 2.2 Start and Stop (POD-6, part), 2.3 Pods page (POD-4), 2.4 Login checks (POD-5), 2.5 Web terminal (POD-9), 2. Pods, 3.1 Enable a Project (PRJ-1, PRJ-2) (+16 more)

### Community 41 - "doctor.ts"
Cohesion: 0.10
Nodes (20): CLOCK_SKEW_MS, DoctorInput, firstLine(), fixFor(), LOW_DISK_GB, Platform, runDoctor(), ADR-0007 (+12 more)

### Community 42 - "protocol/src/index.ts"
Cohesion: 0.12
Nodes (20): doctorReport, envelopeShape, parseEnvelope(), ParseResult, CONTROL_TYPES, ControlType, isMessageType(), messageSchemas (+12 more)

### Community 43 - "flows/page.tsx"
Cohesion: 0.14
Nodes (18): FlowsTabs(), ImportFlow(), dynamic, LibraryPage(), NewFlow(), dynamic, FlowsPage(), dynamic (+10 more)

### Community 44 - "flow-node.tsx"
Cohesion: 0.16
Nodes (20): CanvasHandle(), HandleType, FIcon, kindIcon(), stroke, acceptsWire(), KIND_LABEL, NodeAction (+12 more)

### Community 45 - "server/flows.ts"
Cohesion: 0.11
Nodes (45): saveNodeAction(), copyName(), cleanGraph(), CloneFlowResult, cloneMyFlow(), createMyFlow(), Definition, DeleteFlowOutcome (+37 more)

### Community 47 - "core/src/index.ts"
Cohesion: 0.09
Nodes (25): databaseUrl, { db }, gateway, port, sessionSecret, handlePairing(), json(), PairingHttpOptions (+17 more)

### Community 50 - "ticket-table.tsx"
Cohesion: 0.15
Nodes (16): loadStartDialog(), startAction(), dynamic, Search, STATUSES, TicketsPage(), Dialog, selectable() (+8 more)

### Community 51 - "flow-editor-model.test.ts"
Cohesion: 0.18
Nodes (12): layeredLayout(), LAYOUT_GAP_X, LAYOUT_GAP_Y, LayoutEdge, LayoutNode, advanceTestRun(), edgeStates(), nodeStates() (+4 more)

### Community 52 - "tickets.ts"
Cohesion: 0.19
Nodes (15): viewProjects(), asPrState(), TicketFilters, TicketRow, viewTickets(), isActive(), ACTIVE_STATUS, PullRequestState (+7 more)

### Community 53 - "schema.ts"
Cohesion: 0.06
Nodes (41): openRequest(), 4. Changes by layer, 7. Traceability, AUDIT_PAGE_SIZE, AuditEntry, AuditFilters, auditOfSubject(), listAudit() (+33 more)

### Community 54 - "testing/package.json"
Cohesion: 0.13
Nodes (18): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, drizzle-orm@^0.45.4, exports, @clauderon/core, @clauderon/db (+10 more)

### Community 55 - "bundle.mjs"
Cohesion: 0.15
Nodes (9): buildId, bundle, dist, manifest, ADR-0007, root, versionMatch, config (+1 more)

### Community 56 - "deploy.sh"
Cohesion: 0.30
Nodes (16): compose(), die(), down(), env_get(), env_set(), init_env(), preflight(), say() (+8 more)

### Community 57 - "Db"
Cohesion: 0.14
Nodes (18): ADR-0004, handle, connect(), Db, CommandPublish, GATEWAY_COMMAND_CHANNEL, listenGatewayCommands(), parseGatewayCommand() (+10 more)

### Community 58 - "compilerOptions"
Cohesion: 0.04
Nodes (38): extends, include, extends, include, compilerOptions, allowJs, incremental, jsx (+30 more)

### Community 59 - "LinkSocket"
Cohesion: 0.14
Nodes (12): BrowserHub, BrowserHubOptions, add(), LiveHub, LogLine, send(), Member, BrowserEvent (+4 more)

### Community 61 - "flows-list.tsx"
Cohesion: 0.26
Nodes (13): EMPTY, FlowCard(), FlowsList(), Pipeline(), SCOPES, filterFlows(), FlowRowView, FlowScope (+5 more)

### Community 62 - "start.ts"
Cohesion: 0.15
Nodes (22): AccessDeps, AppDeps, Viewer, MemberMachine, MemberRow, MemberStatus, MembersView, RemoveMemberResult (+14 more)

### Community 64 - "Deploying Clauderon"
Cohesion: 0.14
Nodes (14): 1. Prepare the machine (once), 2. Outside accounts (once), 3. Configure, 4. Start the stack, 5. Publish with a Cloudflare Tunnel, 6. Members pair their Machines, 7. Backups, Demo on Render (+6 more)

### Community 65 - "human-form.tsx"
Cohesion: 0.26
Nodes (9): respondAction(), RespondFormState, Choices(), HumanForm(), OpenRequest, Question, answersFromForm(), OTHER_CHOICE (+1 more)

### Community 66 - "run-engine.ts"
Cohesion: 0.07
Nodes (45): MachineBack, RunContext, RunEngineOptions, Sender, ADR-0006, log(), ApproveSubject, buildGrillAnswerPrompt() (+37 more)

### Community 67 - "limits.ts"
Cohesion: 0.38
Nodes (5): checkSlots(), MAX_SLOTS, queuePositions(), SlotsCheck, ADR-0006

### Community 68 - "environment"
Cohesion: 0.19
Nodes (13): AUTH_URL, DATABASE_URL, GATEWAY_PORT, GATEWAY_URL, GITHUB_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPERATOR_EMAILS (+5 more)

### Community 69 - "postgres"
Cohesion: 0.15
Nodes (12): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, name, environment, image, ports, volumes (+4 more)

### Community 70 - "gateway.ts"
Cohesion: 0.09
Nodes (19): Gateway, GatewayOptions, LOG_RETENTION_DAYS, LogRetention, LogRetentionOptions, flusher(), newGateway(), restartGateway() (+11 more)

### Community 71 - "protocol/package.json"
Cohesion: 0.17
Nodes (11): dependencies, zod@^4.6.7, exports, name, private, scripts, lint, test (+3 more)

### Community 72 - "tasks"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+4 more)

### Community 73 - "serialize"
Cohesion: 0.16
Nodes (5): Agent, controlMessage(), Envelope, serialize(), ResumeBuffer

### Community 74 - "server/machines.ts"
Cohesion: 0.05
Nodes (52): approveMyPairing(), ApproveResult, canRemoveMachine(), LookUpResult, MACHINE_NAME_MAX, MachineSettingsInput, MachineView, ownMachine() (+44 more)

### Community 76 - "compose.yml"
Cohesion: 0.20
Nodes (9): content, configs, cloudflared, name, name, services, volumes, pgdata (+1 more)

### Community 78 - "core/package.json"
Cohesion: 0.20
Nodes (9): exports, name, private, scripts, lint, test, typecheck, type (+1 more)

### Community 80 - "agent.ts"
Cohesion: 0.08
Nodes (13): AgentOptions, BACKOFF_CAP_MS, BACKOFF_START_MS, Connector, Handler, HEARTBEAT_MS, MachineFacts, MachineFactsReader (+5 more)

### Community 81 - "postgres"
Cohesion: 0.25
Nodes (8): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, environment, image, restart, volumes, postgres

### Community 82 - "Payload"
Cohesion: 0.10
Nodes (12): createGateway(), HEARTBEAT_TIMEOUT_MS, MachineWatch, MachineWatchOptions, MachineService, MachineServiceOptions, ADR-0006, ADR-0007 (+4 more)

### Community 83 - "M4 — Refinement and release"
Cohesion: 0.12
Nodes (17): 1. Scope, 2.1 Diff (TRK-3), 2.2 Usage (TRK-4), 2.3 Artifact (TRK-5), 2.4 Batch page (TRK-6), 2.5 Ticket detail (TIC-4), 2. Tracking, 3. Machines (replaces Pods) (+9 more)

### Community 84 - "runs/page.tsx"
Cohesion: 0.18
Nodes (12): AuditPage(), detailText(), dynamic, Search, SUBJECT_LINK, FilterSelect(), Option, dynamic (+4 more)

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

### Community 93 - "Clauderon"
Cohesion: 0.12
Nodes (17): Architecture, Clauderon, Contributing, Development commands, Development (`.env`), Documentation, Environment variables, How it works (+9 more)

### Community 105 - "M0 — Foundations"
Cohesion: 0.12
Nodes (17): 11. Slices, 1. Scope, 2. Configuration, 3. Database schema, 4.1 Envelope and resuming, 4. Host Agent protocol, 5.1 Flow validator (FLW-4, FLW-5, A3), 5.2 Run state machine (RUN-2 … RUN-9, RUN-16) (+9 more)

### Community 108 - "3. Day by day"
Cohesion: 0.14
Nodes (14): 1. At a glance, 2. Before Day 1, 3. Day by day, 4. How the team works with AI agents, 5. Risks and what to cut, 6. Definition of done, Clauderon v1 — seven-day roadmap, Day 1 — Foundations (M0) (+6 more)

### Community 109 - "M3 — People in the loop"
Cohesion: 0.15
Nodes (13): 10. Slices, 1. Scope, 2.1 Approve (FLW-2, RUN-4, RUN-6), 2.2 Grill (FLW-2, RUN-10), 2. Human Nodes, 3. Needs you (RUN-5, MEM-2), 4. Retry (RUN-7, RUN-9), 5. Cancel (RUN-8) (+5 more)

### Community 111 - "next"
Cohesion: 0.15
Nodes (14): createFlowAction(), exportFlowAction(), flowActionAction(), FlowFormState, importFlowAction(), FlowRowActions(), AutoRefresh(), ConfirmProps (+6 more)

### Community 112 - "Contributing"
Cohesion: 0.07
Nodes (21): Releases and the repo graph, Branches, Commits, Configuration and secrets, Contributing, Pull requests, Release notes, Releases (+13 more)

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

### Community 120 - "validateFlow"
Cohesion: 0.12
Nodes (22): 9. Seeds (FLW-8), 10. Slices, 1. Scope, 2. Flows page, 3. Canvas editor (FLW-3 … FLW-6), 4. Node library (FLW-1, FLW-9, FLW-10), 5. Flow edit lock (FLW-7), 6. Slots, limits and the queue (POD-2, POD-3, POD-6) (+14 more)

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
- **52 isolated node(s):** `ADR-0006`, `ADR-0006`, `ADR-0007`, `ADR-0006`, `ADR-0007` (+47 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 930 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `web/test/m3.test.ts` to `src/access.ts`, `agent-install.ts`, `run-live.tsx`, `flow-canvas.tsx`, `library-view.ts`, `machines/[id]/page.tsx`, `host-agent/src/nodes.ts`, `service.ts`, `package.json`, `pair.ts`, `flow-file.ts`, `health.test.ts`, `run.ts`, `flow.ts`, `protocol/src/index.ts`, `server/flows.ts`, `flow-editor-model.test.ts`, `tickets.ts`, `Db`, `flows-list.tsx`, `human-form.tsx`, `run-engine.ts`, `limits.ts`, `agent.ts`, `validateFlow`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `deps()` (e.g. with `web/test/access.test.ts` and `m1.test.ts`) actually correct?**
  _`deps()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0006`, `ADR-0006`, `ADR-0007` to the rest of the system?**
  _52 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/test/m3.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0945273631840796 - nodes in this community are weakly interconnected._
- **Why does `deps()` connect `deps` to `web/test/m3.test.ts`, `human-form.tsx`, `src/access.ts`, `run-live.tsx`, `flows/page.tsx`, `library-view.ts`, `server/flows.ts`, `(app)/layout.tsx`, `next`, `machines/[id]/page.tsx`, `requireMember`, `ticket-table.tsx`, `members/page.tsx`, `runs/page.tsx`, `Db`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `src/access.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08315863032844165 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `human-form.tsx`, `agent-install.ts`, `deps`, `run-live.tsx`, `web/package.json`, `(app)/layout.tsx`, `library-view.ts`, `server/flows.ts`, `machines/[id]/page.tsx`, `requireMember`, `flows/page.tsx`, `ticket-table.tsx`, `members/page.tsx`, `runs/page.tsx`, `flow-editor.tsx`, `bundle.mjs`, `flows-list.tsx`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._