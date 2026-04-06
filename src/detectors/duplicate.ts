import type { Finding, ParsedInstructions, ParsedLine } from '../types.js';
import { jaccardSimilarity, removeStopWords, tokenizeWords } from '../utils/text.js';

const SIMILARITY_THRESHOLD = 0.7;
const MIN_WORDS_AFTER_STOP = 4;

interface RuleLine {
  line: ParsedLine;
  file: string;
  words: string[];
}

function collectRuleLines(instructions: ParsedInstructions): RuleLine[] {
  const result: RuleLine[] = [];

  const add = (lines: ParsedLine[], file: string) => {
    for (const l of lines) {
      if (l.type !== 'rule') continue;
      const words = removeStopWords(tokenizeWords(l.text));
      if (words.length < MIN_WORDS_AFTER_STOP) continue;
      result.push({ line: l, file, words });
    }
  };

  add(instructions.rootFile.lines, instructions.rootFile.path);
  for (const sub of instructions.subFiles) add(sub.lines, sub.path);
  for (const rule of instructions.rules) add(rule.lines, rule.path);

  return result;
}

export function detectDuplicates(instructions: ParsedInstructions): Finding[] {
  const findings: Finding[] = [];
  const ruleLines = collectRuleLines(instructions);
  const reported = new Set<string>();

  for (let i = 0; i < ruleLines.length; i++) {
    for (let j = i + 1; j < ruleLines.length; j++) {
      const a = ruleLines[i]!;
      const b = ruleLines[j]!;
      const pairKey = `${a.file}:${a.line.lineNumber}|${b.file}:${b.line.lineNumber}`;
      if (reported.has(pairKey)) continue;

      const sim = jaccardSimilarity(a.words, b.words);
      if (sim < SIMILARITY_THRESHOLD) continue;

      reported.add(pairKey);

      const isExact = sim >= 1.0;
      const simPct = `${Math.round(sim * 100)}`;

      findings.push({
        severity: isExact ? 'warning' : 'info',
        category: 'duplicate',
        file: b.file,
        line: b.line.lineNumber,
        messageKey: isExact ? 'deadRule.exactDuplicate' : 'deadRule.nearDuplicate',
        messageParams: {
          otherFile: a.file,
          otherLine: String(a.line.lineNumber),
          similarity: simPct,
        },
        suggestion: isExact
          ? `Exact duplicate of line ${a.line.lineNumber} in ${a.file}`
          : `Very similar to line ${a.line.lineNumber} in ${a.file} (${simPct}% similar)`,
        autoFixable: isExact,
      });
    }
  }

  return findings;
}
