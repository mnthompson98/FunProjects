/**
 * parse-stepbible.ts
 *
 * Downloads and parses STEPBible Translators Amalgamated files (TAHOT + TAGNT)
 * and the brief lexicons (TBESH + TBESG), inserting into SQLite.
 *
 * Column layout (determined from actual files):
 *
 * TAHOT (Hebrew OT) - tab-separated:
 *   Col 0: Ref e.g. "Isa.1.1#01=L"
 *   Col 1: Hebrew text
 *   Col 2: Transliteration
 *   Col 3: English translation
 *   Col 4: dStrongs e.g. "{H2377}" or "H9002/{H3389}"
 *   Col 5: Grammar/morphology
 *   ... (more cols, not needed)
 *
 * TAGNT (Greek NT) - tab-separated:
 *   Col 0: Ref e.g. "Mat.1.1#01=NKO"
 *   Col 1: Greek word + transliteration in parens
 *   Col 2: English translation
 *   Col 3: dStrongs = Grammar  e.g. "G0976=N-NSF"
 *   Col 4: Dictionary form = Gloss  e.g. "βίβλος=book"
 *   ... (more cols, not needed)
 *
 * Lexicon (TBESH/TBESG) - tab-separated:
 *   Col 0: eStrong# e.g. "H0001"
 *   Col 1: dStrong e.g. "H0001G ="
 *   Col 2: uStrong
 *   Col 3: Hebrew/Greek form
 *   Col 4: Transliteration
 *   Col 5: Morph
 *   Col 6: Gloss
 *   Col 7: Meaning (HTML)
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(__dirname, '../../raw');

// Map of TAHOT file sections we need
const TAHOT_FILES = [
  {
    name: 'TAHOT Gen-Deu',
    url: 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Gen-Deu%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
    localName: 'TAHOT-Gen-Deu.txt',
  },
  {
    name: 'TAHOT Jos-Est',
    url: 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Jos-Est%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
    localName: 'TAHOT-Jos-Est.txt',
  },
  {
    name: 'TAHOT Job-Sng',
    url: 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Job-Sng%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
    localName: 'TAHOT-Job-Sng.txt',
  },
  {
    name: 'TAHOT Isa-Mal',
    url: 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Isa-Mal%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
    localName: 'TAHOT-Isa-Mal.txt',
  },
];

const TAGNT_FILES = [
  {
    name: 'TAGNT Mat-Jhn',
    url: 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt',
    localName: 'TAGNT-Mat-Jhn.txt',
  },
  {
    name: 'TAGNT Act-Rev',
    url: 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt',
    localName: 'TAGNT-Act-Rev.txt',
  },
];

const LEXICON_FILES = [
  {
    name: 'TBESH',
    url: 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/TBESH%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Hebrew%20-%20STEPBible.org%20CC%20BY.txt',
    localName: 'TBESH.txt',
    language: 'hebrew',
  },
  {
    name: 'TBESG',
    url: 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt',
    localName: 'TBESG.txt',
    language: 'greek',
  },
];

async function downloadFile(url: string, dest: string): Promise<void> {
  if (fs.existsSync(dest)) {
    console.log(`  [cache] ${path.basename(dest)}`);
    return;
  }
  console.log(`  [download] ${path.basename(dest)}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buffer));
  console.log(`  [done] ${path.basename(dest)} (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
}

/** Parse a Strong's from the dStrongs field (e.g. "{H2617A}" -> "H2617A", "H9002/{H3389}" -> "H3389") */
function extractPrimaryStrongs(dStrongs: string): string | null {
  if (!dStrongs || dStrongs.trim() === '') return null;
  // Find first {Hxxxx} or {Gxxxx} (the root word is in curly braces)
  const curlyMatch = dStrongs.match(/\{([HG]\d+[A-Z]?)\}/);
  if (curlyMatch) return curlyMatch[1];
  // Fallback: just look for H/G number
  const plainMatch = dStrongs.match(/([HG]\d+[A-Z]?)/);
  if (plainMatch) return plainMatch[1];
  return null;
}

/**
 * Parse ref like "Lam.3.22#01=L" -> { verseRef: "Lam.3.22", position: 1 }
 */
