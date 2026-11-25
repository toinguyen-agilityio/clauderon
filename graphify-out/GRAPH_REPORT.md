# Graph Report - clauderon  (2026-11-25)

## Corpus Check
- 398 files · ~315,450 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 4, .example 2, .cmd 1)

## Summary
- 3098 nodes · 7950 edges · 151 communities (138 shown, 13 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 226 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `60af6610`
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
- vitest
- machines/[id]/page.tsx
- check
- MachineLinks
- protocol/src/index.ts
- host-agent/package.json
- m1.test.ts
- db/src/machines.ts
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
- server/library.ts
- gateway/package.json
- server/runtime.ts
- server/github-access.ts
- services
- machines/actions.ts
- Clauderon — Requirements v1 (final)
- M1 — Walking skeleton
- doctor.ts
- envelope.ts
- server/flows.ts
- flow-node.tsx
- server/machines.ts
- run-flow-diagram.tsx
- flows/page.tsx
- Payload
- README.md
- server/runs.ts
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
- pairings.test.ts
- doctor-card.tsx
- Deploying Clauderon
- human-form.tsx
- runner.ts
- start.ts
- environment
- postgres
- web/test/m3.test.ts
- protocol/package.json
- tasks
- Agent
- library-list.tsx
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
- LinkSocket
- Clauderon
- Contributing
- run-live.tsx
- deps
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
- 3. Day by day
- CONTRIBUTING.md
- cloudflared
- Clauderon at a glance
- db/src/human.ts
- core/src/index.ts
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
- human.test.ts
- TurnRecorder
- AGENTS.md
- Clauderon docs
- machine-watch.ts
- The GitHub token is set on the Projects page, stored encrypted
- ticket-status.test.ts
- machine-link.ts
- disk.ts
- result
- getMachineOfMember
- web/test/inspector.test.ts
- import-nodes.tsx
- Run attachments reach the Machine through the Gateway, stored encrypted until delivered

## God Nodes (most connected - your core abstractions)
1. `deps()` - 103 edges
2. `requireMember()` - 78 edges
3. `vitest` - 63 edges
4. `next` - 58 edges
5. `react` - 54 edges
6. `Db` - 51 edges
7. `RunEngine` - 39 edges
8. `Icon` - 36 edges
9. `FlowEditor()` - 34 edges
10. `recordAudit()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Naming` --references--> `Member`  [INFERRED]
  docs/specs/README.md → packages/db/src/access.ts
- `11. Slices` --references--> `endMemberAccess()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/db/src/access.ts
- `10. Slices` --references--> `canConnect()`  [INFERRED]
  docs/specs/m2-flows-and-scheduling.md → packages/core/src/flow.ts
- `Places to change` --references--> `migrate()`  [INFERRED]
  docs/superpowers/specs/2026-11-20-contributing-conventions-design.md → packages/db/src/migrate.ts
- `4.2 Run engine (RUN-2, RUN-3, RUN-16)` --references--> `nextNode()`  [INFERRED]
  docs/specs/m1-walking-skeleton.md → packages/core/src/run.ts

## Import Cycles
- None detected.

## Communities (151 total, 13 thin omitted)

### Community 0 - "gateway/test/m3.test.ts"
Cohesion: 0.12
Nodes (24): inspectorOf(), withCalls(), BYTES_PER_TOKEN, contextSize(), EDITING_TOOLS, EXPLORING_CALLS, EXPLORING_TOOLS, Finding (+16 more)

### Community 1 - "src/access.ts"
Cohesion: 0.05
Nodes (75): sessionFor(), ADD_ERRORS, addEmail(), FormState, refresh(), removeMachineAction(), removeMemberAction(), runsOf() (+67 more)

### Community 2 - "RunEngine"
Cohesion: 0.12
Nodes (13): createGateway(), RunEngine, activeOutputs(), attachmentsOfRun(), getMachine(), finishAttempt(), getAttempt(), getRunContext() (+5 more)

### Community 3 - "agent-install.ts"
Cohesion: 0.06
Nodes (38): agent, doctor, env, home, nodeVersion, problems, report, server (+30 more)

### Community 4 - "fakes.ts"
Cohesion: 0.07
Nodes (15): EXEC_ARGS, ExecOptions, OutputListener, ProcessHandle, Signal, DIR, ExecCall, ExecReply (+7 more)

### Community 5 - "server/library.ts"
Cohesion: 0.18
Nodes (11): buildNodeFile(), fail(), isObject(), NODE_FILE_FORMAT, NODE_FILE_MAX_BYTES, NODE_FILE_VERSION, NodeFile, ParsedNodes (+3 more)

### Community 6 - "runs/[id]/page.tsx"
Cohesion: 0.16
Nodes (14): AuditPage(), detailText(), dynamic, Search, SUBJECT_LINK, FilterSelect(), Option, dynamic (+6 more)

### Community 7 - "host-agent/src/main.ts"
Cohesion: 0.09
Nodes (41): findBash(), localSystem(), agentBinDir(), ask(), [command = "run", ...args], doctorCommand(), doctorFor(), gatewayOf() (+33 more)

### Community 8 - "web/package.json"
Cohesion: 0.07
Nodes (39): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, next@^16.4.6, next-auth@5.0.0-beta.32, react@^19.3.1, react-dom@^19.3.1 (+31 more)

### Community 9 - "flow-canvas.tsx"
Cohesion: 0.12
Nodes (36): boundsOf(), centerOn(), clampZoom(), edgePath(), FAR_ZOOM, fitBounds(), intersects(), MAX_ZOOM (+28 more)

### Community 10 - "server/runs.ts"
Cohesion: 0.10
Nodes (20): env, if, runs-on, steps, GH_TOKEN, PR, PR_BODY, REPO (+12 more)

### Community 11 - "(app)/layout.tsx"
Cohesion: 0.12
Nodes (24): AccessDeniedPage(), dynamic, needsYouAction(), AppLayout(), dynamic, SignInPage(), DENIED_EMAIL_COOKIE, handlers (+16 more)

### Community 12 - "library-view.ts"
Cohesion: 0.19
Nodes (18): deleteNodeAction(), deleteBlocker(), INSTRUCTIONS_MAX, KIND_GROUPS, KIND_HELP, LibraryUse, NodeFormValue, plural() (+10 more)

### Community 13 - "vitest"
Cohesion: 0.09
Nodes (21): BrowserHubOptions, ADR-0008, open(), operators, answerWith(), setup(), flusher(), newGateway() (+13 more)

### Community 14 - "machines/[id]/page.tsx"
Cohesion: 0.15
Nodes (31): AutoRefresh(), ADR-0007, claudeAccountLabel(), defaultMachineName(), diskFree(), DiskStatus(), formatGb(), LoginChip() (+23 more)

### Community 15 - "check"
Cohesion: 0.08
Nodes (25): env, runs-on, services, steps, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, TEST_DATABASE_URL (+17 more)

### Community 17 - "protocol/src/index.ts"
Cohesion: 0.06
Nodes (42): ClaudeErrorWatch, draftClaudeCommand(), draftDir(), DraftRunnerOptions, registerDraftHandlers(), runDraft(), Running, ADR-0008 (+34 more)

### Community 18 - "host-agent/package.json"
Cohesion: 0.08
Nodes (30): dependencies, @clauderon/core@workspace:*, @clauderon/protocol@workspace:*, dockerode@^5.0.1, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, esbuild@0.28.2 (+22 more)

### Community 19 - "m1.test.ts"
Cohesion: 0.07
Nodes (12): SESSION_SECRET, setup(), hello, ADR-0007, keysFor(), startDialog(), startRuns(), planFlow() (+4 more)

### Community 20 - "db/src/machines.ts"
Cohesion: 0.07
Nodes (28): PAIRING_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_TTL_MS, ADR-0006, deleteMachine(), DeleteMachineResult, Machine, MACHINE_DEFAULT_SLOTS (+20 more)

### Community 21 - "service.ts"
Cohesion: 0.16
Nodes (25): Exec, installService(), launchdPath(), launchdPlist(), logFile(), SERVICE_LABEL, serviceArgs(), serviceInstalled() (+17 more)

### Community 22 - "react"
Cohesion: 0.08
Nodes (31): createFlowAction(), importFlowAction(), LeaveDialog(), ImportFlow(), NewFlow(), SettingsFormState, MACHINE_NAME_MAX, PairingPhase (+23 more)

### Community 23 - "package.json"
Cohesion: 0.07
Nodes (31): devDependencies, eslint@^10.15.0, tsx@^4.23.15, turbo@^2.11.11, @types/node@^26.6.6, typescript@~6.0.3, typescript-eslint@^8.72.2, vitest@^5.1.0 (+23 more)

### Community 24 - "flow-drafts.ts"
Cohesion: 0.13
Nodes (21): Draft, FlowDraftsOptions, Job, Purpose, ADR-0008, describeLibrary(), DraftLibraryNode, FLOW_DRAFT_MAX_DESCRIPTION (+13 more)

### Community 25 - "pair.ts"
Cohesion: 0.08
Nodes (25): buildId, bundle, dist, manifest, ADR-0007, root, versionMatch, attachmentDownloader() (+17 more)

### Community 26 - "FakeGitHub"
Cohesion: 0.10
Nodes (13): ApiIssue, ADR-0010, withCachedPullRequests(), pull(), setup(), GitHubReader, Issue, OpenPullRequest (+5 more)

### Community 27 - "flow-file.ts"
Cohesion: 0.15
Nodes (16): buildFlowFile(), ENTRY_KINDS, fail(), FATAL, FLOW_FILE_FORMAT, FLOW_FILE_VERSION, FlowToExport, isObject() (+8 more)

### Community 28 - "ref_node_path"
Cohesion: 0.11
Nodes (17): signalGroup(), ADR-0006, memberShell(), mergePaths(), parsePathOutput(), printPathCommand(), refreshToolPath(), shellPath() (+9 more)

### Community 29 - "build-flow.tsx"
Cohesion: 0.13
Nodes (17): BuildAvailability, Draft, DraftPreview(), EXAMPLES, Phase, ADR-0008, DraftEdge, DraftPlacement (+9 more)

### Community 30 - "db/package.json"
Cohesion: 0.09
Nodes (25): dependencies, @clauderon/core@workspace:*, drizzle-orm@^0.45.4, pg@^8.23.1, devDependencies, drizzle-kit@^0.31.11, @types/pg@^8.23.1, exports (+17 more)

### Community 31 - "run.ts"
Cohesion: 0.10
Nodes (26): 1. Starting point, 2. Architecture decisions, 3. Dependency graph and order, 6. Risks and edge cases, 8. Deployment order, 9. Progress log, M3 execution plan — People in the loop, Not covered here (+18 more)

### Community 32 - "run-engine.ts"
Cohesion: 0.07
Nodes (12): MachineBack, RunContext, RunEngineOptions, Sender, ADR-0006, ADR-0011, log(), ATTACHMENTS_MIN_AGENT (+4 more)

### Community 33 - "server/library.ts"
Cohesion: 0.18
Nodes (24): saveNodeAction(), copyName(), importMyFlow(), sameDefinition(), cloneMyNode(), CloneNodeOutcome, createMyNode(), Definition (+16 more)

### Community 34 - "gateway/package.json"
Cohesion: 0.10
Nodes (24): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, @types/ws@^8.18.2 (+16 more)

### Community 35 - "server/runtime.ts"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, incremental, jsx, lib, plugins, exclude, extends (+2 more)

### Community 36 - "server/github-access.ts"
Cohesion: 0.09
Nodes (40): ENABLE_ERRORS, enableAction(), EnableState, loadBranches(), loadRepositories(), removeProjectAction(), removeTokenAction(), saveTokenAction() (+32 more)

### Community 37 - "services"
Cohesion: 0.07
Nodes (31): databases, databaseName, ipAllowList, name, plan, postgresMajorVersion, region, user (+23 more)

### Community 38 - "machines/actions.ts"
Cohesion: 0.15
Nodes (21): approvePairingAction(), checkLoginsAction(), lookUpPairingAction(), MachineFormState, PairFormState, removeMachineAction(), setSettingsAction(), unpairAction() (+13 more)

### Community 39 - "Clauderon — Requirements v1 (final)"
Cohesion: 0.07
Nodes (30): 10. Glossary, 11. Related documents, 12. Next steps, 1. Overview, 2. Goals and success measures, 3. Scope, 4.1 Members and Projects, 4.2 Pods (+22 more)

### Community 40 - "M1 — Walking skeleton"
Cohesion: 0.08
Nodes (24): 1. Scope, 2.1 Create my Pod (POD-2), 2.2 Start and Stop (POD-6, part), 2.3 Pods page (POD-4), 2.4 Login checks (POD-5), 2.5 Web terminal (POD-9), 2. Pods, 3.1 Enable a Project (PRJ-1, PRJ-2) (+16 more)

### Community 41 - "doctor.ts"
Cohesion: 0.18
Nodes (9): AgentCheck, AgentManifest, doctorCheck, DoctorCheck, DoctorReport, doctorStatus, DoctorStatus, isLegacyAgentVersion() (+1 more)

### Community 42 - "envelope.ts"
Cohesion: 0.15
Nodes (13): doctorReport, envelopeShape, ParseResult, CONTROL_TYPES, ControlType, messageSchemas, MessageType, ADR-0006 (+5 more)

### Community 43 - "server/flows.ts"
Cohesion: 0.17
Nodes (9): add(), LiveHub, LogLine, send(), logChunksOf(), browserRequest, BrowserRequest, parseBrowserMessage() (+1 more)

### Community 44 - "flow-node.tsx"
Cohesion: 0.10
Nodes (27): CanvasHandle(), HandleType, FIcon, kindIcon(), stroke, acceptsWire(), KIND_LABEL, NodeAction (+19 more)

### Community 45 - "server/machines.ts"
Cohesion: 0.13
Nodes (23): approveMyPairing(), ApproveResult, canRemoveMachine(), lookUpPairing(), LookUpResult, MACHINE_NAME_MAX, MachineSettingsInput, MachineView (+15 more)

### Community 46 - "run-flow-diagram.tsx"
Cohesion: 0.17
Nodes (14): currentNodeId(), DiagramEdgeState, diagramEdgeStates(), diagramPositions(), DiagramState, diagramState(), nodeSize(), PILL (+6 more)

### Community 47 - "flows/page.tsx"
Cohesion: 0.18
Nodes (13): BuildFlow(), Composer(), FlowsTabs(), LibraryNodeView, dynamic, LibraryPage(), dynamic, FlowsPage() (+5 more)

### Community 48 - "Payload"
Cohesion: 0.20
Nodes (6): Clock, Envelope, Payload, FakeAgent, HelloOverrides, Responder

### Community 49 - "README.md"
Cohesion: 0.30
Nodes (3): Consequences, Considered Options, The Agent ships as one bundle with its own Node, and checks its Machine

### Community 50 - "server/runs.ts"
Cohesion: 0.05
Nodes (41): openRequest(), dynamic, PullRequestsPage(), Search, PullRequestTable(), selectable(), CancelOutcome, InspectedAttempt (+33 more)

### Community 51 - "flow-editor.tsx"
Cohesion: 0.07
Nodes (35): GRID, isTyping(), DEFAULT_NODE, Doc, FlowEditor(), GraphEdge, isMac(), LibraryAnchor (+27 more)

### Community 52 - "features/package.json"
Cohesion: 0.14
Nodes (14): dependencies, zod@^4.6.7, exports, zod, name, private, scripts, build:file (+6 more)

### Community 53 - "db/src/schema.ts"
Cohesion: 0.08
Nodes (46): saveFlowAction(), dynamic, FlowPage(), cleanGraph(), CloneFlowResult, createMyFlow(), Definition, DeleteFlowOutcome (+38 more)

### Community 54 - "testing/package.json"
Cohesion: 0.13
Nodes (18): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, drizzle-orm@^0.45.4, exports, @clauderon/core, @clauderon/db (+10 more)

### Community 55 - "build.ts"
Cohesion: 0.11
Nodes (26): config, rootEnv, buildFeatures(), MAP_PATH, OUTPUT_PATH, read(), renderFeatures(), out (+18 more)

### Community 56 - "deploy.sh"
Cohesion: 0.29
Nodes (16): compose(), die(), down(), env_get(), env_set(), init_env(), preflight(), say() (+8 more)

### Community 57 - "db/src/schema.ts"
Cohesion: 0.04
Nodes (52): AttachmentInfo, key(), markAttachmentsDelivered(), NewAttachment, openAttachment(), sealAttachment(), SealedAttachment, sha256Hex() (+44 more)

### Community 58 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution (+9 more)

### Community 59 - "core/src/index.ts"
Cohesion: 0.07
Nodes (17): Gateway, GatewayOptions, LOG_RETENTION_DAYS, LogRetention, LogRetentionOptions, HEARTBEAT_TIMEOUT_MS, MachineWatchOptions, databaseUrl (+9 more)

### Community 60 - "steps"
Cohesion: 0.10
Nodes (19): runs-on, steps, strategy, jobs, agent, os, name, on (+11 more)

### Community 61 - "flows-list.tsx"
Cohesion: 0.23
Nodes (14): EMPTY, FlowCard(), FlowsList(), SCOPES, Steps(), filterFlows(), FlowRowView, FlowScope (+6 more)

### Community 62 - "pairings.test.ts"
Cohesion: 0.08
Nodes (28): handleAttachments(), json(), ADR-0011, handlePairing(), json(), PairingHttpOptions, readBody(), ADR-0006 (+20 more)

### Community 63 - "doctor-card.tsx"
Cohesion: 0.31
Nodes (7): CmdBox(), DoctorCard(), DOT, looksLikeCommand(), ORDER, ADR-0007, MachineDoctor

### Community 64 - "Deploying Clauderon"
Cohesion: 0.11
Nodes (18): 1. Prepare the machine (once), 2. Outside accounts (once), 3. Configure, 4. Start the stack, 5. Publish with a Cloudflare Tunnel, 6. Members pair their Machines, 7. Backups, Demo on Render (+10 more)

### Community 65 - "human-form.tsx"
Cohesion: 0.25
Nodes (9): respondAction(), RespondFormState, Choices(), HumanForm(), OpenRequest, Question, answersFromForm(), OTHER_CHOICE (+1 more)

### Community 66 - "runner.ts"
Cohesion: 0.09
Nodes (30): claudeResult(), 5. Testing strategy, ApproveSubject, buildGrillAnswerPrompt(), checkAnswers(), FEEDBACK_HEADING, GrillAnswers, GrillOption (+22 more)

### Community 67 - "start.ts"
Cohesion: 0.05
Nodes (61): exportFlowAction(), flowActionAction(), FlowFormState, loadFlowStartAction(), loadFlowStartChoicesAction(), startFromInputAction(), FlowRowActions(), deleteRunsNote() (+53 more)

### Community 68 - "environment"
Cohesion: 0.20
Nodes (12): AUTH_URL, DATABASE_URL, GATEWAY_PORT, GATEWAY_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPERATOR_EMAILS, SESSION_SECRET (+4 more)

### Community 69 - "postgres"
Cohesion: 0.15
Nodes (12): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, name, environment, image, ports, volumes (+4 more)

### Community 70 - "web/test/m3.test.ts"
Cohesion: 0.15
Nodes (30): attemptId(), nodeStates(), Script, setup(), AppDeps, cloneMyFlow(), deleteMyFlow(), cloneOf() (+22 more)

### Community 71 - "protocol/package.json"
Cohesion: 0.17
Nodes (12): dependencies, zod@^4.6.7, exports, zod, name, private, scripts, lint (+4 more)

### Community 72 - "tasks"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+4 more)

### Community 73 - "Agent"
Cohesion: 0.17
Nodes (4): Agent, parseEnvelope(), isMessageType(), ResumeBuffer

### Community 74 - "library-list.tsx"
Cohesion: 0.24
Nodes (15): cloneNodeAction(), exportNodesAction(), LibraryList(), NodeCard(), NodeDialog(), emptyText(), filterNodes(), groupCounts() (+7 more)

### Community 75 - "FlowDrafts"
Cohesion: 0.29
Nodes (4): FlowDrafts, sendEvent(), Member, BrowserEvent

### Community 76 - "compose.yml"
Cohesion: 0.14
Nodes (13): content, configs, cloudflared, name, name, services, volumes, pgdata (+5 more)

### Community 77 - "src/runs.ts"
Cohesion: 0.09
Nodes (27): viewRun(), retryLogLines(), tailLines(), snapshotFlow(), activeRun(), Attempt, AttemptEnd, attemptsOfRun() (+19 more)

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
Cohesion: 0.22
Nodes (6): MachineService, MachineServiceOptions, ADR-0006, ADR-0007, applyMachineDoctor(), applyMachineLogins()

### Community 83 - "M4 — Refinement and release"
Cohesion: 0.12
Nodes (17): 1. Scope, 2.1 Diff (TRK-3), 2.2 Usage (TRK-4), 2.3 Artifact (TRK-5), 2.4 Batch page (TRK-6), 2.5 Ticket detail (TIC-4), 2. Tracking, 3. Machines (replaces Pods) (+9 more)

### Community 84 - "handlers.test.ts"
Cohesion: 0.15
Nodes (16): byteSize(), CLAUDE_ARGS, claudeCommand(), ClaudeEvent, Content, firstLine(), inputTokens(), ModelUsage (+8 more)

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
Cohesion: 0.11
Nodes (32): startTestRun(), 10. Acceptance tests, 3. Canvas editor (FLW-3 … FLW-6), byCanvas(), canConnect(), compare(), ConnectResult, cycleEdges() (+24 more)

### Community 92 - "LinkSocket"
Cohesion: 0.20
Nodes (5): BrowserHub, controlMessage(), serialize(), LinkSocket, WsLike

### Community 93 - "Clauderon"
Cohesion: 0.12
Nodes (17): Architecture, Clauderon, Contributing, Development commands, Development (`.env`), Documentation, Environment variables, How it works (+9 more)

### Community 94 - "Contributing"
Cohesion: 0.20
Nodes (10): Branches, Commits, Configuration and secrets, Contributing, Pull requests, Release notes, Releases, Repo graph for Claude (+2 more)

### Community 95 - "run-live.tsx"
Cohesion: 0.08
Nodes (45): DISK_ADVICE, dynamic, NeedsYouPage(), retryRunAction(), CancelRun(), Attempt, callLabel(), Inspected (+37 more)

### Community 96 - "deps"
Cohesion: 0.12
Nodes (25): dynamic, POST(), ADR-0011, dynamic, GET(), CancelFormState, cancelRunAction(), RetryFormState (+17 more)

### Community 97 - "protocol.test.ts"
Cohesion: 0.43
Nodes (5): createGatewayTicket(), GATEWAY_TICKET_SECONDS, sign(), verifyGatewayTicket(), hello

### Community 103 - "ListSkeleton"
Cohesion: 0.60
Nodes (3): Loading(), Loading(), ListSkeleton()

### Community 104 - "M2 — Flows and scheduling"
Cohesion: 0.12
Nodes (16): 10. Slices, 1. Scope, 2. Flows page, 4. Node library (FLW-1, FLW-9, FLW-10), 5. Flow edit lock (FLW-7), 6. Slots, limits and the queue (POD-2, POD-3, POD-6), 7. Dry-run (removed), 8. Second Member (A6) (+8 more)

### Community 105 - "Flow Drafts run Claude Code on the Member's Machine, outside any Run"
Cohesion: 0.50
Nodes (3): Consequences, Considered Options, Flow Drafts run Claude Code on the Member's Machine, outside any Run

### Community 106 - "The whole app is self-hosted on the Pod Host and reached over Tailscale"
Cohesion: 0.40
Nodes (4): labels, title, changelog, categories

### Community 107 - "db/test/access.test.ts"
Cohesion: 0.09
Nodes (26): ADR-0004, endMemberAccess(), removeAllowlistEntry(), handle, connect(), Db, CommandPublish, GATEWAY_COMMAND_CHANNEL (+18 more)

### Community 108 - "3. Day by day"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 109 - "M3 — People in the loop"
Cohesion: 0.15
Nodes (13): 10. Slices, 1. Scope, 2.1 Approve (FLW-2, RUN-4, RUN-6), 2.2 Grill (FLW-2, RUN-10), 2. Human Nodes, 3. Needs you (RUN-5, MEM-2), 4. Retry (RUN-7, RUN-9), 5. Cancel (RUN-8) (+5 more)

### Community 111 - "3. Day by day"
Cohesion: 0.15
Nodes (13): 1. At a glance, 2. Before Day 1, 3. Day by day, 4. How the team works with AI agents, 6. Definition of done, Clauderon v1 — seven-day roadmap, Day 1 — Foundations (M0), Day 2 — Pods and Tickets (M1) (+5 more)

### Community 112 - "CONTRIBUTING.md"
Cohesion: 0.13
Nodes (8): Releases and the repo graph, Updating tickets after a PR merge, What runs by itself, Triage Labels, Change, Notes, Test plan, Why

### Community 113 - "cloudflared"
Cohesion: 0.17
Nodes (12): command, configs, depends_on, environment, image, restart, source, target (+4 more)

### Community 114 - "Clauderon at a glance"
Cohesion: 0.17
Nodes (12): Architecture in brief, Clauderon at a glance, Decisions we need from leads, How it works, How we will know it works, In one sentence, Learn more, Roadmap (+4 more)

### Community 115 - "db/src/human.ts"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 116 - "core/src/index.ts"
Cohesion: 0.14
Nodes (25): enableableRepositories(), EnableRepositoryResult, lastAttempt, mapLimit(), pullFromGitHub(), refreshPullRequest(), syncAllProjects(), SyncResult (+17 more)

### Community 117 - "Clauderon"
Cohesion: 0.22
Nodes (9): Agent skills, Architecture, Clauderon, Commands, Contributing, Domain docs, Issue tracker, Next.js (+1 more)

### Community 118 - "tickets/page.tsx"
Cohesion: 0.12
Nodes (23): loadStartDialog(), startAction(), syncTicketsAction(), dynamic, Search, TicketsPage(), VIEWS, FilterLink() (+15 more)

### Community 119 - "DESIGN.md"
Cohesion: 0.20
Nodes (9): Colors, Components, Do's and Don'ts, Elevation & Depth, Layout, Overview, Shapes, Theme (+1 more)

### Community 120 - "M0 — Foundations"
Cohesion: 0.14
Nodes (14): 11. Slices, 1. Scope, 2. Configuration, 5.1 Flow validator (FLW-4, FLW-5, A3), 5.2 Run state machine (RUN-2 … RUN-9, RUN-16), 5.3 Slot scheduler (POD-3), 5.4 Ticket Status (TIC-6), 5.5 Masking (NFR-1) (+6 more)

### Community 121 - "Shared conventions"
Cohesion: 0.25
Nodes (8): Clauderon v1 — milestone specs, Definition of done for every slice, Naming, Repository layout, Requirement coverage, Shared conventions, Slices, The test seam (spec Q1)

### Community 122 - "Contributing guide and team conventions (design)"
Cohesion: 0.20
Nodes (9): Approaches, Branch flow and repo graph (decided), Contributing guide and team conventions (design), Convention (my proposals, to be reviewed), Goals, Intent, Left to the builder, Non-goals / anti-goals (+1 more)

### Community 123 - "core/src/human.ts"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 124 - "Issue tracker: GitHub"
Cohesion: 0.25
Nodes (7): Conventions, How v1 work is organised, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 125 - "Language"
Cohesion: 0.29
Nodes (7): Clauderon, Execution, Flows, Language, People, Runs, Work

### Community 126 - "isActive"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 127 - ".scheduleNow"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 128 - "Log a bug"
Cohesion: 0.33
Nodes (5): Body, File it, Log a bug, Rules, Title

### Community 129 - "logins.ts"
Cohesion: 0.14
Nodes (20): CLOCK_SKEW_MS, DoctorInput, firstLine(), fixFor(), Platform, runDoctor(), ADR-0007, detached() (+12 more)

### Community 130 - "Domain Docs"
Cohesion: 0.40
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 131 - "Spike M0-02: Claude Code headless in the Pod image"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 132 - "tickets.ts"
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

### Community 137 - "human.test.ts"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Each Member runs on their own Machine, paired to a public app

### Community 138 - "TurnRecorder"
Cohesion: 0.27
Nodes (6): TurnRecorder, assistant(), line(), record(), usage(), Turn

### Community 143 - "ticket-status.test.ts"
Cohesion: 0.22
Nodes (10): stream(), flow(), 3. Database schema, 4.1 Envelope and resuming, 4.2 Messages, 4. Host Agent protocol, RunForStatus, at() (+2 more)

### Community 144 - "machine-link.ts"
Cohesion: 0.20
Nodes (9): Handler, HeartbeatListener, HelloListener, Link, MachineLinksOptions, ADR-0006, recordMachineConnected(), recordMachineHeartbeat() (+1 more)

### Community 145 - "disk.ts"
Cohesion: 0.38
Nodes (5): DiskFree, CRITICAL_DISK_GB, DiskState, diskState(), LOW_DISK_GB

### Community 146 - "result"
Cohesion: 0.25
Nodes (7): result(), 5. Risks and what to cut, 6. Agent result contract (RUN-10), Findings, Goal, Spike M0-02: Claude Code headless in the Pod image, Steps

### Community 147 - "getMachineOfMember"
Cohesion: 0.60
Nodes (5): FlowBuildAvailability, flowBuildAvailability(), agentSupportsFlowDrafts(), isMachineReady(), getMachineOfMember()

### Community 149 - "import-nodes.tsx"
Cohesion: 0.83
Nodes (3): importNodesAction(), ImportNodes(), importSummary()

## Knowledge Gaps
- **93 isolated node(s):** `ADR-0011`, `ADR-0010`, `ADR-0011`, `ADR-0006`, `ADR-0011` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1171 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `gateway/test/m3.test.ts`, `src/access.ts`, `agent-install.ts`, `fakes.ts`, `server/library.ts`, `host-agent/src/main.ts`, `flow-canvas.tsx`, `TurnRecorder`, `(app)/layout.tsx`, `library-view.ts`, `machines/[id]/page.tsx`, `ticket-status.test.ts`, `disk.ts`, `protocol/src/index.ts`, `m1.test.ts`, `web/test/inspector.test.ts`, `service.ts`, `package.json`, `flow-drafts.ts`, `pair.ts`, `FakeGitHub`, `flow-file.ts`, `ref_node_path`, `build-flow.tsx`, `run.ts`, `server/library.ts`, `run-flow-diagram.tsx`, `flow-editor.tsx`, `build.ts`, `flows-list.tsx`, `pairings.test.ts`, `human-form.tsx`, `runner.ts`, `start.ts`, `web/test/m3.test.ts`, `src/library.ts`, `run-live.tsx`, `protocol.test.ts`, `M2 — Flows and scheduling`, `db/test/access.test.ts`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `deps()` (e.g. with `web/test/access.test.ts` and `github-access.test.ts`) actually correct?**
  _`deps()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0011`, `ADR-0010`, `ADR-0011` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `gateway/test/m3.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11904761904761904 - nodes in this community are weakly interconnected._
- **Why does `Member` connect `FlowDrafts` to `src/access.ts`, `vitest`, `flow-drafts.ts`, `Shared conventions`, `LinkSocket`, `Contributing`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `src/access.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05185779203421545 - nodes in this community are weakly interconnected._
- **Why does `Contributing` connect `Contributing` to `CONTRIBUTING.md`, `FlowDrafts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._