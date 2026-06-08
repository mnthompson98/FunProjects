/**
 * verify.ts
 *
 * Queries the DB for Lam 3:22 and John 1:1, prints results, and asserts expected data.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../db/verse-roots.db');

interface Word {
  id: number;
  verse_ref: string;
  position: number;
  original_text: string;
  transliteration: string | null;
  strongs: string | null;
  morphology: string | null;
  gloss: string | null;
}

interface StrongsEntry {
  strongs: string;
  language: string;
  lemma: string | null;
  transliteration: string | null;
  short_def: string | null;
}

function printVerse(ref: string, words: Word[], db: Database.Database): void {
  console.log(`\n=== ${ref} ===`);
  console.log(`  ${words.length} words\n`);
  for (const w of words) {
    const entry = w.strongs
      ? (db.prepare('SELECT * FROM strongs_entries WHERE strongs = ?').get(w.strongs) as StrongsEntry | undefined)
      : undefined;
    console.log(
      `  [${w.position}] ${w.original_text}  (${w.transliteration ?? '—'})  Strongs: ${w.strongs ?? '—'}  Morph: ${w.morphology ?? '—'}`,
    );
    console.log(
      `       gloss: "${w.gloss ?? '—'}"  lex: ${entry?.lemma ?? '—'} = ${entry?.short_def ?? '—'}`,
    );
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

export function runVerify(): void {
  const db = new Database(DB_PATH, { readonly: true });

  const getWords = (ref: string): Word[] =>
    db
      .prepare('SELECT * FROM original_words WHERE verse_ref = ? ORDER BY position')
      .all(ref) as Word[];

  const lamWords = getWords('Lam.3.22');
  const johnWords = getWords('Jhn.1.1');

  printVerse('Lam.3.22', lamWords, db);
  printVerse('Jhn.1.1', johnWords, db);

  console.log('\n=== Assertions ===');

  assert(lamWords.length >= 5, `Lam 3:22 has at least 5 words (got ${lamWords.length})`);
  assert(johnWords.length >= 7, `John 1:1 has at least 7 words (got ${johnWords.length})`);

  assert(
    lamWords.some((w) => w.strongs?.startsWith('H')),
    'At least one word in Lam 3:22 has a Strong\'s starting with H',
  );
  assert(
    johnWords.some((w) => w.strongs?.startsWith('G')),
    'At least one word in John 1:1 has a Strong\'s starting with G',
  );

  // H2617 / H2617A = chesed (lovingkindness/mercy)
  assert(
    lamWords.some((w) => w.strongs === 'H2617A' || w.strongs === 'H2617'),
    'Lam 3:22 contains H2617 (chesed/lovingkindness)',
  );

  // G3056 = logos
  assert(
    johnWords.some((w) => w.strongs === 'G3056'),
    'John 1:1 contains G3056 (logos)',
  );

  console.log('\nAll assertions passed!');
  db.close();
}

// Run standalone
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  runVerify();
}
