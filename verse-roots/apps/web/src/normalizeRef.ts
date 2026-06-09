/**
 * Normalize a user-typed Bible reference to the format used in the DB: "Bbb.C.V"
 * e.g. "John 1:1" -> "Jhn.1.1", "Lam 3:22" -> "Lam.3.22"
 */

const BOOK_MAP: Record<string, string> = {
  // Old Testament
  genesis: 'Gen', gen: 'Gen',
  exodus: 'Exo', exo: 'Exo', ex: 'Exo',
  leviticus: 'Lev', lev: 'Lev',
  numbers: 'Num', num: 'Num',
  deuteronomy: 'Deu', deu: 'Deu', deut: 'Deu', dt: 'Deu',
  joshua: 'Jos', jos: 'Jos', josh: 'Jos',
  judges: 'Jdg', jdg: 'Jdg', judg: 'Jdg',
  ruth: 'Rut', rut: 'Rut',
  '1samuel': '1Sa', '1sa': '1Sa', '1sam': '1Sa', 'isamuel': '1Sa',
  '2samuel': '2Sa', '2sa': '2Sa', '2sam': '2Sa', 'iisamuel': '2Sa',
  '1kings': '1Ki', '1ki': '1Ki', '1kgs': '1Ki', 'ikings': '1Ki',
  '2kings': '2Ki', '2ki': '2Ki', '2kgs': '2Ki', 'iikings': '2Ki',
  '1chronicles': '1Ch', '1ch': '1Ch', '1chr': '1Ch', 'ichronicles': '1Ch',
  '2chronicles': '2Ch', '2ch': '2Ch', '2chr': '2Ch', 'iichronicles': '2Ch',
  ezra: 'Ezr', ezr: 'Ezr',
  nehemiah: 'Neh', neh: 'Neh',
  esther: 'Est', est: 'Est', esth: 'Est',
  job: 'Job',
  psalms: 'Psa', psalm: 'Psa', psa: 'Psa', ps: 'Psa', pss: 'Psa',
  proverbs: 'Pro', pro: 'Pro', prov: 'Pro',
  ecclesiastes: 'Ecc', ecc: 'Ecc', eccl: 'Ecc', eccles: 'Ecc',
  'songofsolomon': 'Sng', 'songofsongs': 'Sng', sng: 'Sng', sos: 'Sng', song: 'Sng', ss: 'Sng',
  isaiah: 'Isa', isa: 'Isa',
  jeremiah: 'Jer', jer: 'Jer',
  lamentations: 'Lam', lam: 'Lam',
  ezekiel: 'Ezk', eze: 'Ezk', ezk: 'Ezk', ezek: 'Ezk',
  daniel: 'Dan', dan: 'Dan',
  hosea: 'Hos', hos: 'Hos',
  joel: 'Jol', joe: 'Jol', jol: 'Jol', jl: 'Jol',
  amos: 'Amo', amo: 'Amo',
  obadiah: 'Oba', oba: 'Oba', ob: 'Oba',
  jonah: 'Jon', jon: 'Jon',
  micah: 'Mic', mic: 'Mic',
  nahum: 'Nam', nah: 'Nam', nam: 'Nam',
  habakkuk: 'Hab', hab: 'Hab',
  zephaniah: 'Zep', zep: 'Zep', zeph: 'Zep',
  haggai: 'Hag', hag: 'Hag',
  zechariah: 'Zec', zec: 'Zec', zech: 'Zec',
  malachi: 'Mal', mal: 'Mal',
  // New Testament
  matthew: 'Mat', mat: 'Mat', matt: 'Mat', mt: 'Mat',
  mark: 'Mrk', mrk: 'Mrk', mk: 'Mrk', mar: 'Mrk',
  luke: 'Luk', luk: 'Luk', lk: 'Luk',
  john: 'Jhn', jhn: 'Jhn', jn: 'Jhn',
  acts: 'Act', act: 'Act',
  romans: 'Rom', rom: 'Rom',
  '1corinthians': '1Co', '1co': '1Co', '1cor': '1Co', 'icorinthians': '1Co',
  '2corinthians': '2Co', '2co': '2Co', '2cor': '2Co', 'iicorinthians': '2Co',
  galatians: 'Gal', gal: 'Gal',
  ephesians: 'Eph', eph: 'Eph',
  philippians: 'Php', php: 'Php', phil: 'Php',
  colossians: 'Col', col: 'Col',
  '1thessalonians': '1Th', '1th': '1Th', '1thess': '1Th', 'ithessalonians': '1Th',
  '2thessalonians': '2Th', '2th': '2Th', '2thess': '2Th', 'iithessalonians': '2Th',
  '1timothy': '1Ti', '1ti': '1Ti', '1tim': '1Ti', 'itimothy': '1Ti',
  '2timothy': '2Ti', '2ti': '2Ti', '2tim': '2Ti', 'iitimothy': '2Ti',
  titus: 'Tit', tit: 'Tit',
  philemon: 'Phm', phm: 'Phm', phlm: 'Phm',
  hebrews: 'Heb', heb: 'Heb',
  james: 'Jas', jas: 'Jas', jm: 'Jas',
  '1peter': '1Pe', '1pe': '1Pe', '1pet': '1Pe', 'ipeter': '1Pe',
  '2peter': '2Pe', '2pe': '2Pe', '2pet': '2Pe', 'iipeter': '2Pe',
  '1john': '1Jn', '1jn': '1Jn', '1jo': '1Jn', 'ijohn': '1Jn',
  '2john': '2Jn', '2jn': '2Jn', '2jo': '2Jn', 'iijohn': '2Jn',
  '3john': '3Jn', '3jn': '3Jn', '3jo': '3Jn', 'iiijohn': '3Jn',
  jude: 'Jud', jud: 'Jud',
  revelation: 'Rev', rev: 'Rev', revelations: 'Rev',
};

export function normalizeRef(input: string): string {
  // Strip extra whitespace
  const trimmed = input.trim();

  // Match patterns like "Book Chapter:Verse" or "Book C:V" or already normalized "Bbb.C.V"
  // Handle numbered books: "1 Kings 2:3" or "1Kings 2:3"
  const match = trimmed.match(
    /^(\d\s*[A-Za-z]+(?:\s+[A-Za-z]+)*|[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+)[:\.](\d+)$/
  );

  if (!match) {
    // Maybe it's already in "Bbb.C.V" format
    if (/^[A-Z][A-Za-z]{2}\.\d+\.\d+$/.test(trimmed)) {
      return trimmed;
    }
    return trimmed; // Return as-is and let the API 404
  }

  const [, bookRaw, chapter, verse] = match;

  // Normalize book: lowercase, remove spaces
  const bookKey = bookRaw.toLowerCase().replace(/\s+/g, '');
  const bookCode = BOOK_MAP[bookKey];

  if (!bookCode) {
    // Try partial match — use first 3 chars capitalized
    return trimmed;
  }

  return `${bookCode}.${chapter}.${verse}`;
}
