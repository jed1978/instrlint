import { readFileSync } from "fs";
import type { InstructionFile, ParsedLine } from "../types.js";

// ─── Keyword dictionary ────────────────────────────────────────────────────

const KNOWN_KEYWORDS = new Set([
  "typescript",
  "javascript",
  "eslint",
  "prettier",
  "biome",
  "react",
  "vue",
  "svelte",
  "angular",
  "next",
  "nextjs",
  "nuxt",
  "jest",
  "vitest",
  "mocha",
  "jasmine",
  "playwright",
  "cypress",
  "postgresql",
  "postgres",
  "mysql",
  "sqlite",
  "mongodb",
  "redis",
  "docker",
  "kubernetes",
  "k8s",
  "terraform",
  "git",
  "github",
  "gitlab",
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "node",
  "nodejs",
  "deno",
  "webpack",
  "vite",
  "esbuild",
  "tsup",
  "rollup",
  "zod",
  "prisma",
  "drizzle",
  "openai",
  "anthropic",
  "claude",
  "commitlint",
  "husky",
  "lint-staged",
]);

const KEYWORD_REGEX = new RegExp(
  `\\b(${[...KNOWN_KEYWORDS].join("|")})\\b`,
  "gi",
);

// ─── Path extraction ───────────────────────────────────────────────────────

// Matches path-like strings: starts with src/, tests/, ./, ../, or contains /
// but NOT URLs (http:// https://)
const PATH_REGEX =
  /(?<!\w)(?:\.{1,2}\/|(?:src|tests?|dist|lib|docs?|config|scripts?|packages?)\/)[^\s,;`'")\]>]+/g;

// Matches @file references: @path/to/file.md (or .txt, .json, .yaml, .yml)
// Negative lookbehind: not after word char (avoids emails like user@example.com)
// Capture group 1: the path, WITHOUT the leading @
const AT_REF_REGEX =
  /(?<![a-zA-Z0-9_])@((?:\.\.?\/)?[\w./-]+\.(?:md|txt|json|yaml|yml))\b/g;

// ─── Rule classification signals ──────────────────────────────────────────

const RULE_IMPERATIVE_WORDS =
  /\b(must|should|never|always|prefer|avoid|ensure|require|forbid|use|do not|don't)\b|必須|應該|應當|永遠|總是|禁止|不要|不可|不得|避免|請使用|優先使用|請勿/i;

const RULE_NEGATION_PATTERN = /\b(not|don't|do not)\s+\w+/i;

// Strong imperatives for non-list lines (must match at sentence start or be prominent)
const STRONG_IMPERATIVE = /\b(must|shall|always|never)\b/i;

// ─── YAML frontmatter parsing ──────────────────────────────────────────────

export interface FrontmatterResult {
  paths?: string[];
  globs?: string[];
  body: string;
}

export function parseYamlFrontmatter(content: string): FrontmatterResult {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/m.exec(content);
  if (match == null) {
    return { body: content };
  }

  const yaml = match[1] ?? "";
  const body = match[2] ?? "";

  const paths = extractYamlStringArray(yaml, "paths");
  const globs = extractYamlStringArray(yaml, "globs");

  return {
    ...(paths != null ? { paths } : {}),
    ...(globs != null ? { globs } : {}),
    body,
  };
}

function extractYamlStringArray(
  yaml: string,
  key: string,
): string[] | undefined {
  // Match "key:\n  - value\n  - value" style
  const blockMatch = new RegExp(
    `^${key}:\\s*\\n((?:\\s+-\\s+.+\\n?)*)`,
    "m",
  ).exec(yaml);
  if (blockMatch != null) {
    return (blockMatch[1] ?? "")
      .split("\n")
      .map((l) =>
        l
          .replace(/^\s+-\s+/, "")
          .replace(/["']/g, "")
          .trim(),
      )
      .filter((l) => l.length > 0);
  }

  // Match "key: [value, value]" inline style
  const inlineMatch = new RegExp(`^${key}:\\s*\\[(.+)\\]`, "m").exec(yaml);
  if (inlineMatch != null) {
    return (inlineMatch[1] ?? "")
      .split(",")
      .map((s) => s.replace(/["']/g, "").trim())
      .filter((s) => s.length > 0);
  }

  return undefined;
}

// ─── Line classifier ───────────────────────────────────────────────────────

function classifyLine(
  text: string,
  inCodeBlock: boolean,
  inHtmlComment: boolean,
): ParsedLine["type"] {
  if (inCodeBlock) return "code";
  if (inHtmlComment) return "comment";

  const trimmed = text.trim();

  if (trimmed.length === 0) return "blank";
  if (/^#{1,6}\s/.test(trimmed)) return "heading";
  if (trimmed.startsWith("```")) return "code";

  // Inline HTML comment (whole line)
  if (/^<!--[\s\S]*-->$/.test(trimmed)) return "comment";
  // Opening HTML comment
  if (trimmed.startsWith("<!--")) return "comment";

  if (isRule(trimmed)) return "rule";
  return "other";
}

