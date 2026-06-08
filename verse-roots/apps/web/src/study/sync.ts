import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getAllStudies, saveStudy } from './db';
import type { Study } from './types';

// ---------------------------------------------------------------------------
// Row conversion helpers
// ---------------------------------------------------------------------------

function toRow(study: Study, userId: string) {
  return {
    id: study.id,
    user_id: userId,
    verse_ref: study.verseRef,
    title: study.title,
    focus_strongs: study.focusStrongs,
    focus_word: study.focusWord,
    sections: study.sections,
    tags: study.tags,
    created_at: new Date(study.createdAt).toISOString(),
    updated_at: new Date(study.updatedAt).toISOString(),
    deleted_at: null,
  };
}

function fromRow(row: Record<string, unknown>): Study {
  return {
    id: row.id as string,
    verseRef: row.verse_ref as string,
    title: row.title as string,
    focusStrongs: (row.focus_strongs as string | null) ?? null,
    focusWord: (row.focus_word as string | null) ?? null,
    sections: row.sections as Study['sections'],
    tags: (row.tags as string[]) ?? [],
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
  };
}

// ---------------------------------------------------------------------------
// Per-study push (debounced by the caller)
// ---------------------------------------------------------------------------

async function pushStudy(study: Study, userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('studies').upsert(toRow(study, userId));
}

// ---------------------------------------------------------------------------
// Debounce state for maybeSyncStudy
// ---------------------------------------------------------------------------

const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Called after every local save when the user is logged in and has an active
 * subscription. Debounced 5 s per study so we don't hammer Supabase on every
 * keystroke.
 */
export function maybeSyncStudy(
  study: Study,
  userId: string,
  canSync: boolean,
): void {
  if (!canSync || !isSupabaseConfigured) return;

  const existing = syncTimers.get(study.id);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    syncTimers.delete(study.id);
    pushStudy(study, userId).catch((err) =>
      console.warn('[sync] pushStudy error:', err),
    );
  }, 5000);

  syncTimers.set(study.id, timer);
}

// ---------------------------------------------------------------------------
// Full initial sync on login
// ---------------------------------------------------------------------------

/**
 * Called on app load when the user is logged in and has an active
 * subscription. Merges local IndexedDB with Supabase (last-write-wins).
 * Returns the merged study list.
 */
export async function initialSync(userId: string): Promise<Study[]> {
  if (!isSupabaseConfigured) return getAllStudies();

  // Fetch remote (non-deleted)
  const { data: remoteRows, error } = await supabase
    .from('studies')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (error) {
    console.warn('[sync] initialSync fetch error:', error.message);
    return getAllStudies();
  }

  const remoteStudies = (remoteRows ?? []).map(
    (r) => fromRow(r as Record<string, unknown>),
  );
  const localStudies = await getAllStudies();

  const localMap = new Map<string, Study>(localStudies.map((s) => [s.id, s]));
  const remoteMap = new Map<string, Study>(remoteStudies.map((s) => [s.id, s]));

  const merged: Study[] = [];
  const toSaveLocally: Study[] = [];
  const toPushRemotely: Study[] = [];

  for (const remote of remoteStudies) {
    const local = localMap.get(remote.id);
    if (!local) {
      toSaveLocally.push(remote);
      merged.push(remote);
    } else if (remote.updatedAt > local.updatedAt) {
      toSaveLocally.push(remote);
      merged.push(remote);
    } else {
      merged.push(local);
    }
  }

  for (const local of localStudies) {
    if (!remoteMap.has(local.id)) {
      toPushRemotely.push(local);
      merged.push(local);
    }
  }

  await Promise.all(toSaveLocally.map((s) => saveStudy(s)));
  await Promise.all(toPushRemotely.map((s) => pushStudy(s, userId)));

  return merged;
}

/**
 * Push a deleted study to Supabase (soft delete).
 */
export async function deleteStudyRemote(studyId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase
    .from('studies')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', studyId)
    .eq('user_id', userId);
}
