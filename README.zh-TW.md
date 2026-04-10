# instrlint

[![npm](https://img.shields.io/npm/v/instrlint)](https://www.npmjs.com/package/instrlint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/jed1978/instrlint/actions/workflows/ci.yml/badge.svg)](https://github.com/jed1978/instrlint/actions/workflows/ci.yml)

[English](README.md) | 繁體中文

**instrlint 會 lint 自己。**

## 為什麼需要 instrlint？

`CLAUDE.md` 會隨時間膨脹。規則從範本複製過來、在不同段落重複出現、或留著指向早已不存在的檔案。有些規則默默地和 `tsconfig.json`、`.editorconfig` 重複——白白佔用 token 預算，什麼好處也沒有。

instrlint 掃描你的指令檔，告訴你哪裡要修。一個指令、一個分數、一份可執行的報告。

有兩件事讓它和單純的行數計算工具不同：

- **Host 協調的 LLM 驗證** — 在 Claude Code 執行 `/instrlint --verify`，host model 自己判斷有疑義的 findings。不需要 API key，不需要外部服務。當前 session 裡已在運行的模型就是驗證者。
- **拆分決策引導** — 根指令檔太長時，instrlint 不只說「去拆一拆」，而是逐段引導你做決定：每個段落會被分入四個桶，再依你選擇的範圍執行——因為並非每份過長的 CLAUDE.md 都該用同一種方式拆。

支援 Claude Code、Codex 和 Cursor。測試完整。從 v0.2.3 開始用自己 lint 自己。

## 快速開始

```bash
npx instrlint
```

在含有 `CLAUDE.md` 或 `AGENTS.md` 的專案根目錄執行即可，免安裝。

或全域安裝，在任何專案都能直接使用：

```bash
npm install -g instrlint
instrlint
```

## 輸出範例

```
  ╭──────────────────────────────────────────────────╮
  │  instrlint  ─  sample-project                    │
  │  claude-code  ·  measured                        │
  ├──────────────────────────────────────────────────┤
  │  ███████████████░░░░░░░░░░░░░░░  50/100   F      │
  ╰──────────────────────────────────────────────────╯

  ── 預算 ──────────────────────────────────────────────
  18,957 / 200,000 tokens (9%)  █░░░░░░░░░░░░░

  ── 問題總覽 ────────────────────────────────────────────
  Contradictions    ✖ 1
  Budget            ⚠ 1
  Dead rules        ⚠ 5
  Duplicates        ⚠ 1  ℹ 1
  Stale refs        ⚠ 2
  Structure         ℹ 11

  ── 首要問題 ────────────────────────────────────────────
  1. ✖  規則矛盾：「Use exceptions for error handling. Throw errors with descrip..…
  2. ⚠  根指令檔有 206 行（建議：< 200 行）
  3. ⚠  規則「Always use TypeScript strict mode. Enable all strict checks to ca…
  4. ⚠  規則「Use 2-space indentation for all files. Never use tabs.」已由 .editor…
  5. ⚠  規則「Always use semicolons at the end of statements.」已由 .prettierrc (s…
     … 還有 17 個（執行 instrlint <command> 查看詳情）

  ── 1 個嚴重問題 · 9 個警告 · 12 個建議 ────────────────────────
```

加上 `--lang zh-TW` 即可取得完整繁體中文輸出：

```bash
npx instrlint --lang zh-TW
```

## 能找出什麼問題

**Token 預算** — 使用 `cl100k_base` encoding 計算所有指令檔和 MCP server 的 token 用量。標記超過 200 行的根指令檔，以及超過 context 視窗 25% 的情況。

**冗餘規則** — 偵測已被 config 檔強制執行的規則：TypeScript strict mode、Prettier 格式化、ESLint、EditorConfig、conventional commits、C# `.csproj`/`.editorconfig` 設定等，約 20 種模式，涵蓋 JS/TS 和 C# 生態系。

**結構問題** — 互相矛盾的規則、過時的檔案參照、高度相似的重複規則，以及路徑範圍化的優化機會。

**自動修復** — `--fix` 安全地移除冗餘規則、過時參照和完全重複的規則。需要乾淨的 git 工作目錄。

**CI 整合** — `instrlint ci` 依嚴重程度回傳 exit code。支援 SARIF 輸出供 GitHub Code Scanning 使用。使用 `instrlint init-ci --github` 產生 workflow 設定。

## 支援工具

| 工具 | 根指令檔 | 設定目錄 |
|------|----------|----------|
| Claude Code | `CLAUDE.md` | `.claude/` |
| Codex | `AGENTS.md` | `.agents/`, `.codex/` |
| Cursor | `.cursorrules` | `.cursor/` |

從專案結構自動偵測。可用 `--tool` 強制指定。

## 支援生態系（冗餘規則偵測）

| 生態系 | 檢查的 config 檔 |
|--------|------------------|
| JavaScript / TypeScript | `tsconfig.json`、`.eslintrc.*`、`.prettierrc.*`、`.editorconfig`、`commitlint.config.*` |
| C# / .NET | `.csproj`、`Directory.Build.props`、`.editorconfig`（`dotnet_*`、`csharp_*` 欄位）|

更多生態系（Python、Go、Rust）列入規劃。歡迎參閱[貢獻](#貢獻)新增規則。

## 在 Claude Code 或 Codex 中使用

安裝一次 skill：

```bash
npx instrlint install --claude-code          # 全域（~/.claude/commands/）
npx instrlint install --claude-code --project  # 僅專案
npx instrlint install --codex
```

重新啟動編輯器以載入指令，然後使用：

```
/instrlint           # 完整報告
/instrlint --fix     # 自動修復安全問題
/instrlint --verify  # LLM 驗證報告 — 不需要 API key
```

> **注意：** Claude Code 只在啟動時載入 custom commands。`/reload-plugins` 無法載入新安裝的指令。

當報告需要更深入的審查，skill 會自動觸發兩段式驗證：instrlint 將低信心的 findings 寫成 `candidates.json`，host model 逐一判斷後寫 `verdicts.json`，再由 instrlint 合併結果——過濾 false positive，並附上 `✓` / `❓` badge。不需要 API key；當前 session 的模型就是驗證者。

根指令檔過長時，`/instrlint` 會引導你做拆分決策：每個段落被分入四個桶——值得抽出（低載入率）、可抽出但不省 token、該刪不是該搬、或必須留在原檔。你選範圍，skill 執行。

## 常用指令

```bash
instrlint                           # 完整健康檢查
instrlint --fix                     # 自動修復冗餘規則、過時參照、重複規則
instrlint --format markdown         # Markdown 輸出（供 PR 留言使用）
instrlint --lang zh-TW              # 繁體中文輸出

instrlint ci --fail-on warning      # CI 模式：警告也 exit 1
instrlint init-ci --github          # 產生 GitHub Actions workflow

instrlint install --claude-code     # 安裝為 Claude Code skill

# LLM 驗證（兩段式，不需要 API key）
instrlint --emit-candidates instrlint-candidates.json
instrlint --apply-verdicts instrlint-verdicts.json
```

所有選項請執行：`instrlint --help`

## 貢獻

核心差異化功能是 `src/detectors/config-overlap.ts` 中的 config 重疊規則。新增規則的方式：

1. 在 `OVERLAP_PATTERNS` 陣列新增一筆
2. 將規則關鍵字對應到強制執行它的 config 檔 + 欄位
3. 在 `tests/fixtures/` 新增觸發該規則的 fixture
4. 在 `tests/detectors/config-overlap.test.ts` 新增測試案例

完整架構文件請參閱 [CLAUDE.md](CLAUDE.md)。

## 授權

MIT — 詳見 [LICENSE](LICENSE)
