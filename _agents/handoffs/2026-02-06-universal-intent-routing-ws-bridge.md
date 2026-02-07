# Handoff: Universal Intent Routing + WS Bridge + `_agents` Surfacing

Date: 2026-02-06  
Workspace: `repos/vscode/extensions/atlassian`

## Why These Changes Exist

This extension is being evolved into a lifecycle “control center” (Plan → Execute → Review → Ship → Observe) that:

- Treats the extension host as the source of truth (state, auth, storage).
- Treats the webview UI as a client (requests data, renders, triggers actions).
- Surfaces a universal `_agents/` workspace convention (docs/runbooks/plans/skills/automations) directly in the UI.
- Provides a **single universal contract** for routes/actions/commands/events/settings that stays stable across environments.

The key problem in dev: running the webview UI in a normal browser (`bun run dev:webview`) breaks VS Code IPC (`acquireVsCodeApi` is missing). A WS bridge enables “browser dev mode” while keeping the same envelopes/handlers.

The key problem in “universal links”: you can’t make one `scheme://` work for browser navigation, VS Code deep links, and WebSockets. The scheme is the transport selector. The workable solution is a **canonical intent** (meaning) plus **environment wrappers** (transport).

## High-Level Outcomes

- A **Universal Registry** UI page that shows the configured contract (routes/actions/commands/events/settings), deep link base, and WS bridge endpoint/token status.
- The Registry includes a “matrix of matrices” visualization (intent → action → envelope → transport → effects) and quick-jump cards for the major contract surfaces.
- The Registry UI is now organized around intent-level concepts (Entry points, Runtime, Navigation, Intents, Operations, Signals, Preferences, Persistence) and cross-links surfaces (e.g. which actions map to a route/command).
- A **WS bridge** so browser dev UI can speak the same IPC envelope as the VS Code webview.
- A canonical universal URL format that is transport-agnostic (meaning-only), with wrappers that open correctly from VS Code or a browser.
- Canonical scheme is now `app://` (host is the `appId`), with a path-based dispatcher wrapper at `/app/...`.
- The URL bar “copy link” now consistently emits `/app/<appId>/route/...` wrappers (instead of `/open/...`), so the same link pattern works across environments.
- Both the URL bar and the in-app command palette can now accept pasted links (`#/...`, `vscode://...`, deep links, canonical intent URLs) and route them through the same parser.
- The omnibox is now usable in browser/dev mode (navigation + palette) even when the VS Code APIs are unavailable.
- The hash history now **preserves the webview’s base query in the URL** (required for VS Code) but **prevents it from leaking into router search params** (avoids pollution from `id/parentId/origin/...`).
- The command palette is now a height-aware modal (scrollable results, full-screen fallback on short viewports) and uses the View Transitions API for shared-element animation between the overlay pill and the palette when available.
- Overlay / stage UI surfacing rituals by linking stage pages to relevant docs/runbooks/skills.
- Docs updated to reflect the intent+transport model (see `_agents/docs/universal-matrix.md`, `_agents/docs/routing-matrix.md`, `_agents/docs/main-app-usage.md`).

## Canonical Links: The Alignment Model

### 1) Canonical intent URL (meaning)

This is the “single universal string” runbooks/skills/automations can output:

- `app://atlassian/route/plan`
- `app://atlassian/doc/docs/universal-matrix.md`
- `app://atlassian/skill/release-promotion`
- `app://atlassian/rpc/getUniversalConfig`
- `app://atlassian/command/openApp?args=[]`
- `app://atlassian/action/dev/syncEnvToSettings`

```toml
[app]
# Canonical scheme + app id (host) for universal links
id = "atlassian"
intentScheme = "app"
```

Implementation notes:
- Parsing is allow-listed against the configured scheme (plus a legacy fallback) to avoid accidentally executing foreign protocols.
- If you want web-native registration, use a `web+...` scheme and an HTTPS wrapper page.

### 2) Environment wrappers (transport)

Wrappers carry the intent via a single entry point (`/app`):

- VS Code deep link wrapper:
  - `${uriScheme}://${extensionId}/app/atlassian/route/plan`
- Browser wrapper (dev):
  - `http://localhost:5173/#/app/atlassian/route/plan`

Notes:
- Route/doc/skill intents auto-dispatch.
- Command/RPC/action intents require user confirmation on `/app/...` to avoid drive-by execution.

## Transport Contract: One Envelope Across postMessage + WS

The UI/extension use a transport-agnostic envelope:

```ts
type IpcEnvelope =
  | { kind: "rpc"; payload: string }
  | { kind: "event"; name: string; payload?: unknown }
  | { kind: "command"; name: string; payload?: unknown };
```

- VS Code webview transport: `webview.postMessage(IpcEnvelope)`
- Browser dev transport: WS bridge (`ws://host:port/?token=...`) sends/receives the same envelopes

The WS bridge gates outbound *commands* until it receives `IPC_EVENTS.WEBVIEW_READY`, and then flushes “last known commands” to avoid missing early navigation.

Transport guidance:
- The thing you actually want to unify long-term is the contract (intent/actions/routes/envelope), not the transport.
- Prefer `acquireVsCodeApi().postMessage(...)` inside VS Code webviews (reliability, no ports/CSP/tunneling).
- Use WS only for external/browser clients (dev now; prod later only if you accept the operational/security cost).

## Where To Look (Key Files)

### Universal contract / routing

- `src/shared/contracts/intent.ts`
  - `parseUniversalIntentUrl(...)`
  - `buildUniversalIntentUrl(...)`
  - scheme normalization + allow-listing
- `src/webview/src/routes/app/$.tsx`
  - `/app/...` dispatcher page + confirmation UI for command-like intents
