---
name: instrlint
description: Health check your AGENTS.md — find dead rules, token waste, duplicates, contradictions, and stale references.
invocation: instrlint
argument-hint: "[budget|deadrules|structure] [--fix] [--format json|markdown]"
status: Draft — will be updated as CLI stabilizes
---

# instrlint

Lint and optimize agent instruction files for Codex. Produces a scored health report across three dimensions: token budget, dead rules, and structure.

## Usage

```
instrlint                       # Full health check (all analyzers)
instrlint budget                # Token budget analysis only
instrlint deadrules             # Dead rule detection only
instrlint structure             # Structural analysis only
instrlint --fix                 # Auto-fix safe issues
instrlint --format json         # JSON output for CI
instrlint --format markdown     # Markdown output for PR comments
instrlint --tool codex          # Force Codex tool detection
```

## What it checks

- **Budget** — token consumption across AGENTS.md and all related files
- **Dead rules** — rules already enforced by tsconfig, prettier, eslint, commitlint, etc.
- **Structure** — duplicates, contradictions, stale file references, path-scoping opportunities
