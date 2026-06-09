import { bibleSupa } from './client';

// ---------------------------------------------------------------------------
// Types (mirrors apps/web/src/types.ts)
// ---------------------------------------------------------------------------

export interface Verse {
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  testament: 'OT' | 'NT';
}

export interface OriginalWord {
  id: number;
  verseRef: string;
  position: number;
  originalText: string;
  transliteration: string | null;
  strongs: string | null;
  morphology: string | null;
  gloss: string | null;
}

export interface StrongsEntry {
  strongs: string;
  language: 'hebrew' | 'greek';
  lemma: string | null;
  transliteration: string | null;
  shortDef: string | null;
  fullDef: string | null;
}

export interface WordWithLexicon extends OriginalWord {
  lexicon: StrongsEntry | null;
}

export interface VerseWithWords extends Verse {
  words: WordWithLexicon[];
}

export interface ConcordanceEntry {
  verseRef: string;
  book: string;
  chapter: number;
  verse: number;
  words: OriginalWord[];
}

export interface ConcordanceResponse {
  total: number;
  results: ConcordanceEntry[];
}

// ---------------------------------------------------------------------------
// Row shape from Supabase (snake_case)
// ---------------------------------------------------------------------------

interface VerseRow {
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  testament: string;
}

interface WordRow {
  id: number;
  verse_ref: string;
  position: number;
  original_text: string;
  transliteration: string | null;
  strongs: string | null;
  morphology: string | null;
  gloss: string | null;
}

