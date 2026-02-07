> Archived: 2026-02-07 — Implementation complete.

# Handoff: Owned Query Hygiene + URL State Readability

Date: 2026-02-07  
Repo: `repos/vscode/extensions/atlassian`

## Problem

1. VS Code webviews inject internal wrapper query params into the base document URL (`id`, `parentId`, `origin`, `swVersion`, etc.). These were leaking into:
   - the in-app omnibox "deep link" display/copy
   - pasted deep links parsed by the command palette
   - registry/entrypoint examples
2. Some UI states were encoded as comma-separated lists (`open=a,b,c`), which becomes noisy (`%2C`) in the URL bar.
3. Several TSX text nodes contained raw escape sequences like `Loading\u2026`, rendering literally as `\u2026`.

## Changes

### Query Param Sanitization (Wrapper vs App-Owned)

New helper:
- `src/webview/src/lib/sanitize-query.ts`

Behavior:
- filters known VS Code wrapper keys + `vscode-*` prefixes
- keeps only app-owned keys as part of the public URL/state contract

Applied in:
- `src/webview/src/App.tsx`
  - `searchParams` now sanitized
  - omnibox deep links and navigation parsing exclude wrapper params
- `src/webview/src/lib/parse-nav-target.ts`
  - pasted links have wrapper params stripped before routing

### Browser Links Stay Browser Links (Even When WS Bridge Connects)

Problem observed: when the browser dev UI connected to the WS bridge, the omnibox deep link would flip to
`vscode(-insiders)://...`, which is not the shareable URL for the browser surface.

Fix:
- `src/webview/src/App.tsx`
  - deep-link base is now selected by *surface* (`acquireVsCodeApi()` present) instead of host connectivity.

### Human-Friendly `open=` Serialization

- `src/webview/src/routes/system/registry.tsx`
  - `open=` now serializes as dot-separated list: `open=entrypoints.intents.matrix.runtime`
  - still parses legacy comma-separated input for backward compatibility

### Fixed Literal Escape Rendering

Patched TSX text nodes to use ASCII `...` where raw escapes were shown:
- `src/webview/src/routes/app/$.tsx`
- `src/webview/src/routes/execute/index.tsx`
- `src/webview/src/routes/system/docs.tsx`
- `src/webview/src/routes/review/index.tsx`
- `src/webview/src/routes/review/issues/$key.tsx`

Docs updated to match:
- `_agents/docs/universal-matrix.md`
- `_agents/docs/routing-matrix.md`

## How To Verify

1. Open VS Code webview.
2. Navigate to `System → Registry`.
3. Confirm:
   - URL bar/deep link copy does **not** include wrapper params (`id`, `parentId`, `origin`, etc.)
   - registry `open=` uses dot-delimited list (not `%2C`)
4. Paste a noisy deep link containing wrapper params into the omnibox/palette; ensure routing works and wrapper params are ignored.

## Next Steps (Non-Blocking)

1. Centralize "paste anything" link parsing/formatting into one shared module:
   - `parseAnyLink(input) -> { to, search, display, canonicalIntent }`
2. Add a first-class "URL State registry" (route → keys → meaning → defaults → history mode) so:
   - omnibox can suggest keys/values
   - registry can document query-state as a stable API surface
3. Optional UX: segment-aware omnibox navigation (Left/Right selects route segments, Up/Down selects options from registry).
