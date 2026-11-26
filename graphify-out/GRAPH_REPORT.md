# Graph Report - clauderon-wt-release  (2026-11-26)

## Corpus Check
- 411 files · ~327,225 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .css 2, .example 2)

## Summary
- 3119 nodes · 8122 edges · 138 communities (128 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 237 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ca5df0e7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server/runs.ts
- src/access.ts
- Payload
- agent-install.ts
- fakes.ts
- mask
- runs/page.tsx
- host-agent/src/main.ts
- web/package.json
- flow-canvas.tsx
- env
- (app)/layout.tsx
- library-view.ts
- vitest
- machines/[id]/page.tsx
- check
- machine-link.ts
- host-agent/src/nodes.ts
- host-agent/package.json
- build-report.mjs
- server/machines.ts
- service.ts
- react
- package.json
- notifications-live.tsx
- pair.ts
- FakeGitHub
- core/src/index.ts
- doctor.ts
- draft-view.ts
- gateway/src/main.ts
- run.ts
- run-engine.ts
- server/flows.ts
- gateway/package.json
- compilerOptions
- requireMember
- services
- machines/actions.ts
- Clauderon — Requirements v1 (final)
- M1 — Walking skeleton
- members/page.tsx
- agent.ts
- live-hub.ts
- flow-node.tsx
- server/github-access.ts
- run-flow-diagram.tsx
- runs/[id]/page.tsx
- FakeAgent
- README.md
- web/test/m3.test.ts
- flow-editor.tsx
- features/package.json
- db/src/schema.ts
- testing/package.json
- ref_node_path
- deploy.sh
- server/github.ts
- compilerOptions
- log-retention.ts
- steps
- flows-list.tsx
- gateway/src/pairing.ts
- 5. Domain core (`packages/core`)
- Deploying Clauderon
- runner.ts
- start.ts
- environment
- postgres
- gateway/test/m3.test.ts
- protocol/package.json
- tasks
- Agent
- flow-drafts.ts
- compose.yml
- src/runs.ts
- core/package.json
- MemorySocket
- StateStore
- postgres
- createGateway
- M4 — Refinement and release
- claude.ts
- web
- gateway
- backup.sh
- migrate
- healthcheck
- build
- validateFlow
- Clauderon
- Contributing
- run-live.tsx
- deps
- after-pr-merge.mjs
- pnpm-workspace.yaml
- { GET, POST }
- dynamic
- ListSkeleton
- M2 — Flows and scheduling
- Flow Drafts run Claude Code on the Member's Machine, outside any Run
- categories
- db/src/index.ts
- gateway/tsconfig.json
- M3 — People in the loop
- Remove Dry-run; keep the editor's Test run
- 3. Day by day
- CONTRIBUTING.md
- cloudflared
- Clauderon at a glance
- host-agent/tsconfig.json
- server/projects.ts
- Clauderon
- next
- DESIGN.md
- M0 — Foundations
- report.js
- Contributing guide and team conventions (design)
- core/tsconfig.json
- Issue tracker: GitHub
- Language
- db/tsconfig.json
- features/tsconfig.json
- Log a bug
- Domain Docs
- protocol/tsconfig.json
- testing/tsconfig.json
- Pods push and open pull requests with their own git/gh login
- Flows are typed DAGs without cycles, run one Node at a time
- Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent
- The web app runs on Vercel, with an always-on Gateway for long-lived connections
- Each Member runs on their own Machine, paired to a public app
- AGENTS.md
- Clauderon docs
- ticket-status.test.ts
- Steps
- Run attachments reach the Machine through the Gateway, stored encrypted until delivered

## God Nodes (most connected - your core abstractions)
1. `deps()` - 103 edges
2. `requireMember()` - 78 edges
3. `vitest` - 67 edges
4. `next` - 60 edges
5. `react` - 57 edges
6. `Db` - 54 edges
7. `Payload` - 43 edges
8. `RunEngine` - 40 edges
9. `Icon` - 38 edges
10. `FlowEditor()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `9. Seeds (FLW-8)` --references--> `validateFlow()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/core/src/flow.ts
- `4.2 Run engine (RUN-2, RUN-3, RUN-16)` --references--> `nextNode()`  [INFERRED]
  docs/specs/m1-walking-skeleton.md → packages/core/src/run.ts
- `7. Dry-run (removed)` --references--> `simulatedOutputs()`  [INFERRED]
  docs/specs/m2-flows-and-scheduling.md → packages/core/src/simulate.ts
- `11. Slices` --references--> `endMemberAccess()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/db/src/access.ts
- `Places to change` --references--> `migrate()`  [INFERRED]
  docs/superpowers/specs/2026-11-20-contributing-conventions-design.md → packages/db/src/migrate.ts

## Import Cycles
- None detected.

## Communities (138 total, 10 thin omitted)

### Community 0 - "server/runs.ts"
Cohesion: 0.06
Nodes (42): CancelOutcome, InspectedAttempt, inspectorOf(), NeedsYouItem, NOTIFY_OF_DECISION, PullRequestQuery, PullRequestTab, RespondOutcome (+34 more)

### Community 1 - "src/access.ts"
Cohesion: 0.07
Nodes (57): sessionFor(), AccessDeps, addToAllowlist(), checkGoogleSignIn(), GoogleSignIn, clauderonAdapter(), orNull(), toUser() (+49 more)

### Community 2 - "Payload"
Cohesion: 0.14
Nodes (11): RunEngine, attachmentsOfRun(), getMachine(), finishAttempt(), getAttempt(), getRunContext(), moveRun(), runningRuns() (+3 more)

### Community 3 - "agent-install.ts"
Cohesion: 0.08
Nodes (31): agent, doctor, env, home, nodeVersion, problems, report, server (+23 more)

### Community 4 - "fakes.ts"
Cohesion: 0.07
Nodes (14): EXEC_ARGS, ExecOptions, OutputListener, Signal, DIR, ExecCall, ExecReply, FakeLink (+6 more)

### Community 5 - "mask"
Cohesion: 0.09
Nodes (20): Considered Options, The GitHub token is set on the Projects page, stored encrypted, checkNodeDefinition(), hasDuplicate(), portNames(), escapeRegExp(), MASK, mask() (+12 more)

### Community 6 - "runs/page.tsx"
Cohesion: 0.16
Nodes (15): AuditPage(), detailText(), dynamic, Search, SUBJECT_LINK, FilterSelect(), Option, dynamic (+7 more)

### Community 7 - "host-agent/src/main.ts"
Cohesion: 0.08
Nodes (42): findBash(), localSystem(), signalGroup(), ADR-0006, agentBinDir(), ask(), [command = "run", ...args], doctorCommand() (+34 more)

### Community 8 - "web/package.json"
Cohesion: 0.07
Nodes (39): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, next@^16.4.6, next-auth@5.0.0-beta.32, react@^19.3.1, react-dom@^19.3.1 (+31 more)

### Community 9 - "flow-canvas.tsx"
Cohesion: 0.12
Nodes (36): boundsOf(), centerOn(), clampZoom(), edgePath(), FAR_ZOOM, fitBounds(), intersects(), MAX_ZOOM (+28 more)

### Community 10 - "env"
Cohesion: 0.10
Nodes (20): env, if, runs-on, steps, GH_TOKEN, PR, PR_BODY, REPO (+12 more)

### Community 11 - "(app)/layout.tsx"
Cohesion: 0.07
Nodes (39): AccessDeniedPage(), dynamic, needsYouAction(), AppLayout(), inter, jetbrains, metadata, outfit (+31 more)

### Community 12 - "library-view.ts"
Cohesion: 0.12
Nodes (40): kindIcon(), cloneNodeAction(), exportNodesAction(), importNodesAction(), ImportNodes(), LibraryList(), NodeCard(), NodeDialog() (+32 more)

### Community 13 - "vitest"
Cohesion: 0.08
Nodes (20): BrowserHub, BrowserHubOptions, ADR-0008, createGatewayServer(), GatewayServerOptions, ADR-0011, open(), operators (+12 more)

### Community 14 - "machines/[id]/page.tsx"
Cohesion: 0.08
Nodes (49): CmdBox(), DoctorCard(), DOT, looksLikeCommand(), ORDER, ADR-0007, ADR-0007, claudeAccountLabel() (+41 more)

### Community 15 - "check"
Cohesion: 0.08
Nodes (25): env, runs-on, services, steps, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, TEST_DATABASE_URL (+17 more)

### Community 16 - "machine-link.ts"
Cohesion: 0.10
Nodes (14): Handler, HeartbeatListener, HelloListener, Link, MachineLinks, MachineLinksOptions, ADR-0006, connect() (+6 more)

### Community 17 - "host-agent/src/nodes.ts"
Cohesion: 0.06
Nodes (52): ClaudeErrorWatch, draftClaudeCommand(), draftDir(), DraftRunnerOptions, registerDraftHandlers(), runDraft(), Running, ADR-0008 (+44 more)

### Community 18 - "host-agent/package.json"
Cohesion: 0.08
Nodes (30): dependencies, @clauderon/core@workspace:*, @clauderon/protocol@workspace:*, dockerode@^5.0.1, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, esbuild@0.28.2 (+22 more)

### Community 19 - "build-report.mjs"
Cohesion: 0.09
Nodes (33): allCases, args, assets, base, css, dataUri(), dims(), errors (+25 more)

### Community 20 - "server/machines.ts"
Cohesion: 0.05
Nodes (54): approveMyPairing(), ApproveResult, canRemoveMachine(), LookUpResult, MACHINE_NAME_MAX, MachineSettingsInput, MachineView, ownMachine() (+46 more)

### Community 21 - "service.ts"
Cohesion: 0.16
Nodes (25): Exec, installService(), launchdPath(), launchdPlist(), logFile(), SERVICE_LABEL, serviceArgs(), serviceInstalled() (+17 more)

### Community 22 - "react"
Cohesion: 0.08
Nodes (42): createFlowAction(), exportFlowAction(), FlowFormState, importFlowAction(), loadFlowStartAction(), loadFlowStartChoicesAction(), startFromInputAction(), BuildAvailability (+34 more)

### Community 23 - "package.json"
Cohesion: 0.07
Nodes (31): devDependencies, eslint@^10.15.0, tsx@^4.23.15, turbo@^2.11.11, @types/node@^26.6.6, typescript@~6.0.3, typescript-eslint@^8.72.2, vitest@^5.1.0 (+23 more)

### Community 24 - "notifications-live.tsx"
Cohesion: 0.19
Nodes (19): currentPermission(), NotificationsProvider(), NotificationsToggle(), NotifySetting, Setting, storage(), Toast, at() (+11 more)

### Community 25 - "pair.ts"
Cohesion: 0.09
Nodes (25): attachmentDownloader(), checkGateway(), GatewayCheck, skew(), ADR-0007, ADR-0011, httpBase(), pair() (+17 more)

### Community 26 - "FakeGitHub"
Cohesion: 0.20
Nodes (7): Issue, OpenPullRequest, PullRequest, Repository, FakeGitHub, FakePullRequest, RepoData

### Community 27 - "core/src/index.ts"
Cohesion: 0.09
Nodes (36): ConnectResult, describeLibrary(), FLOW_DRAFT_MAX_DESCRIPTION, FLOW_DRAFT_MIN_AGENT, FlowDraftRead, flowFileOf(), port(), readFlowDraft() (+28 more)

### Community 28 - "doctor.ts"
Cohesion: 0.08
Nodes (30): CLOCK_SKEW_MS, DoctorInput, firstLine(), fixFor(), Platform, runDoctor(), ADR-0007, ClaudeLogin (+22 more)

### Community 29 - "draft-view.ts"
Cohesion: 0.31
Nodes (7): DraftEdge, DraftPlacement, DraftView, layOutDraft(), nodeHeight(), ADR-0008, file

### Community 30 - "gateway/src/main.ts"
Cohesion: 0.05
Nodes (43): databaseUrl, { db }, gateway, port, sessionSecret, ADR-0010, ADR-0004, dependencies (+35 more)

### Community 31 - "run.ts"
Cohesion: 0.11
Nodes (25): 2. Architecture decisions, Flow, FlowNode, LibraryNode, AttemptState, AttemptView, holdsSlot(), MachineForSchedule (+17 more)

### Community 32 - "run-engine.ts"
Cohesion: 0.07
Nodes (31): MachineBack, RunContext, RunEngineOptions, Sender, ADR-0006, ADR-0011, log(), waitAt() (+23 more)

### Community 33 - "server/flows.ts"
Cohesion: 0.10
Nodes (39): deleteNodeAction(), saveNodeAction(), copyName(), cleanGraph(), CloneFlowResult, createMyFlow(), Definition, DeleteFlowOutcome (+31 more)

### Community 34 - "gateway/package.json"
Cohesion: 0.10
Nodes (24): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, @types/ws@^8.18.2 (+16 more)

### Community 35 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, incremental, jsx, lib, plugins, exclude, extends (+2 more)

### Community 36 - "requireMember"
Cohesion: 0.19
Nodes (24): ENABLE_ERRORS, enableAction(), EnableState, loadBranches(), loadRepositories(), removeProjectAction(), removeTokenAction(), saveTokenAction() (+16 more)

### Community 37 - "services"
Cohesion: 0.07
Nodes (31): databases, databaseName, ipAllowList, name, plan, postgresMajorVersion, region, user (+23 more)

### Community 38 - "machines/actions.ts"
Cohesion: 0.15
Nodes (19): approvePairingAction(), checkLoginsAction(), lookUpPairingAction(), MachineFormState, PairFormState, removeMachineAction(), SettingsFormState, updateAgentAction() (+11 more)

### Community 39 - "Clauderon — Requirements v1 (final)"
Cohesion: 0.07
Nodes (30): 10. Glossary, 11. Related documents, 12. Next steps, 1. Overview, 2. Goals and success measures, 3. Scope, 4.1 Members and Projects, 4.2 Pods (+22 more)

### Community 40 - "M1 — Walking skeleton"
Cohesion: 0.08
Nodes (24): 1. Scope, 2.1 Create my Pod (POD-2), 2.2 Start and Stop (POD-6, part), 2.3 Pods page (POD-4), 2.4 Login checks (POD-5), 2.5 Web terminal (POD-9), 2. Pods, 3.1 Enable a Project (PRJ-1, PRJ-2) (+16 more)

### Community 41 - "members/page.tsx"
Cohesion: 0.21
Nodes (16): ADD_ERRORS, addEmail(), FormState, refresh(), removeMachineAction(), removeMemberAction(), runsOf(), AddEmailForm() (+8 more)

### Community 42 - "agent.ts"
Cohesion: 0.09
Nodes (25): AgentOptions, BACKOFF_CAP_MS, BACKOFF_START_MS, Handler, HEARTBEAT_MS, MachineFacts, MachineFactsReader, MachineUsage (+17 more)

### Community 43 - "live-hub.ts"
Cohesion: 0.09
Nodes (18): add(), LiveHub, LogLine, send(), hub(), BrowserEvent, browserRequest, BrowserRequest (+10 more)

### Community 44 - "flow-node.tsx"
Cohesion: 0.11
Nodes (25): CanvasHandle(), HandleType, FIcon, stroke, acceptsWire(), KIND_LABEL, NodeAction, NodeRunState (+17 more)

### Community 45 - "server/github-access.ts"
Cohesion: 0.22
Nodes (15): appGitHubToken(), GitHubAccessDeps, GitHubAccessView, saveGitHubToken(), SaveTokenResult, ADR-0010, viewGitHubAccess(), GitHubError (+7 more)

### Community 46 - "run-flow-diagram.tsx"
Cohesion: 0.18
Nodes (15): CanvasEdge, CanvasNode, currentNodeId(), DiagramEdgeState, diagramEdgeStates(), diagramPositions(), DiagramState, diagramState() (+7 more)

### Community 47 - "runs/[id]/page.tsx"
Cohesion: 0.13
Nodes (22): FlowsTabs(), ImportFlow(), dynamic, LibraryPage(), NewFlow(), dynamic, FlowsPage(), DISK_ADVICE (+14 more)

### Community 48 - "FakeAgent"
Cohesion: 0.16
Nodes (5): Clock, systemClock, TimerHandle, FakeAgent, Responder

### Community 49 - "README.md"
Cohesion: 0.30
Nodes (3): Consequences, Considered Options, The Agent ships as one bundle with its own Node, and checks its Machine

### Community 50 - "web/test/m3.test.ts"
Cohesion: 0.20
Nodes (15): flowActionAction(), cloneMyFlow(), deleteMyFlow(), EditorData, editorData(), saveMyFlow(), cloneOf(), flowUsingLint() (+7 more)

### Community 51 - "flow-editor.tsx"
Cohesion: 0.08
Nodes (41): saveFlowAction(), GRID, isTyping(), DEFAULT_NODE, Doc, FlowEditor(), GraphEdge, isMac() (+33 more)

### Community 52 - "features/package.json"
Cohesion: 0.14
Nodes (14): dependencies, zod@^4.6.7, exports, zod, name, private, scripts, build:file (+6 more)

### Community 53 - "db/src/schema.ts"
Cohesion: 0.06
Nodes (39): cloneFlow(), copyName(), deleteFlow(), DeleteFlowResult, FlowListRow, FlowLock, flowLocks(), ImportFlowPlan (+31 more)

### Community 54 - "testing/package.json"
Cohesion: 0.13
Nodes (18): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, drizzle-orm@^0.45.4, exports, @clauderon/core, @clauderon/db (+10 more)

### Community 55 - "ref_node_path"
Cohesion: 0.07
Nodes (34): buildId, bundle, dist, manifest, ADR-0007, root, versionMatch, SCRIPT (+26 more)

### Community 56 - "deploy.sh"
Cohesion: 0.29
Nodes (16): compose(), die(), down(), env_get(), env_set(), init_env(), preflight(), say() (+8 more)

### Community 57 - "server/github.ts"
Cohesion: 0.14
Nodes (8): ApiIssue, fetchJson(), request(), ADR-0010, withCachedPullRequests(), pull(), setup(), GitHubReader

### Community 58 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution (+9 more)

### Community 59 - "log-retention.ts"
Cohesion: 0.24
Nodes (5): LOG_RETENTION_DAYS, LogRetention, LogRetentionOptions, clearTurnTargetsBefore(), deleteLogChunksBefore()

### Community 60 - "steps"
Cohesion: 0.10
Nodes (19): runs-on, steps, strategy, jobs, agent, os, name, on (+11 more)

### Community 61 - "flows-list.tsx"
Cohesion: 0.26
Nodes (16): FlowRowActions(), EMPTY, FlowCard(), FlowsList(), SCOPES, Steps(), deleteRunsNote(), filterFlows() (+8 more)

### Community 62 - "gateway/src/pairing.ts"
Cohesion: 0.25
Nodes (10): handlePairing(), json(), PairingHttpOptions, readBody(), ADR-0006, ADR-0007, pendingCode(), createPairing() (+2 more)

### Community 63 - "5. Domain core (`packages/core`)"
Cohesion: 0.33
Nodes (6): 5.1 Flow validator (FLW-4, FLW-5, A3), 5.2 Run state machine (RUN-2 … RUN-9, RUN-16), 5.3 Slot scheduler (POD-3), 5.4 Ticket Status (TIC-6), 5.5 Masking (NFR-1), 5. Domain core (`packages/core`)

### Community 64 - "Deploying Clauderon"
Cohesion: 0.11
Nodes (18): 1. Prepare the machine (once), 2. Outside accounts (once), 3. Configure, 4. Start the stack, 5. Publish with a Cloudflare Tunnel, 6. Members pair their Machines, 7. Backups, Demo on Render (+10 more)

### Community 66 - "runner.ts"
Cohesion: 0.08
Nodes (39): openRequest(), 3. Dependency graph and order, 4. Changes by layer, 5. Testing strategy, 6. Risks and edge cases, 7. Traceability, 8. Deployment order, 9. Progress log (+31 more)

### Community 67 - "start.ts"
Cohesion: 0.10
Nodes (39): nodeStates(), FlowStartChoice, keysFor(), PullRequestRef, pullRequestStartDialog(), resolveInput(), startableFlows(), startDialog() (+31 more)

### Community 68 - "environment"
Cohesion: 0.18
Nodes (13): APP_VERSION, AUTH_URL, DATABASE_URL, GATEWAY_PORT, GATEWAY_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPERATOR_EMAILS (+5 more)

### Community 69 - "postgres"
Cohesion: 0.15
Nodes (12): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, name, environment, image, ports, volumes (+4 more)

### Community 70 - "gateway/test/m3.test.ts"
Cohesion: 0.11
Nodes (34): Gateway, GatewayOptions, answerWith(), setup(), flusher(), newGateway(), restartGateway(), SESSION_SECRET (+26 more)

### Community 71 - "protocol/package.json"
Cohesion: 0.17
Nodes (12): dependencies, zod@^4.6.7, exports, zod, name, private, scripts, lint (+4 more)

### Community 72 - "tasks"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+4 more)

### Community 73 - "Agent"
Cohesion: 0.15
Nodes (6): sendEvent(), Agent, controlMessage(), Envelope, serialize(), ResumeBuffer

### Community 75 - "flow-drafts.ts"
Cohesion: 0.13
Nodes (16): Draft, FlowDrafts, FlowDraftsOptions, Job, Purpose, ADR-0008, FlowBuildAvailability, agentSupportsFlowDrafts() (+8 more)

### Community 76 - "compose.yml"
Cohesion: 0.14
Nodes (13): content, configs, cloudflared, name, name, services, volumes, pgdata (+5 more)

### Community 77 - "src/runs.ts"
Cohesion: 0.07
Nodes (40): viewRun(), retryLogLines(), tailLines(), snapshotFlow(), AskHumanInput, AUDIT_ACTION, countOpenHumanRequests(), HumanRequest (+32 more)

### Community 78 - "core/package.json"
Cohesion: 0.20
Nodes (9): exports, name, private, scripts, lint, test, typecheck, type (+1 more)

### Community 79 - "MemorySocket"
Cohesion: 0.21
Nodes (3): Connector, FakeGateway, MemorySocket

### Community 81 - "postgres"
Cohesion: 0.25
Nodes (8): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, environment, image, restart, volumes, postgres

### Community 82 - "createGateway"
Cohesion: 0.10
Nodes (17): createGateway(), HEARTBEAT_TIMEOUT_MS, MachineWatch, MachineWatchOptions, MachineService, MachineServiceOptions, ADR-0006, ADR-0007 (+9 more)

### Community 83 - "M4 — Refinement and release"
Cohesion: 0.12
Nodes (17): 1. Scope, 2.1 Diff (TRK-3), 2.2 Usage (TRK-4), 2.3 Artifact (TRK-5), 2.4 Batch page (TRK-6), 2.5 Ticket detail (TIC-4), 2. Tracking, 3. Machines (replaces Pods) (+9 more)

### Community 84 - "claude.ts"
Cohesion: 0.09
Nodes (25): byteSize(), CLAUDE_ARGS, claudeCommand(), ClaudeEvent, claudeResult(), Content, firstLine(), inputTokens() (+17 more)

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

### Community 91 - "validateFlow"
Cohesion: 0.23
Nodes (13): executionOrder(), 10. Acceptance tests, 10. Slices, 3. Canvas editor (FLW-3 … FLW-6), byCanvas(), canConnect(), compare(), cycleEdges() (+5 more)

### Community 93 - "Clauderon"
Cohesion: 0.12
Nodes (17): Architecture, Clauderon, Contributing, Development commands, Development (`.env`), Documentation, Environment variables, How it works (+9 more)

### Community 94 - "Contributing"
Cohesion: 0.20
Nodes (10): Branches, Commits, Configuration and secrets, Contributing, Pull requests, Release notes, Releases, Repo graph for Claude (+2 more)

### Community 95 - "run-live.tsx"
Cohesion: 0.05
Nodes (63): hasTextInput(), linkList(), size(), TextInputFields(), TextInputState, ADR-0011, respondAction(), RespondFormState (+55 more)

### Community 96 - "deps"
Cohesion: 0.10
Nodes (31): dynamic, GET(), ADR-0006, dynamic, POST(), ADR-0011, dynamic, GET() (+23 more)

### Community 103 - "ListSkeleton"
Cohesion: 0.60
Nodes (3): Loading(), Loading(), ListSkeleton()

### Community 104 - "M2 — Flows and scheduling"
Cohesion: 0.22
Nodes (9): 1. Scope, 2. Flows page, 4. Node library (FLW-1, FLW-9, FLW-10), 5. Flow edit lock (FLW-7), 6. Slots, limits and the queue (POD-2, POD-3, POD-6), 7. Dry-run (removed), 8. Second Member (A6), 9. Acceptance tests (+1 more)

### Community 105 - "Flow Drafts run Claude Code on the Member's Machine, outside any Run"
Cohesion: 0.50
Nodes (3): Consequences, Considered Options, Flow Drafts run Claude Code on the Member's Machine, outside any Run

### Community 106 - "categories"
Cohesion: 0.40
Nodes (4): labels, title, changelog, categories

### Community 107 - "db/src/index.ts"
Cohesion: 0.08
Nodes (38): handleAttachments(), json(), ADR-0011, attachmentForMachine(), AttachmentInfo, key(), NewAttachment, openAttachment() (+30 more)

### Community 108 - "gateway/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 109 - "M3 — People in the loop"
Cohesion: 0.15
Nodes (13): 10. Slices, 1. Scope, 2.1 Approve (FLW-2, RUN-4, RUN-6), 2.2 Grill (FLW-2, RUN-10), 2. Human Nodes, 3. Needs you (RUN-5, MEM-2), 4. Retry (RUN-7, RUN-9), 5. Cancel (RUN-8) (+5 more)

### Community 111 - "3. Day by day"
Cohesion: 0.15
Nodes (13): 1. At a glance, 2. Before Day 1, 3. Day by day, 4. How the team works with AI agents, 6. Definition of done, Clauderon v1 — seven-day roadmap, Day 1 — Foundations (M0), Day 2 — Pods and Tickets (M1) (+5 more)

### Community 112 - "CONTRIBUTING.md"
Cohesion: 0.15
Nodes (8): Releases and the repo graph, Updating tickets after a PR merge, What runs by itself, Triage Labels, Change, Notes, Test plan, Why

### Community 113 - "cloudflared"
Cohesion: 0.17
Nodes (12): command, configs, depends_on, environment, image, restart, source, target (+4 more)

### Community 114 - "Clauderon at a glance"
Cohesion: 0.17
Nodes (12): Architecture in brief, Clauderon at a glance, Decisions we need from leads, How it works, How we will know it works, In one sentence, Learn more, Roadmap (+4 more)

### Community 115 - "host-agent/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 116 - "server/projects.ts"
Cohesion: 0.10
Nodes (31): enableableRepositories(), EnableRepositoryResult, lastAttempt, mapLimit(), pullFromGitHub(), refreshPullRequest(), syncAllProjects(), SyncResult (+23 more)

### Community 117 - "Clauderon"
Cohesion: 0.18
Nodes (9): Agent skills, Architecture, Clauderon, Commands, Contributing, Domain docs, Issue tracker, Next.js (+1 more)

### Community 118 - "next"
Cohesion: 0.07
Nodes (40): loadPullRequestStartDialog(), startPullRequestsAction(), dynamic, PullRequestsPage(), Search, PullRequestListRow, PullRequestTable(), selectable() (+32 more)

### Community 119 - "DESIGN.md"
Cohesion: 0.20
Nodes (9): Colors, Components, Do's and Don'ts, Elevation & Depth, Layout, Overview, Shapes, Theme (+1 more)

### Community 120 - "M0 — Foundations"
Cohesion: 0.15
Nodes (14): stream(), flow(), 11. Slices, 1. Scope, 2. Configuration, 3. Database schema, 4.1 Envelope and resuming, 4.2 Messages (+6 more)

### Community 121 - "report.js"
Cohesion: 0.15
Nodes (11): openLb(), show(), step(), Clauderon v1 — milestone specs, Definition of done for every slice, Naming, Repository layout, Requirement coverage (+3 more)

### Community 122 - "Contributing guide and team conventions (design)"
Cohesion: 0.20
Nodes (9): Approaches, Branch flow and repo graph (decided), Contributing guide and team conventions (design), Convention (my proposals, to be reviewed), Goals, Intent, Left to the builder, Non-goals / anti-goals (+1 more)

### Community 123 - "core/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 124 - "Issue tracker: GitHub"
Cohesion: 0.25
Nodes (7): Conventions, How v1 work is organised, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 125 - "Language"
Cohesion: 0.29
Nodes (7): Clauderon, Execution, Flows, Language, People, Runs, Work

### Community 126 - "db/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 127 - "features/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 128 - "Log a bug"
Cohesion: 0.33
Nodes (5): Body, File it, Log a bug, Rules, Title

### Community 130 - "Domain Docs"
Cohesion: 0.40
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 131 - "protocol/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 132 - "testing/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

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

### Community 143 - "ticket-status.test.ts"
Cohesion: 0.50
Nodes (4): RunForStatus, at(), open, real()

### Community 146 - "Steps"
Cohesion: 0.14
Nodes (13): result(), Example, report.json format, 1. Get the build script, 2. Collect the results, 3. Write report.json, 4. Build, 5. Check it in a browser (+5 more)

## Knowledge Gaps
- **96 isolated node(s):** `ADR-0011`, `ADR-0008`, `ADR-0008`, `ADR-0006`, `ADR-0006` (+91 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1159 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `server/runs.ts`, `src/access.ts`, `agent-install.ts`, `fakes.ts`, `mask`, `host-agent/src/main.ts`, `flow-canvas.tsx`, `(app)/layout.tsx`, `library-view.ts`, `machines/[id]/page.tsx`, `ticket-status.test.ts`, `server/machines.ts`, `service.ts`, `react`, `package.json`, `notifications-live.tsx`, `pair.ts`, `core/src/index.ts`, `doctor.ts`, `draft-view.ts`, `run.ts`, `run-engine.ts`, `live-hub.ts`, `server/github-access.ts`, `run-flow-diagram.tsx`, `web/test/m3.test.ts`, `flow-editor.tsx`, `ref_node_path`, `server/github.ts`, `flows-list.tsx`, `runner.ts`, `start.ts`, `gateway/test/m3.test.ts`, `flow-drafts.ts`, `claude.ts`, `run-live.tsx`, `db/src/index.ts`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `deps()` (e.g. with `web/test/access.test.ts` and `github-access.test.ts`) actually correct?**
  _`deps()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0011`, `ADR-0008`, `ADR-0008` to the rest of the system?**
  _96 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server/runs.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06274509803921569 - nodes in this community are weakly interconnected._
- **Why does `Member` connect `flow-drafts.ts` to `src/access.ts`, `gateway/test/m3.test.ts`, `vitest`, `machine-link.ts`, `report.js`, `Contributing`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `src/access.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07019230769230769 - nodes in this community are weakly interconnected._
- **Why does `Contributing` connect `Contributing` to `CONTRIBUTING.md`, `flow-drafts.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._