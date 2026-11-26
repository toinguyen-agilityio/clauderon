# Graph Report - clauderon  (2026-11-26)

## Corpus Check
- 429 files · ~354,388 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 4, .css 2, .example 2)

## Summary
- 3448 nodes · 8567 edges · 170 communities (159 shown, 11 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 217 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e5c43317`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- gateway/test/m3.test.ts
- src/access.ts
- RunEngine
- agent-install.ts
- server/runs.ts
- node-file.ts
- flows/page.tsx
- host-agent/src/main.ts
- web/package.json
- flow-canvas.tsx
- server/runs.ts
- (app)/layout.tsx
- library-view.ts
- Clock
- machine-parts.tsx
- check
- createGateway
- claude.ts
- host-agent/package.json
- m1.test.ts
- pairings.ts
- service.ts
- fakes.ts
- package.json
- flow-drafts.ts
- pair.ts
- FakeGitHub
- flow-file.ts
- doctor.ts
- build-flow.tsx
- db/package.json
- run.ts
- run-engine.ts
- server/library.ts
- gateway/package.json
- server/runtime.ts
- server/github-access.ts
- services
- core/src/index.ts
- Clauderon — Requirements v1 (final)
- M1 — Walking skeleton
- doctor.ts
- machine-link.ts
- next
- flow-node.tsx
- members.ts
- run-flow-diagram.tsx
- gateway/test/m3.test.ts
- runs/[id]/page.tsx
- server/flows.ts
- flow-editor.tsx
- features/package.json
- db/src/schema.ts
- testing/package.json
- build.ts
- deploy.sh
- agent-dist.ts
- compilerOptions
- server/github-access.ts
- steps
- flows-list.tsx
- attachments-http.ts
- server/machines.ts
- Deploying Clauderon
- browser.ts
- runner.ts
- start.ts
- environment
- postgres
- web/test/m3.test.ts
- protocol/package.json
- tasks
- Agent
- [versionId]/page.tsx
- FlowDrafts
- compose.yml
- src/runs.ts
- core/package.json
- MemorySocket
- agent.ts
- postgres
- machines/[id]/page.tsx
- M4 — Refinement and release
- src/flows.ts
- web
- gateway
- backup.sh
- migrate
- healthcheck
- build
- Flow Drafts run Claude Code on the Member's Machine, outside any Run
- runner.ts
- Clauderon
- Contributing
- run-live.tsx
- deps
- db/src/machines.ts
- after-pr-merge.mjs
- pnpm-workspace.yaml
- { GET, POST }
- core/src/flow-history.ts
- ListSkeleton
- core/src/index.ts
- start-text-input.tsx
- The whole app is self-hosted on the Pod Host and reached over Tailscale
- db/src/index.ts
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
- icons.tsx
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
- Each Member runs on their own Machine, paired to a public app
- Domain Docs
- Spike M0-02: Claude Code headless in the Pod image
- tickets.ts
- Pods push and open pull requests with their own git/gh login
- Flows are typed DAGs without cycles, run one Node at a time
- Pods are per-Member Docker containers on one Pod Host, driven by a Host Agent
- The web app runs on Vercel, with an always-on Gateway for long-lived connections
- gateway/src/main.ts
- The Agent ships as one bundle with its own Node, and checks its Machine
- AGENTS.md
- Clauderon docs
- drafts.ts
- human-form.tsx
- host-agent/src/nodes.ts
- agent-smoke.ts
- workspace.ts
- result
- needs-you/page.tsx
- pull-request-table.tsx
- TurnRecorder
- Run attachments reach the Machine through the Gateway, stored encrypted until delivered
- auth.ts
- machines/page.tsx
- flow-draft.ts
- limits.ts
- db/src/flow-history.ts
- The whole app is self-hosted on the Pod Host and reached over Tailscale
- local-system.ts
- audit/page.tsx
- markdown-text.tsx
- log-retention.ts
- seed.ts
- machines/actions.ts
- db/test/flow-history.test.ts
- bundle.mjs
- runs/[id]/actions.ts
- doctor-card.tsx
- agentManifest
- 4.2 Messages
- Spike M0-02: Claude Code headless in the Pod image

## God Nodes (most connected - your core abstractions)
1. `deps()` - 114 edges
2. `requireMember()` - 88 edges
3. `vitest` - 70 edges
4. `next` - 66 edges
5. `react` - 59 edges
6. `Db` - 54 edges
7. `RunEngine` - 43 edges
8. `Icon` - 42 edges
9. `FlowEditor()` - 34 edges
10. `createGateway()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `11. Slices` --references--> `endMemberAccess()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/db/src/access.ts
- `9. Seeds (FLW-8)` --references--> `validateFlow()`  [INFERRED]
  docs/specs/m0-foundations.md → packages/core/src/flow.ts
- `7. Dry-run (removed)` --references--> `simulatedOutputs()`  [INFERRED]
  docs/specs/m2-flows-and-scheduling.md → packages/core/src/simulate.ts
- `Places to change` --references--> `migrate()`  [INFERRED]
  docs/superpowers/specs/2026-11-20-contributing-conventions-design.md → packages/db/src/migrate.ts
- `5. Testing strategy` --references--> `extractResultBlock()`  [INFERRED]
  docs/plans/m3-execution-plan.md → packages/core/src/runner.ts

## Import Cycles
- 2-file cycle: `packages/db/src/flow-history.ts -> packages/db/src/flows.ts -> packages/db/src/flow-history.ts`

## Communities (170 total, 11 thin omitted)

### Community 0 - "gateway/test/m3.test.ts"
Cohesion: 0.09
Nodes (25): base, attemptTokens(), BYTES_PER_TOKEN, Call, EDITING_TOOLS, EXPLORING_CALLS, EXPLORING_TOOLS, Finding (+17 more)

### Community 1 - "src/access.ts"
Cohesion: 0.09
Nodes (36): BrowserHub, sessionFor(), clauderonAdapter(), orNull(), toUser(), member(), signInWithCookie(), addAllowlistEntry() (+28 more)

### Community 2 - "RunEngine"
Cohesion: 0.14
Nodes (11): RunEngine, attachmentsOfRun(), getMachine(), attemptsOfRun(), finishAttempt(), getAttempt(), getRunContext(), moveRun() (+3 more)

### Community 3 - "agent-install.ts"
Cohesion: 0.18
Nodes (15): server, dynamic, GET(), ADR-0006, dynamic, GET(), ADR-0006, agentHomeName() (+7 more)

### Community 4 - "server/runs.ts"
Cohesion: 0.05
Nodes (15): CancelOutcome, InspectedAttempt, inspectorOf(), isUuid(), NOTIFY_OF_DECISION, parseRunFilters(), PullRequestQuery, PullRequestRow (+7 more)

### Community 5 - "node-file.ts"
Cohesion: 0.20
Nodes (9): fail(), isObject(), NODE_FILE_FORMAT, NODE_FILE_VERSION, NodeFile, ParsedNodes, parseNodeFile(), ParseNodesResult (+1 more)

### Community 6 - "flows/page.tsx"
Cohesion: 0.18
Nodes (17): DeletedFlowsPage(), dynamic, FlowsTabs(), LibraryNodeView, dynamic, LibraryPage(), dynamic, FlowsPage() (+9 more)

### Community 7 - "host-agent/src/main.ts"
Cohesion: 0.08
Nodes (40): MachineFacts, MachineUsageReader, findBash(), agentBinDir(), ask(), [command = "run", ...args], doctorCommand(), doctorFor() (+32 more)

### Community 8 - "web/package.json"
Cohesion: 0.07
Nodes (38): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, next@^16.4.6, next-auth@5.0.0-beta.32, react@^19.3.1, react-dom@^19.3.1 (+30 more)

### Community 9 - "flow-canvas.tsx"
Cohesion: 0.12
Nodes (36): boundsOf(), centerOn(), clampZoom(), edgePath(), FAR_ZOOM, fitBounds(), intersects(), MAX_ZOOM (+28 more)

### Community 10 - "server/runs.ts"
Cohesion: 0.10
Nodes (20): env, if, runs-on, steps, GH_TOKEN, PR, PR_BODY, REPO (+12 more)

### Community 11 - "(app)/layout.tsx"
Cohesion: 0.10
Nodes (27): needsYouAction(), AppLayout(), jetbrains, metadata, roboto, signOut, openGatewaySocket(), useGatewaySocket() (+19 more)

### Community 12 - "library-view.ts"
Cohesion: 0.11
Nodes (40): cloneNodeAction(), deleteNodeAction(), exportNodesAction(), importNodesAction(), ImportNodes(), LibraryList(), NodeCard(), NodeDialog() (+32 more)

### Community 13 - "Clock"
Cohesion: 0.10
Nodes (18): Gateway, GatewayOptions, flusher(), newGateway(), restartGateway(), SESSION_SECRET, startGateway(), connect() (+10 more)

### Community 14 - "machine-parts.tsx"
Cohesion: 0.13
Nodes (27): claudeAccountLabel(), DISK_ADVICE, DiskFree, diskFree(), DiskStatus(), formatGb(), LoginChip(), MACHINE_NAME_MAX (+19 more)

### Community 15 - "check"
Cohesion: 0.08
Nodes (25): env, runs-on, services, steps, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, TEST_DATABASE_URL (+17 more)

### Community 16 - "createGateway"
Cohesion: 0.13
Nodes (4): createGateway(), MachineLinks, MachineWatch, recordMachineDisconnected()

### Community 17 - "claude.ts"
Cohesion: 0.10
Nodes (22): byteSize(), CLAUDE_ARGS, claudeCommand(), ClaudeEvent, ClaudeOptions, claudeResult(), Content, firstLine() (+14 more)

### Community 18 - "host-agent/package.json"
Cohesion: 0.08
Nodes (30): dependencies, @clauderon/core@workspace:*, @clauderon/protocol@workspace:*, dockerode@^5.0.1, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, esbuild@0.28.2 (+22 more)

### Community 19 - "m1.test.ts"
Cohesion: 0.09
Nodes (33): allCases, args, assets, base, css, dataUri(), dims(), errors (+25 more)

### Community 20 - "pairings.ts"
Cohesion: 0.07
Nodes (31): handlePairing(), json(), PairingHttpOptions, readBody(), ADR-0006, ADR-0007, approveMyPairing(), normalizePairingCode() (+23 more)

### Community 21 - "service.ts"
Cohesion: 0.16
Nodes (25): Exec, installService(), launchdPath(), launchdPlist(), logFile(), SERVICE_LABEL, serviceArgs(), serviceInstalled() (+17 more)

### Community 22 - "fakes.ts"
Cohesion: 0.09
Nodes (14): EXEC_ARGS, ExecOptions, OutputListener, ProcessHandle, Signal, DIR, ExecCall, ExecReply (+6 more)

### Community 23 - "package.json"
Cohesion: 0.07
Nodes (31): devDependencies, eslint@^10.15.0, tsx@^4.23.15, turbo@^2.11.11, @types/node@^26.6.6, typescript@~6.0.3, typescript-eslint@^8.72.2, vitest@^5.1.0 (+23 more)

### Community 24 - "flow-drafts.ts"
Cohesion: 0.19
Nodes (19): currentPermission(), NotificationsProvider(), NotificationsToggle(), NotifySetting, Setting, storage(), Toast, at() (+11 more)

### Community 25 - "pair.ts"
Cohesion: 0.10
Nodes (24): attachmentDownloader(), checkGateway(), skew(), ADR-0007, ADR-0011, httpBase(), pair(), PAIR_POLL_MS (+16 more)

### Community 26 - "FakeGitHub"
Cohesion: 0.10
Nodes (13): ApiIssue, ADR-0010, withCachedPullRequests(), pull(), setup(), GitHubReader, Issue, OpenPullRequest (+5 more)

### Community 27 - "flow-file.ts"
Cohesion: 0.14
Nodes (17): buildFlowFile(), ENTRY_KINDS, fail(), FATAL, FLOW_FILE_FORMAT, FLOW_FILE_MAX_BYTES, FLOW_FILE_VERSION, FlowToExport (+9 more)

### Community 28 - "doctor.ts"
Cohesion: 0.17
Nodes (15): CLOCK_SKEW_MS, DoctorInput, firstLine(), fixFor(), Platform, runDoctor(), ADR-0007, GatewayCheck (+7 more)

### Community 29 - "build-flow.tsx"
Cohesion: 0.13
Nodes (20): BuildAvailability, BuildFlow(), Composer(), Draft, DraftPreview(), EXAMPLES, Phase, ADR-0008 (+12 more)

### Community 30 - "db/package.json"
Cohesion: 0.09
Nodes (25): dependencies, @clauderon/core@workspace:*, drizzle-orm@^0.45.4, pg@^8.23.1, devDependencies, drizzle-kit@^0.31.11, @types/pg@^8.23.1, exports (+17 more)

### Community 31 - "run.ts"
Cohesion: 0.09
Nodes (29): 1. Starting point, 2. Architecture decisions, 4.2 Run engine (RUN-2, RUN-3, RUN-16), AttemptState, AttemptView, holdsSlot(), isActive(), MachineForSchedule (+21 more)

### Community 32 - "run-engine.ts"
Cohesion: 0.08
Nodes (18): NoticeOptions, MachineBack, RunContext, RunEngineOptions, Sender, ADR-0006, ADR-0011, RetryContext (+10 more)

### Community 33 - "server/library.ts"
Cohesion: 0.16
Nodes (26): saveNodeAction(), copyName(), cloneMyNode(), CloneNodeOutcome, createMyNode(), Definition, deleteMyNode(), exportMyNodes() (+18 more)

### Community 34 - "gateway/package.json"
Cohesion: 0.10
Nodes (24): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, ws@^8.23.0, devDependencies, @clauderon/testing@workspace:*, @types/ws@^8.18.2 (+16 more)

### Community 35 - "server/runtime.ts"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, incremental, jsx, lib, plugins, exclude, extends (+2 more)

### Community 36 - "server/github-access.ts"
Cohesion: 0.17
Nodes (26): ENABLE_ERRORS, enableAction(), EnableState, loadBranches(), loadRepositories(), removeProjectAction(), removeTokenAction(), saveTokenAction() (+18 more)

### Community 37 - "services"
Cohesion: 0.07
Nodes (31): databases, databaseName, ipAllowList, name, plan, postgresMajorVersion, region, user (+23 more)

### Community 38 - "core/src/index.ts"
Cohesion: 0.07
Nodes (27): BrowserHubOptions, ADR-0008, Draft, FlowDraftsOptions, Job, Purpose, ADR-0008, add() (+19 more)

### Community 39 - "Clauderon — Requirements v1 (final)"
Cohesion: 0.07
Nodes (30): 10. Glossary, 11. Related documents, 12. Next steps, 1. Overview, 2. Goals and success measures, 3. Scope, 4.1 Members and Projects, 4.2 Pods (+22 more)

### Community 40 - "M1 — Walking skeleton"
Cohesion: 0.09
Nodes (23): 1. Scope, 2.1 Create my Pod (POD-2), 2.2 Start and Stop (POD-6, part), 2.3 Pods page (POD-4), 2.4 Login checks (POD-5), 2.5 Web terminal (POD-9), 2. Pods, 3.1 Enable a Project (PRJ-1, PRJ-2) (+15 more)

### Community 41 - "doctor.ts"
Cohesion: 0.17
Nodes (20): ADD_ERRORS, addEmail(), FormState, refresh(), removeMachineAction(), removeMemberAction(), runsOf(), AddEmailForm() (+12 more)

### Community 42 - "machine-link.ts"
Cohesion: 0.07
Nodes (29): Handler, HeartbeatListener, HelloListener, Link, MachineLinksOptions, ADR-0006, succeedEverything(), doctorReport (+21 more)

### Community 43 - "next"
Cohesion: 0.10
Nodes (26): createFlowAction(), exportFlowAction(), flowActionAction(), FlowFormState, importFlowAction(), loadFlowStartAction(), loadFlowStartChoicesAction(), startFromInputAction() (+18 more)

### Community 44 - "flow-node.tsx"
Cohesion: 0.12
Nodes (21): CanvasHandle(), HandleType, FIcon, kindIcon(), stroke, acceptsWire(), KIND_LABEL, NodeAction (+13 more)

### Community 45 - "members.ts"
Cohesion: 0.24
Nodes (11): MemberMachine, MemberRow, MemberStatus, MembersView, RemoveMemberResult, viewMembers(), isMachineReady(), listAllowlist() (+3 more)

### Community 46 - "run-flow-diagram.tsx"
Cohesion: 0.23
Nodes (12): currentNodeId(), DiagramEdgeState, diagramEdgeStates(), diagramPositions(), DiagramState, diagramState(), nodeSize(), PILL (+4 more)

### Community 47 - "gateway/test/m3.test.ts"
Cohesion: 0.07
Nodes (6): setup(), failThenRetry(), Script, scriptPlanAndDeliver(), Sent, setup()

### Community 48 - "runs/[id]/page.tsx"
Cohesion: 0.13
Nodes (25): FilterSelect(), Option, CancelRun(), ACTION, dynamic, Fact(), RunPage(), dynamic (+17 more)

### Community 50 - "server/flows.ts"
Cohesion: 0.04
Nodes (15): CreateFlowResult, Definition, DeletedFlowView, DeleteFlowOutcome, ExportFlowResult, FlowHistoryView, FlowVersionView, HistoryEntryView (+7 more)

### Community 51 - "flow-editor.tsx"
Cohesion: 0.08
Nodes (41): GRID, isTyping(), DEFAULT_NODE, Doc, FlowEditor(), GraphEdge, isMac(), LibraryAnchor (+33 more)

### Community 52 - "features/package.json"
Cohesion: 0.14
Nodes (14): dependencies, zod@^4.6.7, exports, zod, name, private, scripts, build:file (+6 more)

### Community 53 - "db/src/schema.ts"
Cohesion: 0.05
Nodes (33): AttachmentInfo, markAttachmentsDelivered(), NewAttachment, SealedAttachment, sha256Hex(), ADR-0010, ADR-0011, AUDIT_PAGE_SIZE (+25 more)

### Community 54 - "testing/package.json"
Cohesion: 0.13
Nodes (18): dependencies, @clauderon/core@workspace:*, @clauderon/db@workspace:*, @clauderon/protocol@workspace:*, drizzle-orm@^0.45.4, exports, @clauderon/core, @clauderon/db (+10 more)

### Community 55 - "build.ts"
Cohesion: 0.11
Nodes (26): config, rootEnv, buildFeatures(), MAP_PATH, OUTPUT_PATH, read(), renderFeatures(), out (+18 more)

### Community 56 - "deploy.sh"
Cohesion: 0.29
Nodes (16): compose(), die(), down(), env_get(), env_set(), init_env(), preflight(), say() (+8 more)

### Community 57 - "agent-dist.ts"
Cohesion: 0.12
Nodes (14): latestAgent(), sha256(), ADR-0007, updateAgent(), UpdateOptions, UpdateResult, AgentCheck, AgentManifest (+6 more)

### Community 58 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, esModuleInterop, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution (+9 more)

### Community 59 - "server/github-access.ts"
Cohesion: 0.12
Nodes (22): appGitHubToken(), GitHubAccessDeps, GitHubAccessView, removeGitHubToken(), saveGitHubToken(), SaveTokenResult, ADR-0010, viewGitHubAccess() (+14 more)

### Community 60 - "steps"
Cohesion: 0.10
Nodes (19): runs-on, steps, strategy, jobs, agent, os, name, on (+11 more)

### Community 61 - "flows-list.tsx"
Cohesion: 0.23
Nodes (17): EMPTY, FlowCard(), FlowsList(), SCOPES, Steps(), deleteRunsNote(), filterFlows(), FlowRowView (+9 more)

### Community 62 - "attachments-http.ts"
Cohesion: 0.21
Nodes (11): handleAttachments(), json(), ADR-0011, createGatewayServer(), wsConnector(), attachmentForMachine(), key(), openAttachment() (+3 more)

### Community 63 - "server/machines.ts"
Cohesion: 0.09
Nodes (21): ApproveResult, LookUpResult, MACHINE_NAME_MAX, MachineSettingsInput, MachineView, PairingPreview, QueueEntry, RemoveResult (+13 more)

### Community 64 - "Deploying Clauderon"
Cohesion: 0.14
Nodes (14): 1. Prepare the machine (once), 2. Outside accounts (once), 3. Configure, 4. Start the stack, 5. Publish with a Cloudflare Tunnel, 6. Members pair their Machines, 7. Backups, Demo on Render (+6 more)

### Community 65 - "browser.ts"
Cohesion: 0.20
Nodes (8): browserRequest, BrowserRequest, NOTIFY_KINDS, notifyEvent, NotifyEvent, NotifyKind, parseBrowserMessage(), ADR-0008

### Community 66 - "runner.ts"
Cohesion: 0.07
Nodes (46): 3. Dependency graph and order, 4. Changes by layer, 5. Testing strategy, 6. Risks and edge cases, 7. Traceability, 8. Deployment order, 9. Progress log, M3 execution plan — People in the loop (+38 more)

### Community 67 - "start.ts"
Cohesion: 0.10
Nodes (34): FlowStartChoice, flowStartDialog(), PullRequestRef, pullRequestStartDialog(), resolveInput(), startableFlows(), startDialog(), startFromForm() (+26 more)

### Community 68 - "environment"
Cohesion: 0.18
Nodes (13): APP_VERSION, AUTH_URL, DATABASE_URL, GATEWAY_PORT, GATEWAY_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPERATOR_EMAILS (+5 more)

### Community 69 - "postgres"
Cohesion: 0.15
Nodes (12): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, name, environment, image, ports, volumes (+4 more)

### Community 70 - "web/test/m3.test.ts"
Cohesion: 0.08
Nodes (22): AppDeps, Viewer, cleanGraph(), cloneMyFlow(), createMyFlow(), editorData(), saveMyFlow(), SnapshotView (+14 more)

### Community 71 - "protocol/package.json"
Cohesion: 0.17
Nodes (12): dependencies, zod@^4.6.7, exports, zod, name, private, scripts, lint (+4 more)

### Community 72 - "tasks"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+4 more)

### Community 74 - "[versionId]/page.tsx"
Cohesion: 0.12
Nodes (22): cloneVersionAction(), restoreVersionAction(), VersionActions(), dynamic, FIELD, FlowVersionPage(), KIND, LinkRow() (+14 more)

### Community 75 - "FlowDrafts"
Cohesion: 0.29
Nodes (5): FlowDrafts, sendEvent(), Member, BrowserEvent, LinkSocket

### Community 76 - "compose.yml"
Cohesion: 0.14
Nodes (13): content, configs, cloudflared, name, name, services, volumes, pgdata (+5 more)

### Community 77 - "src/runs.ts"
Cohesion: 0.06
Nodes (24): log(), activeRun(), appendLogChunk(), Attempt, AttemptEnd, buildRetryContext(), CancelRunResult, getRunView() (+16 more)

### Community 78 - "core/package.json"
Cohesion: 0.20
Nodes (9): exports, name, private, scripts, lint, test, typecheck, type (+1 more)

### Community 80 - "agent.ts"
Cohesion: 0.04
Nodes (16): operators, hello, ADR-0007, AgentOptions, BACKOFF_CAP_MS, BACKOFF_START_MS, Connector, Handler (+8 more)

### Community 81 - "postgres"
Cohesion: 0.25
Nodes (8): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, environment, image, restart, volumes, postgres

### Community 82 - "machines/[id]/page.tsx"
Cohesion: 0.16
Nodes (19): MachineFormState, UpdateFormState, AutoRefresh(), dynamic, FactRow(), loginChip(), MachinePage(), ADR-0007 (+11 more)

### Community 83 - "M4 — Refinement and release"
Cohesion: 0.12
Nodes (17): 1. Scope, 2.1 Diff (TRK-3), 2.2 Usage (TRK-4), 2.3 Artifact (TRK-5), 2.4 Batch page (TRK-6), 2.5 Ticket detail (TIC-4), 2. Tracking, 3. Machines (replaces Pods) (+9 more)

### Community 84 - "src/flows.ts"
Cohesion: 0.13
Nodes (21): buildVersionSnapshot(), recordFlowVersion(), cloneFlow(), copyName(), deleteFlow(), DeleteFlowResult, FlowGraphInput, FlowListRow (+13 more)

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

### Community 91 - "Flow Drafts run Claude Code on the Member's Machine, outside any Run"
Cohesion: 0.50
Nodes (3): Consequences, Considered Options, Flow Drafts run Claude Code on the Member's Machine, outside any Run

### Community 92 - "runner.ts"
Cohesion: 0.13
Nodes (20): CONTEXT_WRITING, contextSize(), activeOutputs(), BranchFacts, branchName(), CheckResult, CommandFacts, commandOutputs() (+12 more)

### Community 93 - "Clauderon"
Cohesion: 0.12
Nodes (17): Architecture, Clauderon, Contributing, Development commands, Development (`.env`), Documentation, Environment variables, How it works (+9 more)

### Community 94 - "Contributing"
Cohesion: 0.20
Nodes (10): Branches, Commits, Configuration and secrets, Contributing, Pull requests, Release notes, Releases, Repo graph for Claude (+2 more)

### Community 95 - "run-live.tsx"
Cohesion: 0.14
Nodes (21): Attempt, callLabel(), Inspected, NodeInspector(), SEGMENTS, Stat(), RetryFromHere(), classify() (+13 more)

### Community 96 - "deps"
Cohesion: 0.10
Nodes (33): dynamic, GET(), ADR-0006, dynamic, POST(), ADR-0011, dynamic, GET() (+25 more)

### Community 97 - "db/src/machines.ts"
Cohesion: 0.11
Nodes (17): deleteMachine(), DeleteMachineResult, MachineFacts, MachineLogins, MachineRow, MachineRun, MachineRunCounts, markAllMachinesDisconnected() (+9 more)

### Community 102 - "core/src/flow-history.ts"
Cohesion: 0.13
Nodes (20): Considered Options, Flow history is a full snapshot per change, kept forever, describeChange(), describeChanges(), diffFlow(), FLOW_VERSION_KINDS, FlowChange, FlowVersionKind (+12 more)

### Community 103 - "ListSkeleton"
Cohesion: 0.60
Nodes (3): Loading(), Loading(), ListSkeleton()

### Community 104 - "core/src/index.ts"
Cohesion: 0.06
Nodes (47): 10. Acceptance tests, 10. Slices, 1. Scope, 2. Flows page, 3. Canvas editor (FLW-3 … FLW-6), 4. Node library (FLW-1, FLW-9, FLW-10), 5. Flow edit lock (FLW-7), 6. Slots, limits and the queue (POD-2, POD-3, POD-6) (+39 more)

### Community 105 - "start-text-input.tsx"
Cohesion: 0.20
Nodes (18): hasTextInput(), linkList(), size(), TextInputFields(), TextInputState, ADR-0011, textInput(), agentAtLeast() (+10 more)

### Community 106 - "The whole app is self-hosted on the Pod Host and reached over Tailscale"
Cohesion: 0.40
Nodes (4): labels, title, changelog, categories

### Community 107 - "db/src/index.ts"
Cohesion: 0.11
Nodes (27): attemptId(), setup(), operators, handle, connect(), DbHandle, GitHubAccess, setGitHubAccess() (+19 more)

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
Cohesion: 0.09
Nodes (31): EnableRepositoryResult, forgetSyncAttempts(), lastAttempt, mapLimit(), pullFromGitHub(), refreshPullRequest(), syncAllProjects(), SyncResult (+23 more)

### Community 117 - "Clauderon"
Cohesion: 0.12
Nodes (14): Agent skills, Architecture, Clauderon, Commands, Contributing, Domain docs, Issue tracker, Next.js (+6 more)

### Community 118 - "icons.tsx"
Cohesion: 0.09
Nodes (34): loadStartDialog(), startAction(), syncTicketsAction(), dynamic, Search, TicketsPage(), VIEWS, FilterLink() (+26 more)

### Community 119 - "DESIGN.md"
Cohesion: 0.18
Nodes (10): Colors, Components, Do's and Don'ts, Elevation & Depth, Layout, Motion, Overview, Shapes (+2 more)

### Community 120 - "M0 — Foundations"
Cohesion: 0.14
Nodes (14): 11. Slices, 1. Scope, 2. Configuration, 5.1 Flow validator (FLW-4, FLW-5, A3), 5.2 Run state machine (RUN-2 … RUN-9, RUN-16), 5.3 Slot scheduler (POD-3), 5.4 Ticket Status (TIC-6), 5.5 Masking (NFR-1) (+6 more)

### Community 121 - "Shared conventions"
Cohesion: 0.15
Nodes (11): openLb(), show(), step(), Clauderon v1 — milestone specs, Definition of done for every slice, Naming, Repository layout, Requirement coverage (+3 more)

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

### Community 129 - "Each Member runs on their own Machine, paired to a public app"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, Each Member runs on their own Machine, paired to a public app

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

### Community 137 - "gateway/src/main.ts"
Cohesion: 0.11
Nodes (17): databaseUrl, { db }, gateway, port, sessionSecret, ADR-0010, ADR-0004, listenMemberRevoked() (+9 more)

### Community 138 - "The Agent ships as one bundle with its own Node, and checks its Machine"
Cohesion: 0.67
Nodes (3): Consequences, Considered Options, The Agent ships as one bundle with its own Node, and checks its Machine

### Community 141 - "drafts.ts"
Cohesion: 0.17
Nodes (13): ClaudeErrorWatch, draftClaudeCommand(), draftDir(), DraftRunnerOptions, registerDraftHandlers(), runDraft(), Running, ADR-0008 (+5 more)

### Community 142 - "human-form.tsx"
Cohesion: 0.24
Nodes (10): respondAction(), RespondFormState, Choices(), HumanForm(), OpenRequest, Question, answersFromForm(), OTHER_CHOICE (+2 more)

### Community 143 - "host-agent/src/nodes.ts"
Cohesion: 0.12
Nodes (14): ATTEMPT_ENV, EXPECT_COMMIT_ENV, FILE_ENV, KILL_GRACE_MS, NodeHandles, NodeRunnerOptions, PidFile, pidFile() (+6 more)

### Community 144 - "agent-smoke.ts"
Cohesion: 0.12
Nodes (12): agent, doctor, env, home, nodeVersion, problems, report, ADR-0007 (+4 more)

### Community 145 - "workspace.ts"
Cohesion: 0.10
Nodes (26): detached(), checkClaude(), checkLogins(), CLAUDE_STATUS_SCRIPT, ClaudeLogin, LoginHooks, Logins, parseClaudeStatus() (+18 more)

### Community 146 - "result"
Cohesion: 0.17
Nodes (10): Example, report.json format, 1. Get the build script, 2. Collect the results, 3. Write report.json, 4. Build, 5. Check it in a browser, 6. Publish (+2 more)

### Community 147 - "needs-you/page.tsx"
Cohesion: 0.18
Nodes (13): NodePanel(), STATE_LABEL, dynamic, KIND, NeedsYouPage(), urgency(), RetryFormState, Input (+5 more)

### Community 148 - "pull-request-table.tsx"
Cohesion: 0.21
Nodes (14): loadPullRequestStartDialog(), dynamic, PullRequestsPage(), Search, PullRequestListRow, PullRequestTable(), selectable(), StartDialog() (+6 more)

### Community 149 - "TurnRecorder"
Cohesion: 0.19
Nodes (10): TurnRecorder, assistant(), line(), record(), result(), usage(), 5. Risks and what to cut, 6. Agent result contract (RUN-10) (+2 more)

### Community 151 - "auth.ts"
Cohesion: 0.20
Nodes (12): AccessDeniedPage(), dynamic, dynamic, SignInPage(), STEPS, DENIED_EMAIL_COOKIE, handlers, signIn (+4 more)

### Community 152 - "machines/page.tsx"
Cohesion: 0.24
Nodes (13): lookUpPairingAction(), PairFormState, CmdBox(), osLabel(), dynamic, MachinesPage(), PairSteps(), PairMachine() (+5 more)

### Community 153 - "flow-draft.ts"
Cohesion: 0.15
Nodes (17): agentSupportsFlowDrafts(), describeLibrary(), DraftLibraryNode, FLOW_DRAFT_MAX_DESCRIPTION, FLOW_DRAFT_MIN_AGENT, FLOW_DRAFT_TIMEOUT_MS, flowDraftPrompt(), FlowDraftRead (+9 more)

### Community 154 - "limits.ts"
Cohesion: 0.38
Nodes (5): checkSlots(), MAX_SLOTS, queuePositions(), SlotsCheck, ADR-0006

### Community 155 - "db/src/flow-history.ts"
Cohesion: 0.18
Nodes (14): maskSnapshot(), cloneFlowVersion(), CloneVersionResult, copyOfName(), DeletedFlow, FlowHistoryEntry, FlowVersionRow, getFlowVersion() (+6 more)

### Community 156 - "The whole app is self-hosted on the Pod Host and reached over Tailscale"
Cohesion: 0.50
Nodes (4): Consequences, Considered Options, The whole app is self-hosted on the Pod Host and reached over Tailscale, profile()

### Community 157 - "local-system.ts"
Cohesion: 0.19
Nodes (5): localSystem(), signalGroup(), ADR-0006, ADR-0006, SCRIPT

### Community 158 - "audit/page.tsx"
Cohesion: 0.18
Nodes (13): ACTIONS, AFTER, area(), AuditPage(), clock, dayKey, dayLabel, detailPairs() (+5 more)

### Community 159 - "markdown-text.tsx"
Cohesion: 0.33
Nodes (12): CODE_LIKE, ExpandedText(), formatForReading(), isLongText(), LONG_TEXT_CHARS, LONG_TEXT_LINES, MarkdownBody(), MarkdownText() (+4 more)

### Community 160 - "log-retention.ts"
Cohesion: 0.24
Nodes (5): LOG_RETENTION_DAYS, LogRetention, LogRetentionOptions, clearTurnTargetsBefore(), deleteLogChunksBefore()

### Community 161 - "seed.ts"
Cohesion: 0.18
Nodes (8): flowEdge, SampleEdge, SampleFlow, sampleFlows, SampleNode, sampleNodes, SamplePlacement, SEEDED_BY

### Community 162 - "machines/actions.ts"
Cohesion: 0.31
Nodes (9): approvePairingAction(), checkLoginsAction(), removeMachineAction(), setSettingsAction(), updateAgentAction(), checkMyLogins(), ownMachine(), setMyMachineSettings() (+1 more)

### Community 163 - "db/test/flow-history.test.ts"
Cohesion: 0.36
Nodes (9): listFlowHistory(), createFlow(), loadFlowDetail(), agent(), flowWith(), history(), lockFlow(), t() (+1 more)

### Community 164 - "bundle.mjs"
Cohesion: 0.22
Nodes (7): buildId, bundle, dist, manifest, ADR-0007, root, versionMatch

### Community 165 - "runs/[id]/actions.ts"
Cohesion: 0.43
Nodes (6): CancelFormState, cancelRunAction(), retryRunAction(), cancelRunAs(), notifyStarter(), retryAs()

### Community 166 - "doctor-card.tsx"
Cohesion: 0.33
Nodes (5): DoctorCard(), DOT, looksLikeCommand(), ORDER, ADR-0007

### Community 167 - "agentManifest"
Cohesion: 0.50
Nodes (4): dynamic, GET(), ADR-0007, agentManifest()

### Community 168 - "4.2 Messages"
Cohesion: 0.50
Nodes (4): stream(), 4.1 Envelope and resuming, 4.2 Messages, 4. Host Agent protocol

### Community 169 - "Spike M0-02: Claude Code headless in the Pod image"
Cohesion: 0.50
Nodes (3): Goal, Spike M0-02: Claude Code headless in the Pod image, Steps

## Knowledge Gaps
- **95 isolated node(s):** `ADR-0007`, `ADR-0008`, `{ GET, POST }`, `ADR-0011`, `ADR-0011` (+90 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1338 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `db/src/index.ts` to `gateway/test/m3.test.ts`, `agent-install.ts`, `node-file.ts`, `host-agent/src/main.ts`, `flow-canvas.tsx`, `(app)/layout.tsx`, `library-view.ts`, `human-form.tsx`, `host-agent/src/nodes.ts`, `machine-parts.tsx`, `claude.ts`, `pairings.ts`, `service.ts`, `fakes.ts`, `TurnRecorder`, `flow-drafts.ts`, `pair.ts`, `FakeGitHub`, `package.json`, `doctor.ts`, `build-flow.tsx`, `local-system.ts`, `markdown-text.tsx`, `flow-draft.ts`, `flow-file.ts`, `limits.ts`, `run.ts`, `db/test/flow-history.test.ts`, `core/src/index.ts`, `next`, `run-flow-diagram.tsx`, `gateway/test/m3.test.ts`, `flow-editor.tsx`, `build.ts`, `server/github-access.ts`, `flows-list.tsx`, `runner.ts`, `start.ts`, `web/test/m3.test.ts`, `agent.ts`, `runner.ts`, `run-live.tsx`, `core/src/flow-history.ts`, `core/src/index.ts`, `start-text-input.tsx`, `Clauderon`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `deps()` (e.g. with `web/test/access.test.ts` and `web/test/flow-history.test.ts`) actually correct?**
  _`deps()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ADR-0007`, `ADR-0008`, `{ GET, POST }` to the rest of the system?**
  _95 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `gateway/test/m3.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0907258064516129 - nodes in this community are weakly interconnected._
- **Why does `Member` connect `FlowDrafts` to `src/access.ts`, `core/src/index.ts`, `doctor.ts`, `db/src/index.ts`, `gateway/test/m3.test.ts`, `Shared conventions`, `Contributing`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `src/access.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09302325581395349 - nodes in this community are weakly interconnected._
- **Why does `Contributing` connect `Contributing` to `CONTRIBUTING.md`, `FlowDrafts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._