---
description: Token estimator implementation gotchas
paths:
  - src/detectors/token-estimator.ts
---

# Token Estimator Gotchas

- `js-tiktoken` is a dependency, not a peer dependency. It should always be installed. The fallback path is for edge cases where the wasm binary fails to load at runtime, not for optional installation.
- `token-estimator.ts` initialization uses a single module-level IIFE Promise (`initPromise`). All callers `await ensureInitialized()` which awaits the same Promise — guarantees the encoder is truly ready before any tokenization. Do NOT revert to a boolean flag; the race condition (flag set before `await import()` completes) caused all counts to show "estimated".
- `cl100k_base` is not Claude's exact tokenizer. It's close enough for instruction file analysis (typically within 5-10% of actual). Don't claim it's exact — say "measured with cl100k_base encoding" when asked about methodology.
