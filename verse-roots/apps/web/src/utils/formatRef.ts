/**
 * Convert an OSIS-style book code to a display name.
 * e.g. "Jhn.1.1" -> "John 1:1"
 */

const OSIS_TO_DISPLAY: Record<string, string> = {
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
 * Format an OSIS ref like "Jhn.1.1" to a display string like "John 1:1".
 */
export function formatRef(osisRef: string): string {
  const parts = osisRef.split('.');
  if (parts.length !== 3) return osisRef;

  const [bookCode, chapter, verse] = parts;
  const bookName = OSIS_TO_DISPLAY[bookCode] ?? bookCode;
  return `${bookName} ${chapter}:${verse}`;
}

/**
 * Format a passage span like "Jhn.3.16-17" to "John 3:16-17", or a single
 * verse "Jhn.3.16" to "John 3:16". Ranges are within one chapter.
 */
export function formatPassageRef(passageRef: string): string {
  const parts = passageRef.split('.');
  if (parts.length !== 3) return passageRef;

  const [bookCode, chapter, verses] = parts;
  const bookName = OSIS_TO_DISPLAY[bookCode] ?? bookCode;
  const [start, end] = verses.split('-');
  if (end && end !== start) return `${bookName} ${chapter}:${start}-${end}`;
  return `${bookName} ${chapter}:${start}`;
}
