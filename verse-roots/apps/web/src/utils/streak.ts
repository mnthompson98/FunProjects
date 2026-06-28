// Memory practice streak (consecutive days with at least one practice).

const KEY = 'vr-memory-streak';

export interface Streak {
  lastDate: string; // YYYY-MM-DD
  days: number;
}

function dayStr(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function getStreak(): Streak {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Streak;
  } catch { /* ignore */ }
  return { lastDate: '', days: 0 };
}

/** Record a practice today; returns the updated streak. */
export function bumpStreak(): Streak {
  const cur = getStreak();
  const today = dayStr(Date.now());
  if (cur.lastDate === today) return cur; // already counted today
  const yesterday = dayStr(Date.now() - 86_400_000);
  const days = cur.lastDate === yesterday ? cur.days + 1 : 1;
  const next: Streak = { lastDate: today, days };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

/** Whether the current streak is still active (practiced today or yesterday). */
export function isStreakActive(s: Streak): boolean {
  if (!s.lastDate) return false;
  const today = dayStr(Date.now());
  const yesterday = dayStr(Date.now() - 86_400_000);
  return s.lastDate === today || s.lastDate === yesterday;
}
