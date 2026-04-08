---
description: Parser and adapter implementation gotchas
paths:
  - src/core/parser.ts
  - src/adapters/
---

# Parser & Adapter Gotchas

- CLAUDE.md format is freeform markdown — parser must be very tolerant. Lines that can't be classified should be typed as `other` and skipped, never error.
- `.claude/rules/*.md` files may have YAML frontmatter with `paths:` or `globs:` fields — parse both variants.
- Codex uses `.agents/` (project) and `~/.codex/` (global). Cursor uses `.cursor/rules/` and `.cursorrules` (flat file). Each adapter handles its own structure.
- `settings.json` in `.claude/` may or may not exist. MCP config might be in `settings.local.json` instead. Check both.
- Some users put CLAUDE.md at project root, others at `.claude/CLAUDE.md`. Support both.
