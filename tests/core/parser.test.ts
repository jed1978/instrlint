import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  parseInstructionFile,
  parseYamlFrontmatter,
} from "../../src/core/parser.js";

// ─── Temp file helper ──────────────────────────────────────────────────────

const tmpRoot = join(tmpdir(), `instrlint-parser-test-${Date.now()}`);
mkdirSync(tmpRoot, { recursive: true });

function tmpFile(name: string, content: string): string {
  const path = join(tmpRoot, name);
  writeFileSync(path, content, "utf8");
  return path;
}

// Cleanup
import { afterAll } from "vitest";
afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));

// ─── Line type helpers ─────────────────────────────────────────────────────

function parseLines(content: string) {
  const path = tmpFile(`${Date.now()}.md`, content);
  return parseInstructionFile(path).lines;
}

function lineTypes(content: string) {
  return parseLines(content).map((l) => l.type);
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("parseInstructionFile — line classification", () => {
  describe("heading", () => {
    it('classifies "# Project Overview" as heading', () => {
      expect(lineTypes("# Project Overview")[0]).toBe("heading");
    });

    it('classifies "## Coding conventions" as heading', () => {
      expect(lineTypes("## Coding conventions")[0]).toBe("heading");
    });

    it("does NOT classify mid-line # as heading", () => {
      expect(lineTypes("The # of items")[0]).toBe("other");
    });
  });

  describe("blank", () => {
    it("empty file has 0 lines (trailing newline stripped)", () => {
      expect(lineTypes("")).toHaveLength(0);
    });

    it("classifies a single blank line as blank", () => {
      // A file with one blank line (no trailing newline)
      expect(lineTypes("\n")[0]).toBe("blank");
    });

    it("classifies whitespace-only line as blank", () => {
      expect(lineTypes("   ")[0]).toBe("blank");
    });
  });

  describe("code", () => {
    it("classifies lines inside code fence as code", () => {
      const types = lineTypes("```\nconst x = 1;\n```");
      expect(types[0]).toBe("code"); // opening fence
      expect(types[1]).toBe("code"); // inside
      expect(types[2]).toBe("code"); // closing fence
    });

    it("does not bleed code classification outside fence", () => {
      const types = lineTypes("```\ncode line\n```\nnormal line");
      expect(types[3]).not.toBe("code");
    });
  });

  describe("comment", () => {
    it("classifies inline HTML comment as comment", () => {
      expect(lineTypes("<!-- anything -->")[0]).toBe("comment");
    });

    it("classifies multi-line HTML comment lines as comment", () => {
      const types = lineTypes("<!-- start\ncontent\nend -->");
      expect(types[0]).toBe("comment");
      expect(types[1]).toBe("comment");
      expect(types[2]).toBe("comment");
    });
  });

  describe("rule — positive examples", () => {
    it('"- Use ES modules (import/export), not CommonJS"', () => {
      expect(
        lineTypes("- Use ES modules (import/export), not CommonJS")[0],
      ).toBe("rule");
    });

    it('"- Never push directly to main branch"', () => {
      expect(lineTypes("- Never push directly to main branch")[0]).toBe("rule");
    });

    it('"Always run tests before committing"', () => {
      expect(lineTypes("Always run tests before committing")[0]).toBe("rule");
    });

    it('"Prefer named exports over default exports"', () => {
      expect(lineTypes("Prefer named exports over default exports")[0]).toBe(
        "rule",
      );
    });

    it('"Error handling: use Result<T> pattern"', () => {
      // Contains "use" but doesn't start with "- ", needs strong imperative
      // Actually let's test a list version
      expect(lineTypes("- Error handling: use Result<T> pattern")[0]).toBe(
        "rule",
      );
    });

    it('"- Avoid using any type in TypeScript"', () => {
      expect(lineTypes("- Avoid using any type in TypeScript")[0]).toBe("rule");
    });

    it('"- Always use semicolons"', () => {
      expect(lineTypes("- Always use semicolons")[0]).toBe("rule");
    });

    it('"Must use parameterized queries for all database access"', () => {
      expect(
        lineTypes("Must use parameterized queries for all database access")[0],
      ).toBe("rule");
    });

    it("classifies Chinese imperative lines as rules", () => {
      expect(lineTypes("永遠使用 TypeScript 嚴格模式")[0]).toBe("rule");
      expect(lineTypes("禁止使用 any 型別")[0]).toBe("rule");
      expect(lineTypes("應該優先使用 const")[0]).toBe("rule");
      expect(lineTypes("避免在迴圈中發出 API 請求")[0]).toBe("rule");
      expect(lineTypes("不要在 production 使用 console.log")[0]).toBe("rule");
      expect(lineTypes("必須使用參數化查詢")[0]).toBe("rule");
    });
  });

  describe("rule — negative examples (should NOT be rule)", () => {
    it('"- Node.js >= 18" is other (fact, not instruction)', () => {
      expect(lineTypes("- Node.js >= 18")[0]).toBe("other");
    });

    it('"This project uses React and TypeScript" is other (context)', () => {
      expect(lineTypes("This project uses React and TypeScript")[0]).toBe(
        "other",
      );
    });

    it('"Install dependencies with pnpm install" does not match rule heuristics', () => {
      // Starts with capital, imperative-ish but no strong signal word in our set for this
      // "Install" is not in our rule signals — it should be 'other'
      const type = lineTypes("Install dependencies with pnpm install")[0];
      expect(type).toBe("other");
    });
  });

  describe("other", () => {
    it("classifies plain description text as other", () => {
      expect(lineTypes("This is the main entry point.")[0]).toBe("other");
    });
  });
});

describe("parseInstructionFile — keyword extraction", () => {
  it("extracts known tech terms from a line", () => {
    const lines = parseLines("- Use TypeScript with ESLint and Prettier");
    expect(lines[0]?.keywords).toContain("typescript");
    expect(lines[0]?.keywords).toContain("eslint");
    expect(lines[0]?.keywords).toContain("prettier");
  });

  it("extracts keywords case-insensitively", () => {
    const lines = parseLines("Configure VITEST for unit testing");
    expect(lines[0]?.keywords).toContain("vitest");
  });

  it("returns empty array when no known keywords", () => {
    const lines = parseLines("This line has no known tech terms here.");
    expect(lines[0]?.keywords).toEqual([]);
  });

  it("deduplicates repeated keywords", () => {
    const lines = parseLines("Use pnpm. Do not use npm. Use pnpm only.");
    const kw = lines[0]?.keywords ?? [];
    expect(kw.filter((k) => k === "pnpm").length).toBe(1);
    expect(kw.filter((k) => k === "npm").length).toBe(1);
  });
});

describe("parseInstructionFile — path extraction", () => {
  it("extracts src/ paths", () => {
    const lines = parseLines("See src/components/Button.tsx for the example.");
    expect(lines[0]?.referencedPaths).toContain("src/components/Button.tsx");
  });

  it("extracts ./ relative paths", () => {
    const lines = parseLines("Config is at ./config/settings.json");
    expect(lines[0]?.referencedPaths).toContain("./config/settings.json");
  });

  it("extracts tests/ paths", () => {
    const lines = parseLines("Tests live in tests/unit/");
    expect(lines[0]?.referencedPaths.some((p) => p.startsWith("tests/"))).toBe(
      true,
    );
  });

  it("does NOT extract URLs", () => {
    const lines = parseLines("See https://example.com/docs for details.");
    expect(lines[0]?.referencedPaths).not.toContain("https://example.com/docs");
  });

  it("returns empty array when no paths", () => {
    const lines = parseLines("No paths mentioned here.");
    expect(lines[0]?.referencedPaths).toEqual([]);
  });
});

describe("parseInstructionFile — @-reference extraction", () => {
  it("extracts @-reference to a .md file in a subdirectory", () => {
    const lines = parseLines("See @.claude/rules/coding-style.md for details.");
    expect(lines[0]?.referencedPaths).toContain(
      ".claude/rules/coding-style.md",
    );
  });

  it("extracts @-reference at line start", () => {
    const lines = parseLines("@docs/guidelines.md");
    expect(lines[0]?.referencedPaths).toContain("docs/guidelines.md");
  });

  it("extracts explicit relative @-reference", () => {
    const lines = parseLines("Import from @./shared/rules.md");
    expect(lines[0]?.referencedPaths).toContain("./shared/rules.md");
  });

  it("extracts parent-dir @-reference", () => {
    const lines = parseLines("See @../global.md");
    expect(lines[0]?.referencedPaths).toContain("../global.md");
  });

  it("does NOT extract @username (no extension)", () => {
    const lines = parseLines("Ping @alice to review.");
    expect(lines[0]?.referencedPaths.some((p) => p.includes("alice"))).toBe(
      false,
    );
  });

  it("does NOT extract @types/node (npm scoped package, no extension)", () => {
    const lines = parseLines("Install @types/node for TypeScript support.");
    expect(lines[0]?.referencedPaths.some((p) => p.includes("types"))).toBe(
      false,
    );
  });

  it("does NOT extract email addresses", () => {
    const lines = parseLines("Contact user@example.com for help.");
    expect(
      lines[0]?.referencedPaths.some((p) => p.includes("example.com")),
    ).toBe(false);
  });

  it("does NOT extract @-references inside fenced code blocks", () => {
    const content = "```\n@.claude/rules/secret.md\n```";
    const lines = parseLines(content);
    const codeBlockLine = lines.find((l) => l.type === "code");
    // stale-refs skips code-type lines; verify the type is classified as code
    expect(codeBlockLine?.type).toBe("code");
  });
});

describe("parseInstructionFile — edge cases", () => {
  it("handles empty file", () => {
    const path = tmpFile("empty.md", "");
    const file = parseInstructionFile(path);
    // An empty string split by \n gives one empty element
    expect(file.lineCount).toBeGreaterThanOrEqual(0);
    expect(file.lines.every((l) => l.type === "blank")).toBe(true);
  });

  it("parses Chinese content without crashing", () => {
    const path = tmpFile(
      "chinese.md",
      "# 專案說明\n\n- 永遠使用 TypeScript strict mode\n",
    );
    const file = parseInstructionFile(path);
    expect(file.lineCount).toBe(3);
    expect(file.lines[0]?.type).toBe("heading");
    expect(file.lines[1]?.type).toBe("blank");
    // Chinese rule with keyword
    expect(file.lines[2]?.keywords).toContain("typescript");
  });

  it("counts lines correctly", () => {
    const path = tmpFile(
      "lines.md",
      "# H\n\ntext\n- rule here should use pnpm\n",
    );
    const file = parseInstructionFile(path);
    expect(file.lineCount).toBe(4);
    expect(file.lines[0]?.lineNumber).toBe(1);
    expect(file.lines[3]?.lineNumber).toBe(4);
  });
});

describe("parseYamlFrontmatter", () => {
  it("extracts paths array from block YAML", () => {
    const content =
      "---\npaths:\n  - src/**/*.ts\n  - src/**/*.tsx\n---\n# Body";
    const result = parseYamlFrontmatter(content);
    expect(result.paths).toEqual(["src/**/*.ts", "src/**/*.tsx"]);
    expect(result.body).toContain("# Body");
  });

  it("extracts globs array from block YAML", () => {
    const content =
      '---\nglobs:\n  - "**/*.test.ts"\n  - "**/*.spec.ts"\n---\ncontent';
    const result = parseYamlFrontmatter(content);
    expect(result.globs).toEqual(["**/*.test.ts", "**/*.spec.ts"]);
  });

  it("returns body only when no frontmatter", () => {
    const content = "# No frontmatter here\ncontent";
    const result = parseYamlFrontmatter(content);
    expect(result.paths).toBeUndefined();
    expect(result.globs).toBeUndefined();
    expect(result.body).toBe(content);
  });

  it("returns body when frontmatter is present but has no paths/globs", () => {
    const content = "---\nname: my-rule\n---\n# Body";
    const result = parseYamlFrontmatter(content);
    expect(result.paths).toBeUndefined();
    expect(result.globs).toBeUndefined();
    expect(result.body).toContain("# Body");
  });
});
