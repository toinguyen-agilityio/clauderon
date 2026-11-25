# Graph Report - clauderon  (2026-11-25)

## Corpus Check
- 384 files · ~302,133 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 4, .example 2, .cmd 1)

## Summary
- 2904 nodes · 7515 edges · 145 communities (128 shown, 17 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 221 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4c7c2e89`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- inspector.ts
- core/src/index.ts
- run-engine.ts
- agent-install.ts
- Agent node execution
- node-file.ts
- Needs-you and run pages
- Agent main and CLI
- Web dependencies
- Flow canvas geometry
- env
- icons.tsx
- Node library UI
- agent-smoke.ts
- machines/page.tsx
- CI workflow
- MachineLinks
- Claude CLI wrapper
- Host-agent dependencies
- db/src/human.ts
- flow-drafts.ts
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
- markdown-text.tsx
- LinkSocket
- gateway/package.json
- compilerOptions
- deps
- services
- src/projects.ts
- Clauderon — Requirements v1 (final)
- M1 — Walking skeleton
- agent-dist.ts
- envelope.ts
- LiveHub
- flow-node.tsx
- server/github-access.ts
- bundle.mjs
- GitHubReader
- Payload
- README.md
- pull-request-table.tsx
- flow-editor-model.test.ts
- tickets.ts
- server/flows.ts
- testing/package.json
- bundle.mjs
- deploy.sh
- db/src/schema.ts
- compilerOptions
- server.test.ts
- steps
- flows/page.tsx
- server/machines.ts
- machines/[id]/page.tsx
- Deploying Clauderon
- human-form.tsx
- db/src/human.ts
- m1.test.ts
- environment
- postgres
- db/src/index.ts
- protocol/package.json
- tasks
- Agent
- agent.json/route.ts
- FlowDrafts
- compose.yml
- server/runs.ts
- core/package.json
- app/layout.tsx
- agent.ts
- postgres
- gateway/src/machines.ts
- M4 — Refinement and release
- claude.ts
- web
- gateway
- backup.sh
- migrate
- healthcheck
- build
- flow.ts
- serialize
- Clauderon
- Contributing
- run-live.tsx
- server/runtime.ts
- protocol.test.ts
- after-pr-merge.mjs
- pnpm-workspace.yaml
- { GET, POST }
- dynamic
- 4. Starting Runs
- activeOutputs
- ticket-status.test.ts
- categories
- Db
- gateway/tsconfig.json
- M3 — People in the loop
- gateway/tsconfig.json
- host-agent/tsconfig.json
- pull_request_template.md
- cloudflared
- Clauderon at a glance
- host-agent/tsconfig.json
- server/projects.ts
- Clauderon
- tickets/page.tsx
- DESIGN.md
- M0 — Foundations
- Shared conventions
- Contributing guide and team conventions (design)
- core/tsconfig.json
- Issue tracker: GitHub
- Language
- db/tsconfig.json
- features/tsconfig.json
- Log a bug
- doctor.ts
- Domain Docs
- protocol/tsconfig.json
- testing/tsconfig.json
- Pods push and open pull requests with their own git/gh login
- Flows are typed DAGs without cycles, run one Node at a time
- Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent
- The web app runs on Vercel, with an always-on Gateway for long-lived connections
- Each Member runs on their own Machine, paired to a public app
- The Agent ships as one bundle with its own Node, and checks its Machine
- AGENTS.md
- Clauderon docs
- MachineWatch
- mask
- ticket-status-after-merge.md
- machine-parts.tsx

## God Nodes (most connected - your core abstractions)
1. `deps()` - 101 edges
2. `requireMember()` - 78 edges
3. `vitest` - 60 edges
4. `next` - 57 edges
5. `react` - 52 edges
6. `Db` - 48 edges
7. `Payload` - 42 edges
8. `RunEngine` - 38 edges
9. `Icon` - 36 edges
10. `recordAudit()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `9. Seeds (FLW-8)` --references--> `validateFlow()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/core/src/flow.ts
- `4.2 Run engine (RUN-2, RUN-3, RUN-16)` --references--> `nextNode()`  [INFERRED]
  docs/specs/m1-walking-skeleton.md → packages/core/src/run.ts
- `7. Dry-run (removed)` --references--> `simulatedOutputs()`  [INFERRED]
  docs/specs/m2-flows-and-scheduling.md → packages/core/src/simulate.ts
- `Naming` --references--> `Member`  [INFERRED]
  docs/specs/README.md → packages/db/src/access.ts
- `11. Slices` --references--> `endMemberAccess()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/db/src/access.ts

## Import Cycles
- None detected.

## Communities (145 total, 17 thin omitted)

### Community 0 - "inspector.ts"
Cohesion: 0.10
Nodes (26): inspectorOf(), base, BYTES_PER_TOKEN, Call, contextSize(), EDITING_TOOLS, EXPLORING_CALLS, EXPLORING_TOOLS (+18 more)

### Community 1 - "core/src/index.ts"
Cohesion: 0.07
Nodes (54): operators, sessionFor(), AccessDeps, addToAllowlist(), checkGoogleSignIn(), GoogleSignIn, clauderonAdapter(), orNull() (+46 more)

### Community 2 - "run-engine.ts"
Cohesion: 0.08
Nodes (31): createGateway(), MachineBack, RunContext, RunEngine, RunEngineOptions, Sender, ADR-0006, log() (+23 more)

### Community 3 - "agent-install.ts"
Cohesion: 0.18
Nodes (15): server, dynamic, GET(), ADR-0006, dynamic, GET(), ADR-0006, agentHomeName() (+7 more)

### Community 4 - "Agent node execution"
Cohesion: 0.09
Nodes (12): EXEC_ARGS, ExecOptions, OutputListener, Signal, DIR, ExecCall, ExecReply, FakeSystem (+4 more)

### Community 5 - "node-file.ts"
Cohesion: 0.16
Nodes (12): NodeDefinition, buildNodeFile(), fail(), isObject(), NODE_FILE_FORMAT, NODE_FILE_MAX_BYTES, NODE_FILE_VERSION, NodeFile (+4 more)

### Community 6 - "Needs-you and run pages"
Cohesion: 0.12
Nodes (15): AuditPage(), detailText(), dynamic, Search, SUBJECT_LINK, FilterSelect(), Option, dynamic (+7 more)

### Community 7 - "Agent main and CLI"
Cohesion: 0.09
Nodes (43): registerDraftHandlers(), findBash(), localSystem(), checkLogins(), agentBinDir(), ask(), [command = "run", ...args], doctorCommand() (+35 more)

### Community 8 - "Web dependencies"
Cohesion: 0.07
Nodes (39): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, next@^16.4.6, next-auth@5.0.0-beta.32, react@^19.3.1, react-dom@^19.3.1 (+31 more)

### Community 9 - "Flow canvas geometry"
Cohesion: 0.12
Nodes (36): boundsOf(), centerOn(), clampZoom(), edgePath(), FAR_ZOOM, fitBounds(), intersects(), MAX_ZOOM (+28 more)

### Community 10 - "env"
Cohesion: 0.10
Nodes (20): env, if, runs-on, steps, GH_TOKEN, PR, PR_BODY, REPO (+12 more)

### Community 11 - "icons.tsx"
Cohesion: 0.08
Nodes (31): AccessDeniedPage(), dynamic, needsYouAction(), AppLayout(), inter, jetbrains, metadata, outfit (+23 more)

### Community 12 - "Node library UI"
Cohesion: 0.10
Nodes (45): kindIcon(), cloneNodeAction(), deleteNodeAction(), exportNodesAction(), saveNodeAction(), ImportNodes(), LibraryList(), NodeCard() (+37 more)

### Community 13 - "agent-smoke.ts"
Cohesion: 0.13
Nodes (12): agent, doctor, env, home, nodeVersion, problems, report, ADR-0007 (+4 more)

### Community 14 - "machines/page.tsx"
Cohesion: 0.18
Nodes (21): PairFormState, claudeAccountLabel(), DiskStatus(), LoginChip(), machineName(), MachineStatusChip(), osLabel(), ReadyChip() (+13 more)

### Community 15 - "CI workflow"
Cohesion: 0.08
Nodes (25): env, runs-on, services, steps, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, TEST_DATABASE_URL (+17 more)

### Community 16 - "MachineLinks"
Cohesion: 0.11
Nodes (13): Handler, HeartbeatListener, HelloListener, Link, MachineLinks, MachineLinksOptions, ADR-0006, markAllMachinesDisconnected() (+5 more)

### Community 17 - "Claude CLI wrapper"
Cohesion: 0.08
Nodes (33): claudeCommand(), ClaudeErrorWatch, draftClaudeCommand(), draftDir(), DraftRunnerOptions, runDraft(), Running, ADR-0008 (+25 more)

### Community 18 - "Host-agent dependencies"
Cohesion: 0.08
Nodes (30): dependencies, @clauderon/core@workspace:*, @clauderon/protocol@workspace:*, dockerode@^5.0.1, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, esbuild@0.28.2 (+22 more)

### Community 19 - "db/src/human.ts"
Cohesion: 0.22
Nodes (16): ADD_ERRORS, addEmail(), FormState, refresh(), removeMachineAction(), removeMemberAction(), runsOf(), AddEmailForm() (+8 more)

### Community 20 - "flow-drafts.ts"
Cohesion: 0.15
Nodes (11): Draft, FlowDraftsOptions, Job, Purpose, sendEvent(), ADR-0008, FLOW_DRAFT_TIMEOUT_MS, BrowserEvent (+3 more)

### Community 21 - "Agent service install"
Cohesion: 0.16
Nodes (25): Exec, installService(), launchdPath(), launchdPlist(), logFile(), SERVICE_LABEL, serviceArgs(), serviceInstalled() (+17 more)

### Community 22 - "react"
Cohesion: 0.17
Nodes (17): Choice, INPUT_LABEL, Loaded, MachineFormState, SettingsFormState, CheckLogins(), Confirmed(), RemoveMachine() (+9 more)

### Community 23 - "Root tooling"
Cohesion: 0.07
Nodes (31): devDependencies, eslint@^10.15.0, tsx@^4.23.15, turbo@^2.11.11, @types/node@^26.6.6, typescript@~6.0.3, typescript-eslint@^8.72.2, vitest@^5.1.0 (+23 more)

### Community 24 - "flow-drafts.ts"
Cohesion: 0.17
Nodes (15): describeLibrary(), DraftLibraryNode, FLOW_DRAFT_MAX_DESCRIPTION, FLOW_DRAFT_MIN_AGENT, flowDraftPrompt(), FlowDraftRead, flowDraftRepairPrompt(), flowDraftRevisePrompt() (+7 more)

### Community 25 - "pair.ts"
Cohesion: 0.10
Nodes (22): checkGateway(), GatewayCheck, skew(), ADR-0007, httpBase(), pair(), PAIR_POLL_MS, Paired (+14 more)

### Community 26 - "FakeGitHub"
Cohesion: 0.20
Nodes (7): Issue, OpenPullRequest, PullRequest, Repository, FakeGitHub, FakePullRequest, RepoData

### Community 27 - "core/src/index.ts"
Cohesion: 0.14
Nodes (17): buildFlowFile(), ENTRY_KINDS, fail(), FATAL, FLOW_FILE_FORMAT, FLOW_FILE_MAX_BYTES, FLOW_FILE_VERSION, FlowToExport (+9 more)

### Community 28 - "health.test.ts"
Cohesion: 0.14
Nodes (11): DoctorInput, signalGroup(), ADR-0006, memberShell(), mergePaths(), parsePathOutput(), printPathCommand(), refreshToolPath() (+3 more)

### Community 29 - "build-flow.tsx"
Cohesion: 0.13
Nodes (19): BuildAvailability, BuildFlow(), Composer(), Draft, DraftPreview(), EXAMPLES, Phase, ADR-0008 (+11 more)

### Community 30 - "db/package.json"
Cohesion: 0.07
Nodes (33): ADR-0004, dependencies, @clauderon/core@workspace:*, drizzle-orm@^0.45.4, pg@^8.23.1, devDependencies, drizzle-kit@^0.31.11, @types/pg@^8.23.1 (+25 more)

### Community 31 - "run.ts"
Cohesion: 0.10
Nodes (28): 1. Starting point, 2. Architecture decisions, 3. Dependency graph and order, 6. Risks and edge cases, 8. Deployment order, 9. Progress log, M3 execution plan — People in the loop, Not covered here (+20 more)

### Community 32 - "markdown-text.tsx"
Cohesion: 0.33
Nodes (12): CODE_LIKE, ExpandedText(), formatForReading(), isLongText(), LONG_TEXT_CHARS, LONG_TEXT_LINES, MarkdownBody(), MarkdownText() (+4 more)

### Community 34 - "gateway/package.json"
Cohesion: 0.10
Nodes (24): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, @types/ws@^8.18.2 (+16 more)

### Community 35 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, incremental, jsx, lib, plugins, exclude, extends (+2 more)

### Community 36 - "deps"
Cohesion: 0.08
Nodes (52): createFlowAction(), FlowFormState, importFlowAction(), loadFlowStartAction(), loadFlowStartChoicesAction(), startFromInputAction(), saveFlowAction(), dynamic (+44 more)

### Community 37 - "services"
Cohesion: 0.07
Nodes (31): databases, databaseName, ipAllowList, name, plan, postgresMajorVersion, region, user (+23 more)

### Community 38 - "src/projects.ts"
Cohesion: 0.12
Nodes (15): enableProject(), EnableResult, FINAL_PR_STATES, Project, removeProject(), RemoveProjectResult, RunWithPullRequest, Ticket (+7 more)

### Community 39 - "Clauderon — Requirements v1 (final)"
Cohesion: 0.07
Nodes (30): 10. Glossary, 11. Related documents, 12. Next steps, 1. Overview, 2. Goals and success measures, 3. Scope, 4.1 Members and Projects, 4.2 Pods (+22 more)

### Community 40 - "M1 — Walking skeleton"
Cohesion: 0.08
Nodes (24): 1. Scope, 2.1 Create my Pod (POD-2), 2.2 Start and Stop (POD-6, part), 2.3 Pods page (POD-4), 2.4 Login checks (POD-5), 2.5 Web terminal (POD-9), 2. Pods, 3.1 Enable a Project (PRJ-1, PRJ-2) (+16 more)

### Community 41 - "agent-dist.ts"
Cohesion: 0.12
Nodes (15): latestAgent(), sha256(), ADR-0007, updateAgent(), UpdateOptions, UpdateResult, AgentCheck, AgentManifest (+7 more)

### Community 42 - "envelope.ts"
Cohesion: 0.17
Nodes (12): doctorReport, envelopeShape, ParseResult, CONTROL_TYPES, ControlType, messageSchemas, MessageType, ADR-0006 (+4 more)

### Community 43 - "LiveHub"
Cohesion: 0.28
Nodes (4): add(), LiveHub, send(), parseBrowserMessage()

### Community 44 - "flow-node.tsx"
Cohesion: 0.12
Nodes (26): GRID, CanvasHandle(), HandleType, DEFAULT_NODE, Doc, GraphEdge, LibraryAnchor, NO_SELECTION (+18 more)

### Community 45 - "server/github-access.ts"
Cohesion: 0.18
Nodes (16): appGitHubToken(), GitHubAccessDeps, SaveTokenResult, ADR-0010, viewGitHubAccess(), GitHubError, key(), seal() (+8 more)

### Community 46 - "bundle.mjs"
Cohesion: 0.22
Nodes (7): buildId, bundle, dist, manifest, ADR-0007, root, versionMatch

### Community 50 - "pull-request-table.tsx"
Cohesion: 0.21
Nodes (13): loadPullRequestStartDialog(), startPullRequestsAction(), dynamic, PullRequestsPage(), Search, PullRequestListRow, PullRequestTable(), selectable() (+5 more)

### Community 51 - "flow-editor-model.test.ts"
Cohesion: 0.09
Nodes (28): isTyping(), FlowEditor(), isMac(), newId(), sameSet(), layeredLayout(), layerOf(), LAYOUT_GAP_X (+20 more)

### Community 52 - "tickets.ts"
Cohesion: 0.14
Nodes (14): dependencies, zod@^4.6.7, exports, zod, name, private, scripts, build:file (+6 more)

### Community 53 - "server/flows.ts"
Cohesion: 0.07
Nodes (65): copyName(), cleanGraph(), CloneFlowResult, cloneMyFlow(), createMyFlow(), Definition, DeleteFlowOutcome, deleteMyFlow() (+57 more)

### Community 54 - "testing/package.json"
Cohesion: 0.13
Nodes (18): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, drizzle-orm@^0.45.4, exports, @clauderon/core, @clauderon/db (+10 more)

### Community 55 - "bundle.mjs"
Cohesion: 0.11
Nodes (26): config, rootEnv, buildFeatures(), MAP_PATH, OUTPUT_PATH, read(), renderFeatures(), out (+18 more)

### Community 56 - "deploy.sh"
Cohesion: 0.29
Nodes (16): compose(), die(), down(), env_get(), env_set(), init_env(), preflight(), say() (+8 more)

### Community 57 - "db/src/schema.ts"
Cohesion: 0.07
Nodes (30): DeleteMachineResult, MachineFacts, MachineLogins, MachineRow, MachineRun, MachineRunCounts, machineRunsIn(), QueuedRun (+22 more)

### Community 58 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution (+9 more)

### Community 59 - "server.test.ts"
Cohesion: 0.05
Nodes (29): BrowserHub, BrowserHubOptions, ADR-0008, Gateway, GatewayOptions, LOG_RETENTION_DAYS, LogRetention, LogRetentionOptions (+21 more)

### Community 60 - "steps"
Cohesion: 0.10
Nodes (19): runs-on, steps, strategy, jobs, agent, os, name, on (+11 more)

### Community 61 - "flows/page.tsx"
Cohesion: 0.13
Nodes (27): exportFlowAction(), flowActionAction(), FlowRowActions(), EMPTY, FlowCard(), FlowsList(), SCOPES, Steps() (+19 more)

### Community 62 - "server/machines.ts"
Cohesion: 0.06
Nodes (52): handlePairing(), json(), PairingHttpOptions, readBody(), ADR-0006, ADR-0007, approveMyPairing(), ApproveResult (+44 more)

### Community 63 - "machines/[id]/page.tsx"
Cohesion: 0.15
Nodes (14): AutoRefresh(), CmdBox(), DoctorCard(), DOT, looksLikeCommand(), ORDER, ADR-0007, ADR-0007 (+6 more)

### Community 64 - "Deploying Clauderon"
Cohesion: 0.11
Nodes (18): 1. Prepare the machine (once), 2. Outside accounts (once), 3. Configure, 4. Start the stack, 5. Publish with a Cloudflare Tunnel, 6. Members pair their Machines, 7. Backups, Demo on Render (+10 more)

### Community 65 - "human-form.tsx"
Cohesion: 0.24
Nodes (9): respondAction(), RespondFormState, Choices(), OpenRequest, Question, answersFromForm(), OTHER_CHOICE, respondAs() (+1 more)

### Community 66 - "db/src/human.ts"
Cohesion: 0.07
Nodes (42): claudeResult(), 4. Changes by layer, 5. Testing strategy, ApproveSubject, buildGrillAnswerPrompt(), checkAnswers(), FEEDBACK_HEADING, GrillAnswers (+34 more)

### Community 67 - "m1.test.ts"
Cohesion: 0.12
Nodes (37): AppDeps, viewMachine(), viewMachines(), viewPullRequests(), viewRuns(), FlowStartChoice, flowStartDialog(), keysFor() (+29 more)

### Community 68 - "environment"
Cohesion: 0.20
Nodes (12): AUTH_URL, DATABASE_URL, GATEWAY_PORT, GATEWAY_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPERATOR_EMAILS, SESSION_SECRET (+4 more)

### Community 69 - "postgres"
Cohesion: 0.15
Nodes (12): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, name, environment, image, ports, volumes (+4 more)

### Community 70 - "db/src/index.ts"
Cohesion: 0.07
Nodes (53): LogLine, open(), answerWith(), setup(), flusher(), newGateway(), restartGateway(), SESSION_SECRET (+45 more)

### Community 71 - "protocol/package.json"
Cohesion: 0.17
Nodes (12): dependencies, zod@^4.6.7, exports, zod, name, private, scripts, lint (+4 more)

### Community 72 - "tasks"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+4 more)

### Community 74 - "agent.json/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, GET(), ADR-0007, agentManifest()

### Community 76 - "compose.yml"
Cohesion: 0.14
Nodes (13): content, configs, cloudflared, name, name, services, volumes, pgdata (+5 more)

### Community 77 - "server/runs.ts"
Cohesion: 0.06
Nodes (47): openRequest(), CancelOutcome, InspectedAttempt, NeedsYouItem, NodeState, PullRequestQuery, PullRequestTab, RespondOutcome (+39 more)

### Community 78 - "core/package.json"
Cohesion: 0.20
Nodes (9): exports, name, private, scripts, lint, test, typecheck, type (+1 more)

### Community 79 - "app/layout.tsx"
Cohesion: 0.21
Nodes (3): Connector, FakeGateway, MemorySocket

### Community 80 - "agent.ts"
Cohesion: 0.11
Nodes (12): AgentOptions, BACKOFF_CAP_MS, BACKOFF_START_MS, Handler, HEARTBEAT_MS, MachineFacts, MachineFactsReader, MachineUsage (+4 more)

### Community 81 - "postgres"
Cohesion: 0.25
Nodes (8): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, environment, image, restart, volumes, postgres

### Community 82 - "gateway/src/machines.ts"
Cohesion: 0.16
Nodes (8): MachineService, MachineServiceOptions, ADR-0006, ADR-0007, FakeLink, applyMachineDoctor(), applyMachineLogins(), Payload

### Community 83 - "M4 — Refinement and release"
Cohesion: 0.12
Nodes (17): 1. Scope, 2.1 Diff (TRK-3), 2.2 Usage (TRK-4), 2.3 Artifact (TRK-5), 2.4 Batch page (TRK-6), 2.5 Ticket detail (TIC-4), 2. Tracking, 3. Machines (replaces Pods) (+9 more)

### Community 84 - "claude.ts"
Cohesion: 0.13
Nodes (18): byteSize(), CLAUDE_ARGS, ClaudeEvent, Content, firstLine(), inputTokens(), ModelUsage, parseClaudeLine() (+10 more)

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

### Community 91 - "flow.ts"
Cohesion: 0.09
Nodes (36): describeProblems(), Placement, ProblemFix, ProblemView, byCanvas(), compare(), ConnectResult, cycleEdges() (+28 more)

### Community 93 - "Clauderon"
Cohesion: 0.12
Nodes (17): Architecture, Clauderon, Contributing, Development commands, Development (`.env`), Documentation, Environment variables, How it works (+9 more)

### Community 94 - "Contributing"
Cohesion: 0.20
Nodes (10): Branches, Commits, Configuration and secrets, Contributing, Pull requests, Release notes, Releases, Repo graph for Claude (+2 more)

### Community 95 - "run-live.tsx"
Cohesion: 0.09
Nodes (44): DISK_ADVICE, dynamic, NeedsYouPage(), CancelFormState, RetryFormState, retryRunAction(), CancelRun(), Attempt (+36 more)

### Community 96 - "server/runtime.ts"
Cohesion: 0.10
Nodes (26): dynamic, GET(), ADR-0006, dynamic, GET(), dynamic, GET(), ADR-0006 (+18 more)

### Community 97 - "protocol.test.ts"
Cohesion: 0.43
Nodes (5): createGatewayTicket(), GATEWAY_TICKET_SECONDS, sign(), verifyGatewayTicket(), hello

### Community 103 - "4. Starting Runs"
Cohesion: 0.60
Nodes (3): Loading(), Loading(), ListSkeleton()

### Community 104 - "activeOutputs"
Cohesion: 0.17
Nodes (13): 10. Acceptance tests, 10. Slices, 1. Scope, 2. Flows page, 3. Canvas editor (FLW-3 … FLW-6), 4. Node library (FLW-1, FLW-9, FLW-10), 5. Flow edit lock (FLW-7), 6. Slots, limits and the queue (POD-2, POD-3, POD-6) (+5 more)

### Community 105 - "ticket-status.test.ts"
Cohesion: 0.50
Nodes (3): Consequences, Considered Options, Flow Drafts run Claude Code on the Member's Machine, outside any Run

### Community 106 - "categories"
Cohesion: 0.40
Nodes (4): labels, title, changelog, categories

### Community 107 - "Db"
Cohesion: 0.13
Nodes (16): handle, connect(), Db, migrate(), flowEdge, flowNode, SampleEdge, SampleFlow (+8 more)

### Community 108 - "gateway/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 109 - "M3 — People in the loop"
Cohesion: 0.15
Nodes (13): 10. Slices, 1. Scope, 2.1 Approve (FLW-2, RUN-4, RUN-6), 2.2 Grill (FLW-2, RUN-10), 2. Human Nodes, 3. Needs you (RUN-5, MEM-2), 4. Retry (RUN-7, RUN-9), 5. Cancel (RUN-8) (+5 more)

### Community 111 - "host-agent/tsconfig.json"
Cohesion: 0.24
Nodes (7): ApiIssue, fetchJson(), request(), ADR-0010, withCachedPullRequests(), pull(), setup()

### Community 112 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Change, Notes, Test plan, Why

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
Cohesion: 0.22
Nodes (14): EnableRepositoryResult, forgetSyncAttempts(), lastAttempt, mapLimit(), pullFromGitHub(), refreshPullRequest(), syncAllProjects(), SyncResult (+6 more)

### Community 117 - "Clauderon"
Cohesion: 0.22
Nodes (9): Agent skills, Architecture, Clauderon, Commands, Contributing, Domain docs, Issue tracker, Next.js (+1 more)

### Community 118 - "tickets/page.tsx"
Cohesion: 0.13
Nodes (23): loadStartDialog(), startAction(), syncTicketsAction(), dynamic, Search, TicketsPage(), VIEWS, FilterLink() (+15 more)

### Community 119 - "DESIGN.md"
Cohesion: 0.20
Nodes (9): Colors, Components, Do's and Don'ts, Elevation & Depth, Layout, Overview, Shapes, Theme (+1 more)

### Community 120 - "M0 — Foundations"
Cohesion: 0.04
Nodes (46): stream(), assistant(), result(), usage(), flow(), 1. At a glance, 2. Before Day 1, 3. Day by day (+38 more)

### Community 121 - "Shared conventions"
Cohesion: 0.25
Nodes (8): Clauderon v1 — milestone specs, Definition of done for every slice, Naming, Repository layout, Requirement coverage, Shared conventions, Slices, The test seam (spec Q1)

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

### Community 129 - "doctor.ts"
Cohesion: 0.14
Nodes (19): CLOCK_SKEW_MS, firstLine(), fixFor(), Platform, runDoctor(), ADR-0007, detached(), checkClaude() (+11 more)

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

### Community 138 - "The Agent ships as one bundle with its own Node, and checks its Machine"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, The Agent ships as one bundle with its own Node, and checks its Machine

### Community 142 - "mask"
Cohesion: 0.22
Nodes (9): Considered Options, The GitHub token is set on the Projects page, stored encrypted, escapeRegExp(), MASK, mask(), TOKEN_PATTERNS, checkRunInput(), RunInput (+1 more)

### Community 145 - "machine-parts.tsx"
Cohesion: 0.18
Nodes (17): DiskFree, diskFree(), formatGb(), MACHINE_NAME_MAX, MachineResources(), OS_LABEL, Resource, resourceLabels() (+9 more)

## Knowledge Gaps
- **78 isolated node(s):** `ADR-0008`, `ADR-0008`, `ADR-0006`, `ADR-0006`, `ADR-0007` (+73 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1074 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Member` connect `FlowDrafts` to `LinkSocket`, `core/src/index.ts`, `db/src/index.ts`, `flow-drafts.ts`, `Shared conventions`, `server.test.ts`, `Contributing`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `deps()` (e.g. with `web/test/access.test.ts` and `github-access.test.ts`) actually correct?**
  _`deps()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0008`, `ADR-0008`, `ADR-0006` to the rest of the system?**
  _78 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `inspector.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09848484848484848 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `db/src/index.ts` to `inspector.ts`, `core/src/index.ts`, `doctor.ts`, `agent-install.ts`, `Agent node execution`, `node-file.ts`, `run-engine.ts`, `Agent main and CLI`, `Flow canvas geometry`, `icons.tsx`, `Node library UI`, `mask`, `machine-parts.tsx`, `Agent service install`, `Root tooling`, `flow-drafts.ts`, `pair.ts`, `core/src/index.ts`, `health.test.ts`, `build-flow.tsx`, `run.ts`, `markdown-text.tsx`, `server/github-access.ts`, `flow-editor-model.test.ts`, `bundle.mjs`, `server.test.ts`, `flows/page.tsx`, `server/machines.ts`, `human-form.tsx`, `db/src/human.ts`, `m1.test.ts`, `agent.ts`, `claude.ts`, `flow.ts`, `protocol.test.ts`, `Db`, `host-agent/tsconfig.json`, `M0 — Foundations`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Should `core/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06806526806526807 - nodes in this community are weakly interconnected._
- **Why does `Contributing` connect `Contributing` to `README.md`, `FlowDrafts`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._