---
name: instrlint
description: Health check your CLAUDE.md and rule files — find dead rules, token waste, duplicates, contradictions, and stale references.
command: /instrlint
argument-hint: "[budget|deadrules|structure] [--fix] [--format json|markdown]"
status: Draft — will be updated as CLI stabilizes
---

# instrlint

Lint and optimize agent instruction files. Produces a scored health report across three dimensions: token budget, dead rules, and structure.

## Usage

```
/instrlint                      # Full health check (all analyzers)
/instrlint budget               # Token budget analysis only
/instrlint deadrules            # Dead rule detection only
/instrlint structure            # Structural analysis only
/instrlint --fix                # Auto-fix safe issues
/instrlint --format json        # JSON output for CI
/instrlint --format markdown    # Markdown output for PR comments
/instrlint --lang zh-TW         # Output in Traditional Chinese
```

## What it checks

- **Budget** — token consumption across all instruction files and MCP servers
- **Dead rules** — rules already enforced by tsconfig, prettier, eslint, commitlint, etc.
- **Structure** — duplicates, contradictions, stale file references, path-scoping opportunities
