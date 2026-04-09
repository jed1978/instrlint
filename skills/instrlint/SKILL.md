---
name: instrlint
description: Lint and optimize agent instruction files. Use when the user wants to lint, audit, refactor, or optimize their CLAUDE.md, AGENTS.md, .cursorrules, or related instruction files — finds dead rules, token waste, duplicates, contradictions, and stale references. Produces a scored health report (0–100) with auto-fix and host-orchestrated LLM verification.
---

# instrlint

Lint and optimize agent instruction files. Produces a scored health report across three dimensions: token budget, dead rules, and structure.

## Command Resolution Protocol

When the user runs `/instrlint [args]`:

1. **Detect language** — identify conversation language → output: locale
   - 繁體中文 → `zh-TW`
   - English or any other → `en`

2. **Check `--verify`** — if args contain `--verify` → jump to LLM Verification Protocol below. Otherwise continue.

3. **Map command** — parse user args against this table → output: base command

   | User args | Base command |
   |-----------|-------------|
   | _(none)_ | `npx instrlint@latest` |
   | `budget` | `npx instrlint@latest budget` |
   | `deadrules` | `npx instrlint@latest deadrules` |
   | `structure` | `npx instrlint@latest structure` |
   | `--fix` | `npx instrlint@latest --fix` |
   | `ci --fail-on warning` | `npx instrlint@latest ci --fail-on warning` |

4. **Build final command** — append flags from steps 1 and 3:
   `{base command} --format markdown --lang {locale}`
   Exception: `--fix` omits `--format markdown` (output is a fix summary, not a report).

5. **Execute and present** — run the command → present the markdown output directly to the user. Never summarize or paraphrase.

## LLM Verification Protocol (`--verify`)

contradiction / duplicate / structure detectors are text heuristics and may produce false positives. You (the host agent) can judge these semantically.

**Protocol:** instrlint never calls an LLM API. It writes suspicious findings as `candidates.json`, you judge them and write `verdicts.json`, then instrlint merges the results back into the report.

### Quick steps

1. `npx instrlint@latest --emit-candidates instrlint-candidates.json --skip-report --lang <detected>`
2. Read `instrlint-candidates.json` and judge each candidate using criteria from [references/judgment-framework.md](references/judgment-framework.md) (`confirmed` / `rejected` / `uncertain`)
3. Write `instrlint-verdicts.json` with your verdicts (`id` must match 12-char hex from candidates)
4. `npx instrlint@latest --apply-verdicts instrlint-verdicts.json --format markdown --lang <detected>`

## Splitting Guidance

When instrlint reports either of these conditions, **do not paste the suggestion text directly** — run the splitting decision walkthrough instead:

- Budget warning: root instruction file exceeds recommended line count (> 200 lines)
- Structure findings contain path-scope suggestions (`messageKey: structure.scopePathScoped`)

### Walkthrough flow

1. **Read** the file, list major sections (heading + line count)
2. **Classify each section** using the 4-bucket framework (see [references/judgment-framework.md](references/judgment-framework.md))
3. **Present a decision table** to the user (section / lines / recommended action / reason)
4. **Ask** the user: "Minimum split (bucket 1 only) / Full split (buckets 1+2+3) / Custom"
5. **Execute**: bucket 1 → extract to rules directory with `paths:` / `globs:` frontmatter; bucket 2 → extract without path-scope; bucket 3 → replace with one-line pointer
