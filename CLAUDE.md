# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# instrlint

Lint and optimize your CLAUDE.md / AGENTS.md — find dead rules, token waste, and structural issues.

## Project overview

instrlint is a CLI tool + Claude Code/Codex skill that analyzes agent instruction files and produces a health report with three dimensions:

1. **Budget** — token consumption analysis of instruction files, rules, and MCP config
2. **Dead rules** — rules already enforced by project config (tsconfig, eslint, prettier, etc.)
3. **Structure** — contradictions, stale references, duplicates, and refactoring opportunities

One command, one report, one score. The user knows exactly what to fix.

## Tech stack

- Runtime: Node.js (>= 18)
- Language: TypeScript (strict mode)
- Build: tsup (ESM + CJS dual output)
- CLI framework: Commander.js
- Terminal output: chalk for colors
- Tokenizer: js-tiktoken (cl100k_base encoding, fallback to char estimation)
- i18n: simple key-value JSON files (no heavy framework)
- Package manager: pnpm
- Test: vitest
- Publish target: npm (`npx instrlint`)

## Project structure

See `.claude/rules/project-structure.md`.

## Commands

```bash
instrlint                        # Full health check (all three analyzers)
instrlint budget                 # Token budget analysis only
instrlint deadrules              # Dead rule detection only
instrlint structure              # Structural analysis only
instrlint --fix                  # Auto-fix safe issues (dead rules, stale refs, dupes)
instrlint --format json          # JSON output for CI
instrlint --format markdown      # Markdown output for PR comments
instrlint --lang zh-TW           # Output in Traditional Chinese
instrlint --lang en              # Output in English (default)
instrlint --tool claude-code     # Force specific tool detection

instrlint ci                     # CI mode: exit 1 on critical findings
instrlint ci --fail-on warning   # Exit 1 on warnings too
instrlint ci --format sarif      # SARIF output for GitHub Code Scanning
instrlint ci --output report.sarif

instrlint init-ci --github       # Generate .github/workflows/instrlint.yml
instrlint init-ci --gitlab       # Print GitLab CI snippet to stdout

instrlint install --claude-code          # Install skill globally (~/.claude/commands/)
instrlint install --claude-code --project  # Install into project (.claude/commands/)
instrlint install --codex                # Install as Codex skill

# Host-orchestrated LLM verification (two-pass, no API key needed)
instrlint --emit-candidates <path>       # Write low-confidence findings as candidates JSON
instrlint --emit-candidates <path> --skip-report  # Write candidates without printing report
instrlint --apply-verdicts <path>        # Apply host LLM verdicts and re-render report
```

## Architecture decisions

- **No AI dependency for core analysis.** All detection is deterministic (regex, file existence checks, Jaccard similarity, config parsing). AI is never required.
- **LLM verification is host-orchestrated, never in-process.** instrlint never calls an LLM API directly. When users want LLM-assisted verification, they run `instrlint --emit-candidates <path>` (writes candidates.json), then the host agent (Claude Code, Codex, Cursor) reads it, judges each finding, and writes verdicts.json. instrlint then runs `--apply-verdicts <path>` to merge results. This keeps instrlint dependency-free, key-free, and provider-agnostic — the host's current model is the verifier, whatever it is. Do NOT add LLM SDK dependencies; if you're tempted to call an API from inside instrlint, you're solving the wrong problem.
- **Adapter pattern for multi-tool support.** Each agentic tool (Claude Code, Codex, Cursor) has its own adapter that normalizes its config structure into a shared `ParsedInstructions` interface.
- **Conservative --fix.** Only fix provably safe issues: remove rules where config files deterministically enforce the same thing, remove references to non-existent files, remove exact duplicates. Never auto-fix contradictions or structural suggestions.
- **Score is motivational, not scientific.** The 0-100 score is a weighted heuristic to make the report shareable and comparable. Don't over-engineer the algorithm.
- **Lightweight i18n, no heavy framework.** Use simple JSON key-value files with a `t(key, params?)` helper. No ICU MessageFormat, no plural rules engine. Two locales: `en` (default) and `zh-TW`. Language detection order: `--lang` flag → `INSTRLINT_LANG` env var → system locale → `en`.
- **Real tokenizer with graceful fallback.** Use `js-tiktoken` with `cl100k_base` encoding for accurate token counts. If tiktoken fails to load at runtime, fall back to character-based estimation. Report labels each count as "measured" or "estimated" so the user knows the precision level.
- **Output injection for testability.** All print functions (`printBudgetTerminal`, `printDeadRulesTerminal`, `printStructureTerminal`, `printCombinedTerminal`) accept an `output: { log: typeof console.log; error?: typeof console.error }` parameter (default `console`). This eliminates global `console` dependency and makes terminal output fully testable.
- **Compact terminal report (one page).** `printCombinedTerminal` renders in ~31 lines: rounded-box header with score bar + grade badge, single-line budget summary, findings summary table (per-category critical/warning/info counts), and top-5 issues truncated to 68 chars. Subcommands (`instrlint budget/deadrules/structure`) retain their full detailed output.
- **Skill install target is `.claude/commands/`**, not `.claude/skills/`. Claude Code loads slash commands from `.claude/commands/<name>.md`; the filename becomes the command name (`instrlint.md` → `/instrlint`). Skills directory does not trigger slash command registration.
- **Skill version tracking.** `src/utils/skill-version.ts` exports `CURRENT_VERSION` (must be kept in sync with `package.json`). `install-command.ts` injects `instrlint-version: <version>` into the SKILL.md frontmatter on install. `run-command.ts` calls `checkSkillUpdate()` after printing the report; if outdated and running in an interactive TTY, prompts `Update skill now? [Y/n]` and auto-reinstalls on confirmation.
- **Claude Code does not hot-reload commands.** `/reload-plugins` reloads plugins/skills/agents/hooks but NOT `.claude/commands/`. Users must restart Claude Code after installing or updating the skill.
- **`--lang` must be declared on each subcommand.** Commander.js with `enablePositionalOptions()` parses options strictly by position. `--lang` placed after a subcommand name is not seen by the parent. Each subcommand (`budget`, `deadrules`, `structure`) has its own `--lang` option; the action handler merges it with the parent's value (`opts.lang ?? parent.opts.lang`).

