import { readFileSync } from 'fs';
import { resolve } from 'path';
import Database from 'better-sqlite3';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

function loadEnv() {
  // Support running from repo root or from data/ingestion/
  const candidates = [
    resolve(process.cwd(), 'apps/api/.env'),
    resolve(process.cwd(), '../../apps/api/.env'),
  ];
  for (const envPath of candidates) {
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const [key, ...vals] = line.split('=');
      if (key && vals.length && !process.env[key]) {
        process.env[key] = vals.join('=').trim();
      }
    }
    break; // found and loaded successfully
  } catch {
    // try next candidate
  }
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function findDbPath(): string {
  const candidates = [
    resolve(process.cwd(), 'data/db/verse-roots.db'),
    resolve(process.cwd(), '../../data/db/verse-roots.db'),
  ];
  for (const p of candidates) {
    try { readFileSync(p); return p; } catch { /* try next */ }
  }
  return candidates[0]; // will fail with a clear error
}
const DB_PATH = findDbPath();
const db = new Database(DB_PATH, { readonly: true });

async function getCount(table: string): Promise<number> {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }) as { count: number | null };
  return count ?? 0;
}

async function insertBatch<T extends Record<string, unknown>>(
  table: string,
  batch: T[],
  batchIndex: number,
): Promise<void> {
  const { error } = await supabase.from(table).insert(batch);
  if (error) {
    console.error(`  [${table}] Error in batch ${batchIndex}: ${error.message}`);
  }
}

async function migrateVerses(): Promise<void> {
  const existingCount = await getCount('verses');
  if (existingCount > 0) {
    console.log(`verses: already has ${existingCount} rows, skipping.`);
    return;
  }

  console.log('Migrating verses...');
  const rows = db.prepare('SELECT ref, book, chapter, verse, testament FROM verses ORDER BY ref').all() as Array<{
    ref: string; book: string; chapter: number; verse: number; testament: string;
  }>;

  const BATCH_SIZE = 1000;
  let batchIdx = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await insertBatch('verses', batch, batchIdx);
    batchIdx++;
    if (batchIdx % 10 === 0) {
      console.log(`  verses: ${i + batch.length}/${rows.length}`);
    }
  }
  console.log(`verses: done (${rows.length} rows)`);
}

async function migrateStrongsEntries(): Promise<void> {
  const existingCount = await getCount('strongs_entries');
  if (existingCount > 0) {
    console.log(`strongs_entries: already has ${existingCount} rows, skipping.`);
    return;
  }

  console.log('Migrating strongs_entries...');
  const rows = db.prepare('SELECT strongs, language, lemma, transliteration, short_def, full_def FROM strongs_entries').all() as Array<{
    strongs: string; language: string; lemma: string | null; transliteration: string | null;
    short_def: string | null; full_def: string | null;
  }>;

  const BATCH_SIZE = 500;
  let batchIdx = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await insertBatch('strongs_entries', batch, batchIdx);
    batchIdx++;
    if (batchIdx % 10 === 0) {
      console.log(`  strongs_entries: ${i + batch.length}/${rows.length}`);
    }
  }
  console.log(`strongs_entries: done (${rows.length} rows)`);
}

async function migrateOriginalWords(): Promise<void> {
  const existingCount = await getCount('original_words');
  if (existingCount > 0) {
    console.log(`original_words: already has ${existingCount} rows, skipping.`);
    return;
  }

  console.log('Migrating original_words...');
  const rows = db.prepare(
    'SELECT id, verse_ref, position, original_text, transliteration, strongs, morphology, gloss FROM original_words ORDER BY verse_ref, position'
  ).all() as Array<{
    id: number; verse_ref: string; position: number; original_text: string;
    transliteration: string | null; strongs: string | null; morphology: string | null; gloss: string | null;
  }>;

  const BATCH_SIZE = 500;
  let batchIdx = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await insertBatch('original_words', batch, batchIdx);
    batchIdx++;
    if (batchIdx % 10 === 0) {
      console.log(`  original_words: ${i + batch.length}/${rows.length}`);
    }
  }
  console.log(`original_words: done (${rows.length} rows)`);
}

async function migrateVerseTranslations(): Promise<void> {
  const existingCount = await getCount('verse_translations');
  if (existingCount > 0) {
    console.log(`verse_translations: already has ${existingCount} rows, skipping.`);
    return;
  }

  // Check if verse_translations table exists in SQLite
  const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='verse_translations'").get();
  if (!tableInfo) {
    console.log('verse_translations: table not found in SQLite, skipping.');
    return;
  }

  console.log('Migrating verse_translations...');
  const rows = db.prepare('SELECT ref, translation, text FROM verse_translations').all() as Array<{
    ref: string; translation: string; text: string;
  }>;

  const BATCH_SIZE = 1000;
  let batchIdx = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await insertBatch('verse_translations', batch, batchIdx);
    batchIdx++;
    if (batchIdx % 10 === 0) {
      console.log(`  verse_translations: ${i + batch.length}/${rows.length}`);
    }
  }
  console.log(`verse_translations: done (${rows.length} rows)`);
}

async function main() {
  console.log('Starting Supabase migration...');
  console.log(`DB: ${DB_PATH}`);
  console.log(`Supabase: ${SUPABASE_URL}`);

  await migrateVerses();
  await migrateStrongsEntries();
  await migrateOriginalWords();
  await migrateVerseTranslations();

  console.log('\nMigration complete!');
  db.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
