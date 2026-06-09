/**
 * Fetch a verse from API.Bible (scripture.api.bible).
 * Used for NIV (requires a free API key from scripture.api.bible).
 *
 * VITE_API_BIBLE_KEY must be set for this to work.
 */

const API_KEY = import.meta.env.VITE_API_BIBLE_KEY as string | undefined;

// NIV Bible ID on API.Bible
const NIV_BIBLE_ID = '78a9f6124f344018-01';

// Simple cache so repeated lookups don't re-fetch
const cache = new Map<string, string>();

/**
 * Convert our internal OSIS ref (e.g. "Gen.1.1") to the API.Bible verse ID.
 * API.Bible uses the same USFM uppercase book codes (GEN, EXO, ...).
 */
function refToApiBibleId(ref: string): string {
  const [book, chapter, verse] = ref.split('.');
  return `${book.toUpperCase()}.${chapter}.${verse}`;
}

export const isApiBibleConfigured = Boolean(API_KEY);

export async function fetchNivVerse(ref: string): Promise<string | null> {
  if (!API_KEY) return null;

  const cacheKey = `NIV:${ref}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const verseId = refToApiBibleId(ref);
  const url =
    `https://api.scripture.api.bible/v1/bibles/${NIV_BIBLE_ID}/verses/${verseId}` +
    `?content-type=text&include-notes=false&include-titles=false` +
    `&include-chapter-numbers=false&include-verse-numbers=false&include-verse-spans=false`;

  try {
    const res = await fetch(url, { headers: { 'api-key': API_KEY } });
    if (!res.ok) return null;
    const json = await res.json() as { data?: { content?: string } };
    const text = json.data?.content?.trim() ?? null;
    if (text) cache.set(cacheKey, text);
    return text;
  } catch {
    return null;
  }
}
