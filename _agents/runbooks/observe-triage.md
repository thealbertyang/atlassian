# Observe Triage (Observe Stage)

**Owner**
TBD

**Last Reviewed**
YYYY-MM-DD

**Trigger**
- A user reports broken behavior.
- Logs show WS bridge failures, auth failures, or repeated refresh errors.
- Automation runs are failing or not scheduling.

**Goal**
Turn signals into a concrete next action: fix now, schedule, or document.

**Signal Inputs**
- VS Code Output panel logs (Atlassian)
- Webview console logs (dev tools)
- Automation run history (`/execute`)
- Repro steps from user

**Steps**

1. Capture the symptom
   - What route/surface? (`/plan`, `/execute`, `/review`, etc.)
   - What environment? (VS Code webview vs browser dev mode)

2. Classify quickly
   - Auth/config issue: missing baseUrl/email/token.
   - Transport issue: IPC vs WS bridge, CSP/connect-src issues, token mismatch.
   - Data issue: Jira API error, JQL error, network error.
   - Routing issue: deep link parsing, missing route, incorrect redirects.

3. Confirm with minimal repro
   - Open System `Settings` and `Registry` to confirm:
     - deep link base (scheme)
     - WS bridge port + token presence
     - universal routes/actions present

4. Route to next step
   - Fix now: create a task/issue, patch, validate with `bun run typecheck`.
   - Schedule: add to Plan stage (Daily/Weekly).
   - Document: update `_agents/docs/*` or `_agents/runbooks/*`.

**Verification**
- The issue has an owner and next step.
- If patched: the repro no longer triggers and the fix is validated.

**Rollback**
- If a recent change caused the regression: revert the change and ship a hotfix VSIX.

**Artifacts**
- Repro steps
- Logs/screenshots
- Linked PR/issue

