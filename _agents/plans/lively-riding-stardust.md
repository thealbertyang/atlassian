---
source: claude
app: atlassian-sprint-view
workspace: repos/vscode/extensions/atlassian
created: 2026-01-31
tags: [workspace, architecture, xdg, symlinks, git-submodules, developer-setup]
---

# Modular Workspace Architecture Plan

## Problem
- `~/Developer/` has diverged between personal Mac and workbox
- Same patterns exist but with different names (tasks vs todos, docs vs knowledge)
- Hard to sync base tooling while allowing machine-specific extensions

## Current State - Pattern Divergence

| Pattern | Archive (personal) | Workbox (work) | Main (current) |
|---------|-------------------|----------------|----------------|
| **Tooling** | `just/` (flat imports) | — | `just/` (mod submodules) |
| **Tasks** | `_tasks/` | `.todos/stories/` | — |
| **Docs** | `_docs/` | `.knowledge/` | `docs/` |
| **Projects** | `apps/`, `packages/` | `repos/` (nested) | `apps/` (empty) |
| **Issues** | — | `.beads/` | — |

**Key insight:** These are the same workspace patterns with inconsistent naming.

## Unified Workspace Structure

```
~/Developer/                        # Workspace (git repo)
├── just/                           # SYNCED - Core tooling modules
├── config/                         # SYNCED - Templates and examples
├── docs/                           # SYNCED - Documentation
├── .env*                           # SYNCED - Environment configs
│
├── tasks -> ~/.local/share/Developer/tasks/    # SYMLINK (local)
├── repos -> ~/.local/share/Developer/repos/    # SYMLINK (local)
│
├── apps/                           # OPTIONAL - Submodule
└── packages/                       # OPTIONAL - Submodule

~/.config/Developer/                # XDG_CONFIG_HOME
└── envs/base.env                   # Machine config

~/.local/share/Developer/           # XDG_DATA_HOME (actual storage)
├── tasks/                          # Task tracking
└── repos/                          # External git clones

~/.cache/Developer/                 # XDG_CACHE_HOME
└── ...                             # Build cache
```

### Directory Mapping
| In Workspace | Actual Location | Synced? |
|--------------|-----------------|---------|
| `just/` | `~/Developer/just/` | Yes |
| `config/` | `~/Developer/config/` | Yes |
| `docs/` | `~/Developer/docs/` | Yes |
| `tasks/` | `~/.local/share/Developer/tasks/` | No (symlink) |
| `repos/` | `~/.local/share/Developer/repos/` | No (symlink) |
| `apps/` | Submodule (optional) | Personal only |

## Git Strategy: Submodules for Optional Layers

```
~/Developer/                    # Base repo (thealbertyang/Developer)
├── just/                       # TRACKED - Core tooling
├── config/                     # TRACKED - Templates
├── docs/                       # TRACKED - Documentation
├── .env*                       # TRACKED - Environment configs
│
├── apps/                       # SUBMODULE → thealbertyang/Developer-Apps
├── packages/                   # SUBMODULE → thealbertyang/Developer-Packages
│
├── repos/                      # GITIGNORED - Local clones
├── .local/                     # GITIGNORED - Machine-specific
└── .gitmodules                 # Defines optional submodules
```

### How Submodules Work

**Repository structure on GitHub:**
```
thealbertyang/
├── Developer              # Base tooling + docs (this repo)
├── Developer-Apps         # Personal applications
└── Developer-Packages     # Shared packages
```

**Clone scenarios:**
```bash
# Personal Mac - everything
git clone --recurse-submodules https://github.com/thealbertyang/Developer.git
# Result: just/, config/, docs/, apps/, packages/ all populated

# Workbox - tooling only
git clone https://github.com/thealbertyang/Developer.git
# Result: just/, config/, docs/ populated; apps/, packages/ empty
```

**Daily workflow:**
```bash
# Pull base tooling updates (any machine)
git pull origin main

# Update submodules (personal only, when needed)
git submodule update --remote apps packages

# Work on apps (personal - submodule is a full repo)
cd apps && git checkout -b feature && ... && git push
```

**Why submodules:**
- Base tooling syncs independently of apps/packages
- Workbox gets clean tooling without personal project bloat
- Apps can have their own CI/CD, issues, releases
- `git clone` without flags = minimal setup for work machines

## Implementation Plan

### Phase 1: Setup creates XDG structure + symlinks
`dev setup` now:
1. Creates `~/.local/share/Developer/{tasks,repos}`
2. Creates symlinks `~/Developer/tasks` → XDG path
3. Creates symlinks `~/Developer/repos` → XDG path

```bash
# Run setup
dev setup

# Result:
~/Developer/tasks -> ~/.local/share/Developer/tasks
~/Developer/repos -> ~/.local/share/Developer/repos
```

### Phase 2: Create submodule repos (optional)
```bash
# Extract apps from archive branch
git checkout archive/2026-01-29 -- apps/
# Create Developer-Apps repo on GitHub, push content
git submodule add https://github.com/thealbertyang/Developer-Apps apps

# Same for packages
git checkout archive/2026-01-29 -- packages/
git submodule add https://github.com/thealbertyang/Developer-Packages packages
```

### Phase 3: Deploy to workbox
```bash
# Backup existing
ssh workbox "mv ~/Developer ~/Developer.bak"

# Clone base (no submodules)
ssh workbox "git clone https://github.com/thealbertyang/Developer.git"

# Run setup to create XDG dirs + symlinks
ssh workbox "cd ~/Developer && source ~/.zshrc && dev setup"

# Migrate existing work data to XDG
ssh workbox "mv ~/Developer.bak/.todos/* ~/.local/share/Developer/tasks/"
ssh workbox "mv ~/Developer.bak/repos/* ~/.local/share/Developer/repos/"
```

### Machine Content Summary

| Content | Location | Storage | Synced? |
|---------|----------|---------|---------|
| Tooling | `~/Developer/just/` | In repo | Yes |
| Docs | `~/Developer/docs/` | In repo | Yes |
| Tasks | `~/Developer/tasks/` | XDG symlink | No |
| Repos | `~/Developer/repos/` | XDG symlink | No |
| Apps | `~/Developer/apps/` | Submodule | Personal only |

## Verification

```bash
# 1. Run setup
dev setup

# 2. Check symlinks created
ls -la ~/Developer/tasks ~/Developer/repos

# 3. Check XDG directories exist
ls ~/.local/share/Developer/

# 4. Test tooling
dev info
dev worlds where

# 5. Create a task file (goes to XDG)
echo "# Test" > ~/Developer/tasks/test.md
cat ~/.local/share/Developer/tasks/test.md  # Same file
```

## Status

- [x] `.gitignore` updated
- [x] `justfile` setup recipe creates XDG + symlinks
- [ ] Test on personal Mac
- [ ] Deploy to workbox
- [ ] Create submodule repos (optional)
