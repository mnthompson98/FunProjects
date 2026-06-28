// Memory Verses — personal memorization list + helpers for the practice modes.

export interface MemoryItem {
  id: string;
  ref: string;             // OSIS: verse "Jhn.3.16" or chapter "Jhn.3" (one chapter only)
  scope: 'verse' | 'chapter';
  display: string;         // "John 3:16" / "John 3"
  topic?: string;          // optional label (from the TMS catalog)
  source: 'tms' | 'custom';
  addedAt: number;
  lastPracticed?: number;
  timesPracticed?: number;
}

// ── Text helpers for Quiz + Builder ──

/** Split into whitespace-separated chunks, preserving punctuation on each. */
export function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** Letters-only, lowercased core of a token, for comparison. */
export function wordCore(token: string): string {
  return token.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Mask a token for the Builder fade levels:
 *  0 full · 1 first letter + length (F___) · 2 first letter only (F) · 3 blank (___)
 * Non-letters (punctuation) are preserved as cues.
 */
export function maskToken(token: string, level: 0 | 1 | 2 | 3): string {
  if (level === 0) return token;
  let seenFirst = false;
  let out = '';
  for (const ch of token) {
    if (/[a-zA-Z]/.test(ch)) {
      if (!seenFirst) {
        out += level === 3 ? '_' : ch;
        seenFirst = true;
      } else {
        out += level === 2 ? '' : '_';
      }
    } else {
      out += ch; // keep punctuation
    }
  }
  return out;
}

/** Deterministic-ish blank selection: spread ~ratio of words, skipping tiny ones. */
export function pickBlankIndices(tokens: string[], ratio = 0.25, max = 14): number[] {
  const candidates = tokens
    .map((t, i) => ({ i, len: wordCore(t).length }))
    .filter((c) => c.len >= 3);
  const target = Math.min(max, Math.max(1, Math.round(tokens.length * ratio)));
  if (candidates.length <= target) return candidates.map((c) => c.i);
  // Even spacing across candidates
  const step = candidates.length / target;
  const picked: number[] = [];
  for (let k = 0; k < target; k++) {
    picked.push(candidates[Math.floor(k * step)].i);
  }
  return Array.from(new Set(picked)).sort((a, b) => a - b);
}

/** Word-by-word accuracy of a typed attempt against the target text. */
export function scoreTyping(answer: string, target: string): { correct: number; total: number; perWord: boolean[] } {
  const a = tokenize(answer).map(wordCore).filter(Boolean);
  const t = tokenize(target).map(wordCore).filter(Boolean);
  const perWord = t.map((word, i) => a[i] === word);
  const correct = perWord.filter(Boolean).length;
  return { correct, total: t.length, perWord };
}

/** Shuffle a copy of an array (Fisher–Yates seeded by index variation, no Math.random). */
export function shuffleStable<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
