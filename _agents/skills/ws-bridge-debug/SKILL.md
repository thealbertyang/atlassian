# Skill: WS Bridge Debug

Repeatable workflow for debugging the browser dev transport (WS bridge).

## When To Use

- Browser UI shows "Webview Unavailable"
- Browser UI shows "WS bridge auth failed"
- RPC handlers fail to respond in browser dev mode

## Inputs

- Browser URL (including any `?wsToken=...`)
- VS Code Output panel logs (Atlassian)
- Current VS Code product (stable vs insiders)

## Outputs

- Confirmed cause (token/origin/port/runtime) + fix

## Workflow

1. Confirm the endpoints
   - Vite dev server: `http://localhost:5173`
   - WS bridge: `ws://127.0.0.1:5174/?token=...`

2. Confirm token path
   - Preferred: token injected into Vite via `VITE_ATLASSIAN_WS_BRIDGE_TOKEN`
     - This happens when the extension starts the dev server.
   - Fallback: set once via browser URL:
     - `http://localhost:5173/?wsToken=...`
     - The UI persists it to localStorage.

3. Check **System → Registry**
   - WS bridge port + token presence
   - Deep link base (scheme + extension id)

4. Check VS Code Output logs
   - Look for `[ws-bridge]` lines:
     - listening
     - rejected client (origin/token)
     - connected/disconnected

5. Fix common causes
   - Token mismatch: re-copy token from System → Settings/Registry.
   - Wrong origin allowlist: set `ATLASSIAN_WS_BRIDGE_ORIGINS` or use default localhost origins.
   - Port conflicts: stop any process binding `5174`.

## Safety Rules

- WS bridge is for local/dev only. Do not bind to public interfaces unless you fully understand the security tradeoffs.

## Related

- Plan: `plans/luminous-jingling-thompson.md`
- Docs: `docs/configuration-matrix.md`, `docs/routing-matrix.md`
