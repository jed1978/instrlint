---
name: instrlint
description: Lint and optimize agent instruction files. Use when the user wants to lint, audit, refactor, or optimize their CLAUDE.md, AGENTS.md, .cursorrules, or related instruction files — finds dead rules, token waste, duplicates, contradictions, and stale references. Produces a scored health report (0–100) with auto-fix and host-orchestrated LLM verification.
command: /instrlint
argument-hint: "[budget|deadrules|structure|ci] [--fix] [--verify] [--lang zh-TW]"
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

contradiction / duplicate / structure detector 是純文字啟發式，可能產生 false positive。你（host agent）能讀懂語意，可以複核這些 findings。

**協議概念：** instrlint 不會自己呼叫 LLM API。它把可疑 findings 寫成 `candidates.json`，由你判斷後寫 `verdicts.json`，再由 instrlint merge 回報告。

### 四步驟

**Step 1** — 產出 candidates：

```bash
npx instrlint@latest --emit-candidates instrlint-candidates.json --skip-report --lang <detected>
```

**Step 2** — 讀取並判斷：

用 Read tool 讀 `instrlint-candidates.json`。對每個 candidate，根據下方「判斷框架」做出 verdict。

**Step 3** — 寫出 verdicts：

用 Write tool 寫 `instrlint-verdicts.json`：

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
npx instrlint@latest --apply-verdicts instrlint-verdicts.json --format markdown --lang <detected>
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

### structure

- **confirmed**：這條規則確實更適合由 git hook 或 path-scoped rule file 自動執行，放在 CLAUDE.md 中是多餘的
- **rejected**：這條規則是架構決策說明、一般性原則、或需要人工判斷的 context，不適合用工具強制執行（例：「LLM 驗證必須由 host orchestrate」是設計原則，不是 git hook 能攔的）
- **uncertain**：無法判斷，需要看更多 context

### 通則

- structure：先讀 `candidate.context.rule.text` 和 `candidate.context.suggestion`
- contradiction / duplicate：先讀 `candidate.context.ruleA.text` / `ruleB.text`
- 必要時用 Read tool 看該 file 的上下文
- `reason` 實務上寫 ≤ 20 字即可（上限 500 字元，instrlint 會驗證）
- 沒有 verdict 的 candidate 不需要寫進 verdicts.json（instrlint 會保留它不動）
- `rejected` findings 在最終報告中會被過濾掉；`confirmed` 和 `uncertain` 會附上你的 reason 顯示

## CLAUDE.md 拆分引導

當 instrlint 報告出現以下任一情況時，**不要直接貼建議文字**，改走「拆分決策 walkthrough」：

- Budget 警告：根指令檔超過建議行數（> 200 行）
- Structure findings 含 path-scope 建議（`messageKey: structure.scopePathScoped`）

### Walkthrough 流程

1. **Read** 該檔，列出主要段落（標題 + 行數）
2. **逐段分類**，套用下方 4-bucket 框架；若一個段落混合多個 bucket，以主體為準並在決策表中標注
3. **呈現決策表**給 user（段落名稱 / 行數 / 建議動作 / 原因）
4. **詢問** user：「最小拆（只處理 bucket 1）/ 全拆（bucket 1 + 2 + 3 均處理）/ 自選」
5. **對選定段落執行對應行動**：bucket 1 → 抽出到 `.claude/rules/` 並引導寫 `paths:` / `globs:` frontmatter；bucket 2 → 抽出但**不加** path-scope frontmatter；bucket 3 → 替換成一行指標

### 4-bucket 分類框架

| Bucket | 條件 | 行動 |
|---|---|---|
| **1. 實質節省** | 綁特定檔案/模組，多數對話用不到（< 30% 載入率）| 抽出 + `paths:` / `globs:` frontmatter |
| **2. 可抽出但不節省** | 全域通用，任何任務都會載入（> 80% 載入率）| 可純抽出讓 CLAUDE.md 變短，總 token 不變 |
| **3. 該刪不是該搬** | 跟 source code 重複（例：型別定義已在 `src/types.ts`）| 替換成一行指標 |
| **4. 留在 CLAUDE.md** | 跨對話必需的決策 / commands / 狀態 | 不動 |

**載入頻率判斷標準：** 問自己「多少比例的對話會載入這個 scope？」
- > 80% → bucket 2 或 4（path-scope 無效，不值得拆）
- 30–80% → 視維護成本決定
- < 30% → bucket 1（實質節省）

### 範例

| 段落 | Bucket | 理由 |
|---|---|---|
| 特定模組的 gotchas | 1 — 實質節省 | 只在改該模組時需要，scope 到對應 `src/` 路徑 |
| Coding conventions | 2 — 可抽出但不節省 | 寫任何 .ts 都會載入，拆不拆總 token 相同 |
| Key types（型別定義，**與 source file 完全一致無額外說明**）| 3 — 該刪不是該搬 | 重複資訊，留一行 `see src/types.ts` 即可 |
| Architecture decisions | 4 — 留在 CLAUDE.md | 跨檔設計原則，每次對話都需要 |

> **原則：** path-scope 的目的是「在不需要這段規則的對話中完全不載入」。如果 scope 後還是幾乎每次都載入，就是 bucket 2，不是 bucket 1。

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
