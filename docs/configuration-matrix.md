# Configuration Matrix

Complete reference for all configuration dimensions, settings, environment variables, build modes, and how they interact.

## Extension Modes

| Mode | Trigger | BuildWatcher | WebviewRoot | Server Auto-Start |
|------|---------|-------------|-------------|-------------------|
| **Development** | F5 / `--extensionDevelopmentPath` | YES | Searches filesystem | YES (if source found) |
| **Production** | Installed via VSIX / marketplace | NO | Searches workspace folders | YES (if source found) |

In both modes, the webview server auto-starts when `resolveWebviewRoot()` finds `src/webview/src` in the extension path or a workspace folder. The key difference is that Development mode also starts the build watcher for extension host code.

## Settings

All settings live under the `atlassian.*` namespace.

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `atlassian.baseUrl` | string | `""` | Jira site base URL |
| `atlassian.jiraUrl` | string | `""` | Legacy Jira URL (prefer `baseUrl`) |
| `atlassian.email` | string | `""` | Atlassian account email |
| `atlassian.apiToken` | string | `""` | API token (prefer `.env.local`) |
| `atlassian.jql` | string | `assignee = currentUser() AND sprint in openSprints() ORDER BY updated DESC` | JQL query for issues |
| `atlassian.maxResults` | number | `50` | Max issues per refresh |
| `atlassian.docsPath` | string | `""` | Path to docs directory |
| `atlassian.webviewPath` | string | `""` | Local HTML file for live-refresh |
| `atlassian.webviewServerUrl` | string | `""` | Dev server URL for HMR |

## Environment Variables

### Settings Resolution Priority

1. `.env.local` (all workspace folders, highest priority)
2. `.env` (all workspace folders)
3. `process.env`
4. VS Code settings (with `${env:VAR}` placeholder expansion)
5. Default values

### Env Var Mappings

| Setting | Env Vars (checked in order) |
|---------|-----------------------------|
| baseUrl | `ATLASSIAN_BASE_URL`, `JIRA_URL` |
| email | `ATLASSIAN_EMAIL`, `JIRA_USER_EMAIL` |
| apiToken | `ATLASSIAN_API_TOKEN`, `JIRA_API_TOKEN` |
| jql | `JIRA_JQL` |
| webviewServerUrl | `ATLASSIAN_WEBVIEW_SERVER_URL` |
| webviewPath | `ATLASSIAN_WEBVIEW_PATH` |
| docsPath | `ATLASSIAN_DOCS_PATH` |

### Webview-Specific Env Vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `ATLASSIAN_WEBVIEW_PORT` | `5173` | Port for Vite dev server |
| `ATLASSIAN_WEBVIEW_SERVER_URL` | (none) | Custom server URL |
| `ATLASSIAN_WEBVIEW_PATH` | (none) | Path to local HTML file |
| `ATLASSIAN_WEBVIEW_DEV_KEEPALIVE` | `""` | If `"1"`, keeps dev-webview.sh alive for preLaunchTask |

## Build System

### Scripts

| Script | What it does |
|--------|-------------|
| `bun run dev` | Parallel: watch-build extension + start Vite HMR server |
| `bun run dev:ext` | Watch-build extension only |
| `bun run dev:webview` | Start Vite dev server only (port 5173) |
| `bun run build` | Build extension (bun) + build webview (vite) |
| `bun run build:ext` | Bundle extension to `out/extension/` |
| `bun run build:webview` | Vite build webview to `out/webview/` |
| `bun run install:ext` | build + package VSIX + uninstall + install into Insiders |
| `bun run package` | Package into `.vsix` only |
| `bun run typecheck` | Type-check with tsgo |

### Build Outputs

```
out/
  extension/
    extension.js          # Main entry (CJS, Node target)
    extension.js.map
  webview/
    index.html            # Processed by vite build
    assets/               # Bundled JS/CSS with hashed names
```

### Installed Extension Location

```
~/.vscode-insiders/extensions/albertyang.atlassian-sprint-view-VERSION/
  package.json
  out/extension/extension.js
  out/webview/index.html
  out/webview/assets/
```

## Vite Configuration

| Dimension | Serve (`bun run dev:webview`) | Build (`bun run build:webview`) |
|-----------|------------------------------|--------------------------------|
| Base | `/` | `./` (relative) |
| Router plugin | `tanstackRouter` | `tanstackRouter` |
| HMR plugin | `vscodeWebviewHmr()` | none |
| React plugin | `@vitejs/plugin-react-swc` | `@vitejs/plugin-react-swc` |
| Output | N/A (served) | `out/webview/` |
| Port | 5173 (strict) | N/A |
| CORS | `*` | N/A |
| FS allow | `src/` (parent of webview) | N/A |

## Webview HTML Resolution

When the webview panel opens, `getWebviewHtmlSafe()` resolves HTML through this decision tree:

```
Is server URL configured AND reachable?
|
+-- NO --> [5] Production build (out/webview/index.html)
|          Falls back to error page if missing.
|
+-- YES --> Try sources in order:
    |
    [1] HMR plugin output (repo's out/webview/index.html)
    |   Requires: VSCODE_WEBVIEW_HMR_MARK + "atlassian-webview" in HTML
    |   Action: buildWebviewHtml(html, devUrl)
    |
    [2] Source index.html (repo's src/webview/index.html)
    |   Requires: "atlassian-webview" in HTML
    |   Action: Inject /@vite/client + React refresh preamble
    |           then buildWebviewHtml(html, devUrl)
    |
    [3] Installed production HTML with HMR mark
    |   Path: extensionPath/out/webview/index.html
    |   Requires: VSCODE_WEBVIEW_HMR_MARK + "atlassian-webview"
    |   Action: buildWebviewHtml(html, devUrl)
    |
    [4] Local webview path (from atlassian.webviewPath setting)
    |   Action: buildWebviewHtml(html) -- no dev server
    |
    [5] Fallback: production build --> error page
```

