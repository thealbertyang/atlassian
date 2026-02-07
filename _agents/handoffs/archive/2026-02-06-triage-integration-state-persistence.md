> Archived: 2026-02-07 — Implementation complete.

# Handoff: Triage Integration, State Persistence, UI Redesign, Reactive System Design

Date: 2026-02-06
Workspace: `repos/vscode/extensions/atlassian`

## Why These Changes Exist

The extension's Plan > Daily page had a static "Run Triage" button that only opened a placeholder runbook doc. The NOW/NEXT/WAITING worklist sections were hardcoded empty. The Review page required manually clicking an issue in the tree view. The header had a destructive "Disconnect" button on every route.

These changes integrate triage as a live workflow, persist state locally, auto-load issue data, and clean up the UI.

## High-Level Outcomes

### 1. Live Triage (Plan > Daily)

- **Run Triage** now fetches sprint issues from Jira API, categorizes them by status into NOW/NEXT/WAITING buckets, and persists the result to `_agents/state.json`.
- **Auto-load on page open**: reads persisted triage state so issues appear immediately without re-fetching.
- **Status categorization**: `statusToBucket()` maps Jira statuses to buckets:
  - NOW: "In Progress", "In Review", "In Development", "Doing"
  - WAITING: "Blocked", "On Hold", "Waiting", "Impediment"
  - NEXT: everything else (To Do, Open, New, etc.)
- Clicking any issue navigates to `/review/issues/{KEY}` for full detail.

### 2. State Persistence (`_agents/state.json`)

**Architecture decision: config and state are separate files.**

| File | Format | Purpose | Lifecycle |
|---|---|---|---|
| `config/universal.toml` | TOML | Structural contract (stages, routes, commands) | Rarely changes, human-editable |
| `_agents/config.local.toml` | TOML | Workspace config overrides | Rarely changes, human-editable |
| `_agents/config.local.json` | JSON | Debug snapshot of getFullConfig | Written on demand |
| `_agents/state.json` | JSON | **Runtime state** (triage results, timestamps) | Written every triage run |

State schema (`AppPersistedState`):
```json
{
  "version": 1,
  "triage": {
    "issues": [
      { "key": "CSO-123", "summary": "...", "status": "In Progress", "issueType": "Story", "project": "CSO", "bucket": "now" }
    ],
    "lastTriagedAt": 1738828800000
  }
}
```

Why separate:
- Config = user intent. State = runtime data. Different change frequencies.
- State is machine-written JSON. Config is human-editable TOML.
- Can reset state without losing config.
- State should not be committed; config sometimes should.

### 3. Review Page Auto-Load

- When the Review page opens at `/review/` (no issue key), it now auto-fetches the user's sprint issues via `listIssues` RPC and displays them as a clickable list.
- Each row shows issue key, summary, and status dot.
- "No issues found" empty state only shows when the user genuinely has zero matching issues.
- The old "No issue selected — click an issue in the tree view" message is replaced.

### 4. Header Redesign

- **Removed**: Red "Disconnect" button from every route header.
- **Disconnect** is still available in System > Settings (where it belongs).
- **Contextual header actions**:
  - Not connected → "Configure" button (secondary style)
  - Review with issue selected → "Open in Jira" + "Refresh"
  - All other connected states → clean header (overlay pill provides quick actions)

### 5. Developer Tools

- Added "Reload Window" button to Dev Environment tool group (`workbench.action.reloadWindow`).

## Data Flow

```
User opens Plan > Daily
  → getTriageState() reads _agents/state.json
  → Populates NOW/NEXT/WAITING from persisted triage
  → Shows last triage timestamp

User clicks "Run Triage"
  → runTriage() calls client.searchMyOpenSprintIssues() (Jira API)
  → statusToBucket() categorizes each issue
  → Writes result to _agents/state.json
  → Returns TriageState to webview
  → UI updates NOW/NEXT/WAITING buckets

User clicks issue row
  → navigate("/review/issues/{KEY}")
  → App.tsx detects issueKey, calls getIssue(key)
  → Renders full issue detail with description
```

## Integration with Docs

These docs define the system that triage implements:

| Doc | What it defines | How triage implements it |
|---|---|---|
| `engineer-work-matrix.md` | Planning AI role = "Summaries + ranking" | `statusToBucket()` categorizes, worklist ranks |
| `lifecycle-ui.md` | Plan trigger = "Open app or triage" | Auto-load on mount + Run Triage button |
| `project-management-matrix.md` | Daily routine = "Triage → Execute → Review" | NOW/NEXT/WAITING maps to this cycle |
| `reminder-ui.md` | Daily Focus wireframe with Now/Next/Waiting | Worklist sections match the wireframe |

