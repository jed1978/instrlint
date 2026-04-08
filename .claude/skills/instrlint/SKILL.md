---
name: instrlint
description: Lint and optimize agent instruction files. Use when the user wants to lint, audit, refactor, or optimize their CLAUDE.md, AGENTS.md, .cursorrules, or related instruction files — finds dead rules, token waste, duplicates, contradictions, and stale references. Produces a scored health report (0–100) with auto-fix and host-orchestrated LLM verification.
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
| `/instrlint --verify` | Run the LLM verification protocol below |
| `/instrlint structure --verify` | Same, but only for structure category findings |

## LLM Verification (`--verify`)

contradiction / duplicate / structure detectors are text heuristics and may produce false positives. You (the host agent) can judge these semantically.

**Protocol:** instrlint never calls an LLM API. It writes suspicious findings as `candidates.json`, you judge them and write `verdicts.json`, then instrlint merges the results back into the report.

### Quick steps

1. `npx instrlint@latest --emit-candidates instrlint-candidates.json --skip-report --lang <detected>`
2. Read `instrlint-candidates.json` and judge each candidate (`confirmed` / `rejected` / `uncertain`)
3. Write `instrlint-verdicts.json` with your verdicts (`id` must match 12-char hex from candidates)
4. `npx instrlint@latest --apply-verdicts instrlint-verdicts.json --format markdown --lang <detected>`

For detailed judgment criteria (contradiction / duplicate / structure rules, candidates.json format, example verdicts), see [references/judgment-framework.md](references/judgment-framework.md).

## CLAUDE.md Splitting Guidance

When instrlint reports either of these conditions, **do not paste the suggestion text directly** — run the splitting decision walkthrough instead:

- Budget warning: root instruction file exceeds recommended line count (> 200 lines)
- Structure findings contain path-scope suggestions (`messageKey: structure.scopePathScoped`)

### Walkthrough flow

1. **Read** the file, list major sections (heading + line count)
2. **Classify each section** using the 4-bucket framework (see [references/judgment-framework.md](references/judgment-framework.md))
3. **Present a decision table** to the user (section / lines / recommended action / reason)
4. **Ask** the user: "Minimum split (bucket 1 only) / Full split (buckets 1+2+3) / Custom"
5. **Execute**: bucket 1 → extract to `.claude/rules/` with `paths:` / `globs:` frontmatter; bucket 2 → extract without path-scope; bucket 3 → replace with one-line pointer

## What it checks

- **Budget** — token consumption across all instruction files and MCP servers. Flags files > 200 lines, baselines > 25% of context window.
- **Dead rules** — rules already enforced by tsconfig, prettier, eslint, commitlint, editorconfig, C# `.csproj`/`.editorconfig`, and more. ~20 overlap patterns.
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
