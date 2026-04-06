import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Finding, ParsedInstructions, ParsedLine } from "../types.js";

// ─── Config reading helpers ───────────────────────────────────────────────────

function readJsonFile(projectRoot: string, filename: string): unknown | null {
  try {
    const content = readFileSync(join(projectRoot, filename), "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function readTextFile(projectRoot: string, filename: string): string | null {
  try {
    return readFileSync(join(projectRoot, filename), "utf8");
  } catch {
    return null;
  }
}

function checkEditorConfig(projectRoot: string, key: string): boolean {
  const content = readTextFile(projectRoot, ".editorconfig");
  if (!content) return false;
  return new RegExp(`^${key}\\s*=\\s*.+`, "m").test(content);
}

function checkPrettierConfig(projectRoot: string, field: string): boolean {
  // Try .prettierrc and .prettierrc.json
  for (const filename of [".prettierrc", ".prettierrc.json"]) {
    const parsed = readJsonFile(projectRoot, filename);
    if (parsed !== null && typeof parsed === "object" && parsed !== null) {
      if (field in (parsed as Record<string, unknown>)) return true;
    }
  }
  return false;
}

function getPrettierField(projectRoot: string, field: string): unknown {
  for (const filename of [".prettierrc", ".prettierrc.json"]) {
    const parsed = readJsonFile(projectRoot, filename);
    if (parsed !== null && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (field in obj) return obj[field];
    }
  }
  return undefined;
}

function checkEslintRule(projectRoot: string, ruleName: string): boolean {
  const parsed = readJsonFile(projectRoot, ".eslintrc.json");
  if (!parsed || typeof parsed !== "object") return false;
  const rules = (parsed as Record<string, unknown>)["rules"];
  if (!rules || typeof rules !== "object") return false;
  const val = (rules as Record<string, unknown>)[ruleName];
  if (val === undefined) return false;
  if (val === "off" || val === 0) return false;
  if (Array.isArray(val) && (val[0] === "off" || val[0] === 0)) return false;
  return true;
}

// ─── Overlap patterns ─────────────────────────────────────────────────────────

interface OverlapPattern {
  id: string;
  rulePattern: RegExp;
  configCheck: (projectRoot: string) => boolean;
  configName: string;
}

const PATTERNS: OverlapPattern[] = [
  {
    id: "ts-strict",
    rulePattern: /\b(typescript|ts)\b.*\bstrict\b|\bstrict\s*(mode|typing)/i,
    configCheck: (root) => {
      const tsconfig = readJsonFile(root, "tsconfig.json");
      if (!tsconfig || typeof tsconfig !== "object") return false;
      const opts = (tsconfig as Record<string, unknown>)["compilerOptions"];
      if (!opts || typeof opts !== "object") return false;
      return (opts as Record<string, unknown>)["strict"] === true;
    },
    configName: "tsconfig.json (compilerOptions.strict: true)",
  },
  {
    id: "indent-spaces",
    rulePattern: /\b(2|two|4|four)\s*(-?\s*)space\s*indent/i,
    configCheck: (root) =>
      checkEditorConfig(root, "indent_size") ||
      checkPrettierConfig(root, "tabWidth"),
    configName: ".editorconfig / .prettierrc (indentation)",
  },
  {
    id: "import-order",
    rulePattern: /import\s*(order|sort)|sort\s*import/i,
    configCheck: (root) => {
      const pkg = readJsonFile(root, "package.json");
      if (!pkg || typeof pkg !== "object") return false;
      const devDeps = (pkg as Record<string, unknown>)["devDependencies"];
      const hasPlugin =
        devDeps &&
        typeof devDeps === "object" &&
        "eslint-plugin-import" in devDeps;
      return hasPlugin === true && checkEslintRule(root, "import/order");
    },
    configName: "eslint-plugin-import (import/order)",
  },
  {
    id: "conventional-commit",
    rulePattern: /conventional\s*commit/i,
    configCheck: (root) => {
      // Check commitlint key in package.json
      const pkg = readJsonFile(root, "package.json");
      if (pkg && typeof pkg === "object" && "commitlint" in (pkg as object))
        return true;
      // Check commitlint config files
      const configFiles = [
        "commitlint.config.js",
        "commitlint.config.cjs",
        "commitlint.config.ts",
        ".commitlintrc",
        ".commitlintrc.json",
        ".commitlintrc.yaml",
        ".commitlintrc.yml",
      ];
      return configFiles.some((f) => existsSync(join(root, f)));
    },
    configName: "commitlint config",
  },
  {
    id: "semicolons",
    rulePattern: /\b(semicolons?|always\s*use\s*;|semi\s*colon)/i,
    configCheck: (root) => checkPrettierConfig(root, "semi"),
    configName: ".prettierrc (semi)",
  },
  {
    id: "single-quote",
    rulePattern: /single\s*quotes?|prefer\s*'|use\s*'/i,
    configCheck: (root) => getPrettierField(root, "singleQuote") === true,
    configName: ".prettierrc (singleQuote: true)",
  },
  {
    id: "trailing-comma",
    rulePattern: /trailing\s*comma/i,
    configCheck: (root) => checkPrettierConfig(root, "trailingComma"),
    configName: ".prettierrc (trailingComma)",
  },
  {
    id: "max-line-length",
    rulePattern:
      /\b(max|maximum)\s*(line\s*)?(length|width|chars?)\b|\bprint\s*width\b/i,
    configCheck: (root) => checkPrettierConfig(root, "printWidth"),
    configName: ".prettierrc (printWidth)",
  },
  {
    id: "no-console",
    rulePattern: /\b(no|avoid|remove)\b.*\bconsole\.(log|warn|error)/i,
    configCheck: (root) => checkEslintRule(root, "no-console"),
    configName: "eslint (no-console)",
  },
  {
    id: "no-unused-vars",
    rulePattern: /\b(no|remove|avoid)\s*(unused|dead)\s*(var|variable|import)/i,
    configCheck: (root) => {
      const tsconfig = readJsonFile(root, "tsconfig.json");
      if (tsconfig && typeof tsconfig === "object") {
        const opts = (tsconfig as Record<string, unknown>)["compilerOptions"];
        if (opts && typeof opts === "object") {
          const o = opts as Record<string, unknown>;
          if (o["noUnusedLocals"] === true || o["noUnusedParameters"] === true)
            return true;
        }
      }
      return (
        checkEslintRule(root, "no-unused-vars") ||
        checkEslintRule(root, "@typescript-eslint/no-unused-vars")
      );
    },
    configName: "tsconfig / eslint (no-unused-vars)",
  },
  {
    id: "test-framework",
    rulePattern: /\b(use|prefer)\s*(jest|vitest|mocha|jasmine)\b/i,
    configCheck: (root) => {
      const configs = [
        "vitest.config.ts",
        "vitest.config.js",
        "jest.config.ts",
        "jest.config.js",
        "jest.config.cjs",
        ".mocharc.js",
        ".mocharc.json",
        ".mocharc.yaml",
      ];
      if (configs.some((f) => existsSync(join(root, f)))) return true;
      const pkg = readJsonFile(root, "package.json");
      if (!pkg || typeof pkg !== "object") return false;
      const devDeps = (pkg as Record<string, unknown>)["devDependencies"] ?? {};
      return ["jest", "vitest", "mocha", "jasmine"].some(
        (fw) => typeof devDeps === "object" && fw in (devDeps as object),
      );
    },
    configName: "test framework config file",
  },
  {
    id: "formatter",
    rulePattern: /\b(format|prettier|biome)\s*(code|files|on\s*save)/i,
    configCheck: (root) => {
      const prettierFiles = [
        ".prettierrc",
        ".prettierrc.json",
        ".prettierrc.yaml",
        ".prettierrc.yml",
      ];
      if (prettierFiles.some((f) => existsSync(join(root, f)))) return true;
      return existsSync(join(root, "biome.json"));
    },
    configName: "prettier / biome config file",
  },
  {
    id: "end-of-line",
    rulePattern: /\b(line\s*ending|eol|crlf|lf)\b/i,
    configCheck: (root) =>
      checkEditorConfig(root, "end_of_line") ||
      checkPrettierConfig(root, "endOfLine"),
    configName: ".editorconfig / .prettierrc (endOfLine)",
  },
  {
    id: "tab-width",
    rulePattern: /\btab\s*(width|size)\b/i,
    configCheck: (root) =>
      checkEditorConfig(root, "tab_width") ||
      checkEditorConfig(root, "indent_size") ||
      checkPrettierConfig(root, "tabWidth"),
    configName: ".editorconfig / .prettierrc (tabWidth)",
  },
  {
    id: "no-default-export",
    rulePattern: /\b(no|avoid|prefer\s*named)\s*(default\s*export)/i,
    configCheck: (root) =>
      checkEslintRule(root, "import/no-default-export") ||
      checkEslintRule(root, "no-restricted-exports"),
    configName: "eslint-plugin-import (no-default-export)",
  },
];

// ─── Detector ─────────────────────────────────────────────────────────────────

function collectRuleLines(
  instructions: ParsedInstructions,
): Array<{ line: ParsedLine; file: string }> {
  const result: Array<{ line: ParsedLine; file: string }> = [];
  for (const l of instructions.rootFile.lines) {
    if (l.type === "rule")
      result.push({ line: l, file: instructions.rootFile.path });
  }
  for (const sub of instructions.subFiles) {
    for (const l of sub.lines) {
      if (l.type === "rule") result.push({ line: l, file: sub.path });
    }
  }
  for (const rule of instructions.rules) {
    for (const l of rule.lines) {
      if (l.type === "rule") result.push({ line: l, file: rule.path });
    }
  }
  return result;
}

export function detectConfigOverlaps(
  instructions: ParsedInstructions,
  projectRoot: string,
): Finding[] {
  const findings: Finding[] = [];
  const ruleLines = collectRuleLines(instructions);

  for (const { line, file } of ruleLines) {
    for (const pattern of PATTERNS) {
      if (
        pattern.rulePattern.test(line.text) &&
        pattern.configCheck(projectRoot)
      ) {
        const ruleText = line.text.trim();
        const short =
          ruleText.length > 60 ? ruleText.slice(0, 60) + "…" : ruleText;
        findings.push({
          severity: "warning",
          category: "dead-rule",
          file,
          line: line.lineNumber,
          messageKey: "deadRule.configOverlap",
          messageParams: {
            rule: ruleText.slice(0, 80),
            config: pattern.configName,
          },
          suggestion: `Rule "${short}" is already enforced by ${pattern.configName}`,
          autoFixable: true,
        });
        break; // one pattern match per line is enough
      }
    }
  }

  return findings;
}
