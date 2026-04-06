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

```
instrlint/
├── src/
│   ├── cli.ts                    # Commander.js entry point, subcommands
│   ├── index.ts                  # Programmatic API export
│   ├── core/
│   │   ├── scanner.ts            # Auto-detect which agentic tool is used
│   │   ├── parser.ts             # Parse CLAUDE.md / AGENTS.md into structured rules
│   │   ├── reporter.ts           # Format output (terminal / json / markdown)
│   │   └── scorer.ts             # Calculate health score (0-100)
│   ├── analyzers/
│   │   ├── budget.ts             # Token budget analysis
│   │   ├── dead-rules.ts         # Redundant rule detection
│   │   └── structure.ts          # Structural analysis
│   ├── commands/
│   │   ├── budget-command.ts     # `instrlint budget` subcommand + printBudgetTerminal
│   │   ├── deadrules-command.ts  # `instrlint deadrules` subcommand + printDeadRulesTerminal
│   │   ├── structure-command.ts  # `instrlint structure` subcommand + printStructureTerminal
│   │   ├── run-command.ts        # Root `instrlint` orchestrator (budget + dead-rules + structure)
│   │   ├── ci-command.ts         # `instrlint ci` — CI mode with SARIF output
│   │   ├── init-ci-command.ts    # `instrlint init-ci` — GitHub/GitLab workflow generators
│   │   └── install-command.ts    # `instrlint install` — skill installer
│   ├── detectors/
│   │   ├── config-overlap.ts     # Rule ↔ config file overlap detection
│   │   ├── contradiction.ts      # Contradicting rules detection
│   │   ├── duplicate.ts          # Duplicate rule detection (Jaccard similarity)
│   │   ├── stale-refs.ts         # References to non-existent files
│   │   ├── scope-classifier.ts   # Classify rules: global / path-scoped / module / skill
│   │   └── token-estimator.ts    # Token counting (js-tiktoken primary, char estimation fallback)
│   ├── fixers/
│   │   ├── remove-dead.ts        # Remove provably redundant rules
│   │   ├── remove-stale.ts       # Remove stale file references
│   │   ├── deduplicate.ts        # Remove exact duplicates
│   │   └── structure-suggestions.ts  # Actionable suggestions for non-auto-fixable structure findings
│   ├── adapters/                 # Per-tool config parsing
│   │   ├── dispatch.ts           # Routes loadProject() to correct adapter
│   │   ├── claude-code.ts        # .claude/ directory structure
│   │   ├── codex.ts              # .agents/ + .codex/ structure
│   │   └── cursor.ts             # .cursor/ structure
│   ├── reporters/
│   │   └── sarif.ts              # SARIF v2.1.0 reporter for GitHub Code Scanning
│   ├── types.ts                  # Shared type definitions
│   ├── i18n/
│   │   ├── index.ts              # Locale loader + t() function
│   │   ├── en.json               # English strings (default)
│   │   └── zh-TW.json            # Traditional Chinese strings
│   └── utils/
│       ├── fs.ts                 # File system helpers
│       ├── text.ts               # Text processing (keyword extraction, similarity)
│       └── skill-version.ts      # Skill version tracking + outdated detection
├── skills/
│   ├── claude-code/SKILL.md      # /instrlint skill for Claude Code (installs to .claude/commands/)
│   └── codex/SKILL.md            # Codex-compatible skill
├── tests/
│   ├── fixtures/                 # Test fixture files (sample CLAUDE.md, configs)
│   ├── analyzers/
│   ├── detectors/
│   └── cli.test.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── CLAUDE.md                     # This file
├── README.md
└── README.zh-TW.md               # Traditional Chinese README
```

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
```

## Architecture decisions

- **No AI dependency for core analysis.** All detection is deterministic (regex, file existence checks, Jaccard similarity, config parsing). AI is never required.
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

Two locale files (`src/i18n/en.json`, `src/i18n/zh-TW.json`), flat key structure with dot notation and `{{param}}` interpolation. `t(key, params?)` is the only helper — no heavy framework.

Rules:
- All user-facing strings go through `t()`. No hardcoded display text in analyzers or reporters.
- Internal log messages, debug output, and JSON format output stay in English.
- Emoji and symbols are locale-independent — use them in all languages.
- Config file names, code references, and file paths are never translated.
- Keep locale files in sync: every key in `en.json` must exist in `zh-TW.json`.
- The user's CLAUDE.md content may be in any language — never translate it, only translate instrlint's own UI strings.

## Config overlap detection patterns

The core of dead-rule detection lives in `src/detectors/config-overlap.ts`. Each pattern maps a CLAUDE.md rule keyword to the config file + field that already enforces it (e.g., TypeScript strict mode → `tsconfig.json compilerOptions.strict`, semicolons → prettier `semi`, etc.).

Start with ~15 patterns covering the most common cases (formatting, linting, TypeScript, commit conventions). This list grows via community PRs and is the primary differentiator of the tool.

## Token counting strategy

Two-tier approach with graceful degradation:

**Primary: js-tiktoken (cl100k_base encoding)**
- `js-tiktoken` is a pure JavaScript implementation, no native bindings needed
- Use `cl100k_base` encoding — closest publicly available encoding to what Claude uses
- Not a perfect match for Claude's actual tokenizer, but significantly more accurate than character estimation
- Gives exact token counts for the input text

**Fallback: character-based estimation**
- Activates automatically if js-tiktoken fails to load at runtime
- English text: ~4 chars per token
- Chinese/CJK text: ~2 chars per token
- Mixed content: ~3 chars per token (detect CJK ratio dynamically)
- Code blocks: ~3.5 chars per token

**MCP server token estimation (always estimated, no tokenizer helps here)**
- Tool definitions are not locally available — we can't tokenize them
- Use community-sourced benchmarks:
  - Small server (3-5 tools): ~2-3K tokens
  - Medium server (10-20 tools): ~5-8K tokens
  - Large server (30+ tools): ~10-15K tokens
- Claude Code Tool Search reduces this via deferred loading
- Always label MCP counts as "estimated"

**Display rules:**
- When tiktoken is used: show "4,217 tokens" (no tilde, no disclaimer)
- When fallback is used: show "~4,200 tokens (estimated)"
- MCP servers: always show "~5,000 tokens (estimated)"
- HealthReport.tokenMethod tells downstream consumers which method was used

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

**Fully implemented.** All three analyzers (budget, dead-rules, structure), fixers, reporter, scorer, CLI, i18n, CI mode, multi-tool adapters, and skill installer are complete. 387 passing tests (`pnpm check` fully green). Published to npm as `instrlint`.

**Implemented:** budget analyzer, dead-rules analyzer, structure analyzer (contradiction + stale-refs + scope-classifier), all fixers, structure-suggestions fixer, terminal/JSON/markdown/SARIF reporters, scorer, full CLI with `--fix`/`--format`/`--lang`/`--tool` flags, `instrlint ci`, `instrlint init-ci`, `instrlint install`, skill version tracking + auto-update prompt, Codex adapter, Cursor adapter, adapter dispatcher, `README.zh-TW.md`.

**Not yet implemented:** none — all planned features are shipped.

## Release workflow

每次發布前**必須先升版號**，否則 `npm publish` 會回傳 403 Forbidden。

### 步驟

```bash
# 1. 確認目前版本
node -e "console.log(require('./package.json').version)"

