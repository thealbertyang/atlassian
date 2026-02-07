# Runbooks

Runbooks are executable documentation. The Markdown is the source of truth and the commands are run directly from code blocks.

**How To Run**

```sh
node scripts/runbook.mjs _agents/runbooks/<runbook>.md --list
node scripts/runbook.mjs _agents/runbooks/<runbook>.md --block <name>
node scripts/runbook.mjs _agents/runbooks/<runbook>.md --block <name> --dry-run
```

**How To Open (UI)**

- System → Docs → Runbooks
- Paste a canonical link into the URL bar / command palette: `<intentScheme>://runbook/runbooks/<runbook>.md`

**Runbook Index**

| Runbook | Purpose | Owner | Last Reviewed |
| --- | --- | --- | --- |
| runbooks/automation-triage.md | Triage inbox items across systems | TBD | TBD |
| runbooks/connect-integrations.md | Connect external systems and verify access | TBD | TBD |