function parseRef(refField: string): { verseRef: string; position: number } | null {
  const m = refField.match(/^([A-Za-z0-9]+\.\d+\.\d+)#(\d+)/);
  if (!m) return null;
  return { verseRef: m[1], position: parseInt(m[2], 10) };
}

/** Book -> testament mapping */
const OT_BOOKS = new Set([
  'Gen','Exo','Lev','Num','Deu','Jos','Jdg','Rut','1Sa','2Sa','1Ki','2Ki',
  '1Ch','2Ch','Ezr','Neh','Est','Job','Psa','Pro','Ecc','Sng','Isa','Jer',
  'Lam','Ezk','Dan','Hos','Joe','Amo','Oba','Jon','Mic','Nah','Hab','Zep',
  'Hag','Zec','Mal',
]);

function getTestament(book: string): string {
  return OT_BOOKS.has(book) ? 'OT' : 'NT';
}

async function processTahotFile(
  db: Database.Database,
  filePath: string,
  insertVerse: Database.Statement,
  insertWord: Database.Statement,
): Promise<void> {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let lineCount = 0;
  let wordCount = 0;
  let inDataSection = false;

  const insertMany = db.transaction((rows: any[]) => {
    for (const r of rows) {
      try {
        insertVerse.run(r.verseRef, r.book, r.chapter, r.verse, r.testament);
      } catch {
        // verse already inserted
      }
      insertWord.run(r.verseRef, r.position, r.hebrew, r.translit, r.strongs, r.morph, r.gloss);
      wordCount++;
    }
  });

  let batch: any[] = [];

  for await (const line of rl) {
    lineCount++;

    // Data lines look like: Isa.1.1#01=L\tHebrew\tTranslit\tTranslation\tdStrongs\tGrammar...
    // We detect data section when we see "Eng (Heb) Ref & Type" header
    if (line.startsWith('Eng (Heb) Ref & Type')) {
      inDataSection = true;
      continue;
    }
    if (!inDataSection) continue;
    if (line.trim() === '' || line.startsWith('#') || line.startsWith('$')) continue;

    const cols = line.split('\t');
    if (cols.length < 5) continue;

    const refField = cols[0].trim();
    const parsed = parseRef(refField);
    if (!parsed) continue;

    const { verseRef, position } = parsed;
    const parts = verseRef.split('.');
    if (parts.length < 3) continue;
    const book = parts[0];
    const chapter = parseInt(parts[1], 10);
    const verse = parseInt(parts[2], 10);
    const testament = getTestament(book);

    const hebrew = cols[1]?.trim() ?? '';
    const translit = cols[2]?.trim() ?? null;
    const gloss = cols[3]?.trim() ?? null;
    const dStrongs = cols[4]?.trim() ?? '';
    const morph = cols[5]?.trim() ?? null;
    const strongs = extractPrimaryStrongs(dStrongs);

    batch.push({ verseRef, book, chapter, verse, testament, position, hebrew, translit, strongs, morph, gloss });

    if (batch.length >= 1000) {
      insertMany(batch);
      batch = [];
    }
  }

  if (batch.length > 0) insertMany(batch);
  console.log(`  Processed ${lineCount} lines, ${wordCount} words from ${path.basename(filePath)}`);
}

async function processTagntFile(
  db: Database.Database,
  filePath: string,
  insertVerse: Database.Statement,
  insertWord: Database.Statement,
): Promise<void> {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let lineCount = 0;
  let wordCount = 0;
  let inDataSection = false;

  const insertMany = db.transaction((rows: any[]) => {
    for (const r of rows) {
      try {
        insertVerse.run(r.verseRef, r.book, r.chapter, r.verse, r.testament);
      } catch {
        // already inserted
      }
      insertWord.run(r.verseRef, r.position, r.greek, r.translit, r.strongs, r.morph, r.gloss);
      wordCount++;
    }
  });

  let batch: any[] = [];

  for await (const line of rl) {
    lineCount++;

    if (line.startsWith('Word & Type\t')) {
      inDataSection = true;
      continue;
    }
    if (!inDataSection) continue;
    if (line.trim() === '' || line.startsWith('#') || line.startsWith('$')) continue;

    const cols = line.split('\t');
    if (cols.length < 4) continue;

    const refField = cols[0].trim();
    const parsed = parseRef(refField);
    if (!parsed) continue;

    const { verseRef, position } = parsed;
    // NT uses Jhn, not John; Act not Acts, etc. - keep as-is (OSIS-like)
    const parts = verseRef.split('.');
    if (parts.length < 3) continue;
    const book = parts[0];
    const chapter = parseInt(parts[1], 10);
    const verse = parseInt(parts[2], 10);
    const testament = 'NT';

    // Col 1: "λόγος, (logos)" - extract Greek and transliteration
    const wordField = cols[1]?.trim() ?? '';
    const wordMatch = wordField.match(/^(.+?)\s+\((.+?)\)$/);
    const greek = wordMatch ? wordMatch[1].trim() : wordField;
    const translit = wordMatch ? wordMatch[2].trim() : null;

    // Col 2: English translation
    const gloss = cols[2]?.trim() ?? null;

    // Col 3: "G0976=N-NSF"
    const dStrongsGrammar = cols[3]?.trim() ?? '';
    const sgMatch = dStrongsGrammar.match(/^([HG]\d+[A-Z]?)=(.+)$/);
    const strongs = sgMatch ? sgMatch[1] : extractPrimaryStrongs(dStrongsGrammar);
    const morph = sgMatch ? sgMatch[2] : null;

    batch.push({ verseRef, book, chapter, verse, testament, position, greek, translit, strongs, morph, gloss });

    if (batch.length >= 1000) {
      insertMany(batch);
      batch = [];
    }
  }

  if (batch.length > 0) insertMany(batch);
  console.log(`  Processed ${lineCount} lines, ${wordCount} words from ${path.basename(filePath)}`);
}

async function processLexiconFile(
  db: Database.Database,
  filePath: string,
  language: string,
  insertEntry: Database.Statement,
): Promise<void> {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let count = 0;
  let inDataSection = false;

  const insertBatch = db.transaction((rows: any[]) => {
    for (const r of rows) {
      insertEntry.run(r.strongs, language, r.lemma, r.translit, r.gloss, r.meaning);
      count++;
    }
  });

  let batch: any[] = [];

  for await (const line of rl) {
    // Look for the data header line
    if (line.startsWith('eStrong#\t')) {
      inDataSection = true;
      continue;
    }
    if (!inDataSection) continue;
    if (line.trim() === '' || line.startsWith('#') || line.startsWith('$')) continue;

    const cols = line.split('\t');
    if (cols.length < 7) continue;

    const eStrong = cols[0]?.trim();
    if (!eStrong || !eStrong.match(/^[HG]\d+/)) continue;

    // Col 1: dStrong e.g. "H0001G =" -- extract the dStrong
    const dStrongField = cols[1]?.trim() ?? '';
    const dStrongMatch = dStrongField.match(/^([HG]\d+[A-Z]?)/);
    const strongs = dStrongMatch ? dStrongMatch[1] : eStrong;

    const lemma = cols[3]?.trim() ?? null;
    const translit = cols[4]?.trim() ?? null;
    const gloss = cols[6]?.trim() ?? null;
    const meaning = cols[7]?.trim() ?? null;

    batch.push({ strongs, lemma, translit, gloss, meaning });

    if (batch.length >= 500) {
      insertBatch(batch);
      batch = [];
    }
  }

  if (batch.length > 0) insertBatch(batch);
  console.log(`  Processed ${count} entries from ${path.basename(filePath)}`);
}

export async function parseStepbible(db: Database.Database): Promise<void> {
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const insertVerse = db.prepare(`
    INSERT OR IGNORE INTO verses (ref, book, chapter, verse, testament)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertWord = db.prepare(`
    INSERT OR REPLACE INTO original_words (verse_ref, position, original_text, transliteration, strongs, morphology, gloss)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEntry = db.prepare(`
    INSERT OR REPLACE INTO strongs_entries (strongs, language, lemma, transliteration, short_def, full_def)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Download and parse lexicons first
  console.log('\n--- Lexicons ---');
  for (const lex of LEXICON_FILES) {
    const dest = path.join(RAW_DIR, lex.localName);
    await downloadFile(lex.url, dest);
    console.log(`  Parsing ${lex.name}...`);
    await processLexiconFile(db, dest, lex.language, insertEntry);
  }

  // Download and parse TAHOT
  console.log('\n--- Hebrew OT (TAHOT) ---');
  for (const f of TAHOT_FILES) {
    const dest = path.join(RAW_DIR, f.localName);
    await downloadFile(f.url, dest);
    console.log(`  Parsing ${f.name}...`);
    await processTahotFile(db, dest, insertVerse, insertWord);
  }

  // Download and parse TAGNT
  console.log('\n--- Greek NT (TAGNT) ---');
  for (const f of TAGNT_FILES) {
    const dest = path.join(RAW_DIR, f.localName);
    await downloadFile(f.url, dest);
    console.log(`  Parsing ${f.name}...`);
    await processTagntFile(db, dest, insertVerse, insertWord);
  }

  // Build concordance cache
  console.log('\n--- Building concordance cache ---');
  db.exec(`
    INSERT OR IGNORE INTO concordance_cache (strongs, verse_ref)
    SELECT DISTINCT strongs, verse_ref FROM original_words WHERE strongs IS NOT NULL
  `);
  const ccCount = (db.prepare('SELECT COUNT(*) as n FROM concordance_cache').get() as any).n;
  console.log(`  Concordance cache: ${ccCount} entries`);
}
