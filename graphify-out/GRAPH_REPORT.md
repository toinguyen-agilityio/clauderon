# Graph Report - clauderon  (2026-11-20)

## Corpus Check
- 315 files · ~220,248 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .example 2, .css 1)

## Summary
- 2083 nodes · 5614 edges · 103 communities (94 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 121 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Gateway tests
- Web auth and access
- Run engine
- Agent smoke and doctor
- Agent node execution
- Flow list actions
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
- Human nodes (core)
- Run engine types
- Agent service install
- Flow editor
- Root tooling
- Browser hub
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 100
- Community 101
- Community 102

## God Nodes (most connected - your core abstractions)
1. `deps()` - 83 edges
2. `requireMember()` - 64 edges
3. `next` - 48 edges
4. `vitest` - 46 edges
5. `Db` - 43 edges
6. `RunEngine` - 37 edges
7. `react` - 37 edges
8. `Payload` - 36 edges
9. `FlowEditor()` - 30 edges
10. `recordAudit()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `LogRetention` --references--> `TimerHandle`  [EXTRACTED]
  apps/gateway/src/log-retention.ts → packages/core/src/clock.ts
- `createGatewayServer()` --calls--> `fromWebSocket()`  [EXTRACTED]
  apps/gateway/src/server.ts → packages/protocol/src/socket.ts
- `flusher()` --calls--> `settle()`  [EXTRACTED]
  apps/gateway/test/harness.ts → packages/testing/src/fake-clock.ts
- `startGateway()` --calls--> `FakeAgent`  [EXTRACTED]
  apps/gateway/test/harness.ts → packages/testing/src/fake-agent.ts
- `startGateway()` --calls--> `FakeClock`  [EXTRACTED]
  apps/gateway/test/harness.ts → packages/testing/src/fake-clock.ts

## Import Cycles
- None detected.

## Communities (103 total, 9 thin omitted)

### Community 0 - "Gateway tests"
Cohesion: 0.13
Nodes (34): attemptId(), nodeStates(), Script, scriptPlanAndDeliver(), setup(), setup(), succeedEverything(), cancelRunAs() (+26 more)

### Community 1 - "Web auth and access"
Cohesion: 0.09
Nodes (39): sessionFor(), checkGoogleSignIn(), clauderonAdapter(), orNull(), toUser(), member(), operators, signInWithCookie() (+31 more)

### Community 2 - "Run engine"
Cohesion: 0.13
Nodes (14): createGateway(), RunEngine, activeOutputs(), checkAgentResult(), commandOutputs(), SnapshotNode, askHuman(), finishAttempt() (+6 more)

### Community 3 - "Agent smoke and doctor"
Cohesion: 0.07
Nodes (34): agent, doctor, env, home, nodeVersion, problems, report, server (+26 more)

### Community 4 - "Agent node execution"
Cohesion: 0.08
Nodes (16): pidFile(), registerNodeHandlers(), terminate(), EXEC_ARGS, ExecOptions, OutputListener, ProcessHandle, Signal (+8 more)

### Community 5 - "Flow list actions"
Cohesion: 0.11
Nodes (35): exportFlowAction(), flowActionAction(), FlowFormState, FlowRowActions(), AppDeps, Viewer, cleanGraph(), CloneFlowResult (+27 more)

### Community 6 - "Needs-you and run pages"
Cohesion: 0.11
Nodes (34): dynamic, NeedsYouPage(), FilterSelect(), Option, dynamic, RunPage(), Stat(), classify() (+26 more)

### Community 7 - "Agent main and CLI"
Cohesion: 0.10
Nodes (34): findBash(), agentBinDir(), ask(), [command = "run", ...args], doctorCommand(), doctorFor(), gatewayOf(), log() (+26 more)

### Community 8 - "Web dependencies"
Cohesion: 0.07
Nodes (39): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, next@^16.4.6, next-auth@5.0.0-beta.32, react@^19.3.1, react-dom@^19.3.1 (+31 more)

### Community 9 - "Flow canvas geometry"
Cohesion: 0.12
Nodes (37): boundsOf(), centerOn(), clampZoom(), edgePath(), FAR_ZOOM, fitBounds(), intersects(), MAX_ZOOM (+29 more)

### Community 10 - "Run views (web server)"
Cohesion: 0.10
Nodes (37): openRequest(), viewMachine(), viewMachines(), CancelOutcome, isUuid(), NeedsYouItem, NodeState, parseRunFilters() (+29 more)

### Community 11 - "App layout and sign-in"
Cohesion: 0.09
Nodes (26): AccessDeniedPage(), dynamic, AppLayout(), inter, jetbrains, metadata, outfit, dynamic (+18 more)

### Community 12 - "Node library UI"
Cohesion: 0.12
Nodes (33): cloneNodeAction(), deleteNodeAction(), KIND_MARK, LibraryList(), NodeCard(), NodeDialog(), Port, PortChips() (+25 more)

### Community 13 - "Flow and project actions"
Cohesion: 0.15
Nodes (26): saveFlowAction(), dynamic, FlowPage(), ENABLE_ERRORS, enableAction(), EnableState, loadBranches(), loadRepositories() (+18 more)

### Community 14 - "Machine page widgets"
Cohesion: 0.15
Nodes (26): AutoRefresh(), CmdBox(), DoctorCard(), DOT, looksLikeCommand(), ORDER, ADR-0007, ADR-0007 (+18 more)

### Community 15 - "CI workflow"
Cohesion: 0.07
Nodes (32): runs-on, steps, strategy, env, runs-on, services, steps, POSTGRES_DB (+24 more)

### Community 16 - "Machine links (gateway)"
Cohesion: 0.11
Nodes (14): Handler, HeartbeatListener, HelloListener, Link, MachineLinks, MachineLinksOptions, ADR-0006, markAllMachinesDisconnected() (+6 more)

### Community 17 - "Claude CLI wrapper"
Cohesion: 0.10
Nodes (24): CLAUDE_ARGS, claudeCommand(), ClaudeErrorWatch, ClaudeEvent, claudeResult(), Content, firstLine(), inputTokens() (+16 more)

### Community 18 - "Host-agent dependencies"
Cohesion: 0.08
Nodes (30): dependencies, @clauderon/core@workspace:*, @clauderon/protocol@workspace:*, dockerode@^5.0.1, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, esbuild@0.28.2 (+22 more)

### Community 19 - "Human nodes (core)"
Cohesion: 0.09
Nodes (27): ApproveSubject, buildGrillAnswerPrompt(), checkAnswers(), FEEDBACK_HEADING, GrillAnswers, GrillOption, GrillQuestion, HumanResponse (+19 more)

### Community 20 - "Run engine types"
Cohesion: 0.09
Nodes (26): MachineBack, RunContext, RunEngineOptions, Sender, ADR-0006, log(), OutputValue, fake() (+18 more)

### Community 21 - "Agent service install"
Cohesion: 0.14
Nodes (25): installCommand(), Exec, installService(), launchdPath(), launchdPlist(), logFile(), SERVICE_LABEL, serviceArgs() (+17 more)

### Community 22 - "Flow editor"
Cohesion: 0.10
Nodes (26): GRID, CanvasConnection, isTyping(), DEFAULT_NODE, Doc, FlowEditor(), GraphEdge, isMac() (+18 more)

### Community 23 - "Root tooling"
Cohesion: 0.08
Nodes (28): devDependencies, eslint@^10.15.0, tsx@^4.23.15, turbo@^2.11.11, @types/node@^26.6.6, typescript@~6.0.3, typescript-eslint@^8.72.2, vitest@^5.1.0 (+20 more)

### Community 24 - "Browser hub"
Cohesion: 0.13
Nodes (13): BrowserHubOptions, open(), operators, connect(), flush(), waitFor(), TimerHandle, CloseCode (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.10
Nodes (23): checkGateway(), GatewayCheck, skew(), ADR-0007, httpBase(), pair(), PAIR_POLL_MS, Paired (+15 more)

### Community 26 - "Community 26"
Cohesion: 0.12
Nodes (9): ApiIssue, request(), GitHubError, GitHubReader, Issue, PullRequest, Repository, FakeGitHub (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.10
Nodes (22): buildFlowFile(), fail(), FATAL, FLOW_FILE_FORMAT, FLOW_FILE_MAX_BYTES, FLOW_FILE_VERSION, FlowFile, FlowToExport (+14 more)

### Community 28 - "Community 28"
Cohesion: 0.09
Nodes (14): buildId, bundle, dist, manifest, ADR-0007, root, versionMatch, localSystem() (+6 more)

### Community 29 - "Community 29"
Cohesion: 0.17
Nodes (19): PendingLeave, CancelFormState, cancelRunAction(), RetryFormState, retryRunAction(), CancelRun(), Input, RetryFromHere() (+11 more)

### Community 30 - "Community 30"
Cohesion: 0.08
Nodes (26): dependencies, @clauderon/core@workspace:*, drizzle-orm@^0.45.4, pg@^8.23.1, devDependencies, drizzle-kit@^0.31.11, @types/pg@^8.23.1, exports (+18 more)

### Community 31 - "Community 31"
Cohesion: 0.13
Nodes (22): Flow, FlowNode, validateFlow(), AttemptState, AttemptView, holdsSlot(), MachineForSchedule, MOVES (+14 more)

### Community 32 - "Community 32"
Cohesion: 0.14
Nodes (19): AgentLink, detached(), errorText(), Log, checkClaude(), checkLogins(), CLAUDE_STATUS_SCRIPT, ClaudeLogin (+11 more)

### Community 33 - "Community 33"
Cohesion: 0.14
Nodes (22): byCanvas(), compare(), ConnectResult, cycleEdges(), FlowEdge, groupOutgoing(), LibraryNode, NODE_KINDS (+14 more)

### Community 34 - "Community 34"
Cohesion: 0.10
Nodes (24): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, @types/ws@^8.18.2 (+16 more)

### Community 35 - "Community 35"
Cohesion: 0.13
Nodes (18): dynamic, GET(), dynamic, GET(), ADR-0006, AccessDeps, GoogleSignIn, memberFromCookies() (+10 more)

### Community 36 - "Community 36"
Cohesion: 0.15
Nodes (23): removeMachineAction(), ADD_ERRORS, addEmail(), refresh(), removeMachineAction(), removeMemberAction(), runsOf(), addToAllowlist() (+15 more)

### Community 37 - "Community 37"
Cohesion: 0.10
Nodes (12): BrowserHub, databaseUrl, { db }, gateway, port, sessionSecret, createGatewayServer(), GatewayServerOptions (+4 more)

### Community 38 - "Community 38"
Cohesion: 0.14
Nodes (22): EnableRepositoryResult, refreshPullRequest(), syncProject(), SyncResult, enableProject(), EnableResult, getProject(), openTicketsMissingFrom() (+14 more)

### Community 39 - "Community 39"
Cohesion: 0.10
Nodes (19): buildFlowSnapshot(), DeleteFlowResult, FlowGraphInput, FlowListRow, FlowLock, ImportFlowPlan, isOutputType(), PlacementInput (+11 more)

### Community 40 - "Community 40"
Cohesion: 0.14
Nodes (14): Gateway, GatewayOptions, HEARTBEAT_TIMEOUT_MS, MachineWatchOptions, MachineService, MachineServiceOptions, ADR-0006, ADR-0007 (+6 more)

### Community 41 - "Community 41"
Cohesion: 0.12
Nodes (18): CLOCK_SKEW_MS, DoctorInput, firstLine(), fixFor(), LOW_DISK_GB, Platform, runDoctor(), ADR-0007 (+10 more)

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (13): FakeLink, doctorReport, envelopeShape, ParseResult, CONTROL_TYPES, ControlType, messageSchemas, MessageType (+5 more)

### Community 43 - "Community 43"
Cohesion: 0.16
Nodes (16): importFlowAction(), FlowsTabs(), ImportFlow(), dynamic, LibraryPage(), dynamic, FlowsPage(), dynamic (+8 more)

### Community 44 - "Community 44"
Cohesion: 0.19
Nodes (17): CanvasHandle(), HandleType, FIcon, kindIcon(), stroke, acceptsWire(), KIND_LABEL, NodeAction (+9 more)

### Community 45 - "Community 45"
Cohesion: 0.23
Nodes (19): saveNodeAction(), copyName(), cloneMyNode(), CloneNodeOutcome, createMyNode(), deleteMyNode(), LibraryInput, NodeOutcome (+11 more)

### Community 46 - "Community 46"
Cohesion: 0.12
Nodes (19): approveMyPairing(), normalizePairingCode(), PAIRING_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_TTL_MS, ADR-0006, Machine, MACHINE_DEFAULT_SLOTS (+11 more)

### Community 47 - "Community 47"
Cohesion: 0.17
Nodes (17): handlePairing(), json(), PairingHttpOptions, readBody(), ADR-0006, ADR-0007, pendingCode(), hashToken() (+9 more)

### Community 48 - "Community 48"
Cohesion: 0.22
Nodes (4): Envelope, serialize(), ResumeBuffer, hello

### Community 49 - "Community 49"
Cohesion: 0.18
Nodes (17): approvePairingAction(), checkLoginsAction(), lookUpPairingAction(), MachineFormState, PairFormState, unpairAction(), CheckLogins(), Confirmed() (+9 more)

### Community 50 - "Community 50"
Cohesion: 0.17
Nodes (12): loadStartDialog(), startAction(), dynamic, Search, STATUSES, TicketsPage(), Dialog, selectable() (+4 more)

### Community 51 - "Community 51"
Cohesion: 0.16
Nodes (14): layeredLayout(), LAYOUT_GAP_X, LAYOUT_GAP_Y, LayoutEdge, LayoutNode, advanceTestRun(), edgeStates(), nodeStates() (+6 more)

### Community 52 - "Community 52"
Cohesion: 0.18
Nodes (16): viewProjects(), asPrState(), TicketFilters, TicketRow, viewTickets(), isActive(), RunState, ACTIVE_STATUS (+8 more)

### Community 53 - "Community 53"
Cohesion: 0.11
Nodes (15): artifact, attemptState, batch, humanRequestKind, logChunk, logStream, NodeInputJson, nodeKind (+7 more)

### Community 54 - "Community 54"
Cohesion: 0.13
Nodes (18): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, drizzle-orm@^0.45.4, exports, @clauderon/core, @clauderon/db (+10 more)

### Community 55 - "Community 55"
Cohesion: 0.19
Nodes (14): memberShell(), mergePaths(), parsePathOutput(), printPathCommand(), refreshToolPath(), shellPath(), ADR-0007, latestAgent() (+6 more)

### Community 56 - "Community 56"
Cohesion: 0.29
Nodes (17): compose(), die(), down(), env_get(), env_set(), gateway_port(), init_env(), preflight() (+9 more)

### Community 57 - "Community 57"
Cohesion: 0.19
Nodes (12): ADR-0004, handle, connect(), Db, DbHandle, CommandPublish, GATEWAY_COMMAND_CHANNEL, listenGatewayCommands() (+4 more)

### Community 58 - "Community 58"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution (+9 more)

### Community 59 - "Community 59"
Cohesion: 0.19
Nodes (9): add(), LiveHub, LogLine, send(), logChunksOf(), BrowserEvent, browserRequest, BrowserRequest (+1 more)

### Community 60 - "Community 60"
Cohesion: 0.14
Nodes (14): applyMachineLogins(), DeleteMachineResult, MachineFacts, MachineLogins, MachineRow, MachineRun, MachineRunCounts, machineRunsIn() (+6 more)

### Community 61 - "Community 61"
Cohesion: 0.29
Nodes (13): EMPTY, FlowCard(), FlowsList(), Pipeline(), SCOPES, filterFlows(), FlowRowView, FlowScope (+5 more)

### Community 62 - "Community 62"
Cohesion: 0.23
Nodes (15): keysFor(), startableFlows(), startDialog(), StartInput, StartResult, startRuns(), TRUSTED, queuePositions() (+7 more)

### Community 63 - "Community 63"
Cohesion: 0.19
Nodes (4): Connector, FakeGateway, controlMessage(), MemorySocket

### Community 64 - "Community 64"
Cohesion: 0.25
Nodes (12): ConfirmState, FormState, AddEmailForm(), Confirm(), ConfirmProps, RemoveMachine(), RemoveMember(), dynamic (+4 more)

### Community 65 - "Community 65"
Cohesion: 0.26
Nodes (9): respondAction(), RespondFormState, Choices(), HumanForm(), OpenRequest, Question, answersFromForm(), OTHER_CHOICE (+1 more)

### Community 66 - "Community 66"
Cohesion: 0.19
Nodes (12): renderRetryContext(), RetryContext, BranchFacts, branchName(), buildAgentPrompt(), CheckResult, CommandFacts, PromptInput (+4 more)

### Community 67 - "Community 67"
Cohesion: 0.19
Nodes (10): setSettingsAction(), SettingsFormState, MACHINE_NAME_MAX, MachineSettings(), setMyMachineSettings(), checkSlots(), MAX_SLOTS, SlotsCheck (+2 more)

### Community 68 - "Community 68"
Cohesion: 0.19
Nodes (13): AUTH_URL, DATABASE_URL, GATEWAY_PORT, GATEWAY_URL, GITHUB_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPERATOR_EMAILS (+5 more)

### Community 69 - "Community 69"
Cohesion: 0.15
Nodes (12): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, name, environment, image, ports, volumes (+4 more)

### Community 70 - "Community 70"
Cohesion: 0.23
Nodes (4): Clock, FakeAgent, HelloOverrides, Responder

### Community 71 - "Community 71"
Cohesion: 0.17
Nodes (12): dependencies, zod@^4.6.7, exports, name, private, scripts, lint, test (+4 more)

### Community 72 - "Community 72"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+4 more)

### Community 74 - "Community 74"
Cohesion: 0.18
Nodes (10): ApproveResult, LookUpResult, MACHINE_NAME_MAX, MachineSettingsInput, MachineView, QueueEntry, RemoveResult, SettingsResult (+2 more)

### Community 75 - "Community 75"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, incremental, jsx, lib, plugins, exclude, extends (+2 more)

### Community 76 - "Community 76"
Cohesion: 0.18
Nodes (10): name, name, services, volumes, pgdata, x-app-env, DATABASE_URL, GITHUB_TOKEN (+2 more)

### Community 77 - "Community 77"
Cohesion: 0.24
Nodes (4): LOG_RETENTION_DAYS, LogRetention, LogRetentionOptions, deleteLogChunksBefore()

### Community 78 - "Community 78"
Cohesion: 0.20
Nodes (9): exports, name, private, scripts, lint, test, typecheck, type (+1 more)

### Community 80 - "Community 80"
Cohesion: 0.22
Nodes (8): AgentOptions, BACKOFF_CAP_MS, BACKOFF_START_MS, Handler, HEARTBEAT_MS, MachineFacts, MachineFactsReader, ADR-0006

### Community 81 - "Community 81"
Cohesion: 0.25
Nodes (8): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, environment, image, restart, volumes, postgres

### Community 84 - "Community 84"
Cohesion: 0.38
Nodes (6): AuditPage(), detailText(), dynamic, Search, SUBJECT_LINK, viewAudit()

### Community 85 - "Community 85"
Cohesion: 0.29
Nodes (7): gateway, condition, web, depends_on, image, ports, restart

### Community 86 - "Community 86"
Cohesion: 0.29
Nodes (7): migrate, depends_on, image, ports, restart, condition, gateway

### Community 87 - "Community 87"
Cohesion: 0.67
Nodes (5): backup(), compose(), install_agent(), restore(), backup.sh script

### Community 88 - "Community 88"
Cohesion: 0.33
Nodes (6): postgres, command, depends_on, image, condition, migrate

### Community 89 - "Community 89"
Cohesion: 0.53
Nodes (6): healthcheck, interval, retries, test, timeout, healthcheck

### Community 90 - "Community 90"
Cohesion: 0.60
Nodes (5): context, dockerfile, target, build, build

### Community 91 - "Community 91"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 92 - "Community 92"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 93 - "Community 93"
Cohesion: 0.50
Nodes (3): PairingPhase, PairingProgress(), Step

### Community 94 - "Community 94"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 95 - "Community 95"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 96 - "Community 96"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 97 - "Community 97"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

## Knowledge Gaps
- **59 isolated node(s):** `ADR-0006`, `ADR-0006`, `ADR-0007`, `ADR-0006`, `ADR-0007` (+54 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 676 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Browser hub` to `Gateway tests`, `Web auth and access`, `Agent smoke and doctor`, `Agent node execution`, `Flow list actions`, `Agent main and CLI`, `Flow canvas geometry`, `Node library UI`, `Machine page widgets`, `Human nodes (core)`, `Agent service install`, `Root tooling`, `Community 25`, `Community 27`, `Community 28`, `Community 29`, `Community 31`, `Community 33`, `Community 37`, `Community 47`, `Community 48`, `Community 51`, `Community 52`, `Community 55`, `Community 61`, `Community 65`, `Community 66`, `Community 67`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `deps()` (e.g. with `web/test/access.test.ts` and `m1.test.ts`) actually correct?**
  _`deps()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0006`, `ADR-0006`, `ADR-0007` to the rest of the system?**
  _59 weakly-connected nodes found - possible missing edges._
- **Should `Gateway tests` be split into smaller, more focused modules?**
  _Cohesion score 0.13142857142857142 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Community 50` to `Agent smoke and doctor`, `Flow list actions`, `Needs-you and run pages`, `Web dependencies`, `App layout and sign-in`, `Node library UI`, `Flow and project actions`, `Machine page widgets`, `Flow editor`, `Community 28`, `Community 29`, `Community 35`, `Community 36`, `Community 43`, `Community 45`, `Community 49`, `Community 61`, `Community 64`, `Community 65`, `Community 84`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `Web auth and access` be split into smaller, more focused modules?**
  _Cohesion score 0.08788159111933395 - nodes in this community are weakly interconnected._
- **Why does `deps()` connect `Flow and project actions` to `Gateway tests`, `Web auth and access`, `Flow list actions`, `Needs-you and run pages`, `App layout and sign-in`, `Node library UI`, `Machine page widgets`, `Community 29`, `Community 35`, `Community 36`, `Community 43`, `Community 45`, `Community 49`, `Community 50`, `Community 57`, `Community 64`, `Community 65`, `Community 67`, `Community 84`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._