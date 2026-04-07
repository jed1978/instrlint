---
name: instrlint
description: Health check your AGENTS.md and rule files — find dead rules, token waste, duplicates, contradictions, and stale references.
command: /instrlint
argument-hint: "[budget|deadrules|structure|ci] [--fix] [--format json|markdown|sarif]"
---

# instrlint

Lint and optimize agent instruction files. Produces a scored health report across three dimensions: token budget, dead rules, and structure.

## Language detection

**Always detect the language of the current conversation before running instrlint:**

- If the user is conversing in **Traditional Chinese (繁體中文)**: run with `--lang zh-TW`
- If the user is conversing in **English**: run with `--lang en`
- For any other language instrlint does not support: fall back to `--lang en`

## Usage

```
/instrlint                          # Full health check (score + grade)
/instrlint budget                   # Token budget analysis only
/instrlint deadrules                # Dead rule detection only
/instrlint structure                # Structural analysis only
/instrlint ci --fail-on warning     # CI mode: exit 1 if warnings found
/instrlint --fix                    # Auto-fix safe issues + show actionable suggestions
/instrlint --format json            # JSON output for CI
/instrlint --format markdown        # Markdown output for PR comments
/instrlint install --codex          # Install skill into .agents/skills/
/instrlint --verify                 # LLM-assisted two-pass verification (see below)
```

## LLM 驗證流程（--verify）

contradiction / duplicate detector 是純文字啟發式，可能產生 false positive。你（host agent）能讀懂語意，可以複核這些 findings。

**協議概念：** instrlint 不會自己呼叫 LLM API。它把可疑 findings 寫成 `candidates.json`，由你判斷後寫 `verdicts.json`，再由 instrlint merge 回報告。

### 四步驟

**Step 1** — 產出 candidates：

```bash
npx instrlint@latest --emit-candidates /tmp/instrlint-candidates.json --skip-report --lang <detected>
```

**Step 2** — 讀取並判斷：

讀 `/tmp/instrlint-candidates.json`。對每個 candidate，根據下方「判斷框架」做出 verdict。

**Step 3** — 寫出 verdicts：

寫 `/tmp/instrlint-verdicts.json`：

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

- 先讀 `candidate.context.ruleA.text` / `ruleB.text`，必要時看該 file 的上下文
- `reason` 實務上寫 ≤ 20 字即可（上限 500 字元，instrlint 會驗證）
- 沒有 verdict 的 candidate 不需要寫進 verdicts.json（instrlint 會保留它不動）
- `rejected` findings 在最終報告中會被過濾掉；`confirmed` 和 `uncertain` 會附上你的 reason 顯示

## What it checks

- **Budget** — token consumption across AGENTS.md, skills, and MCP servers.
- **Dead rules** — rules already enforced by tsconfig, prettier, eslint, and other config files.
- **Structure** — contradictions, stale file references, duplicates, and path-scoping opportunities.
