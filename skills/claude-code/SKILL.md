---
name: instrlint
description: Health check your CLAUDE.md and rule files — find dead rules, token waste, duplicates, contradictions, and stale references. Produces a scored health report (0-100) with auto-fix support.
command: /instrlint
argument-hint: "[budget|deadrules|structure|ci] [--fix] [--format json|markdown|sarif] [--lang zh-TW]"
---

# instrlint

Lint and optimize agent instruction files. Produces a scored health report across three dimensions: token budget, dead rules, and structure.

## Usage

```
/instrlint                          # Full health check (score + grade)
/instrlint budget                   # Token budget analysis only
/instrlint deadrules                # Dead rule detection only
/instrlint structure                # Structural analysis only
/instrlint ci --fail-on warning     # CI mode: exit 1 if warnings found
/instrlint --fix                    # Auto-fix safe issues
/instrlint --format json            # JSON output for CI
/instrlint --format markdown        # Markdown output for PR comments
/instrlint --lang zh-TW             # Output in Traditional Chinese
/instrlint install --claude-code    # Install skill globally
```

## What it checks

- **Budget** — token consumption across all instruction files and MCP servers. Flags files > 200 lines, baselines > 25% of context window.
- **Dead rules** — rules already enforced by tsconfig, prettier, eslint, commitlint, editorconfig, and more. ~15 overlap patterns.
- **Structure** — contradictions between rules, stale file references, duplicates, and path-scoping opportunities.

## Score and grade

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 90–100 | Excellent — minor issues only |
| B | 80–89 | Good — a few improvements possible |
| C | 70–79 | Fair — some issues to address |
| D | 60–69 | Poor — significant problems |
| F | < 60 | Critical — needs immediate attention |

## Auto-fix (--fix)

Safe to auto-fix:
- Rules already enforced by config files (dead rules)
- References to non-existent files (stale refs)
- Exact duplicate rules

Never auto-fixed (requires human judgment):
- Contradicting rules
- Path-scoping suggestions

## Supported tools

Claude Code, Codex, Cursor — auto-detected from project structure.
