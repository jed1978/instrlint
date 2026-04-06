# instrlint

[![npm](https://img.shields.io/npm/v/instrlint)](https://www.npmjs.com/package/instrlint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/jed1978/instrlint/actions/workflows/ci.yml/badge.svg)](https://github.com/jed1978/instrlint/actions/workflows/ci.yml)

[English](README.md) | 繁體中文

**instrlint 會 lint 自己。**

Lint 並優化你的 `CLAUDE.md` / `AGENTS.md` — 找出冗餘規則、token 浪費和結構問題。一個指令、一個分數、一份報告。

## 快速開始

```bash
npx instrlint
```

無需安裝。在含有 `CLAUDE.md` 或 `AGENTS.md` 的專案根目錄執行即可。

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

## 功能特色

**Token 預算** — 使用 `cl100k_base` encoding 計算所有指令檔的 token 用量（無法載入時自動降級為字元估算）。標記超過 200 行的檔案，以及 baseline context 超過視窗 25% 的情況。

**冗餘規則偵測** — 偵測已被 config 檔強制執行的規則。涵蓋 TypeScript strict mode、Prettier 格式化、ESLint 規則、conventional commits、EditorConfig 等約 15 種重疊模式。

**結構分析** — 找出互相矛盾的規則、過時的檔案參照、完全相同和高度相似的重複規則，以及路徑範圍化的優化機會。

**自動修復** — `--fix` 安全地移除冗餘規則、過時參照和完全重複的規則。需要乾淨的 git 工作目錄。

**CI 整合** — `instrlint ci` 依 findings 嚴重程度回傳 exit code 0 或 1，並支援 SARIF 輸出供 GitHub Code Scanning 使用。

## 支援工具

| 工具 | 根指令檔 | 設定目錄 |
|------|----------|----------|
| Claude Code | `CLAUDE.md` | `.claude/` |
| Codex | `AGENTS.md` | `.agents/`, `.codex/` |
| Cursor | `.cursorrules` | `.cursor/` |

從專案結構自動偵測。可用 `--tool` 強制指定。

## 指令

```bash
instrlint                         # 完整健康檢查 — 分數、等級、首要問題
instrlint budget                  # 僅 token 預算分析
instrlint deadrules               # 僅冗餘規則偵測
instrlint structure               # 僅結構分析
instrlint --fix                   # 自動修復安全問題
instrlint --fix --force           # 跳過 git clean 檢查

instrlint --format json           # JSON 輸出（供 CI、腳本使用）
instrlint --format markdown       # Markdown 輸出（供 PR 留言使用）
instrlint --lang zh-TW            # 繁體中文輸出

instrlint ci                      # CI 模式：嚴重問題時 exit 1
instrlint ci --fail-on warning    # 警告也 exit 1
instrlint ci --format sarif       # SARIF 輸出供 GitHub Code Scanning
instrlint ci --output report.sarif  # 寫入檔案

instrlint init-ci --github        # 產生 .github/workflows/instrlint.yml
instrlint init-ci --gitlab        # 輸出 GitLab CI 設定片段

instrlint install --claude-code   # 安裝為全域 Claude Code skill
instrlint install --claude-code --project  # 安裝到專案
instrlint install --codex         # 安裝為 Codex skill
```

## CI 整合

### GitHub Actions

```bash
npx instrlint init-ci --github
```

此指令會建立 `.github/workflows/instrlint.yml`，包含：
- 在 `CLAUDE.md`、`.claude/**`、`AGENTS.md` 等檔案變更時觸發
- 執行 `instrlint ci --fail-on warning --format sarif`
- 上傳 SARIF 至 GitHub Code Scanning

或加入現有 CI：

```yaml
- name: Run instrlint
  run: npx instrlint@latest ci --fail-on warning
```

### GitLab CI

```bash
npx instrlint init-ci --gitlab
```

## Skill 安裝

不離開編輯器直接從 Claude Code 或 Codex 使用 instrlint：

```bash
# Claude Code（全域）
npx instrlint install --claude-code

# Claude Code（僅專案）
npx instrlint install --claude-code --project

# Codex
npx instrlint install --codex
```

安裝後在編輯器中使用：

```
/instrlint
/instrlint --fix
/instrlint ci --fail-on warning
```

## 分數與等級

| 等級 | 分數 | 說明 |
|------|------|------|
| A | 90–100 | 優秀 |
| B | 80–89 | 良好 |
| C | 70–79 | 尚可 |
| D | 60–69 | 較差 |
| F | < 60 | 嚴重 |

扣分規則：嚴重問題 −10（上限 −40）、警告 −5（上限 −30）、建議 −1（上限 −10）。預算懲罰：baseline 超過 context 的 25% 扣 −5，超過 50% 扣 −15。

## 貢獻

核心差異化功能是 `src/detectors/config-overlap.ts` 中的 config 重疊規則。新增規則的方式：

1. 在 `OVERLAP_PATTERNS` 陣列新增一筆
2. 將規則關鍵字對應到強制執行它的 config 檔 + 欄位
3. 在 `tests/fixtures/sample-project/` 新增觸發該規則的 fixture
4. 在 `tests/detectors/config-overlap.test.ts` 新增測試案例

完整架構文件請參閱 [CLAUDE.md](CLAUDE.md)。

## 授權

MIT — 詳見 [LICENSE](LICENSE)