# 2. 升版號（只需修改一個地方）
#    - package.json → "version"
#    CURRENT_VERSION 和 cli --version 都直接從 package.json 讀取，自動同步

# 3. 品質檢查
pnpm check        # typecheck + lint + test

# 4. 建置
pnpm build

# 5. 確認打包內容
npm pack --dry-run

# 6. commit & push
git add package.json src/utils/skill-version.ts
git commit -m "chore: bump version to x.y.z"
git push

# 7. 發布
npm publish
```

### 版本號規則（Semantic Versioning）

| 類型 | 版號 | 適用情況 |
|------|------|---------|
| patch | 0.1.x | bug fix、文件更新、小幅調整 |
| minor | 0.x.0 | 新功能、向下相容 |
| major | x.0.0 | breaking change |

### 常見錯誤

- **403 Forbidden "cannot publish over previously published versions"** — 忘記升版號。先更新 `package.json`，重新 build 後再 publish。
- **版本號讀取失敗回傳 "0.0.0"** — `skill-version.ts` 的 `readPackageVersion()` 找不到 `package.json` 時的 fallback。通常不會發生，除非 package 結構異常。

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

- CLAUDE.md format is freeform markdown — parser must be very tolerant. Lines that can't be classified should be typed as `other` and skipped, never error.
- `.claude/rules/*.md` files may have YAML frontmatter with `paths:` or `globs:` fields — parse both variants.
- Codex uses `.agents/` (project) and `~/.codex/` (global). Cursor uses `.cursor/rules/` and `.cursorrules` (flat file). Each adapter handles its own structure.
- `settings.json` in `.claude/` may or may not exist. MCP config might be in `settings.local.json` instead. Check both.
- Some users put CLAUDE.md at project root, others at `.claude/CLAUDE.md`. Support both.
- The `--fix` command must check for clean git working tree before modifying files. If dirty, warn and require `--force`.
- `js-tiktoken` is a dependency, not a peer dependency. It should always be installed. The fallback path is for edge cases where the wasm binary fails to load at runtime, not for optional installation.
- `token-estimator.ts` initialization uses a single module-level IIFE Promise (`initPromise`). All callers `await ensureInitialized()` which awaits the same Promise — guarantees the encoder is truly ready before any tokenization. Do NOT revert to a boolean flag; the race condition (flag set before `await import()` completes) caused all counts to show "estimated".
- `cl100k_base` is not Claude's exact tokenizer. It's close enough for instruction file analysis (typically within 5-10% of actual). Don't claim it's exact — say "measured with cl100k_base encoding" when asked about methodology.
- Token counts for user-facing display: use `Intl.NumberFormat` for locale-aware formatting (e.g. "4,217" in en, "4,217" in zh-TW).
- i18n: the user's CLAUDE.md content may be in any language. instrlint's UI language (`--lang`) is independent of the content language. Never translate the user's rule text — only translate instrlint's own labels, messages, and suggestions.