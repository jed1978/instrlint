---
description: Reporter, i18n, and fixer implementation gotchas
paths:
  - src/core/reporter.ts
  - src/i18n/
  - src/fixers/
  - src/commands/run-command.ts
  - src/commands/budget-command.ts
---

# Reporter, i18n & Fixer Gotchas

- Token counts for user-facing display: use `Intl.NumberFormat` for locale-aware formatting (e.g. "4,217" in en, "4,217" in zh-TW).
- i18n: the user's CLAUDE.md content may be in any language. instrlint's UI language (`--lang`) is independent of the content language. Never translate the user's rule text — only translate instrlint's own labels, messages, and suggestions.
- The `--fix` command must check for clean git working tree before modifying files. If dirty, warn and require `--force`.
