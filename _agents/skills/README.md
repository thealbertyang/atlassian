# Skills

Skills are reusable agent workflows. They complement (not replace) docs and runbooks:

- **Docs** (`_agents/docs`) explain the system and the matrices.
- **Runbooks** (`_agents/runbooks`) are executable procedures (runnable code blocks).
- **Skills** (`_agents/skills/<skill>/SKILL.md`) orchestrate repeatable workflows, usually by:
  - pointing at one or more runbooks
  - defining inputs/outputs (parameters, artifacts)
  - enforcing safety gates (confirm before write actions)

## Conventions

- Put repo-specific skills under `_agents/skills/<skill>/SKILL.md`.
- If global skills exist, the extension will expose them via:
  - `_agents/skills/.codex-global` -> `~/.codex/skills` (if present)
  - `_agents/skills/.claude-global` -> `~/.claude/skills` (if present)

## How This Shows Up In The UI

Open **System → Docs** and use the **Skills** group in the left sidebar.

## Repo Skills

- `skills/release-promotion/SKILL.md`
- `skills/observe-triage/SKILL.md`
- `skills/ws-bridge-debug/SKILL.md`