## Where To Look (Key Files)

### Shared contracts
- `src/shared/contracts/app-state.ts` — `TriageState`, `TriagedIssue`, `statusToBucket()`, `AppPersistedState`
- `src/shared/contracts/state.ts` — `JiraIssueSummary` (new base type for `JiraIssueDetails`)
- `src/shared/contracts/commands.ts` — `RUN_TRIAGE`, `GET_TRIAGE_STATE`, `LIST_ISSUES` RPC methods

### Extension handlers
- `src/extension/handlers/triage.ts` — `getTriageState`, `runTriage` (reads/writes `_agents/state.json`)
- `src/extension/handlers/issues.ts` — `listIssues` (fetches sprint issues from Jira API)
- `src/extension/handlers/index.ts` — registers triage handlers

### Webview
- `src/webview/src/routes/plan/index.tsx` — Plan daily page with live triage
- `src/webview/src/routes/review/index.tsx` — Review page with auto-loaded issue list
- `src/webview/src/App.tsx` — header actions redesign, sprint issues state
- `src/webview/src/contexts/app-context.tsx` — `sprintIssues`, `sprintIssuesLoading` context
- `src/webview/src/types/handlers.ts` — `listIssues`, `getTriageState`, `runTriage` type signatures

### Styles
- `src/webview/src/App.css` — `.review-issue-list`, `.review-issue-row` styles

### State file
- `_agents/state.json` — persisted triage state (machine-written, not committed)

## Verified

- `bun run typecheck` — clean
- `bun run build` — clean (ext + webview)

## Session 2: Reactive System Design and Event System (Research/Docs Only)

After the code changes above, the session continued with design research. No code was written for the items below — they are documented in `_agents/docs/` for future implementation.

### 6. Reactive Workflows (`docs/reactive-workflows.md` — NEW)

Central design doc replacing the "individual rrule scheduling" model with a hybrid event + schedule + chain system.

**Six missing matrices identified and documented:**

| Matrix | Gap It Fills |
|---|---|
| Decision / Problem-Solving | "What do I work on next?" decision trees, stuck signals, escalation paths |
| Communication Channels | Situation → channel → content → automation mapping (system drafts, human sends) |
| Collaboration / Handoffs | How work flows between people: assignment, review, pairing, escalation |
| Feedback Loops | How Observe feeds Plan, Review feeds Execute, weekly feeds daily |
| Context Switching | Branch switch, meeting interrupt, day boundary — context preservation |
| AI Interaction Patterns | Summarize/draft/classify/suggest/execute/decide with trust levels per pattern |

**Reactive workflow model:**
- Three trigger types: **events** (something happened), **schedules** (ritual cadence), **chains** (automation output triggers next)
- Workflows are the unit, not individual automations: trigger → steps → state → display → gate
- TOML workflow definitions with conditions and chains

**Muscle memory design:**
- Spatial consistency: same zones, same positions across all stages
- Gesture consistency: `Enter` = primary action everywhere, `1-5` = stage switch
- **See → Pick → Detail → Act → Result** loop — identical rhythm, content changes
- Progressive trust: assist → guided → auto, earned per workflow type
- Ritual anchoring: morning 2min, mid-day 1min, Friday 5min

**Adaptive AI system:**
- Dynamic process model with phases, transitions, conditions (not rigid schedules)
- Unified AI agent that knows current phase, active work, blockers, patterns
- Adaptive triggers: `app.opened AND triage.stale > 1h` instead of `FREQ=DAILY;BYHOUR=9`
- Learning loop: system observes user behavior, adapts prompts/thresholds/timing
- The unified loop: events → process engine → workflow → state → UI → user acts → system learns

### 7. Universal Event System (`docs/event-system-matrix.md` — NEW)

Full event bus design that fits into the universal config contract.

**Current state (gap):**
- 1 event in `universal.toml`, 4 hard-coded in `ipc.ts`
- No persistence, no patterns, no middleware, no automation triggers from events