### `buildWebviewHtml` Processing

Applied to all loaded HTML:

1. **Rewrite asset URLs** -- `<script src>` and `<link href>` resolved against `assetBase` (dev server URL) or the webview URI
2. **Inject CSP** -- Content Security Policy meta tag (dev vs production, see below)
3. **Inject webview URI** -- `window.__webview_uri__` global for frontend asset resolution

## Webview Server Auto-Start

```
activate() -->
  cwd = resolveWebviewRoot(extensionPath)
  if (!cwd) --> NO SERVER (source not found)

  configuredUrl = normalizeServerUrl(getWebviewServerUrl())
  devUrl = configuredUrl || "http://localhost:5173/"

  if (configuredUrl && !isLocalhostUrl(devUrl))
    --> NO SERVER (remote URL, user starts manually)

  port = getServerPort(devUrl) || 5173
  webviewServer.start(cwd, port)
  waitForServer(devUrl, 20, 500) --> refreshPanel when ready
```

### `resolveWebviewRoot` Search Order

1. `extensionPath/src/webview/src` -- direct (F5 development)
2. `workspaceFolder/repos/vscode/extensions/atlassian/src/webview/src` -- monorepo
3. `workspaceFolder/src/webview/src` -- workspace root

Returns the parent directory containing `src/webview/src`, or `""` if not found.

### `dev-webview.sh` Logic

1. Check if port is in use
   - If Vite already running on it: reuse (exit 0)
   - If another process: kill it, wait up to 2s
2. Ensure `src/webview/node_modules` installed (`bun install`)
3. Start: `cd src/webview && bunx vite --port PORT --strictPort`

## Content Security Policy

| Context | script-src | connect-src | Inline scripts | WebSocket |
|---------|-----------|-------------|----------------|-----------|
| **Dev** (devOrigin set) | cspSource + `unsafe-inline` + `unsafe-eval` + devOrigin | devOrigin + `ws:` + `wss:` | YES | YES |
| **Production** | cspSource only | cspSource only | NO | NO |

The `devOrigin` is derived from the server URL (e.g., `http://localhost:5173`).

## Behavior Matrix

| Mode | WebviewRoot | Server Config | Server Starts | HMR | HTML Source |
|------|-------------|---------------|---------------|-----|------------|
| Any + no config + repo open | Found | localhost:5173 (default) | YES | YES | [2] Source index.html |
| Any + custom port | Found | localhost:PORT | YES | YES | [2] Source index.html |
| Any + remote URL | Found | https://remote.dev | NO | Maybe | [3] or [5] |
| Any + no config + no repo | Not found | N/A | NO | NO | [5] Production build |
| Any + webviewPath set | -- | -- | NO | NO | [4] Local file |

## HMR Flow

When the Vite dev server is running and the webview uses source HTML:

1. `/@vite/client` loaded from `http://localhost:5173` -- sets up HMR WebSocket
2. React refresh preamble injected -- enables component hot swaps
3. `/src/main.tsx` loaded from Vite -- app renders via `createRoot` + `RouterProvider`
4. File changes detected by Vite --> WebSocket push --> React Fast Refresh patches components
5. Route `staticData` changes (e.g., `tabLabel`) trigger re-evaluation via custom HMR bridge in `route-tabs.ts`

### What HMR covers

| Change type | Update method |
|------------|---------------|
| Component JSX/logic | React Fast Refresh (instant) |
| CSS/styles | Vite CSS HMR (instant) |
| Route `staticData` (tabLabel, tabOrder) | Custom HMR bridge (instant) |
| Route tree structure (new/deleted routes) | Full page reload |
| Extension host code | `Developer: Restart Extension Host` |

## Constants

| Constant | Value | Used for |
|----------|-------|----------|
| `DEFAULT_WEBVIEW_PORT` | `5173` | Default Vite dev server port |
| `REOPEN_APP_AFTER_RESTART_KEY` | `"atlassian.reopenAppAfterRestart"` | Persist panel state across restarts |
| `VSCODE_WEBVIEW_HMR_MARK` | `"vite-plugin-vscode-webview-hmr"` | Detect HMR-capable HTML |

## Activation Flow

```
1. Initialize services
   StorageService, AtlassianClient, AtlassianIssuesProvider,
   WebviewServer, ExtensionBuildWatcher, ExtensionInstaller,
   WebviewRenderTracker

2. Register panel serializer (restores panel on reload)

3. Register URI handler (vscode:// deep links)

4. Register tree data provider ("atlassianIssues" in Explorer)

5. Start build watcher (Development mode only)

6. Auto-start webview server (if source found + localhost)
   Wait for server --> refresh panel

7. Reopen panel if flagged from previous restart

8. Register commands:
   atlassian.refresh, atlassian.openApp, atlassian.login,
   atlassian.logout, atlassian.runDevWebview,
   atlassian.restartExtensionHost, atlassian.reloadWebviews,
   atlassian.syncEnvToSettings, atlassian.reinstallExtension,
   atlassian.openIssue
```

## URL Normalization

`normalizeServerUrl(raw)` handles various input formats:

| Input | Output |
|-------|--------|
| `localhost:5173` | `http://localhost:5173/` |
| `http://localhost:5173` | `http://localhost:5173/` |
| `https://dev.example.com:8443` | `https://dev.example.com:8443/` |
| `0.0.0.0:5173` | `http://localhost:5173/` |
| `::1:5173` | `http://localhost:5173/` |
| `""` | `""` |

`isLocalhostUrl` matches: `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, `::`.
