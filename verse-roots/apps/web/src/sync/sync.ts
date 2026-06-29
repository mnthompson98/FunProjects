// Cloud sync of the local library (studies, groups, memory items) to Supabase.
// Last-write-wins by a client `updated_at` (ms); deletes use tombstones.

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  getAllStudies, saveStudy, deleteStudy,
  getAllGroups, saveGroup, deleteGroup,
  getAllMemoryItems, saveMemoryItem, deleteMemoryItem,
  setSyncChangeListener,
  type SyncChange, type SyncKind,
} from '../study/db';
import type { Study, StudyGroup } from '../study/types';
import type { MemoryItem } from '../study/memory';

interface RemoteRow {
  kind: SyncKind;
  item_id: string;
  data: unknown;
  updated_at: number;
  deleted: boolean;
}

let userId: string | null = null;
let applying = false; // true while writing remote→local, to avoid echo pushes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tsOf(kind: SyncKind, data: any): number {
  if (kind === 'study') return data?.updatedAt ?? data?.createdAt ?? 0;
  if (kind === 'group') return data?.createdAt ?? 0;
  return Math.max(data?.addedAt ?? 0, data?.lastPracticed ?? 0, data?.memorizedAt ?? 0);
}

async function applyUpsert(kind: SyncKind, data: unknown): Promise<void> {
  if (kind === 'study') await saveStudy(data as Study);
  else if (kind === 'group') await saveGroup(data as StudyGroup);
  else await saveMemoryItem(data as MemoryItem);
}

async function applyDelete(kind: SyncKind, id: string): Promise<void> {
  if (kind === 'study') await deleteStudy(id);
  else if (kind === 'group') await deleteGroup(id);
  else await deleteMemoryItem(id);
}

/** Push one local change to the cloud (best effort). */
async function pushChange(change: SyncChange): Promise<void> {
  if (!userId || !isSupabaseConfigured) return;
  const row =
    change.op === 'delete'
      ? { user_id: userId, kind: change.kind, item_id: change.id, data: {}, updated_at: Date.now(), deleted: true }
      : { user_id: userId, kind: change.kind, item_id: change.id, data: change.data, updated_at: tsOf(change.kind, change.data), deleted: false };
  const { error } = await supabase.from('sync_items').upsert(row, { onConflict: 'user_id,kind,item_id' });
  if (error) console.warn('[sync] push failed:', error.message);
}

// Register once; pushes whenever a signed-in user mutates local data.
setSyncChangeListener((change) => {
  if (!userId || applying || !isSupabaseConfigured) return;
  void pushChange(change);
});

/** Pull the cloud library, merge with local (last-write-wins), and push local changes up. */
export async function fullSync(): Promise<void> {
  if (!userId || !isSupabaseConfigured) return;

  const { data: rows, error } = await supabase
    .from('sync_items')
    .select('kind,item_id,data,updated_at,deleted');
  if (error) { console.warn('[sync] pull failed:', error.message); return; }

  const remoteMap = new Map<string, RemoteRow>();
  (rows as RemoteRow[] ?? []).forEach((r) => remoteMap.set(`${r.kind}:${r.item_id}`, r));

  const [studies, groups, memory] = await Promise.all([
    getAllStudies(), getAllGroups(), getAllMemoryItems(),
  ]);
  const localItems = [
    ...studies.map((s) => ({ kind: 'study' as const, id: s.id, data: s as unknown, ts: tsOf('study', s) })),
    ...groups.map((g) => ({ kind: 'group' as const, id: g.id, data: g as unknown, ts: tsOf('group', g) })),
    ...memory.map((m) => ({ kind: 'memory' as const, id: m.id, data: m as unknown, ts: tsOf('memory', m) })),
  ];
  const localMap = new Map(localItems.map((l) => [`${l.kind}:${l.id}`, l]));

  // Remote → local (newer remote wins; tombstones delete)
  applying = true;
  try {
    for (const [key, r] of remoteMap) {
      const l = localMap.get(key);
      const localTs = l ? l.ts : -1;
      if (r.deleted) {
        if (l && r.updated_at >= localTs) await applyDelete(r.kind, r.item_id);
      } else if (!l || r.updated_at > localTs) {
        await applyUpsert(r.kind, r.data);
      }
    }
  } finally {
    applying = false;
  }

  // Local → remote (new locally, or local is newer)
  const toPush = localItems
    .filter((l) => {
      const r = remoteMap.get(`${l.kind}:${l.id}`);
      return !r || l.ts > r.updated_at;
    })
    .map((l) => ({ user_id: userId, kind: l.kind, item_id: l.id, data: l.data, updated_at: l.ts, deleted: false }));

  if (toPush.length) {
    const { error: upErr } = await supabase.from('sync_items').upsert(toPush, { onConflict: 'user_id,kind,item_id' });
    if (upErr) console.warn('[sync] push failed:', upErr.message);
  }
}

/** Begin syncing for a signed-in user (runs an initial full sync). */
export async function startSync(uid: string): Promise<void> {
  userId = uid;
  await fullSync();
}

/** Stop syncing (on sign-out). */
export function stopSync(): void {
  userId = null;
}
