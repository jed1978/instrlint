import { describe, it, expect } from "vitest";
import {
  tokenizeWords,
  jaccardSimilarity,
  removeStopWords,
} from "../../src/utils/text.js";

// ─── tokenizeWords: English regression ────────────────────────────────────────

describe("tokenizeWords: English (regression)", () => {
  it("lowercases and extracts alphanumeric tokens", () => {
    expect(tokenizeWords("Hello, World!")).toEqual(["hello", "world"]);
  });

  it("filters single-char ASCII tokens", () => {
    const words = tokenizeWords("use a b cd efgh");
    expect(words).not.toContain("a");
    expect(words).not.toContain("b");
    expect(words).toContain("cd");
    expect(words).toContain("efgh");
  });

  it("handles empty string", () => {
    expect(tokenizeWords("")).toEqual([]);
  });

  it("handles whitespace-only string", () => {
    expect(tokenizeWords("   ")).toEqual([]);
  });
});

// ─── tokenizeWords: CJK bigrams ───────────────────────────────────────────────

describe("tokenizeWords: CJK char-bigrams", () => {
  it("extracts sliding-window bigrams from a CJK run", () => {
    expect(tokenizeWords("永遠使用嚴格模式")).toEqual([
      "永遠",
      "遠使",
      "使用",
      "用嚴",
      "嚴格",
      "格模",
      "模式",
    ]);
  });

  it("handles a two-char CJK run (single bigram)", () => {
    expect(tokenizeWords("禁止")).toEqual(["禁止"]);
  });

  it("skips single-char CJK runs (analogous to single-char ASCII filter)", () => {
    const words = tokenizeWords("用 TypeScript");
    expect(words).not.toContain("用");
    expect(words).toContain("typescript");
  });

  it("handles mixed CJK + English in one line", () => {
    const words = tokenizeWords("永遠使用 TypeScript 嚴格模式");
    expect(words).toContain("typescript");
    expect(words).toContain("永遠");
    expect(words).toContain("嚴格");
    expect(words).toContain("格模");
    expect(words).toContain("模式");
  });

  it("treats each CJK run independently", () => {
    // Two separate CJK runs split by ASCII: "禁止" and "嚴格"
    const words = tokenizeWords("禁止 something 嚴格");
    expect(words).toContain("禁止");
    expect(words).toContain("嚴格");
    expect(words).not.toContain("止 "); // no cross-run bigrams
  });
});

// ─── jaccardSimilarity with CJK ───────────────────────────────────────────────

describe("jaccardSimilarity: CJK", () => {
  it("returns high similarity for two Chinese rules with same topic", () => {
    const a = tokenizeWords("永遠使用 TypeScript 嚴格模式");
    const b = tokenizeWords("應該啟用 TypeScript 嚴格模式");
    // Shared: typescript + bigrams covering 嚴格模式
    expect(jaccardSimilarity(a, b)).toBeGreaterThan(0.3);
  });

  it("returns low similarity for unrelated Chinese rules", () => {
    const a = tokenizeWords("禁止在 production 使用 console.log");
    const b = tokenizeWords("永遠在 commit 前執行測試");
    expect(jaccardSimilarity(a, b)).toBeLessThan(0.2);
  });
});

// ─── removeStopWords with CJK stop bigrams ────────────────────────────────────

describe("removeStopWords: Chinese stop bigrams", () => {
  it("removes Chinese filler bigrams", () => {
    const words = ["的時", "例外", "時候", "處理"];
    expect(removeStopWords(words)).toEqual(["例外", "處理"]);
  });
});
