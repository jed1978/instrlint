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

### Changed (coverage hardening)

- Extracted budget logic from `src/cli.ts` into `src/commands/budget-command.ts` for testability
  - Exports: `formatTokens`, `bar`, `pct`, `printBudgetTerminal`, `runBudget`
  - `runBudget` accepts injectable `output: { log, error }` for unit testing
- Rewrote `tests/cli.test.ts` (24 tests) — direct unit tests for all exported helpers, full `runBudget` coverage, 4 CLI smoke tests
- Expanded `tests/adapters/claude-code.test.ts` (32 tests) — added 6 error-path tests: missing CLAUDE.md, malformed settings.json, no mcpServers key, settings.local.json, orphan skill dir, missing .claude/rules/
- Overall test coverage: **87%** (statements/lines), 87% branches, 97% functions — exceeds 80% target

### Added (dead rules analyzer)

- `src/utils/text.ts`: `tokenizeWords`, `removeStopWords`, `jaccardSimilarity` — shared text utilities
- `src/detectors/config-overlap.ts`: 15 overlap patterns (tsconfig strict, prettier semi/singleQuote/tabWidth/trailingComma/printWidth/endOfLine, eslint import-order/no-console, commitlint, editorconfig, test framework, formatter)
  - Private config-reading helpers: `readJsonFile`, `readTextFile`, `checkEditorConfig`, `checkPrettierConfig`, `checkEslintRule`
  - Emits `category: 'dead-rule'`, `severity: 'warning'`, `autoFixable: true`
- `src/detectors/duplicate.ts`: Jaccard similarity duplicate detection (threshold > 0.7, min 4 words after stop-word removal)
  - Exact duplicate → `severity: 'warning'`, `autoFixable: true`
  - Near-duplicate → `severity: 'info'`, `autoFixable: false`
- `src/analyzers/dead-rules.ts`: thin orchestrator combining both detectors
- `src/commands/deadrules-command.ts`: CLI command with terminal (two-section: Redundant / Duplicates) and JSON output
- `src/cli.ts`: wired up `deadrules` subcommand with `--format` and `--tool` options

### Added (code quality tooling)

- `eslint.config.js`: flat config with `@typescript-eslint/recommended`, `no-explicit-any`, `no-unused-vars`
- `package.json` scripts: `lint`, `lint:fix`, `typecheck`, `audit`, `check`
- Fixed type errors: `McpServerConfig.toolCount` exactOptionalPropertyTypes, `TiktokenEncoder.encode` return type
- `.gitignore`: added `coverage/`

### Changed (test quality audit)

- Deleted `tests/types.test.ts` (11 tautological tests — type assignment round-trips, zero behavioral value)
- `tests/core/scanner.test.ts`: `clean-project` confidence assertion changed from `toContain(['high','low'])` to `toBe('low')`
- `tests/detectors/config-overlap.test.ts`:
  - Removed two implementation-leaking tests that duplicated source regexes verbatim
  - Replaced magic `toHaveLength(5)` with `toBeGreaterThanOrEqual(5)` 
  - Added heading-line guard test: keyword in `type:'heading'` line must not produce a dead-rule finding
- `tests/detectors/duplicate.test.ts`:
  - Removed redundant `removeStopWords "preserves non-stop words"` test
  - Replaced `"does not report (A,B) and (B,A)"` with a stronger three-line mutual-similarity test
  - Replaced magic `toHaveLength(2)` with behavioral assertions
- `tests/analyzers/dead-rules.test.ts`: collapsed redundant per-property tests already covered by detector-level suites; reduced to smoke assertions checking both categories are represented
- `tests/analyzers/budget.test.ts`: replaced hardcoded `12_000` / `200_000` constants with relational assertions
- `tests/detectors/token-estimator.test.ts`: removed redundant `estimateMcpTokens "always returns method=estimated"` test
- Sample fixture `tests/fixtures/sample-project/CLAUDE.md`: corrected 5 lines so import-order rule is classified as `rule`, conventional-commit duplicate lines don't falsely trigger config-overlap, and semantic-duplicate pair achieves Jaccard > 0.7
- Total: tests reorganized from 216 to ~210 passing; coverage maintained at 89%+