**Designed system:**
- **Event shape**: `AppEvent` with id, name, category, timestamp, source, correlationId, metadata
- **13 categories**: app, route, ui, issue, triage, pr, branch, build, automation, state, sprint, timer, system
- **~40 events cataloged** with source, payload, trigger conditions
- **5 bus operations**: publish, subscribe (glob patterns like `triage.*`, `*.completed`), capture, query, replay
- **Capture policy**: config-driven per category — persist (triage, automation, state, sprint, pr, issue) vs transient (ui, route, timer, app)
- **Event store**: SQLite for production, JSONL for debug — configurable in `universal.toml`
- **Full `[events.*]` TOML config** ready to drop into `universal.toml`
- **Automation trigger integration**: workflows subscribe to event patterns instead of only rrule
- **Query API**: by name, time range, correlationId, category — powers Observe stage, feedback loops, debugging

**How events connect workflows:**
```
pr.opened → pr-risk-scan workflow
branch.switched → context-restore workflow
triage.completed → daily-focus workflow (chain)
sprint.started → sprint-planning workflow
timer.ritual → morning/weekly rituals
issue.transitioned → re-triage workflow
```

### 8. Doc Updates (Existing Files)

All four original design docs were updated to integrate the reactive and event system:

| Doc | What Was Added |
|---|---|
| `lifecycle-ui.md` | Reactive display patterns table, per-stage auto-load mapping, interaction rhythm, primary action per stage, `Escape` key |
| `reminder-ui.md` | Reactive data sources per screen, loading behavior (mount → staleness → refresh → empty), ritual anchoring table, cyclical data flow between screens |
| `engineer-work-matrix.md` | State persistence architecture (config vs state), automation→display pipeline, reactive vs scheduled triggers, context switching support |
| `project-management-matrix.md` | Cycle feedback loops (daily→weekly→monthly with auto-generated artifacts), reactive automation pipeline table, signal→automation→display flow |
| `universal-matrix.md` | Event Matrix expanded with category/capture/kind fields, config example, store config |
| `routing-matrix.md` | Event Flow section (sources → bus → subscribers), events column in examples table |
| `reactive-workflows.md` | Event Catalog references `event-system-matrix.md`, expanded with categories and additional events |

### Doc Inventory (Complete)

| Doc | Status | Purpose |
|---|---|---|
| `lifecycle-ui.md` | Updated | UI layout, reactive display, muscle memory |
| `reminder-ui.md` | Updated | Wireframes, reactive data sources, rituals |
| `engineer-work-matrix.md` | Updated | Daily job matrix, state persistence, context switching |
| `project-management-matrix.md` | Updated | Cadence, feedback loops, automation pipeline |
| `universal-matrix.md` | Updated | Universal config contract, event matrix |
| `routing-matrix.md` | Updated | Data flow, IPC, event flow |
| `reactive-workflows.md` | **New** | Reactive automation model, missing matrices, muscle memory, adaptive AI |
| `event-system-matrix.md` | **New** | Universal event bus, catalog, capture, query, automation triggers |
| `external-app-matrix.md` | Unchanged | Jira API integration |
| `configuration-matrix.md` | Unchanged | Settings, env vars, build config |
| `automation-runner.md` | Unchanged | TOML-based runner |
| `main-app-usage.md` | Unchanged | User guide |

## Open Questions / Follow-Ups

### Code (from session 1)
- **Auto-triage on app open**: Currently auto-loads persisted state. Could also auto-fetch fresh from Jira if stale (e.g., >1 hour old). Controlled by a staleness threshold setting.
- **Manual bucket override**: Users may want to drag issues between NOW/NEXT/WAITING. Would require persisting user overrides that survive re-triage.
- **State file location**: Currently `_agents/state.json`. Could also use VS Code's `context.workspaceState` for truly opaque persistence, but the file approach keeps state inspectable.
- **Extending state.json**: The `AppPersistedState` schema is versioned (`version: 1`) and extensible. Future sections could include weekly review snapshots, career growth signals, etc.

### Design (from session 2 — research only, no code yet)
- **Event bus implementation**: The event system is fully designed in `docs/event-system-matrix.md`. Implementation requires: event bus abstraction, capture/store layer, subscription routing, and wiring into automation runner.
- **Workflow engine**: The reactive workflow model in `docs/reactive-workflows.md` needs a process engine that evaluates event triggers, conditions, and chains.
- **Adaptive triggers**: Replacing rigid rrule with condition-based triggers requires the event bus + state staleness checks.
- **Learning loop**: Tracking confirmation rates and user patterns needs an `adaptations` section in `state.json`.
- **External event sources**: Git hooks, Jira webhooks, and GitHub webhooks need ingestion endpoints that publish to the event bus.
- **Event store implementation**: SQLite vs JSONL decision, retention policy, query API.
- **Registry UI**: System > Registry page should show live event stream, subscription map, and event log query.
