---
description: instrlint project directory structure
---

# Project Structure

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
│   ├── verifiers/                # Host-orchestrated LLM verification (no API calls)
│   │   ├── index.ts              # Barrel export
│   │   ├── schema.ts             # CandidatesFile / VerdictsFile types
│   │   ├── policy.ts             # shouldVerify(finding) — which findings need LLM review
│   │   ├── candidates.ts         # buildCandidates() — serialize findings for host LLM
│   │   └── verdicts.ts           # applyVerdicts() / loadVerdictsFile()
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
│   └── instrlint/
│       ├── SKILL.md              # Unified skill (Agent Skills spec compliant, all platforms)
│       └── references/
│           └── judgment-framework.md  # LLM verification criteria + 4-bucket framework
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
