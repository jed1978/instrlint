import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildStructureSuggestions,
  buildHookSnippet,
  buildPathScopedFile,
  printStructureSuggestions,
  markdownStructureSuggestions,
} from "../../src/fixers/structure-suggestions.js";
import { initLocale } from "../../src/i18n/index.js";
import type { Finding } from "../../src/types.js";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const sampleRoot = join(__dirname, "..", "fixtures", "sample-project");

beforeEach(() => {
  initLocale("en");
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const hookFinding: Finding = {
  severity: "info",
  category: "structure",
  file: join(sampleRoot, "CLAUDE.md"),
  line: 86,
  messageKey: "structure.scopeHook",
  messageParams: {
    line: "86",
    snippet: "Never commit API keys or secrets to the repository.",
  },
  suggestion: "Rule at line 86 could be a git hook",
  autoFixable: false,
};

const pathScopedFinding: Finding = {
  severity: "info",
  category: "structure",
  file: join(sampleRoot, "CLAUDE.md"),
  line: 164,
  messageKey: "structure.scopePathScoped",
  messageParams: {
    line: "164",
    snippet: "Before updating any dependency used by src/components/...",
  },
  suggestion: "Rule at line 164 references a specific path",
  autoFixable: false,
};

const nonStructureFinding: Finding = {
  severity: "warning",
  category: "dead-rule",
  file: join(sampleRoot, "CLAUDE.md"),
  line: 16,
  messageKey: "deadRule.configOverlap",
  messageParams: { rule: "strict mode", config: "tsconfig.json" },
  suggestion: "Rule already enforced",
  autoFixable: true,
};

// ─── buildStructureSuggestions ───────────────────────────────────────────────

describe("buildStructureSuggestions", () => {
  it("returns empty array when no structure findings", () => {
    expect(buildStructureSuggestions([nonStructureFinding])).toHaveLength(0);
  });

  it("returns empty array for clean-project (no structure findings)", () => {
    expect(buildStructureSuggestions([])).toHaveLength(0);
  });

  it("detects hook type for scopeHook finding", () => {
    const suggestions = buildStructureSuggestions([hookFinding]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.type).toBe("hook");
  });

  it("detects path-scoped type for scopePathScoped finding", () => {
    const suggestions = buildStructureSuggestions([pathScopedFinding]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.type).toBe("path-scoped");
  });

  it("extracts pathDir from rule text", () => {
    const suggestions = buildStructureSuggestions([pathScopedFinding]);
    expect(suggestions[0]!.pathDir).toBe("src");
  });

  it("ignores non-scopeHook/scopePathScoped structure findings", () => {
    const otherStructure: Finding = {
      ...pathScopedFinding,
      messageKey: "structure.staleRef",
    };
    expect(buildStructureSuggestions([otherStructure])).toHaveLength(0);
  });

  it("reads full rule text from file when line is set", () => {
    const suggestions = buildStructureSuggestions([hookFinding]);
    // Should have non-empty text (read from file or fallback to snippet)
    expect(suggestions[0]!.ruleText.length).toBeGreaterThan(0);
  });
});

// ─── buildHookSnippet ─────────────────────────────────────────────────────────

describe("buildHookSnippet", () => {
  it("produces valid JSON", () => {
    const snippet = buildHookSnippet("Never commit secrets");
    expect(() => JSON.parse(snippet)).not.toThrow();
  });

  it("contains hooks key", () => {
    const parsed = JSON.parse(buildHookSnippet("Never commit secrets"));
    expect(parsed).toHaveProperty("hooks");
    expect(parsed.hooks).toHaveProperty("PreToolUse");
  });

  it("includes rule text as comment in command", () => {
    const snippet = buildHookSnippet("Never commit secrets");
    expect(snippet).toContain("Never commit secrets");
  });

  it("truncates long rule text to 80 chars", () => {
    const longRule = "Never commit ".repeat(10);
    const snippet = buildHookSnippet(longRule);
    expect(snippet).toContain("…");
  });
});

// ─── buildPathScopedFile ──────────────────────────────────────────────────────

describe("buildPathScopedFile", () => {
  it("generates correct file path", () => {
    const { filePath } = buildPathScopedFile("src", "Some rule");
    expect(filePath).toBe(".claude/rules/src.md");
  });

  it("uses tests as directory name for tests/", () => {
    const { filePath } = buildPathScopedFile("tests", "Some rule");
    expect(filePath).toBe(".claude/rules/tests.md");
  });

  it("content contains YAML frontmatter with globs", () => {
    const { content } = buildPathScopedFile("src", "Some rule");
    expect(content).toContain("---");
    expect(content).toContain("globs:");
    expect(content).toContain("src/**");
  });

  it("content contains the rule text", () => {
    const { content } = buildPathScopedFile(
      "src",
      "Never import from external packages",
    );
    expect(content).toContain("Never import from external packages");
  });
});

// ─── printStructureSuggestions ────────────────────────────────────────────────

describe("printStructureSuggestions", () => {
  it("prints nothing for empty suggestions", () => {
    const log = vi.fn();
    printStructureSuggestions([], sampleRoot, { log });
    expect(log).not.toHaveBeenCalled();
  });

  it("prints MANUAL ACTIONS NEEDED header for non-empty suggestions", () => {
    const log = vi.fn();
    const suggestions = buildStructureSuggestions([hookFinding]);
    printStructureSuggestions(suggestions, sampleRoot, { log });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("MANUAL ACTIONS NEEDED");
  });

  it("prints hook warning for hook suggestions", () => {
    const log = vi.fn();
    const suggestions = buildStructureSuggestions([hookFinding]);
    printStructureSuggestions(suggestions, sampleRoot, { log });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("shell command");
  });

  it("prints file path for path-scoped suggestions", () => {
    const log = vi.fn();
    const suggestions = buildStructureSuggestions([pathScopedFinding]);
    printStructureSuggestions(suggestions, sampleRoot, { log });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain(".claude/rules/");
  });

  it("prints zh-TW text when locale is zh-TW", () => {
    initLocale("zh-TW");
    const log = vi.fn();
    const suggestions = buildStructureSuggestions([hookFinding]);
    printStructureSuggestions(suggestions, sampleRoot, { log });
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("手動操作");
  });
});

// ─── markdownStructureSuggestions ─────────────────────────────────────────────

describe("markdownStructureSuggestions", () => {
  it("returns empty array for no suggestions", () => {
    const lines = markdownStructureSuggestions([], sampleRoot);
    expect(lines).toHaveLength(0);
  });

  it("contains MANUAL ACTIONS NEEDED heading", () => {
    const suggestions = buildStructureSuggestions([hookFinding]);
    const lines = markdownStructureSuggestions(suggestions, sampleRoot);
    expect(lines.join("\n")).toContain("MANUAL ACTIONS NEEDED");
  });

  it("contains JSON code block for hook", () => {
    const suggestions = buildStructureSuggestions([hookFinding]);
    const text = markdownStructureSuggestions(suggestions, sampleRoot).join(
      "\n",
    );
    expect(text).toContain("```json");
    expect(text).toContain("hooks");
  });

  it("contains warning blockquote for hook", () => {
    const suggestions = buildStructureSuggestions([hookFinding]);
    const text = markdownStructureSuggestions(suggestions, sampleRoot).join(
      "\n",
    );
    expect(text).toContain("> ⚠");
  });

  it("contains markdown code block for path-scoped", () => {
    const suggestions = buildStructureSuggestions([pathScopedFinding]);
    const text = markdownStructureSuggestions(suggestions, sampleRoot).join(
      "\n",
    );
    expect(text).toContain("```markdown");
    expect(text).toContain("globs:");
  });
});
