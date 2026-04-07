---
globs:
  - src/detectors/token-estimator.ts
  - src/analyzers/budget.ts
---

# Token counting strategy

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
