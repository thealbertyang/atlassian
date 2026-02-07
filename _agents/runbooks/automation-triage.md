# Automation Triage

**Owner**
TBD

**Last Reviewed**
YYYY-MM-DD

**Trigger**
New issues, PRs, or messages arrive across connected systems.

**Goal**
Produce a prioritized list with clear next steps.

**Prerequisites**
- Connected integrations
- Access to Jira/Linear/GitHub/Slack as needed
- Workspace settings configured

**Exact Commands**

```sh runbook name=triage-refresh
# Refresh the extension data
# Replace with actual project command if needed
echo "Trigger triage refresh in the extension UI."
```

**Steps**

1. Open the main app and run the triage workflow.
2. Review the ranked list and select the top items.
3. Create or update tasks for the top three items.

**Verification**
Top items are captured as tasks with owners and next steps.

**Rollback**
Remove or revert tasks created during triage.

**Escalation**
Notify the team lead if the triage queue is blocked.

**Artifacts**
Links to created tasks and any discussion threads.
