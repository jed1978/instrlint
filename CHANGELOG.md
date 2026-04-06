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
