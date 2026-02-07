---
source: codex
app: atlassian-sprint-view
workspace: repos/vscode/extensions/atlassian
created: 2025-12-20
tags: [decompiler, pipeline, ast, bun, typescript, extraction]
---

# Plan

We will rebuild the cc pipeline to decompile `cli.js` into a Bun TypeScript Ink/React app with feature parity, using a dual extractor strategy (webcrack/retidy + custom Bun extractor) and a tolerant AST-based rename/mapping pipeline guided by the architecture and feature inventory specs.

## Requirements
- Use Bun for scripts and tooling; no agent-sdk and no subagents.
- Support extraction via webcrack/retidy and via a custom Bun bundle extractor.
- Normalize outputs into a single manifest format and module folder layout.
- Handle minified/bundled syntax with tolerant parsing and fallbacks.
- Reconstruct a feature-parity `src/` tree that aligns with the specs in `cc/specs/`.
- Include validation (AST diff + smoke TUI run) that works offline.

## Scope
- In: extraction/unbundle, rename, module mapping/grouping, reconstruction into `cc/src`, validation tooling, docs for pipeline usage.
- Out: network scraping or online lookups during pipeline runs, agent-sdk integration.

## Files and entry points
- `cc/scripts/run-pipeline.ts` (orchestrator)
- `cc/scripts/extract-bun.ts`, `cc/scripts/extract-webcrack.ts`, `cc/scripts/extract-retidy.ts`
- New: `cc/scripts/rename.ts`, `cc/scripts/map-modules.ts`, `cc/scripts/reconstruct.ts`, `cc/scripts/validate.ts`
- Specs: `cc/specs/architecture.md`, `cc/specs/complete-feature-inventory.md`
- Output: `cc/.versions/<version>/modules`, `cc/.versions/<version>/src`, `cc/src`

## Data model / API changes
- Define a canonical `manifest.json` schema (module id, type, deps, source path, parse status).
- Emit `grouping.json` and `mapping.json` to track module-feature and module-target file mapping.
- Add `validation.json` with counts (modules parsed, renamed, mapped, reconstructed, parity checks).

## Action items
[ ] Inventory existing scripts and define canonical manifest/output layout for all extractors.
[ ] Implement a tolerant rename stage (meriyah/oxc parser + fallback to string heuristics on parse failure).
[ ] Build a module mapping stage that uses the specs to classify UI/core/tools/auth/etc. and emits `mapping.json`.
[ ] Implement reconstruction to materialize `cc/src` with spec-aligned structure and mapped module content.
[ ] Add validation: AST diffs where possible, module coverage report, and a minimal TUI smoke run.
[ ] Document pipeline usage and expected outputs in `cc/specs/` or a short `cc/README.md`.

## Testing and validation
- `bun scripts/run-pipeline.ts --version 2.0.75 --extractor auto`
- `bun scripts/validate.ts --version 2.0.75`
- Smoke: `bun run build` or a minimal `bun run dev` if we wire a TUI entry

## Risks and edge cases
- Minified bundle syntax can exceed parser limits; need robust fallback paths.
- webcrack's optional deobfuscation depends on isolated-vm; must avoid or guard.
- Spec version mismatch (2.0.69 vs 2.0.75) may cause parity gaps.
- Some modules may be webpack/bun runtime artifacts not meant to map to `src/`.

## Open questions
- Confirm target version for parity (2.0.75 vs spec's 2.0.69).
- Confirm output location (write final reconstruction into `cc/src`).
- Preferred extractor precedence (webcrack vs retidy) when both succeed.
