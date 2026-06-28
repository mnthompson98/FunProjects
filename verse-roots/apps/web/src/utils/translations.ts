import { isApiBibleConfigured } from './apiBible';

// Translations stored in Supabase (always available)
export const SUPABASE_TRANSLATIONS = ['KJV', 'ASV', 'WEB'];

// NIV is fetched from API.Bible when a key is configured
export const NIV_AVAILABLE = isApiBibleConfigured;

// Display order, NIV first when available
export const TRANSLATIONS = [...(NIV_AVAILABLE ? ['NIV'] : []), ...SUPABASE_TRANSLATIONS];

export const TRANSLATION_ATTRIBUTION: Record<string, string> = {
  KJV: 'KJV (public domain)',
  ASV: 'ASV (public domain)',
  WEB: 'WEB (public domain)',
  NIV: 'NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.®',
};
