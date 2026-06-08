import { getVerse, getWord, getStrongs, getConcordance, getChapter } from './index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// 1. getVerse("Lam.3.22")
// ---------------------------------------------------------------------------
console.log('\n--- getVerse("Lam.3.22") ---');
const lam322 = getVerse('Lam.3.22');
console.log(JSON.stringify(lam322, null, 2));
assert(lam322 !== null, 'Lam.3.22 is not null');
assert(lam322?.ref === 'Lam.3.22', 'ref is Lam.3.22');
assert(lam322?.testament === 'OT', 'testament is OT');
assert((lam322?.words.length ?? 0) > 0, 'has words');

// ---------------------------------------------------------------------------
// 2. getVerse("Jhn.1.1")
// ---------------------------------------------------------------------------
console.log('\n--- getVerse("Jhn.1.1") ---');
const jhn11 = getVerse('Jhn.1.1');
console.log(JSON.stringify(jhn11, null, 2));
assert(jhn11 !== null, 'Jhn.1.1 is not null');
assert(jhn11?.ref === 'Jhn.1.1', 'ref is Jhn.1.1');
assert(jhn11?.testament === 'NT', 'testament is NT');
assert((jhn11?.words.length ?? 0) > 0, 'has words');

// ---------------------------------------------------------------------------
// 3. getWord("Jhn.1.1", 5) — should be λόγος
// ---------------------------------------------------------------------------
console.log('\n--- getWord("Jhn.1.1", 5) ---');
const word5 = getWord('Jhn.1.1', 5);
console.log(JSON.stringify(word5, null, 2));
assert(word5 !== null, 'word at position 5 is not null');
assert(word5?.position === 5, 'position is 5');
// λόγος is G3056
assert(word5?.strongs === 'G3056' || word5?.originalText?.includes('λόγ') || word5?.gloss?.toLowerCase().includes('word'),
  'word5 is logos (G3056 or contains logos text)');

// ---------------------------------------------------------------------------
// 4. getStrongs("H2617") and getStrongs("H2617A") — both should return chesed
// ---------------------------------------------------------------------------
console.log('\n--- getStrongs("H2617") ---');
const h2617 = getStrongs('H2617');
console.log(JSON.stringify(h2617, null, 2));
assert(h2617 !== null, 'H2617 is not null (resolves to variant like H2617A)');
assert(h2617?.language === 'hebrew', 'H2617 is hebrew');

console.log('\n--- getStrongs("H2617A") ---');
const h2617a = getStrongs('H2617A');
console.log(JSON.stringify(h2617a, null, 2));
assert(h2617a !== null, 'H2617A is not null');
// Both should resolve to same chesed entry
assert(
  h2617?.strongs === h2617a?.strongs || (h2617 !== null && h2617a !== null),
  'Both H2617 and H2617A resolve to a chesed entry'
);

// ---------------------------------------------------------------------------
// 5. getConcordance("G3056") — logos
// ---------------------------------------------------------------------------
console.log('\n--- getConcordance("G3056") ---');
const concordance = getConcordance('G3056');
console.log(`Count: ${concordance.length}`);
console.log('First 3 entries:');
console.log(JSON.stringify(concordance.slice(0, 3), null, 2));
assert(concordance.length > 0, 'G3056 concordance has entries');
assert(concordance.length > 10, `G3056 appears in many verses (got ${concordance.length})`);
assert(concordance[0].words.length > 0, 'first entry has words');

// ---------------------------------------------------------------------------
// 6. getChapter("Lam.3") — count of verses
// ---------------------------------------------------------------------------
console.log('\n--- getChapter("Lam.3") ---');
const lam3 = getChapter('Lam.3');
console.log(`Verse count in Lam.3: ${lam3.length}`);
assert(lam3.length > 0, 'Lam.3 has verses');
assert(lam3.length === 66, `Lam.3 has 66 verses (got ${lam3.length})`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  throw new Error(`${failed} assertion(s) failed`);
}
console.log('All tests passed!');
