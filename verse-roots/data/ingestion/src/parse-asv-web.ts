/**
 * parse-asv-web.ts
 *
 * Downloads:
 *   ASV  – from bibleapi/bibleapi-bibles-json (resultset JSON, public domain)
 *   WEB  – from seven1m/open-bibles (USFX XML, public domain)
 *
 * Inserts both into verse_translations in the local SQLite DB.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { fileURLToPath } from 'url';
import { openDb } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(__dirname, '../../../data/raw');

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

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
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function downloadIfMissing(filename: string, url: string): Promise<string> {
  const filePath = path.join(RAW_DIR, filename);
  if (fs.existsSync(filePath)) {
    console.log(`  ${filename}: already cached, skipping download.`);
    return filePath;
  }
  console.log(`  Downloading ${filename}…`);
  const text = await fetchUrl(url);
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
  console.log(`  Saved ${filename} (${(text.length / 1024 / 1024).toFixed(1)} MB)`);
  return filePath;
}

// ---------------------------------------------------------------------------
// ASV parser  (bibleapi resultset format)
// ---------------------------------------------------------------------------

// Map book number (1-66) to our OSIS abbreviation
const BOOK_NUM_TO_OSIS: Record<number, string> = {
  1: 'Gen', 2: 'Exo', 3: 'Lev', 4: 'Num', 5: 'Deu',
  6: 'Jos', 7: 'Jdg', 8: 'Rut', 9: '1Sa', 10: '2Sa',
  11: '1Ki', 12: '2Ki', 13: '1Ch', 14: '2Ch', 15: 'Ezr',
  16: 'Neh', 17: 'Est', 18: 'Job', 19: 'Psa', 20: 'Pro',
  21: 'Ecc', 22: 'Sng', 23: 'Isa', 24: 'Jer', 25: 'Lam',
  26: 'Ezk', 27: 'Dan', 28: 'Hos', 29: 'Jol', 30: 'Amo',
  31: 'Oba', 32: 'Jon', 33: 'Mic', 34: 'Nam', 35: 'Hab',
  36: 'Zep', 37: 'Hag', 38: 'Zec', 39: 'Mal',
  40: 'Mat', 41: 'Mrk', 42: 'Luk', 43: 'Jhn', 44: 'Act',
  45: 'Rom', 46: '1Co', 47: '2Co', 48: 'Gal', 49: 'Eph',
  50: 'Php', 51: 'Col', 52: '1Th', 53: '2Th', 54: '1Ti',
  55: '2Ti', 56: 'Tit', 57: 'Phm', 58: 'Heb', 59: 'Jas',
  60: '1Pe', 61: '2Pe', 62: '1Jn', 63: '2Jn', 64: '3Jn',
  65: 'Jud', 66: 'Rev',
};

interface ResultsetRow {
  field: [number, number, number, number, string]; // [id, bookNum, chapter, verse, text]
}

function parseAsv(
  filePath: string,
  existingRefs: Set<string>,
  insert: { run: (ref: string, trans: string, text: string) => void },
): number {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const rows: ResultsetRow[] = data.resultset.row;
  let count = 0;
  for (const row of rows) {
    const [, bookNum, chapter, verse, text] = row.field;
    const osis = BOOK_NUM_TO_OSIS[bookNum];
    if (!osis) continue;
    const ref = `${osis}.${chapter}.${verse}`;
    if (!existingRefs.has(ref)) continue;
    insert.run(ref, 'ASV', text.trim());
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// WEB parser  (USFX XML from seven1m/open-bibles)
// ---------------------------------------------------------------------------

// USFX uses uppercase USFM codes; convert to our mixed-case OSIS abbreviations.
// Rule: first char kept as-is (digit or uppercase letter); if letter, rest lowercased;
// if digit, second char kept uppercase, rest lowercased.
function usfxToOsis(code: string): string {
  if (/^\d/.test(code)) {
    return code[0] + code[1] + code.slice(2).toLowerCase();
  }
  return code[0] + code.slice(1).toLowerCase();
}

// Canonical 66 USFX book IDs
const CANONICAL_USFX_BOOKS = new Set([
  'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI',
  '1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER',
  'LAM','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP',
  'HAG','ZEC','MAL',
  'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL',
  '1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN',
  '3JN','JUD','REV',
]);

function stripInlineTags(xml: string): string {
  // Remove footnotes/cross-refs entirely: <f ...>...</f>, <x ...>...</x>
  let s = xml.replace(/<f\b[^>]*>[\s\S]*?<\/f>/g, '');
  s = s.replace(/<x\b[^>]*>[\s\S]*?<\/x>/g, '');
  // Remove remaining XML tags
  s = s.replace(/<[^>]+>/g, '');
  // Collapse whitespace
  return s.replace(/\s+/g, ' ').trim();
}

function parseWeb(
  filePath: string,
  existingRefs: Set<string>,
  insert: { run: (ref: string, trans: string, text: string) => void },
): number {
  const xml = fs.readFileSync(filePath, 'utf8');
  let count = 0;

  let currentBook = '';
  let currentChapter = 0;
  let currentVerse = 0;
  let inVerse = false;
  let verseBuffer = '';

  // We'll scan through the XML linearly
  const bookRe = /<book id="([^"]+)"/g;
  const chapterRe = /<c id="(\d+)"/g;
  const verseStartRe = /<v id="(\d+)"\/>/g;
  const verseEndRe = /<ve\/>/g;

  // Combine all events into a sorted list by index
  type Event =
    | { type: 'book'; idx: number; id: string }
    | { type: 'chapter'; idx: number; num: number }
    | { type: 'vstart'; idx: number; num: number }
    | { type: 'vend'; idx: number };

  const events: Event[] = [];

  let m: RegExpExecArray | null;
  bookRe.lastIndex = 0;
  while ((m = bookRe.exec(xml)) !== null) {
    events.push({ type: 'book', idx: m.index, id: m[1] });
  }
  chapterRe.lastIndex = 0;
  while ((m = chapterRe.exec(xml)) !== null) {
    events.push({ type: 'chapter', idx: m.index, num: parseInt(m[1], 10) });
  }
  verseStartRe.lastIndex = 0;
  while ((m = verseStartRe.exec(xml)) !== null) {
    events.push({ type: 'vstart', idx: m.index, num: parseInt(m[1], 10) });
  }
  verseEndRe.lastIndex = 0;
  while ((m = verseEndRe.exec(xml)) !== null) {
    events.push({ type: 'vend', idx: m.index });
  }

  events.sort((a, b) => a.idx - b.idx);

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.type === 'book') {
      if (inVerse && verseBuffer.trim()) {
        const text = stripInlineTags(verseBuffer);
        const ref = `${currentBook}.${currentChapter}.${currentVerse}`;
        if (existingRefs.has(ref)) { insert.run(ref, 'WEB', text); count++; }
        verseBuffer = '';
        inVerse = false;
      }
      currentBook = CANONICAL_USFX_BOOKS.has(ev.id) ? usfxToOsis(ev.id) : '';
      currentChapter = 0;
      currentVerse = 0;
    } else if (ev.type === 'chapter') {
      if (inVerse && verseBuffer.trim()) {
        const text = stripInlineTags(verseBuffer);
        const ref = `${currentBook}.${currentChapter}.${currentVerse}`;
        if (existingRefs.has(ref)) { insert.run(ref, 'WEB', text); count++; }
        verseBuffer = '';
        inVerse = false;
      }
      currentChapter = ev.num;
      currentVerse = 0;
    } else if (ev.type === 'vstart') {
      if (inVerse && verseBuffer.trim()) {
        const text = stripInlineTags(verseBuffer);
        const ref = `${currentBook}.${currentChapter}.${currentVerse}`;
        if (existingRefs.has(ref)) { insert.run(ref, 'WEB', text); count++; }
        verseBuffer = '';
      }
      if (!currentBook) { inVerse = false; continue; }
      currentVerse = ev.num;
      inVerse = true;
      const nextIdx = events[i + 1]?.idx ?? xml.length;
      const tagEnd = xml.indexOf('/>', ev.idx) + 2;
      verseBuffer = xml.slice(tagEnd, nextIdx);
    } else if (ev.type === 'vend') {
      if (inVerse && currentBook && verseBuffer.trim()) {
        const text = stripInlineTags(verseBuffer);
        const ref = `${currentBook}.${currentChapter}.${currentVerse}`;
        if (existingRefs.has(ref)) { insert.run(ref, 'WEB', text); count++; }
      }
      verseBuffer = '';
      inVerse = false;
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== ASV + WEB Ingestion ===\n');

  const asvPath = await downloadIfMissing(
    'asv.json',
    'https://raw.githubusercontent.com/bibleapi/bibleapi-bibles-json/master/asv.json',
  );
  const webPath = await downloadIfMissing(
    'eng-web.usfx.xml',
    'https://raw.githubusercontent.com/seven1m/open-bibles/master/eng-web.usfx.xml',
  );

  const db = openDb();

  const existingRefs = new Set<string>(
    (db.prepare('SELECT ref FROM verses').all() as { ref: string }[]).map((r) => r.ref),
  );
  console.log(`Loaded ${existingRefs.size} verse refs from DB.\n`);

  const insert = db.prepare(
    'INSERT OR REPLACE INTO verse_translations (ref, translation, text) VALUES (?, ?, ?)',
  );

  console.log('Ingesting ASV…');
  const asvCount = parseAsv(asvPath, existingRefs, insert);
  console.log(`  ASV: ${asvCount} verses inserted\n`);

  console.log('Ingesting WEB…');
  const webCount = parseWeb(webPath, existingRefs, insert);
  console.log(`  WEB: ${webCount} verses inserted\n`);

  const counts = db.prepare(
    "SELECT translation, COUNT(*) as count FROM verse_translations GROUP BY translation ORDER BY translation",
  ).all() as Array<{ translation: string; count: number }>;
  console.log('=== verse_translations counts ===');
  for (const row of counts) console.log(`  ${row.translation}: ${row.count}`);

  db.close();
  console.log('\nDone!');
}

main().catch((err) => { console.error(err); process.exit(1); });
