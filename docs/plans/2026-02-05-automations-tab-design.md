# Automations Tab Design

## Overview

Add a new "Automations" tab to the VS Code extension webview that displays automation definitions and their execution history.

## Data Sources

| Data | Source | Format |
|------|--------|--------|
| Automation definitions | `~/.codex/automations/*/automation.toml` | TOML |
| Workspace automations | `${workspace}/_agents/automations/*/automation.toml` | TOML |
| Run timing (next/last) | `~/.codex/sqlite/codex-dev.db` → `automations` table | SQLite |
| Execution history | `~/.codex/sqlite/codex-dev.db` → `automation_runs` table | SQLite |
| Memory indicator | `~/.codex/automations/*/memory.md` exists check | File |

## Data Model

```typescript
// src/shared/types/automations.ts

interface Automation {
  id: string;
  name: string;
  prompt: string;
  status: "ACTIVE" | "INACTIVE";
  rrule: string;           // raw rrule string
  rruleHuman: string;      // "Every 6 hours" (computed)
  cwds: string[];
  hasMemory: boolean;      // memory.md exists
  nextRunAt?: number;      // from SQLite (epoch ms)
  lastRunAt?: number;      // from SQLite (epoch ms)
  source: "global" | "workspace";
}

interface AutomationRun {
  threadId: string;
  automationId: string;
  status: "ACCEPTED" | "ARCHIVED" | "PENDING";
  threadTitle?: string;
  inboxSummary?: string;
  sourceCwd?: string;
  createdAt: number;
  updatedAt: number;
  archivedReason?: string;
}
```

## Extension Handlers

```typescript
// src/extension/handlers/automations.ts

getAutomations(): Promise<Automation[]>
// - Scan TOML files from global + workspace paths
// - Join with SQLite automations table for timing
// - Check memory.md existence
// - Convert rrule to human-readable

getAutomationRuns(automationId: string): Promise<AutomationRun[]>
// - Query SQLite automation_runs table
// - Order by created_at DESC
// - Limit to recent N runs (e.g., 10)
```

## UI Layout

Route: `/automations` with `tabOrder: 5`

```
┌─────────────────────────────────────────────────────┐
│ Automations                                         │
├─────────────────────────────────────────────────────┤
│ ▼ Global (~/.codex/automations)                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ● Issues Triage                    ACTIVE       │ │
│ │   Every 6 hours · 2 cwds · has memory           │ │
│ │   "Use $linear to triage Linear issues..."      │ │
│ │   Last: 2h ago · Next: 4h                       │ │
│ │   ┌───────────────────────────────────────────┐ │ │
│ │   │ Recent Runs (expandable)                  │ │ │
│ │   │  ✓ ACCEPTED · "ALB-16 verified" · 1h ago  │ │ │
│ │   │  ○ ARCHIVED · "No relevant issues" · 7h   │ │ │
│ │   └───────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ▼ Workspace (_agents/automations)                   │
│   (empty state or list)                             │
└─────────────────────────────────────────────────────┘
```

**Card contents:**
- Name + status badge (green=ACTIVE, gray=INACTIVE)
- Schedule (human-readable) · cwd count · memory indicator
- Prompt preview (truncated ~100 chars)
- Last/next run times (relative format)
- Expandable "Recent Runs" with status icon, title, relative time

## Files to Create

| File | Purpose |
|------|---------|
| `src/webview/src/routes/automations/index.tsx` | Route component |
| `src/extension/handlers/automations.ts` | Data fetching handlers |
| `src/shared/types/automations.ts` | Shared type definitions |

## Files to Modify

| File | Change |
|------|--------|
| `src/extension/handlers/index.ts` | Import + spread automations handlers |
| `src/webview/src/types/handlers.ts` | Add handler signatures |

## Dependencies

- TOML parsing: `@iarna/toml` or similar
- SQLite: `better-sqlite3` or Bun's `bun:sqlite`
- rrule display: simple regex map for common patterns

## rrule → Human Readable

Common pattern mapping:
- `FREQ=HOURLY;INTERVAL=1` → "Every hour"
- `FREQ=HOURLY;INTERVAL=6` → "Every 6 hours"
- `FREQ=HOURLY;INTERVAL=24` → "Daily"
- `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` → "Weekdays"

## Future (Phase 2)

- Flamegraph visualization of execution steps
- Data exists in session JSONL files (`~/.codex/sessions/YYYY/MM/DD/*.jsonl`)
- Each file has `function_call` and `function_call_output` events with timestamps
- Can compute duration per step and render as horizontal timeline bars
