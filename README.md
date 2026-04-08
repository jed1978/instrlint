# instrlint

[![npm](https://img.shields.io/npm/v/instrlint)](https://www.npmjs.com/package/instrlint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/jed1978/instrlint/actions/workflows/ci.yml/badge.svg)](https://github.com/jed1978/instrlint/actions/workflows/ci.yml)

[繁體中文](README.zh-TW.md) | English

**instrlint lints itself.**

## Why instrlint?

Your `CLAUDE.md` grows over time. Rules get copied from templates, duplicated across sections, or left pointing at files that no longer exist. Some rules repeat what `tsconfig.json` or `.editorconfig` already enforces — burning token budget with no benefit.

instrlint scans your instruction files and tells you exactly what to fix. One command, one score, one actionable report.

Two things make it different from a line counter:

- **Host-orchestrated LLM verification** — run `/instrlint --verify` in Claude Code and the host model judges ambiguous findings itself. No API key. No separate service. The model already running your session *is* the verifier.
- **Refactoring walkthrough** — when your root file is too long, instrlint doesn't just say "split this." It walks you through each section, classifies it into one of four buckets, and guides the decision — because not every long CLAUDE.md should be split the same way.

Supports Claude Code, Codex, and Cursor. 487 tests. Dogfoods itself since v0.2.3.

## Quick start

```bash
npx instrlint
```

Run from the directory where your `CLAUDE.md` or `AGENTS.md` lives. No install required.

Or install globally and run from any project:

```bash
npm install -g instrlint
instrlint
```

## Output example

```
  ╭──────────────────────────────────────────────────╮
  │  instrlint  ─  sample-project                    │
  │  claude-code  ·  measured                        │
  ├──────────────────────────────────────────────────┤
  │  ███████████████░░░░░░░░░░░░░░░  50/100   F      │
  ╰──────────────────────────────────────────────────╯

  ── BUDGET ──────────────────────────────────────────
  18,957 / 200,000 tokens (9%)  █░░░░░░░░░░░░░

  ── FINDINGS ────────────────────────────────────────
  Contradictions    ✖ 1
  Budget            ⚠ 1
  Dead rules        ⚠ 5
  Duplicates        ⚠ 1  ℹ 1
  Stale refs        ⚠ 2
  Structure         ℹ 11

  ── TOP ISSUES ──────────────────────────────────────
  1. ✖  Contradicting rules: "Use exceptions for error handling. Throw error…
  2. ⚠  Root instruction file is 206 lines (recommended: < 200)
  3. ⚠  Rule "Always use TypeScript strict mode. Enable all strict checks to…
  4. ⚠  Rule "Use 2-space indentation for all files. Never use tabs." is alr…
  5. ⚠  Rule "Always use semicolons at the end of statements." is already en…
     … and 17 more (run instrlint <command> for details)

  ── 1 critical · 9 warnings · 12 suggestions ────────
```

## What it finds

**Token budget** — measures tokens across all instruction files and MCP servers using `cl100k_base` encoding. Flags root files over 200 lines and baselines above 25% of your context window.

**Dead rules** — rules your config files already enforce: TypeScript strict mode, Prettier formatting, ESLint, EditorConfig, conventional commits, C# `.csproj`/`.editorconfig` settings, and more. ~20 patterns covering JS/TS and C# ecosystems.

**Structural issues** — contradicting rules, stale file references, near-duplicate rules, and path-scoping opportunities.

**Auto-fix** — `--fix` removes dead rules, stale refs, and exact duplicates. Requires a clean git working tree.

**CI integration** — `instrlint ci` exits non-zero based on severity. SARIF output for GitHub Code Scanning. Generate a workflow with `instrlint init-ci --github`.

## Supported tools

| Tool | Root file | Config dir |
|------|-----------|------------|
| Claude Code | `CLAUDE.md` | `.claude/` |
| Codex | `AGENTS.md` | `.agents/`, `.codex/` |
| Cursor | `.cursorrules` | `.cursor/` |

Auto-detected from project structure. Override with `--tool`.

## Use in Claude Code or Codex

Install the skill once:

```bash
npx instrlint install --claude-code          # global (~/.claude/commands/)
npx instrlint install --claude-code --project  # project only
npx instrlint install --codex
```

Restart your editor to load the command, then:

```
/instrlint           # full report
/instrlint --fix     # auto-fix safe issues
/instrlint --verify  # LLM-verified report — no API key needed
```

> **Note:** Claude Code only loads custom commands at startup. `/reload-plugins` does not pick up newly installed commands.

The skill auto-detects when your report needs deeper review. `/instrlint --verify` triggers a two-pass protocol: instrlint writes low-confidence findings as `candidates.json`, the host model judges each one, and instrlint merges the verdicts — filtering false positives and attaching `✓` / `❓` badges. No API key; the model already running your session is the verifier.

When your root file is too long, `/instrlint` walks you through a splitting decision: each section is classified as worth extracting (low load rate), extractable but always-loaded, should delete not move, or must stay. You choose the scope; the skill executes.

## Common commands

```bash
instrlint                           # full health check
instrlint --fix                     # auto-fix dead rules, stale refs, duplicates
instrlint --format markdown         # Markdown output for PR comments
instrlint --lang zh-TW              # Traditional Chinese output

instrlint ci --fail-on warning      # CI mode: exit 1 on warnings
instrlint init-ci --github          # generate GitHub Actions workflow

instrlint install --claude-code     # install as Claude Code skill

# LLM verification (two-pass, no API key)
instrlint --emit-candidates instrlint-candidates.json
instrlint --apply-verdicts instrlint-verdicts.json
```

See all options: `instrlint --help`

## Contributing

The primary differentiator is the config overlap patterns in `src/detectors/config-overlap.ts`. To add a new pattern:

1. Add a new entry to the `OVERLAP_PATTERNS` array
2. Map the rule keywords to the config file + field that enforces them
3. Add a test fixture in `tests/fixtures/` that triggers the pattern
4. Add a test case in `tests/detectors/config-overlap.test.ts`

See [CLAUDE.md](CLAUDE.md) for full architecture documentation.

## License

MIT — see [LICENSE](LICENSE)
