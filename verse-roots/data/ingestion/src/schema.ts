import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../../db/verse-roots.db');

export function openDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  return db;
}

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS verses (
      ref TEXT PRIMARY KEY,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      testament TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verse_translations (
      ref TEXT NOT NULL,
      translation TEXT NOT NULL,
      text TEXT NOT NULL,
      PRIMARY KEY (ref, translation)
    );

    CREATE TABLE IF NOT EXISTS original_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      verse_ref TEXT NOT NULL,
      position INTEGER NOT NULL,
      original_text TEXT NOT NULL,
      transliteration TEXT,
      strongs TEXT,
      morphology TEXT,
      gloss TEXT,
      UNIQUE(verse_ref, position)
    );

    CREATE INDEX IF NOT EXISTS idx_original_words_strongs ON original_words(strongs);

    CREATE TABLE IF NOT EXISTS strongs_entries (
      strongs TEXT PRIMARY KEY,
      language TEXT NOT NULL,
      lemma TEXT,
      transliteration TEXT,
      short_def TEXT,
      full_def TEXT
    );

    CREATE TABLE IF NOT EXISTS concordance_cache (
      strongs TEXT NOT NULL,
      verse_ref TEXT NOT NULL,
      PRIMARY KEY (strongs, verse_ref)
    );
  `);
  console.log('Schema created/verified.');
}

// Run standalone if called directly
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const db = openDb();
  createSchema(db);
  db.close();
}