## Key types

```typescript
interface ParsedInstructions {
  tool: 'claude-code' | 'codex' | 'cursor' | 'unknown';
  rootFile: InstructionFile;            // CLAUDE.md or AGENTS.md
  rules: RuleFile[];                    // .claude/rules/*.md
  skills: SkillFile[];                  // .claude/skills/*/SKILL.md
  subFiles: InstructionFile[];          // Subdirectory CLAUDE.md files
  mcpServers: McpServerConfig[];        // From settings.json
}

interface InstructionFile {
  path: string;
  lines: ParsedLine[];
  lineCount: number;
  tokenCount: number;                   // from tiktoken or estimation
  tokenMethod: 'measured' | 'estimated'; // how tokenCount was obtained
}

interface ParsedLine {
  lineNumber: number;
  text: string;
  type: 'rule' | 'heading' | 'comment' | 'blank' | 'code' | 'other';
  keywords: string[];
  referencedPaths: string[];
}

interface Finding {
  severity: 'critical' | 'warning' | 'info';
  category: 'budget' | 'dead-rule' | 'contradiction' | 'stale-ref' | 'duplicate' | 'structure';
  file: string;
  line?: number;
  messageKey: string;              // i18n key, e.g. 'findings.deadRule.configOverlap'
  messageParams?: Record<string, string>;  // interpolation params
  suggestion: string;
  autoFixable: boolean;
  verification?: {                  // present after --apply-verdicts; rejected findings are filtered out
    verdict: 'confirmed' | 'rejected' | 'uncertain';
    reason: string;
  };
}

interface HealthReport {
  project: string;
  tool: string;
  score: number;
  locale: 'en' | 'zh-TW';
  tokenMethod: 'measured' | 'estimated';
  findings: Finding[];
  budget: BudgetSummary;
  actionPlan: ActionItem[];
}
```

## i18n design

See `.claude/rules/i18n.md`.

## Config overlap detection patterns

The core of dead-rule detection lives in `src/detectors/config-overlap.ts`. Each pattern maps a CLAUDE.md rule keyword to the config file + field that already enforces it (e.g., TypeScript strict mode → `tsconfig.json compilerOptions.strict`, semicolons → prettier `semi`, etc.).

Start with ~15 patterns covering the most common cases (formatting, linting, TypeScript, commit conventions). This list grows via community PRs and is the primary differentiator of the tool.

## Token counting strategy

See `.claude/rules/token-counting.md`.

## Coding conventions

- Use ES modules (import/export), not CommonJS
- Prefer named exports over default exports
- Use `interface` for object shapes, `type` for unions/intersections
- Error handling: return `Result<T, E>` pattern where appropriate, throw only for truly exceptional cases
- File naming: kebab-case for files, PascalCase for types/interfaces, camelCase for functions/variables
- Keep functions under 40 lines; extract helpers
- Each detector is a pure function: `(input: ParsedInstructions, projectRoot: string) => Finding[]`
- No classes unless managing stateful resources; prefer functions + closures

## Test strategy

- Unit tests for each detector (most important — these are the core logic)
- Use fixture files in `tests/fixtures/` for realistic CLAUDE.md / config file scenarios
- Integration test for full CLI flow (scan a fixture project, check output)
- No snapshot tests for terminal output (too fragile with colors/formatting)
- Token estimator tests: compare tiktoken output vs fallback output, ensure fallback is within ±30% of tiktoken for representative samples

## Development status

**Implemented:** budget analyzer, dead-rules analyzer, structure analyzer (contradiction + stale-refs + scope-classifier), all fixers, structure-suggestions fixer, terminal/JSON/markdown/SARIF reporters, scorer, full CLI with `--fix`/`--format`/`--lang`/`--tool` flags, `instrlint ci`, `instrlint init-ci`, `instrlint install`, skill version tracking + auto-update prompt, Codex adapter, Cursor adapter, adapter dispatcher, `README.zh-TW.md`, host-orchestrated LLM verifier infrastructure (`--emit-candidates` / `--apply-verdicts`). 433 passing tests.

**Not yet implemented:** skill markdown updated for `--verify` two-pass flow (PR 2).

## Release workflow

See `.claude/rules/release.md`.

## Build and run

```bash
pnpm install           # Install dependencies
pnpm dev               # Run in dev mode (tsx watch src/cli.ts)
pnpm build             # Build with tsup (outputs to dist/)
pnpm test              # Run all tests with vitest
pnpm test <path>       # Run a single test file
pnpm lint              # ESLint
pnpm lint:fix          # ESLint with auto-fix
pnpm typecheck         # TypeScript type checking (tsc --noEmit)
pnpm audit             # Security audit for dependencies
pnpm check             # Run all quality checks (typecheck + lint + test)
node dist/cli.js       # Run built CLI
```

## Important gotchas

See `.claude/rules/parser-adapter-gotchas.md`, `.claude/rules/tokenizer-gotchas.md`, and `.claude/rules/reporter-gotchas.md` (path-scoped — auto-loaded when editing the relevant modules).