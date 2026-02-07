> Archived: 2026-02-07 — Implementation complete.

# Brief: Universal Routing + Omnibox + Registry (Context)

Date: 2026-02-06  
Workspace: `repos/vscode/extensions/atlassian`

## Goal

Make the “control center” app (Plan → Execute → Review → Ship → Observe → System) work as one coherent system across environments:

- VS Code webview panel (IPC via `postMessage`)
- Browser dev UI (WS bridge)
- Deep links (VS Code URI handler)

The long-term unification target is the **contract** (routes/actions/commands/events/envelope), not any single transport.

## Canonical Model

- **Meaning link:** `app://<appId>/<kind>/<target>?...`
- **Dispatcher wrapper:** `/app/<appId>/<kind>/<target>?...`
  - Safe kinds (route/doc/runbook/plan/skill/automation) auto-dispatch.
  - Command/RPC/action kinds require confirmation to avoid drive-by execution.

## UX Integration

- The top URL bar (omnibox) and command palette accept “paste anything” inputs:
  - `app://...`, legacy `<scheme>://...`, `vscode(-insiders)://...`, `#/...`, raw `/path`
- Browser/dev mode keeps omnibox navigation usable even without VS Code APIs.
- Command palette supports link/route segment editing with Left/Right and registry-derived suggestions.
- Segment editing works for dispatcher kinds beyond routes (`/app/<appId>/{route|action|command|rpc}/...`).

## Registry as Contract Surface

System → Registry is the human-facing “matrix of matrices”:

- Entry points (deep links, web URLs, intent URLs, WS endpoint)
- Runtime (platforms/environments)
- Navigation/Intents/Operations/Signals/Preferences/Persistence
- `_agents/` workspace convention (docs/runbooks/plans/skills/automations)

## Notable Implementation Detail

VS Code webviews have a base document query (`?id=...&parentId=...&origin=...`) that must remain in the URL, but should not pollute app search params.

Router history now:

- **Preserves** the base query in the URL for VS Code
- **Ignores** the base query when deriving router search state (only hash query affects the app)

## Status (As Of 2026-02-07)

- Fixed lingering JSX escape rendering (`\\u2026`, `\\u00b7`) in a few routes so UI does not show raw escape sequences.
- Registry `open=` query param is now human-friendly:
  - Preferred: `open=entrypoints.intents.matrix.runtime`
  - Backward compatible: commas still parse, but dots avoid `%2C` in the omnibox.
- Added “wrapper query param” sanitization so VS Code internal webview params do not leak into app deep links / registry / omnibox:
  - New: `src/webview/src/lib/sanitize-query.ts`
  - Applied in: `src/webview/src/App.tsx` and `src/webview/src/lib/parse-nav-target.ts`
- Adjusted deep-link selection so browser URLs stay browser URLs even when the WS bridge connects:
  - deep-link base is keyed off `acquireVsCodeApi()` (surface), not host connectivity.

## Parallel Agent Work Package (Non-Conflicting)

This repo has two orthogonal tracks right now:

- Track A (in progress): omnibox/palette parsing + URL presentation details (query sanitization, human-friendly query encoding, etc.)
- Track B (safe to parallelize): “App as config” engine surfaces (schema, workspace config, app-global-state cache)

If you are a parallel agent, pick **Track B** only to avoid merge conflicts.

### Track B: App Engine Config + Workspace State Cache

Goal: define a deterministic, app-agnostic configuration surface that can generate (or constrain) the registry/runtime behavior, and expose a read-only “full app state” cache file in the workspace for humans/agents.

Deliverables (extension-dev facing):

- `config/app.schema.json` (JSON Schema)
  - Defines the “app engine” configuration surface (registry sources, storage rules, messaging/transport options, logging/tracing knobs, etc.)
- `config/app.config.toml` (engine defaults)
  - Default engine config for the extension itself (safe defaults; no secrets).
  - Should compose cleanly with `config/universal.toml` (do not fork semantics).

Deliverables (workspace/user facing):

- `$workspace/_agents/app.config.toml`
  - User config (safe + ergonomic; no secrets). Keep it scoped to the user’s intent, not engine internals.
- `$workspace/_agents/app-global-state.json`
  - Read-only cache (written by the extension) of the effective app state/config/runtime info.
  - This file is meant for “debugging + other agents”, not for the app to trust as input.

Implementation guidance:

- Prefer additive changes (new files + new service) over refactors.
- Ensure secrets never land in `_agents/app-global-state.json`.
- Consider using `unjs/c12` for config merging and env overrides, but it’s acceptable to reuse existing TOML parsing (`src/shared/simple-toml`) if that’s already the established pattern.
- Use the existing “Universal registry” contract as the core: the engine config should *reference* or *extend* it, not replace it.

Suggested file touch-set (safe):

- `config/app.schema.json` (new)
- `config/app.config.toml` (new)
- `src/extension/service/*` (new service + minimal wiring)
- `src/extension/handlers/config.ts` (optional: expose paths/flags in `getFullConfig`)
- `_agents/docs/configuration-matrix.md` (optional: document the new config surfaces)

Do not touch (active in Track A, likely to conflict):

- `src/webview/src/lib/parse-nav-target.ts`
- `src/webview/src/routes/system/registry.tsx`
- `src/webview/src/routes/system/docs.tsx`
- `src/webview/src/components/AppOverlaySearch.tsx`
- `src/webview/src/components/UrlBar.tsx`
- `src/shared/contracts/routes.ts`

Testing (for Track B):

- `bun run lint`
- `bun run build:ext`
- Manual: open the extension, confirm `_agents/app-global-state.json` is created/updated and contains no secrets.

## Deferred Refactors (Why + What To Centralize)

### Why We Deferred Bigger Refactors

- The routing/omnibox work touches “hot” files used by both the webview runtime and the extension’s deep-link parsing. Large refactors here have a high regression risk.
- This repo is actively being worked in parallel. Minimizing churn reduces merge conflicts and avoids blocking other work streams.
- Several subsystems are mid-migration (legacy `/open`, legacy `/intent`, new `/app` dispatcher, new WS bridge, new Registry UI). Deleting/flattening too early would strand existing links and docs.

### What To Streamline Next (Concise + Scalable)

- Centralize the “paste anything” grammar into a single shared module:
  - `parseAnyLink(input) -> { to: string; search: Record<string,string>; display: string; passthrough?: URLSearchParams }`
  - Reuse it from URL bar, command palette, docs-link handler, and deep-link handler.
- Add an explicit **URL State registry** (owned query keys + meaning + defaults):
  - Keep it in `config/universal.toml` or a new `config/app.config.toml` section.
  - Use it for: sanitizing displayed URLs, validating search state, generating omnibox hints, and documenting query-state.
- Separate “app-owned query params” from “transport wrapper params”:
  - VS Code webview wrapper params (`id`, `parentId`, `origin`, etc.) must remain pass-through but should never appear as app state.
  - The UI should display only app-owned keys; unknown keys should be treated as hidden passthrough unless explicitly registered.
- Unify link formatting:
  - Canonical: `app://<appId>/<kind>/<target>` (meaning)
  - Wrapper: `/app/<appId>/<kind>/<target>` (internal dispatcher)
  - Environment-specific openables should be derived from these, not built ad-hoc in UI components.
- Make URL-state the default for component/page interaction state:
  - Use `nuqs` for any state that should be shareable/bookmarkable (tabs, filters, expanded sections, focus/anchor, view modes).
  - Keep volatile UI-only state (transient hover, ephemeral modals) out of the URL.
