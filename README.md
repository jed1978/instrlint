# instrlint

[![npm](https://img.shields.io/npm/v/instrlint)](https://www.npmjs.com/package/instrlint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/jed1978/instrlint/actions/workflows/ci.yml/badge.svg)](https://github.com/jed1978/instrlint/actions/workflows/ci.yml)

[繁體中文](README.zh-TW.md) | English

**instrlint lints itself.**

Lint and optimize your `CLAUDE.md` / `AGENTS.md` — find dead rules, token waste, and structural issues. One command, one score, one report.

## Quick Start

```bash
npx instrlint
```

No install required. Run from your project root where `CLAUDE.md` or `AGENTS.md` lives.

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

<details>
<summary>繁體中文輸出 (Traditional Chinese output)</summary>

```bash
npx instrlint --lang zh-TW
```

```
  ╭──────────────────────────────────────────────────╮
  │  instrlint  ─  my-project                        │
  │  claude-code  ·  測量值                           │
  ├──────────────────────────────────────────────────┤
  │  ████████████████████░░░░░░░░  84/100   B        │
  ╰──────────────────────────────────────────────────╯

  ── 預算 ──────────────────────────────────────────
  13,500 / 200,000 tokens (7%)  ██░░░░░░░░░░░░

  ── 問題總覽 ────────────────────────────────────────
  Contradictions      ✖ 1
  Dead rules          ⚠ 1
  ...
```

</details>

## Features

**Token Budget** — counts tokens across all your instruction files using `cl100k_base` encoding (falls back to character estimation). Flags files over 200 lines and baseline context over 25% of your window.

**Dead Rules** — detects rules already enforced by your config files. ~15 overlap patterns covering TypeScript strict mode, Prettier formatting, ESLint rules, conventional commits, EditorConfig, and more.

**Structure** — finds contradicting rules, stale file references, exact and near-duplicate rules, and path-scoping opportunities.

**Auto-fix** — `--fix` safely removes dead rules, stale refs, and exact duplicates. Requires a clean git working tree.

**CI Integration** — `instrlint ci` exits 0 or 1 based on findings severity, with SARIF output for GitHub Code Scanning.

## Supported tools

| Tool | Root file | Config dir |
|------|-----------|------------|
| Claude Code | `CLAUDE.md` | `.claude/` |
| Codex | `AGENTS.md` | `.agents/`, `.codex/` |
| Cursor | `.cursorrules` | `.cursor/` |

Auto-detected from project structure. Override with `--tool`.

## Commands

```bash
instrlint                         # Full health check — score, grade, top issues
instrlint budget                  # Token budget analysis only
instrlint deadrules               # Dead rule detection only
instrlint structure               # Structural analysis only
instrlint --fix                   # Auto-fix safe issues
instrlint --fix --force           # Skip git clean check

instrlint --format json           # JSON output (for CI, scripts)
instrlint --format markdown       # Markdown output (for PR comments)
instrlint --lang zh-TW            # Traditional Chinese output

instrlint ci                      # CI mode: exit 1 on critical findings
instrlint ci --fail-on warning    # Exit 1 on warnings too
instrlint ci --format sarif       # SARIF output for GitHub Code Scanning
instrlint ci --output report.sarif  # Write to file

instrlint init-ci --github        # Generate .github/workflows/instrlint.yml
instrlint init-ci --gitlab        # Print GitLab CI snippet to stdout

instrlint install --claude-code   # Install as global Claude Code skill
instrlint install --claude-code --project  # Install into project
instrlint install --codex         # Install as Codex skill
```

## CI Integration

### GitHub Actions

```bash
npx instrlint init-ci --github
```

This creates `.github/workflows/instrlint.yml` with:
- Triggers on changes to `CLAUDE.md`, `.claude/**`, `AGENTS.md`, etc.
- Runs `instrlint ci --fail-on warning --format sarif`
- Uploads SARIF to GitHub Code Scanning

Or add it to your existing CI:

```yaml
- name: Run instrlint
  run: npx instrlint@latest ci --fail-on warning
```

### GitLab CI

```bash
npx instrlint init-ci --gitlab
```

## Skill installation

Use instrlint directly from Claude Code or Codex without leaving the editor:

```bash
# Claude Code (global)
npx instrlint install --claude-code

# Claude Code (project only)
npx instrlint install --claude-code --project

# Codex
npx instrlint install --codex
```

Then in your editor:

```
/instrlint
/instrlint --fix
/instrlint ci --fail-on warning
```

## Score and grade

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 90–100 | Excellent |
| B | 80–89 | Good |
| C | 70–79 | Fair |
| D | 60–69 | Poor |
| F | < 60 | Critical |

Deductions: critical finding −10 (cap −40), warning −5 (cap −30), info −1 (cap −10). Budget penalty: −5 if baseline > 25% of context, −15 if > 50%.

## Contributing

The primary differentiator is the config overlap patterns in `src/detectors/config-overlap.ts`. To add a new pattern:

1. Add a new entry to the `OVERLAP_PATTERNS` array
2. Map the rule keywords to the config file + field that enforces them
3. Add a test fixture in `tests/fixtures/sample-project/` that triggers the pattern
4. Add a test case in `tests/detectors/config-overlap.test.ts`

See [CLAUDE.md](CLAUDE.md) for full architecture documentation.

## License

MIT — see [LICENSE](LICENSE)
