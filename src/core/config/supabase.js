import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail loudly (rather than silently misbehaving) if the env vars are absent.
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase config: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY must be set at build time.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);