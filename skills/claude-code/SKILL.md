---
name: instrlint
description: Health check your CLAUDE.md and rule files — find dead rules, token waste, duplicates, contradictions, and stale references. Produces a scored health report (0-100) with auto-fix support.
command: /instrlint
argument-hint: "[budget|deadrules|structure|ci] [--fix] [--lang zh-TW]"
---

# instrlint

Lint and optimize agent instruction files. Produces a scored health report across three dimensions: token budget, dead rules, and structure.

## How to run

**Always run with `--format markdown`** so the report renders properly in Claude Code. Never use the default terminal format — it uses ANSI colors and box-drawing characters that don't display correctly here.

Then **present the markdown report directly to the user** — do not summarize or paraphrase it.

## Language detection

**Always detect the language of the current conversation before running:**

- 繁體中文 conversation → add `--lang zh-TW`
- English conversation → add `--lang en`
- Any other language → fall back to `--lang en`

## Command mapping

When the user runs `/instrlint [args]`, translate to:

| User input | Command to run |
|------------|---------------|
| `/instrlint` | `npx instrlint@latest --format markdown --lang <detected>` |
| `/instrlint budget` | `npx instrlint@latest budget --format markdown --lang <detected>` |
| `/instrlint deadrules` | `npx instrlint@latest deadrules --format markdown --lang <detected>` |
| `/instrlint structure` | `npx instrlint@latest structure --format markdown --lang <detected>` |
| `/instrlint --fix` | `npx instrlint@latest --fix --lang <detected>` then present the fix summary as-is |
| `/instrlint ci --fail-on warning` | `npx instrlint@latest ci --format markdown --fail-on warning --lang <detected>` |
| `/instrlint --verify` | 執行下方「LLM 驗證流程」四步驟 |
| `/instrlint structure --verify` | 同上，但僅對 structure 類別的 findings 進行 LLM 複核 |

## LLM 驗證流程（--verify）

contradiction / duplicate detector 是純文字啟發式，可能產生 false positive。你（host agent）能讀懂語意，可以複核這些 findings。

**協議概念：** instrlint 不會自己呼叫 LLM API。它把可疑 findings 寫成 `candidates.json`，由你判斷後寫 `verdicts.json`，再由 instrlint merge 回報告。

### 四步驟

**Step 1** — 產出 candidates：

```bash
npx instrlint@latest --emit-candidates /tmp/instrlint-candidates.json --skip-report --lang <detected>
```

**Step 2** — 讀取並判斷：

用 Read tool 讀 `/tmp/instrlint-candidates.json`。對每個 candidate，根據下方「判斷框架」做出 verdict。

**Step 3** — 寫出 verdicts：

用 Write tool 寫 `/tmp/instrlint-verdicts.json`：

```json
{
  "version": 1,
  "verdicts": [
    { "id": "a3f1c9e2b4d6", "verdict": "rejected", "reason": "兩條規則 context 無關" }
  ]
}
```

每個 verdict 的 `id` 必須與 candidates.json 中的 `id` 完全對應（12-char hex）。`verdict` 為 `confirmed` / `rejected` / `uncertain`，`reason` ≤ 500 字元。

**Step 4** — 套用 verdicts 並呈現報告：

```bash
npx instrlint@latest --apply-verdicts /tmp/instrlint-verdicts.json --format markdown --lang <detected>
```

把輸出的 markdown 報告原樣呈現給使用者，不要摘要或改寫。

### candidates.json 格式

```json
{
  "version": 1,
  "generatedAt": "2026-04-07T12:00:00.000Z",
  "projectRoot": "/absolute/path/to/project",
  "candidates": [
    {
      "id": "a3f1c9e2b4d6",
      "category": "contradiction",
      "question": "Do rules A and B actually contradict each other in practice?...",
      "context": {
        "type": "contradiction",
        "ruleA": { "file": "CLAUDE.md", "line": 10, "text": "Use exceptions for error handling." },
        "ruleB": { "file": "CLAUDE.md", "line": 20, "text": "Never throw exceptions, use Result<T> instead." }
      },
      "originalFinding": { "severity": "critical", "category": "contradiction", "file": "CLAUDE.md", "line": 20, "..." }
    }
  ]
}
```

## 判斷框架（host agent 用）

### contradiction

- **confirmed**：開發者同時遵守 ruleA 和 ruleB 在某些情境下做不到（真實衝突）
- **rejected**：兩條規則各做各的、context 不同、或只是字面上有否定詞（false positive）
- **uncertain**：語意模糊，無法從現有 context 判斷

### duplicate

- **confirmed**：兩條規則用不同措辭說同一件事，刪掉一條沒有任何資訊損失
- **rejected**：表面相似但實際說的是不同的細節 / 範圍 / 例外
- **uncertain**：判不出來

### 通則

- 先讀 `candidate.context.ruleA.text` / `ruleB.text`，必要時用 Read tool 看該 file 的上下文
- `reason` 實務上寫 ≤ 20 字即可（上限 500 字元，instrlint 會驗證）
- 沒有 verdict 的 candidate 不需要寫進 verdicts.json（instrlint 會保留它不動）
- `rejected` findings 在最終報告中會被過濾掉；`confirmed` 和 `uncertain` 會附上你的 reason 顯示

## What it checks

- **Budget** — token consumption across all instruction files and MCP servers. Flags files > 200 lines, baselines > 25% of context window.
- **Dead rules** — rules already enforced by tsconfig, prettier, eslint, commitlint, editorconfig, and more. ~15 overlap patterns.
- **Structure** — contradictions between rules, stale file references, duplicates, and path-scoping opportunities.

## Auto-fix (--fix)

Auto-applied (safe, deterministic):
- Rules already enforced by config files (dead rules)
- References to non-existent files (stale refs)
- Exact duplicate rules

Actionable suggestions shown after fix (requires human judgment):
- Git hook suggestions — copy-paste `.claude/settings.json` snippet
- Path-scoped rule file suggestions — ready-to-create file content

## Score and grade

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 90–100 | Excellent — minor issues only |
| B | 80–89 | Good — a few improvements possible |
| C | 70–79 | Fair — some issues to address |
| D | 60–69 | Poor — significant problems |
| F | < 60 | Critical — needs immediate attention |

## Supported tools

Claude Code, Codex, Cursor — auto-detected from project structure.
