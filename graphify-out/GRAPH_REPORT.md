# Graph Report - clauderon  (2026-11-23)

## Corpus Check
- 333 files · ~246,808 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .example 2, .css 1)

## Summary
- 2639 nodes · 6792 edges · 138 communities (126 shown, 12 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 207 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d95fd09b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Gateway tests
- Web auth and access
- Run engine
- Agent smoke and doctor
- Agent node execution
- server/library.ts
- Needs-you and run pages
- Agent main and CLI
- Web dependencies
- Flow canvas geometry
- server/runs.ts
- icons.tsx
- Node library UI
- Flow and project actions
- machines/[id]/page.tsx
- CI workflow
- MachineLinks
- Claude CLI wrapper
- Host-agent dependencies
- db/src/human.ts
- src/runs.ts
- Agent service install
- react
- Root tooling
- flow-drafts.ts
- pair.ts
- FakeGitHub
- core/src/index.ts
- health.test.ts
- build-flow.tsx
- db/package.json
- run.ts
- doctor.ts
- flow.ts
- gateway/package.json
- deps
- machines/actions.ts
- services
- server/projects.ts
- Clauderon — Requirements v1 (final)
- M1 — Walking skeleton
- agent-dist.ts
- envelope.ts
- pull-requests/page.tsx
- flow-node.tsx
- server/flows.ts
- pairings.test.ts
- gateway/src/pairing.ts
- Payload
- ticket-table.tsx
- flow-editor-model.test.ts
- tickets.ts
- schema.ts
- testing/package.json
- bundle.mjs
- deploy.sh
- client.ts
- compilerOptions
- run-engine.ts
- steps
- flows/page.tsx
- server/machines.ts
- db/src/machines.ts
- Deploying Clauderon
- human-form.tsx
- db/src/human.ts
- start.ts
- environment
- postgres
- gateway/test/m3.test.ts
- protocol/package.json
- tasks
- Agent
- pairings.ts
- FlowDrafts
- compose.yml
- LinkSocket
- core/package.json
- app/layout.tsx
- agent.ts
- postgres
- gateway/src/machines.ts
- M4 — Refinement and release
- runs/[id]/page.tsx
- web
- gateway
- backup.sh
- migrate
- healthcheck
- build
- node-file.ts
- compilerOptions
- Clauderon
- Contributing
- ResumeBuffer
- M3 execution plan — People in the loop
- protocol.test.ts
- after-pr-merge.mjs
- pnpm-workspace.yaml
- { GET, POST }
- dynamic
- 4. Starting Runs
- activeOutputs
- ticket-status.test.ts
- categories
- .respond
- 3. Day by day
- M3 — People in the loop
- gateway/tsconfig.json
- host-agent/tsconfig.json
- CONTRIBUTING.md
- cloudflared
- Clauderon at a glance
- core/tsconfig.json
- db/tsconfig.json
- Clauderon
- protocol/tsconfig.json
- DESIGN.md
- validateFlow
- Shared conventions
- Contributing guide and team conventions (design)
- testing/tsconfig.json
- Issue tracker: GitHub
- Language
- Log a bug
- x-app-env
- Domain Docs
- runner.ts
- Pods push and open pull requests with their own git/gh login
- Flows are typed DAGs without cycles, run one Node at a time
- Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent
- The web app runs on Vercel, with an always-on Gateway for long-lived connections
- Each Member runs on their own Machine, paired to a public app
- The Agent ships as one bundle with its own Node, and checks its Machine
- AGENTS.md
- Clauderon docs

## God Nodes (most connected - your core abstractions)
1. `deps()` - 87 edges
2. `requireMember()` - 68 edges
3. `vitest` - 52 edges
4. `next` - 51 edges
5. `Db` - 45 edges
6. `react` - 44 edges
7. `Payload` - 41 edges
8. `RunEngine` - 39 edges
9. `Icon` - 33 edges
10. `recordAudit()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `5. Testing strategy` --references--> `extractResultBlock()`  [INFERRED]
  docs/plans/m3-execution-plan.md → packages/core/src/runner.ts
- `11. Slices` --references--> `endMemberAccess()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/db/src/access.ts
- `Places to change` --references--> `migrate()`  [INFERRED]
  docs/superpowers/specs/2026-11-20-contributing-conventions-design.md → packages/db/src/migrate.ts
- `4.2 Messages` --references--> `attemptId()`  [INFERRED]
  docs/specs/m0-foundations.md → apps/gateway/test/log-retention.test.ts
- `4.2 Messages` --references--> `inputTokens()`  [INFERRED]
  docs/specs/m0-foundations.md → apps/host-agent/src/claude.ts

## Import Cycles
- None detected.

## Communities (138 total, 12 thin omitted)

### Community 0 - "Gateway tests"
Cohesion: 0.13
Nodes (34): attemptId(), nodeStates(), Script, setup(), setup(), AppDeps, cloneMyFlow(), cancelRunAs() (+26 more)

### Community 1 - "Web auth and access"
Cohesion: 0.09
Nodes (38): sessionFor(), AccessDeps, addToAllowlist(), checkGoogleSignIn(), GoogleSignIn, clauderonAdapter(), orNull(), toUser() (+30 more)

### Community 2 - "Run engine"
Cohesion: 0.06
Nodes (38): createGateway(), LogRetention, MachineWatch, RunEngine, retryLogLines(), tailLines(), SnapshotNode, askHuman() (+30 more)

### Community 3 - "Agent smoke and doctor"
Cohesion: 0.08
Nodes (31): agent, doctor, env, home, nodeVersion, problems, report, server (+23 more)

### Community 4 - "Agent node execution"
Cohesion: 0.09
Nodes (14): ADR-0006, EXEC_ARGS, ExecOptions, OutputListener, ProcessHandle, Signal, System, DIR (+6 more)

### Community 5 - "server/library.ts"
Cohesion: 0.16
Nodes (28): copyName(), cloneMyNode(), CloneNodeOutcome, createMyNode(), Definition, deleteMyNode(), exportMyNodes(), ExportNodesResult (+20 more)

### Community 6 - "Needs-you and run pages"
Cohesion: 0.10
Nodes (39): dynamic, NeedsYouPage(), CancelFormState, cancelRunAction(), RetryFormState, retryRunAction(), CancelRun(), dynamic (+31 more)

### Community 7 - "Agent main and CLI"
Cohesion: 0.09
Nodes (41): findBash(), localSystem(), signalGroup(), agentBinDir(), ask(), [command = "run", ...args], doctorCommand(), doctorFor() (+33 more)

### Community 8 - "Web dependencies"
Cohesion: 0.07
Nodes (39): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, next@^16.4.6, next-auth@5.0.0-beta.32, react@^19.3.1, react-dom@^19.3.1 (+31 more)

### Community 9 - "Flow canvas geometry"
Cohesion: 0.12
Nodes (36): boundsOf(), centerOn(), clampZoom(), edgePath(), FAR_ZOOM, fitBounds(), intersects(), MAX_ZOOM (+28 more)

### Community 10 - "server/runs.ts"
Cohesion: 0.09
Nodes (43): openRequest(), viewMachine(), viewMachines(), CancelOutcome, isUuid(), NeedsYouItem, NodeState, parseRunFilters() (+35 more)

### Community 11 - "icons.tsx"
Cohesion: 0.14
Nodes (19): AccessDeniedPage(), dynamic, AppLayout(), AutoRefresh(), dynamic, SignInPage(), DENIED_EMAIL_COOKIE, handlers (+11 more)

### Community 12 - "Node library UI"
Cohesion: 0.12
Nodes (38): cloneNodeAction(), deleteNodeAction(), exportNodesAction(), importNodesAction(), saveNodeAction(), ImportNodes(), LibraryList(), NodeCard() (+30 more)

### Community 13 - "Flow and project actions"
Cohesion: 0.18
Nodes (21): ENABLE_ERRORS, enableAction(), EnableState, loadBranches(), loadRepositories(), removeProjectAction(), syncAction(), SyncState (+13 more)

### Community 14 - "machines/[id]/page.tsx"
Cohesion: 0.13
Nodes (34): CmdBox(), DoctorCard(), DOT, looksLikeCommand(), ORDER, ADR-0007, ADR-0007, claudeAccountLabel() (+26 more)

### Community 15 - "CI workflow"
Cohesion: 0.08
Nodes (25): env, runs-on, services, steps, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, TEST_DATABASE_URL (+17 more)

### Community 16 - "MachineLinks"
Cohesion: 0.10
Nodes (14): Handler, HeartbeatListener, HelloListener, Link, MachineLinks, MachineLinksOptions, ADR-0006, markAllMachinesDisconnected() (+6 more)

### Community 17 - "Claude CLI wrapper"
Cohesion: 0.06
Nodes (39): CLAUDE_ARGS, claudeCommand(), ClaudeErrorWatch, ClaudeEvent, Content, draftClaudeCommand(), firstLine(), inputTokens() (+31 more)

### Community 18 - "Host-agent dependencies"
Cohesion: 0.08
Nodes (30): dependencies, @clauderon/core@workspace:*, @clauderon/protocol@workspace:*, dockerode@^5.0.1, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, esbuild@0.28.2 (+22 more)

### Community 19 - "db/src/human.ts"
Cohesion: 0.15
Nodes (21): PairingPhase, PairingProgress(), Step, ADD_ERRORS, addEmail(), FormState, refresh(), removeMachineAction() (+13 more)

### Community 20 - "src/runs.ts"
Cohesion: 0.38
Nodes (6): latestAgent(), sha256(), ADR-0007, updateAgent(), UpdateOptions, UpdateResult

### Community 21 - "Agent service install"
Cohesion: 0.15
Nodes (25): Exec, installService(), launchdPath(), launchdPlist(), logFile(), SERVICE_LABEL, serviceArgs(), serviceInstalled() (+17 more)

### Community 22 - "react"
Cohesion: 0.23
Nodes (9): AnchorLike, ClickLike, hasUnsavedChanges(), leavesPage(), PendingLeave, useLeaveGuard(), ConfirmProps, closeOnBackdrop (+1 more)

### Community 23 - "Root tooling"
Cohesion: 0.08
Nodes (29): devDependencies, eslint@^10.15.0, tsx@^4.23.15, turbo@^2.11.11, @types/node@^26.6.6, typescript@~6.0.3, typescript-eslint@^8.72.2, vitest@^5.1.0 (+21 more)

### Community 24 - "flow-drafts.ts"
Cohesion: 0.11
Nodes (24): Draft, FlowDraftsOptions, Job, Purpose, sendEvent(), ADR-0008, FlowBuildAvailability, agentSupportsFlowDrafts() (+16 more)

### Community 25 - "pair.ts"
Cohesion: 0.14
Nodes (17): checkGateway(), GatewayCheck, skew(), ADR-0007, httpBase(), pair(), PAIR_POLL_MS, Paired (+9 more)

### Community 26 - "FakeGitHub"
Cohesion: 0.10
Nodes (11): ApiIssue, request(), GitHubError, GitHubReader, Issue, OpenPullRequest, PullRequest, Repository (+3 more)

### Community 27 - "core/src/index.ts"
Cohesion: 0.13
Nodes (18): Consequences, Considered Options, Flow Drafts run Claude Code on the Member's Machine, outside any Run, buildFlowFile(), fail(), FATAL, FLOW_FILE_FORMAT, FLOW_FILE_VERSION (+10 more)

### Community 28 - "health.test.ts"
Cohesion: 0.17
Nodes (9): memberShell(), mergePaths(), parsePathOutput(), printPathCommand(), refreshToolPath(), shellPath(), ADR-0007, ADR-0006 (+1 more)

### Community 29 - "build-flow.tsx"
Cohesion: 0.13
Nodes (20): BuildAvailability, BuildFlow(), Composer(), Draft, DraftPreview(), EXAMPLES, Phase, ADR-0008 (+12 more)

### Community 30 - "db/package.json"
Cohesion: 0.09
Nodes (25): dependencies, @clauderon/core@workspace:*, drizzle-orm@^0.45.4, pg@^8.23.1, devDependencies, drizzle-kit@^0.31.11, @types/pg@^8.23.1, exports (+17 more)

### Community 31 - "run.ts"
Cohesion: 0.11
Nodes (26): 1. Starting point, 2. Architecture decisions, 4.2 Run engine (RUN-2, RUN-3, RUN-16), Flow, FlowNode, AttemptState, AttemptView, holdsSlot() (+18 more)

### Community 32 - "doctor.ts"
Cohesion: 0.17
Nodes (19): AgentLink, detached(), Log, checkClaude(), checkLogins(), CLAUDE_STATUS_SCRIPT, LoginHooks, Logins (+11 more)

### Community 33 - "flow.ts"
Cohesion: 0.15
Nodes (19): executionOrder(), byCanvas(), compare(), ConnectResult, cycleEdges(), groupOutgoing(), NODE_KINDS, NodeInput (+11 more)

### Community 34 - "gateway/package.json"
Cohesion: 0.10
Nodes (24): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, @types/ws@^8.18.2 (+16 more)

### Community 35 - "deps"
Cohesion: 0.11
Nodes (26): dynamic, GET(), ADR-0006, dynamic, GET(), saveFlowAction(), dynamic, GET() (+18 more)

### Community 36 - "machines/actions.ts"
Cohesion: 0.14
Nodes (21): approvePairingAction(), checkLoginsAction(), lookUpPairingAction(), MachineFormState, PairFormState, removeMachineAction(), setSettingsAction(), SettingsFormState (+13 more)

### Community 37 - "services"
Cohesion: 0.07
Nodes (31): databases, databaseName, ipAllowList, name, plan, postgresMajorVersion, region, user (+23 more)

### Community 38 - "server/projects.ts"
Cohesion: 0.12
Nodes (26): EnableRepositoryResult, pullFromGitHub(), refreshPullRequest(), syncAllProjects(), syncProject(), SyncResult, enableProject(), EnableResult (+18 more)

### Community 39 - "Clauderon — Requirements v1 (final)"
Cohesion: 0.07
Nodes (30): 10. Glossary, 11. Related documents, 12. Next steps, 1. Overview, 2. Goals and success measures, 3. Scope, 4.1 Members and Projects, 4.2 Pods (+22 more)

### Community 40 - "M1 — Walking skeleton"
Cohesion: 0.12
Nodes (17): 1. Scope, 2.1 Create my Pod (POD-2), 2.2 Start and Stop (POD-6, part), 2.3 Pods page (POD-4), 2.4 Login checks (POD-5), 2.5 Web terminal (POD-9), 2. Pods, 3.1 Enable a Project (PRJ-1, PRJ-2) (+9 more)

### Community 41 - "agent-dist.ts"
Cohesion: 0.11
Nodes (17): CLOCK_SKEW_MS, DoctorInput, firstLine(), fixFor(), LOW_DISK_GB, Platform, runDoctor(), ADR-0007 (+9 more)

### Community 42 - "envelope.ts"
Cohesion: 0.17
Nodes (12): doctorReport, envelopeShape, ParseResult, CONTROL_TYPES, ControlType, messageSchemas, MessageType, ADR-0006 (+4 more)

### Community 43 - "pull-requests/page.tsx"
Cohesion: 0.15
Nodes (21): createFlowAction(), importFlowAction(), FlowsTabs(), ImportFlow(), dynamic, LibraryPage(), NewFlow(), dynamic (+13 more)

### Community 44 - "flow-node.tsx"
Cohesion: 0.10
Nodes (35): GRID, CanvasHandle(), HandleType, DEFAULT_NODE, Doc, GraphEdge, LibraryAnchor, NO_SELECTION (+27 more)

### Community 45 - "server/flows.ts"
Cohesion: 0.09
Nodes (38): FlowFormState, dynamic, FlowPage(), cleanGraph(), CloneFlowResult, CreateFlowResult, createMyFlow(), Definition (+30 more)

### Community 46 - "pairings.test.ts"
Cohesion: 0.14
Nodes (20): handlePairing(), json(), PairingHttpOptions, readBody(), ADR-0006, ADR-0007, pendingCode(), hashToken() (+12 more)

### Community 47 - "gateway/src/pairing.ts"
Cohesion: 0.09
Nodes (18): BrowserHubOptions, ADR-0008, databaseUrl, { db }, gateway, port, sessionSecret, createGatewayServer() (+10 more)

### Community 48 - "Payload"
Cohesion: 0.18
Nodes (6): TimerHandle, serialize(), Payload, FakeAgent, HelloOverrides, Responder

### Community 50 - "ticket-table.tsx"
Cohesion: 0.22
Nodes (12): loadStartDialog(), startAction(), dynamic, Search, STATUSES, TicketsPage(), Dialog, selectable() (+4 more)

### Community 51 - "flow-editor-model.test.ts"
Cohesion: 0.13
Nodes (21): isTyping(), FlowEditor(), isMac(), newId(), sameSet(), layeredLayout(), layerOf(), LAYOUT_GAP_X (+13 more)

### Community 52 - "tickets.ts"
Cohesion: 0.35
Nodes (9): asPrState(), TicketFilters, viewTickets(), isActive(), ACTIVE_STATUS, PullRequestState, TicketStatus, ticketStatus() (+1 more)

### Community 53 - "schema.ts"
Cohesion: 0.07
Nodes (24): artifact, attemptState, flow, flowEdge, flowNode, humanRequestKind, logChunk, logStream (+16 more)

### Community 54 - "testing/package.json"
Cohesion: 0.13
Nodes (18): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, drizzle-orm@^0.45.4, exports, @clauderon/core, @clauderon/db (+10 more)

### Community 55 - "bundle.mjs"
Cohesion: 0.15
Nodes (9): buildId, bundle, dist, manifest, ADR-0007, root, versionMatch, config (+1 more)

### Community 56 - "deploy.sh"
Cohesion: 0.30
Nodes (16): compose(), die(), down(), env_get(), env_set(), init_env(), preflight(), say() (+8 more)

### Community 57 - "client.ts"
Cohesion: 0.15
Nodes (16): ADR-0004, handle, connect(), CommandPublish, GATEWAY_COMMAND_CHANNEL, listenGatewayCommands(), parseGatewayCommand(), ADR-0006 (+8 more)

### Community 58 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution (+9 more)

### Community 59 - "run-engine.ts"
Cohesion: 0.12
Nodes (17): add(), LiveHub, LogLine, send(), MachineBack, RunContext, RunEngineOptions, Sender (+9 more)

### Community 60 - "steps"
Cohesion: 0.10
Nodes (19): runs-on, steps, strategy, jobs, agent, os, name, on (+11 more)

### Community 61 - "flows/page.tsx"
Cohesion: 0.23
Nodes (17): exportFlowAction(), flowActionAction(), FlowRowActions(), EMPTY, FlowCard(), FlowsList(), SCOPES, Steps() (+9 more)

### Community 62 - "server/machines.ts"
Cohesion: 0.11
Nodes (32): Viewer, ApproveResult, canRemoveMachine(), checkMyLogins(), LookUpResult, MACHINE_NAME_MAX, MachineSettingsInput, ownMachine() (+24 more)

### Community 63 - "db/src/machines.ts"
Cohesion: 0.13
Nodes (15): applyMachineLogins(), DeleteMachineResult, MachineFacts, MachineLogins, MachineRow, MachineRun, MachineRunCounts, machineRunsIn() (+7 more)

### Community 64 - "Deploying Clauderon"
Cohesion: 0.11
Nodes (18): 1. Prepare the machine (once), 2. Outside accounts (once), 3. Configure, 4. Start the stack, 5. Publish with a Cloudflare Tunnel, 6. Members pair their Machines, 7. Backups, Demo on Render (+10 more)

### Community 65 - "human-form.tsx"
Cohesion: 0.26
Nodes (8): respondAction(), RespondFormState, Choices(), OpenRequest, Question, answersFromForm(), OTHER_CHOICE, HumanAction

### Community 66 - "db/src/human.ts"
Cohesion: 0.10
Nodes (23): ApproveSubject, buildGrillAnswerPrompt(), checkAnswers(), FEEDBACK_HEADING, GrillAnswers, GrillOption, GrillQuestion, HumanResponse (+15 more)

### Community 67 - "start.ts"
Cohesion: 0.19
Nodes (17): keysFor(), startableFlows(), startDialog(), StartInput, StartResult, startRuns(), TRUSTED, checkSlots() (+9 more)

### Community 68 - "environment"
Cohesion: 0.19
Nodes (13): AUTH_URL, DATABASE_URL, GATEWAY_PORT, GATEWAY_URL, GITHUB_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPERATOR_EMAILS (+5 more)

### Community 69 - "postgres"
Cohesion: 0.15
Nodes (12): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, name, environment, image, ports, volumes (+4 more)

### Community 70 - "gateway/test/m3.test.ts"
Cohesion: 0.09
Nodes (22): Gateway, GatewayOptions, LOG_RETENTION_DAYS, LogRetentionOptions, HEARTBEAT_TIMEOUT_MS, MachineWatchOptions, open(), setup() (+14 more)

### Community 71 - "protocol/package.json"
Cohesion: 0.17
Nodes (12): dependencies, zod@^4.6.7, exports, name, private, scripts, lint, test (+4 more)

### Community 72 - "tasks"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+4 more)

### Community 74 - "pairings.ts"
Cohesion: 0.12
Nodes (20): approveMyPairing(), normalizePairingCode(), PAIRING_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_TTL_MS, ADR-0006, Machine, MACHINE_DEFAULT_SLOTS (+12 more)

### Community 76 - "compose.yml"
Cohesion: 0.20
Nodes (9): content, configs, cloudflared, name, name, services, volumes, pgdata (+1 more)

### Community 78 - "core/package.json"
Cohesion: 0.20
Nodes (9): exports, name, private, scripts, lint, test, typecheck, type (+1 more)

### Community 79 - "app/layout.tsx"
Cohesion: 0.18
Nodes (9): inter, jetbrains, metadata, outfit, apply(), OPTIONS, Theme, THEME_BOOTSTRAP (+1 more)

### Community 80 - "agent.ts"
Cohesion: 0.09
Nodes (16): AgentOptions, BACKOFF_CAP_MS, BACKOFF_START_MS, Connector, Handler, HEARTBEAT_MS, MachineFacts, MachineFactsReader (+8 more)

### Community 81 - "postgres"
Cohesion: 0.25
Nodes (8): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, environment, image, restart, volumes, postgres

### Community 82 - "gateway/src/machines.ts"
Cohesion: 0.25
Nodes (5): MachineService, MachineServiceOptions, ADR-0006, ADR-0007, applyMachineDoctor()

### Community 83 - "M4 — Refinement and release"
Cohesion: 0.12
Nodes (17): 1. Scope, 2.1 Diff (TRK-3), 2.2 Usage (TRK-4), 2.3 Artifact (TRK-5), 2.4 Batch page (TRK-6), 2.5 Ticket detail (TIC-4), 2. Tracking, 3. Machines (replaces Pods) (+9 more)

### Community 84 - "runs/[id]/page.tsx"
Cohesion: 0.13
Nodes (15): AuditPage(), detailText(), dynamic, Search, SUBJECT_LINK, FilterSelect(), Option, dynamic (+7 more)

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

### Community 91 - "node-file.ts"
Cohesion: 0.18
Nodes (10): fail(), isObject(), NODE_FILE_FORMAT, NODE_FILE_MAX_BYTES, NODE_FILE_VERSION, NodeFile, ParsedNodes, parseNodeFile() (+2 more)

### Community 92 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, incremental, jsx, lib, plugins, exclude, extends (+2 more)

### Community 93 - "Clauderon"
Cohesion: 0.12
Nodes (17): Architecture, Clauderon, Contributing, Development commands, Development (`.env`), Documentation, Environment variables, How it works (+9 more)

### Community 94 - "Contributing"
Cohesion: 0.20
Nodes (10): Branches, Commits, Configuration and secrets, Contributing, Pull requests, Release notes, Releases, Repo graph for Claude (+2 more)

### Community 96 - "M3 execution plan — People in the loop"
Cohesion: 0.29
Nodes (7): 3. Dependency graph and order, 5. Testing strategy, 6. Risks and edge cases, 8. Deployment order, 9. Progress log, M3 execution plan — People in the loop, Not covered here

### Community 97 - "protocol.test.ts"
Cohesion: 0.43
Nodes (5): createGatewayTicket(), GATEWAY_TICKET_SECONDS, sign(), verifyGatewayTicket(), hello

### Community 103 - "4. Starting Runs"
Cohesion: 0.33
Nodes (6): 4.1 Start dialog (RUN-1, TIC-9), 4.3 Agent Nodes (RUN-10, POD-12), 4.4 Command Nodes (RUN-10), 4.5 `Open a pull request` (RUN-11, POD-11, TIC-8), 4.6 Masking and logs (NFR-1, NFR-5), 4. Starting Runs

### Community 104 - "activeOutputs"
Cohesion: 0.47
Nodes (5): activeOutputs(), OutputValue, fake(), simulatedDelayMs(), simulatedOutputs()

### Community 105 - "ticket-status.test.ts"
Cohesion: 0.24
Nodes (10): stream(), flow(), 3. Database schema, 4.1 Envelope and resuming, 4.2 Messages, 4. Host Agent protocol, RunForStatus, at() (+2 more)

### Community 106 - "categories"
Cohesion: 0.40
Nodes (4): labels, title, changelog, categories

### Community 107 - ".respond"
Cohesion: 0.50
Nodes (3): answerWith(), scriptPlanAndDeliver(), succeedEverything()

### Community 108 - "3. Day by day"
Cohesion: 0.14
Nodes (14): 1. At a glance, 2. Before Day 1, 3. Day by day, 4. How the team works with AI agents, 5. Risks and what to cut, 6. Definition of done, Clauderon v1 — seven-day roadmap, Day 1 — Foundations (M0) (+6 more)

### Community 109 - "M3 — People in the loop"
Cohesion: 0.15
Nodes (13): 10. Slices, 1. Scope, 2.1 Approve (FLW-2, RUN-4, RUN-6), 2.2 Grill (FLW-2, RUN-10), 2. Human Nodes, 3. Needs you (RUN-5, MEM-2), 4. Retry (RUN-7, RUN-9), 5. Cancel (RUN-8) (+5 more)

### Community 110 - "gateway/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 111 - "host-agent/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 112 - "CONTRIBUTING.md"
Cohesion: 0.14
Nodes (7): Releases and the repo graph, Updating tickets after a PR merge, Triage Labels, Change, Notes, Test plan, Why

### Community 113 - "cloudflared"
Cohesion: 0.17
Nodes (12): command, configs, depends_on, environment, image, restart, source, target (+4 more)

### Community 114 - "Clauderon at a glance"
Cohesion: 0.17
Nodes (12): Architecture in brief, Clauderon at a glance, Decisions we need from leads, How it works, How we will know it works, In one sentence, Learn more, Roadmap (+4 more)

### Community 115 - "core/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 116 - "db/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 117 - "Clauderon"
Cohesion: 0.22
Nodes (9): Agent skills, Architecture, Clauderon, Commands, Contributing, Domain docs, Issue tracker, Next.js (+1 more)

### Community 118 - "protocol/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 119 - "DESIGN.md"
Cohesion: 0.20
Nodes (9): Colors, Components, Do's and Don'ts, Elevation & Depth, Layout, Overview, Shapes, Theme (+1 more)

### Community 120 - "validateFlow"
Cohesion: 0.08
Nodes (30): 10. Acceptance tests, 11. Slices, 1. Scope, 2. Configuration, 5.1 Flow validator (FLW-4, FLW-5, A3), 5.2 Run state machine (RUN-2 … RUN-9, RUN-16), 5.3 Slot scheduler (POD-3), 5.4 Ticket Status (TIC-6) (+22 more)

### Community 121 - "Shared conventions"
Cohesion: 0.22
Nodes (9): Clauderon v1 — milestone specs, Definition of done for every slice, Naming, Repository layout, Requirement coverage, Shared conventions, Slices, The test seam (spec Q1) (+1 more)

### Community 122 - "Contributing guide and team conventions (design)"
Cohesion: 0.20
Nodes (9): Approaches, Branch flow and repo graph (decided), Contributing guide and team conventions (design), Convention (my proposals, to be reviewed), Goals, Intent, Left to the builder, Non-goals / anti-goals (+1 more)

### Community 123 - "testing/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

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

### Community 131 - "runner.ts"
Cohesion: 0.12
Nodes (18): claudeResult(), Findings, Goal, Spike M0-02: Claude Code headless in the Pod image, Steps, MASK, BranchFacts, branchName() (+10 more)

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
- **69 isolated node(s):** `ADR-0008`, `ADR-0008`, `ADR-0006`, `ADR-0006`, `ADR-0007` (+64 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 989 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Member` connect `FlowDrafts` to `Web auth and access`, `gateway/test/m3.test.ts`, `LinkSocket`, `gateway/src/pairing.ts`, `flow-drafts.ts`, `Shared conventions`, `Contributing`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `deps()` (e.g. with `web/test/access.test.ts` and `m1.test.ts`) actually correct?**
  _`deps()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0008`, `ADR-0008`, `ADR-0006` to the rest of the system?**
  _69 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Gateway tests` be split into smaller, more focused modules?**
  _Cohesion score 0.12745098039215685 - nodes in this community are weakly interconnected._
- **Why does `Contributing` connect `Contributing` to `CONTRIBUTING.md`, `FlowDrafts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Should `Web auth and access` be split into smaller, more focused modules?**
  _Cohesion score 0.0919661733615222 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Gateway tests` to `Web auth and access`, `Agent smoke and doctor`, `Agent node execution`, `runner.ts`, `Needs-you and run pages`, `Agent main and CLI`, `Flow canvas geometry`, `icons.tsx`, `Node library UI`, `machines/[id]/page.tsx`, `Claude CLI wrapper`, `Agent service install`, `Root tooling`, `flow-drafts.ts`, `pair.ts`, `core/src/index.ts`, `health.test.ts`, `build-flow.tsx`, `run.ts`, `flow.ts`, `pairings.test.ts`, `gateway/src/pairing.ts`, `flow-editor-model.test.ts`, `client.ts`, `flows/page.tsx`, `human-form.tsx`, `db/src/human.ts`, `start.ts`, `gateway/test/m3.test.ts`, `agent.ts`, `node-file.ts`, `protocol.test.ts`, `ticket-status.test.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._