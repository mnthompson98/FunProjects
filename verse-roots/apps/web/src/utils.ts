/**
 * Human-readable names for OSIS book codes.
 * Inverse of the BOOK_MAP in normalizeRef.ts.
 */
const OSIS_TO_NAME: Record<string, string> = {
  Gen: 'Genesis',
  Exo: 'Exodus',
  Lev: 'Leviticus',
  Num: 'Numbers',
  Deu: 'Deuteronomy',
  Jos: 'Joshua',
  Jdg: 'Judges',
  Rut: 'Ruth',
  '1Sa': '1 Samuel',
  '2Sa': '2 Samuel',
  '1Ki': '1 Kings',
  '2Ki': '2 Kings',
  '1Ch': '1 Chronicles',
  '2Ch': '2 Chronicles',
  Ezr: 'Ezra',
  Neh: 'Nehemiah',
  Est: 'Esther',
  Job: 'Job',
  Psa: 'Psalm',
  Pro: 'Proverbs',
  Ecc: 'Ecclesiastes',
  Sng: 'Song of Solomon',
  Isa: 'Isaiah',
  Jer: 'Jeremiah',
  Lam: 'Lamentations',
  Ezk: 'Ezekiel',
  Dan: 'Daniel',
  Hos: 'Hosea',
  Jol: 'Joel',
  Amo: 'Amos',
  Oba: 'Obadiah',
  Jon: 'Jonah',
  Mic: 'Micah',
  Nam: 'Nahum',
  Hab: 'Habakkuk',
  Zep: 'Zephaniah',
  Hag: 'Haggai',
  Zec: 'Zechariah',
  Mal: 'Malachi',
  Mat: 'Matthew',
  Mrk: 'Mark',
  Luk: 'Luke',
  Jhn: 'John',
  Act: 'Acts',
  Rom: 'Romans',
  '1Co': '1 Corinthians',
  '2Co': '2 Corinthians',
  Gal: 'Galatians',
  Eph: 'Ephesians',
  Php: 'Philippians',
  Col: 'Colossians',
  '1Th': '1 Thessalonians',
  '2Th': '2 Thessalonians',
  '1Ti': '1 Timothy',
  '2Ti': '2 Timothy',
  Tit: 'Titus',
  Phm: 'Philemon',
  Heb: 'Hebrews',
  Jas: 'James',
  '1Pe': '1 Peter',
  '2Pe': '2 Peter',
  '1Jn': '1 John',
  '2Jn': '2 John',
  '3Jn': '3 John',
  Jud: 'Jude',
  Rev: 'Revelation',
};

/**
 * Converts an OSIS reference to human-readable form.
 * "Jhn.1.1" → "John 1:1"
 * "Lam.3.22" → "Lamentations 3:22"
 * "1Sa.17.4" → "1 Samuel 17:4"
 * "Psa.119.105" → "Psalm 119:105"
 */
export function formatRef(ref: string): string {
  const parts = ref.split('.');
  if (parts.length !== 3) return ref;
  const [book, chapter, verse] = parts;
  const bookName = OSIS_TO_NAME[book] ?? book;
  return `${bookName} ${chapter}:${verse}`;
}

/**
 * Sanitize HTML from STEPBible fullDef — allow only safe inline tags.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1');
}
