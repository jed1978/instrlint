# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- CLI entry point (`src/cli.ts`) with commander subcommands: `budget`, `deadrules`, `structure`, `install`
- Global CLI options: `--format`, `--lang`, `--tool`, `--fix`, `--force`
- Scanner module (`src/core/scanner.ts`): auto-detect agentic tool (Claude Code, Codex, Cursor) from project structure
  - Supports `--tool` force override, ambiguous multi-tool detection, and root-file-only fallback
- Core type definitions (`src/types.ts`): `ParsedInstructions`, `InstructionFile`, `Finding`, `HealthReport`, etc.
- Programmatic API entry (`src/index.ts`) re-exporting all types
- Skill files: `skills/claude-code/SKILL.md`, `skills/codex/SKILL.md` (draft)
- Test fixtures:
  - `tests/fixtures/sample-project/` with 14 pre-seeded issues across 5 categories (dead-rule, duplicate, contradiction, stale-ref, structure)
  - `tests/fixtures/clean-project/` for "all pass" scenario
- Test suites: `tests/types.test.ts` (11), `tests/core/scanner.test.ts` (12), `tests/cli.test.ts` (7) — 30 tests total
- Build config: tsup (ESM + CJS), TypeScript strict, vitest
- Project metadata: package.json (`instrlint@0.1.0`), .gitignore, tsconfig.json
- Instruction file parser (`src/core/parser.ts`):
  - Line-by-line classification: `heading`, `code`, `blank`, `comment`, `rule`, `other`
  - Rule detection via imperative signal words (must/never/always/prefer/avoid/use/ensure/forbid/…)
  - Keyword extraction against a 30+ term dictionary (typescript, eslint, prettier, docker, pnpm, etc.)
  - Path extraction via regex, excluding URLs
  - YAML frontmatter parser (`parseYamlFrontmatter`) for `paths:` and `globs:` fields in rule files
- Token estimator (`src/detectors/token-estimator.ts`):
  - Primary: `js-tiktoken` with `cl100k_base` encoding (singleton, lazy-initialized)
  - Fallback: character-based estimation with CJK ratio adjustment (graceful degradation if tiktoken fails)
  - MCP server token estimation: `toolCount * 400` or 2500 default
- Claude Code adapter (`src/adapters/claude-code.ts`):
  - `loadClaudeCodeProject()` reads root CLAUDE.md, `.claude/rules/*.md` (with frontmatter), `.claude/skills/*/SKILL.md`, sub-directory CLAUDE.md files, and `.claude/settings.json` MCP config
  - Per-file error isolation: failed reads are skipped with a warning, never crashing the scan
- Test suites: `tests/core/parser.test.ts` (38), `tests/detectors/token-estimator.test.ts` (13), `tests/adapters/claude-code.test.ts` (26) — 107 tests total
- Budget analyzer (`src/analyzers/budget.ts`):
  - `analyzeBudget()` computes token breakdown across system prompt (12K fixed), root file, rules, skills, sub-files, and MCP servers
  - Findings: root file > 200 lines (warning), > 400 lines (critical), baseline > 25% of context window (warning), MCP server > 10K tokens (info)
- CLI `budget` subcommand fully implemented:
  - Terminal output: bar chart (████░░░░) with per-category token breakdown and chalk colors
  - `--format json`: structured JSON output of `{ findings, summary }`
  - `--format` / `--tool` options scoped to subcommand via `enablePositionalOptions()`
  - Error messages for unknown tool and missing root file
- Extended `BudgetSummary` type with per-category token fields and `tokenMethod`
- Updated `tests/cli.test.ts` (8 tests): budget terminal + JSON format tests
- Added `tests/analyzers/budget.test.ts` (15 tests): findings, summary fields, MCP threshold, baseline threshold
- Updated `tests/fixtures/sample-project/CLAUDE.md` to 206 lines (exceeds 200-line threshold for testing)
- Total: 123 tests passing
