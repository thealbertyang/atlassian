# Skill: Observe Triage

Repeatable workflow for the **Observe** stage: classify a signal quickly and route it to a concrete next action (fix now, schedule, or document).

## When To Use

- A user reports broken behavior.
- Output logs show repeated errors.
- WS bridge/browser dev mode fails to connect.
- Automations appear stuck or not scheduling.

## Inputs

- Symptom description (what happened)
- Where it happened (route/surface)
- Environment (VS Code webview vs browser dev via WS bridge)
- Any logs/screenshots

## Outputs

- Classification + likely root cause
- Minimal repro steps (if possible)
- Next step:
  - Fix now (patch + verification)
  - Plan it (new task + owner)
  - Document it (docs/runbook update)

## Workflow

1. Open the canonical runbook
   - `runbooks/observe-triage.md`

2. Confirm environment + transport
   - VS Code webview transport: `webview.postMessage`
   - Browser dev transport: WS bridge `ws://127.0.0.1:5174/?token=...`
   - Use **System → Registry** to confirm:
     - deep link base (scheme)
     - WS endpoint + token presence
     - universal routes/actions present

3. Classify quickly
   - Auth/config (baseUrl/email/token)
   - Transport (IPC vs WS bridge, CSP/connect-src, token mismatch)
   - Data (Jira API/JQL/network)
   - Routing (deep link parsing, missing route, redirects)

4. Route to the right fix path
   - If fix now: implement smallest patch + validate (`bun run typecheck`)
   - If schedule: create a Plan-stage next action + owner
   - If document: update `_agents/docs/*` or `_agents/runbooks/*`

## Safety Rules

- Prefer diagnosis + repro before code changes.
- Confirm before changing user settings or secrets.
- Confirm before creating issues in external systems.

## Related

- Runbook: `runbooks/observe-triage.md`
- Docs: `docs/routing-matrix.md`, `docs/configuration-matrix.md`, `docs/universal-matrix.md`
