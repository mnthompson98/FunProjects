import { supabase, isSupabaseConfigured } from './client.js';

export interface SyncableStudy {
  id: string;
  verseRef: string;
  title: string;
  focusStrongs: string | null;
  focusWord: string | null;
  sections: unknown[];
  tags: string[];
  createdAt: number; // ms timestamp
  updatedAt: number; // ms timestamp
}

export interface StudyLocalDb {
  getAll(): Promise<SyncableStudy[]>;
  save(study: SyncableStudy): Promise<void>;
}

/** Convert local study (ms timestamps) to Supabase row format. */
function toRow(study: SyncableStudy, userId: string) {
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

/** Convert Supabase row back to local study format. */
function fromRow(row: Record<string, unknown>): SyncableStudy {
  return {
    id: row.id as string,
    verseRef: row.verse_ref as string,
    title: row.title as string,
    focusStrongs: (row.focus_strongs as string | null) ?? null,
    focusWord: (row.focus_word as string | null) ?? null,
    sections: (row.sections as unknown[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
  };
}

/** Push a single study to Supabase (upsert by id). */
export async function pushStudy(study: SyncableStudy, userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('studies').upsert(toRow(study, userId));
}

/**
 * Pull all studies from Supabase for this user, merge with local IndexedDB.
 * Strategy: last-write-wins by updatedAt timestamp.
 */
export async function pullStudies(
  userId: string,
  localDb: StudyLocalDb,
): Promise<SyncableStudy[]> {
  if (!isSupabaseConfigured) return localDb.getAll();

  // 1. Fetch remote (non-deleted)
  const { data: remoteRows, error } = await supabase
    .from('studies')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (error) {
    console.warn('[sync] pullStudies error:', error.message);
    return localDb.getAll();
  }

  const remoteStudies = (remoteRows ?? []).map(fromRow);
  const localStudies = await localDb.getAll();

  // Build maps by id
  const localMap = new Map<string, SyncableStudy>(localStudies.map((s) => [s.id, s]));
  const remoteMap = new Map<string, SyncableStudy>(remoteStudies.map((s) => [s.id, s]));

  const merged: SyncableStudy[] = [];
  const toSaveLocally: SyncableStudy[] = [];
  const toPushRemotely: SyncableStudy[] = [];

  // 3. For each remote study
  for (const remote of remoteStudies) {
    const local = localMap.get(remote.id);
    if (!local) {
      // Only in remote — add to local
      toSaveLocally.push(remote);
      merged.push(remote);
    } else if (remote.updatedAt > local.updatedAt) {
      // Remote is newer — overwrite local
      toSaveLocally.push(remote);
      merged.push(remote);
    } else {
      // Local is same or newer — keep local
      merged.push(local);
    }
  }

  // 5. Studies only in local — push to remote
  for (const local of localStudies) {
    if (!remoteMap.has(local.id)) {
      toPushRemotely.push(local);
      merged.push(local);
    }
  }

  // Persist changes
  await Promise.all(toSaveLocally.map((s) => localDb.save(s)));
  await Promise.all(toPushRemotely.map((s) => pushStudy(s, userId)));

  return merged;
}

/**
 * Full sync: push all local studies, pull remote, merge.
 * Returns the merged study list.
 */
export async function syncStudies(
  userId: string,
  localDb: StudyLocalDb,
): Promise<SyncableStudy[]> {
  if (!isSupabaseConfigured) return localDb.getAll();

  // Push all local studies first
  const localStudies = await localDb.getAll();
  await Promise.all(localStudies.map((s) => pushStudy(s, userId)));

  // Then pull & merge
  return pullStudies(userId, localDb);
}

/** Push a deleted study (sets deleted_at for soft delete sync). */
export async function deleteStudyRemote(studyId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase
    .from('studies')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', studyId)
    .eq('user_id', userId);
}
