# Atlassian Sprint Issues (VS Code Extension)

Shows your open sprint Jira issues in the Explorer view.

## Features

- Tree view in Explorer with issues from the current open sprint assigned to you
- Login via Atlassian OAuth 2.0 (3LO) or API token
- Refresh and open issue commands

## Setup

### API Token

1. Run `Atlassian: Login` from the Command Palette.
2. Enter your Jira site URL, email, and API token.

### OAuth 2.0 (3LO)

1. Create an OAuth 2.0 (3LO) app in the Atlassian developer console.
2. Add a redirect URL in your app that matches the local callback, for example: `http://127.0.0.1:8765/callback`.
3. In VS Code settings, configure:
   - `atlassian.oauthClientId`
   - `atlassian.oauthClientSecret`
   - `atlassian.oauthRedirectPort` (if you want a different port)
4. Run `Atlassian: Login` and choose OAuth.

## Settings

- `atlassian.jql`: JQL used to fetch issues. Default: `assignee = currentUser() AND sprint in openSprints() ORDER BY updated DESC`
- `atlassian.maxResults`: Max issues returned per refresh.
- `atlassian.oauthClientId`: OAuth client ID.
- `atlassian.oauthClientSecret`: OAuth client secret.
- `atlassian.oauthScopes`: OAuth scopes (default: `read:jira-work offline_access`).
- `atlassian.oauthRedirectPort`: Local port for OAuth callback.

### Environment Overrides

You can supply OAuth settings via `.env.local` (or `.env`) in any workspace folder.
The extension loads these and will also resolve `${env:VAR}` placeholders in settings.

- `ATLASSIAN_OAUTH_CLIENT_ID`
- `ATLASSIAN_OAUTH_CLIENT_SECRET`
- `ATLASSIAN_OAUTH_SCOPES`
- `ATLASSIAN_OAUTH_REDIRECT_PORT`

API token settings can also be provided via `.env.local` (or `.env`):

- `JIRA_URL` (e.g., `https://your-domain.atlassian.net`)
- `JIRA_USER_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_JQL` (optional override for the JQL query)

### Webview Dev (Live Refresh)

If you want fast iteration on the login panel UI, set:

- `atlassian.webviewDevPath` in settings, or
- `ATLASSIAN_WEBVIEW_DEV_PATH` in `.env.local`

Point it to a local HTML file (for example: `.../webview/login.html`). The panel will
reload whenever that file changes. By default, the extension will use
`webview/login.html` from its install path if present, so editing that file in the
repo also live-reloads without extra config. You still need `Developer: Reload Window`
for extension host changes (tree view logic, API code).

## Commands

- `Atlassian: Login`
- `Atlassian: Logout`
- `Atlassian: Refresh Issues`
- `Atlassian: Open Issue`

## Development (Bun)

- `bun install`
- `bun run compile`
- `bun run lint`
- `bun run fmt`
- `bun run dev` opens the login panel, sets the webview dev path (if not set),
  and runs `tsgo --watch`.
- Press `F5` to launch an Extension Development Host.

## Install (Code - Insiders)

- `bun run install:extension:local` installs the local VSIX and attempts to reload the window via AppleScript.
  `bun run install:extension` is an alias for `install:extension:local`.
- `bun run install:extension:market` installs the Marketplace build.
  If the reload step fails, grant Accessibility permissions to your terminal, or run `Developer: Reload Window` manually.

## Publish

- `bun run publish` publishes the current version using `VSCE_PAT` from `.env.local`, then
  waits for Marketplace propagation and installs the new version locally.
  It installs the exact version to avoid downgrades while the CDN propagates.
- `bun run publish:patch` bumps patch, publishes, installs from Marketplace, then tags the release.
- `bun run publish:minor` bumps minor, publishes, installs from Marketplace, then tags the release.
- `bun run publish:major` bumps major, publishes, installs from Marketplace, then tags the release.
- `bun run release:patch` does the full flow: bump patch, lint/format/compile, show recent commits,
  prompt for a commit message, commit + push, publish + install, then tag. Output is also written
  to `.release.log`. If `gh` is installed, it shows GitHub Actions status.
- `bun run release:minor` same as above for minor versions.
- `bun run release:major` same as above for major versions.
- `bun run release:status` shows the latest GitHub Actions release status.

### Reliable Marketplace Install (launchd)

If Marketplace propagation is slow, you can install a launchd helper that polls
for the new version and installs it as soon as it appears.

- `bun run launchd:install` installs a LaunchAgent that checks every 2 minutes.
- `bun run launchd:uninstall` removes the LaunchAgent.

Logs are written to `~/Library/Logs/atlassian-sprint-view-marketplace.log`.

- `bun run release:tag` creates and pushes a git tag for the current version.

## CI/CD

This repo includes a GitHub Actions workflow at `.github/workflows/release.yml`.
Push a tag like `v0.0.5` and it will:

- build + package the VSIX
- publish to the Marketplace (requires `VSCE_PAT` secret)
- create a GitHub Release and attach the VSIX
