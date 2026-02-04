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

You can supply OAuth settings via `.env.local` (or `.env`) in the workspace root.
The extension loads these and will also resolve `${env:VAR}` placeholders in settings.

- `ATLASSIAN_OAUTH_CLIENT_ID`
- `ATLASSIAN_OAUTH_CLIENT_SECRET`
- `ATLASSIAN_OAUTH_SCOPES`
- `ATLASSIAN_OAUTH_REDIRECT_PORT`

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
- Press `F5` to launch an Extension Development Host.

## Install (Code - Insiders)

- `bun run install:extension:local` installs the local VSIX and attempts to reload the window via AppleScript.
  `bun run install:extension` is an alias for `install:extension:local`.
- `bun run install:extension:market` installs the Marketplace build.
  If the reload step fails, grant Accessibility permissions to your terminal, or run `Developer: Reload Window` manually.

## Publish

- `bun run publish` publishes the current version using `VSCE_PAT` from `.env.local`.
- `bun run publish:patch` bumps the patch version and publishes.
- `bun run publish:minor` bumps the minor version and publishes.
- `bun run publish:major` bumps the major version and publishes.
