/**
 * parse-oshb.ts
 *
 * Stub for future OSHB XML ingestion.
 * The Open Scriptures Hebrew Bible provides morphological data in XML format.
 * For now, the STEPBible TAHOT data covers our needs.
 */

import Database from 'better-sqlite3';

export async function parseOshb(db: Database.Database): Promise<void> {
  console.log('OSHB parser: stub — skipping (STEPBible data used instead)');
}
