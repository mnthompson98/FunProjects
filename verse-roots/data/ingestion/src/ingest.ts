/**
 * ingest.ts
 *
 * Orchestrator: run schema, then parsers, then verify.
 */

import { openDb, createSchema } from './schema.js';
import { parseStepbible } from './parse-stepbible.js';
import { parseOshb } from './parse-oshb.js';
import { runVerify } from './verify.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.resolve(__dirname, '../../db');

async function main() {
  console.log('=== Verse Roots Ingestion ===\n');

  // Ensure DB directory exists
  fs.mkdirSync(DB_DIR, { recursive: true });

  const db = openDb();

  console.log('1. Creating/verifying schema...');
  createSchema(db);

  console.log('\n2. Parsing STEPBible data...');
  await parseStepbible(db);

  console.log('\n3. Parsing OSHB data (stub)...');
  await parseOshb(db);

  // Print stats
  const wordCount = (db.prepare('SELECT COUNT(*) as n FROM original_words').get() as any).n;
  const verseCount = (db.prepare('SELECT COUNT(*) as n FROM verses').get() as any).n;
  const lexCount = (db.prepare('SELECT COUNT(*) as n FROM strongs_entries').get() as any).n;
  console.log(`\n=== Stats ===`);
  console.log(`  Verses: ${verseCount}`);
  console.log(`  Words: ${wordCount}`);
  console.log(`  Lexicon entries: ${lexCount}`);

  db.close();

  console.log('\n4. Running verification...');
  runVerify();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
