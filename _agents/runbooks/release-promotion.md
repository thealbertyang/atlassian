# Release Promotion (Ship Stage)

**Owner**
TBD

**Last Reviewed**
YYYY-MM-DD

**Trigger**
- A feature set is ready to publish (VSIX release).
- Hotfix needed after an Observe-stage incident.

**Goal**
Ship a new extension version safely with a clear changelog and rollback plan.

**Prerequisites**
- `bun` installed
- `vsce` available via `@vscode/vsce` (repo devDependency)
- VS Code Insiders installed (for `bun run install:ext`)

**Primary Surfaces**
- UI: `Ship` stage (`/ship`)
- Config: `config/universal.toml`
- Docs: `_agents/docs/*`
- Runbooks: `_agents/runbooks/*`
- Packaging: `bun run package`

**Steps**

1. Validate locally
   - `bun run typecheck`
   - `bun run lint`
   - `bun run build`

2. Smoke test in VS Code
   - `bun run install:ext`
   - Verify: extension activates, panel opens, tree view loads, System pages render.

3. Prepare release notes
   - Summarize user-visible changes.
   - Call out breaking changes (settings/env changes, route changes).

4. Bump + tag release (recommended path)
   - `bun run release`
   - Or: `bun run release:minor`

5. Publish artifact
   - Upload `atlassian-sprint-view.vsix` to the distribution channel of record.

**Verification**
- VSIX installs cleanly.
- App opens and renders at least: `/plan`, `/execute`, `/review`, `/ship`, `/observe`, `/system/settings`, `/system/docs`, `/system/registry`.
- Dev server and WS bridge (if used) connect successfully in local dev.

**Rollback**
- Re-publish previous VSIX version.
- If needed, revert settings defaults in `package.json` and `config/universal.toml`.

**Artifacts**
- VSIX file
- Release notes
- Links to any issues/PRs shipped

