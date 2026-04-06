---
name: instrlint
description: Health check your AGENTS.md and rule files — find dead rules, token waste, duplicates, contradictions, and stale references.
command: /instrlint
argument-hint: "[budget|deadrules|structure|ci] [--fix] [--format json|markdown|sarif]"
---

# instrlint

Lint and optimize agent instruction files. Produces a scored health report across three dimensions: token budget, dead rules, and structure.

## Language detection

**Always detect the language of the current conversation before running instrlint:**

- If the user is conversing in **Traditional Chinese (繁體中文)**: run with `--lang zh-TW`
- If the user is conversing in **English**: run with `--lang en`
- For any other language instrlint does not support: fall back to `--lang en`

## Usage

```
/instrlint                          # Full health check (score + grade)
/instrlint budget                   # Token budget analysis only
/instrlint deadrules                # Dead rule detection only
/instrlint structure                # Structural analysis only
/instrlint ci --fail-on warning     # CI mode: exit 1 if warnings found
/instrlint --fix                    # Auto-fix safe issues + show actionable suggestions
/instrlint --format json            # JSON output for CI
/instrlint --format markdown        # Markdown output for PR comments
/instrlint install --codex          # Install skill into .agents/skills/
```

## What it checks

- **Budget** — token consumption across AGENTS.md, skills, and MCP servers.
- **Dead rules** — rules already enforced by tsconfig, prettier, eslint, and other config files.
- **Structure** — contradictions, stale file references, duplicates, and path-scoping opportunities.