interface StrongsRow {
  strongs: string;
  language: string;
  lemma: string | null;
  transliteration: string | null;
  short_def: string | null;
  full_def: string | null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapWord(row: WordRow): OriginalWord {
  return {
    id: row.id,
    verseRef: row.verse_ref,
    position: row.position,
    originalText: row.original_text,
    transliteration: row.transliteration,
    strongs: row.strongs,
    morphology: row.morphology,
    gloss: row.gloss,
  };
}

function mapStrongs(row: StrongsRow): StrongsEntry {
  return {
    strongs: row.strongs,
    language: row.language as 'hebrew' | 'greek',
    lemma: row.lemma,
    transliteration: row.transliteration,
    shortDef: row.short_def,
    fullDef: row.full_def,
  };
}

function mapVerse(row: VerseRow): Verse {
  return {
    ref: row.ref,
    book: row.book,
    chapter: row.chapter,
    verse: row.verse,
    testament: row.testament as 'OT' | 'NT',
  };
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** Fetch a verse with all its original words and lexicon entries. */
export async function getVerse(ref: string): Promise<VerseWithWords | null> {
  const { data: verseRow, error: verseErr } = await bibleSupa
    .from('verses')
    .select('ref, book, chapter, verse, testament')
    .eq('ref', ref)
    .maybeSingle();

  if (verseErr || !verseRow) return null;

  const { data: wordRows, error: wordErr } = await bibleSupa
    .from('original_words')
    .select('id, verse_ref, position, original_text, transliteration, strongs, morphology, gloss')
    .eq('verse_ref', ref)
    .order('position');

  if (wordErr) return null;

  // Collect unique strongs numbers
  const strongsIds = [...new Set((wordRows ?? []).map((w: WordRow) => w.strongs).filter(Boolean) as string[])];
  let lexiconMap = new Map<string, StrongsEntry>();

  if (strongsIds.length > 0) {
    const { data: sRows } = await bibleSupa
      .from('strongs_entries')
      .select('strongs, language, lemma, transliteration, short_def, full_def')
      .in('strongs', strongsIds);

    for (const row of (sRows ?? []) as StrongsRow[]) {
      lexiconMap.set(row.strongs, mapStrongs(row));
    }
  }

  const words: WordWithLexicon[] = (wordRows ?? []).map((w: WordRow) => ({
    ...mapWord(w),
    lexicon: w.strongs ? (lexiconMap.get(w.strongs) ?? null) : null,
  }));

  return {
    ...mapVerse(verseRow as VerseRow),
    words,
  };
}

/** Fetch a single word with its lexicon entry. */
export async function getWord(verseRef: string, position: number): Promise<WordWithLexicon | null> {
  const { data: row, error } = await bibleSupa
    .from('original_words')
    .select('id, verse_ref, position, original_text, transliteration, strongs, morphology, gloss')
    .eq('verse_ref', verseRef)
    .eq('position', position)
    .maybeSingle();

  if (error || !row) return null;
  const word = mapWord(row as WordRow);

  let lexicon: StrongsEntry | null = null;
  if (word.strongs) {
    lexicon = await getStrongs(word.strongs);
  }

  return { ...word, lexicon };
}

/** Fetch a Strong's lexicon entry by ID. Tries exact match, then base-number prefix. */
export async function getStrongs(strongs: string): Promise<StrongsEntry | null> {
  const { data: row, error } = await bibleSupa
    .from('strongs_entries')
    .select('strongs, language, lemma, transliteration, short_def, full_def')
    .eq('strongs', strongs)
    .maybeSingle();

  if (!error && row) return mapStrongs(row as StrongsRow);

  // Fallback: match by prefix (e.g., "H2617" matches "H2617a")
  const { data: rows } = await bibleSupa
    .from('strongs_entries')
    .select('strongs, language, lemma, transliteration, short_def, full_def')
    .like('strongs', `${strongs}%`)
    .limit(1);

  if (rows && rows.length > 0) return mapStrongs(rows[0] as StrongsRow);
  return null;
}

/** Fetch concordance data for a Strong's number. */
export async function getConcordance(strongs: string, limit = 50): Promise<ConcordanceResponse> {
  // Total count
  const { count } = await bibleSupa
    .from('original_words')
    .select('*', { count: 'exact', head: true })
    .like('strongs', `${strongs}%`);

  const total = count ?? 0;

  // Results with verse info
  const { data: wordRows, error } = await bibleSupa
    .from('original_words')
    .select('id, verse_ref, position, original_text, transliteration, strongs, morphology, gloss')
    .like('strongs', `${strongs}%`)
    .order('verse_ref')
    .limit(limit);

  if (error || !wordRows) return { total, results: [] };

  // Group words by verse_ref and fetch verse metadata
  const verseRefs = [...new Set((wordRows as WordRow[]).map((w) => w.verse_ref))];
  const { data: verseRows } = await bibleSupa
    .from('verses')
    .select('ref, book, chapter, verse, testament')
    .in('ref', verseRefs);

  const verseMap = new Map<string, VerseRow>();
  for (const v of (verseRows ?? []) as VerseRow[]) {
    verseMap.set(v.ref, v);
  }

  // Group words by verse
  const grouped = new Map<string, WordRow[]>();
  for (const w of wordRows as WordRow[]) {
    const arr = grouped.get(w.verse_ref) ?? [];
    arr.push(w);
    grouped.set(w.verse_ref, arr);
  }

  const results: ConcordanceEntry[] = verseRefs
    .map((ref) => {
      const v = verseMap.get(ref);
      if (!v) return null;
      return {
        verseRef: ref,
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        words: (grouped.get(ref) ?? []).map(mapWord),
      };
    })
    .filter((x): x is ConcordanceEntry => x !== null);

  return { total, results };
}

/** Fetch all verses in a chapter (e.g., "John.3"). */
export async function getChapter(bookAndChapter: string): Promise<VerseWithWords[]> {
  const [book, chapterStr] = bookAndChapter.split('.');
  const chapter = parseInt(chapterStr, 10);

  const { data: verseRows, error } = await bibleSupa
    .from('verses')
    .select('ref, book, chapter, verse, testament')
    .eq('book', book)
    .eq('chapter', chapter)
    .order('verse');

  if (error || !verseRows) return [];

  const refs = (verseRows as VerseRow[]).map((v) => v.ref);
  const results = await Promise.all(refs.map((ref) => getVerse(ref)));
  return results.filter((v): v is VerseWithWords => v !== null);
}

/** Fetch a translation text for a verse. */
export async function getVerseTranslation(
  ref: string,
  translation: string,
): Promise<{ ref: string; translation: string; text: string } | null> {
  const { data, error } = await bibleSupa
    .from('verse_translations')
    .select('ref, translation, text')
    .eq('ref', ref)
    .eq('translation', translation)
    .maybeSingle();

  if (error || !data) return null;
  return data as { ref: string; translation: string; text: string };
}
