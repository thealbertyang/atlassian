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

- `bun run install:extension` installs the VSIX and attempts to reload the window via AppleScript.
  If the reload step fails, grant Accessibility permissions to your terminal, or run `Developer: Reload Window` manually.
