---
source: claude
app: atlassian-sprint-view
workspace: repos/vscode/extensions/atlassian
created: 2026-02-05
tags: [settings, deduplication, ui, components, webview]
---

# Deduplicate Connection Settings Across Atlassian Webview

## Problem

Connection info (Base URL, Email, Auth mode, Config source) is displayed redundantly in 3 places:
- **Hero header** (App.tsx) — pills on every page
- **Overview page** (overview/index.tsx) — full kv-grid card duplicating the hero
- **Settings page** (settings/index.tsx) — near-identical kv-grid card

## Design: Each piece of info lives in ONE place

| Location | After refactor | Purpose |
|---|---|---|
| **Hero** (every page) | 3 pills: status, source, auth mode + action button | At-a-glance, always visible |
| **Overview** | "What to do next" guidance only (status card removed) | Welcome/orientation |
| **Settings** | Full kv-grid with ALL 5 fields + security card | Canonical detailed view |
| **Setup** | Edit form (unchanged except StatusPill) | Credential entry |

## New Components

- `lib/connection-labels.ts` — Pure functions for label derivations
- `components/StatusPill.tsx` — Replaces repeated pill pattern
- `components/ConnectionDetails.tsx` — Configurable kv-grid from context
- `components/OpenSettingsButton.tsx` — Replaces duplicated button

## Verification

1. Hero pills show correct status on all pages
2. Settings page shows all 5 fields (superset)
3. Overview page no longer duplicates connection info
4. Setup pill and Jira settings button still work
