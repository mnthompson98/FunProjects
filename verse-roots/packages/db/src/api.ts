import { db } from './db.js';
import type {
  Verse,
  OriginalWord,
  StrongsEntry,
  WordWithLexicon,
  VerseWithWords,
  ConcordanceEntry,
} from './types.js';

// ---------------------------------------------------------------------------
// Internal row mappers
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

function mapVerse(row: VerseRow): Verse {
  return {
    ref: row.ref,
    book: row.book,
    chapter: row.chapter,
    verse: row.verse,
    testament: row.testament as 'OT' | 'NT',
  };
}

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

function attachLexicon(word: OriginalWord): WordWithLexicon {
  const lexicon = word.strongs ? getStrongs(word.strongs) : null;
  return { ...word, lexicon };
}

// ---------------------------------------------------------------------------
// Prepared statements (lazy)
// ---------------------------------------------------------------------------

const stmts = {
  getStrongsVariants: db.prepare<[string], StrongsRow>(
    "SELECT * FROM strongs_entries WHERE strongs GLOB ? ORDER BY strongs LIMIT 1"
  ),
  getVerseRow: db.prepare<[string], VerseRow>('SELECT * FROM verses WHERE ref = ?'),
  getWordsByVerse: db.prepare<[string], WordRow>(
    'SELECT * FROM original_words WHERE verse_ref = ? ORDER BY position'
  ),
  getWordByPosition: db.prepare<[string, number], WordRow>(
    'SELECT * FROM original_words WHERE verse_ref = ? AND position = ?'
  ),
  getStrongsExact: db.prepare<[string], StrongsRow>(
    'SELECT * FROM strongs_entries WHERE strongs = ?'
  ),
  getConcordanceVerseRefs: db.prepare<[string], { verse_ref: string }>(
    'SELECT verse_ref FROM concordance_cache WHERE strongs = ? ORDER BY verse_ref'
  ),
  getConcordanceByBase: db.prepare<[string], { verse_ref: string }>(
    "SELECT DISTINCT verse_ref FROM concordance_cache WHERE strongs GLOB ? ORDER BY verse_ref"
  ),
  getWordsByVerseAndStrongs: db.prepare<[string, string], WordRow>(
    'SELECT * FROM original_words WHERE verse_ref = ? AND strongs = ? ORDER BY position'
  ),
  getWordsByVerseAndStrongsGlob: db.prepare<[string, string], WordRow>(
    "SELECT * FROM original_words WHERE verse_ref = ? AND strongs GLOB ? ORDER BY position"
  ),
  getVersesByBook: db.prepare<[string], VerseRow>(
    "SELECT * FROM verses WHERE book LIKE ? ORDER BY ref"
  ),
  getVersesByChapter: db.prepare<[string, string], VerseRow>(
    'SELECT * FROM verses WHERE book = ? AND chapter = ? ORDER BY verse'
  ),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns verse metadata + all its original-language words with inline lexicon entries.
 * Returns null if ref not found.
 */
export function getVerse(ref: string): VerseWithWords | null {
  const verseRow = stmts.getVerseRow.get(ref);
  if (!verseRow) return null;

  const verse = mapVerse(verseRow);
  const wordRows = stmts.getWordsByVerse.all(ref);
  const words = wordRows.map(mapWord).map(attachLexicon);

  return { ...verse, words };
}

/**
 * Returns a single word by verse ref + 1-based position.
 * Returns null if not found.
 */
export function getWord(verseRef: string, position: number): WordWithLexicon | null {
  const row = stmts.getWordByPosition.get(verseRef, position);
  if (!row) return null;
  return attachLexicon(mapWord(row));
}

/**
 * Returns the lexicon entry for a Strong's number.
 * Accepts both "H2617" and "H2617A" (strip suffix for lookup fallback).
 * Returns null if not found.
 */
export function getStrongs(strongs: string): StrongsEntry | null {
  // Try exact match first
  const exact = stmts.getStrongsExact.get(strongs);
  if (exact) return mapStrongs(exact);

  // If this looks like a base number (no trailing letter), try variants (e.g. "H2617" -> "H2617A")
  const isBase = /^[HG]\d+$/.test(strongs);
  if (isBase) {
    const variant = stmts.getStrongsVariants.get(`${strongs}*`);
    if (variant) return mapStrongs(variant);
  }

  // Strip trailing letter suffix and try again (e.g. "H2617A" -> "H2617")
  const base = strongs.replace(/([A-Z]\d+)[A-Z]+$/, '$1');
  if (base !== strongs) {
    const fallback = stmts.getStrongsExact.get(base);
    if (fallback) return mapStrongs(fallback);
  }

  return null;
}

/**
 * Returns all verses where a given Strong's number appears, with the matching words.
 * Accepts both exact ("H2617A") and base ("H2617") — base matches all variants.
 * Returns sorted by verseRef.
 */
export function getConcordance(strongs: string): ConcordanceEntry[] {
  // Determine if this is a base number (no trailing letter) or exact
  const isBase = /^[HG]\d+$/.test(strongs);
  const globPattern = isBase ? `${strongs}*` : strongs;

  const verseRefs = isBase
    ? stmts.getConcordanceByBase.all(globPattern).map((r) => r.verse_ref)
    : stmts.getConcordanceVerseRefs.all(strongs).map((r) => r.verse_ref);

  return verseRefs.map((verseRef) => {
    const verseRow = stmts.getVerseRow.get(verseRef);
    const wordRows = isBase
      ? stmts.getWordsByVerseAndStrongsGlob.all(verseRef, globPattern)
      : stmts.getWordsByVerseAndStrongs.all(verseRef, strongs);

    return {
      verseRef,
      book: verseRow?.book ?? '',
      chapter: verseRow?.chapter ?? 0,
      verse: verseRow?.verse ?? 0,
      words: wordRows.map(mapWord),
    };
  });
}

/**
 * Search verses by book name (partial match, case-insensitive).
 */
export function getVersesByBook(book: string): Verse[] {
  const rows = stmts.getVersesByBook.all(`%${book}%`);
  return rows.map(mapVerse);
}

/**
 * Given a partial ref like "Lam.3" return all verses in that chapter with words.
 */
export function getChapter(bookAndChapter: string): VerseWithWords[] {
  const parts = bookAndChapter.split('.');
  if (parts.length < 2) return [];

  const book = parts[0];
  const chapter = parts[1];

  const verseRows = stmts.getVersesByChapter.all(book, chapter);
  return verseRows.map((row) => {
    const verse = mapVerse(row);
    const wordRows = stmts.getWordsByVerse.all(row.ref);
    const words = wordRows.map(mapWord).map(attachLexicon);
    return { ...verse, words };
  });
}
