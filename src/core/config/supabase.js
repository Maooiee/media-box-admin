import { createClient } from '@supabase/supabase-js';

// Prefer Netlify/Vite env vars. Fall back to hardcoded values if they're missing
// at build time (Netlify env vars have been unreliable here).
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://qbefrttyhmhssdolbfhi.supabase.co';

const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_rNS9yqNHm0CcEF5iuud8Ig_chgMcior';

export const supabase = createClient(supabaseUrl, supabaseKey);