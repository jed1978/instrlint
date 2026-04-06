---
name: instrlint
description: Health check your CLAUDE.md and rule files — find dead rules, token waste, duplicates, contradictions, and stale references. Produces a scored health report (0-100) with auto-fix support.
command: /instrlint
argument-hint: "[budget|deadrules|structure|ci] [--fix] [--lang zh-TW]"
---

# instrlint

Lint and optimize agent instruction files. Produces a scored health report across three dimensions: token budget, dead rules, and structure.

## How to run

**Always run with `--format markdown`** so the report renders properly in Claude Code. Never use the default terminal format — it uses ANSI colors and box-drawing characters that don't display correctly here.

Then **present the markdown report directly to the user** — do not summarize or paraphrase it.

## Language detection

**Always detect the language of the current conversation before running:**

- 繁體中文 conversation → add `--lang zh-TW`
- English conversation → add `--lang en`
- Any other language → fall back to `--lang en`

## Command mapping

When the user runs `/instrlint [args]`, translate to:

| User input | Command to run |
|------------|---------------|
| `/instrlint` | `npx instrlint@latest --format markdown --lang <detected>` |
| `/instrlint budget` | `npx instrlint@latest budget --format markdown --lang <detected>` |
| `/instrlint deadrules` | `npx instrlint@latest deadrules --format markdown --lang <detected>` |
| `/instrlint structure` | `npx instrlint@latest structure --format markdown --lang <detected>` |
| `/instrlint --fix` | `npx instrlint@latest --fix --lang <detected>` then present the fix summary as-is |
| `/instrlint ci --fail-on warning` | `npx instrlint@latest ci --format markdown --fail-on warning --lang <detected>` |

## What it checks

- **Budget** — token consumption across all instruction files and MCP servers. Flags files > 200 lines, baselines > 25% of context window.
- **Dead rules** — rules already enforced by tsconfig, prettier, eslint, commitlint, editorconfig, and more. ~15 overlap patterns.
- **Structure** — contradictions between rules, stale file references, duplicates, and path-scoping opportunities.

## Auto-fix (--fix)

Auto-applied (safe, deterministic):
- Rules already enforced by config files (dead rules)
- References to non-existent files (stale refs)
- Exact duplicate rules

Actionable suggestions shown after fix (requires human judgment):
- Git hook suggestions — copy-paste `.claude/settings.json` snippet
- Path-scoped rule file suggestions — ready-to-create file content

## Score and grade

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 90–100 | Excellent — minor issues only |
| B | 80–89 | Good — a few improvements possible |
| C | 70–79 | Fair — some issues to address |
| D | 60–69 | Poor — significant problems |
| F | < 60 | Critical — needs immediate attention |

## Supported tools

Claude Code, Codex, Cursor — auto-detected from project structure.
