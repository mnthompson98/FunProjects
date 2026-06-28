// Recently viewed verses/chapters + reference search history (localStorage).

const RECENT_KEY = 'vr-recent-verses';
const HISTORY_KEY = 'vr-search-history';

export interface RecentVerse {
  ref: string;      // OSIS, e.g. "Jhn.3.16" or "Jhn.3"
  display: string;  // "John 3:16"
  ts: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getRecentVerses(): RecentVerse[] {
  return read<RecentVerse[]>(RECENT_KEY, []);
}

export function addRecentVerse(ref: string, display: string): void {
  const list = getRecentVerses().filter((r) => r.ref !== ref);
  list.unshift({ ref, display, ts: Date.now() });
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8))); } catch { /* ignore */ }
}

export function getSearchHistory(): string[] {
  return read<string[]>(HISTORY_KEY, []);
}

export function addSearchHistory(q: string): void {
  const trimmed = q.trim();
  if (!trimmed) return;
  const list = getSearchHistory().filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
  list.unshift(trimmed);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 10))); } catch { /* ignore */ }
}
