# Skill: Release Promotion

Repeatable workflow for the **Ship** stage: produce a shippable VSIX with clear release notes, following the repo runbook.

## When To Use

- You are ready to ship a new version of the extension.
- You need a hotfix release after an incident.

## Inputs

- Version bump: `patch` (default) or `minor`
- Distribution channel: internal VSIX upload vs marketplace (human-only)
- Linked issues/PRs (optional, for release notes)

## Outputs

- `atlassian-sprint-view.vsix`
- Draft release notes (Markdown)
- Smoke-test checklist results

## Workflow

1. Open the canonical runbook
   - `runbooks/release-promotion.md`

2. Validate locally (safe, automated)
   - `bun run typecheck`
   - `bun run lint`
   - `bun run build`

3. Package + install into VS Code Insiders (requires confirmation)
   - `bun run install:ext`
   - Smoke test at least:
     - `/plan`, `/execute`, `/review`, `/ship`, `/observe`
     - `/system/settings`, `/system/docs`, `/system/registry`

4. Draft release notes (assist-only by default)
   - Summarize user-visible changes.
   - Call out breaking changes (settings/env changes, route changes).

5. Gate: publish/distribute (human-only)
   - Never publish automatically.
   - Ask for explicit approval before uploading/releasing.

## Safety Rules

- Do not publish to external marketplaces automatically.
- Do not run destructive git commands (`reset --hard`, history rewrites).
- Confirm before installing/uninstalling extensions.

## Related

- Runbook: `runbooks/release-promotion.md`
- Docs: `docs/routing-matrix.md`, `docs/configuration-matrix.md`
