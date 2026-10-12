import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── TEMP DEBUG ─── remove after fixing
console.log('[0] Supabase client init:', {
  url: supabaseUrl,
  keyPrefix: supabaseKey?.slice(0, 20),
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseKey,
});
// ─── END DEBUG ───

export const supabase = createClient(supabaseUrl, supabaseKey);