import { removeStopWords, tokenizeWords } from "../utils/text.js";
import type {
  Finding,
  InstructionFile,
  ParsedInstructions,
  ParsedLine,
} from "../types.js";

// ─── Negation detection ────────────────────────────────────────────────────────

const NEGATION_WORDS = ["never", "don't", "avoid", "forbid"];

// CJK negation words that negate the whole clause they appear in
const CJK_NEGATIONS = ["禁止", "不要", "不可", "不得", "避免", "請勿", "勿"];

// Matches CJK-only strings (no ASCII)
const CJK_ONLY_RE = /^[\u4e00-\u9fff\u3400-\u4dbf]+$/;

/**
 * Returns true if `word` is negated within a single sentence of `text`.
 * Checks each sentence independently to avoid cross-sentence false positives.
 *
 * Possessive forms ("not Claude's …") are excluded: when the word immediately
 * follows "not" but is itself in possessive form, the negation targets the
 * whole noun phrase, not the word itself.
 */
function isNegated(text: string, word: string): boolean {
  // Split into sentences — supports both English (.!?) and Chinese (。！？) punctuation
  const sentences = text.split(/[.!?。！？]+\s*/);
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordPresent = new RegExp(`\\b${escapedWord}\\b`, "i");

  for (const sentence of sentences) {
    if (!wordPresent.test(sentence)) continue;
    const lower = sentence.toLowerCase();

    for (const neg of NEGATION_WORDS) {
      // Window of 1: negation must be within 1 intervening word of the target.
      // Exclude possessive: "never Claude's X" negates the NP, not "Claude".
      const pattern = new RegExp(
        `\\b${neg}\\b(?:\\s+\\w+){0,1}\\s+\\b${escapedWord}\\b(?!['\\u2019]s\\b)`,
        "i",
      );
      if (pattern.test(lower)) return true;
    }

    // "do not" / "not" before word (within 1 token), same possessive exclusion
    const notPattern = new RegExp(
      `\\b(?:do\\s+)?not\\b(?:\\s+\\w+){0,1}\\s+\\b${escapedWord}\\b(?!['\\u2019]s\\b)`,
      "i",
    );
    if (notPattern.test(lower)) return true;
  }

  // CJK path: whole-sentence negation.
  // Chinese imperatives (禁止/不要/…) typically appear sentence-initially and
  // negate the entire clause — no word-boundary or window needed.
  if (CJK_ONLY_RE.test(word)) {
    for (const sentence of sentences) {
      if (!sentence.includes(word)) continue;
      for (const neg of CJK_NEGATIONS) {
        if (sentence.includes(neg)) return true;
      }
    }
  }

  return false;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extra stop words specific to contradiction detection.
 * These are polarity markers and generic imperatives/modals that appear across
 * many rule lines and would generate false-positive shared-word matches.
 */
const POLARITY_STOP_WORDS = new Set([
  // Polarity / negation markers (meta-level, not domain content)
  "never",
  "always",
  "avoid",
  "not",
  // Generic imperative verbs (describe HOW to comply, not WHAT topic)
  "use",
  "ensure",
  "require",
  "prefer",
  "follow",
  "keep",
  "calls",
  "run",
  "runs",
  // Common modals and auxiliaries
  "must",
  "should",
  "can",
  "will",
  "may",
  // Generic quantifiers
  "all",
  "every",
  "each",
  "any",
  // Pronouns and copulas — appear in any sentence regardless of topic;
  // their negation carries no semantic domain information
  "it",
  "its",
  "be",
  "by",
  "own",
  "on",
  // Chinese polarity / imperative bigrams (analogues of English never/always/use/must)
  "永遠",
  "總是",
  "禁止",
  "不要",
  "不可",
  "不得",
  "避免",
  "請勿",
  "必須",
  "應該",
  "應當",
  // Chinese generic verb bigrams (HOW to comply, not WHAT topic)
  "使用",
  "採用",
  "執行",
  "進行",
  "可以",
  "需要",
]);

interface AnnotatedLine {
  line: ParsedLine;
  words: string[];
  file: string;
}

function collectRuleLines(instructions: ParsedInstructions): AnnotatedLine[] {
  const sources: InstructionFile[] = [
    instructions.rootFile,
    ...instructions.subFiles,
    ...instructions.rules,
  ];

  const annotated: AnnotatedLine[] = [];
  for (const file of sources) {
    for (const line of file.lines) {
      if (line.type !== "rule") continue;
      const words = removeStopWords(tokenizeWords(line.text)).filter(
        (w) => !POLARITY_STOP_WORDS.has(w),
      );
      if (words.length < 3) continue;
      annotated.push({ line, words, file: file.path });
    }
  }
  return annotated;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function detectContradictions(
  instructions: ParsedInstructions,
): Finding[] {
  const lines = collectRuleLines(instructions);
  const findings: Finding[] = [];
  const reportedPairs = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i]!;
      const b = lines[j]!;

      // Find unique shared content words (Set-based to avoid duplicate counting)
      const setA = new Set(a.words);
      const setB = new Set(b.words);
      const shared = [...setB].filter((w) => setA.has(w));

      if (shared.length < 3) continue;

      // Check if any shared word has opposite polarity in the two lines
      const hasContradiction = shared.some(
        (word) => isNegated(a.line.text, word) !== isNegated(b.line.text, word),
      );

      if (!hasContradiction) continue;

      const pairKey = `${a.file}:${a.line.lineNumber}|${b.file}:${b.line.lineNumber}`;
      if (reportedPairs.has(pairKey)) continue;
      reportedPairs.add(pairKey);

      const snippet =
        a.line.text.length > 60
          ? `${a.line.text.slice(0, 60)}...`
          : a.line.text;

      findings.push({
        severity: "critical",
        category: "contradiction",
        file: b.file,
        line: b.line.lineNumber,
        messageKey: "structure.contradiction",
        messageParams: {
          snippet,
          lineA: String(a.line.lineNumber),
          lineB: String(b.line.lineNumber),
          fileA: a.file,
        },
        suggestion: `Contradicting rules: "${snippet}" (${a.file} line ${a.line.lineNumber}) conflicts with line ${b.line.lineNumber}.`,
        autoFixable: false,
      });
    }
  }

  return findings;
}
