# Connect Integrations

**Owner**
TBD

**Last Reviewed**
YYYY-MM-DD

**Trigger**
First time setup or credentials have expired.

**Goal**
All required external systems are connected and verified.

**Prerequisites**
- API credentials or OAuth access
- Workspace settings ready

**Exact Commands**

```sh runbook name=connect
# Open the app and start the connect flow
echo "Open the extension and run the connect flow."
```

**Steps**

1. Open the app and go to the integrations screen.
2. Connect Jira or Linear.
3. Connect GitHub or GitLab.
4. Connect Slack.
5. Save and verify.

**Verification**
Each integration shows as connected and can fetch data.

**Rollback**
Disconnect integrations and clear stored tokens if needed.

**Escalation**
Contact the integration owner if tokens or scopes are blocked.

**Artifacts**
Integration status screenshots or logs.
