const STOP_WORDS = new Set([
  // English grammatical function words
  "the",
  "a",
  "an",
  "is",
  "are",
  "to",
  "for",
  "and",
  "or",
  "in",
  "of",
  "with",
  "that",
  "this",
  // Chinese filler bigrams (grammatical / no topic content)
  "的時",
  "時候",
  "一個",
  "所有",
  "每個",
]);

// Matches a contiguous run of CJK Unified Ideographs (BMP + Extension A)
const CJK_RUN = /[\u4e00-\u9fff\u3400-\u4dbf]+/g;
const ASCII_WORD = /[a-z0-9]+/g;

export function tokenizeWords(text: string): string[] {
  const words: string[] = [];
  const lower = text.toLowerCase();

  // English alphanumeric tokens — same behaviour as before (length > 1)
  for (const m of lower.matchAll(ASCII_WORD)) {
    if (m[0].length > 1) words.push(m[0]);
  }

  // CJK char-bigrams: slide a 2-char window over each contiguous CJK run.
  // Single-char runs are skipped (analogous to the length > 1 filter for ASCII).
  for (const m of text.matchAll(CJK_RUN)) {
    const run = m[0];
    if (run.length < 2) continue;
    for (let i = 0; i < run.length - 1; i++) {
      words.push(run.slice(i, i + 2));
    }
  }

  return words;
}

export function removeStopWords(words: string[]): string[] {
  return words.filter((w) => !STOP_WORDS.has(w));
}

export function jaccardSimilarity(setA: string[], setB: string[]): number {
  if (setA.length === 0 && setB.length === 0) return 0;
  const a = new Set(setA);
  const b = new Set(setB);
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}
