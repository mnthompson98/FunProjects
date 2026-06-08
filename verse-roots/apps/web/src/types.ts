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
