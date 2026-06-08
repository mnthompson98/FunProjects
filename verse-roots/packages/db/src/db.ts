import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.VERSE_ROOTS_DB
  ? resolve(process.env.VERSE_ROOTS_DB)
  : resolve(__dirname, '../../../data/db/verse-roots.db');

export const db = new Database(dbPath, { readonly: true });
