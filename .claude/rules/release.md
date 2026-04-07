---
globs:
  - package.json
  - src/utils/skill-version.ts
---

# Release workflow

每次發布前**必須先升版號**，否則 `npm publish` 會回傳 403 Forbidden。

## 步驟

```bash
# 1. 確認目前版本
node -e "console.log(require('./package.json').version)"

# 2. 升版號（只需修改一個地方）
#    - package.json → "version"
#    CURRENT_VERSION 和 cli --version 都直接從 package.json 讀取，自動同步

# 3. 品質檢查
pnpm check        # typecheck + lint + test

# 4. 建置
pnpm build

# 5. 確認打包內容
npm pack --dry-run

# 6. commit & push
git add package.json src/utils/skill-version.ts
git commit -m "chore: bump version to x.y.z"
git push

# 7. 發布
npm publish
```

## 版本號規則（Semantic Versioning）

| 類型 | 版號 | 適用情況 |
|------|------|---------|
| patch | 0.1.x | bug fix、文件更新、小幅調整 |
| minor | 0.x.0 | 新功能、向下相容 |
| major | x.0.0 | breaking change |

## 常見錯誤

- **403 Forbidden "cannot publish over previously published versions"** — 忘記升版號。先更新 `package.json`，重新 build 後再 publish。
- **版本號讀取失敗回傳 "0.0.0"** — `skill-version.ts` 的 `readPackageVersion()` 找不到 `package.json` 時的 fallback。通常不會發生，除非 package 結構異常。
