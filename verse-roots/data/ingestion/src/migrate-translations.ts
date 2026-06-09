/**
 * migrate-translations.ts
 *
 * Uploads ASV and WEB rows from the local SQLite verse_translations table
 * to the Supabase verse_translations table.
 *
 * Safe to re-run: skips translations that are already present.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import Database from 'better-sqlite3';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

function loadEnv() {
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
      break;
    } catch { /* try next */ }
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: ws },
});

function findDbPath(): string {
  const candidates = [
    resolve(process.cwd(), 'data/db/verse-roots.db'),
    resolve(process.cwd(), '../../data/db/verse-roots.db'),
  ];
  for (const p of candidates) {
    try { readFileSync(p); return p; } catch { /* try next */ }
  }
  return candidates[0];
}

const db = new Database(findDbPath(), { readonly: true });

async function migrateTranslation(translation: string): Promise<void> {
  // Check if already migrated
  const { count } = (await supabase
    .from('verse_translations')
    .select('*', { count: 'exact', head: true })
    .eq('translation', translation)) as { count: number | null };

  if ((count ?? 0) > 0) {
    console.log(`${translation}: already has ${count} rows in Supabase, skipping.`);
    return;
  }

  const tableInfo = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='verse_translations'")
    .get();
  if (!tableInfo) {
    console.log('verse_translations: table not found in SQLite, skipping.');
    return;
  }

  const rows = db
    .prepare('SELECT ref, translation, text FROM verse_translations WHERE translation = ?')
    .all(translation) as Array<{ ref: string; translation: string; text: string }>;

  if (rows.length === 0) {
    console.log(`${translation}: no rows found in SQLite.`);
    return;
  }

  console.log(`Migrating ${translation} (${rows.length} verses)…`);
  const BATCH = 1000;
  let batchIdx = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('verse_translations').insert(batch);
    if (error) console.error(`  [${translation}] batch ${batchIdx} error: ${error.message}`);
    batchIdx++;
    if (batchIdx % 5 === 0) console.log(`  ${translation}: ${i + batch.length}/${rows.length}`);
  }
  console.log(`${translation}: done (${rows.length} rows)`);
}

async function main() {
  console.log('Starting translation migration…');
  await migrateTranslation('ASV');
  await migrateTranslation('WEB');
  console.log('\nTranslation migration complete!');
  db.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
