import { db } from './db.js';
const rows = (db.prepare("SELECT strongs, short_def FROM strongs_entries WHERE strongs LIKE 'H2617%'") as any).all();
console.log(rows);