- `src/webview/src/routes/intent.tsx`
  - legacy `/intent?u=...` redirect to `/app/...`
  - fix: uses `location.searchStr` (string) for query parsing
- `src/webview/src/router.tsx`
  - custom hash history: keep VS Code base query stable but ignore it for router search
- `src/webview/src/App.tsx`
  - URL bar “copy link” now uses `/app/<appId>/route/...` wrapper consistently
- `src/webview/src/components/UrlBar.tsx`
  - URL bar accepts canonical universal URLs and routes them through `/app`
- `src/webview/src/lib/parse-nav-target.ts`
  - shared “paste anything” navigation parser used by URL bar + command palette
  - normalizes dot-form dispatcher ids into URL-friendly path segments (e.g. `.../action/atlassian.foo.bar` → `.../action/foo/bar`)
- `src/webview/src/lib/execute-universal-action.ts`
  - single action execution routine used by Registry + command palette (prefers navigation vs RPC/command based on domain)
- `src/webview/src/components/AppOverlay.tsx`
  - listens for `atlassian:commandPalette` events to open the palette from anywhere in the app
- `src/webview/src/components/AppOverlaySearch.tsx`
  - command palette results for routes/actions + direct “Open intent / Go to” for pasted links
  - segment editing works for dispatcher kinds beyond routes (`/app/<appId>/{route|action|command|rpc}/...`)
- `src/shared/universal/types.ts`
  - `app.intentScheme?: string`
- `config/universal.toml`
  - `[app] intentScheme = ...`

### System registry surface

- `src/webview/src/routes/system/registry.tsx`
  - shows deep link base, canonical intent examples, WS endpoint, and registries
- `src/webview/src/App.css`
  - styles for the Registry “matrix of matrices” flow + matrix cards

### WS bridge

- `src/extension/service/webview-ws-bridge.ts`
  - WS server + auth + readiness gating + flush on ready
- `src/webview/src/contexts/jsonrpc-rx-context.tsx`
  - browser WS client that mimics `acquireVsCodeApi()` + auto reconnect

### `_agents` integration

- `_agents/docs/*`, `_agents/runbooks/*`, `_agents/plans/*`, `_agents/skills/*`
- `src/extension/service/agents-scaffold.ts` copies extension-bundled `_agents` → workspace `_agents` if missing.

### Docs / matrices updated

- `_agents/docs/universal-matrix.md`
  - intent link model + “unify contract, not transport” guidance
- `_agents/docs/routing-matrix.md`
  - deep links vs canonical intent + wrappers
- `_agents/docs/main-app-usage.md`
  - updated deep link guidance to prefer `/app/...` wrappers
- `src/webview/src/routes/system/docs.tsx`
  - markdown link handler now treats canonical universal links (`app://...`) as internal navigation via `/app/...`

## Verified

- `bun run typecheck`
- `bun run lint`
- `bun run build:webview`
- `bun run build:ext`
- `bun run package`
- `code-insiders --install-extension atlassian-sprint-view.vsix --force`

## Streamlined Routing Refactor (2026-02-07)

The deep link routing stack was refactored for reliability and clarity:

### Bug Fixes

1. **`injectInitialRoute` always overrides hash** — removed the `if(!location.hash)` guard that prevented deep links from overriding existing hashes (e.g., `#/plan` from a prior session). Explicit navigation always takes priority.
2. **URI handler: navigate before showApp** — swapped the order so `ViewProviderPanel.initialRoute` is set *before* HTML is built. This makes `injectInitialRoute` actually embed the target route.
3. **`buildDeepLinkUrl` no longer normalizes** — removed the fragile `normalizeRoutePath` call; dispatcher paths should not go through route normalization.
4. **Surface-aware deep link base** — `deepLinkBase` is selected by surface (`acquireVsCodeApi` present), not WS bridge connectivity. Browser links no longer flip to `vscode://` when the bridge connects.

### New Helpers (`src/shared/contracts/routes.ts`)

| Helper | Purpose |
| --- | --- |
| `buildAppDispatcherPath(appId, routePath)` | Wraps a route path → `/app/{appId}/route{routePath}` |
| `isAppDispatcherPath(path)` | Checks if a path is already in dispatcher format (prevents double-wrapping) |

### JSDoc Documentation Added

Comprehensive JSDoc was added to all key routing functions:
- `normalizeRoutePath`, `extractIssueKey`, `routeHintToPath`
- `parseRouteHash`, `buildRouteHash`, `buildDeepLinkBase`, `buildDeepLinkUrl`
- `buildAppDispatcherPath`, `isAppDispatcherPath`, `resolveRouteFromDeepLink`
- `parseUniversalIntentUrl`, `buildUniversalIntentUrl`, `resolveIntentToAction`
- `AtlassianUriHandler` (class-level + navigation flow)
- `requestNavigate`, `injectInitialRoute` (lifecycle docs)

### Docs Updated

- `_agents/docs/routing-matrix.md` — deep link construction table, navigation flow diagram, route vs dispatcher path distinction
- `_agents/docs/configuration-matrix.md` — route + deep link helper reference table
- `_agents/docs/universal-matrix.md` — code examples for constructing deep links, surface-aware base selection

## Open Questions / Follow-Ups

- If you want true web-native protocol registration, consider using a `web+...` intent scheme (e.g. `web+agent`) and a hosted HTTPS wrapper URL for `registerProtocolHandler`.
- If you want one canonical scheme across *multiple apps*, the current grammar already includes `appId` as the `app://<appId>/...` hostname. The remaining decision is how you want to map `appId` → a concrete runtime target (which extension/web app to open).
- If you want deep link wrappers clickable inside the docs pane (e.g. `${uriScheme}://${extensionId}/app/...`), decide whether the docs handler should route those as well (or always open externally).