function isRule(text: string): boolean {
  const isList = text.startsWith("- ");
  const body = isList ? text.slice(2) : text;

  if (isList) {
    if (RULE_IMPERATIVE_WORDS.test(body)) return true;
    if (RULE_NEGATION_PATTERN.test(body)) return true;
  } else {
    // Non-list lines: require strong imperative AND sentence-like structure
    if (STRONG_IMPERATIVE.test(body) && /^[A-Z]/.test(body)) return true;
    // Also catch imperative sentences starting with a verb (capitalised)
    if (RULE_IMPERATIVE_WORDS.test(body) && /^[A-Z][a-z]/.test(body))
      return true;
    // CJK lines: classify as rule if they start with a CJK character and contain an imperative word
    if (
      RULE_IMPERATIVE_WORDS.test(body) &&
      /^[\u4e00-\u9fff\u3400-\u4dbf]/.test(body)
    )
      return true;
  }

  return false;
}

function extractKeywords(text: string): string[] {
  const matches = text.matchAll(KEYWORD_REGEX);
  const found = new Set<string>();
  for (const m of matches) {
    found.add(m[0].toLowerCase());
  }
  return [...found];
}

function extractPaths(text: string): string[] {
  const found: string[] = [];

  // Existing path patterns (src/, tests/, ./, ../, etc.)
  for (const m of text.matchAll(PATH_REGEX)) {
    const cleaned = m[0].replace(/[.,;)>\]'"]+$/, "");
    if (cleaned.length > 1) found.push(cleaned);
  }

  // @file references: strip the @ and keep just the path
  for (const m of text.matchAll(AT_REF_REGEX)) {
    const cleaned = (m[1] ?? "").replace(/[.,;)>\]'"]+$/, "");
    if (cleaned.length > 0) found.push(cleaned);
  }

  return [...new Set(found)];
}

// ─── Public API ────────────────────────────────────────────────────────────

export function parseInstructionFile(filePath: string): InstructionFile {
  const raw = readFileSync(filePath, "utf8");
  const rawLines = raw.split(/\r?\n/);

  // Strip the single trailing empty string produced by a final newline.
  // Most text files end with \n, which splits into [..., ''] — this is not a real line.
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }

  let inCodeBlock = false;
  let inHtmlComment = false;
  const lines: ParsedLine[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const text = rawLines[i] ?? "";
    const trimmed = text.trim();

    // Classify using current state (before updating)
    const type = classifyLine(text, inCodeBlock, inHtmlComment);

    // Update code block state AFTER classifying the fence line itself
    if (!inHtmlComment && trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
    }

    // Update HTML comment state AFTER classifying the current line:
    // - opening line (<!-- ... without -->): set true after this line
    // - closing line (contains -->): set false after this line
    // - lines inside: state remains true
    if (!inCodeBlock) {
      if (inHtmlComment) {
        if (trimmed.includes("-->")) inHtmlComment = false;
      } else if (trimmed.startsWith("<!--") && !trimmed.includes("-->")) {
        inHtmlComment = true;
      }
    }

    lines.push({
      lineNumber: i + 1,
      text,
      type,
      keywords: extractKeywords(text),
      referencedPaths: extractPaths(text),
    });
  }

  return {
    path: filePath,
    lines,
    lineCount: lines.length,
    // tokenCount and tokenMethod will be filled by the adapter/estimator
    tokenCount: 0,
    tokenMethod: "estimated",
  };
}
