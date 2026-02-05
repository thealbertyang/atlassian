# Atlassian Sprint Issues (VS Code Extension)

Shows your open sprint Jira issues in the Explorer view.

## Overview

Atlassian Sprint Issues is a VS Code extension that keeps your current sprint Jira issues visible in the Explorer view. It pairs a lightweight tree view with a webview panel for connection, issue drill‑downs, and future workflow views.

Primary flows:

1. Connect to Jira (API token or OAuth).
2. View and refresh your sprint issues.
3. Open an issue in the app or browser.

## Features

- Tree view in Explorer with issues from the current open sprint assigned to you
- Login via Atlassian OAuth 2.0 (3LO) or API token
- Refresh and open issue commands

## Setup

Quick start:

1. Run `Atlassian: Open App`.
2. Choose API token or OAuth.
3. Confirm the connection and refresh the tree.

### API Token

1. Run `Atlassian: Open App` from the Command Palette.
2. Enter your Jira site URL, email, and API token.

### OAuth 2.0 (3LO)

1. Create an OAuth 2.0 (3LO) app in the Atlassian developer console.
2. Add a redirect URL in your app that matches the local callback, for example: `http://127.0.0.1:8765/callback`.
3. In VS Code settings (or `.env.local`), configure:
   - `atlassian.oauthClientId`
   - `atlassian.oauthClientSecret`
   - `atlassian.oauthRedirectPort` (if you want a different port)
4. Run `Atlassian: Open App` and choose OAuth.

If you use `.env.local`, run `Atlassian: Sync .env.local to Settings` to copy values into workspace settings.

## Settings

| Setting | Purpose | Default | Notes |
| --- | --- | --- | --- |
| `atlassian.baseUrl` | Jira site base URL | `""` | Example: `https://your-domain.atlassian.net` |
| `atlassian.jiraUrl` | Legacy Jira URL | `""` | Prefer `atlassian.baseUrl` |
| `atlassian.email` | Atlassian account email | `""` | Used for API token auth |
| `atlassian.apiToken` | Atlassian API token | `""` | Prefer `.env.local` or OAuth |
| `atlassian.jql` | JQL used to fetch issues | `assignee = currentUser() AND sprint in openSprints() ORDER BY updated DESC` | User intent only |
| `atlassian.maxResults` | Max issues per refresh | `50` | Keep small for performance |
| `atlassian.oauthClientId` | OAuth client ID | `""` | Required for OAuth |
| `atlassian.oauthClientSecret` | OAuth client secret | `""` | Required for OAuth |
| `atlassian.oauthScopes` | OAuth scopes | `read:jira-work offline_access` | Keep minimal |
| `atlassian.oauthRedirectPort` | OAuth callback port | `8765` | Local only |
| `atlassian.webviewDevPath` | Local HTML path for webview dev | `""` | Live reloads on file change |
| `atlassian.webviewDevServerUrl` | Dev server URL for HMR | `""` | Example: `http://localhost:5173` |

### Environment Overrides

You can supply settings via `.env.local` (or `.env`) in any workspace folder.
The extension loads these and will also resolve `${env:VAR}` placeholders in settings. Use `Atlassian: Sync .env.local to Settings` to copy values into workspace settings.

OAuth env vars:

- `ATLASSIAN_OAUTH_CLIENT_ID`
- `ATLASSIAN_OAUTH_CLIENT_SECRET`
- `ATLASSIAN_OAUTH_SCOPES`
- `ATLASSIAN_OAUTH_REDIRECT_PORT`

API token settings can also be provided via `.env.local` (or `.env`):

API token env vars:

- `JIRA_URL` (e.g., `https://your-domain.atlassian.net`)
- `ATLASSIAN_BASE_URL`
- `JIRA_USER_EMAIL`
- `ATLASSIAN_EMAIL`
- `JIRA_API_TOKEN`
- `ATLASSIAN_API_TOKEN`
- `JIRA_JQL` (optional override for the JQL query)

Webview dev env vars:

- `ATLASSIAN_WEBVIEW_DEV_PATH`
- `ATLASSIAN_WEBVIEW_DEV_SERVER_URL`

## Dev Design

The extension follows a predictable flow: user intent or system events are normalized into actions, the extension host produces effects, then storage and UI updates follow. The webview is a renderer and never writes storage directly.

Design rules we follow:

1. Settings represent user intent, not cache.
2. Secrets live in `context.secrets`.
3. Large data goes in `storageUri` or `globalStorageUri`.
4. Commands stay minimal and high‑value.

Related docs:

- `docs/routing-matrix.md`
- `docs/external-app-matrix.md`
- `docs/main-app-usage.md`

### Webview Dev (Live Refresh)

If you want fast iteration on the login panel UI, set:

- `atlassian.webviewDevPath` in settings, or
- `ATLASSIAN_WEBVIEW_DEV_PATH` in `.env.local`

Point it to a local HTML file (for example: `.../webview/login.html`). The panel will
reload whenever that file changes. By default, the extension will use
`webview/login.html` from its install path if present, so editing that file in the
repo also live-reloads without extra config. You still need `Developer: Reload Window`
for extension host changes (tree view logic, API code).

### Webview Dev (HMR via Vite)

For a richer UI, you can run a local dev server and have the webview load it:

- `ATLASSIAN_WEBVIEW_DEV_SERVER_URL=http://localhost:5173`
- `bun run dev:webview`

Then reopen `Atlassian: Login`. The webview will load the dev server and get HMR.
The dev server runs on `http://localhost:5173` by default so the
extension can find it.

#### HTTPS (optional)

If you want HTTPS locally (some browsers auto-upgrade), run:

- `bun run dev:webview:https`

This generates a self-signed cert in `src/webview/.certs` and starts Vite at
`https://localhost:5173`. You may need to trust the cert in Keychain.

### Webview Build (Production)

For Marketplace builds, the extension will load `out/webview/index.html`.
You can generate it locally with:

- `bun run build:webview`

### Extension Host Workflow

Run an Extension Development Host (F5) and keep a watch build running:

- `bun run watch` for extension host code
- `Developer: Restart Extension Host` after changes

If you want both HMR + watch: `bun run dev:hmr`

### VS Code Tasks (Seamless)

Use the provided launch config:

1. Press `F5` and choose `Run Extension (HMR)`.
2. It will start `tsgo --watch` and `vite dev` automatically.
3. Use `Developer: Restart Extension Host` after host code changes.

## Commands

- `Atlassian: Login`
- `Atlassian: Logout`
- `Atlassian: Refresh Issues`
- `Atlassian: Open Issue`

## Docs

- `docs/routing-matrix.md`
- `docs/external-app-matrix.md`
- `docs/main-app-usage.md`
- `docs/engineer-work-matrix.md`
- `docs/lifecycle-ui.md`
- `docs/project-management-matrix.md`
- `docs/reminder-ui.md`
- `docs/automation-runner.md`

## Development (Bun)

- `bun install`
- `bun run dev` starts the TypeScript watch build for the extension.
- Press `F5` to launch an Extension Development Host.
  The webview dev server starts automatically in development mode.

## Install (Code - Insiders)

- `bun run install:ext` builds, packages, and installs the local VSIX.

## Publish

- `bun run publish` publishes the current version using `VSCE_PAT` from `.env.local`.

## CI/CD

This repo includes a GitHub Actions workflow at `.github/workflows/release.yml`.
Push a tag like `v0.0.5` and it will:

- build + package the VSIX
- publish to the Marketplace (requires `VSCE_PAT` secret)
- create a GitHub Release and attach the VSIX
