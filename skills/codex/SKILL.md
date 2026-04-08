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
npx instrlint@latest --emit-candidates instrlint-candidates.json --skip-report --lang <detected>
```

**Step 2** — 讀取並判斷：

讀 `instrlint-candidates.json`。對每個 candidate，根據下方「判斷框架」做出 verdict。

**Step 3** — 寫出 verdicts：

寫 `instrlint-verdicts.json`：

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

## AGENTS.md 拆分引導

當 instrlint 報告出現以下任一情況時，**不要直接貼建議文字**，改走「拆分決策 walkthrough」：

- Budget 警告：根指令檔超過建議行數（> 200 行）
- Structure findings 含 path-scope 建議（`messageKey: structure.scopePathScoped`）

### Walkthrough 流程

1. **Read** 該檔，列出主要段落（標題 + 行數）
2. **逐段分類**，套用下方 4-bucket 框架；若一個段落混合多個 bucket，以主體為準並在決策表中標注
3. **呈現決策表**給 user（段落名稱 / 行數 / 建議動作 / 原因）
4. **詢問** user：「最小拆（只處理 bucket 1）/ 全拆（bucket 1 + 2 + 3 均處理）/ 自選」
5. **對選定段落執行對應行動**：bucket 1 → 抽出到 `.agents/rules/` 並引導寫 `paths:` / `globs:` frontmatter；bucket 2 → 抽出但**不加** path-scope frontmatter；bucket 3 → 替換成一行指標

### 4-bucket 分類框架

| Bucket | 條件 | 行動 |
|---|---|---|
| **1. 實質節省** | 綁特定檔案/模組，多數對話用不到（< 30% 載入率）| 抽出到 `.agents/rules/` + `paths:` / `globs:` frontmatter |
| **2. 可抽出但不節省** | 全域通用，任何任務都會載入（> 80% 載入率）| 可純抽出讓 AGENTS.md 變短，總 token 不變 |
| **3. 該刪不是該搬** | 跟 source code 重複（例：型別定義已在原始檔中）| 替換成一行指標 |
| **4. 留在 AGENTS.md** | 跨對話必需的決策 / commands / 狀態 | 不動 |

**載入頻率判斷標準：** 問自己「多少比例的對話會載入這個 scope？」
- > 80% → bucket 2 或 4（path-scope 無效，不值得拆）
- 30–80% → 視維護成本決定
- < 30% → bucket 1（實質節省）

### 範例

| 段落 | Bucket | 理由 |
|---|---|---|
| 特定模組的 gotchas | 1 — 實質節省 | 只在改該模組時需要，scope 到對應 `src/` 路徑 |
| Coding conventions | 2 — 可抽出但不節省 | 寫任何 .ts 都會載入，拆不拆總 token 相同 |
| Key types（型別定義，**與 source file 完全一致無額外說明**）| 3 — 該刪不是該搬 | 重複資訊，留一行 source file 指標即可 |
| Architecture decisions | 4 — 留在 AGENTS.md | 跨檔設計原則，每次對話都需要 |

> **原則：** path-scope 的目的是「在不需要這段規則的對話中完全不載入」。如果 scope 後還是幾乎每次都載入，就是 bucket 2，不是 bucket 1。

## What it checks

- **Budget** — token consumption across AGENTS.md, skills, and MCP servers.
- **Dead rules** — rules already enforced by tsconfig, prettier, eslint, and other config files.
- **Structure** — contradictions, stale file references, duplicates, and path-scoping opportunities.
