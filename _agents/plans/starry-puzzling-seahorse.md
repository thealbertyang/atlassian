---
source: claude
app: atlassian-sprint-view
workspace: repos/vscode/extensions/atlassian
created: 2026-01-31
tags: [cli, workspace, justfile, cloudflare, networking, developer-tools]
---

# Developer Workspace CLI Framework Refactor

> Workspace-agnostic, future-proofed CLI framework with Apple-like simplicity

## Goals

1. **Workspace-agnostic**: Clone to any machine, configure once, reuse
2. **Intuitive UX**: Commands that "just work" with progressive disclosure
3. **Visual clarity**: Clear groupings in `--list` output
4. **Future-proof**: Easy to add new tools or cloud providers
5. **DRY**: Reusable template pattern for CLI wrappers

## Proposed Structure

```
just/
  env/mod.just          # Environment context (was: worlds)
  key/mod.just          # Local secrets (was: secrets)
  key/sync/mod.just     # push, pull, status (Keychain <-> CF)
  net/mod.just          # Networking utilities
  net/dns/mod.just      # dig, trace, reverse
  net/ssh/mod.just      # connect, config
  aws/mod.just          # Passthrough -> aws
  cf/mod.just           # Cloudflare ecosystem
  cf/d1/mod.just        # -> wrangler d1
  cf/kv/mod.just        # -> wrangler kv
  cf/r2/mod.just        # -> wrangler r2
  cf/tunnel/mod.just    # create, delete, list, route, run
  cf/warp/mod.just      # connect, disconnect, status
  container/mod.just    # Passthrough -> container (Apple)
  db/mod.just           # psql, info, list
```

## Migration Phases

1. Create new structure (env, key, net modules)
2. Refactor CF module (nested dirs, passthrough)
3. Apply template pattern (require, doc, default)
4. Update root justfile (new modules, quick actions)
5. Cleanup (delete old dirs, regenerate completions)
