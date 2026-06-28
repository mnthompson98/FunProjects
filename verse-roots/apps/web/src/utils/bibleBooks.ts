// Canonical (Protestant) book order with chapter counts, for book search and
// cross-book chapter navigation.

export interface BibleBook {
  osis: string;
  name: string;
  chapters: number;
}

export const BIBLE_BOOKS: BibleBook[] = [
  { osis: 'Gen', name: 'Genesis', chapters: 50 },
  { osis: 'Exo', name: 'Exodus', chapters: 40 },
  { osis: 'Lev', name: 'Leviticus', chapters: 27 },
  { osis: 'Num', name: 'Numbers', chapters: 36 },
  { osis: 'Deu', name: 'Deuteronomy', chapters: 34 },
  { osis: 'Jos', name: 'Joshua', chapters: 24 },
  { osis: 'Jdg', name: 'Judges', chapters: 21 },
  { osis: 'Rut', name: 'Ruth', chapters: 4 },
  { osis: '1Sa', name: '1 Samuel', chapters: 31 },
  { osis: '2Sa', name: '2 Samuel', chapters: 24 },
  { osis: '1Ki', name: '1 Kings', chapters: 22 },
  { osis: '2Ki', name: '2 Kings', chapters: 25 },
  { osis: '1Ch', name: '1 Chronicles', chapters: 29 },
  { osis: '2Ch', name: '2 Chronicles', chapters: 36 },
  { osis: 'Ezr', name: 'Ezra', chapters: 10 },
  { osis: 'Neh', name: 'Nehemiah', chapters: 13 },
  { osis: 'Est', name: 'Esther', chapters: 10 },
  { osis: 'Job', name: 'Job', chapters: 42 },
  { osis: 'Psa', name: 'Psalm', chapters: 150 },
  { osis: 'Pro', name: 'Proverbs', chapters: 31 },
  { osis: 'Ecc', name: 'Ecclesiastes', chapters: 12 },
  { osis: 'Sng', name: 'Song of Solomon', chapters: 8 },
  { osis: 'Isa', name: 'Isaiah', chapters: 66 },
  { osis: 'Jer', name: 'Jeremiah', chapters: 52 },
  { osis: 'Lam', name: 'Lamentations', chapters: 5 },
  { osis: 'Ezk', name: 'Ezekiel', chapters: 48 },
  { osis: 'Dan', name: 'Daniel', chapters: 12 },
  { osis: 'Hos', name: 'Hosea', chapters: 14 },
  { osis: 'Jol', name: 'Joel', chapters: 3 },
  { osis: 'Amo', name: 'Amos', chapters: 9 },
  { osis: 'Oba', name: 'Obadiah', chapters: 1 },
  { osis: 'Jon', name: 'Jonah', chapters: 4 },
  { osis: 'Mic', name: 'Micah', chapters: 7 },
  { osis: 'Nam', name: 'Nahum', chapters: 3 },
  { osis: 'Hab', name: 'Habakkuk', chapters: 3 },
  { osis: 'Zep', name: 'Zephaniah', chapters: 3 },
  { osis: 'Hag', name: 'Haggai', chapters: 2 },
  { osis: 'Zec', name: 'Zechariah', chapters: 14 },
  { osis: 'Mal', name: 'Malachi', chapters: 4 },
  { osis: 'Mat', name: 'Matthew', chapters: 28 },
  { osis: 'Mrk', name: 'Mark', chapters: 16 },
  { osis: 'Luk', name: 'Luke', chapters: 24 },
  { osis: 'Jhn', name: 'John', chapters: 21 },
  { osis: 'Act', name: 'Acts', chapters: 28 },
  { osis: 'Rom', name: 'Romans', chapters: 16 },
  { osis: '1Co', name: '1 Corinthians', chapters: 16 },
  { osis: '2Co', name: '2 Corinthians', chapters: 13 },
  { osis: 'Gal', name: 'Galatians', chapters: 6 },
  { osis: 'Eph', name: 'Ephesians', chapters: 6 },
  { osis: 'Php', name: 'Philippians', chapters: 4 },
  { osis: 'Col', name: 'Colossians', chapters: 4 },
  { osis: '1Th', name: '1 Thessalonians', chapters: 5 },
  { osis: '2Th', name: '2 Thessalonians', chapters: 3 },
  { osis: '1Ti', name: '1 Timothy', chapters: 6 },
  { osis: '2Ti', name: '2 Timothy', chapters: 4 },
  { osis: 'Tit', name: 'Titus', chapters: 3 },
  { osis: 'Phm', name: 'Philemon', chapters: 1 },
  { osis: 'Heb', name: 'Hebrews', chapters: 13 },
  { osis: 'Jas', name: 'James', chapters: 5 },
  { osis: '1Pe', name: '1 Peter', chapters: 5 },
  { osis: '2Pe', name: '2 Peter', chapters: 3 },
  { osis: '1Jn', name: '1 John', chapters: 5 },
  { osis: '2Jn', name: '2 John', chapters: 1 },
  { osis: '3Jn', name: '3 John', chapters: 1 },
  { osis: 'Jud', name: 'Jude', chapters: 1 },
  { osis: 'Rev', name: 'Revelation', chapters: 22 },
];

const INDEX_BY_OSIS = new Map(BIBLE_BOOKS.map((b, i) => [b.osis, i]));

export function getBook(osis: string): BibleBook | undefined {
  const i = INDEX_BY_OSIS.get(osis);
  return i === undefined ? undefined : BIBLE_BOOKS[i];
}

/** True if a normalized ref is a bare book code (no chapter/verse). */
export function isBookCode(ref: string): boolean {
  return !ref.includes('.') && INDEX_BY_OSIS.has(ref);
}

export interface ChapterTarget {
  ref: string;   // "Jhn.3"
  label: string; // "John 3"
}

/** Previous chapter, wrapping to the previous book's last chapter. Null at Genesis 1. */
export function prevChapter(chapterRef: string): ChapterTarget | null {
  const [osis, chStr] = chapterRef.split('.');
  const idx = INDEX_BY_OSIS.get(osis);
  if (idx === undefined) return null;
  const ch = parseInt(chStr, 10);
  if (ch > 1) {
    return { ref: `${osis}.${ch - 1}`, label: `${BIBLE_BOOKS[idx].name} ${ch - 1}` };
  }
  if (idx === 0) return null; // Genesis 1
  const prev = BIBLE_BOOKS[idx - 1];
  return { ref: `${prev.osis}.${prev.chapters}`, label: `${prev.name} ${prev.chapters}` };
}

/** Next chapter, wrapping to the next book's chapter 1. Null at Revelation 22. */
export function nextChapter(chapterRef: string): ChapterTarget | null {
  const [osis, chStr] = chapterRef.split('.');
  const idx = INDEX_BY_OSIS.get(osis);
  if (idx === undefined) return null;
  const ch = parseInt(chStr, 10);
  const book = BIBLE_BOOKS[idx];
  if (ch < book.chapters) {
    return { ref: `${osis}.${ch + 1}`, label: `${book.name} ${ch + 1}` };
  }
  if (idx === BIBLE_BOOKS.length - 1) return null; // Revelation last chapter
  const next = BIBLE_BOOKS[idx + 1];
  return { ref: `${next.osis}.1`, label: `${next.name} 1` };
}
