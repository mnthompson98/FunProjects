/**
 * parse-kjv.ts
 *
 * Downloads KJV text from https://github.com/aruljohn/Bible-kjv (public domain)
 * and populates the verse_translations table with translation='KJV'.
 *
 * Run via: npm run ingest:kjv (from repo root)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { fileURLToPath } from 'url';
import { openDb } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(__dirname, '../../../data/raw/kjv');

// Map from KJV book filename (without .json) to OSIS book code
const KJV_BOOK_TO_OSIS: Record<string, string> = {
  Genesis: 'Gen',
  Exodus: 'Exo',
  Leviticus: 'Lev',
  Numbers: 'Num',
  Deuteronomy: 'Deu',
  Joshua: 'Jos',
  Judges: 'Jdg',
  Ruth: 'Rut',
  '1Samuel': '1Sa',
  '2Samuel': '2Sa',
  '1Kings': '1Ki',
  '2Kings': '2Ki',
  '1Chronicles': '1Ch',
  '2Chronicles': '2Ch',
  Ezra: 'Ezr',
  Nehemiah: 'Neh',
  Esther: 'Est',
  Job: 'Job',
  Psalms: 'Psa',
  Proverbs: 'Pro',
  Ecclesiastes: 'Ecc',
  SongofSolomon: 'Sng',
  Isaiah: 'Isa',
  Jeremiah: 'Jer',
  Lamentations: 'Lam',
  Ezekiel: 'Ezk',
  Daniel: 'Dan',
  Hosea: 'Hos',
  Joel: 'Jol',
  Amos: 'Amo',
  Obadiah: 'Oba',
  Jonah: 'Jon',
  Micah: 'Mic',
  Nahum: 'Nam',
  Habakkuk: 'Hab',
  Zephaniah: 'Zep',
  Haggai: 'Hag',
  Zechariah: 'Zec',
  Malachi: 'Mal',
  Matthew: 'Mat',
  Mark: 'Mrk',
  Luke: 'Luk',
  John: 'Jhn',
  Acts: 'Act',
  Romans: 'Rom',
  '1Corinthians': '1Co',
  '2Corinthians': '2Co',
  Galatians: 'Gal',
  Ephesians: 'Eph',
  Philippians: 'Php',
  Colossians: 'Col',
  '1Thessalonians': '1Th',
  '2Thessalonians': '2Th',
  '1Timothy': '1Ti',
  '2Timothy': '2Ti',
  Titus: 'Tit',
  Philemon: 'Phm',
  Hebrews: 'Heb',
  James: 'Jas',
  '1Peter': '1Pe',
  '2Peter': '2Pe',
  '1John': '1Jn',
  '2John': '2Jn',
  '3John': '3Jn',
  Jude: 'Jud',
  Revelation: 'Rev',
};

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location!).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchBook(bookName: string): Promise<any> {
  const cachePath = path.join(RAW_DIR, `${bookName}.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }
  const url = `https://raw.githubusercontent.com/aruljohn/Bible-kjv/master/${bookName}.json`;
  console.log(`  Downloading ${bookName}...`);
  const text = await fetchUrl(url);
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(cachePath, text, 'utf8');
  return JSON.parse(text);
}

export async function parseKjv(): Promise<void> {
  const db = openDb();

  // Get all existing verse refs for INNER JOIN logic
  const existingRefs = new Set<string>(
    (db.prepare('SELECT ref FROM verses').all() as { ref: string }[]).map((r) => r.ref)
  );

  const insert = db.prepare(
    'INSERT OR REPLACE INTO verse_translations (ref, translation, text) VALUES (?, ?, ?)'
  );

  let inserted = 0;
  let skipped = 0;

  const insertMany = db.transaction((rows: Array<[string, string, string]>) => {
    for (const [ref, trans, text] of rows) {
      insert.run(ref, trans, text);
    }
  });

  for (const [bookName, osisCode] of Object.entries(KJV_BOOK_TO_OSIS)) {
    const data = await fetchBook(bookName);
    const rows: Array<[string, string, string]> = [];

    for (const chapter of data.chapters) {
      const chapterNum = String(chapter.chapter);
      for (const verseObj of chapter.verses) {
        const verseNum = String(verseObj.verse);
        const ref = `${osisCode}.${chapterNum}.${verseNum}`;
        if (existingRefs.has(ref)) {
          rows.push([ref, 'KJV', verseObj.text]);
          inserted++;
        } else {
          skipped++;
        }
      }
    }

    insertMany(rows);
    process.stdout.write(`  ${bookName}: ${rows.length} verses\n`);
  }

  console.log(`\nKJV ingestion complete: ${inserted} inserted, ${skipped} skipped (not in verses table).`);
  db.close();
}

// Run standalone if called directly
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  console.log('=== KJV Ingestion ===\n');
  parseKjv().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
