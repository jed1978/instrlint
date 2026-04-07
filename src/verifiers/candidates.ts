import { createHash } from "crypto";
import { relative } from "path";
import type { Finding, ParsedInstructions, InstructionFile } from "../types.js";
import type {
  Candidate,
  CandidatesFile,
  CandidateContext,
  RuleRef,
} from "./schema.js";
import { shouldVerify } from "./policy.js";

// ─── Line lookup ──────────────────────────────────────────────────────────────

function findLineText(
  parsed: ParsedInstructions,
  filePath: string,
  lineNumber: number,
): string {
  const sources: InstructionFile[] = [
    parsed.rootFile,
    ...parsed.subFiles,
    ...parsed.rules,
  ];
  const file = sources.find((f) => f.path === filePath);
  if (!file) return "";
  const line = file.lines.find((l) => l.lineNumber === lineNumber);
  return line?.text.trim() ?? "";
}

function ruleRef(
  parsed: ParsedInstructions,
  filePath: string,
  lineNumber: number,
): RuleRef {
  return {
    file: filePath,
    line: lineNumber,
    text: findLineText(parsed, filePath, lineNumber),
  };
}

// ─── Context builders ─────────────────────────────────────────────────────────

function buildContext(
  finding: Finding,
  parsed: ParsedInstructions,
): CandidateContext | null {
  if (finding.category === "contradiction") {
    const { fileA, lineA } = finding.messageParams ?? {};
    if (!fileA || !lineA) return null;
    return {
      type: "contradiction",
      ruleA: ruleRef(parsed, fileA, Number(lineA)),
      ruleB: ruleRef(parsed, finding.file, finding.line ?? 0),
    };
  }

  if (finding.category === "duplicate") {
    const { otherFile, otherLine } = finding.messageParams ?? {};
    if (!otherFile || !otherLine) return null;
    return {
      type: "duplicate",
      ruleA: ruleRef(parsed, otherFile, Number(otherLine)),
      ruleB: ruleRef(parsed, finding.file, finding.line ?? 0),
    };
  }

  return null;
}

// ─── Stable ID ────────────────────────────────────────────────────────────────

/**
 * Hash over category + file + line so the same finding always gets the same ID
 * across instrlint runs, enabling verdict caching by the host agent.
 */
export function hashFinding(finding: Finding): string {
  const key = `${finding.category}:${finding.file}:${finding.line ?? 0}:${finding.messageKey}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}

// ─── Question text ────────────────────────────────────────────────────────────

const QUESTIONS: Record<string, Record<string, string>> = {
  contradiction: {
    en: 'Do rules A and B actually contradict each other in practice? A real contradiction means a developer following both rules would be forced to violate one of them. Respond with JSON only: {"verdict":"confirmed"|"rejected"|"uncertain","reason":"<≤20 words>"}',
    "zh-TW":
      '規則 A 和規則 B 在實際開發中真的相互矛盾嗎？真正的矛盾是指：同時遵守兩條規則在某些情境下是不可能的。僅用 JSON 回答：{"verdict":"confirmed"|"rejected"|"uncertain","reason":"<20 字以內>"}',
  },
  duplicate: {
    en: 'Are rules A and B true semantic duplicates — do they say the same thing in different words, such that keeping both adds no value? Respond with JSON only: {"verdict":"confirmed"|"rejected"|"uncertain","reason":"<≤20 words>"}',
    "zh-TW":
      '規則 A 和規則 B 在語意上真的是重複的嗎——用不同的措辭說同一件事，保留兩條毫無額外價值？僅用 JSON 回答：{"verdict":"confirmed"|"rejected"|"uncertain","reason":"<20 字以內>"}',
  },
};

function questionFor(category: string, locale: string): string {
  const lang = locale === "zh-TW" ? "zh-TW" : "en";
  const question = QUESTIONS[category]?.[lang] ?? QUESTIONS[category]?.["en"];
  if (!question) {
    process.stderr.write(
      `[instrlint] Warning: no verification question for category "${category}", skipping\n`,
    );
    return "";
  }
  return question;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Normalize an absolute path to project-relative for safe serialization. */
function toRelative(filePath: string, projectRoot: string): string {
  const rel = relative(projectRoot, filePath);
  // If the path escaped the project root, keep as-is (safety: don't strip info)
  return rel.startsWith("..") ? filePath : rel;
}

/** Return a copy of the finding with all file paths made project-relative. */
function normalizeFilePaths(finding: Finding, projectRoot: string): Finding {
  const normalized: Finding = {
    ...finding,
    file: toRelative(finding.file, projectRoot),
  };
  if (normalized.messageParams) {
    const params = { ...normalized.messageParams };
    if (params["fileA"])
      params["fileA"] = toRelative(params["fileA"], projectRoot);
    if (params["otherFile"])
      params["otherFile"] = toRelative(params["otherFile"], projectRoot);
    normalized.messageParams = params;
  }
  return normalized;
}

export function buildCandidates(
  findings: Finding[],
  parsed: ParsedInstructions,
  projectRoot: string,
  locale: string,
): CandidatesFile {
  const candidates: Candidate[] = [];

  for (const finding of findings) {
    if (!shouldVerify(finding)) continue;
    const context = buildContext(finding, parsed);
    if (!context) continue;

    candidates.push({
      id: hashFinding(finding),
      category: finding.category,
      question: questionFor(finding.category, locale),
      context,
      originalFinding: normalizeFilePaths(finding, projectRoot),
    });
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    projectRoot,
    candidates,
  };
}
