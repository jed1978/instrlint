const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'to', 'for', 'and', 'or', 'in', 'of', 'with', 'that', 'this',
]);

export function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1);
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
