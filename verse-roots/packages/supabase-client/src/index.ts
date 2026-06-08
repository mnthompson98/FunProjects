export { supabase, isSupabaseConfigured } from './client.js';
export { sendMagicLink, signOut, getCurrentUser, onAuthStateChange } from './auth.js';
export type { User } from './auth.js';
export { getSubscriptionStatus } from './subscription.js';
export type { SubscriptionStatus } from './subscription.js';
export {
  pushStudy,
  pullStudies,
  syncStudies,
  deleteStudyRemote,
} from './sync.js';
export type { SyncableStudy, StudyLocalDb } from './sync.js';
